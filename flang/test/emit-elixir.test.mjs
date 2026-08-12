/**
 * Печать flang → Elixir.
 *
 * Главный тест здесь один и он же единственный осмысленный: **сверка с
 * интерпретатором**. Кодогенератор не имеет права быть «почти правильным»:
 * либо напечатанная программа на каждом входе даёт то же значение и ту же
 * ошибку (код и текст), что `interpret.mjs`, либо результатам сгенерированного
 * кода нельзя верить вовсе.
 *
 * Поэтому каждая программа проходит полный путь пользователя: печатается в
 * ПУСТОЙ каталог, собирается настоящим `elixirc` ровно из того, что выдал
 * бэкенд (ни одного файла руками), и запускается настоящей BEAM. Ничего не
 * подкладывается из репозитория: если бы рантайм работал только потому, что
 * лежит рядом, дыра нашлась бы у первого же пользователя, а не здесь.
 *
 * Сборка идёт под `--warnings-as-errors`, и это здешний линтер. В Elixir
 * связанная, но не использованная переменная — предупреждение, и под этим
 * ключом оно становится отказом сборки: тот же дефект, который ломал сборку
 * бэкенда C под `-Werror`. Отдельного линтера (credo, dialyzer) бэкенд от чужой
 * машины требовать не вправе.
 *
 * Набор программ для главной сверки — не выдуманные фикстуры, а всё, что в
 * репозитории написано на самом flang: `flang/stdlib/*.flang` и
 * `flang/examples/leetcode/*.flang`. Это три десятка программ, полторы сотни
 * функций и четверть тысячи примеров; сетка входов строится из примеров и из
 * порчи их аргументов заведомо неподходящими значениями — там, где проверяются
 * коды и тексты диагностик.
 *
 * Сетка гоняется через прогонщик одним процессом на программу: запуск BEAM
 * стоит десятые доли секунды, запрос — микросекунды. Значения ездят размеченным
 * JSON — числа строкой, чтобы NaN, Infinity и −0 доехали без потерь.
 *
 * ── Где Elixir расходится с языком ──────────────────────────────────────────
 * Здесь всё собирается всегда, и расхождение всплывает значением. Отдельными
 * тестами закрыты ровно те места, где Elixir не совпадает с flang:
 *
 *   • **NaN и бесконечности не существуют как значения с плавающей точкой.**
 *     BEAM возбуждает `ArithmeticError` и на `1.0 / 0.0`, и на переполнении, а
 *     SPEC (раздел 5) требует значения. Это главное расхождение бэкенда.
 *   • целые произвольной точности против IEEE-754;
 *   • `String.length/1` считает графемы, а SPEC требует кодовые точки;
 *   • порядок вычисления аргументов вызова язык не обещает вовсе;
 *   • рекурсия ограничена иначе: стека фиксированного размера у процесса нет,
 *     он растёт в куче, и незавершающаяся нехвостовая рекурсия съедает память
 *     узла вместо того, чтобы упасть.
 *
 * И одно место, где Elixir совпадает с языком лучше всех остальных целей и где
 * это совпадение надо не потерять: **хвостовые вызовы гарантированы машиной**.
 * Ни цикла, ни батута здесь нет; ловушка ровно одна — стоит положить результат
 * хвостового вызова в переменную, и хвостовым он быть перестанет. Это
 * проверяется и текстом напечатанного кода, и поведением на ста тысячах шагов.
 *
 * ── Если тулчейна Elixir нет ────────────────────────────────────────────────
 * Тесты, которым нужен компилятор, честно пропускаются через `missingToolchain`
 * (tools/ftsc/test/toolchain-guard.mjs). Молчаливый пропуск, выглядящий как
 * успех, недопустим: `FTS_REQUIRE_TOOLCHAINS=elixir` превращает пропуск в
 * падение, а каталог с `elixirc` вне PATH указывается в `FTS_TOOLCHAIN_PATH`.
 * Тесты, которым тулчейн не нужен (детерминированность печати, статические
 * диагностики, форма выдачи), идут всегда.
 *
 * ── О мусоре на диске ───────────────────────────────────────────────────────
 * Всё печатается и собирается во временный каталог, который удаляется после
 * прогона: ни одного .beam ни в репозитории, ни после себя.
 */
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

import { errorCode } from "../src/compat.mjs"
import { evaluate as interpret, variant } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"
import { emitElixir } from "../src/emit/elixir.mjs"
import { findExecutable } from "../../tools/ftsc/src/toolchain.mjs"
import { missingToolchain } from "../../tools/ftsc/test/toolchain-guard.mjs"

const elixirBin = findExecutable("elixir")
const elixircBin = findExecutable("elixirc")
const toolchain = elixirBin !== null && elixircBin !== null

const workdir = await mkdtemp(join(tmpdir(), "flang-emit-elixir-"))
after(async () => {
  await rm(workdir, { recursive: true, force: true })
})

/* Ни сети, ни следов в домашнем каталоге: напечатанная программа ни от чего не
   зависит, и запуск обязан это доказывать. */
const ELIXIR_ENV = {
  ...process.env,
  MIX_ENV: "prod",
  ERL_CRASH_DUMP_SECONDS: "0",
}

/* Строгий режим: связанное, но не использованное имя в Elixir — предупреждение,
   и под этим ключом оно становится отказом сборки. Именно здесь ловится тот
   дефект, который в C ломал сборку неиспользованным результатом. */
const ELIXIRC_FLAGS = ["--warnings-as-errors"]

let serial = 0

/* ───────────────────── печать, сборка, запуск ───────────────────── */

/** Все файлы каталога с путями относительно него — включая подкаталоги. */
function listFiles(directory, prefix = "") {
  const found = []
  for (const entry of readdirSync(join(directory, prefix), { withFileTypes: true })) {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) found.push(...listFiles(directory, path))
    else found.push(path)
  }
  return found
}

/* Сборка программы стоит секунду, а программ три десятка, и тесты берут их по
   нескольку раз. Кэш по самому AST: одна и та же программа с одними и теми же
   настройками печатается и собирается однажды. */
const builds = new Map()

function build(program, options = {}) {
  if (Object.keys(options).length > 0) return buildFresh(program, options)
  const existing = builds.get(program)
  if (existing !== undefined) return existing
  const built = buildFresh(program, options)
  builds.set(program, built)
  return built
}

/** Печатает программу в пустой каталог и собирает ровно то, что напечатано. */
function buildFresh(program, options) {
  serial += 1
  const directory = join(workdir, `p${serial}`)
  mkdirSync(directory, { recursive: true })
  const emitted = emitElixir(program, options)
  for (const file of emitted.files) {
    mkdirSync(dirname(join(directory, file.path)), { recursive: true })
    writeFileSync(join(directory, file.path), file.content, "utf8")
  }

  /* В каталоге не должно оказаться ничего, кроме напечатанного. Проверяется до
     сборки: она сама насыпет _build. */
  assert.deepEqual(listFiles(directory).sort(), emitted.files.map((file) => file.path).sort())

  const sources = emitted.files.filter((file) => file.path.endsWith(".ex")).map((file) => file.path)
  const moduleFile = sources.find((path) => !["flang_runtime.ex", "flang_cli.ex"].includes(path))
  const moduleSource = emitted.files.find((file) => file.path === moduleFile).content
  const alias = moduleSource.match(/^defmodule ([A-Za-z0-9_.]+) do$/mu)[1]

  mkdirSync(join(directory, "_build"), { recursive: true })
  /* Один вызов на все файлы сразу: elixirc сам разрешает ссылки между модулями
     за несколько проходов, и порядок аргументов ему безразличен. */
  const compiled = spawnSync(elixircBin, [...ELIXIRC_FLAGS, "-o", "_build", ...sources], {
    cwd: directory,
    encoding: "utf8",
    env: ELIXIR_ENV,
  })
  assert.equal(
    compiled.status,
    0,
    `elixirc не принял напечатанное (--warnings-as-errors):\n${compiled.stdout}\n${compiled.stderr}`,
  )

  return {
    directory,
    emitted,
    alias,
    source: moduleSource,
    runtime: emitted.files.find((file) => file.path === "flang_runtime.ex").content,
  }
}

/** Один процесс на сколько угодно запросов: запуск BEAM дорог, запрос дёшев. */
function ask(built, requests) {
  const input = `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`
  const output = execFileSync(
    elixirBin,
    ["-pa", "_build", "-e", `Flang.Cli.main(["${built.alias}"])`],
    {
      cwd: built.directory,
      input,
      encoding: "utf8",
      env: ELIXIR_ENV,
      maxBuffer: 512 * 1024 * 1024,
    },
  )
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

function answerOutcome(answer) {
  return answer.ok
    ? { ok: true, value: decode(answer.value) }
    : { ok: false, code: answer.code, message: answer.message }
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
    if (options.steps !== undefined) request.steps = String(options.steps)
    return request
  })
  const answers = ask(built, requests)

  points.forEach((args, index) => {
    const byInterpreter = outcome(() => interpret(program, functionName, args, options.limits ?? {}))
    const byEmitted = answerOutcome(answers[index])
    assert.ok(
      sameOutcome(byInterpreter, byEmitted),
      `«${functionName}» на входе ${JSON.stringify(args) ?? "?"}: интерпретатор дал ${describeOutcome(byInterpreter)}, ` +
        `собранный Elixir дал ${describeOutcome(byEmitted)}`,
    )
  })
  return points.length
}

/* ══════════════════ 1. главный тест: stdlib и leetcode ══════════════════ */

const stdlibDirectory = fileURLToPath(new URL("../stdlib/", import.meta.url))
const leetcodeDirectory = fileURLToPath(new URL("../examples/leetcode/", import.meta.url))

