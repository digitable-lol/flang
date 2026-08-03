/**
 * Мост FTS → flang.
 *
 * Главный тест — сквозная сверка (§9 SPEC): все модели репозитория,
 * `examples/**\/*.fts` и `tools/ftsc/stdlib/**\/*.fts`, прогоняются через оба
 * движка на сетке входов, выведенной из примеров и границ условий. Совпадать
 * обязаны и значения, и коды ошибок: «мелких» расхождений тут не бывает —
 * либо обещание «любая модель FTS считается одинаково» выполняется, либо нет.
 */
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { globSync } from "node:fs"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { errorCode, evaluateFlang, fromFtsDocument, INPUT_PARAM, RESULT_BINDING, runExamples } from "../src/compat.mjs"

const root = fileURLToPath(new URL("../..", import.meta.url))
const core = await import(new URL("../../dist/src/index.js", import.meta.url).href)
const { parseModuleFile } = await import(new URL("../../tools/ftsc/src/parse-module.mjs", import.meta.url).href)

/* Движок flang — `interpret.mjs` через мост: своего вычислителя у моста нет. */
const engine = { name: "interpret.mjs", evaluate: evaluateFlang }

/* ─────────────────────────── загрузка моделей ───────────────────────────── */

async function loadModels() {
  const files = [
    ...globSync("examples/**/*.fts", { cwd: root }),
    ...globSync("tools/ftsc/stdlib/**/*.fts", { cwd: root }),
  ].sort()
  const models = []
  for (const file of files) {
    const source = await readFile(new URL(file, new URL("file://" + root)), "utf8")
    /* Файлы stdlib начинаются с заголовка `модуль …`, которого ядро не знает;
       файлы-функторы вовсе не содержат категории — они не документы FTS. */
    const parsed = parseModuleFile(source, file)
    if (parsed.kind !== "module") {
      models.push({ file, document: null, skipped: "файл-функтор, а не документ FTS" })
      continue
    }
    models.push({ file, document: core.compile(parsed.body) })
  }
  return models
}

const models = await loadModels()
const documents = models.filter((model) => model.document !== null)

/* ───────────────────────── сетка входных данных ─────────────────────────── */

/**
 * Сетка выводится из самой модели, а не выдумывается: значения из примеров,
 * все константы, встречающиеся в условиях/действиях/свойствах, и границы
 * вокруг числовых констант (c-1, c, c+1) — именно там прячутся расхождения
 * в `>` против `>=`. Для признаков — оба значения, для строк — примеры плюс
 * пустая строка.
 */
function inputGrid(structure, utility) {
  const constants = collectConstants(utility)
  const candidates = new Map()
  for (const field of structure.fields) {
    const values = new Set()
    for (const example of utility.examples) {
      if (field.name in example.input) values.add(example.input[field.name])
    }
    const type = field.type.replace(/\s*\|\s*undefined/gu, "").trim()
    if (type === "Число" || type === "Деньги" || type === "number") {
      for (const value of constants.numbers) {
        values.add(value - 1)
        values.add(value)
        values.add(value + 1)
      }
      values.add(0)
      values.add(1)
      values.add(-1)
    } else if (type === "Признак" || type === "boolean") {
      values.add(true)
      values.add(false)
    } else if (type === "Строка" || type === "Дата" || type === "string") {
      for (const value of constants.strings) values.add(value)
      values.add("")
    } else {
      /* Состояние («Скоринг пройден») — маркер доказательства, не значение;
         ядро его не проверяет. Берём то, что есть в примерах, иначе `да`. */
      if (values.size === 0) values.add(true)
    }
    candidates.set(field.name, [...values].slice(0, 12))
  }

  /* Пример целиком — обязательная точка сетки: он документирует намерение. */
  const grid = utility.examples.map((example) => ({ ...example.input }))
  const required = structure.fields.filter((field) => !field.type.includes("undefined"))
  const combinations = product(required.map((field) => candidates.get(field.name) ?? [null]), 4096)
  for (const combination of combinations) {
    const input = {}
    required.forEach((field, index) => {
      input[field.name] = combination[index]
    })
    grid.push(input)
  }
  return grid
}

