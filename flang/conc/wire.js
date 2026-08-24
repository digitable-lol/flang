/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
// Сгенерировано flang (бэкенд JavaScript, flang/src/emit/js.mjs). Не редактировать руками.
// Модуль flang: «Провод узла».
// Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.
// Модуль самодостаточен — ни одной зависимости, работает и в Node, и в браузере.
// Рядом напечатан прогонщик: node flang_cli.js ./<этот файл> — JSON на входе, JSON на выходе.

/* ── рантайм: то и только то, что нужно этому модулю ──
   Представление значений повторяет интерпретатор flang дословно: список —
   массив, запись — обычный объект, вариант — экземпляр класса, «ничто» — null.
   Тексты и коды ошибок тоже дословные: они часть наблюдаемого поведения. */

// Индексация строк — с 1 и включительно с обоих концов (SPEC, раздел 5):
// «первый символ» на языке предметной области это первый, а не нулевой.
const $INDEX_BASE = 1

class $FlangError extends Error {
  constructor(code, message, span) {
    super(message)
    this.name = "FlangError"
    this.code = code
    const diagnostic = { code, message, severity: "error" }
    if (span !== undefined && span !== null) {
      diagnostic.span = span
      this.span = span
    }
    this.diagnostics = [diagnostic]
  }
}

function $fail(code, message, span) {
  throw new $FlangError(code, message, span)
}

class $FlangVariant {
  constructor(name, fields = {}) {
    this.variant = name
    this.fields = fields
  }
}

function $isList(value) {
  return Array.isArray(value)
}

function $isVariant(value) {
  return value instanceof $FlangVariant
}

function $isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof $FlangVariant)
}

function $isScalar(value) {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
}

function $typeName(value) {
  if (value === null) return "ничто"
  if (typeof value === "string") return "строка"
  if (typeof value === "number") return "число"
  if (typeof value === "boolean") return "признак"
  if ($isList(value)) return "список"
  if ($isVariant(value)) return `вариант «${value.variant}»`
  if ($isRecord(value)) return "запись"
  return "неизвестное значение"
}

function $describe(value) {
  if (typeof value === "string") return JSON.stringify(value)
  if ($isVariant(value)) {
    const fields = Object.keys(value.fields)
    return fields.length === 0 ? value.variant : `${value.variant}(${fields.join(", ")})`
  }
  if ($isList(value)) return `список из ${value.length}`
  if ($isRecord(value)) return `запись {${Object.keys(value).join(", ")}}`
  if (value === null) return "ничто"
  if (value === true) return "да"
  if (value === false) return "нет"
  return String(value)
}

function $equal(left, right) {
  if ($isScalar(left) || $isScalar(right)) {
    if (!$isScalar(left) || !$isScalar(right)) return false
    return Object.is(left, right)
  }
  if ($isList(left) && $isList(right)) {
    if (left.length !== right.length) return false
    for (let index = 0; index < left.length; index += 1) {
      if (!$equal(left[index], right[index])) return false
    }
    return true
  }
  if ($isVariant(left) && $isVariant(right)) {
    if (left.variant !== right.variant) return false
    return $recordsEqual(left.fields, right.fields)
  }
  if ($isRecord(left) && $isRecord(right)) return $recordsEqual(left, right)
  return false
}

function $recordsEqual(left, right) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((key) => key in right && $equal(left[key], right[key]))
}

function $field(target, name) {
  if ($isVariant(target)) {
    if (Object.hasOwn(target.fields, name)) return target.fields[name]
    $fail("FLANG_TYPE", `поле «${name}» нельзя взять у варианта «${target.variant}» — нужен разбор`)
  }
  if (!$isRecord(target)) {
    $fail("FLANG_TYPE", `поле «${name}» можно взять только у записи, получено ${$typeName(target)}`)
  }
  if (!Object.hasOwn(target, name)) $fail("FLANG_UNKNOWN_NAME", `запись не содержит поле «${name}»`)
  return target[name]
}

function $cond(value) {
  if (typeof value !== "boolean") {
    $fail("FLANG_TYPE", `условие «если» должно быть признаком, получено ${$typeName(value)}`)
  }
  return value
}

function $matchFail(value) {
  $fail("FLANG_MATCH_NOT_EXHAUSTIVE", `разбор не покрывает значение ${$describe(value)}`)
}

function $variantField(value, field) {
  if (!Object.hasOwn(value.fields, field)) {
    $fail("FLANG_UNKNOWN_NAME", `вариант «${value.variant}» не содержит поле «${field}»`)
  }
  return value.fields[field]
}

function $requireList(value, label) {
  if (!$isList(value)) {
    $fail("FLANG_TYPE", `«${label}» работает только со списком, получено ${$typeName(value)}`)
  }
  return value
}

function $keep(value) {
  if (typeof value !== "boolean") {
    $fail("FLANG_TYPE", `условие «отфильтровать» должно быть признаком, получено ${$typeName(value)}`)
  }
  return value
}

function $post(value, property, name) {
  if (typeof value !== "boolean") {
    $fail("FLANG_TYPE", `постусловие «${property}» функции «${name}» должно давать признак, получено ${$typeName(value)}`)
  }
  return value
}

function $pre(value, property, name) {
  if (typeof value !== "boolean") {
    $fail("FLANG_TYPE", `предусловие «${property}» функции «${name}» должно давать признак, получено ${$typeName(value)}`)
  }
  return value
}

function $nums(op, left, right) {
  if (typeof left !== "number" || typeof right !== "number") {
    $fail("FLANG_TYPE", `операция «${op}» допустима только для чисел, получено ${$typeName(left)} и ${$typeName(right)}`)
  }
}

function $ord(left, right) {
  if (typeof left !== "number" || typeof right !== "number") {
    $fail("FLANG_TYPE", "сравнения порядка допустимы только для чисел")
  }
}

function $add(left, right) {
  $nums("add", left, right)
  return left + right
}

function $sub(left, right) {
  $nums("sub", left, right)
  return left - right
}

function $mul(left, right) {
  $nums("mul", left, right)
  return left * right
}

function $div(left, right) {
  $nums("div", left, right)
  return left / right
}

function $mod(left, right) {
  $nums("mod", left, right)
  return left % right
}

function $gt(left, right) {
  $ord(left, right)
  return left > right
}

function $lt(left, right) {
  $ord(left, right)
  return left < right
}

function $lte(left, right) {
  $ord(left, right)
  return left <= right
}