function loadPrograms() {
  const found = []
  for (const directory of [stdlibDirectory, leetcodeDirectory]) {
    for (const name of readdirSync(directory).filter((item) => item.endsWith(".flang")).sort()) {
      found.push({ file: name, program: parse(readFileSync(directory + name, "utf8"), name) })
    }
  }
  return found
}

const programs = loadPrograms()

/* Значения, которых функция заведомо не ждёт. Ими портятся аргументы примеров:
   так проверяются не значения, а коды и тексты диагностик — вторая половина
   наблюдаемого поведения, и та, в которой кодогенератор ошибается чаще. */
const ЧУЖИЕ = [null, "не то", 42, true, [], [1, "два"], { "поле": 1 }, variant("Нет такого", {})]

/**
 * Сетка одной функции: аргументы её примеров плюс их порча по одному
 * аргументу. Выдуманная сетка проверяла бы фантазию автора теста, а сетка из
 * примеров — то, ради чего функция написана.
 */
/** Объявлен ли параметр типом «функция»: `функция из числа в число`. */
function fnTypedParam(fn, index) {
  const param = fn.params?.[index]
  return param !== null && typeof param === "object" && param.type?.kind === "fn"
}

function functionGrid(fn) {
  const params = fn.params.map((param) => (typeof param === "string" ? param : param.name))
  const examples = (fn.examples ?? []).filter((example) =>
    example.args !== null && typeof example.args === "object" &&
    params.every((name) => Object.hasOwn(example.args, name)))
  const points = examples.map((example) => params.map((name) => example.args[name]))
  if (params.length === 0) return points

  const seed = points.length > 0 ? points[0] : params.map(() => null)
  for (let index = 0; index < params.length; index += 1) {
    /* Параметр типа «функция» порче не подвергается, и это не дырка, а
       названное расхождение (`flang/cat/HOF.md`, «Одно расхождение, и оно
       названо»): чужое значение на месте тега отвергают ОБЕ стороны, но
       разными словами — интерпретатор `FLANG_APPLY`, напечатанный диспетчер
       `FLANG_MATCH_NOT_EXHAUSTIVE`, — потому что «отказать вот с этим текстом»
       в языке невыразимо. Проверяется оно дословно и отдельно, в
       `flang/test/stdlib-hof.test.mjs` и `flang/test/hof-emit.test.mjs`;
       здесь же сверяются тексты, и сверять их тут значило бы записать
       расхождение в восьми местах вместо одного. Значения из примеров на этой
       позиции остаются: тег там настоящий. */
    if (fnTypedParam(fn, index)) continue
    for (const alien of ЧУЖИЕ) {
      const spoiled = [...seed]
      spoiled[index] = alien
      points.push(spoiled)
    }
  }
  return points
}

/* Пределы одинаковы у обоих движков. Шаг напечатанного кода — вход в функцию,
   виток хвостового цикла и отскок батута, шаг интерпретатора — итерация его
   машины, а их на одно применение функции приходится много. Значит при одном и
   том же пределе счётчик Elixir всегда меньше, и упереться в лимит первым может
   только интерпретатор. Такие точки сверяются по коду ошибки, а не по тексту:
   текст содержит число шагов, а оно у двух счётчиков разное по построению. */
const ПРЕДЕЛЫ = { maxSteps: 5_000_000, maxDepth: 10_000 }

test("stdlib и leetcode: собранный Elixir совпадает с интерпретатором", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден (ни в PATH, ни в FTS_TOOLCHAIN_PATH) — пропуск")
    return
  }
  assert.ok(programs.length >= 25, `программ на flang найдено слишком мало: ${programs.length}`)

  let points = 0
  let functions = 0
  let limited = 0
  const started = Date.now()

  for (const { file, program } of programs) {
    const built = build(program)
    const requests = []
    const plan = []
    for (const fn of program.functions) {
      const grid = functionGrid(fn)
      if (grid.length === 0) continue
      functions += 1
      for (const args of grid) {
        requests.push({
          fn: fn.name,
          args: args.map(encode),
          depth: String(ПРЕДЕЛЫ.maxDepth),
          steps: String(ПРЕДЕЛЫ.maxSteps),
        })
        plan.push({ name: fn.name, args })
      }
    }
    assert.ok(requests.length > 0, `${file}: не из чего построить сетку — у функций нет примеров`)
    const answers = ask(built, requests)

    plan.forEach((point, index) => {
      const byInterpreter = outcome(() => interpret(program, point.name, point.args, ПРЕДЕЛЫ))
      const byEmitted = answerOutcome(answers[index])
      if (!byInterpreter.ok && byInterpreter.code === "FLANG_RECURSION_LIMIT") {
        /* Точка, на которой интерпретатор исчерпал лимит. Текст диагностики
           содержит число шагов, а счётчики у двух движков разные по построению
           (см. ПРЕДЕЛЫ), поэтому сверяется только код — и только если
           напечатанный код тоже остановился. */
        limited += 1
        if (!byEmitted.ok) {
          assert.equal(byEmitted.code, "FLANG_RECURSION_LIMIT",
            `${file} / «${point.name}»: интерпретатор упёрся в лимит, Elixir дал ${describeOutcome(byEmitted)}`)
        }
        return
      }
      assert.ok(
        sameOutcome(byInterpreter, byEmitted),
        `${file} / «${point.name}» на входе ${JSON.stringify(point.args) ?? "?"}: ` +
          `интерпретатор дал ${describeOutcome(byInterpreter)}, собранный Elixir дал ${describeOutcome(byEmitted)}`,
      )
      points += 1
    })
  }

  t.diagnostic(
    `программ: ${programs.length}, функций: ${functions}, сверенных входов: ${points}` +
      `${limited > 0 ? `, из них по лимиту шагов только по коду: ${limited}` : ""}` +
      `, за ${Math.round((Date.now() - started) / 1000)} с`,
  )
  assert.ok(programs.length >= 25)
  assert.ok(functions >= 150, `функций со сверкой слишком мало: ${functions}`)
  assert.ok(points > 2000, `сетка слишком редкая: ${points}`)
})

test("примеры stdlib и leetcode сходятся у Elixir так же, как у интерпретатора", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  let checked = 0
  for (const { file, program } of programs) {
    const built = build(program)
    const requests = []
    const plan = []
    for (const fn of program.functions) {
      const params = fn.params.map((param) => (typeof param === "string" ? param : param.name))
      for (const example of fn.examples ?? []) {
        if (!params.every((name) => Object.hasOwn(example.args ?? {}, name))) continue
        const args = params.map((name) => example.args[name])
        requests.push({ fn: fn.name, args: args.map(encode) })
        plan.push({ fn, example, args })
      }
    }
    if (requests.length === 0) continue
    const answers = ask(built, requests)
    answers.forEach((answer, index) => {
      const { fn, example, args } = plan[index]
      const byEmitted = answerOutcome(answer)
      assert.ok(byEmitted.ok, `${file} / «${fn.name}» / «${example.name}»: Elixir дал ${describeOutcome(byEmitted)}`)
      assert.ok(
        sameValue(byEmitted.value, interpret(program, fn.name, args)),
        `${file} / «${fn.name}» / «${example.name}»: движки разошлись`,
      )
      assert.ok(
        sameValue(byEmitted.value, example.expected),
        `${file} / «${fn.name}» / «${example.name}»: ожидалось ${JSON.stringify(example.expected)}, ` +
          `получено ${JSON.stringify(byEmitted.value)}`,
      )
      checked += 1
    })
  }
  t.diagnostic(`сверенных примеров: ${checked}`)
  assert.ok(checked >= 250, `примеров сверено слишком мало: ${checked}`)
})

/* ══════════════════════════ 2. рекурсия по списку ═══════════════════════════ */

/* «Сумма» не хвостовая: результат вызова ещё складывается с головой. Такая
   функция печатается обычной рекурсией Elixir — как и у интерпретатора, глубина
   растёт. Упереться она обязана в счётчик языка, и здесь это не подстраховка:
   у процесса BEAM нет стека фиксированного размера, он растёт в куче, и без
   счётчика незавершающаяся рекурсия съела бы память узла целиком. */
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
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const built = build(listProgram)
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

