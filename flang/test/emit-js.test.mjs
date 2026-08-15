/**
 * Печать flang → JavaScript.
 *
 * Главный тест здесь один и он же — единственный осмысленный: **сверка с
 * интерпретатором**. Кодогенератор не имеет права быть «почти правильным»:
 * либо напечатанный модуль на каждом входе даёт то же значение и ту же ошибку
 * (код и текст), что `interpret.mjs`, либо результатам сгенерированного кода
 * нельзя верить вовсе.
 *
 * Поэтому каждая программа прогоняется через оба движка на сетке входов, а
 * напечатанный код исполняется по-настоящему: записывается во временный файл и
 * загружается динамическим `import`. Никаких `eval` со срезанными углами —
 * проверяем ровно тот артефакт, который получит пользователь.
 *
 * Набор программ: все модели репозитория через `compat.mjs` (обещание §9
 * SPEC), рекурсия по списку, обход дерева-суммы, взаимная рекурсия, нарушение
 * постусловия, строковые формы на кириллице и суррогатных парах, и хвостовая
 * рекурсия на 100 000 шагов — последняя ловит ровно ту ошибку, ради которой
 * эмиттер разворачивает хвостовые самовызовы в цикл.
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

import { errorCode, fromFtsDocument, INPUT_PARAM } from "../src/compat.mjs"
import { evaluate as interpret, variant } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"
import { emitJs } from "../src/emit/js.mjs"
import { camel, pascal } from "../../tools/ftsc/src/naming.mjs"
import { globSync } from "./glob.mjs"

const root = fileURLToPath(new URL("../..", import.meta.url))
const core = await import(new URL("../../dist/src/index.js", import.meta.url).href)
const { parseModuleFile } = await import(new URL("../../tools/ftsc/src/parse-module.mjs", import.meta.url).href)

/* ─────────────────────── загрузка напечатанного модуля ──────────────────── */

const workdir = await mkdtemp(join(tmpdir(), "flang-emit-js-"))
after(async () => {
  await rm(workdir, { recursive: true, force: true })
})

let serial = 0

/**
 * Печатает программу, кладёт файл на диск и загружает его как модуль.
 *
 * Файлов у цели два: сама программа и прогонщик (`flang_cli.js`) — тот же, что
 * у остальных семи целей. Здесь берётся ПЕРВЫЙ, и это не удобство порядка:
 * модуль обязан оставаться самодостаточным и работать в браузере, поэтому
 * прогонщика он не импортирует и без него полон. Прогонщик проверяется своим
 * файлом (`emit-js-cli.test.mjs`) — настоящим запуском, а не чтением.
 */
async function build(program, options) {
  const emitted = emitJs(program, options)
  assert.deepEqual(
    emitted.files.map((file) => file.path).slice(1),
    ["flang_cli.js"],
    "одна программа — один модуль и один прогонщик",
  )
  serial += 1
  const path = join(workdir, `m${serial}-${emitted.files[0].path}`)
  await writeFile(path, emitted.files[0].content, "utf8")
  const module = await import(pathToFileURL(path).href)
  return { module, content: emitted.files[0].content, path }
}

/* Идентификатор экспорта функции: тот же camel из naming.mjs, что у эмиттера. */
function exportName(name) {
  const ident = camel(name)
  return /^[A-Za-z_$]/u.test(ident) ? ident : `_${ident}`
}

/* ─────────────────────────── сравнение результатов ──────────────────────── */

/**
 * Вариант напечатанного модуля — экземпляр его собственного класса, а не класса
 * `builtins.mjs`: у модуля с нулём зависимостей другого выбора нет. Значит
 * сравнивать значения двух движков можно только структурно — по форме, а не по
 * прототипу.
 */
function isVariantLike(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.variant === "string" &&
    typeof value.fields === "object" &&
    value.fields !== null
  )
}

function sameValue(left, right) {
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return Object.is(left, right)
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((item, index) => sameValue(item, right[index]))
  }
  if (isVariantLike(left) || isVariantLike(right)) {
    if (!isVariantLike(left) || !isVariantLike(right)) return false
    return left.variant === right.variant && sameValue(left.fields, right.fields)
  }
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  if (leftKeys.length !== rightKeys.length) return false
  if (!leftKeys.every((key, index) => key === rightKeys[index])) return false
  return leftKeys.every((key) => sameValue(left[key], right[key]))
}

/** Итог вычисления в форме, сравнимой у двух разных движков. */
function outcome(run) {
  try {
    return { ok: true, value: run() }
  } catch (error) {
    return { ok: false, code: errorCode(error), message: error instanceof Error ? error.message : String(error) }
  }
}

function sameOutcome(left, right) {
  if (left.ok !== right.ok) return false
  if (left.ok) return sameValue(left.value, right.value)
  /* Код и текст ошибки — часть наблюдаемого поведения: вызывающий отличает
     нарушение свойства от поломки движка именно по ним. */
  return left.code === right.code && left.message === right.message
}

function describeOutcome(result) {
  return result.ok ? `значение ${JSON.stringify(result.value) ?? String(result.value)}` : `${result.code}: ${result.message}`
}

/**
 * Сверка одной функции на сетке входов. Возвращает число сверенных точек —
 * тест обязан не просто «не упасть», но и показать, что сверял хоть что-то.
 */
function compare(program, module, functionName, grid, options = {}) {
  const fn = (program.functions ?? []).find((item) => item.name === functionName)
  assert.ok(fn, `в программе нет функции «${functionName}»`)
  const emitted = module[exportName(functionName)]
  assert.equal(typeof emitted, "function", `модуль не экспортирует «${functionName}»`)
  const params = fn.params.map((param) => (typeof param === "string" ? param : param.name))

  for (const point of grid) {
    const args = Array.isArray(point) ? point : params.map((name) => point[name])
    const byInterpreter = outcome(() => interpret(program, functionName, args, options.limits ?? {}))
    const byEmitted = outcome(() => emitted(...args.map((value) => options.adapt ? options.adapt(value) : value)))
    assert.ok(
      sameOutcome(byInterpreter, byEmitted),
      `«${functionName}» на входе ${JSON.stringify(args) ?? "?"}: интерпретатор дал ${describeOutcome(byInterpreter)}, ` +
        `напечатанный код дал ${describeOutcome(byEmitted)}`,
    )
  }
  return grid.length
}

/* ══════════════════════════ 1. модели репозитория ═══════════════════════════ */

async function loadModels() {
  const files = [
    ...globSync("examples/**/*.fts", { cwd: root }),
    ...globSync("tools/ftsc/stdlib/**/*.fts", { cwd: root }),
  ].sort()
  const models = []
  for (const file of files) {
    const source = await readFile(join(root, file), "utf8")
    /* Файлы-функторы не документы FTS: у них нет категории, и компилятор ядра
       их не принимает. */
    const parsed = parseModuleFile(source, file)
    if (parsed.kind !== "module") continue
    models.push({ file, document: core.compile(parsed.body) })
  }
  return models
}

const models = await loadModels()

/**
 * Сетка выводится из самой модели: значения примеров, все константы условий и
 * границы вокруг них (c−1, c, c+1) — именно там прячется разница между `>` и
 * `>=`. Выдуманная сетка проверяла бы фантазию автора теста, а не модель.
 */
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
    } else if (values.size === 0) {
      values.add(true)
    }
    candidates.set(field.name, [...values].slice(0, 10))
  }

  const grid = utility.examples.map((example) => ({ ...example.input }))
  const required = structure.fields.filter((field) => !field.type.includes("undefined"))
  for (const combination of product(required.map((field) => candidates.get(field.name) ?? [null]), 2048)) {
    const input = {}
    required.forEach((field, index) => {
      input[field.name] = combination[index]
    })
    grid.push(input)
  }
  return grid
}

test("все модели репозитория: напечатанный JS совпадает с интерпретатором", async (t) => {
  assert.ok(models.length > 0, "модели репозитория не найдены — тест бессмыслен")
  let programs = 0
  let functions = 0
  let points = 0

  for (const model of models) {
    const program = fromFtsDocument(model.document)
    if ((program.functions ?? []).length === 0) continue
    const { module } = await build(program)
    programs += 1

    const byName = new Map(model.document.structures.map((structure) => [structure.name, structure]))
    for (const utility of model.document.utilities) {
      const structure = byName.get(utility.input)
      const grid = inputGrid(structure, utility).map((input) => ({ [INPUT_PARAM]: input }))
      points += compare(program, module, utility.name, grid)
      functions += 1
    }
  }

  t.diagnostic(`моделей: ${programs}, функций: ${functions}, сверенных входов: ${points}`)
  assert.ok(programs >= 5, `моделей с утилитами слишком мало: ${programs}`)
  assert.ok(points > 1000, `сетка слишком редкая: ${points}`)
})

