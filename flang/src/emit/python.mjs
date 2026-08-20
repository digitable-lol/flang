/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
// emit/python.mjs — печать программы flang в Python.
//
// ── Зачем ──────────────────────────────────────────────────────────────────
// Печать в JS (emit/js.mjs) даёт модуль для Node и браузера, печать в C
// (emit/c.mjs) — переносимость до NetBSD и RISC-V, печать в Go (emit/go.mjs) —
// один статически слинкованный файл. Python закрывает нишу, которой не
// закрывает ни один из трёх: язык, который уже стоит на машине аналитика,
// научного работника и администратора, и в который программу flang нужно не
// «встроить», а просто импортировать — вместе с pandas, Jupyter и всем
// остальным, что там уже есть.
//
// ── Что здесь принципиально иначе, чем в бэкендах C, Go и JS ────────────────
// Общее с Go сохранено намеренно, чтобы бэкенды читались как одна система: тот
// же обход AST, то же решение арности при печати, тот же протокол прогонщика,
// та же транслитерация имён через flang/src/naming.mjs, и коллизия после
// транслитерации — ошибка печати, а не тихое переименование.
//
// Расходится же Python с Go там, где расходятся сами языки.
//
// 1. ОШИБКИ — ИСКЛЮЧЕНИЯ. В Go диагностика едет вторым возвращаемым значением,
//    и половина тела каждой напечатанной функции — это `if err != nil`. В
//    Python ошибка возбуждается, поэтому выражение flang печатается выражением
//    Python: `rt.add(ctx, rt.b_head(ctx, а), rt.b_tail(ctx, б))` вместо семи
//    операторов. Порядок вычисления при этом обязан остаться строго слева
//    направо — Python его гарантирует для аргументов вызова, а там, где
//    правый операнд требует собственных операторов (условие, разбор, цикл),
//    левый принудительно материализуется во временное ДО них (см. emitOrdered).
//
// 2. ЧИСЛА. В Python есть int неограниченной точности, и он заразен: `len(x)`
//    даёт int, `2 ** 70` — точное целое, которого в IEEE-754 нет. Поэтому
//    число flang — всегда float, а печать числа идёт через rt.number_text
//    (правила ECMAScript Number::toString дословно): repr(1.0) это «1.0», а
//    Number::toString(1) — «1», и это видно пользователю через «к строке».
//
// 3. ДЕЛЕНИЕ НА НОЛЬ. Единственное место, где Python расходится с flang не
//    представлением, а поведением: `1.0 / 0.0` возбуждает ZeroDivisionError, а
//    SPEC (раздел 5) требует Infinity. Ловится в рантайме (rt.divide_raw), и
//    ровно поэтому арифметика не печатается операторами на месте.
//
// 4. РАВЕНСТВО. `Object.is` и `==` в Python расходятся в обе стороны сразу:
//    `nan == nan` ложно, `0.0 == -0.0` истинно, а `True == 1` истинно, потому
//    что bool — подтип int. Отсюда размеченное значение и своё равенство
//    (rt.equal), а не родное.
//
// 5. РЕКУРСИЯ. У Python свой предел (sys.setrecursionlimit) и свой стек. Он не
//    имеет права подменять собой FLANG_RECURSION_LIMIT, поэтому рантайм
//    поднимает предел Python под max_depth программы, а прогонщик считает в
//    потоке с большим стеком.
//
// 6. НЕИСПОЛЬЗОВАННОЕ ИМЯ. В Go это ошибка компиляции, и Go-бэкенд гасит такие
//    имена через `_ = имя`. В Python неиспользованная локальная переменная —
//    не ошибка и даже не предупреждение, поэтому гасить нечего: привязка
//    печатается всегда (она обязана вычислиться — у варианта она может дать
//    FLANG_UNKNOWN_NAME), и на этом всё.
//
// ── Роль входит в имя, и это не украшение ──────────────────────────────────
// Модуль Python — одно пространство имён на все объявления верхнего уровня, и
// повторное `def` не ошибка, а молчаливое затирание. В ядре FTS есть «Значение
// операнда» — и вариант суммы типов, и функция; назови мы конструктор варианта
// по имени варианта, а функцию по имени функции, второе `def` съело бы первое,
// и программа вызывала бы не то, что написано. Поэтому идентификатор всегда
// несёт роль: fn_… у функции, v_… у конструктора варианта, rec_… у фабрики
// записи, step_… у шага батута. Столкнуться после этого могут только два имени
// одной роли — и это ошибка печати, а не переименование (createNamer).
//
// ── Три файла, а не один ───────────────────────────────────────────────────
// Рантайм печатается отдельным модулем flang_runtime.py, программа — модулем по
// имени модуля flang, прогонщик — flang_cli.py. Рантайм и прогонщик печатаются
// байт в байт из flang/src/emit/python/: так их проверяет сам Python и линтер
// прямо в репозитории, а не только через тест печати.
//
// ── Главное требование: совпадение с interpret.mjs ─────────────────────────
// Сгенерированный код обязан давать то же значение и ту же ошибку (код И
// текст). Отсюда:
//
//   • строгий порядок вычисления слева направо;
//   • проценты печатаются как `(процент / 100) * значение`;
//   • равенство скаляров — Object.is (NaN равен NaN, 0 не равен −0).
//
// ── Хвостовая рекурсия: те же три случая, что в emit/js.mjs, c.mjs и go.mjs ─
//   • хвостовой самовызов → `while True:` с переприсваиванием параметров;
//   • взаимная хвостовая рекурсия (компонента сильной связности из двух и
//     более функций) → батут через значения функций;
//   • функция с постусловиями хвостовых вызовов не получает — интерпретатор
//     тоже не переиспользует кадр, которому есть что проверить после возврата.
//
// ── Пределы: и глубина, и шаги ─────────────────────────────────────────────
// Воспроизведены оба, как в бэкенде Go. Шаг здесь — вход в функцию, виток цикла
// хвостового самовызова и отскок батута; шаг интерпретатора — итерация его
// машины, а их на одно применение функции приходится много. Значит счётчик
// здесь всегда МЕНЬШЕ, и при одинаковом пределе интерпретатор упирается в лимит
// первым. Расхождение одностороннее и безопасное: напечатанный код не объявит
// исчерпанным то, что интерпретатор досчитал до конца.

import { readFileSync } from "node:fs"

import { canonicalBuiltinName, flangError, hasBuiltin, помощникФормы } from "../builtins.mjs"
import { требуетИсполнителяПлана, требуетПланировщика } from "../conc.mjs"
import { defunctionalize } from "../defunc.mjs"
import { таблицаВхода } from "../types.mjs"
import { BIDI_CONTROLS, escapeBidiInFiles, escapeBidiUnicode4 } from "../bidi.mjs"
import { snake } from "../naming.mjs"
import { обойтиЗанятоеЦелью } from "../target-occupied.mjs"

