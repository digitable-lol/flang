// emit/elixir.mjs — печать программы flang в Elixir.
//
// ── Зачем ──────────────────────────────────────────────────────────────────
// Печать в C даёт переносимость, в Go — один слинкованный файл, в Rust —
// сборку без рантайма, в Python — импорт рядом с Jupyter, в Java и C# — слой
// предметной логики корпоративной системы. Elixir закрывает нишу, которой не
// закрывает ни один из них: программу flang нужно поместить в живую систему,
// которая уже работает и которую нельзя останавливать, — и вызывать её из
// тысяч процессов одновременно, не думая ни о разделяемом состоянии, ни о
// блокировках, потому что и того, и другого здесь нет по устройству.
//
// ── Что здесь принципиально иначе, чем в остальных бэкендах ────────────────
// Общий обход AST, протокол прогонщика и транслитерация имён сохранены, чтобы
// бэкенды читались как одна система. Но печать расходится сильнее, чем где бы
// то ни было, и расходится в обе стороны.
//
// ЧТО ДОСТАЁТСЯ ДАРОМ И ПОТОМУ НЕ ПЕЧАТАЕТСЯ ВОВСЕ:
//
// 1. НЕИЗМЕНЯЕМОСТЬ. Значения flang неизменяемы по договору, и во всех
//    остальных целях этот договор приходится соблюдать вручную. Здесь он —
//    свойство языка, и «хвост» списка вообще перестаёт копировать: список
//    Elixir односвязный, его хвост — тот же список без первой ячейки. Рекурсия
//    «голова и хвост» по длинному списку выходит линейной там, где у
//    интерпретатора и у остальных бэкендов она квадратична.
//
// 2. СОПОСТАВЛЕНИЕ С ОБРАЗЦОМ. Разбор flang печатается `cond`, а не цепочкой
//    `if` с ручной проверкой дискриминанта, потому что `cond` — это ровно
//    «первая подошедшая ветвь» и ничего сверх того.
//
// 3. ХВОСТОВЫЕ ВЫЗОВЫ. Их гарантирует машина. Поэтому здесь НЕТ ни цикла
//    `while (true)`, в который разворачивают хвостовой самовызов бэкенды C,
//    Go, Rust, Python, Java и C#, ни батута, которым они же разворачивают
//    взаимную хвостовую рекурсию. «Отсчёт» вызывает себя напрямую и идёт в
//    постоянной глубине — как у интерпретатора, и без единой строчки, которая
//    бы это устраивала.
//
//    Цена одна, и она перед вами: функция, считающая глубину, оборачивает своё
//    тело в `try/after`, а `try` хвостовые вызовы ломает. Поэтому тело такой
//    функции печатается ОТДЕЛЬНОЙ приватной функцией (`loop_…`), а публичная
//    только считает глубину вокруг неё. Хвостовой самовызов идёт в `loop_…` и
//    остаётся хвостовым; вход снаружи идёт в публичную и считается один раз.
//
// ЧТО ПРИХОДИТСЯ ПЕЧАТАТЬ ЗАНОВО:
//
// 4. IEEE-754. Это главное расхождение бэкенда, и оно не то, которого ждёшь.
//    Целые произвольной точности — беда известная и лечится тем, что число
//    flang всегда `float`. Настоящая беда в другом: **на BEAM невозможно
//    получить значение с плавающей точкой, равное NaN или бесконечности** —
//    машина не возвращает их, а возбуждает ArithmeticError, в том числе на
//    `1.0 / 0.0` и на переполнении. А SPEC (раздел 5) требует, чтобы деление на
//    ноль давало значение. Поэтому число flang здесь — `float()` для конечных
//    значений и один из атомов `:nan`, `:inf`, `:ninf` для остальных, а вся
//    арифметика идёт через функции рантайма, каждая из которых разбирает особые
//    случаи IEEE-754 явно (см. flang_runtime.ex).
//
// 5. ПОРЯДОК ВЫЧИСЛЕНИЯ. Elixir не обещает, в каком порядке вычисляются
//    аргументы вызова, — это записано в его же справочнике. На практике порядок
//    слева направо, но опираться на практику там, где сверяются ТЕКСТЫ первых
//    ошибок, нельзя. Поэтому каждый аргумент, кроме голого имени, печатается
//    отдельной привязкой в блоке: последовательность привязок — единственная
//    конструкция, порядок которой язык гарантирует.
//
// 6. СЧЁТЧИКИ ПРЕДЕЛОВ. Изменяемого состояния в Elixir нет, а контекст
//    вычисления изменяем по своей природе. Протащить его через каждое выражение
//    значило бы удвоить размер напечатанного кода; поэтому счётчики живут в
//    словаре процесса — единственном месте BEAM, где изменяемость локальна
//    процессу и не требует ни сервера, ни передачи состояния (см. рантайм).
//
// 7. РЕКУРСИЯ ОГРАНИЧЕНА ИНАЧЕ. У BEAM нет стека фиксированного размера: он
//    растёт в куче. Значит незавершающаяся нехвостовая рекурсия не упадёт по
//    стеку, как в C, и не даст StackOverflow, как в Java, — она съест память
//    узла целиком. Счётчик глубины здесь поэтому не подстраховка, а
//    единственный ограничитель, и прогонщику не нужен ни большой стек, ни
//    отдельный поток.
//
// ── Неиспользованное имя — здесь ошибка сборки ─────────────────────────────
// Elixir предупреждает о связанной, но не использованной переменной, а
// `elixirc --warnings-as-errors` превращает предупреждение в отказ. Это тот же
// дефект, который ломал сборку бэкенда C под -Werror, и здесь он закрыт так же,
// как в Go: имя, которое никто не читает, получает приставку «_» — принятую в
// Elixir форму «вычислено и намеренно выброшено». Убрать само связывание
// нельзя: у варианта оно обязано сходить за полем и дать FLANG_UNKNOWN_NAME,
// если поля нет. То же и с неиспользованным параметром функции.
//
// ── Роль входит в имя ──────────────────────────────────────────────────────
// Модуль Elixir — одно пространство имён, и повторное определение функции той
// же арности не ошибка, а молчаливое переопределение (с предупреждением о
// несгруппированных клаузах, но с полной потерей одной из них). В ядре FTS
// «Значение операнда» — и вариант суммы типов, и запись, и функция; поэтому
// идентификатор всегда несёт роль: fn_… у функции, v_… у конструктора варианта,
// rec_… у фабрики записи, loop_… у тела рекурсивной функции.
//
// ── Три файла ──────────────────────────────────────────────────────────────
// Рантайм печатается отдельным flang_runtime.ex, программа — модулем по имени
// модуля flang, прогонщик — flang_cli.ex. Рантайм и прогонщик печатаются байт в
// байт из flang/src/emit/elixir/: так их проверяет сам компилятор Elixir прямо
// в репозитории, а не только через тест печати.

