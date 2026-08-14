/**
 * Печать flang → C#.
 *
 * Главный тест здесь один и он же единственный осмысленный: **сверка с
 * интерпретатором**. Кодогенератор не имеет права быть «почти правильным»:
 * либо напечатанная программа на каждом входе даёт то же значение и ту же
 * ошибку (код и текст), что `interpret.mjs`, либо результатам сгенерированного
 * кода нельзя верить вовсе.
 *
 * Поэтому каждая программа проходит полный путь пользователя: печатается в
 * ПУСТОЙ каталог, собирается настоящим `dotnet build` ровно из того, что выдал
 * бэкенд (ни одного файла руками), и запускается настоящей средой. Ничего не
 * подкладывается из репозитория: если бы рантайм работал только потому, что
 * лежит рядом, дыра нашлась бы у первого же пользователя, а не здесь.
 *
 * Сборка идёт под `TreatWarningsAsErrors` и `Nullable=enable` — это записано в
 * напечатанном flang.csproj, а не в ключах теста, потому что режим сборки
 * такая же часть выдачи, как и сам код. Заодно этот режим и есть здешний
 * линтер: отдельного (StyleCop, Roslynator) бэкенд от чужой машины требовать не
 * вправе.
 *
 * Набор программ для главной сверки — не выдуманные фикстуры, а всё, что в
 * репозитории написано на самом flang: `flang/stdlib/*.flang` и
 * `flang/examples/leetcode/*.flang`. Это три десятка программ, полторы сотни
 * функций и четверть тысячи примеров; сетка входов строится из примеров и из
 * порчи их аргументов заведомо неподходящими значениями — там, где проверяются
 * коды и тексты диагностик.
 *
 * Сетка гоняется через прогонщик одним процессом на программу: запуск среды
 * стоит десятки миллисекунд, запрос — микросекунды. Значения ездят размеченным
 * JSON — числа строкой, чтобы NaN, Infinity и −0 доехали без потерь.
 *
 * ── Где C# расходится с языком ──────────────────────────────────────────────
 * Половину расхождений ловит компилятор, но ровно половину: типы совпадают, а
 * семантика — нет. Поэтому отдельными тестами закрыты те места, где C#
 * расходится с flang:
 *
 *   • строка в UTF-16 против длины в кодовых точках;
 *   • double.ToString() против Number::toString (и разделитель дробной части,
 *     зависящий от культуры);
 *   • `==` для double против Object.is;
 *   • decimal, который для предметной области выглядит правильным, а для flang
 *     неверен: нет ни NaN, ни бесконечностей, база 10 вместо IEEE-754;
 *   • предел стека против FLANG_RECURSION_LIMIT — и здесь C# строже всех:
 *     StackOverflowException в .NET не ловится вовсе и убивает процесс;
 *   • недостижимый код (CS0162) — предупреждение, то есть под
 *     TreatWarningsAsErrors отказ сборки; это аналог того дефекта, который в C
 *     ломал сборку неиспользованным результатом.
 *
 * ── Если тулчейна .NET нет ──────────────────────────────────────────────────
 * Тесты, которым нужен компилятор, честно пропускаются через `missingToolchain`
 * (tools/ftsc/test/toolchain-guard.mjs). Молчаливый пропуск, выглядящий как
 * успех, недопустим: `FTS_REQUIRE_TOOLCHAINS=csharp` превращает пропуск в
 * падение, а каталог с `dotnet` вне PATH указывается в `FTS_TOOLCHAIN_PATH`.
 * Тесты, которым тулчейн не нужен (детерминированность печати, статические
 * диагностики, форма выдачи), идут всегда.
 *
 * ── О мусоре на диске ───────────────────────────────────────────────────────
 * Всё печатается и собирается во временный каталог, который удаляется после
 * прогона. Кэш пакетов и домашний каталог CLI тоже уводятся туда: ни одного
 * байта ни в репозитории, ни в домашнем каталоге пользователя.
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
import { emitCsharp } from "../src/emit/csharp.mjs"
import { findExecutable } from "../../tools/ftsc/src/toolchain.mjs"
import { missingToolchain } from "../../tools/ftsc/test/toolchain-guard.mjs"

const dotnetBin = findExecutable("dotnet")
const toolchain = dotnetBin !== null

const workdir = await mkdtemp(join(tmpdir(), "flang-emit-csharp-"))
after(async () => {
  await rm(workdir, { recursive: true, force: true })
})

/* Ни сети, ни пользовательских настроек, ни следов в домашнем каталоге:
   напечатанная программа ни от чего не зависит, и запуск обязан это
   доказывать. Телеметрия и приветствие первого запуска гасятся не из
   вредности — они пишут в stdout, а там протокол прогонщика. */
