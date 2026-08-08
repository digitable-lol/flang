/**
 * Печать flang → C.
 *
 * Главный тест здесь один и он же единственный осмысленный: **сверка с
 * интерпретатором**. Кодогенератор не имеет права быть «почти правильным»:
 * либо собранная программа на каждом входе даёт то же значение и ту же ошибку
 * (код и текст), что `interpret.mjs`, либо результатам сгенерированного кода
 * нельзя верить вовсе.
 *
 * Поэтому каждая программа проходит полный путь пользователя: печатается в
 * ПУСТОЙ каталог, собирается `gcc -std=c99 -Wall -Wextra -Werror -pedantic`
 * ровно из того, что выдал бэкенд (ни одного файла руками), и запускается
 * настоящим процессом. Ничего не подкладывается из репозитория: если бы
 * рантайм собирался только потому, что лежит рядом, дыра нашлась бы у первого
 * же пользователя, а не здесь.
 *
 * Сетка входов гоняется через прогонщик одним процессом на программу: тысячи
 * точек, одна сборка. Значения ездят размеченным JSON — числа строкой, чтобы
 * NaN, Infinity и −0 доехали без потерь.
 *
 * Набор программ: все модели репозитория через `compat.mjs` (обещание §9
 * SPEC), рекурсия по списку, обход дерева-суммы, взаимная рекурсия, строки на
 * кириллице и суррогатных парах, нарушение постусловия, хвостовая рекурсия на
 * 100 000 шагов и проверка утечек под valgrind.
 */
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

import { errorCode, fromFtsDocument, INPUT_PARAM } from "../src/compat.mjs"
import { evaluate as interpret, variant } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"
import { markMeasureGuards } from "../src/totality.mjs"
import { emitC } from "../src/emit/c.mjs"
import { globSync } from "./glob.mjs"

const root = fileURLToPath(new URL("../..", import.meta.url))
const core = await import(new URL("../../dist/src/index.js", import.meta.url).href)
const { parseModuleFile } = await import(new URL("../../tools/ftsc/src/parse-module.mjs", import.meta.url).href)

const workdir = await mkdtemp(join(tmpdir(), "flang-emit-c-"))
after(async () => {
  await rm(workdir, { recursive: true, force: true })
})

const CFLAGS = ["-std=c99", "-Wall", "-Wextra", "-Werror", "-pedantic"]

let serial = 0

/* ───────────────────── печать, сборка, запуск ───────────────────── */

/** Печатает программу в пустой каталог и собирает ровно то, что напечатано. */
async function build(program, options = {}) {
  serial += 1
  const directory = join(workdir, `p${serial}`)
  await mkdir(directory, { recursive: true })
  const emitted = emitC(program, options)
  for (const file of emitted.files) await writeFile(join(directory, file.path), file.content, "utf8")

  /* В каталоге не должно оказаться ничего, кроме напечатанного. */
  const present = readdirSync(directory).sort()
  assert.deepEqual(present, emitted.files.map((file) => file.path).sort())

  compile(directory, emitted, options.cc ?? "gcc", options.extraFlags ?? [])
  const moduleSource = emitted.files.find((file) => file.path.endsWith(".c") && !file.path.startsWith("flang_"))
  return {
    directory,
    emitted,
    cli: join(directory, "flang_cli"),
    source: moduleSource.content,
    header: emitted.files.find((file) => file.path.endsWith(".h") && !file.path.startsWith("flang_")).content,
  }
}

