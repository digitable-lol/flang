/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
// emit/java.mjs — печать программы flang в Java.
//
// ── Зачем ──────────────────────────────────────────────────────────────────
// Печать в C даёт переносимость до NetBSD и RISC-V, в Go — один статически
// слинкованный файл, в Rust — сборку без рантайма, в Python — импорт рядом с
// pandas и Jupyter. Java закрывает нишу, которой не закрывает ни один из них:
// это язык, на котором написан слой предметной логики в банке, страховой и
// торговой системе, — то есть ровно там, где живут модели FTS. Программу flang
// туда нужно не «встроить через процесс», а положить классом рядом с прочими и
// вызвать методом.
//
// ── Что здесь принципиально иначе, чем в бэкендах Python, Go и C ───────────
// Общее сохранено намеренно, чтобы бэкенды читались как одна система: тот же
// обход AST, то же решение арности при печати, тот же протокол прогонщика, та
// же транслитерация имён через tools/ftsc/src/naming.mjs, и коллизия после
// транслитерации — ошибка печати, а не тихое переименование.
//
// Расходится же Java с соседями там, где расходятся сами языки.
//
// 1. НЕТ UNION-ТИПОВ. Выразить «Скаляр | Список | Запись | Вариант» (SPEC,
//    раздел 2) в Java нечем: запечатанный интерфейс с record-ами на каждый вид
//    (JDK 25 это умеет) дал бы семь типов, между которыми напечатанный код всё
//    равно ходил бы через instanceof — то есть через тот же тег, записанный
//    дороже. Напечатанный код flang динамически типизирован: у переменной,
//    которую разбор связал с полем варианта, статического типа нет ни в одной
//    точке. Поэтому значение — один класс с тегом (см. Value.java), а суммы
//    типов flang — значения с тегом VARIANT и дискриминантом-строкой плюс по
//    статическому методу-конструктору на вариант.
//
// 2. ВСЕ ЧИСЛА — double, И ЭТО СОВПАДЕНИЕ, А НЕ УСТУПКА. Число flang — IEEE-754
//    double (SPEC, раздел 2), и double в Java ровно он же: деление на ноль даёт
//    ±Infinity, `%` — это оператор ECMAScript дословно. Арифметика совпадает с
//    ядром сама по себе, в отличие от Python (где деление на ноль возбуждает
//    исключение) и Go (где целые заразны). Расходятся только печать числа и
//    равенство — обе поправки в Value.java.
//
// 3. СТРОКИ В UTF-16, А ДЛИНА В КОДОВЫХ ТОЧКАХ. String в Java — единицы UTF-16,
//    а SPEC (раздел 5) требует кодовые точки. Для кириллицы разницы нет, для
//    эмодзи — вдвое, и молчаливое расхождение на эмодзи хуже громкого. Поэтому
//    «длина», «символ» и «подстрока» ходят по кодовым точкам явно (Flang.java).
//
// 4. ПРОВЕРЯЕМЫЕ ИСКЛЮЧЕНИЯ. Java — единственная цель, где у автора есть выбор,
//    и выбор сделан в пользу непроверяемого: ошибку языка умеет дать любая
//    операция, вплоть до сложения, поэтому `throws FlangError` стояло бы на
//    каждой напечатанной функции, ничего не сообщая, зато делая напечатанный
//    код непригодным для лямбды со сторонней сигнатурой (Stream.map,
//    Comparator). Обоснование целиком — в FlangError.java.
//
// 5. ПРЕДЕЛ СТЕКА. У потока JVM стек задан при создании (около мегабайта), и
//    предел глубины flang в 10⁴ вызовов в него не помещается; StackOverflowError
//    при этом не диагностика, а Error. Поэтому прогонщик считает в потоке с явно
//    заданным стеком (Flang.withDeepStack), как это делает и бэкенд Python.
//
// 6. НЕИСПОЛЬЗОВАННОЕ ИМЯ — НЕ ОШИБКА, А НЕДОСТИЖИМЫЙ ОПЕРАТОР — ОШИБКА. В Go
//    неиспользованное имя ломает сборку, в C под -Werror ломает её же, и оба
//    бэкенда его гасят. javac неиспользованную локальную переменную не замечает
//    даже под -Xlint:all -Werror, поэтому гасить нечего. Зато у Java есть
//    собственный аналог того же дефекта, и он строже: **недостижимый оператор —
//    ошибка компиляции**, а не предупреждение. Функция, у которой все хвостовые
//    позиции — самовызов, разворачивается в `while (true)`, и любой оператор
//    после такого цикла (в том числе `return результат`, который печатали бы «на
//    всякий случай») javac отвергнет. Поэтому после хвостового цикла здесь не
//    печатается ничего, а сама функция не объявляет переменной результата,
//    в которую ни разу не пишет. Ровно этот дефект ловил C под -Werror.
//
// ── Роль входит в имя, и это не украшение ──────────────────────────────────
// Класс Java — одно пространство имён на все объявления, и метод, объявленный
// дважды с одной сигнатурой, — ошибка компиляции. В ядре FTS есть «Значение
// операнда» — и вариант суммы типов, и запись, и функция; назови мы конструктор
// варианта по имени варианта, а функцию по имени функции, класс не собрался бы
// вовсе. Поэтому идентификатор всегда несёт роль: fn_… у функции, v_… у
// конструктора варианта, rec_… у фабрики записи, step_… у шага батута.
// Столкнуться после этого могут только два имени одной роли — и это ошибка
// печати, а не переименование (createDeclarations).
//
// ── Файлы, а не один файл ──────────────────────────────────────────────────
// javac требует, чтобы имя публичного типа совпадало с именем файла, поэтому
// рантайм печатается пятью файлами (Value, Field, Ctx, FlangError, Flang),
// программа — классом по имени модуля flang, прогонщик — FlangCli. Всё в
// безымянном пакете: так `javac *.java` собирает каталог целиком, а классы
// видят друг друга без единого import.
//
// Рантайм и прогонщик печатаются байт в байт из flang/src/emit/java/: так их
// проверяет сам javac прямо в репозитории, а не только через тест печати.
//
// ── Главное требование: совпадение с interpret.mjs ─────────────────────────
// Сгенерированный код обязан давать то же значение и ту же ошибку (код И
// текст). Отсюда:
//
//   • строгий порядок вычисления слева направо;
//   • проценты печатаются как `(процент / 100) * значение`;
//   • равенство скаляров — Object.is (NaN равен NaN, 0 не равен −0).
//
// ── Хвостовая рекурсия: те же три случая, что в остальных бэкендах ─────────
//   • хвостовой самовызов → `while (true)` с переприсваиванием параметров;
//   • взаимная хвостовая рекурсия (компонента сильной связности из двух и
//     более функций) → батут через ссылки на методы;
//   • функция с постусловиями хвостовых вызовов не получает — интерпретатор
//     тоже не переиспользует кадр, которому есть что проверить после возврата.
//
// ── Пределы: и глубина, и шаги ─────────────────────────────────────────────
// Воспроизведены оба, как в бэкендах Go, Rust и Python. Шаг здесь — вход в
// функцию, виток цикла хвостового самовызова и отскок батута; шаг
// интерпретатора — итерация его машины, а их на одно применение функции
// приходится много. Значит счётчик здесь всегда МЕНЬШЕ, и при одинаковом
// пределе интерпретатор упирается в лимит первым. Расхождение одностороннее и
// безопасное.

import { readFileSync } from "node:fs"

import { canonicalBuiltinName, flangError, hasBuiltin } from "../builtins.mjs"
import { defunctionalize } from "../defunc.mjs"
import { BIDI_CONTROLS, escapeBidiInFiles, escapeBidiUnicode4 } from "../../../tools/ftsc/src/bidi.mjs"
import { pascal, snake } from "../../../tools/ftsc/src/naming.mjs"

/* ═══════════════════════════════════════════════════════════════════════════
   Рантайм и прогонщик.

   Лежат рядом настоящими .java, а не строками в этом файле: так их проверяет
   сам javac (под -Xlint:all -Werror) прямо в репозитории, а правка рантайма не
   превращается в правку экранирования внутри шаблона. Печатаются байт в байт —
   только с шапкой «сгенерировано» перед первой строкой.
   ═══════════════════════════════════════════════════════════════════════════ */

const RUNTIME_DIRECTORY = new URL("./java/", import.meta.url)

/** Файлы рантайма: имя типа = имя файла, этого требует javac. */
const RUNTIME_FILES = [
  ["Value.java", "значение: тег, поля, равенство, печать числа"],
  ["Field.java", "поле записи или варианта"],
  ["FlangError.java", "диагностика: код и текст"],
  ["Ctx.java", "контекст вычисления: пределы и индексация строк"],
  ["Flang.java", "операции языка: арифметика, встроенные формы, батут"],
]

