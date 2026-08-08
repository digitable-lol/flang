/**
 * Печать flang → Rust.
 *
 * Главный тест здесь один и он же единственный осмысленный: **сверка с
 * интерпретатором**. Кодогенератор не имеет права быть «почти правильным»:
 * либо собранная программа на каждом входе даёт то же значение и ту же ошибку
 * (код и текст), что `interpret.mjs`, либо результатам сгенерированного кода
 * нельзя верить вовсе.
 *
 * Поэтому каждая программа проходит полный путь пользователя: печатается в
 * ПУСТОЙ каталог, собирается настоящим `rustc` под `-D warnings` ровно из того,
 * что выдал бэкенд (ни одного файла руками), и запускается настоящим процессом.
 * Ничего не подкладывается из репозитория: если бы рантайм собирался только
 * потому, что лежит рядом, дыра нашлась бы у первого же пользователя, а не
 * здесь. Отдельный тест собирает ту же печать через `cargo`, чтобы напечатанный
 * `Cargo.toml` был не украшением, а рабочим манифестом.
 *
 * `-D warnings` — не придирка к стилю. В Rust неиспользованное имя,
 * неиспользованное присваивание и мёртвый код это предупреждения, и в языке с
 * образцами («случай голова и хвост», а голова телу не нужна) они возникают
 * постоянно. Собирать напечатанное с молчаливыми предупреждениями значило бы не
 * замечать, что бэкенд печатает мусор.
 *
 * Набор программ для главной сверки — не выдуманные фикстуры, а всё, что в
 * репозитории написано на самом flang: `flang/stdlib/*.flang` и
 * `flang/examples/leetcode/*.flang`. Это 31 программа, полторы сотни функций и
 * четверть тысячи примеров; сетка входов строится из примеров и из порчи их
 * аргументов заведомо неподходящими значениями — там, где проверяются коды и
 * тексты диагностик.
 *
 * Сетка гоняется через прогонщик одним процессом на программу: сборка дорога,
 * запрос дёшев. Значения ездят размеченным JSON — числа строкой, чтобы NaN,
 * Infinity и −0 доехали без потерь.
 *
 * ── Если тулчейна Rust нет ──────────────────────────────────────────────────
 * Тесты, которым нужен компилятор, честно пропускаются через `missingToolchain`
 * (tools/ftsc/test/toolchain-guard.mjs) — тем же способом, что у бэкендов Go и
 * .NET в tools/ftsc. Молчаливый пропуск, выглядящий как успех, недопустим:
 * `FTS_REQUIRE_TOOLCHAINS=rust` превращает пропуск в падение, а каталог с
 * тулчейном вне PATH указывается через `FTS_TOOLCHAIN_PATH`. Тесты, которым
 * компилятор не нужен (детерминированность печати, статические диагностики,
 * форма выдачи), идут всегда.
 */
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

import { errorCode } from "../src/compat.mjs"
import { evaluate as interpret, variant } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"
import { emitRust } from "../src/emit/rust.mjs"
import { findExecutable } from "../../tools/ftsc/src/toolchain.mjs"
import { missingToolchain } from "../../tools/ftsc/test/toolchain-guard.mjs"

/* rustup кладёт тулчейн в ~/.cargo/bin, а этого каталога нет ни в списке
   общеизвестных мест toolchain.mjs, ни, на серверах без входа в оболочку, в
   PATH. Ищем и там: иначе тест «честно пропускается» на машине, где Rust есть. */
const CARGO_BIN = [join(homedir(), ".cargo", "bin")]
const rustcBin = findExecutable("rustc", CARGO_BIN)
const cargoBin = findExecutable("cargo", CARGO_BIN)

const workdir = await mkdtemp(join(tmpdir(), "flang-emit-rust-"))
after(async () => {
  await rm(workdir, { recursive: true, force: true })
})

/* Ни сети, ни реестра пакетов: напечатанный крейт ни от чего не зависит, и
   сборка обязана это доказывать, а не молча тянуть что-нибудь из интернета. */
const RUST_ENV = { ...process.env, CARGO_NET_OFFLINE: "true" }

/* Отладочная информация тесту не нужна, а место на диске и время сборки —
   нужны: с ней каждый из тридцати одного крейта весит вчетверо больше. */
const RUSTC_FLAGS = ["--edition", "2021", "-D", "warnings", "-C", "debuginfo=0"]

const CRATE = "flangprogram"

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

