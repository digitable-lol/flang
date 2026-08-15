/**
 * Печать flang → Go.
 *
 * Главный тест здесь один и он же единственный осмысленный: **сверка с
 * интерпретатором**. Кодогенератор не имеет права быть «почти правильным»:
 * либо собранная программа на каждом входе даёт то же значение и ту же ошибку
 * (код и текст), что `interpret.mjs`, либо результатам сгенерированного кода
 * нельзя верить вовсе.
 *
 * Поэтому каждая программа проходит полный путь пользователя: печатается в
 * ПУСТОЙ каталог, проверяется `gofmt -l` и `go vet`, собирается `go build`
 * ровно из того, что выдал бэкенд (ни одного файла руками), и запускается
 * настоящим процессом. Ничего не подкладывается из репозитория: если бы
 * рантайм собирался только потому, что лежит рядом, дыра нашлась бы у первого
 * же пользователя, а не здесь.
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
 * ── Если тулчейна Go нет ────────────────────────────────────────────────────
 * Тесты, которым нужен компилятор, честно пропускаются через `missingToolchain`
 * (tools/ftsc/test/toolchain-guard.mjs) — тем же способом, что у бэкендов Go и
 * .NET в tools/ftsc. Молчаливый пропуск, выглядящий как успех, недопустим:
 * `FTS_REQUIRE_TOOLCHAINS=go` превращает пропуск в падение, а каталог с
 * тулчейном вне PATH указывается через `FTS_TOOLCHAIN_PATH`. Тесты, которым
 * компилятор не нужен (детерминированность печати, статические диагностики,
 * форма выдачи), идут всегда.
 */
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, relative } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

import { errorCode } from "../src/compat.mjs"
import { evaluate as interpret, variant } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"
import { emitGo } from "../src/emit/go.mjs"
import { findExecutable } from "../../tools/ftsc/src/toolchain.mjs"
import { missingToolchain } from "../../tools/ftsc/test/toolchain-guard.mjs"

const goBin = findExecutable("go")
const gofmtBin = findExecutable("gofmt")

const workdir = await mkdtemp(join(tmpdir(), "flang-emit-go-"))
after(async () => {
  await rm(workdir, { recursive: true, force: true })
})

/* Ни сети, ни прокси: напечатанный модуль ни от чего не зависит, и сборка
   обязана это доказывать, а не молча тянуть что-нибудь из интернета. */
const GO_ENV = { ...process.env, GOFLAGS: "-mod=mod", GOPROXY: "off", GOSUMDB: "off" }

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