const CLI_FILE = "FlangCli.java"

const RUNTIME_SOURCE = new Map(
  RUNTIME_FILES.map(([name]) => [name, readFileSync(new URL(name, RUNTIME_DIRECTORY), "utf8")]),
)
const CLI_SOURCE = readFileSync(new URL(CLI_FILE, RUNTIME_DIRECTORY), "utf8")

/** Классы, которые печатает рантайм: имя модуля не имеет права их занять. */
const RUNTIME_TYPES = ["Value", "Field", "FlangError", "Ctx", "Flang", "FlangCli"]

/** Канонические имена встроенных форм → методы рантайма. */
const BUILTIN_HELPERS = new Map([
  ["длина", "bLength"],
  ["символ", "bChar"],
  ["подстрока", "bSubstring"],
  ["соединить", "bJoin"],
  ["разделить", "bSplit"],
  ["символы", "bCharacters"],
  ["код символа", "bCharCode"],
  ["содержит", "bContains"],
  ["начинается с", "bStartsWith"],
  ["к числу", "bToNumber"],
  ["к числу или беда", "bToNumberOrFailure"],
  ["к строке", "bToString"],
  ["пусто", "bEmpty"],
  ["голова", "bHead"],
  ["хвост", "bTail"],
  ["элемент", "bElement"],
  ["добавить", "bAppend"],
  ["остаток от", "bRemainder"],
  ["процентов от", "bPercentOf"],
])

/** Арность встроенных форм — проверяется при печати, а не в рантайме. */
const BUILTIN_ARITY = new Map([
  ["длина", 1], ["символ", 2], ["подстрока", 3], ["соединить", 2], ["разделить", 2],
  ["символы", 1],
  ["код символа", 1],
  ["содержит", 2], ["начинается с", 2], ["к числу", 1], ["к числу или беда", 1], ["к строке", 1], ["пусто", 1],
  ["голова", 1], ["хвост", 1], ["элемент", 2], ["добавить", 2], ["остаток от", 2], ["процентов от", 2],
])

const BINARY_HELPERS = new Map([
  ["add", "add"], ["sub", "sub"], ["mul", "mul"], ["div", "div"], ["mod", "mod"],
  ["percent", "percent"], ["gt", "gt"], ["lt", "lt"], ["gte", "gte"], ["lte", "lte"],
  ["concat", "concat"],
])

/* Ключевые слова Java (включая контекстные: var, record, yield, sealed,
   permits — с JDK 25 все они действуют в своих позициях) и литералы. Имя из
   модели, попавшее сюда после транслитерации, обязано считаться коллизией, а не
   молча получить суффикс. */
const JAVA_RESERVED = [
  "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const",
  "continue", "default", "do", "double", "else", "enum", "extends", "final", "finally", "float",
  "for", "goto", "if", "implements", "import", "instanceof", "int", "interface", "long", "native",
  "new", "package", "private", "protected", "public", "return", "short", "static", "strictfp",
  "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "void",
  "volatile", "while",
  "true", "false", "null",
  "var", "record", "yield", "sealed", "permits", "non-sealed", "_",
  /* Простые имена из java.lang: пакет импортируется неявно, и локальное имя
     «String» сделало бы недоступным настоящий java.lang.String. */
  "String", "Object", "Integer", "Double", "Boolean", "Character", "Math", "System", "Number",
  "Exception", "RuntimeException", "Error", "Thread", "Class", "Long", "Byte", "Short", "Float",
  "Void", "Iterable", "Comparable", "Runnable", "StringBuilder", "Override", "SuppressWarnings",
  /* Имена, которыми пользуется сам напечатанный код. */
  ...RUNTIME_TYPES,
  "ctx", "args", "bounce",
]

/* Имена, которые печатает сам бэкенд в классе программы. */
const DECLARED_BY_BACKEND = ["call", "newContext"]

/* Приставки ролей. Роль обязана входить в идентификатор: класс Java — одно
   пространство имён, и вариант «Значение операнда» с функцией «Значение
   операнда» (в ядре FTS есть и то, и другое) иначе дали бы два метода с одной
   сигнатурой, то есть несобирающийся класс. */
const ROLE_PREFIX = {
  function: "fn_",
  variant: "v_",
  record: "rec_",
  step: "step_",
}

const ROLE_LABEL = {
  function: "функции",
  variant: "конструктора варианта",
  record: "фабрики записи",
  step: "шага батута",
}

/* ═══════════════════════════ подготовка программы ═══════════════════════════ */

// Повторяет prepareProgram интерпретатора: те же проверки, те же коды и
// тексты. Разница только во времени срабатывания — при печати, а не при
// вычислении (ровно как в остальных бэкендах).
function prepare(program) {
  if (program === null || typeof program !== "object" || Array.isArray(program)) {
    throw flangError("FLANG_PARSE", "программа должна быть объектом AST flang")
  }
  const functionList = program.functions ?? []
  if (!Array.isArray(functionList)) {
    throw flangError("FLANG_PARSE", "поле «functions» программы должно быть списком")
  }

  const functions = new Map()
  for (const fn of functionList) {
    if (fn === null || typeof fn !== "object" || typeof fn.name !== "string") {
      throw flangError("FLANG_PARSE", "функция должна быть объектом с полем «name»")
    }
    if (functions.has(fn.name)) {
      throw flangError("FLANG_PARSE", `функция «${fn.name}» объявлена дважды`, fn.span)
    }
    if (fn.body === undefined || fn.body === null) {
      throw flangError("FLANG_PARSE", `у функции «${fn.name}» нет тела`, fn.span)
    }
    functions.set(fn.name, {
      name: fn.name,
      total: fn.total === true,
      params: normalizeParams(fn),
      returns: fn.returns,
      body: fn.body,
      postconditions: normalizePostconditions(fn),
      span: fn.span,
    })
  }

  const records = new Map()
  const variants = new Map()
  const sums = []
  for (const type of program.types ?? []) {
    if (type === null || typeof type !== "object") continue
    if (type.kind === "record") records.set(type.name, type)
    if (type.kind === "sum") {
      sums.push(type)
      for (const item of type.variants ?? []) variants.set(item.name, { sum: type.name, ...item })
    }
  }
  return { functions, records, variants, sums }
}

function normalizeParams(fn) {
  const params = fn.params ?? []
  if (!Array.isArray(params)) {
    throw flangError("FLANG_PARSE", `поле «params» функции «${fn.name}» должно быть списком`, fn.span)
  }
  return params.map((param) => {
    if (typeof param === "string") return { name: param }
    if (param === null || typeof param !== "object" || typeof param.name !== "string") {
      throw flangError("FLANG_PARSE", `параметр функции «${fn.name}» должен иметь имя`, fn.span)
    }
    return param
  })
}

function normalizePostconditions(fn) {
  const list = fn.postconditions ?? []
  if (!Array.isArray(list)) {
    throw flangError("FLANG_PARSE", `поле «postconditions» функции «${fn.name}» должно быть списком`, fn.span)
  }
  return list.map((item) => {
    if (item === null || typeof item !== "object" || item.expr === undefined) {
      throw flangError("FLANG_PARSE", `постусловие функции «${fn.name}» должно содержать «expr»`, fn.span)
    }
    return {
      name: item.name ?? "",
      expr: item.expr,
      bind: typeof item.bind === "string" ? item.bind : "результат",
      code: typeof item.code === "string" ? item.code : "FLANG_PROPERTY",
      message: typeof item.message === "string" ? item.message : null,
      span: item.span,
    }
  })
}

/* ═══════════════════════════ анализ графа вызовов ═══════════════════════════ */

// Хвостовые позиции тела. Функция с постусловиями хвостовых вызовов не имеет.
function tailCallees(fn) {
  if (fn.postconditions.length > 0) return new Set()
  const found = new Set()
  const walk = (expr) => {
    if (expr === null || typeof expr !== "object") return
    switch (expr.kind) {
      case "let":
        walk(expr.in ?? expr.body)
        return
      case "if":
        walk(expr.then)
        walk(expr.else)
        return
      case "match":
        for (const branch of expr.cases ?? []) {
          if (branch !== null && typeof branch === "object") walk(branch.body)
        }
        return
      case "call":
        if (typeof expr.name === "string") found.add(expr.name)
        return
      default:
    }
  }
  walk(fn.body)
  return found
}

