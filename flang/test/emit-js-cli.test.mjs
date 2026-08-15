/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Прогонщик напечатанного JavaScript: JSON на входе, JSON на выходе.
 *
 * ── Зачем отдельным файлом ──────────────────────────────────────────────────
 * `emit-js.test.mjs` сверяет напечатанный МОДУЛЬ, зовя его функции прямо из
 * Node. Это правильная проверка кодогенератора и негодная проверка обещания
 * языка: прямой вызов считает на стеке того, кто позвал, и объявленных 10 000
 * кадров у него нет — их не хватало НИ ОДНОЙ программе (1 378 кадров у функции
 * с сорока связываниями, 7 386 у самой тонкой). До этого файла у цели не было
 * прогонщика вовсе — единственной из восьми, — и «обычный запуск» означал
 * «прямой вызов», то есть чужой стек и не тот отказ.
 *
 * Здесь проверяется ровно то, что получит пользователь: напечатанный каталог
 * запускается настоящим процессом (`node flang_cli.js ./модуль.js`), запросы
 * едут трубой, ответы сверяются с интерпретатором — тем же приёмом, каким
 * сверяются остальные семь целей (`emit-python.test.mjs`, `emit-c.test.mjs`).
 *
 * ── Набор программ ──────────────────────────────────────────────────────────
 * Не выдуманные фикстуры, а всё, что в репозитории написано на самом flang:
 * `flang/stdlib/*.flang` и `flang/examples/leetcode/*.flang`. Сетка входов
 * строится из примеров функций и из порчи их аргументов заведомо неподходящими
 * значениями — там проверяются коды и тексты диагностик, вторая половина
 * наблюдаемого поведения.
 *
 * ── Изъятие ─────────────────────────────────────────────────────────────────
 * Тест «прогонщик доводит до объявленного предела» имеет зубы: рядом стоит тот
 * же вход, посчитанный прямым вызовом на своём стеке, и он обязан НЕ дойти.
 * Выломают поток из `flang_cli.js` — прогонщик сравняется с прямым вызовом, и
 * первый тест покраснеет, а не промолчит.
 */
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

import { errorCode } from "../src/compat.mjs"
import { evaluate as interpret, variant } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"
import { emitJs } from "../src/emit/js.mjs"

const workdir = await mkdtemp(join(tmpdir(), "flang-emit-js-cli-"))
after(async () => {
  await rm(workdir, { recursive: true, force: true })
})

let serial = 0

/* ───────────────────── печать, проверка, запуск ───────────────────── */

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

const builds = new Map()

function build(program, options = {}) {
  if (Object.keys(options).length > 0) return buildFresh(program, options)
  const existing = builds.get(program)
  if (existing !== undefined) return existing
  const built = buildFresh(program, options)
  builds.set(program, built)
  return built
}

/**
 * Печатает программу в ПУСТОЙ каталог и проверяет ровно то, что напечатано.
 * Ничего не подкладывается из репозитория: если бы прогонщик работал только
 * потому, что лежит рядом, дыра нашлась бы у первого же пользователя.
 */
function buildFresh(program, options) {
  serial += 1
  const directory = join(workdir, `p${serial}`)
  mkdirSync(directory, { recursive: true })
  const emitted = emitJs(program, options)
  for (const file of emitted.files) {
    mkdirSync(dirname(join(directory, file.path)), { recursive: true })
    writeFileSync(join(directory, file.path), file.content, "utf8")
  }
  assert.deepEqual(listFiles(directory).sort(), emitted.files.map((file) => file.path).sort())
  return { directory, emitted, module: emitted.files[0].path }
}

/** Один процесс на сколько угодно запросов: запуск дорог, запрос дёшев. */
function ask(built, requests) {
  const input = `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`
  const output = execFileSync(process.execPath, ["flang_cli.js", `./${built.module}`], {
    cwd: built.directory,
    input,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  })
  const lines = output.split("\n").filter((line) => line.length > 0)
  assert.equal(lines.length, requests.length, "прогонщик обязан ответить на каждый запрос ровно один раз")
  return lines.map((line) => JSON.parse(line))
}

/* ───────────────────── значения на проводе ─────────────────────
   Кодирование и раскодирование списаны с `emit-c.test.mjs` и
   `emit-python.test.mjs` знак в знак: протокол у восьми целей ОДИН, и своя
   редакция его здесь означала бы, что сверяются два разных протокола. */

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
   так проверяются не значения, а коды и тексты диагностик. */
const ЧУЖИЕ = [null, "не то", 42, true, [], [1, "два"], { "поле": 1 }, variant("Нет такого", {})]

