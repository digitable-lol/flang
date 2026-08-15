/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/*
 * Прогонщик программы flang: JSON на входе, JSON на выходе.
 *
 * ── Зачем он есть ──────────────────────────────────────────────────────────
 * Напечатанный модуль на JavaScript — это библиотека, и вызвать её можно только
 * из JavaScript. Но проверить кодогенератор нужно ровно одним способом —
 * сверкой с интерпретатором на сетке из тысяч входов, а поднимать процесс ради
 * каждой точки сетки — это тысячи запусков. Поэтому бэкенд печатает ещё и
 * прогонщик: один запуск, дальше поток запросов через трубу. Ровно тот же файл
 * и ровно тот же протокол, что у остальных семи целей (`emit/c/flang_cli.c`,
 * `emit/python/flang_cli.py`).
 *
 * Вторая причина важнее первой, и до этого файла её у цели НЕ БЫЛО. Предел
 * глубины вызовов несёт СТЕК, а стека у вызывающего в JavaScript хватает не на
 * объявленные 10 000 кадров, а на 7 386 у самой тонкой рекурсивной функции и на
 * 1 379 у функции с сорока живыми связываниями (замер холодными процессами,
 * Node 26.7). Рычаг у модуля есть — `$callDeep` уводит расчёт в поток с явно
 * заданным стеком, — но звать его надо руками, и обычный запуск объявленного
 * предела не имел. Здесь этот рычаг стоит на пути КАЖДОГО запроса: весь прогон
 * идёт в потоке со стеком, отведённым под объявленный предел (см. «Почему
 * поток» ниже), и отказ приходит тот же, что у интерпретатора, — с тем же
 * кодом и тем же текстом.
 *
 * ── Протокол (тот же, что у бэкендов C, Go и Python) ────────────────────────
 * Запрос — одна строка:  {"fn":"Имя функции","args":[…],"depth":"10000","steps":"1000000"}
 * Ответ  — одна строка:  {"ok":true,"value":…}
 *                        {"ok":false,"code":"FLANG_TYPE","message":"…"}
 *
 * Значения размечены тегами, потому что JSON беднее flang:
 *
 *     null            «ничто»
 *     true / false    признак
 *     {"n":"1.5"}     число — строкой, иначе потерялись бы NaN, Infinity и −0
 *                     (по той же причине строкой едут «depth» и «steps»)
 *     {"s":"текст"}   строка
 *     {"l":[…]}       список
 *     {"r":[["поле",…]]}                 запись (порядок полей сохраняется)
 *     {"v":"Имя","f":[["поле",…]]}       вариант
 *
 * Прогона конкурентной программы (`{"run":…}`) здесь нет — как и у бэкенда
 * Python. Обещать в протоколе то, чего файл не делает, хуже, чем не обещать:
 * процессы у цели гоняет планировщик, напечатанный внутрь самого модуля.
 *
 * ── Какой модуль исполнять ─────────────────────────────────────────────────
 * Путь к файлу программы приходит первым аргументом командной строки: файл
 * называется по имени модуля flang, а прогонщик печатается байт в байт и знать
 * этого имени заранее не может. Без аргумента берётся «program.js» — имя,
 * которое бэкенд даёт программе без имени модуля.
 *
 *     node flang_cli.js ./opcionalnoe_znachenie.js < запросы.jsonl
 *
 * ── Почему поток ───────────────────────────────────────────────────────────
 * Счётчик глубины считает КАДРЫ, а несёт их стек, и стека главного потока V8
 * под объявленные 10 000 кадров не хватает НИ ОДНОЙ программе. Поэтому весь
 * прогон уезжает в `worker_threads` с `resourceLimits.stackSizeMb`, а размер
 * стека не выдуман здесь, а посчитан при печати и приехал в модуле
 * (`$PROGRAM.stackMb`): предел глубины и цена кадра живут там, где живёт сам
 * предел. Так же устроены C (`fl_call_deep` вокруг всего прогонщика) и Python
 * (`rt.call_with_deep_stack` вокруг `serve`) — поток заводится ОДИН на процесс,
 * а не один на запрос: запросов в трубе сколько угодно, а стек нужен один.
 *
 * Если поток не завёлся, прогон идёт здесь же, на своём стеке. Обещание держит
 * тогда сторож, а не стек: предел окажется ниже объявленного, и программа
 * СКАЖЕТ об этом (`$hostDepth`), а не упадёт.
 *
 * ── Чего этот файл не делает ───────────────────────────────────────────────
 * Он не часть модуля. Модуль обязан работать и в браузере, поэтому в нём нет ни
 * `import`, ни `process`, ни потоков; всё, что нужно браузеру, у него есть без
 * этого файла. Здесь же — Node и только Node.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { isMainThread, Worker } from "node:worker_threads"

/* Имя, которое бэкенд даёт программе без объявленного имени модуля. */
const DEFAULT_PROGRAM = "program.js"

