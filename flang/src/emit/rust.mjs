/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
// emit/rust.mjs — печать программы flang в Rust.
//
// ── Зачем ──────────────────────────────────────────────────────────────────
// Печать в JS (emit/js.mjs) даёт модуль для Node и браузера, печать в C
// (emit/c.mjs) — переносимость до NetBSD и RISC-V, печать в Go (emit/go.mjs) —
// один статический файл в контейнер. Rust закрывает нишу, которой не закрывает
// ни один из трёх: встраивание в чужую программу без сборщика мусора и без
// рантайма — библиотека, которую линкуют в приложение, в ядро WebAssembly или
// в расширение базы данных, и которая при этом не может ни упасть по стеку
// молча, ни потерять память, ни уронить процесс паникой.
//
// ── Что здесь принципиально иначе, чем в бэкендах C, Go и JS ────────────────
// Общее сохранено намеренно, чтобы четыре бэкенда читались как одна система:
// тот же обход AST, то же решение арности при печати, тот же протокол
// прогонщика, та же транслитерация имён через flang/src/naming.mjs, и
// коллизия после транслитерации — ошибка печати, а не тихое переименование.
//
// Расходится же Rust с остальными ровно там, где расходятся сами языки.
//
// 1. СУММЫ ТИПОВ. У Rust, в отличие от C и Go, есть настоящий `enum`, и
//    соблазн напечатать каждую сумму flang своим `enum` велик. Он обманчив, и
//    ровно по тем причинам, по которым в Go был отвергнут интерфейс с
//    методом-маркером. SPEC требует структурного равенства ЛЮБЫХ двух значений
//    (а «любых» — значит разнотипных), сообщения «разбор не покрывает значение
//    Лист(значение)» с именем варианта и его полей, доступа к полю ПО ИМЕНИ,
//    которое приезжает из AST строкой, и приёма значения снаружи — из
//    прогонщика, теста, чужого языка через трубу. В Rust это либо `dyn Any` с
//    нисходящим приведением, либо внешний крейт сериализации, то есть второе,
//    теневое представление рядом с первым. Два представления одного значения
//    дают два набора расхождений с интерпретатором.
//
//    Поэтому представление одно — `rt::Value`, — а типизированный слой поверх
//    него печатается функциями-конструкторами: на каждый вариант суммы и на
//    каждую запись своя функция с именованными параметрами. Настоящий `enum`
//    Rust при этом всё же выигран, и это не мелочь: в Go тег и поля лежали в
//    одной структуре и «число со списком внутри» было представимо, здесь
//    недопустимое состояние не выражается вовсе.
//
// 2. ВЛАДЕНИЕ. Значение рекурсивно (список значений, поля значений), значит
//    нужен указатель: `Box` или `Rc`. Взят `Rc`, и держится он везде. Причина
//    не в удобстве: «хвост» обязан отдавать суффикс списка без копирования,
//    иначе рекурсия «голова и хвост» становится квадратичной, а `Box` —
//    единственное владение, при котором суффикс пришлось бы копировать.
//    Следствие для печати важнее причины: клонирование значения стоит один
//    инкремент счётчика, поэтому напечатанный код клонирует при каждом чтении
//    имени и нигде не борется с проверкой заимствований — ни `&`, ни времён
//    жизни в сгенерированном коде нет вовсе.
//
// 3. ЧИСЛА. Все числа flang — IEEE-754 double, значит везде `f64`, в том числе
//    там, где число выглядит целым. Печать числа обязана давать тот же текст,
//    что Number::toString («1», а не «1.0», «1e+21», а не
//    «1000000000000000000000»), поэтому в рантайме лежит `number_text` —
//    правила ECMAScript дословно. Ни `{}`, ни `{:e}` не годятся: первый не
//    переходит к экспоненте никогда, второй всегда, а ECMAScript — по своим
//    порогам.
//
// 4. СТРОКИ. Rust индексирует `str` байтами, flang считает кодовыми точками.
//    Отсюда `chars()` в «длина», «символ» и «подстрока» — иначе «мир 🌍»
//    оказался бы длиной 8, а не 5, а срез по байтовому индексу ещё и паниковал
//    бы на середине символа.
//
// 5. ПАНИКА НЕДОПУСТИМА. Ошибка flang — это ответ программы («такой скидки не
//    бывает»), а не сломанный инвариант, и у неё есть код и текст, обязанные
//    дословно совпасть с интерпретатором. `panic!` не несёт ни кода, ни
//    текста, разворачивает стек и при `panic = "abort"` убивает процесс.
//    Поэтому каждая функция возвращает `Result<rt::Value, rt::Error>`, а в
//    рантайме нет ни одного `unwrap`, ни одной индексации вычисленным
//    индексом. Сюда же переполнение стека: у Rust оно не паника, а аварийный
//    останов, поэтому прогонщик считает в потоке с большим стеком, а предел
//    глубины срабатывает раньше, чем стек кончается.
//
// 6. РОЛЬ ВХОДИТ В ИМЯ. Вариант и функция живут в Rust в одном пространстве
//    имён модуля, и одноимённые вариант и функция (в ядре FTS «Значение
//    операнда» — и то, и другое) дали бы два объявления одного идентификатора,
//    то есть код, который не компилируется. Поэтому имя строится из роли и
//    имени модели: «функция Х» → `funkciya_h`, «вариант Х» → `variant_h`,
//    «запись Х» → `zapis_h`. Роль не украшение, а часть контракта: без неё
//    столкновение ловилось бы компилятором целевого языка, а не бэкендом.
//
// 7. НЕИСПОЛЬЗОВАННОЕ ИМЯ. Как и в Go, связанное, но не использованное имя —
//    обычное дело в языке с образцами. В Rust это предупреждение, а под
//    `-D warnings` — ошибка, поэтому локальные имена гасятся `let _ = &имя;`
//    (заимствование, а не перемещение: перемещение сломало бы дальнейшее
//    использование), а неиспользованные параметры получают приставку `_`,
//    которая гасит и `unused_variables`, и `unused_assignments`.
//
// ── Крейт: библиотека плюс тонкий прогонщик ────────────────────────────────
// `src/lib.rs` — библиотека, `src/main.rs` — три строки, вызывающие её. Так
// один и тот же файл не попадает в два цели сборки (cargo за это ругается), а
// вся программа компилируется ровно один раз. Рантайм печатается в
// `src/runtime.rs` байт в байт из репозитория: он одинаков для всех программ.
//
// ── Главное требование: совпадение с interpret.mjs ─────────────────────────
// Сгенерированный код обязан давать то же значение и ту же ошибку (код И
// текст). Отсюда:
//
//   • строгий порядок вычисления слева направо: каждый узел, способный дать
//     ошибку, материализуется в оператор — порядок операторов и есть порядок
//     вычисления;
//   • проценты печатаются как `(процент / 100) * значение`;
//   • равенство скаляров — Object.is (NaN равен NaN, 0 не равен −0), никакого
//     сравнения с допуском: «0.1 плюс 0.2 равно 0.3» обязано быть ложью в обоих
//     движках.
//
// ── Хвостовая рекурсия: те же три случая, что в js.mjs, c.mjs и go.mjs ──────
//   • хвостовой самовызов → `loop { … }` с переприсваиванием параметров;
//   • взаимная хвостовая рекурсия (компонента сильной связности из двух и
//     более функций) → батут через указатели на функции;
//   • функция с постусловиями хвостовых вызовов не получает — интерпретатор
//     тоже не переиспользует кадр, которому есть что проверить после возврата.
//
// ── Пределы: и глубина, и шаги ─────────────────────────────────────────────
// Воспроизведены оба, как в бэкенде Go. Шаг здесь — вход в функцию, виток
// цикла хвостового самовызова и отскок батута; шаг интерпретатора — итерация
// его машины, а их на одно применение функции приходится много. Значит счётчик
// здесь всегда МЕНЬШЕ, и при одинаковом пределе интерпретатор упирается в
// лимит первым. Расхождение одностороннее и безопасное: напечатанный код не
// объявит исчерпанным то, что интерпретатор досчитал до конца.