test("примеры моделей считаются одинаково обоими движками и ядром FTS", async () => {
  let checked = 0
  for (const model of models) {
    const program = fromFtsDocument(model.document)
    if ((program.functions ?? []).length === 0) continue
    const { module } = await build(program)
    for (const utility of model.document.utilities) {
      for (const example of utility.examples) {
        const byCore = outcome(() => core.executeUtility(model.document, utility.name, example.input))
        const args = { [INPUT_PARAM]: example.input }
        const byInterpreter = outcome(() => interpret(program, utility.name, args))
        const byEmitted = outcome(() => module[exportName(utility.name)](args[INPUT_PARAM]))
        assert.ok(sameOutcome(byInterpreter, byEmitted), `${utility.name} / ${example.name}: движки разошлись`)
        if (byCore.ok) assert.ok(sameValue(byCore.value, byEmitted.value), `${utility.name} / ${example.name}: ядро разошлось с печатью`)
        checked += 1
      }
    }
  }
  assert.ok(checked > 0)
})

/* ══════════════════════════ 2. рекурсия по списку ═══════════════════════════ */

/* Не хвостовая: результат вызова ещё складывается с головой. Такая функция
   печатается обычной рекурсией — как и в интерпретаторе, глубина растёт. */
const listProgram = {
  flang: 1,
  module: "Списки",
  functions: [
    {
      name: "Сумма",
      total: true,
      params: [{ name: "элементы", type: { kind: "list", of: { kind: "number" } } }],
      returns: { kind: "number" },
      body: {
        kind: "match",
        target: { kind: "var", name: "элементы" },
        cases: [
          { pattern: { kind: "empty" }, body: { kind: "literal", value: 0 } },
          {
            pattern: { kind: "cons", head: "голова", tail: "хвост" },
            body: {
              kind: "binary",
              op: "add",
              left: { kind: "var", name: "голова" },
              right: { kind: "call", name: "Сумма", args: [{ kind: "var", name: "хвост" }] },
            },
          },
        ],
      },
    },
    {
      name: "Удвоить",
      total: true,
      params: [{ name: "элементы", type: { kind: "list", of: { kind: "number" } } }],
      returns: { kind: "list", of: { kind: "number" } },
      body: {
        kind: "map",
        over: { kind: "var", name: "элементы" },
        item: "элемент",
        body: {
          kind: "binary",
          op: "mul",
          left: { kind: "var", name: "элемент" },
          right: { kind: "literal", value: 2 },
        },
      },
    },
    {
      name: "Положительные",
      total: true,
      params: [{ name: "элементы", type: { kind: "list", of: { kind: "number" } } }],
      returns: { kind: "list", of: { kind: "number" } },
      body: {
        kind: "filter",
        over: { kind: "var", name: "элементы" },
        item: "элемент",
        body: {
          kind: "binary",
          op: "gt",
          left: { kind: "var", name: "элемент" },
          right: { kind: "literal", value: 0 },
        },
      },
    },
    {
      name: "Свернуть",
      total: true,
      params: [{ name: "элементы", type: { kind: "list", of: { kind: "number" } } }],
      returns: { kind: "number" },
      body: {
        kind: "fold",
        over: { kind: "var", name: "элементы" },
        init: { kind: "literal", value: 1 },
        acc: "накопитель",
        item: "элемент",
        body: {
          kind: "binary",
          op: "mul",
          left: { kind: "var", name: "накопитель" },
          right: { kind: "var", name: "элемент" },
        },
      },
    },
  ],
}

test("рекурсия по списку, отобразить, отфильтровать и свёртка", async (t) => {
  const { module } = await build(listProgram)
  const lists = [
    [],
    [1],
    [1, 2, 3],
    [-1, 0, 1],
    [0.1, 0.2, 0.3],
    [1e308, 1e308],
    [Number.NaN, 1],
    [-0],
    Array.from({ length: 200 }, (_, index) => index - 100),
    /* Заведомо неверные входы: коды ошибок обязаны совпасть так же, как значения. */
    "не список",
    null,
    [1, "два", 3],
    [[1], [2]],
  ]
  const grid = lists.map((value) => [value])
  let points = 0
  for (const name of ["Сумма", "Удвоить", "Положительные", "Свернуть"]) {
    points += compare(listProgram, module, name, grid)
  }
  t.diagnostic(`сверенных входов: ${points}`)
})

/* ══════════════════════════ 3. дерево-сумма ═══════════════════════════ */

const treeProgram = {
  flang: 1,
  module: "Деревья",
  types: [
    {
      kind: "sum",
      name: "Дерево",
      variants: [
        { name: "Лист", fields: [{ name: "значение", type: { kind: "number" } }] },
        {
          name: "Узел",
          fields: [
            { name: "левое", type: { kind: "sum", name: "Дерево" } },
            { name: "правое", type: { kind: "sum", name: "Дерево" } },
          ],
        },
        { name: "Пустое", fields: [] },
      ],
    },
  ],
  functions: [
    {
      name: "Сумма дерева",
      total: true,
      params: [{ name: "дерево", type: { kind: "sum", name: "Дерево" } }],
      returns: { kind: "number" },
      body: {
        kind: "match",
        target: { kind: "var", name: "дерево" },
        cases: [
          { pattern: { kind: "variant", name: "Пустое", bind: {} }, body: { kind: "literal", value: 0 } },
          {
            pattern: { kind: "variant", name: "Лист", bind: { "значение": "значение" } },
            body: { kind: "var", name: "значение" },
          },
          {
            pattern: { kind: "variant", name: "Узел", bind: { "левое": "левое", "правое": "правое" } },
            body: {
              kind: "binary",
              op: "add",
              left: { kind: "call", name: "Сумма дерева", args: [{ kind: "var", name: "левое" }] },
              right: { kind: "call", name: "Сумма дерева", args: [{ kind: "var", name: "правое" }] },
            },
          },
        ],
      },
    },
    {
      name: "Удвоить дерево",
      total: true,
      params: [{ name: "дерево", type: { kind: "sum", name: "Дерево" } }],
      returns: { kind: "sum", name: "Дерево" },
      body: {
        kind: "match",
        target: { kind: "var", name: "дерево" },
        cases: [
          {
            pattern: { kind: "variant", name: "Лист", bind: { "значение": "значение" } },
            body: {
              kind: "construct",
              variant: "Лист",
              fields: {
                "значение": {
                  kind: "binary",
                  op: "mul",
                  left: { kind: "var", name: "значение" },
                  right: { kind: "literal", value: 2 },
                },
              },
            },
          },
          {
            pattern: { kind: "variant", name: "Узел", bind: { "левое": "л", "правое": "п" } },
            body: {
              kind: "construct",
              variant: "Узел",
              fields: {
                "левое": { kind: "call", name: "Удвоить дерево", args: [{ kind: "var", name: "л" }] },
                "правое": { kind: "call", name: "Удвоить дерево", args: [{ kind: "var", name: "п" }] },
              },
            },
          },
          { pattern: { kind: "any" }, body: { kind: "construct", variant: "Пустое", fields: {} } },
        ],
      },
    },
  ],
}

/** Переносит значение интерпретатора в представление напечатанного модуля. */
function adaptTo(module) {
  const walk = (value) => {
    if (Array.isArray(value)) return value.map(walk)
    if (value !== null && typeof value === "object") {
      if (isVariantLike(value)) {
        const constructor = module[pascal(value.variant)]
        assert.equal(typeof constructor, "function", `модуль не экспортирует конструктор «${value.variant}»`)
        const fields = {}
        for (const [key, item] of Object.entries(value.fields)) fields[key] = walk(item)
        return constructor(fields)
      }
      const record = {}
      for (const [key, item] of Object.entries(value)) record[key] = walk(item)
      return record
    }
    return value
  }
  return walk
}