function collectConstants(utility) {
  const numbers = new Set()
  const strings = new Set()
  const take = (value) => {
    if (typeof value === "number") numbers.add(value)
    if (typeof value === "string") strings.add(value)
  }
  const operand = (item) => {
    if (item.kind === "value") take(item.value)
    if (item.kind === "percent") numbers.add(item.percent)
  }
  take(utility.initial)
  for (const rule of utility.rules) {
    for (const condition of rule.when) operand(condition.value)
    operand(rule.action.value)
  }
  for (const property of utility.properties) operand(property.value)
  for (const example of utility.examples) for (const value of Object.values(example.input)) take(value)
  return { numbers, strings }
}

/** Декартово произведение с детерминированным обрезанием: тест воспроизводим. */
function product(lists, limit) {
  let combinations = [[]]
  for (const list of lists) {
    const next = []
    for (const combination of combinations) {
      for (const value of list) {
        if (next.length >= limit) break
        next.push([...combination, value])
      }
      if (next.length >= limit) break
    }
    combinations = next
  }
  return combinations
}

/* ─────────────────────────── сверка одного входа ────────────────────────── */

/** Итог вычисления в форме, которую можно сравнить у двух разных движков. */
function outcome(run) {
  try {
    return { ok: true, value: run() }
  } catch (error) {
    return { ok: false, code: errorCode(error), message: error instanceof Error ? error.message : String(error) }
  }
}

function sameOutcome(left, right) {
  if (left.ok !== right.ok) return false
  if (left.ok) return Object.is(left.value, right.value)
  /* Код ошибки — часть наблюдаемого поведения: `FTS_UTILITY_PROPERTY` обязан
     остаться `FTS_UTILITY_PROPERTY`, иначе вызывающая сторона не отличит
     нарушение свойства от поломки движка. */
  return left.code === right.code && left.message === right.message
}

/* ──────────────────────────────── тесты ─────────────────────────────────── */

test("объект FTS переводится в запись flang", () => {
  const document = core.compile(
    "категория «Продажи»\n\n  объект Покупка\n    сумма является деньгами\n    «постоянный клиент» является признаком\n",
  )
  const program = fromFtsDocument(document)
  assert.equal(program.flang, 1)
  assert.equal(program.module, "Продажи")
  assert.deepEqual(program.types[0].kind, "record")
  assert.equal(program.types[0].name, "Покупка")
  assert.deepEqual(program.types[0].fields, [
    { name: "сумма", type: { kind: "number" } },
    { name: "постоянный клиент", type: { kind: "boolean" } },
  ])
})

test("необязательное поле и состояние сохраняют исходный тип FTS", () => {
  const document = core.compile(
    "категория «Запрос»\n\n  объект Запрос\n    телефон иногда является строкой\n    проверен является состоянием «Проверен»\n",
  )
  const program = fromFtsDocument(document)
  assert.deepEqual(program.types[0].fields, [
    { name: "телефон", type: { kind: "string", optional: true } },
    { name: "проверен", type: { kind: "unknown", name: "Проверен" } },
  ])
  assert.equal(program.types[0].meta.fts["проверен"], "Проверен")
})

test("утилита переводится в тотальную функцию с примерами", async () => {
  const source = await readFile(new URL("../../examples/utilities/discount.fts", import.meta.url), "utf8")
  const program = fromFtsDocument(core.compile(source))
  const fn = program.functions[0]
  assert.equal(fn.name, "Рассчитать скидку")
  assert.equal(fn.total, true)
  assert.deepEqual(fn.params, [{ name: INPUT_PARAM, type: { kind: "record", name: "Покупка" } }])
  assert.deepEqual(fn.returns, { kind: "number" })
  assert.equal(fn.examples.length, 3)
  assert.deepEqual(fn.examples[1], {
    name: "Большая покупка",
    args: { [INPUT_PARAM]: { "сумма": 20000, "постоянный клиент": false } },
    expected: 2000,
  })
})

test("правила — цепочка независимых if, а не else", async () => {
  const source = await readFile(new URL("../../examples/utilities/discount.fts", import.meta.url), "utf8")
  const program = fromFtsDocument(core.compile(source))
  /* Тело: let результат0 = 0 → let результат1 = if … → let результат2 = if … */
  const names = []
  let node = program.functions[0].body
  while (node.kind === "let") {
    names.push(node.name)
    assert.equal(node.value.kind === "literal" || node.value.kind === "if", true)
    node = node.in
  }
  assert.deepEqual(names, ["результат0", "результат1", "результат2"])
  assert.deepEqual(node, { kind: "var", name: "результат2" })
  /* Оба правила истинны одновременно — значит суммируются, а не выбирается одно. */
  assert.equal(evaluateFlang(program, "Рассчитать скидку", { [INPUT_PARAM]: { "сумма": 20000, "постоянный клиент": true } }), 3000)
})

