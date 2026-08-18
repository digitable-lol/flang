/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
// emit/csharp.mjs — печать программы flang в C#.
//
// ── Зачем ──────────────────────────────────────────────────────────────────
// Печать в C даёт переносимость, в Go — один слинкованный файл, в Rust —
// сборку без рантайма, в Python — импорт рядом с Jupyter, в Java — слой
// предметной логики банковской системы. C# закрывает ту же нишу, что Java, на
// другой половине корпоративного мира: там, где предметная логика написана под
// .NET, программу flang нужно положить классом рядом с прочими, а не звать
// через процесс.
//
// ── Что здесь принципиально иначе, чем в бэкенде Java ──────────────────────
// Языки близки, и общее сохранено намеренно: тот же обход AST, тот же протокол
// прогонщика, та же транслитерация имён, та же развёртка хвостовой рекурсии.
// Расходятся четыре вещи, и каждая решена явно.
//
// 1. STRUCT ПРОТИВ CLASS. У C# есть значимые типы, которых нет в Java, и
//    соблазн сделать Value структурой велик: значения неизменяемы, живут
//    недолго, передаются повсюду. Решение — класс, и по трём причинам сразу:
//    у struct всегда есть состояние по умолчанию (все поля в нулях), которое
//    выглядит как «ничто», но роняет всё, что его прочитает; сорок байт копии
//    дороже восьми байт ссылки на каждой из десятков тысяч передач за вызов; и
//    значение всё равно рекурсивно — список содержит значения, — так что от
//    кучи не уйти. Обоснование целиком — в Value.cs.
//
//    Field, наоборот, структура: пара из двух ссылок, состояния по умолчанию у
//    неё не бывает, рекурсии в ней нет.
//
// 2. NULLABLE-КОНТЕКСТ. Он включён везде (#nullable enable в каждом файле и
//    <Nullable>enable</Nullable> в проекте), и это не украшение: значение flang
//    никогда не бывает отсутствующим — «ничто» это полноценное значение с тегом,
//    а не null, — поэтому Value без вопросительного знака означает «здесь точно
//    есть значение», и компилятор это проверяет. Вопросительный знак стоит ровно
//    в двух местах: Value.Lookup, где отсутствие поля — законный ответ, и шаг
//    батута, который возвращает null, когда вместо значения заполнил отскок.
//
// 3. DECIMAL НЕ ГОДИТСЯ. Для предметной области, где считают деньги, decimal
//    выглядит правильным выбором, и в бэкенде ftsc → C# он им и является. Здесь
//    — нет: это база 10 с 28 значащими цифрами, а не IEEE-754; в нём нет ни NaN,
//    ни бесконечностей, а SPEC (раздел 5) требует, чтобы деление на ноль давало
//    значение, а не исключение; и «0.1 плюс 0.2» дало бы ровно 0.3 — в ядре FTS
//    это ложь. Число flang — IEEE-754 double (SPEC, раздел 2), и точка.
//
// 4. НЕТ UNION-ТИПОВ, как и в Java. Суммы типов flang — значения с тегом
//    Variant и дискриминантом-строкой плюс по статическому методу-конструктору
//    на вариант; иерархия классов дала бы семь типов, между которыми
//    напечатанный код всё равно ходил бы через `is`.
//
// ── Три дефекта, которые ловит /warnaserror ────────────────────────────────
// Напечатанный код собирается с TreatWarningsAsErrors, и это здешний линтер:
// отдельного бэкенд от чужой машины требовать не вправе.
//
//   • НЕДОСТИЖИМЫЙ КОД (CS0162) — предупреждение, то есть под /warnaserror
//     отказ сборки. Функция, у которой все хвостовые позиции — самовызов,
//     разворачивается в `while (true)`, и любой оператор после такого цикла
//     компилятор отвергнет. Поэтому после хвостового цикла здесь не печатается
//     ничего — ни возврата, ни переменной результата, в которую такая функция
//     ни разу не пишет. Ровно этот дефект ломал сборку бэкенда C под -Werror.
//   • НЕПРИСВОЕННАЯ ПЕРЕМЕННАЯ (CS0165) — ошибка. Переменная, в которую кладут
//     результат разбора, обязана быть присвоена по КАЖДОМУ пути, поэтому у
//     цепочки образцов всегда есть последняя ветвь, а разбор без единого случая
//     печатается вызовом Flang.NoMatch, а не оператором throw.
//   • НЕИСПОЛЬЗОВАННАЯ ПЕРЕМЕННАЯ. CS0219 срабатывает только на присваивание
//     константы, а привязки образцов приходят из вызовов, поэтому формально
//     тишина. Полагаться на это нельзя — анализаторы у пользователя могут быть
//     строже, — и связанное, но не использованное имя уходит в отбрасывающее
//     присваивание `_ = …`. Выбросить само связывание нельзя: у варианта оно
//     обязано сходить за полем и дать FLANG_UNKNOWN_NAME, если поля нет.
//
// ── Роль входит в имя ──────────────────────────────────────────────────────
// Класс C# — одно пространство имён, и два метода с одной сигнатурой не
// собираются. В ядре FTS «Значение операнда» — и вариант суммы типов, и запись,
// и функция; поэтому идентификатор всегда несёт роль: Fn… у функции, V… у
// конструктора варианта, Rec… у фабрики записи, Step… у шага батута.
// Столкнуться после этого могут только два имени одной роли — и это ошибка
// печати, а не молчаливое переименование.
//
// ── Пределы ────────────────────────────────────────────────────────────────
// Воспроизведены и глубина, и шаги. Стек здесь важнее, чем где бы то ни было:
// StackOverflowException в .NET не ловится вовсе и убивает процесс вместе со
// всеми накопленными ответами, поэтому прогонщик считает в потоке с явно
// заданным стеком, а предел глубины упирается первым.

import { readFileSync } from "node:fs"