import { readFileSync } from "node:fs"

import { canonicalBuiltinName, flangError, hasBuiltin, помощникФормы } from "../builtins.mjs"
import { требуетПланировщика } from "../conc.mjs"
import { defunctionalize } from "../defunc.mjs"
import { таблицаВхода } from "../types.mjs"
import { BIDI_CONTROLS, escapeBidiBraced, escapeBidiInFiles } from "../bidi.mjs"
import { createNamer, snake } from "../naming.mjs"

/* ═══════════════════════════════════════════════════════════════════════════
   Рантайм.

   Он лежит рядом настоящими .rs, а не строкой в этом файле: так его проверяет
   компилятор прямо в репозитории, а не только через тест печати, и правка
   рантайма не превращается в правку экранирования внутри шаблона. Печатается
   он байт в байт — только с шапкой «сгенерировано» перед первой строкой.
   ═══════════════════════════════════════════════════════════════════════════ */

const RUNTIME_DIRECTORY = new URL("./rust/", import.meta.url)
const RUNTIME_SOURCE = readFileSync(new URL("flang_runtime.rs", RUNTIME_DIRECTORY), "utf8")
const CLI_SOURCE = readFileSync(new URL("flang_cli.rs", RUNTIME_DIRECTORY), "utf8")

/* Имя крейта зафиксировано: прогонщик обращается к библиотеке по нему, и
   параметризовать его значило бы переписывать чужой файл при печати. Программе
   это ничего не стоит — крейт всё равно самодостаточен и ни от чего не
   зависит, а вложить его в свой проект можно одной строкой `path`. */
const CRATE = "flangprogram"

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
])

/* «mod» — ключевое слово Rust, поэтому двуместный остаток зовётся `modulo`;
   встроенная форма «остаток от» это отдельная функция с другими текстами
   диагностик, и путать их нельзя. */
const BINARY_HELPERS = new Map([
  ["add", "add"], ["sub", "sub"], ["mul", "mul"], ["div", "div"], ["mod", "modulo"],
  ["percent", "percent"], ["gt", "gt"], ["lt", "lt"], ["gte", "gte"], ["lte", "lte"],
  ["concat", "concat"],
])

/* Ключевые слова Rust всех изданий плюс зарезервированные на будущее. Сырым
   идентификатором (`r#type`) здесь не пользуемся: локальное имя дешевле
   развести приставкой, а имя из контракта модели, попавшее сюда, обязано быть
   ошибкой печати, а не тихим переименованием. */
const RUST_RESERVED = [
  "as", "break", "const", "continue", "crate", "dyn", "else", "enum", "extern", "false", "fn",
  "for", "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return",
  "self", "Self", "static", "struct", "super", "trait", "true", "type", "unsafe", "use", "where",
  "while", "async", "await", "try", "abstract", "become", "box", "do", "final", "macro",
  "override", "priv", "typeof", "unsized", "virtual", "yield", "union", "_",
  /* Имена, которые печатает сам бэкенд внутри тела функции. */
  "rt", "ctx", "args", "bounce", "main",
]

/* Имена верхнего уровня, которые печатает сам бэкенд в модуле программы. */
const OCCUPIED_BY_BACKEND = ["call", "new_context", "runtime", "cli", "program"]

/* Роли в именах верхнего уровня: без них одноимённые вариант и функция дали бы
   два объявления одного идентификатора (см. пункт 6 в шапке файла). */
const ROLE_FUNCTION = "функция"
const ROLE_VARIANT = "вариант"
const ROLE_RECORD = "запись"

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

/* ═══════════════════════════ литералы Rust ═══════════════════════════ */

/**
 * Строковый литерал Rust. Кириллица печатается как есть (исходник в UTF-8 —
 * ровно то, ради чего этот язык затевался: имена в коде обязаны читаться), а
 * экранируются кавычка, обратный слэш и управляющие символы.
 *
 * По символам, а не по байтам: файл записывается в UTF-8, и «Длина»,
 * разобранная на байты и собранная обратно как символы, превратилась бы в
 * двойную кодировку — имя перестало бы совпадать с именем в интерпретаторе.
 *
 * Двунаправленные управляющие (набор — bidi.mjs, общий на все бэкенды обоих
 * компиляторов) уезжают в `\u{X…}` — ту самую форму, которую предлагает сам
 * rustc в тексте отказа: `text_direction_codepoint_in_literal` deny-by-default,
 * то есть сырой символ здесь не предупреждение, а несобирающийся крейт. Скобки
 * закрывают экранирование, поэтому цифра следом к нему не приклеится.
 */
function ruststring(value) {
  let result = '"'
  for (const character of String(value)) {
    const code = character.codePointAt(0)
    if (character === '"') result += '\\"'
    else if (character === "\\") result += "\\\\"
    else if (character === "\n") result += "\\n"
    else if (character === "\r") result += "\\r"
    else if (character === "\t") result += "\\t"
    else if (code < 0x20 || code === 0x7f || BIDI_CONTROLS.has(code)) result += `\\u{${code.toString(16)}}`
    else result += character
  }
  return `${result}"`
}

/**
 * Число как литерал Rust.
 *
 * `String(value)` — кратчайшая запись, читающаяся обратно тем же double, и
 * литерал `f64` её принимает вместе с экспонентой и знаком в ней. Точка
 * дописывается там, где её нет: без неё «1» — целочисленный литерал, и хотя в
 * позиции `f64` он не пройдёт вовсе, читателю сгенерированного кода незачем
 * гадать. Чисел flang, не представимых как `f64`, не бывает по определению.
 *
 * NaN и бесконечности литералом в Rust не записываются — для них есть
 * константы `f64`. Минус ноль записывается литералом честно: `-0.0` это
 * отрицание нуля, и знак сохраняется, а Object.is его различает.
 */
function rustnumber(value) {
  if (Number.isNaN(value)) return "f64::NAN"
  if (value === Infinity) return "f64::INFINITY"
  if (value === -Infinity) return "f64::NEG_INFINITY"
  if (Object.is(value, -0)) return "-0.0"
  const text = String(value)
  return /[.e]/u.test(text) ? text : `${text}.0`
}