test("процент считается ровно как в ядре: (процент / 100) * поле", async () => {
  const source = await readFile(new URL("../../examples/utilities/discount.fts", import.meta.url), "utf8")
  const program = fromFtsDocument(core.compile(source))
  const rule = program.functions[0].body.in.value.then
  assert.equal(rule.op, "add")
  assert.equal(rule.right.kind, "binary")
  assert.equal(rule.right.op, "percent")
  assert.deepEqual(rule.right.left, { kind: "literal", value: 10 })
  assert.equal(rule.right.right.field, "сумма")
  /* Значение, где перестановка множителей была бы заметна. */
  const document = core.compile(source)
  const input = { "сумма": 10000.1, "постоянный клиент": false }
  assert.equal(
    evaluateFlang(program, "Рассчитать скидку", { [INPUT_PARAM]: input }),
    core.executeUtility(document, "Рассчитать скидку", input),
  )
})

test("нарушение свойства даёт тот же код и текст, что и ядро", () => {
  const document = core.compile(
    [
      "категория «Проверка»",
      "",
      "  объект Вход",
      "    сумма является числом",
      "",
      "  утилита «Только положительное»",
      "    принимает Вход",
      "    возвращает число",
      "    начинает с 0",
      "",
      "    правило «Взять сумму»",
      "      если сумма не меньше -1000",
      "      то результат равен поле сумма",
      "",
      "    свойство «Неотрицательно»",
      "      результат не меньше 0",
      "",
      "    пример «Ноль»",
      "      дано сумма равна 0",
      "      ожидается результат равен 0",
      "",
    ].join("\n"),
  )
  const program = fromFtsDocument(document)
  /* Свойство становится постусловием функции, а не веткой в теле: проверка
     обязана видеть готовый результат и не может «участвовать» в его расчёте. */
  const [postcondition] = program.functions[0].postconditions
  assert.equal(postcondition.name, "Неотрицательно")
  assert.equal(postcondition.bind, RESULT_BINDING)
  assert.equal(postcondition.code, "FTS_UTILITY_PROPERTY")
  assert.deepEqual(postcondition.expr, {
    kind: "binary",
    op: "gte",
    left: { kind: "var", name: RESULT_BINDING },
    right: { kind: "literal", value: 0 },
  })

  const input = { "сумма": -5 }
  const fromCore = outcome(() => core.executeUtility(document, "Только положительное", input))
  const fromFlang = outcome(() => evaluateFlang(program, "Только положительное", { [INPUT_PARAM]: input }))
  assert.equal(fromCore.ok, false)
  assert.equal(fromCore.code, "FTS_UTILITY_PROPERTY")
  assert.deepEqual(fromFlang, fromCore)
})

test("морфизмы и теорема сохранены как метаданные программы", async () => {
  const source = await readFile(new URL("../../examples/real-world/credit-limit.fts", import.meta.url), "utf8")
  const document = core.compile(source)
  const program = fromFtsDocument(document)
  assert.deepEqual(program.meta.fts.functors, document.functors)
  assert.deepEqual(program.meta.fts.proposition, document.proposition)
  /* Вычислительного аналога у них нет — функций из них не появляется. */
  assert.deepEqual(program.functions, [])
})

test("модели репозитория найдены и разобраны", () => {
  assert.ok(models.length >= 19, `ожидалось не меньше 19 моделей, найдено ${models.length}`)
  assert.ok(documents.length >= 17, `ожидалось не меньше 17 документов, найдено ${documents.length}`)
})