import { canonicalBuiltinName, flangError, hasBuiltin, помощникФормы } from "../builtins.mjs"
import { требуетПланировщика } from "../conc.mjs"
import { defunctionalize } from "../defunc.mjs"
import { таблицаВхода } from "../types.mjs"
import { BIDI_CONTROLS, escapeBidiInFiles, escapeBidiUnicode4 } from "../bidi.mjs"
import { camel, pascal } from "../naming.mjs"
import { обойтиЗанятоеЦелью } from "./target-occupied.mjs"

/* ═══════════════════════════════════════════════════════════════════════════
   Рантайм и прогонщик.

   Лежат рядом настоящими .cs, а не строками в этом файле: так их проверяет сам
   компилятор прямо в репозитории, а правка рантайма не превращается в правку
   экранирования внутри шаблона. Печатаются байт в байт — только с шапкой
   «сгенерировано» перед первой строкой.
   ═══════════════════════════════════════════════════════════════════════════ */

const RUNTIME_DIRECTORY = new URL("./csharp/", import.meta.url)

const RUNTIME_FILES = [
  ["Value.cs", "значение: тег, поля, равенство, печать числа"],
  ["Field.cs", "поле записи или варианта"],
  ["FlangError.cs", "диагностика: код и текст"],
  ["Ctx.cs", "контекст вычисления: пределы и индексация строк"],
  ["Flang.cs", "операции языка: арифметика, встроенные формы, батут"],
]

const CLI_FILE = "FlangCli.cs"

const RUNTIME_SOURCE = new Map(
  RUNTIME_FILES.map(([name]) => [name, readFileSync(new URL(name, RUNTIME_DIRECTORY), "utf8")]),
)
const CLI_SOURCE = readFileSync(new URL(CLI_FILE, RUNTIME_DIRECTORY), "utf8")

/** Типы, которые печатает рантайм: имя модуля не имеет права их занять. */
const RUNTIME_TYPES = ["Value", "Field", "FlangError", "Ctx", "Flang", "FlangCli"]

/** Канонические имена встроенных форм → методы рантайма. */
const BUILTIN_HELPERS = new Map([
  ["длина", "BLength"],
  ["символ", "BChar"],
  ["подстрока", "BSubstring"],
  ["соединить", "BJoin"],
  ["разделить", "BSplit"],
  ["символы", "BCharacters"],
  ["код символа", "BCharCode"],
  ["содержит", "BContains"],
  ["начинается с", "BStartsWith"],
  ["к числу", "BToNumber"],
  ["к числу или беда", "BToNumberOrFailure"],
  ["к строке", "BToString"],
  ["пусто", "BEmpty"],
  ["голова", "BHead"],
  ["хвост", "BTail"],
  ["элемент", "BElement"],
  ["добавить", "BAppend"],
  ["приписать", "BPrepend"],
  ["остаток от", "BRemainder"],
  ["процентов от", "BPercentOf"],
])

/**
 * Суффикс имени помощника БЕЗ сторожа частичности (`помощникФормы`).
 *
 * Печать здесь ничего не доказывает: отметку `доказана` кладёт передний край
 * (`bin/flang.mjs`, `markProven`) по выводу проверки типов, а копия печати на
 * самом языке анализа не видит вовсе — круг импортов. Обе стороны читают одну
 * отметку и потому печатают одно и то же.
 */
const СУФФИКС_ДОКАЗАННОГО = "Proven"

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
  ["add", "Add"], ["sub", "Sub"], ["mul", "Mul"], ["div", "Div"], ["mod", "Mod"],
  ["percent", "Percent"], ["gt", "Gt"], ["lt", "Lt"], ["gte", "Gte"], ["lte", "Lte"],
  ["concat", "Concat"],
])

/* Ключевые слова C# (включая контекстные) и имена базовой библиотеки, которые
   напечатанный код видит без квалификации. Имя из модели, попавшее сюда после
   транслитерации, обязано считаться коллизией, а не молча получить суффикс.
   Экранирование через «@class» C# допускает, но оно превратило бы читаемое имя
   в загадку — а весь смысл транслитерации в том, чтобы код читался. */
const CS_RESERVED = [
  "abstract", "as", "base", "bool", "break", "byte", "case", "catch", "char", "checked",
  "class", "const", "continue", "decimal", "default", "delegate", "do", "double", "else",
  "enum", "event", "explicit", "extern", "false", "finally", "fixed", "float", "for",
  "foreach", "goto", "if", "implicit", "in", "int", "interface", "internal", "is", "lock",
  "long", "namespace", "new", "null", "object", "operator", "out", "override", "params",
  "private", "protected", "public", "readonly", "ref", "return", "sbyte", "sealed", "short",
  "sizeof", "stackalloc", "static", "string", "struct", "switch", "this", "throw", "true",
  "try", "typeof", "uint", "ulong", "unchecked", "unsafe", "ushort", "using", "virtual",
  "void", "volatile", "while",
  "add", "and", "alias", "ascending", "args", "async", "await", "by", "descending", "dynamic",
  "equals", "from", "get", "global", "group", "init", "into", "join", "let", "nameof", "not",
  "notnull", "on", "or", "orderby", "partial", "record", "remove", "required", "select", "set",
  "unmanaged", "value", "var", "when", "where", "with", "yield", "_",
  /* Базовая библиотека: эти простые имена напечатанный код видит через using. */
  "System", "Console", "Math", "String", "Object", "Double", "Boolean", "Array", "List",
  "Exception", "Type", "Convert", "Enum", "Nullable", "Func", "Action", "StringBuilder",
  ...RUNTIME_TYPES,
  "ctx", "bounce",
]

/* Имена, которые печатает сам бэкенд в классе программы. */
const DECLARED_BY_BACKEND = ["Call", "NewContext"]

/* Приставки ролей. В отличие от бэкендов Python и Java, где приставка идёт в
   змеином регистре (fn_, v_, rec_, step_), здесь она в PascalCase: имена членов
   класса в C# принято писать так, и напечатанный код обязан читаться как код на
   C#, а не как код на Python в чужом синтаксисе. Роль от этого никуда не
   девается — она по-прежнему первое, что видно в имени. */
const ROLE_PREFIX = {
  function: "Fn",
  variant: "V",
  record: "Rec",
  step: "Step",
}

