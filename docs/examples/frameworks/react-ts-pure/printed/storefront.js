/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

// СГЕНЕРИРОВАНО flang — НЕ ПРАВИТЬ РУКАМИ. Переиздать из корня дерева flang:
// bootstrap/flang emit examples/frameworks/react-ts-pure/core/storefront.flang --target js --out examples/frameworks/react-ts-pure/printed
// Сгенерировано flang (бэкенд JavaScript, flang/self/emit-js.flang). Не редактировать руками.
// Модуль flang: «Storefront».
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

function $gte(left, right) {
  $ord(left, right)
  return left >= right
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

function $b_soderzhit(left, right) {
  if ($isList(left)) return left.some((item) => $equal(item, right))
  const text = $expectString("содержит", left, "строка или список")
  const part = $expectString("содержит", right, "искомая подстрока")
  if (!$isTorn(part)) return text.includes(part)
  return $findAligned(text, part, 0) !== -1
}

function $b_k_stroke(value) {
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "да" : "нет"
  if (value === null) return "ничто"
  $fail("FLANG_BUILTIN_ARGS", `«к строке»: ожидается скаляр, получено ${$typeName(value)}`)
}

/** Запись FTS «Товар». */
/** @typedef {{ "артикул": string, "название": string, "цена": number, "остаток": number }} Tovar */

/**
 * Фабрика записи «Товар».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<Tovar>} [fields]
 * @returns {Tovar}
 */
export function sozdatTovar(fields = {}) {
  return {
    "артикул": fields["артикул"] ?? null,
    "название": fields["название"] ?? null,
    "цена": fields["цена"] ?? null,
    "остаток": fields["остаток"] ?? null,
  }
}

/** Запись FTS «Позиция». */
/** @typedef {{ "артикул": string, "количество": number }} Poziciya */

/**
 * Фабрика записи «Позиция».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<Poziciya>} [fields]
 * @returns {Poziciya}
 */
export function sozdatPoziciya(fields = {}) {
  return {
    "артикул": fields["артикул"] ?? null,
    "количество": fields["количество"] ?? null,
  }
}

/** Запись FTS «Корзина». */
/** @typedef {{ "товары": Array<Tovar>, "позиции": Array<Poziciya> }} Korzina */

/**
 * Фабрика записи «Корзина».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<Korzina>} [fields]
 * @returns {Korzina}
 */
export function sozdatKorzina(fields = {}) {
  return {
    "товары": fields["товары"] ?? null,
    "позиции": fields["позиции"] ?? null,
  }
}

/** Запись FTS «Строка витрины». */
/** @typedef {{ "артикул": string, "название": string, "цена": string, "количество": number, "стоимость": string, "больше нельзя": *, "меньше нельзя": * }} StrokaVitriny */

/**
 * Фабрика записи «Строка витрины».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<StrokaVitriny>} [fields]
 * @returns {StrokaVitriny}
 */
export function sozdatStrokaVitriny(fields = {}) {
  return {
    "артикул": fields["артикул"] ?? null,
    "название": fields["название"] ?? null,
    "цена": fields["цена"] ?? null,
    "количество": fields["количество"] ?? null,
    "стоимость": fields["стоимость"] ?? null,
    "больше нельзя": fields["больше нельзя"] ?? null,
    "меньше нельзя": fields["меньше нельзя"] ?? null,
  }
}

/** Запись FTS «Итоги». */
/** @typedef {{ "сумма": string, "сумма копеек": number, "скидка": string, "к оплате": string, "к оплате копеек": number }} Itogi */

/**
 * Фабрика записи «Итоги».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<Itogi>} [fields]
 * @returns {Itogi}
 */
export function sozdatItogi(fields = {}) {
  return {
    "сумма": fields["сумма"] ?? null,
    "сумма копеек": fields["сумма копеек"] ?? null,
    "скидка": fields["скидка"] ?? null,
    "к оплате": fields["к оплате"] ?? null,
    "к оплате копеек": fields["к оплате копеек"] ?? null,
  }
}

/** Сумма типов FTS «Действие»: «Больше» | «Меньше» | «Сбросить». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} Deystvie */

/**
 * Конструктор варианта «Больше» суммы «Действие».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "артикул": string }} fields
 * @returns {$FlangVariant}
 */
export function Bolshe(fields) {
  return new $FlangVariant("Больше", fields)
}

/**
 * Конструктор варианта «Меньше» суммы «Действие».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "артикул": string }} fields
 * @returns {$FlangVariant}
 */
export function Menshe(fields) {
  return new $FlangVariant("Меньше", fields)
}

/**
 * Конструктор варианта «Сбросить» суммы «Действие».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function Sbrosit(fields = {}) {
  return new $FlangVariant("Сбросить", fields)
}

/**
 * Функция flang «Товары витрины».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {Array<Tovar>}
 */
export function tovaryVitriny() {
  return [{ "артикул": "ч-1", "название": "чайник", "цена": 250000, "остаток": 3 }, { "артикул": "к-7", "название": "кружка", "цена": 39000, "остаток": 10 }]
}

/**
 * Функция flang «Начальная корзина».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {Korzina}
 */
export function nachalnayaKorzina() {
  return { "товары": [{ "артикул": "ч-1", "название": "чайник", "цена": 250000, "остаток": 3 }, { "артикул": "к-7", "название": "кружка", "цена": 39000, "остаток": 10 }], "позиции": [{ "артикул": "ч-1", "количество": 2 }, { "артикул": "к-7", "количество": 3 }] }
}

/**
 * Функция flang «Количество».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Korzina} korzina — «корзина»
 * @param {string} artikul — «артикул»
 * @returns {number}
 */
export function kolichestvo(korzina, artikul) {
  const $t1 = $requireList($field(korzina, "позиции"), "свёртка")
  let naydeno = 0
  for (const poziciya of $t1) {
    let $t2
    if ($cond($equal($field(poziciya, "артикул"), artikul))) {
      $t2 = $field(poziciya, "количество")
    } else {
      $t2 = naydeno
    }
    naydeno = $t2
  }
  return naydeno
}

/**
 * Функция flang «Цена товара».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Korzina} korzina — «корзина»
 * @param {string} artikul — «артикул»
 * @returns {number}
 */
export function cenaTovara(korzina, artikul) {
  const $t1 = $requireList($field(korzina, "товары"), "свёртка")
  let naydeno = 0
  for (const tovar of $t1) {
    let $t2
    if ($cond($equal($field(tovar, "артикул"), artikul))) {
      $t2 = $field(tovar, "цена")
    } else {
      $t2 = naydeno
    }
    naydeno = $t2
  }
  return naydeno
}

/**
 * Функция flang «Остаток товара».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Korzina} korzina — «корзина»
 * @param {string} artikul — «артикул»
 * @returns {number}
 */
export function ostatokTovara(korzina, artikul) {
  const $t1 = $requireList($field(korzina, "товары"), "свёртка")
  let naydeno = 0
  for (const tovar of $t1) {
    let $t2
    if ($cond($equal($field(tovar, "артикул"), artikul))) {
      $t2 = $field(tovar, "остаток")
    } else {
      $t2 = naydeno
    }
    naydeno = $t2
  }
  return naydeno
}

/**
 * Функция flang «Зажать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} znachenie — «значение»
 * @param {number} nizhnyaya — «нижняя»
 * @param {number} verhnyaya — «верхняя»
 * @returns {number}
 */
export function zazhat(znachenie, nizhnyaya, verhnyaya) {
  if ($cond($lt(znachenie, nizhnyaya))) {
    return nizhnyaya
  } else {
    if ($cond($gt(znachenie, verhnyaya))) {
      return verhnyaya
    } else {
      return znachenie
    }
  }
}

/**
 * Функция flang «Задать количество».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Korzina} korzina — «корзина»
 * @param {string} artikul — «артикул»
 * @param {number} novoe — «новое»
 * @returns {Korzina}
 */
export function zadatKolichestvo(korzina, artikul, novoe) {
  const zazhatoe = zazhat(novoe, 0, ostatokTovara(korzina, artikul))
  const $t4 = $field(korzina, "товары")
  const $t1 = $requireList($field(korzina, "позиции"), "отобразить")
  const $t2 = []
  for (const poziciya of $t1) {
    let $t3
    if ($cond($equal($field(poziciya, "артикул"), artikul))) {
      $t3 = { "артикул": artikul, "количество": zazhatoe }
    } else {
      $t3 = poziciya
    }
    $t2.push($t3)
  }
  return { "товары": $t4, "позиции": $t2 }
}

/**
 * Функция flang «Шаг».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Korzina} korzina — «корзина»
 * @param {Deystvie} deystvie — «действие»
 * @returns {Korzina}
 */
export function shag(korzina, deystvie) {
  if ($isVariant(deystvie) && deystvie.variant === "Больше") {
    const iskomyy = $variantField(deystvie, "артикул")
    return zadatKolichestvo(korzina, iskomyy, $add(kolichestvo(korzina, iskomyy), 1))
  } else if ($isVariant(deystvie) && deystvie.variant === "Меньше") {
    const iskomyy$2 = $variantField(deystvie, "артикул")
    return zadatKolichestvo(korzina, iskomyy$2, $sub(kolichestvo(korzina, iskomyy$2), 1))
  } else if ($isVariant(deystvie) && deystvie.variant === "Сбросить") {
    const $t3 = $field(korzina, "товары")
    const $t1 = $requireList($field(korzina, "позиции"), "отобразить")
    const $t2 = []
    for (const poziciya of $t1) {
      $t2.push({ "артикул": $field(poziciya, "артикул"), "количество": 0 })
    }
    return { "товары": $t3, "позиции": $t2 }
  } else {
    $matchFail(deystvie)
  }
}

/**
 * Функция flang «Стоимость позиции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Korzina} korzina — «корзина»
 * @param {Poziciya} poziciya — «позиция»
 * @returns {number}
 */
export function stoimostPozicii(korzina, poziciya) {
  return $mul(cenaTovara(korzina, $field(poziciya, "артикул")), $field(poziciya, "количество"))
}

/**
 * Функция flang «Сумма корзины».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Korzina} korzina — «корзина»
 * @returns {number}
 */
export function summaKorziny(korzina) {
  const $t1 = $requireList($field(korzina, "позиции"), "свёртка")
  let summa = 0
  for (const poziciya of $t1) {
    summa = $add(summa, stoimostPozicii(korzina, poziciya))
  }
  let $t2
  if ($cond($gt($b_dlina($field(korzina, "позиции")), 0))) {
    $t2 = true
  } else {
    $t2 = $equal(summa, 0)
  }
  // постусловие «без позиций сумма ноль»
  if (!$post($t2, "без позиций сумма ноль", "Сумма корзины")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «без позиций сумма ноль» функции «Сумма корзины»", { "line": 174, "column": 3 })
  }
  return summa
}

/**
 * Функция flang «Скидка в процентах».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} summa — «сумма»
 * @returns {number}
 */
export function skidkaVProcentah(summa) {
  if ($cond($gte(summa, 2000000))) {
    return 10
  } else {
    if ($cond($gte(summa, 500000))) {
      return 5
    } else {
      return 0
    }
  }
}

/**
 * Функция flang «Сумма со скидкой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} summa — «сумма»
 * @returns {number}
 */
export function summaSoSkidkoy(summa) {
  const $t1 = $sub(summa, $div($mul(summa, skidkaVProcentah(summa)), 100))
  let $t2
  if ($cond($equal($sub(summa, summa), 0))) {
    $t2 = false
  } else {
    $t2 = true
  }
  let $t3
  if ($cond($t2)) {
    $t3 = true
  } else {
    $t3 = $lte($t1, summa)
  }
  // постусловие «со скидкой платят не больше, чем без неё»
  if (!$post($t3, "со скидкой платят не больше, чем без неё", "Сумма со скидкой")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «со скидкой платят не больше, чем без неё» функции «Сумма со скидкой»", { "line": 203, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Две цифры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} znachenie — «значение»
 * @returns {string}
 */
export function dveCifry(znachenie) {
  if ($cond($lt(znachenie, 10))) {
    return $concat("0", $b_k_stroke(znachenie))
  } else {
    return $b_k_stroke(znachenie)
  }
}

/**
 * Функция flang «Хвост разрядов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} cifry — «цифры»
 * @param {number} skolko — «сколько»
 * @returns {string}
 */
export function hvostRazryadov(cifry, skolko) {
  return $b_podstroka(cifry, $sub(skolko, 2), skolko)
}

/**
 * Функция flang «Разряды до девяти».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} cifry — «цифры»
 * @param {number} skolko — «сколько»
 * @returns {string}
 */
export function razryadyDoDevyati(cifry, skolko) {
  return $b_soedinit([$b_podstroka(cifry, 1, $sub(skolko, 6)), " ", $b_podstroka(cifry, $sub(skolko, 5), $sub(skolko, 3)), " ", hvostRazryadov(cifry, skolko)], "")
}

/**
 * Функция flang «Разряды до двенадцати».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} cifry — «цифры»
 * @param {number} skolko — «сколько»
 * @returns {string}
 */
export function razryadyDoDvenadcati(cifry, skolko) {
  return $b_soedinit([$b_podstroka(cifry, 1, $sub(skolko, 9)), " ", $b_podstroka(cifry, $sub(skolko, 8), $sub(skolko, 6)), " ", $b_podstroka(cifry, $sub(skolko, 5), $sub(skolko, 3)), " ", hvostRazryadov(cifry, skolko)], "")
}

/**
 * Функция flang «Разряды длинные».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} cifry — «цифры»
 * @param {number} skolko — «сколько»
 * @returns {string}
 */
export function razryadyDlinnye(cifry, skolko) {
  if ($cond($lte(skolko, 6))) {
    return $b_soedinit([$b_podstroka(cifry, 1, $sub(skolko, 3)), " ", hvostRazryadov(cifry, skolko)], "")
  } else {
    if ($cond($lte(skolko, 9))) {
      return razryadyDoDevyati(cifry, skolko)
    } else {
      if ($cond($lte(skolko, 12))) {
        return razryadyDoDvenadcati(cifry, skolko)
      } else {
        return cifry
      }
    }
  }
}

/**
 * Функция flang «Разряды».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} cifry — «цифры»
 * @returns {string}
 */
export function razryady(cifry) {
  let $t1
  if ($cond($lte($b_dlina(cifry), 3))) {
    $t1 = cifry
  } else {
    $t1 = razryadyDlinnye(cifry, $b_dlina(cifry))
  }
  let $t2
  if ($cond($gt($b_dlina(cifry), 3))) {
    $t2 = true
  } else {
    $t2 = $equal($t1, cifry)
  }
  // постусловие «короткая запись остаётся собой»
  if (!$post($t2, "короткая запись остаётся собой", "Разряды")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «короткая запись остаётся собой» функции «Разряды»", { "line": 281, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Рубли».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} kopeyki — «копейки»
 * @returns {string}
 */
export function rubli(kopeyki) {
  const celye = $div($sub(kopeyki, $mod(kopeyki, 100)), 100)
  const $t1 = $b_soedinit([razryady($b_k_stroke(celye)), ",", dveCifry($mod(kopeyki, 100)), " ₽"], "")
  let $t2
  if ($cond($b_soderzhit($t1, ","))) {
    $t2 = $b_soderzhit($t1, "₽")
  } else {
    $t2 = false
  }
  // постусловие «в записи есть запятая и знак рубля»
  if (!$post($t2, "в записи есть запятая и знак рубля", "Рубли")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «в записи есть запятая и знак рубля» функции «Рубли»", { "line": 301, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Проценты».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} dolya — «доля»
 * @returns {string}
 */
export function procenty(dolya) {
  const $t1 = $concat($b_k_stroke(dolya), " %")
  // постусловие «в записи есть знак процента»
  if (!$post($b_soderzhit($t1, "%"), "в записи есть знак процента", "Проценты")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «в записи есть знак процента» функции «Проценты»", { "line": 320, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Строка витрины».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Korzina} korzina — «корзина»
 * @param {Tovar} tovar — «товар»
 * @returns {StrokaVitriny}
 */
export function strokaVitriny(korzina, tovar) {
  const skolko = kolichestvo(korzina, $field(tovar, "артикул"))
  return { "артикул": $field(tovar, "артикул"), "название": $field(tovar, "название"), "цена": rubli($field(tovar, "цена")), "количество": skolko, "стоимость": rubli($mul($field(tovar, "цена"), skolko)), "больше нельзя": $gte(skolko, $field(tovar, "остаток")), "меньше нельзя": $lte(skolko, 0) }
}

/**
 * Функция flang «Строки витрины».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Korzina} korzina — «корзина»
 * @returns {Array<StrokaVitriny>}
 */
export function strokiVitriny(korzina) {
  const $t1 = $requireList($field(korzina, "товары"), "отобразить")
  const $t2 = []
  for (const tovar of $t1) {
    $t2.push(strokaVitriny(korzina, tovar))
  }
  return $t2
}

/**
 * Функция flang «Итоги».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Korzina} korzina — «корзина»
 * @returns {Itogi}
 */
export function itogi(korzina) {
  const summa = summaKorziny(korzina)
  const itog = summaSoSkidkoy(summa)
  const $t1 = { "сумма": rubli(summa), "сумма копеек": summa, "скидка": procenty(skidkaVProcentah(summa)), "к оплате": rubli(itog), "к оплате копеек": itog }
  // постусловие «к оплате не больше суммы»
  if (!$post($lte($field($t1, "к оплате копеек"), $field($t1, "сумма копеек")), "к оплате не больше суммы", "Итоги")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «к оплате не больше суммы» функции «Итоги»", { "line": 349, "column": 3 })
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
  functions: new Map(/** @type {[string, Function][]} */ ([
    ["Товары витрины", tovaryVitriny],
    ["Начальная корзина", nachalnayaKorzina],
    ["Количество", kolichestvo],
    ["Цена товара", cenaTovara],
    ["Остаток товара", ostatokTovara],
    ["Зажать", zazhat],
    ["Задать количество", zadatKolichestvo],
    ["Шаг", shag],
    ["Стоимость позиции", stoimostPozicii],
    ["Сумма корзины", summaKorziny],
    ["Скидка в процентах", skidkaVProcentah],
    ["Сумма со скидкой", summaSoSkidkoy],
    ["Две цифры", dveCifry],
    ["Хвост разрядов", hvostRazryadov],
    ["Разряды до девяти", razryadyDoDevyati],
    ["Разряды до двенадцати", razryadyDoDvenadcati],
    ["Разряды длинные", razryadyDlinnye],
    ["Разряды", razryady],
    ["Рубли", rubli],
    ["Проценты", procenty],
    ["Строка витрины", strokaVitriny],
    ["Строки витрины", strokiVitriny],
    ["Итоги", itogi],
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