/** Все вызовы тела — граф для поиска рекурсии (не только хвостовой). */
function allCallees(fn) {
  const found = new Set()
  const seen = new Set()
  const walk = (node) => {
    if (node === null || typeof node !== "object" || seen.has(node)) return
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    seen.add(node)
    if (node.kind === "call" && typeof node.name === "string") found.add(node.name)
    for (const value of Object.values(node)) walk(value)
  }
  walk(fn.body)
  for (const property of fn.postconditions) walk(property.expr)
  return found
}

// Компоненты сильной связности (Тарьян) на явном стеке: эмиттер не имеет права
// падать на глубине графа вызовов.
function stronglyConnected(names, edges) {
  const index = new Map()
  const low = new Map()
  const onStack = new Set()
  const stack = []
  const components = []
  let counter = 0

  for (const root of names) {
    if (index.has(root)) continue
    const work = [{ name: root, edges: [...(edges.get(root) ?? [])], position: 0 }]
    index.set(root, counter)
    low.set(root, counter)
    counter += 1
    stack.push(root)
    onStack.add(root)

    while (work.length > 0) {
      const frame = work[work.length - 1]
      if (frame.position < frame.edges.length) {
        const next = frame.edges[frame.position]
        frame.position += 1
        if (!names.includes(next)) continue
        if (!index.has(next)) {
          index.set(next, counter)
          low.set(next, counter)
          counter += 1
          stack.push(next)
          onStack.add(next)
          work.push({ name: next, edges: [...(edges.get(next) ?? [])], position: 0 })
        } else if (onStack.has(next)) {
          low.set(frame.name, Math.min(low.get(frame.name), index.get(next)))
        }
        continue
      }
      work.pop()
      if (work.length > 0) {
        const parent = work[work.length - 1]
        low.set(parent.name, Math.min(low.get(parent.name), low.get(frame.name)))
      }
      if (low.get(frame.name) === index.get(frame.name)) {
        const component = []
        for (;;) {
          const name = stack.pop()
          onStack.delete(name)
          component.push(name)
          if (name === frame.name) break
        }
        components.push(component)
      }
    }
  }
  return components
}

/* ═══════════════════════════ литералы Java ═══════════════════════════ */

/**
 * Строковый литерал Java.
 *
 * Кириллица печатается как есть — исходник записывается в UTF-8, и javac ему
 * велено читать его в UTF-8 (`-encoding UTF-8` в Makefile). Ровно ради этого
 * язык и затевался: имена в напечатанном коде обязаны читаться.
 *
 * По символам, а не по единицам UTF-16: суррогатная пара обязана уехать в файл
 * парой, а не двумя escape-последовательностями, — иначе строка, разобранная и
 * собранная обратно, перестала бы совпадать с исходной по кодовым точкам.
 *
 * Двунаправленные управляющие (набор — bidi.mjs, общий на все бэкенды обоих
 * компиляторов) уезжают в `\uXXXX`: другой формы для них у Java нет вовсе —
 * `\xNN` язык не знает, а восьмеричные (`\NNN`) кончаются на \377 и кодовую
 * точку U+202E выразить не могут. Все двенадцать лежат в BMP, поэтому каждая —
 * ровно одно экранирование, та же кодовая точка и та же длина строки в char:
 * значение литерала не меняется, меняется только запись.
 */
function javastring(value) {
  let result = '"'
  for (const character of String(value)) {
    const code = character.codePointAt(0)
    if (character === '"') result += '\\"'
    else if (character === "\\") result += "\\\\"
    else if (character === "\n") result += "\\n"
    else if (character === "\r") result += "\\r"
    else if (character === "\t") result += "\\t"
    else if (code < 0x20 || code === 0x7f || BIDI_CONTROLS.has(code)) {
      /* Java не знает \xNN, только \uNNNN и восьмеричные.

         `\uXXXX` в Java разворачивается ещё до лексера (JLS 3.3), и это здесь
         не помеха: обратный слэш значения печатается парой `\\`, а перед `\u`
         оказывается чётное число слэшей — то есть экранирование остаётся
         экранированием и даёт ровно тот символ, что был. */
      result += `\\u${code.toString(16).padStart(4, "0")}`
    } else result += character
  }
  return `${result}"`
}

/**
 * Число как литерал Java (double).
 *
 * NaN и бесконечности литералом записать нельзя вовсе — только константами
 * Double. Всё остальное печатается кратчайшей записью, читающейся обратно тем
 * же double: `String(value)` даёт именно её, а суффикс `d` делает литерал
 * заведомо вещественным (без него `2` было бы int, и `2 / 3` посчиталось бы
 * целочисленно там, где выражение попадёт в арифметику Java напрямую).
 *
 * −0.0 в Java — настоящий отрицательный ноль, и Double.doubleToRawLongBits его
 * различает, поэтому особого приёма не нужно: нужен только знак.
 */
function javanumber(value) {
  if (Number.isNaN(value)) return "Double.NaN"
  if (value === Infinity) return "Double.POSITIVE_INFINITY"
  if (value === -Infinity) return "Double.NEGATIVE_INFINITY"
  if (Object.is(value, -0)) return "-0.0d"
  const text = String(value)
  /* Экспоненциальная запись JS («1e+21») — допустимый литерал Java, а вот
     запись без точки и без экспоненты («2») стала бы int. */
  return /[.e]/u.test(text) ? `${text}d` : `${text}.0d`
}

/**
 * Идентификатор Java не может начинаться с цифры и не может быть пустым.
 */
function safeIdent(identifier) {
  if (identifier.length === 0) return "value"
  return /^[0-9]/u.test(identifier) ? `v${identifier}` : identifier
}

/* ═══════════════════════════ имена ═══════════════════════════ */

/**
 * Именователь верхнего уровня: роль плюс транслитерация имени модели.
 *
 * Роль входит в идентификатор всегда — см. шапку файла. Столкнуться поэтому
 * могут только два имени одной роли («Сумма» и «сумма» дают один fn_summa), и
 * это ошибка печати, а не молчаливое переименование: сгенерированный код читают
 * рядом с моделью, и два разных имени модели обязаны остаться различимыми.
 */
function createDeclarations(reserved) {
  const taken = new Map(reserved.map((word) => [word, { role: null, name: word }]))
  return {
    taken,
    claim(role, name) {
      const identifier = safeIdent(`${ROLE_PREFIX[role]}${snake(name)}`)
      const previous = taken.get(identifier)
      if (previous !== undefined && !(previous.role === role && previous.name === name)) {
        const owner = previous.role === null
          ? `зарезервировано в Java: ${previous.name}`
          : `${ROLE_LABEL[previous.role]} «${previous.name}»`
        throw flangError(
          "FLANG_PARSE",
          `имя ${ROLE_LABEL[role]} «${name}» даёт идентификатор «${identifier}», ` +
            `уже занятый (${owner}) — переименуйте одно из имён в модели`,
        )
      }
      taken.set(identifier, { role, name })
      return identifier
    },
  }
}

/* ═══════════════════════════ печать ═══════════════════════════ */

/**
 * Печать программы flang в Java.
 *
 * @param {object} program AST flang (SPEC.md, раздел 5)
 * @param {{ path?: string, indexBase?: 0 | 1, maxDepth?: number, maxSteps?: number, cli?: boolean }} [options]
 * @returns {{ files: Array<{ path: string, content: string }> }}
 */