test("счётчик глубины — единственный ограничитель рекурсии на BEAM", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /* Ключевой тест слоя, и на BEAM он проверяет обратное тому, что в Java и C#.
     Там стек кончается и процесс падает; здесь стек живёт в куче и не кончается
     никогда — незавершающаяся нехвостовая рекурсия просто съест память узла.
     Значит счётчик глубины обязан сработать ровно там же, где у интерпретатора:
     на глубине чуть ниже предела программа обязана СОСЧИТАТЬ, а чуть выше —
     сказать FLANG_RECURSION_LIMIT тем же текстом. */
  const built = build(listProgram)
  const long = Array.from({ length: 3000 }, (_, index) => index)
  const started = Date.now()
  const [answer] = ask(built, [{ fn: "Сумма", args: [encode(long)] }])
  assert.equal(answer.ok, true, `рекурсия глубиной 3000 обязана считаться: ${JSON.stringify(answer)}`)
  assert.equal(decode(answer.value), (2999 * 3000) / 2)
  /* И ровно та же глубина у интерпретатора. */
  assert.equal(interpret(listProgram, "Сумма", [long]), (2999 * 3000) / 2)

  /* Предел языка по умолчанию — 10 000 вызовов. Обе стороны границы. */
  const under = Array.from({ length: 9998 }, (_, index) => index)
  const over = Array.from({ length: 10_001 }, (_, index) => index)
  const [deep, tooDeep] = ask(built, [
    { fn: "Сумма", args: [encode(under)] },
    { fn: "Сумма", args: [encode(over)] },
  ])
  assert.equal(deep.ok, true, `рекурсия у самого предела обязана считаться: ${JSON.stringify(deep)}`)
  assert.equal(decode(deep.value), (9997 * 9998) / 2)
  assert.deepEqual(
    [tooDeep.ok, tooDeep.code],
    [false, "FLANG_RECURSION_LIMIT"],
    "за пределом обязана быть диагностика языка, а не съеденная память",
  )
  assert.deepEqual(
    outcome(() => interpret(listProgram, "Сумма", [over])),
    { ok: false, code: tooDeep.code, message: tooDeep.message },
    "и код, и текст обязаны совпасть с интерпретатором",
  )
  t.diagnostic(`рекурсия до 9998 кадров сосчитана, на 10 001 остановлена; всё за ${Date.now() - started} мс`)
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
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const built = build(treeProgram)
  /* Сумма типов — размеченный кортеж с дискриминантом-строкой, а не структура
     Elixir: дискриминант в flang именной, и литерал {variant, fields} из JSON
     статического типа не имеет вовсе. Типизированный слой — это напечатанные
     конструкторы: по функции на вариант. */
  assert.match(built.source, /^ {2}def v_list\(znachenie\) do$/mu,
    "конструктор варианта «Лист» обязан быть напечатан")
  assert.match(built.source, /Flang\.Rt\.variant\("Лист", \[/u,
    "конструктор обязан строить вариант рантайма")
  assert.match(built.source, /Flang\.Rt\.variant_is\?\([a-z_0-9]+, "Узел"\)/u,
    "разбор — это проверка дискриминанта")

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

/* ══════ 4. одноимённые вариант, запись и функция: роль обязана быть в имени ══════ */

/* В ядре FTS «Значение операнда» — и вариант суммы типов, и функция. Модуль
   Elixir — одно пространство имён, и повторное определение функции той же
   арности не ошибка, а молчаливое переопределение: уцелела бы одна клауза из
   двух, и программа считала бы не то, что написано. Ровно этот дефект здесь
   закрыт тестом. */
const namesakeProgram = {
  flang: 1,
  module: "Тёзки",
  types: [
    {
      kind: "sum",
      name: "Операнд",
      variants: [
        { name: "Значение операнда", fields: [{ name: "значение", type: { kind: "number" } }] },
        { name: "Пустой операнд", fields: [] },
      ],
    },
    { kind: "record", name: "Обёртка", fields: [{ name: "значение", type: { kind: "number" } }] },
  ],
  functions: [
    {
      /* Функция-тёзка варианта. */
      name: "Значение операнда",
      total: true,
      params: [{ name: "операнд", type: { kind: "sum", name: "Операнд" } }],
      returns: { kind: "number" },
      body: {
        kind: "match",
        target: { kind: "var", name: "операнд" },
        cases: [
          {
            pattern: { kind: "variant", name: "Значение операнда", bind: { "значение": "зн" } },
            body: { kind: "var", name: "зн" },
          },
          { pattern: { kind: "any" }, body: { kind: "literal", value: 0 } },
        ],
      },
    },
    {
      /* Функция-тёзка записи: и у неё роль обязана быть в имени. */
      name: "Обёртка",
      total: true,
      params: [{ name: "ч", type: { kind: "number" } }],
      returns: { kind: "record", name: "Обёртка" },
      body: { kind: "record", type: "Обёртка", fields: { "значение": { kind: "var", name: "ч" } } },
    },
    {
      name: "Обернуть операнд",
      total: true,
      params: [{ name: "ч", type: { kind: "number" } }],
      returns: { kind: "sum", name: "Операнд" },
      body: {
        kind: "construct",
        variant: "Значение операнда",
        fields: { "значение": { kind: "var", name: "ч" } },
      },
    },
  ],
}

test("одноимённые вариант, запись и функция получают разные имена: роль в идентификаторе", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const built = build(namesakeProgram)
  /* Три определения с одним именем модели — три разных идентификатора. */
  assert.match(built.source, /^ {2}def fn_znachenie_operanda\(operand\) do$/mu)
  assert.match(built.source, /^ {2}def v_znachenie_operanda\(znachenie\) do$/mu)
  assert.match(built.source, /^ {2}def fn_obyortka\(ch\) do$/mu)
  assert.match(built.source, /^ {2}def rec_obyortka\(znachenie\) do$/mu)

  /* Ни одно имя не определено дважды: молчаливое переопределение — это как раз
     то, чего нельзя заметить по значению одной функции. */
  const declared = [...built.source.matchAll(/^ {2}defp? ([a-z_][A-Za-z_0-9]*)\(/gmu)]
    .map((match) => match[1])
    .filter((name) => name !== "call")
  assert.equal(new Set(declared).size, declared.length, `повторное объявление: ${declared.join(", ")}`)

  const points = compare(namesakeProgram, built, "Значение операнда", [
    [variant("Значение операнда", { "значение": 7 })],
    [variant("Пустой операнд", {})],
    [42],
  ]) + compare(namesakeProgram, built, "Обернуть операнд", [[1], [-0], ["не число"]]) +
    compare(namesakeProgram, built, "Обёртка", [[2], [null]])

  const [unwrapped, wrapped, record] = ask(built, [
    { fn: "Значение операнда", args: [encode(variant("Значение операнда", { "значение": 7 }))] },
    { fn: "Обернуть операнд", args: [encode(3)] },
    { fn: "Обёртка", args: [encode(4)] },
  ])
  assert.equal(decode(unwrapped.value), 7, "функция обязана остаться функцией")
  assert.deepEqual(decode(wrapped.value), variant("Значение операнда", { "значение": 3 }),
    "конструктор варианта обязан остаться конструктором")
  assert.deepEqual(decode(record.value), { "значение": 4 })
  t.diagnostic(`сверенных входов: ${points}`)
})

/* ══════════════════════════ 5. взаимная рекурсия ═══════════════════════════ */

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
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const built = build(mutualProgram)
  /* Батута здесь нет и быть не должно: BEAM переиспользует кадр сам, если
     вызов действительно хвостовой. Тело каждой функции живёт отдельной
     приватной функцией ровно затем, чтобы `try/after` со счётчиком глубины не
     оказался вокруг этого вызова и не отобрал у машины такую возможность. */
  assert.doesNotMatch(built.source, /trampoline|bounce/iu, "батут в Elixir не нужен")
  assert.match(built.source, /^ {2}defp loop_chyotnoe\(n\) do$/mu, "тело живёт отдельной функцией")
  assert.match(built.source, /^ +loop_nechyotnoe\(.+\)$/mu,
    "хвостовой вызов соседа идёт прямо в его тело и остаётся хвостовым")
  assert.doesNotMatch(built.source, /^ +[a-z_0-9]+ = loop_[a-z_]+\(/mu,
    "результат хвостового вызова не имеет права лечь в переменную — иначе он не хвостовой")

  const grid = [-1, 0, 1, 2, 3, 10, 11, 999, 1000].map((value) => [value])
  const points = compare(mutualProgram, built, "Чётное", grid) +
    compare(mutualProgram, built, "Нечётное", grid)

  /* depth = 16 — доказательство, что вызовы действительно хвостовые: без
     переиспользования кадра оба движка упёрлись бы в предел на 17-м шаге. */
  const limits = { maxSteps: 100_000_000, maxDepth: 16 }
  assert.equal(interpret(mutualProgram, "Чётное", [50_000], limits), true)
  const [even, odd] = ask(built, [
    { fn: "Чётное", args: [encode(50_000)], depth: "16", steps: "100000000" },
    { fn: "Нечётное", args: [encode(50_001)], depth: "16", steps: "100000000" },
  ])
  assert.deepEqual([even.ok, decode(even.value)], [true, true])
  assert.deepEqual([odd.ok, decode(odd.value)], [true, true])
  t.diagnostic(`сверенных входов: ${points}; 50 000 взаимных хвостовых шагов при пределе глубины 16`)
})

/* ══════════════════════════ 6. хвостовая рекурсия ═══════════════════════════ */

/* Интерпретатор переиспользует кадр возврата, поэтому считает 100 000 шагов в
   постоянной глубине. У BEAM хвостовые вызовы гарантированы машиной — именно
   поэтому здесь нет ни цикла, ни батута: `loop_otschyot` вызывает себя
   напрямую. Ловушка ровно одна, и она проверяется ниже: стоит положить
   результат вызова в переменную, и хвостовым он быть перестанет. */
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

test("хвостовой самовызов остаётся хвостовым: 100 000 шагов проходят", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const built = build(countdownProgram)
  assert.doesNotMatch(built.source, /while|continue/u, "циклов в Elixir нет, и печатать их нечем")
  assert.match(built.source, /^ {2}defp loop_otschyot\(n, nakopitel\) do$/mu,
    "тело вынесено в отдельную функцию: try/after вокруг него убил бы хвостовой вызов")
  /* Ключевое для Elixir: вызов обязан быть ПОСЛЕДНИМ выражением, а не лечь в
     переменную. `t = loop_otschyot(…)` с последующим `t` — это уже не хвостовой
     вызов, и сто тысяч шагов держали бы сто тысяч кадров. */
  assert.match(built.source, /^ +loop_otschyot\(t[0-9]+, t[0-9]+\)$/mu,
    "самовызов — последнее выражение блока, а не привязка")
  assert.doesNotMatch(built.source, /^ +t[0-9]+ = loop_otschyot\(/mu,
    "результат хвостового вызова не имеет права лечь в переменную")
  /* В теле цикла самовызова через публичную функцию быть не должно: та считает
     глубину, и сто тысяч шагов упёрлись бы в предел. В диспетчере `call/2`
     `fn_otschyot` законен и потому из проверки исключён. */
  const loopBody = built.source.slice(built.source.indexOf("defp loop_otschyot"))
    .split("\n  @doc")[0]
  assert.doesNotMatch(loopBody, /fn_otschyot\(/u,
    "хвостовой самовызов идёт в тело, а не в публичную функцию со счётчиком глубины")

  const expected = (100_000 * 100_001) / 2
  /* depth = 8 — доказательство хвостовой природы вызова: без переиспользования
     кадра оба движка упёрлись бы в предел на девятом шаге. */
  const byInterpreter = interpret(countdownProgram, "Отсчёт", [100_000, 0], { maxSteps: 100_000_000, maxDepth: 8 })
  assert.equal(byInterpreter, expected)
  const [answer] = ask(built, [
    { fn: "Отсчёт", args: [encode(100_000), encode(0)], depth: "8", steps: "100000000" },
  ])
  assert.equal(answer.ok, true, `собранный Elixir не сосчитал 100 000 шагов: ${JSON.stringify(answer)}`)
  assert.equal(decode(answer.value), expected)

  const grid = [-1, 0, 1, 2, 7, 1000].map((value) => [value, 0])
  const points = compare(countdownProgram, built, "Отсчёт", grid, { limits: { maxSteps: 10_000_000 } })
  t.diagnostic(`100 000 шагов пройдено обоими движками; дополнительно сверено входов: ${points}`)
})

test("внутренний цикл не перехватывает continue хвостового самовызова", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
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
  const built = build(program)
  compare(program, built, "Свести", [
    [[], 0],
    [[1, 2, 3], 0],
    [[1, -2, 3], 0],
    [[-1, -2], 100],
    [Array.from({ length: 300 }, (_, index) => index + 1), 0],
    ["не список", 0],
  ])
})

/* ══════════════════════════ 7. постусловия ═══════════════════════════ */

test("постусловие без кода даёт FLANG_PROPERTY, не признак — FLANG_TYPE", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
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
      {
        name: "Своя ошибка",
        params: [{ name: "х", type: { kind: "number" } }],
        returns: { kind: "number" },
        body: { kind: "var", name: "х" },
        postconditions: [
          {
            name: "Ограничено",
            bind: "результат",
            code: "FTS_UTILITY_PROPERTY",
            message: "результат не больше 20 процентов от поля сумма",
            expr: {
              kind: "binary",
              op: "lte",
              left: { kind: "var", name: "результат" },
              right: { kind: "literal", value: 20 },
            },
          },
        ],
      },
    ],
  }
  const built = build(program)
  /* Код и текст едут в AST данными — значит и в Elixir они литералы, а не знание,
     зашитое в бэкенд. */
  assert.match(built.source, /"FTS_UTILITY_PROPERTY"/u)

  compare(program, built, "Значение", [[1], [0], [-1]])
  compare(program, built, "Кривое", [[1], [0]])
  compare(program, built, "Своя ошибка", [[1], [20], [21], ["строка"]])

  const [broken, wrong, custom] = ask(built, [
    { fn: "Значение", args: [encode(-1)] },
    { fn: "Кривое", args: [encode(1)] },
    { fn: "Своя ошибка", args: [encode(21)] },
  ])
  assert.equal(broken.code, "FLANG_PROPERTY")
  assert.equal(broken.message, "нарушено свойство «Неотрицательно» функции «Значение»")
  assert.equal(wrong.code, "FLANG_TYPE")
  assert.equal(custom.code, "FTS_UTILITY_PROPERTY")
  assert.equal(custom.message, "результат не больше 20 процентов от поля сумма")
})