function compile(directory, emitted, cc, extraFlags) {
  const sources = emitted.files.filter((file) => file.path.endsWith(".c")).map((file) => file.path)
  try {
    execFileSync(cc, [...CFLAGS, ...extraFlags, ...sources, "-o", "flang_cli", "-lm"], {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    assert.fail(`${cc} не собрал напечатанное:\n${error.stderr ?? error.message}`)
  }
}

/** Один процесс на сколько угодно запросов: сборка дорога, запрос дёшев. */
function ask(built, requests) {
  const input = `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`
  const output = execFileSync(built.cli, {
    input,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  })
  const lines = output.split("\n").filter((line) => line.length > 0)
  assert.equal(lines.length, requests.length, "прогонщик обязан ответить на каждый запрос ровно один раз")
  return lines.map((line) => JSON.parse(line))
}

/* ───────────────────── значения на проводе ───────────────────── */

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

/* Число едет строкой: JSON не знает ни NaN, ни Infinity, ни знака нуля, а
   Object.is их различает — значит различать обязан и провод. */
function encode(value) {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value
  if (typeof value === "number") return { n: Object.is(value, -0) ? "-0" : String(value) }
  if (typeof value === "string") return { s: value }
  if (Array.isArray(value)) return { l: value.map(encode) }
  if (isVariantLike(value)) {
    return { v: value.variant, f: Object.entries(value.fields).map(([key, item]) => [key, encode(item)]) }
  }
  if (typeof value === "object") {
    return { r: Object.entries(value).map(([key, item]) => [key, encode(item)]) }
  }
  throw new Error(`нечего кодировать: ${typeof value}`)
}

function decode(node) {
  if (node === null) return null
  if (typeof node === "boolean") return node
  if (Object.hasOwn(node, "n")) return Number(node.n)
  if (Object.hasOwn(node, "s")) return node.s
  if (Object.hasOwn(node, "l")) return node.l.map(decode)
  if (Object.hasOwn(node, "r")) {
    const record = {}
    for (const [key, item] of node.r) record[key] = decode(item)
    return record
  }
  if (Object.hasOwn(node, "v")) {
    const fields = {}
    for (const [key, item] of node.f ?? []) fields[key] = decode(item)
    return variant(node.v, fields)
  }
  throw new Error(`нечего декодировать: ${JSON.stringify(node)}`)
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
  return result.ok
    ? `значение ${JSON.stringify(result.value) ?? String(result.value)}`
    : `${result.code}: ${result.message}`
}

/**
 * Сверка одной функции на сетке входов одним запуском процесса.
 * Возвращает число сверенных точек: тест обязан не просто «не упасть», но и
 * показать, что сверял хоть что-то.
 */
function compare(program, built, functionName, grid, options = {}) {
  const fn = (program.functions ?? []).find((item) => item.name === functionName)
  assert.ok(fn, `в программе нет функции «${functionName}»`)
  const params = fn.params.map((param) => (typeof param === "string" ? param : param.name))
  const points = grid.map((point) => (Array.isArray(point) ? point : params.map((name) => point[name])))

  const requests = points.map((args) => {
    const request = { fn: functionName, args: args.map(encode) }
    if (options.depth !== undefined) request.depth = String(options.depth)
    return request
  })
  const answers = ask(built, requests)

  points.forEach((args, index) => {
    const byInterpreter = outcome(() => interpret(program, functionName, args, options.limits ?? {}))
    const answer = answers[index]
    const byEmitted = answer.ok
      ? { ok: true, value: decode(answer.value) }
      : { ok: false, code: answer.code, message: answer.message }
    assert.ok(
      sameOutcome(byInterpreter, byEmitted),
      `«${functionName}» на входе ${JSON.stringify(args) ?? "?"}: интерпретатор дал ${describeOutcome(byInterpreter)}, ` +
        `собранный C дал ${describeOutcome(byEmitted)}`,
    )
  })
  return points.length
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
    /* Файлы-функторы не документы FTS: у них нет категории. */
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

test("все модели репозитория: собранный C совпадает с интерпретатором", async (t) => {
  assert.ok(models.length > 0, "модели репозитория не найдены — тест бессмыслен")
  let programs = 0
  let functions = 0
  let points = 0

  for (const model of models) {
    const program = fromFtsDocument(model.document)
    if ((program.functions ?? []).length === 0) continue
    const built = await build(program)
    programs += 1

    const byName = new Map(model.document.structures.map((structure) => [structure.name, structure]))
    for (const utility of model.document.utilities) {
      const structure = byName.get(utility.input)
      const grid = inputGrid(structure, utility).map((input) => ({ [INPUT_PARAM]: input }))
      points += compare(program, built, utility.name, grid)
      functions += 1
    }
  }

  t.diagnostic(`моделей: ${programs}, функций: ${functions}, сверенных входов: ${points}`)
  assert.ok(programs >= 5, `моделей с утилитами слишком мало: ${programs}`)
  assert.ok(points > 1000, `сетка слишком редкая: ${points}`)
})

test("примеры моделей считаются одинаково ядром FTS, интерпретатором и C", async (t) => {
  let checked = 0
  for (const model of models) {
    const program = fromFtsDocument(model.document)
    if ((program.functions ?? []).length === 0) continue
    const built = await build(program)
    const requests = []
    const expected = []
    for (const utility of model.document.utilities) {
      for (const example of utility.examples) {
        requests.push({ fn: utility.name, args: [encode(example.input)] })
        expected.push({ utility, example })
      }
    }
    if (requests.length === 0) continue
    const answers = ask(built, requests)
    answers.forEach((answer, index) => {
      const { utility, example } = expected[index]
      const byCore = outcome(() => core.executeUtility(model.document, utility.name, example.input))
      const byInterpreter = outcome(() =>
        interpret(program, utility.name, { [INPUT_PARAM]: example.input }))
      const byEmitted = answer.ok
        ? { ok: true, value: decode(answer.value) }
        : { ok: false, code: answer.code, message: answer.message }
      assert.ok(sameOutcome(byInterpreter, byEmitted), `${utility.name} / ${example.name}: движки разошлись`)
      if (byCore.ok) {
        assert.ok(sameValue(byCore.value, byEmitted.value), `${utility.name} / ${example.name}: ядро разошлось с C`)
      }
      checked += 1
    })
  }
  t.diagnostic(`сверенных примеров: ${checked}`)
  assert.ok(checked > 0)
})

/* ══════════════════════════ 2. рекурсия по списку ═══════════════════════════ */

/* «Сумма» не хвостовая: результат вызова ещё складывается с головой. Такая
   функция печатается обычной рекурсией C — как и у интерпретатора, глубина
   растёт. */
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
  const built = await build(listProgram)
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
    points += compare(listProgram, built, name, grid)
  }
  t.diagnostic(`сверенных входов: ${points}`)
})

