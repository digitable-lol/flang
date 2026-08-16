/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
// emit/go.mjs — печать программы flang в Go.
//
// ── Зачем ──────────────────────────────────────────────────────────────────
// Печать в JS (emit/js.mjs) даёт модуль для Node и браузера, печать в C
// (emit/c.mjs) — переносимость до NetBSD и RISC-V. Go закрывает третью нишу,
// которой не закрывает ни один из двух: один статически слинкованный файл без
// рантайма снаружи, кросс-компиляция под любую платформу одной переменной
// окружения и сборщик мусора. Программа flang, напечатанная в Go, кладётся в
// контейнер как есть и работает там, где нет ни Node, ни libc.
//
// ── Что здесь принципиально иначе, чем в бэкендах C и JS ────────────────────
// Общее с C сохранено намеренно, чтобы два бэкенда читались как одна система:
// тот же обход AST, то же решение арности при печати, тот же протокол
// прогонщика, та же транслитерация имён через flang/src/naming.mjs, и
// коллизия после транслитерации — ошибка печати, а не тихое переименование.
//
// Расходится же Go с C ровно там, где расходятся сами языки.
//
// 1. СУММЫ ТИПОВ. В Go нет ни объединений, ни сумм. Выбор был между структурой
//    с тегом и интерфейсом с методом-маркером (по типу Go на каждый вариант).
//    Выбрана структура с тегом (`flangrt.Value`), и вот почему: интерфейс
//    читался бы приятнее ровно до первого требования SPEC — структурное
//    равенство любых двух значений, сообщение «разбор не покрывает значение
//    Лист(значение)», доступ к полю по имени, приём значения снаружи. Всё это
//    потребовало бы рефлексии, то есть второго, теневого представления рядом с
//    первым, а два представления одного значения — это два набора расхождений
//    с интерпретатором. Поэтому представление одно, а типизированный слой
//    поверх него печатается функциями-конструкторами: на каждый вариант суммы
//    и на каждую запись — своя функция с именованными параметрами.
//
// 2. ЧИСЛА. Все числа flang — IEEE-754 double, значит в Go везде float64, в том
//    числе там, где число выглядит целым. Печать числа обязана давать тот же
//    текст, что Number::toString («1», а не «1.0», «1e+21», а не
//    «1000000000000000000000»), поэтому в рантайме лежит NumberText — правила
//    ECMAScript дословно; strconv.FormatFloat с 'g' не годится, у него свои
//    пороги перехода к экспоненте.
//
// 3. СТРОКИ. Go итерирует строку по байтам, flang считает в кодовых точках.
//    Отсюда []rune в «длина», «символ» и «подстрока» — иначе «мир 🌍» оказался
//    бы длиной 8, а не 5.
//
// 4. ДЕЛЕНИЕ НА НОЛЬ. В Go деление float64 на ноль даёт ±Inf, а 0/0 — NaN, ровно
//    как в JS, — но только для переменных: деление константы на константный ноль
//    Go не компилирует вовсе. Поэтому арифметика идёт через функции рантайма, а
//    не печатается оператором на месте.
//
// 5. НЕИСПОЛЬЗОВАННОЕ ИМЯ. В C это предупреждение, в Go — ошибка компиляции.
//    Связанное, но не использованное имя — обычное дело в языке с образцами
//    («случай голова и хвост», а голова телу не нужна), поэтому такие имена
//    гасятся `_ = имя` тем же приёмом, каким это делают руками.
//
// 6. ПОРЯДОК ОБЪЯВЛЕНИЙ. В Go его нет: функции пакета видят друг друга
//    независимо от порядка. Предварительных объявлений, без которых в C не
//    обходится взаимная рекурсия, здесь не нужно.
//
// 7. РОЛЬ ВХОДИТ В ИМЯ — и в ключ, по которому имя занимается. Функция,
//    конструктор варианта и фабрика записи живут в Go в ОДНОМ пространстве
//    имён пакета, а перегрузки по сигнатуре в языке нет: два объявления с
//    одним идентификатором — это `redeclared in this block`, то есть пакет,
//    который не собирается. Совпадение же имени функции и имени варианта в
//    модели законно (HOF.md, решение 2) и не выдумано: дефункционализация
//    (src/defunc.mjs) СТРОИТ такую программу сама — тег функции «Чётное» она
//    объявляет вариантом «Чётное». Поэтому в идентификатор входит роль:
//    «вариант Х» → `VariantH`, «создать Х» → `SozdatH`, функция — просто `H`.
//
//    Одной приставки мало, и это стоило красного CI. Приставка — часть СТРОКИ,
//    которую получает именователь, а `createNamer` помнит выданное по этой
//    строке: пока роль в неё не входила, вариант «Чётное» и функция «Чётное»
//    приходили одной и той же строкой, именователь считал их одним объектом,
//    названным дважды, и молча выдавал один идентификатор на оба объявления.
//    Ровно так же — молча — совпадали фабрика записи «Точка» (строка «Создать
//    Точка») и функция, которую в модели ТАК И НАЗВАЛИ, «Создать Точка».
//    Поэтому имена занимаются не строкой, а ПАРОЙ (роль, имя модели):
//    createDeclarations ниже, тот же приём и те же тексты отказа, что у
//    бэкендов C#, Java, Python и Elixir. Столкновение после транслитерации
//    остаётся ошибкой печати с обоими именами — как и обещано выше, — а не
//    тихим переименованием и не молчанием до чужого компилятора.
//
// ── Два пакета, а не один ──────────────────────────────────────────────────
// Рантайм печатается в пакет `flangrt`, программа — в пакет `flang`. Причина
// не в эстетике: у пакета Go одно пространство имён на все объявления верхнего
// уровня, и вариант с именем «Лист» дал бы идентификатор `List`, уже занятый
// конструктором списка в рантайме. Разведение по пакетам снимает вопрос совсем,
// а заодно делает рантайм переиспользуемым: он одинаков для всех программ и
// печатается байт в байт.
//
// ── Главное требование: совпадение с interpret.mjs ─────────────────────────
// Сгенерированный код обязан давать то же значение и ту же ошибку (код И
// текст). Отсюда:
//
//   • строгий порядок вычисления слева направо: в Go выражение не может
//     «упасть», поэтому каждый узел, способный дать ошибку, материализуется в
//     оператор — порядок операторов и есть порядок вычисления;
//   • проценты печатаются как `(процент / 100) * значение`;
//   • равенство скаляров — Object.is (NaN равен NaN, 0 не равен −0), никакого
//     сравнения с допуском: «0.1 плюс 0.2 равно 0.3» обязано быть ложью в обоих
//     движках.
//
// ── Хвостовая рекурсия: те же три случая, что в emit/js.mjs и emit/c.mjs ────
//   • хвостовой самовызов → `for { … }` с переприсваиванием параметров;
//   • взаимная хвостовая рекурсия (компонента сильной связности из двух и
//     более функций) → батут через значения функций;
//   • функция с постусловиями хвостовых вызовов не получает — интерпретатор
//     тоже не переиспользует кадр, которому есть что проверить после возврата.
//
// ── Пределы: и глубина, и шаги ─────────────────────────────────────────────
// В отличие от бэкенда C здесь воспроизведён не только предел глубины, но и
// лимит шагов: обычная (не тотальная) функция flang может не завершаться, и
// напечатанная программа обязана сказать FLANG_RECURSION_LIMIT, а не крутиться
// вечно. Шаг здесь — вход в функцию, виток цикла хвостового самовызова и отскок
// батута; шаг интерпретатора — итерация его машины, а их на одно применение
// функции приходится много. Значит счётчик здесь всегда МЕНЬШЕ, и при одинаковом
// пределе интерпретатор упирается в лимит первым. Расхождение одностороннее и
// безопасное: напечатанный код не объявит исчерпанным то, что интерпретатор
// досчитал до конца.

