/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

// СГЕНЕРИРОВАНО flang — НЕ ПРАВИТЬ РУКАМИ. Переиздать из корня дерева flang:
// bootstrap/flang emit examples/frameworks/react-invoice/core/cart.flang --target js --out examples/frameworks/react-invoice/printed
// Сгенерировано flang (бэкенд JavaScript, flang/self/emit-js.flang). Не редактировать руками.
// Модуль flang: «Cart service».
// Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.
// Модуль самодостаточен — ни одной зависимости, работает и в Node, и в браузере.
// Рядом напечатан прогонщик: node flang_cli.js ./<этот файл> — JSON на входе, JSON на выходе.

/* ── рантайм: то и только то, что нужно этому модулю ──
   Представление значений повторяет интерпретатор flang дословно: список —
   массив, запись — обычный объект, вариант — экземпляр класса, «ничто» — null.
   Тексты и коды ошибок тоже дословные: они часть наблюдаемого поведения. */

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

function $gt(left, right) {
  $ord(left, right)
  return left > right
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

/** Запись FTS «Каталог». */
/** @typedef {{ "товары": Array<Tovar> }} Katalog */

/**
 * Фабрика записи «Каталог».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<Katalog>} [fields]
 * @returns {Katalog}
 */
export function sozdatKatalog(fields = {}) {
  return {
    "товары": fields["товары"] ?? null,
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
/** @typedef {{ "позиции": Array<Poziciya> }} Korzina */

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
    "позиции": fields["позиции"] ?? null,
  }
}

/** Сумма типов FTS «Находка»: «Товар найден» | «Товара нет». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} Nahodka */

/**
 * Конструктор варианта «Товар найден» суммы «Находка».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "товар": Tovar }} fields
 * @returns {$FlangVariant}
 */
export function TovarNayden(fields) {
  return new $FlangVariant("Товар найден", fields)
}

/**
 * Конструктор варианта «Товара нет» суммы «Находка».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function TovaraNet(fields = {}) {
  return new $FlangVariant("Товара нет", fields)
}

/**
 * Функция flang «Найти по артикулу».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Katalog} katalog — «каталог»
 * @param {string} artikul — «артикул»
 * @returns {Nahodka}
 */
export function naytiPoArtikulu(katalog, artikul) {
  const $t1 = $requireList($field(katalog, "товары"), "свёртка")
  let naydeno = TovaraNet({})
  for (const tek of $t1) {
    let $t2
    if ($cond($equal($field(tek, "артикул"), artikul))) {
      $t2 = TovarNayden({ "товар": tek })
    } else {
      $t2 = naydeno
    }
    naydeno = $t2
  }
  return naydeno
}

/**
 * Функция flang «Цена находки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Nahodka} nahodka — «находка»
 * @returns {number}
 */
export function cenaNahodki(nahodka) {
  if ($isVariant(nahodka) && nahodka.variant === "Товар найден") {
    const t = $variantField(nahodka, "товар")
    return $field(t, "цена")
  } else if ($isVariant(nahodka) && nahodka.variant === "Товара нет") {
    return 0
  } else {
    $matchFail(nahodka)
  }
}

/**
 * Функция flang «Пустая корзина».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @returns {Korzina}
 */
export function pustayaKorzina() {
  return { "позиции": [] }
}

/**
 * Функция flang «Положить в корзину».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Korzina} korzina — «корзина»
 * @param {Poziciya} poziciya — «позиция»
 * @returns {Korzina}
 */
export function polozhitVKorzinu(korzina, poziciya) {
  return { "позиции": $b_dobavit(poziciya, $field(korzina, "позиции")) }
}

/**
 * Функция flang «Стоимость позиции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Katalog} katalog — «каталог»
 * @param {Poziciya} poziciya — «позиция»
 * @returns {number}
 */
export function stoimostPozicii(katalog, poziciya) {
  return $mul(cenaNahodki(naytiPoArtikulu(katalog, $field(poziciya, "артикул"))), $field(poziciya, "количество"))
}

/**
 * Функция flang «Сумма корзины».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Katalog} katalog — «каталог»
 * @param {Korzina} korzina — «корзина»
 * @returns {number}
 */
export function summaKorziny(katalog, korzina) {
  const $t1 = $requireList($field(korzina, "позиции"), "свёртка")
  let akk = 0
  for (const poziciya of $t1) {
    akk = $add(akk, stoimostPozicii(katalog, poziciya))
  }
  let $t2
  if ($cond($gt($b_dlina($field(korzina, "позиции")), 0))) {
    $t2 = true
  } else {
    $t2 = $equal(akk, 0)
  }
  // постусловие «пустая корзина стоит ноль»
  if (!$post($t2, "пустая корзина стоит ноль", "Сумма корзины")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «пустая корзина стоит ноль» функции «Сумма корзины»", { "line": 64, "column": 3 })
  }
  return akk
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
    $fail("FLANG_PROPERTY", "нарушено свойство «со скидкой платят не больше, чем без неё» функции «Сумма со скидкой»", { "line": 102, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Строка позиции».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Katalog} katalog — «каталог»
 * @param {Poziciya} poziciya — «позиция»
 * @returns {string}
 */
export function strokaPozicii(katalog, poziciya) {
  const $t1 = $concat($concat($concat($concat($field(poziciya, "артикул"), "\t"), $b_k_stroke($field(poziciya, "количество"))), "\t"), $b_k_stroke(stoimostPozicii(katalog, poziciya)))
  // постусловие «в строке счёта назван артикул»
  if (!$post($b_soderzhit($t1, $field(poziciya, "артикул")), "в строке счёта назван артикул", "Строка позиции")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «в строке счёта назван артикул» функции «Строка позиции»", { "line": 117, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Счёт корзины».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Katalog} katalog — «каталог»
 * @param {Korzina} korzina — «корзина»
 * @returns {string}
 */
export function schyotKorziny(katalog, korzina) {
  const $t1 = $requireList($field(korzina, "позиции"), "свёртка")
  let akk = ""
  for (const poziciya of $t1) {
    akk = $concat(akk, $concat(strokaPozicii(katalog, poziciya), "\n"))
  }
  return akk
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
    ["Найти по артикулу", naytiPoArtikulu],
    ["Цена находки", cenaNahodki],
    ["Пустая корзина", pustayaKorzina],
    ["Положить в корзину", polozhitVKorzinu],
    ["Стоимость позиции", stoimostPozicii],
    ["Сумма корзины", summaKorziny],
    ["Скидка в процентах", skidkaVProcentah],
    ["Сумма со скидкой", summaSoSkidkoy],
    ["Строка позиции", strokaPozicii],
    ["Счёт корзины", schyotKorziny],
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