/* ───────────────────────────── чтение значений ───────────────────────────── */

/** Значение из размеченного JSON. Чужой узел — исключение, а не догадка. */
function decodeValue(node, program) {
  if (node === null) return null
  if (node === true || node === false) return node
  if (typeof node !== "object" || Array.isArray(node)) throw new Error("нечего декодировать")
  if (Object.hasOwn(node, "n")) return parseNumber(node.n)
  if (Object.hasOwn(node, "s")) return requireText(node.s)
  if (Object.hasOwn(node, "l")) {
    if (!Array.isArray(node.l)) throw new Error("список обязан быть массивом")
    return node.l.map((item) => decodeValue(item, program))
  }
  if (Object.hasOwn(node, "r")) return decodeFields(node.r, program)
  if (Object.hasOwn(node, "v")) {
    /* Вариант строится ФАБРИКОЙ МОДУЛЯ, а не похожим объектом: напечатанный код
       узнаёт вариант по прототипу (`$isVariant`), и запись с полями `variant` и
       `fields` он разобрал бы как запись. Имя при этом любое — в том числе
       такое, какого в программе нет: тогда разбор обязан отказать тем же
       FLANG_MATCH_NOT_EXHAUSTIVE, что у интерпретатора, а не считать значение
       записью. */
    return program.$PROGRAM.variant(requireText(node.v), decodeFields(node.f ?? [], program))
  }
  throw new Error("нечего декодировать")
}

/** Поля записи или варианта: список пар «имя, значение». Порядок — часть значения. */
function decodeFields(pairs, program) {
  if (!Array.isArray(pairs)) throw new Error("поля обязаны быть списком пар")
  const fields = {}
  for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      throw new Error("пара «имя, значение» обязана быть из двух элементов")
    }
    fields[requireText(pair[0])] = decodeValue(pair[1], program)
  }
  return fields
}

function requireText(value) {
  if (typeof value !== "string") throw new Error("ожидалась строка")
  return value
}

/**
 * Число приезжает строкой, и разбирает его `Number`.
 *
 * Отдельных случаев для «NaN», «Infinity» и «-Infinity» здесь нет не по
 * недосмотру: протокол печатает числа правилами ECMAScript Number::toString, а
 * `Number` — в точности обратная им операция, вместе со знаком нуля. У
 * остальных семи целей эти случаи выписаны руками ровно потому, что их разбор
 * чисел этих слов не знает.
 */
function parseNumber(value) {
  return Number(requireText(value))
}

/* ───────────────────────────── печать значений ───────────────────────────── */

/** Значение в размеченный JSON. */
function encodeValue(value, program) {
  if (value === null || value === undefined) return null
  if (value === true || value === false) return value
  if (typeof value === "number") {
    /* −0 обязан доехать до сверки со знаком: Object.is(0, −0) ложно, а
       String(−0) даёт «0». Всё остальное печатает сам Number::toString. */
    return { n: Object.is(value, -0) ? "-0" : String(value) }
  }
  if (typeof value === "string") return { s: value }
  if (Array.isArray(value)) return { l: value.map((item) => encodeValue(item, program)) }
  if (program.$PROGRAM.isVariant(value)) return { v: value.variant, f: encodeFields(value.fields, program) }
  if (typeof value === "object") return { r: encodeFields(value, program) }
  throw new Error(`нечего кодировать: ${typeof value}`)
}