import { readFileSync } from "node:fs"

import { canonicalBuiltinName, flangError, hasBuiltin } from "../builtins.mjs"
import { BIDI_CONTROLS, escapeBidiBraced, escapeBidiInFiles } from "../../../tools/ftsc/src/bidi.mjs"
import { pascal, snake } from "../../../tools/ftsc/src/naming.mjs"

/* ═══════════════════════════════════════════════════════════════════════════
   Рантайм и прогонщик.

   Лежат рядом настоящими .ex, а не строками в этом файле: так их проверяет сам
   Elixir (под --warnings-as-errors) прямо в репозитории, а правка рантайма не
   превращается в правку экранирования внутри шаблона. Печатаются байт в байт —
   только с шапкой «сгенерировано» перед первой строкой.
   ═══════════════════════════════════════════════════════════════════════════ */

const RUNTIME_DIRECTORY = new URL("./elixir/", import.meta.url)
const RUNTIME_SOURCE = readFileSync(new URL("flang_runtime.ex", RUNTIME_DIRECTORY), "utf8")
const CLI_SOURCE = readFileSync(new URL("flang_cli.ex", RUNTIME_DIRECTORY), "utf8")

const RUNTIME_FILE = "flang_runtime.ex"
const CLI_FILE = "flang_cli.ex"

/** Модули, которые печатает рантайм: имя модуля flang не имеет права их занять. */
const RUNTIME_MODULES = ["Flang", "Flang.Rt", "Flang.Error", "Flang.Cli", "Flang.Json"]

/** Канонические имена встроенных форм → функции рантайма. */
const BUILTIN_HELPERS = new Map([
  ["длина", "b_length"],
  ["символ", "b_char"],
  ["подстрока", "b_substring"],
  ["соединить", "b_join"],
  ["разделить", "b_split"],
  ["символы", "b_characters"],
  ["содержит", "b_contains"],
  ["начинается с", "b_starts_with"],
  ["к числу", "b_to_number"],
  ["к строке", "b_to_string"],
  ["пусто", "b_empty"],
  ["голова", "b_head"],
  ["хвост", "b_tail"],
  ["добавить", "b_append"],
  ["остаток от", "b_remainder"],
  ["процентов от", "b_percent_of"],
])

/** Арность встроенных форм — проверяется при печати, а не в рантайме. */
const BUILTIN_ARITY = new Map([
  ["длина", 1], ["символ", 2], ["подстрока", 3], ["соединить", 2], ["разделить", 2],
  ["символы", 1],
  ["содержит", 2], ["начинается с", 2], ["к числу", 1], ["к строке", 1], ["пусто", 1],
  ["голова", 1], ["хвост", 1], ["добавить", 2], ["остаток от", 2], ["процентов от", 2],
])

const BINARY_HELPERS = new Map([
  ["add", "add"], ["sub", "sub"], ["mul", "mul"], ["div", "divide"], ["mod", "mod"],
  ["percent", "percent"], ["gt", "gt"], ["lt", "lt"], ["gte", "gte"], ["lte", "lte"],
  ["concat", "concat"],
])

/* Ключевые слова и особые формы Elixir, а также имена, которые напечатанный код
   видит из Kernel без квалификации. Имя из модели, попавшее сюда после
   транслитерации, обязано считаться коллизией, а не молча получить суффикс. */
const EX_RESERVED = [
  "after", "and", "catch", "do", "else", "end", "false", "fn", "in", "nil", "not", "or",
  "rescue", "true", "when",
  "case", "cond", "for", "if", "import", "quote", "raise", "receive", "require", "try",
  "unless", "unquote", "use", "with", "alias", "def", "defp", "defmodule", "defstruct",
  "defexception", "defmacro", "defguard", "defimpl", "defprotocol",
  "__MODULE__", "__DIR__", "__ENV__", "__CALLER__", "__STACKTRACE__", "__aliases__", "__block__",
  /* Kernel: эти имена видны без импорта, и локальное имя их бы затенило. */
  "abs", "apply", "binding", "div", "elem", "exit", "hd", "inspect", "length", "make_ref",
  "map_size", "max", "min", "node", "put_elem", "rem", "round", "self", "send", "spawn",
  "throw", "tl", "trunc", "tuple_size", "is_atom", "is_binary", "is_float", "is_integer",
  "is_list", "is_map", "is_number", "is_pid", "is_tuple", "to_string", "to_charlist",
  /* Имена, которыми пользуется сам напечатанный код. */
  "rt", "args", "value",
]

/* Имена функций, которые печатает сам бэкенд в модуле программы. */
const DECLARED_BY_BACKEND = ["call", "new_context"]

/* Приставки ролей. Роль обязана входить в идентификатор: модуль Elixir — одно
   пространство имён, и вариант «Значение операнда» с функцией «Значение
   операнда» (в ядре FTS есть и то, и другое) при одной арности дали бы две
   клаузы одной функции, из которых уцелела бы вторая. */
const ROLE_PREFIX = {
  function: "fn_",
  variant: "v_",
  record: "rec_",
  step: "loop_",
}

const ROLE_LABEL = {
  function: "функции",
  variant: "конструктора варианта",
  record: "фабрики записи",
  step: "тела рекурсивной функции",
}

/* ═══════════════════════════ подготовка программы ═══════════════════════════ */

// Повторяет prepareProgram интерпретатора: те же проверки, те же коды и тексты.
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

/* ═══════════════════════════ литералы Elixir ═══════════════════════════ */

/**
 * Строковый литерал Elixir.
 *
 * Кириллица печатается как есть: исходник Elixir — всегда UTF-8, и это записано
 * в самом языке, а не в ключе компилятора. Ровно ради этого язык и затевался:
 * имена в напечатанном коде обязаны читаться.
 *
 * Отдельно экранируется `#`: в Elixir строка в двойных кавычках умеет
 * интерполяцию через `#{…}`, и имя модели, содержащее эту последовательность,
 * иначе превратилось бы в код.
 *
 * Двунаправленные управляющие уезжают в `\u{XXXX}` — ту самую форму, которую
 * предлагает сам компилятор в тексте своего отказа. Скобки закрывают
 * экранирование, поэтому шестнадцатеричная цифра, стоящая в строке следом, к
 * нему не приклеится (с бесскобочным `\uXXXX` это пришлось бы держать в
 * голове). Строка Elixir — двоичка UTF-8, и `\u{202e}` даёт ровно те же три
 * байта, что сырой символ: значение прежнее, изменилась только запись.
 */