test("примеры всех моделей проходят на движке flang", () => {
  for (const model of documents) {
    if ((model.document.utilities ?? []).length === 0) continue
    const program = fromFtsDocument(model.document)
    const flang = runExamples(program, engine.evaluate)
    const fts = core.testUtilities(model.document)
    assert.equal(flang.total, fts.total, `${model.file}: разное число примеров`)
    assert.deepEqual(
      flang.results.map((result) => [result.function, result.example, result.passed, result.actual]),
      fts.results.map((result) => [result.utility, result.example, result.passed, result.actual]),
      `${model.file}: примеры считаются по-разному`,
    )
    assert.equal(flang.valid, true, `${model.file}: примеры не сошлись на движке flang`)
  }
})

test(`сквозная сверка с ядром на всех моделях репозитория (движок: ${engine.name})`, () => {
  const report = { models: 0, utilities: 0, inputs: 0, mismatches: [], errorOutcomes: 0, codes: new Set() }
  for (const model of documents) {
    const utilities = model.document.utilities ?? []
    if (utilities.length === 0) continue
    report.models += 1
    const program = fromFtsDocument(model.document)
    for (const utility of utilities) {
      report.utilities += 1
      const structure = model.document.structures.find((item) => item.name === utility.input)
      for (const input of inputGrid(structure, utility)) {
        report.inputs += 1
        const fromCore = outcome(() => core.executeUtility(model.document, utility.name, input))
        const fromFlang = outcome(() => engine.evaluate(program, utility.name, { [INPUT_PARAM]: input }))
        if (!fromCore.ok) {
          report.errorOutcomes += 1
          report.codes.add(fromCore.code)
        }
        if (!sameOutcome(fromCore, fromFlang)) {
          report.mismatches.push({
            file: model.file,
            utility: utility.name,
            input,
            core: fromCore,
            flang: fromFlang,
          })
        }
      }
    }
  }
  /* Отчёт печатается всегда: цифры сверки — часть результата, а не отладка. */
  console.log(
    `сверка: файлов ${models.length}, документов ${documents.length}, из них с утилитами ${report.models}; ` +
      `утилит ${report.utilities}, входов ${report.inputs}, ` +
      `из них с ошибкой ${report.errorOutcomes} (коды: ${[...report.codes].join(", ") || "нет"}), ` +
      `расхождений ${report.mismatches.length}`,
  )
  assert.deepEqual(report.mismatches.slice(0, 5), [], "движки разошлись")
  assert.ok(report.inputs > 1000, `сетка слишком мелкая: ${report.inputs} входов`)
  /* Сверка обязана задеть и путь ошибки, иначе совпадение кодов не проверено. */
  assert.ok(report.codes.has("FTS_UTILITY_PROPERTY"), "сетка не задела нарушение свойства")
})

/* ─────────────────────── CLI: check | run | test | ast ──────────────────── */

const CLI = fileURLToPath(new URL("../bin/flang.mjs", import.meta.url))
const exec = promisify(execFile)
const temporary = await mkdtemp(join(tmpdir(), "flang-compat-"))
after(() => rm(temporary, { recursive: true, force: true }))

async function cli(args) {
  try {
    const { stdout, stderr } = await exec(process.execPath, [CLI, ...args])
    return { code: 0, stdout, stderr }
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" }
  }
}

const discountFile = join(temporary, "discount.fts")
await writeFile(discountFile, await readFile(new URL("../../examples/utilities/discount.fts", import.meta.url), "utf8"))

test("flang check: модель FTS проходит разбор, типы и тотальность", async () => {
  const result = await cli(["check", discountFile])
  assert.equal(result.code, 0)
  assert.equal(result.stderr, "")
  const output = JSON.parse(result.stdout)
  assert.equal(output.valid, true)
  assert.deepEqual(output.functions, [{ name: "Рассчитать скидку", total: true }])
  assert.deepEqual(output.types, ["Покупка"])
})

test("flang check: все модели репозитория проходят проверку", async () => {
  /* Это тот же тезис, что и у моста, только со стороны инструмента: если хоть
     одна существующая модель не проходит `flang check`, обещание нарушено. */
  for (const model of documents) {
    /* Именно исходники: так проверяется и снятие заголовка «модуль …», с
       которого начинаются файлы stdlib. */
    const file = join(temporary, `${model.file.replace(/[\/]/gu, "_")}`)
    await writeFile(file, await readFile(new URL(model.file, new URL("file://" + root)), "utf8"))
    const result = await cli(["check", file])
    assert.equal(result.code, 0, `${model.file}: ${result.stderr}`)
  }
})