test("функция с постусловием не получает хвостовой оптимизации — как в интерпретаторе", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
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
  const built = build(program)
  assert.doesNotMatch(built.source, /loop_schyot/u, "постусловие запрещает вынос тела: хвостовых вызовов у такой функции нет")
  compare(program, built, "Счёт", [[0], [1], [5], [50]])
})

/* ══════════════════════════ 8. пределы ═══════════════════════════ */

test("нехвостовая рекурсия глубже предела даёт FLANG_RECURSION_LIMIT у обоих движков", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const built = build(listProgram)
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

test("незавершающаяся обычная функция упирается в лимит шагов, а не крутится вечно", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /* Хвостовой самовызов развёрнут в цикл, значит ни стек, ни глубина здесь не
     растут — остановить это может только счётчик шагов. Число шагов у двух
     движков разное по построению, поэтому сверяется код, а текст — по форме. */
  const program = {
    flang: 1,
    module: "Вечность",
    functions: [
      {
        name: "Вечно",
        params: [{ name: "н" }],
        body: {
          kind: "call",
          name: "Вечно",
          args: [{ kind: "binary", op: "add", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 1 } }],
        },
      },
    ],
  }
  const built = build(program)
  const byInterpreter = outcome(() => interpret(program, "Вечно", [0], { maxSteps: 5000 }))
  assert.equal(byInterpreter.ok, false)
  assert.equal(byInterpreter.code, "FLANG_RECURSION_LIMIT")

  const started = Date.now()
  const [answer] = ask(built, [{ fn: "Вечно", args: [encode(0)], steps: "5000" }])
  assert.equal(answer.ok, false, "напечатанная программа обязана остановиться сама")
  assert.equal(answer.code, "FLANG_RECURSION_LIMIT")
  assert.match(answer.message, /^функция «Вечно» исчерпала лимит шагов \(5000\) на глубине вызовов \d+$/u)
  t.diagnostic(`остановка по лимиту шагов за ${Date.now() - started} мс`)
})

/* ══════════════════════════ 9. строковые формы ═══════════════════════════ */

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
    builtinFn("Приписать", "приписать", ["э", "с"]),
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

/* Кириллица и суррогатные пары: длина обязана считаться в кодовых точках. В JS
   «мир 🌍» это 6 единиц UTF-16, в Go — 8 байт, а в Elixir String.length/1 даёт
   ГРАФЕМЫ: для эмодзи это те же 5, а для буквы с комбинирующим ударением — на
   одну меньше, чем кодовых точек. Отсюда String.to_charlist/1 в рантайме. */
const texts = ["", "привет", "мир 🌍", "ёжик", "a", "😀😀", "\u{1F600}абв", "  42  ", "3.5e2", "не число", "да",
  "  7  ", "ЁЖИК"]
const indices = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 1.5, 100]

/*
 * Стоимость взятия по номеру — вопрос, который нельзя решить чтением кода.
 *
 * Форма `элемент N в СПИСОК` обещает ЗНАЧЕНИЕ, а не стоимость: у восьми целей
 * разные структуры данных, и «быстро» верно не для всех. Проход по номеру
 * сверху вниз делает ровно n взятий, поэтому время всего прохода — это n·(цена
 * одного взятия). Удвоив n, получаем ответ прямо: время выросло вдвое —
 * взятие постоянное; вчетверо — взятие линейное.
 *
 * Проход хвостовой, поэтому глубина стека в измерение не входит.
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

test("стоимость взятия по номеру: список BEAM односвязный, и это видно в коде", (t) => {
  if (!elixirBin) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /*
   * ЕДИНСТВЕННАЯ ЦЕЛЬ ИЗ ВОСЬМИ, ГДЕ ВЗЯТИЕ ПО НОМЕРУ НЕ ПОСТОЯННОГО ВРЕМЕНИ.
   * Утверждение держится не временем (оно на общей машине шумит), а причиной:
   * рантайм идёт к N-му элементу через `Enum.at`, то есть по звеньям. Появится
   * там массив — эта проверка покраснеет, и вместе с ней придётся пересмотреть
   * таблицу стоимостей в flang/SPEC.md и запись каталога, которая на ней стоит.
   */
  const рантайм = readFileSync(new URL("../src/emit/elixir/flang_runtime.ex", import.meta.url), "utf8")
  const тело = рантайм.slice(рантайм.indexOf("def b_element("))
  assert.match(тело.slice(0, тело.indexOf("\n  end")), /Enum\.at\(items,/u,
    "b_element обязана идти по звеньям: иначе утверждение о стоимости в SPEC врёт")

  /* Длины меньше, чем у целей с массивом, и всё же ВЧЕТВЕРО больше друг друга:
     при линейном взятии время растёт как квадрат, и на двух-четырёх тысячах
     квадрат ещё тонет в запуске BEAM (сотня миллисекунд). На пяти и двадцати
     тысячах он виден: 4·10⁷ переходов по звеньям против 2.5·10⁶. */
  const built = build(indexCostProgram)
  const прогон = (n) => {
    const список = Array.from({ length: n }, (_, номер) => номер + 1)
    const начало = Date.now()
    const [ответ] = ask(built, [{ fn: "Сумма по номеру", args: [encode(список), encode(n), encode(0)], depth: "8" }])
    const прошло = Date.now() - начало
    assert.equal(ответ.ok, true, JSON.stringify(ответ))
    assert.equal(decode(ответ.value), (n * (n + 1)) / 2)
    return прошло
  }
  /* Запуск BEAM стоит порядка сотни миллисекунд и от длины списка не зависит.
     Не вычесть его — и в числах не останется ничего, кроме него: на пяти
     тысячах он больше самой работы. Меряется он тем же способом, что и
     работа, — прогоном на списке из одного элемента. */
  const запуск = прогон(1)
  const времена = [прогон(5_000) - запуск, прогон(20_000) - запуск]
  t.diagnostic(
    `взятие по номеру (Elixir), без запуска BEAM (${запуск} мс): ` +
      `5000 за ${времена[0]} мс, 20 000 за ${времена[1]} мс`,
  )
})