const DOTNET_ENV = {
  ...process.env,
  DOTNET_CLI_TELEMETRY_OPTOUT: "1",
  DOTNET_NOLOGO: "1",
  DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
  DOTNET_CLI_HOME: join(workdir, ".dotnet-home"),
  NUGET_PACKAGES: join(workdir, ".nuget"),
}

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

/* Сборка программы стоит секунду с лишним, а программ три десятка, и тесты
   берут их по нескольку раз. Кэш по самому AST: одна и та же программа с одними
   и теми же настройками печатается и собирается однажды. */
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
  const emitted = emitCsharp(program, options)
  for (const file of emitted.files) {
    mkdirSync(dirname(join(directory, file.path)), { recursive: true })
    writeFileSync(join(directory, file.path), file.content, "utf8")
  }

  /* В каталоге не должно оказаться ничего, кроме напечатанного. Проверяется до
     сборки: она сама насыпет bin/ и obj/. */
  assert.deepEqual(listFiles(directory).sort(), emitted.files.map((file) => file.path).sort())

  const moduleFile = emitted.files
    .map((file) => file.path)
    .find(
      (path) => path.endsWith(".cs")
        && !["Value.cs", "Field.cs", "FlangError.cs", "Ctx.cs", "Flang.cs", "FlangCli.cs"].includes(path),
    )
  const className = moduleFile.replace(/\.cs$/u, "")

  /* Строгий режим задан в напечатанном flang.csproj, а не здесь: режим сборки —
     часть выдачи бэкенда, и проверять надо именно её. */
  const compiled = spawnSync(dotnetBin, ["build", "-v", "quiet", "--nologo", "-o", "out"], {
    cwd: directory,
    encoding: "utf8",
    env: DOTNET_ENV,
  })
  assert.equal(
    compiled.status,
    0,
    `dotnet build не принял напечатанное (TreatWarningsAsErrors):\n${compiled.stdout}\n${compiled.stderr}`,
  )

  return {
    directory,
    emitted,
    className,
    assembly: join(directory, "out", "flang.dll"),
    source: emitted.files.find((file) => file.path === moduleFile).content,
    runtime: emitted.files.find((file) => file.path === "Flang.cs").content,
  }
}