export function emitJava(program, options = {}) {
  /* Дефункционализация — ОДИН проход на все восемь целей (src/defunc.mjs), а не
     восемь реализаций: после него в программе нет ни функций-значений, ни
     применения, и печатается она теми же узлами, что и всё остальное. На
     программе без высшего порядка проход тождествен — возвращает ТОТ ЖЕ объект,
     — поэтому напечатанное не меняется ни на байт, и неподвижная точка цела. */
  program = defunctionalize(program)
  const prepared = prepare(program)
  const base = options.indexBase === 0 ? 0 : 1
  const maxDepth = Number.isInteger(options.maxDepth) && options.maxDepth > 0 ? options.maxDepth : 10_000
  const maxSteps = Number.isInteger(options.maxSteps) && options.maxSteps > 0 ? options.maxSteps : 1_000_000
  const moduleName = typeof program.module === "string" && program.module.length > 0 ? program.module : null
  const className = options.path ?? (moduleName === null ? "FlangProgram" : safeIdent(pascal(moduleName)))
  if (RUNTIME_TYPES.includes(className)) {
    throw flangError(
      "FLANG_PARSE",
      `модуль «${moduleName}» даёт класс «${className}», занятый рантаймом бэкенда — переименуйте модуль`,
    )
  }

  /* Одно пространство имён на класс, поэтому один именователь на всё, что
     объявляется в нём: функции, фабрики записей, конструкторы вариантов, шаги
     батута. Имена, которые печатает сам бэкенд, заняты заранее, как и имена
     типов рантайма. */
  const declarations = createDeclarations([...JAVA_RESERVED, ...DECLARED_BY_BACKEND])

  const functionIdents = new Map()
  const factoryIdents = new Map()
  const variantIdents = new Map()
  for (const name of prepared.records.keys()) factoryIdents.set(name, declarations.claim("record", name))
  for (const name of prepared.variants.keys()) variantIdents.set(name, declarations.claim("variant", name))
  for (const name of prepared.functions.keys()) functionIdents.set(name, declarations.claim("function", name))

  /* Граф хвостовых вызовов: кто разворачивается в цикл, а кто — в батут. */
  const names = [...prepared.functions.keys()]
  const tailEdges = new Map()
  for (const [name, fn] of prepared.functions) tailEdges.set(name, tailCallees(fn))
  const cyclic = new Map()
  for (const component of stronglyConnected(names, tailEdges)) {
    if (component.length < 2) continue
    const members = new Set(component)
    for (const name of component) cyclic.set(name, members)
  }

  /* Граф всех вызовов: кто способен к рекурсии и потому обязан считать глубину. */
  const callEdges = new Map()
  for (const [name, fn] of prepared.functions) callEdges.set(name, allCallees(fn))
  const recursive = new Set()
  for (const component of stronglyConnected(names, callEdges)) {
    if (component.length >= 2) {
      for (const name of component) recursive.add(name)
      continue
    }
    if (callEdges.get(component[0])?.has(component[0])) recursive.add(component[0])
  }

  const stepIdents = new Map()
  for (const name of cyclic.keys()) stepIdents.set(name, declarations.claim("step", name))

  /* Имена параметров считаются один раз: их видят и сигнатура, и тело, и шаг
     батута — разойтись им нельзя. Локальные имена не имеют права затенить
     объявления класса: затенённый fn_… превратил бы вызов метода в чтение
     переменной, а Java запрещает и просто повторное объявление имени во
     вложенном блоке — в отличие от C. */
  const globalNames = new Set(declarations.taken.keys())
  const paramIdents = new Map()
  for (const [name, fn] of prepared.functions) {
    paramIdents.set(name, uniqueIdents(fn.params.map((param) => param.name), globalNames))
  }

  const shared = {
    prepared,
    className,
    globalNames,
    paramIdents,
    functionIdents,
    factoryIdents,
    variantIdents,
    stepIdents,
    tailEdges,
    cyclic,
    recursive,
    counter: 0,
  }

  const bodies = [renderContext(base, maxDepth, maxSteps)]
  for (const [name, type] of prepared.records) bodies.push(renderFactory(name, type, shared))
  for (const sum of prepared.sums) {
    for (const item of sum.variants ?? []) {
      if (variantIdents.has(item.name)) bodies.push(renderVariantFactory(sum, item, shared))
    }
  }
  for (const fn of prepared.functions.values()) bodies.push(renderFunction(fn, shared))
  bodies.push(renderDispatch(shared))

  const files = []
  for (const [name, what] of RUNTIME_FILES) {
    files.push({ path: name, content: `${banner(moduleName, what)}\n${RUNTIME_SOURCE.get(name)}` })
  }
  files.push({ path: `${className}.java`, content: renderSource(moduleName, className, bodies) })

  if (options.cli !== false) {
    files.push({
      path: CLI_FILE,
      content: `${banner(moduleName, "прогонщик: JSON на входе, JSON на выходе")}\n${CLI_SOURCE}`,
    })
  }
  files.push({ path: "Makefile", content: renderMakefile(className, options.cli !== false) })
  /* Последний шаг — снять сырые двунаправленные управляющие со всего вывода
     (bidi.mjs). Литералы их уже экранировали сами, но имя FTS уезжает ещё и в
     комментарии — в шапку файла, в javadoc функции, в подпись параметра, — а
     комментарий читают первым и проверить исполнением не могут. Форма для Java
     одна: `\uXXXX`. */
  return { files: escapeBidiInFiles(files, escapeBidiUnicode4) }
}

function banner(moduleName, what) {
  return [
    "// Сгенерировано flang (бэкенд Java, flang/src/emit/java.mjs). Не редактировать руками.",
    moduleName === null ? "// Программа flang без имени модуля." : `// Модуль flang: «${moduleName}».`,
    `// Файл: ${what}.`,
    "// Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.",
  ].join("\n")
}

function renderMakefile(className, cli) {
  return [
    "# Сгенерировано flang (бэкенд Java). Целей ровно столько, сколько нужно:",
    "# напечатанный код обязан собираться и запускаться без единой правки.",
    "JAVAC ?= javac",
    "JAVA ?= java",
    `CLASS ?= ${className}`,
    "",
    "# -encoding UTF-8 обязателен: имена в напечатанном коде кириллические, а",
    "# кодировка исходника по умолчанию зависит от локали машины.",
    "# -Xlint:all -Werror — не придирка: напечатанный код обязан быть чистым",
    "# под самым строгим режимом javac, иначе он не пройдёт в чужую сборку.",
    "JAVACFLAGS ?= -encoding UTF-8 -Xlint:all -Werror",
    "",
    "all: build",
    "",
    "build:",
    "\t$(JAVAC) $(JAVACFLAGS) -d . *.java",
    "",
    ...(cli
      ? [
        "# -Xss не нужен: прогонщик сам считает в потоке с большим стеком.",
        "run: build",
        "\t$(JAVA) -cp . FlangCli $(CLASS)",
        "",
      ]
      : []),
    "clean:",
    "\trm -f *.class",
    "",
    `.PHONY: all build${cli ? " run" : ""} clean`,
    "",
  ].join("\n")
}

/* ── файл программы ── */

function renderSource(moduleName, className, bodies) {
  const head = [
    banner(moduleName, "реализация: функции, конструкторы значений, вызов по имени"),
    "",
    "/**",
    moduleName === null
      ? " * Программа flang, напечатанная в Java."
      : ` * Модуль flang «${escapeComment(moduleName)}», напечатанный в Java.`,
    " *",
    " * Контракт вызова: метод возвращает значение либо бросает FlangError с кодом и",
    " * текстом, дословно совпадающими с интерпретатором flang. Все значения — Value:",
    " * числа там всегда double (целых чисел в flang нет), признак отличается от числа",
    " * тегом, а не типом Java, и равенство скаляров — Object.is, а не ==.",
    " *",
    " * FlangError непроверяемая (см. FlangError.java), поэтому ни один метод здесь не",
    " * объявляет throws: ошибку языка умеет дать любая операция, и объявление не",
    " * сообщило бы вызывающему ничего нового.",
    " */",
    `public final class ${className} {`,
    "",
    `  private ${className}() {}`,
  ].join("\n")
  return `${[head, ...bodies.filter((body) => body.length > 0), "}"].join("\n\n")}\n`
}

/** Имя модели внутри javadoc не имеет права закрыть комментарий раньше времени. */
function escapeComment(value) {
  return String(value).replaceAll("*/", "*\\/")
}

function renderContext(base, maxDepth, maxSteps) {
  return [
    "  /**",
    "   * Контекст вычисления с настройками этой программы.",
    "   *",
    "   * Индексация строк, предел глубины вызовов и лимит шагов — это настройки",
    "   * программы, а не рантайма: печать могла идти с нулевой базой индексации, а",
    "   * пределы вызывающий вправе поменять прямо в возвращённом контексте.",
    "   */",
    "  public static Ctx newContext() {",
    "    Ctx ctx = new Ctx();",
    `    ctx.indexBase = ${base};`,
    `    ctx.maxDepth = ${maxDepth};`,
    `    ctx.maxSteps = ${maxSteps}L;`,
    "    return ctx;",
    "  }",
  ].join("\n")
}

/** Строка документации Java из готовых строк текста. */
function javadoc(lines, pad) {
  const safe = lines.map((line) => escapeComment(line))
  return [`${pad}/**`, ...safe.map((line) => (line === "" ? `${pad} *` : `${pad} * ${line}`)), `${pad} */`]
}