const ROLE_LABEL = {
  function: "функции",
  variant: "конструктора варианта",
  record: "фабрики записи",
  step: "шага батута",
}

/* ═══════════════════════════ подготовка программы ═══════════════════════════ */

// Повторяет prepareProgram интерпретатора: те же проверки, те же коды и тексты.
// Разница только во времени срабатывания — при печати, а не при вычислении.
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

/* ═══════════════════════════ литералы C# ═══════════════════════════ */

/**
 * Строковый литерал C#.
 *
 * Кириллица печатается как есть — исходник записывается в UTF-8, и компилятор
 * читает его так же (у .NET SDK это поведение по умолчанию). Ровно ради этого
 * язык и затевался: имена в напечатанном коде обязаны читаться.
 *
 * По символам, а не по единицам UTF-16: суррогатная пара обязана уехать в файл
 * парой, иначе строка, разобранная и собранная обратно, перестала бы совпадать
 * с исходной по кодовым точкам.
 *
 * Двунаправленные управляющие уезжают в `\uXXXX` — той же формой, что и прочие
 * управляющие. Она берёт ровно четыре шестнадцатеричные цифры, поэтому цифра,
 * стоящая в строке следом, к экранированию не приклеится (у `\x` в C# длина
 * переменная, 1–4 цифры, и он бы её проглотил). Все двенадцать лежат в BMP:
 * одно экранирование на символ, та же кодовая точка, та же длина в char —
 * значение литерала прежнее, изменилась только запись.
 */
function csstring(value) {
  let result = '"'
  for (const character of String(value)) {
    const code = character.codePointAt(0)
    if (character === '"') result += '\\"'
    else if (character === "\\") result += "\\\\"
    else if (character === "\n") result += "\\n"
    else if (character === "\r") result += "\\r"
    else if (character === "\t") result += "\\t"
    else if (code < 0x20 || code === 0x7f || BIDI_CONTROLS.has(code)) result += `\\u${code.toString(16).padStart(4, "0")}`
    else result += character
  }
  return `${result}"`
}

/**
 * Число как литерал C# (double).
 *
 * NaN и бесконечности литералом записать нельзя вовсе — только константами
 * double. Всё остальное печатается кратчайшей записью, читающейся обратно тем
 * же double: `String(value)` даёт именно её, а суффикс `d` делает литерал
 * заведомо вещественным (без него `2` было бы int, и целочисленное деление
 * посчитало бы не то).
 *
 * −0.0 в C# — настоящий отрицательный ноль, double.IsNegative его различает,
 * поэтому особого приёма не нужно: нужен только знак.
 */
function csnumber(value) {
  if (Number.isNaN(value)) return "double.NaN"
  if (value === Infinity) return "double.PositiveInfinity"
  if (value === -Infinity) return "double.NegativeInfinity"
  if (Object.is(value, -0)) return "-0.0d"
  const text = String(value)
  /* Экспоненциальная запись JS («1e+21») — допустимый литерал C#, а вот запись
     без точки и без экспоненты («2») стала бы int. */
  return /[.e]/u.test(text) ? `${text}d` : `${text}.0d`
}

/** Идентификатор C# не может начинаться с цифры и не может быть пустым. */
function safeIdent(identifier) {
  if (identifier.length === 0) return "value"
  return /^[0-9]/u.test(identifier) ? `v${identifier}` : identifier
}

/* ═══════════════════════════ имена ═══════════════════════════ */

/**
 * Именователь верхнего уровня: роль плюс транслитерация имени модели.
 *
 * Роль входит в идентификатор всегда — см. шапку файла. Столкнуться поэтому
 * могут только два имени одной роли («Сумма» и «сумма» дают один FnSumma), и
 * это ошибка печати, а не молчаливое переименование: сгенерированный код читают
 * рядом с моделью, и два разных имени модели обязаны остаться различимыми.
 */