/* Сборка крейта — доли секунды, но программ тридцать одна, и тесты берут их по
   нескольку раз. Кэш по самому AST: одна и та же программа с одними и теми же
   настройками собирается однажды. */
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
  const emitted = emitRust(program, options)
  for (const file of emitted.files) {
    mkdirSync(dirname(join(directory, file.path)), { recursive: true })
    writeFileSync(join(directory, file.path), file.content, "utf8")
  }

  /* В каталоге не должно оказаться ничего, кроме напечатанного. */
  assert.deepEqual(listFiles(directory).sort(), emitted.files.map((file) => file.path).sort())

  /* Плоды сборки — отдельным каталогом: он появляется уже после проверки, что
     бэкенд не напечатал ничего лишнего. */
  const built = join(directory, "build")
  mkdirSync(built, { recursive: true })
  const library = join(built, `lib${CRATE}.rlib`)

  const lib = spawnSync(
    rustcBin,
    [...RUSTC_FLAGS, "--crate-type", "lib", "--crate-name", CRATE, "-o", library, "src/lib.rs"],
    { cwd: directory, encoding: "utf8", env: RUST_ENV },
  )
  assert.equal(lib.status, 0, `rustc не собрал библиотеку:\n${lib.stdout}\n${lib.stderr}`)
  assert.equal(lib.stderr.trim(), "", `rustc нашёл, к чему придраться:\n${lib.stderr}`)

  const cli = join(built, "flang_cli")
  const binary = spawnSync(
    rustcBin,
    [...RUSTC_FLAGS, "--extern", `${CRATE}=${library}`, "-o", cli, "src/main.rs"],
    { cwd: directory, encoding: "utf8", env: RUST_ENV },
  )
  assert.equal(binary.status, 0, `rustc не собрал прогонщик:\n${binary.stdout}\n${binary.stderr}`)
  assert.equal(binary.stderr.trim(), "", `rustc нашёл, к чему придраться:\n${binary.stderr}`)

  const moduleSource = emitted.files.find(
    (file) => file.path.startsWith("src/") &&
      !["src/lib.rs", "src/main.rs", "src/cli.rs", "src/runtime.rs"].includes(file.path),
  )
  return {
    directory,
    emitted,
    cli,
    source: moduleSource.content,
    runtime: emitted.files.find((file) => file.path === "src/runtime.rs").content,
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
        `собранный Rust дал ${describeOutcome(byEmitted)}`,
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
   том же пределе счётчик Rust всегда меньше, и упереться в лимит первым может
   только интерпретатор. Такие точки сверяются по коду ошибки, а не по тексту:
   текст содержит число шагов, а оно у двух счётчиков разное по построению. */
const ПРЕДЕЛЫ = { maxSteps: 5_000_000, maxDepth: 10_000 }

test("stdlib и leetcode: собранный Rust совпадает с интерпретатором", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден (ни в PATH, ни в FTS_TOOLCHAIN_PATH) — пропуск")
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
            `${file} / «${point.name}»: интерпретатор упёрся в лимит, Rust дал ${describeOutcome(byEmitted)}`)
        }
        return
      }
      assert.ok(
        sameOutcome(byInterpreter, byEmitted),
        `${file} / «${point.name}» на входе ${JSON.stringify(point.args) ?? "?"}: ` +
          `интерпретатор дал ${describeOutcome(byInterpreter)}, собранный Rust дал ${describeOutcome(byEmitted)}`,
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

test("примеры stdlib и leetcode сходятся у собранного Rust так же, как у интерпретатора", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
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
      assert.ok(byEmitted.ok, `${file} / «${fn.name}» / «${example.name}»: собранный Rust дал ${describeOutcome(byEmitted)}`)
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
   функция печатается обычной рекурсией Rust — как и у интерпретатора, глубина
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
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
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

test("хвост списка — суффикс, а не копия: длинный список обходится линейно", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
  /* В JS «хвост» копирует, потому что массив нельзя разделить с суффиксом.
     Здесь значения неизменяемы и лежат под `Rc`, поэтому хвост — тот же массив
     со сдвинутым началом, и наблюдаемо это неотличимо: значение то же, а
     времени меньше. Именно ради этого выбран `Rc`, а не `Box`. */
  const built = build(listProgram)
  assert.match(built.source, /rt::chain_tail\(&[a-z0-9_]+\)/u, "хвост обязан браться суффиксом рантайма")
  assert.match(built.runtime, /fn tail\(&self\) -> Items \{/u, "суффикс обязан быть сдвигом начала, а не копией")
  const long = Array.from({ length: 3000 }, (_, index) => index)
  const started = Date.now()
  const [answer] = ask(built, [{ fn: "Сумма", args: [encode(long)] }])
  assert.equal(answer.ok, true, JSON.stringify(answer))
  assert.equal(decode(answer.value), (2999 * 3000) / 2)
  t.diagnostic(`список из 3000 элементов пройден рекурсией за ${Date.now() - started} мс`)
})

test("глубина 10 000 кадров проходит, а не срывает стек", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
  /* У интерпретатора стек лежит в куче, у Rust — настоящий, и его переполнение
     это не паника, а аварийный останов процесса: ни кода, ни текста ошибки. То
     есть предел глубины обязан срабатывать РАНЬШЕ, чем кончается стек, — иначе
     вместо FLANG_RECURSION_LIMIT пользователь получит убитый процесс. Ради
     этого прогонщик считает в потоке с большим стеком. */
  const built = build(listProgram)
  assert.match(built.runtime, /pub const DEFAULT_MAX_DEPTH: i64 = 10000;/u)
  const deep = Array.from({ length: 9500 }, (_, index) => index)
  const tooDeep = Array.from({ length: 12000 }, (_, index) => index)
  const [ok, over] = ask(built, [
    { fn: "Сумма", args: [encode(deep)], steps: "100000000" },
    { fn: "Сумма", args: [encode(tooDeep)], steps: "100000000" },
  ])
  assert.equal(ok.ok, true, `9500 кадров обязаны пройти, получено ${JSON.stringify(ok)}`)
  assert.equal(decode(ok.value), (9499 * 9500) / 2)
  assert.equal(over.ok, false, "12 000 кадров обязаны упереться в предел, а не в стек")
  assert.equal(over.code, "FLANG_RECURSION_LIMIT")
  assert.match(over.message, /^функция «Сумма» превысила предел глубины вызовов \(10000\) на глубине 10001$/u)
  /* И то же самое обязан сказать интерпретатор. */
  const byInterpreter = outcome(() => interpret(listProgram, "Сумма", [tooDeep], { maxSteps: 100_000_000 }))
  assert.equal(byInterpreter.code, "FLANG_RECURSION_LIMIT")
  assert.equal(byInterpreter.message, over.message)
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
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
  const built = build(treeProgram)
  /* У Rust есть настоящий enum, но сумма типов flang представлена одним
     динамическим значением рантайма (см. шапку emit/rust.mjs), а типизированный
     слой — это напечатанные конструкторы: по функции на вариант. */
  assert.match(
    built.source,
    /pub fn variant_list\(znachenie: rt::Value\) -> rt::Value/u,
    "конструктор варианта «Лист» обязан быть напечатан",
  )
  assert.match(built.source, /rt::variant\("Лист", fields\)/u, "конструктор обязан строить вариант рантайма")
  assert.match(built.source, /rt::variant_is\(&[a-z0-9_]+, "Узел"\)/u, "разбор — это проверка дискриминанта")
  assert.doesNotMatch(built.source, /^enum /mu, "отдельного enum на каждую сумму быть не должно")

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

/* ══════════ 4. роль в имени: одноимённые вариант, запись и функция ══════════ */

/* Дефект, найденный в бэкенде C: конструктор варианта звался по имени варианта,
   функция — по имени функции, и одноимённые вариант и функция («Значение
   операнда» в ядре FTS — и вариант суммы, и функция) дали два объявления одного
   идентификатора, то есть код, который не компилируется. В Rust вариант,
   запись и функция живут в одном пространстве имён модуля, значит болезнь та
   же. Лекарство — роль в имени, и вот его проверка. */
const clashProgram = {
  flang: 1,
  module: "Одноимённое",
  types: [
    {
      kind: "record",
      name: "Значение операнда",
      fields: [{ name: "число", type: { kind: "number" } }],
    },
    {
      kind: "sum",
      name: "Операнд",
      variants: [
        { name: "Значение операнда", fields: [{ name: "число", type: { kind: "number" } }] },
        { name: "Пусто операнда", fields: [] },
      ],
    },
  ],
  functions: [
    {
      name: "Значение операнда",
      total: true,
      params: [{ name: "операнд", type: { kind: "sum", name: "Операнд" } }],
      returns: { kind: "number" },
      body: {
        kind: "match",
        target: { kind: "var", name: "операнд" },
        cases: [
          {
            pattern: { kind: "variant", name: "Значение операнда", bind: { "число": "ч" } },
            body: { kind: "var", name: "ч" },
          },
          { pattern: { kind: "any" }, body: { kind: "literal", value: 0 } },
        ],
      },
    },
    {
      name: "Собрать операнд",
      total: true,
      params: [{ name: "ч", type: { kind: "number" } }],
      returns: { kind: "sum", name: "Операнд" },
      body: {
        kind: "construct",
        variant: "Значение операнда",
        fields: { "число": { kind: "var", name: "ч" } },
      },
    },
  ],
}

test("одноимённые вариант, запись и функция расходятся ролью в имени", async (t) => {
  const emitted = emitRust(clashProgram)
  const source = emitted.files.find((file) => file.path === "src/odnoimyonnoe.rs").content

  /* Три объявления, три разных идентификатора — и ни одного повтора. */
  const declared = [...source.matchAll(/^pub fn ([a-z0-9_]+)\(/gmu)].map((match) => match[1])
  assert.deepEqual(
    declared.filter((name) => name.endsWith("znachenie_operanda")).sort(),
    ["funkciya_znachenie_operanda", "variant_znachenie_operanda", "zapis_znachenie_operanda"],
    "имя модели «Значение операнда» обязано дать три разных идентификатора — по одному на роль",
  )
  assert.equal(new Set(declared).size, declared.length, "два объявления одного идентификатора недопустимы")

  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — сборка одноимённых пропущена")
    return
  }
  const built = build(clashProgram)
  compare(clashProgram, built, "Значение операнда", [
    [variant("Значение операнда", { "число": 7 })],
    [variant("Пусто операнда", {})],
    [variant("Значение операнда", {})],
    [42],
    [null],
  ])
  compare(clashProgram, built, "Собрать операнд", [[1], [-0], ["не число"]])

  const [built7] = ask(built, [{ fn: "Собрать операнд", args: [encode(7)] }])
  assert.deepEqual(decode(built7.value), variant("Значение операнда", { "число": 7 }))
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
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
  const built = build(mutualProgram)
  assert.match(built.source, /rt::trampoline\(/u, "взаимная хвостовая рекурсия печатается через батут")
  assert.match(built.source, /bounce\.next = Some\(/u, "хвостовой вызов соседа — отскок, а не кадр стека")

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

/* Ключевой тест слоя. Интерпретатор переиспользует кадр возврата, поэтому
   считает 100 000 шагов в постоянной глубине. Напечатанная «в лоб» рекурсия
   съела бы стек — именно поэтому хвостовой самовызов идёт в `loop { … }`. */
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
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
  const built = build(countdownProgram)
  assert.match(built.source, /^ {4}loop \{$/mu, "хвостовой самовызов обязан стать циклом")
  assert.match(built.source, /^ +continue;$/mu, "цикл обязан замыкаться на continue, а не на рекурсию")
  assert.doesNotMatch(built.source, /= funkciya_otschyot\(ctx/u, "самовызова остаться не должно")

  const expected = (100_000 * 100_001) / 2
  /* depth = 8 — доказательство хвостовой природы вызова: без переиспользования
     кадра оба движка упёрлись бы в предел на девятом шаге. */
  const byInterpreter = interpret(countdownProgram, "Отсчёт", [100_000, 0], { maxSteps: 100_000_000, maxDepth: 8 })
  assert.equal(byInterpreter, expected)
  const [answer] = ask(built, [
    { fn: "Отсчёт", args: [encode(100_000), encode(0)], depth: "8", steps: "100000000" },
  ])
  assert.equal(answer.ok, true, `собранный Rust не сосчитал 100 000 шагов: ${JSON.stringify(answer)}`)
  assert.equal(decode(answer.value), expected)

  const grid = [-1, 0, 1, 2, 7, 1000].map((value) => [value, 0])
  const points = compare(countdownProgram, built, "Отсчёт", grid, { limits: { maxSteps: 10_000_000 } })
  t.diagnostic(`100 000 шагов пройдено обоими движками; дополнительно сверено входов: ${points}`)
})

test("внутренний цикл не перехватывает continue хвостового самовызова", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
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
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
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
  /* Код и текст едут в AST данными — значит и в Rust они литералы, а не знание,
     зашитое в бэкенд. Нарушенное свойство — это `Err`, а не `panic!`: доменный
     отказ обязан быть обработан вызывающим, а не убивать процесс. */
  assert.match(built.source, /"FTS_UTILITY_PROPERTY"/u)
  assert.doesNotMatch(built.source, /panic!|unwrap\(\)|expect\(/u, "паника в напечатанном коде недопустима")

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
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
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
  assert.doesNotMatch(built.source, /^ {4}loop \{$/mu, "постусловие запрещает разворот в цикл")
  compare(program, built, "Счёт", [[0], [1], [5], [50]])
})

/* ══════════════════════════ 8. пределы ═══════════════════════════ */

test("нехвостовая рекурсия глубже предела даёт FLANG_RECURSION_LIMIT у обоих движков", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
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
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
  /* Хвостовой самовызов развёрнут в цикл, значит ни стек, ни глубина здесь не
     растут — остановить это может только счётчик шагов. Он и есть та часть
     интерпретатора, которой в бэкенде C нет вовсе (там такая функция крутится
     бесконечно). Число шагов у двух движков разное по построению, поэтому
     сверяется код, а текст — только по форме. */
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
  "  7  ", "ЁЖИК"]
const indices = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 1.5, 100]

test("строковые формы: кириллица, суррогатные пары и границы индексов", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
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
  points += compare(stringProgram, built, "Содержит", [["привет", "иве"], ["мир 🌍", "🌍"], [[1, 2], 2], [[1, 2], 3], [1, 2], ["", ""]])
  points += compare(stringProgram, built, "Начинается", [["привет", "при"], ["", ""], ["🌍x", "🌍"], [1, "а"]])
  points += compare(stringProgram, built, "К числу",
    [...texts, "0", "-0", "1e3", "Infinity", "0x10", "+5", "1.", ".5", "1e", "1e999", " 7 ", "\u{FEFF}7"]
      .map((value) => [value]))
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
    { fn: "К строке", args: [encode(1e21)] },
    { fn: "К строке", args: [encode(1)] },
  ])
  assert.deepEqual(answers.map((answer) => decode(answer.value)), ["да", "нет", "ничто", 5, "🌍", "1e+21", "1"])
  t.diagnostic(`сверенных входов: ${points}`)
})

test("печать числа совпадает с Number::toString на порогах экспоненты", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
  /* `{}` для f64 в Rust не переходит к экспоненте никогда, `{:e}` — всегда, а
     ECMAScript переключается на n > 21 и n ≤ −6. Значит правило приходится
     писать руками, и вот его проверка на самих порогах. */
  const built = build(stringProgram)
  const numbers = [
    0, -0, 1, -1, 0.5, 1.5, 100, 1e20, 1e21, 1e22, 1.2345e21, 1e-6, 1e-7, 5e-324,
    1.7976931348623157e308, 0.1, 0.2, 0.3, 1 / 3, 123456789012345680000, Number.NaN, Infinity, -Infinity,
  ]
  const answers = ask(built, numbers.map((value) => ({ fn: "К строке", args: [encode(value)] })))
  answers.forEach((answer, index) => {
    assert.equal(answer.ok, true, JSON.stringify(answer))
    assert.equal(
      decode(answer.value),
      String(numbers[index]),
      `печать числа ${String(numbers[index])} разошлась с Number::toString`,
    )
  })
  compare(stringProgram, built, "К строке", numbers.map((value) => [value]))
  t.diagnostic(`сверено чисел: ${numbers.length}`)
})

test("нулевая индексация строк включается опцией и остаётся согласованной", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
  const built = build(stringProgram, { indexBase: 0 })
  assert.match(built.source, /ctx\.set_index_base\(0\);/u)
  const grid = []
  for (const index of indices) for (const text of texts) grid.push([index, text])
  compare(stringProgram, built, "Символ", grid, { limits: { indexBase: 0 } })
})

/* ══════════════════════ 10. семантика чисел и равенства ═══════════════════ */

test("порядок вычисления строго слева направо: первая ошибка — левая", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
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
    ],
  }
  const built = build(program)
  compare(program, built, "Сложить", [
    [[], []],
    [[1], []],
    [[], [1]],
    [[1], [2]],
    ["не список", []],
  ])
})

