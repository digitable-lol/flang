/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
// emit/c.mjs — печать программы flang в переносимый C99.
//
// ── Зачем ──────────────────────────────────────────────────────────────────
// Печать в JS (emit/js.mjs) даёт модуль для Node и браузера. Но программа на
// flang должна работать и там, где Node нет и не будет: NetBSD, RISC-V, любой
// POSIX. C99 компилируется везде, поэтому этот бэкенд — не «ещё один целевой
// язык», а условие переносимости языка вообще. Он же первый шаг к
// самохостингу: компилятор flang, написанный на flang, соберётся через C.
//
// ── Что здесь принципиально иначе, чем в бэкенде C для FTS-моделей ─────────
// tools/ftsc/src/emit/c.mjs печатает модели FTS: только скаляры, никаких
// списков, строк-как-данных, рекурсии и сумм типов. Там хватает `double` и
// `const char *`, и рантайма почти нет. Здесь язык полный, поэтому появляется
// рантайм (flang/src/emit/c/flang_runtime.[ch]) с представлением значений,
// ареной и UTF-8. Общее сохранено намеренно, чтобы два бэкенда C читались как
// одна система:
//
//   • контракт возврата: статус + результат через указатель + необязательный
//     выходной параметр с причиной; при ошибке *result НЕ трогается;
//   • транслитерация имён — только через tools/ftsc/src/naming.mjs, и коллизия
//     после транслитерации — ошибка печати, а не тихое переименование.
//
// Одно решение ftsc здесь сознательно НЕ повторено: сравнение чисел с
// допуском. Для моделей FTS допуск верен (модель считает деньги, а пример
// записан десятичным), но flang сравнивает значения по `Object.is` (SPEC,
// раздел 5), и «0.1 плюс 0.2 равно 0.3» обязано быть ложью в обоих движках.
// Допуск сделал бы его истиной — то есть расхождением с интерпретатором.
//
// ── Главное требование: совпадение с interpret.mjs ─────────────────────────
// Сгенерированный код обязан давать то же значение и ту же ошибку (код И
// текст). Отсюда:
//
//   • строгий порядок вычисления слева направо: в C выражение не может
//     «упасть», поэтому каждый узел, способный дать ошибку, материализуется в
//     оператор — порядок операторов и есть порядок вычисления;
//   • проценты печатаются как `(процент / 100.0) * значение`;
//   • число печатается по правилам ECMAScript Number::toString (рантайм),
//     потому что «к строке» и тексты диагностик содержат числа;
//   • строки меряются кодовыми точками, индексация с 1 включительно.
//
// ── Хвостовая рекурсия: те же три случая, что в emit/js.mjs ────────────────
//   • хвостовой самовызов → `for (;;)` с переприсваиванием параметров;
//   • взаимная хвостовая рекурсия (компонента сильной связности из двух и
//     более функций) → батут через указатели на функции;
//   • функция с постусловиями хвостовых вызовов не получает — интерпретатор
//     тоже не переиспользует кадр, которому есть что проверить после возврата.
//
// ── Пределы: и глубина, и шаги ─────────────────────────────────────────────
// Предел ГЛУБИНЫ — не прихоть: в JS переполнение стека даёт исключение, в C —
// падение процесса. Поэтому каждая функция, лежащая на цикле графа вызовов,
// считает глубину и на превышении даёт FLANG_RECURSION_LIMIT — тот же код и
// тот же текст, что у интерпретатора. Знание `total: true` (totality.mjs) при
// этом используется честно: оно доказывает завершение, но не ограничивает
// глубину (тотальная «Сумма» на списке в миллион элементов уйдёт на миллион
// кадров), поэтому счётчик нужен обоим классам — и в заголовке модуля
// тотальность отмечена как факт для вызывающего, а не как повод убрать
// проверку.
//
// Лимит ШАГОВ раньше был только в Go, Rust и Python, и это была дыра: глубину
// хвостовая рекурсия не растит, поэтому незавершающаяся обычная функция
// («Вечность» из курса) собиралась и крутилась вечно, вместо того чтобы
// сказать FLANG_RECURSION_LIMIT. Теперь шаг считается в трёх местах — вход в
// функцию (fl_enter), оборот цикла хвостового самовызова и отскок батута, —
// ровно как в бэкенде Go. Шаг интерпретатора мельче (итерация его машины), так
// что счётчик здесь всегда МЕНЬШЕ, и при одинаковом пределе интерпретатор
// упирается первым: расхождение одностороннее и безопасное — напечатанный код
// не объявит исчерпанным то, что интерпретатор досчитал до конца.
//
// ── Предел глубины несёт СТЕК, и стек под него отводится ───────────────────
// Счётчика глубины мало, и это стоило SIGSEGV на пределах по умолчанию. Счётчик
// считает КАДРЫ, а несёт их стек, и толщина кадра — свойство программы, а не
// языка: 408 байт у нехвостовой функции с одним параметром и 5 552 у функции с
// сорока связываниями. Первая проходила объявленные 10 000 вдвое, вторая
// умирала на 1 518 — без кода, без текста, без возможности перехвата.
//
// Отсюда две вещи в напечатанном, и обе живут в рантайме, а не в этом файле:
//
//   • прогонщик считает на потоке с ЯВНО ЗАДАННЫМ стеком, и размер стека
//     соотнесён с впечатанным пределом (`fl_stack_wanted`, flang_cli.c) — приём
//     взят у бэкенда Python, где он же закрывает тот же вопрос;
//   • `fl_enter` — та же и единственная точка, где сходятся оба предела, —
//     смотрит ещё и на остаток стека и переводит его исчерпание в объявленный
//     FLANG_RECURSION_LIMIT с честным текстом про хозяина. Третьего механизма
//     для стека не заведено намеренно: место проверки одно, вид отказа один, а
//     набор видов отказа закрыт (failures.mjs).
//
// Замеры, границы и цена в памяти — в шапках flang_cli.c и flang_runtime.h,
// проверка — flang/test/emit-depth.test.mjs.

import { readFileSync } from "node:fs"

import { canonicalBuiltinName, flangError, hasBuiltin, помощникФормы } from "../builtins.mjs"
import { defunctionalize } from "../defunc.mjs"
import { таблицаВхода } from "../types.mjs"
import { BIDI_CONTROLS, escapeBidiInFiles, escapeBidiOctalBytes } from "../../../tools/ftsc/src/bidi.mjs"
import { createNamer, pascal, snake } from "../../../tools/ftsc/src/naming.mjs"

/* ═══════════════════════════════════════════════════════════════════════════
   Рантайм.

   Он лежит рядом настоящими .c/.h, а не строкой в этом файле: так его
   проверяет компилятор прямо в репозитории, а не только через тест печати, и
   правка рантайма не превращается в правку экранирования внутри шаблона.
   Печатается он байт в байт — кроме шапки и блока настроек, который бэкенд
   ставит ПЕРЕД файлом (в самом файле те же настройки объявлены через #ifndef,
   поэтому он собирается и отдельно).
   ═══════════════════════════════════════════════════════════════════════════ */

const RUNTIME_DIRECTORY = new URL("./c/", import.meta.url)
const RUNTIME_HEADER = readFileSync(new URL("flang_runtime.h", RUNTIME_DIRECTORY), "utf8")
const RUNTIME_SOURCE = readFileSync(new URL("flang_runtime.c", RUNTIME_DIRECTORY), "utf8")
const CLI_SOURCE = readFileSync(new URL("flang_cli.c", RUNTIME_DIRECTORY), "utf8")
const REPL_SOURCE = readFileSync(new URL("flang_repl.c", RUNTIME_DIRECTORY), "utf8")
/* Планировщик конкурентности — тоже настоящие .c/.h рядом, а не строка здесь, и
   по той же причине: его проверяет компилятор прямо в репозитории. Печатается
   он ТОЛЬКО программе с процессами (см. renderConcurrency). */
const CONC_HEADER = readFileSync(new URL("flang_conc.h", RUNTIME_DIRECTORY), "utf8")
const CONC_SOURCE = readFileSync(new URL("flang_conc.c", RUNTIME_DIRECTORY), "utf8")

/** Канонические имена встроенных форм → функции рантайма. */
const BUILTIN_HELPERS = new Map([
  ["длина", "fl_b_dlina"],
  ["символ", "fl_b_simvol"],
  ["подстрока", "fl_b_podstroka"],
  ["соединить", "fl_b_soedinit"],
  ["разделить", "fl_b_razdelit"],
  ["символы", "fl_b_simvoly"],
  ["код символа", "fl_b_kod_simvola"],
  ["содержит", "fl_b_soderzhit"],
  ["начинается с", "fl_b_nachinaetsya_s"],
  ["к числу", "fl_b_k_chislu"],
  ["к числу или беда", "fl_b_k_chislu_ili_beda"],
  ["к строке", "fl_b_k_stroke"],
  ["пусто", "fl_b_pusto"],
  ["голова", "fl_b_golova"],
  ["хвост", "fl_b_hvost"],
  ["элемент", "fl_b_element"],
  ["добавить", "fl_b_dobavit"],
  ["остаток от", "fl_b_ostatok_ot"],
  ["процентов от", "fl_b_procentov_ot"],
])

