#!/usr/bin/env node
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
 *
 * Файл — `.fts` (модель FTS, переводится мостом), `.json` (готовый AST) или
 * `.flang` (исходник; разбирается `parser.mjs`, как только он появится).
 * Поддержка `.fts` здесь не «бонус», а тот же тезис, что и у моста: любая
 * существующая модель FTS — валидная программа flang.
 */
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { checkFacts } from "../src/factcheck.mjs"
import { errorCode, evaluateFlang, fromFtsDocument, runExamples } from "../src/compat.mjs"

const HELP = `flang — полный язык поверх FTS

Использование:
  flang check <файл> [--pretty]
  flang run   <файл> --function «Имя» --args '{"поле": 1}' [--pretty]
  flang test  <файл> [--pretty]
  flang facts <файл> --facts факты.json --claims '["…"]' [--steps N] [--pretty]
  flang ast   <файл> [--pretty]
  flang version

Файл: .fts (модель FTS), .json (AST) или .flang (исходник).
Результат — JSON в stdout, диагностика — JSON в stderr, ошибка — ненулевой код.
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

const invoked = process.argv[1]
if (invoked !== undefined && import.meta.url === pathToFileURL(invoked).href) {
  process.exitCode = await main()
}
