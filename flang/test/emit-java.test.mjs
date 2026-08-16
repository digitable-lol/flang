/**
 * Печать flang → Java.
 *
 * Главный тест здесь один и он же единственный осмысленный: **сверка с
 * интерпретатором**. Кодогенератор не имеет права быть «почти правильным»:
 * либо напечатанная программа на каждом входе даёт то же значение и ту же
 * ошибку (код и текст), что `interpret.mjs`, либо результатам сгенерированного
 * кода нельзя верить вовсе.
 *
 * Поэтому каждая программа проходит полный путь пользователя: печатается в
 * ПУСТОЙ каталог, собирается настоящим `javac` ровно из того, что выдал бэкенд
 * (ни одного файла руками), и запускается настоящей JVM. Ничего не
 * подкладывается из репозитория: если бы рантайм работал только потому, что
 * лежит рядом, дыра нашлась бы у первого же пользователя, а не здесь.
 *
 * Сборка идёт под `-Xlint:all -Werror`, и это не педантизм. Напечатанный код
 * попадает в чужую сборку, где такой режим — норма, и предупреждение там
 * означает отказ. Заодно этот режим и есть здешний линтер: отдельного
 * (checkstyle, spotbugs) бэкенд от чужой машины требовать не вправе.
 *
 * Набор программ для главной сверки — не выдуманные фикстуры, а всё, что в
 * репозитории написано на самом flang: `flang/stdlib/*.flang` и
 * `flang/examples/leetcode/*.flang`. Это три десятка программ, полторы сотни
 * функций и четверть тысячи примеров; сетка входов строится из примеров и из
 * порчи их аргументов заведомо неподходящими значениями — там, где проверяются
 * коды и тексты диагностик.
 *
 * Сетка гоняется через прогонщик одним процессом на программу: запуск JVM
 * стоит сотню миллисекунд, запрос — микросекунды. Значения ездят размеченным
 * JSON — числа строкой, чтобы NaN, Infinity и −0 доехали без потерь.
 *
 * ── Чем Java отличается от Python и Go ──────────────────────────────────────
 * В Python расхождение с flang всплывает значением, потому что собирается там
 * всё. В Java половину ловит компилятор, но ровно половину: типы совпадают, а
 * семантика — нет. Поэтому отдельными тестами закрыты те места, где Java
 * расходится с языком:
 *
 *   • строка в UTF-16 против длины в кодовых точках;
 *   • Double.toString против Number::toString;
 *   • `==` для double против Object.is;
 *   • предел стека JVM против FLANG_RECURSION_LIMIT;
 *   • недостижимый оператор — ошибка компиляции, а не предупреждение (аналог
 *     того дефекта, который в C ломал сборку под -Werror неиспользованным
 *     результатом).
 *
 * ── Если JDK не найден ──────────────────────────────────────────────────────
 * Тесты, которым нужен компилятор, честно пропускаются через `missingToolchain`
 * (tools/ftsc/test/toolchain-guard.mjs). Молчаливый пропуск, выглядящий как
 * успех, недопустим: `FTS_REQUIRE_TOOLCHAINS=java` превращает пропуск в
 * падение. Тесты, которым JDK не нужен (детерминированность печати, статические
 * диагностики, форма выдачи), идут всегда.
 *
 * ── О мусоре на диске ───────────────────────────────────────────────────────
 * Всё печатается и собирается во временный каталог, который удаляется после
 * прогона: ни одного .class ни в репозитории, ни после себя.
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
import { emitJava } from "../src/emit/java.mjs"
import { findExecutable } from "../../tools/ftsc/src/toolchain.mjs"
import { missingToolchain } from "../../tools/ftsc/test/toolchain-guard.mjs"
import { черезГраницу } from "./through-entry.mjs"
import {
  functionGrid,
  loadPrograms,
  ключТочки,
  сверьУбегающих,
  ПРЕДЕЛ_УБЕГАЮЩЕЙ,
  ПРЕДЕЛЫ,
} from "./corpus-grid.mjs"

const javacBin = findExecutable("javac")
const javaBin = findExecutable("java")
const toolchain = javacBin !== null && javaBin !== null

const workdir = await mkdtemp(join(tmpdir(), "flang-emit-java-"))
after(async () => {
  await rm(workdir, { recursive: true, force: true })
})

/* Ни сети, ни пользовательских настроек: напечатанная программа ни от чего не
   зависит, и запуск обязан это доказывать. JAVA_TOOL_OPTIONS гасится намеренно
   — он умеет дописать в stdout строку «Picked up …», которая испортила бы
   протокол прогонщика. */
const JAVA_ENV = {
  ...process.env,
  JAVA_TOOL_OPTIONS: "",
  _JAVA_OPTIONS: "",
}

/* Строгий режим: напечатанный код обязан быть чистым под самым придирчивым
   javac. Именно здесь ловится недостижимый оператор — аналог дефекта
   «неиспользованный результат», который в C ломал сборку. */
const JAVAC_FLAGS = ["-encoding", "UTF-8", "-Xlint:all", "-Werror"]

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
  const emitted = emitJava(program, options)
  for (const file of emitted.files) {
    mkdirSync(dirname(join(directory, file.path)), { recursive: true })
    writeFileSync(join(directory, file.path), file.content, "utf8")
  }

  /* В каталоге не должно оказаться ничего, кроме напечатанного. */
  assert.deepEqual(listFiles(directory).sort(), emitted.files.map((file) => file.path).sort())

  const sources = emitted.files.filter((file) => file.path.endsWith(".java")).map((file) => file.path)
  const moduleFile = sources.find(
    (path) => !["Value.java", "Field.java", "FlangError.java", "Ctx.java", "Flang.java", "FlangCli.java"]
      .includes(path),
  )
  const className = moduleFile.replace(/\.java$/u, "")

  const compiled = spawnSync(javacBin, [...JAVAC_FLAGS, "-d", ".", ...sources], {
    cwd: directory,
    encoding: "utf8",
    env: JAVA_ENV,
  })
  assert.equal(
    compiled.status,
    0,
    `javac не принял напечатанное (-Xlint:all -Werror):\n${compiled.stdout}\n${compiled.stderr}`,
  )

  return {
    directory,
    emitted,
    className,
    source: emitted.files.find((file) => file.path === moduleFile).content,
    runtime: emitted.files.find((file) => file.path === "Flang.java").content,
  }
}

/**
 * Один процесс на сколько угодно запросов: запуск JVM дорог, запрос дёшев.
 *
 * `срок` — необязательный предел в миллисекундах. Он нужен там, где проверяется
 * не значение, а ЦЕНА: вопрос «предел шагов срабатывает за секунду или за
 * минуту» без срока не задать вовсе — прогонщик молча считает дальше, и тест,
 * вместо того чтобы покраснеть, просто идёт столько, сколько идёт.
 */