import { readFileSync } from "node:fs"

import { canonicalBuiltinName, flangError, hasBuiltin, помощникФормы } from "../builtins.mjs"
import { требуетПланировщика } from "../conc.mjs"
import { defunctionalize } from "../defunc.mjs"
import { таблицаВхода } from "../types.mjs"
import { BIDI_CONTROLS, escapeBidiInFiles, escapeBidiUnicode4 } from "../bidi.mjs"
import { camel, createNamer, pascal, snake } from "../naming.mjs"

/* ═══════════════════════════════════════════════════════════════════════════
   Рантайм.

   Он лежит рядом настоящими .go, а не строкой в этом файле: так его проверяет
   компилятор и gofmt прямо в репозитории, а не только через тест печати, и
   правка рантайма не превращается в правку экранирования внутри шаблона.
   Печатается он байт в байт — только с шапкой «сгенерировано» перед пакетом.
   ═══════════════════════════════════════════════════════════════════════════ */

const RUNTIME_DIRECTORY = new URL("./go/", import.meta.url)
const RUNTIME_SOURCE = readFileSync(new URL("flang_runtime.go", RUNTIME_DIRECTORY), "utf8")
const CLI_SOURCE = readFileSync(new URL("flang_cli.go", RUNTIME_DIRECTORY), "utf8")

/* Путь модуля Go зафиксирован: прогонщик импортирует пакеты по нему, и
   параметризовать его значило бы переписывать чужой файл при печати. Программе
   это ничего не стоит — модуль всё равно самодостаточен и ни от чего не
   зависит, а вложить его в свой проект можно одной строкой `replace`. */
const GO_MODULE = "flangprogram"
const RUNTIME_PACKAGE = "flangrt"
const PROGRAM_PACKAGE = "flang"

/** Канонические имена встроенных форм → функции рантайма. */
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
  ["остаток от", "BRemainder"],
  ["процентов от", "BPercentOf"],
])

/**
 * Суффикс имени помощника БЕЗ сторожа частичности (`помощникФормы`).
 *
 * Печать здесь ничего не доказывает: отметку `доказана` кладёт передний край
 * (`bin/flang.mjs`, `markNonEmpty`) по выводу проверки типов, а копия печати на
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
])

const BINARY_HELPERS = new Map([
  ["add", "Add"], ["sub", "Sub"], ["mul", "Mul"], ["div", "Div"], ["mod", "Mod"],
  ["percent", "Percent"], ["gt", "Gt"], ["lt", "Lt"], ["gte", "Gte"], ["lte", "Lte"],
  ["concat", "Concat"],
])

/* Ключевые слова и предобъявленные идентификаторы Go. Модельное имя, которое
   после транслитерации попадает сюда, обязано считаться коллизией, а не молча
   получить суффикс: createNamer об этом и скажет. Отдельно перечислены имена,
   которые печатает сам бэкенд (Call, NewContext) и импортированные псевдонимы. */
const GO_RESERVED = [
  "break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough",
  "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range",
  "return", "select", "struct", "switch", "type", "var",
  "any", "bool", "byte", "comparable", "complex64", "complex128", "error", "float32", "float64",
  "int", "int8", "int16", "int32", "int64", "rune", "string", "uint", "uint8", "uint16",
  "uint32", "uint64", "uintptr",
  "true", "false", "iota", "nil",
  "append", "cap", "clear", "close", "complex", "copy", "delete", "imag", "len", "make",
  "max", "min", "new", "panic", "print", "println", "real", "recover",
  "rt", "ctx", "args", "bounce", "err", "main", "init",
]

/* Имена, которые печатает сам бэкенд на верхнем уровне пакета программы. */
const EXPORTED_BY_BACKEND = ["Call", "NewContext"]

/* Роль в идентификаторе — см. пункт 7 шапки. Слова русские и проходят ту же
   транслитерацию, что имя модели: приставка обязана читаться так же, как всё
   остальное в напечатанном файле. У функции слова нет — идентификатор функции
   остаётся именем модели, как и был; роль её отличает то, что приставки нет ни
   у кого больше. */
const ROLE_WORD = {
  function: "",
  variant: "вариант",
  record: "создать",
}

const ROLE_LABEL = {
  function: "функции",
  variant: "конструктора варианта",
  record: "фабрики записи",
}

/* ═══════════════════════════ подготовка программы ═══════════════════════════ */

// Повторяет prepareProgram интерпретатора: те же проверки, те же коды и
// тексты. Разница только во времени срабатывания — при печати, а не при
// вычислении (ровно как в emit/js.mjs и emit/c.mjs).
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

/* ═══════════════════════════ литералы Go ═══════════════════════════ */

/**
 * Строковый литерал Go. Кириллица печатается как есть (исходник в UTF-8 — ровно
 * то, ради чего этот язык затевался: имена в коде обязаны читаться), а
 * экранируются кавычка, обратный слэш и управляющие символы.
 *
 * По символам, а не по байтам: файл записывается в UTF-8, и «Длина»,
 * разобранная на байты и собранная обратно как символы, превратилась бы в
 * двойную кодировку — имя перестало бы совпадать с именем в интерпретаторе.
 *
 * Двунаправленные управляющие (набор — bidi.mjs, общий на все бэкенды обоих
 * компиляторов) уезжают в `\uXXXX`: go vet за сырые не ругается, но набор общий
 * с C, Rust и Elixir, где это прямая ошибка сборки. Ровно четыре цифры, поэтому
 * цифра, стоящая в строке следом, к экранированию не приклеится; кодовая точка
 * и байты те же — меняется только запись.
 */
