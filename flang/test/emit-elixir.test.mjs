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
 * (flang/test/toolchain-guard.mjs). Молчаливый пропуск, выглядящий как
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
import { ЧАСТИЧНЫЕ } from "../src/failures.mjs"
import { markMeasureGuards } from "../src/totality.mjs"
import { emitElixir } from "../src/emit/elixir.mjs"
import { findExecutable } from "../src/toolchain.mjs"
import { missingToolchain } from "./toolchain-guard.mjs"
import { черезГраницу } from "./through-entry.mjs"
import {
  functionGrid,
  loadPrograms,
  ключТочки,
  сверьУбегающих,
  ПРЕДЕЛ_УБЕГАЮЩЕЙ,
  ПРЕДЕЛЫ,
} from "./corpus-grid.mjs"

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

/**
 * Один процесс на сколько угодно запросов: запуск BEAM дорог, запрос дёшев.
 *
 * `срок` — необязательный предел в миллисекундах. Он нужен там, где проверяется
 * не значение, а ЦЕНА: вопрос «предел шагов срабатывает за секунды или не
 * срабатывает вовсе» без срока не задать — прогонщик просто висит, и тест,
 * вместо того чтобы покраснеть, не кончается никогда.
 */
function ask(built, requests, срок = undefined) {
  const input = `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`
  let output
  try {
    output = execFileSync(
      elixirBin,
      ["-pa", "_build", "-e", `Flang.Cli.main(["${built.alias}"])`],
      {
        cwd: built.directory,
        input,
        encoding: "utf8",
        env: ELIXIR_ENV,
        maxBuffer: 512 * 1024 * 1024,
        ...(срок === undefined ? {} : { timeout: срок, killSignal: "SIGKILL" }),
      },
    )
  } catch (беда) {
    if (срок !== undefined && (беда.code === "ETIMEDOUT" || беда.signal === "SIGKILL")) {
      assert.fail(`прогонщик не ответил за ${срок} мс: ${JSON.stringify(requests).slice(0, 200)}`)
    }
    throw беда
  }
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
    const byInterpreter = черезГраницу(program, functionName, args, options.limits ?? {})
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

/* Корпус, сетка порчи, пределы и поимённый список убегающих точек — общие на
   все шесть сверок и лежат в `flang/test/corpus-grid.mjs`. Раньше эти сто с
   лишним строк были скопированы в шесть файлов побайтово: правило, написанное
   шесть раз, шесть раз и расходится. */
const programs = loadPrograms()

test("stdlib и leetcode: собранный Elixir совпадает с интерпретатором", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден (ни в PATH, ни в FTS_TOOLCHAIN_PATH) — пропуск")
    return
  }
  assert.ok(programs.length >= 25, `программ на flang найдено слишком мало: ${programs.length}`)

  let points = 0
  let functions = 0
  let limited = 0
  const убежали = []
  const started = Date.now()

  for (const { file, program } of programs) {
    const built = build(program)
    const plan = []
    for (const fn of program.functions) {
      const grid = functionGrid(fn)
      if (grid.length === 0) continue
      functions += 1
      for (const args of grid) {
        /* Эталон спрашивается ПЕРВЫМ — до того, как построен запрос: его ответ
           решает, каким бюджетом спрашивать напечатанный код. Один и тот же
           `maxSteps` у двух счётчиков означает разное количество РАБОТЫ (шаг
           напечатанного кода крупнее шага эталона в ~48,6 раза — измерено, см.
           corpus-grid.mjs), а цена одного шага не ограничена: `добавить`
           копирует список. На убегающих точках это разница в тысячи раз. */
        /* Эталон спрашивается ЧЕРЕЗ ГРАНИЦУ ВХОДА (`through-entry.mjs`), а не
           голым `interpret`: напечатанная программа сверяет аргумент с
           объявленным типом ДО вычисления (`work/entry-types-113`,
           `work/emit-entry-types`), и эталон, зовущий вычислитель напрямую,
           отвечал бы на чужие значения иначе, чем цель. Общий модуль сетки
           пришёл с `interpret` здесь — это молчаливый откат границы входа, и
           он закрыт при сборке. */
        const byInterpreter = черезГраницу(program, fn.name, args, ПРЕДЕЛЫ)
        const runaway = !byInterpreter.ok && byInterpreter.code === "FLANG_RECURSION_LIMIT"
        if (runaway) убежали.push(ключТочки(file, fn.name, args))
        plan.push({ name: fn.name, args, byInterpreter, runaway })
      }
    }
    assert.ok(plan.length > 0, `${file}: не из чего построить сетку — у функций нет примеров`)
    const answers = ask(built, plan.map((point) => ({
      fn: point.name,
      args: point.args.map(encode),
      depth: String(ПРЕДЕЛЫ.maxDepth),
      steps: String(point.runaway ? ПРЕДЕЛ_УБЕГАЮЩЕЙ : ПРЕДЕЛЫ.maxSteps),
    })))

    plan.forEach((point, index) => {
      const byEmitted = answerOutcome(answers[index])
      if (point.runaway) {
        /* Убегающая точка: значения нет ни у кого, сверяется отказ по пределу.
           Требование при этом СТРОЖЕ прежнего — было «если напечатанный код
           тоже остановился, то тем же кодом», стало «обязан остановиться».
           Текст не сверяется: в нём стоит бюджет, а он у двух движков разный
           по построению. */
        limited += 1
        assert.ok(
          !byEmitted.ok && byEmitted.code === "FLANG_RECURSION_LIMIT",
          `${file} / «${point.name}» на входе ${JSON.stringify(point.args) ?? "?"}: эталон упёрся ` +
            `в предел шагов, а при ${ПРЕДЕЛ_УБЕГАЮЩЕЙ} своих шагов собранный Elixir дал ${describeOutcome(byEmitted)}`,
        )
        return
      }
      assert.ok(
        sameOutcome(point.byInterpreter, byEmitted),
        `${file} / «${point.name}» на входе ${JSON.stringify(point.args) ?? "?"}: ` +
          `интерпретатор дал ${describeOutcome(point.byInterpreter)}, собранный Elixir дал ${describeOutcome(byEmitted)}`,
      )
      points += 1
    })
  }

  const оУбегающих = сверьУбегающих(убежали)

  t.diagnostic(
    `программ: ${programs.length}, функций: ${functions}, сверенных входов: ${points}` +
      `${limited > 0 ? `, убегающих (сверены отказом по пределу): ${limited} — ${оУбегающих}` : ""}` +
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

/* ═════════ 8а. цена «добавить»: предел шагов обязан быть СРОКОМ ═════════ */

/*
 * Предел шагов, который не срабатывает за полторы минуты, — не предел.
 *
 * Улика. Точка сетки «Строить скобки» от 42 и 0 и 0 и "" и [] (её строит порча
 * аргумента в главной сверке выше: 42 входит в ЧУЖИЕ) при объявленных 5 000 000
 * шагов снималась по сроку 90 000 мс, и вместе с нею НЕ ЗАВЕРШАЛСЯ весь этот
 * файл. Эталон-интерпретатор на той же точке упирается в предел за 926 мс.
 *
 * Причина была не в счётчике, а в цене шага: «добавить» печаталось как
 * `список ++ [элемент]`, то есть копировало весь список на каждый вызов, и
 * накопление n слов стоило O(n²). Один шаг стоил O(длины) — значит предел шагов
 * не ограничивал РАБОТУ ничем.
 *
 * Приём, которым это чинится у C, Go и Rust («массив с запасом» и отметка
 * занятого), к BEAM не прикладывается вовсе: список односвязный, ячейки не
 * переписывает никто, запаса за концом не бывает. Здесь список стал парой
 * «начало и конец наоборот» (moduledoc рантайма, раздел 5), и «добавить» кладёт
 * одну ячейку в голову конца.
 *
 * Два теста проверяют разное: ЦЕНУ (накопление обязано быть линейным) и
 * ПОРЯДОК (перевёрнутый конец обязан разворачиваться, и ветвление обязано
 * давать независимые списки). Без второго первый зеленел бы и на «добавить»,
 * которое просто возвращает список задом наперёд.
 */

const накоплениеProgram = parse([
  "модуль «Накопление»",
  "",
  "тотальная функция «Накопить»",
  "  принимает н: число, итог: список числа",
  "  возвращает список числа",
  "  убывает н",
  "  если н не больше 0",
  "    то итог",
  "    иначе «Накопить» от (н минус 1) и (добавить н к итог)",
  "",
].join("\n"), "накопление.flang")

test("накопление списка линейно: 200 000 «добавить» — это секунды, а не минуты", (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const built = build(накоплениеProgram)

  /* Предел шагов снят намеренно (`steps: "0"`): здесь меряется цена ОДНОГО
     шага, и счётчик в измерение входить не должен. */
  const времена = []
  for (const н of [50_000, 100_000, 200_000]) {
    const начало = Date.now()
    const [ответ] = ask(
      built,
      [{ fn: "Накопить", args: [encode(н), encode([])], depth: "10000", steps: "0" }],
      120_000,
    )
    времена.push(Date.now() - начало)
    assert.equal(ответ.ok, true, JSON.stringify(ответ).slice(0, 200))
    const значение = decode(ответ.value)
    assert.equal(значение.length, н, "накоплено не то число элементов")
    assert.equal(значение[0], н, "первым обязан лежать первый добавленный")
    assert.equal(значение[н - 1], 1, "последним — последний добавленный")
  }

  /* Порог с запасом в два порядка, а не «на глаз»: до починки 200 000 брали
     146 884 мс. Между линией и квадратом здесь разница классов сложности, а не
     нагрузки машины. */
  assert.ok(
    времена[2] < 30_000,
    `200 000 «добавить» заняли ${времена[2]} мс — это снова квадрат, а не линия`,
  )
  assert.ok(
    времена[2] < времена[1] * 3 + 100,
    `удвоение числа «добавить» подняло время с ${времена[1]} до ${времена[2]} мс — это квадратичный рост`,
  )
  t.diagnostic(
    `накопление: 50 000 за ${времена[0]} мс, 100 000 за ${времена[1]} мс, 200 000 за ${времена[2]} мс`,
  )
})

test("«добавить» за постоянное время не портит исходный список: ветвление и хвост", (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /* Ветвление — то самое место, где приём «копить конец наоборот» ломается,
     если инвариант неверен: «два» обязано кончаться двойкой, а не единицей, и
     «основа» обязана остаться прежней. «Хвост» здесь не для полноты: он
     снимает элемент с НАЧАЛА, а «добавить» пишет в КОНЕЦ, и именно на их
     сочетании накопленный конец обязан развернуться в порядок языка. */
  const program = parse([
    "модуль «Ветвление добавления»",
    "",
    "функция «Ветвление»",
    "  принимает основа: список числа",
    "  возвращает список (список числа)",
    "  пусть один равно (добавить 1 к основа)",
    "  пусть два равно (добавить 2 к основа)",
    "  пусть три равно (добавить 3 к один)",
    "  пусть четыре равно (добавить 4 к один)",
    "  [основа, один, два, три, четыре]",
    "",
    "функция «Ветвление хвоста»",
    "  принимает основа: список числа",
    "  возвращает список (список числа)",
    "  пусть срез равно (хвост (добавить 9 к основа))",
    "  пусть один равно (добавить 1 к срез)",
    "  пусть два равно (добавить 2 к срез)",
    "  [основа, срез, один, два, (хвост один)]",
    "",
  ].join("\n"), "ветвление.flang")
  const built = build(program)

  const сетка = [[[7]], [[7, 8]], [[7, 8, 9]], [[1, 2, 3, 4, 5]]]
  let points = compare(program, built, "Ветвление", [[[]], ...сетка])
  points += compare(program, built, "Ветвление хвоста", сетка)

  const [ответ] = ask(built, [{ fn: "Ветвление", args: [encode([7, 8])] }])
  assert.deepEqual(decode(ответ.value), [[7, 8], [7, 8, 1], [7, 8, 2], [7, 8, 1, 3], [7, 8, 1, 4]])

  const [второй] = ask(built, [{ fn: "Ветвление хвоста", args: [encode([7, 8])] }])
  assert.deepEqual(decode(второй.value), [[7, 8], [8, 9], [8, 9, 1], [8, 9, 2], [9, 1]])
  t.diagnostic(`ветвление «добавить» сверено на ${points} входах`)
})

test("точка сетки, на которой печать зависала: предел шагов срабатывает за секунды", (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const найдено = programs.find((item) => item.file === "022-generate-parentheses.flang")
  assert.ok(найдено, "в корпусе нет 022-generate-parentheses.flang — тест потерял свою улику")
  const built = build(найдено.program)

  const запросы = [
    {
      fn: "Строить скобки",
      args: [42, 0, 0, "", []].map(encode),
      depth: String(ПРЕДЕЛЫ.maxDepth),
      steps: String(ПРЕДЕЛЫ.maxSteps),
    },
    {
      fn: "Правильные скобки",
      args: [encode(42)],
      depth: String(ПРЕДЕЛЫ.maxDepth),
      steps: String(ПРЕДЕЛЫ.maxSteps),
    },
  ]

  const начало = Date.now()
  const ответы = ask(built, запросы, 120_000)
  const мс = Date.now() - начало

  for (const ответ of ответы) {
    assert.equal(ответ.ok, false, `на этой точке обязан быть отказ по пределу: ${JSON.stringify(ответ).slice(0, 200)}`)
    assert.equal(ответ.code, "FLANG_RECURSION_LIMIT")
    assert.equal(
      ответ.message,
      "функция «Строить скобки» исчерпала лимит шагов (5000000) на глубине вызовов 43",
    )
  }

  /* Текст сверен не с образцом, а с эталоном: дословно, знак в знак. */
  const эталон = outcome(() => interpret(найдено.program, "Строить скобки", [42, 0, 0, "", []], ПРЕДЕЛЫ))
  assert.equal(эталон.ok, false)
  assert.equal(эталон.code, "FLANG_RECURSION_LIMIT")
  assert.equal(ответы[0].message, эталон.message)

  t.diagnostic(`обе точки упёрлись в предел за ${мс} мс на двоих (было: не отвечали и за 90 000 мс)`)
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
  assert.match(тело.slice(0, тело.indexOf("\n  end")), /Enum\.at\(cells,/u,
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

/* ═══ 9а. кодировку протокола задаёт протокол, а не локаль хозяина ═══ */

/*
 * Улика, снятая на этой машине, а не выдуманная.
 *
 * В окружении стоит `LC_CTYPE=UTF-8` — форма, законная на macOS и не
 * существующая в glibc (`locale` отвечает «Cannot set LC_CTYPE to default
 * locale»). BEAM в такой локали поднимает `:standard_io` с кодировкой `latin1`
 * (`:io.getopts/1` показывает её прямо), и тогда `IO.write` печатает всякий знак
 * свыше U+00FF не байтами UTF-8, а текстом `\x{43D}`, а `IO.read` читает байты
 * UTF-8 как знаки latin1. Ответ прогонщика переставал быть JSON — `JSON.parse`
 * падал на «Bad escaped character», — и 32 теста этого файла из 38 краснели при
 * верной программе и верном входе. Хуже: калечился и ЗАПРОС, поэтому «Эхо»
 * отвечало «не найдена функция», хотя функция есть.
 *
 * Обходы существуют (`LC_ALL=C.UTF-8`, `ELIXIR_ERL_OPTIONS=+fnu`), но обход —
 * это просьба к пользователю, а обещание языка звучит иначе: напечатанная
 * программа работает одинаково у всех. Поэтому прогонщик снимает перекодировку
 * вовсе и ходит байтами (`flang_cli.ex`, `pin_bytes/1` и `serve/2`).
 *
 * Проверяется это НЕ на локали хозяина, иначе тест зеленел бы там, где локаль
 * исправна. Ответ снимается при четырёх окружениях сразу и обязан совпасть
 * ПОБАЙТОВО. Одного совпадения мало — сойтись можно и на общей порче, — поэтому
 * байты ещё и сверяются с ожидаемым UTF-8, а форма `\x{` объявлена запрещённой.
 */
const ЛОКАЛИ = [
  ["своя локаль хозяина", {}],
  /* `C` — не-UTF-8 локаль, которая есть ВЕЗДЕ, включая macOS: улика
     воспроизводится не только на этой машине. */
  ["LC_ALL=C", { LC_ALL: "C", LC_CTYPE: "C", LANG: "C" }],
  /* Та самая несуществующая форма из macOS, с которой всё началось. */
  ["LC_CTYPE=UTF-8", { LC_ALL: "", LC_CTYPE: "UTF-8", LANG: "" }],
  ["LC_ALL=C.UTF-8", { LC_ALL: "C.UTF-8", LC_CTYPE: "C.UTF-8", LANG: "C.UTF-8" }],
]

/** Сырые БАЙТЫ ответа прогонщика: JSON.parse тут не годится — он их и портит. */
function askBytes(built, requests, env) {
  const input = `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`
  /* Ни `encoding`, ни строки: вход уезжает байтами UTF-8, выход приезжает
     Buffer-ом. Перевод через строку JS убил бы ровно ту улику, что ищется. */
  return execFileSync(elixirBin, ["-pa", "_build", "-e", `Flang.Cli.main(["${built.alias}"])`], {
    cwd: built.directory,
    input: Buffer.from(input, "utf8"),
    env: { ...ELIXIR_ENV, ...env },
    maxBuffer: 64 * 1024 * 1024,
  })
}

test("кодировка прогонщика: ответ побайтово тот же при любой локали хозяина", (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const program = parse([
    "модуль «Локаль»",
    "",
    "тотальная функция «Эхо»",
    "  принимает текст: строка",
    "  возвращает строка",
    "  текст",
    "",
    "тотальная функция «Слова»",
    "  принимает текст: строка",
    "  возвращает список строки",
    '  [текст, "нат", "натуральное число ℕ", "🔥"]',
    "",
  ].join("\n"), "локаль.flang")
  const built = build(program)

  /* Кириллица едет в обе стороны: в аргументе (чтение) и в ответе (печать).
     Плюс знак вне BMP — суррогатная пара в UTF-16 и четыре байта в UTF-8, — и
     отказ, у которого кириллица в ТЕКСТЕ, а не в значении. */
  const слово = "нат «ℕ» 🔥"
  const запросы = [
    { fn: "Эхо", args: [encode(слово)] },
    { fn: "Слова", args: [encode("привет")] },
    { fn: "Нету", args: [] },
  ]

  const снимки = ЛОКАЛИ.map(([имя, окружение]) => [имя, askBytes(built, запросы, окружение)])
  const [первоеИмя, эталонныеБайты] = снимки[0]

  for (const [имя, байты] of снимки.slice(1)) {
    assert.ok(
      байты.equals(эталонныеБайты),
      `локаль «${имя}» дала не те байты, что «${первоеИмя}»:\n` +
        `  ${имя}: ${JSON.stringify(байты.toString("utf8").slice(0, 200))}\n` +
        `  ${первоеИмя}: ${JSON.stringify(эталонныеБайты.toString("utf8").slice(0, 200))}`,
    )
  }

  /* Совпасть можно и на общей порче — значит байты обязаны быть ТЕМИ САМЫМИ. */
  const текст = эталонныеБайты.toString("utf8")
  assert.doesNotMatch(
    текст,
    /\\x\{/u,
    "в ответе форма \\x{…}: устройство всё ещё перекодирует знаки свыше U+00FF",
  )
  const строки = текст.split("\n").filter((line) => line.length > 0)
  assert.equal(строки.length, запросы.length, "прогонщик обязан ответить на каждый запрос ровно один раз")

  const ответы = строки.map((line) => JSON.parse(line))
  assert.equal(decode(ответы[0].value), слово, "строка обязана вернуться из прогонщика знак в знак")
  assert.deepEqual(decode(ответы[1].value), ["привет", "нат", "натуральное число ℕ", "🔥"])
  assert.equal(ответы[2].ok, false)
  assert.equal(ответы[2].message, "не найдена функция «Нету»")

  /* И то же самое, но с эталоном-интерпретатором, а не с образцом. */
  const эталон = outcome(() => interpret(program, "Слова", ["привет"], {}))
  assert.ok(sameOutcome(эталон, answerOutcome(ответы[1])))

  t.diagnostic(
    `ответ прогонщика совпал побайтово (${эталонныеБайты.length} байт) при локалях: ` +
      ЛОКАЛИ.map(([имя]) => имя).join(", "),
  )
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

/* ═════════════ 11б. сторож меры: отметка обязана ПОЯВИТЬСЯ ════════════════ */

/**
 * Программа, чьё доказательство держится на числовой мере.
 *
 * Она же у цели C (`emit-c.test.mjs`, «сторож меры»), и намеренно та же:
 * сторож у всех восьми целей один и тот же, значит и вход, на котором он обязан
 * сработать, обязан быть один.
 */
const measureSource = `модуль «Счёт»

тотальная функция «До нуля»
  принимает н: число
  возвращает число
  если н не больше 0
    то 0
    иначе «До нуля» от (н минус 1)
`

/** Сколько раз слово `FLANG_MEASURE` встречается во всём напечатанном. */
function упоминанийМеры(program) {
  const весь = emitElixir(program).files.map((file) => file.content).join("")
  return (весь.match(/FLANG_MEASURE/gu) ?? []).length
}

test("сторож меры ПОЯВЛЯЕТСЯ в напечатанном Elixir, а не теряется обеими сторонами", () => {
  /* Главная сверка двусторонняя, и этим слепа: снятая отметка теряется ОБЕИМИ
     сторонами разом. Интерпретатор зовёт то же понижение, и на непомеченной
     программе он досчитает ровно то, что досчитает непомеченный Elixir, —
     сверка останется зелёной, а сторожа не будет ни у кого. Поэтому здесь
     проверяется не совпадение, а ПОЯВЛЕНИЕ: без него изъятие отметки покрасило
     бы только статическую улику, а главный тест смолчал бы. */
  assert.equal(упоминанийМеры(parse(measureSource)), 0,
    "у голого разбора сторожа меры нет вовсе — иначе улика ниже ничего не значит")
  assert.equal(упоминанийМеры(markMeasureGuards(parse(measureSource))), 1,
    "помеченная программа обязана печатать сторожа")

  /* И то же самое на настоящем корпусе, которым идёт главная сверка: он
     грузится помеченным (`loadPrograms`), и сторожа обязаны в нём БЫТЬ. */
  let несут = 0
  let всего = 0
  for (const { program } of programs) {
    const сколько = упоминанийМеры(program)
    if (сколько > 0) несут += 1
    всего += сколько
  }
  assert.ok(несут >= 43, `сторожа меры несут ${несут} программ корпуса из ${programs.length}, а несли 43`)
  assert.ok(всего >= 185, `упоминаний сторожа в печати корпуса ${всего}, а было 185`)
})

test("сторож меры: отказ у собранного Elixir дословно тот же, что у интерпретатора", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  /* Доказательство по мере верно для вещественных чисел, а числа flang —
     IEEE-754 double: `н минус 1` при большом |н| равен н, спуск не идёт, и
     `тотальная` обещала бы завершение там, где его нет. Понижение перед печатью
     ставит на доказанном мерой аргументе проверку убывания (`src/defunc.mjs`),
     а вычислитель зовёт то же понижение — значит отказ у них обязан совпасть
     КОДОМ И ТЕКСТОМ, а не «по смыслу».

     Сетка — не выдумка: 2⁵⁴+4 и 1e308 это входы, где шаг ничего не меняет;
     ±∞ и NaN — там же по другой причине; 0, 1, 7 и 2.5 — обычный спуск,
     который сторож обязан пропустить неотличимо от программы без него. */
  const program = markMeasureGuards(parse(measureSource))
  const built = build(program)
  assert.match(built.source, /FLANG_MEASURE/u, "сторож не доехал до напечатанного Elixir")

  const points = compare(program, built, "До нуля", [
    [0], [1], [7], [2.5], [-3],
    [18014398509481988], [1e308], [Infinity], [-Infinity], [NaN],
  ])

  /* Отказ обязан ПРИЙТИ С МАШИНЫ, а не только совпасть: на 2⁵⁴+4 шаг ничего не
     меняет, и собранный Elixir обязан отказать шестым видом. */
  const [ответ] = ask(built, [{ fn: "До нуля", args: [encode(18014398509481988)] }])
  assert.equal(ответ.ok, false, "на входе, где мера не убывает, собранный Elixir обязан отказать")
  assert.equal(ответ.code, "FLANG_MEASURE", `с машины пришёл ${ответ.code}, а не шестой вид отказа`)
  t.diagnostic(`сверенных входов: ${points}, с машины пришёл ${ответ.code}`)
})

/* ═════════ 11в. сторож ОБЪЯВЛЕННОЙ меры: 98 мест корпуса из ста ════════════ */

/**
 * Программа, чьё завершение доказано ОБЪЯВЛЕННОЙ мерой, — Евклид.
 *
 * Сторожей меры понижение ставит ДВА, и это два разных сторожа, а не один с
 * настройками (`src/defunc.mjs`): `renderGuard` — постоянный шаг, одно
 * постусловие; `renderDescentGuard` — объявленная мера, ТРИ постусловия и
 * параметр типа. Выше проверен первый, и мест в корпусе у него два из ста:
 * `node flang/scripts/proof-ledger.mjs` считает 2 функции «постоянным шагом» на
 * 2 места сторожа и 64 функции «объявленной мерой» на 98 мест в 44 файлах.
 * Девяносто восемь мест из ста до сегодня не проверял у целей никто.
 *
 * Евклид взят не для красоты: `а остаток от б` от дробного аргумента даёт
 * дробную меру, а убывающая дробная цепочка (0.618, 0.382, 0.236 …) не
 * кончается вовсе — ровно то, что ловит третье постусловие и чего у сторожа
 * постоянного шага нет.
 */
const descentSource = `модуль «Евклид»

тотальная функция «НОД»
  принимает а: число, б: число
  возвращает число
  убывает б
  если б равен 0
    то а
    иначе «НОД» от б и (а остаток от б)
`

/**
 * Сетка объявленной меры: семь исправных спусков и десять входов, на которых
 * не выполняется ровно одно из трёх условий.
 *
 * Она же у остальных семи целей, и намеренно та же: сторож один на восемь
 * целей, значит и входы, на которых он обязан сработать, обязаны быть одни.
 */
const descentGrid = [
  /* Спуск идёт: сторож обязан пропустить их неотличимо от программы без него. */
  [1071, 462], [12, 18], [0, 0], [5, 0], [7, 1], [1, 0.5], [1e308, 7],
  /* Мера перестала быть целой: цепочка убывает и не кончается. */
  [1071.5, 462], [1071, 462.5], [10, 3.5], [2, 1e-300],
  /* Мера не убыла: ±∞ и NaN сравнение не проходят. */
  [1, Infinity], [Infinity, 3], [NaN, 3], [1, NaN], [10, -3],
  /* Мера ушла ниже нуля: остаток от отрицательного отрицателен. */
  [-10, 3],
]

test("сторож объявленной меры ПОЯВЛЯЕТСЯ в напечатанном Elixir всеми тремя условиями", () => {
  /* Довод тот же, что у сторожа постоянного шага, и здесь он весомее: условий
     ТРИ, живут они в общем понижении, и снятие любого теряют ОБЕ стороны разом.
     Убери проверку целости — интерпретатор и собранный Elixir согласно закрутят
     Евклида на дробной мере, сверка останется зелёной, а обещание «тотальная»
     станет ложным. Поэтому проверяется ПОЯВЛЕНИЕ, и по тексту на условие. */
  assert.equal(упоминанийМеры(parse(descentSource)), 0,
    "у голого разбора сторожа объявленной меры нет вовсе — иначе улика ниже ничего не значит")
  assert.equal(упоминанийМеры(markMeasureGuards(parse(descentSource))), 3,
    "у сторожа объявленной меры три постусловия — по одному на условие")

  const весь = emitElixir(markMeasureGuards(parse(descentSource))).files.map((file) => file.content).join("")
  for (const условие of [/не убыла/u, /ушла ниже нуля/u, /перестала быть целой/u]) {
    assert.match(весь, условие, `условие сторожа не доехало до напечатанного Elixir: ${условие}`)
  }
})

test("сторож объявленной меры: отказ у собранного Elixir дословно тот же, что у интерпретатора", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const program = markMeasureGuards(parse(descentSource))
  const built = build(program)
  assert.match(built.source, /FLANG_MEASURE/u, "сторож объявленной меры не доехал до напечатанного Elixir")

  const points = compare(program, built, "НОД", descentGrid)

  /* Отказ обязан ПРИЙТИ С МАШИНЫ, а не только совпасть, и по всем трём
     условиям: совпадение отказов двух движков, взявших текст из одного поля
     AST, доказывает согласие, а не срабатывание.

     ВХОД «не убыла» — `НОД(10, −3)`, а НЕ `НОД(1, ∞)`, и это не придирка к
     красоте. Граница входа напечатанной программы отвергает значение вне
     объявленного типа ДО вычисления, а `число` конечно: на бесконечности с
     машины приходит `FLANG_TYPE`, и сторож меры до дела не доходит вовсе. Взяв
     такой вход, тест проверял бы границу входа, думая, что проверяет сторожа.
     `остаток от` при отрицательном делителе несёт знак делимого, поэтому мера
     `б` идёт −3 → 1 и НЕ УБЫВАЕТ, оставаясь конечной. Бесконечности и NaN
     остались в сетке выше — там они сверяются с интерпретатором, и обе стороны
     согласно отвечают отказом границы. */
  const [дробная, ниже, неУбыла] = ask(built, [
    { fn: "НОД", args: [encode(1071.5), encode(462)] },
    { fn: "НОД", args: [encode(-10), encode(3)] },
    { fn: "НОД", args: [encode(10), encode(-3)] },
  ])
  for (const [ответ, условие] of [[дробная, /перестала быть целой/u], [ниже, /ушла ниже нуля/u],
    [неУбыла, /не убыла/u]]) {
    assert.equal(ответ.ok, false, `на входе без спуска собранный Elixir обязан отказать: ${условие}`)
    assert.equal(ответ.code, "FLANG_MEASURE", `с машины пришёл ${ответ.code}, а не шестой вид отказа`)
    assert.match(ответ.message, условие, `с машины пришёл не тот текст: ${ответ.message}`)
  }
  t.diagnostic(`сверенных входов: ${points}, условий с машины: 3`)
})

/* ═════════ 11г. сторож частичной формы: 278 мест корпуса ═══════════════════ */

/**
 * Вход, на котором каждая частичная форма отказывает, — по одному на форму.
 *
 * ── Почему список, а не сетка руками ───────────────────────────────────────
 *
 * Частичная форма — второй вид сторожа в рантайме и самый многочисленный:
 * 278 мест в 67 файлах корпуса против 100 мест сторожа меры (считано обходом
 * дерева по `ЧАСТИЧНЫЕ`; больше всех у `элемент` — 114, дальше `хвост` 53,
 * `разделить` 35, `голова` 34, `подстрока` 29). Сверка с интерпретатором его
 * уже покрывала — но покрывала СЕТКОЙ, написанной руками внутри общего теста
 * строковых форм: убери из неё `[[]]` у «Головы», и клетка опустеет молча.
 *
 * Здесь источник — закрытый список `ЧАСТИЧНЫЕ` (`src/failures.mjs`), который
 * сам сверяется с `builtins.mjs` прогоном. Форма, появившаяся в нём девятой,
 * покрасит этот тест у всех восьми целей и назовёт себя, вместо того чтобы
 * тихо остаться у цели без сторожа.
 *
 * Имена функций — из `stringProgram` выше: там уже есть по обёртке на форму.
 */
const ЧАСТИЧНЫЕ_ВХОДЫ = new Map([
  ["голова", ["Голова", [[]]]],
  ["хвост", ["Хвост", [[]]]],
  ["элемент", ["Элемент", [0, [1, 2]]]],
  ["символ", ["Символ", [3, "аб"]]],
  ["подстрока", ["Подстрока", ["абв", 0, 2]]],
  ["разделить", ["Разделить", ["а,б", ""]]],
  ["к числу", ["К числу", ["не число"]]],
  ["код символа", ["Код символа", [""]]],
])

test("сторож частичной формы: все восемь форм отказывают у Elixir кодом и текстом эталона", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  assert.deepEqual([...ЧАСТИЧНЫЕ_ВХОДЫ.keys()].sort(), [...ЧАСТИЧНЫЕ.keys()].sort(),
    "список частичных форм закрыт (src/failures.mjs) — вход обязан быть у каждой")

  const built = build(stringProgram)
  const ответы = ask(built, [...ЧАСТИЧНЫЕ_ВХОДЫ.values()].map(([fn, args]) => ({ fn, args: args.map(encode) })));
  [...ЧАСТИЧНЫЕ_ВХОДЫ].forEach(([форма, [fn, args]], index) => {
    /* Эталон обязан отказать — иначе вход выбран неверно и клетка пуста при
       зелёном тесте. */
    const эталон = outcome(() => interpret(stringProgram, fn, args))
    assert.equal(эталон.ok, false, `«${форма}»: у эталона отказа нет — вход выбран неверно`)
    /* И отказ обязан ПРИЙТИ С МАШИНЫ, а не только совпасть. */
    const ответ = ответы[index]
    assert.equal(ответ.ok, false, `«${форма}»: Elixir не отказал там, где отказал эталон`)
    assert.equal(ответ.code, "FLANG_BUILTIN_ARGS", `«${форма}»: с машины пришёл ${ответ.code}`)
    assert.equal(ответ.code, эталон.code, `«${форма}»: код разошёлся с эталоном`)
    assert.equal(ответ.message, эталон.message, `«${форма}»: текст с машины разошёлся с эталоном`)
  })
  t.diagnostic(`частичных форм с машины: ${ЧАСТИЧНЫЕ_ВХОДЫ.size}`)
})

/* ══════════════════════════ 12. форма результата ═══════════════════════════ */

/**
 * Код напечатанного файла без строк документации и комментариев.
 *
 * Сканировать весь текст нельзя: в @moduledoc и в комментариях законно стоит
 * проза про `Object.is` и про литерал `-0.0`, и считать её кодом значило бы
 * краснеть на объяснении вместо дефекта. Разделитель `"""` в напечатанных
 * файлах всегда парный (проверено на всех трёх файлах рантайма), поэтому куски
 * с чётным номером — это код, с нечётным — документация.
 */
function elixirCode(text) {
  const fence = '"'.repeat(3)
  return text
    .split(fence)
    .filter((piece, index) => index % 2 === 0)
    .join("\n")
    .replaceAll(/^\s*#.*$/gmu, "")
}

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
  const code = elixirCode(all)
  const modules = [...code.matchAll(/(?<![.\w])([A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*)*)\.[a-z_]+[(\s]/gu)]
    .map((match) => match[1])
  const allowed = new Set([
    "Flang", "Flang.Rt", "Flang.Error", "Flang.Cli", "Flang.Json",
    "Enum", "String", "Integer", "Float", "List", "Process", "Module", "Code", "IO", "Kernel",
  ])
  for (const name of modules) {
    assert.ok(allowed.has(name), `внешняя зависимость «${name}» в напечатанном коде недопустима`)
  }
  /* `:io` — не послабление списку, а единственный способ сделать то, чего в
     Elixir нет: снять с устройства перекодировку. `IO` — обёртка над ним и
     кодировку менять не умеет, а без этого ответ прогонщика зависел бы от
     локали хозяина (flang_cli.ex, «Кодировку протокола задаёт протокол»). Оба
     модуля — стандартная поставка OTP, зависимостей это не добавляет. */
  const erlang = [...code.matchAll(/:([a-z_]+)\.[a-z_]+\(/gu)].map((match) => match[1])
  for (const name of erlang) {
    assert.ok(["erlang", "math", "io"].includes(name), `модуль Erlang «:${name}» в напечатанном коде неожидан`)
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

/**
 * Знак нуля в напечатанном ТЕКСТЕ — единственная проверка, работающая на любой
 * версии OTP.
 *
 * До OTP 27 `-0.0 =:= 0.0` истинно, и компилятор BEAM опирается именно на это,
 * решая, что два литерала — один и тот же терм. На OTP 25 замерено: ветви
 * `if c, do: -0.0, else: 0.0` сливаются в одну, а `{:num, 0.0}` и
 * `{:num, -0.0}` становятся одним термом, отчего ветвь минус нуля в разборе
 * делается недостижимой (см. `Flang.Rt.neg_zero/0`).
 *
 * Начиная с OTP 27 знак нуля различается — и дефект ПРОПАДАЕТ С ГЛАЗ. Это и
 * есть причина, по которой здесь нужна отдельная проверка: сверка с
 * интерпретатором ловит дефект только на старой машине. Мерено изъятием на
 * OTP 29 (erts-17.0.5, Elixir 1.20.3): с `num_div`, возвращённой к
 * `do: -0.0, else: 0.0`, тест «деление на ноль даёт Infinity и NaN» остаётся
 * ЗЕЛЁНЫМ, хотя дефект в напечатанном коде есть и на OTP 25 он бы выстрелил.
 * Версия машины, где напечатанное будут собирать, нам неизвестна по
 * определению, поэтому «здесь зелено» про неё не говорит ничего.
 *
 * Отсюда правило, проверяемое ниже: в напечатанном Elixir не имеет права
 * стоять НИ ОДНОГО литерала минус нуля — ни в модуле программы, ни в трёх
 * файлах рантайма, которые печатаются байт в байт. Тулчейн для этого не нужен:
 * проверяется то, что напечатано, а не то, что собралось, — значит проверка
 * идёт и там, где Elixir не установлен вовсе.
 */
test("−0 не печатается литералом ни в одном файле Elixir: до OTP 27 его сливают с 0", () => {
  const zeroProgram = {
    flang: 1,
    module: "Знак нуля",
    functions: [
      { name: "Ноль", params: [], body: { kind: "literal", value: 0 } },
      { name: "Минус ноль", params: [], body: { kind: "literal", value: -0 } },
    ],
  }
  /* Программа с процессами берётся ради flang_conc.ex: его получает только она,
     а смотреть надо ВЕСЬ печатаемый Elixir, а не ту его часть, что попалась. */
  const concProgram = parse(
    readFileSync(fileURLToPath(new URL("../conc/examples/counter.flang", import.meta.url)), "utf8"),
    "counter.flang",
  )
  const emittedZero = emitElixir(zeroProgram)
  const checked = new Set()
  for (const file of [...emittedZero.files, ...emitElixir(concProgram).files]) {
    if (!file.path.endsWith(".ex") || checked.has(file.path)) continue
    checked.add(file.path)
    const code = elixirCode(file.content)
    /* Литерал минус нуля в любой его записи: -0.0, -0.000, -0.0e10. */
    assert.doesNotMatch(code, /-\s*0[0_]*\.0+(?:[eE][+-]?\d+)?/u,
      `${file.path}: литерал минус нуля — до OTP 27 компилятор сливает его с литералом 0.0; ` +
        "минус ноль обязан приезжать вызовом Flang.Rt.neg_zero()")
    /* И обход, на который тянет первым делом, а он не работает: свёртка
       констант считает произведение на сборке и кладёт в код тот же литерал —
       на OTP 25 это замерено. Произведению двух литералов в напечатанном коде
       взяться неоткуда, поэтому запрет ничего живого не задевает. */
    for (const folded of [/0\.0+\s*\*\s*-/u, /-\s*[\d_.]+\s*\*\s*0\.0+/u]) {
      assert.doesNotMatch(code, folded,
        `${file.path}: произведение литералов сворачивается на сборке в тот же литерал — ` +
          "минус ноль так не получить, он обязан приезжать вызовом Flang.Rt.neg_zero()")
    }
  }
  /* Зубы списку даёт не перечисление имён, а счёт: имена модулей программ —
     транслитерация, и привязка к ней красила бы этот сторож на чужой правке
     именователя. Три файла рантайма названы поимённо: их печатает бэкенд, и
     выпасть из просмотра молча они не имеют права. */
  for (const name of ["flang_runtime.ex", "flang_cli.ex", "flang_conc.ex"]) {
    assert.ok(checked.has(name), `${name} не просмотрен, а печатается — сторож обязан видеть весь Elixir`)
  }
  assert.equal(checked.size, 5, "просмотрены три файла рантайма и два модуля программ, всего пять")

  /* Ноль и минус ноль обязаны стоять в одном модуле РАЗНЫМИ формами: сливалась
     ровно эта пара, и разной её делает вызов, а не запись литерала. */
  const source = emittedZero.files
    .find((file) => file.path.endsWith(".ex") && !file.path.startsWith("flang_")).content
  assert.match(source, /\{:num, 0\.0\}/u, "ноль остаётся литералом: сливать его не с чем")
  assert.match(source, /\{:num, Flang\.Rt\.neg_zero\(\)\}/u,
    "−0 печатается вызовом: у вызова свёртке констант не за что зацепиться")

  /* И сам вызов обязан собирать значение из битов — 1 в знаке, 63 нуля. Стоило
     бы в его теле появиться литералу с плавающей точкой, и дефект вернулся бы
     туда же, откуда его убрали. */
  const runtime = emittedZero.files.find((file) => file.path === "flang_runtime.ex").content
  const neg = runtime.match(/\n {2}def neg_zero do\n(?<body>(?:.*\n)*?) {2}end\n/u)
  assert.ok(neg !== null, "Flang.Rt.neg_zero/0 обязан существовать: на нём держится знак нуля")
  assert.match(neg.groups.body, /<<value::float>> = <<1::1, 0::63>>/u,
    "минус ноль собирается из битов, а не пишется литералом")
  assert.doesNotMatch(neg.groups.body, /\d\.\d/u,
    "в теле neg_zero/0 не должно быть ни одного числа с плавающей точкой")
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