test("обход дерева-суммы: конструкторы вариантов и разбор дискриминанта", async (t) => {
  const { module, content } = await build(treeProgram)
  assert.match(content, /export function List\(/u, "конструктор варианта «Лист» обязан быть экспортирован")
  assert.match(content, /\.variant === "Узел"/u, "разбор — это проверка дискриминанта")

  const лист = (n) => variant("Лист", { "значение": n })
  const узел = (l, r) => variant("Узел", { "левое": l, "правое": r })
  const глубокое = (depth) => (depth === 0 ? лист(1) : узел(глубокое(depth - 1), лист(depth)))

  const grid = [
    [variant("Пустое", {})],
    [лист(5)],
    [узел(лист(1), лист(2))],
    [узел(узел(лист(1), лист(2)), узел(лист(3), лист(4)))],
    [глубокое(500)],
    /* Разбор без подходящего случая и обращение к отсутствующему полю: коды
       FLANG_MATCH_NOT_EXHAUSTIVE и FLANG_UNKNOWN_NAME обязаны совпасть. */
    [variant("Лист", {})],
    [42],
    [null],
    [{ "значение": 1 }],
  ]
  const points = compare(treeProgram, module, "Сумма дерева", grid, { adapt: adaptTo(module) }) +
    compare(treeProgram, module, "Удвоить дерево", grid, { adapt: adaptTo(module) })
  t.diagnostic(`сверенных входов: ${points}`)
})

test("$callDeep: значение переживает границу потока — вариант остаётся вариантом", async (t) => {
  /*
   * Расчёт под объявленный предел глубины уезжает в поток с заданным стеком
   * (`$callDeep`), и значение едет туда и обратно копированием. Копирование
   * теряет ПРОТОТИП: вариант приехал бы обычной записью, разбор дискриминанта
   * перестал бы находить случай, и модуль отвечал бы не то — молча. Поэтому вид
   * значения едет тегом, а тег проверяется здесь: результат обязан совпасть с
   * результатом прямого вызова СТРУКТУРНО и остаться экземпляром класса модуля.
   */
  const { module } = await build(treeProgram)
  const лист = (n) => variant("Лист", { "значение": n })
  const узел = (l, r) => variant("Узел", { "левое": l, "правое": r })
  const adapt = adaptTo(module)

  const входы = [
    variant("Пустое", {}),
    лист(5),
    лист(-0),
    лист(Number.NaN),
    лист(Number.POSITIVE_INFINITY),
    узел(узел(лист(1), лист(2)), узел(лист(3), лист(4))),
  ]
  for (const вход of входы) {
    const свой = module.udvoitDerevo(adapt(вход))
    const дальний = await module.$callDeep(module.udvoitDerevo, [adapt(вход)])
    assert.ok(sameValue(свой, дальний), `${JSON.stringify(вход)}: поток вернул не то же значение`)
    assert.equal(
      Object.getPrototypeOf(дальний),
      Object.getPrototypeOf(свой),
      "вариант обязан вернуться вариантом этого же модуля, а не обычной записью",
    )
    /* И дискриминант обязан ЧИТАТЬСЯ, а не только совпадать по форме: значение
       из потока должно годиться следующей функции модуля как своё. */
    assert.equal(module.summaDereva(дальний), module.summaDereva(свой))
  }

  /* Отказ через границу тоже обязан остаться отказом языка, а не превратиться
     в чужую ошибку без кода. */
  const беда = await module.$callDeep(module.summaDereva, [42]).then(
    (значение) => ({ значение }),
    (ошибка) => ({ code: ошибка.code, message: ошибка.message }),
  )
  const своя = (() => {
    try {
      return { значение: module.summaDereva(42) }
    } catch (ошибка) {
      return { code: ошибка.code, message: ошибка.message }
    }
  })()
  assert.deepEqual(беда, своя, "отказ из потока обязан быть тем же отказом языка — код и текст")
  assert.equal(беда.code, "FLANG_MATCH_NOT_EXHAUSTIVE", `а не чужой ошибкой: ${JSON.stringify(беда)}`)

  t.diagnostic(`через поток пронесено ${входы.length} значений, включая −0, NaN и бесконечность`)
})

/* ══════════════════════════ 4. взаимная рекурсия ═══════════════════════════ */

/* Хвостовые вызовы друг друга: компонента сильной связности из двух функций,
   которой эмиттер обязан дать батут. Без него глубина стека JS росла бы там,
   где интерпретатор переиспользует кадр возврата. */
const mutualProgram = {
  flang: 1,
  module: "Чётность",
  functions: [
    {
      name: "Чётное",
      params: [{ name: "н", type: { kind: "number" } }],
      returns: { kind: "boolean" },
      body: {
        kind: "if",
        cond: { kind: "binary", op: "lte", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 0 } },
        then: { kind: "literal", value: true },
        else: {
          kind: "call",
          name: "Нечётное",
          args: [{ kind: "binary", op: "sub", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 1 } }],
        },
      },
    },
    {
      name: "Нечётное",
      params: [{ name: "н", type: { kind: "number" } }],
      returns: { kind: "boolean" },
      body: {
        kind: "if",
        cond: { kind: "binary", op: "lte", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 0 } },
        then: { kind: "literal", value: false },
        else: {
          kind: "call",
          name: "Чётное",
          args: [{ kind: "binary", op: "sub", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 1 } }],
        },
      },
    },
  ],
}

test("взаимная рекурсия совпадает с интерпретатором", async (t) => {
  const { module, content } = await build(mutualProgram)
  assert.match(content, /\$trampoline\(/u, "взаимная хвостовая рекурсия печатается через батут")

  const grid = [-1, 0, 1, 2, 3, 10, 11, 999, 1000].map((value) => [value])
  const points = compare(mutualProgram, module, "Чётное", grid) +
    compare(mutualProgram, module, "Нечётное", grid)
  t.diagnostic(`сверенных входов: ${points}`)
})

test("взаимная хвостовая рекурсия держит постоянную глубину стека", async () => {
  const { module } = await build(mutualProgram)
  const limits = { maxSteps: 100_000_000, maxDepth: 16 }
  /* maxDepth = 16 в интерпретаторе — доказательство, что вызовы действительно
     хвостовые: без переиспользования кадра он упёрся бы в лимит на 17-м шаге. */
  assert.equal(interpret(mutualProgram, "Чётное", [50_000], limits), true)
  assert.equal(module[exportName("Чётное")](50_000), true)
  assert.equal(module[exportName("Нечётное")](50_001), true)
})

/* ══════════════════════════ 5. хвостовая рекурсия на 100 000 шагов ═══════════ */

/* Ключевой тест слоя. Интерпретатор переиспользует кадр возврата, поэтому
   считает 100 000 шагов в постоянной глубине. Напечатанный «в лоб» код упал бы
   здесь с RangeError — именно поэтому хвостовой самовызов разворачивается в
   `for (;;)`. */
const countdownProgram = {
  flang: 1,
  module: "Отсчёт",
  functions: [
    {
      name: "Отсчёт",
      params: [
        { name: "н", type: { kind: "number" } },
        { name: "накопитель", type: { kind: "number" } },
      ],
      returns: { kind: "number" },
      body: {
        kind: "if",
        cond: { kind: "binary", op: "lte", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 0 } },
        then: { kind: "var", name: "накопитель" },
        else: {
          kind: "call",
          name: "Отсчёт",
          args: [
            { kind: "binary", op: "sub", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 1 } },
            { kind: "binary", op: "add", left: { kind: "var", name: "накопитель" }, right: { kind: "var", name: "н" } },
          ],
        },
      },
    },
  ],
}

test("хвостовой самовызов развёрнут в цикл: 100 000 шагов проходят", async (t) => {
  const { module, content } = await build(countdownProgram)
  assert.match(content, /for \(;;\) \{/u, "хвостовой самовызов обязан стать циклом")
  assert.match(content, /^ +continue$/mu, "цикл обязан замыкаться на continue, а не на рекурсию")
  assert.doesNotMatch(content, /return otschyot\(/u, "самовызова в напечатанном коде остаться не должно")

  const expected = (100_000 * 100_001) / 2
  /* maxDepth = 8 — доказательство хвостовой природы вызова: без переиспользования
     кадра интерпретатор упёрся бы в лимит на девятом шаге, а не на сотнетысячном. */
  const byInterpreter = interpret(countdownProgram, "Отсчёт", [100_000, 0], { maxSteps: 100_000_000, maxDepth: 8 })
  assert.equal(byInterpreter, expected)
  assert.equal(module[exportName("Отсчёт")](100_000, 0), expected)

  /* И на мелких входах — обычная сверка: цикл не должен поменять семантику. */
  const grid = [-1, 0, 1, 2, 7, 1000].map((value) => [value, 0])
  const points = compare(countdownProgram, module, "Отсчёт", grid, { limits: { maxSteps: 10_000_000 } })
  t.diagnostic(`100 000 шагов пройдено обоими движками; дополнительно сверено входов: ${points}`)
})

/* Нехвостовой спуск по ЧИСЛУ, а не по списку: рекурсия по списку разбирает его
   образцом «голова и хвост», и хвост — это новый массив, то есть на глубине N
   она стоит O(N²) памяти. Здесь нужна глубина в десятки тысяч кадров и ноль
   аллокаций, иначе кончится куча, а не стек, и мерить будет нечего. */
const descentProgram = {
  flang: 1,
  module: "Спуск",
  functions: [
    {
      name: "Спуск",
      params: [{ name: "н", type: { kind: "number" } }],
      returns: { kind: "number" },
      body: {
        kind: "if",
        cond: { kind: "binary", op: "lte", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 0 } },
        then: { kind: "literal", value: 0 },
        else: {
          kind: "binary",
          op: "add",
          left: { kind: "literal", value: 1 },
          right: {
            kind: "call",
            name: "Спуск",
            args: [{ kind: "binary", op: "sub", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 1 } }],
          },
        },
      },
    },
  ],
}

/* Незавершающаяся обычная функция: считает ВВЕРХ, дна у неё нет. Ловить её
   глубиной нечем — хвостовой самовызов кадра не растит, — поэтому она и есть
   проверка на предел ВИТКОВ. */
const foreverProgram = {
  flang: 1,
  module: "Вечность",
  functions: [
    {
      name: "Вечность",
      params: [{ name: "н", type: { kind: "number" } }],
      returns: { kind: "number" },
      body: {
        kind: "if",
        cond: { kind: "binary", op: "lt", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 0 } },
        then: { kind: "literal", value: 0 },
        else: {
          kind: "call",
          name: "Вечность",
          args: [{ kind: "binary", op: "add", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 1 } }],
        },
      },
    },
  ],
}

