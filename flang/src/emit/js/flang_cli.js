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
 * ── Граница входа ──────────────────────────────────────────────────────────
 * Значения приезжают СНАРУЖИ, программой не являются и сверяются с
 * объявленными типами параметров ДО вызова — той же дверью, что стоит у
 * `flang run --args`, и теми же словами. Таблица типов печатается в модуле
 * (`$PROGRAM.entry`), обход по ней — `checkEntry` ниже; зачем это нужно и
 * почему не в самих функциях, сказано там же.
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
import { readFileSync, realpathSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
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

/** Ответ — ровно одна строка на запрос, как у семи остальных целей. */
function line(payload) {
  return JSON.stringify(payload)
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

  /* Граница входа — ДО вызова: значения приехали снаружи, программой не являются
     и сверяются с объявленными типами. Значение вне типа выносит вместе с типом
     и доказательство завершения `тотальной`, а поймать вечную цепочку потом
     нечем — сторожа в тотальной функции нет. */
  const refused = checkEntry(program, name, args)
  if (refused !== null) return failure("FLANG_TYPE", refused)

  /* Свежий контекст на каждый запрос — как `new_context` у остальных семи. У
     программы без счётчиков его в модуле нет вовсе, и ставить нечего: глубина у
     неё ограничена графом вызовов, а витков она не считает. */
  if (typeof program.$newContext === "function") program.$newContext(limits)

  /* Вторая половина той же двери: ДОГОВОР. Типы сверены выше, но `требует`
     типами не выражается («ширина не меньше длины» — не тип), и снаружи его
     снять некому: внутри программы это делает вызывающий на проверке, а у
     значения из трубы вызывающего нет. Гейт печатается только у программы с
     `требует` — отсюда оба `undefined`. Считается он ПОСЛЕ `$newContext`:
     предусловие — вычисление, и витки его идут в тот же счёт, что витки тела. */
  const gate = program.$PROGRAM.pre === undefined ? undefined : program.$PROGRAM.pre.get(name)
  if (gate !== undefined) {
    try {
      const broken = gate(...args)
      if (broken !== null) return failure(broken.code, broken.message)
    } catch (error) {
      if (error !== null && typeof error === "object" && typeof error.code === "string") {
        return failure(error.code, error.message)
      }
      throw error
    }
  }
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

/* ───────────────────────────── граница входа ───────────────────────────── */

/**
 * ОБЪЯВЛЕННЫЕ ТИПЫ ПАРАМЕТРОВ СВЕРЯЮТСЯ ЗДЕСЬ, ДО ВЫЧИСЛЕНИЯ.
 *
 * Зачем это в прогонщике, а не в самих функциях модуля. У напечатанной
 * программы два входа, и обещания у них разные: библиотечный (экспорт модуля) —
 * это вычислитель, обязанный совпадать с интерпретатором значение в значение;
 * прогонщик — вход ИЗВНЕ, и у него та же граница, что у `flang run --args`.
 *
 * Граница заведена не ради вежливого сообщения. Доказательство завершения
 * `тотальной` стоит НА ТИПЕ: у `неотрицательное` есть дно 0 и потолок 2^53−1, ниже которого
 * `н минус 1` точно меньше `н`, и сторож убывания в такую функцию не печатается
 * ВОВСЕ. Значение вне типа выносит вместе с типом и доказательство: `1e300`
 * минус 1 равно `1e300`, цепочка вечна, а ловить её нечем. До этой двери
 * `«Факториал» принимает н: неотрицательное` считался при `н` равном −3 и 2.5, а при 1e300
 * отказывал FLANG_RECURSION_LIMIT — кодом, отведённым ОБЫЧНОЙ функции.
 *
 * Таблицу печатает бэкенд вместе с модулем (`$PROGRAM.entry`), а строит её
 * `flang/src/types.mjs` (`таблицаВхода`) — тем же пониманием слов «значение
 * подходит типу», каким сверяется `flang run --args`. Обход ниже — тот же, что
 * напечатан в рантайме остальных семи целей, строка в строку; расхождение с ним
 * ловится сеткой корпуса (`flang/test/emit-js-cli.test.mjs`).
 *
 * Форма таблицы — четыре плоских списка. Поля и варианты лежат сплошными
 * отрезками общих списков, а тип называет своё начало и длину; ссылка на тип —
 * ИНДЕКС, а не вложение, потому что тип бывает рекурсивным (у суммы «Дерево»
 * поле варианта имеет тип «Дерево») и вложение такого типа не кончается.
 *
 * Виды: «число» (с отрезком и признаком целости — в них живут `неотрицательное` и `целое`),
 * «строка», «признак», «ничто», «список», «запись», «сумма». Видом «неизвестно»
 * приезжает и НЕ сверяется то, для чего таблицы мало: значение-функция,
 * параметр полиморфизма и применение типа с аргументами. Молчание на нём — то
 * же самое, каким отвечает на джокер проверка значений свидетеля.
 *
 * Отказ возвращается ТЕКСТОМ, а не исключением: код у него всегда один
 * (FLANG_TYPE), и заводить ради него класс ошибки значило бы городить второй
 * путь отказа рядом с тем, что уже есть.
 */
function checkEntry(program, name, args) {
  const table = program.$PROGRAM.entry
  const declared = table.params.filter((param) => param.fn === name)
  /* Сверять нечем: имени в таблице нет, параметров у функции нет вовсе, либо
     число значений не сошлось с числом параметров — это отдельный отказ, и он
     принадлежит вызывающему, чтобы текст про арность был в программе один. */
  if (declared.length === 0 || declared.length !== args.length) return null
  for (const [at, param] of declared.entries()) {
    const refusal = checkTyped(program, table, param.type, args[at],
      `вызов функции «${name}»: аргумент «${param.name}»`)
    if (refusal !== null) return refusal
  }
  return null
}

/** Значение против одного типа таблицы. `null` — подошло, строка — текст отказа. */
function checkTyped(program, table, at, value, label) {
  const spec = table.types[at]
  if (spec === undefined) return null
  /* Необязательный аргумент можно не задавать: отсутствие — это «ничто», а не
     пропуск. Так же считает и ядро FTS. */
  if (spec.nothing && (value === null || value === undefined)) return null
  const mismatch = `${label} не соответствует типу ${spec.name}`
  switch (spec.kind) {
    case "число":
      return checkNumber(spec, value, label, mismatch)
    case "строка":
      return typeof value === "string" ? null : mismatch
    case "признак":
      return value === true || value === false ? null : mismatch
    case "ничто":
      return value === null || value === undefined ? null : mismatch
    case "список": {
      if (!Array.isArray(value)) return mismatch
      for (const [index, item] of value.entries()) {
        const refusal = checkTyped(program, table, spec.item, item, `${label}[${index}]`)
        if (refusal !== null) return refusal
      }
      return null
    }
    case "запись": {
      if (!isRecordValue(program, value)) return mismatch
      const refusal = checkFields(program, table, spec.fieldAt, spec.fieldCount, value, label, spec.owner, false)
      if (refusal !== null) return refusal
      /* Лишнее поле — тоже несоответствие типу: запись flang тотальна, и поля
         сверх объявленных в ней взяться неоткуда. */
      const declared = []
      for (let step = 0; step < spec.fieldCount; step += 1) declared.push(table.fields[spec.fieldAt + step].name)
      for (const given of Object.keys(value)) {
        if (!declared.includes(given)) return `${label}: запись «${spec.owner}» не имеет поля «${given}»`
      }
      return null
    }
    case "сумма": {
      const asVariant = program.$PROGRAM.isVariant(value)
      if (!asVariant && !isRecordValue(program, value)) return mismatch
      let found = null
      if (asVariant) {
        for (let step = 0; step < spec.variantCount; step += 1) {
          const item = table.variants[spec.variantAt + step]
          if (item.name === value.variant) {
            found = item
            break
          }
        }
      }
      if (found === null) return `${label}: ожидался вариант типа «${spec.owner}»`
      return checkFields(program, table, found.fieldAt, found.fieldCount, value.fields, label, found.name, true)
    }
    default:
      /* «неизвестно» — молчание, а не забытый случай: см. шапку `checkEntry`. */
      return null
  }
}

/** Число: сначала само число, потом целость, потом отрезок — порядок свидетеля. */
function checkNumber(spec, value, label, mismatch) {
  if (typeof value !== "number" || !Number.isFinite(value)) return mismatch
  /* Целость проверяется ДО отрезка и на ней же кончается: у свидетеля тот же
     порядок, и второй отказ на одном значении был бы вторым текстом про одну
     беду. */
  if (spec.integer && !Number.isInteger(value)) {
    return `${label}: ${value} не целое, а тип ${spec.name} — целый`
  }
  if (spec.range && (value < spec.low || value > spec.high)) {
    return `${label}: ${value} вне ${spec.name}`
  }
  return null
}

/** Поля записи или варианта — сплошной отрезок общего списка полей. */
function checkFields(program, table, at, count, given, label, owner, ofVariant) {
  for (let step = 0; step < count; step += 1) {
    const field = table.fields[at + step]
    if (!Object.hasOwn(given, field.name)) {
      /* Необязательное поле можно не задавать: отсутствие — это «ничто». */
      if (table.types[field.type].nothing) continue
      return ofVariant
        ? `${label}: вариант «${owner}» требует поле «${field.name}»`
        : `${label}: не задано поле «${field.name}» записи «${owner}»`
    }
    const refusal = checkTyped(program, table, field.type, given[field.name], `${label}.${field.name}`)
    if (refusal !== null) return refusal
  }
  return null
}

/** Запись на проводе — простой объект: не «ничто», не список и не вариант. */
function isRecordValue(program, value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && !program.$PROGRAM.isVariant(value)
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

/*
 * «Меня запустили напрямую?» — тот же ответ, что у всего дерева
 * (`flang/scripts/direct-run.mjs`), но написанный ЗДЕСЬ, а не ввезённый оттуда.
 * Ввезти нельзя дважды: `flang/scripts` в пакет не уезжает, и этот файл вдобавок
 * КОПИРУЕТСЯ рядом с напечатанной программой, где никакого дерева нет вовсе.
 * Копия сверяется с образцом строкой в строку (`flang/scripts/direct-run-guard.mjs`).
 *
 * Стояло здесь `pathToFileURL(resolve(process.argv[1])).href === import.meta.url`.
 * Кириллицу и пробел оно переживает (обе стороны кодированы процентами), а
 * символьную ссылку — нет: Node разрешает ссылку для `import.meta.url`, но не
 * для `process.argv[1]`. Прогонщик, позванный по ссылке, молча не отвечал бы ни
 * на один запрос, выйдя кодом 0.
 */
function запущенНапрямую(адресМодуля) {
  const запуск = process.argv[1]
  if (запуск === undefined || запуск === "") return false
  try {
    return realpathSync(fileURLToPath(адресМодуля)) === realpathSync(запуск)
  } catch {
    return false
  }
}

/* Прогонщик запускается сам, только когда его ЗАПУСТИЛИ. Два условия, и каждое
   нужно: в потоке этот же файл импортируется ради `answer` (там `isMainThread`
   ложь), а из чужого кода его импортируют ради того же — и второй прогон был бы
   вторым ответом на каждый запрос либо ожиданием ввода, которого нет. */
if (isMainThread && запущенНапрямую(import.meta.url)) {
  await main(process.argv)
}
