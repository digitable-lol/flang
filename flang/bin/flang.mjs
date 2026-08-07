#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * CLI flang.
 *
 * Контракт вывода повторяет `src/cli.ts` ядра, потому что инструменты вокруг
 * FTS (скрипты, агенты, CI) уже умеют его читать: результат — JSON в stdout,
 * диагностика — JSON в stderr, отказ — ненулевой код возврата. Расхождение в
 * контракте вывода стоило бы дороже, чем любая «улучшенная» подача.
 *
 *   flang check <файл>                             разбор + типы + тотальность
 *   flang run   <файл> --function «Имя» --args '{…}'
 *   flang test  <файл>                             примеры всех функций
 *   flang facts <файл> --facts f.json --claims '["…"]'
 *   flang ast   <файл>                             печать AST
 *   flang emit  <файл> --target c|go|js            печать в целевой язык
 *   flang repl  [файл]                             интерактивная оболочка
 *
 * `repl` — единственная команда, которая не подчиняется контракту JSON: она
 * разговаривает с человеком, а не с инструментом, и печатает значения
 * поверхностью языка. Диагностика и здесь уходит в stderr, поэтому
 * `flang repl < сценарий.flang 2>ошибки` разделяется как обычно.
 *
 * Файл — `.fts` (модель FTS, переводится мостом), `.json` (готовый AST) или
 * `.flang` (исходник; разбирается `parser.mjs`, как только он появится).
 * Поддержка `.fts` здесь не «бонус», а тот же тезис, что и у моста: любая
 * существующая модель FTS — валидная программа flang.
 */
import { realpathSync } from "node:fs"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { checkFacts } from "../src/factcheck.mjs"
import { errorCode, evaluateFlang, fromFtsDocument, runExamples } from "../src/compat.mjs"

const HELP = `flang — полный язык поверх FTS

Использование:
  flang check <файл> [--pretty]
  flang run   <файл> --function «Имя» --args '{"поле": 1}' [--pretty]
  flang test  <файл> [--pretty]
  flang facts <файл> --facts факты.json --claims '["…"]' [--steps N] [--pretty]
  flang ast   <файл> [--pretty]
  flang emit  <файл> --target <язык> [--out каталог] [--cli|--no-cli]
                     [--index-base 0|1] [--max-depth N] [--max-steps N] [--pretty]
  flang io    <файл> [--plan «Имя»] [--seed N] [--in-dir] [--max-orders N]
                     [--no-read] [--no-write] [--no-net] [--no-clock] [--no-random]
  flang repl  [файл] [--max-steps N] [--max-depth N]
  flang version

Файл: .fts (модель FTS), .json (AST) или .flang (исходник).
Результат — JSON в stdout, диагностика — JSON в stderr, ошибка — ненулевой код.

emit: цели берутся из src/emit (по одному модулю на язык); без --out файлы
уходят в stdout вместе с путями, с --out записываются в каталог.

io: исполняет объявленный в файле план. Язык остаётся чистым — поручения
строит программа, выполняет их хозяин на Node, и ключи --no-… его сужают.
В выводе есть журнал выданных поручений и полученных откликов.

repl: интерактивная оболочка. Объявления накапливаются в сессии, выражения
вычисляются сразу, «.помощь» показывает команды. Файл в аргументе загружается
в сессию при запуске. Это единственная команда с человеческим выводом вместо
JSON.
`

export async function main(argv = process.argv.slice(2)) {
  let options
  try {
    options = parseArgs(argv)
  } catch (error) {
    writeJson(errorResult(error), false, process.stderr)
    return 2
  }

  if (options.command === "help" || options.command === "--help" || options.command === "-h") {
    process.stdout.write(HELP)
    return 0
  }
  if (options.command === "version" || options.command === "--version" || options.command === "-v") {
    process.stdout.write("0.1.0\n")
    return 0
  }

  try {
    switch (options.command) {
      case "check":
        return await commandCheck(options)
      case "ast":
        return await commandAst(options)
      case "run":
        return await commandRun(options)
      case "test":
        return await commandTest(options)
      case "facts":
        return await commandFacts(options)
      case "emit":
        return await commandEmit(options)
      case "io":
        return await commandIo(options)
      case "repl":
        return await commandRepl(options)
      default:
        process.stderr.write(`unknown command '${options.command}'\n\n${HELP}`)
        return 2
    }
  } catch (error) {
    writeJson(errorResult(error), options.pretty, process.stderr)
    /* Ошибка вызова (не хватает ключа, кривой JSON) — код 2, как в ядре;
       ошибка модели или вычисления — код 1. */
    return error?.usage === true ? 2 : 1
  }
}