test("деление на ноль даёт Infinity и NaN, равенство — Object.is", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
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
  const built = build(program)
  compare(program, built, "Делить", [[1, 0], [-1, 0], [0, 0], [1, 2], [-0, 1], [1, -0]])

  const [infinity, nothing] = ask(built, [
    { fn: "Делить", args: [encode(1), encode(0)] },
    { fn: "Делить", args: [encode(0), encode(0)] },
  ])
  assert.equal(decode(infinity.value), Infinity, "деление на ноль обязано дать Infinity, а не ошибку")
  assert.ok(Number.isNaN(decode(nothing.value)), "ноль на ноль обязан дать NaN")

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

test("неконечные литералы и −0 печатаются константами f64 и доезжают без потерь", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
  /* Записать NaN и бесконечность литералом в Rust нельзя — для них есть
     константы f64. Знак нуля литерал сохраняет, и Object.is его различает. */
  const program = {
    flang: 1,
    module: "Неконечные",
    functions: [
      { name: "Не число", params: [], body: { kind: "literal", value: Number.NaN } },
      { name: "Бесконечность", params: [], body: { kind: "literal", value: Infinity } },
      { name: "Минус бесконечность", params: [], body: { kind: "literal", value: -Infinity } },
      { name: "Минус ноль", params: [], body: { kind: "literal", value: -0 } },
      { name: "Много", params: [], body: { kind: "literal", value: 1e21 } },
    ],
  }
  const built = build(program)
  assert.match(built.source, /rt::number\(f64::NAN\)/u)
  assert.match(built.source, /rt::number\(f64::NEG_INFINITY\)/u)
  assert.match(built.source, /rt::number\(-0\.0\)/u)
  for (const name of program.functions.map((fn) => fn.name)) compare(program, built, name, [[]])

  const answers = ask(built, program.functions.map((fn) => ({ fn: fn.name, args: [] })))
  assert.deepEqual(answers.map((answer) => answer.value), [
    { n: "NaN" }, { n: "Infinity" }, { n: "-Infinity" }, { n: "-0" }, { n: "1e+21" },
  ])
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
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
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
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
  /* Ни в stdlib, ни в leetcode образцов-литералов нет — там встречаются только
     «пусто», «голова и хвост» и варианты. Значит этот путь печати главная
     сверка не проходит вовсе, и проверять его надо отдельно. Заодно здесь
     живут строки, которые обязаны пережить экранирование в литерале Rust:
     кавычка, обратный слэш, перевод строки, табуляция и суррогатная пара. */
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
    ],
  }
  const built = build(program)
  assert.match(built.source, /rt::equal\(&[a-z0-9_]+, &rt::number\(0\.0\)\)/u, "образец-литерал — это сравнение значений")

  const grid = [0, -0, 1, 2, "да", "нет", true, false, null, [1, 2], [1, 2, 3], Number.NaN, 3.5]
    .map((value) => [value])
  compare(program, built, "Назвать", grid)
  compare(program, built, "Особые", [[]])

  const [special] = ask(built, [{ fn: "Особые", args: [] }])
  assert.deepEqual(decode(special.value), [
    "кавычка \" внутри", "слэш \\ внутри", "перевод\nстроки", "таб\tуляция", "эмодзи 🌍", "",
  ])
})