test("нехвостовая рекурсия глубже предела даёт FLANG_RECURSION_LIMIT у обоих движков", async (t) => {
  /* Тот же тест, что у остальных семи целей, и здесь он был единственным
     отсутствующим. У интерпретатора переполнение стека невозможно (стек в куче),
     у JS — возможно и приходит RangeError, у которого `code` пуст. Отказ с пустым
     кодом не входит в закрытый набор видов отказа, то есть обещание «тотальная
     функция завершится ИЛИ ОТКАЖЕТ ЧЕСТНО» на нём не держится. Значит счётчик
     обязателен, и его код с текстом обязаны совпасть с интерпретатором. */
  const { module, content } = await build(listProgram)
  assert.match(content, /\$enter\("Сумма"\)/u, "рекурсивная функция обязана считать глубину")
  assert.match(content, /FLANG_RECURSION_LIMIT/u, "предел обязан давать объявленный код")

  /* Предел взят низким намеренно: так упирается СЧЁТЧИК, а не стек хозяина, и
     сверять с интерпретатором можно не только код, но и текст. */
  module.$newContext({ maxDepth: 20, maxSteps: 10_000_000 })
  const long = Array.from({ length: 40 }, (_, index) => index)
  const points = compare(listProgram, module, "Сумма", [[long]], {
    limits: { maxDepth: 20, maxSteps: 10_000_000 },
  })
  assert.equal(points, 1)

  const byEmitted = outcome(() => module[exportName("Сумма")](long))
  assert.equal(byEmitted.ok, false)
  assert.equal(byEmitted.code, "FLANG_RECURSION_LIMIT")
  assert.match(byEmitted.message, /^функция «Сумма» превысила предел глубины вызовов \(20\) на глубине 21$/u)

  /* А теперь то же на пределах ПО УМОЛЧАНИЮ. Здесь стек хозяина кончается раньше
     объявленного предела (у V8 холодных кадров меньше десяти тысяч, и поднять
     стек изнутри модуля нечем), поэтому текст обязан назвать хозяина — но КОД
     обязан остаться объявленным. Именно этого раньше и не было: наружу выходил
     RangeError с `code === undefined`. */
  const descent = await build(descentProgram)
  const спуск = descent.module[exportName("Спуск")]
  assert.equal(спуск(100), 100, "неглубокая рекурсия обязана считаться как раньше")
  let raw = null
  try {
    спуск(200_000)
    assert.fail("рекурсия на 200 000 кадров обязана отказать, а не досчитать")
  } catch (error) {
    raw = error
  }
  assert.equal(raw.code, "FLANG_RECURSION_LIMIT", `глубокая рекурсия обязана давать объявленный отказ: ${raw.message}`)
  assert.ok(
    !(raw instanceof RangeError),
    `RangeError наружу выпускать нельзя — его код не входит в набор видов отказа: ${raw.message}`,
  )
  /* Счётчик обязан вернуться: иначе первый же отказ навсегда съел бы предел, и
     следующий вызов отказал бы на пустом месте. */
  assert.equal(спуск(100), 100, "после отказа глубина обязана вернуться к нулю")
  const deep = { message: raw.message }

  /* И предел ВИТКОВ: хвостовой самовызов глубину не растит, поэтому раньше
     незавершающаяся функция крутилась вечно — в браузере это смерть вкладки. */
  const forever = await build(foreverProgram)
  const spun = outcome(() => forever.module[exportName("Вечность")](1))
  assert.equal(spun.ok, false)
  assert.equal(spun.code, "FLANG_RECURSION_LIMIT", "незавершающаяся функция обязана упереться в предел витков")
  assert.deepEqual(
    outcome(() => interpret(foreverProgram, "Вечность", [1])),
    { ok: false, code: spun.code, message: spun.message },
    "и код, и текст обязаны совпасть с интерпретатором",
  )
  t.diagnostic(`объявленный отказ на глубине ${deep.message.replace(/^.*глубине /u, "")}; витки: ${spun.message}`)
})

test("внутренний цикл не перехватывает continue хвостового самовызова", async () => {
  /* `отфильтровать` печатается как `for … of`, а хвостовой самовызов — как
     `continue`. Если бы `continue` оказался внутри цикла коллекции, функция
     молча зациклилась бы на первом же элементе. */
  const program = {
    flang: 1,
    module: "Цикл в цикле",
    functions: [
      {
        name: "Свести",
        params: [{ name: "элементы" }, { name: "итог" }],
        body: {
          kind: "match",
          target: { kind: "var", name: "элементы" },
          cases: [
            { pattern: { kind: "empty" }, body: { kind: "var", name: "итог" } },
            {
              pattern: { kind: "cons", head: "г", tail: "х" },
              body: {
                kind: "let",
                name: "положительные",
                value: {
                  kind: "filter",
                  over: { kind: "var", name: "х" },
                  item: "э",
                  body: { kind: "binary", op: "gt", left: { kind: "var", name: "э" }, right: { kind: "literal", value: 0 } },
                },
                in: {
                  kind: "call",
                  name: "Свести",
                  args: [
                    { kind: "var", name: "положительные" },
                    { kind: "binary", op: "add", left: { kind: "var", name: "итог" }, right: { kind: "var", name: "г" } },
                  ],
                },
              },
            },
          ],
        },
      },
    ],
  }
  const { module } = await build(program)
  compare(program, module, "Свести", [
    [[], 0],
    [[1, 2, 3], 0],
    [[1, -2, 3], 0],
    [[-1, -2], 100],
    [Array.from({ length: 300 }, (_, index) => index + 1), 0],
    ["не список", 0],
  ])
})

/* ══════════════════════════ 6. постусловия ═══════════════════════════ */

const violatingSource = [
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
].join("\n")

test("нарушение постусловия: код FTS_UTILITY_PROPERTY и текст ядра", async () => {
  const document = core.compile(violatingSource)
  const program = fromFtsDocument(document)
  const { module, content } = await build(program)

  /* Код и текст едут в AST данными — значит и в напечатанном коде они literals,
     а не знание, зашитое в эмиттер. */
  assert.match(content, /"FTS_UTILITY_PROPERTY"/u)

  const byCore = outcome(() => core.executeUtility(document, "Только положительное", { "сумма": -5 }))
  const byInterpreter = outcome(() => interpret(program, "Только положительное", { [INPUT_PARAM]: { "сумма": -5 } }))
  const byEmitted = outcome(() => module[exportName("Только положительное")]({ "сумма": -5 }))

  assert.equal(byEmitted.ok, false)
  assert.equal(byEmitted.code, "FTS_UTILITY_PROPERTY")
  assert.equal(byEmitted.code, byCore.code, "код обязан совпасть с ядром FTS")
  assert.equal(byEmitted.message, byCore.message, "текст обязан совпасть с ядром FTS дословно")
  assert.ok(sameOutcome(byInterpreter, byEmitted))

  /* Соседние точки: там, где свойство держится, оба движка возвращают значение. */
  const grid = [-5, -1, 0, 1, 5, -1001].map((value) => ({ [INPUT_PARAM]: { "сумма": value } }))
  compare(program, module, "Только положительное", grid)
})

test("постусловие, не давшее признак, даёт FLANG_TYPE у обоих движков", async () => {
  const program = {
    flang: 1,
    module: "Кривое свойство",
    functions: [
      {
        name: "Значение",
        params: [{ name: "х", type: { kind: "number" } }],
        returns: { kind: "number" },
        body: { kind: "var", name: "х" },
        postconditions: [{ name: "Не признак", expr: { kind: "literal", value: 1 }, bind: "результат" }],
      },
    ],
  }
  const { module } = await build(program)
  compare(program, module, "Значение", [[1], [0]])

  const byEmitted = outcome(() => module.znachenie(1))
  assert.equal(byEmitted.code, "FLANG_TYPE")
})

test("постусловие без кода даёт FLANG_PROPERTY и текст по умолчанию", async () => {
  const program = {
    flang: 1,
    module: "Свойство без кода",
    functions: [
      {
        name: "Значение",
        params: [{ name: "х", type: { kind: "number" } }],
        returns: { kind: "number" },
        body: { kind: "var", name: "х" },
        postconditions: [
          {
            name: "Неотрицательно",
            bind: "результат",
            expr: {
              kind: "binary",
              op: "gte",
              left: { kind: "var", name: "результат" },
              right: { kind: "literal", value: 0 },
            },
          },
        ],
      },
    ],
  }
  const { module } = await build(program)
  compare(program, module, "Значение", [[1], [0], [-1]])

  const byEmitted = outcome(() => module.znachenie(-1))
  assert.equal(byEmitted.code, "FLANG_PROPERTY")
  assert.equal(byEmitted.message, "нарушено свойство «Неотрицательно» функции «Значение»")
})

test("функция с постусловием не получает хвостовой оптимизации — как в интерпретаторе", async () => {
  /* Интерпретатор не переиспользует кадр, у которого есть постусловия: они
     обязаны проверить именно свой результат. Печать обязана повторить это,
     иначе постусловие проверилось бы не у той функции. */
  const program = {
    flang: 1,
    module: "Постусловие и хвост",
    functions: [
      {
        name: "Счёт",
        params: [{ name: "н", type: { kind: "number" } }],
        returns: { kind: "number" },
        body: {
          kind: "if",
          cond: { kind: "binary", op: "lte", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 0 } },
          then: { kind: "literal", value: 0 },
          else: {
            kind: "call",
            name: "Счёт",
            args: [{ kind: "binary", op: "sub", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 1 } }],
          },
        },
        postconditions: [
          {
            name: "Неотрицательно",
            bind: "результат",
            expr: {
              kind: "binary",
              op: "gte",
              left: { kind: "var", name: "результат" },
              right: { kind: "literal", value: 0 },
            },
          },
        ],
      },
    ],
  }
  const { module, content } = await build(program)
  assert.doesNotMatch(content, /for \(;;\)/u, "постусловие запрещает разворот в цикл")
  compare(program, module, "Счёт", [[0], [1], [5], [50]])
})