function exstring(value) {
  let result = '"'
  for (const character of String(value)) {
    const code = character.codePointAt(0)
    if (character === '"') result += '\\"'
    else if (character === "\\") result += "\\\\"
    else if (character === "#") result += "\\#"
    else if (character === "\n") result += "\\n"
    else if (character === "\r") result += "\\r"
    else if (character === "\t") result += "\\t"
    else if (code < 0x20 || code === 0x7f || BIDI_CONTROLS.has(code)) result += `\\u{${code.toString(16)}}`
    else result += character
  }
  return `${result}"`
}

/**
 * Число как значение flang.
 *
 * NaN и бесконечности здесь не литералы вовсе, а атомы: на BEAM значения с
 * плавающей точкой, равного NaN или бесконечности, не существует — машина
 * возбуждает ArithmeticError вместо того, чтобы его вернуть (см. шапку файла).
 *
 * Конечное число печатается кратчайшей записью, читающейся обратно тем же
 * float, и обязательно с точкой: `2` в Elixir — целое неограниченной точности,
 * а целых чисел в flang нет (SPEC, раздел 2).
 */
function exnumber(value) {
  if (Number.isNaN(value)) return ":nan"
  if (value === Infinity) return ":inf"
  if (value === -Infinity) return ":ninf"
  if (Object.is(value, -0)) return "-0.0"
  const text = String(value)
  if (/e/u.test(text)) {
    /* Экспоненциальная запись Elixir требует мантиссу с точкой: «1.0e21», а не
       «1e21». JS печатает «1e+21» — плюс тоже недопустим. */
    const [mantissa, exponent] = text.split("e")
    const body = mantissa.includes(".") ? mantissa : `${mantissa}.0`
    return `${body}e${exponent.replace("+", "")}`
  }
  return text.includes(".") ? text : `${text}.0`
}