/** Один процесс на сколько угодно запросов: запуск среды дорог, запрос дёшев. */
function ask(built, requests) {
  const input = `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`
  const output = execFileSync(dotnetBin, [built.assembly, built.className], {
    cwd: built.directory,
    input,
    encoding: "utf8",
    env: DOTNET_ENV,
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
        `собранный C# дал ${describeOutcome(byEmitted)}`,
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
   том же пределе счётчик C# всегда меньше, и упереться в лимит первым может
   только интерпретатор. Такие точки сверяются по коду ошибки, а не по тексту:
   текст содержит число шагов, а оно у двух счётчиков разное по построению. */
const ПРЕДЕЛЫ = { maxSteps: 5_000_000, maxDepth: 10_000 }

test("stdlib и leetcode: собранный C# совпадает с интерпретатором", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "csharp", "тулчейн .NET не найден (ни в PATH, ни в FTS_TOOLCHAIN_PATH) — пропуск")
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
            `${file} / «${point.name}»: интерпретатор упёрся в лимит, C# дал ${describeOutcome(byEmitted)}`)
        }
        return
      }
      assert.ok(
        sameOutcome(byInterpreter, byEmitted),
        `${file} / «${point.name}» на входе ${JSON.stringify(point.args) ?? "?"}: ` +
          `интерпретатор дал ${describeOutcome(byInterpreter)}, собранный C# дал ${describeOutcome(byEmitted)}`,
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

test("примеры stdlib и leetcode сходятся у C# так же, как у интерпретатора", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
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
      assert.ok(byEmitted.ok, `${file} / «${fn.name}» / «${example.name}»: C# дал ${describeOutcome(byEmitted)}`)
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
   функция печатается обычной рекурсией C# — как и у интерпретатора, глубина
   растёт, и упереться она обязана в счётчик языка, а не в стек .NET. */
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
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

test("стек .NET не подменяет собой предел языка", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  /* Ключевой тест слоя, и в C# он важнее, чем где бы то ни было.
     StackOverflowException в .NET не ловится вовсе: среда завершает процесс
     немедленно, и ни catch, ни finally не выполняются — то есть переполнение
     стека здесь уносит с собой все ответы, которые прогонщик успел накопить.
     Проверяется поэтому граница: на глубине чуть ниже предела flang программа
     обязана СОСЧИТАТЬ, а чуть выше — сказать FLANG_RECURSION_LIMIT тем же
     текстом, что интерпретатор. Падения между этими точками быть не может. */
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
    "за пределом обязана быть диагностика языка, а не падение процесса",
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  const built = build(treeProgram)
  /* Union-типов в C# нет, поэтому сумма типов представлена значением с тегом,
     а типизированный слой — это напечатанные конструкторы: по статическому
     методу на вариант. */
  assert.match(built.source, /public static Value VList\(Value znachenie\)/u,
    "конструктор варианта «Лист» обязан быть напечатан")
  assert.match(built.source, /Value\.Variant\("Лист", new Field\[\] \{/u,
    "конструктор обязан строить вариант рантайма")
  assert.match(built.source, /Value\.VariantIs\([a-zA-Z0-9_]+, "Узел"\)/u,
    "разбор — это проверка дискриминанта, а не `is`")

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

/* В ядре FTS «Значение операнда» — и вариант суммы типов, и функция. Класс C#
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  const built = build(namesakeProgram)
  /* Три объявления с одним именем модели — три разных идентификатора. Самим
     фактом успешной сборки это уже доказано (компилятор не принял бы два метода
     с одной сигнатурой), но проверяется и текст: молчаливое переименование
     одного из них было бы столь же неверным. Приставка роли здесь в PascalCase,
     как принято для членов класса в C#, — роль от этого никуда не девается. */
  assert.match(built.source, /^ {4}public static Value FnZnachenieOperanda\(Ctx ctx, Value operand\)$/mu)
  assert.match(built.source, /^ {4}public static Value VZnachenieOperanda\(Value znachenie\)$/mu)
  assert.match(built.source, /^ {4}public static Value FnObyortka\(Ctx ctx, Value ch\)$/mu)
  assert.match(built.source, /^ {4}public static Value RecObyortka\(Value znachenie\)$/mu)

  /* Ни одно имя не объявлено дважды: затирание — это как раз то, чего нельзя
     заметить по значению одной функции. */
  const declared = [...built.source.matchAll(/^ {4}(?:public|private) static Value\??? ([A-Za-z_][A-Za-z_0-9]*)\(/gmu)]
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  const built = build(mutualProgram)
  assert.match(built.source, /Flang\.Trampoline\(/u, "взаимная хвостовая рекурсия печатается через батут")
  assert.match(built.source, /bounce\.Next = Step[A-Za-z0-9_]*;/u,
    "хвостовой вызов соседа — отскок группой методов, а не кадр стека")

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
   постоянной глубине. У C# хвостовых вызовов среда не обещает (инструкция IL
   tail. существует, но компилятор её не порождает) — именно поэтому хвостовой
   самовызов идёт в `while (true)`. */
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  const built = build(countdownProgram)
  assert.match(built.source, /^ +while \(true\)$/mu, "хвостовой самовызов обязан стать циклом")
  assert.match(built.source, /^ +continue;$/mu, "цикл обязан замыкаться на continue, а не на рекурсию")
  assert.doesNotMatch(built.source, /= FnOtschyot\(ctx/u, "самовызова остаться не должно")
  /* Ключевое для C#: после `while (true)` без break не печатается НИЧЕГО.
     Любой оператор там был бы недостижимым (CS0162), а под
     TreatWarningsAsErrors это отказ сборки — тот же дефект, который в C ломал
     сборку неиспользованным результатом. */
  assert.match(built.source, /continue;\n\s*\}\n\s*\}\n\s*\}\n\s*finally$/mu,
    "после хвостового цикла не печатается ничего: закрылась ветвь, закрылся цикл, дальше только finally")

  const expected = (100_000 * 100_001) / 2
  /* depth = 8 — доказательство хвостовой природы вызова: без переиспользования
     кадра оба движка упёрлись бы в предел на девятом шаге. */
  const byInterpreter = interpret(countdownProgram, "Отсчёт", [100_000, 0], { maxSteps: 100_000_000, maxDepth: 8 })
  assert.equal(byInterpreter, expected)
  const [answer] = ask(built, [
    { fn: "Отсчёт", args: [encode(100_000), encode(0)], depth: "8", steps: "100000000" },
  ])
  assert.equal(answer.ok, true, `собранный C# не сосчитал 100 000 шагов: ${JSON.stringify(answer)}`)
  assert.equal(decode(answer.value), expected)

  const grid = [-1, 0, 1, 2, 7, 1000].map((value) => [value, 0])
  const points = compare(countdownProgram, built, "Отсчёт", grid, { limits: { maxSteps: 10_000_000 } })
  t.diagnostic(`100 000 шагов пройдено обоими движками; дополнительно сверено входов: ${points}`)
})

test("внутренний цикл не перехватывает continue хвостового самовызова", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
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
  /* Код и текст едут в AST данными — значит и в C# они литералы, а не знание,
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
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
   «мир 🌍» это 6 единиц UTF-16, в Go — 8 байт, и в C# ровно те же 6 единиц,
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
 * Обход СЧИТАЕТ, а не разбирает список звено за звеном: у C# «хвост» — копия, и
 * обход звеньями стоил бы n³ работы там, где для доказательства хватает n².
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
 * нему поставить было нельзя — на общей машине оно шумит вдвое, а запуск .NET
 * на малых n больше самой работы, — поэтому порога не стояло вовсе, и
 * утверждение «удвоение n удваивает время» жило только в имени теста.
 *
 * Сам факт, что граница НАХОДИТСЯ, доказывает, что счётчик шагов работает:
 * иначе запрос доходил бы при любом бюджете и поиск не сошёлся бы.
 *
 * Ищется пачкой: один запуск процесса проверяет сразу лестницу бюджетов, а
 * запуск дорог — запрос дёшев.
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
  if (!dotnetBin) {
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  const built = build(indexCostProgram)
  assert.match(built.source, /BElement\(/u, "взятие по номеру обязано печататься вызовом формы")

  /* ДОКАЗАТЕЛЬСТВО, а не замер: у формы в напечатанном рантайме нет обхода
     вовсе — номер превращается в индекс массива. Никакой замер этого не даёт:
     он говорит про один компилятор на одной машине, а эти три строки — про
     всякий. Сменят массив на звенья — упадёт здесь и сразу, а не замедлится
     молча. */
  const тело = /static Value BElement\([^)]*\)\s*\{([\s\S]*?)\n    \}/u.exec(built.runtime)?.[1]
  assert.ok(тело !== undefined, "в напечатанном рантайме не нашлось тела BElement")
  assert.match(тело, /return items\[\(int\)at\];/u, "взятие обязано быть индексом массива")
  assert.doesNotMatch(тело, /\b(for|while|foreach|goto)\b/u, "во взятии по номеру появился обход — форма перестала быть постоянной")

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
  t.diagnostic(`формой на ${n} номерах (C#): ${мс} мс — время печатается, но не утверждается: оно шумит`)

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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  /* Единственное место, где C# расходится со строкой flang по построению:
     string — это UTF-16, «😀😀».Length там 4, а кодовых точек 2. Кириллица
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  const built = build(stringProgram, { indexBase: 0 })
  assert.match(built.source, /ctx\.IndexBase = 0;/u)
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
 * Заметит ли это Roslyn — здесь не проверено: тулчейна .NET на машине, где это
 * писалось, не было. Ждать защиты от компилятора и не стоило бы: у Java, где
 * проверить удалось, javac собирает такой файл молча даже под
 * `-Xlint:all -Werror`. Надёжная защита одна — не печатать их сырыми.
 *
 * Проверок две, и первая нарочно не требует тулчейна: форма записи — часть
 * выдачи бэкенда, и она обязана проверяться и там, где .NET не поставлен.
 * Общая проверка на все восемь целей сразу — в flang/test/emit-bidi.test.mjs.
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

test("двунаправленные управляющие уезжают в \\uXXXX, а не печатаются сырыми", () => {
  const program = parse(bidiSource)
  const emitted = emitCsharp(program, {})
  const all = emitted.files.map((file) => file.content).join("\n")

  const raw = [...all].filter((character) => BIDI_CONTROLS.includes(character.codePointAt(0)))
  assert.equal(raw.length, 0, "в напечатанном C# не может быть сырых двунаправленных управляющих")

  /* `\uXXXX` берёт ровно четыре цифры, поэтому «во» следом за ним читается как
     текст, а не как продолжение экранирования (у `\x` длина переменная, и он бы
     съел то, что за ним стоит). Записано ожидание целым литералом: так видно
     не только «экранировано», но и «экранировано именно так». */
  assert.ok(
    all.includes('"\\u202eле\\u202cво"'),
    "литерал обязан быть напечатан как \"\\u202eле\\u202cво\"",
  )
  /* И это ровно то значение, которое даёт интерпретатор: разница только в
     записи, кодовые точки те же. Ожидание записано через `\u`, потому что
     сырому символу нечего делать и в тексте теста. */
  assert.equal(interpret(program, "Метка", []), "\u202eле\u202cво")
})