test("вызов по имени: неизвестная функция и неверная арность дают ошибки интерпретатора", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
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
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
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

test("связанное, но неиспользованное имя гасится, а не ломает сборку", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
  /* В Rust неиспользованная переменная — предупреждение, то есть под
     -D warnings ошибка сборки. «случай голова и хвост», где голова телу не
     нужна, — обычное дело. Гасится заимствованием, а не перемещением: иначе
     ошибочно погашенное имя стало бы ошибкой компиляции. */
  const program = {
    flang: 1,
    module: "Неиспользованное",
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
        name: "Пропустить",
        total: true,
        params: [{ name: "элементы" }],
        body: {
          kind: "map",
          over: { kind: "var", name: "элементы" },
          item: "э",
          body: { kind: "literal", value: 0 },
        },
      },
      {
        name: "Без аргумента",
        total: true,
        params: [{ name: "ненужный" }],
        body: { kind: "literal", value: 1 },
      },
    ],
  }
  const built = build(program)
  assert.match(built.source, /let _ = &/u, "неиспользованное локальное имя обязано гаситься заимствованием")
  assert.match(built.source, /_nenuzhnyy: rt::Value/u, "неиспользованный параметр обязан получить приставку")
  compare(program, built, "Считать", [[[]], [[1, 2, 3]], ["не список"]])
  compare(program, built, "Пропустить", [[[]], [[1, 2, 3]], [null]])
  compare(program, built, "Без аргумента", [[1], ["что угодно"], [null]])
})