/** Идентификатор Elixir начинается со строчной буквы или подчёркивания. */
function safeIdent(identifier) {
  if (identifier.length === 0) return "value"
  return /^[a-z_]/u.test(identifier) ? identifier : `v_${identifier}`
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
          ? `зарезервировано в Elixir: ${previous.name}`
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
 * Печать программы flang в Elixir.
 *
 * @param {object} program AST flang (SPEC.md, раздел 5)
 * @param {{ path?: string, indexBase?: 0 | 1, maxDepth?: number, maxSteps?: number, cli?: boolean }} [options]
 * @returns {{ files: Array<{ path: string, content: string }> }}
 */
export function emitElixir(program, options = {}) {
  const prepared = prepare(program)
  const base = options.indexBase === 0 ? 0 : 1
  const maxDepth = Number.isInteger(options.maxDepth) && options.maxDepth > 0 ? options.maxDepth : 10_000
  const maxSteps = Number.isInteger(options.maxSteps) && options.maxSteps > 0 ? options.maxSteps : 1_000_000
  const moduleName = typeof program.module === "string" && program.module.length > 0 ? program.module : null
  const alias = options.path ?? (moduleName === null ? "FlangProgram" : pascalModule(moduleName))
  if (RUNTIME_MODULES.includes(alias) || alias.startsWith("Flang.")) {
    throw flangError(
      "FLANG_PARSE",
      `модуль «${moduleName}» даёт модуль «${alias}», занятый рантаймом бэкенда — переименуйте модуль`,
    )
  }
  /* Имя файла берётся из имени МОДЕЛИ, а не из уже собранного псевдонима:
     snake не умеет разбирать «UchyotSklada» обратно на слова и дал бы
     «uchyotsklada» вместо «uchyot_sklada». Заодно только так ловится модуль,
     чьё имя занимает файл рантайма («flang runtime» → flang_runtime.ex). */
  const file = moduleName === null ? "flang_program" : safeIdent(snake(moduleName))
  if (file === "flang_runtime" || file === "flang_cli") {
    throw flangError(
      "FLANG_PARSE",
      `модуль «${moduleName}» даёт файл «${file}.ex», занятый рантаймом бэкенда — переименуйте модуль`,
    )
  }

  /* Одно пространство имён на модуль, поэтому один именователь на всё, что
     объявляется в нём: функции, фабрики записей, конструкторы вариантов, тела
     рекурсивных функций. */
  const declarations = createDeclarations([...EX_RESERVED, ...DECLARED_BY_BACKEND])

  const functionIdents = new Map()
  const factoryIdents = new Map()
  const variantIdents = new Map()
  for (const name of prepared.records.keys()) factoryIdents.set(name, declarations.claim("record", name))
  for (const name of prepared.variants.keys()) variantIdents.set(name, declarations.claim("variant", name))
  for (const name of prepared.functions.keys()) functionIdents.set(name, declarations.claim("function", name))

  /* Граф хвостовых вызовов. В отличие от остальных бэкендов, разворачивать
     здесь нечего — BEAM переиспользует кадр сам. Граф нужен ровно за тем, чтобы
     знать, у каких функций тело обязано жить отдельной приватной функцией:
     `try/after` вокруг тела ломает хвостовой вызов, а счётчик глубины без
     `after` не вернулся бы назад на ошибке. */
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

  /* Тело отдельной функцией нужно там, где есть хвостовая рекурсия: только так
     она переживёт `try/after` публичной функции и останется хвостовой. */
  const stepIdents = new Map()
  for (const [name, fn] of prepared.functions) {
    const selfTail = tailEdges.get(name)?.has(name) === true
    const members = cyclic.get(name) ?? null
    if ((selfTail || members !== null) && fn.postconditions.length === 0) {
      stepIdents.set(name, declarations.claim("step", name))
    }
  }

  const globalNames = new Set(declarations.taken.keys())
  const paramIdents = new Map()
  for (const [name, fn] of prepared.functions) {
    paramIdents.set(name, uniqueIdents(fn.params.map((param) => param.name), globalNames))
  }

  const shared = {
    prepared,
    alias,
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

  const files = [
    {
      path: RUNTIME_FILE,
      content: `${banner(moduleName, "рантайм: значения, числа, строки, диагностики")}\n${RUNTIME_SOURCE}`,
    },
    { path: `${file}.ex`, content: renderSource(moduleName, alias, bodies) },
  ]

  if (options.cli !== false) {
    files.push({
      path: CLI_FILE,
      content: `${banner(moduleName, "прогонщик: JSON на входе, JSON на выходе")}\n${CLI_SOURCE}`,
    })
  }
  files.push({ path: "Makefile", content: renderMakefile(alias, file, options.cli !== false) })
  /* Последний шаг — снять сырые двунаправленные управляющие со всего вывода
     (bidi.mjs). Литерал их уже экранировал сам, но имя FTS уезжает ещё и в
     комментарии и в @moduledoc/@doc. Для elixirc это отказ разбора и там, и там
     («invalid bidirectional formatting character in comment/string»): до этого
     фильтра напечатанный модуль с таким именем не собирался вовсе. Форма
     Elixir — `\u{X…}`, та же, что в литерале; @doc остаётся строкой с теми же
     байтами. */
  return { files: escapeBidiInFiles(files, escapeBidiBraced) }
}

/**
 * Имя модуля Elixir из имени модели: PascalCase, но с точкой там, где в имени
 * стоит точка (иначе «Учёт.Склад» дало бы один сегмент вместо двух).
 */
function pascalModule(name) {
  return String(name)
    .split(".")
    .map((part) => pascal(part))
    .map((part) => (/^[A-Z]/u.test(part) ? part : `M${part}`))
    .join(".")
}

function banner(moduleName, what) {
  return [
    "# Сгенерировано flang (бэкенд Elixir, flang/src/emit/elixir.mjs). Не редактировать руками.",
    moduleName === null ? "# Программа flang без имени модуля." : `# Модуль flang: «${moduleName}».`,
    `# Файл: ${what}.`,
    "# Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.",
  ].join("\n")
}

function renderMakefile(alias, file, cli) {
  return [
    "# Сгенерировано flang (бэкенд Elixir). Целей ровно столько, сколько нужно:",
    "# напечатанный код обязан собираться и запускаться без единой правки.",
    "#",
    "# mix здесь не нужен: зависимостей нет ни одной, а mix.exs потребовал бы",
    "# структуры проекта там, где хватает трёх файлов рядом.",
    "ELIXIRC ?= elixirc",
    "ELIXIR ?= elixir",
    `MODULE ?= ${alias}`,
    "",
    "# --warnings-as-errors — не придирка: связанное, но не использованное имя",
    "# в Elixir даёт предупреждение, и напечатанный код обязан быть чистым.",
    "ELIXIRCFLAGS ?= --warnings-as-errors",
    "",
    "all: build",
    "",
    "build:",
    "\tmkdir -p _build",
    `\t$(ELIXIRC) $(ELIXIRCFLAGS) -o _build ${RUNTIME_FILE} ${file}.ex${cli ? ` ${CLI_FILE}` : ""}`,
    "",
    ...(cli
      ? [
        "run: build",
        "\t$(ELIXIR) -pa _build -e 'Flang.Cli.main([\"$(MODULE)\"])'",
        "",
      ]
      : []),
    "clean:",
    "\trm -rf _build",
    "",
    `.PHONY: all build${cli ? " run" : ""} clean`,
    "",
  ].join("\n")
}

/* ── файл программы ── */

function renderSource(moduleName, alias, bodies) {
  const head = [
    banner(moduleName, "реализация: функции, конструкторы значений, вызов по имени"),
    "",
    `defmodule ${alias} do`,
    "  @moduledoc \"\"\"",
    moduleName === null
      ? "  Программа flang, напечатанная в Elixir."
      : `  Модуль flang «${escapeDoc(moduleName)}», напечатанный в Elixir.`,
    "",
    "  Контракт вызова: функция возвращает значение либо возбуждает `Flang.Error` с",
    "  кодом и текстом, дословно совпадающими с интерпретатором flang. Все значения",
    "  — размеченные кортежи `Flang.Rt`: число там всегда `float()` либо один из",
    "  атомов `:nan`, `:inf`, `:ninf` (на BEAM таких значений с плавающей точкой не",
    "  существует), признак отличается от числа тегом, а равенство скаляров —",
    "  Object.is, а не `===`.",
    "",
    "  Пределы вычисления живут в словаре процесса и обнуляются `new_context/0`:",
    "  вызывать её обязан всякий, кто начинает новое вычисление.",
    "  \"\"\"",
  ].join("\n")
  return `${[head, ...bodies.filter((body) => body.length > 0), "end"].join("\n\n")}\n`
}

/** Имя модели внутри @doc не имеет права закрыть строку документации. */
function escapeDoc(value) {
  return String(value).replaceAll('"""', '\\"\\"\\"').replaceAll("\\", "\\\\")
}

function renderContext(base, maxDepth, maxSteps) {
  return [
    "  @doc \"\"\"",
    "  Готовит контекст вычисления с настройками этой программы.",
    "",
    "  Индексация строк, предел глубины вызовов и лимит шагов — это настройки",
    "  программы, а не рантайма: печать могла идти с нулевой базой индексации, а",
    "  пределы вызывающий вправе поменять через `Flang.Rt.set_max_depth/1` и",
    "  `Flang.Rt.set_max_steps/1`.",
    "",
    "  Счётчики при этом обнуляются, поэтому вызывать её нужно перед каждым",
    "  самостоятельным вычислением, а не один раз на процесс.",
    "  \"\"\"",
    "  def new_context do",
    `    Flang.Rt.new_context(${base}, ${maxDepth}, ${maxSteps})`,
    "  end",
  ].join("\n")
}

/** Строка документации Elixir из готовых строк текста. */
function exdoc(lines, pad) {
  const safe = lines.map((line) => escapeDoc(line))
  return [
    `${pad}@doc """`,
    ...safe.map((line) => (line === "" ? "" : `${pad}${line}`)),
    `${pad}"""`,
  ]
}

function describeFunction(fn, shared) {
  const lines = [`Функция flang «${fn.name}».`, ""]
  lines.push(
    fn.total
      ? "Тотальная: завершение доказано анализом структурного убывания (totality.mjs)."
      : "Обычная (не тотальная): завершение не доказано, зацикливание ловится лимитом шагов.",
  )
  if (shared.stepIdents.has(fn.name)) {
    const members = shared.cyclic.get(fn.name)
    if (members !== undefined) {
      const others = [...members].filter((name) => name !== fn.name).map((name) => `«${name}»`).join(", ")
      lines.push(
        "",
        `Взаимная хвостовая рекурсия с ${others}. Тело живёт отдельной функцией`,
        "`" + shared.stepIdents.get(fn.name) + "`: BEAM переиспользует кадр сам, но только",
        "если вызов действительно хвостовой, а `try/after` вокруг тела это ломает.",
      )
    } else {
      lines.push(
        "",
        "Хвостовой самовызов. Ни цикла, ни батута здесь нет: BEAM переиспользует",
        "кадр сам. Тело вынесено в `" + shared.stepIdents.get(fn.name) + "` ровно затем,",
        "чтобы `try/after` со счётчиком глубины не оказался вокруг хвостового вызова.",
      )
    }
  }
  if (shared.recursive.has(fn.name)) {
    lines.push("", "Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.")
  }
  const idents = shared.paramIdents.get(fn.name)
  lines.push("")
  fn.params.forEach((param, index) => {
    lines.push(`Параметр \`${idents[index]}\` — «${param.name}»${typeNote(param.type)}.`)
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

/** Идентификаторы Elixir для набора имён модели. */
function uniqueIdents(names, globalNames) {
  const taken = new Set([...EX_RESERVED, ...globalNames])
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

function renderFields(keys, values, variantName) {
  const body = keys.map((key, index) => `{${exstring(key)}, ${values[index]}}`).join(", ")
  return variantName === null
    ? `Flang.Rt.record([${body}])`
    : `Flang.Rt.variant(${exstring(variantName)}, [${body}])`
}

function renderFactory(name, type, shared) {
  const fields = Array.isArray(type.fields) ? type.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name), shared.globalNames)
  return [
    ...exdoc([
      `Запись FTS «${name}»: ${fields.map((field) => `«${field.name}»`).join(", ") || "без полей"}.`,
      "",
      "Запись flang тотальна: пропущенное поле — это «ничто», а не дырка.",
      "Поля — список пар, а не Map: их порядок наблюдаем в диагностиках.",
    ], "  "),
    `  def ${shared.factoryIdents.get(name)}(${idents.join(", ")}) do`,
    `    ${renderFields(fields.map((field) => field.name), idents, null)}`,
    "  end",
  ].join("\n")
}

function renderVariantFactory(sum, item, shared) {
  const fields = Array.isArray(item.fields) ? item.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name), shared.globalNames)
  return [
    ...exdoc([
      `Вариант «${item.name}» суммы типов «${sum.name}».`,
      "",
      "Дискриминант — имя варианта; проверяется через `Flang.Rt.variant_is?/2`.",
      "Структурой Elixir вариант не сделан намеренно: дискриминант в flang именной,",
      "и литерал `{variant, fields}` из JSON статического типа не имеет вовсе.",
      "Приставка `v_` в имени — это роль: у функции flang с тем же именем",
      "идентификатор начинается с `fn_`, и одно определение не съедает другое.",
    ], "  "),
    `  def ${shared.variantIdents.get(item.name)}(${idents.join(", ")}) do`,
    `    ${renderFields(fields.map((field) => field.name), idents, item.name)}`,
    "  end",
  ].join("\n")
}

/* ═══════════════════════════ печать функции ═══════════════════════════ */

function renderFunction(fn, shared) {
  const guard = shared.recursive.has(fn.name)
  const step = shared.stepIdents.get(fn.name) ?? null

  const ctx = createContext(fn, shared)
  const body = []
  const inner = "    "

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
        `${inner}if not Flang.Rt.post(${check}, ${exstring(property.name)}, ${exstring(fn.name)}) do`,
        `${inner}  raise Flang.Rt.fail(${exstring(property.code)}, ${exstring(message)})`,
        `${inner}end`,
        "",
        `${inner}${result}`,
      )
    }
  } else {
    /* Тело функции — хвостовая позиция по определению: его значение и есть
       значение функции. Печатать его через привязку значило бы отобрать у BEAM
       возможность переиспользовать кадр. */
    emitTail(fn.body, ctx, body, inner)
  }

  /* Неиспользованный параметр в Elixir — предупреждение, а под
     --warnings-as-errors отказ сборки. Приставка «_» — принятая здесь форма
     «получено и намеренно не использовано». */
  const bodyText = body.join("\n")
  const params = ctx.params.map((param) => (usesName(bodyText, param) ? param : `_${param}`))

  const documentation = exdoc(describeFunction(fn, shared), "  ")

  if (step !== null) {
    /* Тело живёт отдельной приватной функцией: хвостовой вызов внутри неё
       остаётся хвостовым, и BEAM переиспользует кадр. Обёртка вокруг тела
       (`try/after` со счётчиком глубины) сюда не попадает — иначе хвостовой
       вызов перестал бы им быть, и «Отсчёт» на ста тысячах шагов съел бы
       память. */
    const stepBlock = [
      `  defp ${step}(${params.join(", ")}) do`,
      ...body,
      "  end",
    ].join("\n")

    const outer = guard
      ? [
        ...documentation,
        `  def ${shared.functionIdents.get(fn.name)}(${ctx.params.join(", ")}) do`,
        `    Flang.Rt.enter(${exstring(fn.name)})`,
        "",
        "    try do",
        `      ${step}(${ctx.params.join(", ")})`,
        "    after",
        "      Flang.Rt.leave()",
        "    end",
        "  end",
      ].join("\n")
      : [
        ...documentation,
        `  def ${shared.functionIdents.get(fn.name)}(${ctx.params.join(", ")}) do`,
        `    ${step}(${ctx.params.join(", ")})`,
        "  end",
      ].join("\n")
    return `${outer}\n\n${stepBlock}`
  }

  if (guard) {
    /* Счётчик глубины обязан уменьшаться и на ошибке, иначе первая же пойманная
       ошибка навсегда съела бы предел; enter вне try намеренно — если он сам
       возбудил FLANG_RECURSION_LIMIT, входа не было, и выхода быть не должно. */
    return [
      ...documentation,
      `  def ${shared.functionIdents.get(fn.name)}(${params.join(", ")}) do`,
      `    Flang.Rt.enter(${exstring(fn.name)})`,
      "",
      "    try do",
      ...body.map((line) => (line === "" ? "" : `  ${line}`)),
      "    after",
      "      Flang.Rt.leave()",
      "    end",
      "  end",
    ].join("\n")
  }
  return [
    ...documentation,
    `  def ${shared.functionIdents.get(fn.name)}(${params.join(", ")}) do`,
    ...body,
    "  end",
  ].join("\n")
}