/* ───────────────────────────────── команды ──────────────────────────────── */

async function commandCheck(options) {
  const program = await loadProgram(options.file)
  const diagnostics = [...structuralDiagnostics(program), ...(await externalDiagnostics(program))]
  const result = {
    valid: diagnostics.length === 0,
    module: program.module ?? null,
    functions: (program.functions ?? []).map((fn) => ({ name: fn.name, total: fn.total === true })),
    types: (program.types ?? []).map((type) => type.name),
    diagnostics,
  }
  if (!result.valid) {
    writeJson(result, options.pretty, process.stderr)
    return 1
  }
  writeJson(result, options.pretty, process.stdout)
  return 0
}

async function commandAst(options) {
  writeJson(await loadProgram(options.file), options.pretty, process.stdout)
  return 0
}

async function commandRun(options) {
  if (options.functionName === undefined) throw usage("run требует --function «Имя»")
  const program = await loadProgram(options.file)
  const fn = (program.functions ?? []).find((item) => item.name === options.functionName)
  if (fn === undefined) throw fail("FLANG_UNKNOWN_NAME", `не найдена функция «${options.functionName}»`)
  const args = bindArguments(fn, options.args ?? {})
  writeJson({ function: fn.name, args, result: evaluateFlang(program, fn.name, args) }, options.pretty, process.stdout)
  return 0
}

async function commandTest(options) {
  const program = await loadProgram(options.file)
  const result = runExamples(program)
  if (!result.valid) {
    writeJson(result, options.pretty, process.stderr)
    return 1
  }
  writeJson(result, options.pretty, process.stdout)
  return 0
}

async function commandFacts(options) {
  if (options.claims === undefined) throw usage("facts требует --claims '[\"…\"]'")
  const program = await loadProgram(options.file)
  const facts = options.factsFile === undefined ? {} : JSON.parse(await readInput(options.factsFile))
  const limits = options.steps === undefined ? undefined : { steps: options.steps }
  const verdict = checkFacts(program, { facts, claims: options.claims, limits })
  /* Опровергнутое утверждение — это результат работы, а не сбой инструмента:
     JSON уходит в stdout. Ненулевой код нужен, чтобы CI мог на нём падать. */
  writeJson(verdict, options.pretty, process.stdout)
  return verdict.ok ? 0 : 1
}

/**
 * `flang io` — единственная команда, которая ДЕЙСТВИТЕЛЬНО что-то делает.
 *
 * Всё остальное в этом CLI чисто: разбирает, проверяет, вычисляет, печатает.
 * Здесь программа впервые получает файл, сеть и часы — и получает их не сама, а
 * от хозяина (`src/host/node.mjs`), которому эта команда и передаёт управление.
 *
 * Полномочия сужаются ключами (`--no-net`, `--no-write`, `--in-dir`), и это не
 * украшение: чистый язык тем и ценен, что описание действия можно прочитать до
 * того, как оно случилось. Отказ хозяина приходит программе откликом `«Сбой»`,
 * а не падением — программа обязана уметь его встретить.
 *
 * В выводе есть журнал: какие поручения были выданы и что на них ответили. Это
 * то же самое, что тест увидит от поддельного хозяина, — значит настоящий
 * прогон и проверка без эффектов сравнимы напрямую.
 */
async function commandIo(options) {
  const { runPlan, findPlan } = await import(new URL("../src/io.mjs", import.meta.url).href)
  const { nodeHost } = await import(new URL("../src/host/node.mjs", import.meta.url).href)

  const program = await loadProgram(options.file)
  const план = findPlan(program, options.planName)
  const хозяин = nodeHost({
    base: options.file === "-" ? process.cwd() : dirname(resolve(options.file)),
    разрешено: options.allow,
    seed: options.seed,
    внутриКорня: options.inDir === true,
  })

  const итог = await runPlan(program, план.name, хозяин, {
    maxSteps: options.maxSteps,
    maxDepth: options.maxDepth,
    maxOrders: options.maxOrders,
  })
  writeJson(
    {
      plan: план.name,
      result: итог.значение,
      orders: итог.поручений,
      log: итог.журнал,
    },
    options.pretty,
    process.stdout,
  )
  return 0
}