test("двунаправленные управляющие: собранный C# даёт то же значение, что интерпретатор", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  const program = parse(bidiSource)
  const built = build(program)
  const points = compare(program, built, "Метка", [[]]) + compare(program, built, "Длина метки", [[]])
  assert.equal(points, 2)
})

/* ══════════════════════════ 10. числа и равенство ═══════════════════════════ */

test("порядок вычисления строго слева направо: первая ошибка — левая", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
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
           ошибка. Это ровно то место, где выражение C# пришлось бы
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  /* Деление на ноль C# даёт даром — в отличие от Python, где оно возбуждает
     исключение, и в отличие от decimal, где деления на ноль не бывает вовсе. А
     вот равенство даром не даётся: `==` для double считает NaN не равным NaN и
     0 равным −0 — обе половины наоборот относительно Object.is. */
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  /* Литерал `2` в C# — это int, и `2 / 3` посчиталось бы целочисленно. Число
     flang — всегда IEEE-754 double: ни int, ни decimal здесь не годятся (см.
     Value.cs), поэтому суффикс `d` обязателен, а NaN и бесконечности литералом
     не записываются вовсе. */
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
  assert.match(built.source, /Value\.Number\(1\.0d\)/u, "целое обязано печататься double-литералом")
  assert.match(built.source, /Value\.Number\(double\.NaN\)/u)
  assert.match(built.source, /Value\.Number\(-0\.0d\)/u)
  assert.match(built.source, /Value\.Number\(1e\+21d\)/u)
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  /* double.ToString() даёт «1E+21» там, где нужно «1e+21», и «1E-07» там, где
     нужно «1e-7», а разделитель дробной части у него зависит от культуры. Пороги
     перехода к экспоненте у ECMAScript свои: n больше 21 и n не больше −6. Всё
     это видно пользователю через «к строке». */
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  /* Ни в stdlib, ни в leetcode образцов-литералов нет — там встречаются только
     «пусто», «голова и хвост» и варианты. Значит этот путь печати главная
     сверка не проходит вовсе, и проверять его надо отдельно. Заодно здесь живут
     строки, которые обязаны пережить экранирование в литерале C#: кавычка,
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
  assert.match(built.source, /Value\.Equal\([a-zA-Z0-9_]+, Value\.Number\(0\.0d\)\)/u,
    "образец-литерал — это сравнение значений")
  assert.match(built.source, /Value\.Variant\("Есть", new Field\[\] \{/u,
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  /* C# запрещает повторно объявить локальное имя во вложенном блоке — в
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

test("связанное, но неиспользованное имя гасится, а вычисляться не перестаёт", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  /* «случай голова и хвост», где голова телу не нужна, — обычное дело. CS0219
     на такое имя не срабатывает: он ловит только присваивание константы, а
     привязки приходят из вызовов. Полагаться на это нельзя — анализаторы у
     пользователя могут быть строже, — поэтому объявление уходит в
     отбрасывающее присваивание `_ = …`. Выбросить само связывание всё равно
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
  assert.match(built.source, /^ +_ = Flang\.VariantField\(ctx, [a-zA-Z0-9]+, "значение"\);$/mu,
    "неиспользованная привязка обязана вычисляться и уходить в «_»")

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
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  /* Функция, у которой ВСЕ хвостовые позиции — самовызов, ни разу не пишет в
     результат и никогда не возвращается нормально. В C под -Werror это ломало
     сборку неиспользованной переменной результата; в C# аналог — недостижимый
     код (CS0162), который под TreatWarningsAsErrors тоже отказ сборки. Здесь
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
  /* Сам факт успешной сборки под TreatWarningsAsErrors и есть проверка. */
  const built = build(program)
  assert.match(built.source, /^ +while \(true\)$/mu)
  assert.match(built.source, /bounce\.Next = Step[A-Za-z0-9_]*;/u)
  /* Сразу за `continue` закрывается цикл, а за ним — только finally: ни
     возврата, ни объявления результата после хвостового цикла быть не может,
     любой такой оператор был бы недостижимым. */
  assert.match(built.source, /continue;\n\s*\}\n\s*\}\n\s*finally$/mu)
  assert.doesNotMatch(built.source, /continue;\n\s*\}\n\s*(?:return|Value |throw)/u)

  /* Обе функции незавершающиеся — обе обязаны упереться в лимит шагов, а не
     сорвать стек и не собраться в код, который компилятор отверг бы. */
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
    const first = emitCsharp(program)
    const second = emitCsharp(program)
    assert.deepEqual(first, second)
    /* И ещё раз после кругосветки через JSON: вывод не зависит от того, откуда
       приехал AST. */
    const third = emitCsharp(JSON.parse(JSON.stringify(program)))
    assert.deepEqual(first, third)
  }
})

