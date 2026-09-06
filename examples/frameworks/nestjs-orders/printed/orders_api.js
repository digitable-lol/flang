/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

// СГЕНЕРИРОВАНО flang — НЕ ПРАВИТЬ РУКАМИ. Переиздать из корня дерева flang:
// bootstrap/flang emit examples/frameworks/nestjs-orders/core/orders-api.flang --target js --out examples/frameworks/nestjs-orders/printed
// Сгенерировано flang (бэкенд JavaScript, flang/self/emit-js.flang). Не редактировать руками.
// Модуль flang: «Orders API».
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

function $chainEmpty(value) {
  if (typeof value === "string") return value.length === 0
  return $isList(value) && value.length === 0
}

function $chainCons(value) {
  if (typeof value === "string") return value.length > 0
  return $isList(value) && value.length > 0
}

function $chainHead(value) {
  return typeof value === "string" ? Array.from(value)[0] : value[0]
}

function $chainTail(value) {
  return typeof value === "string" ? Array.from(value).slice(1).join("") : value.slice(1)
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

function $gt(left, right) {
  $ord(left, right)
  return left > right
}

function $lte(left, right) {
  $ord(left, right)
  return left <= right
}

function $pairSplits(left, right) {
  /* Сойдутся ли на стыке двух строк высокая и низкая половины суррогатной пары.
     В UTF-16 они слились бы в ОДИН знак: два знака на входе, один на выходе. */
  if (left.length === 0 || right.length === 0) return false
  const last = left.charCodeAt(left.length - 1)
  const first = right.charCodeAt(0)
  return last >= 0xd800 && last <= 0xdbff && first >= 0xdc00 && first <= 0xdfff
}

function $glueCheck(left, right) {
  /* Отказ, а не тихая порча: слияние на стыке сделало бы ложным всякое
     утверждение о длине склейки, а показать разницу это представление не может.
     У целей, где строка — UTF-8 или последовательность кодовых точек, такого
     стыка не бывает вовсе, и проверка там не нужна. */
  if ($pairSplits(left, right)) {
    $fail("FLANG_BUILTIN_ARGS", "«соединить»: на стыке сошлись половины суррогатной пары — два знака слились бы в один")
  }
}

function $glue(left, right) {
  $glueCheck(left, right)
  return left + right
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

function $concat(left, right) {
  if (typeof left !== "string" || typeof right !== "string") {
    $fail("FLANG_TYPE", `«соединить» допустимо только для строк, получено ${$typeName(left)} и ${$typeName(right)}`)
  }
  return $glue(left, right)
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

function $b_soedinit(left, right) {
  if ($isList(left)) {
    const separator = $expectString("соединить", right, "разделитель")
    const parts = left.map((item, index) => {
      if (typeof item !== "string") {
        $fail(
          "FLANG_BUILTIN_ARGS",
          `«соединить»: элемент ${index + 1} списка должен быть строкой, получено ${$typeName(item)}`,
        )
      }
      return item
    })
    let tail = ""
    for (let index = 0; index < parts.length; index++) {
      if (index !== 0) {
        $glueCheck(tail, separator)
        if (separator.length !== 0) tail = separator
      }
      $glueCheck(tail, parts[index])
      if (parts[index].length !== 0) tail = parts[index]
    }
    return parts.join(separator)
  }
  $expectString("соединить", left, "первая строка")
  $expectString("соединить", right, "вторая строка")
  return $glue(left, right)
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

function $b_nachinaetsya_s(text, prefix) {
  $expectString("начинается с", text, "строка")
  $expectString("начинается с", prefix, "префикс")
  if (!text.startsWith(prefix)) return false
  return !$isTorn(prefix) || $isBoundary(text, prefix.length)
}

function $b_pusto(value) {
  if ($isList(value)) return value.length === 0
  if (typeof value === "string") return Array.from(value).length === 0
  $fail("FLANG_BUILTIN_ARGS", `«пусто»: ожидается строка или список, получено ${$typeName(value)}`)
}

function $b_golova_dokazano(value) {
  return $expectList("голова", value, "аргумент")[0]
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

/** Запись FTS «Обрезка слева». */
/** @typedef {{ "началось": *, "готово": string }} ObrezkaSleva */

/**
 * Фабрика записи «Обрезка слева».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<ObrezkaSleva>} [fields]
 * @returns {ObrezkaSleva}
 */
export function sozdatObrezkaSleva(fields = {}) {
  return {
    "началось": fields["началось"] ?? null,
    "готово": fields["готово"] ?? null,
  }
}

/** Запись FTS «Обрезка справа». */
/** @typedef {{ "готово": string, "пробелы": string }} ObrezkaSprava */

/**
 * Фабрика записи «Обрезка справа».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<ObrezkaSprava>} [fields]
 * @returns {ObrezkaSprava}
 */
export function sozdatObrezkaSprava(fields = {}) {
  return {
    "готово": fields["готово"] ?? null,
    "пробелы": fields["пробелы"] ?? null,
  }
}

/** Сумма типов FTS «Связь»: «Связь». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} Svyaz */

/**
 * Конструктор варианта «Связь» суммы «Связь».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "ключ": string, "значение": string }} fields
 * @returns {$FlangVariant}
 */
export function Svyaz(fields) {
  return new $FlangVariant("Связь", fields)
}

/** Сумма типов FTS «Ответ»: «Ответ». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} Otvet */

/**
 * Конструктор варианта «Ответ» суммы «Ответ».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "код": number, "тело": string }} fields
 * @returns {$FlangVariant}
 */
export function Otvet(fields) {
  return new $FlangVariant("Ответ", fields)
}

/**
 * Функция flang «Шаг склейки строк».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} hod — «ход»
 * @param {string} razdelitel — «разделитель»
 * @param {string} chast — «часть»
 * @returns {string}
 */
export function shagSkleykiStrok(hod, razdelitel, chast) {
  return $concat($concat(hod, razdelitel), chast)
}

/**
 * Функция flang «Соединить строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<string>} chasti — «части»
 * @param {string} razdelitel — «разделитель»
 * @returns {string}
 */
export function soedinitStroki(chasti, razdelitel) {
  let $t1
  if ($chainEmpty(chasti)) {
    $t1 = ""
  } else if ($chainCons(chasti)) {
    const golova = $chainHead(chasti)
    const hvost = $chainTail(chasti)
    const $t2 = $requireList(hvost, "свёртка")
    let akk = golova
    for (const chast of $t2) {
      akk = shagSkleykiStrok(akk, razdelitel, chast)
    }
    $t1 = akk
  } else {
    $matchFail(chasti)
  }
  let $t3
  if ($cond($b_pusto(chasti))) {
    $t3 = true
  } else {
    $t3 = $b_nachinaetsya_s($t1, $b_golova_dokazano(chasti))
  }
  // постусловие «склейка начинается первой частью»
  if (!$post($t3, "склейка начинается первой частью", "Соединить строки")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «склейка начинается первой частью» функции «Соединить строки»", { "line": 159, "column": 3 })
  }
  let $t4
  if ($cond($equal($b_dlina(chasti), 1))) {
    $t4 = $equal($t1, $b_golova_dokazano(chasti))
  } else {
    $t4 = true
  }
  // постусловие «одна часть склеивается сама в себя»
  if (!$post($t4, "одна часть склеивается сама в себя", "Соединить строки")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «одна часть склеивается сама в себя» функции «Соединить строки»", { "line": 160, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Разбить по символу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} tekst — «текст»
 * @param {string} razdelitel — «разделитель»
 * @returns {Array<string>}
 */
export function razbitPoSimvolu(tekst, razdelitel) {
  const $t1 = $b_razdelit(tekst, razdelitel)
  // постусловие «разбиение даёт хотя бы одну часть»
  if (!$post($lte(1, $b_dlina($t1)), "разбиение даёт хотя бы одну часть", "Разбить по символу")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «разбиение даёт хотя бы одну часть» функции «Разбить по символу»", { "line": 188, "column": 3 })
  }
  // постусловие «разрезал и склеил тем же разделителем — исходное»
  if (!$post($equal(soedinitStroki($t1, razdelitel), tekst), "разрезал и склеил тем же разделителем — исходное", "Разбить по символу")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «разрезал и склеил тем же разделителем — исходное» функции «Разбить по символу»", { "line": 189, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Символы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} tekst — «текст»
 * @returns {Array<string>}
 */
export function simvoly(tekst) {
  const $t1 = $b_simvoly(tekst)
  // постусловие «разложил и склеил без разделителя — исходное»
  if (!$post($equal($b_soedinit($t1, ""), tekst), "разложил и склеил без разделителя — исходное", "Символы")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «разложил и склеил без разделителя — исходное» функции «Символы»", { "line": 498, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Шаг обращения строки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} hod — «ход»
 * @param {string} bukva — «буква»
 * @returns {string}
 */
export function shagObrascheniyaStroki(hod, bukva) {
  return $concat(bukva, hod)
}

/**
 * Функция flang «Обратить строку».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} tekst — «текст»
 * @returns {string}
 */
export function obratitStroku(tekst) {
  const $t1 = $requireList(simvoly(tekst), "свёртка")
  let akk = ""
  for (const bukva of $t1) {
    akk = shagObrascheniyaStroki(akk, bukva)
  }
  // постусловие «обращение не удлиняет строку»
  if (!$post($lte($b_dlina(akk), $b_dlina(tekst)), "обращение не удлиняет строку", "Обратить строку")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «обращение не удлиняет строку» функции «Обратить строку»", { "line": 533, "column": 3 })
  }
  // постусловие «обращение сохраняет пустоту»
  if (!$post($equal($equal($b_dlina(akk), 0), $equal($b_dlina(tekst), 0)), "обращение сохраняет пустоту", "Обратить строку")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «обращение сохраняет пустоту» функции «Обратить строку»", { "line": 534, "column": 3 })
  }
  let $t2
  if ($cond($equal($b_dlina(akk), $b_dlina(tekst)))) {
    $t2 = $gt($b_dlina(tekst), 0)
  } else {
    $t2 = false
  }
  let $t3
  if ($cond($t2)) {
    $t3 = $equal($b_podstroka(akk, 1, 1), $b_podstroka(tekst, $b_dlina(tekst), $b_dlina(tekst)))
  } else {
    $t3 = true
  }
  // постусловие «при сохранённой длине первый знак обращённого — последний знак исходного»
  if (!$post($t3, "при сохранённой длине первый знак обращённого — последний знак исходного", "Обратить строку")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «при сохранённой длине первый знак обращённого — последний знак исходного» функции «Обратить строку»", { "line": 535, "column": 3 })
  }
  return akk
}

/**
 * Функция flang «Ключ связи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Svyaz} svyaz — «связь»
 * @returns {string}
 */
export function klyuchSvyazi(svyaz) {
  if ($isVariant(svyaz) && svyaz.variant === "Связь") {
    const imya = $variantField(svyaz, "ключ")
    const soderzhimoe = $variantField(svyaz, "значение")
    return imya
  } else {
    $matchFail(svyaz)
  }
}

/**
 * Функция flang «Значение связи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Svyaz} svyaz — «связь»
 * @returns {string}
 */
export function znachenieSvyazi(svyaz) {
  if ($isVariant(svyaz) && svyaz.variant === "Связь") {
    const imya = $variantField(svyaz, "ключ")
    const soderzhimoe = $variantField(svyaz, "значение")
    return soderzhimoe
  } else {
    $matchFail(svyaz)
  }
}

/**
 * Функция flang «Шаг поиска ключа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {*} naydeno — «найдено»
 * @param {Svyaz} svyaz — «связь»
 * @param {string} iskomyy — «искомый»
 * @returns {*}
 */
export function shagPoiskaKlyucha(naydeno, svyaz, iskomyy) {
  if ($cond($equal(klyuchSvyazi(svyaz), iskomyy))) {
    return true
  } else {
    return naydeno
  }
}

/**
 * Функция flang «Есть ключ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Svyaz>} slovar — «словарь»
 * @param {string} iskomyy — «искомый»
 * @returns {*}
 */
export function estKlyuch(slovar, iskomyy) {
  const $t1 = $requireList(slovar, "свёртка")
  let naydeno = false
  for (const svyaz of $t1) {
    naydeno = shagPoiskaKlyucha(naydeno, svyaz, iskomyy)
  }
  // постусловие «ключ найден ровно тогда, когда он есть среди ключей»
  if (!$post($equal(naydeno, $b_soderzhit(klyuchi(slovar), iskomyy)), "ключ найден ровно тогда, когда он есть среди ключей", "Есть ключ")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «ключ найден ровно тогда, когда он есть среди ключей» функции «Есть ключ»", { "line": 94, "column": 3 })
  }
  return naydeno
}

/**
 * Функция flang «Шаг взятия».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} itog — «итог»
 * @param {Svyaz} svyaz — «связь»
 * @param {string} iskomyy — «искомый»
 * @returns {string}
 */
export function shagVzyatiya(itog, svyaz, iskomyy) {
  if ($cond($equal(klyuchSvyazi(svyaz), iskomyy))) {
    return znachenieSvyazi(svyaz)
  } else {
    return itog
  }
}

/**
 * Функция flang «Взять или запасное».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Svyaz>} slovar — «словарь»
 * @param {string} iskomyy — «искомый»
 * @param {string} zapasnoe — «запасное»
 * @returns {string}
 */
export function vzyatIliZapasnoe(slovar, iskomyy, zapasnoe) {
  const $t1 = $requireList(slovar, "свёртка")
  let itog = zapasnoe
  for (const svyaz of $t1) {
    itog = shagVzyatiya(itog, svyaz, iskomyy)
  }
  let $t2
  if ($cond($b_soderzhit(klyuchi(slovar), iskomyy))) {
    $t2 = true
  } else {
    $t2 = $equal(itog, zapasnoe)
  }
  // постусловие «чего нет среди ключей, того и не взято: отдаётся запасное»
  if (!$post($t2, "чего нет среди ключей, того и не взято: отдаётся запасное", "Взять или запасное")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «чего нет среди ключей, того и не взято: отдаётся запасное» функции «Взять или запасное»", { "line": 134, "column": 3 })
  }
  let $t3
  if ($cond($b_soderzhit(znacheniya(slovar), itog))) {
    $t3 = true
  } else {
    $t3 = $equal(itog, zapasnoe)
  }
  // постусловие «взятое — либо одно из значений словаря, либо запасное»
  if (!$post($t3, "взятое — либо одно из значений словаря, либо запасное", "Взять или запасное")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «взятое — либо одно из значений словаря, либо запасное» функции «Взять или запасное»", { "line": 135, "column": 3 })
  }
  return itog
}

/**
 * Функция flang «Убрать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Svyaz>} slovar — «словарь»
 * @param {string} iskomyy — «искомый»
 * @returns {Array<Svyaz>}
 */
export function ubrat(slovar, iskomyy) {
  const $t1 = $requireList(slovar, "свёртка")
  let ostavshiesya = []
  for (const svyaz of $t1) {
    let $t2
    if ($cond($equal(klyuchSvyazi(svyaz), iskomyy))) {
      $t2 = ostavshiesya
    } else {
      $t2 = $b_dobavit(svyaz, ostavshiesya)
    }
    ostavshiesya = $t2
  }
  const $t6 = $b_dlina(ostavshiesya)
  const $t3 = $requireList(klyuchi(slovar), "отфильтровать")
  const $t4 = []
  for (const klch of $t3) {
    let $t5
    if ($cond($equal(klch, iskomyy))) {
      $t5 = false
    } else {
      $t5 = true
    }
    if ($keep($t5)) $t4.push(klch)
  }
  // постусловие «удаление оставляет ровно связи с другими ключами»
  if (!$post($equal($t6, $b_dlina($t4)), "удаление оставляет ровно связи с другими ключами", "Убрать")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «удаление оставляет ровно связи с другими ключами» функции «Убрать»", { "line": 174, "column": 3 })
  }
  let $t7
  if ($cond($b_soderzhit(klyuchi(ostavshiesya), iskomyy))) {
    $t7 = false
  } else {
    $t7 = true
  }
  let $t8
  if ($cond($equal($t7, true))) {
    const $t9 = $requireList(klyuchi(slovar), "отфильтровать")
    const $t10 = []
    for (const klch$2 of $t9) {
      let $t11
      if ($cond($equal(klch$2, iskomyy))) {
        $t11 = false
      } else {
        $t11 = true
      }
      let $t12
      if ($cond($t11)) {
        let $t13
        if ($cond($b_soderzhit(klyuchi(ostavshiesya), klch$2))) {
          $t13 = false
        } else {
          $t13 = true
        }
        $t12 = $t13
      } else {
        $t12 = false
      }
      if ($keep($t12)) $t10.push(klch$2)
    }
    $t8 = $equal($b_dlina($t10), 0)
  } else {
    $t8 = false
  }
  // постусловие «убранного ключа больше нет, а прочие ключи остались»
  if (!$post($t8, "убранного ключа больше нет, а прочие ключи остались", "Убрать")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «убранного ключа больше нет, а прочие ключи остались» функции «Убрать»", { "line": 175, "column": 3 })
  }
  return ostavshiesya
}

/**
 * Функция flang «Положить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Svyaz>} slovar — «словарь»
 * @param {string} klyuch — «ключ»
 * @param {string} znachenie — «значение»
 * @returns {Array<Svyaz>}
 */
export function polozhit(slovar, klyuch, znachenie) {
  const $t1 = $b_dobavit(Svyaz({ "ключ": klyuch, "значение": znachenie }), ubrat(slovar, klyuch))
  let $t2
  if ($cond($equal($b_soderzhit(klyuchi($t1), klyuch), true))) {
    $t2 = $equal(vzyatIliZapasnoe($t1, klyuch, ""), znachenie)
  } else {
    $t2 = false
  }
  // постусловие «положенный ключ есть, и по нему лежит положенное значение»
  if (!$post($t2, "положенный ключ есть, и по нему лежит положенное значение", "Положить")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «положенный ключ есть, и по нему лежит положенное значение» функции «Положить»", { "line": 204, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Шаг сбора ключей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<string>} sobrannye — «собранные»
 * @param {Svyaz} svyaz — «связь»
 * @returns {Array<string>}
 */
export function shagSboraKlyuchey(sobrannye, svyaz) {
  return $b_dobavit(klyuchSvyazi(svyaz), sobrannye)
}

/**
 * Функция flang «Ключи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Svyaz>} slovar — «словарь»
 * @returns {Array<string>}
 */
export function klyuchi(slovar) {
  const $t1 = $requireList(slovar, "свёртка")
  let sobrannye = []
  for (const svyaz of $t1) {
    sobrannye = shagSboraKlyuchey(sobrannye, svyaz)
  }
  const $t2 = $requireList(slovar, "отфильтровать")
  const $t3 = []
  for (const sv of $t2) {
    let $t4
    if ($cond($b_soderzhit(sobrannye, klyuchSvyazi(sv)))) {
      $t4 = false
    } else {
      $t4 = true
    }
    if ($keep($t4)) $t3.push(sv)
  }
  // постусловие «в ключах — ключ каждой связи»
  if (!$post($equal($b_dlina($t3), 0), "в ключах — ключ каждой связи", "Ключи")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «в ключах — ключ каждой связи» функции «Ключи»", { "line": 239, "column": 3 })
  }
  return sobrannye
}

/**
 * Функция flang «Шаг сбора значений».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<string>} sobrannye — «собранные»
 * @param {Svyaz} svyaz — «связь»
 * @returns {Array<string>}
 */
export function shagSboraZnacheniy(sobrannye, svyaz) {
  return $b_dobavit(znachenieSvyazi(svyaz), sobrannye)
}

/**
 * Функция flang «Значения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Svyaz>} slovar — «словарь»
 * @returns {Array<string>}
 */
export function znacheniya(slovar) {
  const $t1 = $requireList(slovar, "свёртка")
  let sobrannye = []
  for (const svyaz of $t1) {
    sobrannye = shagSboraZnacheniy(sobrannye, svyaz)
  }
  const $t2 = $requireList(slovar, "отфильтровать")
  const $t3 = []
  for (const sv of $t2) {
    let $t4
    if ($cond($b_soderzhit(sobrannye, znachenieSvyazi(sv)))) {
      $t4 = false
    } else {
      $t4 = true
    }
    if ($keep($t4)) $t3.push(sv)
  }
  // постусловие «в значениях — значение каждой связи»
  if (!$post($equal($b_dlina($t3), 0), "в значениях — значение каждой связи", "Значения")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «в значениях — значение каждой связи» функции «Значения»", { "line": 264, "column": 3 })
  }
  return sobrannye
}

/**
 * Функция flang «Шаг поиска в множестве».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {*} naydeno — «найдено»
 * @param {string} el — «эл»
 * @param {string} iskomoe — «искомое»
 * @returns {*}
 */
export function shagPoiskaVMnozhestve(naydeno, el, iskomoe) {
  if ($cond($equal(el, iskomoe))) {
    return true
  } else {
    return naydeno
  }
}

/**
 * Функция flang «Есть в множестве».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<string>} mnozhestvo — «множество»
 * @param {string} iskomoe — «искомое»
 * @returns {*}
 */
export function estVMnozhestve(mnozhestvo, iskomoe) {
  const $t1 = $requireList(mnozhestvo, "свёртка")
  let naydeno = false
  for (const el of $t1) {
    naydeno = shagPoiskaVMnozhestve(naydeno, el, iskomoe)
  }
  // постусловие «есть в множестве — это встроенная проверка вхождения»
  if (!$post($equal(naydeno, $b_soderzhit(mnozhestvo, iskomoe)), "есть в множестве — это встроенная проверка вхождения", "Есть в множестве")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «есть в множестве — это встроенная проверка вхождения» функции «Есть в множестве»", { "line": 86, "column": 3 })
  }
  return naydeno
}

/**
 * Функция flang «Добавить в множество».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<string>} mnozhestvo — «множество»
 * @param {string} novoe — «новое»
 * @returns {Array<string>}
 */
export function dobavitVMnozhestvo(mnozhestvo, novoe) {
  let $t1
  if ($cond(estVMnozhestve(mnozhestvo, novoe))) {
    $t1 = mnozhestvo
  } else {
    $t1 = $b_dobavit(novoe, mnozhestvo)
  }
  // постусловие «после добавления новое в множестве есть»
  if (!$post($equal($b_soderzhit($t1, novoe), true), "после добавления новое в множестве есть", "Добавить в множество")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «после добавления новое в множестве есть» функции «Добавить в множество»", { "line": 107, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Шаг разности».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<string>} itog — «итог»
 * @param {string} el — «эл»
 * @param {Array<string>} vtoroe — «второе»
 * @returns {Array<string>}
 */
export function shagRaznosti(itog, el, vtoroe) {
  if ($cond(estVMnozhestve(vtoroe, el))) {
    return itog
  } else {
    return dobavitVMnozhestvo(itog, el)
  }
}

/**
 * Функция flang «Разность».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<string>} pervoe — «первое»
 * @param {Array<string>} vtoroe — «второе»
 * @returns {Array<string>}
 */
export function raznost(pervoe, vtoroe) {
  const $t1 = $requireList(pervoe, "свёртка")
  let itog = []
  for (const el of $t1) {
    itog = shagRaznosti(itog, el, vtoroe)
  }
  // постусловие «разность не длиннее уменьшаемого»
  if (!$post($lte($b_dlina(itog), $b_dlina(pervoe)), "разность не длиннее уменьшаемого", "Разность")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «разность не длиннее уменьшаемого» функции «Разность»", { "line": 262, "column": 3 })
  }
  const $t2 = $requireList(itog, "отфильтровать")
  const $t3 = []
  for (const e of $t2) {
    let $t4
    if ($cond($b_soderzhit(pervoe, e))) {
      $t4 = false
    } else {
      $t4 = true
    }
    let $t5
    if ($cond($t4)) {
      $t5 = true
    } else {
      $t5 = $b_soderzhit(vtoroe, e)
    }
    if ($keep($t5)) $t3.push(e)
  }
  let $t6
  if ($cond($equal($b_dlina($t3), 0))) {
    const $t7 = $requireList(pervoe, "отфильтровать")
    const $t8 = []
    for (const e$2 of $t7) {
      let $t9
      if ($cond($b_soderzhit(vtoroe, e$2))) {
        $t9 = false
      } else {
        $t9 = true
      }
      let $t10
      if ($cond($t9)) {
        let $t11
        if ($cond($b_soderzhit(itog, e$2))) {
          $t11 = false
        } else {
          $t11 = true
        }
        $t10 = $t11
      } else {
        $t10 = false
      }
      if ($keep($t10)) $t8.push(e$2)
    }
    $t6 = $equal($b_dlina($t8), 0)
  } else {
    $t6 = false
  }
  // постусловие «разность — ровно то из первого, чего нет во втором»
  if (!$post($t6, "разность — ровно то из первого, чего нет во втором", "Разность")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «разность — ровно то из первого, чего нет во втором» функции «Разность»", { "line": 263, "column": 3 })
  }
  return itog
}

/**
 * Функция flang «Шаг счёта элементов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} skolko — «сколько»
 * @param {string} el — «эл»
 * @returns {number}
 */
export function shagSchyotaElementov(skolko, el) {
  return $add(skolko, 1)
}

/**
 * Функция flang «Размер множества».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<string>} mnozhestvo — «множество»
 * @returns {number}
 */
export function razmerMnozhestva(mnozhestvo) {
  const $t1 = $requireList(mnozhestvo, "свёртка")
  let skolko = 0
  for (const el of $t1) {
    skolko = shagSchyotaElementov(skolko, el)
  }
  return skolko
}

/**
 * Функция flang «Код ответа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Otvet} otvet — «ответ»
 * @returns {number}
 */
export function kodOtveta(otvet) {
  if ($isVariant(otvet) && otvet.variant === "Ответ") {
    const znachenie = $variantField(otvet, "код")
    const tekst = $variantField(otvet, "тело")
    return znachenie
  } else {
    $matchFail(otvet)
  }
}

/**
 * Функция flang «Тело ответа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Otvet} otvet — «ответ»
 * @returns {string}
 */
export function teloOtveta(otvet) {
  if ($isVariant(otvet) && otvet.variant === "Ответ") {
    const znachenie = $variantField(otvet, "код")
    const tekst = $variantField(otvet, "тело")
    return tekst
  } else {
    $matchFail(otvet)
  }
}

/**
 * Функция flang «Голова строк».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<string>} chasti — «части»
 * @returns {string}
 */
export function golovaStrok(chasti) {
  if ($chainEmpty(chasti)) {
    return ""
  } else if ($chainCons(chasti)) {
    const golova = $chainHead(chasti)
    const hvost = $chainTail(chasti)
    return golova
  } else {
    $matchFail(chasti)
  }
}

/**
 * Функция flang «Хвост строк».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<string>} chasti — «части»
 * @returns {Array<string>}
 */
export function hvostStrok(chasti) {
  if ($chainEmpty(chasti)) {
    return []
  } else if ($chainCons(chasti)) {
    const golova = $chainHead(chasti)
    const hvost = $chainTail(chasti)
    return hvost
  } else {
    $matchFail(chasti)
  }
}

/**
 * Функция flang «Разобрать пару».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} kusok — «кусок»
 * @returns {Svyaz}
 */
export function razobratParu(kusok) {
  return Svyaz({ "ключ": golovaStrok(razbitPoSimvolu(kusok, "=")), "значение": soedinitStroki(hvostStrok(razbitPoSimvolu(kusok, "=")), "=") })
}

/**
 * Функция flang «Разобрать параметры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} hvostadresa — «хвостадреса»
 * @returns {Array<Svyaz>}
 */
export function razobratParametry(hvostadresa) {
  const $t1 = $requireList(razbitPoSimvolu(hvostadresa, "&"), "свёртка")
  let sobrannye = []
  for (const kusok of $t1) {
    sobrannye = polozhit(sobrannye, klyuchSvyazi(razobratParu(kusok)), znachenieSvyazi(razobratParu(kusok)))
  }
  return sobrannye
}

/**
 * Функция flang «Нехватка полей».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Svyaz>} parametry — «параметры»
 * @param {Array<string>} obyazatelnye — «обязательные»
 * @returns {Array<string>}
 */
export function nehvatkaPoley(parametry, obyazatelnye) {
  return raznost(obyazatelnye, klyuchi(parametry))
}

/**
 * Функция flang «Ответ о нехватке».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<string>} nehvatka — «нехватка»
 * @returns {Otvet}
 */
export function otvetONehvatke(nehvatka) {
  return Otvet({ "код": 400, "тело": $concat("не хватает полей: ", soedinitStroki(nehvatka, ", ")) })
}

/**
 * Функция flang «Создать заказ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Svyaz>} parametry — «параметры»
 * @returns {Otvet}
 */
export function sozdatZakaz(parametry) {
  if ($cond($gt(razmerMnozhestva(nehvatkaPoley(parametry, ["товар"])), 0))) {
    return otvetONehvatke(nehvatkaPoley(parametry, ["товар"]))
  } else {
    return Otvet({ "код": 201, "тело": $concat("заказ принят: ", vzyatIliZapasnoe(parametry, "товар", "")) })
  }
}

/**
 * Функция flang «Показать заказ».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Svyaz>} parametry — «параметры»
 * @returns {Otvet}
 */
export function pokazatZakaz(parametry) {
  if ($cond(estKlyuch(parametry, "номер"))) {
    return Otvet({ "код": 200, "тело": $concat("заказ ", vzyatIliZapasnoe(parametry, "номер", "")) })
  } else {
    return otvetONehvatke(["номер"])
  }
}

/**
 * Функция flang «Обработать запрос».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} metod — «метод»
 * @param {string} put — «путь»
 * @param {string} hvostadresa — «хвостадреса»
 * @returns {Otvet}
 */
export function obrabotatZapros(metod, put, hvostadresa) {
  if ($cond($equal(put, "/заказы"))) {
    if ($cond($equal(metod, "POST"))) {
      return sozdatZakaz(razobratParametry(hvostadresa))
    } else {
      if ($cond($equal(metod, "GET"))) {
        return pokazatZakaz(razobratParametry(hvostadresa))
      } else {
        return Otvet({ "код": 405, "тело": "метод не поддержан" })
      }
    }
  } else {
    return Otvet({ "код": 404, "тело": "нет такого пути" })
  }
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
  functions: new Map(/** @type {[string, Function][]} */ ([
    ["Шаг склейки строк", shagSkleykiStrok],
    ["Соединить строки", soedinitStroki],
    ["Разбить по символу", razbitPoSimvolu],
    ["Символы", simvoly],
    ["Шаг обращения строки", shagObrascheniyaStroki],
    ["Обратить строку", obratitStroku],
    ["Ключ связи", klyuchSvyazi],
    ["Значение связи", znachenieSvyazi],
    ["Шаг поиска ключа", shagPoiskaKlyucha],
    ["Есть ключ", estKlyuch],
    ["Шаг взятия", shagVzyatiya],
    ["Взять или запасное", vzyatIliZapasnoe],
    ["Убрать", ubrat],
    ["Положить", polozhit],
    ["Шаг сбора ключей", shagSboraKlyuchey],
    ["Ключи", klyuchi],
    ["Шаг сбора значений", shagSboraZnacheniy],
    ["Значения", znacheniya],
    ["Шаг поиска в множестве", shagPoiskaVMnozhestve],
    ["Есть в множестве", estVMnozhestve],
    ["Добавить в множество", dobavitVMnozhestvo],
    ["Шаг разности", shagRaznosti],
    ["Разность", raznost],
    ["Шаг счёта элементов", shagSchyotaElementov],
    ["Размер множества", razmerMnozhestva],
    ["Код ответа", kodOtveta],
    ["Тело ответа", teloOtveta],
    ["Голова строк", golovaStrok],
    ["Хвост строк", hvostStrok],
    ["Разобрать пару", razobratParu],
    ["Разобрать параметры", razobratParametry],
    ["Нехватка полей", nehvatkaPoley],
    ["Ответ о нехватке", otvetONehvatke],
    ["Создать заказ", sozdatZakaz],
    ["Показать заказ", pokazatZakaz],
    ["Обработать запрос", obrabotatZapros],
  ])),
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