function paramType(fn, index) {
  const param = fn.params?.[index]
  return param !== null && typeof param === "object" ? param.type ?? null : null
}

/**
 * Годится ли чужое значение на это место.
 *
 * Два исключения, и оба названы, а не подразумеваются.
 *
 * Первое — параметр типа «функция»: чужое значение на месте тега отвергают ОБЕ
 * стороны, но разными словами (`flang/cat/HOF.md`, «Одно расхождение, и оно
 * названо»), и сверяются они дословно и отдельно, в `stdlib-hof.test.mjs`.
 *
 * Второе — ЧИСЛО на месте числа. `42` в этом списке стоит затем, чтобы попасть
 * на место списка, строки или варианта; на месте параметра, объявленного
 * числом, оно не чужое вовсе — это законный вход, и сверять на нём нечего.
 * Зато стоит он дорого: у перебора с отсечением (`022-generate-parentheses`)
 * цена экспоненциальна по этому самому параметру, и «сверка» на нём
 * превращается в зависание — то есть в тест, который ничего не проверяет и
 * никогда не кончается.
 */
function alienFits(fn, index, alien) {
  const type = paramType(fn, index)
  if (type?.kind === "fn") return false
  if (type?.kind === "number" && typeof alien === "number") return false
  return true
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
    for (const alien of ЧУЖИЕ) {
      if (!alienFits(fn, index, alien)) continue
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
   том же пределе счётчик JS всегда меньше, и упереться в лимит первым может
   только интерпретатор. Такие точки сверяются по коду ошибки, а не по тексту:
   текст содержит число шагов, а оно у двух счётчиков разное по построению. */
const ПРЕДЕЛЫ = { maxSteps: 5_000_000, maxDepth: 10_000 }

test("stdlib и leetcode: ответы прогонщика совпадают с интерпретатором", async (t) => {
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
        limited += 1
        if (!byEmitted.ok) {
          assert.equal(byEmitted.code, "FLANG_RECURSION_LIMIT",
            `${file} / «${point.name}»: интерпретатор упёрся в лимит, прогонщик дал ${describeOutcome(byEmitted)}`)
        }
        return
      }
      assert.ok(
        sameOutcome(byInterpreter, byEmitted),
        `${file} / «${point.name}» на входе ${JSON.stringify(point.args) ?? "?"}: ` +
          `интерпретатор дал ${describeOutcome(byInterpreter)}, прогонщик дал ${describeOutcome(byEmitted)}`,
      )
      points += 1
    })
  }

  t.diagnostic(
    `программ: ${programs.length}, функций: ${functions}, сверенных входов: ${points}` +
      `${limited > 0 ? `, из них по лимиту только по коду: ${limited}` : ""}` +
      `, за ${Math.round((Date.now() - started) / 1000)} с`,
  )
  assert.ok(functions >= 150, `функций со сверкой слишком мало: ${functions}`)
  assert.ok(points > 2000, `сетка слишком редкая: ${points}`)
})

/* ══════════════════ 2. объявленный предел глубины ══════════════════ */

/**
 * Сорок локальных связываний, и все живы на момент рекурсивного вызова — та же
 * худшая форма, на которой чинили C и на которой мерили JS (`emit-depth`).
 */
const СВЯЗЫВАНИЙ = 40
const ПРЕДЕЛ = 10_000

function толстаяПрограмма() {
  const имена = Array.from({ length: СВЯЗЫВАНИЙ }, (_, номер) => `а${String(номер + 1).padStart(2, "0")}`)
  return parse([
    "модуль «Толстый кадр»",
    "",
    "функция «Спуск»",
    "  принимает н: число",
    "  возвращает число",
    ...имена.map((имя, номер) => `  пусть ${имя} равно н плюс ${номер + 1}`),
    "  если н не больше 0",
    "    то 0",
    `    иначе (${имена.join(" плюс ")}) плюс («Спуск» от (н минус 1))`,
    "",
  ].join("\n"), "толстый-кадр.flang")
}

const толстая = толстаяПрограмма()

/* Отказ эталона на том же входе. С него списывается ТЕКСТ, а не только код.
   Предел шагов поднят намеренно: проверяется предел ГЛУБИНЫ, а шаг у
   интерпретатора мельче, и при умолчании он упёрся бы первым. */
const эталонныйОтказ = (() => {
  try {
    interpret(толстая, "Спуск", [ПРЕДЕЛ * 4], { maxDepth: ПРЕДЕЛ, maxSteps: 1_000_000_000 })
  } catch (беда) {
    return { code: беда.code, message: беда.message }
  }
  return assert.fail("эталон обязан упереться в предел глубины на этом входе")
})()