test("напечатанный C# ни от чего не зависит и объясняет себя", () => {
  const emitted = emitCsharp(treeProgram)
  const all = emitted.files.map((file) => file.content).join("\n")
  /* Только базовая библиотека .NET и собственный рантайм программы: ни одной
     ссылки на пакет, поэтому в flang.csproj нет ни одного PackageReference, а
     `dotnet build` работает без сети. Пространств имён ровно столько, сколько
     нужно: System и его подпространства. */
  const usings = [...all.matchAll(/^using ([A-Za-z_][\w.]*);/gmu)].map((match) => match[1])
  assert.ok(usings.length > 0)
  const allowed = new Set([
    "System", "System.Collections.Generic", "System.Globalization", "System.IO",
    "System.Numerics", "System.Reflection", "System.Text", "System.Threading",
  ])
  for (const name of usings) {
    assert.ok(allowed.has(name), `внешняя зависимость «${name}» в напечатанном коде недопустима`)
  }
  assert.doesNotMatch(all, /PackageReference/u, "ни одной ссылки на пакет NuGet")
  assert.doesNotMatch(all, /DateTime\.Now|\bnew Random\b|Environment\.GetEnvironmentVariable|ProcessStartInfo/u,
    "ни времени, ни случайности, ни окружения")
  /* Nullable-контекст включён в каждом файле, а не только в проекте: файл могут
     взять по одному и положить в чужую сборку с другими настройками. */
  for (const file of emitted.files.filter((item) => item.path.endsWith(".cs"))) {
    assert.match(file.content, /^#nullable enable$/mu, `${file.path} без nullable-контекста`)
  }
  assert.deepEqual(emitted.files.map((file) => file.path).sort(), [
    "Ctx.cs",
    "Derevya.cs",
    "Field.cs",
    "Flang.cs",
    "FlangCli.cs",
    "FlangError.cs",
    "Makefile",
    "Value.cs",
    "flang.csproj",
  ])
  const source = emitted.files.find((file) => file.path === "Derevya.cs").content
  assert.match(source, /^\/\/ Сгенерировано flang \(бэкенд C#/u)
  assert.match(source, /Не редактировать руками/u)
  /* Имена flang сохраняются рядом с каждым типом и каждой функцией. */
  assert.match(source, /Функция flang «Сумма дерева»/u)
  assert.match(source, /Вариант «Лист» суммы типов «Дерево»/u)
  /* Проект требует того самого строгого режима, под которым идёт сборка. */
  const project = emitted.files.find((file) => file.path === "flang.csproj").content
  assert.match(project, /<Nullable>enable<\/Nullable>/u)
  assert.match(project, /<TreatWarningsAsErrors>true<\/TreatWarningsAsErrors>/u)
  assert.match(project, /<InvariantGlobalization>true<\/InvariantGlobalization>/u)
  assert.doesNotMatch(project, /PackageReference/u)
  /* Рантайм печатается байт в байт из репозитория. */
  for (const name of ["Value.cs", "Field.cs", "FlangError.cs", "Ctx.cs", "Flang.cs"]) {
    const onDisk = readFileSync(fileURLToPath(new URL(`../src/emit/csharp/${name}`, import.meta.url)), "utf8")
    const printed = emitted.files.find((file) => file.path === name).content
    assert.ok(printed.endsWith(onDisk), `${name} обязан печататься без правок, только с шапкой`)
  }
})

test("без прогонщика печатается одна библиотека", () => {
  const emitted = emitCsharp(listProgram, { cli: false })
  assert.deepEqual(emitted.files.map((file) => file.path).sort(), [
    "Ctx.cs",
    "Field.cs",
    "Flang.cs",
    "FlangError.cs",
    "Makefile",
    "Spiski.cs",
    "Value.cs",
    "flang.csproj",
  ])
  /* Библиотека — значит и проект собирает библиотеку, а не программу. */
  const project = emitted.files.find((file) => file.path === "flang.csproj").content
  assert.match(project, /<OutputType>Library<\/OutputType>/u)
  assert.doesNotMatch(project, /StartupObject/u)
})

/* ══════════════════════════ 13. ошибки печати ═══════════════════════════ */

test("статические ошибки ловятся при печати, а не в собранной программе", () => {
  const wrongArity = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "builtin", name: "длина", args: [] } }],
  }
  assert.throws(() => emitCsharp(wrongArity), (error) => {
    assert.equal(errorCode(error), "FLANG_BUILTIN_ARGS")
    assert.equal(error.message, "«длина» ожидает 1 аргумент, получено 0")
    return true
  })

  const unknownName = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "var", name: "неизвестное" } }],
  }
  assert.throws(() => emitCsharp(unknownName), (error) => {
    assert.equal(errorCode(error), "FLANG_UNKNOWN_NAME")
    assert.equal(error.message, "имя «неизвестное» не связано")
    return true
  })

  const unknownCall = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "call", name: "Нет такой", args: [] } }],
  }
  assert.throws(() => emitCsharp(unknownCall), (error) => errorCode(error) === "FLANG_UNKNOWN_NAME")

  /* «Сумма» и «сумма» — разные имена модели, но один идентификатор C#. */
  const collision = {
    flang: 1,
    functions: [
      { name: "Сумма", params: [], body: { kind: "literal", value: 1 } },
      { name: "сумма", params: [], body: { kind: "literal", value: 2 } },
    ],
  }
  assert.throws(() => emitCsharp(collision), /идентификатор/u)

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
  assert.throws(() => emitCsharp(variantCollision), /идентификатор/u)

  /* Модуль, чьё имя заняло бы класс рантайма. */
  const shadowRuntime = {
    flang: 1,
    module: "flang error",
    functions: [{ name: "Ф", params: [], body: { kind: "literal", value: 1 } }],
  }
  assert.throws(() => emitCsharp(shadowRuntime), /рантайм/u)
})