function describeFunction(fn, shared) {
  const lines = [`Функция flang «${fn.name}».`, ""]
  lines.push(
    fn.total
      ? "Тотальная: завершение доказано анализом завершаемости (totality.mjs)."
      : "Обычная (не тотальная): завершение не доказано, зацикливание ловится лимитом шагов.",
  )
  if (shared.tailEdges.get(fn.name)?.has(fn.name) === true && fn.postconditions.length === 0) {
    lines.push("", "Хвостовой самовызов развёрнут в цикл: стек не растёт.")
  }
  const members = shared.cyclic.get(fn.name)
  if (members !== undefined) {
    const others = [...members].filter((name) => name !== fn.name).map((name) => `«${name}»`).join(", ")
    lines.push("", `Взаимная хвостовая рекурсия с ${others}: вызовы идут через батут.`)
  }
  if (shared.recursive.has(fn.name)) {
    lines.push("", "Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.")
  }
  const idents = shared.paramIdents.get(fn.name)
  lines.push("")
  fn.params.forEach((param, index) => {
    lines.push(`@param ${idents[index]} «${param.name}»${typeNote(param.type)}`)
  })
  lines.push(`@return значение${typeNote(fn.returns)}`)
  return lines
}

function typeNote(type) {
  if (type === null || type === undefined || typeof type !== "object") return ""
  switch (type.kind) {
    case "string": return ": строка"
    case "number": return ": число"
    case "boolean": return ": признак"
    case "nothing": return ": ничто"
    case "list": return `: список${typeNote(type.of)}`
    default: return typeof type.name === "string" ? `: «${type.name}»` : ""
  }
}

/**
 * Идентификаторы Java для набора имён модели: транслитерация плюс развод
 * столкновений. Столкнуться могут и «цена» с «Цена», и поле, чьё имя после
 * транслитерации совпало с ключевым словом Java или с объявлением класса.
 */
function uniqueIdents(names, globalNames) {
  const taken = new Set([...JAVA_RESERVED, ...globalNames])
  return names.map((name) => {
    const wanted = safeIdent(snake(name))
    let candidate = wanted
    let suffix = 1
    while (taken.has(candidate) || /^t[0-9]+$/u.test(candidate)) {
      suffix += 1
      candidate = `${wanted}${suffix}`
    }
    taken.add(candidate)
    return candidate
  })
}

/* ── фабрики записей и вариантов ── */

function renderFields(pad, keys, values, variantName) {
  if (keys.length === 0) {
    return variantName === null
      ? "Value.emptyRecord()"
      : `Value.variant(${javastring(variantName)}, new Field[0])`
  }
  const body = keys.map((key, index) => `new Field(${javastring(key)}, ${values[index]})`).join(", ")
  return variantName === null
    ? `Value.record(new Field[] {${body}})`
    : `Value.variant(${javastring(variantName)}, new Field[] {${body}})`
}

function renderFactory(name, type, shared) {
  const fields = Array.isArray(type.fields) ? type.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name), shared.globalNames)
  const signature = idents.map((ident) => `Value ${ident}`).join(", ")
  return [
    ...javadoc([
      `Запись FTS «${name}»: ${fields.map((field) => `«${field.name}»`).join(", ") || "без полей"}.`,
      "",
      "Запись flang тотальна: пропущенное поле — это «ничто», а не дырка.",
    ], "  "),
    `  public static Value ${shared.factoryIdents.get(name)}(${signature}) {`,
    `    return ${renderFields("    ", fields.map((field) => field.name), idents, null)};`,
    "  }",
  ].join("\n")
}

function renderVariantFactory(sum, item, shared) {
  const fields = Array.isArray(item.fields) ? item.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name), shared.globalNames)
  const signature = idents.map((ident) => `Value ${ident}`).join(", ")
  return [
    ...javadoc([
      `Вариант «${item.name}» суммы типов «${sum.name}».`,
      "",
      "Дискриминант — имя варианта; проверяется через Value.variantIs(значение, «Имя»).",
      "Приставка v_ в имени — это роль: у функции flang с тем же именем идентификатор",
      "начинается с fn_, и одно объявление не спорит с другим.",
    ], "  "),
    `  public static Value ${shared.variantIdents.get(item.name)}(${signature}) {`,
    `    return ${renderFields("    ", fields.map((field) => field.name), idents, item.name)};`,
    "  }",
  ].join("\n")
}

/* ═══════════════════════════ печать функции ═══════════════════════════ */

function renderFunction(fn, shared) {
  const members = shared.cyclic.get(fn.name) ?? null
  const selfTail = shared.tailEdges.get(fn.name)?.has(fn.name) === true
  const guard = shared.recursive.has(fn.name)

  const ctx = createContext(fn, shared, { selfTail, members })
  const body = []
  /* Тело функции с батутом печатается внутри шага, у остальных — внутри самой
     функции; отступ у обоих один, а обёртка вокруг разная. */
  const inner = guard && members === null ? "      " : "    "

  if (fn.postconditions.length > 0) {
    /* Постусловия проверяются после тела: результат уже вычислен, и первое же
       нарушение прерывает вычисление — как в интерпретаторе. */
    const value = emitValue(fn.body, ctx, body, inner)
    const result = ctx.temp()
    body.push(`${inner}Value ${result} = ${value};`)
    for (const property of fn.postconditions) {
      const previous = ctx.bind(property.bind, result)
      const check = emitValue(property.expr, ctx, body, inner)
      ctx.unbind(property.bind, previous)
      const message = property.message ?? `нарушено свойство «${property.name}» функции «${fn.name}»`
      body.push(
        `${inner}// постусловие «${property.name}»`,
        `${inner}if (!Flang.post(ctx, ${check}, ${javastring(property.name)}, ${javastring(fn.name)})) {`,
        `${inner}  throw Flang.fail(${javastring(property.code)}, ${javastring(message)});`,
        `${inner}}`,
      )
    }
    body.push(`${inner}return ${result};`)
  } else if (selfTail) {
    /* Ни одного оператора после этого цикла печатать нельзя: `while (true)` без
       достижимого break не завершается нормально, и javac объявил бы всё
       следующее недостижимым — это ошибка компиляции, а не предупреждение.
       Ровно поэтому здесь нет и переменной результата, в которую функция с
       чисто хвостовой рекурсией ни разу не пишет. */
    body.push(`${inner}while (true) {`)
    emitTail(fn.body, ctx, body, `${inner}  `)
    body.push(`${inner}}`)
  } else {
    emitTail(fn.body, ctx, body, inner)
  }

  const documentation = javadoc(describeFunction(fn, shared), "  ")
  const params = ["Ctx ctx", ...ctx.params.map((param) => `Value ${param}`)].join(", ")
  const signature = `  public static Value ${shared.functionIdents.get(fn.name)}(${params}) {`

  if (members !== null) {
    /* Батут: наружу торчит обычный метод, внутри — шаг, возвращающий отскок.
       Ссылка на метод (Класс::step_…) — самая дешёвая форма значения-функции в
       Java: никакого объекта не создаётся, JVM связывает её один раз. */
    const step = shared.stepIdents.get(fn.name)
    const unpack = ctx.params.flatMap((param, index) => [
      `    // «${fn.params[index].name}»`,
      `    Value ${param} = args[${index}];`,
    ])
    const stepBlock = [
      ...javadoc([
        `Шаг батута для «${fn.name}»: значение либо отскок к соседу по рекурсии.`,
      ], "  "),
      `  private static Value ${step}(Ctx ctx, Value[] args, Flang.Bounce bounce) {`,
      ...unpack,
      ...body,
      "  }",
    ].join("\n")

    const outer = [
      ...documentation,
      signature,
      `    ctx.enter(${javastring(fn.name)});`,
      "    try {",
      `      return Flang.trampoline(ctx, ${shared.className}::${step},`,
      `          new Value[] {${ctx.params.join(", ")}}, ${javastring(fn.name)});`,
      "    } finally {",
      "      ctx.leave();",
      "    }",
      "  }",
    ].join("\n")
    return `${stepBlock}\n\n${outer}`
  }

  if (guard) {
    /* Счётчик глубины обязан уменьшаться и на ошибке, иначе первая же пойманная
       ошибка навсегда съела бы предел; ctx.enter вне try намеренно — если он
       сам бросил FLANG_RECURSION_LIMIT, входа не было, и выхода быть не должно. */
    return [
      ...documentation,
      signature,
      `    ctx.enter(${javastring(fn.name)});`,
      "    try {",
      ...body,
      "    } finally {",
      "      ctx.leave();",
      "    }",
      "  }",
    ].join("\n")
  }
  return [...documentation, signature, ...body, "  }"].join("\n")
}