function gostring(value) {
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
 * Число как литерал Go.
 *
 * `String(value)` — кратчайшая запись, читающаяся обратно тем же double.
 * Константы Go имеют произвольную точность и округляются к float64 при
 * присваивании, поэтому запись доедет без потерь. Точка дописывается там, где
 * её нет: без неё `1` — нетипизированная целая константа, и хотя в аргумент
 * float64 она пройдёт, читателю сгенерированного кода незачем гадать, целое тут
 * или нет. Чисел flang, не представимых как float64, не бывает по определению.
 *
 * NaN и бесконечности приходят из math: записать их литералом в Go нельзя, а
 * `1.0/0.0` на константах — ошибка компиляции, а не Inf.
 */
function gonumber(value) {
  if (Number.isNaN(value)) return "math.NaN()"
  if (value === Infinity) return "math.Inf(1)"
  if (value === -Infinity) return "math.Inf(-1)"
  /* −0 как константа теряет знак: Go складывает `-0` в обычный ноль, а
     Object.is их различает. */
  if (Object.is(value, -0)) return "math.Copysign(0, -1)"
  const text = String(value)
  return /[.e]/u.test(text) ? text : `${text}.0`
}

function needsMath(value) {
  return typeof value === "number" && (!Number.isFinite(value) || Object.is(value, -0))
}

/** Идентификатор Go не может начинаться с цифры и не может быть пустым. */
function safeIdent(identifier) {
  if (identifier.length === 0) return "v"
  return /^[0-9]/u.test(identifier) ? `v${identifier}` : identifier
}

/**
 * Именователь верхнего уровня пакета: роль плюс транслитерация имени модели.
 *
 * Занимается идентификатор ПАРОЙ (роль, имя модели), а не строкой, из которой
 * он сложен. Разница не косметическая, и цена ей — пункт 7 шапки: `createNamer`
 * помнит выданное по строке, поэтому вариант «Чётное» и функция «Чётное»
 * (строка у них одна) считались одним объектом, названным дважды, и получали
 * один идентификатор на два объявления — молча, до `go vet` в чужой джобе.
 * Здесь такая пара — разные объекты, и одинаковый идентификатор у них ошибка.
 *
 * Столкнуться после этого могут только имена, которые ДЕЙСТВИТЕЛЬНО неразличимы
 * после транслитерации, — «Счёт» и «Счет», «вариант Х» из роли и функция,
 * названная в модели «Вариант Х». Это ошибка печати с обоими именами, а не
 * молчаливое переименование: сгенерированный код читают рядом с моделью, и два
 * разных имени модели обязаны остаться различимыми (см. шапку naming.mjs).
 *
 * Шаги батута идут мимо — через свой именователь, camelCase’ом: в Go регистр
 * первой буквы это не стиль, а видимость, и печатать шаг Pascal’ем значило бы
 * его экспортировать. Правка их не касается: шаг занимает имя один раз, роль у
 * него одна, и столкнуться он мог бы только с другим шагом — а это разные
 * функции, то есть разные имена, и об этом createNamer скажет.
 */
function createDeclarations(reserved) {
  const taken = new Map(reserved.map((word) => [word, { role: null, name: word }]))
  return {
    claim(role, name) {
      const word = ROLE_WORD[role]
      const identifier = safeIdent(pascal(word === "" ? name : `${word} ${name}`))
      const previous = taken.get(identifier)
      if (previous !== undefined && !(previous.role === role && previous.name === name)) {
        const owner =
          previous.role === null
            ? `зарезервировано в Go: ${previous.name}`
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
 * Печать программы flang в Go.
 *
 * @param {object} program AST flang (SPEC.md, раздел 5)
 * @param {{ path?: string, indexBase?: 0 | 1, maxDepth?: number, maxSteps?: number, cli?: boolean }} [options]
 * @returns {{ files: Array<{ path: string, content: string }> }}
 */
export function emitGo(program, options = {}) {
  /* Печать в цель без планировщика конкурентности невозможна, и молчать об этом
     нельзя: до этого отказа шесть целей из восьми ТЕРЯЛИ процессы, печатали
     обработчики обычными функциями и кончались кодом 0. Отказ стоит первым — до
     всякой работы, потому что печатать нечего вовсе (см. `conc.mjs`,
     `требуетПланировщика`). */
  требуетПланировщика(program, "go")
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
  const file = options.path ?? (moduleName === null ? "program" : snake(moduleName))

  /* Одно пространство имён на пакет, поэтому один именователь на всё, что
     торчит наружу: функции, фабрики записей, конструкторы вариантов. Имена,
     которые печатает сам бэкенд, занимаются первыми. Занимается идентификатор
     ПАРОЙ (роль, имя модели) — почему парой, а не строкой, см. пункт 7 шапки
     и createDeclarations. */
  const declarations = createDeclarations([...GO_RESERVED, ...EXPORTED_BY_BACKEND])

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

  /* Шаг батута не экспортируется, но живёт в том же пространстве имён. */
  const stepIdents = new Map()
  const unexported = createNamer((name) => safeIdent(camel(name)), GO_RESERVED)
  for (const name of cyclic.keys()) stepIdents.set(name, unexported(`Шаг ${name}`))

  /* Имена параметров считаются один раз: их видят и сигнатура, и тело, и шаг
     батута — разойтись им нельзя. */
  const paramIdents = new Map()
  for (const [name, fn] of prepared.functions) {
    paramIdents.set(name, uniqueIdents(fn.params.map((param) => param.name)))
  }

  const shared = {
    prepared,
    paramIdents,
    functionIdents,
    factoryIdents,
    variantIdents,
    stepIdents,
    tailEdges,
    cyclic,
    recursive,
    needsMath: false,
    counter: 0,
  }

  const bodies = []
  for (const [name, type] of prepared.records) bodies.push(renderFactory(name, type, shared))
  for (const sum of prepared.sums) {
    for (const item of sum.variants ?? []) {
      if (variantIdents.has(item.name)) bodies.push(renderVariantFactory(sum, item, shared))
    }
  }
  for (const fn of prepared.functions.values()) bodies.push(renderFunction(fn, shared))
  bodies.push(renderDispatch(shared))
  bodies.push(renderEntry(входные))

  const settings = renderContext(base, maxDepth, maxSteps)

  const files = [
    { path: "go.mod", content: renderGoMod() },
    {
      path: `${RUNTIME_PACKAGE}/flang_runtime.go`,
      content: `${banner(moduleName, "рантайм: значения, числа, строки, диагностики")}\n\n${RUNTIME_SOURCE}`,
    },
    {
      path: `${PROGRAM_PACKAGE}/${file}.go`,
      content: renderSource(moduleName, shared, [settings, ...bodies]),
    },
  ]

  if (options.cli !== false) {
    files.push({
      path: `cli/main.go`,
      content: `${banner(moduleName, "прогонщик: JSON на входе, JSON на выходе")}\n\n${CLI_SOURCE}`,
    })
  }
  files.push({ path: "Makefile", content: renderMakefile(options.cli !== false) })
  /* Последний шаг — снять сырые двунаправленные управляющие со всего вывода
     (bidi.mjs). Литерал их уже экранировал сам, но имя FTS уезжает ещё и в
     комментарии — в шапку файла и в строку «Ident — функция flang «…»», — а
     комментарий читают первым и проверить исполнением не могут. go vet о таком
     не предупреждает: молчание тулчейна здесь и есть беда, а не оправдание.
     Форма Go — `\uXXXX`, та же, что в литерале. */
  return { files: escapeBidiInFiles(files, escapeBidiUnicode4) }
}

function banner(moduleName, what) {
  return [
    "// Сгенерировано flang (бэкенд Go, flang/src/emit/go.mjs). Не редактировать руками.",
    moduleName === null ? "// Программа flang без имени модуля." : `// Модуль flang: «${moduleName}».`,
    `// Файл: ${what}.`,
    "// Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.",
  ].join("\n")
}

function renderGoMod() {
  return [
    `module ${GO_MODULE}`,
    "",
    "go 1.21",
    "",
  ].join("\n")
}

function renderMakefile(cli) {
  return [
    "# Сгенерировано flang (бэкенд Go). Флаги здесь — часть контракта бэкенда:",
    "# напечатанный код обязан проходить go vet и gofmt без единого замечания.",
    "GO ?= go",
    "",
    `all:${cli ? " flang_cli" : " build"}`,
    "",
    "build:",
    "\t$(GO) build ./...",
    ...(cli ? ["", "flang_cli:", "\t$(GO) build -o flang_cli ./cli"] : []),
    "",
    "vet:",
    "\t$(GO) vet ./...",
    "",
    "fmt:",
    "\tgofmt -l .",
    "",
    "clean:",
    "\trm -f flang_cli",
    "",
    ".PHONY: all build vet fmt clean",
    "",
  ].join("\n")
}

/* ── файл программы ── */

function renderSource(moduleName, shared, bodies) {
  const head = [
    banner(moduleName, "реализация: функции, конструкторы значений, вызов по имени"),
    "",
    "// Контракт вызова: функция возвращает значение и nil либо нулевое значение",
    "// и ошибку *flangrt.Error с кодом и текстом, дословно совпадающими с",
    "// интерпретатором flang. Паник здесь нет: диагностика — это значение.",
    `package ${PROGRAM_PACKAGE}`,
    "",
    "import (",
  ]
  /* Порядок импортов — по пути, а не по псевдониму: так их сортирует gofmt, а
     напечатанный код обязан проходить `gofmt -l` без единой правки.
     «flangprogram/flangrt» < «math» при любом раскладе, потому что путь модуля
     здесь зафиксирован. */
  head.push(`\trt "${GO_MODULE}/${RUNTIME_PACKAGE}"`)
  if (shared.needsMath) head.push('\t"math"')
  head.push(")")
  return [head.join("\n"), ...bodies.filter((body) => body.length > 0)].join("\n\n") + "\n"
}

function renderContext(base, maxDepth, maxSteps) {
  return [
    "// NewContext — контекст вычисления с настройками этой программы.",
    "//",
    "// Индексация строк, предел глубины вызовов и лимит шагов — это настройки",
    "// программы, а не рантайма: печать могла идти с нулевой базой индексации,",
    "// а пределы вызывающий вправе поменять прямо в возвращённом контексте.",
    "func NewContext() *rt.Ctx {",
    "\tctx := rt.NewCtx()",
    `\tctx.IndexBase = ${base}`,
    `\tctx.MaxDepth = ${maxDepth}`,
    `\tctx.MaxSteps = ${maxSteps}`,
    "\treturn ctx",
    "}",
  ].join("\n")
}

function describeFunction(fn, shared) {
  const ident = shared.functionIdents.get(fn.name)
  const lines = [`// ${ident} — функция flang «${fn.name}».`, "//"]
  lines.push(
    fn.total
      ? "// Тотальная: завершение доказано анализом завершаемости (totality.mjs)."
      : "// Обычная (не тотальная): завершение не доказано, зацикливание ловится лимитом шагов.",
  )
  if (shared.tailEdges.get(fn.name)?.has(fn.name) === true && fn.postconditions.length === 0) {
    lines.push("//", "// Хвостовой самовызов развёрнут в цикл: стек не растёт.")
  }
  const members = shared.cyclic.get(fn.name)
  if (members !== undefined) {
    const others = [...members].filter((name) => name !== fn.name).map((name) => `«${name}»`).join(", ")
    lines.push("//", `// Взаимная хвостовая рекурсия с ${others}: вызовы идут через батут.`)
  }
  if (shared.recursive.has(fn.name)) {
    lines.push("//", "// Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.")
  }
  const idents = shared.paramIdents.get(fn.name)
  lines.push("//")
  fn.params.forEach((param, index) => {
    lines.push(`// Параметр ${idents[index]} — «${param.name}»${typeNote(param.type)}.`)
  })
  lines.push(`// Результат — значение${typeNote(fn.returns)}.`)
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
 * Идентификаторы Go для набора имён модели: транслитерация плюс развод
 * столкновений. Столкнуться могут и «цена» с «Цена», и поле, чьё имя после
 * транслитерации совпало с ключевым словом Go.
 */
function uniqueIdents(names) {
  const taken = new Set(GO_RESERVED)
  return names.map((name) => {
    const wanted = safeIdent(camel(name))
    let candidate = wanted
    let suffix = 1
    while (taken.has(candidate)) {
      suffix += 1
      candidate = `${wanted}${suffix}`
    }
    taken.add(candidate)
    return candidate
  })
}

function declareFactory(name, type, shared) {
  const fields = Array.isArray(type.fields) ? type.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name))
  const params = idents.map((ident) => `${ident} rt.Value`).join(", ")
  return `func ${shared.factoryIdents.get(name)}(${params}) rt.Value`
}

function declareVariantFactory(item, shared) {
  const fields = Array.isArray(item.fields) ? item.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name))
  const params = idents.map((ident) => `${ident} rt.Value`).join(", ")
  return `func ${shared.variantIdents.get(item.name)}(${params}) rt.Value`
}

function declareFunction(fn, shared) {
  const idents = shared.paramIdents.get(fn.name)
  const params = ["ctx *rt.Ctx", ...idents.map((ident) => `${ident} rt.Value`)].join(", ")
  return `func ${shared.functionIdents.get(fn.name)}(${params}) (rt.Value, error)`
}

/* ── фабрики записей и вариантов ── */

function renderFactory(name, type, shared) {
  const fields = Array.isArray(type.fields) ? type.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name))
  const lines = [
    `// ${shared.factoryIdents.get(name)} — запись FTS «${name}»: ${
      fields.map((field) => `«${field.name}»`).join(", ") || "без полей"
    }.`,
    "//",
    "// Запись flang тотальна: пропущенное поле — это «ничто», а не дырка.",
    `${declareFactory(name, type, shared)} {`,
  ]
  if (fields.length === 0) {
    lines.push("\treturn rt.Record(nil)")
  } else {
    lines.push("\treturn rt.Record([]rt.Field{")
    fields.forEach((field, index) => {
      lines.push(`\t\t{Name: ${gostring(field.name)}, Value: ${idents[index]}},`)
    })
    lines.push("\t})")
  }
  lines.push("}")
  return lines.join("\n")
}