function createDeclarations(reserved) {
  const taken = new Map(reserved.map((word) => [word, { role: null, name: word }]))
  return {
    taken,
    claim(role, name) {
      const identifier = safeIdent(`${ROLE_PREFIX[role]}${pascal(name)}`)
      const previous = taken.get(identifier)
      if (previous !== undefined && !(previous.role === role && previous.name === name)) {
        const owner = previous.role === null
          ? `зарезервировано в C#: ${previous.name}`
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
 * Печать программы flang в C#.
 *
 * @param {object} program AST flang (SPEC.md, раздел 5)
 * @param {{ path?: string, indexBase?: 0 | 1, maxDepth?: number, maxSteps?: number, cli?: boolean }} [options]
 * @returns {{ files: Array<{ path: string, content: string }> }}
 */
export function emitCsharp(program, options = {}) {
  /* Печать в цель без планировщика конкурентности невозможна, и молчать об этом
     нельзя: до этого отказа шесть целей из восьми ТЕРЯЛИ процессы, печатали
     обработчики обычными функциями и кончались кодом 0. Отказ стоит первым — до
     всякой работы, потому что печатать нечего вовсе (см. `conc.mjs`,
     `требуетПланировщика`). */
  требуетПланировщика(program, "csharp")
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
  const base = options.indexBase === 0 ? 0 : 1
  const maxDepth = Number.isInteger(options.maxDepth) && options.maxDepth > 0 ? options.maxDepth : 10_000
  const maxSteps = Number.isInteger(options.maxSteps) && options.maxSteps > 0 ? options.maxSteps : 1_000_000
  const moduleName = typeof program.module === "string" && program.module.length > 0 ? program.module : null
  const wanted = options.path ?? (moduleName === null ? "FlangProgram" : safeIdent(pascal(moduleName)))
  /* Имя модуля flang доезжает до цели именем в ЕЁ пространстве имён, а часть
     этого пространства цель занимает сама (`target-occupied.mjs`). Свободное имя
     возвращается как есть — вывод не меняется ни на байт, — занятое обходится
     приставкой. Отказывать здесь нельзя: имя автор выбрал законно, а набор
     занятого у цели свой и меняется от её версии. */
  const className = обойтиЗанятоеЦелью(wanted, "csharp")
  if (RUNTIME_TYPES.includes(className)) {
    throw flangError(
      "FLANG_PARSE",
      `модуль «${moduleName}» даёт класс «${className}», занятый рантаймом бэкенда — переименуйте модуль`,
    )
  }

  const declarations = createDeclarations([...CS_RESERVED, ...DECLARED_BY_BACKEND])

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
     объявления класса, а C# вдобавок запрещает повторно объявить имя во
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
  bodies.push(renderEntry(входные))

  const files = []
  for (const [name, what] of RUNTIME_FILES) {
    files.push({ path: name, content: `${banner(moduleName, what)}\n${RUNTIME_SOURCE.get(name)}` })
  }
  files.push({ path: `${className}.cs`, content: renderSource(moduleName, className, bodies) })

  if (options.cli !== false) {
    files.push({
      path: CLI_FILE,
      content: `${banner(moduleName, "прогонщик: JSON на входе, JSON на выходе")}\n${CLI_SOURCE}`,
    })
  }
  files.push({ path: "flang.csproj", content: renderProject(moduleName, options.cli !== false) })
  files.push({ path: "Makefile", content: renderMakefile(className, options.cli !== false) })
  /* Последний шаг — снять сырые двунаправленные управляющие со всего вывода
     (bidi.mjs). Литерал их уже экранировал сам, но имя FTS уезжает ещё и в
     комментарии — в шапку файла, в `///`-документацию и в комментарий .csproj,
     — а комментарий читают первым и проверить исполнением не могут. Как ведёт
     себя Roslyn, здесь не проверено: тулчейна .NET на машине нет, — и его
     молчание всё равно не было бы доказательством. Форма C# — `\uXXXX`. */
  return { files: escapeBidiInFiles(files, escapeBidiUnicode4) }
}

function banner(moduleName, what) {
  return [
    "// Сгенерировано flang (бэкенд C#, flang/src/emit/csharp.mjs). Не редактировать руками.",
    moduleName === null ? "// Программа flang без имени модуля." : `// Модуль flang: «${moduleName}».`,
    `// Файл: ${what}.`,
    "// Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.",
  ].join("\n")
}

/**
 * Проект .NET SDK.
 *
 * Пуст настолько, насколько это возможно: ни одной ссылки на пакет — только
 * базовая библиотека. Из настроек значимы четыре:
 *
 *   • Nullable=enable — nullable-контекст обязателен, см. шапку файла;
 *   • TreatWarningsAsErrors — здешний линтер, см. «три дефекта» там же;
 *   • InvariantGlobalization — напечатанный код не имеет права зависеть от
 *     локали машины: разделитель дробной части и правила сравнения строк
 *     наблюдаемы через «к строке» и «содержит»;
 *   • RootNamespace пуст — типы живут в глобальном пространстве имён, как в
 *     безымянном пакете бэкенда Java, и видят друг друга без using.
 */
function renderProject(moduleName, cli) {
  return [
    "<!-- Сгенерировано flang (бэкенд C#). Не редактировать руками. -->",
    moduleName === null ? "<!-- Программа flang без имени модуля. -->" : `<!-- Модуль flang: «${moduleName}». -->`,
    '<Project Sdk="Microsoft.NET.Sdk">',
    "",
    "  <PropertyGroup>",
    `    <OutputType>${cli ? "Exe" : "Library"}</OutputType>`,
    "    <TargetFramework>net8.0</TargetFramework>",
    /* Напечатанная программа обязана запускаться там, где рантайм НОВЕЕ
       заявленной цели, а не только ровно на ней. По умолчанию .NET требует
       ту же основную версию: собранный под net8.0 проект на машине с одним
       лишь .NET 10 собирается и падает при запуске — «You must install or
       update .NET», хотя ничего в коде десятке не противоречит.
       Поймано на dev (Ubuntu 26.04, .NET 10 без пакета восьмёрки): 30 из 36
       проверок бэкенда красили набор, и это была не наша ошибка и не ошибка
       машины, а обещание генератора, которое он не собирался держать.
       Целью остаётся net8.0 — она задаёт язык и библиотеку, на которые мы
       рассчитываем; RollForward снимает лишнее требование к рантайму. */
    "    <RollForward>LatestMajor</RollForward>",
    "    <LangVersion>latest</LangVersion>",
    "    <Nullable>enable</Nullable>",
    "    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>",
    "    <InvariantGlobalization>true</InvariantGlobalization>",
    "    <RootNamespace></RootNamespace>",
    "    <AssemblyName>flang</AssemblyName>",
    ...(cli ? ["    <StartupObject>FlangCli</StartupObject>"] : []),
    "    <EnableDefaultCompileItems>true</EnableDefaultCompileItems>",
    "    <GenerateDocumentationFile>false</GenerateDocumentationFile>",
    "  </PropertyGroup>",
    "",
    "</Project>",
    "",
  ].join("\n")
}

function renderMakefile(className, cli) {
  return [
    "# Сгенерировано flang (бэкенд C#). Целей ровно столько, сколько нужно:",
    "# напечатанный код обязан собираться и запускаться без единой правки.",
    "DOTNET ?= dotnet",
    `CLASS ?= ${className}`,
    "",
    "all: build",
    "",
    "# Сборка идёт с TreatWarningsAsErrors (см. flang.csproj): напечатанный код",
    "# обязан быть чистым под самым строгим режимом, иначе он не пройдёт в чужую",
    "# сборку.",
    "build:",
    "\t$(DOTNET) build -v quiet --nologo",
    "",
    ...(cli
      ? [
        "run: build",
        "\t$(DOTNET) run -v quiet --nologo -- $(CLASS)",
        "",
      ]
      : []),
    "clean:",
    "\t$(DOTNET) clean -v quiet --nologo || true",
    "\trm -rf bin obj",
    "",
    `.PHONY: all build${cli ? " run" : ""} clean`,
    "",
  ].join("\n")
}

/* ── файл программы ── */

function renderSource(moduleName, className, bodies) {
  const head = [
    banner(moduleName, "реализация: функции, конструкторы значений, вызов по имени"),
    "#nullable enable",
    "",
    "using System.Collections.Generic;",
    "",
    "/// <summary>",
    moduleName === null
      ? "/// Программа flang, напечатанная в C#."
      : `/// Модуль flang «${escapeXml(moduleName)}», напечатанный в C#.`,
    "///",
    "/// Контракт вызова: метод возвращает значение либо бросает FlangError с кодом и",
    "/// текстом, дословно совпадающими с интерпретатором flang. Все значения — Value:",
    "/// числа там всегда double (ни int, ни decimal в flang нет), признак отличается",
    "/// от числа тегом, а не типом C#, и равенство скаляров — Object.is, а не ==.",
    "///",
    "/// Value без вопросительного знака означает «здесь точно есть значение»:",
    "/// «ничто» в flang — полноценное значение с тегом, а не null.",
    "/// </summary>",
    `public static class ${className}`,
    "{",
  ].join("\n")
  return `${[head, ...bodies.filter((body) => body.length > 0), "}"].join("\n\n")}\n`
}

/** Имя модели внутри XML-комментария не имеет права его сломать. */
function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function renderContext(base, maxDepth, maxSteps) {
  return [
    "    /// <summary>",
    "    /// Контекст вычисления с настройками этой программы.",
    "    ///",
    "    /// Индексация строк, предел глубины вызовов и лимит шагов — это настройки",
    "    /// программы, а не рантайма: печать могла идти с нулевой базой индексации, а",
    "    /// пределы вызывающий вправе поменять прямо в возвращённом контексте.",
    "    /// </summary>",
    "    public static Ctx NewContext()",
    "    {",
    "        var ctx = new Ctx();",
    `        ctx.IndexBase = ${base};`,
    `        ctx.MaxDepth = ${maxDepth};`,
    `        ctx.MaxSteps = ${maxSteps}L;`,
    "        return ctx;",
    "    }",
  ].join("\n")
}

/** Документирующий комментарий C# из готовых строк текста. */
function csdoc(lines, pad) {
  const safe = lines.map((line) => escapeXml(line))
  return [
    `${pad}/// <summary>`,
    ...safe.map((line) => (line === "" ? `${pad}///` : `${pad}/// ${line}`)),
    `${pad}/// </summary>`,
  ]
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
 * Идентификаторы C# для набора имён модели: транслитерация в camelCase (так
 * принято для локальных имён и параметров) плюс развод столкновений.
 */
function uniqueIdents(names, globalNames) {
  const taken = new Set([...CS_RESERVED, ...globalNames])
  return names.map((name) => {
    const wanted = safeIdent(camel(name))
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
  if (keys.length === 0) {
    return variantName === null
      ? "Value.EmptyRecord()"
      : `Value.Variant(${csstring(variantName)}, System.Array.Empty<Field>())`
  }
  const body = keys.map((key, index) => `new Field(${csstring(key)}, ${values[index]})`).join(", ")
  return variantName === null
    ? `Value.Record(new Field[] { ${body} })`
    : `Value.Variant(${csstring(variantName)}, new Field[] { ${body} })`
}

function renderFactory(name, type, shared) {
  const fields = Array.isArray(type.fields) ? type.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name), shared.globalNames)
  const signature = idents.map((ident) => `Value ${ident}`).join(", ")
  return [
    ...csdoc([
      `Запись FTS «${name}»: ${fields.map((field) => `«${field.name}»`).join(", ") || "без полей"}.`,
      "",
      "Запись flang тотальна: пропущенное поле — это «ничто», а не дырка.",
    ], "    "),
    `    public static Value ${shared.factoryIdents.get(name)}(${signature})`,
    "    {",
    `        return ${renderFields(fields.map((field) => field.name), idents, null)};`,
    "    }",
  ].join("\n")
}

function renderVariantFactory(sum, item, shared) {
  const fields = Array.isArray(item.fields) ? item.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name), shared.globalNames)
  const signature = idents.map((ident) => `Value ${ident}`).join(", ")
  return [
    ...csdoc([
      `Вариант «${item.name}» суммы типов «${sum.name}».`,
      "",
      "Union-типов в C# нет, поэтому дискриминант — имя варианта; проверяется через",
      "Value.VariantIs(значение, «Имя»). Приставка V в имени — это роль: у функции",
      "flang с тем же именем идентификатор начинается с Fn, и одно объявление не",
      "спорит с другим.",
    ], "    "),
    `    public static Value ${shared.variantIdents.get(item.name)}(${signature})`,
    "    {",
    `        return ${renderFields(fields.map((field) => field.name), idents, item.name)};`,
    "    }",
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
  const inner = guard && members === null ? "            " : "        "

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
        `${inner}if (!Flang.Post(ctx, ${check}, ${csstring(property.name)}, ${csstring(fn.name)}))`,
        `${inner}{`,
        `${inner}    throw Flang.Fail(${csstring(property.code)}, ${csstring(message)});`,
        `${inner}}`,
      )
    }
    body.push(`${inner}return ${result};`)
  } else if (selfTail) {
    /* Ни одного оператора после этого цикла печатать нельзя: `while (true)` без
       достижимого break не завершается нормально, и всё следующее компилятор
       объявил бы недостижимым (CS0162), а под TreatWarningsAsErrors это отказ
       сборки. Ровно поэтому здесь нет и переменной результата, в которую
       функция с чисто хвостовой рекурсией ни разу не пишет. */
    body.push(`${inner}while (true)`, `${inner}{`)
    emitTail(fn.body, ctx, body, `${inner}    `)
    body.push(`${inner}}`)
  } else {
    emitTail(fn.body, ctx, body, inner)
  }

  const documentation = csdoc(describeFunction(fn, shared), "    ")
  const params = ["Ctx ctx", ...ctx.params.map((param) => `Value ${param}`)].join(", ")
  const signature = `    public static Value ${shared.functionIdents.get(fn.name)}(${params})`

  if (members !== null) {
    /* Батут: наружу торчит обычный метод, внутри — шаг, возвращающий отскок.
       Группа методов приводится к делегату Flang.Step прямо по имени: никакого
       объекта при этом не создаётся сверх самого делегата. */
    const step = shared.stepIdents.get(fn.name)
    const unpack = ctx.params.flatMap((param, index) => [
      `        // «${fn.params[index].name}»`,
      `        Value ${param} = args[${index}];`,
    ])
    const stepBlock = [
      ...csdoc([
        `Шаг батута для «${fn.name}»: значение либо отскок к соседу по рекурсии.`,
        "",
        "Возвращает Value? именно потому, что отскок — это не значение: заполнив",
        "bounce, шаг обязан вернуть null, и nullable-контекст делает это видимым в",
        "сигнатуре, а не в комментарии.",
      ], "    "),
      `    private static Value? ${step}(Ctx ctx, Value[] args, Flang.Bounce bounce)`,
      "    {",
      ...unpack,
      ...body,
      "    }",
    ].join("\n")

    const outer = [
      ...documentation,
      signature,
      "    {",
      `        ctx.Enter(${csstring(fn.name)});`,
      "        try",
      "        {",
      `            return Flang.Trampoline(ctx, ${step}, new Value[] { ${ctx.params.join(", ")} }, ${csstring(fn.name)});`,
      "        }",
      "        finally",
      "        {",
      "            ctx.Leave();",
      "        }",
      "    }",
    ].join("\n")
    return `${stepBlock}\n\n${outer}`
  }

  if (guard) {
    /* Счётчик глубины обязан уменьшаться и на ошибке, иначе первая же пойманная
       ошибка навсегда съела бы предел; ctx.Enter вне try намеренно — если он сам
       бросил FLANG_RECURSION_LIMIT, входа не было, и выхода быть не должно. */
    return [
      ...documentation,
      signature,
      "    {",
      `        ctx.Enter(${csstring(fn.name)});`,
      "        try",
      "        {",
      ...body,
      "        }",
      "        finally",
      "        {",
      "            ctx.Leave();",
      "        }",
      "    }",
    ].join("\n")
  }
  return [...documentation, signature, "    {", ...body, "    }"].join("\n")
}