test("строковые формы: кириллица, суррогатные пары и границы индексов", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const built = build(stringProgram)
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
     отдельным элементом — это кодовая точка, а не графема. */
  points += compare(stringProgram, built, "Символы", [
    [""], ["a"], ["привет"], ["мир 🌍"], ["😀😀"], ["\u{1F600}абв"], ["e\u0301"], [42], [null], [["а"]],
  ])
  /* «код символа» обязана дать КОДОВУЮ ТОЧКУ, а не единицу UTF-16 и не байт:
     на «😀» это 128512, а не 55357 (старший суррогат) и не 240 (первый байт
     UTF-8). Берётся первый символ, поэтому «😀абв» даёт то же число, что «😀».
     Пустая строка, не строка и список — отказы, и тексты их обязаны совпасть с
     вычислителем дословно, а не «по смыслу». */
  points += compare(stringProgram, built, "Код символа", [
    [""], ["a"], ["Я"], ["привет"], ["😀"], ["😀абв"], ["\u{1F600}"], ["e\u0301"], ["\u0301e"], [42], [null], [["а"]],
  ])
  points += compare(stringProgram, built, "Содержит", [["привет", "иве"], ["мир 🌍", "🌍"], [[1, 2], 2], [[1, 2], 3], [1, 2], ["", ""]])
  points += compare(stringProgram, built, "Начинается", [["привет", "при"], ["", ""], ["🌍x", "🌍"], [1, "а"]])
  points += compare(stringProgram, built, "К числу",
    [...texts, "0", "-0", "1e3", "Infinity", "0x10", "+5", "1.", ".5", "1e", "1e999", " 7 ", "\u{FEFF}7",
      "\u{0661}", "1_0", "١٢٣", "1d", "1f", "0b1", "1_000"]
      .map((value) => [value]))
  /* «к строке» от признака обязано дать «да»/«нет», а не true/false. */
  points += compare(stringProgram, built, "К строке", [true, false, null, 0, -0, Number.NaN, Infinity, -Infinity, 1e21, 1e-7, 0.1, "уже строка", [1]].map((value) => [value]))
  points += compare(stringProgram, built, "Пусто", [[""], ["а"], [[]], [[1]], [42], [null]])
  points += compare(stringProgram, built, "Голова", [[[]], [[1, 2]], ["строка"], [null]])
  points += compare(stringProgram, built, "Хвост", [[[]], [[1, 2]], ["строка"]])
  /* «элемент N в СПИСОК»: сетка номеров та же, что у «символ», и по той же
     причине — индексация у форм одна. Проверяются обе границы, дробный и
     отрицательный номер, пустой список, не-список и не-число: тексты отказов
     обязаны совпасть с вычислителем дословно, а не «по смыслу». */
  const списки = [[], [1], [1, 2, 3], ["а", "б"], [[1], [2]]]
  const сеткаЭлемента = []
  for (const номер of indices) for (const список of списки) сеткаЭлемента.push([номер, список])
  сеткаЭлемента.push([1, "строка"], [1, 42], [null, [1]], [1, null])
  points += compare(stringProgram, built, "Элемент", сеткаЭлемента)
  points += compare(stringProgram, built, "Добавить", [[1, []], [1, [2]], [1, "строка"]])
  points += compare(stringProgram, built, "Приписать", [[1, []], [1, [2]], [1, "строка"]])
  points += compare(stringProgram, built, "Остаток", [[7, 3], [7, 0], [-7, 3], [7.5, 2], [-7, -3], [0, 0], ["a", 1]])
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
    { fn: "К строке", args: [encode(1e21)] },
    { fn: "К строке", args: [encode(1)] },
    { fn: "К строке", args: [encode(1e-7)] },
  ])
  assert.deepEqual(answers.map((answer) => decode(answer.value)),
    ["да", "нет", "ничто", 5, "🌍", "1e+21", "1", "1e-7"])
  t.diagnostic(`сверенных входов: ${points}`)
})

test("длина в кодовых точках, а не в единицах UTF-16", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /* Строка Elixir — это UTF-8 бинарь, и по кодовым точкам она считается
     правильно сама. Расходится другое: String.length/1 считает графемы, а SPEC
     требует кодовые точки. Проверяется и эмодзи (где графемы и кодовые точки
     совпадают), и составной знак (где нет). */
  const built = build(stringProgram)
  const answers = ask(built, [
    { fn: "Длина", args: [encode("😀😀")] },
    { fn: "Длина", args: [encode("мир 🌍")] },
    { fn: "Символ", args: [encode(1), encode("😀😀")] },
    { fn: "Символ", args: [encode(2), encode("😀😀")] },
    { fn: "Подстрока", args: [encode("а😀б😀в"), encode(2), encode(4)] },
    { fn: "Символ", args: [encode(3), encode("😀😀")] },
  ])
  /* «подстрока с 2 по 4» при базе 1 — это кодовые точки со второй по
     четвёртую включительно, то есть «😀б😀», а не «😀б»: в единицах UTF-16 те
     же границы дали бы «😀» с половиной суррогатной пары. */
  assert.deepEqual(answers.slice(0, 5).map((answer) => decode(answer.value)),
    [2, 5, "😀", "😀", "😀б😀"])
  assert.equal(answers[5].code, "FLANG_BUILTIN_ARGS")
  assert.equal(answers[5].message, "«символ»: индекс 3 вне строки длиной 2")
  /* И то же самое у интерпретатора — он источник истины. */
  assert.equal(interpret(stringProgram, "Длина", ["😀😀"]), 2)
  assert.equal(interpret(stringProgram, "Подстрока", ["а😀б😀в", 2, 4]), "😀б😀")
})

test("нулевая индексация строк включается опцией и остаётся согласованной", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const built = build(stringProgram, { indexBase: 0 })
  assert.match(built.source, /Flang\.Rt\.new_context\(0, /u)
  const grid = []
  for (const index of indices) for (const text of texts) grid.push([index, text])
  compare(stringProgram, built, "Символ", grid, { limits: { indexBase: 0 } })
})

/*
 * Двунаправленные управляющие символы в литерале.
 *
 * Таблица блоков лексера (flang/self/lexer.flang) перечисляет весь блок
 * U+2000…U+207F подряд, и одиннадцать из них — двунаправленные управляющие.
 * Напечатанные сырыми, они переставляют текст при показе: файл читается не так,
 * как исполняется, — «Trojan Source» (CVE-2021-42574).
 *
 * Elixir на этот счёт строже всех целей: разбор падает с «invalid bidirectional
 * formatting character in string» и сам предлагает экранированную форму, — то
 * есть напечатанный модуль не собирался вовсе, ни под `--warnings-as-errors`, ни
 * без него. Это не придирка линтера, а полный отказ бэкенда на законной
 * программе.
 *
 * Экранирование `\u{XXXX}` обязано убрать отказ, НЕ меняя значения: строка
 * Elixir — двоичка UTF-8, и байты обязаны остаться теми же.
 *
 * Общая проверка на все восемь целей сразу — в flang/test/emit-bidi.test.mjs;
 * здесь то, чего та проверить не может: настоящий elixirc и настоящая BEAM.
 *
 * Источник записан через `\uXXXX`, поэтому сырых двунаправленных нет и в самом
 * этом файле — иначе тест воспроизводил бы ровно ту беду, от которой стережёт.
 */
const bidiSource = [
  "модуль «Двунаправленные»",
  "",
  "тотальная функция «Метка»",
  "  возвращает строка",
  '  "\\u202eле\\u202cво"',
  "",
  "тотальная функция «Длина метки»",
  "  возвращает число",
  "  длина («Метка»)",
].join("\n")

const BIDI_CONTROLS = [0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]

test("двунаправленные управляющие экранируются: elixirc принимает, значение то же", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const program = parse(bidiSource)
  /* build() собирает под --warnings-as-errors, и до починки падал уже здесь —
     не предупреждением, а синтаксической ошибкой. */
  const built = build(program)

  const all = built.emitted.files.map((file) => file.content).join("\n")
  const raw = [...all].filter((character) => BIDI_CONTROLS.includes(character.codePointAt(0)))
  assert.equal(raw.length, 0, "в напечатанном Elixir не может быть сырых двунаправленных управляющих")

  /* Форма со скобками: следующая за экранированием шестнадцатеричная цифра к
     нему не приклеится. */
  assert.match(built.source, /\\u\{202e\}/u, "U+202E обязан приехать как \\u{202e}")

  /* Главное: значение не изменилось — те же байты, те же кодовые точки. */
  const points = compare(program, built, "Метка", [[]]) + compare(program, built, "Длина метки", [[]])
  assert.equal(points, 2)
})

/* ══════════════════════════ 10. числа и равенство ═══════════════════════════ */

test("порядок вычисления строго слева направо: первая ошибка — левая", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
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
      {
        /* Правый операнд требует собственных операторов (разбор), а левый —
           нет: левый обязан вычислиться ДО них, иначе первой окажется правая
           ошибка. Это ровно то место, где выражение Elixir пришлось бы
           материализовать во временное. */
        name: "Слева направо",
        params: [{ name: "а" }, { name: "б" }],
        body: {
          kind: "binary",
          op: "add",
          left: { kind: "builtin", name: "голова", args: [{ kind: "var", name: "а" }] },
          right: {
            kind: "match",
            target: { kind: "var", name: "б" },
            cases: [
              { pattern: { kind: "empty" }, body: { kind: "literal", value: 0 } },
              { pattern: { kind: "cons", head: "г", tail: "х" }, body: { kind: "var", name: "г" } },
            ],
          },
        },
      },
    ],
  }
  const built = build(program)
  const grid = [
    [[], []],
    [[1], []],
    [[], [1]],
    [[1], [2]],
    ["не список", []],
    ["не список", "тоже не список"],
    [[], "не список"],
  ]
  compare(program, built, "Сложить", grid)
  compare(program, built, "Слева направо", grid)
})