test("flang check: сломанный AST — диагностика в stderr и код 1", async () => {
  const file = join(temporary, "broken.json")
  await writeFile(file, JSON.stringify({ flang: 1, functions: [{ name: "Без тела" }] }))
  const result = await cli(["check", file])
  assert.equal(result.code, 1)
  assert.equal(result.stdout, "")
  const output = JSON.parse(result.stderr)
  assert.equal(output.valid, false)
  assert.ok(output.diagnostics.some((item) => item.code === "FLANG_PARSE"))
})

test("flang run: аргументы читаются как сама запись входа", async () => {
  const result = await cli([
    "run",
    discountFile,
    "--function",
    "Рассчитать скидку",
    "--args",
    JSON.stringify({ "сумма": 20000, "постоянный клиент": true }),
  ])
  assert.equal(result.code, 0)
  const output = JSON.parse(result.stdout)
  assert.equal(output.result, 3000)
  assert.deepEqual(output.args, { [INPUT_PARAM]: { "сумма": 20000, "постоянный клиент": true } })
})

test("flang run: явная форма {«вход»: …} тоже работает", async () => {
  const result = await cli([
    "run",
    discountFile,
    "--function",
    "Рассчитать скидку",
    "--args",
    JSON.stringify({ [INPUT_PARAM]: { "сумма": 5000, "постоянный клиент": false } }),
  ])
  assert.equal(result.code, 0)
  assert.equal(JSON.parse(result.stdout).result, 0)
})

test("flang run: нарушение свойства — код 1 и диагностика с кодом ядра", async () => {
  const result = await cli([
    "run",
    discountFile,
    "--function",
    "Рассчитать скидку",
    "--args",
    JSON.stringify({ "сумма": -100, "постоянный клиент": true }),
  ])
  assert.equal(result.code, 1)
  assert.equal(result.stdout, "")
  const output = JSON.parse(result.stderr)
  assert.equal(output.diagnostics[0].code, "FTS_UTILITY_PROPERTY")
})

test("flang run: без --function — код 2", async () => {
  const result = await cli(["run", discountFile])
  assert.equal(result.code, 2)
  assert.equal(JSON.parse(result.stderr).diagnostics[0].code, "FLANG_CLI")
})

test("flang test: примеры модели со снятым заголовком модуля ftsc", async () => {
  const file = join(temporary, "query.fts")
  await writeFile(file, await readFile(new URL("../../tools/ftsc/stdlib/http/query.fts", import.meta.url), "utf8"))
  const result = await cli(["test", file])
  assert.equal(result.code, 0)
  const output = JSON.parse(result.stdout)
  assert.equal(output.valid, true)
  assert.equal(output.total, 6)
})

test("flang test: непройденный пример — код 1 и отчёт в stderr", async () => {
  const program = fromFtsDocument(core.compile("категория «К»\n\n  объект В\n    x является числом\n"))
  program.functions.push({
    name: "Единица",
    total: true,
    params: [],
    returns: { kind: "number" },
    body: { kind: "literal", value: 1 },
    examples: [{ name: "Не сойдётся", args: {}, expected: 2 }],
  })
  const file = join(temporary, "failing.json")
  await writeFile(file, JSON.stringify(program))
  const result = await cli(["test", file])
  assert.equal(result.code, 1)
  assert.equal(result.stdout, "")
  const output = JSON.parse(result.stderr)
  assert.equal(output.valid, false)
  assert.equal(output.results[0].actual, 1)
})

test("flang ast: печатает AST, который снова читается инструментом", async () => {
  const printed = await cli(["ast", discountFile])
  assert.equal(printed.code, 0)
  const program = JSON.parse(printed.stdout)
  assert.equal(program.flang, 1)
  const file = join(temporary, "roundtrip.json")
  await writeFile(file, printed.stdout)
  const again = await cli(["ast", file])
  assert.deepEqual(JSON.parse(again.stdout), program)
})

test("flang: неизвестная команда — код 2 и подсказка в stderr", async () => {
  const result = await cli(["летать", discountFile])
  assert.equal(result.code, 2)
  assert.match(result.stderr, /unknown command/u)
})

test("flang version: версия в stdout и код 0", async () => {
  const result = await cli(["version"])
  assert.equal(result.code, 0)
  assert.match(result.stdout, /^\d+\.\d+\.\d+/u)
})