/** Только то, что Rust примет как идентификатор из ASCII. */
function ascii(identifier) {
  const cleaned = String(identifier).replace(/[^A-Za-z0-9_]/gu, "")
  if (cleaned.length === 0) return "value"
  return /^[0-9]/u.test(cleaned) ? `v${cleaned}` : cleaned
}

/** Имя модели → идентификатор Rust в змеином регистре. */
function rustSnake(value) {
  return ascii(snake(value))
}

/** Локальное имя: ключевое слово Rust разводится приставкой-подчёркиванием. */
function localIdent(value) {
  const identifier = rustSnake(value)
  return RUST_RESERVED.includes(identifier) ? `${identifier}_` : identifier
}

/* ═══════════════════════════ печать ═══════════════════════════ */

/**
 * Печать программы flang в Rust.
 *
 * @param {object} program AST flang (SPEC.md, раздел 5)
 * @param {{ path?: string, indexBase?: 0 | 1, maxDepth?: number, maxSteps?: number, cli?: boolean }} [options]
 * @returns {{ files: Array<{ path: string, content: string }> }}
 */
export function emitRust(program, options = {}) {
  /* Печать в цель без планировщика конкурентности невозможна, и молчать об этом
     нельзя: до этого отказа шесть целей из восьми ТЕРЯЛИ процессы, печатали
     обработчики обычными функциями и кончались кодом 0. Отказ стоит первым — до
     всякой работы, потому что печатать нечего вовсе (см. `conc.mjs`,
     `требуетПланировщика`). */
  требуетПланировщика(program, "rust")
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
  const file = options.path ?? (moduleName === null ? "program" : rustSnake(moduleName))

  /* Одно пространство имён на модуль Rust, поэтому один именователь на всё,
     что объявляется на верхнем уровне: функции, фабрики записей, конструкторы
     вариантов, шаги батута. Роль входит в имя (см. шапку файла), поэтому
     одноимённые вариант и функция расходятся, а «Сумма» и «сумма» — нет, и это
     ошибка печати, а не тихое переименование. */
  const exported = createNamer((name) => rustSnake(name), [...RUST_RESERVED, ...OCCUPIED_BY_BACKEND])

  const functionIdents = new Map()
  const factoryIdents = new Map()
  const variantIdents = new Map()
  for (const name of prepared.records.keys()) factoryIdents.set(name, exported(`${ROLE_RECORD} ${name}`))
  for (const name of prepared.variants.keys()) variantIdents.set(name, exported(`${ROLE_VARIANT} ${name}`))
  for (const name of prepared.functions.keys()) functionIdents.set(name, exported(`${ROLE_FUNCTION} ${name}`))

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
  for (const name of cyclic.keys()) stepIdents.set(name, exported(`шаг ${name}`))

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
  const withCli = options.cli !== false

  const files = [
    { path: "Cargo.toml", content: renderCargo(moduleName, withCli) },
    {
      path: "src/runtime.rs",
      content: `${banner(moduleName, "рантайм: значения, числа, строки, диагностики")}\n\n${RUNTIME_SOURCE}`,
    },
    {
      path: `src/${file}.rs`,
      content: renderSource(moduleName, [settings, ...bodies]),
    },
    { path: "src/lib.rs", content: renderLib(moduleName, file, withCli) },
  ]

  if (withCli) {
    files.push({
      path: "src/cli.rs",
      content: `${banner(moduleName, "прогонщик: JSON на входе, JSON на выходе")}\n\n${CLI_SOURCE}`,
    })
    files.push({ path: "src/main.rs", content: renderMain(moduleName) })
  }
  files.push({ path: "Makefile", content: renderMakefile(withCli) })
  /* Последний шаг — снять сырые двунаправленные управляющие со всего вывода
     (bidi.mjs). Литерал их уже экранировал сам, но имя FTS уезжает ещё и в
     комментарии — в шапку файла, в `///` над функцией, в комментарий Cargo.toml.
     Для rustc это не придирка: `text_direction_codepoint_in_comment` —
     deny-by-default, и до этого фильтра напечатанный крейт с таким именем не
     собирался вовсе. Форма Rust — `\u{X…}`, та же, что в литерале. */
  return { files: escapeBidiInFiles(files, escapeBidiBraced) }
}

function banner(moduleName, what) {
  return [
    "// Сгенерировано flang (бэкенд Rust, flang/src/emit/rust.mjs). Не редактировать руками.",
    moduleName === null ? "// Программа flang без имени модуля." : `// Модуль flang: «${moduleName}».`,
    `// Файл: ${what}.`,
    "// Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.",
  ].join("\n")
}

function renderCargo(moduleName, withCli) {
  return [
    `# Сгенерировано flang (бэкенд Rust)${moduleName === null ? "" : `, модуль «${moduleName}»`}. Не редактировать руками.`,
    "#",
    "# Зависимостей нет и не будет: программа flang считает и ничего больше, а",
    "# внешний крейт сделал бы сборку невозможной в офлайне.",
    "[package]",
    `name = "${CRATE}"`,
    'version = "0.0.0"',
    'edition = "2021"',
    "publish = false",
    "",
    "[lib]",
    `name = "${CRATE}"`,
    'path = "src/lib.rs"',
    "",
    ...(withCli
      ? [
        "# Прогонщик — три строки поверх библиотеки, а не второй её экземпляр: один",
        "# и тот же файл в двух целях сборки cargo считает неоднозначностью.",
        "[[bin]]",
        'name = "flang_cli"',
        'path = "src/main.rs"',
        "",
      ]
      : []),
    "[dependencies]",
    "",
  ].join("\n")
}

function renderMakefile(withCli) {
  return [
    "# Сгенерировано flang (бэкенд Rust). Флаги здесь — часть контракта бэкенда:",
    "# напечатанный код обязан собираться под -D warnings без единого замечания.",
    "CARGO ?= cargo",
    "",
    "all: build",
    "",
    "build:",
    "\tRUSTFLAGS='-D warnings' $(CARGO) build --offline",
    "",
    ...(withCli ? ["run:", "\t$(CARGO) run --offline --bin flang_cli", ""] : []),
    "check:",
    "\t$(CARGO) check --offline",
    "",
    "clean:",
    "\t$(CARGO) clean",
    "",
    ".PHONY: all build check clean" + (withCli ? " run" : ""),
    "",
  ].join("\n")
}