test("параметр цикла, который только переприсваивается, не ломает сборку", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
  /* Отдельный лад того же предупреждения, и самый неочевидный: параметр
     хвостового цикла, которому на каждом витке присваивают новое значение, но
     который никто не читает. Это уже не `unused_variables`, а
     `unused_assignments` («значение присвоено и никогда не прочитано»), и
     гасить его заимствованием в начале тела бесполезно — виток возвращается к
     началу ЦИКЛА, а не к началу функции. Помогает только приставка в имени. */
  const v = (name) => ({ kind: "var", name })
  const program = {
    flang: 1,
    module: "Мёртвый параметр",
    functions: [
      {
        name: "Гасить",
        params: [{ name: "н" }, { name: "мусор" }],
        body: {
          kind: "if",
          cond: { kind: "binary", op: "lte", left: v("н"), right: { kind: "literal", value: 0 } },
          then: { kind: "literal", value: 0 },
          else: {
            kind: "call",
            name: "Гасить",
            args: [
              { kind: "binary", op: "sub", left: v("н"), right: { kind: "literal", value: 1 } },
              { kind: "literal", value: 0 },
            ],
          },
        },
      },
    ],
  }
  const built = build(program)
  assert.match(built.source, /mut _musor: rt::Value/u, "мёртвый параметр цикла обязан получить приставку")
  assert.match(built.source, /^ +_musor = t\d+;$/mu, "и всё-таки переприсваиваться: вычисление аргумента наблюдаемо")
  compare(program, built, "Гасить", [[0, 1], [5, 2], [-1, "что угодно"], ["не число", 0]])
})