/* Сборка Go — секунда на программу, а программ тридцать одна, и тесты берут их
   по нескольку раз. Кэш по самому AST: одна и та же программа с одними и теми
   же настройками собирается однажды. */
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
  const emitted = emitGo(program, options)
  for (const file of emitted.files) {
    mkdirSync(dirname(join(directory, file.path)), { recursive: true })
    writeFileSync(join(directory, file.path), file.content, "utf8")
  }

  /* В каталоге не должно оказаться ничего, кроме напечатанного. */
  assert.deepEqual(listFiles(directory).sort(), emitted.files.map((file) => file.path).sort())

  if (gofmtBin) {
    const formatted = execFileSync(gofmtBin, ["-l", "."], { cwd: directory, encoding: "utf8", env: GO_ENV })
    assert.equal(formatted.trim(), "", `gofmt -l нашёл неотформатированные файлы:\n${formatted}`)
  }
  const vet = spawnSync(goBin, ["vet", "./..."], { cwd: directory, encoding: "utf8", env: GO_ENV })
  assert.equal(vet.status, 0, `go vet не принял напечатанное:\n${vet.stdout}\n${vet.stderr}`)
  const compiled = spawnSync(goBin, ["build", "-o", "flang_cli", "./cli"], {
    cwd: directory,
    encoding: "utf8",
    env: GO_ENV,
  })
  assert.equal(compiled.status, 0, `go build не собрал напечатанное:\n${compiled.stdout}\n${compiled.stderr}`)

  const moduleSource = emitted.files.find((file) => file.path.startsWith("flang/"))
  return {
    directory,
    emitted,
    cli: join(directory, "flang_cli"),
    source: moduleSource.content,
    runtime: emitted.files.find((file) => file.path.startsWith("flangrt/")).content,
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
        `собранный Go дал ${describeOutcome(byEmitted)}`,
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
 *
 * Функции, работающие с суммами типов, примеров пока не имеют (см.
 * stdlib.test.mjs) — им остаётся только порча, то есть проверка кодов и
 * текстов диагностик. Это меньше, чем хотелось бы, но это не ноль, и без этого
 * два десятка функций не проверялись бы собранным кодом вовсе.
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
   том же пределе счётчик Go всегда меньше, и упереться в лимит первым может
   только интерпретатор. Такие точки сверяются по коду ошибки, а не по тексту:
   текст содержит число шагов, а оно у двух счётчиков разное по построению. */
const ПРЕДЕЛЫ = { maxSteps: 5_000_000, maxDepth: 10_000 }

test("stdlib и leetcode: собранный Go совпадает с интерпретатором", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден (ни в PATH, ни в FTS_TOOLCHAIN_PATH) — пропуск")
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
            `${file} / «${point.name}»: интерпретатор упёрся в лимит, Go дал ${describeOutcome(byEmitted)}`)
        }
        return
      }
      assert.ok(
        sameOutcome(byInterpreter, byEmitted),
        `${file} / «${point.name}» на входе ${JSON.stringify(point.args) ?? "?"}: ` +
          `интерпретатор дал ${describeOutcome(byInterpreter)}, собранный Go дал ${describeOutcome(byEmitted)}`,
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

test("примеры stdlib и leetcode сходятся у собранного Go так же, как у интерпретатора", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
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
      assert.ok(byEmitted.ok, `${file} / «${fn.name}» / «${example.name}»: собранный Go дал ${describeOutcome(byEmitted)}`)
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
   функция печатается обычной рекурсией Go — как и у интерпретатора, глубина
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
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
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

/** Тело функции от сигнатуры до парной закрывающей скобки. */
function телоФункции(текст, сигнатура) {
  const начало = текст.indexOf(сигнатура)
  assert.notEqual(начало, -1, `в напечатанном рантайме не нашлось «${сигнатура}»`)
  let глубина = 0
  for (let место = текст.indexOf("{", начало); место >= 0 && место < текст.length; место += 1) {
    if (текст[место] === "{") глубина += 1
    else if (текст[место] === "}") {
      глубина -= 1
      if (глубина === 0) return текст.slice(начало, место + 1)
    }
  }
  assert.fail(`у «${сигнатура}» не нашлось конца`)
}

/*
 * Имя этого теста скромнее, чем у близнецов в emit-c и emit-rust, и это не
 * недосмотр — там вторая половина («длинный список обходится линейно») доказана
 * мерой памяти, а здесь такой меры нет. Обе попытки её завести померены и
 * отвергнуты, числа стоит знать, чтобы не заводить их третий раз:
 *
 *   • предел `ulimit -v` у Go не имеет нужной цены деления: рантайм резервирует
 *     около семисот мегабайт адресного пространства ещё до первой строки
 *     программы (ниже — `failed to reserve page summary memory`, прогонщик не
 *     стартует вовсе), и от запуска к запуску это число гуляет на полсотни
 *     мегабайт — вчетверо больше всего, что тратит сам проход;
 *   • но главное — копирующий хвост в Go вообще НЕ СТОИТ памяти. Померено на
 *     подделке, у которой `ChainTail` копирует срез: наименьший бюджет на
 *     четырёх тысячах 753 664 КиБ против 761 856 у среза, на восьми тысячах
 *     782 336 против 778 240 — то есть разницы нет. Копии умирают сразу, их
 *     собирает сборщик мусора; растёт только время (3,2 с против 0,48 и 11,8 с
 *     против 0,77).
 *
 * Время же мерить нельзя: на общей машине оно шумит вдвое. Поэтому здесь
 * остаётся ровно то, что доказуемо, — исходник рантайма, — и имя говорит ровно
 * это. Кому нужна цена прохода на Go, тот читает соседей: у C арена не отдаёт
 * ничего до конца запроса, у Rust `Rc` держит копию до конца кадра, и там
 * квадрат виден в байтах.
 */
test("хвост списка — срез, а не копия: в рантайме ни обхода, ни копирования", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  /* В JS «хвост» копирует, потому что массив нельзя разделить с суффиксом.
     Здесь значения неизменяемы и лежат под сборщиком мусора, поэтому хвост —
     срез, и наблюдаемо это неотличимо: значение то же, а работы меньше. */
  const built = build(listProgram)
  assert.match(built.source, /rt\.ChainTail\(/u, "хвост обязан браться срезом рантайма")

  /* Проверяется ВСЯ дорога значения, а не первый её шаг: до сегодняшнего дня
     стоял один assert на `ChainTail`, и подделка, в которой копию заводил уже
     `List`, проходила тест целиком — проверяемая строка при этом оставалась
     байт в байт прежней. */
  const хвост = телоФункции(built.runtime, "func ChainTail(value Value) Value")
  assert.match(хвост, /return List\(value\.List\[1:\]\)/u, "срез обязан быть сдвигом начала, а не копией")
  const обёртка = телоФункции(built.runtime, "func List(items []Value) Value")
  assert.match(обёртка, /return Value\{Tag: TagList, List: items\}/u, "список обязан брать чужой срез как есть")
  for (const [имя, тело] of [["ChainTail", хвост], ["List", обёртка]]) {
    assert.doesNotMatch(
      тело,
      /\b(for|range|goto|copy|append|make)\b/u,
      `в ${имя} появился обход или копирование — хвост перестал быть срезом`,
    )
  }

  /* И значение прежде всего: срез не имеет права менять ответ. */
  const long = Array.from({ length: 3000 }, (_, index) => index)
  const [answer] = ask(built, [{ fn: "Сумма", args: [encode(long)] }])
  assert.equal(answer.ok, true, JSON.stringify(answer))
  assert.equal(decode(answer.value), (2999 * 3000) / 2)
  t.diagnostic("список из 3000 элементов пройден рекурсией; время не печатается: утверждать по нему нечего")
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
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  const built = build(treeProgram)
  /* Сумма типов представлена структурой с тегом, а типизированный слой — это
     напечатанные конструкторы: по функции на вариант.

     Приставка `Variant` — это роль, и стоит она не для красоты: у пакета Go
     одно пространство имён, перегрузки нет, а имя функции и имя варианта в
     модели совпадать ВПРАВЕ (HOF.md, решение 2) — дефункционализация строит
     такие программы сама. Без приставки «Лист»-вариант и «Лист»-функция дали
     бы два `func List`, то есть `redeclared in this block`. Проверяется это
     без тулчейна и на всех восьми целях сразу — flang/test/emit-names.test.mjs. */
  assert.match(
    built.source,
    /func VariantList\(znachenie rt\.Value\) rt\.Value/u,
    "конструктор варианта «Лист» обязан быть напечатан — с ролью в имени",
  )
  assert.match(built.source, /rt\.Variant\("Лист", \[\]rt\.Field\{/u, "конструктор обязан строить вариант рантайма")
  assert.match(built.source, /rt\.VariantIs\([a-zA-Z0-9]+, "Узел"\)/u, "разбор — это проверка дискриминанта")

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
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  const built = build(mutualProgram)
  assert.match(built.source, /rt\.Trampoline\(/u, "взаимная хвостовая рекурсия печатается через батут")
  assert.match(built.source, /bounce\.Next = /u, "хвостовой вызов соседа — отскок, а не кадр стека")

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

/* ══════════════════════════ 5. хвостовая рекурсия на 100 000 шагов ═══════════ */

/* Ключевой тест слоя. Интерпретатор переиспользует кадр возврата, поэтому
   считает 100 000 шагов в постоянной глубине. Напечатанная «в лоб» рекурсия Go
   съела бы стек — именно поэтому хвостовой самовызов идёт в `for { … }`. */
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
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  const built = build(countdownProgram)
  assert.match(built.source, /\tfor \{\n/u, "хвостовой самовызов обязан стать циклом")
  assert.match(built.source, /^\t+continue$/mu, "цикл обязан замыкаться на continue, а не на рекурсию")
  assert.doesNotMatch(built.source, /:= Otschyot\(ctx/u, "самовызова остаться не должно")

  const expected = (100_000 * 100_001) / 2
  /* depth = 8 — доказательство хвостовой природы вызова: без переиспользования
     кадра оба движка упёрлись бы в предел на девятом шаге. */
  const byInterpreter = interpret(countdownProgram, "Отсчёт", [100_000, 0], { maxSteps: 100_000_000, maxDepth: 8 })
  assert.equal(byInterpreter, expected)
  const [answer] = ask(built, [
    { fn: "Отсчёт", args: [encode(100_000), encode(0)], depth: "8", steps: "100000000" },
  ])
  assert.equal(answer.ok, true, `собранный Go не сосчитал 100 000 шагов: ${JSON.stringify(answer)}`)
  assert.equal(decode(answer.value), expected)

  const grid = [-1, 0, 1, 2, 7, 1000].map((value) => [value, 0])
  const points = compare(countdownProgram, built, "Отсчёт", grid, { limits: { maxSteps: 10_000_000 } })
  t.diagnostic(`100 000 шагов пройдено обоими движками; дополнительно сверено входов: ${points}`)
})

test("внутренний цикл не перехватывает continue хвостового самовызова", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
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

/* ══════════════════════════ 6. постусловия ═══════════════════════════ */

test("постусловие без кода даёт FLANG_PROPERTY, не признак — FLANG_TYPE", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
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
  /* Код и текст едут в AST данными — значит и в Go они литералы, а не знание,
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
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
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
  assert.doesNotMatch(built.source, /\tfor \{\n/u, "постусловие запрещает разворот в цикл")
  compare(program, built, "Счёт", [[0], [1], [5], [50]])
})

/* ══════════════════════════ 7. пределы ═══════════════════════════ */

test("нехвостовая рекурсия глубже предела даёт FLANG_RECURSION_LIMIT у обоих движков", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  /* У интерпретатора переполнение стека невозможно (стек в куче), у Go стек
     растёт до гигабайта и падает паникой, а не диагностикой. Поэтому счётчик
     глубины обязателен, и его код с текстом обязаны совпасть с интерпретатором. */
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
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
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
   иначе «мир 🌍» окажется длиной 6 (UTF-16) или 8 (UTF-8), а не 5. */
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
 * Обход СЧИТАЕТ, а не разбирает список звено за звеном: у Java, C# и Python
 * «хвост» — копия, и обход звеньями стоил бы n³ работы там, где для
 * доказательства хватает n². Витков языка при этом ровно столько же — н на одно
 * взятие, — а меряются здесь именно витки.
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
 * нему поставить было нельзя — на общей машине оно шумит вдвое, а запуск
 * процесса на малых n больше самой работы, — поэтому порога не стояло вовсе, и
 * утверждение «удвоение n удваивает время» жило только в имени теста.
 *
 * Сам факт, что граница НАХОДИТСЯ, доказывает, что счётчик шагов работает:
 * иначе запрос доходил бы при любом бюджете и поиск не сошёлся бы.
 *
 * Ищется пачкой: один запуск процесса проверяет сразу лестницу бюджетов, а
 * сборка дорога — запрос дёшев.
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
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  const built = build(indexCostProgram)
  assert.match(built.source, /BElement\(/u, "взятие по номеру обязано печататься вызовом формы")

  /* ДОКАЗАТЕЛЬСТВО, а не замер: у формы в напечатанном рантайме нет обхода
     вовсе — номер превращается в индекс среза. Никакой замер этого не даёт: он
     говорит про один компилятор на одной машине, а эти три строки — про всякий.
     Сменят срез на звенья — упадёт здесь и сразу, а не замедлится молча. */
  const тело = /func BElement\([^)]*\)[^{]*\{([\s\S]*?)\n\}/u.exec(built.runtime)?.[1]
  assert.ok(тело !== undefined, "в напечатанном рантайме не нашлось тела BElement")
  assert.match(тело, /return items\[int\(at\)\], nil/u, "взятие обязано быть индексом среза")
  assert.doesNotMatch(тело, /\b(for|range|goto)\b/u, "во взятии по номеру появился обход — форма перестала быть постоянной")

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
  t.diagnostic(`формой на ${n} номерах (Go): ${мс} мс — время печатается, но не утверждается: оно шумит`)

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
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
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
    [...texts, "0", "-0", "1e3", "Infinity", "0x10", "+5", "1.", ".5", "1e", "1e999", " 7 ", "\u{FEFF}7"]
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

test("нулевая индексация строк включается опцией и остаётся согласованной", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  const built = build(stringProgram, { indexBase: 0 })
  assert.match(built.source, /ctx\.IndexBase = 0/u)
  const grid = []
  for (const index of indices) for (const text of texts) grid.push([index, text])
  compare(stringProgram, built, "Символ", grid, { limits: { indexBase: 0 } })
})

/* ══════════════════════════ 9. семантика чисел и равенства ═══════════════════ */

test("порядок вычисления строго слева направо: первая ошибка — левая", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
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
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
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

test("неконечные литералы и −0 печатаются через math и доезжают без потерь", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  /* Записать NaN и бесконечность литералом в Go нельзя, а `1.0/0.0` на
     константах — не Inf, а ошибка компиляции. Знак нуля константа тоже теряет,
     хотя Object.is его различает. Всё это идёт через math, и «math» обязан
     попасть в импорт ровно тогда, когда он нужен: лишний импорт в Go — такая
     же ошибка сборки, как недостающий. */
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
  assert.match(built.source, /^\t"math"$/mu, "«math» обязан попасть в импорт")
  for (const name of program.functions.map((fn) => fn.name)) compare(program, built, name, [[]])

  const answers = ask(built, program.functions.map((fn) => ({ fn: fn.name, args: [] })))
  assert.deepEqual(answers.map((answer) => answer.value), [
    { n: "NaN" }, { n: "Infinity" }, { n: "-Infinity" }, { n: "-0" }, { n: "1e+21" },
  ])

  /* А там, где неконечных литералов нет, «math» не импортируется вовсе. */
  assert.doesNotMatch(build(countdownProgram).source, /"math"/u)
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
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  const program = parse(flangSource)
  const built = build(program)
  assert.match(built.source, /функция flang «Длина»/u)
  assert.match(built.source, /запись FTS «Позиция»/u)

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
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  /* Ни в stdlib, ни в leetcode образцов-литералов нет — там встречаются только
     «пусто», «голова и хвост» и варианты. Значит этот путь печати главная
     сверка не проходит вовсе, и проверять его надо отдельно. Заодно здесь
     живут строки, которые обязаны пережить экранирование в литерале Go:
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
          value: ["кавычка \" внутри", "слэш \\ внутри", "перевод\nстроки", "таб\tуляция", "эмодзи 🌍", ""],
        },
      },
    ],
  }
  const built = build(program)
  assert.match(built.source, /rt\.Equal\([a-zA-Z0-9]+, rt\.Number\(0\.0\)\)/u, "образец-литерал — это сравнение значений")

  const grid = [0, -0, 1, 2, "да", "нет", true, false, null, [1, 2], [1, 2, 3], Number.NaN, 3.5]
    .map((value) => [value])
  compare(program, built, "Назвать", grid)
  compare(program, built, "Особые", [[]])

  const [special] = ask(built, [{ fn: "Особые", args: [] }])
  assert.deepEqual(decode(special.value), [
    "кавычка \" внутри", "слэш \\ внутри", "перевод\nстроки", "таб\tуляция", "эмодзи 🌍", "",
  ])
})

test("вызов по имени: неизвестная функция и неверная арность дают ошибки интерпретатора", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
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

/* ══════════════════════════ 11. форма результата ═══════════════════════════ */

test("детерминированность: две печати дают побайтово одно и то же", () => {
  const list = [listProgram, treeProgram, mutualProgram, countdownProgram, stringProgram, parse(flangSource)]
  for (const { program } of programs) list.push(program)
  for (const program of list) {
    const first = emitGo(program)
    const second = emitGo(program)
    assert.deepEqual(first, second)
    /* И ещё раз после кругосветки через JSON: вывод не зависит от того, откуда
       приехал AST. */
    const third = emitGo(JSON.parse(JSON.stringify(program)))
    assert.deepEqual(first, third)
  }
})

test("напечатанный Go ни от чего не зависит и объясняет себя", () => {
  const emitted = emitGo(treeProgram)
  const all = emitted.files.map((file) => file.content).join("\n")
  /* Только стандартная библиотека Go и собственные пакеты программы: ни одной
     внешней зависимости, поэтому и go.sum не нужен. */
  const imports = [...all.matchAll(/^\t(?:rt )?"([^"]+)"$/gmu)].map((match) => match[1])
  assert.ok(imports.length > 0)
  for (const path of imports) {
    assert.ok(
      path.startsWith("flangprogram/") || !path.includes("."),
      `внешняя зависимость «${path}» в напечатанном коде недопустима`,
    )
  }
  assert.doesNotMatch(all, /\btime\.Now\b|\bmath\/rand\b|\bos\.Getenv\b/u, "ни времени, ни случайности, ни окружения")
  assert.deepEqual(emitted.files.map((file) => file.path).sort(), [
    "Makefile",
    "cli/main.go",
    "flang/derevya.go",
    "flangrt/flang_runtime.go",
    "go.mod",
  ])
  const source = emitted.files.find((file) => file.path === "flang/derevya.go").content
  assert.match(source, /^\/\/ Сгенерировано flang \(бэкенд Go/u)
  assert.match(source, /Не редактировать руками/u)
  /* Имена flang сохраняются рядом с каждым типом и каждой функцией. */
  assert.match(source, /функция flang «Сумма дерева»/u)
  assert.match(source, /вариант «Лист» суммы типов «Дерево»/u)
  /* Рантайм печатается байт в байт из репозитория. */
  const onDisk = readFileSync(fileURLToPath(new URL("../src/emit/go/flang_runtime.go", import.meta.url)), "utf8")
  const runtime = emitted.files.find((file) => file.path === "flangrt/flang_runtime.go").content
  assert.ok(runtime.endsWith(onDisk), "рантайм обязан печататься без правок, только с шапкой")
})

test("без прогонщика печатается одна библиотека", () => {
  const emitted = emitGo(listProgram, { cli: false })
  assert.deepEqual(emitted.files.map((file) => file.path).sort(), [
    "Makefile",
    "flang/spiski.go",
    "flangrt/flang_runtime.go",
    "go.mod",
  ])
})

/* ══════════════════════════ 12. ошибки печати ═══════════════════════════ */

test("статические ошибки ловятся при печати, а не в собранной программе", () => {
  const wrongArity = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "builtin", name: "длина", args: [] } }],
  }
  assert.throws(() => emitGo(wrongArity), (error) => {
    assert.equal(errorCode(error), "FLANG_BUILTIN_ARGS")
    assert.equal(error.message, "«длина» ожидает 1 аргумент, получено 0")
    return true
  })

  const unknownName = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "var", name: "неизвестное" } }],
  }
  assert.throws(() => emitGo(unknownName), (error) => {
    assert.equal(errorCode(error), "FLANG_UNKNOWN_NAME")
    assert.equal(error.message, "имя «неизвестное» не связано")
    return true
  })

  const unknownCall = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "call", name: "Нет такой", args: [] } }],
  }
  assert.throws(() => emitGo(unknownCall), (error) => errorCode(error) === "FLANG_UNKNOWN_NAME")

  /* «Сумма» и «сумма» — разные имена модели, но один идентификатор Go. */
  const collision = {
    flang: 1,
    functions: [
      { name: "Сумма", params: [], body: { kind: "literal", value: 1 } },
      { name: "сумма", params: [], body: { kind: "literal", value: 2 } },
    ],
  }
  assert.throws(() => emitGo(collision), /идентификатор/u)

  /* Имя, которое после транслитерации совпало с тем, что печатает сам бэкенд. */
  const reserved = {
    flang: 1,
    functions: [{ name: "Call", params: [], body: { kind: "literal", value: 1 } }],
  }
  assert.throws(() => emitGo(reserved), /идентификатор/u)
})

test("затенение локальных имён и совпадение с именем функции", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
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
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  /* В Go неиспользованная переменная — ошибка компиляции, а не предупреждение.
     «случай голова и хвост», где голова телу не нужна, — обычное дело. */
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
    ],
  }
  const built = build(program)
  assert.match(built.source, /_ = /u, "неиспользованное имя обязано гаситься явно")
  compare(program, built, "Считать", [[[]], [[1, 2, 3]], ["не список"]])
  compare(program, built, "Пропустить", [[[]], [[1, 2, 3]], [null]])
})