function $isTorn(part) {
  /* Разорван ли край подстроки: начинается низкой половиной суррогатной пары
     или кончается высокой. Вхождение способно разрезать знак пополам ТОЛЬКО у
     такой подстроки — значит у всякой другой обычный поиск по единицам UTF-16
     уже считает знаки, и обходить строку незачем. */
  if (part.length === 0) return false
  const first = part.charCodeAt(0)
  if (first >= 0xdc00 && first <= 0xdfff) return true
  const last = part.charCodeAt(part.length - 1)
  return last >= 0xd800 && last <= 0xdbff
}

function $isBoundary(text, at) {
  /* Стоит ли позиция на границе знака, а не в середине суррогатной пары. */
  if (at <= 0 || at >= text.length) return true
  const here = text.charCodeAt(at)
  if (here < 0xdc00 || here > 0xdfff) return true
  const before = text.charCodeAt(at - 1)
  return before < 0xd800 || before > 0xdbff
}

function $findAligned(text, part, from) {
  /* Первое вхождение, не разрезающее знак ни началом, ни концом. */
  for (let at = text.indexOf(part, from); at !== -1; at = text.indexOf(part, at + 1)) {
    if ($isBoundary(text, at) && $isBoundary(text, at + part.length)) return at
  }
  return -1
}

function $expectString(name, value, role) {
  if (typeof value !== "string") {
    $fail("FLANG_BUILTIN_ARGS", `«${name}»: ${role} должна быть строкой, получено ${$typeName(value)}`)
  }
  return value
}

function $expectNumber(name, value, role) {
  if (typeof value !== "number") {
    $fail("FLANG_BUILTIN_ARGS", `«${name}»: ${role} должно быть числом, получено ${$typeName(value)}`)
  }
  return value
}

function $expectInteger(name, value, role) {
  $expectNumber(name, value, role)
  if (!Number.isInteger(value)) {
    $fail("FLANG_BUILTIN_ARGS", `«${name}»: ${role} должно быть целым числом, получено ${value}`)
  }
  return value
}

function $expectList(name, value, role) {
  if (!$isList(value)) {
    $fail("FLANG_BUILTIN_ARGS", `«${name}»: ${role} должен быть списком, получено ${$typeName(value)}`)
  }
  return value
}

function $b_dlina(value) {
  if (typeof value === "string") return Array.from(value).length
  if ($isList(value)) return value.length
  $fail("FLANG_BUILTIN_ARGS", `«длина»: ожидается строка или список, получено ${$typeName(value)}`)
}

function $b_podstroka(text, from, to) {
  $expectString("подстрока", text, "строка")
  $expectInteger("подстрока", from, "начало")
  $expectInteger("подстрока", to, "конец")
  const chars = Array.from(text)
  const start = from - $INDEX_BASE
  const end = to
  if (start < 0 || start > chars.length) {
    $fail("FLANG_BUILTIN_ARGS", `«подстрока»: начало ${from} вне строки длиной ${chars.length}`)
  }
  if (end < start || end > chars.length) {
    $fail("FLANG_BUILTIN_ARGS", `«подстрока»: конец ${to} вне диапазона [${from}, ${chars.length}]`)
  }
  return chars.slice(start, end).join("")
}

function $b_razdelit(text, separator) {
  $expectString("разделить", text, "строка")
  $expectString("разделить", separator, "разделитель")
  if (separator === "") $fail("FLANG_BUILTIN_ARGS", "«разделить»: разделитель не может быть пустым")
  if (!$isTorn(separator)) return text.split(separator)
  const parts = []
  let from = 0
  for (let at = $findAligned(text, separator, from); at !== -1; at = $findAligned(text, separator, from)) {
    parts.push(text.slice(from, at))
    from = at + separator.length
  }
  parts.push(text.slice(from))
  return parts
}

function $b_simvoly(text) {
  $expectString("символы", text, "строка")
  /* Array.from идёт по кодовым точкам, а не по единицам UTF-16: [...text] и
     text.split("") разошлись бы на первом же символе вне BMP. То же деление,
     что у «длина» и «подстрока» в builtins.mjs. */
  return Array.from(text)
}

function $b_soderzhit(left, right) {
  if ($isList(left)) return left.some((item) => $equal(item, right))
  const text = $expectString("содержит", left, "строка или список")
  const part = $expectString("содержит", right, "искомая подстрока")
  if (!$isTorn(part)) return text.includes(part)
  return $findAligned(text, part, 0) !== -1
}

function $b_k_chislu(text) {
  $expectString("к числу", text, "строка")
  const trimmed = text.trim()
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/u.test(trimmed)) {
    $fail("FLANG_BUILTIN_ARGS", `«к числу»: строка ${JSON.stringify(text)} не является числом`)
  }
  const result = Number(trimmed)
  if (!Number.isFinite(result)) {
    $fail("FLANG_BUILTIN_ARGS", `«к числу»: строка ${JSON.stringify(text)} не является конечным числом`)
  }
  return result
}

function $b_k_stroke(value) {
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "да" : "нет"
  if (value === null) return "ничто"
  $fail("FLANG_BUILTIN_ARGS", `«к строке»: ожидается скаляр, получено ${$typeName(value)}`)
}

function $b_pusto(value) {
  if ($isList(value)) return value.length === 0
  if (typeof value === "string") return Array.from(value).length === 0
  $fail("FLANG_BUILTIN_ARGS", `«пусто»: ожидается строка или список, получено ${$typeName(value)}`)
}

function $b_razdelit_dokazano(text, separator) {
  $expectString("разделить", text, "строка")
  $expectString("разделить", separator, "разделитель")
  if (!$isTorn(separator)) return text.split(separator)
  const parts = []
  let from = 0
  for (let at = $findAligned(text, separator, from); at !== -1; at = $findAligned(text, separator, from)) {
    parts.push(text.slice(from, at))
    from = at + separator.length
  }
  parts.push(text.slice(from))
  return parts
}

function $b_element(index, value) {
  $expectInteger("элемент", index, "индекс")
  const list = $expectList("элемент", value, "список")
  const at = index - $INDEX_BASE
  if (at < 0 || at >= list.length) {
    $fail("FLANG_BUILTIN_ARGS", `«элемент»: индекс ${index} вне списка длиной ${list.length}`)
  }
  return list[at]
}

function $indexKey(key) {
  if (typeof key !== "string") return -1
  const index = Number(key)
  return Number.isInteger(index) && index >= 0 && String(index) === key ? index : -1
}

// Буферы «добавить»: вид → его буфер и длина. Слабая — вид, который никому
// больше не нужен, обязан уйти вместе со своей записью.
const $VIEWS = new WeakMap()