/**
 * Суффикс имени помощника БЕЗ сторожа частичности (`помощникФормы`).
 *
 * Печать здесь ничего не доказывает: отметку `доказана` кладёт передний край
 * (`bin/flang.mjs`, `markNonEmpty`) по выводу проверки типов, а копия печати на
 * самом языке анализа не видит вовсе — круг импортов. Обе стороны читают одну
 * отметку и потому печатают одно и то же.
 */
const СУФФИКС_ДОКАЗАННОГО = "_dokazano"

/** Арность встроенных форм — проверяется при печати, а не в рантайме. */
const BUILTIN_ARITY = new Map([
  ["длина", 1], ["символ", 2], ["подстрока", 3], ["соединить", 2], ["разделить", 2],
  ["символы", 1],
  ["код символа", 1],
  ["содержит", 2], ["начинается с", 2], ["к числу", 1], ["к числу или беда", 1], ["к строке", 1], ["пусто", 1],
  ["голова", 1], ["хвост", 1], ["элемент", 2], ["добавить", 2], ["остаток от", 2], ["процентов от", 2],
])

const BINARY_HELPERS = new Map([
  ["add", "fl_add"], ["sub", "fl_sub"], ["mul", "fl_mul"], ["div", "fl_div"], ["mod", "fl_mod"],
  ["percent", "fl_percent"], ["gt", "fl_gt"], ["lt", "fl_lt"], ["gte", "fl_gte"], ["lte", "fl_lte"],
  ["concat", "fl_concat"],
])

/* Ключевые слова C99 плюс имена, занятые рантаймом и сигнатурой функции.
   Попадание имени модели сюда — ошибка печати от createNamer, а не тихая
   порча кода. */
const C_RESERVED = [
  "auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum",
  "extern", "float", "for", "goto", "if", "inline", "int", "long", "register", "restrict", "return",
  "short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void",
  "volatile", "while", "bool", "true", "false", "inline", "_Bool", "_Complex", "_Imaginary",
  "main", "NULL", "fl", "ctx", "result", "error", "status", "size_t",
]

/* ═══════════════════════════ подготовка программы ═══════════════════════════ */

// Повторяет prepareProgram интерпретатора: те же проверки, те же коды и
// тексты. Разница только во времени срабатывания — при печати, а не при
// вычислении (ровно как в emit/js.mjs).
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

/* ═══════════════════════════ литералы C ═══════════════════════════ */

/**
 * Строковый литерал C. Кириллица печатается как есть (UTF-8 в исходнике —
 * ровно то, ради чего этот язык затевался: имена в коде обязаны читаться), а
 * экранируются кавычка, обратный слэш, управляющие символы и вопросительный
 * знак. Вопросительный знак — из-за триграфов: «??=» в строке при -std=c99
 * превращается в «#», и -Wtrigraphs (он в -Wall) сделал бы из этого ошибку.
 *
 * Двунаправленные управляющие символы уезжают в восьмеричные экранирования
 * побайтно: в C99 нет `\u` внутри узкой строки, зато `\NNN` читает не больше
 * трёх цифр, поэтому следующий за ним символ — хоть цифра, хоть буква — уже не
 * приклеится. Байты те же, что и у сырого символа, поэтому длина строки в
 * байтах и в кодовых точках не меняется, и значение остаётся тем же.
 */
function cstring(value) {
  let result = '"'
  /* По символам, а не по байтам: файл записывается в UTF-8, и «Длина»,
     разобранная на байты и собранная обратно как символы, превратилась бы в
     двойную кодировку — имя перестало бы совпадать с именем в интерпретаторе. */
  for (const character of String(value)) {
    const code = character.codePointAt(0)
    if (character === '"') result += '\\"'
    else if (character === "\\") result += "\\\\"
    else if (character === "?") result += "\\?"
    else if (code < 0x20 || code === 0x7f) result += `\\${code.toString(8).padStart(3, "0")}`
    else if (BIDI_CONTROLS.has(code)) {
      for (const byte of new TextEncoder().encode(character)) result += `\\${byte.toString(8).padStart(3, "0")}`
    } else result += character
  }
  return `${result}"`
}

/**
 * Число как литерал C. `String(value)` — кратчайшая запись, читающаяся обратно
 * тем же double, и strtod компилятора обязан её так и прочитать. NaN и
 * бесконечности приходят из <math.h>: писать «0.0/0.0» значило бы полагаться
 * на то, что компилятор не свернёт это в предупреждение.
 */
function cnumber(value) {
  if (Number.isNaN(value)) return "((double)NAN)"
  if (value === Infinity) return "((double)INFINITY)"
  if (value === -Infinity) return "(-(double)INFINITY)"
  const text = Object.is(value, -0) ? "-0" : String(value)
  return /[.e]/u.test(text) ? text : `${text}.0`
}

function needsMath(value) {
  return typeof value === "number" && !Number.isFinite(value)
}

/* ═══════════════════════════ печать ═══════════════════════════ */

/**
 * Печать программы flang в C99.
 *
 * @param {object} program AST flang (SPEC.md, раздел 5)
 * @param {{ path?: string, indexBase?: 0 | 1, maxDepth?: number, maxSteps?: number, cli?: boolean,
 *           repl?: boolean }} [options]
 *   `repl` — печатать ли рядом с прогонщиком интерактивную оболочку
 *   (`flang_repl.c`, команда `flang repl`). По умолчанию нет: осмысленна она
 *   только у самого компилятора flang, потому что зовёт его точки входа.
 * @returns {{ files: Array<{ path: string, content: string }> }}
 */