test("имена, опасные для C#, печать переживают: ключевые слова и имена бэкенда", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  /* Приставка роли снимает целый класс столкновений: функция, названная «call»
     или «new context», не спорит с тем, что печатает сам бэкенд. Локальные же
     имена приставки не несут, и там опасность настоящая: параметр «class» —
     ключевое слово, после которого файл вообще не разберётся, а «string» и
     «Value» затенили бы типы, которыми пользуется каждая строка. Экранирование
     через «@class» C# допускает, но оно превратило бы читаемое имя в загадку —
     а весь смысл транслитерации в том, чтобы код читался. */
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
  assert.match(built.source, /^ {4}public static Value FnCall\(Ctx ctx, /mu,
    "имя «call» не спорит с диспетчером бэкенда")
  assert.match(built.source, /^ {4}public static Value FnNewContext\(Ctx ctx\)$/mu)
  assert.doesNotMatch(built.source, /\(Ctx ctx, Value value\)/u, "параметр не имеет права затенить ключевое слово")
  assert.match(built.source, /^ {4}public static Value Call\(Ctx ctx, string name, Value\[\] args\)$/mu,
    "диспетчер бэкенда остаётся на месте")

  compare(program, built, "call", [[1, 2], ["строка", 2]])
  compare(program, built, "String", [[1], [true], [null], [[1]]])
  compare(program, built, "new context", [[]])
})