function ask(built, requests, срок = undefined) {
  const input = `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`
  let output
  try {
    output = execFileSync(javaBin, ["-cp", ".", "FlangCli", built.className], {
      cwd: built.directory,
      input,
      encoding: "utf8",
      env: JAVA_ENV,
      maxBuffer: 512 * 1024 * 1024,
      ...(срок === undefined ? {} : { timeout: срок, killSignal: "SIGKILL" }),
    })
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
        `собранная Java дала ${describeOutcome(byEmitted)}`,
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

test("stdlib и leetcode: собранная Java совпадает с интерпретатором", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден (ни в PATH, ни в FTS_TOOLCHAIN_PATH) — пропуск")
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
            `в предел шагов, а при ${ПРЕДЕЛ_УБЕГАЮЩЕЙ} своих шагов собранная Java дала ${describeOutcome(byEmitted)}`,
        )
        return
      }
      assert.ok(
        sameOutcome(point.byInterpreter, byEmitted),
        `${file} / «${point.name}» на входе ${JSON.stringify(point.args) ?? "?"}: ` +
          `интерпретатор дал ${describeOutcome(point.byInterpreter)}, собранная Java дала ${describeOutcome(byEmitted)}`,
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

test("примеры stdlib и leetcode сходятся у Java так же, как у интерпретатора", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
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
      assert.ok(byEmitted.ok, `${file} / «${fn.name}» / «${example.name}»: Java дала ${describeOutcome(byEmitted)}`)
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
   функция печатается обычной рекурсией Java — как и у интерпретатора, глубина
   растёт, и упереться она обязана в счётчик языка, а не в стек JVM. */
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
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

test("стек JVM не подменяет собой предел языка", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  /* Ключевой тест слоя. Стек потока JVM по умолчанию около мегабайта — на
     глубину 10⁴ кадров напечатанного кода его не хватает, а StackOverflowError
     это Error, а не диагностика. Проверяется поэтому граница: на глубине чуть
     ниже предела flang программа обязана СОСЧИТАТЬ, а чуть выше — сказать
     FLANG_RECURSION_LIMIT тем же текстом, что интерпретатор. Ни падения, ни
     StackOverflowError между этими двумя точками быть не может. */
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
    "за пределом обязана быть диагностика языка, а не StackOverflowError и не падение",
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  const built = build(treeProgram)
  /* Union-типов в Java нет, поэтому сумма типов представлена значением с тегом,
     а типизированный слой — это напечатанные конструкторы: по статическому
     методу на вариант. */
  assert.match(built.source, /public static Value v_list\(Value znachenie\) \{/u,
    "конструктор варианта «Лист» обязан быть напечатан")
  assert.match(built.source, /Value\.variant\("Лист", new Field\[\] \{/u,
    "конструктор обязан строить вариант рантайма")
  assert.match(built.source, /Value\.variantIs\([a-zA-Z0-9_]+, "Узел"\)/u,
    "разбор — это проверка дискриминанта, а не instanceof")

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

/* В ядре FTS «Значение операнда» — и вариант суммы типов, и функция. Класс Java
   — одно пространство имён, и два метода с одной сигнатурой не собираются
   вовсе; в модуле Python то же столкновение было бы молчаливым затиранием, а в
   C дало некомпилируемый код. Ровно этот дефект здесь закрыт тестом. */
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  const built = build(namesakeProgram)
  /* Три объявления с одним именем модели — три разных идентификатора. Самим
     фактом успешной сборки это уже доказано (javac не принял бы два метода с
     одной сигнатурой), но проверяется и текст: молчаливое переименование одного
     из них было бы столь же неверным. */
  assert.match(built.source, /^ {2}public static Value fn_znachenie_operanda\(Ctx ctx, Value operand\) \{$/mu)
  assert.match(built.source, /^ {2}public static Value v_znachenie_operanda\(Value znachenie\) \{$/mu)
  assert.match(built.source, /^ {2}public static Value fn_obyortka\(Ctx ctx, Value ch\) \{$/mu)
  assert.match(built.source, /^ {2}public static Value rec_obyortka\(Value znachenie\) \{$/mu)

  /* Ни одно имя не объявлено дважды: затирание — это как раз то, чего нельзя
     заметить по значению одной функции. */
  const declared = [...built.source.matchAll(/^ {2}(?:public|private) static Value ([A-Za-z_][A-Za-z_0-9]*)\(/gmu)]
    .map((match) => match[1])
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  const built = build(mutualProgram)
  assert.match(built.source, /Flang\.trampoline\(/u, "взаимная хвостовая рекурсия печатается через батут")
  assert.match(built.source, /bounce\.next = [A-Za-z0-9_]+::step_/u,
    "хвостовой вызов соседа — отскок ссылкой на метод, а не кадр стека")

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
   постоянной глубине. У Java хвостовых вызовов нет и не предвидится — именно
   поэтому хвостовой самовызов идёт в `while (true)`. */
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
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  const built = build(countdownProgram)
  assert.match(built.source, /^ +while \(true\) \{$/mu, "хвостовой самовызов обязан стать циклом")
  assert.match(built.source, /^ +continue;$/mu, "цикл обязан замыкаться на continue, а не на рекурсию")
  assert.doesNotMatch(built.source, /= fn_otschyot\(ctx/u, "самовызова остаться не должно")
  /* Ключевое для Java: после `while (true)` без break не печатается НИЧЕГО.
     Любой оператор там был бы недостижимым, а это ошибка компиляции — тот же
     дефект, который в C ломал сборку неиспользованным результатом. */
  assert.match(built.source, /continue;\n\s*\}\n\s*\}\n\s*\} finally \{/u,
    "после хвостового цикла не печатается ничего: закрылась ветвь, закрылся цикл, дальше только finally")

  const expected = (100_000 * 100_001) / 2
  /* depth = 8 — доказательство хвостовой природы вызова: без переиспользования
     кадра оба движка упёрлись бы в предел на девятом шаге. */
  const byInterpreter = interpret(countdownProgram, "Отсчёт", [100_000, 0], { maxSteps: 100_000_000, maxDepth: 8 })
  assert.equal(byInterpreter, expected)
  const [answer] = ask(built, [
    { fn: "Отсчёт", args: [encode(100_000), encode(0)], depth: "8", steps: "100000000" },
  ])
  assert.equal(answer.ok, true, `собранная Java не сосчитала 100 000 шагов: ${JSON.stringify(answer)}`)
  assert.equal(decode(answer.value), expected)

  const grid = [-1, 0, 1, 2, 7, 1000].map((value) => [value, 0])
  const points = compare(countdownProgram, built, "Отсчёт", grid, { limits: { maxSteps: 10_000_000 } })
  t.diagnostic(`100 000 шагов пройдено обоими движками; дополнительно сверено входов: ${points}`)
})

test("внутренний цикл не перехватывает continue хвостового самовызова", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
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
  /* Код и текст едут в AST данными — значит и в Java они литералы, а не знание,
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
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
  assert.doesNotMatch(built.source, /while \(true\)/u, "постусловие запрещает разворот в цикл")
  compare(program, built, "Счёт", [[0], [1], [5], [50]])
})

/* ══════════════════════════ 8. пределы ═══════════════════════════ */

test("нехвостовая рекурсия глубже предела даёт FLANG_RECURSION_LIMIT у обоих движков", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
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
 * Предел шагов, который срабатывает через минуту, — не предел.
 *
 * Улика. Точка сетки «Строить скобки» от 42 и 0 и 0 и "" и [] (её строит порча
 * аргумента в главной сверке выше) при объявленных 5 000 000 шагов упиралась в
 * предел 63,7 с. Эталон-интерпретатор на той же точке отвечает за 950 мс,
 * напечатанный C — за 1,4 с. Ловил этот дефект и главный тест выше, но ловил
 * ДОЛГИМ ОЖИДАНИЕМ, а ожидание не краснеет никогда.
 *
 * Причина была не в счётчике: тот же перебор без списка-накопителя брал те же
 * 5 000 000 шагов за доли секунды. Цена была в «добавить» — оно копировало весь
 * список на каждый вызов, и накопление n слов стоило O(n²). Один шаг стоил
 * O(длины), значит предел шагов не ограничивал РАБОТУ ничем.
 *
 * Здесь три теста, и они проверяют разное:
 *   • цену — накопление обязано быть линейным;
 *   • правильность — за постоянное время список продлевается ЗАПИСЬЮ в общий
 *     массив, и если инвариант «ячейку за концом занимает единственный» сломан,
 *     ветвление двух «добавить» от одного списка испортит оба;
 *   • ту самую точку — предел обязан срабатывать за секунды.
 * Без второго первый зеленел бы и на «добавить», которое просто портит данные.
 */

const накоплениеИсходник = [
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
].join("\n")

test("накопление списка линейно: 400 000 «добавить» — это доли секунды, а не минуты", (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  const program = parse(накоплениеИсходник, "накопление.flang")
  const built = build(program)

  /* Предел шагов снят намеренно (`steps: "0"`): здесь меряется цена ОДНОГО
     шага, и счётчик в измерение входить не должен. Хвостовой самовызов
     развёрнут в цикл, поэтому и глубина постоянна. */
  const времена = []
  for (const н of [100_000, 200_000, 400_000]) {
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

  /* Замер печатается ДО проверок, а не после: когда тест краснеет, числа нужны
     тому, кто будет чинить, а `assert` до них не доходит. */
  t.diagnostic(
    `накопление: 100 000 за ${времена[0]} мс, 200 000 за ${времена[1]} мс, 400 000 за ${времена[2]} мс`,
  )

  /* Порог с запасом в два порядка, а не «на глаз». Числа мерены здесь: до
     починки те же три точки давали 4 827, 16 086 и 41 740 мс, после — 374, 478
     и 757 мс. Между 757 и 30 000 нет ни машины помедленнее, ни отобранного
     процессора — там разница классов сложности, а не нагрузки.

     Длины взяты вдвое больше, чем у Rust и Go (там 50 000, 100 000, 200 000), и
     это не прихоть: копию массива в JVM делает System.arraycopy, и на 200 000
     квадрат успевал уложиться в те же секунды, что линия, — тест зеленел бы на
     сломанном коде. Проверено изъятием, а не предположено. */
  assert.ok(
    времена[2] < 30_000,
    `400 000 «добавить» заняли ${времена[2]} мс — это снова квадрат, а не линия`,
  )
  /* И отдельно — сама форма роста: удвоение длины обязано удваивать время, а не
     учетверять. Порог 3 (а не 2) оставлен под запуск JVM, который входит в оба
     замера целиком; квадрат даёт около 4 и здесь. */
  assert.ok(
    времена[2] < времена[1] * 3 + 100,
    `удвоение числа «добавить» подняло время с ${времена[1]} до ${времена[2]} мс — это квадратичный рост`,
  )
})

test("«добавить» за постоянное время не портит исходный список: ветвление и хвост", (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  /* Ветвление — то самое место, где приём «занять ячейку за концом» ломается,
     если инвариант неверен: «два» обязано кончаться двойкой, а не единицей,
     «четыре» — четвёркой, а не тройкой, и «основа» обязана остаться прежней.
     «Хвост» здесь не для полноты: он отдаёт суффикс, и продление такого
     суффикса не имеет права дописать в чужие ячейки. */
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
    "  пусть срез равно (хвост основа)",
    "  пусть один равно (добавить 1 к срез)",
    "  пусть два равно (добавить 2 к срез)",
    "  [основа, срез, один, два]",
    "",
  ].join("\n"), "ветвление.flang")
  const built = build(program)

  const сетка = [[[]], [[7]], [[7, 8]], [[7, 8, 9]], [[1, 2, 3, 4, 5]]]
  let points = compare(program, built, "Ветвление", сетка)
  points += compare(program, built, "Ветвление хвоста", сетка)

  /* Явные ожидания сверх сверки с эталоном: сверка ловит расхождение движков, а
     эти две строки ловят согласованную ошибку обоих — на случай, если чинить
     когда-нибудь возьмутся сразу оба. */
  const [пусто, дважды] = ask(built, [
    { fn: "Ветвление", args: [encode([])] },
    { fn: "Ветвление", args: [encode([7, 8])] },
  ])
  assert.deepEqual(decode(пусто.value), [[], [1], [2], [1, 3], [1, 4]])
  assert.deepEqual(decode(дважды.value), [[7, 8], [7, 8, 1], [7, 8, 2], [7, 8, 1, 3], [7, 8, 1, 4]])
  t.diagnostic(`ветвление «добавить» сверено на ${points} входах`)
})

test("точка сетки, на которой печать зависала: предел шагов срабатывает за секунды", (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
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
  /* Срок 30 с — это в двадцать раз больше, чем нужно после починки (1,6 с), и
     втрое меньше того, что тот же прогон брал до неё (91,3 с). Ставить сюда
     минуты бессмысленно: минута на этой точке — уже не срок, а ожидание. */
  const ответы = ask(built, запросы, 30_000)
  const мс = Date.now() - начало

  for (const ответ of ответы) {
    assert.equal(ответ.ok, false, `на этой точке обязан быть отказ по пределу: ${JSON.stringify(ответ).slice(0, 200)}`)
    assert.equal(ответ.code, "FLANG_RECURSION_LIMIT")
    assert.match(
      ответ.message,
      /^функция «Строить скобки» исчерпала лимит шагов \(5000000\) на глубине вызовов \d+$/u,
    )
  }

  /* Эталон на той же точке — тот же код отказа; текст сверяется формой, потому
     что число шагов у двух счётчиков разное по построению (см. ПРЕДЕЛЫ). */
  const эталон = outcome(() => interpret(найдено.program, "Строить скобки", [42, 0, 0, "", []], ПРЕДЕЛЫ))
  assert.equal(эталон.ok, false)
  assert.equal(эталон.code, "FLANG_RECURSION_LIMIT")

  t.diagnostic(`обе точки упёрлись в предел за ${мс} мс на двоих (было: 63 660 мс на одной)`)
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
   «мир 🌍» это 6 единиц UTF-16, в Go — 8 байт, и в Java ровно те же 6 единиц,
   что в JS, — а надо 5. Это главное расхождение строкового слоя, и проверяется
   оно именно здесь. */
const texts = ["", "привет", "мир 🌍", "ёжик", "a", "😀😀", "\u{1F600}абв", "  42  ", "3.5e2", "не число", "да",
  "  7  ", "ЁЖИК"]
const indices = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 1.5, 100]

/*
 * Стоимость взятия по номеру — вопрос, который нельзя решить чтением кода.
 *
 * Форма `элемент N в СПИСОК` обещает ЗНАЧЕНИЕ, а не стоимость: у восьми целей
 * разные структуры данных, и «быстро» верно не для всех. Проход по номеру
 * сверху вниз делает ровно n взятий, поэтому работа всего прохода — это n·(цена
 * одного взятия). Удвоив n, получаем ответ прямо: работа выросла вдвое —
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

/*
 * Свидетель: тот же проход, но взятие разложено ОБХОДОМ на самом языке — до
 * н-го номера идёт счётчик, шаг за шагом, и только потом берётся значение.
 *
 * Он здесь не ради сравнения скоростей, а чтобы порог ниже нельзя было принять
 * на слово: проверка, которая не умеет упасть, выглядит ровно как проверка, у
 * которой всё хорошо. Свидетель обязан порог перейти — n обходов по н шагов
 * стоят n·n, то есть вчетверо на удвоении вместо вдвое.
 *
 * Обход СЧИТАЕТ, а не разбирает список звено за звеном: у Java «хвост» — копия,
 * и обход звеньями стоил бы n³ работы там, где для доказательства хватает n².
 * Витков языка при этом ровно столько же — н на одно взятие, — а меряются здесь
 * именно витки.
 */
const обходИсточник = [
  "модуль «Обход»",
  "",
  "функция «Элемент обходом»",
  "  принимает н: число, элементы: список числа, осталось: число",
  "  возвращает число",
  "  если осталось не больше 0",
  "    то элемент н в элементы",
  "    иначе «Элемент обходом» от н и элементы и (осталось минус 1)",
  "",
  "функция «Сумма обходом»",
  "  принимает элементы: список числа, н: число, акк: число",
  "  возвращает число",
  "  если н не больше 0",
  "    то акк",
  "    иначе «Сумма обходом» от элементы и (н минус 1) и (акк плюс («Элемент обходом» от н и элементы и н))",
].join("\n")

/**
 * Наименьший бюджет шагов, при котором запрос ещё доходит до ВЕРНОГО ответа, —
 * поиском по бюджету напечатанного прогонщика.
 *
 * Это замер, но не по часам: число выходит целое и одно и то же на загруженной
 * машине и на пустой. Раньше здесь стояло время в миллисекундах, и порога по
 * нему поставить было нельзя — на общей машине оно шумит вдвое, а запуск JVM на
 * малых n больше самой работы, — поэтому порога не стояло вовсе, и утверждение
 * «удвоение n удваивает время» жило только в имени теста.
 *
 * Сам факт, что граница НАХОДИТСЯ, доказывает, что счётчик шагов работает:
 * иначе запрос доходил бы при любом бюджете и поиск не сошёлся бы.
 *
 * Ищется пачкой: один запуск JVM проверяет сразу лестницу бюджетов, а запуск
 * дорог — запрос дёшев.
 */
function минимумШагов(built, запрос, ожидание) {
  const годны = (бюджеты) =>
    ask(built, бюджеты.map((бюджет) => ({ ...запрос, steps: String(бюджет) })))
      .map((ответ) => ответ.ok === true && decode(ответ.value) === ожидание)

  const лестница = []
  for (let бюджет = 1; бюджет <= 1 << 24; бюджет *= 2) лестница.push(бюджет)
  const ступень = годны(лестница).findIndex(Boolean)
  assert.ok(ступень >= 0, "бюджета в 16 миллионов шагов не хватило: проход не доходит вовсе")
  let низ = ступень === 0 ? 0 : лестница[ступень - 1]
  let верх = лестница[ступень]
  while (верх - низ > 1) {
    const шаг = Math.max(1, Math.floor((верх - низ) / 32))
    const сетка = []
    for (let бюджет = низ + шаг; бюджет < верх; бюджет += шаг) сетка.push(бюджет)
    if (сетка.length === 0) break
    const годен = годны(сетка)
    const первый = годен.findIndex(Boolean)
    if (первый === -1) низ = сетка[сетка.length - 1]
    else {
      верх = сетка[первый]
      низ = первый === 0 ? низ : сетка[первый - 1]
    }
  }
  return верх
}

test("стоимость взятия по номеру: массив, значит удвоение n удваивает работу", (t) => {
  if (!javaBin) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  const built = build(indexCostProgram)
  assert.match(built.source, /bElement\(/u, "взятие по номеру обязано печататься вызовом формы")

  /* ДОКАЗАТЕЛЬСТВО, а не замер: у формы в напечатанном рантайме нет обхода
     вовсе — номер превращается в индекс массива. Никакой замер этого не даёт:
     он говорит про один компилятор на одной машине, а эти три строки — про
     всякий. Сменят массив на звенья — упадёт здесь и сразу, а не замедлится
     молча. */
  const тело = /static Value bElement\([^)]*\)\s*\{([\s\S]*?)\n  \}/u.exec(built.runtime)?.[1]
  assert.ok(тело !== undefined, "в напечатанном рантайме не нашлось тела bElement")
  assert.match(тело, /return Value\.at\(list, \(int\) at\);/u, "взятие обязано быть индексом массива")
  assert.doesNotMatch(тело, /\b(for|while|goto)\b/u, "во взятии по номеру появился обход — форма перестала быть постоянной")

  /* Проверка идёт на ОДИН уровень ниже, и без этого она стала бы пустой. С тех
     пор как у списка есть общий массив с запасом («добавить» за постоянное
     время), сам индекс живёт в `Value.at`, а `bElement` только считает границы.
     Смотреть на один `bElement` значило бы разрешить спрятать обход этажом
     ниже — ровно тот способ протухнуть молча, ради которого этот тест и стоит
     исходником, а не замером. */
  const valueJava = built.emitted.files.find((файл) => файл.path === "Value.java")?.content
  assert.ok(valueJava !== undefined, "в напечатанном не нашлось Value.java")
  const телоAt = /static Value at\(Value list, int index\) \{([\s\S]*?)\n  \}/u.exec(valueJava)?.[1]
  assert.ok(телоAt !== undefined, "в Value.java не нашлось тела at")
  assert.match(телоAt, /return list\.items\[index\];/u, "Value.at обязан быть индексом массива")
  assert.doesNotMatch(телоAt, /\b(for|while|goto)\b/u, "в Value.at появился обход — массив сменили на звенья")

  /* ЗАМЕР в шагах — и он проверяет НЕ то же, что проверка выше, поэтому стоят
     обе. Счётчик шагов считает витки самой программы и внутрь формы не смотрит:
     обход, спрятанный в рантайме, он не увидит (его видит проверка выше, по
     исходнику). Зато он видит то, чего не видит исходник, — что проход по n
     номерам стоит n витков, а не n·n: то есть взятие происходит ВНУТРИ витка, а
     не разложено обходом на самом языке. Свидетель ниже показывает, во что
     обошёлся бы второй случай. */
  const шагиФормы = (длина) =>
    минимумШагов(
      built,
      { fn: "Сумма по номеру", args: [encode(Array.from({ length: длина }, (_, номер) => номер + 1)), encode(длина), encode(0)], depth: "8" },
      (длина * (длина + 1)) / 2,
    )
  const форма = [шагиФормы(2000), шагиФормы(4000)]
  const ростФормы = форма[1] / форма[0]

  /* Повтор того же замера обязан дать ТО ЖЕ ЦЕЛОЕ. Это и есть ответ на вопрос,
     почему порог ниже не даст ложного красного при чужой нагрузке: замеряется
     не то, сколько времени машина смогла уделить, а сколько витков программа
     потребовала, — а это от загрузки машины не зависит вовсе. */
  assert.equal(шагиФормы(2000), форма[0], "тот же замер дал другое число: счётчик шагов перестал быть детерминированным")

  /* Значение прежде всего: постоянная цена ничего не стоит, если ответ неверен.
     Сверяется на входе вдесятеро больше того, на котором мерились шаги. */
  const n = 40_000
  const начало = Date.now()
  const [ответ] = ask(built, [
    { fn: "Сумма по номеру", args: [encode(Array.from({ length: n }, (_, номер) => номер + 1)), encode(n), encode(0)], depth: "8" },
  ])
  const мс = Date.now() - начало
  assert.equal(ответ.ok, true, JSON.stringify(ответ))
  assert.equal(decode(ответ.value), (n * (n + 1)) / 2)

  const свидетель = build(parse(обходИсточник))
  const шагиОбхода = (длина) =>
    минимумШагов(
      свидетель,
      { fn: "Сумма обходом", args: [encode(Array.from({ length: длина }, (_, номер) => номер + 1)), encode(длина), encode(0)], depth: "16" },
      (длина * (длина + 1)) / 2,
    )
  const обход = [шагиОбхода(200), шагиОбхода(400)]
  const ростОбхода = обход[1] / обход[0]

  t.diagnostic(`формой: ${форма[0]} шагов на 2000 номерах, ${форма[1]} на 4000 — рост ×${ростФормы.toFixed(2)}`)
  t.diagnostic(`обходом: ${обход[0]} шагов на 200, ${обход[1]} на 400 — рост ×${ростОбхода.toFixed(2)}`)
  t.diagnostic(`формой на ${n} номерах (Java): ${мс} мс — время печатается, но не утверждается: оно шумит`)

  assert.ok(
    ростФормы < 2.5,
    `удвоение n подняло работу формы в ${ростФормы.toFixed(2)} раза (${форма[0]} → ${форма[1]}): ` +
      "взятие по номеру перестало быть постоянным",
  )
  assert.ok(
    ростОбхода > 3.5,
    `свидетель вырос всего в ${ростОбхода.toFixed(2)} раза (${обход[0]} → ${обход[1]}): ` +
      "порог выше нечем перейти, значит он ничего не проверяет",
  )
})

test("строковые формы: кириллица, суррогатные пары и границы индексов", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  /* Единственное место, где Java расходится со строкой flang по построению:
     String — это UTF-16, «😀😀».length() там 4, а кодовых точек 2. Кириллица
     разницы не даёт вовсе, поэтому проверять надо именно эмодзи. */
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  const built = build(stringProgram, { indexBase: 0 })
  assert.match(built.source, /ctx\.indexBase = 0;/u)
  const grid = []
  for (const index of indices) for (const text of texts) grid.push([index, text])
  compare(stringProgram, built, "Символ", grid, { limits: { indexBase: 0 } })
})

/*
 * Двунаправленные управляющие символы в литерале.
 *
 * Таблица блоков лексера (flang/self/lexer.flang) перечисляет весь блок
 * U+2000…U+207F подряд, и одиннадцать из них — двунаправленные управляющие.
 * Напечатанные сырыми, они переставляют текст при показе: напечатанный файл
 * читается не так, как исполняется, — «Trojan Source» (CVE-2021-42574).
 *
 * У Java здесь худший из возможных исходов: javac собирает такой файл МОЛЧА,
 * даже под `-Xlint:all -Werror`, и выдаёт ровно то, ради чего атаку и придумали.
 * Никакой ключ этого не ловит, поэтому единственная защита — не печатать их
 * сырыми, и проверять это обязан тест.
 *
 * Экранирование `\uXXXX` обязано убрать сырой символ, НЕ меняя значения: та же
 * кодовая точка, та же длина. Второе тут не формальность — `\uXXXX` в Java
 * разворачивается ещё до лексера (JLS 3.3), и ошибка в форме дала бы не отказ
 * сборки, а другую строку.
 *
 * Общая проверка на все восемь целей сразу — в flang/test/emit-bidi.test.mjs;
 * здесь то, чего та проверить не может: настоящий javac и настоящая JVM.
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

test("двунаправленные управляющие экранируются: javac собирает, значение то же", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  const program = parse(bidiSource)
  const built = build(program)

  const all = built.emitted.files.map((file) => file.content).join("\n")
  const raw = [...all].filter((character) => BIDI_CONTROLS.includes(character.codePointAt(0)))
  assert.equal(raw.length, 0, "в напечатанной Java не может быть сырых двунаправленных управляющих")

  /* `\uXXXX` — единственная форма, которой Java может выразить эту кодовую
     точку: `\xNN` язык не знает, а восьмеричные кончаются на \377. */
  assert.match(built.source, /\\u202e/u, "U+202E обязан приехать как \\u202e")

  /* Главное: значение не изменилось — те же кодовые точки, та же длина. */
  const points = compare(program, built, "Метка", [[]]) + compare(program, built, "Длина метки", [[]])
  assert.equal(points, 2)
})

/* ══════════════════════════ 10. числа и равенство ═══════════════════════════ */

test("порядок вычисления строго слева направо: первая ошибка — левая", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
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
           ошибка. Это ровно то место, где выражение Java пришлось бы
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  /* Деление на ноль Java даёт даром — в отличие от Python, где оно возбуждает
     исключение. А вот равенство даром не даётся: `==` для double считает NaN не
     равным NaN и 0 равным −0 — обе половины наоборот относительно Object.is. */
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

  const [infinity, minus, nothing] = ask(built, [
    { fn: "Делить", args: [encode(1), encode(0)] },
    { fn: "Делить", args: [encode(1), encode(-0)] },
    { fn: "Делить", args: [encode(0), encode(0)] },
  ])
  assert.equal(decode(infinity.value), Infinity, "деление на ноль обязано дать Infinity, а не ошибку")
  assert.equal(decode(minus.value), -Infinity, "знак нуля-делителя обязан доехать до знака бесконечности")
  assert.ok(Number.isNaN(decode(nothing.value)), "ноль на ноль обязан дать NaN")

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
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  /* Литерал `2` в Java — это int, и `2 / 3` посчиталось бы целочисленно. Число
     flang — всегда IEEE-754 double, поэтому суффикс `d` обязателен, а NaN и
     бесконечности литералом не записываются вовсе. */
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
  assert.match(built.source, /Value\.number\(1\.0d\)/u, "целое обязано печататься double-литералом")
  assert.match(built.source, /Value\.number\(Double\.NaN\)/u)
  assert.match(built.source, /Value\.number\(-0\.0d\)/u)
  assert.match(built.source, /Value\.number\(1e\+21d\)/u)
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  /* Double.toString даёт «1.0» там, где нужно «1», и «1.0E21» там, где нужно
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  /* Ни в stdlib, ни в leetcode образцов-литералов нет — там встречаются только
     «пусто», «голова и хвост» и варианты. Значит этот путь печати главная
     сверка не проходит вовсе, и проверять его надо отдельно. Заодно здесь живут
     строки, которые обязаны пережить экранирование в литерале Java: кавычка,
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
  assert.match(built.source, /Value\.equal\([a-zA-Z0-9_]+, Value\.number\(0\.0d\)\)/u,
    "образец-литерал — это сравнение значений")
  assert.match(built.source, /Value\.variant\("Есть", new Field\[\] \{/u,
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
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
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  /* Java запрещает повторно объявить локальное имя во вложенном блоке — в
     отличие от C и Python, где это законное затенение. Значит два «пусть х»
     подряд обязаны получить разные идентификаторы, иначе класс не соберётся. */
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

test("связанное, но неиспользованное имя вычисляться не перестаёт", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  /* «случай голова и хвост», где голова телу не нужна, — обычное дело. В Go это
     ошибка сборки, в C под -Werror тоже, и оба бэкенда такое имя гасят. javac
     неиспользованную локальную переменную не замечает даже под -Xlint:all
     -Werror, поэтому гасить нечего — но выбрасывать связывание всё равно
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
  assert.match(built.source, /Value zn = Flang\.variantField\(ctx, [a-z_0-9]+, "значение"\);/u,
    "неиспользованная привязка обязана остаться и вычисляться")

  compare(program, built, "Считать", [[[]], [[1, 2, 3]], ["не список"]])
  /* Поля нет — значит ошибка, а не «случай не подошёл»: связывание вычисляется
     даже тогда, когда его результат никому не нужен. */
  compare(program, built, "Единица", [
    [variant("Есть", { "значение": 1 })],
    [variant("Есть", {})],
    [42],
  ])
})

test("функция без единого возврата в хвосте собирается: аналог дефекта «неиспользованный результат»", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  /* Функция, у которой ВСЕ хвостовые позиции — самовызов, ни разу не пишет в
     результат и никогда не возвращается нормально. В C под -Werror это ломало
     сборку неиспользованной переменной результата; в Java аналог строже —
     недостижимый оператор после `while (true)` это ошибка компиляции. Здесь
     закрыты оба конца: и чисто хвостовая функция, и чисто отскакивающая. */
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
  /* Сам факт успешной сборки под -Xlint:all -Werror и есть проверка. */
  const built = build(program)
  assert.match(built.source, /^ +while \(true\) \{$/mu)
  assert.match(built.source, /bounce\.next = [A-Za-z0-9_]+::step_/u)
  /* Сразу за `continue` закрывается цикл, а за ним — только finally: ни
     возврата, ни объявления результата после хвостового цикла быть не может,
     любой такой оператор был бы недостижимым. */
  assert.match(built.source, /continue;\n\s*\}\n\s*\} finally \{/u)
  assert.doesNotMatch(built.source, /continue;\n\s*\}\n\s*(?:return|Value |throw)/u)

  /* Обе функции незавершающиеся — обе обязаны упереться в лимит шагов, а не
     сорвать стек и не собраться в код, который javac отверг бы. */
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
  const весь = emitJava(program).files.map((file) => file.content).join("")
  return (весь.match(/FLANG_MEASURE/gu) ?? []).length
}

test("сторож меры ПОЯВЛЯЕТСЯ в напечатанной Java, а не теряется обеими сторонами", () => {
  /* Главная сверка двусторонняя, и этим слепа: снятая отметка теряется ОБЕИМИ
     сторонами разом. Интерпретатор зовёт то же понижение, и на непомеченной
     программе он досчитает ровно то, что досчитает непомеченная Java, — сверка
     останется зелёной, а сторожа не будет ни у кого. Поэтому здесь проверяется
     не совпадение, а ПОЯВЛЕНИЕ: без него изъятие отметки покрасило бы только
     статическую улику, а главный тест смолчал бы. */
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

test("сторож меры: отказ у собранной Java дословно тот же, что у интерпретатора", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
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
  assert.match(built.source, /FLANG_MEASURE/u, "сторож не доехал до напечатанной Java")

  const points = compare(program, built, "До нуля", [
    [0], [1], [7], [2.5], [-3],
    [18014398509481988], [1e308], [Infinity], [-Infinity], [NaN],
  ])

  /* Отказ обязан ПРИЙТИ С МАШИНЫ, а не только совпасть: на 2⁵⁴+4 шаг ничего не
     меняет, и собранная Java обязана отказать шестым видом. */
  const [ответ] = ask(built, [{ fn: "До нуля", args: [encode(18014398509481988)] }])
  assert.equal(ответ.ok, false, "на входе, где мера не убывает, собранная Java обязана отказать")
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

test("сторож объявленной меры ПОЯВЛЯЕТСЯ в напечатанной Java всеми тремя условиями", () => {
  /* Довод тот же, что у сторожа постоянного шага, и здесь он весомее: условий
     ТРИ, живут они в общем понижении, и снятие любого теряют ОБЕ стороны разом.
     Убери проверку целости — интерпретатор и собранная Java согласно закрутят
     Евклида на дробной мере, сверка останется зелёной, а обещание «тотальная»
     станет ложным. Поэтому проверяется ПОЯВЛЕНИЕ, и по тексту на условие. */
  assert.equal(упоминанийМеры(parse(descentSource)), 0,
    "у голого разбора сторожа объявленной меры нет вовсе — иначе улика ниже ничего не значит")
  assert.equal(упоминанийМеры(markMeasureGuards(parse(descentSource))), 3,
    "у сторожа объявленной меры три постусловия — по одному на условие")

  const весь = emitJava(markMeasureGuards(parse(descentSource))).files.map((file) => file.content).join("")
  for (const условие of [/не убыла/u, /ушла ниже нуля/u, /перестала быть целой/u]) {
    assert.match(весь, условие, `условие сторожа не доехало до напечатанной Java: ${условие}`)
  }
})

test("сторож объявленной меры: отказ у собранной Java дословно тот же, что у интерпретатора", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  const program = markMeasureGuards(parse(descentSource))
  const built = build(program)
  assert.match(built.source, /FLANG_MEASURE/u, "сторож объявленной меры не доехал до напечатанной Java")

  const points = compare(program, built, "НОД", descentGrid)

  /* Отказ обязан ПРИЙТИ С МАШИНЫ, а не только совпасть: совпадение отказов двух
     движков, взявших текст из одного поля AST, доказывает согласие, а не
     срабатывание.

     УСЛОВИЙ С МАШИНЫ ДВА, А НЕ ТРИ, И ПРИЧИНА НАЗВАНА. Третье — «мера не
     убыла» — свидетелей имеет только среди ±∞ и NaN: у `НОД` мера это `б`, а
     `а остаток от б` при конечных числах по модулю всегда меньше `б`. В JSON
     ни ∞, ни NaN не представимы, `Infinity` уезжает в прогонщик как `null`, и
     ГРАНИЦА ВХОДА (`work/entry-types-113`, `work/emit-entry-types`) отвергает
     его `FLANG_TYPE` ДО вычисления — то есть делает ровно то, ради чего
     заведена. Требовать здесь `FLANG_MEASURE` значило бы требовать, чтобы
     граница входа пропускала значение вне типа.

     Третье условие при этом НЕ БЕЗ ПРОВЕРКИ: оно стоит в `descentGrid` и
     сверяется с эталоном строкой `compare` выше (обе стороны обязаны дать один
     ответ), а его текст обязан присутствовать в напечатанном коде — это
     проверяет соседний тест «три условия доехали до напечатанного». Не
     проверено ровно одно: что именно ЭТО условие срабатывает на машине, и
     проверить это через JSON-прогонщик нечем. */
  const [дробная, ниже] = ask(built, [
    { fn: "НОД", args: [encode(1071.5), encode(462)] },
    { fn: "НОД", args: [encode(-10), encode(3)] },
  ])
  for (const [ответ, условие] of [[дробная, /перестала быть целой/u], [ниже, /ушла ниже нуля/u]]) {
    assert.equal(ответ.ok, false, `на входе без спуска собранная Java обязана отказать: ${условие}`)
    assert.equal(ответ.code, "FLANG_MEASURE", `с машины пришёл ${ответ.code}, а не шестой вид отказа`)
    assert.match(ответ.message, условие, `с машины пришёл не тот текст: ${ответ.message}`)
  }
  t.diagnostic(`сверенных входов: ${points}, условий с машины: 2 из 3 (третьему нет свидетеля в JSON)`)
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

test("сторож частичной формы: все восемь форм отказывают у Java кодом и текстом эталона", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
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
    assert.equal(ответ.ok, false, `«${форма}»: Java не отказал там, где отказал эталон`)
    assert.equal(ответ.code, "FLANG_BUILTIN_ARGS", `«${форма}»: с машины пришёл ${ответ.code}`)
    assert.equal(ответ.code, эталон.code, `«${форма}»: код разошёлся с эталоном`)
    assert.equal(ответ.message, эталон.message, `«${форма}»: текст с машины разошёлся с эталоном`)
  })
  t.diagnostic(`частичных форм с машины: ${ЧАСТИЧНЫЕ_ВХОДЫ.size}`)
})

/* ══════════════════════════ 12. форма результата ═══════════════════════════ */

test("детерминированность: две печати дают побайтово одно и то же", () => {
  const list = [listProgram, treeProgram, mutualProgram, countdownProgram, stringProgram, namesakeProgram,
    parse(flangSource)]
  for (const { program } of programs) list.push(program)
  for (const program of list) {
    const first = emitJava(program)
    const second = emitJava(program)
    assert.deepEqual(first, second)
    /* И ещё раз после кругосветки через JSON: вывод не зависит от того, откуда
       приехал AST. */
    const third = emitJava(JSON.parse(JSON.stringify(program)))
    assert.deepEqual(first, third)
  }
})

test("напечатанная Java ни от чего не зависит и объясняет себя", () => {
  const emitted = emitJava(treeProgram)
  const all = emitted.files.map((file) => file.content).join("\n")
  /* Только JDK и собственный рантайм программы: ни одной внешней зависимости,
     поэтому ни pom.xml, ни build.gradle не нужны — хватает `javac *.java`.
     Импортов нет вовсе: всё лежит в безымянном пакете и пишется полным именем
     там, где это java.util. */
  assert.doesNotMatch(all, /^import /mu, "ни одного import: всё видно в безымянном пакете")
  const packages = [...all.matchAll(/\bjava\.([a-z]+)\.[A-Z]/gu)].map((match) => match[1])
  const allowed = new Set(["util", "io", "math", "lang", "nio"])
  for (const name of packages) {
    assert.ok(allowed.has(name), `внешняя зависимость «java.${name}» в напечатанном коде неожиданна`)
  }
  assert.doesNotMatch(all, /System\.currentTimeMillis|\bRandom\b|System\.getenv|ProcessBuilder/u,
    "ни времени, ни случайности, ни окружения")
  assert.deepEqual(emitted.files.map((file) => file.path).sort(), [
    "Ctx.java",
    "Derevya.java",
    "Field.java",
    "Flang.java",
    "FlangCli.java",
    "FlangError.java",
    "Makefile",
    "Value.java",
  ])
  const source = emitted.files.find((file) => file.path === "Derevya.java").content
  assert.match(source, /^\/\/ Сгенерировано flang \(бэкенд Java/u)
  assert.match(source, /Не редактировать руками/u)
  /* Имена flang сохраняются рядом с каждым типом и каждой функцией. */
  assert.match(source, /Функция flang «Сумма дерева»/u)
  assert.match(source, /Вариант «Лист» суммы типов «Дерево»/u)
  /* Рантайм печатается байт в байт из репозитория. */
  for (const name of ["Value.java", "Field.java", "FlangError.java", "Ctx.java", "Flang.java"]) {
    const onDisk = readFileSync(fileURLToPath(new URL(`../src/emit/java/${name}`, import.meta.url)), "utf8")
    const printed = emitted.files.find((file) => file.path === name).content
    assert.ok(printed.endsWith(onDisk), `${name} обязан печататься без правок, только с шапкой`)
  }
})

test("без прогонщика печатается одна библиотека", () => {
  const emitted = emitJava(listProgram, { cli: false })
  assert.deepEqual(emitted.files.map((file) => file.path).sort(), [
    "Ctx.java",
    "Field.java",
    "Flang.java",
    "FlangError.java",
    "Makefile",
    "Spiski.java",
    "Value.java",
  ])
})

/* ══════════════════════════ 13. ошибки печати ═══════════════════════════ */

test("статические ошибки ловятся при печати, а не в собранной программе", () => {
  const wrongArity = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "builtin", name: "длина", args: [] } }],
  }
  assert.throws(() => emitJava(wrongArity), (error) => {
    assert.equal(errorCode(error), "FLANG_BUILTIN_ARGS")
    assert.equal(error.message, "«длина» ожидает 1 аргумент, получено 0")
    return true
  })

  const unknownName = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "var", name: "неизвестное" } }],
  }
  assert.throws(() => emitJava(unknownName), (error) => {
    assert.equal(errorCode(error), "FLANG_UNKNOWN_NAME")
    assert.equal(error.message, "имя «неизвестное» не связано")
    return true
  })

  const unknownCall = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "call", name: "Нет такой", args: [] } }],
  }
  assert.throws(() => emitJava(unknownCall), (error) => errorCode(error) === "FLANG_UNKNOWN_NAME")

  /* «Сумма» и «сумма» — разные имена модели, но один идентификатор Java. */
  const collision = {
    flang: 1,
    functions: [
      { name: "Сумма", params: [], body: { kind: "literal", value: 1 } },
      { name: "сумма", params: [], body: { kind: "literal", value: 2 } },
    ],
  }
  assert.throws(() => emitJava(collision), /идентификатор/u)

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
  assert.throws(() => emitJava(variantCollision), /идентификатор/u)

  /* Модуль, чьё имя заняло бы класс рантайма. */
  const shadowRuntime = {
    flang: 1,
    module: "flang error",
    functions: [{ name: "Ф", params: [], body: { kind: "literal", value: 1 } }],
  }
  assert.throws(() => emitJava(shadowRuntime), /рантайм/u)
})