/* ═══════════════════════════════════════════════════════════════════════════
   Рантайм и прогонщик.

   Лежат рядом настоящими .py, а не строками в этом файле: так их проверяет сам
   Python (и ruff, если он есть) прямо в репозитории, а правка рантайма не
   превращается в правку экранирования внутри шаблона. Печатаются байт в байт —
   только с шапкой «сгенерировано» перед первой строкой.
   ═══════════════════════════════════════════════════════════════════════════ */

const RUNTIME_DIRECTORY = new URL("./python/", import.meta.url)
const RUNTIME_SOURCE = readFileSync(new URL("flang_runtime.py", RUNTIME_DIRECTORY), "utf8")
const CLI_SOURCE = readFileSync(new URL("flang_cli.py", RUNTIME_DIRECTORY), "utf8")

const RUNTIME_MODULE = "flang_runtime"
const CLI_MODULE = "flang_cli"

/** Канонические имена встроенных форм → функции рантайма. */
const BUILTIN_HELPERS = new Map([
  ["длина", "b_length"],
  ["символ", "b_char"],
  ["подстрока", "b_substring"],
  ["соединить", "b_join"],
  ["разделить", "b_split"],
  ["символы", "b_characters"],
  ["код символа", "b_char_code"],
  ["содержит", "b_contains"],
  ["начинается с", "b_starts_with"],
  ["к числу", "b_to_number"],
  ["к числу или беда", "b_to_number_or_failure"],
  ["к строке", "b_to_string"],
  ["пусто", "b_empty"],
  ["голова", "b_head"],
  ["хвост", "b_tail"],
  ["элемент", "b_element"],
  ["добавить", "b_append"],
  ["приписать", "b_prepend"],
  ["остаток от", "b_remainder"],
  ["процентов от", "b_percent_of"],
])

/**
 * Суффикс имени помощника БЕЗ сторожа частичности (`помощникФормы`).
 *
 * Печать здесь ничего не доказывает: отметку `доказана` кладёт передний край
 * (`bin/flang.mjs`, `markProven`) по выводу проверки типов, а копия печати на
 * самом языке анализа не видит вовсе — круг импортов. Обе стороны читают одну
 * отметку и потому печатают одно и то же.
 */
const СУФФИКС_ДОКАЗАННОГО = "_proven"

/** Арность встроенных форм — проверяется при печати, а не в рантайме. */
const BUILTIN_ARITY = new Map([
  ["длина", 1], ["символ", 2], ["подстрока", 3], ["соединить", 2], ["разделить", 2],
  ["символы", 1],
  ["код символа", 1],
  ["содержит", 2], ["начинается с", 2], ["к числу", 1], ["к числу или беда", 1], ["к строке", 1], ["пусто", 1],
  ["голова", 1], ["хвост", 1], ["элемент", 2], ["добавить", 2], ["остаток от", 2], ["процентов от", 2],
  ["приписать", 2],
])

const BINARY_HELPERS = new Map([
  ["add", "add"], ["sub", "sub"], ["mul", "mul"], ["div", "div"], ["mod", "mod"],
  ["percent", "percent"], ["gt", "gt"], ["lt", "lt"], ["gte", "gte"], ["lte", "lte"],
  ["concat", "concat"],
])

/* Ключевые слова Python 3.12, мягкие ключевые слова и те встроенные имена,
   затенение которых сделало бы напечатанный код неверным или нечитаемым.
   Модельное имя, которое после транслитерации попадает сюда, обязано считаться
   коллизией, а не молча получить суффикс. */
const PY_RESERVED = [
  "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class",
  "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
  "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
  "try", "while", "with", "yield",
  "match", "case", "type", "self",
  "abs", "all", "any", "bool", "dict", "dir", "enumerate", "filter", "float", "format",
  "id", "input", "int", "len", "list", "map", "max", "min", "next", "object", "open",
  "print", "range", "repr", "reversed", "round", "set", "slice", "sorted", "str", "sum",
  "tuple", "type", "vars", "zip",
  "rt", "ctx", "args", "bounce",
]

/* Имена, которые печатает сам бэкенд на верхнем уровне модуля программы. */
const DECLARED_BY_BACKEND = ["call", "new_context"]

/* Приставки ролей. Роль обязана входить в идентификатор: модуль Python — одно
   пространство имён, и вариант «Значение операнда» с функцией «Значение
   операнда» (в ядре FTS есть и то, и другое) иначе дали бы один `def`, из
   которых уцелел бы последний. */
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
// вычислении (ровно как в emit/js.mjs, emit/c.mjs и emit/go.mjs).
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
      /* Предусловия здесь ТОЛЬКО ради ДВЕРИ напечатанной программы — вызова по
         имени (`renderDispatch`). В тело функции они не печатаются ни одной
         строкой: внутри программы предусловие снял вызывающий на проверке
         (иначе FLANG_PRECONDITION_CALL), и проверять его во время работы значило
         бы платить временем каждого вызова за доказанное статически. */
      preconditions: normalizePreconditions(fn),
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

/**
 * Предусловия функции — тем же разбором, что у интерпретатора
 * (`normalizePreconditions` в src/interpret.mjs), и с теми же умолчаниями: код
 * FLANG_PRECONDITION, текст «не выполнено требование …». `bind` у предусловия
 * нет и быть не может: оно говорит о том, что было ДО вызова, а результата до
 * вызова не существует.
 */