/* ══════════════════════════ 13. тулчейн ═══════════════════════════ */

test("тулчейн Go: версия записывается в отчёт, отсутствие — честный пропуск", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  const version = execFileSync(goBin, ["version"], { encoding: "utf8", env: GO_ENV }).trim()
  t.diagnostic(`${version}; gofmt ${gofmtBin ? "найден" : "не найден — проверка форматирования пропущена"}`)
  assert.match(version, /^go version go\d+\.\d+/u)
})

/* ───────────────── литерал варианта: сверка бэкендов между собой ─────────── */

test("литерал { variant, fields } печатается вариантом, а не записью", async () => {
  /* Дефект, найденный сверкой бэкендов: emitLiteral на любом объекте делал
     запись, поэтому «ожидается вариант …» в примере превращалось в Go в
     запись, и та же программа считалась по-разному в Go и в интерпретаторе.
     Интерпретатор читает эту форму вариантом — builtins.mjs, encodedVariant. */
  const program = {
    flang: 1,
    module: "Литерал варианта",
    types: [
      {
        kind: "sum",
        name: "Ответ",
        variants: [
          { name: "Найдено", fields: [{ name: "значение", type: { kind: "number" } }] },
          { name: "Пусто", fields: [] },
        ],
      },
    ],
    functions: [
      {
        name: "Образец",
        total: true,
        params: [],
        returns: { kind: "named", name: "Ответ" },
        body: { kind: "literal", value: { variant: "Найдено", fields: { значение: 7 } } },
        examples: [],
      },
    ],
  }
  const { emitGo } = await import("../src/emit/go.mjs")
  const printed = emitGo(program).files.map((file) => file.content).join("\n")
  assert.match(
    printed,
    /rt\.Variant\("Найдено"/u,
    "литерал варианта обязан печататься конструктором варианта, а не записи",
  )
  assert.ok(
    !/rt\.Record\(.*Найдено/su.test(printed),
    "вариант не должен превращаться в запись: интерпретатор читает эту форму вариантом",
  )
})

test("запись с полями «variant» и «fields» неотличима от варианта — и это документировано", async () => {
  /* Цена одного представления вместо двух: запись программы ровно с такими
     двумя полями будет прочитана вариантом и здесь, и интерпретатором.
     Тест закрепляет, что оба ведут себя одинаково, а не что это удобно. */
  const { reifyValue } = await import("../src/builtins.mjs")
  const значение = reifyValue({ variant: "Найдено", fields: { значение: 7 } })
  assert.equal(значение.constructor.name, "FlangVariant", "интерпретатор читает эту форму вариантом")
})