test("деление на ноль даёт Infinity и NaN, равенство — Object.is", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /* Здесь и живёт главное расхождение бэкенда: на BEAM значения с плавающей
     точкой, равного NaN или бесконечности, НЕ СУЩЕСТВУЕТ — машина возбуждает
     ArithmeticError и на `1.0 / 0.0`, и на переполнении. А SPEC (раздел 5)
     требует, чтобы деление на ноль давало значение. Поэтому число flang здесь
     это float либо один из атомов :nan, :inf, :ninf, а вся арифметика разбирает
     особые случаи IEEE-754 руками. */
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
        name: "Остаток",
        params: [{ name: "а" }, { name: "б" }],
        body: { kind: "binary", op: "mod", left: { kind: "var", name: "а" }, right: { kind: "var", name: "б" } },
      },
      {
        name: "Равны",
        params: [{ name: "а" }, { name: "б" }],
        body: { kind: "binary", op: "eq", left: { kind: "var", name: "а" }, right: { kind: "var", name: "б" } },
      },
    ],
  }
  const built = build(program)
  const numbers = [0, -0, 1, -1, 2, 0.5, 7, -7, 3, Number.NaN, Infinity, -Infinity, 1e308]
  const divGrid = []
  for (const left of numbers) for (const right of numbers) divGrid.push([left, right])
  compare(program, built, "Делить", divGrid)
  compare(program, built, "Остаток", divGrid)

  const [infinity, minus, nothing, plusZero, minusZero] = ask(built, [
    { fn: "Делить", args: [encode(1), encode(0)] },
    { fn: "Делить", args: [encode(1), encode(-0)] },
    { fn: "Делить", args: [encode(0), encode(0)] },
    { fn: "Делить", args: [encode(1), encode(Infinity)] },
    { fn: "Делить", args: [encode(1), encode(-Infinity)] },
  ])
  assert.equal(decode(infinity.value), Infinity, "деление на ноль обязано дать Infinity, а не ошибку")
  assert.equal(decode(minus.value), -Infinity, "знак нуля-делителя обязан доехать до знака бесконечности")
  assert.ok(Number.isNaN(decode(nothing.value)), "ноль на ноль обязан дать NaN")
  /* Обратная сторона той же монеты: конечное на бесконечность — ноль СО ЗНАКОМ.
     Здесь бэкенд молча терял знак на OTP 25, где компилятор сливал ветви
     `do: -0.0, else: 0.0` в одну (см. Flang.Rt.neg_zero/0). Сетка выше это
     ловит, но по имени не называет, а имя — половина починки. */
  assert.ok(Object.is(decode(plusZero.value), 0), "1 / Infinity обязано дать 0")
  assert.ok(Object.is(decode(minusZero.value), -0), "1 / −Infinity обязано дать именно −0, а не 0")

  const values = [0, -0, Number.NaN, 1, "1", true, null, [1, 2], [1, 2, 3], { "а": 1 }, { "а": 1, "б": 2 },
    variant("Лист", { "значение": 1 }), variant("Лист", { "значение": 2 }), variant("Узел", {})]
  const grid = []
  for (const left of values) for (const right of values) grid.push([left, right])
  const points = compare(program, built, "Равны", grid)

  const [nan, zero, one] = ask(built, [
    { fn: "Равны", args: [encode(Number.NaN), encode(Number.NaN)] },
    { fn: "Равны", args: [encode(0), encode(-0)] },
    { fn: "Равны", args: [encode(1), true] },
  ])
  assert.equal(decode(nan.value), true, "NaN обязан быть равен NaN")
  assert.equal(decode(zero.value), false, "0 не равен −0")
  assert.equal(decode(one.value), false, "признак не равен числу")
  assert.ok(points > 100)
})

test("литералы — double, а не int: целых чисел в напечатанном коде нет", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /* Литерал `2` в Elixir — целое неограниченной точности, и `2 ** 70` там
     точное, а в IEEE-754 нет. Поэтому всякое число flang печатается с точкой, а
     NaN и бесконечности — атомами: значений с плавающей точкой, равных им, на
     BEAM не бывает вовсе. */
  const program = {
    flang: 1,
    module: "Целые",
    functions: [
      { name: "Один", params: [], body: { kind: "literal", value: 1 } },
      {
        name: "Степень",
        params: [{ name: "н" }],
        body: {
          kind: "binary",
          op: "mul",
          left: { kind: "var", name: "н" },
          right: { kind: "literal", value: 9007199254740993 },
        },
      },
      { name: "Не число", params: [], body: { kind: "literal", value: Number.NaN } },
      { name: "Бесконечность", params: [], body: { kind: "literal", value: Infinity } },
      { name: "Минус бесконечность", params: [], body: { kind: "literal", value: -Infinity } },
      { name: "Минус ноль", params: [], body: { kind: "literal", value: -0 } },
      { name: "Много", params: [], body: { kind: "literal", value: 1e21 } },
    ],
  }
  const built = build(program)
  assert.match(built.source, /\{:num, 1\.0\}/u, "целое обязано печататься с точкой")
  assert.match(built.source, /\{:num, :nan\}/u, "NaN — атом, а не float: такого float на BEAM нет")
  assert.match(built.source, /\{:num, Flang\.Rt\.neg_zero\(\)\}/u,
    "−0 печатается вызовом: литерал `-0.0` компилятор до OTP 27 сливает с литералом `0.0`")
  assert.match(built.source, /\{:num, 1\.0e21\}/u, "экспонента Elixir требует точки в мантиссе и не терпит плюса")
  for (const fn of program.functions) {
    compare(program, built, fn.name, fn.params.length === 0 ? [[]] : [[2], [0.5], [-0]])
  }

  const answers = ask(built, ["Не число", "Бесконечность", "Минус бесконечность", "Минус ноль", "Много", "Один"]
    .map((name) => ({ fn: name, args: [] })))
  assert.deepEqual(answers.map((answer) => answer.value), [
    { n: "NaN" }, { n: "Infinity" }, { n: "-Infinity" }, { n: "-0" }, { n: "1e+21" }, { n: "1" },
  ])
})

test("печать числа совпадает с Number::toString на порогах экспоненты", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /* Float.to_string/1 даёт «1.0» там, где нужно «1», и «1.0e21» там, где нужно
     «1e+21». Пороги перехода к экспоненте у ECMAScript свои: n больше 21 и n не
     больше −6. Всё это видно пользователю через «к строке». */
  const built = build(stringProgram)
  const numbers = [0, 1, -1, 0.1, 0.5, 1 / 3, 100, 1e6, 1e20, 1e21, 1e22, 1e-6, 1e-7, 5e-324,
    1.7976931348623157e308, 123456789012345678901234, 2 ** 53, 2 ** 53 + 2, 1234.5678, -0.000001, 1e300]
  const answers = ask(built, numbers.map((value) => ({ fn: "К строке", args: [encode(value)] })))
  answers.forEach((answer, index) => {
    assert.equal(decode(answer.value), String(numbers[index]),
      `«к строке» от ${numbers[index]} обязано совпасть с Number::toString`)
  })
  compare(stringProgram, built, "К строке", numbers.map((value) => [value]))
  t.diagnostic(`сверено записей числа: ${numbers.length}`)
})

/* ══════════════════════════ 11. настоящий исходник flang ═══════════════════ */

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
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const program = parse(flangSource)
  const built = build(program)
  assert.match(built.source, /Функция flang «Длина»/u)
  assert.match(built.source, /Запись FTS «Позиция»/u)

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