function createContext(fn, shared, { selfTail, members }) {
  const ctx = {
    shared,
    fn,
    scope: new Map(),
    taken: new Set([...JAVA_RESERVED, ...shared.globalNames]),
    params: [],
    selfTail,
    members,
    temp() {
      shared.counter += 1
      return `t${shared.counter}`
    },
    fresh(name) {
      const wanted = safeIdent(snake(name))
      let candidate = wanted
      let suffix = 1
      /* Имя модели вроде «т16» после транслитерации даёт «t16» — ровно форму
         временного имени, поэтому она и проверяется. */
      while (ctx.taken.has(candidate) || /^t[0-9]+$/u.test(candidate)) {
        suffix += 1
        candidate = `${wanted}${suffix}`
      }
      ctx.taken.add(candidate)
      return candidate
    },
    bind(name, ident) {
      const previous = ctx.scope.has(name) ? ctx.scope.get(name) : null
      ctx.scope.set(name, ident)
      return previous
    },
    unbind(name, previous) {
      if (previous === null) ctx.scope.delete(name)
      else ctx.scope.set(name, previous)
    },
  }
  for (const [index, param] of fn.params.entries()) {
    const ident = shared.paramIdents.get(fn.name)[index]
    ctx.taken.add(ident)
    ctx.params.push(ident)
    ctx.bind(param.name, ident)
  }
  return ctx
}

/* ── хвостовая позиция: здесь живут return, continue и отскоки ── */

function emitTail(expr, ctx, out, pad) {
  const node = requireExpr(expr)
  switch (node.kind) {
    case "let": {
      const value = emitValue(node.value, ctx, out, pad)
      requireName(node.name, "let", "name", node.span)
      const ident = ctx.fresh(node.name)
      out.push(`${pad}// пусть «${node.name}»`, `${pad}Value ${ident} = ${value};`)
      const previous = ctx.bind(node.name, ident)
      emitTail(node.in ?? node.body, ctx, out, pad)
      ctx.unbind(node.name, previous)
      return
    }
    case "if": {
      const flag = emitValue(node.cond, ctx, out, pad)
      out.push(`${pad}if (Flang.cond(ctx, ${flag})) {`)
      emitTail(node.then, ctx, out, `${pad}  `)
      out.push(`${pad}} else {`)
      emitTail(node.else, ctx, out, `${pad}  `)
      out.push(`${pad}}`)
      return
    }
    case "match":
      emitMatch(node, ctx, out, pad, null)
      return
    case "call": {
      const callee = resolveCall(node, ctx)
      const args = emitOrdered(
        (node.args ?? []).map((argument) => (out2, pad2) => emitValue(argument, ctx, out2, pad2)),
        ctx, out, pad,
      )
      if (ctx.selfTail && node.name === ctx.fn.name) {
        /* Самовызов в хвосте — это цикл. Присваивание параметров идёт по
           очереди, поэтому аргумент, который ещё читает старое значение
           параметра, обязан сперва лечь во временное. */
        const temps = args.map((argument) => {
          if (isAtom(argument) && !ctx.params.includes(argument)) return argument
          const temp = ctx.temp()
          out.push(`${pad}Value ${temp} = ${argument};`)
          return temp
        })
        ctx.params.forEach((param, index) => {
          out.push(`${pad}${param} = ${temps[index]};`)
        })
        out.push(
          `${pad}// виток цикла — тоже шаг вычисления: незавершающийся хвостовой`,
          `${pad}// самовызов обязан упереться в лимит, а не крутиться вечно`,
          `${pad}ctx.step(${javastring(ctx.fn.name)});`,
          `${pad}continue;`,
        )
        return
      }
      if (ctx.members !== null && ctx.members.has(node.name)) {
        out.push(
          `${pad}// хвостовой вызов «${node.name}» — отскок, а не кадр стека`,
          `${pad}bounce.args = new Value[] {${args.join(", ")}};`,
          `${pad}bounce.next = ${ctx.shared.className}::${ctx.shared.stepIdents.get(node.name)};`,
          `${pad}return null;`,
        )
        return
      }
      out.push(
        `${pad}return ${ctx.shared.functionIdents.get(callee.name)}(${["ctx", ...args].join(", ")});`,
      )
      return
    }
    default: {
      const value = emitValue(node, ctx, out, pad)
      out.push(`${pad}return ${value};`)
    }
  }
}

/* ── значение: возвращает выражение Java, попутно печатая нужные операторы ── */

function emitValue(expr, ctx, out, pad) {
  const node = requireExpr(expr)
  switch (node.kind) {
    case "literal":
      return emitLiteral(node.value, ctx, out, pad)
    case "var": {
      const ident = ctx.scope.get(node.name)
      if (ident === undefined) {
        throw flangError("FLANG_UNKNOWN_NAME", `имя «${node.name}» не связано`, node.span)
      }
      return ident
    }
    case "field": {
      const target = emitValue(node.target, ctx, out, pad)
      return `Flang.fieldGet(ctx, ${target}, ${javastring(node.field)})`
    }
    case "let": {
      const value = emitValue(node.value, ctx, out, pad)
      requireName(node.name, "let", "name", node.span)
      const ident = ctx.fresh(node.name)
      out.push(`${pad}// пусть «${node.name}»`, `${pad}Value ${ident} = ${value};`)
      const previous = ctx.bind(node.name, ident)
      const body = emitValue(node.in ?? node.body, ctx, out, pad)
      ctx.unbind(node.name, previous)
      return body
    }
    case "if": {
      const flag = emitValue(node.cond, ctx, out, pad)
      const temp = ctx.temp()
      /* Объявление отдельно от присваивания: значение приходит из двух ветвей,
         а Java требует, чтобы к моменту чтения переменная была определённо
         присвоена по любому пути — обе ветви присваивают, и этого довольно. */
      out.push(`${pad}Value ${temp};`, `${pad}if (Flang.cond(ctx, ${flag})) {`)
      assignInto(node.then, ctx, out, `${pad}  `, temp)
      out.push(`${pad}} else {`)
      assignInto(node.else, ctx, out, `${pad}  `, temp)
      out.push(`${pad}}`)
      return temp
    }
    case "match": {
      const temp = ctx.temp()
      out.push(`${pad}Value ${temp};`)
      emitMatch(node, ctx, out, pad, temp)
      return temp
    }
    case "call": {
      const callee = resolveCall(node, ctx)
      const args = emitOrdered(
        (node.args ?? []).map((argument) => (out2, pad2) => emitValue(argument, ctx, out2, pad2)),
        ctx, out, pad,
      )
      return `${ctx.shared.functionIdents.get(callee.name)}(${["ctx", ...args].join(", ")})`
    }
    case "builtin": {
      const canonical = canonicalBuiltinName(node.name)
      if (!hasBuiltin(node.name)) {
        throw flangError("FLANG_UNKNOWN_NAME", `неизвестная встроенная форма «${node.name}»`, node.span)
      }
      const args = node.args ?? []
      if (!Array.isArray(args)) {
        throw flangError("FLANG_PARSE", "аргументы выражения должны быть списком", node.span)
      }
      expectArity(canonical, args.length, node.span)
      const rendered = emitOrdered(
        args.map((argument) => (out2, pad2) => emitValue(argument, ctx, out2, pad2)),
        ctx, out, pad,
      )
      return `Flang.${BUILTIN_HELPERS.get(canonical)}(${["ctx", ...rendered].join(", ")})`
    }
    case "binary": {
      const [left, right] = emitOrdered([
        (out2, pad2) => emitValue(node.left, ctx, out2, pad2),
        (out2, pad2) => emitValue(node.right, ctx, out2, pad2),
      ], ctx, out, pad)
      if (node.op === "eq" || node.op === "neq") {
        /* Равенство ошибок не даёт: сравнимо всё со всем (SPEC, раздел 5). */
        return node.op === "eq" ? `Flang.eq(${left}, ${right})` : `Flang.neq(${left}, ${right})`
      }
      const helper = BINARY_HELPERS.get(node.op)
      if (helper === undefined) {
        throw flangError("FLANG_TYPE", `неизвестная операция «${node.op}»`, node.span)
      }
      return `Flang.${helper}(ctx, ${left}, ${right})`
    }
    case "list": {
      const items = node.items ?? []
      if (!Array.isArray(items)) {
        throw flangError("FLANG_PARSE", "аргументы выражения должны быть списком", node.span)
      }
      const rendered = emitOrdered(
        items.map((item) => (out2, pad2) => emitValue(item, ctx, out2, pad2)),
        ctx, out, pad,
      )
      return rendered.length === 0 ? "Value.emptyList()" : `Value.list(new Value[] {${rendered.join(", ")}})`
    }
    case "record": {
      checkRecordType(node, ctx)
      return emitFields(node.fields ?? {}, null, ctx, out, pad)
    }
    case "construct": {
      checkVariantName(node, ctx)
      return emitFields(node.fields ?? {}, node.variant, ctx, out, pad)
    }
    case "fold":
      return emitFold(node, ctx, out, pad)
    case "map":
    case "filter":
      return emitLoop(node, ctx, out, pad)
    default:
      throw flangError("FLANG_PARSE", `неизвестный вид выражения «${node.kind}»`, node.span)
  }
}

