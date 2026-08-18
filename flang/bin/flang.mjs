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
 * Файл — `.flang` (исходник) или `.json` (готовый AST).
 *
 * `.fts` язык читал до 16 августа 2026: модель старого проекта переводилась
 * мостом в программу flang. Проект вынесен из репозитория (тег
 * `fts-pered-udaleniem`), читать стало нечем, и `.fts` теперь ОТКАЗ с внятным
 * текстом, а не падение на отсутствующем модуле. Разница здесь не косметическая:
 * `await import("../../dist/src/index.js")` на несуществующем пути даёт
 * ERR_MODULE_NOT_FOUND — сообщение про внутренности сборки, из которого
 * пользователю не понять ни что случилось, ни что делать.
 */
import { readFileSync, realpathSync } from "node:fs"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { checkFacts } from "../src/factcheck.mjs"
import { checkFunctorDictionary, errorCode, evaluateFlang, runExamples } from "../src/compat.mjs"
import { возможностиЦели } from "../src/conc.mjs"
import { dropUnreachable } from "../src/reachable.mjs"
/* Граница входа. Импорт статический, а не «если модуль есть» (как в
   `externalChecks`): проверка, которая молча отключается, когда её не нашли, —
   это проверка, которая не умеет краснеть. */
import { checkArguments } from "../src/types.mjs"

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
  flang check <файл> [--proof [--json]] [--размещение узлы.json] [--pretty]
  flang run   <файл> --function «Имя» --args '{"поле": 1}' [--max-steps N]
                     [--max-depth N] [--pretty]
  flang test  <файл> [--no-check] [--pretty]
  flang facts <файл> --facts факты.json --claims '["…"]' [--steps N] [--pretty]
  flang ast   <файл> [--pretty]
  flang emit  <файл> --target <язык> [--out каталог] [--cli|--no-cli] [--no-check]
                     [--index-base 0|1] [--max-depth N] [--max-steps N] [--pretty]
  flang io    <файл> [--plan «Имя»] [--seed N] [--in-dir] [--max-orders N]
                     [--no-read] [--no-write] [--no-net] [--no-clock] [--no-random]
                     [--no-spawn]
  flang repl  [файл] [--max-steps N] [--max-depth N]
  flang version

Файл: .flang (исходник) или .json (готовый AST).
Результат — JSON в stdout, диагностика — JSON в stderr, ошибка — ненулевой код.

Коды выхода io: 0 — план дошёл до «Конец работы»; 1 — план сдался сам
(«Провал»), то есть программа нашла беду в предмете; 2 — кривой вызов; 3 —
сломался инструмент (хозяин, предел поручений, не тот тип на входе шага).
Разница между 1 и 3 — это разница между «нашёл беду» и «сам сломался», и она
нужна всякому, кто ставит flang io в CI.

check --размещение: свести программу с РАЗМЕЩЕНИЕМ процессов по узлам
(flang/conc/DISTRIBUTED.md). Процесс, размещённый на другом узле, стоит здесь
представителем и умеет ровно одно — отказать FLANG_LINK_DOWN, когда связь
потеряна; забытый над ним надзор становится ошибкой сборки, как и над местным
процессом. Без ключа проверка считает, что узел один и границы нет.

check --proof: ведомость доказательства. По каждой функции — чем несётся её
обещание «тотальная» (композицией, структурой, постоянным шагом со сторожем,
объявленной мерой со сторожем), по каждому закону — размер сетки, на которой
смотрели, и отдельно то, что принято на веру. Слово «доказано» стоит только
там, где утверждение про ВСЕ входы; «сетка N» — посчитано на N значениях автора
и не является доказательством. Без --proof вывод check прежний. С --json
ведомость едет полем «proof» в том же JSON, что и раньше.

test: прогоняет примеры, объявленные внутри функций. Сначала ПРОВЕРЯЕТ программу
теми же проверками, что и check, и на непроверенной примеров не запускает:
«пример сошёлся» на программе с ошибкой типов не значит ничего — сойтись он мог
на пути, который до кривого места не дошёл. --no-check снимает проверку, чтобы
смотреть на поведение примеров, пока программа ещё в правке.

emit: цели берутся из src/emit (по одному модулю на язык); без --out файлы
уходят в stdout вместе с путями, с --out записываются в каталог. Печать сначала
ПРОВЕРЯЕТ программу теми же проверками, что и check, и отказывается печатать
непроверенное: «тотальная», надзор и типы обещают что-то только потому, что
программа, которая обещания не держит, не собирается. --no-check снимает
проверку — для отладки самой печати, когда смотрят на порождённый код.

