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
import { readFileSync, realpathSync } from "node:fs"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { checkFacts } from "../src/factcheck.mjs"
import { errorCode, evaluateFlang, fromFtsDocument, runExamples } from "../src/compat.mjs"
import { возможностиЦели } from "../src/conc.mjs"

/*
 * Версия читается из package.json, а не пишется здесь строкой. Написанная
 * строкой, она и разошлась: пакет уехал на 0.4.5, формула Homebrew — на 0.4.5,
 * а «flang version» до сих пор отвечал «0.1.0». Одно имя, два инструмента
 * (Node и напечатанный в C бинарник) и три разные версии — это не мелочь, по
 * версии человек решает, что у него установлено.
 */
const ВЕРСИЯ = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version

const HELP = `flang — полный язык поверх FTS

Использование:
  flang check <файл> [--proof [--json]] [--pretty]
  flang run   <файл> --function «Имя» --args '{"поле": 1}' [--max-steps N]
                     [--max-depth N] [--pretty]
  flang test  <файл> [--pretty]
  flang facts <файл> --facts факты.json --claims '["…"]' [--steps N] [--pretty]
  flang ast   <файл> [--pretty]
  flang emit  <файл> --target <язык> [--out каталог] [--cli|--no-cli] [--no-check]
                     [--index-base 0|1] [--max-depth N] [--max-steps N] [--pretty]
  flang io    <файл> [--plan «Имя»] [--seed N] [--in-dir] [--max-orders N]
                     [--no-read] [--no-write] [--no-net] [--no-clock] [--no-random]
  flang repl  [файл] [--max-steps N] [--max-depth N]
  flang version

Файл: .fts (модель FTS), .json (AST) или .flang (исходник).
Результат — JSON в stdout, диагностика — JSON в stderr, ошибка — ненулевой код.

check --proof: ведомость доказательства. По каждой функции — чем несётся её
обещание «тотальная» (композицией, структурой, постоянным шагом со сторожем,
объявленной мерой со сторожем), по каждому закону — размер сетки, на которой
смотрели, и отдельно то, что принято на веру. Слово «доказано» стоит только
там, где утверждение про ВСЕ входы; «сетка N» — посчитано на N значениях автора
и не является доказательством. Без --proof вывод check прежний. С --json
ведомость едет полем «proof» в том же JSON, что и раньше.

emit: цели берутся из src/emit (по одному модулю на язык); без --out файлы
уходят в stdout вместе с путями, с --out записываются в каталог. Печать сначала
ПРОВЕРЯЕТ программу теми же проверками, что и check, и отказывается печатать
непроверенное: «тотальная», надзор и типы обещают что-то только потому, что
программа, которая обещания не держит, не собирается. --no-check снимает
проверку — для отладки самой печати, когда смотрят на порождённый код.

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
    process.stdout.write(`${ВЕРСИЯ}\n`)
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
  const внешнее = await checkProgram(program)
  const diagnostics = внешнее.diagnostics
  const result = {
    valid: diagnostics.length === 0,
    module: program.module ?? null,
    functions: (program.functions ?? []).map((fn) => ({ name: fn.name, total: fn.total === true })),
    types: (program.types ?? []).map((type) => type.name),
    diagnostics,
  }
  if (!result.valid) {
    /* Отказ печатается одинаково с ведомостью и без неё, и это не упрощение:
       ведомость говорит, чем несётся обещание, а у программы с отказом обещания
       нет — «доказано» в такой ведомости было бы неправдой про каждую строку. */
    writeJson(result, options.pretty, process.stderr)
    return 1
  }
  /* Без ключа вывод обязан остаться байт в байт прежним: ведомость — добавление,
     а не замена, и всё, что читает `flang check` сегодня, читает его и завтра. */
  if (options.proof !== true) {
    writeJson(result, options.pretty, process.stdout)
    return 0
  }

  const { proofLedger, formatProofLedger } = await import(new URL("../src/proof.mjs", import.meta.url).href)
  const ведомость = proofLedger(program, внешнее.results)
  if (options.json === true) {
    writeJson({ ...result, proof: ведомость }, options.pretty, process.stdout)
    return 0
  }
  process.stdout.write(formatProofLedger(ведомость))
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
  /* Пределы обязаны дойти до вычислителя. `--max-steps` и `--max-depth`
     разбираются на общем разборе ключей, поэтому `run` их ПРИНИМАЛ — и
     выбрасывал: `evaluateFlang` звался без четвёртого аргумента. Ключ, который
     принят и не действует, хуже отвергнутого: отвергнутый виден сразу, а этот
     обещает работу и молчит. Видно это было только на большом входе — предел по
     умолчанию (миллион шагов, около 33 000 витков числового цикла) поднять было
     нечем, хотя тот же ключ действует у `repl` и у `emit`. */
  const result = evaluateFlang(program, fn.name, args, interpretLimits(options))
  writeJson({ function: fn.name, args, result }, options.pretty, process.stdout)
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
 *
 * ── Печать обязана спросить у проверки ──────────────────────────────────────
 *
 * Проверки зовутся здесь, а не только в `check`, и это не удобство, а сам
 * договор языка. `тотальная` обещает завершение, надзор обещает разобранный
 * отказ, тип обещает форму — и все три обещания стоят на том, что программа,
 * которая их не держит, НЕ СОБИРАЕТСЯ. Пока `emit` проверок не звал, обещание
 * кончалось на границе команды: `supervision.flang` без блока `надзор «Цех»`
 * давал `check` с кодом 1 и `FLANG_UNCOVERED_FAILURE` — и он же давал
 * `emit --target go` с кодом 0 и 80 155 байтами Go, которые собираются и
 * запускаются. Отказ, о котором сказано «ошибка проверки», уезжал в
 * промышленный компилятор.
 *
 * Цена измерена, и она нулевая: все 98 программ репозитория на языке проверку
 * проходят, а те пять моделей `.fts`, что падают, падают на разборе — то есть
 * `emit` отказывал на них и до правки, тем же кодом и в том же месте.
 *
 * `--no-check` оставлен для отладки самой печати: когда смотрят на порождённый
 * код, а не на программу, требовать от программы правильности незачем. Ключ
 * явный и называется в справке, потому что молча печатать непроверенное — это
 * ровно то поведение, которое здесь исправляется.
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
  if (options.check !== false) {
    const { diagnostics } = await checkProgram(program)
    if (diagnostics.length > 0) {
      /* Диагностики уезжают в stderr целиком и в том же виде, в каком их
         печатает `check`: инструмент, который читает вывод `check`, обязан
         прочитать и этот отказ, не заводя второго разбора. Код возврата 1 —
         ошибка модели, а не вызова. */
      const первая = diagnostics[0]
      const error = new Error(
        `печать отменена: программа не проходит проверку (диагностик: ${diagnostics.length}, ` +
          `первая — ${первая.code}: ${первая.message}). ` +
          "Проверьте программу командой check; ключ --no-check печатает непроверенное для отладки самой печати",
      )
      error.diagnostics = diagnostics
      throw error
    }
  }
  const files = emittedFiles(backend.emit(program, emitOptions(options)), options.target)
  /* Возможности цели — ПОЛЕМ вывода, а не абзацем в спецификации. Инструменту
     вокруг языка надо знать не «примерно одинаково везде», а что именно у этой
     цели есть: конкурентность, параллелизм и чем это проверено. Проза не
     краснеет, поле краснеет — таблица живёт в `conc.mjs` в одном месте, и
     сторож (`flang/test/emit-conc-refuse.test.mjs`) сверяет её с поведением
     каждой цели каталога. `null` значит «цели в таблице нет» и обязан быть
     виден: подставить сюда «конкурентности нет» значило бы напечатать
     утверждение, которого никто не проверял. */
  const head = {
    target: options.target,
    module: program.module ?? null,
    возможности: возможностиЦели(options.target),
  }

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

/**
 * Пределы вычислителя по тому же правилу «только если заданы»: умолчания живут
 * в `interpret.mjs`, и подставлять их здесь значило бы завести второе место, где
 * они записаны. Отдельно от `emitOptions` потому, что `cli` и `indexBase` —
 * ключи ПЕЧАТИ: вычислителю их передавать нечего, и то, что он их сейчас молча
 * игнорирует, — совпадение, а не разрешение.
 */
function interpretLimits(options) {
  const result = {}
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
  return await markMeasure(await readProgram(source, file))
}

async function readProgram(source, file) {
  if (file.endsWith(".json")) return JSON.parse(source)
  if (file.endsWith(".fts")) return fromFtsDocument(await compileFts(source))
  if (file.endsWith(".flang") || file.endsWith(".fl")) return await parseFlang(source, file)
  /* Формат не назван расширением — пробуем по содержимому, ничего не угадывая
     молча: если ни один разбор не удался, сообщаем обо всех попытках. */
  const trimmed = source.trimStart()
  if (trimmed.startsWith("{")) return JSON.parse(source)
  return fromFtsDocument(await compileFts(source))
}

/**
 * Отметка меры — единственный шаг переднего края, который что-то приписывает
 * к разобранному.
 *
 * Пометка `тотальная` обещает завершение, и с сегодняшнего дня обещание
 * подкреплено сторожем в самой программе: там, где доказательство держится на
 * числовой мере, вызов помечается, а понижение (`src/defunc.mjs`) ставит на
 * этом месте проверку убывания. Отметку кладёт анализ — только он знает,
 * какая позиция несёт доказательство (`src/totality.mjs`,
 * `markMeasureGuards`).
 *
 * Место здесь, а не внутри восьми бэкендов, потому что стеречь надо ровно то,
 * что доказано, а доказывает анализ, и звать его из бэкенда нельзя: копия
 * понижения на самом языке (`self/defunc.flang`) анализа не видит — круг
 * импортов. Оба понижения читают отметку, а кладёт её передний край, один на
 * все команды: `run`, `emit`, `test`, `repl` получают одну и ту же программу.
 *
 * Молчаливого отказа здесь быть не должно, но и падать нельзя: `check` обязан
 * работать в том объёме, который доступен сегодня (см. `externalChecks`).
 * Программа без числовой меры проходит насквозь тем же объектом.
 */
async function markMeasure(program) {
  try {
    const { markMeasureGuards } = await import(new URL("../src/totality.mjs", import.meta.url).href)
    if (typeof markMeasureGuards !== "function") return program
    return markMeasureGuards(program)
  } catch {
    return program
  }
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

/**
 * Полный отказ или полное согласие проверки — одно место на все команды.
 *
 * Заведено потому, что до этой правки такого места не было вовсе: список
 * проверок жил внутри `commandCheck`, и звать его умела ровно одна команда.
 * `emit` брал программу тем же `loadProgram` и печатал её, не спросив ни у
 * типов, ни у тотальности, ни у надзора, — а весь смысл проверок в том, что
 * непроверенное НЕ ПЕЧАТАЕТСЯ. Пример, на котором это было видно:
 * `flang/conc/examples/supervision.flang` без блока `надзор «Цех»` даёт `check`
 * с кодом 1 и `FLANG_UNCOVERED_FAILURE`, а `emit --target go` до правки давал
 * код 0 и 80 155 байт кода — то есть обещание Г1 (`flang/conc/RESILIENCE.md`)
 * «непокрытый отказ — ошибка проверки» кончалось на границе команды `check` и
 * не касалось того, что пойдёт компилятору.
 *
 * Возвращаются и `results`: ведомость доказательства (`--proof`) печатается из
 * них же, и второй прогон проверок ради отчёта был бы платой за то, что уже
 * посчитано (см. `externalChecks`).
 *
 * @param {object} program AST flang
 * @returns {Promise<{diagnostics: object[], results: object}>}
 */
export async function checkProgram(program) {
  const внешнее = await externalChecks(program)
  return { diagnostics: [...structuralDiagnostics(program), ...внешнее.diagnostics], results: внешнее.results }
}

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

/**
 * types.mjs и totality.mjs пишет соседний агент: подключаем, как только есть.
 *
 * Возвращаются НЕ ТОЛЬКО диагностики. Раньше возвращались только они, и всё
 * остальное, что проверки успели посчитать, здесь же и терялось: `checkTotality`
 * отдавал `guards`, `descents`, `structures` и `cycles` — чем именно доказано
 * завершение каждой функции; законы отдавали `checked` и `assumed` — на какой
 * сетке смотрели и что осталось допущением. Оболочка брала из результата один
 * `diagnostics`, и по её выводу нельзя было отличить доказанное от посчитанного
 * на двенадцати значениях. Ведомость (`--proof`) печатается из этих самых
 * результатов, а не из второго прогона: считать монаду дважды значило бы платить
 * за отчёт вычислением, а расходиться потом — числами.
 *
 * Наружу — затем, чтобы свод по корпусу (`flang/scripts/proof-ledger.mjs`) и
 * проверка сходимости (`flang/test/proof.test.mjs`) считали ведомость ТЕМ ЖЕ
 * путём, каким её печатает `flang check --proof`. Второй путь к тем же числам —
 * второй ответ на один вопрос, и расходятся такие ответы молча.
 */
export async function externalChecks(program) {
  const diagnostics = []
  const results = {}
  for (const [file, names, ключ] of [
    ["../src/types.mjs", ["checkTypes", "typecheck", "check", "inferProgram"], "types"],
    ["../src/totality.mjs", ["checkTotality", "checkProgram", "analyze", "check"], "totality"],
    /* Законы моноида проверяются ВЫЧИСЛЕНИЕМ, в отличие от всего, что стоит
       выше: доказать равенство операций на всех значениях носителя нельзя, и
       проверка идёт на конечной сетке. Место здесь же — потому что для автора
       это такая же ошибка модели, как несходящийся тип; а разница между
       «доказано» и «проверено на N значениях» живёт в документации и в тексте
       сообщений, а не в том, какой командой их показывать. */
    ["../src/monoid.mjs", ["checkMonoidLaws"], "monoid"],
    /* Законы монады — там же и по той же причине, что законы моноида: равенство
       вычислений на всех значениях неразрешимо, значит проверка идёт на сетке,
       а для автора нарушенный закон — такая же ошибка модели, как несходящийся
       тип. Устройство монады при этом доказано раньше, в `checkTypes`. */
    ["../src/monad.mjs", ["checkMonadLaws"], "monad"],
    /* Обратимость изоморфизма — там же и по той же причине. До появления
       `даёт` у морфизма её не проверял никто: у стрелки не было тела, и
       кругооборот было не на чем считать. Теперь есть — но только у той пары
       стрелок, где обе реализованы; остальные остаются допущением автора,
       молча, и `flang check` о них не заговаривает. Не заговаривает — но и не
       умалчивает: в ведомости они стоят строкой «на веру», потому что
       объявление, о котором не сказано ничего, читается как проверенное. */
    ["../src/iso.mjs", ["checkIsoLaws"], "iso"],
    /* Отношения множеств — там же и по тем же причинам. Инъективность вложения
       говорит обо всех ПАРАХ значений, непустота общей части — о всём
       множестве целиком; ни то ни другое не разрешимо, значит сетка. Устройство
       обоих слов при этом доказано раньше, в `checkTypes`. Отказом становится
       только склейка у вложения — предъявленный контрпример; общая часть без
       свидетеля сюда не приходит вовсе и уходит в `assumed`, потому что «не
       нашли» — это не «нет» (flang/cat/SETS.md). */
    ["../src/sets.mjs", ["checkSetLaws"], "sets"],
  ]) {
    try {
      const module = await import(new URL(file, import.meta.url).href)
      const entry = names.map((name) => module[name]).find((value) => typeof value === "function")
      if (entry === undefined) continue
      const итог = entry(program)
      results[ключ] = итог
      diagnostics.push(...normalizeDiagnostics(итог))
    } catch {
      /* модуля ещё нет — check работает в объёме, который доступен сегодня */
    }
  }

  /* Обязательства и ядро идут ПОСЛЕ остальных и отдельным шагом, а не строкой в
     таблице выше, по двум причинам, и обе содержательные.
     ПЕРВАЯ: обязательствам нужен результат анализа завершаемости — они читают у
     него, чем доказана мера, чтобы не отвечать вторым графом вызовов на вопрос,
     на который он уже ответил. Значит порядок здесь значим, а таблица выше
     порядка не обещает.
     ВТОРАЯ: ядру нужны обязательства. Цепочка «цель → предложенное
     доказательство → вердикт» однонаправленна, и записать её тремя строками
     таблицы, каждая из которых зовёт `entry(program)`, было бы неправдой о том,
     что от чего зависит. */
  try {
    const { obligations } = await import(new URL("../src/obligations.mjs", import.meta.url).href)
    const итог = obligations(program, results)
    results.obligations = итог
    diagnostics.push(...normalizeDiagnostics(итог))
    try {
      const { checkProofs } = await import(new URL("../src/proofterm.mjs", import.meta.url).href)
      const вердикты = checkProofs(program, итог.obligations)
      results.proofs = вердикты
      diagnostics.push(...normalizeDiagnostics(вердикты))
    } catch {
      /* ядра ещё нет — обязательства при этом уже посчитаны и видны */
    }
  } catch {
    /* модуля ещё нет — check работает в объёме, который доступен сегодня */
  }
  return { diagnostics, results }
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
    } else if (arg === "--no-check") {
      /* Отказаться от проверки можно только явно, и только у `emit`: печать без
         проверки — отладочный режим, а не второй способ печатать. Умолчания
         «проверять» здесь нет отдельным ключом `--check` по той же причине, по
         какой его нет у `--cli`: осмысленно только отступление от умолчания. */
      options.check = false
    } else if (arg === "--pretty") {
      options.pretty = true
    } else if (arg === "--proof") {
      options.proof = true
    } else if (arg === "--json") {
      /* `--json` осмысленен только рядом с `--proof`: без него `check` и так
         печатает JSON, и запрещать ключ значило бы ломать вызов, который уже
         верен. Ведомость же по умолчанию печатается человеку словами. */
      options.json = true
    } else if (arg.startsWith("--")) {
      throw usage(`неизвестный ключ ${arg}`)
    } else {
      positional.push(arg)
    }
  }
  options.command = positional[0] ?? "help"
  options.file = positional[1] ?? "-"
  /* Ключи ведомости осмысленны только у `check`, и промолчать о них у остальных
     команд нельзя: до этой правки `flang emit … --json` был отказом «неизвестный
     ключ», и остаться ему отказом честнее, чем стать ничего не делающим ключом.
     Молча проглоченный ключ — это вызов, который выглядит верным и не работает. */
  for (const ключ of ["--proof", "--json"]) {
    if (options[ключ === "--proof" ? "proof" : "json"] === true && options.command !== "check") {
      throw usage(`${ключ} — ключ команды check, а не «${options.command}»`)
    }
  }
  /* То же правило и той же ценой для `--no-check`: у `check` он был бы отказом
     от самого себя, у `run` и `test` — обещанием, которого команда не даёт. */
  if (options.check === false && options.command !== "emit") {
    throw usage(`--no-check — ключ команды emit, а не «${options.command}»`)
  }
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