/**
 * Атом — выражение, которое можно передвинуть по тексту, ничего не изменив:
 * имя (никто из напечатанного не переприсваивает чужое имя) и литерал.
 * Всё остальное при переносе через чужие операторы обязано материализоваться.
 */
function isAtom(expression) {
  return /^[A-Za-z_][A-Za-z_0-9]*$/u.test(expression)
}

/**
 * Печать нескольких значений с сохранением порядка вычисления.
 *
 * Значение печатается выражением и вычисляется там, где это выражение стоит.
 * Пока соседи тоже выражения, порядок обеспечивает сама Java (JLS 15.7.4:
 * аргументы вызова и элементы инициализатора массива вычисляются слева
 * направо). Но узел, которому нужны собственные операторы (условие, разбор,
 * свёртка), печатает их ПЕРЕД выражением — и тогда всё, что стоит левее,
 * обязано вычислиться до них, иначе первая ошибка окажется не той. Поэтому
 * левые соседи материализуются во временные ровно в тот момент, когда справа
 * появился первый оператор.
 */
function emitOrdered(makers, ctx, out, pad) {
  const parts = []
  for (const make of makers) {
    const at = out.length
    const value = make(out, pad)
    if (out.length > at) {
      const hoisted = []
      for (const part of parts) {
        if (isAtom(part.value)) continue
        const temp = ctx.temp()
        hoisted.push(`${pad}Value ${temp} = ${part.value};`)
        part.value = temp
      }
      if (hoisted.length > 0) out.splice(at, 0, ...hoisted)
    }
    parts.push({ value })
  }
  return parts.map((part) => part.value)
}

/** Вычислить выражение и положить результат в уже объявленную переменную. */
function assignInto(expr, ctx, out, pad, target) {
  const value = emitValue(expr, ctx, out, pad)
  out.push(`${pad}${target} = ${value};`)
}

/** Значение, которое читается больше одного раза, обязано лечь во временное. */
function materialize(value, ctx, out, pad, type = "Value") {
  if (isAtom(value)) return value
  const temp = ctx.temp()
  out.push(`${pad}${type} ${temp} = ${value};`)
  return temp
}

/* ── литералы ── */

function emitLiteral(value, ctx, out, pad) {
  if (value === undefined || value === null) return "Value.nothing()"
  if (typeof value === "boolean") return `Value.flag(${value ? "true" : "false"})`
  if (typeof value === "number") return `Value.number(${javanumber(value)})`
  if (typeof value === "string") return `Value.text(${javastring(value)})`
  if (Array.isArray(value)) {
    const items = emitOrdered(
      value.map((item) => (out2, pad2) => emitLiteral(item, ctx, out2, pad2)),
      ctx, out, pad,
    )
    return items.length === 0 ? "Value.emptyList()" : `Value.list(new Value[] {${items.join(", ")}})`
  }
  if (typeof value === "object") {
    /* Вариант в JSON записан как { variant, fields } — классов JSON не знает, и
       ровно так его читает reifyValue интерпретатора (builtins.mjs). Литерал
       такой формы обязан стать вариантом и здесь, иначе разбор напечатанной
       программы не сопоставил бы его ни с одним образцом, а интерпретатор
       сопоставил бы. Форма узнаётся строго — объект ровно с двумя полями. */
    const encoded = encodedVariant(value)
    const source = encoded === null ? value : encoded.fields
    const keys = Object.keys(source)
    const values = emitOrdered(
      keys.map((key) => (out2, pad2) => emitLiteral(source[key], ctx, out2, pad2)),
      ctx, out, pad,
    )
    return renderFields(pad, keys, values, encoded === null ? null : encoded.variant)
  }
  throw flangError("FLANG_PARSE", `литерал недопустимого вида: ${typeof value}`)
}

/**
 * Значение-вариант в записи JSON: объект ровно с двумя полями, «variant» —
 * непустая строка, «fields» — объект. Проверка дословно повторяет
 * encodedVariant из builtins.mjs: расхождение здесь означало бы, что литерал,
 * который интерпретатор считает вариантом, напечатанный код считает записью.
 */
function encodedVariant(value) {
  if (value === null || Array.isArray(value)) return null
  const keys = Object.keys(value)
  if (keys.length !== 2 || !keys.includes("variant") || !keys.includes("fields")) return null
  if (typeof value.variant !== "string" || value.variant === "") return null
  const fields = value.fields
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) return null
  return { variant: value.variant, fields }
}

/* ── составные значения ── */

function emitFields(fields, variantName, ctx, out, pad) {
  const keys = Object.keys(fields)
  const values = emitOrdered(
    keys.map((key) => (out2, pad2) => emitValue(fields[key], ctx, out2, pad2)),
    ctx, out, pad,
  )
  return renderFields(pad, keys, values, variantName)
}

/* ── разбор ── */

// `target === null` — хвостовая позиция (тела ветвей печатают возврат), иначе
// результат каждой ветви кладётся в переданную переменную.
function emitMatch(node, ctx, out, pad, target) {
  const subject = materialize(emitValue(node.target, ctx, out, pad), ctx, out, pad)
  const cases = node.cases ?? []
  if (!Array.isArray(cases)) {
    throw flangError("FLANG_PARSE", "случай разбора должен содержать «pattern» и «body»", node.span)
  }

  /* Литерал в образце может потребовать собственных операторов, поэтому все
     проверки готовятся до цепочки if — иначе оператор оказался бы внутри
     ветви соседнего условия. */
  const tests = cases.map((branch) => {
    if (branch === null || typeof branch !== "object" || branch.pattern === undefined) {
      throw flangError("FLANG_PARSE", "случай разбора должен содержать «pattern» и «body»", node.span)
    }
    return patternTest(branch.pattern, subject, ctx, out, pad, node.span)
  })

  let opened = false
  let closed = false
  for (const [index, branch] of cases.entries()) {
    const test = tests[index]
    if (test === null) {
      /* Образец, совпадающий всегда: `else` честнее, чем `if (true)`, а первый
         такой образец не нуждается и в `else`. */
      if (opened) {
        out.push(`${pad}} else {`)
        emitBranch(branch, subject, ctx, out, `${pad}  `, target)
        out.push(`${pad}}`)
      } else {
        emitBranch(branch, subject, ctx, out, pad, target)
      }
      closed = true
      break
    }
    out.push(opened ? `${pad}} else if (${test}) {` : `${pad}if (${test}) {`)
    opened = true
    emitBranch(branch, subject, ctx, out, `${pad}  `, target)
  }
  if (closed) return
  if (opened) {
    /* Ветка «ни один образец не подошёл» обязана быть: без неё переменная
       результата осталась бы не присвоенной ни по одному пути, и javac отверг
       бы её чтение. Здесь она не заглушка, а поведение интерпретатора. */
    out.push(
      `${pad}} else {`,
      `${pad}  throw Flang.matchFail(ctx, ${subject});`,
      `${pad}}`,
    )
  } else if (target === null) {
    out.push(`${pad}throw Flang.matchFail(ctx, ${subject});`)
  } else {
    /* Разбор без единого случая не совпадает никогда, но в позиции значения
       напечатать здесь `throw` нельзя: следующий оператор стал бы недостижимым,
       а это ошибка компиляции Java, а не предупреждение. Поэтому отказ едет
       через метод, чей тип возврата — Value: для javac оператор завершается
       нормально, а во время выполнения он бросает ровно ту же диагностику. */
    out.push(`${pad}${target} = Flang.noMatch(ctx, ${subject});`)
  }
}

function emitBranch(branch, subject, ctx, out, pad, target) {
  const undo = bindPattern(branch.pattern, subject, ctx, out, pad)
  if (target === null) emitTail(branch.body, ctx, out, pad)
  else assignInto(branch.body, ctx, out, pad, target)
  for (const step of undo) ctx.unbind(step.name, step.previous)
}

/** Проверка дискриминанта; `null` — образец совпадает всегда. */
function patternTest(pattern, subject, ctx, out, pad, span) {
  switch (pattern.kind) {
    /* Цепочка — список либо строка: `пусто` и `голова и хвост` разбирают обе.
       Различать их здесь нечем — у печати нет типов, — да и незачем: проверка
       вида стоит одну ветку. */
    case "empty":
      return `Value.chainEmpty(${subject})`
    case "cons":
      return `Value.chainCons(${subject})`
    case "variant":
      return `Value.variantIs(${subject}, ${javastring(pattern.name)})`
    case "literal": {
      const literal = emitLiteral(pattern.value, ctx, out, pad)
      return `Value.equal(${subject}, ${literal})`
    }
    case "any":
      return null
    default:
      throw flangError("FLANG_PARSE", `неизвестный вид образца «${pattern.kind}»`, span)
  }
}