test("образцы-литералы, «любой» с привязкой и строки со спецсимволами", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /* Ни в stdlib, ни в leetcode образцов-литералов нет — там встречаются только
     «пусто», «голова и хвост» и варианты. Значит этот путь печати главная
     сверка не проходит вовсе, и проверять его надо отдельно. Заодно здесь живут
     строки, которые обязаны пережить экранирование в литерале Elixir: кавычка,
     обратный слэш, перевод строки, табуляция и суррогатная пара. */
  const program = {
    flang: 1,
    module: "Образцы",
    functions: [
      {
        name: "Назвать",
        params: [{ name: "з" }],
        body: {
          kind: "match",
          target: { kind: "var", name: "з" },
          cases: [
            { pattern: { kind: "literal", value: 0 }, body: { kind: "literal", value: "ноль" } },
            { pattern: { kind: "literal", value: -0 }, body: { kind: "literal", value: "минус ноль" } },
            { pattern: { kind: "literal", value: 1 }, body: { kind: "literal", value: "один" } },
            { pattern: { kind: "literal", value: "да" }, body: { kind: "literal", value: "строка «да»" } },
            { pattern: { kind: "literal", value: true }, body: { kind: "literal", value: "признак" } },
            { pattern: { kind: "literal", value: null }, body: { kind: "literal", value: "ничто" } },
            { pattern: { kind: "literal", value: [1, 2] }, body: { kind: "literal", value: "список 1 2" } },
            {
              pattern: { kind: "any", bind: "иное" },
              body: {
                kind: "builtin",
                name: "к строке",
                args: [{ kind: "var", name: "иное" }],
              },
            },
          ],
        },
      },
      {
        name: "Особые",
        params: [],
        body: {
          kind: "literal",
          value: ["кавычка \" внутри", "слэш \\ внутри", "перевод\nстроки", "таб\tуляция", "эмодзи 🌍", ""],
        },
      },
      {
        /* Вариант в JSON записан как { variant, fields }: классов JSON не знает.
           Интерпретатор читает такой литерал вариантом (reifyValue), и
           напечатанный код обязан читать его так же — иначе разбор не
           сопоставил бы его ни с одним образцом. Ровно этого не делал бэкенд
           Go, и программа молча считалась по-разному. */
        name: "Вариант литералом",
        params: [],
        body: { kind: "literal", value: { "variant": "Есть", "fields": { "значение": 1 } } },
      },
      {
        name: "Запись литералом",
        params: [],
        body: { kind: "literal", value: { "variant": "Есть", "fields": { "значение": 1 }, "лишнее": 2 } },
      },
    ],
  }
  const built = build(program)
  assert.match(built.source, /Flang\.Rt\.equal\(z, \{:num, 0\.0\}\)/u,
    "образец-литерал — это сравнение значений flang, а не образец Elixir")
  assert.match(built.source, /Flang\.Rt\.equal\(z, \{:num, Flang\.Rt\.neg_zero\(\)\}\)/u,
    "и −0 отличается от 0 именно потому, что сравнение своё, а не `case`, — а сам −0 приезжает " +
      "вызовом: два литерала, `{:num, 0.0}` и `{:num, -0.0}`, компилятор до OTP 27 сливает в один")
  assert.match(built.source, /Flang\.Rt\.variant\("Есть", \[/u,
    "литерал { variant, fields } обязан стать вариантом, а не записью")

  const grid = [0, -0, 1, 2, "да", "нет", true, false, null, [1, 2], [1, 2, 3], Number.NaN, 3.5]
    .map((value) => [value])
  compare(program, built, "Назвать", grid)
  compare(program, built, "Особые", [[]])

  compare(program, built, "Вариант литералом", [[]])
  compare(program, built, "Запись литералом", [[]])

  const [special, asVariant, asRecord] = ask(built, [
    { fn: "Особые", args: [] },
    { fn: "Вариант литералом", args: [] },
    { fn: "Запись литералом", args: [] },
  ])
  assert.deepEqual(decode(special.value), [
    "кавычка \" внутри", "слэш \\ внутри", "перевод\nстроки", "таб\tуляция", "эмодзи 🌍", "",
  ])
  assert.deepEqual(decode(asVariant.value), variant("Есть", { "значение": 1 }))
  /* Третье поле — и это уже запись: форма варианта узнаётся строго. */
  assert.deepEqual(decode(asRecord.value), { "variant": "Есть", "fields": { "значение": 1 }, "лишнее": 2 })
})

test("вызов по имени: неизвестная функция и неверная арность дают ошибки интерпретатора", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const built = build(listProgram)
  const [unknown, tooMany, tooFew] = ask(built, [
    { fn: "Нет такой", args: [] },
    { fn: "Сумма", args: [encode([1]), encode(2)] },
    { fn: "Сумма", args: [] },
  ])
  assert.deepEqual([unknown.ok, unknown.code, unknown.message],
    [false, "FLANG_UNKNOWN_NAME", "не найдена функция «Нет такой»"])
  assert.deepEqual([tooMany.ok, tooMany.code, tooMany.message],
    [false, "FLANG_TYPE", "функция «Сумма» принимает 1 аргум., получено 2"])
  assert.equal(tooFew.message, "функция «Сумма» принимает 1 аргум., получено 0")

  /* Тот же текст обязан давать и интерпретатор — он и есть источник истины. */
  for (const args of [[[1], 2], []]) {
    const byInterpreter = outcome(() => interpret(listProgram, "Сумма", args))
    assert.equal(byInterpreter.code, "FLANG_TYPE")
    assert.equal(byInterpreter.message, `функция «Сумма» принимает 1 аргум., получено ${args.length}`)
  }
})

test("затенение локальных имён и совпадение с именем функции", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /* В Elixir повторная привязка законна и создаёт НОВОЕ имя, а старое остаётся
     видимым во вложенных областях. Разные идентификаторы всё равно обязательны:
     иначе `пусть х` внутри `пусть х` дал бы предупреждение о затенении, а под
     --warnings-as-errors — отказ сборки. */
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
  const built = build(program)
  compare(program, built, "значение", [[0], [5], ["строка"]])
  const [answer] = ask(built, [{ fn: "значение", args: [encode(5)] }])
  assert.equal(decode(answer.value), 16)
})

test("связанное, но неиспользованное имя гасится, а вычисляться не перестаёт", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /* «случай голова и хвост», где голова телу не нужна, — обычное дело. В Elixir
     это предупреждение, а под --warnings-as-errors — отказ сборки, то есть
     ровно тот дефект, который ломал сборку бэкенда C. Приставка «_» — принятая
     здесь форма «вычислено и намеренно выброшено». Выбросить само связывание
     нельзя: у варианта оно обязано сходить за полем и дать FLANG_UNKNOWN_NAME,
     если поля нет. */
  const program = {
    flang: 1,
    module: "Неиспользованное",
    types: [{
      kind: "sum",
      name: "Коробка",
      variants: [{ name: "Есть", fields: [{ name: "значение", type: { kind: "number" } }] }],
    }],
    functions: [
      {
        name: "Считать",
        total: true,
        params: [{ name: "элементы" }],
        body: {
          kind: "match",
          target: { kind: "var", name: "элементы" },
          cases: [
            { pattern: { kind: "empty" }, body: { kind: "literal", value: 0 } },
            {
              pattern: { kind: "cons", head: "г", tail: "х" },
              body: {
                kind: "let",
                name: "ненужное",
                value: { kind: "literal", value: 99 },
                in: {
                  kind: "binary",
                  op: "add",
                  left: { kind: "literal", value: 1 },
                  right: { kind: "call", name: "Считать", args: [{ kind: "var", name: "х" }] },
                },
              },
            },
          ],
        },
      },
      {
        name: "Единица",
        total: true,
        params: [{ name: "к", type: { kind: "sum", name: "Коробка" } }],
        body: {
          kind: "match",
          target: { kind: "var", name: "к" },
          cases: [
            {
              pattern: { kind: "variant", name: "Есть", bind: { "значение": "зн" } },
              body: { kind: "literal", value: 1 },
            },
          ],
        },
      },
    ],
  }
  const built = build(program)
  assert.match(built.source, /^ +_zn = Flang\.Rt\.variant_field\([a-z_0-9]+, "значение"\)$/mu,
    "неиспользованная привязка обязана вычисляться и уходить под приставку «_»")
  assert.match(built.source, /^ +_nenuzhnoe = /mu, "неиспользованное «пусть» — туда же")

  compare(program, built, "Считать", [[[]], [[1, 2, 3]], ["не список"]])
  /* Поля нет — значит ошибка, а не «случай не подошёл»: связывание вычисляется
     даже тогда, когда его результат никому не нужен. */
  compare(program, built, "Единица", [
    [variant("Есть", { "значение": 1 })],
    [variant("Есть", {})],
    [42],
  ])
})

test("функция, состоящая из одного хвостового вызова, собирается и не растит кадры", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /* Функция, у которой ВСЕ хвостовые позиции — самовызов, ни разу не пишет в
     результат и никогда не возвращается нормально. В C под -Werror это ломало
     сборку неиспользованной переменной результата, в Java и C# — недостижимым
     кодом. В Elixir результата как переменной нет вовсе (последнее выражение и
     есть результат), зато есть свой аналог: параметр, который тело не читает, —
     предупреждение, а под --warnings-as-errors отказ сборки. Здесь он и
     проверяется: «н» не используется ни одной из трёх функций. */
  const program = {
    flang: 1,
    module: "Только хвост",
    functions: [
      {
        /* Ни одной ветви, кроме самовызова: `while (true)` без break вовсе. */
        name: "Вечный",
        params: [{ name: "н" }],
        body: { kind: "call", name: "Вечный", args: [{ kind: "var", name: "н" }] },
      },
      {
        /* Взаимная рекурсия без выхода: шаг батута состоит из одних отскоков. */
        name: "Пинг",
        params: [{ name: "н" }],
        body: { kind: "call", name: "Понг", args: [{ kind: "var", name: "н" }] },
      },
      {
        name: "Понг",
        params: [{ name: "н" }],
        body: { kind: "call", name: "Пинг", args: [{ kind: "var", name: "н" }] },
      },
    ],
  }
  /* Сам факт успешной сборки под --warnings-as-errors и есть проверка. */
  const built = build(program)
  assert.match(built.source, /^ {2}defp loop_vechnyy\(n\) do$/mu)
  assert.match(built.source, /^ +loop_pong\(n\)$/mu, "взаимный хвостовой вызов идёт прямо в тело соседа")
  /* Параметр, который тело не читает, обязан уйти под приставку «_»: иначе
     Elixir выдаст предупреждение, а --warnings-as-errors превратит его в
     отказ сборки. */
  assert.match(built.source, /^ {2}def fn_vechnyy\(n\) do$/mu)

  /* Обе функции незавершающиеся — обе обязаны упереться в лимит шагов, а не
     съесть память и не собраться в код, который компилятор отверг бы. */
  const answers = ask(built, [
    { fn: "Вечный", args: [encode(1)], steps: "3000" },
    { fn: "Пинг", args: [encode(1)], steps: "3000" },
  ])
  for (const answer of answers) {
    assert.equal(answer.ok, false)
    assert.equal(answer.code, "FLANG_RECURSION_LIMIT")
  }
  for (const name of ["Вечный", "Пинг"]) {
    const byInterpreter = outcome(() => interpret(program, name, [1], { maxSteps: 3000 }))
    assert.equal(byInterpreter.code, "FLANG_RECURSION_LIMIT",
      `интерпретатор обязан остановиться там же: «${name}»`)
  }
})

/* ══════════════════════════ 12. форма результата ═══════════════════════════ */

test("детерминированность: две печати дают побайтово одно и то же", () => {
  const list = [listProgram, treeProgram, mutualProgram, countdownProgram, stringProgram, namesakeProgram,
    parse(flangSource)]
  for (const { program } of programs) list.push(program)
  for (const program of list) {
    const first = emitElixir(program)
    const second = emitElixir(program)
    assert.deepEqual(first, second)
    /* И ещё раз после кругосветки через JSON: вывод не зависит от того, откуда
       приехал AST. */
    const third = emitElixir(JSON.parse(JSON.stringify(program)))
    assert.deepEqual(first, third)
  }
})