function encodeFields(fields, program) {
  return Object.keys(fields).map((name) => [name, encodeValue(fields[name], program)])
}

/* ───────────────────────────── запрос ───────────────────────────── */

function line(answer) {
  return JSON.stringify(answer)
}

/** Отказ протокола: запрос не разобран. Код «CLI» — тот же, что у семи целей. */
function refusal(message) {
  return line({ ok: false, code: "CLI", message })
}

/** Отказ языка: код и текст приходят от модуля или от таблицы вызова. */
function failure(code, message) {
  return line({ ok: false, code, message })
}

/**
 * Один запрос: разбор, вызов, ответ. Строкой, а не объектом, потому что ответ
 * едет через границу потока, а строка переживает её без структурного
 * копирования — и без вопроса, что стало с прототипом варианта.
 *
 * Исключения наружу не выпускаются, кроме одного случая: беда, которая не
 * является отказом языка (у неё нет кода), — это поломка движка, и прятать её
 * за ответом протокола значило бы выдать спокойствие, которого нет.
 */
export function answer(program, request) {
  let query = null
  try {
    query = JSON.parse(request)
  } catch {
    return refusal("неразборчивый запрос")
  }
  if (query === null || typeof query !== "object" || Array.isArray(query)) {
    return refusal("ожидался объект запроса")
  }

  let name = null
  let raw = []
  const limits = {}
  for (const key of Object.keys(query)) {
    if (key === "fn") {
      if (typeof query.fn !== "string") return refusal("неразборчивое имя функции")
      name = query.fn
    } else if (key === "depth") {
      const depth = parseLimit(query.depth)
      if (depth === null) return refusal("неразборчивый предел глубины")
      limits.maxDepth = depth
    } else if (key === "steps") {
      const steps = parseLimit(query.steps)
      if (steps === null) return refusal("неразборчивый предел шагов")
      limits.maxSteps = steps
    } else if (key === "args") {
      if (!Array.isArray(query.args)) return refusal("неразборчивые аргументы")
      raw = query.args
    } else {
      /* Неизвестное поле — отказ, а не молчание: опечатка в «depth» иначе
         прошла бы тихо, и прогон посчитал бы с другим пределом. */
      return refusal("неизвестное поле запроса")
    }
  }
  if (name === null) return refusal("в запросе нет имени функции")

  const fn = program.$PROGRAM.functions.get(name)
  if (fn === undefined) return failure("FLANG_UNKNOWN_NAME", `не найдена функция «${name}»`)

  let args = null
  try {
    args = raw.map((item) => decodeValue(item, program))
  } catch {
    return refusal("неразборчивые аргументы")
  }
  /* Арность берётся у самой функции (`fn.length`), а не из второй таблицы:
     таблица могла бы разойтись с сигнатурой, подпись — не может. Текст отказа
     дословно тот же, что у интерпретатора (`bindArguments`). */
  if (args.length !== fn.length) {
    return failure("FLANG_TYPE", `функция «${name}» принимает ${fn.length} аргум., получено ${args.length}`)
  }

  /* Свежий контекст на каждый запрос — как `new_context` у остальных семи. У
     программы без счётчиков его в модуле нет вовсе, и ставить нечего: глубина у
     неё ограничена графом вызовов, а витков она не считает. */
  if (typeof program.$newContext === "function") program.$newContext(limits)
  try {
    return line({ ok: true, value: encodeValue(fn(...args), program) })
  } catch (error) {
    if (error !== null && typeof error === "object" && typeof error.code === "string") {
      return failure(error.code, error.message)
    }
    throw error
  }
}