function bindPattern(pattern, subject, ctx, out, pad) {
  const undo = []
  const bind = (name, code, comment) => {
    const ident = ctx.fresh(name)
    if (comment !== null) out.push(`${pad}// ${comment}`)
    out.push(`${pad}Value ${ident} = ${code};`)
    undo.push({ name, ident, previous: ctx.bind(name, ident) })
  }
  switch (pattern.kind) {
    case "cons":
      if (pattern.head !== undefined && pattern.head !== null) {
        bind(pattern.head, `Value.chainHead(${subject})`, `голова «${pattern.head}»`)
      }
      if (pattern.tail !== undefined && pattern.tail !== null) {
        /* Хвост копирует, как и в JS: массив нельзя разделить с суффиксом без
           копирования. Наблюдаемое значение то же, а «хвост» интерпретатора
           копирует ровно так же, поэтому и сложность обхода у двух движков
           одна. У строки голова — одна кодовая точка, хвост — остаток. */
        bind(pattern.tail, `Value.chainTail(${subject})`, `хвост «${pattern.tail}»`)
      }
      return undo
    case "variant": {
      const declared = pattern.bind ?? {}
      const entries = Array.isArray(declared)
        ? declared.map((field) => [field, field])
        : Object.entries(declared)
      for (const [field, name] of entries) {
        /* Отсутствующее поле варианта — ошибка прямо при сопоставлении, а не
           «случай не подошёл»: так же ведёт себя matchPattern интерпретатора. */
        bind(name, `Flang.variantField(ctx, ${subject}, ${javastring(field)})`, `поле «${field}»`)
      }
      return undo
    }
    case "any":
      if (typeof pattern.bind === "string") bind(pattern.bind, subject, null)
      return undo
    default:
      return undo
  }
}

/* ── свёртка, отобразить, отфильтровать ── */

function emitFold(node, ctx, out, pad) {
  requireName(node.acc, "fold", "acc", node.span)
  requireName(node.item, "fold", "item", node.span)
  /* Порядок как в интерпретаторе: сперва коллекция и проверка «это список»,
     только потом начальное значение. Коллекция материализуется безусловно, а не
     через emitOrdered, как в бэкенде Python: у неё тип Value[], а не Value, и
     общий механизм переноса влево, который умеет только Value, испортил бы
     объявление временного. Лишнее временное здесь ничего не стоит — оно всё
     равно нужно циклу. */
  const list = materialize(
    `Flang.requireList(ctx, ${emitValue(node.over, ctx, out, pad)}, "свёртка")`,
    ctx, out, pad, "Value[]",
  )
  const init = emitValue(node.init, ctx, out, pad)
  const accIdent = ctx.fresh(node.acc)
  out.push(`${pad}// «${node.acc}»`, `${pad}Value ${accIdent} = ${init};`)
  const itemIdent = ctx.fresh(node.item)
  out.push(`${pad}for (Value ${itemIdent} : ${list}) {`)

  const undoAcc = ctx.bind(node.acc, accIdent)
  const undoItem = ctx.bind(node.item, itemIdent)
  assignInto(node.body, ctx, out, `${pad}  `, accIdent)
  ctx.unbind(node.item, undoItem)
  ctx.unbind(node.acc, undoAcc)
  out.push(`${pad}}`)
  return accIdent
}

function emitLoop(node, ctx, out, pad) {
  requireName(node.item, node.kind, "item", node.span)
  const label = node.kind === "map" ? "отобразить" : "отфильтровать"
  const over = emitValue(node.over, ctx, out, pad)
  const list = materialize(
    `Flang.requireList(ctx, ${over}, ${javastring(label)})`, ctx, out, pad, "Value[]",
  )
  const items = ctx.temp()
  const itemIdent = ctx.fresh(node.item)
  out.push(
    `${pad}java.util.ArrayList<Value> ${items} = new java.util.ArrayList<>(${list}.length);`,
    `${pad}for (Value ${itemIdent} : ${list}) {`,
  )
  const inner = `${pad}  `

  const undo = ctx.bind(node.item, itemIdent)
  if (node.kind === "map") {
    const value = emitValue(node.body, ctx, out, inner)
    out.push(`${inner}${items}.add(${value});`)
  } else {
    /* Тело фильтра — предикат: для отброшенных элементов ничего больше не
       вычисляется. */
    const flag = emitValue(node.body, ctx, out, inner)
    out.push(
      `${inner}if (Flang.keep(ctx, ${flag})) {`,
      `${inner}  ${items}.add(${itemIdent});`,
      `${inner}}`,
    )
  }
  ctx.unbind(node.item, undo)
  out.push(`${pad}}`)
  return `Value.list(${items}.toArray(new Value[0]))`
}

/* ── вызов по имени ── */

function renderDispatch(shared) {
  const lines = [
    ...javadoc([
      "Вызов функции по её исходному имени flang.",
      "",
      "Нужен прогонщику и всякому, кто связывает программу с внешним миром",
      "динамически (скрипт, тест, служба). Коды и тексты — те же, что у",
      "интерпретатора: «не найдена функция …» и «функция … принимает N аргум.».",
      "",
      "@param ctx контекст вычисления (newContext)",
      "@param name исходное имя функции flang",
      "@param args аргументы по порядку объявления",
      "@return значение функции",
    ], "  "),
    "  public static Value call(Ctx ctx, String name, Value[] args) {",
  ]
  for (const fn of shared.prepared.functions.values()) {
    const arity = fn.params.length
    const pass = Array.from({ length: arity }, (_, index) => `args[${index}]`)
    lines.push(
      `    if (name.equals(${javastring(fn.name)})) {`,
      `      if (args.length != ${arity}) {`,
      "        throw Flang.fail(",
      "            FlangError.CODE_TYPE,",
      /* Склейка, а не форматирование: имя модели вправе содержать что угодно, и
         подстановка этого бы не пережила. */
      `            ${javastring(`функция «${fn.name}» принимает ${arity} аргум., получено `)}`,
      "                + args.length);",
      "      }",
      `      return ${shared.functionIdents.get(fn.name)}(${["ctx", ...pass].join(", ")});`,
      "    }",
    )
  }
  lines.push(
    '    throw Flang.fail(FlangError.CODE_UNKNOWN_NAME, "не найдена функция «" + name + "»");',
    "  }",
  )
  return lines.join("\n")
}

/* ── проверки, повторяющие интерпретатор ── */

function requireExpr(expr) {
  if (expr === undefined || expr === null || typeof expr !== "object" || Array.isArray(expr)) {
    throw flangError("FLANG_PARSE", `ожидалось выражение, получено ${JSON.stringify(expr) ?? "undefined"}`)
  }
  return expr
}

function requireName(name, kind, field, span) {
  if (typeof name !== "string" || name.length === 0) {
    throw flangError("FLANG_PARSE", `узел «${kind}» требует непустое имя в поле «${field}»`, span)
  }
}

function resolveCall(node, ctx) {
  const callee = ctx.shared.prepared.functions.get(node.name)
  if (!callee) throw flangError("FLANG_UNKNOWN_NAME", `не найдена функция «${node.name}»`, node.span)
  const args = node.args ?? []
  if (!Array.isArray(args)) {
    throw flangError("FLANG_PARSE", "аргументы выражения должны быть списком", node.span)
  }
  if (args.length !== callee.params.length) {
    throw flangError(
      "FLANG_TYPE",
      `функция «${callee.name}» принимает ${callee.params.length} аргум., передано ${args.length}`,
      node.span,
    )
  }
  return callee
}

function checkVariantName(node, ctx) {
  if (ctx.shared.prepared.variants.size === 0) return
  if (!ctx.shared.prepared.variants.has(node.variant)) {
    throw flangError("FLANG_UNKNOWN_NAME", `неизвестный вариант «${node.variant}»`, node.span)
  }
}

function checkRecordType(node, ctx) {
  if (ctx.shared.prepared.records.size === 0 || node.type === undefined) return
  if (!ctx.shared.prepared.records.has(node.type)) {
    throw flangError("FLANG_UNKNOWN_NAME", `неизвестная запись «${node.type}»`, node.span)
  }
}

function plural(count, one, few, many) {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

function expectArity(name, got, span) {
  const count = BUILTIN_ARITY.get(name)
  if (count === undefined || got === count) return
  const word = plural(count, "аргумент", "аргумента", "аргументов")
  throw flangError("FLANG_BUILTIN_ARGS", `«${name}» ожидает ${count} ${word}, получено ${got}`, span)
}