test("хвост списка — срез, а не копия: длинный список обходится линейно", async (t) => {
  /* В JS «хвост» копирует, потому что массив нельзя разделить с суффиксом.
     Здесь значения неизменяемы и лежат в арене, поэтому хвост — срез, и
     наблюдаемо это неотличимо: значение то же, а времени меньше. */
  const built = await build(listProgram)
  assert.match(built.source, /fl_chain_tail\(/u, "хвост обязан браться срезом рантайма")
  const рантайм = built.emitted.files.find((file) => file.path === "flang_runtime.c").content
  assert.match(рантайм, /return fl_list_slice\(value, 1\);/u, "срез обязан быть сдвигом начала, а не копией")
  const long = Array.from({ length: 3000 }, (_, index) => index)
  const started = Date.now()
  const [answer] = ask(built, [{ fn: "Сумма", args: [encode(long)] }])
  assert.equal(answer.ok, true)
  assert.equal(decode(answer.value), (2999 * 3000) / 2)
  t.diagnostic(`список из 3000 элементов пройден рекурсией за ${Date.now() - started} мс`)
})

/* ══════════════ 2а. «добавить» не трогает старый список ══════════════ */

/**
 * `добавить` в рантайме на C не копирует список: массив выделяется с запасом,
 * и элемент дописывается в запас на месте (`fl_b_dobavit`). Выигрыш огромен —
 * список из n элементов стоил ~16·n² байт неотбираемой памяти, потому что арена
 * не отдаёт ничего до конца вызова, — но цена ошибки здесь не «медленно», а
 * «тихо испорченные данные»: значения flang неизменяемы, и ссылка на список,
 * сохранённая ДО добавления, обязана видеть прежнюю длину и прежние элементы.
 *
 * Поэтому проверяется ровно это, и двумя способами сразу: значения сверяются с
 * интерпретатором (он копирует, и другого поведения у него быть не может) и,
 * отдельно, выписаны в тесте руками — чтобы тест говорил о свойстве, а не
 * только «у обоих одинаково».
 *
 * Опасны три случая, и все три здесь есть:
 *   • два `добавить` к ОДНОМУ значению — вторая ветка обязана уйти на копию,
 *     иначе она затрёт ячейку, уже отданную первой («Разветвление»);
 *   • ссылка на каждый префикс, пока список растёт дальше («Снимки»);
 *   • удлинение каждого такого префикса задним числом, когда массив давно
 *     ушёл вперёд («Ветви»).
 * Длины подобраны так, чтобы перевыделение запаса (он удваивается) попало и
 * внутрь, и на границу.
 */
const appendSource = `модуль «Неизменяемость»

объект «Ход»
  текущий: список числа
  снимки: список список числа

тотальная функция «Разветвление»
  принимает элементы: список числа
  возвращает список список числа
  пусть «с единицей» равно добавить 1 к элементы
  пусть «с двойкой» равно добавить 2 к элементы
  пусть «и тройка» равно добавить 3 к «с единицей»
  пусть «и четвёрка» равно добавить 4 к «с единицей»
  пусть «и пятёрка» равно добавить 5 к «с двойкой»
  [элементы, «с единицей», «с двойкой», «и тройка», «и четвёрка», «и пятёрка»]

тотальная функция «Снимки»
  принимает элементы: список числа
  возвращает список список числа
  пусть итог равно свёртка элементы начиная с (запись «Ход» с текущий равным пустой список и снимки равным пустой список) как ход и эл
    запись «Ход» с текущий равным (добавить эл к ход.текущий) и снимки равным (добавить ход.текущий к ход.снимки)
  добавить итог.текущий к итог.снимки

тотальная функция «Ветви»
  принимает элементы: список числа
  возвращает список список числа
  пусть снимки равно «Снимки» от элементы
  отобразить снимки как снимок → добавить 0 к снимок

тотальная функция «Сколько накопилось»
  принимает элементы: список числа
  возвращает число
  пусть собрано равно свёртка элементы начиная с пустой список как акк и эл → добавить [эл, эл] к акк
  длина собрано
`

test("«добавить» дописывает в запас, но старый список остаётся прежним", async (t) => {
  const program = parse(appendSource)
  const built = await build(program)

  /* Длины вокруг каждого удвоения запаса (4, 8, 16, …) и заведомо длинный
     список, где запас перевыделялся много раз. */
  const lengths = [0, 1, 2, 3, 4, 5, 7, 8, 9, 15, 16, 17, 31, 32, 33, 63, 64, 65, 200, 300]
  const grid = lengths.map((length) => [Array.from({ length }, (_, index) => index + 1)])
  let points = 0
  for (const name of ["Разветвление", "Снимки", "Ветви"]) points += compare(program, built, name, grid)

  /* То же свойство, выписанное явно: первый элемент ответа — исходный список,
     и он обязан быть ровно тем, что пришёл. */
  const [forked] = ask(built, [{ fn: "Разветвление", args: [encode([7, 8])] }])
  assert.equal(forked.ok, true, JSON.stringify(forked))
  assert.deepEqual(
    decode(forked.value),
    [[7, 8], [7, 8, 1], [7, 8, 2], [7, 8, 1, 3], [7, 8, 1, 4], [7, 8, 2, 5]],
    "второе «добавить» к тому же списку затёрло результат первого",
  )

  /* И на длинном списке: каждая ветка — свой префикс плюс ноль, ни один
     префикс не подрос и не съехал. */
  const long = Array.from({ length: 400 }, (_, index) => index + 1)
  const [branches] = ask(built, [{ fn: "Ветви", args: [encode(long)] }])
  assert.equal(branches.ok, true, JSON.stringify(branches).slice(0, 200))
  assert.deepEqual(
    decode(branches.value),
    Array.from({ length: 401 }, (_, index) => [...long.slice(0, index), 0]),
    "префикс изменился после того, как список ушёл вперёд",
  )
  t.diagnostic(`сверенных входов: ${points}`)
})

test("список из 200 000 элементов собирается «добавить» в 512 МБ", async (t) => {
  /* Мера, а не ощущение — и мера, не зависящая от машины: предел ставит сам
     тест. «Сколько накопилось» делает ровно то, на чём стоял лексер: на каждом
     шаге выделяет значение и дописывает его в накопитель, то есть между двумя
     «добавить» арена успевает выдать что-то ещё.
     Прежний «добавить» копировал список целиком, а арена не отдаёт ничего до
     конца запроса: 16·200000² — это 640 ГБ, и в предел он не уложился бы,
     промахнувшись на шесть порядков. Нынешний тратит около 4n ячеек на массив
     плюс сами значения — десятки мегабайт. Между этими числами можно провести
     границу где угодно; 512 МБ выбрано так, чтобы её не двигал ни аллокатор,
     ни разрядность указателя. */
  const program = parse(appendSource)
  const built = await build(program)
  const request = JSON.stringify({ fn: "Сколько накопилось", args: [encode(Array.from({ length: 200_000 }, (_, i) => i))] })
  const run = spawnSync("/bin/sh", ["-c", `ulimit -v 524288; exec "$0"`, built.cli], {
    input: `${request}\n`,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  assert.equal(run.status, 0, `прогонщик не ответил: ${run.stderr}`)
  const answer = JSON.parse(run.stdout.trim())
  assert.equal(answer.ok, true, `200 000 «добавить» не уложились в 512 МБ: ${JSON.stringify(answer)}`)
  assert.equal(decode(answer.value), 200_000)
  t.diagnostic("200 000 «добавить» с выделением на каждом шаге уложились в 512 МБ")
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

test("обход дерева-суммы: конструкторы вариантов и разбор дискриминанта", async (t) => {
  const built = await build(treeProgram)
  /* Роль в имени («вариант Лист» → derevya_variant_list) — не украшение: у C
     одно пространство имён, и вариант, одноимённый с функцией, давал бы один
     идентификатор на два объявления. На ядре FTS это ровно так и случилось:
     «Значение операнда» там и вариант суммы, и функция вычислителя. */
  assert.match(
    built.header,
    /fl_status derevya_variant_list\(/u,
    "конструктор варианта «Лист» обязан быть объявлен с ролью в имени",
  )
  assert.match(built.source, /fl_variant_is\([a-z_0-9]+, "Узел"\)/u, "разбор — это проверка дискриминанта")

  const лист = (n) => variant("Лист", { "значение": n })
  const узел = (l, r) => variant("Узел", { "левое": l, "правое": r })
  const глубокое = (depth) => (depth === 0 ? лист(1) : узел(глубокое(depth - 1), лист(depth)))

  const grid = [
    [variant("Пустое", {})],
    [лист(5)],
    [узел(лист(1), лист(2))],
    [узел(узел(лист(1), лист(2)), узел(лист(3), лист(4)))],
    [глубокое(500)],
    /* Разбор без подходящего случая и обращение к отсутствующему полю. */
    [variant("Лист", {})],
    [42],
    [null],
    [{ "значение": 1 }],
  ]
  const points = compare(treeProgram, built, "Сумма дерева", grid) +
    compare(treeProgram, built, "Удвоить дерево", grid)
  t.diagnostic(`сверенных входов: ${points}`)
})

/* ══════════════════════════ 4. взаимная рекурсия ═══════════════════════════ */

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

test("взаимная рекурсия совпадает с интерпретатором и держит постоянный стек", async (t) => {
  const built = await build(mutualProgram)
  assert.match(built.source, /fl_trampoline\(/u, "взаимная хвостовая рекурсия печатается через батут")
  assert.match(built.source, /bounce->next = /u, "хвостовой вызов соседа — отскок, а не кадр стека")

  const grid = [-1, 0, 1, 2, 3, 10, 11, 999, 1000].map((value) => [value])
  const points = compare(mutualProgram, built, "Чётное", grid) +
    compare(mutualProgram, built, "Нечётное", grid)

  /* depth = 16 — доказательство, что вызовы действительно хвостовые: без
     переиспользования кадра оба движка упёрлись бы в предел на 17-м шаге. */
  const limits = { maxSteps: 100_000_000, maxDepth: 16 }
  assert.equal(interpret(mutualProgram, "Чётное", [50_000], limits), true)
  const [even, odd] = ask(built, [
    { fn: "Чётное", args: [encode(50_000)], depth: "16" },
    { fn: "Нечётное", args: [encode(50_001)], depth: "16" },
  ])
  assert.deepEqual([even.ok, decode(even.value)], [true, true])
  assert.deepEqual([odd.ok, decode(odd.value)], [true, true])
  t.diagnostic(`сверенных входов: ${points}; 50 000 взаимных хвостовых шагов при пределе глубины 16`)
})

/* ══════════════════════════ 5. хвостовая рекурсия на 100 000 шагов ═══════════ */

/* Ключевой тест слоя. Интерпретатор переиспользует кадр возврата, поэтому
   считает 100 000 шагов в постоянной глубине. Напечатанная «в лоб» рекурсия C
   переполнила бы стек — именно поэтому хвостовой самовызов идёт в `for (;;)`. */
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
  const built = await build(countdownProgram)
  assert.match(built.source, /for \(;;\) \{/u, "хвостовой самовызов обязан стать циклом")
  assert.match(built.source, /^ +continue;$/mu, "цикл обязан замыкаться на continue, а не на рекурсию")
  assert.doesNotMatch(built.source, /FL_TRY\(otschyot_otschyot\(/u, "самовызова остаться не должно")

  const expected = (100_000 * 100_001) / 2
  /* depth = 8 — доказательство хвостовой природы вызова: без переиспользования
     кадра оба движка упёрлись бы в предел на девятом шаге. */
  const byInterpreter = interpret(countdownProgram, "Отсчёт", [100_000, 0], { maxSteps: 100_000_000, maxDepth: 8 })
  assert.equal(byInterpreter, expected)
  const [answer] = ask(built, [{ fn: "Отсчёт", args: [encode(100_000), encode(0)], depth: "8" }])
  assert.equal(answer.ok, true, `собранный C не сосчитал 100 000 шагов: ${JSON.stringify(answer)}`)
  assert.equal(decode(answer.value), expected)

  const grid = [-1, 0, 1, 2, 7, 1000].map((value) => [value, 0])
  const points = compare(countdownProgram, built, "Отсчёт", grid, { limits: { maxSteps: 10_000_000 } })
  t.diagnostic(`100 000 шагов пройдено обоими движками; дополнительно сверено входов: ${points}`)
})

/*
 * Линейное «добавить».
 *
 * Наивная реализация копировала список целиком на каждом шаге: накопление в
 * цикле стоило O(n²) времени и, поскольку арена ничего не отдаёт обратно,
 * 16·n² байт памяти. Тест берёт n, при котором старое поведение заведомо не
 * доходит: 50 000 элементов — это ~40 ГБ копий, то есть не «медленно», а
 * невозможно. Проходит он, следовательно, только если продление на месте
 * работает; отдельного замера памяти для этого не нужно.
 */
const accumulateSource = [
  "модуль «Накопление»",
  "",
  "функция «Копить»",
  "  принимает n: число, акк: список числа",
  "  возвращает список числа",
  "  если n не больше 0",
  "    то акк",
  "    иначе «Копить» от (n минус 1) и (добавить n к акк)",
  "",
  "функция «Сколько»",
  "  принимает n: число",
  "  возвращает число",
  "  длина («Копить» от n и пустой список)",
].join("\n")

test("«добавить» в цикле линейно: 50 000 элементов доходят, а не упираются в память", async (t) => {
  const program = parse(accumulateSource)
  const built = await build(program)

  /* Значение прежде всего: продление на месте не имеет права менять результат. */
  const points = compare(program, built, "Сколько", [[0], [1], [2], [10], [1000]], {
    limits: { maxSteps: 100_000_000 },
  })

  const n = 50_000
  const [answer] = ask(built, [{ fn: "Сколько", args: [encode(n)], steps: "100000000" }])
  assert.equal(answer.ok, true, `собранный C не накопил ${n} элементов: ${JSON.stringify(answer)}`)
  assert.equal(decode(answer.value), n)
  t.diagnostic(`накоплено ${n} элементов; дополнительно сверено входов: ${points}`)
})

test("внутренний цикл не перехватывает continue хвостового самовызова", async () => {
  /* `отфильтровать` печатается циклом `for`, а хвостовой самовызов — как
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
  const built = await build(program)
  compare(program, built, "Свести", [
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

test("нарушение постусловия: код FTS_UTILITY_PROPERTY и текст ядра дословно", async () => {
  const document = core.compile(violatingSource)
  const program = fromFtsDocument(document)
  const built = await build(program)

  /* Код и текст едут в AST данными — значит и в C они литералы, а не знание,
     зашитое в бэкенд. */
  assert.match(built.source, /"FTS_UTILITY_PROPERTY"/u)

  const byCore = outcome(() => core.executeUtility(document, "Только положительное", { "сумма": -5 }))
  const [answer] = ask(built, [{ fn: "Только положительное", args: [encode({ "сумма": -5 })] }])
  assert.equal(answer.ok, false)
  assert.equal(answer.code, "FTS_UTILITY_PROPERTY")
  assert.equal(answer.code, byCore.code, "код обязан совпасть с ядром FTS")
  assert.equal(answer.message, byCore.message, "текст обязан совпасть с ядром FTS дословно")

  const grid = [-5, -1, 0, 1, 5, -1001].map((value) => ({ [INPUT_PARAM]: { "сумма": value } }))
  compare(program, built, "Только положительное", grid)
})

test("постусловие без кода даёт FLANG_PROPERTY, не признак — FLANG_TYPE", async () => {
  const program = {
    flang: 1,
    module: "Свойства",
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
      {
        name: "Кривое",
        params: [{ name: "х", type: { kind: "number" } }],
        returns: { kind: "number" },
        body: { kind: "var", name: "х" },
        postconditions: [{ name: "Не признак", expr: { kind: "literal", value: 1 }, bind: "результат" }],
      },
    ],
  }
  const built = await build(program)
  compare(program, built, "Значение", [[1], [0], [-1]])
  compare(program, built, "Кривое", [[1], [0]])

  const [broken, wrong] = ask(built, [
    { fn: "Значение", args: [encode(-1)] },
    { fn: "Кривое", args: [encode(1)] },
  ])
  assert.equal(broken.code, "FLANG_PROPERTY")
  assert.equal(broken.message, "нарушено свойство «Неотрицательно» функции «Значение»")
  assert.equal(wrong.code, "FLANG_TYPE")
})

test("функция с постусловием не получает хвостовой оптимизации — как в интерпретаторе", async () => {
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
  const built = await build(program)
  assert.doesNotMatch(built.source, /for \(;;\)/u, "постусловие запрещает разворот в цикл")
  compare(program, built, "Счёт", [[0], [1], [5], [50]])
})

/* ══════════════════════════ 7. предел глубины ═══════════════════════════ */

test("нехвостовая рекурсия глубже предела даёт FLANG_RECURSION_LIMIT у обоих движков", async () => {
  /* У интерпретатора переполнение стека невозможно (стек в куче), у C —
     возможно и означает падение процесса. Поэтому счётчик глубины обязателен,
     и его код с текстом обязаны совпасть с интерпретатором. */
  const built = await build(listProgram)
  const long = Array.from({ length: 40 }, (_, index) => index)
  const points = compare(listProgram, built, "Сумма", [[long]], {
    depth: 20,
    limits: { maxDepth: 20, maxSteps: 10_000_000 },
  })
  assert.equal(points, 1)

  const [answer] = ask(built, [{ fn: "Сумма", args: [encode(long)], depth: "20" }])
  assert.equal(answer.code, "FLANG_RECURSION_LIMIT")
  assert.match(answer.message, /^функция «Сумма» превысила предел глубины вызовов \(20\) на глубине 21$/u)
})

/* ══════════════════════════ 8. строковые формы ═══════════════════════════ */

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
    builtinFn("Содержит", "содержит", ["т", "ч"]),
    builtinFn("Начинается", "начинается с", ["т", "п"]),
    builtinFn("К числу", "к числу", ["т"]),
    builtinFn("К строке", "к строке", ["з"]),
    builtinFn("Пусто", "пусто", ["з"]),
    builtinFn("Голова", "голова", ["с"]),
    builtinFn("Хвост", "хвост", ["с"]),
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
   иначе «мир 🌍» окажется длиной 6 (UTF-16) или 8 (UTF-8), а не 5. */
const texts = ["", "привет", "мир 🌍", "ёжик", "a", "😀😀", "\u{1F600}абв", "  42  ", "3.5e2", "не число", "да",
  "  7  ", "ЁЖИК"]
const indices = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 1.5, 100]

test("строковые формы: кириллица, суррогатные пары и границы индексов", async (t) => {
  const built = await build(stringProgram)
  let points = 0

  points += compare(stringProgram, built, "Длина", [...texts, [1, 2, 3], [], 42, null].map((value) => [value]))

  const symbolGrid = []
  for (const index of indices) for (const text of texts) symbolGrid.push([index, text])
  symbolGrid.push([1, 42], [null, "абв"])
  points += compare(stringProgram, built, "Символ", symbolGrid)

  const subGrid = []
  for (const text of texts) for (const from of [0, 1, 2, 3]) for (const to of [0, 1, 2, 3, 6, 100]) subGrid.push([text, from, to])
  points += compare(stringProgram, built, "Подстрока", subGrid)

  points += compare(stringProgram, built, "Соединить", [
    ["мир", " 🌍"],
    ["", ""],
    [["а", "б"], "-"],
    [["а", 1], "-"],
    [[], "-"],
    [["🌍"], "🌍"],
    [1, "а"],
    ["а", 1],
  ])
  points += compare(stringProgram, built, "Разделить", [["а,б,в", ","], ["", ","], ["абв", ""], ["🌍-🌍", "-"], [1, ","], ["ааа", "аа"]])
  /* «символы» обязана делить по кодовым точкам: на «мир 🌍» это 5 элементов, а
     не 6 (единицы UTF-16) и не 8 (байты UTF-8). Комбинирующий знак остаётся
     отдельным элементом — это кодовая точка, а не графема, и в Elixir легко
     ошибиться, взяв String.graphemes. */
  points += compare(stringProgram, built, "Символы", [
    [""], ["a"], ["привет"], ["мир 🌍"], ["😀😀"], ["\u{1F600}абв"], ["e\u0301"], [42], [null], [["а"]],
  ])
  points += compare(stringProgram, built, "Содержит", [["привет", "иве"], ["мир 🌍", "🌍"], [[1, 2], 2], [[1, 2], 3], [1, 2], ["", ""]])
  points += compare(stringProgram, built, "Начинается", [["привет", "при"], ["", ""], ["🌍x", "🌍"], [1, "а"]])
  points += compare(stringProgram, built, "К числу", [...texts, "0", "-0", "1e3", "Infinity", "0x10", "+5", "1.", ".5", "1e", "1e999"].map((value) => [value]))
  /* «к строке» от признака обязано дать «да»/«нет», а не true/false. */
  points += compare(stringProgram, built, "К строке", [true, false, null, 0, -0, Number.NaN, Infinity, -Infinity, 1e21, 1e-7, 0.1, "уже строка", [1]].map((value) => [value]))
  points += compare(stringProgram, built, "Пусто", [[""], ["а"], [[]], [[1]], [42], [null]])
  points += compare(stringProgram, built, "Голова", [[[]], [[1, 2]], ["строка"], [null]])
  points += compare(stringProgram, built, "Хвост", [[[]], [[1, 2]], ["строка"]])
  points += compare(stringProgram, built, "Добавить", [[1, []], [1, [2]], [1, "строка"]])
  points += compare(stringProgram, built, "Остаток", [[7, 3], [7, 0], [-7, 3], [7.5, 2], ["a", 1]])
  /* Проценты: порядок (процент / 100) * значение виден на этих числах. */
  points += compare(stringProgram, built, "Процент", [[10, 10000.1], [20, 1 / 3], [5, 1e308], [0, 0], ["a", 1]])
  /* Разбор строки образцами: пустая, один символ, суррогатная пара, а также
     не-строки — у них ни один случай не подходит, и отказ обязан совпасть. */
  points += compare(stringProgram, built, "Развернуть",
    [...texts, ["а", "б"], [], 42, null].map((value) => [value]))

  const answers = ask(built, [
    { fn: "К строке", args: [encode(true)] },
    { fn: "К строке", args: [encode(false)] },
    { fn: "К строке", args: [encode(null)] },
    { fn: "Длина", args: [encode("мир 🌍")] },
    { fn: "Символ", args: [encode(5), encode("мир 🌍")] },
  ])
  assert.deepEqual(answers.map((answer) => decode(answer.value)), ["да", "нет", "ничто", 5, "🌍"])
  t.diagnostic(`сверенных входов: ${points}`)
})

test("нулевая индексация строк включается опцией и остаётся согласованной", async () => {
  const built = await build(stringProgram, { indexBase: 0 })
  const grid = []
  for (const index of indices) for (const text of texts) grid.push([index, text])
  compare(stringProgram, built, "Символ", grid, { limits: { indexBase: 0 } })
})

/* ══════════════════════════ 9. семантика чисел и равенства ═══════════════════ */

test("порядок вычисления строго слева направо: первая ошибка — левая", async () => {
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
  const built = await build(program)
  compare(program, built, "Сложить", [
    [[], []],
    [[1], []],
    [[], [1]],
    [[1], [2]],
    ["не список", []],
  ])
})

test("деление на ноль даёт Infinity и NaN, равенство — Object.is", async () => {
  const program = {
    flang: 1,
    module: "Числа",
    functions: [
      {
        name: "Делить",
        params: [{ name: "а" }, { name: "б" }],
        body: { kind: "binary", op: "div", left: { kind: "var", name: "а" }, right: { kind: "var", name: "б" } },
      },
      {
        name: "Равны",
        params: [{ name: "а" }, { name: "б" }],
        body: { kind: "binary", op: "eq", left: { kind: "var", name: "а" }, right: { kind: "var", name: "б" } },
      },
    ],
  }
  const built = await build(program)
  compare(program, built, "Делить", [[1, 0], [-1, 0], [0, 0], [1, 2], [-0, 1], [1, -0]])

  const values = [0, -0, Number.NaN, 1, "1", true, null, [1, 2], [1, 2, 3], { "а": 1 }, { "а": 1, "б": 2 },
    variant("Лист", { "значение": 1 }), variant("Лист", { "значение": 2 }), variant("Узел", {})]
  const grid = []
  for (const left of values) for (const right of values) grid.push([left, right])
  const points = compare(program, built, "Равны", grid)

  const [nan, zero] = ask(built, [
    { fn: "Равны", args: [encode(Number.NaN), encode(Number.NaN)] },
    { fn: "Равны", args: [encode(0), encode(-0)] },
  ])
  assert.equal(decode(nan.value), true, "NaN обязан быть равен NaN")
  assert.equal(decode(zero.value), false, "0 не равен −0")
  assert.ok(points > 100)
})

/* ══════════════════════════ 10. настоящий исходник flang ═══════════════════ */

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

test("исходник flang через настоящий парсер собирается и совпадает с интерпретатором", async (t) => {
  const program = parse(flangSource)
  const built = await build(program)
  assert.match(built.header, /Функция flang «Длина»/u)
  assert.match(built.header, /Запись FTS «Позиция»/u)

  let points = compare(program, built, "Длина", [
    [[]],
    [[1, 2, 3]],
    [Array.from({ length: 150 }, (_, index) => index)],
    ["не список"],
    [null],
  ])

  const позиция = (цена, название) => ({ "цена": цена, "название": название })
  points += compare(program, built, "Итого", [
    [[]],
    [[позиция(10, "а")]],
    [[позиция(10, "а"), позиция(2.5, "б")]],
    [[позиция("дорого", "а")]],
    [[{ "название": "без цены" }]],
    ["не список"],
  ])

  points += compare(program, built, "Показать", [
    [variant("Слово", { "текст": "привет" })],
    [variant("Конец", {})],
    [variant("Слово", {})],
    [42],
    [null],
    ["строка"],
  ])
  t.diagnostic(`сверенных входов: ${points}`)
})

test("сторож меры: отказ у собранного C дословно тот же, что у интерпретатора", async (t) => {
  /* Доказательство по мере верно для вещественных чисел, а числа flang —
     IEEE-754 double: `н минус 1` при большом |н| равен н, спуск не идёт, и
     `тотальная` обещала бы завершение там, где его нет. Понижение перед
     печатью ставит на доказанном мерой аргументе проверку убывания
     (`src/defunc.mjs`), а вычислитель зовёт то же понижение — значит отказ у
     них обязан совпасть КОДОМ И ТЕКСТОМ, а не «по смыслу». Ради этого
     совпадения сторож и выражен постусловием: код и текст едут в AST данными,
     и оба движка читают одно поле.

     Сетка — не выдумка: 2⁵⁴+4 и 1e308 это входы, где шаг ничего не меняет;
     ±∞ и NaN — там же по другой причине; 0, 1, 7 и 2.5 — обычный спуск,
     который сторож обязан пропустить неотличимо от программы без него. */
  const program = markMeasureGuards(parse(`модуль «Счёт»

тотальная функция «До нуля»
  принимает н: число
  возвращает число
  если н не больше 0
    то 0
    иначе «До нуля» от (н минус 1)
`))
  const built = await build(program)
  assert.match(built.source, /FLANG_MEASURE/u, "сторож не доехал до напечатанного C")

  const points = compare(program, built, "До нуля", [
    [0], [1], [7], [2.5], [-3],
    [18014398509481988], [1e308], [Infinity], [-Infinity], [NaN],
  ])
  t.diagnostic(`сверенных входов: ${points}`)
})

/* ══════════════════════════ 11. форма результата ═══════════════════════════ */

test("детерминированность: две печати дают побайтово одно и то же", async () => {
  const programs = [listProgram, treeProgram, mutualProgram, countdownProgram, stringProgram, parse(flangSource)]
  for (const model of models) {
    const program = fromFtsDocument(model.document)
    if ((program.functions ?? []).length > 0) programs.push(program)
  }
  for (const program of programs) {
    const first = emitC(program)
    const second = emitC(program)
    assert.deepEqual(first, second)
    /* И ещё раз после кругосветки через JSON: вывод не зависит от того, откуда
       приехал AST. */
    const third = emitC(JSON.parse(JSON.stringify(program)))
    assert.deepEqual(first, third)
  }
})

test("напечатанный C ни от чего не зависит и объясняет себя", async () => {
  const built = await build(treeProgram)
  const all = built.emitted.files.map((file) => file.content).join("\n")
  assert.doesNotMatch(all, /#include\s*<(?!stdarg|stdbool|stddef|stdio|stdlib|string|math|errno)/u,
    "кроме стандартной библиотеки C зависимостей быть не может")
  assert.doesNotMatch(all, /\bglib\b|\butf8proc\b|\biconv\b/u)
  assert.doesNotMatch(all, /\btime\(|\brand\(|\bgetenv\(/u, "ни времени, ни случайности, ни окружения")
  assert.match(built.source, /^\/\*\n \* Сгенерировано flang/u)
  assert.match(built.source, /Не редактировать руками/u)
  /* Имена FTS сохраняются рядом с каждым типом и каждой функцией. */
  assert.match(built.header, /Функция flang «Сумма дерева»/u)
  assert.match(built.header, /Сумма типов FTS «Дерево»/u)
})

/**
 * Оболочка `flang repl` — единственный файл печати, которому нужен мир: она
 * ищет `cc` и каталоги установки, то есть спрашивает окружение и POSIX. Ровно
 * поэтому она, во-первых, отдельный файл (обещание выше остаётся верным для
 * всего остального, и взявший напечатанный C к себе в проект просто не берёт
 * этот файл), а во-вторых — печатается по просьбе: осмысленна она у одной
 * программы из всех, у самого компилятора flang.
 */
test("оболочка печатается только по просьбе, и её нужды названы поимённо", async () => {
  const без = emitC(treeProgram)
  assert.ok(!без.files.some((file) => file.path === "flang_repl.c"), "оболочка приехала без просьбы")
  /* Сам `#ifdef FL_WITH_REPL` в прогонщике есть всегда — нет только просьбы,
     то есть `#define`, который его включает. */
  assert.doesNotMatch(
    без.files.find((file) => file.path === "flang_cli.c").content,
    /#define FL_WITH_REPL/u,
    "прогонщик без просьбы не должен звать оболочку",
  )
  assert.doesNotMatch(без.files.find((file) => file.path === "Makefile").content, /flang_repl/u)

  const built = await build(treeProgram, { repl: true })
  const оболочка = built.emitted.files.find((file) => file.path === "flang_repl.c")
  assert.ok(оболочка !== undefined, "по просьбе оболочка обязана печататься")
  /* Список нужд оболочки записан здесь поимённо: POSIX ей нужен ради временного
     каталога, поиска бинарника, isatty и Ctrl-C, а окружение — ради FLANG_CC,
     FLANG_LIB_DIR и FLANG_INCLUDE_DIR. Вырасти незаметно этот список не может. */
  assert.doesNotMatch(
    оболочка.content,
    /#include\s*<(?!stdarg|stdbool|stddef|stdio|stdlib|string|math|errno|signal|unistd)/u,
    "оболочке хватает стандартной библиотеки C плюс signal.h и unistd.h",
  )
  assert.doesNotMatch(оболочка.content, /\btime\(|\brand\(/u, "ни времени, ни случайности не нужно и оболочке")
  /* И то, ради чего она вообще отдельно: прогонщик остаётся чистым C99. */
  const прогонщик = built.emitted.files.find((file) => file.path === "flang_cli.c")
  assert.doesNotMatch(прогонщик.content, /#include\s*<(signal|unistd)\.h>/u)
  assert.match(прогонщик.content, /#define FL_WITH_REPL 1/u, "просьба доезжает до прогонщика")
  assert.match(built.emitted.files.find((file) => file.path === "Makefile").content, /flang_repl\.o/u)

  /*
   * И главное: собранная так ЧУЖАЯ программа не выдаёт себя за flang. Файл один
   * на все программы, справка в нём написана про язык, и `--help` у программы
   * «Дерево» рассказал бы про flang и назвал бы его версию — то есть соврал бы
   * о себе там, где вопрос как раз о ней. Поэтому первым делом спрашивается
   * «кто я», и ответ здесь отрицательный.
   */
  for (const команда of ["--help", "--version", "check", "repl"]) {
    const итог = spawnSync(built.cli, [команда], { input: "", encoding: "utf8" })
    assert.equal(итог.status, 2, `«${команда}» у чужой программы обязан отказать`)
    assert.equal(итог.stdout, "", `«${команда}» у чужой программы что-то напечатал: ${итог.stdout}`)
    assert.match(итог.stderr, /человеческие команды есть только у компилятора flang/u)
  }
  /* А прогонщик у неё работает как прежде: контракт трубы не тронут. */
  const ответ = spawnSync(built.cli, [], { input: '{"fn":"Сумма дерева","args":[{"v":"Лист","f":[["значение",{"n":"7"}]]}]}\n', encoding: "utf8" })
  assert.equal(ответ.status, 0)
  assert.deepEqual(JSON.parse(ответ.stdout), { ok: true, value: { n: "7" } })
})

/*
 * Двунаправленные управляющие символы в литерале.
 *
 * Таблица блоков лексера (flang/self/lexer.flang) перечисляет весь блок
 * U+2000…U+207F подряд, и одиннадцать из них — двунаправленные управляющие.
 * Напечатанные сырыми, они ловятся -Wbidi-chars, и под -Werror напечатанный C
 * переставал собираться вовсе. Экранирование восьмеричными байтами обязано
 * убрать предупреждение, НЕ меняя значения: те же кодовые точки, та же длина.
 *
 * Долгое время эта проверка была единственной на весь проект — и потому три
 * цели, добавленные позже (java, csharp, elixir), правило не унаследовали.
 * Общая проверка на все цели сразу теперь в flang/test/emit-bidi.test.mjs, она
 * перебирает реестр целей; здесь остаётся то, чего та проверить не может, —
 * настоящий gcc с -Werror.
 *
 * Источник записан через `\uXXXX`, поэтому сырых двунаправленных нет и в самом
 * этом файле — иначе тест воспроизводил бы ровно ту беду, от которой стережёт.
 */
const bidiSource = [
  "модуль «Двунаправленные»",
  "",
  "тотальная функция «Метка»",
  "  возвращает строка",
  '  "\\u202aле\\u202cво"',
  "",
  "тотальная функция «Длина метки»",
  "  возвращает число",
  "  длина («Метка»)",
].join("\n")

const BIDI_CONTROLS = [0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]

test("двунаправленные управляющие экранируются: -Wbidi-chars молчит, значение то же", async () => {
  const program = parse(bidiSource)
  /* build() собирает с -Werror, и до починки падал уже здесь. */
  const built = await build(program)

  const all = built.emitted.files.map((file) => file.content).join("\n")
  const raw = [...all].filter((character) => BIDI_CONTROLS.includes(character.codePointAt(0)))
  assert.equal(raw.length, 0, "в напечатанном C не может быть сырых двунаправленных управляющих")

  /* Экранирование восьмеричное и побайтное: в узкой строке C нет `\u`. */
  assert.match(built.source, /\\342\\200\\252/u, "U+202A обязан приехать байтами 342 200 252")

  /* Главное: значение не изменилось — те же кодовые точки, та же длина. */
  const points =
    compare(program, built, "Метка", [[]]) + compare(program, built, "Длина метки", [[]])
  assert.equal(points, 2)
})

test("сборка и gcc, и clang с обязательными флагами на всех путях печати", async (t) => {
  /* По одной программе на каждый способ печати: суммы типов и конструкторы,
     батут, цикл хвостового самовызова, строковые формы, свёртка с записями.
     Собрать «что-нибудь одно» обоими компиляторами значило бы проверить
     заголовок, а не кодогенерацию. */
  const programs = [
    ["дерево-сумма", treeProgram],
    ["батут", mutualProgram],
    ["хвостовой цикл", countdownProgram],
    ["строковые формы", stringProgram],
    ["исходник через парсер", parse(flangSource)],
  ]
  const reports = []
  for (const cc of ["gcc", "clang"]) {
    for (const [what, program] of programs) {
      const built = await build(program, { cc, extraFlags: ["-O2"] })
      const [answer] = ask(built, [{ fn: program.functions[0].name, args: program.functions[0].params.map(() => null) }])
      assert.ok(typeof answer.ok === "boolean", `${cc} / ${what}: собранная программа обязана отвечать`)
    }
    const version = execFileSync(cc, ["--version"], { encoding: "utf8" }).split("\n")[0]
    reports.push(`${version}: ${CFLAGS.join(" ")} -O2, ${programs.length} программ — без предупреждений`)
  }
  t.diagnostic(reports.join("; "))
})

test("напечатанный Makefile собирает библиотеку и прогонщик", async (t) => {
  const built = await build(treeProgram)
  const make = spawnSync("make", ["-B"], { cwd: built.directory, encoding: "utf8" })
  if (make.error !== undefined && make.error.code === "ENOENT") {
    t.diagnostic("make в системе нет — проверка пропущена")
    return
  }
  assert.equal(make.status, 0, `make не собрал напечатанное:\n${make.stdout}\n${make.stderr}`)
  assert.match(make.stdout, /ar rcs libderevya\.a/u, "библиотека — часть выдачи, а не только прогонщик")
})

test("проверка на утечки: valgrind не находит ни потерянного байта", async (t) => {
  const probe = spawnSync("valgrind", ["--version"], { encoding: "utf8" })
  if (probe.status !== 0) {
    t.diagnostic("valgrind в системе нет — проверка пропущена")
    return
  }
  const built = await build(treeProgram)
  const лист = (n) => variant("Лист", { "значение": n })
  const узел = (l, r) => variant("Узел", { "левое": l, "правое": r })
  const глубокое = (depth) => (depth === 0 ? лист(1) : узел(глубокое(depth - 1), лист(depth)))
  const requests = [
    { fn: "Сумма дерева", args: [encode(глубокое(200))] },
    { fn: "Удвоить дерево", args: [encode(глубокое(200))] },
    { fn: "Сумма дерева", args: [encode(42)] },
    { fn: "Удвоить дерево", args: [encode(variant("Лист", {}))] },
    { fn: "Нет такой", args: [] },
  ]
  const run = spawnSync(
    "valgrind",
    ["--leak-check=full", "--show-leak-kinds=all", "--errors-for-leak-kinds=all", "--error-exitcode=9", built.cli],
    { input: `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`, encoding: "utf8" },
  )
  const report = (run.stderr ?? "").split("\n").filter((line) => /(ERROR SUMMARY|in use at exit|total heap usage)/u.test(line))
  assert.equal(run.status, 0, `valgrind нашёл проблему:\n${run.stderr}`)
  assert.match(run.stderr, /All heap blocks were freed -- no leaks are possible|in use at exit: 0 bytes/u)
  t.diagnostic(report.map((line) => line.replace(/^==\d+==\s*/u, "")).join(" | "))
})

/* ══════════════════════════ 12. ошибки печати ═══════════════════════════ */

test("статические ошибки ловятся при печати, а не в собранной программе", () => {
  const wrongArity = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "builtin", name: "длина", args: [] } }],
  }
  assert.throws(() => emitC(wrongArity), (error) => {
    assert.equal(errorCode(error), "FLANG_BUILTIN_ARGS")
    assert.equal(error.message, "«длина» ожидает 1 аргумент, получено 0")
    return true
  })

  const unknownName = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "var", name: "неизвестное" } }],
  }
  assert.throws(() => emitC(unknownName), (error) => {
    assert.equal(errorCode(error), "FLANG_UNKNOWN_NAME")
    assert.equal(error.message, "имя «неизвестное» не связано")
    return true
  })

  const unknownCall = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "call", name: "Нет такой", args: [] } }],
  }
  assert.throws(() => emitC(unknownCall), (error) => errorCode(error) === "FLANG_UNKNOWN_NAME")

  /* «Сумма» и «сумма» — разные имена модели, но один идентификатор C. */
  const collision = {
    flang: 1,
    functions: [
      { name: "Сумма", params: [], body: { kind: "literal", value: 1 } },
      { name: "сумма", params: [], body: { kind: "literal", value: 2 } },
    ],
  }
  assert.throws(() => emitC(collision), /идентификатор/u)
})

test("затенение локальных имён и совпадение с именем функции", async () => {
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
  const built = await build(program)
  compare(program, built, "значение", [[0], [5], ["строка"]])
  const [answer] = ask(built, [{ fn: "значение", args: [encode(5)] }])
  assert.equal(decode(answer.value), 16)
})

test("самовызов в цикл без единого значения в хвосте гасит result и собирается", async () => {
  /* Третье место с одним и тем же недосмотром. Функция, у которой ВСЕ хвостовые
     позиции — самовызов, разворачивается в вечный цикл и ни разу не пишет в
     *result; под -Wextra с -Werror это несобираемый C.

     Сначала чинили шаг батута (взаимная рекурсия), потом выяснилось, что для
     прямой рекурсии дефект остался — нашла его глава курса, где такая функция
     приведена примером незавершающейся программы. build() и печатает, и
     собирает, поэтому падение сборки здесь и есть проверка. */
  const built = await build({
    flang: 1,
    module: "Вечность",
    functions: [
      {
        name: "Вечность",
        total: false,
        params: [{ name: "счёт", type: { kind: "number" } }],
        returns: { kind: "number" },
        body: {
          kind: "call",
          name: "Вечность",
          args: [
            { kind: "binary", op: "add", left: { kind: "var", name: "счёт" }, right: { kind: "literal", value: 1 } },
          ],
        },
        examples: [],
      },
    ],
  })
  assert.match(built.source, /\(void\)result;/u, "тело вечного цикла обязано гасить result")
})