export function emitC(program, options = {}) {
  /* Граница входа читает типы ДО дефункционализации: после неё параметр,
     объявленный функцией, становится суммой тегов, а `checkArguments` на
     границе интерпретатора видит его функцией. Сверять один и тот же вход двумя
     разными типами значило бы, что у языка два ответа на один вопрос. */
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
  const prefix = snake(moduleName === null ? "program" : moduleName)

  /* Одно пространство имён на весь C, поэтому один именователь на всё, что
     торчит наружу: функции, фабрики записей, конструкторы вариантов. */
  const exported = createNamer(snake, C_RESERVED)
  const functionIdents = new Map()
  const factoryIdents = new Map()
  const variantIdents = new Map()
  const typeIdents = new Map()
  for (const name of prepared.records.keys()) {
    factoryIdents.set(name, `${prefix}_${exported(`создать ${name}`)}`)
    typeIdents.set(name, pascal(name))
  }
  /* Роль входит в имя, потому что одно пространство имён C не различает
     конструктор варианта и функцию: в ядре FTS «Значение операнда» — и вариант
     суммы, и функция вычислителя, и без роли оба давали один идентификатор,
     то есть некомпилируемый C. Фабрики записей уже так и именуются
     («создать X»), варианты были исключением. */
  for (const name of prepared.variants.keys()) variantIdents.set(name, `${prefix}_${exported(`вариант ${name}`)}`)
  for (const name of prepared.functions.keys()) functionIdents.set(name, `${prefix}_${exported(name)}`)

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
  for (const name of cyclic.keys()) stepIdents.set(name, `${functionIdents.get(name)}_step`)

  const maxArgs = Math.max(1, ...names.map((name) => prepared.functions.get(name).params.length))
  const maxTailArgs = Math.max(
    1,
    ...[...cyclic.keys()].map((name) => prepared.functions.get(name).params.length),
    1,
  )

  /* Имена параметров считаются один раз: их видят и заголовок, и реализация, и
     обёртка со счётчиком глубины — разойтись им нельзя. */
  const paramIdents = new Map()
  for (const [name, fn] of prepared.functions) {
    paramIdents.set(name, uniqueIdents(fn.params.map((param) => param.name)))
  }

  const shared = {
    prepared,
    prefix,
    paramIdents,
    functionIdents,
    factoryIdents,
    variantIdents,
    typeIdents,
    stepIdents,
    tailEdges,
    cyclic,
    recursive,
    /* Файловые константы: массивы имён полей и составные литералы. */
    nameArrays: new Map(),
    statics: [],
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
  bodies.push(renderEntry(входные, shared))

  /* Конкурентность печатается только тому, у кого есть хоть один `процесс`.
     Программе без процессов планировщик не нужен, и возить его ей значило бы
     возить неисполнимый код; ровно так же решает бэкенд Elixir. */
  const processes = Array.isArray(program.processes) ? program.processes : []
  const concurrent = processes.length > 0
  if (concurrent) bodies.push(renderConcurrency(program, processes, shared))

  const settings = [
    "/* Настройки этой программы; в самом рантайме те же имена объявлены через",
    "   #ifndef, поэтому он собирается и без этого блока. */",
    `#define FL_INDEX_BASE ${base}`,
    `#define FL_MAX_DEPTH ${maxDepth}`,
    `#define FL_MAX_STEPS ${maxSteps}`,
    `#define FL_MAX_TAIL_ARGS ${maxTailArgs}`,
    `#define FL_MAX_ARGS ${maxArgs}`,
  ].join("\n")

  const files = [
    {
      path: "flang_runtime.h",
      content: `${banner(moduleName, "рантайм: значения, арена, UTF-8, диагностики")}\n${settings}\n\n${RUNTIME_HEADER}`,
    },
    {
      path: "flang_runtime.c",
      content: `${banner(moduleName, "рантайм: реализация")}\n${RUNTIME_SOURCE}`,
    },
  ]
  if (concurrent) {
    files.push(
      {
        path: "flang_conc.h",
        content: `${banner(moduleName, "планировщик конкурентности: процессы, ящики, надзор")}\n${CONC_HEADER}`,
      },
      {
        path: "flang_conc.c",
        content: `${banner(moduleName, "планировщик конкурентности: реализация")}\n${CONC_SOURCE}`,
      },
    )
  }
  files.push(
    { path: `${file}.h`, content: renderHeader(file, moduleName, shared, concurrent) },
    { path: `${file}.c`, content: renderSource(file, moduleName, shared, bodies) },
  )

  /*
   * Оболочка печатается по просьбе, и просьба эта осмысленна ровно у одной
   * программы — у самого компилятора flang: только у него есть точки входа,
   * которые оболочка зовёт («Разбор исходника», «Связать исходники»). Печатать
   * её всем значило бы возить в каждой напечатанной программе сто с лишним
   * килобайт кода, который она не может исполнить.
   *
   * Отдельным файлом, а не внутри прогонщика, — потому что обещания у них
   * разные: прогонщик остаётся переносимым C99, который ни от чего не зависит и
   * ничего не спрашивает у мира, а оболочка обязана спросить, где `cc` и где
   * каталоги установки.
   */
  const repl = options.repl === true && options.cli !== false
  if (options.cli !== false) {
    files.push({
      path: "flang_cli.c",
      content: [
        banner(moduleName, "прогонщик: JSON на входе, JSON на выходе"),
        `#define FL_PROGRAM_CALL ${prefix}_call`,
        `#define FL_PROGRAM_ENTRY ${prefix}_entry`,
        ...(repl ? ["#define FL_WITH_REPL 1"] : []),
        ...(concurrent
          ? ["#define FL_WITH_CONC 1", `#define FL_PROGRAM_CONC_PLAN ${prefix}_conc_plan`]
          : []),
        "",
        CLI_SOURCE,
      ].join("\n"),
    })
  }
  if (repl) {
    files.push({
      path: "flang_repl.c",
      content: [
        banner(moduleName, "оболочка: «flang repl» для человека"),
        `#define FL_PROGRAM_CALL ${prefix}_call`,
        "",
        REPL_SOURCE,
      ].join("\n"),
    })
  }
  files.push({ path: "Makefile", content: renderMakefile(file, options.cli !== false, repl, concurrent) })
  /* Последний шаг — снять сырые двунаправленные управляющие со всего вывода
     (bidi.mjs). Литерал их уже экранировал сам, но имя FTS уезжает ещё и в
     комментарии — в шапку файла, в описание функции, в подпись поля, — а
     комментарий читают первым и проверить исполнением не могут. gcc 13 под
     -Werror останавливает сборку на НЕПАРНОМ управляющем (в комментарии тоже),
     а парную пару RLO…PDF пропускает молча: его молчание не доказательство.
     Форма для C одна и в литерале, и в комментарии — байты UTF-8
     восьмеричными: две записи в одном языке пришлось бы держать в голове. */
  return { files: escapeBidiInFiles(files, escapeBidiOctalBytes) }
}

function banner(moduleName, what) {
  return [
    "/*",
    " * Сгенерировано flang (бэкенд C, flang/src/emit/c.mjs). Не редактировать руками.",
    moduleName === null ? " * Программа flang без имени модуля." : ` * Модуль flang: «${moduleName}».`,
    ` * Файл: ${what}.`,
    " * Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.",
    " */",
  ].join("\n")
}

/* ── заголовок модуля ── */

function renderHeader(file, moduleName, shared, concurrent = false) {
  const guard = `${snake(file).toUpperCase()}_H`
  const lines = [
    banner(moduleName, "объявления: конструкторы значений и функции программы"),
    `#ifndef ${guard}`,
    `#define ${guard}`,
    "",
    '#include "flang_runtime.h"',
    ...(concurrent ? ['#include "flang_conc.h"'] : []),
    "",
    "/*",
    " * Контракт вызова: функция кладёт результат в *result и возвращает FL_OK",
    " * либо НЕ трогает *result и возвращает FL_ERROR, заполнив *error (его можно",
    " * передать NULL). Результат живёт в арене контекста — до ближайшего",
    " * fl_arena_reset; чтобы сохранить его надолго, скопируйте в свою память.",
    " *",
    " *   fl_arena arena;",
    " *   fl_ctx ctx;",
    " *   fl_error error;",
    " *   fl_value result;",
    " *   fl_arena_init(&arena);",
    " *   fl_ctx_init(&ctx, &arena);",
    " *   if (…(&ctx, …, &result, &error) != FL_OK) { … error.code, error.message … }",
    " *   fl_arena_release(&arena);",
    " */",
    "",
  ]

  for (const [name, type] of shared.prepared.records) {
    const fields = Array.isArray(type.fields) ? type.fields : []
    lines.push(
      `/* Запись FTS «${name}»: ${fields.map((field) => `«${field.name}»`).join(", ") || "без полей"}. */`,
      `/* Запись flang тотальна: пропущенное поле — это «ничто», а не дырка. */`,
      `${declareFactory(name, type, shared)};`,
      "",
    )
  }

  for (const sum of shared.prepared.sums) {
    const variants = Array.isArray(sum.variants) ? sum.variants : []
    lines.push(
      `/* Сумма типов FTS «${sum.name}»: ${variants.map((item) => `«${item.name}»`).join(" | ") || "без вариантов"}. */`,
      `/* Дискриминант — имя варианта; проверяется через fl_variant_is(значение, "Имя"). */`,
    )
    for (const item of variants) {
      if (!shared.variantIdents.has(item.name)) continue
      lines.push(`${declareVariantFactory(item, shared)};`)
    }
    lines.push("")
  }

  for (const fn of shared.prepared.functions.values()) {
    lines.push(...describeFunction(fn, shared), `${declareFunction(fn, shared)};`, "")
  }

  lines.push(
    "/*",
    " * Вызов функции по её исходному имени flang. Нужен прогонщику и всякому,",
    " * кто связывает программу с внешним миром динамически (скрипт, FFI, тест).",
    " */",
    `fl_status ${shared.prefix}_call(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,`,
    "                    fl_value *result, fl_error *error);",
    "",
    "/*",
    " * Объявленные типы параметров — данными. Прогонщик сверяет по ним значения,",
    " * пришедшие снаружи, ДО вызова: доказательство завершения `тотальной` стоит",
    " * на типе, и значение вне типа выносит вместе с типом и доказательство.",
    " */",
    `const fl_entry_table *${shared.prefix}_entry(void);`,
    "",
  )
  if (concurrent) {
    lines.push(
      "/*",
      " * Процессы, надзоры и прогоны программы — данными. Отсюда планировщик",
      " * (flang_conc.c) берёт всё, что ему нужно знать о программе; сам он о ней",
      " * не знает ничего, поэтому и печатается байт в байт для всех.",
      " */",
      `const fl_conc_plan *${shared.prefix}_conc_plan(void);`,
      "",
    )
  }
  lines.push(`#endif /* ${guard} */`, "")
  return lines.join("\n")
}

function describeFunction(fn, shared) {
  const lines = ["/*", ` * Функция flang «${fn.name}».`]
  lines.push(
    " *",
    fn.total
      ? " * Тотальная: завершение доказано анализом завершаемости (totality.mjs)."
      : " * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.",
  )
  if (shared.tailEdges.get(fn.name)?.has(fn.name) === true && fn.postconditions.length === 0) {
    lines.push(" *", " * Хвостовой самовызов развёрнут в цикл: стек не растёт.")
  }
  const members = shared.cyclic.get(fn.name)
  if (members !== undefined) {
    const others = [...members].filter((name) => name !== fn.name).map((name) => `«${name}»`).join(", ")
    lines.push(" *", ` * Взаимная хвостовая рекурсия с ${others}: вызовы идут через батут.`)
  }
  if (shared.recursive.has(fn.name)) {
    lines.push(" *", " * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.")
  }
  const idents = shared.paramIdents.get(fn.name)
  fn.params.forEach((param, index) => {
    lines.push(` * @param ${idents[index]} — «${param.name}»${typeNote(param.type)}`)
  })
  lines.push(` * @return значение${typeNote(fn.returns)}`, " */")
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
 * Идентификаторы C для набора имён модели: транслитерация плюс развод
 * столкновений. Столкнуться могут и «цена» с «Цена», и поле, чьё имя после
 * транслитерации совпало с ключевым словом C.
 */
function uniqueIdents(names) {
  const taken = new Set(C_RESERVED)
  return names.map((name) => {
    let wanted = snake(name)
    if (/^fl_/u.test(wanted) || /^[0-9]/u.test(wanted)) wanted = `v_${wanted}`
    let candidate = wanted
    let suffix = 1
    while (taken.has(candidate)) {
      suffix += 1
      candidate = `${wanted}_${suffix}`
    }
    taken.add(candidate)
    return candidate
  })
}

function declareFactory(name, type, shared) {
  const fields = Array.isArray(type.fields) ? type.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name))
  const params = idents.map((ident) => `fl_value ${ident}`).join(", ")
  return `fl_status ${shared.factoryIdents.get(name)}(fl_ctx *ctx${params.length > 0 ? `, ${params}` : ""}, fl_value *out, fl_error *error)`
}

function declareVariantFactory(item, shared) {
  const fields = Array.isArray(item.fields) ? item.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name))
  const params = idents.map((ident) => `fl_value ${ident}`).join(", ")
  return `fl_status ${shared.variantIdents.get(item.name)}(fl_ctx *ctx${params.length > 0 ? `, ${params}` : ""}, fl_value *out, fl_error *error)`
}