function createContext(fn, shared, { selfTail, members }) {
  const ctx = {
    shared,
    fn,
    scope: new Map(),
    taken: new Set([...CS_RESERVED, ...shared.globalNames]),
    params: [],
    selfTail,
    members,
    temp() {
      shared.counter += 1
      return `t${shared.counter}`
    },
    fresh(name) {
      const wanted = safeIdent(camel(name))
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
      out.push(`${pad}if (Flang.Cond(ctx, ${flag}))`, `${pad}{`)
      emitTail(node.then, ctx, out, `${pad}    `)
      out.push(`${pad}}`, `${pad}else`, `${pad}{`)
      emitTail(node.else, ctx, out, `${pad}    `)
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
          `${pad}ctx.Step(${csstring(ctx.fn.name)});`,
          `${pad}continue;`,
        )
        return
      }
      if (ctx.members !== null && ctx.members.has(node.name)) {
        out.push(
          `${pad}// хвостовой вызов «${node.name}» — отскок, а не кадр стека`,
          `${pad}bounce.Args = new Value[] { ${args.join(", ")} };`,
          `${pad}bounce.Next = ${ctx.shared.stepIdents.get(node.name)};`,
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

/* ── значение: возвращает выражение C#, попутно печатая нужные операторы ── */

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
      return `Flang.FieldGet(ctx, ${target}, ${csstring(node.field)})`
    }
    case "let": {
      const value = emitValue(node.value, ctx, out, pad)
      requireName(node.name, "let", "name", node.span)
      const ident = ctx.fresh(node.name)
      out.push(`${pad}// пусть «${node.name}»`, `${pad}Value ${ident} = ${value};`)
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
      const temp = ctx.temp()
      /* Объявление отдельно от присваивания: значение приходит из двух ветвей, а
         C# требует, чтобы к моменту чтения переменная была определённо присвоена
         по любому пути (CS0165) — обе ветви присваивают, и этого довольно. */
      out.push(`${pad}Value ${temp};`, `${pad}if (Flang.Cond(ctx, ${flag}))`, `${pad}{`)
      assignInto(node.then, ctx, out, `${pad}    `, temp)
      out.push(`${pad}}`, `${pad}else`, `${pad}{`)
      assignInto(node.else, ctx, out, `${pad}    `, temp)
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
      return `Flang.${помощникФормы(canonical, node, BUILTIN_HELPERS, СУФФИКС_ДОКАЗАННОГО)}(${["ctx", ...rendered].join(", ")})`
    }
    case "binary": {
      const [left, right] = emitOrdered([
        (out2, pad2) => emitValue(node.left, ctx, out2, pad2),
        (out2, pad2) => emitValue(node.right, ctx, out2, pad2),
      ], ctx, out, pad)
      if (node.op === "eq" || node.op === "neq") {
        /* Равенство ошибок не даёт: сравнимо всё со всем (SPEC, раздел 5). */
        return node.op === "eq" ? `Flang.Eq(${left}, ${right})` : `Flang.Neq(${left}, ${right})`
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
      return rendered.length === 0 ? "Value.EmptyList()" : `Value.List(new Value[] { ${rendered.join(", ")} })`
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
 * Пока соседи тоже выражения, порядок обеспечивает сам C# (спецификация языка
 * требует вычислять аргументы вызова и элементы инициализатора массива слева
 * направо). Но узел, которому нужны собственные операторы (условие, разбор,
 * свёртка), печатает их ПЕРЕД выражением — и тогда всё, что стоит левее, обязано
 * вычислиться до них, иначе первая ошибка окажется не той.
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

/**
 * Связанное, но не использованное имя — обычное дело в языке с образцами
 * («случай голова и хвост», а голова телу не нужна). CS0219 на такое имя не
 * срабатывает: он ловит только присваивание константы, а привязки приходят из
 * вызовов. Полагаться на это нельзя — анализаторы у пользователя могут быть
 * строже, — и объявление уходит в отбрасывающее присваивание `_ = …`.
 *
 * Убрать само связывание нельзя: оно обязано вычислиться (у варианта
 * отсутствующее поле даёт FLANG_UNKNOWN_NAME прямо здесь).
 *
 * `extra` — текст, который тоже считается использованием: значение узла может
 * быть выражением, ещё не попавшим в напечатанные строки.
 */
function hideUnused(out, from, bindings, extra = "") {
  const text = `${out.slice(from).join("\n")}\n${extra}`
  for (const binding of bindings) {
    if (new RegExp(`\\b${binding.ident}\\b`, "u").test(text)) continue
    out[binding.line] = out[binding.line].replace(`Value ${binding.ident} = `, "_ = ")
  }
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
  if (value === undefined || value === null) return "Value.Nothing()"
  if (typeof value === "boolean") return `Value.Flag(${value ? "true" : "false"})`
  if (typeof value === "number") return `Value.Number(${csnumber(value)})`
  if (typeof value === "string") return `Value.Text(${csstring(value)})`
  if (Array.isArray(value)) {
    const items = emitOrdered(
      value.map((item) => (out2, pad2) => emitLiteral(item, ctx, out2, pad2)),
      ctx, out, pad,
    )
    return items.length === 0 ? "Value.EmptyList()" : `Value.List(new Value[] { ${items.join(", ")} })`
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
     проверки готовятся до цепочки if — иначе оператор оказался бы внутри ветви
     соседнего условия. */
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
        out.push(`${pad}}`, `${pad}else`, `${pad}{`)
        emitBranch(branch, subject, ctx, out, `${pad}    `, target)
        out.push(`${pad}}`)
      } else {
        emitBranch(branch, subject, ctx, out, pad, target)
      }
      closed = true
      break
    }
    if (opened) out.push(`${pad}}`, `${pad}else if (${test})`, `${pad}{`)
    else out.push(`${pad}if (${test})`, `${pad}{`)
    opened = true
    emitBranch(branch, subject, ctx, out, `${pad}    `, target)
  }
  if (closed) return
  if (opened) {
    /* Ветка «ни один образец не подошёл» обязана быть: без неё переменная
       результата осталась бы не присвоенной ни по одному пути, и компилятор
       отверг бы её чтение (CS0165). Здесь она не заглушка, а поведение
       интерпретатора. */
    out.push(
      `${pad}}`,
      `${pad}else`,
      `${pad}{`,
      `${pad}    throw Flang.MatchFail(ctx, ${subject});`,
      `${pad}}`,
    )
  } else if (target === null) {
    out.push(`${pad}throw Flang.MatchFail(ctx, ${subject});`)
  } else {
    /* Разбор без единого случая не совпадает никогда, но в позиции значения
       напечатать здесь `throw` нельзя: следующий оператор стал бы недостижимым
       (CS0162), а под TreatWarningsAsErrors это отказ сборки. Поэтому отказ едет
       через метод, чей тип возврата — Value. */
    out.push(`${pad}${target} = Flang.NoMatch(ctx, ${subject});`)
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
      return `Value.ChainEmpty(${subject})`
    case "cons":
      return `Value.ChainCons(${subject})`
    case "variant":
      return `Value.VariantIs(${subject}, ${csstring(pattern.name)})`
    case "literal": {
      const literal = emitLiteral(pattern.value, ctx, out, pad)
      return `Value.Equal(${subject}, ${literal})`
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
    undo.push({ name, ident, line: out.length - 1, previous: ctx.bind(name, ident) })
  }
  switch (pattern.kind) {
    case "cons":
      if (pattern.head !== undefined && pattern.head !== null) {
        bind(pattern.head, `Value.ChainHead(${subject})`, `голова «${pattern.head}»`)
      }
      if (pattern.tail !== undefined && pattern.tail !== null) {
        /* Хвост копирует, как и в JS: массив нельзя разделить с суффиксом без
           копирования. Наблюдаемое значение то же, а «хвост» интерпретатора
           копирует ровно так же, поэтому и сложность обхода у двух движков
           одна. У строки голова — одна кодовая точка, хвост — остаток. */
        bind(pattern.tail, `Value.ChainTail(${subject})`, `хвост «${pattern.tail}»`)
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
        bind(name, `Flang.VariantField(ctx, ${subject}, ${csstring(field)})`, `поле «${field}»`)
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
     только потом начальное значение. Коллекция материализуется безусловно: у
     неё тип Value[], а не Value, и общий механизм переноса влево, который умеет
     только Value, испортил бы объявление временного. */
  const list = materialize(
    `Flang.RequireList(ctx, ${emitValue(node.over, ctx, out, pad)}, "свёртка")`,
    ctx, out, pad, "Value[]",
  )
  const init = emitValue(node.init, ctx, out, pad)
  const accIdent = ctx.fresh(node.acc)
  out.push(`${pad}// «${node.acc}»`, `${pad}Value ${accIdent} = ${init};`)
  const itemIdent = ctx.fresh(node.item)
  out.push(`${pad}foreach (Value ${itemIdent} in ${list})`, `${pad}{`)

  const undoAcc = ctx.bind(node.acc, accIdent)
  const undoItem = ctx.bind(node.item, itemIdent)
  assignInto(node.body, ctx, out, `${pad}    `, accIdent)
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
    `Flang.RequireList(ctx, ${over}, ${csstring(label)})`, ctx, out, pad, "Value[]",
  )
  const items = ctx.temp()
  const itemIdent = ctx.fresh(node.item)
  out.push(
    `${pad}List<Value> ${items} = new List<Value>(${list}.Length);`,
    `${pad}foreach (Value ${itemIdent} in ${list})`,
    `${pad}{`,
  )
  const inner = `${pad}    `

  const undo = ctx.bind(node.item, itemIdent)
  if (node.kind === "map") {
    const value = emitValue(node.body, ctx, out, inner)
    out.push(`${inner}${items}.Add(${value});`)
  } else {
    /* Тело фильтра — предикат: для отброшенных элементов ничего больше не
       вычисляется. */
    const flag = emitValue(node.body, ctx, out, inner)
    out.push(
      `${inner}if (Flang.Keep(ctx, ${flag}))`,
      `${inner}{`,
      `${inner}    ${items}.Add(${itemIdent});`,
      `${inner}}`,
    )
  }
  ctx.unbind(node.item, undo)
  out.push(`${pad}}`)
  return `Value.List(${items}.ToArray())`
}

/* ── вызов по имени: ДВЕРЬ программы ── */

/**
 * Вызов по имени — это не вызов внутри программы, а ГРАНИЦА, и здесь стоит всё,
 * что граница обязана проверить.
 *
 * Внутренние вызовы идут прямо на функцию; сюда заходит только тот, у кого имя
 * функции — строка, то есть прогонщик, служба, тест, скрипт. Ровно так же
 * устроен интерпретатор: `callFunction` (src/interpret.mjs) — дверь и
 * проверяет, `applyFunction` — нет.
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
 * (`Flang.CheckEntry`, зовёт прогонщик до `Call`), и только потом договор.
 * Предусловие о значении вне типа не значит ничего.
 */

function renderDispatch(shared) {
  const lines = [
    ...csdoc([
      "Вызов функции по её исходному имени flang.",
      "",
      "Нужен прогонщику и всякому, кто связывает программу с внешним миром",
      "динамически (скрипт, тест, служба). Коды и тексты — те же, что у",
      "интерпретатора: «не найдена функция …» и «функция … принимает N аргум.».",
    ], "    "),
    "    public static Value Call(Ctx ctx, string name, Value[] args)",
    "    {",
  ]
  for (const fn of shared.prepared.functions.values()) {
    const arity = fn.params.length
    const pass = Array.from({ length: arity }, (_, index) => `args[${index}]`)
    lines.push(
      `        if (name == ${csstring(fn.name)})`,
      "        {",
      `            if (args.Length != ${arity})`,
      "            {",
      "                throw Flang.Fail(",
      "                    FlangError.CodeType,",
      /* Склейка, а не форматирование: имя модели вправе содержать что угодно, и
         подстановка этого бы не пережила. */
      `                    ${csstring(`функция «${fn.name}» принимает ${arity} аргум., получено `)}`,
      "                        + args.Length.ToString(System.Globalization.CultureInfo.InvariantCulture));",
      "            }",
      ...renderPreconditions(fn, shared, "            "),
      `            return ${shared.functionIdents.get(fn.name)}(${["ctx", ...pass].join(", ")});`,
      "        }",
    )
  }
  lines.push(
    '        throw Flang.Fail(FlangError.CodeUnknownName, "не найдена функция «" + name + "»");',
    "    }",
  )
  return lines.join("\n")
}

/**
 * Договор функции на двери: `требует`.
 *
 * Программа без единого `требует` не получает отсюда ни строки — печать обязана
 * остаться побайтово прежней, иначе рухнула бы сверка с близнецом и с эталоном
 * на всём корпусе.
 *
 * Параметры связываются прямо с аргументами двери: своих имён у неё нет, а
 * копировать значения в локальные ради читаемости значило бы печатать строки,
 * которых вычисление не требует.
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
      `${pad}// требует «${property.name}»`,
      `${pad}if (!Flang.Pre(ctx, ${check}, ${csstring(property.name)}, ${csstring(fn.name)}))`,
      `${pad}{`,
      `${pad}    throw Flang.Fail(${csstring(property.code)}, ${csstring(message)});`,
      `${pad}}`,
    )
  }
  return out
}

/* ── граница входа: объявленные типы параметров данными ── */

const ВИДЫ_ТИПА_CS = new Map([
  ["число", "Flang.TypeNumber"],
  ["строка", "Flang.TypeText"],
  ["признак", "Flang.TypeFlag"],
  ["ничто", "Flang.TypeNull"],
  ["список", "Flang.TypeList"],
  ["запись", "Flang.TypeRecord"],
  ["сумма", "Flang.TypeSum"],
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
 * Сверяет таблицу `Flang.CheckEntry` — один и тот же текст для всех программ, а
 * строит её `таблицаВхода` из flang/src/types.mjs, то есть тот же файл, что
 * отвечает на этот вопрос для `flang run --args`.
 */
function renderEntry(таблица) {
  return [
    "    // Граница входа: объявленные типы параметров данными. Прогонщик сверяет",
    "    // по ним значения, пришедшие снаружи, ДО вызова (Flang.CheckEntry). Виды",
    "    // Flang.TypeUnknown (значение-функция, параметр полиморфизма, применение",
    "    // типа с аргументами) не сверяются — ровно как молчит о них проверка",
    "    // значений эталона.",
    "    private static readonly Flang.EntryTable EntryValue = new Flang.EntryTable(",
    "        new Flang.TypeSpec[]",
    "        {",
    ...таблица.типы.map((запись) =>
      `            new Flang.TypeSpec(${ВИДЫ_ТИПА_CS.get(запись.вид) ?? "Flang.TypeUnknown"}, ` +
      `${csstring(запись.имя)}, ${csstring(запись.владелец)}, ${запись.ничто}, ${запись.целое}, ` +
      `${запись.отрезок}, ${csnumber(запись.низ)}, ${csnumber(запись.верх)}, ${запись.элемент}, ` +
      `${запись.полеС}, ${запись.полей}, ${запись.вариантС}, ${запись.вариантов}),`),
    "        },",
    "        new Flang.TypeField[]",
    "        {",
    ...таблица.поля.map((поле) => `            new Flang.TypeField(${csstring(поле.имя)}, ${поле.тип}),`),
    "        },",
    "        new Flang.TypeVariant[]",
    "        {",
    ...таблица.варианты.map((вариант) =>
      `            new Flang.TypeVariant(${csstring(вариант.имя)}, ${вариант.полеС}, ${вариант.полей}),`),
    "        },",
    "        new Flang.EntryParam[]",
    "        {",
    ...таблица.параметры.map((параметр) =>
      `            new Flang.EntryParam(${csstring(параметр.функция)}, ` +
      `${csstring(параметр.параметр)}, ${параметр.тип}),`),
    "        });",
    "",
    "    /// <summary>Объявленные типы параметров: по ним сверяется вход извне.</summary>",
    "    public static Flang.EntryTable Entry()",
    "    {",
    "        return EntryValue;",
    "    }",
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