function normalizePreconditions(fn) {
  const list = fn.preconditions ?? []
  if (!Array.isArray(list)) {
    throw flangError("FLANG_PARSE", `поле «preconditions» функции «${fn.name}» должно быть списком`, fn.span)
  }
  return list.map((item) => {
    if (item === null || typeof item !== "object" || item.expr === undefined) {
      throw flangError("FLANG_PARSE", `предусловие функции «${fn.name}» должно содержать «expr»`, fn.span)
    }
    return {
      name: item.name ?? "",
      expr: item.expr,
      code: typeof item.code === "string" ? item.code : "FLANG_PRECONDITION",
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

/* ═══════════════════════════ литералы Python ═══════════════════════════ */

/**
 * Строковый литерал Python. Кириллица печатается как есть (исходник в UTF-8 —
 * ровно то, ради чего этот язык затевался: имена в коде обязаны читаться), а
 * экранируются кавычка, обратный слэш и управляющие символы.
 *
 * По символам, а не по байтам: файл записывается в UTF-8, и «Длина»,
 * разобранная на байты и собранная обратно как символы, превратилась бы в
 * двойную кодировку — имя перестало бы совпадать с именем в интерпретаторе.
 *
 * Двунаправленные управляющие (набор — bidi.mjs, общий на все бэкенды обоих
 * компиляторов) уезжают в `\uXXXX`: CPython такой файл выполнит и сырым, но
 * набор общий с C, Rust и Elixir, где это прямая ошибка сборки. `\x` здесь не
 * годится — в Python он берёт ровно две цифры и кодовую точку U+202E не
 * выражает; `\uXXXX` даёт ту же точку и ту же длину строки, что сырой символ.
 */
function pystring(value) {
  let result = '"'
  for (const character of String(value)) {
    const code = character.codePointAt(0)
    if (character === '"') result += '\\"'
    else if (character === "\\") result += "\\\\"
    else if (character === "\n") result += "\\n"
    else if (character === "\r") result += "\\r"
    else if (character === "\t") result += "\\t"
    else if (code < 0x20 || code === 0x7f) result += `\\x${code.toString(16).padStart(2, "0")}`
    else if (BIDI_CONTROLS.has(code)) result += `\\u${code.toString(16).padStart(4, "0")}`
    else result += character
  }
  return `${result}"`
}

/**
 * Число как литерал Python.
 *
 * Обязательно float: `1` в Python — это int неограниченной точности, и
 * арифметика с ним даёт не то, что даёт IEEE-754 double («2 ** 70» точно, а
 * должно быть округлено). Поэтому там, где в записи нет ни точки, ни
 * экспоненты, дописывается «.0».
 *
 * `String(value)` — кратчайшая запись, читающаяся обратно тем же double, и
 * любая такая запись является допустимым литералом Python. NaN и бесконечности
 * литералом записать нельзя вовсе — только через float("nan") и float("inf").
 */
function pynumber(value) {
  if (Number.isNaN(value)) return 'float("nan")'
  if (value === Infinity) return 'float("inf")'
  if (value === -Infinity) return 'float("-inf")'
  /* −0.0 в Python — настоящий отрицательный ноль (math.copysign его различает),
     поэтому особого приёма, как в Go, не нужно: нужна только точка. */
  if (Object.is(value, -0)) return "-0.0"
  const text = String(value)
  return /[.e]/u.test(text) ? text : `${text}.0`
}

/**
 * Идентификатор Python не может начинаться с цифры и не может быть пустым.
 *
 * Отдельно разведены `l`, `I` и `O`: в большинстве шрифтов они неотличимы от
 * единицы и нуля, и это не придирка линтера, а честное предупреждение — имя
 * «л» из модели даёт ровно `l`, а «л = 1» рядом с «1 = 1» читать невозможно.
 */
function safeIdent(identifier) {
  if (identifier.length === 0) return "value"
  if (identifier === "l" || identifier === "I" || identifier === "O") return `${identifier}_`
  return /^[0-9]/u.test(identifier) ? `v${identifier}` : identifier
}

/* ═══════════════════════════ имена ═══════════════════════════ */

/**
 * Именователь верхнего уровня: роль плюс транслитерация имени модели.
 *
 * Роль входит в идентификатор всегда — см. шапку файла. Столкнуться поэтому
 * могут только два имени одной роли («Сумма» и «сумма» дают один `fn_summa`), и
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
          ? `зарезервировано в Python: ${previous.name}`
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
 * Печать программы flang в Python.
 *
 * @param {object} program AST flang (SPEC.md, раздел 5)
 * @param {{ path?: string, indexBase?: 0 | 1, maxDepth?: number, maxSteps?: number, cli?: boolean }} [options]
 * @returns {{ files: Array<{ path: string, content: string }> }}
 */
export function emitPython(program, options = {}) {
  /* Печать в цель без планировщика конкурентности невозможна, и молчать об этом
     нельзя: до этого отказа шесть целей из восьми ТЕРЯЛИ процессы, печатали
     обработчики обычными функциями и кончались кодом 0. Отказ стоит первым — до
     всякой работы, потому что печатать нечего вовсе (см. `conc.mjs`,
     `требуетПланировщика`). */
  требуетПланировщика(program, "python")
  /* План — вход программы ввода-вывода, и потерять его молча было бы тем же,
     чем была молчаливая потеря процессов: модуль собирается, код возврата ноль,
     а работать он не умеет. Отказ живёт в бэкенде, а не в команде, по той же
     причине, что и два его соседа: бэкенды зовут напрямую из Node. */
  требуетИсполнителяПлана(program, "python")
  /* Граница входа читает типы ДО дефункционализации: после неё параметр,
     объявленный функцией, становится суммой тегов, а `checkArguments` на границе
     интерпретатора видит его функцией. Два ответа на один вопрос разошлись бы
     молча. */
  const входные = таблицаВхода(program)
  /* Дефункционализация — ОДИН проход на все восемь целей (src/defunc.mjs), а не
     восемь реализаций: после него в программе нет ни функций-значений, ни
     применения, и печатается она теми же узлами, что и всё остальное. На
     программе без высшего порядка проход тождествен — возвращает ТОТ ЖЕ объект,
     — поэтому напечатанное не меняется ни на байт, и неподвижная точка цела. */
  program = defunctionalize(program)
  const prepared = prepare(program)
  /* База номера едет НА ПРОГРАММЕ, а не в ключах: тем же полем считало
     доказательство границ, и второе число здесь развело бы их молча. */
  const base = (program?.базаНомера ?? options.indexBase) === 0 ? 0 : 1
  const maxDepth = Number.isInteger(options.maxDepth) && options.maxDepth > 0 ? options.maxDepth : 10_000
  const maxSteps = Number.isInteger(options.maxSteps) && options.maxSteps > 0 ? options.maxSteps : 1_000_000
  const moduleName = typeof program.module === "string" && program.module.length > 0 ? program.module : null
  const wanted = options.path ?? (moduleName === null ? "program" : safeIdent(snake(moduleName)))
  /* Имя модуля flang доезжает до цели именем в ЕЁ пространстве имён, а часть
     этого пространства цель занимает сама (`target-occupied.mjs`). Свободное имя
     возвращается как есть — вывод не меняется ни на байт, — занятое обходится
     суффиксом (`flang_` приставкой звать нельзя: так зовут файлы рантайма).
     Отказывать здесь нельзя: имя автор выбрал законно, а набор занятого у цели
     свой и меняется от её версии. */
  const file = обойтиЗанятоеЦелью(wanted, "python")
  if (file === RUNTIME_MODULE || file === CLI_MODULE) {
    throw flangError(
      "FLANG_PARSE",
      `модуль «${moduleName}» даёт файл «${file}.py», занятый рантаймом бэкенда — переименуйте модуль`,
    )
  }

  /* Одно пространство имён на модуль, поэтому один именователь на всё, что
     объявляется на верхнем уровне: функции, фабрики записей, конструкторы
     вариантов, шаги батута. Имена, которые печатает сам бэкенд, заняты
     заранее, как и имя импортированного рантайма. */
  const declarations = createDeclarations([...PY_RESERVED, ...DECLARED_BY_BACKEND])

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
     объявления верхнего уровня: затенённый `fn_…` превратил бы вызов функции в
     вызов значения. */
  const globalNames = new Set(declarations.taken.keys())
  const paramIdents = new Map()
  for (const [name, fn] of prepared.functions) {
    paramIdents.set(name, uniqueIdents(fn.params.map((param) => param.name), globalNames))
  }

  const shared = {
    prepared,
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
  bodies.push(renderEntry(входные))

  const files = [
    {
      path: `${RUNTIME_MODULE}.py`,
      content: `${banner(moduleName, "рантайм: значения, числа, строки, диагностики")}\n${RUNTIME_SOURCE}`,
    },
    { path: `${file}.py`, content: renderSource(moduleName, bodies) },
  ]

  if (options.cli !== false) {
    files.push({
      path: `${CLI_MODULE}.py`,
      content: `${banner(moduleName, "прогонщик: JSON на входе, JSON на выходе")}\n${CLI_SOURCE}`,
    })
  }
  files.push({ path: "Makefile", content: renderMakefile(file, options.cli !== false) })
  /* Последний шаг — снять сырые двунаправленные управляющие со всего вывода
     (bidi.mjs). Литерал их уже экранировал сам, но имя FTS уезжает ещё и в
     комментарии и строки документации — а их читают первым и проверить
     исполнением не могут: CPython такой файл выполнит молча. Docstring —
     обычная строка, и `\uXXXX` в ней даёт ту же кодовую точку, что сырой
     символ: значение документации не меняется, меняется только запись. */
  return { files: escapeBidiInFiles(files, escapeBidiUnicode4) }
}

function banner(moduleName, what) {
  return [
    "# Сгенерировано flang (бэкенд Python, flang/src/emit/python.mjs). Не редактировать руками.",
    moduleName === null ? "# Программа flang без имени модуля." : `# Модуль flang: «${moduleName}».`,
    `# Файл: ${what}.`,
    "# Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.",
  ].join("\n")
}

function renderMakefile(file, cli) {
  return [
    "# Сгенерировано flang (бэкенд Python). Целей ровно столько, сколько нужно:",
    "# напечатанный код обязан импортироваться и запускаться без единой правки.",
    "PYTHON ?= python3",
    `MODULE ?= ${file}`,
    "",
    "all: check",
    "",
    "# Импорт без записи .pyc: кэш байткода — мусор в чужом каталоге.",
    "check:",
    cli
      ? '\t$(PYTHON) -B -c "import $(MODULE), flang_runtime, flang_cli"'
      : '\t$(PYTHON) -B -c "import $(MODULE), flang_runtime"',
    ...(cli ? ["", "run:", "\t$(PYTHON) -B flang_cli.py $(MODULE)"] : []),
    "",
    "# Линтер необязателен: его отсутствие не делает напечатанный код неверным.",
    "lint:",
    "\truff check . || true",
    "",
    "clean:",
    "\trm -rf __pycache__",
    "",
    `.PHONY: all check${cli ? " run" : ""} lint clean`,
    "",
  ].join("\n")
}

/* ── файл программы ── */

function renderSource(moduleName, bodies) {
  const head = [
    banner(moduleName, "реализация: функции, конструкторы значений, вызов по имени"),
    '"""',
    moduleName === null
      ? "Программа flang, напечатанная в Python."
      : `Модуль flang «${moduleName}», напечатанный в Python.`,
    "",
    "Контракт вызова: функция возвращает значение либо возбуждает",
    "flang_runtime.FlangError с кодом и текстом, дословно совпадающими с",
    "интерпретатором flang. Все значения — flang_runtime.Value: числа там всегда",
    "float (целых чисел в flang нет), признак отличается от числа тегом, а не",
    "типом Python, и равенство скаляров — Object.is, а не ==.",
    '"""',
    "",
    `import ${RUNTIME_MODULE} as rt`,
  ].join("\n")
  return `${[head, ...bodies.filter((body) => body.length > 0)].join("\n\n\n")}\n`
}

function renderContext(base, maxDepth, maxSteps) {
  return [
    "def new_context():",
    ...docstring([
      "Контекст вычисления с настройками этой программы.",
      "",
      "Индексация строк, предел глубины вызовов и лимит шагов — это настройки",
      "программы, а не рантайма: печать могла идти с нулевой базой индексации, а",
      "пределы вызывающий вправе поменять прямо в возвращённом контексте.",
    ], "    "),
    "    ctx = rt.new_ctx()",
    `    ctx.index_base = ${base}`,
    `    ctx.max_depth = ${maxDepth}`,
    `    ctx.max_steps = ${maxSteps}`,
    "    return ctx",
  ].join("\n")
}

/**
 * Строка документации Python из готовых строк текста.
 *
 * Экранируется ровно то, что может её закрыть или испортить: тройная кавычка и
 * обратный слэш. Имена модели попадают сюда как есть — ради них всё и
 * затевалось.
 */
function docstring(lines, pad) {
  const safe = lines.map((line) =>
    line.replaceAll("\\", "\\\\").replaceAll('"""', '\\"\\"\\"').replace(/"$/u, '\\"'))
  if (safe.length === 1) return [`${pad}"""${safe[0]}"""`]
  return [`${pad}"""${safe[0]}`, ...safe.slice(1).map((line) => (line === "" ? "" : `${pad}${line}`)), `${pad}"""`]
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
    lines.push(`Параметр ${idents[index]} — «${param.name}»${typeNote(param.type)}.`)
  })
  lines.push(`Результат — значение${typeNote(fn.returns)}.`)
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
 * Идентификаторы Python для набора имён модели: транслитерация плюс развод
 * столкновений. Столкнуться могут и «цена» с «Цена», и поле, чьё имя после
 * транслитерации совпало с ключевым словом Python или с объявлением верхнего
 * уровня (затенённый `fn_…` превратил бы вызов функции в вызов значения).
 */
function uniqueIdents(names, globalNames) {
  const taken = new Set([...PY_RESERVED, ...globalNames])
  return names.map((name) => {
    const wanted = safeIdent(snake(name))
    let candidate = wanted
    let suffix = 1
    while (taken.has(candidate) || /^_t[0-9]+$/u.test(candidate)) {
      suffix += 1
      candidate = `${wanted}${suffix}`
    }
    taken.add(candidate)
    return candidate
  })
}

/* ── фабрики записей и вариантов ── */

function renderFactory(name, type, shared) {
  const fields = Array.isArray(type.fields) ? type.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name), shared.globalNames)
  const lines = [
    `def ${shared.factoryIdents.get(name)}(${idents.join(", ")}):`,
    ...docstring([
      `Запись FTS «${name}»: ${fields.map((field) => `«${field.name}»`).join(", ") || "без полей"}.`,
      "",
      "Запись flang тотальна: пропущенное поле — это «ничто», а не дырка.",
    ], "    "),
  ]
  if (fields.length === 0) {
    lines.push("    return rt.record({})")
  } else {
    lines.push("    return rt.record({")
    fields.forEach((field, index) => {
      lines.push(`        ${pystring(field.name)}: ${idents[index]},`)
    })
    lines.push("    })")
  }
  return lines.join("\n")
}

function renderVariantFactory(sum, item, shared) {
  const fields = Array.isArray(item.fields) ? item.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name), shared.globalNames)
  const lines = [
    `def ${shared.variantIdents.get(item.name)}(${idents.join(", ")}):`,
    ...docstring([
      `Вариант «${item.name}» суммы типов «${sum.name}».`,
      "",
      "Дискриминант — имя варианта; проверяется через rt.variant_is(значение, «Имя»).",
      "Приставка v_ в имени — это роль: у функции flang с тем же именем идентификатор",
      "начинается с fn_, и одно объявление не съедает другое.",
    ], "    "),
  ]
  if (fields.length === 0) {
    lines.push(`    return rt.variant(${pystring(item.name)}, {})`)
  } else {
    lines.push(`    return rt.variant(${pystring(item.name)}, {`)
    fields.forEach((field, index) => {
      lines.push(`        ${pystring(field.name)}: ${idents[index]},`)
    })
    lines.push("    })")
  }
  return lines.join("\n")
}

/* ═══════════════════════════ печать функции ═══════════════════════════ */

function renderFunction(fn, shared) {
  const members = shared.cyclic.get(fn.name) ?? null
  const selfTail = shared.tailEdges.get(fn.name)?.has(fn.name) === true
  const guard = shared.recursive.has(fn.name)

  const ctx = createContext(fn, shared, { selfTail, members })
  const body = []
  /* Тело функции с батутом печатается внутри шага, у остальных — внутри самой
     функции; отступ у обоих один, а вот обёртка вокруг разная. */
  const inner = guard && members === null ? "        " : "    "

  if (fn.postconditions.length > 0) {
    /* Постусловия проверяются после тела: результат уже вычислен, и первое же
       нарушение прерывает вычисление — как в интерпретаторе. */
    const value = emitValue(fn.body, ctx, body, inner)
    const result = ctx.temp()
    body.push(`${inner}${result} = ${value}`)
    for (const property of fn.postconditions) {
      const previous = ctx.bind(property.bind, result)
      const check = emitValue(property.expr, ctx, body, inner)
      ctx.unbind(property.bind, previous)
      const message = property.message ?? `нарушено свойство «${property.name}» функции «${fn.name}»`
      body.push(
        `${inner}# постусловие «${property.name}»`,
        `${inner}if not rt.post(ctx, ${check}, ${pystring(property.name)}, ${pystring(fn.name)}):`,
        `${inner}    raise rt.fail(${pystring(property.code)}, ${pystring(message)})`,
      )
    }
    body.push(`${inner}return ${result}`)
  } else if (selfTail) {
    body.push(`${inner}while True:`)
    emitTail(fn.body, ctx, body, `${inner}    `)
  } else {
    emitTail(fn.body, ctx, body, inner)
  }

  const documentation = docstring(describeFunction(fn, shared), "    ")
  const signature = `def ${shared.functionIdents.get(fn.name)}(${["ctx", ...ctx.params].join(", ")}):`

  if (members !== null) {
    /* Батут: наружу торчит обычная функция, внутри — шаг, возвращающий отскок. */
    const step = shared.stepIdents.get(fn.name)
    const unpack = ctx.params.flatMap((param, index) => [
      `    # «${fn.params[index].name}»`,
      `    ${param} = args[${index}]`,
    ])
    const stepBlock = [
      `def ${step}(ctx, args, bounce):`,
      ...docstring([
        `Шаг батута для «${fn.name}»: значение либо отскок к соседу по рекурсии.`,
      ], "    "),
      ...unpack,
      ...body,
    ].join("\n")

    const outer = [
      signature,
      ...documentation,
      `    ctx.enter(${pystring(fn.name)})`,
      "    try:",
      `        return rt.trampoline(ctx, ${step}, [${ctx.params.join(", ")}], ${pystring(fn.name)})`,
      "    finally:",
      "        ctx.leave()",
    ].join("\n")
    return `${stepBlock}\n\n\n${outer}`
  }

  if (guard) {
    /* Счётчик глубины обязан уменьшаться и на ошибке, иначе первая же пойманная
       ошибка навсегда съела бы предел; ctx.enter вне try намеренно — если он
       сам возбудил FLANG_RECURSION_LIMIT, входа не было, и выхода быть не
       должно. */
    return [
      signature,
      ...documentation,
      `    ctx.enter(${pystring(fn.name)})`,
      "    try:",
      ...body,
      "    finally:",
      "        ctx.leave()",
    ].join("\n")
  }
  return [signature, ...documentation, ...body].join("\n")
}

function createContext(fn, shared, { selfTail, members }) {
  const ctx = {
    shared,
    fn,
    scope: new Map(),
    taken: new Set([...PY_RESERVED, ...shared.globalNames]),
    params: [],
    selfTail,
    members,
    temp() {
      shared.counter += 1
      return `_t${shared.counter}`
    },
    fresh(name) {
      const wanted = safeIdent(snake(name))
      let candidate = wanted
      let suffix = 1
      /* Имя модели вроде «т16» после транслитерации даёт «t16»; временные зовутся
         «_t16», так что столкнуться они не могут, но проверка стоит дёшево. */
      while (ctx.taken.has(candidate) || /^_t[0-9]+$/u.test(candidate)) {
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

/* ── хвостовая позиция: здесь живут `return`, `continue` и отскоки ── */

function emitTail(expr, ctx, out, pad) {
  const node = requireExpr(expr)
  switch (node.kind) {
    case "let": {
      const value = emitValue(node.value, ctx, out, pad)
      requireName(node.name, "let", "name", node.span)
      const ident = ctx.fresh(node.name)
      out.push(`${pad}# пусть «${node.name}»`, `${pad}${ident} = ${value}`)
      const binding = { ident, line: out.length - 1 }
      const at = out.length
      const previous = ctx.bind(node.name, ident)
      emitTail(node.in ?? node.body, ctx, out, pad)
      ctx.unbind(node.name, previous)
      hideUnused(out, at, [binding])
      return
    }
    case "if": {
      const flag = emitValue(node.cond, ctx, out, pad)
      out.push(`${pad}if rt.cond(ctx, ${flag}):`)
      emitTail(node.then, ctx, out, `${pad}    `)
      out.push(`${pad}else:`)
      emitTail(node.else, ctx, out, `${pad}    `)
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
           параметра, обязан сперва лечь во временное. Кортежное присваивание
           Python сделало бы это само, но по одному оператору на параметр
           читается лучше и не зависит от длины строки. */
        const temps = args.map((argument) => {
          if (isAtom(argument) && !ctx.params.includes(argument)) return argument
          const temp = ctx.temp()
          out.push(`${pad}${temp} = ${argument}`)
          return temp
        })
        ctx.params.forEach((param, index) => {
          out.push(`${pad}${param} = ${temps[index]}`)
        })
        out.push(
          `${pad}# виток цикла — тоже шаг вычисления: незавершающийся хвостовой`,
          `${pad}# самовызов обязан упереться в лимит, а не крутиться вечно`,
          `${pad}ctx.step(${pystring(ctx.fn.name)})`,
          `${pad}continue`,
        )
        return
      }
      if (ctx.members !== null && ctx.members.has(node.name)) {
        out.push(
          `${pad}# хвостовой вызов «${node.name}» — отскок, а не кадр стека`,
          `${pad}bounce.args = [${args.join(", ")}]`,
          `${pad}bounce.next = ${ctx.shared.stepIdents.get(node.name)}`,
          `${pad}return None`,
        )
        return
      }
      out.push(`${pad}return ${ctx.shared.functionIdents.get(callee.name)}(${["ctx", ...args].join(", ")})`)
      return
    }
    default: {
      const value = emitValue(node, ctx, out, pad)
      out.push(`${pad}return ${value}`)
    }
  }
}

/* ── значение: возвращает выражение Python, попутно печатая нужные операторы ── */

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
      return `rt.field_get(ctx, ${target}, ${pystring(node.field)})`
    }
    case "let": {
      const value = emitValue(node.value, ctx, out, pad)
      requireName(node.name, "let", "name", node.span)
      const ident = ctx.fresh(node.name)
      out.push(`${pad}# пусть «${node.name}»`, `${pad}${ident} = ${value}`)
      const binding = { ident, line: out.length - 1 }
      const at = out.length
      const previous = ctx.bind(node.name, ident)
      const body = emitValue(node.in ?? node.body, ctx, out, pad)
      ctx.unbind(node.name, previous)
      hideUnused(out, at, [binding], body)
      /* Тело могло вернуть выражение, ещё не вычисленное: если дальше кто-то
         напечатает операторы, порядок сохранит emitOrdered — оно уже связано с
         именем ident, которое никто не переприсваивает. */
      return body
    }
    case "if": {
      const flag = emitValue(node.cond, ctx, out, pad)
      const temp = ctx.temp()
      out.push(`${pad}if rt.cond(ctx, ${flag}):`)
      assignInto(node.then, ctx, out, `${pad}    `, temp)
      out.push(`${pad}else:`)
      assignInto(node.else, ctx, out, `${pad}    `, temp)
      return temp
    }
    case "match": {
      const temp = ctx.temp()
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
      return `rt.${помощникФормы(canonical, node, BUILTIN_HELPERS, СУФФИКС_ДОКАЗАННОГО)}(${["ctx", ...rendered].join(", ")})`
    }
    case "binary": {
      const [left, right] = emitOrdered([
        (out2, pad2) => emitValue(node.left, ctx, out2, pad2),
        (out2, pad2) => emitValue(node.right, ctx, out2, pad2),
      ], ctx, out, pad)
      if (node.op === "eq" || node.op === "neq") {
        /* Равенство ошибок не даёт: сравнимо всё со всем (SPEC, раздел 5). */
        return node.op === "eq"
          ? `rt.flag(rt.equal(${left}, ${right}))`
          : `rt.flag(not rt.equal(${left}, ${right}))`
      }
      const helper = BINARY_HELPERS.get(node.op)
      if (helper === undefined) {
        throw flangError("FLANG_TYPE", `неизвестная операция «${node.op}»`, node.span)
      }
      return `rt.${helper}(ctx, ${left}, ${right})`
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
      return `rt.list_of([${rendered.join(", ")}])`
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
 * Пока соседи тоже выражения, порядок обеспечивает сам Python (аргументы вызова
 * и элементы литерала вычисляются слева направо). Но узел, которому нужны
 * собственные операторы (условие, разбор, свёртка), печатает их ПЕРЕД
 * выражением — и тогда всё, что стоит левее, обязано вычислиться до них, иначе
 * первая ошибка окажется не той. Поэтому левые соседи материализуются во
 * временные ровно в тот момент, когда справа появился первый оператор.
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
        hoisted.push(`${pad}${temp} = ${part.value}`)
        part.value = temp
      }
      if (hoisted.length > 0) out.splice(at, 0, ...hoisted)
    }
    parts.push({ value })
  }
  return parts.map((part) => part.value)
}

/**
 * Связанное, но не использованное имя — обычное дело в языке с образцами
 * («случай голова и хвост», а голова телу не нужна). В Python это не ошибка, как
 * в Go, но и не пустяк: линтер справедливо считает такую переменную мусором, а
 * читатель — забытым кодом. Убрать связывание нельзя: оно обязано вычислиться
 * (у варианта отсутствующее поле даёт FLANG_UNKNOWN_NAME прямо здесь). Поэтому
 * результат уходит в `_` — общепринятое имя для «вычислено и выброшено».
 *
 * `extra` — текст, который тоже считается использованием: значение узла может
 * быть выражением, ещё не попавшим в напечатанные строки.
 */
function hideUnused(out, from, bindings, extra = "") {
  const text = `${out.slice(from).join("\n")}\n${extra}`
  for (const binding of bindings) {
    if (new RegExp(`\\b${binding.ident}\\b`, "u").test(text)) continue
    out[binding.line] = out[binding.line].replace(`${binding.ident} = `, "_ = ")
  }
}

/** Вычислить выражение и положить результат в переменную. */
function assignInto(expr, ctx, out, pad, target) {
  const value = emitValue(expr, ctx, out, pad)
  out.push(`${pad}${target} = ${value}`)
}

/** Значение, которое читается больше одного раза, обязано лечь во временное. */
function materialize(value, ctx, out, pad) {
  if (isAtom(value)) return value
  const temp = ctx.temp()
  out.push(`${pad}${temp} = ${value}`)
  return temp
}

/* ── литералы ── */

function emitLiteral(value, ctx, out, pad) {
  if (value === undefined || value === null) return "rt.nothing()"
  if (typeof value === "boolean") return `rt.flag(${value ? "True" : "False"})`
  if (typeof value === "number") return `rt.number(${pynumber(value)})`
  if (typeof value === "string") return `rt.text(${pystring(value)})`
  if (Array.isArray(value)) {
    const items = emitOrdered(
      value.map((item) => (out2, pad2) => emitLiteral(item, ctx, out2, pad2)),
      ctx, out, pad,
    )
    return `rt.list_of([${items.join(", ")}])`
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
    return renderFields(keys, values, encoded === null ? null : encoded.variant)
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
  return renderFields(keys, values, variantName)
}

function renderFields(keys, values, variantName) {
  const body = keys.map((key, index) => `${pystring(key)}: ${values[index]}`).join(", ")
  return variantName === null
    ? `rt.record({${body}})`
    : `rt.variant(${pystring(variantName)}, {${body}})`
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
     проверки готовятся до цепочки `if` — иначе оператор оказался бы внутри
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
      /* Образец, совпадающий всегда: `else` честнее, чем `if True`, а первый
         такой образец не нуждается и в `else`. */
      if (opened) {
        out.push(`${pad}else:`)
        emitBranch(branch, subject, ctx, out, `${pad}    `, target)
      } else {
        emitBranch(branch, subject, ctx, out, pad, target)
      }
      closed = true
      break
    }
    out.push(opened ? `${pad}elif ${test}:` : `${pad}if ${test}:`)
    opened = true
    emitBranch(branch, subject, ctx, out, `${pad}    `, target)
  }
  if (closed) return
  if (opened) {
    out.push(`${pad}else:`, `${pad}    raise rt.match_fail(ctx, ${subject})`)
  } else {
    out.push(`${pad}raise rt.match_fail(ctx, ${subject})`)
  }
}