function declareFunction(fn, shared) {
  const params = shared.paramIdents.get(fn.name).map((ident) => `fl_value ${ident}`).join(", ")
  return `fl_status ${shared.functionIdents.get(fn.name)}(fl_ctx *ctx${params.length > 0 ? `, ${params}` : ""}, fl_value *result, fl_error *error)`
}

/* ── файл реализации ── */

function renderSource(file, moduleName, shared, bodies) {
  const head = [
    banner(moduleName, "реализация"),
    `#include "${file}.h"`,
    "",
    "#include <string.h>",
  ]
  if (shared.needsMath) head.push("#include <math.h> /* NAN и INFINITY: в программе есть неконечные литералы */")
  head.push("")
  if (shared.statics.length > 0) {
    head.push("/* Константы программы: имена полей и строковые литералы. */", ...shared.statics, "")
  }
  if (shared.stepIdents.size > 0) {
    /* Шаги батута ссылаются друг на друга по кругу — иначе это не взаимная
       рекурсия. Значит без предварительных объявлений не обойтись. */
    head.push("/* Шаги батута: объявлены заранее, потому что ссылаются друг на друга. */")
    for (const step of shared.stepIdents.values()) head.push(`${stepSignature(step)};`)
  }
  return [head.join("\n"), ...bodies.filter((body) => body.length > 0)].join("\n\n") + "\n"
}

function renderMakefile(file, cli, repl, concurrent = false) {
  return [
    "# Сгенерировано flang (бэкенд C). Флаги здесь — часть контракта бэкенда:",
    "# сгенерированный код обязан собираться без единого предупреждения.",
    "# -lpthread: расчёт идёт на потоке с заданным стеком, иначе объявленный",
    "# предел глубины не несётся стеком (flang_cli.c). С glibc 2.34 и новее он",
    "# уже в libc, но на старых системах без него не слинкуется.",
    "CC ?= cc",
    "CFLAGS ?= -std=c99 -Wall -Wextra -Werror -pedantic -O2",
    "LDLIBS ?= -lm -lpthread",
    "",
    `OBJECTS = flang_runtime.o${concurrent ? " flang_conc.o" : ""} ${file}.o`,
    "",
    `all: lib${file}.a${cli ? " flang_cli" : ""}`,
    "",
    `lib${file}.a: $(OBJECTS)`,
    "\tar rcs $@ $(OBJECTS)",
    ...(cli
      ? [
          "",
          `flang_cli: flang_cli.o${repl ? " flang_repl.o" : ""} $(OBJECTS)`,
          `\t$(CC) $(CFLAGS) -o $@ flang_cli.o${repl ? " flang_repl.o" : ""} $(OBJECTS) $(LDLIBS)`,
        ]
      : []),
    "",
    "clean:",
    `\trm -f $(OBJECTS) flang_cli.o${repl ? " flang_repl.o" : ""} flang_cli lib${file}.a`,
    "",
    ".PHONY: all clean",
    "",
  ].join("\n")
}

/* ── фабрики записей и вариантов ── */

function renderFactory(name, type, shared) {
  const fields = Array.isArray(type.fields) ? type.fields : []
  const namesIdent = nameArray(shared, fields.map((field) => field.name))
  const idents = uniqueIdents(fields.map((field) => field.name))
  const lines = [`/* Фабрика записи FTS «${name}». */`, `${declareFactory(name, type, shared)} {`]
  if (fields.length === 0) {
    lines.push("  return fl_record_new(ctx, NULL, NULL, 0, out, error);")
  } else {
    lines.push(`  fl_value values[${fields.length}];`)
    fields.forEach((field, index) => {
      lines.push(`  values[${index}] = ${idents[index]}; /* «${field.name}» */`)
    })
    lines.push(`  return fl_record_new(ctx, ${namesIdent}, values, ${fields.length}, out, error);`)
  }
  lines.push("}")
  return lines.join("\n")
}

function renderVariantFactory(sum, item, shared) {
  const fields = Array.isArray(item.fields) ? item.fields : []
  const namesIdent = nameArray(shared, fields.map((field) => field.name))
  const idents = uniqueIdents(fields.map((field) => field.name))
  const lines = [
    `/* Конструктор варианта «${item.name}» суммы «${sum.name}». */`,
    `${declareVariantFactory(item, shared)} {`,
  ]
  if (fields.length === 0) {
    lines.push(`  return fl_variant_new(ctx, ${cstring(item.name)}, NULL, NULL, 0, out, error);`)
  } else {
    lines.push(`  fl_value values[${fields.length}];`)
    fields.forEach((field, index) => {
      lines.push(`  values[${index}] = ${idents[index]}; /* «${field.name}» */`)
    })
    lines.push(
      `  return fl_variant_new(ctx, ${cstring(item.name)}, ${namesIdent}, values, ${fields.length}, out, error);`,
    )
  }
  lines.push("}")
  return lines.join("\n")
}

/** Массив имён полей на уровне файла: один и тот же набор печатается однажды. */
function nameArray(shared, names) {
  if (names.length === 0) return "NULL"
  const key = JSON.stringify(names)
  const existing = shared.nameArrays.get(key)
  if (existing !== undefined) return existing
  const ident = `${shared.prefix}_names_${shared.nameArrays.size + 1}`
  shared.nameArrays.set(key, ident)
  shared.statics.push(
    `static const char *const ${ident}[] = { ${names.map((name) => cstring(name)).join(", ")} };`,
  )
  return ident
}

/* ═══════════════════════════ печать функции ═══════════════════════════ */

function renderFunction(fn, shared) {
  const ident = shared.functionIdents.get(fn.name)
  const members = shared.cyclic.get(fn.name) ?? null
  const selfTail = shared.tailEdges.get(fn.name)?.has(fn.name) === true
  const guard = shared.recursive.has(fn.name)

  const ctx = createContext(fn, shared, { selfTail, members })
  const body = []

  if (fn.postconditions.length > 0) {
    /* Постусловия проверяются после тела: результат уже вычислен, и первое же
       нарушение прерывает вычисление — как в интерпретаторе. */
    const value = emitValue(fn.body, ctx, body, "  ")
    const resultIdent = ctx.temp()
    body.push(`  const fl_value ${resultIdent} = ${value};`)
    for (const property of fn.postconditions) {
      const previous = ctx.bind(property.bind, resultIdent)
      const check = emitValue(property.expr, ctx, body, "  ")
      ctx.unbind(property.bind, previous)
      const holds = ctx.temp()
      const message = property.message ?? `нарушено свойство «${property.name}» функции «${fn.name}»`
      body.push(
        `  /* постусловие «${property.name}» */`,
        `  bool ${holds} = false;`,
        `  FL_TRY(fl_post(ctx, ${check}, ${cstring(property.name)}, ${cstring(fn.name)}, &${holds}, error));`,
        `  if (!${holds}) {`,
        `    return fl_fail(ctx, error, ${cstring(property.code)}, "%s", ${cstring(message)});`,
        "  }",
      )
    }
    body.push(`  *result = ${resultIdent};`, "  return FL_OK;")
  } else if (selfTail) {
    /* Счёт витков стоит НЕ здесь, а на самом хвостовом самовызове (см. ветку
       `call` в emitTail): вход в функцию уже посчитан fl_enter, и второй tick
       в начале цикла считал бы его дважды. Измерено: на «Правильные скобки»
       от 9 бэкенд C насчитывал 30 631 шаг там, где остальные семь целей
       насчитывают 23 713, — ровно по одному лишнему шагу на каждый вход в
       функцию с хвостовым самовызовом. Расхождение восьми целей между собой —
       отказ, а не заметка (AGENTS.md). */
    body.push("  for (;;) {")
    emitTail(fn.body, ctx, body, "    ")
    body.push("  }")
  } else {
    emitTail(fn.body, ctx, body, "  ")
  }

  const text = body.join("\n")
  const prologue = []
  if (!/\bctx\b/u.test(text)) prologue.push("  (void)ctx;")
  if (!/\berror\b/u.test(text)) prologue.push("  (void)error;")

  const blocks = []
  const documentation = describeFunction(fn, shared).join("\n")

  if (members !== null) {
    /* Батут: наружу торчит обычная функция, внутри — шаг, возвращающий отскок. */
    const step = shared.stepIdents.get(fn.name)
    /* Без const: у самовызова в хвосте параметры переприсваиваются в цикле. */
    const unpack = ctx.params.map((param, index) => `  fl_value ${param} = args[${index}]; /* «${fn.params[index].name}» */`)
    const unused = ctx.params
      .filter((param) => !new RegExp(`\\b${param}\\b`, "u").test(text))
      .map((param) => `  (void)${param};`)
    blocks.push(
      [
        `/* Шаг батута для «${fn.name}»: значение либо отскок к соседу по рекурсии. */`,
        `${stepSignature(step)} {`,
        ...(ctx.params.length === 0 ? ["  (void)args;"] : unpack),
        ...unused,
        ...(/\bbounce\b/u.test(text) ? [] : ["  (void)bounce;"]),
        /* `result` гасится по той же причине, что `bounce`: у компоненты, где
           ВСЕ хвостовые позиции — отскоки, шаг ни разу не пишет в *result, и
           -Wextra (то есть -Wunused-parameter) при -Werror делает такой C
           несобираемым. На программах репозитория этот случай не возникает,
           поэтому дефект и дожил: его нашла печать, написанная на самом flang,
           когда напечатала собственный исходник. */
        ...(/\bresult\b/u.test(text) ? [] : ["  (void)result;"]),
        ...prologue,
        text,
        "}",
      ].join("\n"),
    )
    const args = ctx.params.length === 0 ? "NULL" : "args"
    blocks.push(
      [
        documentation,
        `${declareFunction(fn, shared)} {`,
        ...(ctx.params.length === 0
          ? []
          : [
            `  fl_value args[${ctx.params.length}];`,
            ...ctx.params.map((param, index) => `  args[${index}] = ${param};`),
          ]),
        `  FL_TRY(fl_enter(ctx, ${cstring(fn.name)}, error));`,
        "  {",
        "    const fl_mark region = fl_region_open(ctx);",
        `    const fl_status status = fl_trampoline(ctx, ${step}, ${args}, ${ctx.params.length}, ${cstring(fn.name)},`,
        "                                           result, error);",
        "    fl_leave(ctx);",
        "    return fl_region_close(ctx, region, status, result, error);",
        "  }",
        "}",
      ].join("\n"),
    )
    return blocks.join("\n\n")
  }

  const unusedParams = ctx.params
    .filter((param) => !new RegExp(`\\b${param}\\b`, "u").test(text))
    .map((param) => `  (void)${param};`)
  /* Функция, у которой ВСЕ хвостовые позиции — самовызов, разворачивается в
     вечный цикл и ни разу не пишет в *result: «Вечность» из курса — ровно
     такой случай. Под -Wextra с -Werror это несобираемый C. Тот же недосмотр
     уже чинили в шаге батута (взаимная рекурсия); здесь он оставался для
     прямой. */
  const unusedResult = /\bresult\b/u.test(text) ? [] : ["  (void)result;"]

  if (!guard) {
    return [documentation, `${declareFunction(fn, shared)} {`, ...unusedParams, ...unusedResult, ...prologue, text, "}"].join("\n")
  }

  /* Счётчик глубины обязан уменьшаться и на ошибке, поэтому тело уезжает в
     отдельную функцию: единственная точка выхода — то, чего в C иначе не
     получить, не разложив ранние возвраты по goto. Та же единственная точка
     выхода несёт и область на вызов: отметку снимает `fl_region_open` до тела,
     а `fl_region_close` после него перекладывает результат вниз и отдаёт всё
     промежуточное (объяснение — в flang_runtime.c). */
  const inner = `${ident}_body`
  const signature = fn.params.map((param) => `fl_value ${snake(param.name)}`).join(", ")
  return [
    `/* Тело «${fn.name}»; глубину считает обёртка ниже. */`,
    `static fl_status ${inner}(fl_ctx *ctx${signature.length > 0 ? `, ${signature}` : ""}, fl_value *result, fl_error *error) {`,
    ...unusedParams,
    ...unusedResult,
    ...prologue,
    text,
    "}",
    "",
    documentation,
    `${declareFunction(fn, shared)} {`,
    `  FL_TRY(fl_enter(ctx, ${cstring(fn.name)}, error));`,
    "  {",
    "    const fl_mark region = fl_region_open(ctx);",
    `    const fl_status status = ${inner}(ctx${ctx.params.length > 0 ? `, ${ctx.params.join(", ")}` : ""}, result, error);`,
    "    fl_leave(ctx);",
    "    return fl_region_close(ctx, region, status, result, error);",
    "  }",
    "}",
  ].join("\n")
}