/* ─────────────────────────── интерактивная оболочка ─────────────────────── */

/**
 * `flang repl` — терминал вокруг сессии из `src/repl.mjs`.
 *
 * Здесь только терминал: приглашения, история, склейка многострочного ввода и
 * выбор потока для печати. Всё, что решает, чем является строка и что с ней
 * делать, живёт в ядре сессии и потому проверяется тестом без терминала.
 *
 * Многострочность собирается ровно одним правилом: строки копятся, пока
 * `needsMore` говорит «объявление не закончено», и пустая строка заканчивает
 * ввод всегда. Остаток буфера отправляется на вычисление при конце ввода —
 * иначе `flang repl < сценарий.flang` терял бы последнее объявление файла,
 * если автор не оставил в конце пустую строку.
 */
async function commandRepl(options) {
  const { createSession, formatResult, GREETING } = await import(new URL("../src/repl.mjs", import.meta.url).href)
  const { createInterface } = await import("node:readline")

  const session = createSession({
    base: process.cwd(),
    maxSteps: options.maxSteps,
    maxDepth: options.maxDepth,
  })
  /* Приглашения печатаются только человеку: под конвейером они попали бы в
     вывод и испортили его тому, кто читает результат сценария. */
  const interactive = process.stdin.isTTY === true
  let failed = false

  const print = (result) => {
    const text = formatResult(result)
    if (text === "") return
    if (result.kind === "diagnostics") {
      failed = true
      process.stderr.write(`${text}\n`)
      return
    }
    process.stdout.write(`${text}\n`)
  }

  if (interactive) process.stdout.write(`${GREETING}\n`)
  if (options.file !== "-") print(await session.load(options.file))

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: interactive, historySize: 500 })
  let buffer = []
  const prompt = (text) => {
    if (!interactive) return
    rl.setPrompt(text)
    rl.prompt()
  }
  /* Ctrl-C бросает набранное, но не сессию: набранное дешевле повторить, чем
     объявленное. */
  rl.on("SIGINT", () => {
    buffer = []
    if (interactive) process.stdout.write("\n")
    prompt(REPL_PROMPT)
  })

  prompt(REPL_PROMPT)
  for await (const line of rl) {
    buffer.push(line)
    const text = buffer.join("\n")
    if (session.needsMore(text)) {
      prompt(REPL_CONTINUATION)
      continue
    }
    buffer = []
    const result = await session.submit(text)
    if (result.kind === "quit") break
    print(result)
    prompt(REPL_PROMPT)
  }
  if (buffer.length > 0) print(await session.submit(buffer.join("\n")))
  rl.close()

  /* Человеку код возврата не нужен — он видел ошибку и продолжил работать.
     Конвейеру нужен: `flang repl < сценарий.flang` — это прогон сценария, и
     молча отдать 0 после диагностики значило бы соврать вызывающему. */
  return interactive || !failed ? 0 : 1
}

const REPL_PROMPT = "» "
const REPL_CONTINUATION = "… "

/* ────────────────────────────── печать в языки ──────────────────────────── */

/**
 * Печать программы в целевой язык.
 *
 * Программа загружается тем же `loadProgram`, что и у остальных команд, и это
 * не «переиспользование ради экономии»: только он запускает связывание
 * (`использует … из "…"`). Печать напрямую из `parse` дала бы для ядра FTS,
 * разложенного по файлам, неполную программу — и первым признаком стала бы не
 * ошибка CLI, а несобирающийся C.
 */
async function commandEmit(options) {
  const targets = await emitTargets()
  if (options.target === undefined) {
    throw usage(`emit требует --target <язык>; доступны: ${listTargets(targets)}`)
  }
  /* Бэкенд ищется до разбора файла: неизвестная цель — ошибка вызова, и
     сообщать о ней после минуты связывания модулей было бы издевательством. */
  const backend = await loadEmitter(options.target, targets)
  const program = await loadProgram(options.file)
  const files = emittedFiles(backend.emit(program, emitOptions(options)), options.target)
  const head = { target: options.target, module: program.module ?? null }

  if (options.out === undefined) {
    /* Пути видны рядом с содержимым: одной программе соответствует несколько
       файлов (рантайм, модуль, прогонщик, Makefile), и без путей вывод не
       разложить обратно. Форма — JSON, как у всех команд: инструменты вокруг
       FTS уже умеют её читать. */
    writeJson({ ...head, files }, options.pretty, process.stdout)
    return 0
  }

  const out = resolve(process.cwd(), options.out)
  for (const file of files) {
    const path = resolve(out, file.path)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, file.content, "utf8")
  }
  writeJson(
    { ...head, out, files: files.map((file) => ({ path: file.path, bytes: Buffer.byteLength(file.content, "utf8") })) },
    options.pretty,
    process.stdout,
  )
  return 0
}