test("имена, опасные для Java, печать переживают: ключевые слова и имена бэкенда", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  /* Приставка роли снимает целый класс столкновений: функция, названная «call»
     или «new context», не спорит с тем, что печатает сам бэкенд. Локальные же
     имена приставки не несут, и там опасность настоящая: параметр «class» —
     ключевое слово, после которого файл вообще не разберётся, а «String» и
     «Value» затенили бы типы, которыми пользуется каждая строка. */
  const program = {
    flang: 1,
    module: "Опасные",
    functions: [
      {
        name: "call",
        params: [{ name: "class" }, { name: "final" }],
        body: {
          kind: "binary",
          op: "add",
          left: { kind: "var", name: "class" },
          right: { kind: "var", name: "final" },
        },
      },
      {
        name: "String",
        params: [{ name: "Value" }],
        body: { kind: "builtin", name: "к строке", args: [{ kind: "var", name: "Value" }] },
      },
      { name: "new context", params: [], body: { kind: "literal", value: 1 } },
    ],
  }
  const built = build(program)
  assert.match(built.source, /^ {2}public static Value fn_call\(Ctx ctx, /mu,
    "имя «call» не спорит с диспетчером бэкенда")
  assert.match(built.source, /^ {2}public static Value fn_new_context\(Ctx ctx\) \{$/mu)
  assert.doesNotMatch(built.source, /\(Ctx ctx, Value Value\)/u, "параметр не имеет права затенить тип Value")
  assert.match(built.source, /^ {2}public static Value call\(Ctx ctx, String name, Value\[\] args\) \{$/mu,
    "диспетчер бэкенда остаётся на месте")

  compare(program, built, "call", [[1, 2], ["строка", 2]])
  compare(program, built, "String", [[1], [true], [null], [[1]]])
  compare(program, built, "new context", [[]])
})

/* ══════════════════════════ 14. тулчейн ═══════════════════════════ */

test("тулчейн Java: версия записывается в отчёт, отсутствие — честный пропуск", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  const version = execFileSync(javacBin, ["-version"], { encoding: "utf8", env: JAVA_ENV }).trim()
  t.diagnostic(`${version}; сборка идёт под ${JAVAC_FLAGS.join(" ")}`)
  assert.match(version, /^javac \d+/u)
  const major = Number(version.replace(/^javac (\d+).*$/su, "$1"))
  assert.ok(major >= 17, `нужен JDK 17 или новее, найден ${version}`)
})

test("Makefile — рабочая сборка, а не украшение", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  const makeBin = findExecutable("make")
  if (!makeBin) {
    t.diagnostic("make не найден — проверка Makefile пропущена (сборка проверена прямым вызовом javac)")
    return
  }
  /* Печатается в свежий каталог: `make` обязан собрать напечатанное сам, без
     единого ключа от пользователя. */
  serial += 1
  const directory = join(workdir, `make${serial}`)
  mkdirSync(directory, { recursive: true })
  for (const file of emitJava(treeProgram).files) {
    writeFileSync(join(directory, file.path), file.content, "utf8")
  }
  const made = spawnSync(makeBin, ["build"], { cwd: directory, encoding: "utf8", env: JAVA_ENV })
  assert.equal(made.status, 0, `make build не собрал напечатанное:\n${made.stdout}\n${made.stderr}`)
  assert.ok(listFiles(directory).some((path) => path.endsWith(".class")), "make обязан оставить .class")
})