function renderLib(moduleName, file, withCli) {
  return [
    banner(moduleName, "крейт: библиотека программы"),
    "",
    moduleName === null
      ? "//! Программа flang, напечатанная в Rust."
      : `//! Программа flang «${moduleName}», напечатанная в Rust.`,
    "//!",
    "//! Зависимостей нет: только `std`. Функции возвращают `Result`, а не",
    "//! паникуют, — коды и тексты диагностик дословно те же, что у",
    "//! интерпретатора flang.",
    "",
    "/// Рантайм: значения flang, числа, строки, диагностики.",
    "pub mod runtime;",
    "",
    "/// Программа: функции flang, конструкторы значений, вызов по имени.",
    `pub mod ${file};`,
    "",
    "/* Имя модуля программы берётся из имени модуля flang и потому у каждой",
    "   программы своё. Прогонщик обязан обращаться к нему одинаково, поэтому",
    "   рядом лежит устойчивое имя. */",
    `pub use self::${file} as program;`,
    ...(withCli
      ? ["", "/// Прогонщик: JSON на входе, JSON на выходе.", "pub mod cli;"]
      : []),
    "",
  ].join("\n")
}

function renderMain(moduleName) {
  return [
    banner(moduleName, "прогонщик: точка входа"),
    "",
    "//! Три строки поверх библиотеки. Вся работа — в `cli`, вся программа — в",
    "//! библиотеке крейта: так один и тот же файл не попадает в две цели сборки.",
    "",
    "fn main() {",
    `    ${CRATE}::cli::main()`,
    "}",
    "",
  ].join("\n")
}

/* ── файл программы ── */

function renderSource(moduleName, bodies) {
  const head = [
    banner(moduleName, "реализация: функции, конструкторы значений, вызов по имени"),
    "",
    "//! Контракт вызова: функция возвращает `Ok(значение)` либо `Err(rt::Error)`",
    "//! с кодом и текстом, дословно совпадающими с интерпретатором flang. Паник",
    "//! здесь нет: диагностика — это значение.",
    "//!",
    "//! Роль входит в имя каждого объявления: `funkciya_…`, `variant_…`,",
    "//! `zapis_…`. Иначе одноимённые вариант и функция (а такие в моделях FTS",
    "//! встречаются) дали бы два объявления одного идентификатора.",
    "",
    "use crate::runtime as rt;",
  ].join("\n")
  return [head, ...bodies.filter((body) => body.length > 0)].join("\n\n") + "\n"
}

function renderContext(base, maxDepth, maxSteps) {
  return [
    "/// Контекст вычисления с настройками этой программы.",
    "///",
    "/// Индексация строк, предел глубины вызовов и лимит шагов — это настройки",
    "/// программы, а не рантайма: печать могла идти с нулевой базой индексации,",
    "/// а пределы вызывающий вправе поменять прямо в возвращённом контексте.",
    "pub fn new_context() -> rt::Ctx {",
    "    let ctx = rt::Ctx::new();",
    `    ctx.set_index_base(${base});`,
    `    ctx.set_max_depth(${maxDepth});`,
    `    ctx.set_max_steps(${maxSteps});`,
    "    ctx",
    "}",
  ].join("\n")
}