const EMIT_DIRECTORY = new URL("../src/emit/", import.meta.url)

/**
 * Реестр бэкендов — сам каталог `src/emit`, а не список в этом файле (тот же
 * приём, что в tools/ftsc/src/targets.mjs). Новый язык подключается тем, что
 * рядом с c.mjs, go.mjs и js.mjs появляется ещё один модуль: правок в CLI это
 * не требует ни при печати, ни в справке, ни в диагностике неизвестной цели.
 */
export async function emitTargets() {
  try {
    const entries = await readdir(EMIT_DIRECTORY)
    return entries.filter((name) => name.endsWith(".mjs")).map((name) => name.slice(0, -".mjs".length)).sort()
  } catch {
    /* Каталога нет — команда обязана сказать «нет ни одной цели», а не упасть. */
    return []
  }
}

/**
 * Загрузка бэкенда по идентификатору цели.
 *
 * Имя функции печати не навязывается: подходит `emit` (как у бэкендов ftsc),
 * `emit<Цель>` (как у emitC/emitGo/emitJs) и вообще единственный экспорт,
 * начинающийся на «emit». Соглашение бэкендов flang — второе, но привязываться
 * к нему одному значило бы требовать правки CLI от каждого нового бэкенда.
 */
export async function loadEmitter(target, targets) {
  const known = targets ?? (await emitTargets())
  /* Проверка по списку — она же защита от «цели» вроде `../../etc/passwd`:
     дальше идентификатор попадает в URL модуля. */
  if (!known.includes(target)) {
    throw usage(`неизвестная цель «${target}»; доступны: ${listTargets(known)}`)
  }
  const module = await import(new URL(`${target}.mjs`, EMIT_DIRECTORY).href)
  const byName = [module.emit, module[`emit${target[0].toUpperCase()}${target.slice(1)}`]]
  const exact = byName.find((value) => typeof value === "function")
  if (exact !== undefined) return { target, emit: exact }

  const guessed = Object.entries(module).filter(([name, value]) => typeof value === "function" && /^emit/iu.test(name))
  if (guessed.length === 1) return { target, emit: guessed[0][1] }
  throw fail(
    "FLANG_EMIT",
    guessed.length === 0
      ? `бэкенд «${target}» не экспортирует функцию печати (ожидалось «emit» или «emit…»)`
      : `бэкенд «${target}» экспортирует несколько функций печати: ${guessed.map(([name]) => name).join(", ")}`,
  )
}

function listTargets(targets) {
  return targets.length === 0 ? "нет ни одной" : targets.join(", ")
}

/**
 * Ключи печати передаются бэкенду только если заданы: у `cli`, `indexBase`,
 * `maxDepth` и `maxSteps` есть значения по умолчанию внутри бэкенда, и
 * подставлять их здесь значило бы завести второе место, где они записаны.
 */
function emitOptions(options) {
  const result = {}
  if (options.cli !== undefined) result.cli = options.cli
  if (options.indexBase !== undefined) result.indexBase = options.indexBase
  if (options.maxDepth !== undefined) result.maxDepth = options.maxDepth
  if (options.maxSteps !== undefined) result.maxSteps = options.maxSteps
  return result
}

function emittedFiles(emitted, target) {
  const files = Array.isArray(emitted) ? emitted : Array.isArray(emitted?.files) ? emitted.files : null
  if (files === null || files.some((file) => typeof file?.path !== "string" || typeof file?.content !== "string")) {
    throw fail("FLANG_EMIT", `бэкенд «${target}» вернул не список файлов {path, content}`)
  }
  return files
}

/* ───────────────────────────── загрузка программы ───────────────────────── */

export async function loadProgram(file) {
  const source = await readInput(file)
  return loadProgramFromSource(source, file)
}