/* ══════════════════════════ 7. строковые формы ═══════════════════════════ */

function builtinFn(name, builtin, params) {
  return {
    name,
    total: true,
    params: params.map((param) => ({ name: param })),
    body: { kind: "builtin", name: builtin, args: params.map((param) => ({ kind: "var", name: param })) },
  }
}

const stringProgram = {
  flang: 1,
  module: "Строки",
  functions: [
    builtinFn("Длина", "длина", ["т"]),
    builtinFn("Символ", "символ", ["и", "т"]),
    builtinFn("Подстрока", "подстрока", ["т", "с", "по"]),
    builtinFn("Соединить", "соединить", ["а", "б"]),
    builtinFn("Разделить", "разделить", ["т", "р"]),
    builtinFn("Символы", "символы", ["т"]),
    builtinFn("Код символа", "код символа", ["т"]),
    builtinFn("Содержит", "содержит", ["т", "ч"]),
    builtinFn("Начинается", "начинается с", ["т", "п"]),
    builtinFn("К числу", "к числу", ["т"]),
    builtinFn("К строке", "к строке", ["з"]),
    builtinFn("Пусто", "пусто", ["з"]),
    builtinFn("Голова", "голова", ["с"]),
    builtinFn("Хвост", "хвост", ["с"]),
    builtinFn("Элемент", "элемент", ["и", "с"]),
    builtinFn("Добавить", "добавить", ["э", "с"]),
    builtinFn("Остаток", "остаток от", ["а", "б"]),
    builtinFn("Процент", "процентов от", ["п", "з"]),
    /*
     * Образцы по СТРОКЕ: `пусто` и `голова и хвост` разбирают её так же, как
     * список. Функция написана AST вручную, а не через builtinFn, потому что
     * проверяет не встроенную форму, а сам разбор: у строки голова — одна
     * КОДОВАЯ ТОЧКА, и на «😀😀» рантайм, режущий по единицам UTF-16 или по
     * байтам, развалит суррогатную пару. Сверка идёт с интерпретатором, так что
     * расхождение поймается само.
     */
    {
      name: "Развернуть",
      total: true,
      params: [{ name: "т", type: { kind: "string" } }],
      returns: { kind: "string" },
      body: {
        kind: "match",
        target: { kind: "var", name: "т" },
        cases: [
          { pattern: { kind: "empty" }, body: { kind: "literal", value: "" } },
          {
            pattern: { kind: "cons", head: "г", tail: "х" },
            body: {
              kind: "binary",
              op: "concat",
              left: { kind: "call", name: "Развернуть", args: [{ kind: "var", name: "х" }] },
              right: { kind: "var", name: "г" },
            },
          },
        ],
      },
    },
  ],
}

/* Кириллица и суррогатные пары: длина обязана считаться в кодовых точках,
   иначе «мир 🌍» окажется длиной 6, а не 5. */
const texts = ["", "привет", "мир 🌍", "ёжик", "a", "😀😀", "\u{1F600}абв", "  42  ", "3.5e2", "не число", "да"]
const indices = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 1.5, 100]

/*
 * Стоимость взятия по номеру — вопрос, который нельзя решить чтением кода.
 *
 * Форма `элемент N в СПИСОК` обещает ЗНАЧЕНИЕ, а не стоимость: у восьми целей
 * разные структуры данных, и «быстро» верно не для всех. Проход по номеру
 * сверху вниз делает ровно n взятий, поэтому время всего прохода — это n·(цена
 * одного взятия). Удвоив n, получаем ответ прямо: время выросло вдвое —
 * взятие постоянное; вчетверо — взятие линейное. Проход хвостовой, поэтому
 * глубина стека в измерение не входит.
 */
const indexCostProgram = {
  flang: 1,
  module: "Стоимость",
  functions: [
    {
      name: "Сумма по номеру",
      total: true,
      params: [
        { name: "элементы", type: { kind: "list", of: { kind: "number" } } },
        { name: "н", type: { kind: "number" } },
        { name: "акк", type: { kind: "number" } },
      ],
      returns: { kind: "number" },
      body: {
        kind: "if",
        cond: { kind: "binary", op: "lte", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 0 } },
        then: { kind: "var", name: "акк" },
        else: {
          kind: "call",
          name: "Сумма по номеру",
          args: [
            { kind: "var", name: "элементы" },
            { kind: "binary", op: "sub", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 1 } },
            {
              kind: "binary",
              op: "add",
              left: { kind: "var", name: "акк" },
              right: {
                kind: "builtin",
                name: "элемент",
                args: [{ kind: "var", name: "н" }, { kind: "var", name: "элементы" }],
              },
            },
          ],
        },
      },
    },
  ],
}

test("стоимость взятия по номеру: миллион взятий проходит, значит обхода нет", async (t) => {
  const { module, content } = await build(indexCostProgram)
  assert.match(content, /\$b_element\(/u, "взятие по номеру обязано печататься вызовом формы")
  const считать = module[exportName("Сумма по номеру")]

  /*
   * Здесь мерится не время, а ВОЗМОЖНОСТЬ. Модуль зовётся прямо, в том же
   * процессе, и на десятках тысяч элементов время тонет в шуме сборщика
   * мусора: соседние прогоны расходятся вдвое, и «удвоение n удвоило время»
   * из таких чисел не следует. Зато следует другое, и оно однозначно: при
   * линейном взятии миллион взятий стоил бы 10¹² шагов и не завершился бы
   * никогда. Он завершается — значит взятие постоянное.
   *
   * Ровное измерение времени сделано там, где процесс отдельный и шум меньше:
   * emit-c.test.mjs и emit-elixir.test.mjs, «стоимость взятия по номеру».
   */
  const n = 1_000_000
  const список = Array.from({ length: n }, (_, номер) => номер + 1)
  /* Бюджет витков поднят явно: миллион взятий — это миллион оборотов цикла
     хвостового самовызова, то есть миллион ВИТКОВ, а предел по умолчанию ровно
     миллион. Упереться в него здесь — правильное поведение счётчика, а не сбой,
     поэтому бюджет задаётся, как в emit-c.test.mjs («steps: String(бюджет)»). */
  module.$newContext({ maxSteps: 10_000_000 })
  const начало = Date.now()
  assert.equal(считать(список, n, 0), (n * (n + 1)) / 2)
  t.diagnostic(`миллион взятий по номеру пройден за ${Date.now() - начало} мс`)
})

test("строковые формы: кириллица, суррогатные пары и границы индексов", async (t) => {
  const { module } = await build(stringProgram)
  let points = 0

  points += compare(stringProgram, module, "Длина", [...texts, [1, 2, 3], [], 42, null].map((value) => [value]))

  const symbolGrid = []
  for (const index of indices) for (const text of texts) symbolGrid.push([index, text])
  symbolGrid.push([1, 42], [null, "абв"])
  points += compare(stringProgram, module, "Символ", symbolGrid)

  const subGrid = []
  for (const text of texts) for (const from of [0, 1, 2, 3]) for (const to of [0, 1, 2, 3, 6, 100]) subGrid.push([text, from, to])
  points += compare(stringProgram, module, "Подстрока", subGrid)

  points += compare(stringProgram, module, "Соединить", [
    ["мир", " 🌍"],
    ["", ""],
    [["а", "б"], "-"],
    [["а", 1], "-"],
    [[], "-"],
    [1, "а"],
    ["а", 1],
  ])
  points += compare(stringProgram, module, "Разделить", [["а,б,в", ","], ["", ","], ["абв", ""], ["🌍-🌍", "-"], [1, ","]])
  /* «символы» обязана делить по кодовым точкам: на «мир 🌍» это 5 элементов, а
     не 6 (единицы UTF-16). Комбинирующий знак остаётся отдельным элементом. */
  points += compare(stringProgram, module, "Символы", [
    [""], ["a"], ["привет"], ["мир 🌍"], ["😀😀"], ["\u{1F600}абв"], ["e\u0301"], [42], [null], [["а"]],
  ])
  /* «код символа» обязана дать КОДОВУЮ ТОЧКУ, а не единицу UTF-16 и не байт:
     на «😀» это 128512, а не 55357 (старший суррогат) и не 240 (первый байт
     UTF-8). Берётся первый символ, поэтому «😀абв» даёт то же число, что «😀».
     Пустая строка, не строка и список — отказы, и тексты их обязаны совпасть с
     вычислителем дословно, а не «по смыслу». */
  points += compare(stringProgram, module, "Код символа", [
    [""], ["a"], ["Я"], ["привет"], ["😀"], ["😀абв"], ["\u{1F600}"], ["e\u0301"], ["\u0301e"], [42], [null], [["а"]],
  ])
  points += compare(stringProgram, module, "Содержит", [["привет", "иве"], ["мир 🌍", "🌍"], [[1, 2], 2], [[1, 2], 3], [1, 2]])
  points += compare(stringProgram, module, "Начинается", [["привет", "при"], ["", ""], ["🌍x", "🌍"], [1, "а"]])
  points += compare(stringProgram, module, "К числу", [...texts, "0", "-0", "1e3", "Infinity", "0x10", "+5"].map((value) => [value]))
  /* «к строке» от признака обязано дать «да»/«нет», а не true/false. */
  points += compare(stringProgram, module, "К строке", [true, false, null, 0, -0, Number.NaN, Infinity, "уже строка", [1]].map((value) => [value]))
  points += compare(stringProgram, module, "Пусто", [["" ], ["а"], [[]], [[1]], [42], [null]])
  points += compare(stringProgram, module, "Голова", [[[]], [[1, 2]], ["строка"], [null]])
  points += compare(stringProgram, module, "Хвост", [[[]], [[1, 2]], ["строка"]])
  /* «элемент N в СПИСОК»: сетка номеров та же, что у «символ», и по той же
     причине — индексация у форм одна. Проверяются обе границы, дробный и
     отрицательный номер, пустой список, не-список и не-число: тексты отказов
     обязаны совпасть с вычислителем дословно, а не «по смыслу». */
  const списки = [[], [1], [1, 2, 3], ["а", "б"], [[1], [2]]]
  const сеткаЭлемента = []
  for (const номер of indices) for (const список of списки) сеткаЭлемента.push([номер, список])
  сеткаЭлемента.push([1, "строка"], [1, 42], [null, [1]], [1, null])
  points += compare(stringProgram, module, "Элемент", сеткаЭлемента)
  points += compare(stringProgram, module, "Добавить", [[1, []], [1, [2]], [1, "строка"]])
  points += compare(stringProgram, module, "Остаток", [[7, 3], [7, 0], [-7, 3], [7.5, 2], ["a", 1]])
  /* Проценты: порядок (процент / 100) * значение виден на этих числах. */
  points += compare(stringProgram, module, "Процент", [[10, 10000.1], [20, 1 / 3], [5, 1e308], [0, 0], ["a", 1]])
  /* Разбор строки образцами: пустая, один символ, суррогатная пара, а также
     не-строки — у них ни один случай не подходит, и отказ обязан совпасть. */
  points += compare(stringProgram, module, "Развернуть",
    [...texts, ["а", "б"], [], 42, null].map((value) => [value]))

  assert.equal(module.kStroke(true), "да")
  assert.equal(module.kStroke(false), "нет")
  assert.equal(module.kStroke(null), "ничто")
  assert.equal(module.dlina("мир 🌍"), 5)
  assert.equal(module.simvol(5, "мир 🌍"), "🌍")

  t.diagnostic(`сверенных входов: ${points}`)
})

test("встроенная форма с неверной арностью и неизвестное имя ловятся при печати", () => {
  const wrongArity = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "builtin", name: "длина", args: [] } }],
  }
  assert.throws(() => emitJs(wrongArity), (error) => {
    assert.equal(errorCode(error), "FLANG_BUILTIN_ARGS")
    assert.equal(error.message, "«длина» ожидает 1 аргумент, получено 0")
    return true
  })

  const unknown = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "builtin", name: "выдумка", args: [] } }],
  }
  assert.throws(() => emitJs(unknown), (error) => errorCode(error) === "FLANG_UNKNOWN_NAME")

  const unknownCall = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "call", name: "Нет такой", args: [] } }],
  }
  assert.throws(() => emitJs(unknownCall), (error) => errorCode(error) === "FLANG_UNKNOWN_NAME")
})