function $view(cells, end) {
  /* Вид на общий буфер: те же ячейки, своя длина. Так «добавить» стоит
     постоянного времени, а не копии всего списка; обычным массивом это не
     выразить — два массива JS с разной длиной не делят хранилище. Ловушки ниже
     отвечают за одно: вид обязан быть НЕОТЛИЧИМ от массива длиной `end` — за
     концом пусто, ключей сверх своей длины нет, запись отвергается. */
  const view = new Proxy(cells, {
    get(target, key) {
      if (key === "length") return end
      const index = $indexKey(key)
      if (index >= 0) return index < end ? target[index] : undefined
      return target[key]
    },
    has(target, key) {
      if (key === "length") return true
      const index = $indexKey(key)
      if (index >= 0) return index < end
      return key in target
    },
    ownKeys() {
      const keys = []
      for (let index = 0; index < end; index += 1) keys.push(String(index))
      keys.push("length")
      return keys
    },
    getOwnPropertyDescriptor(target, key) {
      if (key === "length") return { value: end, writable: true, enumerable: false, configurable: false }
      const index = $indexKey(key)
      if (index >= 0) {
        if (index >= end) return undefined
        return { value: target[index], writable: true, enumerable: true, configurable: true }
      }
      return Object.getOwnPropertyDescriptor(target, key)
    },
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  })
  $VIEWS.set(view, { cells, end })
  return view
}

function $b_dobavit(item, value) {
  const list = $expectList("добавить", value, "второй аргумент")
  const view = $VIEWS.get(list)
  if (view !== undefined && view.end === view.cells.length) {
    view.cells.push(item)
    return $view(view.cells, view.cells.length)
  }
  /* Копия — из буфера напрямую, а не сквозь ловушки вида: копировать чтением по
     одному элементу стоило бы вдесятеро дороже на ровном месте. */
  const cells = view === undefined ? list.slice() : view.cells.slice(0, view.end)
  cells.push(item)
  return $view(cells, cells.length)
}

/** Запись FTS «Сбор кадров». */
/** @typedef {{ "готовые": Array<string>, "текущий": string }} SborKadrov */

/**
 * Фабрика записи «Сбор кадров».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<SborKadrov>} [fields]
 * @returns {SborKadrov}
 */
export function sozdatSborKadrov(fields = {}) {
  return {
    "готовые": fields["готовые"] ?? null,
    "текущий": fields["текущий"] ?? null,
  }
}

/** Запись FTS «Узел размещения». */
/** @typedef {{ "имя": string, "процессы": Array<string> }} UzelRazmescheniya */

/**
 * Фабрика записи «Узел размещения».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<UzelRazmescheniya>} [fields]
 * @returns {UzelRazmescheniya}
 */
export function sozdatUzelRazmescheniya(fields = {}) {
  return {
    "имя": fields["имя"] ?? null,
    "процессы": fields["процессы"] ?? null,
  }
}

/** Запись FTS «Место процесса». */
/** @typedef {{ "процесс": string, "узел": string }} MestoProcessa */

/**
 * Фабрика записи «Место процесса».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<MestoProcessa>} [fields]
 * @returns {MestoProcessa}
 */
export function sozdatMestoProcessa(fields = {}) {
  return {
    "процесс": fields["процесс"] ?? null,
    "узел": fields["узел"] ?? null,
  }
}

/** Сумма типов FTS «Исход отправки»: «Адресат здесь» | «Через границу» | «Связь потеряна» | «Адресата нет». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} IshodOtpravki */

/**
 * Конструктор варианта «Адресат здесь» суммы «Исход отправки».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function AdresatZdes(fields = {}) {
  return new $FlangVariant("Адресат здесь", fields)
}

/**
 * Конструктор варианта «Через границу» суммы «Исход отправки».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "сосед": string }} fields
 * @returns {$FlangVariant}
 */
export function CherezGranicu(fields = {}) {
  return new $FlangVariant("Через границу", fields)
}

/**
 * Конструктор варианта «Связь потеряна» суммы «Исход отправки».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "сосед": string }} fields
 * @returns {$FlangVariant}
 */
export function SvyazPoteryana(fields = {}) {
  return new $FlangVariant("Связь потеряна", fields)
}

/**
 * Конструктор варианта «Адресата нет» суммы «Исход отправки».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function AdresataNet(fields = {}) {
  return new $FlangVariant("Адресата нет", fields)
}

/**
 * Функция flang «Пульс по умолчанию».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {number}
 */
export function pulsPoUmolchaniyu() {
  // постусловие «пульс по умолчанию положителен»
  if (!$post($gt(200, 0), "пульс по умолчанию положителен", "Пульс по умолчанию")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «пульс по умолчанию положителен» функции «Пульс по умолчанию»", { "line": 58, "column": 3 })
  }
  return 200
}

/**
 * Функция flang «Срок по умолчанию».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {number}
 */
export function srokPoUmolchaniyu() {
  // постусловие «срок по умолчанию — пять пульсов»
  if (!$post($equal(1000, $mul(pulsPoUmolchaniyu(), 5)), "срок по умолчанию — пять пульсов", "Срок по умолчанию")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «срок по умолчанию — пять пульсов» функции «Срок по умолчанию»", { "line": 65, "column": 3 })
  }
  return 1000
}

/**
 * Функция flang «Пауза по умолчанию».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {number}
 */
export function pauzaPoUmolchaniyu() {
  // постусловие «пауза по умолчанию положительна»
  if (!$post($gt(250, 0), "пауза по умолчанию положительна", "Пауза по умолчанию")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «пауза по умолчанию положительна» функции «Пауза по умолчанию»", { "line": 74, "column": 3 })
  }
  return 250
}

/**
 * Функция flang «Период сторожа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} srok — «срок»
 * @returns {number}
 */