Печать отбрасывает недостижимое: в напечатанный код попадают функции входного
файла и всё, до чего от них можно дойти, — импортированный модуль больше не
едет целиком. Точками входа считаются ещё обработчик и начальное состояние
процесса, шаг плана и имена из «экспортирует» входного модуля. Сколько функций
выброшено, видно полем «отброшено»; проверка при этом идёт по полной программе,
и ведомость доказательства не урезается.

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
  const внешнее = await checkProgram(program, {
    размещение: await loadPlacement(options.placement),
    файл: options.file,
  })
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

  /* ВЕДОМОСТЬ СЧИТАЕТ СЛОЙ НА САМОМ FLANG, а не эталон на JavaScript, и это не
     украшение отчёта. Пока «чем несётся обещание» считал `flang/src/proof.mjs`,
     слова «язык отчитывается о собственной доказуемости» держались на чужом
     языке: близнец был написан и сверен побайтово, но в рабочем пути его не
     звал никто.

     ЗАПАСНОГО ПУТИ К ЭТАЛОНУ ЗДЕСЬ НЕТ, и это то же условие, что у
     обязательств: сорвётся слой — сорвётся команда. Тихий запасной путь
     срабатывал бы молча, и рабочий путь снова считал бы эталоном, ничего об
     этом не сказав. */
  const { ведомость } = await import(new URL("../src/self.mjs", import.meta.url).href)
  const отчёт = await ведомость(program, внешнее.results)
  if (options.json === true) {
    writeJson({ ...result, proof: отчёт.значением }, options.pretty, process.stdout)
    return 0
  }
  process.stdout.write(отчёт.словами)
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
  /* ГРАНИЦА ВХОДА. Значения из `--args` приезжают JSON-ом и до этой проверки
     объявленному типу не сверялись ничем: `«Факториал» принимает н: нат`
     считался при −3 и при 2.5, а при 1e300 отказывал FLANG_RECURSION_LIMIT —
     кодом, отведённым ОБЫЧНОЙ функции. Причина не в сообщении, а в том, что
     доказательство завершения `тотальной` стоит НА ТИПЕ: у `нат` есть потолок
     2^53−1, ниже которого `н минус 1` точно меньше `н`, и сторож убывания в
     такую функцию не печатается вовсе. Значение вне типа выносит вместе с типом
     и доказательство. Поэтому сверка стоит ДО вычисления, а не внутри него:
     внутри она поймала бы ложь на той операции, которой не повезло первой, и
     только на тех входах, до которых дошло исполнение. */
  const вход = checkArguments(program, fn.name, args)
  if (!вход.ok) throw failWith(вход.diagnostics)
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

/**
 * `flang test` — прогон примеров, и с этой правки ещё и проверка программы.
 *
 * До неё команда печатала `"valid": true` на программе, которую `check` в тот же
 * миг отвергал: примеры вычисляются напрямую, мимо `checkTypes`, и ошибка типов
 * в функции БЕЗ примеров не мешала пройти примерам ОСТАЛЬНЫХ функций. Слово
 * `valid` при этом читается как приговор всей программе, а не как «примеры
 * досчитались», и в этом была вся беда: зелёный `test` давал ложный покой ровно
 * там, где язык обещает обратное.
 *
 * Порядок теперь такой же, как у `emit`: сначала те же проверки, что у `check`,
 * и только потом работа. Программа, которая обещаний не держит, примеров не
 * запускает — потому что «пример сошёлся» на непроверенной программе не значит
 * ничего: сойтись он мог случайно, на пути, который до кривого места не дошёл.
 *
 * Цена нулевая: весь корпус репозитория проверку проходит (это измерено, когда
 * ту же проверку получал `emit`), значит ни один сегодня зелёный прогон не
 * покраснеет. `--no-check` оставлен той же цели, что у `emit`, — смотреть на
 * поведение примеров, пока программа ещё в правке.
 */