/* ══════════════════════════ 8. порядок вычисления ═══════════════════════════ */

test("порядок вычисления строго слева направо: первая ошибка — левая", async () => {
  /* Оба операнда сломаны. Если бы эмиттер вычислил правый раньше левого, текст
     ошибки был бы про правый, и два движка разошлись бы. */
  const program = {
    flang: 1,
    module: "Порядок",
    functions: [
      {
        name: "Сложить",
        params: [{ name: "а" }, { name: "б" }],
        body: {
          kind: "binary",
          op: "add",
          left: { kind: "builtin", name: "голова", args: [{ kind: "var", name: "а" }] },
          right: { kind: "builtin", name: "хвост", args: [{ kind: "var", name: "б" }] },
        },
      },
    ],
  }
  const { module } = await build(program)
  compare(program, module, "Сложить", [
    [[], []],
    [[1], []],
    [[], [1]],
    [[1], [2]],
    ["не список", []],
  ])
})

test("деление на ноль даёт Infinity и NaN, а не ошибку", async () => {
  const program = {
    flang: 1,
    module: "Деление",
    functions: [
      {
        name: "Делить",
        params: [{ name: "а" }, { name: "б" }],
        body: { kind: "binary", op: "div", left: { kind: "var", name: "а" }, right: { kind: "var", name: "б" } },
      },
    ],
  }
  const { module } = await build(program)
  compare(program, module, "Делить", [[1, 0], [-1, 0], [0, 0], [1, 2], [-0, 1]])
  assert.equal(module.delit(1, 0), Infinity)
  assert.ok(Number.isNaN(module.delit(0, 0)))
})

test("равенство скаляров — Object.is: NaN равен NaN, 0 не равен −0", async () => {
  const program = {
    flang: 1,
    module: "Равенство",
    functions: [
      {
        name: "Равны",
        params: [{ name: "а" }, { name: "б" }],
        body: { kind: "binary", op: "eq", left: { kind: "var", name: "а" }, right: { kind: "var", name: "б" } },
      },
    ],
  }
  const { module } = await build(program)
  const values = [0, -0, Number.NaN, 1, "1", true, null, [1, 2], [1, 2, 3], { а: 1 }]
  const grid = []
  for (const left of values) for (const right of values) grid.push([left, right])
  compare(program, module, "Равны", grid)
  assert.equal(module.ravny(Number.NaN, Number.NaN), true)
  assert.equal(module.ravny(0, -0), false)
})

/* ══════════════════════════ 9. затенение имён ═══════════════════════════ */

test("затенение локальных имён и совпадение с именем функции", async () => {
  /* «пусть х» внутри «пусть х», плюс локальное имя, транслитерация которого
     совпадает с именем функции: если бы эмиттер выдал один идентификатор,
     вызов сам себя не нашёл бы. */
  const program = {
    flang: 1,
    module: "Тени",
    functions: [
      {
        name: "значение",
        params: [{ name: "значение" }],
        body: {
          kind: "let",
          name: "х",
          value: { kind: "literal", value: 1 },
          in: {
            kind: "let",
            name: "х",
            value: { kind: "binary", op: "add", left: { kind: "var", name: "х" }, right: { kind: "literal", value: 10 } },
            in: {
              kind: "binary",
              op: "add",
              left: { kind: "var", name: "х" },
              right: { kind: "var", name: "значение" },
            },
          },
        },
      },
    ],
  }
  const { module } = await build(program)
  compare(program, module, "значение", [[0], [5], ["строка"]])
  assert.equal(module.znachenie(5), 16)
})

test("имя, не связанное в области видимости, ловится при печати", () => {
  const program = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "var", name: "неизвестное" } }],
  }
  assert.throws(() => emitJs(program), (error) => {
    assert.equal(errorCode(error), "FLANG_UNKNOWN_NAME")
    assert.equal(error.message, "имя «неизвестное» не связано")
    return true
  })
})

test("коллизия идентификаторов — ошибка печати, а не тихое переименование", () => {
  const program = {
    flang: 1,
    functions: [
      /* «Сумма» и «сумма» — разные имена модели, но один camel-идентификатор. */
      { name: "Сумма", params: [], body: { kind: "literal", value: 1 } },
      { name: "сумма", params: [], body: { kind: "literal", value: 2 } },
    ],
  }
  assert.throws(() => emitJs(program), /идентификатор/u)
})

/* ══════════════════════════ 10. настоящий исходник flang ═══════════════════ */

/* Все программы выше собраны из AST руками — это законно (AST и есть вход
   слоя), но проверяет он тогда только договорённость автора теста с самим
   собой. Здесь вход приезжает от настоящего парсера: если парсер кладёт `in`
   там, где эмиттер ждёт `body`, узнать об этом надо тут, а не у пользователя. */
const flangSource = `модуль «Счёт»

объект «Позиция»
  цена: число
  название: строка

тип «Токен»
  вариант Слово содержит текст: строка
  вариант Конец

тотальная функция «Длина»
  принимает элементы: список числа
  возвращает число
  разбор элементы
    случай пусто
      то 0
    случай голова и хвост
      то 1 плюс «Длина» от хвост

функция «Итого»
  принимает позиции: список «Позиция»
  возвращает число
  свёртка позиции начиная с 0 как сумма и поз: сумма плюс поз.цена

функция «Показать»
  принимает т: «Токен»
  возвращает строка
  разбор т
    случай Слово содержит текст как слово
      то слово
    случай Конец
      то "конец"
`

