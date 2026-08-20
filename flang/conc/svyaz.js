/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
// Сгенерировано flang (бэкенд JavaScript, flang/src/emit/js.mjs). Не редактировать руками.
// Модуль flang: «Связь узлов».
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

function $sub(left, right) {
  $nums("sub", left, right)
  return left - right
}

function $gt(left, right) {
  $ord(left, right)
  return left > right
}

function $lte(left, right) {
  $ord(left, right)
  return left <= right
}

function $concat(left, right) {
  if (typeof left !== "string" || typeof right !== "string") {
    $fail("FLANG_TYPE", `«соединить» допустимо только для строк, получено ${$typeName(left)} и ${$typeName(right)}`)
  }
  return left + right
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

function $b_k_stroke(value) {
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "да" : "нет"
  if (value === null) return "ничто"
  $fail("FLANG_BUILTIN_ARGS", `«к строке»: ожидается скаляр, получено ${$typeName(value)}`)
}

/** Запись FTS «Связь». */
/** @typedef {{ "кто": string, "готова": *, "звоним": *, "виделись": *, "ждём решения": *, "последний байт": number }} Svyaz */

/**
 * Фабрика записи «Связь».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<Svyaz>} [fields]
 * @returns {Svyaz}
 */
export function sozdatSvyaz(fields = {}) {
  return {
    "кто": fields["кто"] ?? null,
    "готова": fields["готова"] ?? null,
    "звоним": fields["звоним"] ?? null,
    "виделись": fields["виделись"] ?? null,
    "ждём решения": fields["ждём решения"] ?? null,
    "последний байт": fields["последний байт"] ?? null,
  }
}

/** Запись FTS «Ход связи». */
/** @typedef {{ "связь": Svyaz, "веления": Array<Velenie> }} HodSvyazi */

/**
 * Фабрика записи «Ход связи».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<HodSvyazi>} [fields]
 * @returns {HodSvyazi}
 */
export function sozdatHodSvyazi(fields = {}) {
  return {
    "связь": fields["связь"] ?? null,
    "веления": fields["веления"] ?? null,
  }
}

/** Сумма типов FTS «Что случилось со связью»: «Сокет завёлся» | «Пришёл привет» | «Пришёл пульс» | «Пришло письмо» | «Пришёл отбой» | «Пришёл чужой кадр» | «Байты пришли» | «Сокет отказал» | «Звонок не удался» | «Сторож проснулся». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} ChtoSluchilosSoSvyazyu */

/**
 * Конструктор варианта «Сокет завёлся» суммы «Что случилось со связью».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "сейчас": number }} fields
 * @returns {$FlangVariant}
 */
export function SoketZavyolsya(fields = {}) {
  return new $FlangVariant("Сокет завёлся", fields)
}

/**
 * Конструктор варианта «Пришёл привет» суммы «Что случилось со связью».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "узел": string, "хэш": string }} fields
 * @returns {$FlangVariant}
 */
export function PrishyolPrivet(fields = {}) {
  return new $FlangVariant("Пришёл привет", fields)
}

/**
 * Конструктор варианта «Пришёл пульс» суммы «Что случилось со связью».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function PrishyolPuls(fields = {}) {
  return new $FlangVariant("Пришёл пульс", fields)
}

/**
 * Конструктор варианта «Пришло письмо» суммы «Что случилось со связью».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "кому": string }} fields
 * @returns {$FlangVariant}
 */
export function PrishloPismo(fields = {}) {
  return new $FlangVariant("Пришло письмо", fields)
}

/**
 * Конструктор варианта «Пришёл отбой» суммы «Что случилось со связью».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "почему": string }} fields
 * @returns {$FlangVariant}
 */
export function PrishyolOtboy(fields = {}) {
  return new $FlangVariant("Пришёл отбой", fields)
}

/**
 * Конструктор варианта «Пришёл чужой кадр» суммы «Что случилось со связью».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "вид": string }} fields
 * @returns {$FlangVariant}
 */
export function PrishyolChuzhoyKadr(fields = {}) {
  return new $FlangVariant("Пришёл чужой кадр", fields)
}

/**
 * Конструктор варианта «Байты пришли» суммы «Что случилось со связью».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "сейчас": number }} fields
 * @returns {$FlangVariant}
 */
export function BaytyPrishli(fields = {}) {
  return new $FlangVariant("Байты пришли", fields)
}

/**
 * Конструктор варианта «Сокет отказал» суммы «Что случилось со связью».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "почему": string }} fields
 * @returns {$FlangVariant}
 */
export function SoketOtkazal(fields = {}) {
  return new $FlangVariant("Сокет отказал", fields)
}

/**
 * Конструктор варианта «Звонок не удался» суммы «Что случилось со связью».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function ZvonokNeUdalsya(fields = {}) {
  return new $FlangVariant("Звонок не удался", fields)
}

/**
 * Конструктор варианта «Сторож проснулся» суммы «Что случилось со связью».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "сейчас": number }} fields
 * @returns {$FlangVariant}
 */
export function StorozhProsnulsya(fields = {}) {
  return new $FlangVariant("Сторож проснулся", fields)
}

/** Сумма типов FTS «Веление»: «Послать привет» | «Прибрать» | «Связь заведена» | «Связь отвергнута» | «Доложить о потере» | «Доставить письмо» | «Позвонить снова». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} Velenie */

/**
 * Конструктор варианта «Послать привет» суммы «Веление».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function PoslatPrivet(fields = {}) {
  return new $FlangVariant("Послать привет", fields)
}

/**
 * Конструктор варианта «Прибрать» суммы «Веление».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function Pribrat(fields = {}) {
  return new $FlangVariant("Прибрать", fields)
}

/**
 * Конструктор варианта «Связь заведена» суммы «Веление».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function SvyazZavedena(fields = {}) {
  return new $FlangVariant("Связь заведена", fields)
}

/**
 * Конструктор варианта «Связь отвергнута» суммы «Веление».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "сосед": string, "почему": string }} fields
 * @returns {$FlangVariant}
 */
export function SvyazOtvergnuta(fields = {}) {
  return new $FlangVariant("Связь отвергнута", fields)
}

/**
 * Конструктор варианта «Доложить о потере» суммы «Веление».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "почему": string }} fields
 * @returns {$FlangVariant}
 */
export function DolozhitOPotere(fields = {}) {
  return new $FlangVariant("Доложить о потере", fields)
}

/**
 * Конструктор варианта «Доставить письмо» суммы «Веление».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "кому": string }} fields
 * @returns {$FlangVariant}
 */
export function DostavitPismo(fields = {}) {
  return new $FlangVariant("Доставить письмо", fields)
}

/**
 * Конструктор варианта «Позвонить снова» суммы «Веление».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "пауза": number }} fields
 * @returns {$FlangVariant}
 */
export function PozvonitSnova(fields = {}) {
  return new $FlangVariant("Позвонить снова", fields)
}

/** Сумма типов FTS «Доклад о разрыве»: «Доложить» | «Смолчать». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} DokladORazryve */

/**
 * Конструктор варианта «Доложить» суммы «Доклад о разрыве».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function Dolozhit(fields = {}) {
  return new $FlangVariant("Доложить", fields)
}

/**
 * Конструктор варианта «Смолчать» суммы «Доклад о разрыве».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function Smolchat(fields = {}) {
  return new $FlangVariant("Смолчать", fields)
}

/**
 * Функция flang «Связь заново».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} kto — «кто»
 * @param {*} gotova — «готова»
 * @param {*} zvonim — «звоним»
 * @param {*} videlis — «виделись»
 * @param {*} zhdyomResheniya — «ждём решения»
 * @param {number} posledniyBayt — «последний байт»
 * @returns {Svyaz}
 */
export function svyazZanovo(kto, gotova, zvonim, videlis, zhdyomResheniya, posledniyBayt) {
  return { "кто": kto, "готова": gotova, "звоним": zvonim, "виделись": videlis, "ждём решения": zhdyomResheniya, "последний байт": posledniyBayt }
}

/**
 * Функция flang «Связь с отметкой».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Svyaz} svyaz — «связь»
 * @param {number} kogda — «когда»
 * @returns {Svyaz}
 */
export function svyazSOtmetkoy(svyaz, kogda) {
  return svyazZanovo($field(svyaz, "кто"), $field(svyaz, "готова"), $field(svyaz, "звоним"), $field(svyaz, "виделись"), $field(svyaz, "ждём решения"), kogda)
}

/**
 * Функция flang «Связь снята».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Svyaz} svyaz — «связь»
 * @returns {Svyaz}
 */
export function svyazSnyata(svyaz) {
  return svyazZanovo($field(svyaz, "кто"), false, false, $field(svyaz, "виделись"), $field(svyaz, "ждём решения"), $field(svyaz, "последний байт"))
}

/**
 * Функция flang «Связь ждёт решения».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Svyaz} svyaz — «связь»
 * @returns {Svyaz}
 */
export function svyazZhdyotResheniya(svyaz) {
  return svyazZanovo($field(svyaz, "кто"), false, false, $field(svyaz, "виделись"), true, $field(svyaz, "последний байт"))
}

/**
 * Функция flang «Связь готова».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Svyaz} svyaz — «связь»
 * @returns {Svyaz}
 */
export function svyazGotova(svyaz) {
  return svyazZanovo($field(svyaz, "кто"), true, false, true, false, $field(svyaz, "последний байт"))
}

/**
 * Функция flang «Это потеря».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Velenie} velenie — «веление»
 * @returns {*}
 */
export function etoPoterya(velenie) {
  if ($isVariant(velenie) && velenie.variant === "Послать привет") {
    return false
  } else if ($isVariant(velenie) && velenie.variant === "Прибрать") {
    return false
  } else if ($isVariant(velenie) && velenie.variant === "Связь заведена") {
    return false
  } else if ($isVariant(velenie) && velenie.variant === "Связь отвергнута") {
    const sosed = $variantField(velenie, "сосед")
    const pochemu = $variantField(velenie, "почему")
    return false
  } else if ($isVariant(velenie) && velenie.variant === "Доложить о потере") {
    const pochemu$2 = $variantField(velenie, "почему")
    return true
  } else if ($isVariant(velenie) && velenie.variant === "Доставить письмо") {
    const komu = $variantField(velenie, "кому")
    return false
  } else if ($isVariant(velenie) && velenie.variant === "Позвонить снова") {
    const pauza = $variantField(velenie, "пауза")
    return false
  } else {
    $matchFail(velenie)
  }
}

/**
 * Функция flang «Докладывать ли о разрыве».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Svyaz} svyaz — «связь»
 * @param {*} rabotaet — «работает»
 * @returns {DokladORazryve}
 */
export function dokladyvatLiORazryve(svyaz, rabotaet) {
  let $t1
  if ($cond(rabotaet)) {
    $t1 = $field(svyaz, "виделись")
  } else {
    $t1 = false
  }
  let $t2
  if ($cond($t1)) {
    let $t3
    if ($cond($field(svyaz, "ждём решения"))) {
      $t3 = false
    } else {
      $t3 = true
    }
    $t2 = $t3
  } else {
    $t2 = false
  }
  if ($cond($t2)) {
    return Dolozhit({})
  } else {
    return Smolchat({})
  }
}

/**
 * Функция flang «Потеря связи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Svyaz} svyaz — «связь»
 * @param {string} pochemu — «почему»
 * @param {DokladORazryve} doklad — «доклад»
 * @returns {HodSvyazi}
 */
export function poteryaSvyazi(svyaz, pochemu, doklad) {
  let $t1
  if ($isVariant(doklad) && doklad.variant === "Доложить") {
    $t1 = { "связь": svyazZhdyotResheniya(svyaz), "веления": [Pribrat({}), DolozhitOPotere({ "почему": pochemu })] }
  } else if ($isVariant(doklad) && doklad.variant === "Смолчать") {
    $t1 = { "связь": svyazSnyata(svyaz), "веления": [Pribrat({})] }
  } else {
    $matchFail(doklad)
  }
  const $t2 = $requireList($field($t1, "веления"), "отфильтровать")
  const $t3 = []
  for (const v of $t2) {
    if ($keep(etoPoterya(v))) $t3.push(v)
  }
  // постусловие «один разрыв роняет связь не больше одного раза»
  if (!$post($lte($b_dlina($t3), 1), "один разрыв роняет связь не больше одного раза", "Потеря связи")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «один разрыв роняет связь не больше одного раза» функции «Потеря связи»", { "line": 190, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Начало хэша».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} hesh — «хэш»
 * @returns {string}
 */
export function nachaloHesha(hesh) {
  let $t1
  if ($cond($gt($b_dlina(hesh), 12))) {
    $t1 = $b_podstroka(hesh, 1, 12)
  } else {
    $t1 = hesh
  }
  // постусловие «в сообщение едет не больше двенадцати знаков хэша»
  if (!$post($lte($b_dlina($t1), 12), "в сообщение едет не больше двенадцати знаков хэша", "Начало хэша")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «в сообщение едет не больше двенадцати знаков хэша» функции «Начало хэша»", { "line": 217, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Почему хэш не сошёлся».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} uSoseda — «у соседа»
 * @param {string} uMenya — «у меня»
 * @returns {string}
 */
export function pochemuHeshNeSoshyolsya(uSoseda, uMenya) {
  return $concat($concat($concat("хэш программы не сошёлся: у соседа ", nachaloHesha(uSoseda)), ", у меня "), nachaloHesha(uMenya))
}

/**
 * Функция flang «Кем назвался».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Svyaz} svyaz — «связь»
 * @param {string} uzel — «узел»
 * @returns {string}
 */
export function kemNazvalsya(svyaz, uzel) {
  if ($cond($equal(uzel, ""))) {
    return $field(svyaz, "кто")
  } else {
    return uzel
  }
}

/**
 * Функция flang «Связь замолчала».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Svyaz} svyaz — «связь»
 * @param {number} seychas — «сейчас»
 * @param {number} srok — «срок»
 * @returns {*}
 */
export function svyazZamolchala(svyaz, seychas, srok) {
  return $gt($sub(seychas, $field(svyaz, "последний байт")), srok)
}

/**
 * Функция flang «Почему замолчала».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Svyaz} svyaz — «связь»
 * @param {number} seychas — «сейчас»
 * @param {number} srok — «срок»
 * @returns {string}
 */
export function pochemuZamolchala(svyaz, seychas, srok) {
  return $concat($concat($concat("молчание ", $b_k_stroke($sub(seychas, $field(svyaz, "последний байт")))), " мс при сроке "), $concat($b_k_stroke(srok), " мс"))
}

/**
 * Функция flang «Шаг связи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Svyaz} svyaz — «связь»
 * @param {ChtoSluchilosSoSvyazyu} chto — «что»
 * @param {string} moyHesh — «мой хэш»
 * @param {number} srok — «срок»
 * @param {number} pauza — «пауза»
 * @param {*} rabotaet — «работает»
 * @returns {HodSvyazi}
 */
export function shagSvyazi(svyaz, chto, moyHesh, srok, pauza, rabotaet) {
  if ($isVariant(chto) && chto.variant === "Сокет завёлся") {
    const seychas = $variantField(chto, "сейчас")
    return { "связь": svyazZanovo($field(svyaz, "кто"), false, false, $field(svyaz, "виделись"), $field(svyaz, "ждём решения"), seychas), "веления": [PoslatPrivet({})] }
  } else if ($isVariant(chto) && chto.variant === "Пришёл привет") {
    const uzel = $variantField(chto, "узел")
    const hesh = $variantField(chto, "хэш")
    if ($cond($equal(hesh, moyHesh))) {
      return { "связь": svyazGotova(svyaz), "веления": [SvyazZavedena({})] }
    } else {
      return { "связь": svyazSnyata(svyaz), "веления": [SvyazOtvergnuta({ "сосед": kemNazvalsya(svyaz, uzel), "почему": pochemuHeshNeSoshyolsya(hesh, moyHesh) }), Pribrat({})] }
    }
  } else if ($isVariant(chto) && chto.variant === "Пришёл пульс") {
    return { "связь": svyaz, "веления": [] }
  } else if ($isVariant(chto) && chto.variant === "Пришло письмо") {
    const komu = $variantField(chto, "кому")
    return { "связь": svyaz, "веления": [DostavitPismo({ "кому": komu })] }
  } else if ($isVariant(chto) && chto.variant === "Пришёл отбой") {
    const pochemu = $variantField(chto, "почему")
    return poteryaSvyazi(svyaz, $concat("сосед ушёл сам: ", pochemu), dokladyvatLiORazryve(svyaz, rabotaet))
  } else if ($isVariant(chto) && chto.variant === "Пришёл чужой кадр") {
    const vid = $variantField(chto, "вид")
    return poteryaSvyazi(svyaz, $concat($concat("неизвестный кадр «", vid), "»"), dokladyvatLiORazryve(svyaz, rabotaet))
  } else if ($isVariant(chto) && chto.variant === "Байты пришли") {
    const seychas$2 = $variantField(chto, "сейчас")
    return { "связь": svyazSOtmetkoy(svyaz, seychas$2), "веления": [] }
  } else if ($isVariant(chto) && chto.variant === "Сокет отказал") {
    const pochemu$2 = $variantField(chto, "почему")
    return poteryaSvyazi(svyaz, pochemu$2, dokladyvatLiORazryve(svyaz, rabotaet))
  } else if ($isVariant(chto) && chto.variant === "Звонок не удался") {
    let $t1
    if ($cond(rabotaet)) {
      $t1 = false
    } else {
      $t1 = true
    }
    if ($cond($t1)) {
      return { "связь": svyazSnyata(svyaz), "веления": [] }
    } else {
      if ($cond($field(svyaz, "виделись"))) {
        return poteryaSvyazi(svyaz, "дозвониться не удалось", dokladyvatLiORazryve(svyaz, rabotaet))
      } else {
        return { "связь": svyazSnyata(svyaz), "веления": [PozvonitSnova({ "пауза": pauza })] }
      }
    }
  } else if ($isVariant(chto) && chto.variant === "Сторож проснулся") {
    const seychas$3 = $variantField(chto, "сейчас")
    if ($cond(svyazZamolchala(svyaz, seychas$3, srok))) {
      return poteryaSvyazi(svyaz, pochemuZamolchala(svyaz, seychas$3, srok), dokladyvatLiORazryve(svyaz, rabotaet))
    } else {
      return { "связь": svyaz, "веления": [] }
    }
  } else {
    $matchFail(chto)
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
  functions: new Map([
    ["Связь заново", svyazZanovo],
    ["Связь с отметкой", svyazSOtmetkoy],
    ["Связь снята", svyazSnyata],
    ["Связь ждёт решения", svyazZhdyotResheniya],
    ["Связь готова", svyazGotova],
    ["Это потеря", etoPoterya],
    ["Докладывать ли о разрыве", dokladyvatLiORazryve],
    ["Потеря связи", poteryaSvyazi],
    ["Начало хэша", nachaloHesha],
    ["Почему хэш не сошёлся", pochemuHeshNeSoshyolsya],
    ["Кем назвался", kemNazvalsya],
    ["Связь замолчала", svyazZamolchala],
    ["Почему замолчала", pochemuZamolchala],
    ["Шаг связи", shagSvyazi],
  ]),
  variant: (name, fields) => new $FlangVariant(name, fields),
  isVariant: $isVariant,
  stackMb: 79,
  /* Граница входа: объявленные типы параметров данными. Прогонщик сверяет
     по ним значения, пришедшие снаружи, ДО вызова (`checkEntry` в
     flang_cli.js); вид «неизвестно» не сверяется — одной таблицы ему мало. */
  entry: {
    types: [
      { kind: "строка", name: "строка", owner: "", nothing: false, integer: false, range: false, low: 0, high: 0, item: 0, fieldAt: 0, fieldCount: 0, variantAt: 0, variantCount: 0 },
      { kind: "признак", name: "признак", owner: "", nothing: false, integer: false, range: false, low: 0, high: 0, item: 0, fieldAt: 0, fieldCount: 0, variantAt: 0, variantCount: 0 },
      { kind: "число", name: "число", owner: "", nothing: false, integer: false, range: false, low: 0, high: 0, item: 0, fieldAt: 0, fieldCount: 0, variantAt: 0, variantCount: 0 },
      { kind: "запись", name: "«Связь»", owner: "Связь", nothing: false, integer: false, range: false, low: 0, high: 0, item: 0, fieldAt: 0, fieldCount: 6, variantAt: 0, variantCount: 0 },
      { kind: "сумма", name: "«Веление»", owner: "Веление", nothing: false, integer: false, range: false, low: 0, high: 0, item: 0, fieldAt: 0, fieldCount: 0, variantAt: 0, variantCount: 7 },
      { kind: "число", name: "нат", owner: "", nothing: false, integer: true, range: true, low: 0, high: 9007199254740991, item: 0, fieldAt: 0, fieldCount: 0, variantAt: 0, variantCount: 0 },
      { kind: "сумма", name: "«Доклад о разрыве»", owner: "Доклад о разрыве", nothing: false, integer: false, range: false, low: 0, high: 0, item: 0, fieldAt: 0, fieldCount: 0, variantAt: 7, variantCount: 2 },
      { kind: "сумма", name: "«Что случилось со связью»", owner: "Что случилось со связью", nothing: false, integer: false, range: false, low: 0, high: 0, item: 0, fieldAt: 0, fieldCount: 0, variantAt: 9, variantCount: 10 },
    ],
    fields: [
      { name: "кто", type: 0 },
      { name: "готова", type: 1 },
      { name: "звоним", type: 1 },
      { name: "виделись", type: 1 },
      { name: "ждём решения", type: 1 },
      { name: "последний байт", type: 2 },
      { name: "сосед", type: 0 },
      { name: "почему", type: 0 },
      { name: "почему", type: 0 },
      { name: "кому", type: 0 },
      { name: "пауза", type: 5 },
      { name: "сейчас", type: 2 },
      { name: "узел", type: 0 },
      { name: "хэш", type: 0 },
      { name: "кому", type: 0 },
      { name: "почему", type: 0 },
      { name: "вид", type: 0 },
      { name: "сейчас", type: 2 },
      { name: "почему", type: 0 },
      { name: "сейчас", type: 2 },
    ],
    variants: [
      { name: "Послать привет", fieldAt: 6, fieldCount: 0 },
      { name: "Прибрать", fieldAt: 6, fieldCount: 0 },
      { name: "Связь заведена", fieldAt: 6, fieldCount: 0 },
      { name: "Связь отвергнута", fieldAt: 6, fieldCount: 2 },
      { name: "Доложить о потере", fieldAt: 8, fieldCount: 1 },
      { name: "Доставить письмо", fieldAt: 9, fieldCount: 1 },
      { name: "Позвонить снова", fieldAt: 10, fieldCount: 1 },
      { name: "Доложить", fieldAt: 11, fieldCount: 0 },
      { name: "Смолчать", fieldAt: 11, fieldCount: 0 },
      { name: "Сокет завёлся", fieldAt: 11, fieldCount: 1 },
      { name: "Пришёл привет", fieldAt: 12, fieldCount: 2 },
      { name: "Пришёл пульс", fieldAt: 14, fieldCount: 0 },
      { name: "Пришло письмо", fieldAt: 14, fieldCount: 1 },
      { name: "Пришёл отбой", fieldAt: 15, fieldCount: 1 },
      { name: "Пришёл чужой кадр", fieldAt: 16, fieldCount: 1 },
      { name: "Байты пришли", fieldAt: 17, fieldCount: 1 },
      { name: "Сокет отказал", fieldAt: 18, fieldCount: 1 },
      { name: "Звонок не удался", fieldAt: 19, fieldCount: 0 },
      { name: "Сторож проснулся", fieldAt: 19, fieldCount: 1 },
    ],
    params: [
      { fn: "Связь заново", name: "кто", type: 0 },
      { fn: "Связь заново", name: "готова", type: 1 },
      { fn: "Связь заново", name: "звоним", type: 1 },
      { fn: "Связь заново", name: "виделись", type: 1 },
      { fn: "Связь заново", name: "ждём решения", type: 1 },
      { fn: "Связь заново", name: "последний байт", type: 2 },
      { fn: "Связь с отметкой", name: "связь", type: 3 },
      { fn: "Связь с отметкой", name: "когда", type: 2 },
      { fn: "Связь снята", name: "связь", type: 3 },
      { fn: "Связь ждёт решения", name: "связь", type: 3 },
      { fn: "Связь готова", name: "связь", type: 3 },
      { fn: "Это потеря", name: "веление", type: 4 },
      { fn: "Докладывать ли о разрыве", name: "связь", type: 3 },
      { fn: "Докладывать ли о разрыве", name: "работает", type: 1 },
      { fn: "Потеря связи", name: "связь", type: 3 },
      { fn: "Потеря связи", name: "почему", type: 0 },
      { fn: "Потеря связи", name: "доклад", type: 6 },
      { fn: "Начало хэша", name: "хэш", type: 0 },
      { fn: "Почему хэш не сошёлся", name: "у соседа", type: 0 },
      { fn: "Почему хэш не сошёлся", name: "у меня", type: 0 },
      { fn: "Кем назвался", name: "связь", type: 3 },
      { fn: "Кем назвался", name: "узел", type: 0 },
      { fn: "Связь замолчала", name: "связь", type: 3 },
      { fn: "Связь замолчала", name: "сейчас", type: 2 },
      { fn: "Связь замолчала", name: "срок", type: 5 },
      { fn: "Почему замолчала", name: "связь", type: 3 },
      { fn: "Почему замолчала", name: "сейчас", type: 2 },
      { fn: "Почему замолчала", name: "срок", type: 5 },
      { fn: "Шаг связи", name: "связь", type: 3 },
      { fn: "Шаг связи", name: "что", type: 7 },
      { fn: "Шаг связи", name: "мой хэш", type: 0 },
      { fn: "Шаг связи", name: "срок", type: 5 },
      { fn: "Шаг связи", name: "пауза", type: 5 },
      { fn: "Шаг связи", name: "работает", type: 1 },
    ],
  },
}