/* ══════════════════════════ 12. форма результата ═══════════════════════════ */

test("детерминированность: две печати дают побайтово одно и то же", () => {
  const list = [listProgram, treeProgram, mutualProgram, countdownProgram, stringProgram, clashProgram,
    parse(flangSource)]
  for (const { program } of programs) list.push(program)
  for (const program of list) {
    const first = emitRust(program)
    const second = emitRust(program)
    assert.deepEqual(first, second)
    /* И ещё раз после кругосветки через JSON: вывод не зависит от того, откуда
       приехал AST. */
    const third = emitRust(JSON.parse(JSON.stringify(program)))
    assert.deepEqual(first, third)
  }
})

test("напечатанный Rust ни от чего не зависит и объясняет себя", () => {
  const emitted = emitRust(treeProgram)
  const all = emitted.files.map((file) => file.content).join("\n")
  /* Только `std` и собственные модули крейта: ни одной внешней зависимости,
     поэтому и Cargo.lock не нужен. */
  const uses = [...all.matchAll(/^use ([a-zA-Z_][\w:]*)/gmu)].map((match) => match[1])
  assert.ok(uses.length > 0)
  for (const path of uses) {
    assert.ok(
      path.startsWith("std::") || path.startsWith("crate::"),
      `внешняя зависимость «${path}» в напечатанном коде недопустима`,
    )
  }
  const cargo = emitted.files.find((file) => file.path === "Cargo.toml").content
  assert.match(cargo, /\[dependencies\]\n\n?$/u, "раздел зависимостей обязан остаться пустым")
  assert.doesNotMatch(all, /SystemTime::now|std::env::var|rand::/u, "ни времени, ни случайности, ни окружения")
  assert.deepEqual(emitted.files.map((file) => file.path).sort(), [
    "Cargo.toml",
    "Makefile",
    "src/cli.rs",
    "src/derevya.rs",
    "src/lib.rs",
    "src/main.rs",
    "src/runtime.rs",
  ])
  const source = emitted.files.find((file) => file.path === "src/derevya.rs").content
  assert.match(source, /^\/\/ Сгенерировано flang \(бэкенд Rust/u)
  assert.match(source, /Не редактировать руками/u)
  /* Имена flang сохраняются рядом с каждым типом и каждой функцией. */
  assert.match(source, /Функция flang «Сумма дерева»/u)
  assert.match(source, /Вариант «Лист» суммы типов «Дерево»/u)
  /* Рантайм печатается байт в байт из репозитория. */
  const onDisk = readFileSync(fileURLToPath(new URL("../src/emit/rust/flang_runtime.rs", import.meta.url)), "utf8")
  const runtime = emitted.files.find((file) => file.path === "src/runtime.rs").content
  assert.ok(runtime.endsWith(onDisk), "рантайм обязан печататься без правок, только с шапкой")
})

test("без прогонщика печатается одна библиотека", () => {
  const emitted = emitRust(listProgram, { cli: false })
  assert.deepEqual(emitted.files.map((file) => file.path).sort(), [
    "Cargo.toml",
    "Makefile",
    "src/lib.rs",
    "src/runtime.rs",
    "src/spiski.rs",
  ])
  assert.doesNotMatch(emitted.files.find((file) => file.path === "Cargo.toml").content, /\[\[bin\]\]/u)
})

test("напечатанный Cargo.toml — рабочий манифест, а не украшение", async (t) => {
  if (!cargoBin) {
    missingToolchain(t, "rust", "cargo не найден — сборка манифеста пропущена")
    return
  }
  /* Основная сборка идёт через rustc: она на порядок быстрее и не создаёт
     target/. Но пользователь возьмёт напечатанное как проект cargo, значит хотя
     бы одна программа обязана собраться именно так — и без единого замечания,
     включая предупреждения самого cargo о неоднозначности файлов. */
  serial += 1
  const directory = join(workdir, `cargo${serial}`)
  mkdirSync(directory, { recursive: true })
  for (const file of emitRust(listProgram).files) {
    mkdirSync(dirname(join(directory, file.path)), { recursive: true })
    writeFileSync(join(directory, file.path), file.content, "utf8")
  }
  const started = Date.now()
  const result = spawnSync(cargoBin, ["build", "--offline", "--quiet"], {
    cwd: directory,
    encoding: "utf8",
    env: { ...RUST_ENV, RUSTFLAGS: "-D warnings", CARGO_TARGET_DIR: join(directory, "target") },
  })
  assert.equal(result.status, 0, `cargo build не собрал напечатанное:\n${result.stdout}\n${result.stderr}`)
  assert.equal(result.stderr.trim(), "", `cargo нашёл, к чему придраться:\n${result.stderr}`)

  const [answer] = ask({ cli: join(directory, "target", "debug", "flang_cli") }, [
    { fn: "Сумма", args: [encode([1, 2, 3])] },
  ])
  assert.equal(decode(answer.value), 6)
  /* Каталог сборки cargo весит десятки мегабайт; тест не имеет права оставлять
     их на диске дольше, чем нужно. */
  await rm(join(directory, "target"), { recursive: true, force: true })
  t.diagnostic(`cargo build --offline за ${Math.round((Date.now() - started) / 1000)} с`)
})

/* ══════════════════════════ 13. ошибки печати ═══════════════════════════ */

test("статические ошибки ловятся при печати, а не в собранной программе", () => {
  const wrongArity = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "builtin", name: "длина", args: [] } }],
  }
  assert.throws(() => emitRust(wrongArity), (error) => {
    assert.equal(errorCode(error), "FLANG_BUILTIN_ARGS")
    assert.equal(error.message, "«длина» ожидает 1 аргумент, получено 0")
    return true
  })

  const unknownName = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "var", name: "неизвестное" } }],
  }
  assert.throws(() => emitRust(unknownName), (error) => {
    assert.equal(errorCode(error), "FLANG_UNKNOWN_NAME")
    assert.equal(error.message, "имя «неизвестное» не связано")
    return true
  })

  const unknownCall = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "call", name: "Нет такой", args: [] } }],
  }
  assert.throws(() => emitRust(unknownCall), (error) => errorCode(error) === "FLANG_UNKNOWN_NAME")

  /* «Сумма» и «сумма» — разные имена модели, но один идентификатор Rust. */
  const collision = {
    flang: 1,
    functions: [
      { name: "Сумма", params: [], body: { kind: "literal", value: 1 } },
      { name: "сумма", params: [], body: { kind: "literal", value: 2 } },
    ],
  }
  assert.throws(() => emitRust(collision), /идентификатор/u)

  /* А вот имя, совпавшее с тем, что печатает сам бэкенд, коллизией больше не
     является: роль в имени разводит «функцию call» и служебную `call`. */
  const reserved = {
    flang: 1,
    module: "Служебное",
    functions: [
      { name: "call", params: [], body: { kind: "literal", value: 1 } },
      { name: "new context", params: [], body: { kind: "literal", value: 2 } },
    ],
  }
  const emitted = emitRust(reserved, { cli: false })
  const source = emitted.files.find((file) => file.path === "src/sluzhebnoe.rs").content
  assert.match(source, /pub fn funkciya_call\(/u)
  assert.match(source, /pub fn funkciya_new_context\(/u)
  assert.match(source, /pub fn new_context\(\) -> rt::Ctx/u)
})

/* ══════════════════════════ 14. тулчейн ═══════════════════════════ */

test("тулчейн Rust: версия записывается в отчёт, отсутствие — честный пропуск", async (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден (ни в PATH, ни в FTS_TOOLCHAIN_PATH) — пропуск")
    return
  }
  const version = execFileSync(rustcBin, ["--version"], { encoding: "utf8", env: RUST_ENV }).trim()
  t.diagnostic(`${version}; cargo ${cargoBin ? "найден" : "не найден — сборка манифеста пропущена"}`)
  assert.match(version, /^rustc \d+\.\d+/u)
})