function renderVariantFactory(sum, item, shared) {
  const fields = Array.isArray(item.fields) ? item.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name))
  const lines = [
    `// ${shared.variantIdents.get(item.name)} — вариант «${item.name}» суммы типов «${sum.name}».`,
    "//",
    "// Дискриминант — имя варианта; проверяется через rt.VariantIs(значение, «Имя»).",
    "// Приставка Variant в имени — это роль: функция flang с тем же именем даёт",
    "// идентификатор без приставки, и одно объявление не спорит с другим.",
    `${declareVariantFactory(item, shared)} {`,
  ]
  if (fields.length === 0) {
    lines.push(`\treturn rt.Variant(${gostring(item.name)}, nil)`)
  } else {
    lines.push(`\treturn rt.Variant(${gostring(item.name)}, []rt.Field{`)
    fields.forEach((field, index) => {
      lines.push(`\t\t{Name: ${gostring(field.name)}, Value: ${idents[index]}},`)
    })
    lines.push("\t})")
  }
  lines.push("}")
  return lines.join("\n")
}

/* ═══════════════════════════ печать функции ═══════════════════════════ */

function renderFunction(fn, shared) {
  const members = shared.cyclic.get(fn.name) ?? null
  const selfTail = shared.tailEdges.get(fn.name)?.has(fn.name) === true
  const guard = shared.recursive.has(fn.name)

  const ctx = createContext(fn, shared, { selfTail, members })
  const body = []
  const pad = "\t"

  if (fn.postconditions.length > 0) {
    /* Постусловия проверяются после тела: результат уже вычислен, и первое же
       нарушение прерывает вычисление — как в интерпретаторе. */
    const value = emitValue(fn.body, ctx, body, pad)
    const resultIdent = ctx.temp()
    body.push(`${pad}${resultIdent} := ${value}`)
    for (const property of fn.postconditions) {
      const previous = ctx.bind(property.bind, resultIdent)
      const check = emitValue(property.expr, ctx, body, pad)
      ctx.unbind(property.bind, previous)
      const holds = ctx.temp()
      const error = ctx.fault()
      const message = property.message ?? `нарушено свойство «${property.name}» функции «${fn.name}»`
      body.push(
        `${pad}// постусловие «${property.name}»`,
        `${pad}${holds}, ${error} := rt.Post(ctx, ${check}, ${gostring(property.name)}, ${gostring(fn.name)})`,
        `${pad}if ${error} != nil {`,
        `${pad}\treturn rt.Value{}, ${error}`,
        `${pad}}`,
        `${pad}if !${holds} {`,
        `${pad}\treturn rt.Value{}, rt.Fail(${gostring(property.code)}, "%s", ${gostring(message)})`,
        `${pad}}`,
      )
    }
    body.push(`${pad}return ${resultIdent}, nil`)
  } else if (selfTail) {
    body.push(`${pad}for {`)
    emitTail(fn.body, ctx, body, `${pad}\t`)
    body.push(`${pad}}`)
  } else {
    emitTail(fn.body, ctx, body, pad)
  }

  const text = body.join("\n")
  const documentation = describeFunction(fn, shared)

  if (members !== null) {
    /* Батут: наружу торчит обычная функция, внутри — шаг, возвращающий отскок. */
    const step = shared.stepIdents.get(fn.name)
    const unpack = ctx.params.map((param, index) => [
      `\t// «${fn.params[index].name}»`,
      `\t${param} := args[${index}]`,
    ]).flat()
    const unused = ctx.params
      .filter((param) => !new RegExp(`\\b${param}\\b`, "u").test(text))
      .map((param) => `\t_ = ${param}`)
    const stepBlock = [
      `// ${step} — шаг батута для «${fn.name}»: значение либо отскок к соседу по рекурсии.`,
      `${stepSignature(step)} {`,
      ...unpack,
      ...unused,
      text,
      "}",
    ].join("\n")

    const argList = ctx.params.length === 0 ? "nil" : `[]rt.Value{${ctx.params.join(", ")}}`
    const outer = [
      ...documentation,
      `${declareFunction(fn, shared)} {`,
      `\tif err := ctx.Enter(${gostring(fn.name)}); err != nil {`,
      "\t\treturn rt.Value{}, err",
      "\t}",
      "\tdefer ctx.Leave()",
      `\treturn rt.Trampoline(ctx, ${step}, ${argList}, ${gostring(fn.name)})`,
      "}",
    ].join("\n")
    return `${stepBlock}\n\n${outer}`
  }

  const head = [...documentation, `${declareFunction(fn, shared)} {`]
  if (guard) {
    /* Счётчик глубины обязан уменьшаться и на ошибке — в Go для этого есть
       defer, и отдельная внутренняя функция, без которой не обходится C, здесь
       не нужна. */
    head.push(
      `\tif err := ctx.Enter(${gostring(fn.name)}); err != nil {`,
      "\t\treturn rt.Value{}, err",
      "\t}",
      "\tdefer ctx.Leave()",
    )
  }
  return [...head, text, "}"].join("\n")
}