/* ══════════════════════════ 14. тулчейн ═══════════════════════════ */

test("тулчейн C#: версия записывается в отчёт, отсутствие — честный пропуск", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  const version = execFileSync(dotnetBin, ["--version"], { encoding: "utf8", env: DOTNET_ENV }).trim()
  t.diagnostic(`dotnet SDK ${version}; сборка идёт под TreatWarningsAsErrors и Nullable=enable`)
  assert.match(version, /^\d+\./u)
  const major = Number(version.split(".")[0])
  assert.ok(major >= 6, `нужен .NET SDK 6 или новее, найден ${version}`)
})

test("Makefile — рабочая сборка, а не украшение", async (t) => {
  if (!toolchain) {
    missingToolchain(t, "csharp", "тулчейн .NET не найден — пропуск")
    return
  }
  const makeBin = findExecutable("make")
  if (!makeBin) {
    t.diagnostic("make не найден — проверка Makefile пропущена (сборка проверена прямым вызовом dotnet)")
    return
  }
  /* Печатается в свежий каталог: `make` обязан собрать напечатанное сам.
     Единственное, что передаётся снаружи, — путь к `dotnet`: тулчейн мог быть
     найден через FTS_TOOLCHAIN_PATH и не лежать в PATH вовсе. Ровно для этого в
     напечатанном Makefile стоит `DOTNET ?= dotnet`, а не жёсткое имя. */
  serial += 1
  const directory = join(workdir, `make${serial}`)
  mkdirSync(directory, { recursive: true })
  for (const file of emitCsharp(treeProgram).files) {
    writeFileSync(join(directory, file.path), file.content, "utf8")
  }
  const made = spawnSync(makeBin, ["build", `DOTNET=${dotnetBin}`], {
    cwd: directory,
    encoding: "utf8",
    env: DOTNET_ENV,
  })
  assert.equal(made.status, 0, `make build не собрал напечатанное:\n${made.stdout}\n${made.stderr}`)
  assert.ok(listFiles(directory).some((path) => path.endsWith("flang.dll")), "make обязан оставить сборку")
})