/** Встречается ли имя в тексте как отдельное слово. */
function usesName(text, ident) {
  return new RegExp(`(?<![A-Za-z_0-9])${ident}(?![A-Za-z_0-9])`, "u").test(text)
}

function createContext(fn, shared) {
  const ctx = {
    shared,
    fn,
    scope: new Map(),
    taken: new Set([...EX_RESERVED, ...shared.globalNames]),
    params: [],
    temp() {
      shared.counter += 1
      return `t${shared.counter}`
    },
    fresh(name) {
      const wanted = safeIdent(snake(name))
      let candidate = wanted
      let suffix = 1
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

/* ═══════════════════════════ выражения ═══════════════════════════
   В Elixir всё — выражение: `if` и `cond` возвращают значение, а последнее
   выражение блока и есть результат функции. Поэтому `return`, который печатают
   остальные бэкенды, здесь не нужен вовсе.

   А вот хвостовая позиция нужна, и нужна как раз потому, что здесь она
   работает. BEAM переиспользует кадр, только если вызов действительно
   последнее, что делает функция; стоит положить его результат в переменную —

       t2 = if … do … loop_x(a, b) end
       t2

   — и хвостовой вызов перестаёт им быть: после возврата остаётся присвоить и
   вернуть. Программа при этом не сломается (стек BEAM растёт в куче), но
   «Отсчёт» на ста тысячах шагов будет держать сто тысяч кадров вместо одного.
   Поэтому печать разведена на два обхода: emitTail печатает выражение как
   последнее выражение блока, ничего не связывая, а emitValue — как значение,
   которое кому-то ещё понадобится.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Печать выражения в хвостовой позиции: результатом блока становится оно само,
 * без промежуточной привязки. Только здесь хвостовой вызов внутри компоненты
 * печатается вызовом тела соседа (`loop_…`), а не публичной функции.
 */
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
      out.push(`${pad}if Flang.Rt.cond_flag(${flag}) do`)
      emitTail(node.then, ctx, out, `${pad}  `)
      out.push(`${pad}else`)
      emitTail(node.else, ctx, out, `${pad}  `)
      out.push(`${pad}end`)
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
      /* Хвостовой вызов внутри компоненты идёт в тело соседа, а не в его
         публичную функцию: так глубина не растёт (кадр переиспользован BEAM), а
         счётчик считает шаг, а не вход. Ровно это и делают циклом бэкенды C, Go,
         Rust, Python, Java и C# — с той разницей, что им приходится этот цикл
         печатать. */
      const step = ctx.shared.stepIdents.get(callee.name)
      if (step !== undefined && ctx.shared.stepIdents.has(ctx.fn.name) && sameComponent(ctx, callee.name)) {
        out.push(
          `${pad}# хвостовой вызов «${node.name}»: BEAM переиспользует кадр сам`,
          `${pad}Flang.Rt.step(${exstring(ctx.fn.name)})`,
          `${pad}${step}(${args.join(", ")})`,
        )
        return
      }
      out.push(`${pad}${ctx.shared.functionIdents.get(callee.name)}(${args.join(", ")})`)
      return
    }
    default: {
      const value = emitValue(node, ctx, out, pad)
      out.push(`${pad}${value}`)
    }
  }
}

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
      return `Flang.Rt.field_get(${target}, ${exstring(node.field)})`
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
      return body
    }
    case "if": {
      const flag = emitValue(node.cond, ctx, out, pad)
      /* `if` в Elixir — выражение, поэтому ветви печатаются прямо в него, а не
         через переменную-приёмник, как в C-подобных целях. */
      const temp = ctx.temp()
      out.push(`${pad}${temp} =`, `${pad}  if Flang.Rt.cond_flag(${flag}) do`)
      emitBlockValue(node.then, ctx, out, `${pad}    `)
      out.push(`${pad}  else`)
      emitBlockValue(node.else, ctx, out, `${pad}    `)
      out.push(`${pad}  end`)
      return temp
    }
    case "match": {
      const temp = ctx.temp()
      emitMatch(node, ctx, out, pad, temp)
      return temp
    }
    case "call": {
      /* Вызов в позиции значения хвостовым не бывает по построению: его
         результат кому-то ещё нужен. Значит он идёт в публичную функцию, и та
         считает глубину — иначе незавершающаяся нехвостовая рекурсия не упёрлась
         бы ни во что и съела бы память узла. */
      const callee = resolveCall(node, ctx)
      const args = emitOrdered(
        (node.args ?? []).map((argument) => (out2, pad2) => emitValue(argument, ctx, out2, pad2)),
        ctx, out, pad,
      )
      return `${ctx.shared.functionIdents.get(callee.name)}(${args.join(", ")})`
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
      return `Flang.Rt.${BUILTIN_HELPERS.get(canonical)}(${rendered.join(", ")})`
    }
    case "binary": {
      const [left, right] = emitOrdered([
        (out2, pad2) => emitValue(node.left, ctx, out2, pad2),
        (out2, pad2) => emitValue(node.right, ctx, out2, pad2),
      ], ctx, out, pad)
      if (node.op === "eq" || node.op === "neq") {
        /* Равенство ошибок не даёт: сравнимо всё со всем (SPEC, раздел 5). */
        return node.op === "eq"
          ? `Flang.Rt.eq(${left}, ${right})`
          : `Flang.Rt.neq(${left}, ${right})`
      }
      const helper = BINARY_HELPERS.get(node.op)
      if (helper === undefined) {
        throw flangError("FLANG_TYPE", `неизвестная операция «${node.op}»`, node.span)
      }
      return `Flang.Rt.${helper}(${left}, ${right})`
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
      return `Flang.Rt.list([${rendered.join(", ")}])`
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
 * Печатает выражение как последнее выражение блока, но НЕ в хвостовой позиции:
 * значение блока кому-то ещё понадобится (ветвь `if`, чей результат кладётся в
 * переменную; тело `Enum.map`). Разница с emitTail ровно одна и вся в вызове:
 * здесь он идёт в публичную функцию, там — в тело соседа по компоненте.
 */
function emitBlockValue(expr, ctx, out, pad) {
  const value = emitValue(expr, ctx, out, pad)
  out.push(`${pad}${value}`)
}

function sameComponent(ctx, name) {
  if (name === ctx.fn.name) return true
  const members = ctx.shared.cyclic.get(ctx.fn.name)
  return members !== undefined && members.has(name)
}

/**
 * Печать нескольких значений с сохранением порядка вычисления.
 *
 * Elixir не обещает порядка вычисления аргументов вызова — это записано в его
 * справочнике, — а сверяются ТЕКСТЫ первых ошибок. Поэтому каждый аргумент,
 * кроме голого имени, обязательно ложится в отдельную привязку: только
 * последовательность привязок в блоке язык вычисляет строго сверху вниз.
 *
 * Отличие от остальных бэкендов ровно здесь: там временное заводится, лишь
 * когда сосед справа напечатал свои операторы, потому что порядок вычисления
 * аргументов там гарантирован языком. Тут гарантии нет, и экономить нельзя.
 */
function emitOrdered(makers, ctx, out, pad) {
  if (makers.length < 2) return makers.map((make) => make(out, pad))
  const parts = []
  for (const make of makers) {
    const value = make(out, pad)
    if (isAtom(value)) {
      parts.push(value)
      continue
    }
    const temp = ctx.temp()
    out.push(`${pad}${temp} = ${value}`)
    parts.push(temp)
  }
  return parts
}

/**
 * Атом — выражение, которое можно передвинуть по тексту, ничего не изменив:
 * имя переменной. Литералы сюда намеренно не попадают: их вычисление ошибок не
 * даёт, но и переносить их незачем — привязка стоит дёшево, а читаемость от
 * единообразия только выигрывает.
 */
function isAtom(expression) {
  return /^[a-z_][A-Za-z_0-9]*[?!]?$/u.test(expression)
}

/**
 * Связанное, но не использованное имя — обычное дело в языке с образцами
 * («случай голова и хвост», а голова телу не нужна). В Elixir это
 * предупреждение, а под `--warnings-as-errors` — отказ сборки, то есть ровно
 * тот дефект, который ломал сборку бэкенда C. Приставка «_» — принятая здесь
 * форма «вычислено и намеренно выброшено».
 *
 * Убрать само связывание нельзя: оно обязано вычислиться (у варианта
 * отсутствующее поле даёт FLANG_UNKNOWN_NAME прямо здесь).
 */
function hideUnused(out, from, bindings, extra = "") {
  const text = `${out.slice(from).join("\n")}\n${extra}`
  for (const binding of bindings) {
    if (usesName(text, binding.ident)) continue
    out[binding.line] = out[binding.line].replace(`${binding.ident} = `, `_${binding.ident} = `)
  }
}

/* ── литералы ── */

function emitLiteral(value, ctx, out, pad) {
  if (value === undefined || value === null) return "Flang.Rt.nothing()"
  if (typeof value === "boolean") return `Flang.Rt.flag(${value ? "true" : "false"})`
  if (typeof value === "number") return `{:num, ${exnumber(value)}}`
  if (typeof value === "string") return `Flang.Rt.text(${exstring(value)})`
  if (Array.isArray(value)) {
    const items = emitOrdered(
      value.map((item) => (out2, pad2) => emitLiteral(item, ctx, out2, pad2)),
      ctx, out, pad,
    )
    return `Flang.Rt.list([${items.join(", ")}])`
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

function emitFields(fields, variantName, ctx, out, pad) {
  const keys = Object.keys(fields)
  const values = emitOrdered(
    keys.map((key) => (out2, pad2) => emitValue(fields[key], ctx, out2, pad2)),
    ctx, out, pad,
  )
  return renderFields(keys, values, variantName)
}

/* ── разбор ── */

/**
 * Разбор печатается `cond`, а не цепочкой `if`: `cond` — это ровно «первая
 * подошедшая ветвь» и ничего сверх того, и он же выражение, поэтому результат
 * ветви не нужно класть в переменную-приёмник, как в C-подобных целях.
 *
 * Сопоставление с образцом самого Elixir (`case`) здесь не годится: образец
 * flang проверяет дискриминант ПО ЗНАЧЕНИЮ (имя варианта — строка из модели), а
 * образец-литерал сравнивает значения по правилам flang (NaN равен NaN). `case`
 * сравнивал бы по правилам Elixir и разошёлся бы с интерпретатором на первом же
 * NaN.
 */
function emitMatch(node, ctx, out, pad, target) {
  /* `target === null` — хвостовая позиция: `cond` сам становится результатом
     блока, и вызов в ветви остаётся хвостовым. Иначе результат кладётся в
     переменную, и ветви печатаются как обычные значения. */
  const subject = materialize(emitValue(node.target, ctx, out, pad), ctx, out, pad)
  const cases = node.cases ?? []
  if (!Array.isArray(cases)) {
    throw flangError("FLANG_PARSE", "случай разбора должен содержать «pattern» и «body»", node.span)
  }

  /* Литерал в образце может потребовать собственных привязок, поэтому все
     проверки готовятся до `cond` — иначе привязка оказалась бы внутри ветви. */
  const tests = cases.map((branch) => {
    if (branch === null || typeof branch !== "object" || branch.pattern === undefined) {
      throw flangError("FLANG_PARSE", "случай разбора должен содержать «pattern» и «body»", node.span)
    }
    return patternTest(branch.pattern, subject, ctx, out, pad, node.span)
  })

  const head = target === null ? `${pad}cond do` : `${pad}  cond do`
  if (target !== null) out.push(`${pad}${target} =`)
  out.push(head)
  const shift = target === null ? "" : "  "
  const inner = `${pad}${shift}    `
  let closed = false
  for (const [index, branch] of cases.entries()) {
    const test = tests[index]
    out.push(`${pad}${shift}  ${test === null ? "true" : test} ->`)
    const undo = bindPattern(branch.pattern, subject, ctx, out, inner)
    const at = out.length
    if (target === null) emitTail(branch.body, ctx, out, inner)
    else emitBlockValue(branch.body, ctx, out, inner)
    for (const step of undo) ctx.unbind(step.name, step.previous)
    hideUnused(out, at, undo)
    if (index + 1 < cases.length) out.push("")
    if (test === null) {
      closed = true
      break
    }
  }
  if (!closed) {
    /* Ветвь «ни один образец не подошёл» обязана быть: `cond` без подошедшей
       ветви возбуждает CondClauseError — ошибку Elixir, а не диагностику
       flang. */
    if (cases.length > 0) out.push("")
    out.push(`${pad}${shift}  true ->`, `${inner}raise Flang.Rt.match_fail(${subject})`)
  }
  out.push(`${pad}${shift}end`)
}

/** Проверка дискриминанта; `null` — образец совпадает всегда. */
function patternTest(pattern, subject, ctx, out, pad, span) {
  switch (pattern.kind) {
    case "empty":
      return `match?({:list, []}, ${subject})`
    case "cons":
      return `match?({:list, [_ | _]}, ${subject})`
    case "variant":
      return `Flang.Rt.variant_is?(${subject}, ${exstring(pattern.name)})`
    case "literal": {
      const literal = emitLiteral(pattern.value, ctx, out, pad)
      return `Flang.Rt.equal(${subject}, ${literal})`
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
        bind(pattern.head, `Flang.Rt.b_head(${subject})`, `голова «${pattern.head}»`)
      }
      if (pattern.tail !== undefined && pattern.tail !== null) {
        /* Единственное место, где Elixir дешевле остальных целей: список
           односвязный, и «хвост» — тот же список без первой ячейки, без
           копирования. У интерпретатора (массив JS) он копирует, но значение от
           этого не меняется — расходится только сложность, и в лучшую сторону. */
        bind(pattern.tail, `Flang.Rt.b_tail(${subject})`, `хвост «${pattern.tail}»`)
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
        bind(name, `Flang.Rt.variant_field(${subject}, ${exstring(field)})`, `поле «${field}»`)
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

/** Значение, которое читается больше одного раза, обязано лечь в привязку. */
function materialize(value, ctx, out, pad) {
  if (isAtom(value)) return value
  const temp = ctx.temp()
  out.push(`${pad}${temp} = ${value}`)
  return temp
}

/* ── свёртка, отобразить, отфильтровать ── */

/**
 * Циклов в Elixir нет вовсе — и это ровно тот случай, когда их отсутствие не
 * стоит ничего: `свёртка` это `Enum.reduce`, `отобразить` — `Enum.map`,
 * `отфильтровать` — `Enum.filter`. Остальные бэкенды печатают на их месте цикл
 * с накопителем; здесь накопителя нет, потому что нет и изменяемости.
 */
function emitFold(node, ctx, out, pad) {
  requireName(node.acc, "fold", "acc", node.span)
  requireName(node.item, "fold", "item", node.span)
  /* Порядок как в интерпретаторе: сперва коллекция и проверка «это список»,
     только потом начальное значение. */
  const list = materialize(
    `Flang.Rt.require_list(${emitValue(node.over, ctx, out, pad)}, "свёртка")`, ctx, out, pad,
  )
  const init = materialize(emitValue(node.init, ctx, out, pad), ctx, out, pad)
  const accIdent = ctx.fresh(node.acc)
  const itemIdent = ctx.fresh(node.item)
  const temp = ctx.temp()

  const undoAcc = ctx.bind(node.acc, accIdent)
  const undoItem = ctx.bind(node.item, itemIdent)
  const inner = `${pad}    `
  const body = []
  const value = emitValue(node.body, ctx, body, inner)
  ctx.unbind(node.item, undoItem)
  ctx.unbind(node.acc, undoAcc)

  const bodyText = [...body, value].join("\n")
  out.push(
    `${pad}${temp} =`,
    `${pad}  Enum.reduce(${list}, ${init}, fn ${usesName(bodyText, itemIdent) ? itemIdent : `_${itemIdent}`}, ` +
      `${usesName(bodyText, accIdent) ? accIdent : `_${accIdent}`} ->`,
    ...body,
    `${inner}${value}`,
    `${pad}  end)`,
  )
  return temp
}

function emitLoop(node, ctx, out, pad) {
  requireName(node.item, node.kind, "item", node.span)
  const label = node.kind === "map" ? "отобразить" : "отфильтровать"
  const list = materialize(
    `Flang.Rt.require_list(${emitValue(node.over, ctx, out, pad)}, ${exstring(label)})`, ctx, out, pad,
  )
  const itemIdent = ctx.fresh(node.item)
  const temp = ctx.temp()

  const undo = ctx.bind(node.item, itemIdent)
  const inner = `${pad}    `
  const body = []
  const value = emitValue(node.body, ctx, body, inner)
  ctx.unbind(node.item, undo)

  const bodyText = [...body, value].join("\n")
  const parameter = usesName(bodyText, itemIdent) ? itemIdent : `_${itemIdent}`
  if (node.kind === "map") {
    out.push(
      `${pad}${temp} =`,
      `${pad}  Flang.Rt.list(`,
      `${pad}    Enum.map(${list}, fn ${parameter} ->`,
      ...body.map((line) => (line === "" ? "" : `  ${line}`)),
      `${inner}  ${value}`,
      `${pad}    end)`,
      `${pad}  )`,
    )
  } else {
    /* Тело фильтра — предикат: для отброшенных элементов ничего больше не
       вычисляется. */
    out.push(
      `${pad}${temp} =`,
      `${pad}  Flang.Rt.list(`,
      `${pad}    Enum.filter(${list}, fn ${parameter} ->`,
      ...body.map((line) => (line === "" ? "" : `  ${line}`)),
      `${inner}  Flang.Rt.keep(${value})`,
      `${pad}    end)`,
      `${pad}  )`,
    )
  }
  return temp
}

/* ── вызов по имени ── */

function renderDispatch(shared) {
  const lines = [
    ...exdoc([
      "Вызов функции по её исходному имени flang.",
      "",
      "Нужен прогонщику и всякому, кто связывает программу с внешним миром",
      "динамически (скрипт, тест, служба). Коды и тексты — те же, что у",
      "интерпретатора: «не найдена функция …» и «функция … принимает N аргум.».",
    ], "  "),
  ]
  const functions = [...shared.prepared.functions.values()]
  for (const fn of functions) {
    const arity = fn.params.length
    const pass = Array.from({ length: arity }, (_, index) => `Enum.at(args, ${index})`)
    lines.push(
      `  def call(${exstring(fn.name)}, args) do`,
      `    if length(args) != ${arity} do`,
      "      raise Flang.Rt.fail(",
      "        Flang.Rt.code_type(),",
      /* Склейка, а не интерполяция: имя модели вправе содержать «#{», и
         подстановка этого бы не пережила. */
      `        ${exstring(`функция «${fn.name}» принимает ${arity} аргум., получено `)} <>`,
      "          Integer.to_string(length(args))",
      "      )",
      "    end",
      "",
      `    ${shared.functionIdents.get(fn.name)}(${pass.join(", ")})`,
      "  end",
      "",
    )
  }
  lines.push(
    "  def call(name, _args) do",
    '    raise Flang.Rt.fail(Flang.Rt.code_unknown_name(), "не найдена функция «" <> name <> "»")',
    "  end",
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