/** Сигнатура шага батута. */
function stepSignature(step) {
  return `func ${step}(ctx *rt.Ctx, args []rt.Value, bounce *rt.Bounce) (rt.Value, error)`
}

function createContext(fn, shared, { selfTail, members }) {
  const ctx = {
    shared,
    fn,
    scope: new Map(),
    taken: new Set(GO_RESERVED),
    params: [],
    selfTail,
    members,
    temp() {
      shared.counter += 1
      return `t${shared.counter}`
    },
    /* Имя переменной ошибки — своё на каждый вызов: `:=` тогда никогда не
       переобъявляет и никогда не затеняет, в каком бы вложенном блоке вызов ни
       оказался, а `e17` рядом с `t16` читается как ошибка, а не как значение. */
    fault() {
      shared.counter += 1
      return `e${shared.counter}`
    },
    fresh(name) {
      /* Имя модели вроде «т16» после транслитерации даёт «t16» — ровно то, чем
         зовутся временные. Приставка разводит их навсегда. */
      const transliterated = safeIdent(camel(name))
      const wanted = /^[te][0-9]+$/u.test(transliterated) ? `v${transliterated}` : transliterated
      let candidate = wanted
      let suffix = 1
      while (ctx.taken.has(candidate)) {
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

/* ── хвостовая позиция: здесь живут `return …, nil`, `continue` и отскоки ── */

function emitTail(expr, ctx, out, pad) {
  const node = requireExpr(expr)
  switch (node.kind) {
    case "let": {
      const value = emitValue(node.value, ctx, out, pad)
      requireName(node.name, "let", "name", node.span)
      const ident = ctx.fresh(node.name)
      out.push(`${pad}// пусть «${node.name}»`, `${pad}${ident} := ${value}`)
      const at = out.length
      const previous = ctx.bind(node.name, ident)
      emitTail(node.in ?? node.body, ctx, out, pad)
      ctx.unbind(node.name, previous)
      guardUnused(out, at, [ident], pad)
      return
    }
    case "if": {
      const flag = emitCondition(node.cond, ctx, out, pad, "Cond")
      out.push(`${pad}if ${flag} {`)
      emitTail(node.then, ctx, out, `${pad}\t`)
      out.push(`${pad}} else {`)
      emitTail(node.else, ctx, out, `${pad}\t`)
      out.push(`${pad}}`)
      return
    }
    case "match":
      emitMatch(node, ctx, out, pad, null)
      return
    case "call": {
      const callee = resolveCall(node, ctx)
      const args = (node.args ?? []).map((argument) => emitValue(argument, ctx, out, pad))
      if (ctx.selfTail && node.name === ctx.fn.name) {
        /* Самовызов в хвосте — это цикл. Присваивание параметров идёт по
           очереди, поэтому аргумент, который ещё читает старое значение
           параметра, обязан сперва лечь во временное. */
        const temps = args.map((argument) => {
          if (/^[A-Za-z_][\w]*$/u.test(argument) && !ctx.params.includes(argument)) return argument
          const temp = ctx.temp()
          out.push(`${pad}${temp} := ${argument}`)
          return temp
        })
        ctx.params.forEach((param, index) => {
          out.push(`${pad}${param} = ${temps[index]}`)
        })
        const error = ctx.fault()
        out.push(
          `${pad}// виток цикла — тоже шаг вычисления: незавершающийся хвостовой`,
          `${pad}// самовызов обязан упереться в лимит, а не крутиться вечно`,
          `${pad}if ${error} := ctx.Step(${gostring(ctx.fn.name)}); ${error} != nil {`,
          `${pad}\treturn rt.Value{}, ${error}`,
          `${pad}}`,
          `${pad}continue`,
        )
        return
      }
      if (ctx.members !== null && ctx.members.has(node.name)) {
        out.push(`${pad}// хвостовой вызов «${node.name}» — отскок, а не кадр стека`)
        out.push(
          args.length === 0
            ? `${pad}bounce.Args = nil`
            : `${pad}bounce.Args = []rt.Value{${args.join(", ")}}`,
        )
        out.push(`${pad}bounce.Next = ${ctx.shared.stepIdents.get(node.name)}`, `${pad}return rt.Value{}, nil`)
        return
      }
      out.push(`${pad}return ${ctx.shared.functionIdents.get(callee.name)}(${["ctx", ...args].join(", ")})`)
      return
    }
    default: {
      const value = emitValue(node, ctx, out, pad)
      out.push(`${pad}return ${value}, nil`)
    }
  }
}

/* ── значение: возвращает выражение Go, попутно печатая нужные ему операторы ── */

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
      return call(ctx, out, pad, `rt.FieldGet(ctx, ${target}, ${gostring(node.field)})`)
    }
    case "let": {
      const value = emitValue(node.value, ctx, out, pad)
      requireName(node.name, "let", "name", node.span)
      const ident = ctx.fresh(node.name)
      out.push(`${pad}// пусть «${node.name}»`, `${pad}${ident} := ${value}`)
      const at = out.length
      const previous = ctx.bind(node.name, ident)
      const body = emitValue(node.in ?? node.body, ctx, out, pad)
      ctx.unbind(node.name, previous)
      guardUnused(out, at, [ident], pad)
      return body
    }
    case "if": {
      const flag = emitCondition(node.cond, ctx, out, pad, "Cond")
      const temp = ctx.temp()
      out.push(`${pad}var ${temp} rt.Value`, `${pad}if ${flag} {`)
      assignInto(node.then, ctx, out, `${pad}\t`, temp)
      out.push(`${pad}} else {`)
      assignInto(node.else, ctx, out, `${pad}\t`, temp)
      out.push(`${pad}}`)
      return temp
    }
    case "match": {
      const temp = ctx.temp()
      out.push(`${pad}var ${temp} rt.Value`)
      emitMatch(node, ctx, out, pad, temp)
      return temp
    }
    case "call": {
      const callee = resolveCall(node, ctx)
      const args = (node.args ?? []).map((argument) => emitValue(argument, ctx, out, pad))
      const ident = ctx.shared.functionIdents.get(callee.name)
      return call(ctx, out, pad, `${ident}(${["ctx", ...args].join(", ")})`)
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
      const rendered = args.map((argument) => emitValue(argument, ctx, out, pad))
      out.push(`${pad}// «${canonical}»`)
      return call(ctx, out, pad, `rt.${помощникФормы(canonical, node, BUILTIN_HELPERS, СУФФИКС_ДОКАЗАННОГО)}(${["ctx", ...rendered].join(", ")})`)
    }
    case "binary": {
      const left = emitValue(node.left, ctx, out, pad)
      const right = emitValue(node.right, ctx, out, pad)
      if (node.op === "eq" || node.op === "neq") {
        /* Равенство ошибок не даёт: сравнимо всё со всем (SPEC, раздел 5). */
        return node.op === "eq"
          ? `rt.Flag(rt.Equal(${left}, ${right}))`
          : `rt.Flag(!rt.Equal(${left}, ${right}))`
      }
      const helper = BINARY_HELPERS.get(node.op)
      if (helper === undefined) {
        throw flangError("FLANG_TYPE", `неизвестная операция «${node.op}»`, node.span)
      }
      return call(ctx, out, pad, `rt.${helper}(ctx, ${left}, ${right})`)
    }
    case "list": {
      const items = node.items ?? []
      if (!Array.isArray(items)) {
        throw flangError("FLANG_PARSE", "аргументы выражения должны быть списком", node.span)
      }
      return emitList(items.map((item) => (out2, pad2) => emitValue(item, ctx, out2, pad2)), ctx, out, pad)
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
 * Вызов, способный дать ошибку: результат во временное, ранний возврат при
 * ошибке. Имя ошибки каждый раз своё — так `:=` никогда не переобъявляет и
 * никогда не затеняет, в каком бы вложенном блоке вызов ни оказался.
 */
function call(ctx, out, pad, expression) {
  const temp = ctx.temp()
  const error = ctx.fault()
  out.push(
    `${pad}${temp}, ${error} := ${expression}`,
    `${pad}if ${error} != nil {`,
    `${pad}\treturn rt.Value{}, ${error}`,
    `${pad}}`,
  )
  return temp
}

/**
 * Связанное, но не использованное имя — обычное дело в языке с образцами
 * («случай голова и хвост», а голова телу не нужна). В Go это не
 * предупреждение, а ошибка компиляции. Молча не объявлять такую переменную
 * нельзя: привязка обязана вычислиться (у варианта она может дать
 * FLANG_UNKNOWN_NAME). Поэтому объявляем всегда, а неиспользованные гасим
 * `_ = имя` — тем же приёмом, каким это делают руками.
 */
function guardUnused(out, at, idents, pad) {
  if (idents.length === 0) return
  const text = out.slice(at).join("\n")
  const unused = idents.filter((ident) => !new RegExp(`\\b${ident}\\b`, "u").test(text))
  if (unused.length > 0) out.splice(at, 0, ...unused.map((ident) => `${pad}_ = ${ident}`))
}

/** Вычислить выражение и положить результат в уже объявленную переменную. */
function assignInto(expr, ctx, out, pad, target) {
  const value = emitValue(expr, ctx, out, pad)
  out.push(`${pad}${target} = ${value}`)
}

/** Признак из значения: `если` и `отфильтровать` требуют именно признак. */
function emitCondition(expr, ctx, out, pad, helper) {
  const value = emitValue(expr, ctx, out, pad)
  const flag = ctx.temp()
  const error = ctx.fault()
  out.push(
    `${pad}${flag}, ${error} := rt.${helper}(ctx, ${value})`,
    `${pad}if ${error} != nil {`,
    `${pad}\treturn rt.Value{}, ${error}`,
    `${pad}}`,
  )
  return flag
}

/* ── литералы ── */

function emitLiteral(value, ctx, out, pad) {
  if (value === undefined || value === null) return "rt.Nothing()"
  if (typeof value === "boolean") return `rt.Flag(${value ? "true" : "false"})`
  if (typeof value === "number") {
    if (needsMath(value)) ctx.shared.needsMath = true
    return `rt.Number(${gonumber(value)})`
  }
  if (typeof value === "string") return `rt.Text(${gostring(value)})`
  if (Array.isArray(value)) {
    return emitList(value.map((item) => (out2, pad2) => emitLiteral(item, ctx, out2, pad2)), ctx, out, pad)
  }
  if (typeof value === "object") {
    /* Вариант в JSON записан как { variant, fields }: классов JSON не знает, а
       значения ходят через JSON в трёх местах — значение примера в AST, --args
       и факты. Интерпретатор читает эту форму вариантом (builtins.mjs,
       encodedVariant), и печать обязана делать то же: без проверки литерал
       «ожидается вариант …» становился здесь записью, то есть та же программа
       считалась по-разному в Go и в интерпретаторе. Найдено сверкой бэкендов
       между собой — C, Rust, JS и Python эту форму узнают, Go не узнавал. */
    const encoded = encodedVariant(value)
    if (encoded !== null) {
      const keys = Object.keys(encoded.fields)
      const values = keys.map((key) => emitLiteral(encoded.fields[key], ctx, out, pad))
      return emitValues(keys, values, encoded.variant, ctx, out, pad)
    }
    const keys = Object.keys(value)
    const values = keys.map((key) => emitLiteral(value[key], ctx, out, pad))
    return emitValues(keys, values, null, ctx, out, pad)
  }
  throw flangError("FLANG_PARSE", `литерал недопустимого вида: ${typeof value}`)
}

/**
 * Узнаётся строго, как в builtins.mjs: объект ровно с двумя полями, «variant» —
 * непустая строка, «fields» — запись. Запись программы ровно с такими двумя
 * полями от варианта неотличима, и это цена одного представления вместо двух;
 * расхождение здесь означало бы, что литерал, написанный в примере, печатается
 * не тем, чем его прочитал интерпретатор.
 */
function encodedVariant(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null
  const keys = Object.keys(value)
  if (keys.length !== 2 || !keys.includes("variant") || !keys.includes("fields")) return null
  if (typeof value.variant !== "string" || value.variant === "") return null
  const fields = value.fields
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) return null
  return { variant: value.variant, fields }
}

/* ── составные значения ── */

function emitList(makers, ctx, out, pad) {
  if (makers.length === 0) return "rt.List(nil)"
  const items = ctx.temp()
  out.push(`${pad}${items} := make([]rt.Value, ${makers.length})`)
  makers.forEach((make, index) => {
    const value = make(out, pad)
    out.push(`${pad}${items}[${index}] = ${value}`)
  })
  return `rt.List(${items})`
}

function emitFields(fields, variantName, ctx, out, pad) {
  const keys = Object.keys(fields)
  const values = keys.map((key) => emitValue(fields[key], ctx, out, pad))
  return emitValues(keys, values, variantName, ctx, out, pad)
}

function emitValues(keys, values, variantName, ctx, out, pad) {
  if (keys.length === 0) {
    return variantName === null ? "rt.Record(nil)" : `rt.Variant(${gostring(variantName)}, nil)`
  }
  const array = ctx.temp()
  out.push(`${pad}${array} := make([]rt.Field, ${keys.length})`)
  keys.forEach((key, index) => {
    out.push(`${pad}${array}[${index}] = rt.Field{Name: ${gostring(key)}, Value: ${values[index]}}`)
  })
  return variantName === null
    ? `rt.Record(${array})`
    : `rt.Variant(${gostring(variantName)}, ${array})`
}

/* ── разбор ── */

// `target === null` — хвостовая позиция (тела ветвей печатают возврат), иначе
// результат каждой ветви кладётся в переданную переменную.
function emitMatch(node, ctx, out, pad, target) {
  const subject = emitValue(node.target, ctx, out, pad)
  const cases = node.cases ?? []
  if (!Array.isArray(cases)) {
    throw flangError("FLANG_PARSE", "случай разбора должен содержать «pattern» и «body»", node.span)
  }

  /* Литерал в образце может потребовать собственных операторов, поэтому все
     проверки готовятся до цепочки `if` — иначе оператор оказался бы внутри
     условия соседней ветви. */
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
      /* Образец, совпадающий всегда: `else` честнее, чем `if true`. */
      out.push(opened ? `${pad}} else {` : `${pad}{`)
      opened = true
      emitBranch(branch, subject, ctx, out, `${pad}\t`, target)
      out.push(`${pad}}`)
      closed = true
      break
    }
    out.push(opened ? `${pad}} else if ${test} {` : `${pad}if ${test} {`)
    opened = true
    emitBranch(branch, subject, ctx, out, `${pad}\t`, target)
  }
  if (closed) return
  if (opened) {
    out.push(`${pad}} else {`, `${pad}\treturn rt.Value{}, rt.MatchFail(ctx, ${subject})`, `${pad}}`)
  } else {
    out.push(`${pad}return rt.Value{}, rt.MatchFail(ctx, ${subject})`)
  }
}

function emitBranch(branch, subject, ctx, out, pad, target) {
  const undo = bindPattern(branch.pattern, subject, ctx, out, pad)
  const at = out.length
  if (target === null) emitTail(branch.body, ctx, out, pad)
  else assignInto(branch.body, ctx, out, pad, target)
  for (const step of undo) ctx.unbind(step.name, step.previous)
  guardUnused(out, at, undo.map((step) => step.ident), pad)
}

/** Проверка дискриминанта; `null` — образец совпадает всегда. */
function patternTest(pattern, subject, ctx, out, pad, span) {
  switch (pattern.kind) {
    /* Цепочка — список либо строка: `пусто` и `голова и хвост` разбирают обе.
       Различать их здесь нечем — у печати нет типов, — да и незачем: проверка
       вида стоит одну ветку. */
    case "empty":
      return `rt.ChainEmpty(${subject})`
    case "cons":
      return `rt.ChainCons(${subject})`
    case "variant":
      return `rt.VariantIs(${subject}, ${gostring(pattern.name)})`
    case "literal": {
      const literal = emitLiteral(pattern.value, ctx, out, pad)
      return `rt.Equal(${subject}, ${literal})`
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
    out.push(`${pad}${ident} := ${code}`)
    undo.push({ name, ident, previous: ctx.bind(name, ident) })
  }
  switch (pattern.kind) {
    case "cons":
      if (pattern.head !== undefined && pattern.head !== null) {
        bind(pattern.head, `rt.ChainHead(${subject})`, `голова «${pattern.head}»`)
      }
      if (pattern.tail !== undefined && pattern.tail !== null) {
        /* Хвост — срез, а не копия: значения неизменяемы, память общая. У
           строки голова — одна кодовая точка, хвост — остаток. */
        bind(pattern.tail, `rt.ChainTail(${subject})`, `хвост «${pattern.tail}»`)
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
        const ident = ctx.fresh(name)
        const error = ctx.fault()
        out.push(
          `${pad}// поле «${field}»`,
          `${pad}${ident}, ${error} := rt.VariantField(ctx, ${subject}, ${gostring(field)})`,
          `${pad}if ${error} != nil {`,
          `${pad}\treturn rt.Value{}, ${error}`,
          `${pad}}`,
        )
        undo.push({ name, ident, previous: ctx.bind(name, ident) })
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
  const over = emitValue(node.over, ctx, out, pad)
  const list = requireListInto(ctx, out, pad, over, "свёртка")
  const init = emitValue(node.init, ctx, out, pad)
  const accIdent = ctx.fresh(node.acc)
  const index = ctx.temp()
  out.push(
    `${pad}// «${node.acc}»`,
    `${pad}${accIdent} := ${init}`,
    `${pad}for ${index} := range ${list} {`,
  )
  const itemIdent = ctx.fresh(node.item)
  out.push(`${pad}\t// «${node.item}»`, `${pad}\t${itemIdent} := ${list}[${index}]`)

  const at = out.length
  const undoAcc = ctx.bind(node.acc, accIdent)
  const undoItem = ctx.bind(node.item, itemIdent)
  assignInto(node.body, ctx, out, `${pad}\t`, accIdent)
  ctx.unbind(node.item, undoItem)
  ctx.unbind(node.acc, undoAcc)
  guardUnused(out, at, [itemIdent], `${pad}\t`)

  out.push(`${pad}}`)
  return accIdent
}

function emitLoop(node, ctx, out, pad) {
  requireName(node.item, node.kind, "item", node.span)
  const label = node.kind === "map" ? "отобразить" : "отфильтровать"
  const over = emitValue(node.over, ctx, out, pad)
  const list = requireListInto(ctx, out, pad, over, label)
  const items = ctx.temp()
  const index = ctx.temp()
  out.push(
    `${pad}${items} := make([]rt.Value, 0, len(${list}))`,
    `${pad}for ${index} := range ${list} {`,
  )
  const itemIdent = ctx.fresh(node.item)
  const inner = `${pad}\t`
  out.push(`${inner}// «${node.item}»`, `${inner}${itemIdent} := ${list}[${index}]`)

  const at = out.length
  const undo = ctx.bind(node.item, itemIdent)
  if (node.kind === "map") {
    const value = emitValue(node.body, ctx, out, inner)
    out.push(`${inner}${items} = append(${items}, ${value})`)
  } else {
    /* Тело фильтра — предикат: для отброшенных элементов ничего больше не
       вычисляется. */
    const flag = emitCondition(node.body, ctx, out, inner, "Keep")
    out.push(
      `${inner}if ${flag} {`,
      `${inner}\t${items} = append(${items}, ${itemIdent})`,
      `${inner}}`,
    )
  }
  ctx.unbind(node.item, undo)
  guardUnused(out, at, [itemIdent], inner)
  out.push(`${pad}}`)
  return `rt.List(${items})`
}

function requireListInto(ctx, out, pad, value, label) {
  const list = ctx.temp()
  const error = ctx.fault()
  out.push(
    `${pad}${list}, ${error} := rt.RequireList(ctx, ${value}, ${gostring(label)})`,
    `${pad}if ${error} != nil {`,
    `${pad}\treturn rt.Value{}, ${error}`,
    `${pad}}`,
  )
  return list
}

/* ── вызов по имени ── */

function renderDispatch(shared) {
  const lines = [
    "// Call — вызов функции по её исходному имени flang.",
    "//",
    "// Нужен прогонщику и всякому, кто связывает программу с внешним миром",
    "// динамически (скрипт, тест, служба). Коды и тексты — те же, что у",
    "// интерпретатора: «не найдена функция …» и «функция … принимает N аргум.».",
    "func Call(ctx *rt.Ctx, name string, args []rt.Value) (rt.Value, error) {",
    "\tswitch name {",
  ]
  for (const fn of shared.prepared.functions.values()) {
    const arity = fn.params.length
    const pass = Array.from({ length: arity }, (_, index) => `args[${index}]`)
    lines.push(
      `\tcase ${gostring(fn.name)}:`,
      `\t\tif len(args) != ${arity} {`,
      "\t\t\treturn rt.Value{}, rt.Fail(rt.CodeType,",
      '\t\t\t\t"функция «%s» принимает %d аргум., получено %d",',
      `\t\t\t\t${gostring(fn.name)}, ${arity}, len(args))`,
      "\t\t}",
      `\t\treturn ${shared.functionIdents.get(fn.name)}(${["ctx", ...pass].join(", ")})`,
    )
  }
  lines.push(
    "\t}",
    '\treturn rt.Value{}, rt.Fail(rt.CodeUnknownName, "не найдена функция «%s»", name)',
    "}",
  )
  return lines.join("\n")
}

/* ── граница входа: объявленные типы параметров данными ── */

const ВИДЫ_ТИПА_GO = new Map([
  ["число", "rt.TypeNumber"],
  ["строка", "rt.TypeText"],
  ["признак", "rt.TypeFlag"],
  ["ничто", "rt.TypeNull"],
  ["список", "rt.TypeList"],
  ["запись", "rt.TypeRecord"],
  ["сумма", "rt.TypeSum"],
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
 * Сверяет таблицу `rt.CheckEntry` — один и тот же текст для всех программ, а
 * строит её `таблицаВхода` из flang/src/types.mjs, то есть тот же файл, что
 * отвечает на этот вопрос для `flang run --args`.
 */
function renderEntry(таблица) {
  /* Четыре списка отдельными объявлениями, а не одним составным литералом:
     gofmt выравнивает соседние однострочные `поле: значение` по двоеточию, и у
     программы без записей выдача разъезжалась бы по одному пробелу. */
  const блок = (имя, тип, строки) =>
    строки.length === 0 ? [`var ${имя} = []${тип}{}`] : [`var ${имя} = []${тип}{`, ...строки, "}"]
  return [
    "// Граница входа: объявленные типы параметров данными.",
    "//",
    "// Прогонщик сверяет по ним значения, пришедшие снаружи, ДО вызова",
    "// (rt.CheckEntry). Виды rt.TypeUnknown (значение-функция, параметр",
    "// полиморфизма, применение типа с аргументами) не сверяются — ровно как",
    "// молчит о них проверка значений эталона.",
    ...блок(
      "entryTypes",
      "rt.Type",
      таблица.типы.map((запись) =>
        `\t{Kind: ${ВИДЫ_ТИПА_GO.get(запись.вид) ?? "rt.TypeUnknown"}, Name: ${gostring(запись.имя)}, ` +
        `Owner: ${gostring(запись.владелец)}, Optional: ${запись.ничто}, Integral: ${запись.целое}, ` +
        `Bounded: ${запись.отрезок}, Low: ${gonumber(запись.низ)}, High: ${gonumber(запись.верх)}, ` +
        `Of: ${запись.элемент}, FieldFrom: ${запись.полеС}, FieldCount: ${запись.полей}, ` +
        `VariantFrom: ${запись.вариантС}, VariantCount: ${запись.вариантов}},`),
    ),
    "",
    ...блок(
      "entryFields",
      "rt.TypeField",
      таблица.поля.map((поле) => `\t{Name: ${gostring(поле.имя)}, Type: ${поле.тип}},`),
    ),
    "",
    ...блок(
      "entryVariants",
      "rt.TypeVariant",
      таблица.варианты.map((вариант) =>
        `\t{Name: ${gostring(вариант.имя)}, FieldFrom: ${вариант.полеС}, FieldCount: ${вариант.полей}},`),
    ),
    "",
    ...блок(
      "entryParams",
      "rt.EntryParam",
      таблица.параметры.map((параметр) =>
        `\t{Function: ${gostring(параметр.функция)}, Name: ${gostring(параметр.параметр)}, ` +
        `Type: ${параметр.тип}},`),
    ),
    "",
    "var entryTable = rt.EntryTable{Types: entryTypes, Fields: entryFields, " +
      "Variants: entryVariants, Params: entryParams}",
    "",
    "// Entry — объявленные типы параметров: по ним сверяется вход извне.",
    "func Entry() *rt.EntryTable {",
    "\treturn &entryTable",
    "}",
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