export async function loadProgramFromSource(source, file = "-") {
  if (file.endsWith(".json")) return JSON.parse(source)
  if (file.endsWith(".fts")) return fromFtsDocument(await compileFts(source))
  if (file.endsWith(".flang") || file.endsWith(".fl")) return await parseFlang(source, file)
  /* Формат не назван расширением — пробуем по содержимому, ничего не угадывая
     молча: если ни один разбор не удался, сообщаем обо всех попытках. */
  const trimmed = source.trimStart()
  if (trimmed.startsWith("{")) return JSON.parse(source)
  return fromFtsDocument(await compileFts(source))
}

/** Ядро FTS + заголовок модуля ftsc: любой `.fts` репозитория должен читаться. */
export async function compileFts(source) {
  const core = await import(new URL("../../dist/src/index.js", import.meta.url).href)
  try {
    return core.compile(source)
  } catch (error) {
    /* Файлы stdlib начинаются с заголовка `модуль …`, которого ядро не знает:
       снимаем его тем же разбором, что и ftsc, и компилируем тело. */
    const stripped = await stripModuleHeader(source)
    if (stripped === null) throw error
    return core.compile(stripped)
  }
}

export async function stripModuleHeader(source) {
  try {
    const { parseModuleFile } = await import(new URL("../../tools/ftsc/src/parse-module.mjs", import.meta.url).href)
    const parsed = parseModuleFile(source, "-")
    return parsed.kind === "module" ? parsed.body : null
  } catch {
    return null
  }
}

async function parseFlang(source, file) {
  let parse
  try {
    const parser = await import(new URL("../src/parser.mjs", import.meta.url).href)
    parse = parser.parse ?? parser.parseProgram ?? parser.parseModule
  } catch (error) {
    throw fail(
      "FLANG_PARSE",
      `разбор исходников flang недоступен: ${error instanceof Error ? error.message : String(error)}. ` +
        "Передайте .fts (модель FTS) или .json (готовый AST)",
    )
  }
  if (typeof parse !== "function") throw fail("FLANG_PARSE", "в parser.mjs нет функции разбора")

  /* Со стандартного ввода нет каталога, относительно которого разрешается
     `использует … из "…"`, поэтому связывание для него не запускаем: честный
     FLANG_UNKNOWN_NAME лучше, чем чтение файла из случайного каталога. */
  if (file !== "-") {
    const { linkProgram, importsOf } = await import(new URL("../src/link.mjs", import.meta.url).href)
    /* Разбираем сначала сами: у файла без импортов результат обязан остаться
       побайтово прежним, иначе `ast` начнёт отличаться там, где ничего не
       менялось. */
    const single = parse(source, file)
    if (importsOf(single).length === 0) return single
    const linked = await linkProgram(file, source, parse)
    if (linked.diagnostics.length > 0) {
      const error = new Error(linked.diagnostics[0].message)
      error.diagnostics = linked.diagnostics
      throw error
    }
    const { diagnostics: _ignored, ...program } = linked
    return program
  }

  /* Ошибку самого разбора не заворачиваем: у неё уже есть код, сообщение и
     span — подменять их своим текстом значит потерять место ошибки. */
  return parse(source, file)
}

/* ───────────────────────────── проверки check ───────────────────────────── */

/** Минимум, который мост обязан гарантировать сам, не дожидаясь types.mjs. */
function structuralDiagnostics(program) {
  const diagnostics = []
  const push = (code, message) => diagnostics.push({ code, message, severity: "error" })
  if (program === null || typeof program !== "object") {
    push("FLANG_PARSE", "программа не является объектом")
    return diagnostics
  }
  if (program.flang !== 1) push("FLANG_PARSE", "ожидалось поле «flang»: 1")
  if (!Array.isArray(program.functions)) push("FLANG_PARSE", "ожидался список «functions»")
  const seen = new Set()
  for (const fn of program.functions ?? []) {
    if (typeof fn.name !== "string" || fn.name === "") push("FLANG_PARSE", "у функции нет имени")
    else if (seen.has(fn.name)) push("FLANG_UNKNOWN_NAME", `функция «${fn.name}» объявлена дважды`)
    else seen.add(fn.name)
    if (fn.body === undefined) push("FLANG_PARSE", `у функции «${fn.name}» нет тела`)
    if (fn.params !== undefined && !Array.isArray(fn.params)) {
      push("FLANG_TYPE", `параметры функции «${fn.name}» должны быть списком`)
    }
    for (const example of fn.examples ?? []) {
      if (example.args === null || typeof example.args !== "object") {
        push("FLANG_TYPE", `пример «${example.name}» функции «${fn.name}» не задаёт аргументы`)
      }
    }
  }
  return diagnostics
}