test("напечатанный Elixir ни от чего не зависит и объясняет себя", () => {
  const emitted = emitElixir(treeProgram)
  const all = emitted.files.map((file) => file.content).join("\n")
  /* Только стандартная библиотека Elixir и Erlang плюс собственный рантайм
     программы: ни одной внешней зависимости, поэтому и mix.exs не нужен —
     хватает `elixirc`. Ни use, ни import, ни alias: всё пишется полным именем,
     и напечатанный модуль ничего не втаскивает в чужое пространство имён. */
  assert.doesNotMatch(all, /^\s*(?:use|import|alias)\s+[A-Z]/mu,
    "ни use, ни import, ни alias: всё пишется полным именем")
  /* Сканируется КОД, а не весь текст: «Object.is» законно стоит в объяснении
     равенства скаляров, и считать его зависимостью было бы враньём. Поэтому
     строки документации и комментарии убираются до разбора. Имя модуля Elixir
     бывает составным («Flang.Rt»), поэтому берётся вся цепочка сегментов, а не
     первый из них. */
  const fence = '"'.repeat(3)
  const code = all
    .split(fence)
    .filter((piece, index) => index % 2 === 0)
    .join("\n")
    .replaceAll(/^\s*#.*$/gmu, "")
  const modules = [...code.matchAll(/(?<![.\w])([A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*)*)\.[a-z_]+[(\s]/gu)]
    .map((match) => match[1])
  const allowed = new Set([
    "Flang", "Flang.Rt", "Flang.Error", "Flang.Cli", "Flang.Json",
    "Enum", "String", "Integer", "Float", "List", "Process", "Module", "Code", "IO", "Kernel",
  ])
  for (const name of modules) {
    assert.ok(allowed.has(name), `внешняя зависимость «${name}» в напечатанном коде недопустима`)
  }
  const erlang = [...code.matchAll(/:([a-z_]+)\.[a-z_]+\(/gu)].map((match) => match[1])
  for (const name of erlang) {
    assert.ok(["erlang", "math"].includes(name), `модуль Erlang «:${name}» в напечатанном коде неожидан`)
  }
  assert.doesNotMatch(code, /DateTime\.utc_now|:rand\.|System\.get_env|System\.cmd/u,
    "ни времени, ни случайности, ни окружения")
  assert.deepEqual(emitted.files.map((file) => file.path).sort(), [
    "Makefile",
    "derevya.ex",
    "flang_cli.ex",
    "flang_runtime.ex",
  ])
  const source = emitted.files.find((file) => file.path === "derevya.ex").content
  assert.match(source, /^# Сгенерировано flang \(бэкенд Elixir/u)
  assert.match(source, /Не редактировать руками/u)
  assert.match(source, /^defmodule Derevya do$/mu, "имя модуля Elixir — из имени модуля flang")
  /* Имена flang сохраняются рядом с каждым типом и каждой функцией. */
  assert.match(source, /Функция flang «Сумма дерева»/u)
  assert.match(source, /Вариант «Лист» суммы типов «Дерево»/u)
  /* Рантайм печатается байт в байт из репозитория. */
  for (const name of ["flang_runtime.ex", "flang_cli.ex"]) {
    const onDisk = readFileSync(fileURLToPath(new URL(`../src/emit/elixir/${name}`, import.meta.url)), "utf8")
    const printed = emitted.files.find((file) => file.path === name).content
    assert.ok(printed.endsWith(onDisk), `${name} обязан печататься без правок, только с шапкой`)
  }
})

test("без прогонщика печатается одна библиотека", () => {
  const emitted = emitElixir(listProgram, { cli: false })
  assert.deepEqual(emitted.files.map((file) => file.path).sort(), [
    "Makefile",
    "flang_runtime.ex",
    "spiski.ex",
  ])
})

/* ══════════════════════════ 13. ошибки печати ═══════════════════════════ */

test("статические ошибки ловятся при печати, а не в собранной программе", () => {
  const wrongArity = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "builtin", name: "длина", args: [] } }],
  }
  assert.throws(() => emitElixir(wrongArity), (error) => {
    assert.equal(errorCode(error), "FLANG_BUILTIN_ARGS")
    assert.equal(error.message, "«длина» ожидает 1 аргумент, получено 0")
    return true
  })

  const unknownName = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "var", name: "неизвестное" } }],
  }
  assert.throws(() => emitElixir(unknownName), (error) => {
    assert.equal(errorCode(error), "FLANG_UNKNOWN_NAME")
    assert.equal(error.message, "имя «неизвестное» не связано")
    return true
  })

  const unknownCall = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "call", name: "Нет такой", args: [] } }],
  }
  assert.throws(() => emitElixir(unknownCall), (error) => errorCode(error) === "FLANG_UNKNOWN_NAME")

  /* «Сумма» и «сумма» — разные имена модели, но один идентификатор Elixir. */
  const collision = {
    flang: 1,
    functions: [
      { name: "Сумма", params: [], body: { kind: "literal", value: 1 } },
      { name: "сумма", params: [], body: { kind: "literal", value: 2 } },
    ],
  }
  assert.throws(() => emitElixir(collision), /идентификатор/u)

  /* Два варианта одной роли, дающие один идентификатор, — тоже коллизия. */
  const variantCollision = {
    flang: 1,
    types: [{
      kind: "sum",
      name: "Т",
      variants: [{ name: "Лист", fields: [] }, { name: "лист", fields: [] }],
    }],
    functions: [{ name: "Ф", params: [], body: { kind: "literal", value: 1 } }],
  }
  assert.throws(() => emitElixir(variantCollision), /идентификатор/u)

  /* Модуль, чьё имя заняло бы файл рантайма: «flang runtime» даёт
     flang_runtime.ex, и напечатанная программа затёрла бы собственный рантайм. */
  const shadowRuntime = {
    flang: 1,
    module: "flang runtime",
    functions: [{ name: "Ф", params: [], body: { kind: "literal", value: 1 } }],
  }
  assert.throws(() => emitElixir(shadowRuntime), /рантайм/u)

  /* И модуль, чьё имя заняло бы само пространство имён рантайма. */
  const shadowNamespace = {
    flang: 1,
    module: "Flang",
    functions: [{ name: "Ф", params: [], body: { kind: "literal", value: 1 } }],
  }
  assert.throws(() => emitElixir(shadowNamespace), /рантайм/u)
})

test("имена, опасные для Elixir, печать переживают: ключевые слова и имена бэкенда", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /* Приставка роли снимает целый класс столкновений: функция, названная «call»
     или «new context», не спорит с тем, что печатает сам бэкенд. Локальные же
     имена приставки не несут, и там опасность настоящая: параметр «end» —
     ключевое слово, после которого файл вообще не разберётся, а «length» и
     «rem» затенили бы формы Kernel, которые видны без импорта. */
  const program = {
    flang: 1,
    module: "Опасные",
    functions: [
      {
        name: "call",
        params: [{ name: "end" }, { name: "after" }],
        body: {
          kind: "binary",
          op: "add",
          left: { kind: "var", name: "end" },
          right: { kind: "var", name: "after" },
        },
      },
      {
        name: "length",
        params: [{ name: "rem" }],
        body: { kind: "builtin", name: "к строке", args: [{ kind: "var", name: "rem" }] },
      },
      { name: "new context", params: [], body: { kind: "literal", value: 1 } },
    ],
  }
  const built = build(program)
  assert.match(built.source, /^ {2}def fn_call\(/mu, "имя «call» не спорит с диспетчером бэкенда")
  assert.match(built.source, /^ {2}def fn_new_context\(\) do$/mu)
  assert.doesNotMatch(built.source, /^ {2}def fn_call\(end,/mu, "ключевое слово не имеет права стать параметром")
  assert.doesNotMatch(built.source, /^ {2}def fn_length\(rem\)/mu, "имя Kernel не имеет права стать параметром")
  assert.match(built.source, /^ {2}def call\("call", args\) do$/mu, "диспетчер бэкенда остаётся на месте")

  compare(program, built, "call", [[1, 2], ["строка", 2]])
  compare(program, built, "length", [[1], [true], [null], [[1]]])
  compare(program, built, "new context", [[]])
})

/* ══════════════════════════ 14. тулчейн ═══════════════════════════ */

test("тулчейн Elixir: версия записывается в отчёт, отсутствие — честный пропуск", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const version = execFileSync(elixirBin, ["--version"], { encoding: "utf8", env: ELIXIR_ENV }).trim()
  t.diagnostic(`${version.split("\n").filter(Boolean).join("; ")}; сборка идёт под --warnings-as-errors`)
  assert.match(version, /Elixir \d+\.\d+/u)
})

test("Makefile — рабочая сборка, а не украшение", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const makeBin = findExecutable("make")
  if (!makeBin) {
    t.diagnostic("make не найден — проверка Makefile пропущена (сборка проверена прямым вызовом elixirc)")
    return
  }
  /* Печатается в свежий каталог: `make` обязан собрать напечатанное сам, без
     единого ключа от пользователя. */
  serial += 1
  const directory = join(workdir, `make${serial}`)
  mkdirSync(directory, { recursive: true })
  for (const file of emitElixir(treeProgram).files) {
    writeFileSync(join(directory, file.path), file.content, "utf8")
  }
  const made = spawnSync(makeBin, ["build", `ELIXIRC=${elixircBin}`], {
    cwd: directory,
    encoding: "utf8",
    env: ELIXIR_ENV,
  })
  assert.equal(made.status, 0, `make build не собрал напечатанное:\n${made.stdout}\n${made.stderr}`)
  assert.ok(listFiles(directory).some((path) => path.endsWith(".beam")), "make обязан оставить .beam")
})