function emitBranch(branch, subject, ctx, out, pad, target) {
  const undo = bindPattern(branch.pattern, subject, ctx, out, pad)
  const at = out.length
  if (target === null) emitTail(branch.body, ctx, out, pad)
  else assignInto(branch.body, ctx, out, pad, target)
  for (const step of undo) ctx.unbind(step.name, step.previous)
  hideUnused(out, at, undo)
}

/** Проверка дискриминанта; `null` — образец совпадает всегда. */
function patternTest(pattern, subject, ctx, out, pad, span) {
  switch (pattern.kind) {
    /* Цепочка — список либо строка: `пусто` и `голова и хвост` разбирают обе.
       Различать их здесь нечем — у печати нет типов, — да и незачем: проверка
       вида стоит одну ветку. */
    case "empty":
      return `rt.chain_empty(${subject})`
    case "cons":
      return `rt.chain_cons(${subject})`
    case "variant":
      return `rt.variant_is(${subject}, ${pystring(pattern.name)})`
    case "literal": {
      const literal = emitLiteral(pattern.value, ctx, out, pad)
      return `rt.equal(${subject}, ${literal})`
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
    if (comment !== null) out.push(`${pad}# ${comment}`)
    out.push(`${pad}${ident} = ${code}`)
    undo.push({ name, ident, line: out.length - 1, previous: ctx.bind(name, ident) })
  }
  switch (pattern.kind) {
    case "cons":
      if (pattern.head !== undefined && pattern.head !== null) {
        bind(pattern.head, `rt.chain_head(${subject})`, `голова «${pattern.head}»`)
      }
      if (pattern.tail !== undefined && pattern.tail !== null) {
        /* Хвост копирует, как и в JS: срез списка Python — новый список.
           Наблюдаемое значение то же, а «хвост» интерпретатора копирует ровно
           так же, поэтому и сложность обхода у двух движков одна. У строки
           голова — один символ, хвост — остаток. */
        bind(pattern.tail, `rt.chain_tail(${subject})`, `хвост «${pattern.tail}»`)
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
        bind(name, `rt.variant_field(ctx, ${subject}, ${pystring(field)})`, `поле «${field}»`)
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
     только потом начальное значение. */
  const [over, init] = emitOrdered([
    (out2, pad2) => `rt.require_list(ctx, ${emitValue(node.over, ctx, out2, pad2)}, "свёртка")`,
    (out2, pad2) => emitValue(node.init, ctx, out2, pad2),
  ], ctx, out, pad)
  const list = materialize(over, ctx, out, pad)
  const accIdent = ctx.fresh(node.acc)
  out.push(`${pad}# «${node.acc}»`, `${pad}${accIdent} = ${init}`)
  const itemIdent = ctx.fresh(node.item)
  out.push(`${pad}for ${itemIdent} in ${list}:`)

  const undoAcc = ctx.bind(node.acc, accIdent)
  const undoItem = ctx.bind(node.item, itemIdent)
  assignInto(node.body, ctx, out, `${pad}    `, accIdent)
  ctx.unbind(node.item, undoItem)
  ctx.unbind(node.acc, undoAcc)
  return accIdent
}

function emitLoop(node, ctx, out, pad) {
  requireName(node.item, node.kind, "item", node.span)
  const label = node.kind === "map" ? "отобразить" : "отфильтровать"
  const over = emitValue(node.over, ctx, out, pad)
  const list = materialize(`rt.require_list(ctx, ${over}, ${pystring(label)})`, ctx, out, pad)
  const items = ctx.temp()
  const itemIdent = ctx.fresh(node.item)
  out.push(`${pad}${items} = []`, `${pad}for ${itemIdent} in ${list}:`)
  const inner = `${pad}    `

  const undo = ctx.bind(node.item, itemIdent)
  if (node.kind === "map") {
    const value = emitValue(node.body, ctx, out, inner)
    out.push(`${inner}${items}.append(${value})`)
  } else {
    /* Тело фильтра — предикат: для отброшенных элементов ничего больше не
       вычисляется. */
    const flag = emitValue(node.body, ctx, out, inner)
    out.push(
      `${inner}if rt.keep(ctx, ${flag}):`,
      `${inner}    ${items}.append(${itemIdent})`,
    )
  }
  ctx.unbind(node.item, undo)
  return `rt.list_of(${items})`
}

/* ── вызов по имени: ДВЕРЬ программы ── */

/**
 * Вызов по имени — это не вызов внутри программы, а ГРАНИЦА, и здесь стоит всё,
 * что граница обязана проверить.
 *
 * Внутренние вызовы идут прямо на `fn_…`; сюда заходит только тот, у кого имя
 * функции — строка, то есть прогонщик, служба, тест, скрипт. Ровно так же
 * устроен интерпретатор: `callFunction` (src/interpret.mjs) — дверь и проверяет,
 * `applyFunction` — нет.
 *
 * ПОЧЕМУ ПРЕДУСЛОВИЕ ПРОВЕРЯЕТСЯ ЗДЕСЬ, А НЕ В ТЕЛЕ ФУНКЦИИ. В flang `требует`
 * снимает ВЫЗЫВАЮЩИЙ: каждое место вызова обязано доказать предусловие, иначе
 * программа отвергается кодом FLANG_PRECONDITION_CALL и до печати не доезжает.
 * Значит внутри программы требование уже ИСТИННО — не «проверено», а известно,
 * — и печать его проверки в тело была бы платой временем каждого вызова и
 * каждого витка рекурсии за то, что доказано статически. Через эту же дверь
 * приходит недоказанное: значение из JSON, у которого вызывающего нет вовсе.
 *
 * Порядок проверок на двери: сначала арность, потом объявленные типы
 * (`rt.check_entry`, зовёт прогонщик до `call`), и только потом договор.
 * Предусловие о значении вне типа не значит ничего.
 */
function renderDispatch(shared) {
  const lines = [
    "def call(ctx, name, args):",
    ...docstring([
      "Вызов функции по её исходному имени flang.",
      "",
      "Нужен прогонщику и всякому, кто связывает программу с внешним миром",
      "динамически (скрипт, тест, служба). Коды и тексты — те же, что у",
      "интерпретатора: «не найдена функция …» и «функция … принимает N аргум.».",
    ], "    "),
  ]
  for (const fn of shared.prepared.functions.values()) {
    const arity = fn.params.length
    const pass = Array.from({ length: arity }, (_, index) => `args[${index}]`)
    lines.push(
      `    if name == ${pystring(fn.name)}:`,
      `        if len(args) != ${arity}:`,
      "            raise rt.fail(",
      "                rt.CODE_TYPE,",
      /* Склейка, а не f-строка: имя модели вправе содержать фигурные скобки, и
         подстановка их бы не пережила. */
      `                ${pystring(`функция «${fn.name}» принимает ${arity} аргум., получено `)}`,
      "                + str(len(args)),",
      "            )",
      ...renderPreconditions(fn, shared, "        "),
      `        return ${shared.functionIdents.get(fn.name)}(${["ctx", ...pass].join(", ")})`,
    )
  }
  lines.push('    raise rt.fail(rt.CODE_UNKNOWN_NAME, "не найдена функция «" + name + "»")')
  return lines.join("\n")
}

/**
 * Договор функции на двери: `требует`.
 *
 * Программа без единого `требует` не получает отсюда ни строки — печать обязана
 * остаться побайтово прежней, иначе рухнула бы сверка с эталоном и со свидетелем
 * на всём корпусе.
 *
 * Параметры связываются прямо с `args[i]`: своих имён у двери нет, а копировать
 * значения в локальные ради читаемости значило бы печатать строки, которых
 * вычисление не требует.
 */
function renderPreconditions(fn, shared, pad) {
  if (fn.preconditions.length === 0) return []
  const ctx = createContext(fn, shared, { selfTail: false, members: null })
  for (const [index, param] of fn.params.entries()) ctx.bind(param.name, `args[${index}]`)
  const out = []
  for (const property of fn.preconditions) {
    const check = emitValue(property.expr, ctx, out, pad)
    const message = property.message ?? `не выполнено требование «${property.name}» функции «${fn.name}»`
    out.push(
      `${pad}# требует «${property.name}»`,
      `${pad}if not rt.pre(ctx, ${check}, ${pystring(property.name)}, ${pystring(fn.name)}):`,
      `${pad}    raise rt.fail(${pystring(property.code)}, ${pystring(message)})`,
    )
  }
  return out
}

/* ── граница входа: объявленные типы параметров данными ── */

const ВИДЫ_ТИПА_PY = new Map([
  ["число", "rt.TYPE_NUMBER"],
  ["строка", "rt.TYPE_TEXT"],
  ["признак", "rt.TYPE_FLAG"],
  ["ничто", "rt.TYPE_NULL"],
  ["список", "rt.TYPE_LIST"],
  ["запись", "rt.TYPE_RECORD"],
  ["сумма", "rt.TYPE_SUM"],
])

/**
 * Объявленные типы параметров — ТАБЛИЦЕЙ, а не кодом.
 *
 * В напечатанной программе типов нет: прогонщик разбирает JSON и зовёт функцию.
 * Поэтому `«Факториал» принимает н: нат` считался при `н` равном −3 и 2.5, а при
 * 1e300 упирался в FLANG_RECURSION_LIMIT — код, отведённый ОБЫЧНОЙ функции.
 * Тотальная отказывала пределом глубины потому, что доказательство её завершения
 * СТОИТ НА ТИПЕ: у `нат` есть потолок 2^53−1, ниже которого `н минус 1` точно
 * меньше `н`, и сторож убывания в такую функцию не печатается вовсе.
 *
 * Сверяет таблицу `rt.check_entry` — один и тот же текст для всех программ, а
 * строит её `таблицаВхода` из flang/src/types.mjs, то есть тот же файл, что
 * отвечает на этот вопрос для `flang run --args`.
 */
function renderEntry(таблица) {
  return [
    "# Граница входа: объявленные типы параметров данными.",
    "#",
    "# Прогонщик сверяет по ним значения, пришедшие снаружи, ДО вызова",
    "# (rt.check_entry). Виды rt.TYPE_UNKNOWN (значение-функция, параметр",
    "# полиморфизма, применение типа с аргументами) не сверяются — ровно как",
    "# молчит о них проверка значений свидетеля.",
    "_ENTRY = rt.EntryTable(",
    "    [",
    ...таблица.типы.map((запись) =>
      `        (${ВИДЫ_ТИПА_PY.get(запись.вид) ?? "rt.TYPE_UNKNOWN"}, ${pystring(запись.имя)}, ` +
      `${pystring(запись.владелец)}, ${запись.ничто ? "True" : "False"}, ` +
      `${запись.целое ? "True" : "False"}, ${запись.отрезок ? "True" : "False"}, ` +
      `${pynumber(запись.низ)}, ${pynumber(запись.верх)}, ${запись.элемент}, ` +
      `${запись.полеС}, ${запись.полей}, ${запись.вариантС}, ${запись.вариантов}),`),
    "    ],",
    "    [",
    ...таблица.поля.map((поле) => `        (${pystring(поле.имя)}, ${поле.тип}),`),
    "    ],",
    "    [",
    ...таблица.варианты.map((вариант) =>
      `        (${pystring(вариант.имя)}, ${вариант.полеС}, ${вариант.полей}),`),
    "    ],",
    "    [",
    ...таблица.параметры.map((параметр) =>
      `        (${pystring(параметр.функция)}, ${pystring(параметр.параметр)}, ${параметр.тип}),`),
    "    ],",
    ")",
    "",
    "",
    "def entry():",
    ...docstring(["Объявленные типы параметров: по ним сверяется вход извне."], "    "),
    "    return _ENTRY",
  ].join("\n")
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