test("прогонщик доводит до ОБЪЯВЛЕННОГО предела глубины и отказывает текстом эталона", async (t) => {
  assert.equal(эталонныйОтказ.code, "FLANG_RECURSION_LIMIT")
  assert.equal(
    эталонныйОтказ.message,
    `функция «Спуск» превысила предел глубины вызовов (${ПРЕДЕЛ}) на глубине ${ПРЕДЕЛ + 1}`,
  )

  const built = build(толстая)
  const [ответ] = ask(built, [{
    fn: "Спуск",
    args: [encode(ПРЕДЕЛ * 4)],
    depth: String(ПРЕДЕЛ),
    steps: "1000000000",
  }])
  assert.equal(ответ.ok, false, `прогонщик обязан отказать: ${JSON.stringify(ответ)}`)
  assert.equal(ответ.code, эталонныйОтказ.code)
  assert.equal(ответ.message, эталонныйОтказ.message, "текст отказа обязан совпасть с эталоном дословно")

  /* И считает он то же самое, что прямой вызов: стек меняется, смысл — нет.
     Без этой строки тест зеленел бы и на «прогонщике, который всегда
     отказывает». */
  const [малое] = ask(built, [{ fn: "Спуск", args: [encode(3)], depth: String(ПРЕДЕЛ), steps: "1000000000" }])
  assert.equal(малое.ok, true, JSON.stringify(малое))
  assert.equal(decode(малое.value), interpret(толстая, "Спуск", [3], { maxDepth: ПРЕДЕЛ, maxSteps: 1_000_000_000 }))

  t.diagnostic(`при ${СВЯЗЫВАНИЙ} связываниях прогонщик дошёл до ${ПРЕДЕЛ + 1} и отказал текстом эталона`)
})

test("изъятие: тот же вход прямым вызовом до объявленного предела НЕ доходит", async (t) => {
  /* Долг, каким он был до прогонщика: обычный запуск — это прямой вызов, а он
     считает на стеке того, кто позвал. Отказ объявленный (сторож на месте), но
     текст называет хозяина, а не предел, и глубина много меньше обещанной.
     Это и есть доказательство изъятием: выломают поток из `flang_cli.js` —
     верхний тест сравняется с этим и покраснеет. */
  const built = build(толстая)
  const модуль = await import(pathToFileURL(join(built.directory, built.module)).href)
  модуль.$newContext({ maxDepth: ПРЕДЕЛ, maxSteps: 0 })
  let свой = null
  try {
    модуль.spusk(ПРЕДЕЛ * 4)
  } catch (беда) {
    свой = { code: беда.code, message: беда.message }
  }
  assert.ok(свой !== null, "на своём стеке программа обязана отказать, а не досчитать")
  assert.equal(свой.code, "FLANG_RECURSION_LIMIT", "код из закрытого набора видов отказа")
  assert.notEqual(свой.message, эталонныйОтказ.message, "прямой вызов не имеет права дать текст эталона")
  const кадры = Number(/на глубине (\d+)/u.exec(свой.message)?.[1])
  assert.ok(
    кадры > 0 && кадры < ПРЕДЕЛ,
    `без прогонщика объявленный предел обязан оставаться недостижимым, иначе тест беззуб: ${кадры}`,
  )
  t.diagnostic(`прямой вызов несёт ${кадры} кадров при обещанных ${ПРЕДЕЛ}; прогонщик доходит до ${ПРЕДЕЛ + 1}`)
})

/* ══════════════════ 3. протокол ══════════════════ */

test("прогонщик печатается байт в байт одинаково для любой программы", () => {
  const первый = build(programs[0].program).emitted.files
  const второй = build(programs[1].program).emitted.files
  const cli = (files) => files.find((file) => file.path === "flang_cli.js").content
  /* Шапка называет модуль и способ запуска — она своя; тело обязано совпасть. */
  const тело = (текст) => текст.slice(текст.indexOf("/* SPDX"))
  assert.equal(тело(cli(первый)), тело(cli(второй)))
  assert.notEqual(первый[0].content, второй[0].content, "а модули у разных программ, конечно, разные")
})