/** types.mjs и totality.mjs пишет соседний агент: подключаем, как только есть. */
async function externalDiagnostics(program) {
  const diagnostics = []
  for (const [file, names] of [
    ["../src/types.mjs", ["checkTypes", "typecheck", "check", "inferProgram"]],
    ["../src/totality.mjs", ["checkTotality", "checkProgram", "analyze", "check"]],
    /* Законы моноида проверяются ВЫЧИСЛЕНИЕМ, в отличие от всего, что стоит
       выше: доказать равенство операций на всех значениях носителя нельзя, и
       проверка идёт на конечной сетке. Место здесь же — потому что для автора
       это такая же ошибка модели, как несходящийся тип; а разница между
       «доказано» и «проверено на N значениях» живёт в документации и в тексте
       сообщений, а не в том, какой командой их показывать. */
    ["../src/monoid.mjs", ["checkMonoidLaws"]],
  ]) {
    try {
      const module = await import(new URL(file, import.meta.url).href)
      const entry = names.map((name) => module[name]).find((value) => typeof value === "function")
      if (entry === undefined) continue
      diagnostics.push(...normalizeDiagnostics(entry(program)))
    } catch {
      /* модуля ещё нет — check работает в объёме, который доступен сегодня */
    }
  }
  return diagnostics
}

function normalizeDiagnostics(value) {
  if (Array.isArray(value)) return value.filter((item) => item?.severity !== "warning")
  if (value !== null && typeof value === "object" && Array.isArray(value.diagnostics)) {
    return value.diagnostics.filter((item) => item?.severity !== "warning")
  }
  return []
}

/* ───────────────────────────── аргументы вызова ─────────────────────────── */

/**
 * Утилита FTS принимает ровно один объект, поэтому `--args '{"сумма": 1}'`
 * читается как сама запись, а не как «словарь параметров». Обёртка делается,
 * только если имени параметра во входных данных нет: явная форма
 * `{"вход": {…}}` продолжает работать.
 */
export function bindArguments(fn, args) {
  const params = fn.params ?? []
  const single = params.length === 1 ? params[0] : undefined
  /* Обёртка только для функции с единственным параметром-записью — то есть для
     утилиты, пришедшей из FTS. У функции со скалярным параметром `--args
     '{"n": 1}'` уже правильной формы, и «оборачивать» там нечего. */
  if (single !== undefined && single.type?.kind === "record" && !(single.name in args)) {
    return { [single.name]: args }
  }
  return args
}

/* ─────────────────────────────── ввод-вывод ─────────────────────────────── */

async function readInput(file) {
  if (file !== "-") return readFile(file, "utf8")
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString("utf8")
}

function writeJson(value, pretty, stream) {
  stream.write(`${JSON.stringify(value, null, pretty ? 2 : 0)}\n`)
}

function errorResult(error) {
  const message = error instanceof Error ? error.message : String(error)
  const diagnostics = Array.isArray(error?.diagnostics) && error.diagnostics.length > 0
    ? error.diagnostics
    : [{ code: errorCode(error) ?? "FLANG_INTERNAL", message, severity: "error" }]
  return { error: message, diagnostics }
}

function fail(code, message) {
  const error = new Error(message)
  error.diagnostics = [{ code, message, severity: "error" }]
  return error
}

function usage(message) {
  const error = new Error(message)
  error.usage = true
  error.diagnostics = [{ code: "FLANG_CLI", message, severity: "error" }]
  return error
}

/* ───────────────────────────── разбор аргументов ────────────────────────── */