/** Сигнатура шага батута; продолжение выравнивается по открывающей скобке. */
function stepSignature(step) {
  const head = `static fl_status ${step}(`
  return `${head}fl_ctx *ctx, const fl_value *args, fl_bounce *bounce, fl_value *result,\n${" ".repeat(head.length)}fl_error *error)`
}

function createContext(fn, shared, { selfTail, members }) {
  const ctx = {
    shared,
    fn,
    scope: new Map(),
    taken: new Set([...C_RESERVED, "args", "bounce", "values", "items"]),
    params: [],
    selfTail,
    members,
    temp() {
      shared.counter += 1
      return `fl_t${shared.counter}`
    },
    fresh(name) {
      let wanted = snake(name)
      if (/^fl_/u.test(wanted) || /^[0-9]/u.test(wanted)) wanted = `v_${wanted}`
      let candidate = wanted
      let suffix = 1
      while (ctx.taken.has(candidate)) {
        suffix += 1
        candidate = `${wanted}_${suffix}`
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

/* ── хвостовая позиция: здесь живут `*result = …; return FL_OK;`, `continue` и отскоки ── */

function emitTail(expr, ctx, out, pad) {
  const node = requireExpr(expr)
  switch (node.kind) {
    case "let": {
      const value = emitValue(node.value, ctx, out, pad)
      requireName(node.name, "let", "name", node.span)
      const ident = ctx.fresh(node.name)
      out.push(`${pad}const fl_value ${ident} = ${value}; /* пусть «${node.name}» */`)
      const at = out.length
      const previous = ctx.bind(node.name, ident)
      emitTail(node.in ?? node.body, ctx, out, pad)
      ctx.unbind(node.name, previous)
      guardUnused(out, at, [ident], pad)
      return
    }
    case "if": {
      const flag = emitCondition(node.cond, ctx, out, pad, "fl_cond")
      out.push(`${pad}if (${flag}) {`)
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
      const args = (node.args ?? []).map((argument) => emitValue(argument, ctx, out, pad))
      if (ctx.selfTail && node.name === ctx.fn.name) {
        /* Самовызов в хвосте — это цикл. Присваивание параметров идёт по
           очереди, поэтому аргумент, который ещё читает старое значение
           параметра, обязан сперва лечь во временное. */
        const temps = args.map((argument) => {
          if (/^[A-Za-z_][\w]*$/u.test(argument) && !ctx.params.includes(argument)) return argument
          const temp = ctx.temp()
          out.push(`${pad}const fl_value ${temp} = ${argument};`)
          return temp
        })
        ctx.params.forEach((param, index) => {
          out.push(`${pad}${param} = ${temps[index]};`)
        })
        out.push(
          `${pad}/* виток цикла — тоже шаг: незавершающийся самовызов обязан упереться в лимит */`,
          `${pad}FL_TRY(fl_tick(ctx, ${cstring(ctx.fn.name)}, error));`,
          `${pad}continue;`,
        )
        return
      }
      if (ctx.members !== null && ctx.members.has(node.name)) {
        out.push(`${pad}/* хвостовой вызов «${node.name}» — отскок, а не кадр стека */`)
        args.forEach((argument, index) => {
          out.push(`${pad}bounce->args[${index}] = ${argument};`)
        })
        out.push(`${pad}bounce->next = ${ctx.shared.stepIdents.get(node.name)};`, `${pad}return FL_OK;`)
        return
      }
      out.push(
        `${pad}return ${ctx.shared.functionIdents.get(callee.name)}(ctx${args.length > 0 ? `, ${args.join(", ")}` : ""}, result, error);`,
      )
      return
    }
    default: {
      const value = emitValue(node, ctx, out, pad)
      out.push(`${pad}*result = ${value};`, `${pad}return FL_OK;`)
    }
  }
}

/* ── значение: возвращает выражение C, попутно печатая нужные ему операторы ── */

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
      const temp = ctx.temp()
      out.push(
        `${pad}fl_value ${temp} = fl_nothing();`,
        `${pad}FL_TRY(fl_field_get(ctx, ${target}, ${cstring(node.field)}, &${temp}, error));`,
      )
      return temp
    }
    case "let": {
      const value = emitValue(node.value, ctx, out, pad)
      requireName(node.name, "let", "name", node.span)
      const ident = ctx.fresh(node.name)
      out.push(`${pad}const fl_value ${ident} = ${value}; /* пусть «${node.name}» */`)
      const at = out.length
      const previous = ctx.bind(node.name, ident)
      const body = emitValue(node.in ?? node.body, ctx, out, pad)
      ctx.unbind(node.name, previous)
      guardUnused(out, at, [ident], pad)
      return body
    }
    case "if": {
      const flag = emitCondition(node.cond, ctx, out, pad, "fl_cond")
      const temp = ctx.temp()
      out.push(`${pad}fl_value ${temp} = fl_nothing();`, `${pad}if (${flag}) {`)
      assignInto(node.then, ctx, out, `${pad}  `, temp)
      out.push(`${pad}} else {`)
      assignInto(node.else, ctx, out, `${pad}  `, temp)
      out.push(`${pad}}`)
      return temp
    }
    case "match": {
      const temp = ctx.temp()
      out.push(`${pad}fl_value ${temp} = fl_nothing();`)
      emitMatch(node, ctx, out, pad, temp)
      return temp
    }
    case "call": {
      const callee = resolveCall(node, ctx)
      const args = (node.args ?? []).map((argument) => emitValue(argument, ctx, out, pad))
      const temp = ctx.temp()
      out.push(
        `${pad}fl_value ${temp} = fl_nothing();`,
        `${pad}FL_TRY(${ctx.shared.functionIdents.get(callee.name)}(ctx${args.length > 0 ? `, ${args.join(", ")}` : ""}, &${temp}, error));`,
      )
      return temp
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
      const temp = ctx.temp()
      out.push(
        `${pad}fl_value ${temp} = fl_nothing(); /* «${canonical}» */`,
        `${pad}FL_TRY(${помощникФормы(canonical, node, BUILTIN_HELPERS, СУФФИКС_ДОКАЗАННОГО)}(ctx${rendered.length > 0 ? `, ${rendered.join(", ")}` : ""}, &${temp}, error));`,
      )
      return temp
    }
    case "binary": {
      const left = emitValue(node.left, ctx, out, pad)
      const right = emitValue(node.right, ctx, out, pad)
      if (node.op === "eq" || node.op === "neq") {
        /* Равенство ошибок не даёт: сравнимо всё со всем (SPEC, раздел 5). */
        return node.op === "eq"
          ? `fl_flag(fl_equal(${left}, ${right}))`
          : `fl_flag(!fl_equal(${left}, ${right}))`
      }
      const helper = BINARY_HELPERS.get(node.op)
      if (helper === undefined) {
        throw flangError("FLANG_TYPE", `неизвестная операция «${node.op}»`, node.span)
      }
      const temp = ctx.temp()
      out.push(
        `${pad}fl_value ${temp} = fl_nothing();`,
        `${pad}FL_TRY(${helper}(ctx, ${left}, ${right}, &${temp}, error));`,
      )
      return temp
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
 * Связанное, но не использованное имя — обычное дело в языке с образцами
 * («случай голова и хвост», а голова телу не нужна). В C это -Wunused-variable,
 * то есть с -Werror ошибка сборки. Молча не объявлять такую переменную нельзя:
 * привязка обязана вычислиться (у варианта она может дать FLANG_UNKNOWN_NAME).
 * Поэтому объявляем всегда, а неиспользованные гасим `(void)имя;` — тем же
 * приёмом, каким это делают руками.
 */
function guardUnused(out, at, idents, pad) {
  if (idents.length === 0) return
  const text = out.slice(at).join("\n")
  const unused = idents.filter((ident) => !new RegExp(`\\b${ident}\\b`, "u").test(text))
  if (unused.length > 0) out.splice(at, 0, ...unused.map((ident) => `${pad}(void)${ident};`))
}

/** Вычислить выражение и положить результат в уже объявленную переменную. */
function assignInto(expr, ctx, out, pad, target) {
  const value = emitValue(expr, ctx, out, pad)
  out.push(`${pad}${target} = ${value};`)
}

/** Признак из значения: `если` и `отфильтровать` требуют именно признак. */
function emitCondition(expr, ctx, out, pad, helper) {
  const value = emitValue(expr, ctx, out, pad)
  const flag = ctx.temp()
  out.push(`${pad}bool ${flag} = false;`, `${pad}FL_TRY(${helper}(ctx, ${value}, &${flag}, error));`)
  return flag
}

/* ── литералы ── */

function emitLiteral(value, ctx, out, pad) {
  if (value === undefined || value === null) return "fl_nothing()"
  if (typeof value === "boolean") return `fl_flag(${value ? "true" : "false"})`
  if (typeof value === "number") {
    if (needsMath(value)) ctx.shared.needsMath = true
    return `fl_number(${cnumber(value)})`
  }
  if (typeof value === "string") return textLiteral(ctx.shared, value)
  if (Array.isArray(value)) {
    return emitList(value.map((item) => (out2, pad2) => emitLiteral(item, ctx, out2, pad2)), ctx, out, pad)
  }
  if (typeof value === "object") {
    const keys = Object.keys(value)
    const values = keys.map((key) => emitLiteral(value[key], ctx, out, pad))
    return emitValues(keys, values, null, ctx, out, pad)
  }
  throw flangError("FLANG_PARSE", `литерал недопустимого вида: ${typeof value}`)
}

/**
 * Строковый литерал — константа уровня файла, а не вызов конструктора: длина в
 * байтах и в кодовых точках известна при печати, считать её в рантайме на
 * каждом обращении незачем.
 */
function textLiteral(shared, value) {
  const key = `s:${value}`
  const existing = shared.nameArrays.get(key)
  if (existing !== undefined) return existing
  const ident = `${shared.prefix}_text_${shared.nameArrays.size + 1}`
  shared.nameArrays.set(key, ident)
  const bytes = Buffer.byteLength(value, "utf8")
  const points = Array.from(value).length
  shared.statics.push(
    `static const fl_value ${ident} = { FL_STRING, { .string = { ${cstring(value)}, ${bytes}, ${points} } } };`,
  )
  return ident
}

/* ── составные значения ── */

function emitList(makers, ctx, out, pad) {
  if (makers.length === 0) return "fl_list(NULL, 0)"
  const items = ctx.temp()
  out.push(
    `${pad}fl_value *${items} = NULL;`,
    `${pad}FL_TRY(fl_list_alloc(ctx, ${makers.length}, &${items}, error));`,
  )
  makers.forEach((make, index) => {
    const value = make(out, pad)
    out.push(`${pad}${items}[${index}] = ${value};`)
  })
  return `fl_list(${items}, ${makers.length})`
}

function emitFields(fields, variantName, ctx, out, pad) {
  const keys = Object.keys(fields)
  const values = keys.map((key) => emitValue(fields[key], ctx, out, pad))
  return emitValues(keys, values, variantName, ctx, out, pad)
}

function emitValues(keys, values, variantName, ctx, out, pad) {
  const temp = ctx.temp()
  const namesIdent = nameArray(ctx.shared, keys)
  if (keys.length > 0) {
    const array = ctx.temp()
    out.push(`${pad}fl_value ${array}[${keys.length}];`)
    keys.forEach((key, index) => {
      out.push(`${pad}${array}[${index}] = ${values[index]}; /* «${key}» */`)
    })
    out.push(`${pad}fl_value ${temp} = fl_nothing();`)
    out.push(
      variantName === null
        ? `${pad}FL_TRY(fl_record_new(ctx, ${namesIdent}, ${array}, ${keys.length}, &${temp}, error));`
        : `${pad}FL_TRY(fl_variant_new(ctx, ${cstring(variantName)}, ${namesIdent}, ${array}, ${keys.length}, &${temp}, error));`,
    )
    return temp
  }
  out.push(`${pad}fl_value ${temp} = fl_nothing();`)
  out.push(
    variantName === null
      ? `${pad}FL_TRY(fl_record_new(ctx, NULL, NULL, 0, &${temp}, error));`
      : `${pad}FL_TRY(fl_variant_new(ctx, ${cstring(variantName)}, NULL, NULL, 0, &${temp}, error));`,
  )
  return temp
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

  /* Составной литерал в образце строится оператором, а не выражением, поэтому
     все проверки готовятся до цепочки `if` — иначе оператор оказался бы внутри
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
      /* Образец, совпадающий всегда: `else` честнее, чем `if (true)`. */
      out.push(opened ? `${pad}} else {` : `${pad}{`)
      opened = true
      emitBranch(branch, subject, ctx, out, `${pad}  `, target)
      out.push(`${pad}}`)
      closed = true
      break
    }
    out.push(opened ? `${pad}} else if (${test}) {` : `${pad}if (${test}) {`)
    opened = true
    emitBranch(branch, subject, ctx, out, `${pad}  `, target)
  }
  if (closed) return
  if (opened) {
    out.push(`${pad}} else {`, `${pad}  return fl_match_fail(ctx, ${subject}, error);`, `${pad}}`)
  } else {
    out.push(`${pad}return fl_match_fail(ctx, ${subject}, error);`)
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
    /* Цепочка — список либо строка: `пусто` и `голова и хвост` разбирают обе
       (fl_chain_* в flang_runtime.c). Различать их здесь нечем — у печати нет
       типов, — да и незачем: проверка тега стоит одну ветку. */
    case "empty":
      return `fl_chain_empty(${subject})`
    case "cons":
      return `fl_chain_cons(${subject})`
    case "variant":
      return `fl_variant_is(${subject}, ${cstring(pattern.name)})`
    case "literal": {
      const literal = emitLiteral(pattern.value, ctx, out, pad)
      return `fl_equal(${subject}, ${literal})`
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
    out.push(`${pad}const fl_value ${ident} = ${code};${comment}`)
    undo.push({ name, ident, previous: ctx.bind(name, ident) })
  }
  switch (pattern.kind) {
    case "cons":
      if (pattern.head !== undefined && pattern.head !== null) {
        bind(pattern.head, `fl_chain_head(${subject})`, ` /* голова «${pattern.head}» */`)
      }
      if (pattern.tail !== undefined && pattern.tail !== null) {
        /* Хвост — срез, а не копия: значения неизменяемы, память общая. У
           строки голова — одна кодовая точка, хвост — остаток. */
        bind(pattern.tail, `fl_chain_tail(${subject})`, ` /* хвост «${pattern.tail}» */`)
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
        out.push(
          `${pad}fl_value ${ident} = fl_nothing();`,
          `${pad}FL_TRY(fl_variant_field(ctx, ${subject}, ${cstring(field)}, &${ident}, error)); /* «${field}» */`,
        )
        undo.push({ name, ident, previous: ctx.bind(name, ident) })
      }
      return undo
    }
    case "any":
      if (typeof pattern.bind === "string") bind(pattern.bind, subject, "")
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
  const list = ctx.temp()
  out.push(
    `${pad}fl_value ${list} = fl_nothing();`,
    `${pad}FL_TRY(fl_require_list(ctx, ${over}, "свёртка", &${list}, error));`,
  )
  const init = emitValue(node.init, ctx, out, pad)
  const accIdent = ctx.fresh(node.acc)
  const index = ctx.temp()
  out.push(
    `${pad}fl_value ${accIdent} = ${init}; /* «${node.acc}» */`,
    `${pad}for (size_t ${index} = 0; ${index} < ${list}.as.list.count; ${index} += 1) {`,
  )
  const itemIdent = ctx.fresh(node.item)
  out.push(`${pad}  const fl_value ${itemIdent} = ${list}.as.list.items[${index}]; /* «${node.item}» */`)

  const at = out.length
  const undoAcc = ctx.bind(node.acc, accIdent)
  const undoItem = ctx.bind(node.item, itemIdent)
  assignInto(node.body, ctx, out, `${pad}  `, accIdent)
  ctx.unbind(node.item, undoItem)
  ctx.unbind(node.acc, undoAcc)
  guardUnused(out, at, [itemIdent], `${pad}  `)

  out.push(`${pad}}`)
  return accIdent
}

function emitLoop(node, ctx, out, pad) {
  requireName(node.item, node.kind, "item", node.span)
  const label = node.kind === "map" ? "отобразить" : "отфильтровать"
  const over = emitValue(node.over, ctx, out, pad)
  const list = ctx.temp()
  out.push(
    `${pad}fl_value ${list} = fl_nothing();`,
    `${pad}FL_TRY(fl_require_list(ctx, ${over}, ${cstring(label)}, &${list}, error));`,
  )
  const items = ctx.temp()
  const kept = ctx.temp()
  const index = ctx.temp()
  out.push(
    `${pad}fl_value *${items} = NULL;`,
    `${pad}size_t ${kept} = 0;`,
    `${pad}FL_TRY(fl_list_alloc(ctx, ${list}.as.list.count, &${items}, error));`,
    `${pad}for (size_t ${index} = 0; ${index} < ${list}.as.list.count; ${index} += 1) {`,
  )
  const itemIdent = ctx.fresh(node.item)
  out.push(`${pad}  const fl_value ${itemIdent} = ${list}.as.list.items[${index}]; /* «${node.item}» */`)

  const at = out.length
  const undo = ctx.bind(node.item, itemIdent)
  const inner = `${pad}  `
  if (node.kind === "map") {
    const value = emitValue(node.body, ctx, out, inner)
    out.push(`${inner}${items}[${kept}] = ${value};`, `${inner}${kept} += 1;`)
  } else {
    /* Тело фильтра — предикат: для отброшенных элементов ничего больше не
       вычисляется. */
    const flag = emitCondition(node.body, ctx, out, inner, "fl_keep")
    out.push(`${inner}if (${flag}) {`, `${inner}  ${items}[${kept}] = ${itemIdent};`, `${inner}  ${kept} += 1;`, `${inner}}`)
  }
  ctx.unbind(node.item, undo)
  guardUnused(out, at, [itemIdent], inner)
  out.push(`${pad}}`)
  return `fl_list(${items}, ${kept})`
}

/* ── вызов по имени ── */

function renderDispatch(shared) {
  const lines = [
    "/*",
    " * Вызов по исходному имени flang. Коды и тексты — те же, что у",
    " * интерпретатора: «не найдена функция …» и «функция … принимает N аргум.».",
    " */",
    `fl_status ${shared.prefix}_call(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,`,
    "                    fl_value *result, fl_error *error) {",
  ]
  /* `args` читается только там, где есть что читать. Пустая программа — не
     единственный такой случай: программа из одних функций без параметров
     («Метка» без аргументов) тоже не трогает args, и под -Werror
     -Wunused-parameter это несобираемый C. Условие поэтому по параметрам, а не
     по числу функций. */
  const readsArgs = [...shared.prepared.functions.values()].some((fn) => fn.params.length > 0)
  if (!readsArgs) lines.push("  (void)args;")
  for (const fn of shared.prepared.functions.values()) {
    const arity = fn.params.length
    lines.push(
      `  if (strcmp(name, ${cstring(fn.name)}) == 0) {`,
      `    if (count != ${arity}) {`,
      `      return fl_fail(ctx, error, FL_CODE_TYPE, "функция «%s» принимает %lu аргум., получено %lu",`,
      `                     ${cstring(fn.name)}, (unsigned long)${arity}, (unsigned long)count);`,
      "    }",
      `    return ${shared.functionIdents.get(fn.name)}(ctx${
        arity === 0 ? "" : `, ${Array.from({ length: arity }, (_, index) => `args[${index}]`).join(", ")}`
      }, result, error);`,
      "  }",
    )
  }
  lines.push(
    '  return fl_fail(ctx, error, FL_CODE_UNKNOWN_NAME, "не найдена функция «%s»", name);',
    "}",
  )
  return lines.join("\n")
}

/* ── граница входа: объявленные типы параметров данными ── */

const ВИДЫ_ТИПА = new Map([
  ["число", "FL_TYPE_NUMBER"],
  ["строка", "FL_TYPE_STRING"],
  ["признак", "FL_TYPE_FLAG"],
  ["ничто", "FL_TYPE_NULL"],
  ["список", "FL_TYPE_LIST"],
  ["запись", "FL_TYPE_RECORD"],
  ["сумма", "FL_TYPE_SUM"],
])

/**
 * Объявленные типы параметров — ТАБЛИЦЕЙ, а не кодом.
 *
 * Зачем она вообще. В напечатанной программе типов нет: прогонщик разбирает
 * JSON и зовёт функцию. Поэтому `«Факториал» принимает н: нат` считался при `н`
 * равном −3 и 2.5, а при 1e300 упирался в FLANG_RECURSION_LIMIT — код, который
 * SPEC отводит ОБЫЧНОЙ функции. Тотальная отказывала пределом глубины потому,
 * что доказательство её завершения СТОИТ НА ТИПЕ: у `нат` есть потолок 2^53−1,
 * ниже которого `н минус 1` точно меньше `н`, и сторож убывания в такую функцию
 * не печатается вовсе. Значение вне типа выносит вместе с типом и
 * доказательство, и ловить вечную цепочку нечем.
 *
 * Почему данными, а не кодом. Сверяет их один и тот же `fl_check_entry`
 * (flang_runtime.c), напечатанный байт в байт для всех программ: разойдись
 * восемь целей в понимании слов «значение подходит типу» — и разошлись бы они
 * молча. Строит таблицу `таблицаВхода` из flang/src/types.mjs, то есть тот же
 * файл, что отвечает на этот вопрос для `flang run --args`.
 *
 * Ссылки на типы — индексами, потому что тип элемента списка это тоже тип, а
 * складывать их вложением значило бы печатать один и тот же `число` столько
 * раз, сколько он встретился.
 */
function renderEntry(таблица, shared) {
  const prefix = shared.prefix
  const lines = [
    "/*",
    " * Граница входа: объявленные типы параметров данными. Прогонщик сверяет по",
    " * ним значения, пришедшие снаружи, ДО вызова (fl_check_entry).",
    " *",
    " * Виды `неизвестно` (значение-функция, параметр полиморфизма, применение",
    " * типа с аргументами) не сверяются — ровно как молчит о них проверка",
    " * значений эталона.",
    " */",
  ]
  if (таблица.параметры.length === 0) {
    /* Массив нулевой длины в C99 незаконен, поэтому «сверять нечего» — это NULL
       и ноль, а не пустой массив. */
    lines.push(`static const fl_entry_table ${prefix}_entry_table = { NULL, 0, NULL, 0, NULL, 0, NULL, 0 };`)
  } else {
    if (таблица.поля.length > 0) {
      lines.push(
        `static const fl_type_field ${prefix}_entry_fields[] = {`,
        ...таблица.поля.map((поле) => `  { ${cstring(поле.имя)}, ${поле.тип} },`),
        "};",
        "",
      )
    }
    if (таблица.варианты.length > 0) {
      lines.push(
        `static const fl_type_variant ${prefix}_entry_variants[] = {`,
        ...таблица.варианты.map((вариант) =>
          `  { ${cstring(вариант.имя)}, ${вариант.полеС}, ${вариант.полей} },`),
        "};",
        "",
      )
    }
    lines.push(
      `static const fl_type ${prefix}_entry_types[] = {`,
      ...таблица.типы.map((тип) =>
        `  { ${ВИДЫ_ТИПА.get(тип.вид) ?? "FL_TYPE_UNKNOWN"}, ${cstring(тип.имя)}, ${cstring(тип.владелец)}, ` +
        `${тип.ничто}, ${тип.целое}, ${тип.отрезок}, ${cnumber(тип.низ)}, ${cnumber(тип.верх)}, ` +
        `${тип.элемент}, ${тип.полеС}, ${тип.полей}, ${тип.вариантС}, ${тип.вариантов} },`),
      "};",
      "",
      `static const fl_entry_param ${prefix}_entry_params[] = {`,
      ...таблица.параметры.map((параметр) =>
        `  { ${cstring(параметр.функция)}, ${cstring(параметр.параметр)}, ${параметр.тип} },`),
      "};",
      "",
      `static const fl_entry_table ${prefix}_entry_table = {`,
      `  ${prefix}_entry_types, ${таблица.типы.length},`,
      `  ${таблица.поля.length === 0 ? "NULL" : `${prefix}_entry_fields`}, ${таблица.поля.length},`,
      `  ${таблица.варианты.length === 0 ? "NULL" : `${prefix}_entry_variants`}, ${таблица.варианты.length},`,
      `  ${prefix}_entry_params, ${таблица.параметры.length}`,
      "};",
    )
  }
  lines.push("", `const fl_entry_table *${prefix}_entry(void) {`, `  return &${prefix}_entry_table;`, "}")
  return lines.join("\n")
}

/* ═══════════════════════════ конкурентность ═══════════════════════════
   Процессы, надзоры и прогоны печатаются ДАННЫМИ — таблицами уровня файла, а не
   кодом. Причина та же, по какой так сделано в Elixir: надзор в flang —
   объявление, и одно объявление обязано остаться одним местом в напечатанном
   коде. Печать готового планировщика на каждую программу размазала бы его по
   файлу и превратила правку одной строки исходника в правку десятка строк
   вывода — а сам планировщик (flang_conc.c) при этом обязан остаться одним и
   тем же для всех программ, иначе сверять с эталоном пришлось бы не модель, а
   каждую печать по отдельности.
   ═══════════════════════════════════════════════════════════════════════════ */

function renderConcurrency(program, processes, shared) {
  const prefix = shared.prefix
  const supervisors = Array.isArray(program.supervisors) ? program.supervisors : []
  const runs = Array.isArray(program.runs) ? program.runs : []
  const totals = new Set(
    (program.functions ?? []).filter((fn) => fn?.total === true).map((fn) => fn.name),
  )
  const lines = [
    "/* ── План конкурентности: процессы, надзоры и прогоны данными ── */",
    "",
  ]

  /* Запас витков ставится ТОЛЬКО нетотальному обработчику: про тотальный
     доказано, что он завершится, и считать ему нечего — ровно так же решает
     планировщик эталона, и разойтись здесь было бы нельзя, потому что от этого
     зависит, каким кодом кончится отказ. */
  lines.push(`static const fl_conc_process ${prefix}_conc_processes[] = {`)
  processes.forEach((node, index) => {
    const total = totals.has(node.handler)
    const budget = !total && Number.isFinite(node.budget) ? Math.trunc(node.budget) : 0
    /* Ноль — «ящик неограничен», ровно как ноль в запасе значит «считать
       нечего»: два разных смысла у нуля здесь не сталкиваются, потому что
       размер ящика в ноль сообщений проверка типов не пропускает. */
    const mailbox = Number.isFinite(node.mailbox) && node.mailbox > 0 ? Math.trunc(node.mailbox) : 0
    const tail = index + 1 < processes.length ? "," : ""
    lines.push(
      `  { ${cstring(node.name)}, ${cstring(node.handler)}, ${cstring(node.initial)}, ` +
        `${total ? "true" : "false"}, ${budget}, ${mailbox} }${tail}`,
    )
  })
  lines.push("};", "")

  /* Дети надзора — отдельными массивами: массив нулевой длины в C99 незаконен,
     поэтому пустой список печатается как NULL, а не как `{}`. */
  supervisors.forEach((node, index) => {
    const watch = node.watch ?? []
    const nested = node.nested ?? []
    if (watch.length > 0) {
      lines.push(
        `static const fl_conc_child ${prefix}_conc_watch_${index + 1}[] = {`,
        ...watch.map((item, at) =>
          `  { ${cstring(item.process)}, ${cstring(item.strategy)} }${at + 1 < watch.length ? "," : ""}`),
        "};",
      )
    }
    if (nested.length > 0) {
      lines.push(
        `static const fl_conc_child ${prefix}_conc_nested_${index + 1}[] = {`,
        ...nested.map((item, at) =>
          `  { ${cstring(item.supervisor)}, ${cstring(item.strategy)} }${at + 1 < nested.length ? "," : ""}`),
        "};",
      )
    }
  })
  if (supervisors.length > 0) {
    lines.push("", `static const fl_conc_supervisor ${prefix}_conc_supervisors[] = {`)
    supervisors.forEach((node, index) => {
      const watch = node.watch ?? []
      const nested = node.nested ?? []
      const threshold = node.threshold ?? null
      const tail = index + 1 < supervisors.length ? "," : ""
      lines.push(
        `  { ${cstring(node.name)},` +
          ` ${watch.length === 0 ? "NULL" : `${prefix}_conc_watch_${index + 1}`}, ${watch.length},` +
          ` ${nested.length === 0 ? "NULL" : `${prefix}_conc_nested_${index + 1}`}, ${nested.length},` +
          ` ${threshold === null ? "false, 0.0, 0.0, NULL" : `true, ${cnumber(threshold.failures)}, ${cnumber(threshold.window)}, ${cstring(threshold.otherwise)}`} }${tail}`,
      )
    })
    lines.push("};", "")
  }

  /* Входные сообщения прогона — функцией, а не таблицей: сообщение это значение
     flang, а значения строятся в арене и до вызова не существуют. Печатается
     оно тем же аппаратом литералов, что и всё остальное в программе. */
  runs.forEach((run, index) => {
    const inbox = run.inbox ?? []
    if (inbox.length === 0) return
    const body = []
    const ctx = {
      shared,
      temp() {
        shared.counter += 1
        return `t${shared.counter}`
      },
    }
    const values = inbox.map((entry) => emitMessage(entry.message, ctx, body, "  "))
    lines.push(
      `/* Кому адресованы входные сообщения прогона «${run.name}». */`,
      `static const char *const ${prefix}_conc_targets_${index + 1}[] = {`,
      ...inbox.map((entry, at) => `  ${cstring(entry.process)}${at + 1 < inbox.length ? "," : ""}`),
      "};",
      "",
      `/* Сами сообщения прогона «${run.name}». */`,
      `static fl_status ${prefix}_conc_inbox_${index + 1}(fl_ctx *ctx, fl_value *messages, fl_error *error) {`,
    )
    /* Скаляр и строка строятся без арены и без диагностики, поэтому у прогона
       из одних скаляров оба параметра остались бы нетронутыми — а это
       -Wunused-parameter, то есть несобираемый C под флагами контракта. */
    if (body.length === 0) lines.push("  (void)ctx;", "  (void)error;")
    lines.push(...body)
    values.forEach((value, at) => lines.push(`  messages[${at}] = ${value};`))
    lines.push("  return FL_OK;", "}", "")
  })

  if (runs.length > 0) {
    lines.push(`static const fl_conc_run_spec ${prefix}_conc_runs[] = {`)
    runs.forEach((run, index) => {
      const inbox = run.inbox ?? []
      const to = run.seedTo === null || run.seedTo === undefined ? run.seed : run.seedTo
      const tail = index + 1 < runs.length ? "," : ""
      lines.push(
        `  { ${cstring(run.name)}, ${cnumber(run.seed)}, ${cnumber(to)},` +
          ` ${inbox.length === 0 ? "NULL" : `${prefix}_conc_targets_${index + 1}`}, ${inbox.length},` +
          ` ${inbox.length === 0 ? "NULL" : `${prefix}_conc_inbox_${index + 1}`} }${tail}`,
      )
    })
    lines.push("};", "")
  }

  lines.push(
    `static const fl_conc_plan ${prefix}_conc = {`,
    `  ${prefix}_conc_processes, ${processes.length},`,
    `  ${supervisors.length === 0 ? "NULL" : `${prefix}_conc_supervisors`}, ${supervisors.length},`,
    `  ${runs.length === 0 ? "NULL" : `${prefix}_conc_runs`}, ${runs.length},`,
    `  ${prefix}_call`,
    "};",
    "",
    `const fl_conc_plan *${prefix}_conc_plan(void) {`,
    `  return &${prefix}_conc;`,
    "}",
  )
  return lines.join("\n")
}

/**
 * Литерал входного сообщения прогона.
 *
 * Отдельно от `emitLiteral`, а не вместо него, по одной причине: вариант в AST
 * записан объектом `{ variant, fields }` (так его читает `reifyValue`
 * интерпретатора), и `emitLiteral` печатает такой объект ЗАПИСЬЮ с полями
 * «variant» и «fields». Для сообщения прогона это была бы прямая ошибка —
 * обработчик не сопоставил бы его ни с одним образцом, — а править сам
 * `emitLiteral` значило бы менять печать всех программ подряд ради одного
 * места, то есть трогать неподвижную точку самоприменения без нужды.
 */
function emitMessage(value, ctx, out, pad) {
  if (Array.isArray(value)) {
    return emitList(value.map((item) => (out2, pad2) => emitMessage(item, ctx, out2, pad2)), ctx, out, pad)
  }
  if (value !== null && typeof value === "object") {
    const encoded = encodedVariant(value)
    const source = encoded === null ? value : encoded.fields
    const keys = Object.keys(source)
    const values = keys.map((key) => emitMessage(source[key], ctx, out, pad))
    return emitValues(keys, values, encoded === null ? null : encoded.variant, ctx, out, pad)
  }
  return emitLiteral(value, ctx, out, pad)
}

/** Объект ровно с двумя полями `variant` и `fields` — это вариант, а не запись. */
function encodedVariant(value) {
  if (value === null || Array.isArray(value)) return null
  const keys = Object.keys(value)
  if (keys.length !== 2 || !keys.includes("variant") || !keys.includes("fields")) return null
  if (typeof value.variant !== "string" || value.variant === "") return null
  const fields = value.fields
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) return null
  return { variant: value.variant, fields }
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