async function commandTest(options) {
  const program = await loadProgram(options.file)
  if (options.check !== false) {
    const { diagnostics } = await checkProgram(program, { файл: options.file })
    if (diagnostics.length > 0) {
      /* Форма ответа прежняя — тот, кто читает `total`/`passed`/`failed`,
         читает их и здесь. Примеры не запускались, поэтому счётчики нулевые, а
         не выдуманные: `results: []` честно говорит, что не смотрели ни одного,
         и отличимо от «смотрели, все прошли». */
      writeJson(
        { valid: false, total: 0, passed: 0, failed: 0, results: [], diagnostics },
        options.pretty,
        process.stderr,
      )
      return 1
    }
  }
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
 *
 * ── Коды выхода: их четыре, и третий заведён ради одной разницы ─────────────
 *
 * Здесь стояло жёсткое `return 0`, и на нём `flang io` умел ровно два ответа: 0
 * — дошли до «Конец работы», 1 — что-то бросило. Под второй ответ попадало
 * ВСЁ: и `«Провал»` (программа решила сама), и `FLANG_IO_LIMIT`, и «хозяин
 * вернул не «Отклик»». Сторожу спек этого мало, и требование к нему записано
 * дословно: он обязан отличать «нашёл беду» от «сам сломался». Иначе красный CI
 * значит либо «спеки плохи», либо «сторож сломан», и разбираться идёт человек.
 *
 *   0 — план дошёл до «Конец работы»;
 *   1 — план сдался сам («Провал»): предмет плох, инструмент цел;
 *   2 — кривой вызов CLI (как у всех команд, `usage`);
 *   3 — сломался инструмент: хозяин, предел поручений, не тот тип на входе
 *       шага, неизвестный план, нечитаемый файл.
 *
 * Откуда берётся ЧИСЛО — вопрос, на который пришлось отвечать отдельно. Поле
 * `код` у `«Провал»` — СТРОКА (`"СПЕКИ_НЕ_СОГЛАСНЫ"`), и числом её не сделать:
 * коды отказа языка живут именами, а не номерами, и превращать их в номера
 * значило бы завести вторую таблицу кодов. Поэтому число берётся не из
 * значения, а из ПРИРОДЫ беды: `runPlan` помечает символом ту единственную
 * беду, которую подняла сама программа (`сдалсяСам` в `src/io.mjs`), и здесь
 * метка читается. Программе для нужного кода выхода не надо знать ни одного
 * числа — довольно вернуть `«Провал»`.
 *
 * Отвергнуто по дороге: брать код выхода из значения `«Конец работы»`, если оно
 * число. Тогда план, честно посчитавший 7, вышел бы с кодом 7, а `«Конец
 * работы»` — это РЕЗУЛЬТАТ плана, а не вердикт о нём; смешивать их значило бы
 * запретить планам возвращать числа. Образец взят у `commandFacts`, где
 * опровергнутое утверждение уходит в stdout, а ненулевой код нужен только
 * затем, чтобы CI мог на нём упасть.
 *
 * `process.exit()` здесь по-прежнему нет ни одного, и это решение сохранено
 * намеренно (`docs/zettel/the-instrument-lied-not-the-subject.md`): код ставится
 * ОДИН раз, `process.exitCode = await main()`, и поток вывода успевает уйти.
 */
async function commandIo(options) {
  const { runPlan, findPlan, сдалсяСам } = await import(new URL("../src/io.mjs", import.meta.url).href)
  const { nodeHost } = await import(new URL("../src/host/node.mjs", import.meta.url).href)

  try {
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
  } catch (ошибка) {
    /* Кривой вызов остаётся кривым вызовом и здесь: `--plan` без имени разбирает
       `parseArgs`, но `usage` может прилететь и отсюда. */
    if (ошибка?.usage === true) throw ошибка
    writeJson(errorResult(ошибка), options.pretty, process.stderr)
    return сдалсяСам(ошибка) ? 1 : 3
  }
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
    const { diagnostics } = await checkProgram(program, { файл: options.file })
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
  /* ── Печатается только достижимое от точки входа ──────────────────────────
     Проверка выше идёт по ПОЛНОЙ программе и остаётся полной: непроверенное не
     печатается, и ошибка в импортированном модуле обязана отменить печать, даже
     если до кривой функции никто не доходит. А вот в напечатанный код она не
     едет: `использует «Списки»` тянуло весь модуль, и у
     `examples/import-check.flang` из 29 связанных функций вызывались 2 — 1535
     строк и 68 110 байт мёртвого C из 1670 строк и 74 394 байт модуля.

     Проход стоит здесь, а не в бэкенде, по той же причине, по какой здесь стоит
     отметка меры: бэкенду отличить своё от привезённого нечем — связывание
     кладёт все модули в один плоский список, — а какой файл был входом, знает
     загрузчик. Одно место на все восемь целей (`src/reachable.mjs`). */
  const кПечати = dropUnreachable(program, ownFunctionNames(program))
  const отброшено = (program.functions?.length ?? 0) - (кПечати.functions?.length ?? 0)
  const files = emittedFiles(backend.emit(кПечати, emitOptions(options)), options.target)
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
    /* Ключ появляется, только когда что-то выброшено: у программы без импортов
       вывод обязан остаться прежним до байта. Само число — не украшение: без
       него «модуль стал меньше» пришлось бы выяснять сравнением байтов двух
       печатей. */
    ...(отброшено > 0 ? { отброшено } : {}),
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

/**
 * Имена функций, объявленных в САМОМ входном файле, — по загруженной программе.
 *
 * Это то, что печать зовёт точкой входа: связывание сливает функции всех модулей
 * в один плоский список и происхождения в AST не оставляет (`link.mjs`), а знает
 * его только загрузчик — он читал файлы.
 *
 * Хранится СБОКУ, а не полем AST, и это то же решение, что у имени файла в
 * местах (`stampFile` в `src/link.mjs`): AST описывает программу, а не то, из
 * каких файлов её собрали. Новое поле в AST — работа, которую обязаны сделать
 * ОБЕ реализации языка, иначе побайтовая сверка связанной программы с близнецом
 * (`self-bootstrap.test.mjs`) разошлась бы на первом же наборе.
 *
 * `null` значит «отбрасывать нечего»: вход не `.flang` (готовый AST, модель
 * FTS), пришёл со стандартного ввода или не имеет ни одного `использует`.
 */
const СВОИ_ФУНКЦИИ = new WeakMap()

export function ownFunctionNames(program) {
  return СВОИ_ФУНКЦИИ.get(program) ?? null
}

export async function loadProgramFromSource(source, file = "-") {
  const { program, own } = await readProgram(source, file)
  /* Проходов отметки два, и порядок между ними задан зависимостью: доказанное
     выводом типов надо класть на ту программу, которую печать увидит, то есть
     уже со сторожами меры. Оба кладутся здесь, на переднем крае, по одной
     причине: печать обязана получать одну и ту же программу от всех команд, а
     копия печати на самом языке анализа не видит — круг импортов. */
  const отмеченная = await markProven(await markMeasure(program))
  /* Имена кладутся ПОСЛЕ отметок, а не до: там, где сторожа есть,
     `markMeasureGuards` возвращает новый объект, и ключом обязана быть та
     программа, которую получит вызывающий. */
  if (own !== null) СВОИ_ФУНКЦИИ.set(отмеченная, own)
  return отмеченная
}

/**
 * Размещение процессов по узлам — данные узла, а не текст программы.
 *
 * Читается ровно тот файл, который отдают узлу (`flang/conc/bin/node.mjs
 * --размещение`), и читается без единой поправки: проверка обязана видеть то же
 * самое размещение, с каким программа поедет в работу. Второй формат означал бы
 * второй способ ошибиться.
 *
 * Кривой JSON — отказ вызова (код 2), а не молчаливое «размещения нет»: ключ,
 * который принят и не действует, обещает проверку и молчит.
 */
async function loadPlacement(file) {
  if (file === undefined) return null
  const текст = await readInput(file)
  const размещение = parseJson(текст, "--размещение")
  if (размещение === null || typeof размещение !== "object" || Array.isArray(размещение)) {
    throw usage("--размещение: ожидался объект с полем «узлы»")
  }
  if (размещение.узлы === null || typeof размещение.узлы !== "object" || Array.isArray(размещение.узлы)) {
    throw usage("--размещение: в файле нет поля «узлы» — это не размещение (см. flang/conc/DISTRIBUTED.md)")
  }
  return размещение
}

/**
 * Отказ на `.fts` — отдельным кодом и с указанием, где искать.
 *
 * Кодом, а не общим FLANG_PARSE: инструмент, читающий диагностику машиной,
 * обязан отличать «я не понял этот текст» от «этот формат больше не читается».
 * Текст называет три вещи — что случилось, где взять старое и чем пользоваться
 * сейчас, — потому что отказ без указания, что делать, стоит столько же,
 * сколько молчание.
 */
const ФОРМАТ_УБРАН = (причина) =>
  fail(
    "FLANG_FTS_REMOVED",
    `${причина}: старый проект FTS вынесен из этого репозитория. ` +
      "Дерево с ним сохранено тегом «fts-pered-udaleniem» и живёт в github.com/digitable-lol/fts. " +
      "Передайте .flang (исходник) или .json (готовый AST).",
  )

/**
 * Документ FTS без расширения — тоже отказ, и вот почему это не педантизм.
 *
 * Разборщик языка САМ понимает поверхность FTS: `категория`, `объект`,
 * `утилита` и всё их содержимое приезжают в `legacy` разобранными до правил,
 * свойств и примеров. Функцию из утилиты при этом не делает никто — это делал
 * мост из документа ядра, а ядра больше нет. Замерено на настоящей модели:
 *
 *     flang check модель-без-расширения  →  {"valid":true,"functions":[]}
 *
 * То есть команда отвечает «проверено» на файле, в котором объявлена утилита, и
 * не проверяет из него НИЧЕГО. Зелёный ответ, который ничего не проверил, хуже
 * красного: по нему нельзя догадаться, что случилось. Поэтому программа, где
 * есть утилита наследия и нет ни одной функции, отвергается тем же кодом.
 */
function проверитьНеДокументFTS(program) {
  const утилиты = (program?.legacy ?? []).filter((узел) => узел?.construct === "utility")
  if (утилиты.length === 0) return program
  if ((program?.functions ?? []).length > 0) return program
  throw ФОРМАТ_УБРАН(
    `в файле объявлены утилиты наследия FTS (${утилиты.length}) и ни одной функции языка, ` +
      "а переводить утилиту в функцию больше нечем",
  )
}

async function readProgram(source, file) {
  if (file.endsWith(".json")) return { program: JSON.parse(source), own: null }
  if (file.endsWith(".fts")) throw ФОРМАТ_УБРАН("формат .fts больше не читается")
  if (file.endsWith(".flang") || file.endsWith(".fl")) return await parseFlang(source, file)
  /* Формат не назван расширением — пробуем по содержимому, ничего не угадывая
     молча: JSON узнаётся по скобке, всё остальное отдаётся разбору flang. */
  const trimmed = source.trimStart()
  if (trimmed.startsWith("{")) return { program: JSON.parse(source), own: null }
  const разобрано = await parseFlang(source, file)
  проверитьНеДокументFTS(разобрано.program)
  return разобрано
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

/**
 * Вторая отметка переднего края — и она про ДРУГОГО сторожа рантайма.
 *
 * Проверок, которые печать может НЕ печатать, две, и обе называет вывод типов
 * (`src/types.mjs`, `markProven`):
 *
 *   • у частичной формы (`голова`, `хвост`, `разделить`, `код символа`)
 *     доказано условие — длина не ноль;
 *   • у двуместной операции доказан тип обоих операндов — число, и сверка тегов
 *     внутри `fl_add` и соседей становится второй проверкой того же самого.
 *
 * Отметка выше говорит, где сторожа МЕРЫ ставить; эта — где двух названных
 * проверок ставить НЕ НАДО.
 *
 * Идёт ПОСЛЕ отметки меры, и порядок здесь обязательный: отметка меры
 * перестраивает дерево, а доказательство привязано к узлам того дерева,
 * которое уезжает в печать. Поменяй порядок — отметка легла бы на узлы,
 * выброшенные следующим шагом, и снялось бы ноль мест молча.
 *
 * Программа, где доказывать нечего, проходит насквозь тем же объектом.
 */
async function markProven(program) {
  try {
    const { markProven: отметить } = await import(new URL("../src/types.mjs", import.meta.url).href)
    if (typeof отметить !== "function") return program
    return отметить(program)
  } catch {
    return program
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
        "Передайте .json (готовый AST)",
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
    /* Файл без импортов — это и есть вся программа: отбрасывать в ней нечего,
       и точки входа не запоминаются вовсе. */
    if (importsOf(single).length === 0) return { program: single, own: null }
    const linked = await linkProgram(file, source, parse)
    if (linked.diagnostics.length > 0) {
      const error = new Error(linked.diagnostics[0].message)
      error.diagnostics = linked.diagnostics
      throw error
    }
    const { diagnostics: _ignored, ...program } = linked
    /* Одиночный разбор входа уже сделан выше — второй раз файл не читается и не
       разбирается. Имена берутся из него: в СЛИТОЙ программе своё от
       привезённого не отличить. */
    return { program, own: (single.functions ?? []).map((fn) => fn.name) }
  }

  /* Ошибку самого разбора не заворачиваем: у неё уже есть код, сообщение и
     span — подменять их своим текстом значит потерять место ошибки. */
  return { program: parse(source, file), own: null }
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
 * @param {{размещение?: object}} [настройки] данные узла (см. `externalChecks`)
 * @returns {Promise<{diagnostics: object[], results: object}>}
 */
export async function checkProgram(program, настройки = {}) {
  const внешнее = await externalChecks(program, настройки)
  const словарь = await functorDictionaryDiagnostics(program, настройки.файл)
  return {
    diagnostics: [...structuralDiagnostics(program), ...внешнее.diagnostics, ...словарь],
    results: внешнее.results,
  }
}

/**
 * СЛОВАРЬ МЕЖДУ ДВУМЯ СПЕКАМИ — здесь, а не в таблице `externalChecks`, потому
 * что ему нужен ФАЙЛ, а не только программа.
 *
 * Всё, что стоит в той таблице, спрашивают у разобранного дерева; этой проверке
 * надо открыть чужие файлы по путям, написанным внутри функтора, — то есть
 * знать, откуда считать относительный путь. Имени файла у AST нет намеренно
 * (`stampFile` в `src/link.mjs`: дерево описывает программу, а не то, из каких
 * файлов её собрали), значит имя обязано приехать доводом команды.
 *
 * Улика ДО, замером: `flang check` на четырёх словарях — целом и трёх
 * испорченных по одной строке — давал `{"valid":true,…,"diagnostics":[]}` и код
 * 0 на всех четырёх. Проверка была написана (`checkFunctorDictionary`, 10 из 10
 * в `compat-slovar.test.mjs`) и не звалась из рабочего пути ни разу.
 *
 * ЧТЕНИЕ И РАЗБОР ПОДАЮТСЯ ЗДЕСЬ, а не берутся мостом самому: `compat.mjs` не
 * тянет ни одного узла платформы, и втащить туда `node:fs` значило бы сломать
 * его там, где файловой системы нет (браузерная сборка, `docs/site`).
 *
 * Разбор — ГОЛЫЙ `parse`, без связывания и без отметок переднего края. Спека
 * читается ради ОБЪЯВЛЕНИЙ (какие объекты и с какими полями), а связывание
 * втянуло бы её импорты и её импорты импортов; и оно же отвергло бы `.fts`,
 * которым написана половина спек наследия.
 *
 * Запасного пути нет: сорвётся разбор чужой спеки — это диагностика словаря
 * (`FLANG_FUNCTOR_SPEC_MISSING`), а не молчание.
 */
async function functorDictionaryDiagnostics(program, файл) {
  if (typeof файл !== "string" || файл === "" || файл === "-") return []
  const { parse } = await import(new URL("../src/parser.mjs", import.meta.url).href)
  const итог = checkFunctorDictionary(program, {
    file: файл,
    read: (путь) => readFileSync(путь, "utf8"),
    parse,
    /* Категории, объявленные САМОЙ программой (после связывания — вместе с
       привезёнными модулями): их концы проверяет `checkFunctors` в types.mjs, и
       словарём они не являются. */
    declared: (program?.categories ?? []).map((к) => к?.name).filter((имя) => typeof имя === "string"),
  })
  return итог.diagnostics
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
 *
 * `настройки` едут проверкам вторым доводом и сегодня несут ровно одно поле —
 * `размещение`. Это единственное, что проверка узнаёт не из программы: кто на
 * каком узле живёт, решает эксплуатация, а не текст (`conc/DISTRIBUTED.md`), и
 * от этого зависит седьмой вид отказа — `FLANG_LINK_DOWN` у представителя
 * чужого процесса. Проверки, которым второй довод не нужен, его не заметят.
 *
 * @param {object} program AST flang
 * @param {{размещение?: object}} [настройки] данные узла: сегодня — размещение
 */
export async function externalChecks(program, настройки = {}) {
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
    /* Равенство морфизмов — там же и по той же причине. Категория объявляет
       СВОЁ отношение равенства на значениях объекта, а равенство стрелок
       выводится из него поточечно; и то, что оно эквивалентность, и то, что
       композиция его уважает, — утверждения о равенстве вычислений на всех
       значениях, то есть сетка. Устройство самого равенства при этом доказано
       раньше, в `checkTypes`. Категория без объявленного равенства сюда
       приходит и уходит в `assumed`: сравнивать нечем, а молчать о непроверенном
       нельзя. */
    ["../src/setoid.mjs", ["checkCategoryLaws"], "category"],
    /* Пять объявленных свойств — там же и по той же причине, и ПОРОЗНЬ, потому
       что следствие у каждого своё. Порознь не для симметрии: разрешение
       повторить, разрешение переписать и разрешение кешировать — три разных
       разрешения, и один вердикт на пятерых прятал бы их за общим словом.
       Устройство каждого при этом доказано раньше, в `checkTypes`.
       Порядок значим ровно в одном месте: `monotone.mjs` спрашивает у
       `partialorder.mjs`, здоров ли порядок, и спрашивает сам — здесь порядок
       строк ничего не решает и решать не должен. */
    ["../src/idempotent.mjs", ["checkIdempotence"], "idempotent"],
    ["../src/commutative.mjs", ["checkCommutativity"], "commutative"],
    ["../src/distributive.mjs", ["checkDistributivity"], "distributive"],
    ["../src/partialorder.mjs", ["checkPartialOrder"], "order"],
    ["../src/monotone.mjs", ["checkMonotonicity"], "monotone"],
    /* КВАДРАТ СВЯЗИ двух модулей — там же и по тем же причинам, и он последний
       из этого ряда не случайно: остальные говорят о законах ВНУТРИ одного
       модуля, а этот — о согласии двух. Функтор до сих пор проверялся сличением
       имён (`checkFunctors` в types.mjs): концы сходятся, композиция и единицы
       сохраняются. Про ДАННЫЕ не проверялось ничего, потому что перевода данных
       в языке не было. С `объект «А» отображается в «Б» даёт «Ф»` он появился, и
       вместе с ним — утверждение «перевести и сделать» = «сделать и перевести».
       Равенство вычислений неразрешимо, значит сетка; связь без переводов сюда
       не приходит вовсе и уходит в `assumed`. */
    ["../src/functor.mjs", ["checkFunctorSquares"], "functor"],
  ]) {
    try {
      const module = await import(new URL(file, import.meta.url).href)
      const entry = names.map((name) => module[name]).find((value) => typeof value === "function")
      if (entry === undefined) continue
      /* Второй довод получает ТОЛЬКО проверка типов, и это не осторожность ради
         осторожности: у законов моноида, монады, изоморфизма и множеств второй
         довод свой — `пределы` сетки, — и подсунуть им туда размещение значило бы
         молча смешать две разные настройки в одном месте. */
      const итог = ключ === "types" ? entry(program, настройки) : entry(program)
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
  /* ОБЯЗАТЕЛЬСТВА СЧИТАЕТ СЛОЙ НА САМОМ FLANG, а не эталон на JavaScript, и это
     не украшение отчёта. Пока связку «поверхность → цель → предложенное
     доказательство» считал `flang/src/obligations.mjs`, слова «язык доказывает
     сам себя» держались на чужом языке: близнец был написан и сверен побайтово
     (243 программы дерева, 14 нарочно дурных, расхождений 0), но в рабочем пути
     его не звал никто.

     ЗАПАСНОГО ПУТИ К ЭТАЛОНУ ЗДЕСЬ НЕТ. Сорвётся слой — сорвётся команда:
     `try` ниже накрывает только сам ввоз модуля («слоя ещё нет в поставке»), а
     вызов стоит за ним. Тихий запасной путь срабатывал бы молча, и рабочий путь
     снова считал бы эталоном, ничего об этом не сказав. */
  let считатьОбязательства = null
  try {
    ;({ обязательства: считатьОбязательства } = await import(new URL("../src/self.mjs", import.meta.url).href))
  } catch {
    /* слоя ещё нет — check работает в объёме, который доступен сегодня */
  }
  if (считатьОбязательства !== null) {
    const итог = await считатьОбязательства(program, results)
    results.obligations = итог
    diagnostics.push(...normalizeDiagnostics(итог))
    /* ПОИСК НАРУШЕНИЙ НА СЕТКЕ ПРИМЕРОВ. Стоит здесь, а не в таблице выше, по
       той же причине, что и ядро: ему нужны обязательства — он ищет нарушение
       КАЖДОГО названного утверждения по отдельности, а не «ошибку где-нибудь».
       Диагностик не даёт ни одной, и это не забывчивость: нарушенное на примере
       автора постусловие — это красный `flang test`, а место у примеров одно.
       Работа поиска в другом: без него ведомость печатала «нарушений не
       найдено», не посмотрев ни на один пример. */
    try {
      const { checkGrid } = await import(new URL("../src/grid.mjs", import.meta.url).href)
      results.grid = checkGrid(program, итог.obligations)
    } catch {
      /* модуля ещё нет — ведомость тогда скажет «не искали», а не «не найдено» */
    }
    try {
      const { checkProofs } = await import(new URL("../src/proofterm.mjs", import.meta.url).href)
      const вердикты = checkProofs(program, итог.obligations)
      results.proofs = вердикты
      diagnostics.push(...normalizeDiagnostics(вердикты))
    } catch {
      /* ядра ещё нет — обязательства при этом уже посчитаны и видны */
    }
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
/**
 * Ёлочки с имени функции, если человек их написал.
 *
 * Справка показывает `--function «Имя»` — и показывает не по недосмотру: имена
 * функций в языке ПИШУТСЯ в ёлочках, и человек копирует их из исходника вместе
 * с ними. А ключ ёлочек не принимал: `--function «Факториал»` отвечал
 * `не найдена функция ««Факториал»»`, то есть инструмент отвергал ровно ту
 * форму, которой сам же учил. Это та же ложь, что молча проглоченный флаг,
 * только не делом, а словом.
 *
 * Чинится ЗДЕСЬ, а не в справке, по одному доводу: в справке живёт форма,
 * которую человек скопирует, а копирует он её из исходника — с ёлочками. Убери
 * их из справки — и он всё равно напишет так, как написано в файле.
 *
 * Снимается РОВНО ОДНА пара и только внешняя: имени, которое начинается с «и»
 * кончается «», у языка не бывает — ёлочки в лексере ограничивают имя, а не
 * входят в него.
 *
 * Обе реализации правятся ОДНИМ ДВИЖЕНИЕМ (близнец — `run_bare_name` в
 * `flang/src/emit/c/flang_repl.c`), и это не аккуратность: почини одну — и
 * бинарник начал бы принимать то, что эталон отвергает, а расхождение в эту
 * сторону опаснее общего неумения.
 */
export function снятьЁлочки(имя) {
  return имя.length >= 2 && имя.startsWith("«") && имя.endsWith("»") ? имя.slice(1, -1) : имя
}

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

/** Отказ, у которого диагностик сразу несколько: врать может не один аргумент. */
function failWith(diagnostics) {
  const error = new Error(diagnostics[0].message)
  error.diagnostics = diagnostics
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
      options.functionName = снятьЁлочки(require_(argv[++index], "--function требует имя"))
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
    } else if (
      arg === "--no-read" ||
      arg === "--no-write" ||
      arg === "--no-net" ||
      arg === "--no-clock" ||
      arg === "--no-random" ||
      arg === "--no-spawn"
    ) {
      /* Полномочия хозяина сужаются явно и по одному. Отдельного «разрешить»
         нет: умолчание — «можно всё», потому что запуск программы ключом `io`
         и есть согласие на её действия. Осмысленно только сужение. */
      /* У запуска процесса право СВОЁ, а не общее с чтением: запущенная
         программа читает, пишет и ходит в сеть сама, и ни один здешний ключ ей
         не указ. Пустить её под `--no-read` значило бы объявить полномочием то,
         чего хозяин не контролирует. */
      const поле = {
        "--no-read": "чтение",
        "--no-write": "запись",
        "--no-net": "сеть",
        "--no-clock": "время",
        "--no-random": "случайность",
        "--no-spawn": "запуск",
      }[arg]
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
    } else if (arg === "--размещение" || arg === "--placement") {
      /* Единственный ключ, который несёт проверке данные НЕ из программы. Кто на
         каком узле живёт — решение эксплуатации (`conc/DISTRIBUTED.md`), и от
         него зависит седьмой вид отказа: у процесса, размещённого на другом
         узле, здесь стоит представитель, и он умеет отказать `FLANG_LINK_DOWN`.
         Без ключа проверка ведёт себя ровно как прежде: одна машина, границы
         узла нет, представителей нет. */
      options.placement = require_(argv[++index], "--размещение требует файл JSON")
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
     от самого себя, у `run` — обещанием, которого команда не даёт (она считает
     ОДНУ функцию, а не судит программу). У `emit` и `test` обещание есть: обе
     сначала проверяют, значит обе умеют от проверки отказаться. */
  if (options.check === false && options.command !== "emit" && options.command !== "test") {
    throw usage(`--no-check — ключ команд emit и test, а не «${options.command}»`)
  }
  /* И то же правило для размещения, по той же причине: у остальных команд оно
     ничего не значило бы, а ключ, который принят и не действует, обещает
     проверку и молчит — ровно та беда, ради которой эта задача и делалась. */
  if (options.placement !== undefined && options.command !== "check") {
    throw usage(`--размещение — ключ команды check, а не «${options.command}»`)
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