test("исходник flang через настоящий парсер печатается и совпадает с интерпретатором", async (t) => {
  const program = parse(flangSource)
  const { module, content } = await build(program)
  assert.match(content, /Функция flang «Длина»/u)
  assert.match(content, /Запись FTS «Позиция»/u)

  let points = compare(program, module, "Длина", [
    [[]],
    [[1, 2, 3]],
    [Array.from({ length: 150 }, (_, index) => index)],
    ["не список"],
    [null],
  ])

  const позиция = (цена, название) => ({ "цена": цена, "название": название })
  points += compare(program, module, "Итого", [
    [[]],
    [[позиция(10, "а")]],
    [[позиция(10, "а"), позиция(2.5, "б")]],
    [[позиция("дорого", "а")]],
    [[{ "название": "без цены" }]],
    ["не список"],
  ])

  const adapt = adaptTo(module)
  /* Вариант, не объявленный в программе, сюда не попадает намеренно: у модуля с
     нулём зависимостей свой класс варианта, и построить чужой ему нечем — как
     нечем и типизировать. Непокрытые значения проверяются скалярами. */
  points += compare(program, module, "Показать", [
    [variant("Слово", { "текст": "привет" })],
    [variant("Конец", {})],
    [variant("Слово", {})],
    [42],
    [null],
    ["строка"],
  ], { adapt })

  t.diagnostic(`сверенных входов: ${points}`)
})

/* ══════════════════════════ 11. форма результата ═══════════════════════════ */

test("детерминированность: два вызова emitJs дают побайтово одно и то же", async () => {
  const programs = [listProgram, treeProgram, mutualProgram, countdownProgram, stringProgram]
  for (const model of models) {
    const program = fromFtsDocument(model.document)
    if ((program.functions ?? []).length > 0) programs.push(program)
  }
  for (const program of programs) {
    const first = emitJs(program)
    const second = emitJs(program)
    assert.deepEqual(first, second)
    assert.equal(first.files[0].content, second.files[0].content)
    /* И ещё раз после кругосветки через JSON: порядок ключей AST сохраняется,
       а значит вывод не зависит от того, откуда приехал AST. */
    const third = emitJs(JSON.parse(JSON.stringify(program)))
    assert.equal(first.files[0].content, third.files[0].content)
  }
})

test("напечатанный модуль ни от чего не зависит и объясняет себя", async () => {
  const { content } = await build(treeProgram)
  assert.doesNotMatch(content, /^\s*import\s/mu, "у напечатанного кода не может быть зависимостей")
  assert.doesNotMatch(content, /\brequire\(/u)
  assert.doesNotMatch(content, /\bprocess\b|\brequire\b|\bBuffer\b/u, "модуль обязан работать и в браузере")
  assert.doesNotMatch(content, /\bDate\b|Math\.random/u, "ни дат, ни случайности — вывод обязан быть воспроизводим")
  assert.match(content, /^\/\/ Сгенерировано flang/u)
  assert.match(content, /Не редактировать руками/u)
  /* Имена FTS сохраняются рядом с каждым типом и каждой функцией. */
  assert.match(content, /Функция flang «Сумма дерева»/u)
  assert.match(content, /Сумма типов FTS «Дерево»/u)
})

test("рантайм печатается по потребности, а не целиком", async () => {
  const trivial = {
    flang: 1,
    module: "Тривиальная",
    functions: [{ name: "Ноль", total: true, params: [], body: { kind: "literal", value: 0 } }],
  }
  const { content, module } = await build(trivial)
  assert.equal(module.nol(), 0)
  assert.doesNotMatch(content, /\$b_podstroka/u, "неиспользованные встроенные формы не печатаются")
  assert.doesNotMatch(content, /\$trampoline/u)
  assert.doesNotMatch(content, /\$enter|\$step\b|\$top\b/u, "счётчики нужны рекурсии, а её здесь нет")

  /* Меряется МОДУЛЬ, а не модуль вместе с таблицей прогонщика: обещание «рантайм
     по потребности» — про рантайм. Таблица (`$PROGRAM`) — не рантайм, а связь с
     соседним файлом, она печатается вместе с ним и снимается вместе с ним, и
     цена её названа тут же строкой ниже, чтобы не росла молча. */
  const голый = emitJs(trivial, { cli: false }).files[0].content
  assert.ok(
    голый.split("\n").length < 40,
    `тривиальная программа не должна тянуть весь рантайм: ${голый.split("\n").length} строк`,
  )
  const цена = content.split("\n").length - голый.split("\n").length
  assert.ok(цена < 40, `таблица прогонщика обязана оставаться дешёвой: ${цена} строк на одну функцию`)
})

test("имя файла берётся из имени модуля, но его можно задать", () => {
  assert.equal(emitJs(treeProgram).files[0].path, "derevya.js")
  assert.equal(emitJs({ flang: 1, functions: [] }).files[0].path, "program.js")
  assert.equal(emitJs(treeProgram, { path: "деревья.mjs" }).files[0].path, "деревья.mjs")
})

test("нулевая индексация строк включается опцией и остаётся согласованной", async () => {
  const { module } = await build(stringProgram, { indexBase: 0 })
  assert.equal(module.simvol(0, "абв"), "а")
  const grid = []
  for (const index of indices) for (const text of texts) grid.push([index, text])
  compare(stringProgram, module, "Символ", grid, { limits: { indexBase: 0 } })
})

/* ══════════ 12. цена «добавить»: предел шагов обязан быть СРОКОМ ═══════════ */

/*
 * Предел шагов, который срабатывает через полторы минуты, — не предел.
 *
 * Улика. Точка сетки «Строить скобки» от 42 и 0 и 0 и "" и []
 * (`flang/examples/leetcode/022-generate-parentheses.flang`) при объявленных
 * 5 000 000 шагов НЕ ЗАВЕРШАЛАСЬ: прямой запуск напечатанного модуля снимался по
 * сроку 90 с. Эталон-интерпретатор на той же точке упирается в предел за 919 мс.
 *
 * Причина была не в счётчике, а в цене шага: `добавить` печаталось как
 * `[...list, item]`, то есть копировало весь список на каждый вызов, и
 * накопление n слов стоило O(n²). Шаг ценой O(длины) не ограничивает работу
 * ничем.
 *
 * Здесь четыре теста, и они проверяют разное:
 *   • цену — накопление обязано быть линейным;
 *   • правильность — за постоянное время список продлевается ЗАПИСЬЮ в общий
 *     буфер, и если инвариант «ячейку за концом занимает единственный» сломан,
 *     ветвление двух `добавить` от одного списка испортит оба;
 *   • протокол — значение, выданное `добавить`, обязано остаться НЕОТЛИЧИМЫМ от
 *     обычного массива: его читают и тесты, и прогонщик, и всякий, кто модуль
 *     импортировал;
 *   • сам предел — на той самой точке, дословным текстом эталона.
 * Без второго первый зеленел бы и на `добавить`, которое просто портит данные;
 * без третьего — на `добавить`, которое отдаёт что-то своё вместо массива.
 */

/* Прогон вызова в ОТДЕЛЬНОМ процессе. Здесь проверяется не значение, а ЦЕНА, и
   вопрос «предел срабатывает за секунду или не срабатывает вовсе» без срока не
   задать. В своём процессе срока не поставить: зависший вызов не отдаёт
   управление, и тест, вместо того чтобы покраснеть, не кончается никогда. */
/* Прогонщик едет аргументом `-e`, а не файлом рядом с модулем: файл пришлось бы
   держать живым весь прогон, а временный каталог теста убирается по его концу —
   срок и уборка не обязаны договариваться. Просьба едет переменными окружения:
   в `process.argv` после `-e` свои правила, и один пробел в имени функции стоил
   бы разбора чужой командной строки. Имена переменных латиницей: это единственное
   место, где имя пересекает границу процесса, и правила там задаёт не JS. */
const ДРАЙВЕР = `const модуль = await import(process.env.FLANG_MODULE)
const { функция, аргументы, пределы } = JSON.parse(process.env.FLANG_REQUEST)
if (пределы !== null) модуль.$newContext(пределы)
const начало = Date.now()
let ответ
try {
  const значение = модуль[функция](...аргументы)
  const список = Array.isArray(значение)
  ответ = {
    ok: true,
    мс: Date.now() - начало,
    длина: список ? значение.length : null,
    первый: список && значение.length > 0 ? значение[0] : null,
    последний: список && значение.length > 0 ? значение[значение.length - 1] : null,
  }
} catch (беда) {
  ответ = { ok: false, мс: Date.now() - начало, code: беда.code ?? null, message: беда.message }
}
process.stdout.write(JSON.stringify(ответ))
`

function спросить(path, вызов, срок) {
  let вывод
  try {
    вывод = execFileSync(process.execPath, ["--input-type=module", "-e", ДРАЙВЕР], {
      encoding: "utf8",
      timeout: срок,
      killSignal: "SIGKILL",
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        FLANG_MODULE: pathToFileURL(path).href,
        FLANG_REQUEST: JSON.stringify({ пределы: null, ...вызов }),
      },
    })
  } catch (беда) {
    if (беда.code === "ETIMEDOUT" || беда.signal === "SIGKILL") {
      assert.fail(`напечатанный модуль не ответил за ${срок} мс на «${вызов.функция}»`)
    }
    throw беда
  }
  return JSON.parse(вывод)
}

const накоплениеИсходник = `модуль «Накопление»

тотальная функция «Накопить»
  принимает н: число, итог: список числа
  возвращает список числа
  убывает н
  если н не больше 0
    то итог
    иначе «Накопить» от (н минус 1) и (добавить н к итог)
`