export function periodStorozha(srok) {
  const pyataya = $div($sub(srok, $mod(srok, 5)), 5)
  let $t1
  if ($cond($gt(pyataya, 20))) {
    $t1 = pyataya
  } else {
    $t1 = 20
  }
  // постусловие «сторож просыпается не реже, чем раз в двадцать»
  if (!$post($lte(20, $t1), "сторож просыпается не реже, чем раз в двадцать", "Период сторожа")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «сторож просыпается не реже, чем раз в двадцать» функции «Период сторожа»", { "line": 84, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Срок обнаружения молчания».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} srok — «срок»
 * @returns {number}
 */
export function srokObnaruzheniyaMolchaniya(srok) {
  const $t1 = $add(srok, periodStorozha(srok))
  // постусловие «обнаружение не раньше объявленного срока»
  if (!$post($lte(srok, $t1), "обнаружение не раньше объявленного срока", "Срок обнаружения молчания")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «обнаружение не раньше объявленного срока» функции «Срок обнаружения молчания»", { "line": 104, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Срок первого знакомства».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} srok — «срок»
 * @returns {number}
 */
export function srokPervogoZnakomstva(srok) {
  const $t1 = $mul(srok, 30)
  // постусловие «знакомство ждётся дольше, чем обнаружение молчания»
  if (!$post($gt($t1, srokObnaruzheniyaMolchaniya(srok)), "знакомство ждётся дольше, чем обнаружение молчания", "Срок первого знакомства")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «знакомство ждётся дольше, чем обнаружение молчания» функции «Срок первого знакомства»", { "line": 127, "column": 3 })
  }
  return $t1
}

/**
 * Предусловия функции flang «Срок первого знакомства»: их проверяет прогонщик ДО вызова —
 * значения пришли снаружи, и вызывающего, который снял бы требование на
 * проверке, у них нет. В теле функции на это не потрачено ни одной строки.
 *
 * @returns {null | {code: string, message: string, span: object|null}}
 */
export function granicaSrokPervogoZnakomstva(srok) {
  // требует «срок положителен»
  if (!$pre($gt(srok, 0), "срок положителен", "Срок первого знакомства")) {
    return { code: "FLANG_PRECONDITION", message: "не выполнено требование «срок положителен» функции «Срок первого знакомства»", span: { "line": 126, "column": 3 } }
  }
  return null
}

/**
 * Функция flang «Знакомство по умолчанию».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {number}
 */
export function znakomstvoPoUmolchaniyu() {
  // постусловие «знакомство по умолчанию дольше срока по умолчанию»
  if (!$post($gt(30000, srokPoUmolchaniyu()), "знакомство по умолчанию дольше срока по умолчанию", "Знакомство по умолчанию")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «знакомство по умолчанию дольше срока по умолчанию» функции «Знакомство по умолчанию»", { "line": 138, "column": 3 })
  }
  // постусловие «знакомство по умолчанию — тридцать сроков»
  if (!$post($equal(30000, $mul(srokPoUmolchaniyu(), 30)), "знакомство по умолчанию — тридцать сроков", "Знакомство по умолчанию")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «знакомство по умолчанию — тридцать сроков» функции «Знакомство по умолчанию»", { "line": 139, "column": 3 })
  }
  return 30000
}

/**
 * Функция flang «Состояния связи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {Array<string>}
 */
export function sostoyaniyaSvyazi() {
  const $t1 = ["заведена", "потеряна", "отвергнута", "не состоялась"]
  // постусловие «состояний связи ровно четыре»
  if (!$post($equal($b_dlina($t1), 4), "состояний связи ровно четыре", "Состояния связи")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «состояний связи ровно четыре» функции «Состояния связи»", { "line": 152, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Состояние связи известно».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} chto — «что»
 * @returns {*}
 */
export function sostoyanieSvyaziIzvestno(chto) {
  const $t1 = $requireList(sostoyaniyaSvyazi(), "отфильтровать")
  const $t2 = []
  for (const s of $t1) {
    if ($keep($equal(s, chto))) $t2.push(s)
  }
  if ($cond($b_pusto($t2))) {
    return false
  } else {
    return true
  }
}

/**
 * Функция flang «Виды кадров».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {Array<string>}
 */
export function vidyKadrov() {
  const $t1 = ["привет", "письмо", "пульс", "отбой"]
  // постусловие «видов кадров ровно четыре»
  if (!$post($equal($b_dlina($t1), 4), "видов кадров ровно четыре", "Виды кадров")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «видов кадров ровно четыре» функции «Виды кадров»", { "line": 180, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Кадр известен».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} vid — «вид»
 * @returns {*}
 */
export function kadrIzvesten(vid) {
  const $t1 = $requireList(vidyKadrov(), "отфильтровать")
  const $t2 = []
  for (const k of $t1) {
    if ($keep($equal(k, vid))) $t2.push(k)
  }
  if ($cond($b_pusto($t2))) {
    return false
  } else {
    return true
  }
}

/**
 * Функция flang «Кадр уходит до рукопожатия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} vid — «вид»
 * @returns {*}
 */
export function kadrUhoditDoRukopozhatiya(vid) {
  return $equal(vid, "привет")
}

/**
 * Функция flang «Разделитель кадров».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {string}
 */
export function razdelitelKadrov() {
  // постусловие «разделитель кадров — ровно один знак»
  if (!$post($equal($b_dlina("\n"), 1), "разделитель кадров — ровно один знак", "Разделитель кадров")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «разделитель кадров — ровно один знак» функции «Разделитель кадров»", { "line": 231, "column": 3 })
  }
  return "\n"
}

/**
 * Функция flang «Куски потока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} potok — «поток»
 * @returns {Array<string>}
 */
export function kuskiPotoka(potok) {
  const $t1 = $b_razdelit(potok, razdelitelKadrov())
  // постусловие «кусок хотя бы один»
  if (!$post($lte(1, $b_dlina($t1)), "кусок хотя бы один", "Куски потока")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «кусок хотя бы один» функции «Куски потока»", { "line": 237, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Пробельный знак».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} znak — «знак»
 * @returns {*}
 */
export function probelnyyZnak(znak) {
  let $t1
  if ($cond($equal(znak, " "))) {
    $t1 = true
  } else {
    $t1 = $equal(znak, "\t")
  }
  let $t2
  if ($cond($t1)) {
    $t2 = true
  } else {
    $t2 = $equal(znak, "\r")
  }
  if ($cond($t2)) {
    return true
  } else {
    return $equal(znak, "\n")
  }
}

/**
 * Функция flang «Пуста по сути».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} tekst — «текст»
 * @returns {*}
 */
export function pustaPoSuti(tekst) {
  const $t1 = $requireList($b_simvoly(tekst), "отфильтровать")
  const $t2 = []
  for (const znak of $t1) {
    let $t3
    if ($cond(probelnyyZnak(znak))) {
      $t3 = false
    } else {
      $t3 = true
    }
    if ($keep($t3)) $t2.push(znak)
  }
  return $b_pusto($t2)
}

/**
 * Функция flang «Ход сбора кадров».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {SborKadrov} sbor — «сбор»
 * @param {string} kusok — «кусок»
 * @returns {SborKadrov}
 */
export function hodSboraKadrov(sbor, kusok) {
  let $t1
  if ($cond(pustaPoSuti($field(sbor, "текущий")))) {
    $t1 = $field(sbor, "готовые")
  } else {
    $t1 = $b_dobavit($field(sbor, "текущий"), $field(sbor, "готовые"))
  }
  const $t2 = { "готовые": $t1, "текущий": kusok }
  let $t3
  if ($cond(pustaPoSuti($field(sbor, "текущий")))) {
    $t3 = $equal($field($t2, "готовые"), $field(sbor, "готовые"))
  } else {
    $t3 = true
  }
  // постусловие «пустой по сути текущий в готовые не едет»
  if (!$post($t3, "пустой по сути текущий в готовые не едет", "Ход сбора кадров")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «пустой по сути текущий в готовые не едет» функции «Ход сбора кадров»", { "line": 273, "column": 3 })
  }
  // постусловие «ход сбора держит кусок текущим»
  if (!$post($equal($field($t2, "текущий"), kusok), "ход сбора держит кусок текущим", "Ход сбора кадров")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «ход сбора держит кусок текущим» функции «Ход сбора кадров»", { "line": 274, "column": 3 })
  }
  return $t2
}

/**
 * Функция flang «Сбор потока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} potok — «поток»
 * @returns {SborKadrov}
 */
export function sborPotoka(potok) {
  const $t1 = $requireList(kuskiPotoka(potok), "свёртка")
  let sbor = { "готовые": [], "текущий": "" }
  for (const kusok of $t1) {
    sbor = hodSboraKadrov(sbor, kusok)
  }
  // постусловие «готовых кадров меньше, чем кусков потока»
  if (!$post($lt($b_dlina($field(sbor, "готовые")), $b_dlina(kuskiPotoka(potok))), "готовых кадров меньше, чем кусков потока", "Сбор потока")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «готовых кадров меньше, чем кусков потока» функции «Сбор потока»", { "line": 280, "column": 3 })
  }
  return sbor
}

/**
 * Функция flang «Кадры из потока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} potok — «поток»
 * @returns {Array<string>}
 */
export function kadryIzPotoka(potok) {
  const $t1 = $field(sborPotoka(potok), "готовые")
  const $t2 = $requireList($t1, "отфильтровать")
  const $t3 = []
  for (const kadr of $t2) {
    if ($keep($b_soderzhit(kadr, razdelitelKadrov()))) $t3.push(kadr)
  }
  // постусловие «ни в одном кадре разделителя нет»
  if (!$post($b_pusto($t3), "ни в одном кадре разделителя нет", "Кадры из потока")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «ни в одном кадре разделителя нет» функции «Кадры из потока»", { "line": 286, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Хвост потока».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} potok — «поток»
 * @returns {string}
 */
export function hvostPotoka(potok) {
  const $t1 = $field(sborPotoka(potok), "текущий")
  let $t2
  if ($cond($b_soderzhit($t1, razdelitelKadrov()))) {
    $t2 = false
  } else {
    $t2 = true
  }
  // постусловие «в хвосте разделителя нет»
  if (!$post($t2, "в хвосте разделителя нет", "Хвост потока")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «в хвосте разделителя нет» функции «Хвост потока»", { "line": 301, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Метки значений».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {Array<string>}
 */
export function metkiZnacheniy() {
  const $t1 = ["н", "п", "с", "ч", "л", "з", "в"]
  // постусловие «меток значений ровно семь»
  if (!$post($equal($b_dlina($t1), 7), "меток значений ровно семь", "Метки значений")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «меток значений ровно семь» функции «Метки значений»", { "line": 323, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Метка известна».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} metka — «метка»
 * @returns {*}
 */
export function metkaIzvestna(metka) {
  const $t1 = $requireList(metkiZnacheniy(), "отфильтровать")
  const $t2 = []
  for (const eto of $t1) {
    if ($keep($equal(eto, metka))) $t2.push(eto)
  }
  if ($cond($b_pusto($t2))) {
    return false
  } else {
    return true
  }
}

/**
 * Функция flang «Имена чисел».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {Array<string>}
 */
export function imenaChisel() {
  const $t1 = ["NaN", "+∞", "-∞", "-0"]
  // постусловие «имён чисел ровно четыре»
  if (!$post($equal($b_dlina($t1), 4), "имён чисел ровно четыре", "Имена чисел")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «имён чисел ровно четыре» функции «Имена чисел»", { "line": 345, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Число едет именем».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} imya — «имя»
 * @returns {*}
 */
export function chisloEdetImenem(imya) {
  const $t1 = $requireList(imenaChisel(), "отфильтровать")
  const $t2 = []
  for (const eto of $t1) {
    if ($keep($equal(eto, imya))) $t2.push(eto)
  }
  if ($cond($b_pusto($t2))) {
    return false
  } else {
    return true
  }
}

/**
 * Функция flang «Плюс бесконечность».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {number}
 */
export function plyusBeskonechnost() {
  const $t1 = $div(1, 0)
  // постусловие «плюс бесконечность узнаётся своим именем»
  if (!$post($equal(imyaChisla($t1), "+∞"), "плюс бесконечность узнаётся своим именем", "Плюс бесконечность")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «плюс бесконечность узнаётся своим именем» функции «Плюс бесконечность»", { "line": 364, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Минус бесконечность».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {number}
 */
export function minusBeskonechnost() {
  const $t1 = $div($sub(0, 1), 0)
  // постусловие «минус бесконечность узнаётся своим именем»
  if (!$post($equal(imyaChisla($t1), "-∞"), "минус бесконечность узнаётся своим именем", "Минус бесконечность")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «минус бесконечность узнаётся своим именем» функции «Минус бесконечность»", { "line": 369, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Не число».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {number}
 */
export function neChislo() {
  const $t1 = $sub(plyusBeskonechnost(), plyusBeskonechnost())
  // постусловие «не число узнаётся своим именем»
  if (!$post($equal(imyaChisla($t1), "NaN"), "не число узнаётся своим именем", "Не число")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «не число узнаётся своим именем» функции «Не число»", { "line": 376, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Имя числа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} chislo — «число»
 * @returns {string}
 */
export function imyaChisla(chislo) {
  if ($cond($equal($b_k_stroke(chislo), "NaN"))) {
    return "NaN"
  } else {
    if ($cond($equal($b_k_stroke(chislo), "Infinity"))) {
      return "+∞"
    } else {
      if ($cond($equal($b_k_stroke(chislo), "-Infinity"))) {
        return "-∞"
      } else {
        if ($cond($equal($b_k_stroke($div(1, chislo)), "-Infinity"))) {
          return "-0"
        } else {
          return ""
        }
      }
    }
  }
}

/**
 * Функция flang «Число из имени».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} imya — «имя»
 * @returns {number}
 */
export function chisloIzImeni(imya) {
  let $t1
  if ($cond($equal(imya, "NaN"))) {
    $t1 = neChislo()
  } else {
    let $t2
    if ($cond($equal(imya, "+∞"))) {
      $t2 = plyusBeskonechnost()
    } else {
      let $t3
      if ($cond($equal(imya, "-∞"))) {
        $t3 = minusBeskonechnost()
      } else {
        let $t4
        if ($cond($equal(imya, "-0"))) {
          $t4 = -0
        } else {
          $t4 = $b_k_chislu(imya)
        }
        $t3 = $t4
      }
      $t2 = $t3
    }
    $t1 = $t2
  }
  let $t5
  if ($cond($equal(imya, "142"))) {
    $t5 = $equal($t1, 142)
  } else {
    $t5 = true
  }
  // постусловие «обычное имя доезжает числом»
  if (!$post($t5, "обычное имя доезжает числом", "Число из имени")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «обычное имя доезжает числом» функции «Число из имени»", { "line": 413, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Оборот числа через провод».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} chislo — «число»
 * @returns {number}
 */
export function oborotChislaCherezProvod(chislo) {
  const imya = imyaChisla(chislo)
  let $t1
  if ($cond($equal(imya, ""))) {
    $t1 = chislo
  } else {
    $t1 = chisloIzImeni(imya)
  }
  // постусловие «оборот не меняет имени числа»
  if (!$post($equal(imyaChisla($t1), imyaChisla(chislo)), "оборот не меняет имени числа", "Оборот числа через провод")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «оборот не меняет имени числа» функции «Оборот числа через провод»", { "line": 436, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Кадры отправки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {IshodOtpravki} ishod — «исход»
 * @returns {Array<string>}
 */
export function kadryOtpravki(ishod) {
  if ($isVariant(ishod) && ishod.variant === "Адресат здесь") {
    return []
  } else if ($isVariant(ishod) && ishod.variant === "Через границу") {
    const sosed = $variantField(ishod, "сосед")
    return ["письмо"]
  } else if ($isVariant(ishod) && ishod.variant === "Связь потеряна") {
    const sosed$2 = $variantField(ishod, "сосед")
    return []
  } else if ($isVariant(ishod) && ishod.variant === "Адресата нет") {
    return []
  } else {
    $matchFail(ishod)
  }
}

/**
 * Функция flang «Места одного узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {UzelRazmescheniya} uzel — «узел»
 * @returns {Array<MestoProcessa>}
 */
export function mestaOdnogoUzla(uzel) {
  const $t1 = $requireList($field(uzel, "процессы"), "отобразить")
  const $t2 = []
  for (const imya of $t1) {
    $t2.push({ "процесс": imya, "узел": $field(uzel, "имя") })
  }
  // постусловие «мест у узла столько, сколько названо процессов»
  if (!$post($equal($b_dlina($t2), $b_dlina($field(uzel, "процессы"))), "мест у узла столько, сколько названо процессов", "Места одного узла")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «мест у узла столько, сколько названо процессов» функции «Места одного узла»", { "line": 526, "column": 3 })
  }
  const $t3 = $requireList($t2, "отфильтровать")
  const $t4 = []
  for (const m of $t3) {
    let $t5
    if ($cond($equal($field(m, "узел"), $field(uzel, "имя")))) {
      $t5 = false
    } else {
      $t5 = true
    }
    if ($keep($t5)) $t4.push(m)
  }
  // постусловие «все места одного узла названы этим узлом»
  if (!$post($b_pusto($t4), "все места одного узла названы этим узлом", "Места одного узла")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «все места одного узла названы этим узлом» функции «Места одного узла»", { "line": 527, "column": 3 })
  }
  return $t2
}

/**
 * Функция flang «Места размещения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<UzelRazmescheniya>} fayl — «файл»
 * @returns {Array<MestoProcessa>}
 */
export function mestaRazmescheniya(fayl) {
  const $t1 = $requireList(fayl, "свёртка")
  let akk = []
  for (const uzel of $t1) {
    const $t2 = $requireList(mestaOdnogoUzla(uzel), "свёртка")
    let v = akk
    for (const m of $t2) {
      v = $b_dobavit(m, v)
    }
    akk = v
  }
  return akk
}

/**
 * Функция flang «Имена размещённых».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<UzelRazmescheniya>} fayl — «файл»
 * @returns {Array<string>}
 */
export function imenaRazmeschyonnyh(fayl) {
  const $t1 = $requireList(mestaRazmescheniya(fayl), "отобразить")
  const $t2 = []
  for (const m of $t1) {
    $t2.push($field(m, "процесс"))
  }
  // постусловие «имён размещённых столько, сколько мест»
  if (!$post($equal($b_dlina($t2), $b_dlina(mestaRazmescheniya(fayl))), "имён размещённых столько, сколько мест", "Имена размещённых")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «имён размещённых столько, сколько мест» функции «Имена размещённых»", { "line": 540, "column": 3 })
  }
  return $t2
}

/**
 * Функция flang «Имя, встреченное дважды».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<string>} imena — «имена»
 * @returns {string}
 */
export function imyaVstrechennoeDvazhdy(imena) {
  const $t1 = $requireList(imena, "свёртка")
  let beda = ""
  for (const imya of $t1) {
    let $t2
    if ($cond($equal(beda, ""))) {
      $t2 = false
    } else {
      $t2 = true
    }
    let $t3
    if ($cond($t2)) {
      $t3 = beda
    } else {
      const $t4 = $requireList(imena, "отфильтровать")
      const $t5 = []
      for (const eto of $t4) {
        if ($keep($equal(eto, imya))) $t5.push(eto)
      }
      let $t6
      if ($cond($gt($b_dlina($t5), 1))) {
        $t6 = imya
      } else {
        $t6 = beda
      }
      $t3 = $t6
    }
    beda = $t3
  }
  let $t7
  if ($cond($equal(beda, ""))) {
    $t7 = true
  } else {
    const $t8 = $requireList(imena, "отфильтровать")
    const $t9 = []
    for (const eto$2 of $t8) {
      if ($keep($equal(eto$2, beda))) $t9.push(eto$2)
    }
    let $t10
    if ($cond($b_pusto($t9))) {
      $t10 = false
    } else {
      $t10 = true
    }
    $t7 = $t10
  }
  // постусловие «названное дважды имя правда в списке»
  if (!$post($t7, "названное дважды имя правда в списке", "Имя, встреченное дважды")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «названное дважды имя правда в списке» функции «Имя, встреченное дважды»", { "line": 551, "column": 3 })
  }
  return beda
}

/**
 * Функция flang «Размещён дважды».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<UzelRazmescheniya>} fayl — «файл»
 * @returns {string}
 */
export function razmeschyonDvazhdy(fayl) {
  const $t1 = imyaVstrechennoeDvazhdy(imenaRazmeschyonnyh(fayl))
  let $t2
  if ($cond($equal($t1, ""))) {
    $t2 = true
  } else {
    const $t3 = $requireList(imenaRazmeschyonnyh(fayl), "отфильтровать")
    const $t4 = []
    for (const imya of $t3) {
      if ($keep($equal(imya, $t1))) $t4.push(imya)
    }
    let $t5
    if ($cond($b_pusto($t4))) {
      $t5 = false
    } else {
      $t5 = true
    }
    $t2 = $t5
  }
  // постусловие «размещённый дважды правда размещён»
  if (!$post($t2, "размещённый дважды правда размещён", "Размещён дважды")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «размещённый дважды правда размещён» функции «Размещён дважды»", { "line": 557, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Размещение однозначно».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<UzelRazmescheniya>} fayl — «файл»
 * @returns {*}
 */
export function razmeschenieOdnoznachno(fayl) {
  const $t1 = $equal(imyaVstrechennoeDvazhdy(imenaRazmeschyonnyh(fayl)), "")
  let $t2
  if ($cond($t1)) {
    $t2 = true
  } else {
    const $t3 = $requireList(imenaRazmeschyonnyh(fayl), "отфильтровать")
    const $t4 = []
    for (const imya of $t3) {
      if ($keep($equal(imya, razmeschyonDvazhdy(fayl)))) $t4.push(imya)
    }
    let $t5
    if ($cond($b_pusto($t4))) {
      $t5 = false
    } else {
      $t5 = true
    }
    $t2 = $t5
  }
  // постусловие «названный дважды правда размещён»
  if (!$post($t2, "названный дважды правда размещён", "Размещение однозначно")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «названный дважды правда размещён» функции «Размещение однозначно»", { "line": 568, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Узел процесса».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<UzelRazmescheniya>} fayl — «файл»
 * @param {string} process — «процесс»
 * @returns {string}
 */
export function uzelProcessa(fayl, process) {
  const $t1 = $requireList(mestaRazmescheniya(fayl), "свёртка")
  let gde = ""
  for (const m of $t1) {
    let $t2
    if ($cond($equal(gde, ""))) {
      $t2 = false
    } else {
      $t2 = true
    }
    let $t3
    if ($cond($t2)) {
      $t3 = gde
    } else {
      let $t4
      if ($cond($equal($field(m, "процесс"), process))) {
        $t4 = $field(m, "узел")
      } else {
        $t4 = gde
      }
      $t3 = $t4
    }
    gde = $t3
  }
  let $t5
  if ($cond($equal(gde, ""))) {
    $t5 = true
  } else {
    const $t6 = $requireList(fayl, "отфильтровать")
    const $t7 = []
    for (const u of $t6) {
      if ($keep($equal($field(u, "имя"), gde))) $t7.push(u)
    }
    let $t8
    if ($cond($b_pusto($t7))) {
      $t8 = false
    } else {
      $t8 = true
    }
    $t5 = $t8
  }
  // постусловие «названный узел правда есть в файле»
  if (!$post($t5, "названный узел правда есть в файле", "Узел процесса")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «названный узел правда есть в файле» функции «Узел процесса»", { "line": 578, "column": 3 })
  }
  return gde
}

/**
 * Функция flang «Размещение молчит про».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<UzelRazmescheniya>} fayl — «файл»
 * @param {string} process — «процесс»
 * @returns {*}
 */
export function razmeschenieMolchitPro(fayl, process) {
  const $t1 = $equal(uzelProcessa(fayl, process), "")
  let $t2
  if ($cond($t1)) {
    $t2 = false
  } else {
    $t2 = true
  }
  let $t3
  if ($cond($t2)) {
    let $t4
    if ($cond($equal(uzelProcessa(fayl, process), ""))) {
      $t4 = false
    } else {
      $t4 = true
    }
    $t3 = $t4
  } else {
    $t3 = true
  }
  // постусловие «про размещённого размещение не молчит»
  if (!$post($t3, "про размещённого размещение не молчит", "Размещение молчит про")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «про размещённого размещение не молчит» функции «Размещение молчит про»", { "line": 584, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Соседи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<UzelRazmescheniya>} fayl — «файл»
 * @param {string} ya — «я»
 * @returns {Array<string>}
 */
export function sosedi(fayl, ya) {
  const $t1 = $requireList(mestaRazmescheniya(fayl), "свёртка")
  let akk = []
  for (const m of $t1) {
    let $t2
    if ($cond($equal($field(m, "узел"), ya))) {
      $t2 = true
    } else {
      const $t3 = $requireList(akk, "отфильтровать")
      const $t4 = []
      for (const s of $t3) {
        if ($keep($equal(s, $field(m, "узел")))) $t4.push(s)
      }
      let $t5
      if ($cond($b_pusto($t4))) {
        $t5 = false
      } else {
        $t5 = true
      }
      $t2 = $t5
    }
    let $t6
    if ($cond($t2)) {
      $t6 = akk
    } else {
      $t6 = $b_dobavit($field(m, "узел"), akk)
    }
    akk = $t6
  }
  const $t7 = $requireList(akk, "отфильтровать")
  const $t8 = []
  for (const s$2 of $t7) {
    if ($keep($equal(s$2, ya))) $t8.push(s$2)
  }
  // постусловие «себя в соседях нет»
  if (!$post($b_pusto($t8), "себя в соседях нет", "Соседи")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «себя в соседях нет» функции «Соседи»", { "line": 593, "column": 3 })
  }
  return akk
}

/**
 * Функция flang «Кого роняет разрыв».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<UzelRazmescheniya>} fayl — «файл»
 * @param {string} ya — «я»
 * @param {string} sosed — «сосед»
 * @returns {Array<string>}
 */
export function kogoRonyaetRazryv(fayl, ya, sosed) {
  let $t1
  if ($cond($equal(sosed, ya))) {
    $t1 = []
  } else {
    const $t2 = $requireList(mestaRazmescheniya(fayl), "отфильтровать")
    const $t3 = []
    for (const m of $t2) {
      if ($keep($equal($field(m, "узел"), sosed))) $t3.push(m)
    }
    const $t4 = $requireList($t3, "отобразить")
    const $t5 = []
    for (const m$2 of $t4) {
      $t5.push($field(m$2, "процесс"))
    }
    $t1 = $t5
  }
  let $t6
  if ($cond($equal(sosed, ya))) {
    $t6 = $equal($t1, [])
  } else {
    $t6 = true
  }
  // постусловие «разрыв с самим собой не роняет никого»
  if (!$post($t6, "разрыв с самим собой не роняет никого", "Кого роняет разрыв")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «разрыв с самим собой не роняет никого» функции «Кого роняет разрыв»", { "line": 605, "column": 3 })
  }
  const $t7 = $requireList($t1, "отфильтровать")
  const $t8 = []
  for (const imya of $t7) {
    if ($keep($equal(uzelProcessa(fayl, imya), ya))) $t8.push(imya)
  }
  // постусловие «разрыв не роняет ни одного своего процесса»
  if (!$post($b_pusto($t8), "разрыв не роняет ни одного своего процесса", "Кого роняет разрыв")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «разрыв не роняет ни одного своего процесса» функции «Кого роняет разрыв»", { "line": 606, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Части адреса».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} adres — «адрес»
 * @returns {Array<string>}
 */
export function chastiAdresa(adres) {
  const $t1 = $b_razdelit_dokazano(adres, ":")
  // постусловие «часть адреса хотя бы одна»
  if (!$post($lte(1, $b_dlina($t1)), "часть адреса хотя бы одна", "Части адреса")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «часть адреса хотя бы одна» функции «Части адреса»", { "line": 618, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Адрес с портом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} adres — «адрес»
 * @returns {*}
 */
export function adresSPortom(adres) {
  return $gt($b_dlina(chastiAdresa(adres)), 1)
}

/**
 * Функция flang «Порт адреса».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} adres — «адрес»
 * @returns {number}
 */
export function portAdresa(adres) {
  const chasti = chastiAdresa(adres)
  return $b_k_chislu($b_element($b_dlina(chasti), chasti))
}

/**
 * Функция flang «Хозяин адреса».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} adres — «адрес»
 * @returns {string}
 */
export function hozyainAdresa(adres) {
  const chasti = chastiAdresa(adres)
  const portom = $b_element($b_dlina(chasti), chasti)
  const $t1 = $b_podstroka(adres, 1, $sub($sub($b_dlina(adres), $b_dlina(portom)), 1))
  // постусловие «хозяин не длиннее адреса»
  if (!$post($lte($b_dlina($t1), $b_dlina(adres)), "хозяин не длиннее адреса", "Хозяин адреса")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «хозяин не длиннее адреса» функции «Хозяин адреса»", { "line": 644, "column": 3 })
  }
  return $t1
}

/**
 * Связь этого модуля с прогонщиком (`flang_cli.js`): имена flang → функции,
 * фабрика и узнавание варианта, стек под объявленный предел глубины (МиБ) и
 * объявленные типы параметров — граница входа.
 * Прогонщик — соседний файл, а не часть модуля: в браузер он не едет.
 *
 * @type {{functions: Map<string, Function>, variant: Function, isVariant: Function, stackMb: number, entry: object}}
 */
export const $PROGRAM = {
  functions: new Map([
    ["Пульс по умолчанию", pulsPoUmolchaniyu],
    ["Срок по умолчанию", srokPoUmolchaniyu],
    ["Пауза по умолчанию", pauzaPoUmolchaniyu],
    ["Период сторожа", periodStorozha],
    ["Срок обнаружения молчания", srokObnaruzheniyaMolchaniya],
    ["Срок первого знакомства", srokPervogoZnakomstva],
    ["Знакомство по умолчанию", znakomstvoPoUmolchaniyu],
    ["Состояния связи", sostoyaniyaSvyazi],
    ["Состояние связи известно", sostoyanieSvyaziIzvestno],
    ["Виды кадров", vidyKadrov],
    ["Кадр известен", kadrIzvesten],
    ["Кадр уходит до рукопожатия", kadrUhoditDoRukopozhatiya],
    ["Разделитель кадров", razdelitelKadrov],
    ["Куски потока", kuskiPotoka],
    ["Пробельный знак", probelnyyZnak],
    ["Пуста по сути", pustaPoSuti],
    ["Ход сбора кадров", hodSboraKadrov],
    ["Сбор потока", sborPotoka],
    ["Кадры из потока", kadryIzPotoka],
    ["Хвост потока", hvostPotoka],
    ["Метки значений", metkiZnacheniy],
    ["Метка известна", metkaIzvestna],
    ["Имена чисел", imenaChisel],
    ["Число едет именем", chisloEdetImenem],
    ["Плюс бесконечность", plyusBeskonechnost],
    ["Минус бесконечность", minusBeskonechnost],
    ["Не число", neChislo],
    ["Имя числа", imyaChisla],
    ["Число из имени", chisloIzImeni],
    ["Оборот числа через провод", oborotChislaCherezProvod],
    ["Кадры отправки", kadryOtpravki],
    ["Места одного узла", mestaOdnogoUzla],
    ["Места размещения", mestaRazmescheniya],
    ["Имена размещённых", imenaRazmeschyonnyh],
    ["Имя, встреченное дважды", imyaVstrechennoeDvazhdy],
    ["Размещён дважды", razmeschyonDvazhdy],
    ["Размещение однозначно", razmeschenieOdnoznachno],
    ["Узел процесса", uzelProcessa],
    ["Размещение молчит про", razmeschenieMolchitPro],
    ["Соседи", sosedi],
    ["Кого роняет разрыв", kogoRonyaetRazryv],
    ["Части адреса", chastiAdresa],
    ["Адрес с портом", adresSPortom],
    ["Порт адреса", portAdresa],
    ["Хозяин адреса", hozyainAdresa],
  ]),
  /* Предусловия (`требует`) — той же дверью, что и типы: прогонщик зовёт
     гейт ДО вызова, потому что значение приехало снаружи и вызывающего,
     который снял бы требование на проверке, у него нет. В тело функции
     предусловие не печатается: внутри программы оно доказано. */
  pre: new Map([
    ["Срок первого знакомства", granicaSrokPervogoZnakomstva],
  ]),
  variant: (name, fields) => new $FlangVariant(name, fields),
  isVariant: $isVariant,
  stackMb: 79,
  /* Граница входа: объявленные типы параметров данными. Прогонщик сверяет
     по ним значения, пришедшие снаружи, ДО вызова (`checkEntry` в
     flang_cli.js); вид «неизвестно» не сверяется — одной таблицы ему мало. */
  entry: {
    types: [],
    fields: [],
    variants: [],
    params: [],
  },
}