function describeFunction(fn, shared) {
  const lines = [`/// Функция flang «${fn.name}».`, "///"]
  lines.push(
    fn.total
      ? "/// Тотальная: завершение доказано анализом завершаемости (totality.mjs)."
      : "/// Обычная (не тотальная): завершение не доказано, зацикливание ловится лимитом шагов.",
  )
  if (shared.tailEdges.get(fn.name)?.has(fn.name) === true && fn.postconditions.length === 0) {
    lines.push("///", "/// Хвостовой самовызов развёрнут в цикл: стек не растёт.")
  }
  const members = shared.cyclic.get(fn.name)
  if (members !== undefined) {
    const others = [...members].filter((name) => name !== fn.name).map((name) => `«${name}»`).join(", ")
    lines.push("///", `/// Взаимная хвостовая рекурсия с ${others}: вызовы идут через батут.`)
  }
  if (shared.recursive.has(fn.name)) {
    lines.push("///", "/// Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.")
  }
  const idents = shared.paramIdents.get(fn.name)
  lines.push("///")
  fn.params.forEach((param, index) => {
    lines.push(`/// Параметр \`${idents[index]}\` — «${param.name}»${typeNote(param.type)}.`)
  })
  lines.push(`/// Результат — значение${typeNote(fn.returns)}.`)
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
 * Идентификаторы Rust для набора имён модели: транслитерация плюс развод
 * столкновений. Столкнуться могут и «цена» с «Цена», и поле, чьё имя после
 * транслитерации совпало с ключевым словом Rust.
 */
function uniqueIdents(names) {
  const taken = new Set(RUST_RESERVED)
  return names.map((name) => {
    const wanted = localIdent(name)
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

/* ── фабрики записей и вариантов ── */

function renderFactory(name, type, shared) {
  const fields = Array.isArray(type.fields) ? type.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name))
  const params = idents.map((ident) => `${ident}: rt::Value`).join(", ")
  const lines = [
    `/// Запись FTS «${name}»: ${fields.map((field) => `«${field.name}»`).join(", ") || "без полей"}.`,
    "///",
    "/// Запись flang тотальна: пропущенное поле — это «ничто», а не дырка.",
    `pub fn ${shared.factoryIdents.get(name)}(${params}) -> rt::Value {`,
  ]
  if (fields.length === 0) {
    lines.push("    rt::record(Vec::new())")
  } else {
    lines.push(`    let mut fields: Vec<rt::Field> = Vec::with_capacity(${fields.length});`)
    fields.forEach((field, index) => {
      lines.push(`    fields.push(rt::field(${ruststring(field.name)}, ${idents[index]}));`)
    })
    lines.push("    rt::record(fields)")
  }
  lines.push("}")
  return lines.join("\n")
}

function renderVariantFactory(sum, item, shared) {
  const fields = Array.isArray(item.fields) ? item.fields : []
  const idents = uniqueIdents(fields.map((field) => field.name))
  const params = idents.map((ident) => `${ident}: rt::Value`).join(", ")
  const lines = [
    `/// Вариант «${item.name}» суммы типов «${sum.name}».`,
    "///",
    "/// Дискриминант — имя варианта; проверяется через `rt::variant_is`.",
    `pub fn ${shared.variantIdents.get(item.name)}(${params}) -> rt::Value {`,
  ]
  if (fields.length === 0) {
    lines.push(`    rt::variant(${ruststring(item.name)}, Vec::new())`)
  } else {
    lines.push(`    let mut fields: Vec<rt::Field> = Vec::with_capacity(${fields.length});`)
    fields.forEach((field, index) => {
      lines.push(`    fields.push(rt::field(${ruststring(field.name)}, ${idents[index]}));`)
    })
    lines.push(`    rt::variant(${ruststring(item.name)}, fields)`)
  }
  lines.push("}")
  return lines.join("\n")
}

/* ═══════════════════════════ печать функции ═══════════════════════════ */

const PAD = "    "

function renderFunction(fn, shared) {
  const members = shared.cyclic.get(fn.name) ?? null
  const selfTail = shared.tailEdges.get(fn.name)?.has(fn.name) === true
  const guard = shared.recursive.has(fn.name)

  const ctx = createContext(fn, shared, { selfTail, members })
  const body = []
  const pad = PAD

  if (fn.postconditions.length > 0) {
    /* Постусловия проверяются после тела: результат уже вычислен, и первое же
       нарушение прерывает вычисление — как в интерпретаторе. */
    const value = emitValue(fn.body, ctx, body, pad)
    const resultIdent = ctx.temp()
    body.push(`${pad}let ${resultIdent} = ${value};`)
    for (const property of fn.postconditions) {
      const previous = ctx.bind(property.bind, resultIdent)
      body.push(`${pad}// постусловие «${property.name}»`)
      const check = emitValue(property.expr, ctx, body, pad)
      ctx.unbind(property.bind, previous)
      const holds = ctx.temp()
      const message = property.message ?? `нарушено свойство «${property.name}» функции «${fn.name}»`
      body.push(
        `${pad}let ${holds} = rt::post(ctx, ${check}, ${ruststring(property.name)}, ${ruststring(fn.name)})?;`,
        `${pad}if !${holds} {`,
        `${pad}${PAD}return Err(rt::fail(${ruststring(property.code)}, ${ruststring(message)}.to_string()));`,
        `${pad}}`,
      )
    }
    body.push(`${pad}Ok(${resultIdent})`)
  } else if (selfTail) {
    body.push(`${pad}loop {`)
    emitTail(fn.body, ctx, body, `${pad}${PAD}`)
    body.push(`${pad}}`)
  } else {
    emitTail(fn.body, ctx, body, pad)
  }

  const documentation = describeFunction(fn, shared)

  if (members !== null) {
    /* Батут: наружу торчит обычная функция, внутри — шаг, возвращающий отскок. */
    const step = shared.stepIdents.get(fn.name)
    /* Параметр шага переприсваивается, если функция вдобавок зовёт саму себя
       в хвост: тогда её цикл живёт внутри шага батута. */
    const mutable = selfTail ? "mut " : ""
    const unpack = ctx.params.map((param, index) => [
      `${PAD}// «${fn.params[index].name}»`,
      `${PAD}let ${mutable}${param} = rt::arg(&args, ${index});`,
    ]).flat()
    const hidden = hideUnused([...unpack, ...body].join("\n"), ctx.params)
    const stepBlock = [
      `/// Шаг батута для «${fn.name}»: значение либо отскок к соседу по рекурсии.`,
      `fn ${step}(${namedIf(hidden.text, "ctx")}: &rt::Ctx, ${
        ctx.params.length === 0 ? "_args" : "args"
      }: Vec<rt::Value>, ${namedIf(hidden.text, "bounce")}: &mut rt::Bounce) -> Result<rt::Value, rt::Error> {`,
      hidden.text,
      "}",
    ].join("\n")

    const argList = ctx.params.length === 0 ? "Vec::new()" : `vec![${ctx.params.join(", ")}]`
    const outer = [
      ...documentation,
      declareFunction(fn, shared, ctx.params, "ctx", false),
      `${PAD}let _frame = ctx.enter(${ruststring(fn.name)})?;`,
      `${PAD}rt::trampoline(ctx, ${step}, ${argList}, ${ruststring(fn.name)})`,
      "}",
    ].join("\n")
    return `${stepBlock}\n\n${outer}`
  }

  const head = []
  if (guard) {
    /* Счётчик глубины обязан уменьшаться и на ошибке. В Go это `defer`, в
       C — отдельная внутренняя функция, здесь — страж с `Drop`: он срабатывает
       и на раннем возврате через `?`, и на любом другом выходе. */
    head.push(`${pad}let _frame = ctx.enter(${ruststring(fn.name)})?;`)
  }
  const hidden = hideUnused([...head, ...body].join("\n"), ctx.params)
  return [
    ...documentation,
    declareFunction(fn, shared, hidden.idents, namedIf(hidden.text, "ctx"), selfTail),
    hidden.text,
    "}",
  ].join("\n")
}

function declareFunction(fn, shared, idents, ctxName, selfTail) {
  const params = [
    `${ctxName}: &rt::Ctx`,
    ...idents.map((ident) => `${selfTail ? "mut " : ""}${ident}: rt::Value`),
  ].join(", ")
  return `pub fn ${shared.functionIdents.get(fn.name)}(${params}) -> Result<rt::Value, rt::Error> {`
}

/**
 * Имя параметра, который может оказаться неиспользованным.
 *
 * Тело функции печатается до того, как становится известно, понадобился ли ей
 * контекст: тело из одного литерала не обращается к `ctx` вовсе, а
 * неиспользованный параметр в Rust — предупреждение, то есть под `-D warnings`
 * ошибка сборки. Имя проверяется по телу, из которого убраны комментарии и
 * строковые литералы: имя функции flang вполне может дословно совпасть с
 * идентификатором.
 */
function namedIf(text, name) {
  return new RegExp(`\\b${name}\\b`, "u").test(stripNoise(text)) ? name : `_${name}`
}

/** Тело без комментариев и строковых литералов — для поиска использований. */
function stripNoise(text) {
  return text.replace(/"(?:[^"\\]|\\.)*"/gu, '""').replace(/\/\/[^\n]*/gu, "")
}

/**
 * Неиспользованные параметры получают приставку `_`.
 *
 * Она гасит сразу два предупреждения: `unused_variables` (параметр не читается)
 * и `unused_assignments` (параметр цикла хвостового самовызова переприсваивается,
 * но никогда не читается). Гасить их через `let _ = &имя;`, как гасятся
 * локальные имена, здесь нельзя: для второго случая заимствование пришлось бы
 * ставить внутрь цикла, а не в начало тела.
 */
function hideUnused(text, idents) {
  let result = text
  const renamed = []
  for (const ident of idents) {
    /* Строка вида «имя = t7;» — это переприсваивание параметра в цикле
       хвостового самовызова, то есть запись, а не чтение. */
    const reads = stripNoise(result).replace(new RegExp(`^[ ]*${ident} = [^\\n]*;$`, "gmu"), "")
    if (new RegExp(`\\b${ident}\\b`, "u").test(reads)) {
      renamed.push(ident)
      continue
    }
    result = result.replace(new RegExp(`\\b${ident}\\b`, "gu"), `_${ident}`)
    renamed.push(`_${ident}`)
  }
  return { text: result, idents: renamed }
}

function createContext(fn, shared, { selfTail, members }) {
  const ctx = {
    shared,
    fn,
    scope: new Map(),
    taken: new Set(RUST_RESERVED),
    params: [],
    selfTail,
    members,
    temp() {
      shared.counter += 1
      return `t${shared.counter}`
    },
    fresh(name) {
      /* Имя модели вроде «т16» после транслитерации даёт «t16» — ровно то, чем
         зовутся временные. Приставка разводит их навсегда. */
      const transliterated = localIdent(name)
      const wanted = /^t[0-9]+$/u.test(transliterated) ? `v${transliterated}` : transliterated
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

/* ── хвостовая позиция: здесь живут `return`, `continue` и отскоки ── */

function emitTail(expr, ctx, out, pad) {
  const node = requireExpr(expr)
  switch (node.kind) {
    case "let": {
      const value = emitValue(node.value, ctx, out, pad)
      requireName(node.name, "let", "name", node.span)
      const ident = ctx.fresh(node.name)
      out.push(`${pad}// пусть «${node.name}»`, `${pad}let ${ident} = ${value};`)
      const at = out.length
      const previous = ctx.bind(node.name, ident)
      emitTail(node.in ?? node.body, ctx, out, pad)
      ctx.unbind(node.name, previous)
      guardUnused(out, at, [ident], pad)
      return
    }
    case "if": {
      const flag = emitCondition(node.cond, ctx, out, pad, "cond")
      out.push(`${pad}if ${flag} {`)
      emitTail(node.then, ctx, out, `${pad}${PAD}`)
      out.push(`${pad}} else {`)
      emitTail(node.else, ctx, out, `${pad}${PAD}`)
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
        /* Самовызов в хвосте — это цикл. Аргументы кладутся во временные и
           только потом расходятся по параметрам: аргумент, который ещё читает
           старое значение параметра, обязан вычислиться до присваивания.
           Готовое временное перекладывать некуда — оно уже вычислено и
           параметром не является. */
        const temps = args.map((argument) => {
          if (/^t[0-9]+$/u.test(argument)) return argument
          const temp = ctx.temp()
          out.push(`${pad}let ${temp} = ${argument};`)
          return temp
        })
        ctx.params.forEach((param, index) => {
          out.push(`${pad}${param} = ${temps[index]};`)
        })
        out.push(
          `${pad}// виток цикла — тоже шаг вычисления: незавершающийся хвостовой`,
          `${pad}// самовызов обязан упереться в лимит, а не крутиться вечно`,
          `${pad}ctx.step(${ruststring(ctx.fn.name)})?;`,
          `${pad}continue;`,
        )
        return
      }
      if (ctx.members !== null && ctx.members.has(node.name)) {
        out.push(`${pad}// хвостовой вызов «${node.name}» — отскок, а не кадр стека`)
        out.push(
          args.length === 0
            ? `${pad}bounce.args = Vec::new();`
            : `${pad}bounce.args = vec![${args.join(", ")}];`,
        )
        out.push(
          `${pad}bounce.next = Some(${ctx.shared.stepIdents.get(node.name)});`,
          `${pad}return Ok(rt::nothing());`,
        )
        return
      }
      out.push(`${pad}return ${ctx.shared.functionIdents.get(callee.name)}(${["ctx", ...args].join(", ")});`)
      return
    }
    default: {
      const value = emitValue(node, ctx, out, pad)
      out.push(`${pad}return Ok(${value});`)
    }
  }
}

/* ── значение: возвращает выражение Rust, попутно печатая нужные ему операторы ── */

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
      /* Клонирование значения — инкремент счётчика ссылок, а не копия дерева
         (см. пункт 2 в шапке файла), поэтому имя читается клонированием
         всегда: так напечатанный код не зависит от того, последнее это
         использование имени или нет. */
      return `${ident}.clone()`
    }
    case "field": {
      const target = emitValue(node.target, ctx, out, pad)
      return call(ctx, out, pad, `rt::field_get(ctx, ${target}, ${ruststring(node.field)})`)
    }
    case "let": {
      const value = emitValue(node.value, ctx, out, pad)
      requireName(node.name, "let", "name", node.span)
      const ident = ctx.fresh(node.name)
      out.push(`${pad}// пусть «${node.name}»`, `${pad}let ${ident} = ${value};`)
      const at = out.length
      const previous = ctx.bind(node.name, ident)
      const body = emitValue(node.in ?? node.body, ctx, out, pad)
      ctx.unbind(node.name, previous)
      guardUnused(out, at, [ident], pad, body)
      return body
    }
    case "if": {
      const flag = emitCondition(node.cond, ctx, out, pad, "cond")
      const temp = ctx.temp()
      const inner = `${pad}${PAD}`
      /* Блок Rust — выражение, поэтому ветвь печатается как есть: её операторы
         внутри блока, а значение — последней строкой без точки с запятой. Ни
         предварительного объявления переменной, ни присваивания в каждую ветвь
         (без чего не обходятся Go и C) здесь не нужно. */
      out.push(`${pad}let ${temp} = if ${flag} {`)
      const thenValue = emitValue(node.then, ctx, out, inner)
      out.push(`${inner}${thenValue}`, `${pad}} else {`)
      const elseValue = emitValue(node.else, ctx, out, inner)
      out.push(`${inner}${elseValue}`, `${pad}};`)
      return temp
    }
    case "match": {
      const temp = ctx.temp()
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
      return call(ctx, out, pad, `rt::${помощникФормы(canonical, node, BUILTIN_HELPERS, СУФФИКС_ДОКАЗАННОГО)}(${["ctx", ...rendered].join(", ")})`)
    }
    case "binary": {
      const left = emitValue(node.left, ctx, out, pad)
      const right = emitValue(node.right, ctx, out, pad)
      if (node.op === "eq" || node.op === "neq") {
        /* Равенство ошибок не даёт: сравнимо всё со всем (SPEC, раздел 5). */
        const negation = node.op === "eq" ? "" : "!"
        return `rt::flag(${negation}rt::equal(&${left}, &${right}))`
      }
      const helper = BINARY_HELPERS.get(node.op)
      if (helper === undefined) {
        throw flangError("FLANG_TYPE", `неизвестная операция «${node.op}»`, node.span)
      }
      return call(ctx, out, pad, `rt::${helper}(ctx, ${left}, ${right})`)
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
 * Вызов, способный дать ошибку: результат во временное, ранний возврат через
 * `?`. Отдельного имени под ошибку не нужно — `?` и есть тот самый ранний
 * возврат, который в Go и C приходится писать руками, и он же гарантирует, что
 * страж глубины (`rt::Frame`) сработает при выходе.
 */
function call(ctx, out, pad, expression) {
  const temp = ctx.temp()
  out.push(`${pad}let ${temp} = ${expression}?;`)
  return temp
}

/**
 * Связанное, но не использованное имя — обычное дело в языке с образцами
 * («случай голова и хвост», а голова телу не нужна). В Rust это
 * предупреждение, то есть под `-D warnings` ошибка сборки. Молча не объявлять
 * такое имя нельзя: привязка обязана вычислиться (у варианта она может дать
 * FLANG_UNKNOWN_NAME). Поэтому объявляем всегда, а неиспользованные гасим
 * `let _ = &имя;` — заимствованием, а не перемещением: перемещение сделало бы
 * ошибкой всякое последующее использование, если проверка вдруг ошибётся.
 *
 * `extra` — выражение-результат, которое ещё не попало в `out`: без него имя,
 * использованное ровно один раз и именно в результате, сочли бы ненужным.
 */
function guardUnused(out, at, idents, pad, extra = "") {
  if (idents.length === 0) return
  const text = stripNoise(`${out.slice(at).join("\n")}\n${extra}`)
  const unused = idents.filter((ident) => !new RegExp(`\\b${ident}\\b`, "u").test(text))
  if (unused.length > 0) out.splice(at, 0, ...unused.map((ident) => `${pad}let _ = &${ident};`))
}

/** Признак из значения: `если` и `отфильтровать` требуют именно признак. */
function emitCondition(expr, ctx, out, pad, helper) {
  const value = emitValue(expr, ctx, out, pad)
  const flag = ctx.temp()
  out.push(`${pad}let ${flag} = rt::${helper}(ctx, ${value})?;`)
  return flag
}

/* ── литералы ── */

function emitLiteral(value, ctx, out, pad) {
  if (value === undefined || value === null) return "rt::nothing()"
  if (typeof value === "boolean") return `rt::flag(${value ? "true" : "false"})`
  if (typeof value === "number") return `rt::number(${rustnumber(value)})`
  if (typeof value === "string") return `rt::text(${ruststring(value)})`
  if (Array.isArray(value)) {
    return emitList(value.map((item) => (out2, pad2) => emitLiteral(item, ctx, out2, pad2)), ctx, out, pad)
  }
  if (typeof value === "object") {
    /* Значение варианта в JSON — объект ровно с двумя полями (builtins.mjs,
       reifyValue). Интерпретатор превращает такую запись обратно в вариант,
       значит и печать обязана: иначе образец-литерал с вариантом сравнивался
       бы с записью и никогда не совпадал. */
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

/** Запись, которую интерпретатор читает как вариант (builtins.mjs, reifyValue). */
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
  if (makers.length === 0) return "rt::list(Vec::new())"
  const items = ctx.temp()
  out.push(`${pad}let mut ${items}: Vec<rt::Value> = Vec::with_capacity(${makers.length});`)
  for (const make of makers) {
    const value = make(out, pad)
    out.push(`${pad}${items}.push(${value});`)
  }
  return `rt::list(${items})`
}

function emitFields(fields, variantName, ctx, out, pad) {
  const keys = Object.keys(fields)
  const values = keys.map((key) => emitValue(fields[key], ctx, out, pad))
  return emitValues(keys, values, variantName, ctx, out, pad)
}

function emitValues(keys, values, variantName, ctx, out, pad) {
  if (keys.length === 0) {
    return variantName === null
      ? "rt::record(Vec::new())"
      : `rt::variant(${ruststring(variantName)}, Vec::new())`
  }
  const array = ctx.temp()
  out.push(`${pad}let mut ${array}: Vec<rt::Field> = Vec::with_capacity(${keys.length});`)
  keys.forEach((key, index) => {
    out.push(`${pad}${array}.push(rt::field(${ruststring(key)}, ${values[index]}));`)
  })
  return variantName === null
    ? `rt::record(${array})`
    : `rt::variant(${ruststring(variantName)}, ${array})`
}

/* ── разбор ── */

// `target === null` — хвостовая позиция (тела ветвей печатают возврат), иначе
// имя, в которое связывается результат разбора как выражения.
function emitMatch(node, ctx, out, pad, target) {
  const subject = ctx.temp()
  out.push(`${pad}let ${subject} = ${emitValue(node.target, ctx, out, pad)};`)
  const at = out.length

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

  const inner = `${pad}${PAD}`
  const head = target === null ? "" : `let ${target} = `
  let opened = false
  let closed = false

  for (const [index, branch] of cases.entries()) {
    const test = tests[index]
    if (test === null) {
      /* Образец, совпадающий всегда: `else` честнее, чем `if true`. */
      out.push(opened ? `${pad}} else {` : `${pad}${head}{`)
      opened = true
      emitBranch(branch, subject, ctx, out, inner, target)
      out.push(target === null ? `${pad}}` : `${pad}};`)
      closed = true
      break
    }
    out.push(opened ? `${pad}} else if ${test} {` : `${pad}${head}if ${test} {`)
    opened = true
    emitBranch(branch, subject, ctx, out, inner, target)
  }

  if (!closed) {
    if (opened) {
      out.push(`${pad}} else {`)
      out.push(
        target === null
          ? `${inner}return rt::match_fail(ctx, &${subject});`
          : `${inner}rt::match_fail(ctx, &${subject})?`,
      )
      out.push(target === null ? `${pad}}` : `${pad}};`)
    } else {
      /* Разбор без единого случая: значения не покрывает ни одно. */
      out.push(
        target === null
          ? `${pad}return rt::match_fail(ctx, &${subject});`
          : `${pad}let ${target} = rt::match_fail(ctx, &${subject})?;`,
      )
    }
  }
  guardUnused(out, at, [subject], pad)
}

function emitBranch(branch, subject, ctx, out, pad, target) {
  const undo = bindPattern(branch.pattern, subject, ctx, out, pad)
  const at = out.length
  let value = ""
  if (target === null) {
    emitTail(branch.body, ctx, out, pad)
  } else {
    value = emitValue(branch.body, ctx, out, pad)
    out.push(`${pad}${value}`)
  }
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
      return `rt::chain_empty(&${subject})`
    case "cons":
      return `rt::chain_cons(&${subject})`
    case "variant":
      return `rt::variant_is(&${subject}, ${ruststring(pattern.name)})`
    case "literal": {
      const literal = emitLiteral(pattern.value, ctx, out, pad)
      return `rt::equal(&${subject}, &${literal})`
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
    out.push(`${pad}let ${ident} = ${code};`)
    undo.push({ name, ident, previous: ctx.bind(name, ident) })
  }
  switch (pattern.kind) {
    case "cons":
      if (pattern.head !== undefined && pattern.head !== null) {
        bind(pattern.head, `rt::chain_head(&${subject})`, `голова «${pattern.head}»`)
      }
      if (pattern.tail !== undefined && pattern.tail !== null) {
        /* Хвост — суффикс, а не копия: значения неизменяемы, память общая. У
           строки голова — одна кодовая точка, хвост — остаток. */
        bind(pattern.tail, `rt::chain_tail(&${subject})`, `хвост «${pattern.tail}»`)
      }
      return undo
    case "variant": {
      const declared = pattern.bind ?? {}
      const entries = Array.isArray(declared)
        ? declared.map((item) => [item, item])
        : Object.entries(declared)
      for (const [field, name] of entries) {
        /* Отсутствующее поле варианта — ошибка прямо при сопоставлении, а не
           «случай не подошёл»: так же ведёт себя matchPattern интерпретатора. */
        const ident = ctx.fresh(name)
        out.push(
          `${pad}// поле «${field}»`,
          `${pad}let ${ident} = rt::variant_field(ctx, &${subject}, ${ruststring(field)})?;`,
        )
        undo.push({ name, ident, previous: ctx.bind(name, ident) })
      }
      return undo
    }
    case "any":
      if (typeof pattern.bind === "string") bind(pattern.bind, `${subject}.clone()`, null)
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
  const itemIdent = ctx.fresh(node.item)
  const inner = `${pad}${PAD}`
  out.push(
    `${pad}// «${node.acc}»`,
    `${pad}let mut ${accIdent} = ${init};`,
    `${pad}// «${node.item}»`,
    /* Обход идёт по СНИМКУ, а не по заимствованию общего массива: внутри тела
       исполняется код программы, и «добавить» к тому же списку обязано остаться
       постоянным по времени (см. `Items::grown`), а не уходить на копию из-за
       живого заимствования. Снимок стоит один проход, а сам обход и так
       линейный. */
    `${pad}for ${itemIdent} in ${list}.snapshot() {`,
  )

  const at = out.length
  const undoAcc = ctx.bind(node.acc, accIdent)
  const undoItem = ctx.bind(node.item, itemIdent)
  const value = emitValue(node.body, ctx, out, inner)
  out.push(`${inner}${accIdent} = ${value};`)
  ctx.unbind(node.item, undoItem)
  ctx.unbind(node.acc, undoAcc)
  guardUnused(out, at, [itemIdent], inner)

  out.push(`${pad}}`)
  return accIdent
}

function emitLoop(node, ctx, out, pad) {
  requireName(node.item, node.kind, "item", node.span)
  const label = node.kind === "map" ? "отобразить" : "отфильтровать"
  const over = emitValue(node.over, ctx, out, pad)
  const list = requireListInto(ctx, out, pad, over, label)
  const items = ctx.temp()
  const itemIdent = ctx.fresh(node.item)
  const inner = `${pad}${PAD}`
  out.push(
    `${pad}let mut ${items}: Vec<rt::Value> = Vec::with_capacity(${list}.len());`,
    `${pad}// «${node.item}»`,
    /* По снимку, а не по заимствованию: см. `emitFold`. */
    `${pad}for ${itemIdent} in ${list}.snapshot() {`,
  )

  const at = out.length
  const undo = ctx.bind(node.item, itemIdent)
  if (node.kind === "map") {
    const value = emitValue(node.body, ctx, out, inner)
    out.push(`${inner}${items}.push(${value});`)
  } else {
    /* Тело фильтра — предикат: для отброшенных элементов ничего больше не
       вычисляется. */
    const flag = emitCondition(node.body, ctx, out, inner, "keep")
    out.push(
      `${inner}if ${flag} {`,
      `${inner}${PAD}${items}.push(${itemIdent});`,
      `${inner}}`,
    )
  }
  ctx.unbind(node.item, undo)
  guardUnused(out, at, [itemIdent], inner)
  out.push(`${pad}}`)
  return `rt::list(${items})`
}

function requireListInto(ctx, out, pad, value, label) {
  const list = ctx.temp()
  out.push(`${pad}let ${list} = rt::require_list(ctx, ${value}, ${ruststring(label)})?;`)
  return list
}

/* ── вызов по имени ── */

function renderDispatch(shared) {
  /* Программа без единой функции — вырожденная, но печататься обязана: тогда
     ни контекст, ни аргументы диспетчеру не нужны, а неиспользованный параметр
     в Rust это предупреждение. */
  const empty = shared.prepared.functions.size === 0
  const lines = [
    "/// Вызов функции по её исходному имени flang.",
    "///",
    "/// Нужен прогонщику и всякому, кто связывает программу с внешним миром",
    "/// динамически (скрипт, тест, служба). Коды и тексты — те же, что у",
    "/// интерпретатора: «не найдена функция …» и «функция … принимает N аргум.».",
    `pub fn call(${empty ? "_ctx" : "ctx"}: &rt::Ctx, name: &str, ${
      empty ? "_args" : "args"
    }: Vec<rt::Value>) -> Result<rt::Value, rt::Error> {`,
    "    match name {",
  ]
  for (const fn of shared.prepared.functions.values()) {
    const arity = fn.params.length
    const pass = Array.from({ length: arity }, (_, index) => `rt::arg(&args, ${index})`)
    lines.push(
      `        ${ruststring(fn.name)} => {`,
      `            if args.len() != ${arity} {`,
      "                return Err(rt::fail(",
      "                    rt::CODE_TYPE,",
      `                    format!(`,
      `                        "функция «{}» принимает {} аргум., получено {}",`,
      `                        ${ruststring(fn.name)},`,
      `                        ${arity},`,
      "                        args.len()",
      "                    ),",
      "                ));",
      "            }",
      `            ${shared.functionIdents.get(fn.name)}(${["ctx", ...pass].join(", ")})`,
      "        }",
    )
  }
  lines.push(
    "        _ => Err(rt::fail(",
    "            rt::CODE_UNKNOWN_NAME,",
    '            format!("не найдена функция «{name}»"),',
    "        )),",
    "    }",
    "}",
  )
  return lines.join("\n")
}

/* ── граница входа: объявленные типы параметров данными ── */

const ВИДЫ_ТИПА_RUST = new Map([
  ["число", "Number"],
  ["строка", "Text"],
  ["признак", "Flag"],
  ["ничто", "Null"],
  ["список", "List"],
  ["запись", "Record"],
  ["сумма", "Sum"],
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
 * Сверяет таблицу `rt::check_entry` — один и тот же текст для всех программ, а
 * строит её `таблицаВхода` из flang/src/types.mjs, то есть тот же файл, что
 * отвечает на этот вопрос для `flang run --args`.
 */
function renderEntry(таблица) {
  const тип = (запись) =>
    `        rt::Type { kind: rt::TypeKind::${ВИДЫ_ТИПА_RUST.get(запись.вид) ?? "Unknown"}, ` +
    `name: ${ruststring(запись.имя)}, owner: ${ruststring(запись.владелец)}, ` +
    `optional: ${запись.ничто}, integral: ${запись.целое}, bounded: ${запись.отрезок}, ` +
    `low: ${rustnumber(запись.низ)}, high: ${rustnumber(запись.верх)}, of: ${запись.элемент}, ` +
    `field_from: ${запись.полеС}, field_count: ${запись.полей}, ` +
    `variant_from: ${запись.вариантС}, variant_count: ${запись.вариантов} },`
  return [
    "/// Граница входа: объявленные типы параметров данными.",
    "///",
    "/// Прогонщик сверяет по ним значения, пришедшие снаружи, ДО вызова",
    "/// (`rt::check_entry`). Виды `Unknown` (значение-функция, параметр",
    "/// полиморфизма, применение типа с аргументами) не сверяются — ровно как",
    "/// молчит о них проверка значений эталона.",
    "static ENTRY: rt::EntryTable = rt::EntryTable {",
    "    types: &[",
    ...таблица.типы.map(тип),
    "    ],",
    "    fields: &[",
    ...таблица.поля.map((поле) =>
      `        rt::TypeField { name: ${ruststring(поле.имя)}, type_at: ${поле.тип} },`),
    "    ],",
    "    variants: &[",
    ...таблица.варианты.map((вариант) =>
      `        rt::TypeVariant { name: ${ruststring(вариант.имя)}, field_from: ${вариант.полеС}, ` +
      `field_count: ${вариант.полей} },`),
    "    ],",
    "    params: &[",
    ...таблица.параметры.map((параметр) =>
      `        rt::EntryParam { function: ${ruststring(параметр.функция)}, ` +
      `name: ${ruststring(параметр.параметр)}, type_at: ${параметр.тип} },`),
    "    ],",
    "};",
    "",
    "/// Объявленные типы параметров: по ним сверяется вход извне.",
    "pub fn entry() -> &'static rt::EntryTable {",
    "    &ENTRY",
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