test("отказы протокола: код CLI и те же тексты, что у семи остальных целей", () => {
  const built = build(programs[0].program)
  const имя = programs[0].program.functions[0].name
  const запросы = [
    "не json вовсе",
    "[1,2,3]",
    JSON.stringify({ fn: 42 }),
    JSON.stringify({ args: [] }),
    JSON.stringify({ fn: имя, depth: 10_000 }),
    JSON.stringify({ fn: имя, steps: "полтора вагона" }),
    JSON.stringify({ fn: имя, args: "не список" }),
    JSON.stringify({ fn: имя, чепуха: "1" }),
  ]
  const input = `${запросы.join("\n")}\n`
  const output = execFileSync(process.execPath, ["flang_cli.js", `./${built.module}`], {
    cwd: built.directory,
    input,
    encoding: "utf8",
  })
  const ответы = output.split("\n").filter((line) => line.length > 0).map((line) => JSON.parse(line))
  assert.deepEqual(ответы, [
    { ok: false, code: "CLI", message: "неразборчивый запрос" },
    { ok: false, code: "CLI", message: "ожидался объект запроса" },
    { ok: false, code: "CLI", message: "неразборчивое имя функции" },
    { ok: false, code: "CLI", message: "в запросе нет имени функции" },
    { ok: false, code: "CLI", message: "неразборчивый предел глубины" },
    { ok: false, code: "CLI", message: "неразборчивый предел шагов" },
    { ok: false, code: "CLI", message: "неразборчивые аргументы" },
    { ok: false, code: "CLI", message: "неизвестное поле запроса" },
  ])
})

test("модуля нет — отказ протокола и ненулевой код, а не стопка кадров хозяина", () => {
  const built = build(programs[0].program)
  const запуск = spawnSync(process.execPath, ["flang_cli.js", "./такого-модуля-нет.js"], {
    cwd: built.directory,
    input: "",
    encoding: "utf8",
  })
  assert.equal(запуск.status, 1)
  assert.deepEqual(JSON.parse(запуск.stdout.trim()), {
    ok: false,
    code: "CLI",
    message: "не прочитан модуль программы «./такого-модуля-нет.js»",
  })
})

test("неизвестное имя и не та арность — теми же словами, что у интерпретатора", () => {
  const { program } = programs.find((item) => item.file === "optional.flang")
  const built = build(program)
  const [нет, арность] = ask(built, [
    { fn: "Такой функции нет", args: [] },
    { fn: "Обернуть", args: [] },
  ])
  assert.deepEqual(нет, { ok: false, ...outcomeRefusal(program, "Такой функции нет", []) })
  assert.deepEqual(арность, { ok: false, ...outcomeRefusal(program, "Обернуть", []) })
})

/** Отказ эталона на том же вызове — код и текст, без выдумывания их руками. */
function outcomeRefusal(program, name, args) {
  const итог = outcome(() => interpret(program, name, args, ПРЕДЕЛЫ))
  assert.equal(итог.ok, false, `интерпретатор обязан отказать на «${name}»`)
  return { code: итог.code, message: итог.message }
}

test("значения переживают провод: −0, NaN, бесконечности, порядок полей, вложенность", () => {
  const { program } = programs.find((item) => item.file === "optional.flang")
  const built = build(program)
  const значения = [-0, 0, NaN, Infinity, -Infinity, 1e21, 1e-7, 0.1, -1.5]
  const ответы = ask(built, значения.map((значение) => ({ fn: "Обернуть", args: [encode(значение)] })))
  значения.forEach((значение, номер) => {
    const итог = answerOutcome(ответы[номер])
    assert.ok(итог.ok, describeOutcome(итог))
    assert.ok(
      sameValue(итог.value, interpret(program, "Обернуть", [значение])),
      `${значение}: провод потерял значение — приехало ${JSON.stringify(ответы[номер])}`,
    )
  })
})

/* ══════════════════ 4. модуль остался браузерным ══════════════════ */

test("прогонщик — соседний файл: модуль по-прежнему работает в браузере", () => {
  const built = build(programs[0].program)
  const модуль = built.emitted.files[0].content
  assert.doesNotMatch(модуль, /^\s*import\s/mu, "у напечатанного модуля не может быть зависимостей")
  assert.doesNotMatch(модуль, /\bprocess\b|\brequire\b|\bBuffer\b|worker_threads/u, "модуль обязан работать и в браузере")
  /* А прогонщику всё это можно и нужно: он Node и только Node. */
  const прогонщик = built.emitted.files[1].content
  assert.equal(built.emitted.files[1].path, "flang_cli.js")
  assert.match(прогонщик, /node:worker_threads/u, "без потока предел глубины остаётся чужим")
  assert.match(прогонщик, /\$PROGRAM\.stackMb/u, "размер стека приезжает из модуля, а не выдумывается здесь")
})