/** Предел из запроса: он едет строкой по той же причине, что и числа. */
function parseLimit(value) {
  if (typeof value !== "string") return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.trunc(number) : null
}

/* ───────────────────── стек под объявленный предел ───────────────────── */

/**
 * Что делает поток: тот же прогон, только на стеке, отведённом под объявленный
 * предел глубины.
 *
 * Живёт строкой, а не третьим файлом: напечатанное обязано переноситься
 * копированием, а два файла рядом — это уже сборка. Сам прогонщик приезжает в
 * поток обычным импортом по своему же URL, поэтому разбор запроса, коды и
 * тексты отказов в потоке ТЕ ЖЕ — второй их копии не существует.
 */
function deepSource() {
  return [
    'import { parentPort, workerData } from "node:worker_threads"',
    "const cli = await import(workerData.cli)",
    "const program = await import(workerData.program)",
    "for (const request of workerData.requests) parentPort.postMessage(cli.answer(program, request))",
  ].join("\n")
}

/**
 * Прогон в потоке с заданным стеком. Возвращает число НАПЕЧАТАННЫХ ответов:
 * остальное допечатает вызывающий на своём стеке, чтобы на каждый запрос
 * пришёлся ровно один ответ даже тогда, когда поток оборвался.
 */
async function serveDeep(programUrl, stackMb, requests) {
  if (!(stackMb > 0) || requests.length === 0) return 0
  let worker = null
  try {
    worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(deepSource())}`), {
      workerData: { cli: import.meta.url, program: programUrl, requests },
      resourceLimits: { stackSizeMb: stackMb },
    })
  } catch {
    /* Потока не дали (предел адресного пространства, контейнер, чужая среда) —
       считаем здесь же. Глубина, купленная ценой падения, была бы не починкой,
       а переносом отказа. */
    return 0
  }
  let written = 0
  await new Promise((done) => {
    worker.on("message", (text) => {
      process.stdout.write(`${text}\n`)
      written += 1
    })
    /* Обработчик обязателен: без него «error» у Worker'а — необработанное
       исключение процесса. Ответ на оборвавшийся запрос допечатает вызывающий. */
    worker.on("error", () => {})
    worker.on("exit", () => done())
  })
  return written
}

/* ───────────────────────────── запуск ───────────────────────────── */

async function main(argv) {
  const file = argv[2] ?? DEFAULT_PROGRAM
  const programUrl = pathToFileURL(resolve(file)).href
  let program = null
  try {
    program = await import(programUrl)
  } catch {
    /* Не найден или не разобрался — это ошибка вызова, а не запроса, и отвечать
       на неё стопкой кадров хозяина незачем: ответ тот же, что у всякого другого
       отказа протокола, и код возврата ненулевой. */
    process.stdout.write(`${refusal(`не прочитан модуль программы «${file}»`)}\n`)
    process.exitCode = 1
    return
  }
  if (program.$PROGRAM === undefined) {
    process.stdout.write(`${refusal("модуль напечатан без таблицы функций (--no-cli)")}\n`)
    process.exitCode = 1
    return
  }

  /* Вход читается целиком, как в C (`read_all`): труба кончается концом файла,
     а не по частям, и разбор построчный от этого не меняется. */
  const requests = readFileSync(0, "utf8").split("\n").filter((text) => text.trim().length > 0)
  const written = await serveDeep(programUrl, program.$PROGRAM.stackMb, requests)
  for (const request of requests.slice(written)) process.stdout.write(`${answer(program, request)}\n`)
}

/* Прогонщик запускается сам, только когда его ЗАПУСТИЛИ. Два условия, и каждое
   нужно: в потоке этот же файл импортируется ради `answer` (там `isMainThread`
   ложь), а из чужого кода его импортируют ради того же — и второй прогон был бы
   вторым ответом на каждый запрос либо ожиданием ввода, которого нет. */
if (isMainThread && typeof process.argv[1] === "string"
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main(process.argv)
}