function parseArgs(argv) {
  const positional = []
  const options = { pretty: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--function" || arg === "--utility") {
      options.functionName = require_(argv[++index], "--function требует имя")
    } else if (arg === "--args") {
      options.args = parseJson(require_(argv[++index], "--args требует JSON"), "--args")
      if (options.args === null || typeof options.args !== "object" || Array.isArray(options.args)) {
        throw usage("--args должен быть JSON-объектом")
      }
    } else if (arg === "--facts") {
      options.factsFile = require_(argv[++index], "--facts требует файл JSON")
    } else if (arg === "--claims") {
      const claims = parseJson(require_(argv[++index], "--claims требует JSON-массив строк"), "--claims")
      if (!Array.isArray(claims) || claims.some((claim) => typeof claim !== "string")) {
        throw usage("--claims должен быть JSON-массивом строк")
      }
      options.claims = claims
    } else if (arg === "--steps") {
      const steps = Number(require_(argv[++index], "--steps требует число"))
      if (!Number.isFinite(steps) || steps <= 0) throw usage("--steps должен быть положительным числом")
      options.steps = steps
    } else if (arg === "--target") {
      options.target = require_(argv[++index], "--target требует имя целевого языка")
    } else if (arg === "--out") {
      options.out = require_(argv[++index], "--out требует каталог")
    } else if (arg === "--cli") {
      options.cli = true
    } else if (arg === "--no-cli") {
      /* Прогонщик печатается по умолчанию (`cli !== false` в бэкендах), поэтому
         отказаться от него можно только явно. */
      options.cli = false
    } else if (arg === "--index-base") {
      const base = Number(require_(argv[++index], "--index-base требует 0 или 1"))
      if (base !== 0 && base !== 1) throw usage("--index-base должен быть 0 или 1")
      options.indexBase = base
    } else if (arg === "--max-depth") {
      const depth = Number(require_(argv[++index], "--max-depth требует число"))
      if (!Number.isInteger(depth) || depth <= 0) throw usage("--max-depth должен быть целым положительным числом")
      options.maxDepth = depth
    } else if (arg === "--max-steps") {
      const steps = Number(require_(argv[++index], "--max-steps требует число"))
      if (!Number.isInteger(steps) || steps <= 0) throw usage("--max-steps должен быть целым положительным числом")
      options.maxSteps = steps
    } else if (arg === "--plan") {
      options.planName = require_(argv[++index], "--plan требует имя плана")
    } else if (arg === "--seed") {
      const seed = Number(require_(argv[++index], "--seed требует число"))
      if (!Number.isFinite(seed)) throw usage("--seed должен быть числом")
      options.seed = seed
    } else if (arg === "--max-orders") {
      const orders = Number(require_(argv[++index], "--max-orders требует число"))
      if (!Number.isInteger(orders) || orders <= 0) throw usage("--max-orders должен быть целым положительным числом")
      options.maxOrders = orders
    } else if (arg === "--no-read" || arg === "--no-write" || arg === "--no-net" || arg === "--no-clock" || arg === "--no-random") {
      /* Полномочия хозяина сужаются явно и по одному. Отдельного «разрешить»
         нет: умолчание — «можно всё», потому что запуск программы ключом `io`
         и есть согласие на её действия. Осмысленно только сужение. */
      const поле = { "--no-read": "чтение", "--no-write": "запись", "--no-net": "сеть", "--no-clock": "время", "--no-random": "случайность" }[arg]
      options.allow = { ...(options.allow ?? {}), [поле]: false }
    } else if (arg === "--in-dir") {
      options.inDir = true
    } else if (arg === "--pretty") {
      options.pretty = true
    } else if (arg.startsWith("--")) {
      throw usage(`неизвестный ключ ${arg}`)
    } else {
      positional.push(arg)
    }
  }
  options.command = positional[0] ?? "help"
  options.file = positional[1] ?? "-"
  return options
}

function require_(value, message) {
  if (value === undefined) throw usage(message)
  return value
}

function parseJson(text, what) {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw usage(`${what}: неверный JSON — ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Сравниваем РАЗРЕШЁННЫЕ пути, а не строки. npm ставит объявленные в bin
// команды символьными ссылками в node_modules/.bin/, Node ссылки разрешает, и
// argv[1] (путь ссылки) с import.meta.url (путь самого файла) не совпадают.
// Проверка на равенство строк давала ложь, main() не вызывался, и программа
// завершалась с кодом 0, не напечатав ни байта. Ровно так вели себя flang, fts
// и fts-mcp в опубликованной 0.4.0: `node путь/к/flang.mjs check …` работал, а
// `flang check …` после установки молчал.
const invoked = process.argv[1]
let launchedAsProgram = false
if (invoked !== undefined) {
  try {
    launchedAsProgram = realpathSync(fileURLToPath(import.meta.url)) === realpathSync(invoked)
  } catch {
    launchedAsProgram = false
  }
}
if (launchedAsProgram) {
  process.exitCode = await main()
}