test("накопление списка линейно: 200 000 «добавить» — это доли секунды, а не минуты", async (t) => {
  const program = parse(накоплениеИсходник, "накопление.flang")
  const { path } = await build(program)

  /* Предел шагов снят намеренно (`maxSteps: 0`): здесь меряется цена ОДНОГО
     шага, и счётчик в измерение входить не должен. Хвостовой самовызов
     развёрнут в цикл, поэтому и глубина постоянна. */
  const времена = []
  for (const н of [50_000, 100_000, 200_000]) {
    const ответ = спросить(path, {
      функция: exportName("Накопить"),
      аргументы: [н, []],
      пределы: { maxSteps: 0, maxDepth: 10_000 },
    }, 120_000)
    assert.equal(ответ.ok, true, JSON.stringify(ответ).slice(0, 200))
    assert.equal(ответ.длина, н, "накоплено не то число элементов")
    assert.equal(ответ.первый, н, "первым обязан лежать первый добавленный")
    assert.equal(ответ.последний, 1, "последним — последний добавленный")
    времена.push(ответ.мс)
  }

  /* Порог с запасом в два порядка, а не «на глаз»: до починки те же три точки
     давали 13 029 мс, 44 275 мс и больше 120 000 мс (снято по сроку), после —
     45 мс, 55 мс и 133 мс. Между 133 и 30 000 нет ни машины помедленнее, ни
     отобранного процессора — там разница классов сложности, а не нагрузки. */
  assert.ok(
    времена[2] < 30_000,
    `200 000 «добавить» заняли ${времена[2]} мс — это снова квадрат, а не линия`,
  )
  /* И отдельно — сама форма роста: удвоение длины обязано удваивать время, а не
     учетверять. Порог 3 (а не 2) оставлен под шум машины; квадрат дал бы около
     4 и здесь. */
  assert.ok(
    времена[2] < времена[1] * 3 + 100,
    `удвоение числа «добавить» подняло время с ${времена[1]} до ${времена[2]} мс — это квадратичный рост`,
  )
  t.diagnostic(
    `накопление: 50 000 за ${времена[0]} мс, 100 000 за ${времена[1]} мс, 200 000 за ${времена[2]} мс`,
  )
})

const ветвлениеИсходник = `модуль «Ветвление добавления»

функция «Ветвление»
  принимает основа: список числа
  возвращает список (список числа)
  пусть один равно (добавить 1 к основа)
  пусть два равно (добавить 2 к основа)
  пусть три равно (добавить 3 к один)
  пусть четыре равно (добавить 4 к один)
  [основа, один, два, три, четыре]

функция «Ветвление хвоста»
  принимает основа: список числа
  возвращает список (список числа)
  пусть срез равно (хвост основа)
  пусть один равно (добавить 1 к срез)
  пусть два равно (добавить 2 к срез)
  [основа, срез, один, два]
`

test("«добавить» за постоянное время не портит исходный список: ветвление и хвост", async (t) => {
  /* Ветвление — то самое место, где приём «занять ячейку за концом» ломается,
     если инвариант неверен: «два» обязано кончаться двойкой, а не единицей,
     «четыре» — четвёркой, а не тройкой, и «основа» обязана остаться прежней.
     «Хвост» здесь не для полноты: он отдаёт новый массив, продление которого не
     имеет права дописать в буфер соседа. */
  const program = parse(ветвлениеИсходник, "ветвление.flang")
  const { module } = await build(program)

  const сетка = [[[]], [[7]], [[7, 8]], [[7, 8, 9]], [[1, 2, 3, 4, 5]]]
  let points = compare(program, module, "Ветвление", сетка)
  points += compare(program, module, "Ветвление хвоста", сетка)

  /* Явные ожидания сверх сверки с эталоном: сверка ловит расхождение движков, а
     эти две строки ловят согласованную ошибку обоих — на случай, если чинить
     когда-нибудь возьмутся сразу оба. */
  assert.deepEqual(
    module[exportName("Ветвление")]([7, 8]).map((item) => [...item]),
    [[7, 8], [7, 8, 1], [7, 8, 2], [7, 8, 1, 3], [7, 8, 1, 4]],
  )
  assert.deepEqual(
    module[exportName("Ветвление хвоста")]([7, 8, 9]).map((item) => [...item]),
    [[7, 8, 9], [8, 9], [8, 9, 1], [8, 9, 2]],
  )
  t.diagnostic(`ветвление «добавить» сверено на ${points} входах`)
})

test("вид «добавить» неотличим от обычного массива", async () => {
  /* Протокол значений этой цели — обычный массив JS, и `добавить` за постоянное
     время его не меняет: оно отдаёт вид на общий буфер, а вид обязан отвечать
     как массив на ВСЁ, чем массив наблюдают. Список здесь берётся из ветвления
     намеренно: у такого вида буфер ДЛИННЕЕ его самого (в нём лежит ячейка
     соседней ветки), и всякая протечка буфера видна сразу. */
  const program = parse(ветвлениеИсходник, "ветвление.flang")
  const { module } = await build(program)
  const [, один, , три] = module[exportName("Ветвление")]([7, 8])
  const образец = [7, 8, 1]

  assert.equal(Array.isArray(один), true, "«добавить» обязано отдавать массив")
  assert.equal(один.length, 3)
  assert.equal(один[2], 1)
  assert.equal(один[3], undefined, "за концом списка обязано быть пусто, а не ячейка соседа")
  assert.equal(три.length, 4, "у соседа своя длина")
  assert.equal(JSON.stringify(один), JSON.stringify(образец))
  assert.equal(JSON.stringify({ а: [один] }), JSON.stringify({ а: [образец] }))
  assert.deepEqual([...один], образец)
  assert.deepEqual(Array.from(один), образец)
  assert.deepEqual(один.map((x) => x * 2), образец.map((x) => x * 2))
  assert.deepEqual(один.slice(1), образец.slice(1))
  assert.equal(один.join(","), образец.join(","))
  assert.equal(один.indexOf(1), 2)
  assert.deepEqual(Object.keys(один), Object.keys(образец))
  assert.deepEqual(Object.entries(один), Object.entries(образец))
  assert.equal(Object.getPrototypeOf(один), Array.prototype)
  assert.equal(один instanceof Array, true)
  assert.equal(один.constructor, Array)
  assert.equal(2 in один, true)
  assert.equal(3 in один, false)
  assert.deepEqual([].concat(один), образец)
  /* Строгое сравнение — то самое, которым тесты этого дерева сверяют значения:
     оно смотрит и на прототип, и на собственные ключи, и на длину. */
  assert.deepStrictEqual(один, образец)
  assert.deepStrictEqual(образец, один)
  assert.deepStrictEqual({ а: [один] }, { а: [образец] })
  const обход = []
  for (const item of один) обход.push(item)
  assert.deepEqual(обход, образец)

  /* И единственное, чем вид от массива ОТЛИЧИМ, — оно названо в шапке js.mjs, а
     здесь закреплено: запись отвергается. Пустить её в общий буфер значило бы
     испортить соседний список; значение flang неизменяемо, и отказ честнее
     тишины. Строка обязана краснеть, если запись когда-нибудь начнёт проходить
     молча: тогда неизменяемость держится уже ни на чём. */
  assert.throws(() => {
    один[0] = 42
  }, TypeError)
  assert.throws(() => один.push(9), TypeError)
  assert.deepEqual([...один], образец, "отвергнутая запись не имеет права ничего изменить")
})

test("точка сетки, на которой печать зависала: предел шагов срабатывает за секунду", async (t) => {
  const файл = join(root, "flang/examples/leetcode/022-generate-parentheses.flang")
  const program = parse(await readFile(файл, "utf8"), "022-generate-parentheses.flang")
  const { path } = await build(program)

  const пределы = { maxSteps: 5_000_000, maxDepth: 10_000 }
  /* Срок 120 с — это больше ста сроков после починки (0,8 с) и заведомо больше
     того, за что не управлялась печать до неё (снято по сроку 90 с). */
  const ответ = спросить(path, {
    функция: exportName("Строить скобки"),
    аргументы: [42, 0, 0, "", []],
    пределы,
  }, 120_000)

  assert.equal(ответ.ok, false, `на этой точке обязан быть отказ по пределу: ${JSON.stringify(ответ).slice(0, 200)}`)
  assert.equal(ответ.code, "FLANG_RECURSION_LIMIT")

  /* Текст сверяется с эталоном ДОСЛОВНО, а не по форме: на этой точке виток
     печати совпал с витком интерпретатора вплоть до глубины, на которой
     кончился бюджет. */
  const эталон = outcome(() => interpret(program, "Строить скобки", [42, 0, 0, "", []], пределы))
  assert.equal(эталон.ok, false)
  assert.equal(эталон.code, "FLANG_RECURSION_LIMIT")
  assert.equal(ответ.message, эталон.message)
  assert.equal(
    ответ.message,
    "функция «Строить скобки» исчерпала лимит шагов (5000000) на глубине вызовов 43",
  )

  /* И вторая точка — та, с которой перебор начинается у пользователя. */
  const сверху = спросить(path, {
    функция: exportName("Правильные скобки"),
    аргументы: [42],
    пределы,
  }, 120_000)
  assert.equal(сверху.ok, false)
  assert.equal(сверху.code, "FLANG_RECURSION_LIMIT")
  assert.equal(сверху.message, эталон.message)

  t.diagnostic(`обе точки упёрлись в предел за ${ответ.мс} и ${сверху.мс} мс (было: не отвечало и за 90 000 мс)`)
})
