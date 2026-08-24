/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
// Сгенерировано flang (бэкенд JavaScript, flang/src/emit/js.mjs). Не редактировать руками.
// Модуль flang: «Планировщик узла».
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

function $mod(left, right) {
  $nums("mod", left, right)
  return left % right
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

function $concat(left, right) {
  if (typeof left !== "string" || typeof right !== "string") {
    $fail("FLANG_TYPE", `«соединить» допустимо только для строк, получено ${$typeName(left)} и ${$typeName(right)}`)
  }
  return $glue(left, right)
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

function $b_pusto(value) {
  if ($isList(value)) return value.length === 0
  if (typeof value === "string") return Array.from(value).length === 0
  $fail("FLANG_BUILTIN_ARGS", `«пусто»: ожидается строка или список, получено ${$typeName(value)}`)
}

function $b_hvost(value) {
  const list = $expectList("хвост", value, "аргумент")
  if (list.length === 0) $fail("FLANG_BUILTIN_ARGS", "«хвост»: список пуст")
  return list.slice(1)
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

function $b_pripisat(item, value) {
  const list = $expectList("приписать", value, "второй аргумент")
  const view = $VIEWS.get(list)
  const cells = view === undefined ? list : view.cells.slice(0, view.end)
  return [item, ...cells]
}

/** Запись FTS «Письмо». */
/** @typedef {{ "билет": number, "начатое": * }} Pismo */

/**
 * Фабрика записи «Письмо».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<Pismo>} [fields]
 * @returns {Pismo}
 */
export function sozdatPismo(fields = {}) {
  return {
    "билет": fields["билет"] ?? null,
    "начатое": fields["начатое"] ?? null,
  }
}

/** Запись FTS «Процесс». */
/** @typedef {{ "имя": string, "свой": *, "на каком": string, "жив": *, "причина": string, "потолок": number, "в лёте": number, "ящик": Array<Pismo> }} Process */

/**
 * Фабрика записи «Процесс».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<Process>} [fields]
 * @returns {Process}
 */
export function sozdatProcess(fields = {}) {
  return {
    "имя": fields["имя"] ?? null,
    "свой": fields["свой"] ?? null,
    "на каком": fields["на каком"] ?? null,
    "жив": fields["жив"] ?? null,
    "причина": fields["причина"] ?? null,
    "потолок": fields["потолок"] ?? null,
    "в лёте": fields["в лёте"] ?? null,
    "ящик": fields["ящик"] ?? null,
  }
}

/** Запись FTS «Узел». */
/** @typedef {{ "имя": string, "процессы": Array<Process>, "связи": Array<string>, "кто бежит": string, "что бежит": number, "работает": * }} Uzel */

/**
 * Фабрика записи «Узел».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<Uzel>} [fields]
 * @returns {Uzel}
 */
export function sozdatUzel(fields = {}) {
  return {
    "имя": fields["имя"] ?? null,
    "процессы": fields["процессы"] ?? null,
    "связи": fields["связи"] ?? null,
    "кто бежит": fields["кто бежит"] ?? null,
    "что бежит": fields["что бежит"] ?? null,
    "работает": fields["работает"] ?? null,
  }
}

/** Запись FTS «Ход узла». */
/** @typedef {{ "узел": Uzel, "веления": Array<VelenieUzlu> }} HodUzla */

/**
 * Фабрика записи «Ход узла».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<HodUzla>} [fields]
 * @returns {HodUzla}
 */
export function sozdatHodUzla(fields = {}) {
  return {
    "узел": fields["узел"] ?? null,
    "веления": fields["веления"] ?? null,
  }
}

/** Сумма типов FTS «Что случилось с узлом»: «Письмо снаружи» | «Обработчик вернул» | «Обработчик отказал» | «Таймер сработал» | «Связь готова» | «Связь потеряна» | «Узел пропал» | «Пора бежать». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} ChtoSluchilosSUzlom */

/**
 * Конструктор варианта «Письмо снаружи» суммы «Что случилось с узлом».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "кому": string, "билет": number }} fields
 * @returns {$FlangVariant}
 */
export function PismoSnaruzhi(fields = {}) {
  return new $FlangVariant("Письмо снаружи", fields)
}

/**
 * Конструктор варианта «Обработчик вернул» суммы «Что случилось с узлом».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "действия": Array<DeystvieUzla> }} fields
 * @returns {$FlangVariant}
 */
export function ObrabotchikVernul(fields = {}) {
  return new $FlangVariant("Обработчик вернул", fields)
}

/**
 * Конструктор варианта «Обработчик отказал» суммы «Что случилось с узлом».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "код": string, "текст": string }} fields
 * @returns {$FlangVariant}
 */
export function ObrabotchikOtkazal(fields = {}) {
  return new $FlangVariant("Обработчик отказал", fields)
}

/**
 * Конструктор варианта «Таймер сработал» суммы «Что случилось с узлом».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "кому": string, "билет": number }} fields
 * @returns {$FlangVariant}
 */
export function TaymerSrabotal(fields = {}) {
  return new $FlangVariant("Таймер сработал", fields)
}

/**
 * Конструктор варианта «Связь готова» суммы «Что случилось с узлом».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "узел": string }} fields
 * @returns {$FlangVariant}
 */
export function SvyazGotova(fields = {}) {
  return new $FlangVariant("Связь готова", fields)
}

/**
 * Конструктор варианта «Связь потеряна» суммы «Что случилось с узлом».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "узел": string, "почему": string }} fields
 * @returns {$FlangVariant}
 */
export function SvyazPoteryana(fields = {}) {
  return new $FlangVariant("Связь потеряна", fields)
}

/**
 * Конструктор варианта «Узел пропал» суммы «Что случилось с узлом».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "узел": string, "почему": string }} fields
 * @returns {$FlangVariant}
 */
export function UzelPropal(fields = {}) {
  return new $FlangVariant("Узел пропал", fields)
}

/**
 * Конструктор варианта «Пора бежать» суммы «Что случилось с узлом».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "жребий": number }} fields
 * @returns {$FlangVariant}
 */
export function PoraBezhat(fields = {}) {
  return new $FlangVariant("Пора бежать", fields)
}

/** Сумма типов FTS «Действие узла»: «Велено слать» | «Велено слать позже» | «Велено отложить» | «Велено продолжить» | «Велено остановить». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} DeystvieUzla */

/**
 * Конструктор варианта «Велено слать» суммы «Действие узла».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "кому": string, "билет": number }} fields
 * @returns {$FlangVariant}
 */
export function VelenoSlat(fields = {}) {
  return new $FlangVariant("Велено слать", fields)
}

/**
 * Конструктор варианта «Велено слать позже» суммы «Действие узла».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "кому": string, "билет": number, "задержка": number }} fields
 * @returns {$FlangVariant}
 */
export function VelenoSlatPozzhe(fields = {}) {
  return new $FlangVariant("Велено слать позже", fields)
}

/**
 * Конструктор варианта «Велено отложить» суммы «Действие узла».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function VelenoOtlozhit(fields = {}) {
  return new $FlangVariant("Велено отложить", fields)
}

/**
 * Конструктор варианта «Велено продолжить» суммы «Действие узла».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function VelenoProdolzhit(fields = {}) {
  return new $FlangVariant("Велено продолжить", fields)
}

/**
 * Конструктор варианта «Велено остановить» суммы «Действие узла».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "почему": string }} fields
 * @returns {$FlangVariant}
 */
export function VelenoOstanovit(fields = {}) {
  return new $FlangVariant("Велено остановить", fields)
}

/** Сумма типов FTS «Веление узлу»: «Позвать обработчик» | «Послать по проводу» | «Поставить таймер» | «Записать в журнал» | «Уронить процесс» | «Письмо пропало». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} VelenieUzlu */

/**
 * Конструктор варианта «Позвать обработчик» суммы «Веление узлу».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "кто": string, "билет": number }} fields
 * @returns {$FlangVariant}
 */
export function PozvatObrabotchik(fields = {}) {
  return new $FlangVariant("Позвать обработчик", fields)
}

/**
 * Конструктор варианта «Послать по проводу» суммы «Веление узлу».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "узел": string, "кому": string, "билет": number }} fields
 * @returns {$FlangVariant}
 */
export function PoslatPoProvodu(fields = {}) {
  return new $FlangVariant("Послать по проводу", fields)
}

/**
 * Конструктор варианта «Поставить таймер» суммы «Веление узлу».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "кому": string, "билет": number, "задержка": number }} fields
 * @returns {$FlangVariant}
 */
export function PostavitTaymer(fields = {}) {
  return new $FlangVariant("Поставить таймер", fields)
}

/**
 * Конструктор варианта «Записать в журнал» суммы «Веление узлу».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "вид": string, "кто": string, "почему": string }} fields
 * @returns {$FlangVariant}
 */
export function ZapisatVZhurnal(fields = {}) {
  return new $FlangVariant("Записать в журнал", fields)
}

/**
 * Конструктор варианта «Уронить процесс» суммы «Веление узлу».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "кто": string, "код": string, "текст": string }} fields
 * @returns {$FlangVariant}
 */
export function UronitProcess(fields = {}) {
  return new $FlangVariant("Уронить процесс", fields)
}

/**
 * Конструктор варианта «Письмо пропало» суммы «Веление узлу».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "кому": string, "почему": string }} fields
 * @returns {$FlangVariant}
 */
export function PismoPropalo(fields = {}) {
  return new $FlangVariant("Письмо пропало", fields)
}

/** Сумма типов FTS «Может быть процесс»: «Есть процесс» | «Нет процесса». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} MozhetBytProcess */

/**
 * Конструктор варианта «Есть процесс» суммы «Может быть процесс».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "процесс": Process }} fields
 * @returns {$FlangVariant}
 */
export function EstProcess(fields = {}) {
  return new $FlangVariant("Есть процесс", fields)
}

/**
 * Конструктор варианта «Нет процесса» суммы «Может быть процесс».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function NetProcessa(fields = {}) {
  return new $FlangVariant("Нет процесса", fields)
}

/** Сумма типов FTS «Исход доставки»: «Легло» | «Некому» | «Полон». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} IshodDostavki */

/**
 * Конструктор варианта «Легло» суммы «Исход доставки».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function Leglo(fields = {}) {
  return new $FlangVariant("Легло", fields)
}

/**
 * Конструктор варианта «Некому» суммы «Исход доставки».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function Nekomu(fields = {}) {
  return new $FlangVariant("Некому", fields)
}

/**
 * Конструктор варианта «Полон» суммы «Исход доставки».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function Polon(fields = {}) {
  return new $FlangVariant("Полон", fields)
}

/** Сумма типов FTS «Может быть письмо»: «Есть письмо» | «Нет письма». */
/** Дискриминант — поле «variant»; поля варианта лежат в «fields». */
/** @typedef {$FlangVariant} MozhetBytPismo */

/**
 * Конструктор варианта «Есть письмо» суммы «Может быть письмо».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @param {{ "письмо": Pismo }} fields
 * @returns {$FlangVariant}
 */
export function EstPismo(fields = {}) {
  return new $FlangVariant("Есть письмо", fields)
}

/**
 * Конструктор варианта «Нет письма» суммы «Может быть письмо».
 *
 * Поля не копируются, а берутся как есть: интерпретатор строит объект полей
 * в порядке узла AST, и порядок ключей виден в диагностиках разбора.
 *
 * @returns {$FlangVariant}
 */
export function NetPisma(fields = {}) {
  return new $FlangVariant("Нет письма", fields)
}

/**
 * Функция flang «Первый процесс».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Process>} processy — «процессы»
 * @returns {MozhetBytProcess}
 */
export function pervyyProcess(processy) {
  let $t1
  if ($chainEmpty(processy)) {
    $t1 = NetProcessa({})
  } else if ($chainCons(processy)) {
    const golova = $chainHead(processy)
    const hvost = $chainTail(processy)
    $t1 = EstProcess({ "процесс": golova })
  } else {
    $matchFail(processy)
  }
  let $t2
  if ($cond($b_pusto(processy))) {
    $t2 = $equal($t1, NetProcessa({}))
  } else {
    $t2 = true
  }
  // постусловие «у пустой таблицы процесса нет»
  if (!$post($t2, "у пустой таблицы процесса нет", "Первый процесс")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «у пустой таблицы процесса нет» функции «Первый процесс»", { "line": 165, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Найти процесс».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Process>} processy — «процессы»
 * @param {string} imya — «имя»
 * @returns {MozhetBytProcess}
 */
export function naytiProcess(processy, imya) {
  const $t1 = $requireList(processy, "отфильтровать")
  const $t2 = []
  for (const p of $t1) {
    if ($keep($equal($field(p, "имя"), imya))) $t2.push(p)
  }
  const $t3 = pervyyProcess($t2)
  const $t4 = $requireList(processy, "отфильтровать")
  const $t5 = []
  for (const p$2 of $t4) {
    if ($keep($equal($field(p$2, "имя"), imya))) $t5.push(p$2)
  }
  // постусловие «найденное есть первое из подходящих по имени»
  if (!$post($equal($t3, pervyyProcess($t5)), "найденное есть первое из подходящих по имени", "Найти процесс")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «найденное есть первое из подходящих по имени» функции «Найти процесс»", { "line": 175, "column": 3 })
  }
  return $t3
}

/**
 * Функция flang «Заменить процесс».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Process>} processy — «процессы»
 * @param {Process} novyy — «новый»
 * @returns {Array<Process>}
 */
export function zamenitProcess(processy, novyy) {
  const $t1 = $requireList(processy, "отобразить")
  const $t2 = []
  for (const p of $t1) {
    let $t3
    if ($cond($equal($field(p, "имя"), $field(novyy, "имя")))) {
      $t3 = novyy
    } else {
      $t3 = p
    }
    $t2.push($t3)
  }
  // постусловие «замена сохраняет длину таблицы»
  if (!$post($equal($b_dlina($t2), $b_dlina(processy)), "замена сохраняет длину таблицы", "Заменить процесс")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «замена сохраняет длину таблицы» функции «Заменить процесс»", { "line": 184, "column": 3 })
  }
  return $t2
}

/**
 * Функция flang «С процессом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {Process} novyy — «новый»
 * @returns {Uzel}
 */
export function sProcessom(uzel, novyy) {
  const $t1 = { "имя": $field(uzel, "имя"), "процессы": zamenitProcess($field(uzel, "процессы"), novyy), "связи": $field(uzel, "связи"), "кто бежит": $field(uzel, "кто бежит"), "что бежит": $field(uzel, "что бежит"), "работает": $field(uzel, "работает") }
  // постусловие «с процессом ставит пересобранную таблицу»
  if (!$post($equal($field($t1, "процессы"), zamenitProcess($field(uzel, "процессы"), novyy)), "с процессом ставит пересобранную таблицу", "С процессом")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «с процессом ставит пересобранную таблицу» функции «С процессом»", { "line": 190, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Узел с ходом».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {string} ktoBezhit — «кто бежит»
 * @param {number} chtoBezhit — «что бежит»
 * @returns {Uzel}
 */
export function uzelSHodom(uzel, ktoBezhit, chtoBezhit) {
  const $t1 = { "имя": $field(uzel, "имя"), "процессы": $field(uzel, "процессы"), "связи": $field(uzel, "связи"), "кто бежит": ktoBezhit, "что бежит": chtoBezhit, "работает": $field(uzel, "работает") }
  let $t2
  if ($cond($equal($field($t1, "кто бежит"), ktoBezhit))) {
    $t2 = $equal($field($t1, "что бежит"), chtoBezhit)
  } else {
    $t2 = false
  }
  // постусловие «узел с ходом помнит кто и что бежит»
  if (!$post($t2, "узел с ходом помнит кто и что бежит", "Узел с ходом")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «узел с ходом помнит кто и что бежит» функции «Узел с ходом»", { "line": 196, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Узел со связями».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {Array<string>} svyazi — «связи»
 * @returns {Uzel}
 */
export function uzelSoSvyazyami(uzel, svyazi) {
  const $t1 = { "имя": $field(uzel, "имя"), "процессы": $field(uzel, "процессы"), "связи": svyazi, "кто бежит": $field(uzel, "кто бежит"), "что бежит": $field(uzel, "что бежит"), "работает": $field(uzel, "работает") }
  // постусловие «узел со связями ставит поданные связи»
  if (!$post($equal($field($t1, "связи"), svyazi), "узел со связями ставит поданные связи", "Узел со связями")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «узел со связями ставит поданные связи» функции «Узел со связями»", { "line": 202, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Процесс заново».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} imya — «имя»
 * @param {*} svoy — «свой»
 * @param {string} naKakom — «на каком»
 * @param {*} zhiv — «жив»
 * @param {string} prichina — «причина»
 * @param {number} potolok — «потолок»
 * @param {number} vLyote — «в лёте»
 * @param {Array<Pismo>} yaschik — «ящик»
 * @returns {Process}
 */
export function processZanovo(imya, svoy, naKakom, zhiv, prichina, potolok, vLyote, yaschik) {
  const $t1 = { "имя": imya, "свой": svoy, "на каком": naKakom, "жив": zhiv, "причина": prichina, "потолок": potolok, "в лёте": vLyote, "ящик": yaschik }
  let $t2
  if ($cond($equal($field($t1, "имя"), imya))) {
    $t2 = $equal($field($t1, "ящик"), yaschik)
  } else {
    $t2 = false
  }
  let $t3
  if ($cond($t2)) {
    $t3 = $equal($field($t1, "потолок"), potolok)
  } else {
    $t3 = false
  }
  // постусловие «процесс заново берёт имя ящик и потолок»
  if (!$post($t3, "процесс заново берёт имя ящик и потолок", "Процесс заново")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «процесс заново берёт имя ящик и потолок» функции «Процесс заново»", { "line": 210, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «С ящиком».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Process} process — «процесс»
 * @param {Array<Pismo>} yaschik — «ящик»
 * @returns {Process}
 */
export function sYaschikom(process, yaschik) {
  const $t1 = processZanovo($field(process, "имя"), $field(process, "свой"), $field(process, "на каком"), $field(process, "жив"), $field(process, "причина"), $field(process, "потолок"), $field(process, "в лёте"), yaschik)
  // постусловие «с ящиком ставит поданный ящик»
  if (!$post($equal($field($t1, "ящик"), yaschik), "с ящиком ставит поданный ящик", "С ящиком")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «с ящиком ставит поданный ящик» функции «С ящиком»", { "line": 216, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Умертвить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Process} process — «процесс»
 * @param {string} prichina — «причина»
 * @returns {Process}
 */
export function umertvit(process, prichina) {
  const $t1 = processZanovo($field(process, "имя"), $field(process, "свой"), $field(process, "на каком"), false, prichina, $field(process, "потолок"), $field(process, "в лёте"), $field(process, "ящик"))
  let $t2
  if ($cond($equal($field($t1, "жив"), false))) {
    $t2 = $equal($field($t1, "причина"), prichina)
  } else {
    $t2 = false
  }
  // постусловие «умерщвлённый не жив и помнит причину»
  if (!$post($t2, "умерщвлённый не жив и помнит причину", "Умертвить")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «умерщвлённый не жив и помнит причину» функции «Умертвить»", { "line": 224, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Оживить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Process} process — «процесс»
 * @returns {Process}
 */
export function ozhivit(process) {
  const $t1 = processZanovo($field(process, "имя"), $field(process, "свой"), $field(process, "на каком"), true, "", $field(process, "потолок"), $field(process, "в лёте"), $field(process, "ящик"))
  let $t2
  if ($cond($equal($field($t1, "жив"), true))) {
    $t2 = $equal($field($t1, "причина"), "")
  } else {
    $t2 = false
  }
  let $t3
  if ($cond($t2)) {
    $t3 = $equal($field($t1, "ящик"), $field(process, "ящик"))
  } else {
    $t3 = false
  }
  // постусловие «оживший жив без причины и с прежним ящиком»
  if (!$post($t3, "оживший жив без причины и с прежним ящиком", "Оживить")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «оживший жив без причины и с прежним ящиком» функции «Оживить»", { "line": 233, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Оживить процесс».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {string} imya — «имя»
 * @returns {Uzel}
 */
export function ozhivitProcess(uzel, imya) {
  let $t1
  const $t2 = naytiProcess($field(uzel, "процессы"), imya)
  if ($isVariant($t2) && $t2.variant === "Нет процесса") {
    $t1 = uzel
  } else if ($isVariant($t2) && $t2.variant === "Есть процесс") {
    const p = $variantField($t2, "процесс")
    $t1 = sProcessom(uzel, ozhivit(p))
  } else {
    $matchFail($t2)
  }
  let $t3
  if ($cond($equal(naytiProcess($field(uzel, "процессы"), imya), NetProcessa({})))) {
    $t3 = $equal($t1, uzel)
  } else {
    $t3 = true
  }
  // постусловие «без такого процесса узел не меняется»
  if (!$post($t3, "без такого процесса узел не меняется", "Оживить процесс")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «без такого процесса узел не меняется» функции «Оживить процесс»", { "line": 241, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Уложить процесс».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {string} imya — «имя»
 * @param {string} prichina — «причина»
 * @returns {Uzel}
 */
export function ulozhitProcess(uzel, imya, prichina) {
  let $t1
  const $t2 = naytiProcess($field(uzel, "процессы"), imya)
  if ($isVariant($t2) && $t2.variant === "Нет процесса") {
    $t1 = uzel
  } else if ($isVariant($t2) && $t2.variant === "Есть процесс") {
    const p = $variantField($t2, "процесс")
    $t1 = sProcessom(uzel, umertvit(p, prichina))
  } else {
    $matchFail($t2)
  }
  let $t3
  if ($cond($equal(naytiProcess($field(uzel, "процессы"), imya), NetProcessa({})))) {
    $t3 = $equal($t1, uzel)
  } else {
    $t3 = true
  }
  // постусловие «без такого процесса укладывать некого»
  if (!$post($t3, "без такого процесса укладывать некого", "Уложить процесс")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «без такого процесса укладывать некого» функции «Уложить процесс»", { "line": 251, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Остановить узел».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @returns {Uzel}
 */
export function ostanovitUzel(uzel) {
  const $t1 = { "имя": $field(uzel, "имя"), "процессы": $field(uzel, "процессы"), "связи": $field(uzel, "связи"), "кто бежит": $field(uzel, "кто бежит"), "что бежит": $field(uzel, "что бежит"), "работает": false }
  let $t2
  if ($cond($equal($field($t1, "работает"), false))) {
    $t2 = $equal($field($t1, "процессы"), $field(uzel, "процессы"))
  } else {
    $t2 = false
  }
  // постусловие «остановленный узел не работает и хранит таблицу»
  if (!$post($t2, "остановленный узел не работает и хранит таблицу", "Остановить узел")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «остановленный узел не работает и хранит таблицу» функции «Остановить узел»", { "line": 263, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Ящик полон».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Process} process — «процесс»
 * @returns {*}
 */
export function yaschikPolon(process) {
  if ($cond($equal($field(process, "потолок"), 0))) {
    return false
  } else {
    return $gte($add($b_dlina($field(process, "ящик")), $field(process, "в лёте")), $field(process, "потолок"))
  }
}

/**
 * Функция flang «В ящик».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Pismo>} yaschik — «ящик»
 * @param {Pismo} pismo — «письмо»
 * @param {*} vperyod — «вперёд»
 * @returns {Array<Pismo>}
 */
export function vYaschik(yaschik, pismo, vperyod) {
  let $t1
  if ($cond(vperyod)) {
    $t1 = $b_pripisat(pismo, yaschik)
  } else {
    $t1 = $b_dobavit(pismo, yaschik)
  }
  let $t2
  if ($cond(vperyod)) {
    $t2 = $equal($t1, $b_pripisat(pismo, yaschik))
  } else {
    $t2 = true
  }
  // постусловие «вперёд кладёт в голову ящика»
  if (!$post($t2, "вперёд кладёт в голову ящика", "В ящик")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «вперёд кладёт в голову ящика» функции «В ящик»", { "line": 294, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Исход положить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {string} komu — «кому»
 * @param {*} mestoZanyato — «место занято»
 * @returns {IshodDostavki}
 */
export function ishodPolozhit(uzel, komu, mestoZanyato) {
  let $t1
  const $t2 = naytiProcess($field(uzel, "процессы"), komu)
  if ($isVariant($t2) && $t2.variant === "Нет процесса") {
    $t1 = Nekomu({})
  } else if ($isVariant($t2) && $t2.variant === "Есть процесс") {
    const p = $variantField($t2, "процесс")
    let $t3
    if ($cond($field(p, "свой"))) {
      $t3 = false
    } else {
      $t3 = true
    }
    let $t4
    if ($cond($t3)) {
      $t4 = true
    } else {
      let $t5
      if ($cond($field(p, "жив"))) {
        $t5 = false
      } else {
        $t5 = true
      }
      $t4 = $t5
    }
    let $t6
    if ($cond($t4)) {
      $t6 = Nekomu({})
    } else {
      let $t7
      if ($cond(mestoZanyato)) {
        $t7 = false
      } else {
        $t7 = true
      }
      let $t8
      if ($cond($t7)) {
        $t8 = yaschikPolon(p)
      } else {
        $t8 = false
      }
      let $t9
      if ($cond($t8)) {
        $t9 = Polon({})
      } else {
        $t9 = Leglo({})
      }
      $t6 = $t9
    }
    $t1 = $t6
  } else {
    $matchFail($t2)
  }
  let $t10
  if ($cond($equal(naytiProcess($field(uzel, "процессы"), komu), NetProcessa({})))) {
    $t10 = $equal($t1, Nekomu({}))
  } else {
    $t10 = true
  }
  // постусловие «без адресата класть некому»
  if (!$post($t10, "без адресата класть некому", "Исход положить")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «без адресата класть некому» функции «Исход положить»", { "line": 306, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Легло ли».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {IshodDostavki} ishod — «исход»
 * @returns {*}
 */
export function legloLi(ishod) {
  let $t1
  if ($isVariant(ishod) && ishod.variant === "Легло") {
    $t1 = true
  } else if ($isVariant(ishod) && ishod.variant === "Некому") {
    $t1 = false
  } else if ($isVariant(ishod) && ishod.variant === "Полон") {
    $t1 = false
  } else {
    $matchFail(ishod)
  }
  let $t2
  if ($cond($equal(ishod, Leglo({})))) {
    $t2 = $equal($t1, true)
  } else {
    $t2 = true
  }
  // постусловие «легло только у исхода Легло»
  if (!$post($t2, "легло только у исхода Легло", "Легло ли")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «легло только у исхода Легло» функции «Легло ли»", { "line": 318, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Положить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {string} komu — «кому»
 * @param {number} bilet — «билет»
 * @param {*} vperyod — «вперёд»
 * @param {*} mestoZanyato — «место занято»
 * @param {*} nachatoe — «начатое»
 * @returns {Uzel}
 */
export function polozhit(uzel, komu, bilet, vperyod, mestoZanyato, nachatoe) {
  let $t1
  const $t2 = naytiProcess($field(uzel, "процессы"), komu)
  if ($isVariant($t2) && $t2.variant === "Нет процесса") {
    $t1 = uzel
  } else if ($isVariant($t2) && $t2.variant === "Есть процесс") {
    const p = $variantField($t2, "процесс")
    let $t3
    if ($cond(legloLi(ishodPolozhit(uzel, komu, mestoZanyato)))) {
      $t3 = sProcessom(uzel, sYaschikom(p, vYaschik($field(p, "ящик"), { "билет": bilet, "начатое": nachatoe }, vperyod)))
    } else {
      $t3 = uzel
    }
    $t1 = $t3
  } else {
    $matchFail($t2)
  }
  let $t4
  if ($cond($equal(naytiProcess($field(uzel, "процессы"), komu), NetProcessa({})))) {
    $t4 = $equal($t1, uzel)
  } else {
    $t4 = true
  }
  // постусловие «без адресата узел не меняется»
  if (!$post($t4, "без адресата узел не меняется", "Положить")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «без адресата узел не меняется» функции «Положить»", { "line": 330, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Связь есть».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {string} sKem — «с кем»
 * @returns {*}
 */
export function svyazEst(uzel, sKem) {
  const $t1 = $requireList($field(uzel, "связи"), "отфильтровать")
  const $t2 = []
  for (const s of $t1) {
    if ($keep($equal(s, sKem))) $t2.push(s)
  }
  let $t3
  if ($cond($b_pusto($t2))) {
    $t3 = false
  } else {
    $t3 = true
  }
  const $t4 = $requireList($field(uzel, "связи"), "отфильтровать")
  const $t5 = []
  for (const s$2 of $t4) {
    if ($keep($equal(s$2, sKem))) $t5.push(s$2)
  }
  let $t6
  if ($cond($b_pusto($t5))) {
    $t6 = false
  } else {
    $t6 = true
  }
  // постусловие «связь есть ровно когда сосед стоит в списке связей»
  if (!$post($equal($t3, $t6), "связь есть ровно когда сосед стоит в списке связей", "Связь есть")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «связь есть ровно когда сосед стоит в списке связей» функции «Связь есть»", { "line": 341, "column": 3 })
  }
  return $t3
}

/**
 * Функция flang «Отправить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {string} komu — «кому»
 * @param {number} bilet — «билет»
 * @returns {HodUzla}
 */
export function otpravit(uzel, komu, bilet) {
  let $t1
  const $t2 = naytiProcess($field(uzel, "процессы"), komu)
  if ($isVariant($t2) && $t2.variant === "Нет процесса") {
    $t1 = { "узел": uzel, "веления": [PismoPropalo({ "кому": komu, "почему": "такого процесса нет" })] }
  } else if ($isVariant($t2) && $t2.variant === "Есть процесс") {
    const p = $variantField($t2, "процесс")
    $t1 = otpravitNaydennomu(uzel, p, bilet)
  } else {
    $matchFail($t2)
  }
  let $t3
  if ($cond($equal(naytiProcess($field(uzel, "процессы"), komu), NetProcessa({})))) {
    $t3 = $equal($t1, { "узел": uzel, "веления": [PismoPropalo({ "кому": komu, "почему": "такого процесса нет" })] })
  } else {
    $t3 = true
  }
  // постусловие «письмо несуществующему процессу пропадает»
  if (!$post($t3, "письмо несуществующему процессу пропадает", "Отправить")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «письмо несуществующему процессу пропадает» функции «Отправить»", { "line": 355, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Отправить найденному».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {Process} p — «п»
 * @param {number} bilet — «билет»
 * @returns {HodUzla}
 */
export function otpravitNaydennomu(uzel, p, bilet) {
  let $t1
  if ($cond($field(p, "свой"))) {
    $t1 = otpravitSvoemu(uzel, p, bilet)
  } else {
    $t1 = otpravitChuzhomu(uzel, p, bilet)
  }
  let $t2
  if ($cond($field(p, "свой"))) {
    $t2 = $equal($t1, otpravitSvoemu(uzel, p, bilet))
  } else {
    $t2 = true
  }
  // постусловие «своему шлём своим путём»
  if (!$post($t2, "своему шлём своим путём", "Отправить найденному")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «своему шлём своим путём» функции «Отправить найденному»", { "line": 365, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Отправить своему».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {Process} p — «п»
 * @param {number} bilet — «билет»
 * @returns {HodUzla}
 */
export function otpravitSvoemu(uzel, p, bilet) {
  let $t1
  const $t2 = ishodPolozhit(uzel, $field(p, "имя"), false)
  if ($isVariant($t2) && $t2.variant === "Легло") {
    $t1 = { "узел": polozhit(uzel, $field(p, "имя"), bilet, false, false, false), "веления": [] }
  } else if ($isVariant($t2) && $t2.variant === "Некому") {
    $t1 = { "узел": uzel, "веления": [PismoPropalo({ "кому": $field(p, "имя"), "почему": "процесс не жив" })] }
  } else if ($isVariant($t2) && $t2.variant === "Полон") {
    $t1 = { "узел": uzel, "веления": [UronitProcess({ "кто": $field(uzel, "кто бежит"), "код": "FLANG_MAILBOX_FULL", "текст": pochemuYaschikPolon($field(p, "имя")) })] }
  } else {
    $matchFail($t2)
  }
  let $t3
  if ($cond($equal(ishodPolozhit(uzel, $field(p, "имя"), false), Nekomu({})))) {
    $t3 = $equal($t1, { "узел": uzel, "веления": [PismoPropalo({ "кому": $field(p, "имя"), "почему": "процесс не жив" })] })
  } else {
    $t3 = true
  }
  // постусловие «некому — письмо пропало и узел не тронут»
  if (!$post($t3, "некому — письмо пропало и узел не тронут", "Отправить своему")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «некому — письмо пропало и узел не тронут» функции «Отправить своему»", { "line": 373, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Почему ящик полон».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} komu — «кому»
 * @returns {string}
 */
export function pochemuYaschikPolon(komu) {
  return $concat($concat("ящик процесса «", komu), "» полон")
}

/**
 * Функция flang «Отправить чужому».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {Process} p — «п»
 * @param {number} bilet — «билет»
 * @returns {HodUzla}
 */
export function otpravitChuzhomu(uzel, p, bilet) {
  let $t1
  if ($cond($field(p, "жив"))) {
    $t1 = false
  } else {
    $t1 = true
  }
  let $t2
  if ($cond($t1)) {
    $t2 = true
  } else {
    let $t3
    if ($cond(svyazEst(uzel, $field(p, "на каком")))) {
      $t3 = false
    } else {
      $t3 = true
    }
    $t2 = $t3
  }
  let $t4
  if ($cond($t2)) {
    $t4 = { "узел": uzel, "веления": [PismoPropalo({ "кому": $field(p, "имя"), "почему": "связи нет" })] }
  } else {
    $t4 = { "узел": uzel, "веления": [PoslatPoProvodu({ "узел": $field(p, "на каком"), "кому": $field(p, "имя"), "билет": bilet })] }
  }
  let $t5
  if ($cond($field(p, "жив"))) {
    $t5 = false
  } else {
    $t5 = true
  }
  let $t6
  if ($cond($t5)) {
    $t6 = true
  } else {
    let $t7
    if ($cond(svyazEst(uzel, $field(p, "на каком")))) {
      $t7 = false
    } else {
      $t7 = true
    }
    $t6 = $t7
  }
  let $t8
  if ($cond($t6)) {
    $t8 = $equal($t4, { "узел": uzel, "веления": [PismoPropalo({ "кому": $field(p, "имя"), "почему": "связи нет" })] })
  } else {
    $t8 = true
  }
  // постусловие «мёртвому или без связи письмо пропадает»
  if (!$post($t8, "мёртвому или без связи письмо пропадает", "Отправить чужому")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «мёртвому или без связи письмо пропадает» функции «Отправить чужому»", { "line": 394, "column": 3 })
  }
  return $t4
}

/**
 * Функция flang «Готовые».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @returns {Array<Process>}
 */
export function gotovye(uzel) {
  const $t1 = $requireList($field(uzel, "процессы"), "отфильтровать")
  const $t2 = []
  for (const p of $t1) {
    let $t3
    if ($cond($field(p, "свой"))) {
      $t3 = $field(p, "жив")
    } else {
      $t3 = false
    }
    let $t4
    if ($cond($t3)) {
      let $t5
      if ($cond($b_pusto($field(p, "ящик")))) {
        $t5 = false
      } else {
        $t5 = true
      }
      $t4 = $t5
    } else {
      $t4 = false
    }
    if ($keep($t4)) $t2.push(p)
  }
  // постусловие «готовых не больше чем процессов»
  if (!$post($lte($b_dlina($t2), $b_dlina($field(uzel, "процессы"))), "готовых не больше чем процессов", "Готовые")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «готовых не больше чем процессов» функции «Готовые»", { "line": 406, "column": 3 })
  }
  return $t2
}

/**
 * Функция flang «Номер по жребию».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} skolko — «сколько»
 * @param {number} zhrebiy — «жребий»
 * @returns {number}
 */
export function nomerPoZhrebiyu(skolko, zhrebiy) {
  if ($cond($lte(skolko, 0))) {
    return 0
  } else {
    return neBolshe(celayaChast($mul(zhrebiy, skolko)), $sub(skolko, 1))
  }
}

/**
 * Функция flang «Целая часть».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} h — «х»
 * @returns {number}
 */
export function celayaChast(h) {
  return $sub(h, $mod(h, 1))
}

/**
 * Функция flang «Не больше».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} chto — «что»
 * @param {number} predel — «предел»
 * @returns {number}
 */
export function neBolshe(chto, predel) {
  let $t1
  if ($cond($gte(chto, predel))) {
    $t1 = predel
  } else {
    let $t2
    if ($cond($lte(chto, 0))) {
      $t2 = 0
    } else {
      $t2 = chto
    }
    $t1 = $t2
  }
  let $t3
  if ($cond($gte(chto, predel))) {
    $t3 = $equal($t1, predel)
  } else {
    $t3 = true
  }
  // постусловие «выше предела не поднимается»
  if (!$post($t3, "выше предела не поднимается", "Не больше")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «выше предела не поднимается» функции «Не больше»", { "line": 449, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Жил на узле».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Process} p — «п»
 * @param {string} sosed — «сосед»
 * @returns {*}
 */
export function zhilNaUzle(p, sosed) {
  let $t1
  if ($cond($field(p, "свой"))) {
    $t1 = false
  } else {
    $t1 = true
  }
  let $t2
  if ($cond($t1)) {
    $t2 = $equal($field(p, "на каком"), sosed)
  } else {
    $t2 = false
  }
  if ($cond($t2)) {
    return $field(p, "жив")
  } else {
    return false
  }
}

/**
 * Функция flang «Почему узел пропал».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} sosed — «сосед»
 * @param {string} pochemu — «почему»
 * @returns {string}
 */
export function pochemuUzelPropal(sosed, pochemu) {
  return $concat($concat($concat("узел «", sosed), "» пропал: "), pochemu)
}

/**
 * Функция flang «Похоронить жильцов».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Process>} processy — «процессы»
 * @param {string} sosed — «сосед»
 * @param {string} prichina — «причина»
 * @returns {Array<Process>}
 */
export function pohoronitZhilcov(processy, sosed, prichina) {
  const $t1 = $requireList(processy, "отобразить")
  const $t2 = []
  for (const p of $t1) {
    let $t3
    if ($cond(zhilNaUzle(p, sosed))) {
      $t3 = umertvit(p, prichina)
    } else {
      $t3 = p
    }
    $t2.push($t3)
  }
  // постусловие «похороны не меняют длину таблицы»
  if (!$post($equal($b_dlina($t2), $b_dlina(processy)), "похороны не меняют длину таблицы", "Похоронить жильцов")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «похороны не меняют длину таблицы» функции «Похоронить жильцов»", { "line": 509, "column": 3 })
  }
  return $t2
}

/**
 * Функция flang «Веления пропажи».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Process>} processy — «процессы»
 * @param {string} sosed — «сосед»
 * @param {string} prichina — «причина»
 * @returns {Array<VelenieUzlu>}
 */
export function veleniyaPropazhi(processy, sosed, prichina) {
  const $t1 = $requireList(processy, "отфильтровать")
  const $t2 = []
  for (const p of $t1) {
    if ($keep(zhilNaUzle(p, sosed))) $t2.push(p)
  }
  const $t3 = $requireList($t2, "свёртка")
  let akk = [ZapisatVZhurnal({ "вид": "узел", "кто": sosed, "почему": prichina })]
  for (const p$2 of $t3) {
    akk = $b_dobavit(UronitProcess({ "кто": $field(p$2, "имя"), "код": "FLANG_NODE_DOWN", "текст": prichina }), akk)
  }
  // постусловие «запись в журнал стоит первой всегда»
  if (!$post($gte($b_dlina(akk), 1), "запись в журнал стоит первой всегда", "Веления пропажи")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «запись в журнал стоит первой всегда» функции «Веления пропажи»", { "line": 517, "column": 3 })
  }
  return akk
}

/**
 * Функция flang «Узел с процессами».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {Array<Process>} processy — «процессы»
 * @returns {Uzel}
 */
export function uzelSProcessami(uzel, processy) {
  const $t1 = { "имя": $field(uzel, "имя"), "процессы": processy, "связи": $field(uzel, "связи"), "кто бежит": $field(uzel, "кто бежит"), "что бежит": $field(uzel, "что бежит"), "работает": $field(uzel, "работает") }
  // постусловие «узел с процессами ставит поданную таблицу»
  if (!$post($equal($field($t1, "процессы"), processy), "узел с процессами ставит поданную таблицу", "Узел с процессами")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «узел с процессами ставит поданную таблицу» функции «Узел с процессами»", { "line": 523, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Пропажа узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {string} sosed — «сосед»
 * @param {string} pochemu — «почему»
 * @returns {HodUzla}
 */
export function propazhaUzla(uzel, sosed, pochemu) {
  const prichina = pochemuUzelPropal(sosed, pochemu)
  const $t1 = { "узел": uzelSProcessami(uzel, pohoronitZhilcov($field(uzel, "процессы"), sosed, prichina)), "веления": veleniyaPropazhi($field(uzel, "процессы"), sosed, prichina) }
  const $t2 = $requireList($field($t1, "веления"), "отфильтровать")
  const $t3 = []
  for (const v of $t2) {
    if ($keep(etoPadenie(v))) $t3.push(v)
  }
  const $t6 = $b_dlina($t3)
  const $t4 = $requireList($field(uzel, "процессы"), "отфильтровать")
  const $t5 = []
  for (const p of $t4) {
    if ($keep(zhilNaUzle(p, sosed))) $t5.push(p)
  }
  // постусловие «пропажа роняет ровно жильцов пропавшего узла»
  if (!$post($equal($t6, $b_dlina($t5)), "пропажа роняет ровно жильцов пропавшего узла", "Пропажа узла")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «пропажа роняет ровно жильцов пропавшего узла» функции «Пропажа узла»", { "line": 532, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Это падение».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {VelenieUzlu} velenie — «веление»
 * @returns {*}
 */
export function etoPadenie(velenie) {
  let $t1
  if ($isVariant(velenie) && velenie.variant === "Позвать обработчик") {
    const kto = $variantField(velenie, "кто")
    const bilet = $variantField(velenie, "билет")
    $t1 = false
  } else if ($isVariant(velenie) && velenie.variant === "Послать по проводу") {
    const uzel = $variantField(velenie, "узел")
    const komu = $variantField(velenie, "кому")
    const bilet$2 = $variantField(velenie, "билет")
    $t1 = false
  } else if ($isVariant(velenie) && velenie.variant === "Поставить таймер") {
    const komu$2 = $variantField(velenie, "кому")
    const bilet$3 = $variantField(velenie, "билет")
    const zaderzhka = $variantField(velenie, "задержка")
    $t1 = false
  } else if ($isVariant(velenie) && velenie.variant === "Записать в журнал") {
    const vid = $variantField(velenie, "вид")
    const kto$2 = $variantField(velenie, "кто")
    const pochemu = $variantField(velenie, "почему")
    $t1 = false
  } else if ($isVariant(velenie) && velenie.variant === "Уронить процесс") {
    const kto$3 = $variantField(velenie, "кто")
    const kod = $variantField(velenie, "код")
    const tekst = $variantField(velenie, "текст")
    $t1 = true
  } else if ($isVariant(velenie) && velenie.variant === "Письмо пропало") {
    const komu$3 = $variantField(velenie, "кому")
    const pochemu$2 = $variantField(velenie, "почему")
    $t1 = false
  } else {
    $matchFail(velenie)
  }
  let $t2
  if ($cond($equal(velenie, UronitProcess({ "кто": "А", "код": "К", "текст": "Т" })))) {
    $t2 = $equal($t1, true)
  } else {
    $t2 = true
  }
  // постусловие «падением зовётся ровно веление уронить процесс»
  if (!$post($t2, "падением зовётся ровно веление уронить процесс", "Это падение")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «падением зовётся ровно веление уронить процесс» функции «Это падение»", { "line": 551, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Подхватить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Process} process — «процесс»
 * @returns {Process}
 */
export function podhvatit(process) {
  const $t1 = processZanovo($field(process, "имя"), true, "", true, "", $field(process, "потолок"), 0, $field(process, "ящик"))
  let $t2
  if ($cond($equal($field($t1, "свой"), true))) {
    $t2 = $equal($field($t1, "в лёте"), 0)
  } else {
    $t2 = false
  }
  // постусловие «подхваченный стал своим и без писем в лёте»
  if (!$post($t2, "подхваченный стал своим и без писем в лёте", "Подхватить")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «подхваченный стал своим и без писем в лёте» функции «Подхватить»", { "line": 579, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Поднять процесс».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {string} imya — «имя»
 * @returns {Uzel}
 */
export function podnyatProcess(uzel, imya) {
  let $t1
  const $t2 = naytiProcess($field(uzel, "процессы"), imya)
  if ($isVariant($t2) && $t2.variant === "Нет процесса") {
    $t1 = uzel
  } else if ($isVariant($t2) && $t2.variant === "Есть процесс") {
    const p = $variantField($t2, "процесс")
    let $t3
    if ($cond($field(p, "свой"))) {
      $t3 = ozhivit(p)
    } else {
      $t3 = podhvatit(p)
    }
    $t1 = sProcessom(uzel, $t3)
  } else {
    $matchFail($t2)
  }
  let $t4
  if ($cond($equal(naytiProcess($field(uzel, "процессы"), imya), NetProcessa({})))) {
    $t4 = $equal($t1, uzel)
  } else {
    $t4 = true
  }
  // постусловие «без такого процесса поднимать некого»
  if (!$post($t4, "без такого процесса поднимать некого", "Поднять процесс")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «без такого процесса поднимать некого» функции «Поднять процесс»", { "line": 585, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Шаг узла».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {ChtoSluchilosSUzlom} chto — «что»
 * @returns {HodUzla}
 */
export function shagUzla(uzel, chto) {
  let $t1
  if ($isVariant(chto) && chto.variant === "Письмо снаружи") {
    const komu = $variantField(chto, "кому")
    const bilet = $variantField(chto, "билет")
    $t1 = pismoSProvoda(uzel, komu, bilet)
  } else if ($isVariant(chto) && chto.variant === "Таймер сработал") {
    const komu$2 = $variantField(chto, "кому")
    const bilet$2 = $variantField(chto, "билет")
    $t1 = otpravit(uzel, komu$2, bilet$2)
  } else if ($isVariant(chto) && chto.variant === "Связь готова") {
    const sosed = $variantField(chto, "узел")
    let $t2
    if ($cond(svyazEst(uzel, sosed))) {
      $t2 = $field(uzel, "связи")
    } else {
      $t2 = $b_dobavit(sosed, $field(uzel, "связи"))
    }
    $t1 = { "узел": uzelSoSvyazyami(uzel, $t2), "веления": [] }
  } else if ($isVariant(chto) && chto.variant === "Связь потеряна") {
    const sosed$2 = $variantField(chto, "узел")
    const pochemu = $variantField(chto, "почему")
    const $t3 = $requireList($field(uzel, "связи"), "отфильтровать")
    const $t4 = []
    for (const s of $t3) {
      let $t5
      if ($cond($equal(s, sosed$2))) {
        $t5 = false
      } else {
        $t5 = true
      }
      if ($keep($t5)) $t4.push(s)
    }
    $t1 = { "узел": uzelSoSvyazyami(uzel, $t4), "веления": [ZapisatVZhurnal({ "вид": "связь", "кто": sosed$2, "почему": pochemu })] }
  } else if ($isVariant(chto) && chto.variant === "Узел пропал") {
    const sosed$3 = $variantField(chto, "узел")
    const pochemu$2 = $variantField(chto, "почему")
    $t1 = propazhaUzla(uzel, sosed$3, pochemu$2)
  } else if ($isVariant(chto) && chto.variant === "Пора бежать") {
    const zhrebiy = $variantField(chto, "жребий")
    $t1 = probezhat(uzel, zhrebiy)
  } else if ($isVariant(chto) && chto.variant === "Обработчик вернул") {
    const deystviya = $variantField(chto, "действия")
    $t1 = otklikRazobran(uzel, deystviya)
  } else if ($isVariant(chto) && chto.variant === "Обработчик отказал") {
    const kod = $variantField(chto, "код")
    const tekst = $variantField(chto, "текст")
    $t1 = probegSorvalsya(uzel, kod, tekst)
  } else {
    $matchFail(chto)
  }
  let $t6
  if ($cond($equal(chto, PoraBezhat({ "жребий": 0 })))) {
    $t6 = $equal($t1, probezhat(uzel, 0))
  } else {
    $t6 = true
  }
  // постусловие «пора бежать ведёт в пробег»
  if (!$post($t6, "пора бежать ведёт в пробег", "Шаг узла")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «пора бежать ведёт в пробег» функции «Шаг узла»", { "line": 600, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Письмо с провода».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {string} komu — «кому»
 * @param {number} bilet — «билет»
 * @returns {HodUzla}
 */
export function pismoSProvoda(uzel, komu, bilet) {
  let $t1
  const $t2 = ishodPolozhit(uzel, komu, false)
  if ($isVariant($t2) && $t2.variant === "Легло") {
    $t1 = { "узел": polozhit(uzel, komu, bilet, false, false, false), "веления": [] }
  } else if ($isVariant($t2) && $t2.variant === "Некому") {
    $t1 = { "узел": uzel, "веления": [PismoPropalo({ "кому": komu, "почему": "адресата на этом узле нет" })] }
  } else if ($isVariant($t2) && $t2.variant === "Полон") {
    $t1 = { "узел": uzel, "веления": [PismoPropalo({ "кому": komu, "почему": pochemuYaschikPolon(komu) })] }
  } else {
    $matchFail($t2)
  }
  let $t3
  if ($cond($equal(ishodPolozhit(uzel, komu, false), Nekomu({})))) {
    $t3 = $equal($t1, { "узел": uzel, "веления": [PismoPropalo({ "кому": komu, "почему": "адресата на этом узле нет" })] })
  } else {
    $t3 = true
  }
  // постусловие «адресата нет — письмо пропало, узел не тронут»
  if (!$post($t3, "адресата нет — письмо пропало, узел не тронут", "Письмо с провода")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «адресата нет — письмо пропало, узел не тронут» функции «Письмо с провода»", { "line": 627, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Пробежать».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {number} zhrebiy — «жребий»
 * @returns {HodUzla}
 */
export function probezhat(uzel, zhrebiy) {
  let $t1
  if ($cond($field(uzel, "работает"))) {
    $t1 = false
  } else {
    $t1 = true
  }
  let $t2
  if ($cond($t1)) {
    $t2 = true
  } else {
    $t2 = $b_pusto(gotovye(uzel))
  }
  let $t3
  if ($cond($t2)) {
    $t3 = { "узел": uzel, "веления": [] }
  } else {
    $t3 = probezhatVybrannogo(uzel, $b_element($add(1, nomerPoZhrebiyu($b_dlina(gotovye(uzel)), zhrebiy)), gotovye(uzel)))
  }
  let $t4
  if ($cond($field(uzel, "работает"))) {
    $t4 = false
  } else {
    $t4 = true
  }
  let $t5
  if ($cond($t4)) {
    $t5 = true
  } else {
    $t5 = $b_pusto(gotovye(uzel))
  }
  let $t6
  if ($cond($t5)) {
    $t6 = $equal($t3, { "узел": uzel, "веления": [] })
  } else {
    $t6 = true
  }
  // постусловие «стоящий узел и пустая очередь не рождают велений»
  if (!$post($t6, "стоящий узел и пустая очередь не рождают велений", "Пробежать")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «стоящий узел и пустая очередь не рождают велений» функции «Пробежать»", { "line": 642, "column": 3 })
  }
  return $t3
}

/**
 * Функция flang «Пробежать выбранного».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {Process} p — «п»
 * @returns {HodUzla}
 */
export function probezhatVybrannogo(uzel, p) {
  let $t1
  const $t2 = pervoePismo($field(p, "ящик"))
  if ($isVariant($t2) && $t2.variant === "Нет письма") {
    $t1 = { "узел": uzel, "веления": [] }
  } else if ($isVariant($t2) && $t2.variant === "Есть письмо") {
    const pismo = $variantField($t2, "письмо")
    $t1 = { "узел": uzelSHodom(sProcessom(uzel, sYaschikom(p, $b_hvost($field(p, "ящик")))), $field(p, "имя"), $field(pismo, "билет")), "веления": [PozvatObrabotchik({ "кто": $field(p, "имя"), "билет": $field(pismo, "билет") })] }
  } else {
    $matchFail($t2)
  }
  let $t3
  if ($cond($equal(pervoePismo($field(p, "ящик")), NetPisma({})))) {
    $t3 = $equal($t1, { "узел": uzel, "веления": [] })
  } else {
    $t3 = true
  }
  // постусловие «без письма обработчик не зовётся»
  if (!$post($t3, "без письма обработчик не зовётся", "Пробежать выбранного")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «без письма обработчик не зовётся» функции «Пробежать выбранного»", { "line": 650, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Первое письмо».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<Pismo>} yaschik — «ящик»
 * @returns {MozhetBytPismo}
 */
export function pervoePismo(yaschik) {
  let $t1
  if ($chainEmpty(yaschik)) {
    $t1 = NetPisma({})
  } else if ($chainCons(yaschik)) {
    const golova = $chainHead(yaschik)
    const hvost = $chainTail(yaschik)
    $t1 = EstPismo({ "письмо": golova })
  } else {
    $matchFail(yaschik)
  }
  let $t2
  if ($cond($b_pusto(yaschik))) {
    $t2 = $equal($t1, NetPisma({}))
  } else {
    $t2 = true
  }
  // постусловие «у пустого ящика письма нет»
  if (!$post($t2, "у пустого ящика письма нет", "Первое письмо")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «у пустого ящика письма нет» функции «Первое письмо»", { "line": 664, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Отклик разобран».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {Array<DeystvieUzla>} deystviya — «действия»
 * @returns {HodUzla}
 */
export function otklikRazobran(uzel, deystviya) {
  const $t1 = $requireList(deystviya, "свёртка")
  let hod = { "узел": uzelSHodom(uzel, "", 0), "веления": [ZapisatVZhurnal({ "вид": "пробег", "кто": $field(uzel, "кто бежит"), "почему": "обработано" })] }
  for (const d of $t1) {
    hod = odnoDeystvie(hod, d, $field(uzel, "кто бежит"), $field(uzel, "что бежит"))
  }
  const $t2 = $requireList(deystviya, "свёртка")
  let hod$2 = { "узел": uzelSHodom(uzel, "", 0), "веления": [ZapisatVZhurnal({ "вид": "пробег", "кто": $field(uzel, "кто бежит"), "почему": "обработано" })] }
  for (const d$2 of $t2) {
    hod$2 = odnoDeystvie(hod$2, d$2, $field(uzel, "кто бежит"), $field(uzel, "что бежит"))
  }
  // постусловие «отклик есть проход по действиям от записи о пробеге»
  if (!$post($equal(hod, hod$2), "отклик есть проход по действиям от записи о пробеге", "Отклик разобран")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «отклик есть проход по действиям от записи о пробеге» функции «Отклик разобран»", { "line": 678, "column": 3 })
  }
  return hod
}

/**
 * Функция flang «Слить ход».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {HodUzla} hod — «ход»
 * @param {HodUzla} novyy — «новый»
 * @returns {HodUzla}
 */
export function slitHod(hod, novyy) {
  const $t2 = $field(novyy, "узел")
  const $t1 = $requireList($field(novyy, "веления"), "свёртка")
  let akk = $field(hod, "веления")
  for (const v of $t1) {
    akk = $b_dobavit(v, akk)
  }
  const $t3 = { "узел": $t2, "веления": akk }
  // постусловие «слитый ход берёт узел нового»
  if (!$post($equal($field($t3, "узел"), $field(novyy, "узел")), "слитый ход берёт узел нового", "Слить ход")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «слитый ход берёт узел нового» функции «Слить ход»", { "line": 684, "column": 3 })
  }
  return $t3
}

/**
 * Функция flang «Одно действие».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {HodUzla} hod — «ход»
 * @param {DeystvieUzla} d — «д»
 * @param {string} kto — «кто»
 * @param {number} chto — «что»
 * @returns {HodUzla}
 */
export function odnoDeystvie(hod, d, kto, chto) {
  let $t1
  if ($isVariant(d) && d.variant === "Велено слать") {
    const komu = $variantField(d, "кому")
    const bilet = $variantField(d, "билет")
    $t1 = slitHod(hod, otpravit($field(hod, "узел"), komu, bilet))
  } else if ($isVariant(d) && d.variant === "Велено слать позже") {
    const komu$2 = $variantField(d, "кому")
    const bilet$2 = $variantField(d, "билет")
    const zaderzhka = $variantField(d, "задержка")
    $t1 = { "узел": $field(hod, "узел"), "веления": $b_dobavit(PostavitTaymer({ "кому": komu$2, "билет": bilet$2, "задержка": zaderzhka }), $field(hod, "веления")) }
  } else if ($isVariant(d) && d.variant === "Велено отложить") {
    $t1 = { "узел": polozhit($field(hod, "узел"), kto, chto, false, true, true), "веления": $field(hod, "веления") }
  } else if ($isVariant(d) && d.variant === "Велено продолжить") {
    $t1 = { "узел": polozhit($field(hod, "узел"), kto, chto, true, true, true), "веления": $field(hod, "веления") }
  } else if ($isVariant(d) && d.variant === "Велено остановить") {
    const pochemu = $variantField(d, "почему")
    $t1 = ostanovit(hod, kto, pochemu)
  } else {
    $matchFail(d)
  }
  let $t2
  if ($cond($equal(d, VelenoOtlozhit({})))) {
    $t2 = $equal($t1, { "узел": polozhit($field(hod, "узел"), kto, chto, false, true, true), "веления": $field(hod, "веления") })
  } else {
    $t2 = true
  }
  // постусловие «велено отложить кладёт письмо в хвост ящика»
  if (!$post($t2, "велено отложить кладёт письмо в хвост ящика", "Одно действие")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «велено отложить кладёт письмо в хвост ящика» функции «Одно действие»", { "line": 690, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Остановить».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {HodUzla} hod — «ход»
 * @param {string} kto — «кто»
 * @param {string} pochemu — «почему»
 * @returns {HodUzla}
 */
export function ostanovit(hod, kto, pochemu) {
  let $t1
  const $t2 = naytiProcess($field($field(hod, "узел"), "процессы"), kto)
  if ($isVariant($t2) && $t2.variant === "Нет процесса") {
    $t1 = hod
  } else if ($isVariant($t2) && $t2.variant === "Есть процесс") {
    const p = $variantField($t2, "процесс")
    const $t4 = sProcessom($field(hod, "узел"), umertvit(p, pochemu))
    let $t3
    if ($cond($equal(pochemu, "остановлен"))) {
      $t3 = ZapisatVZhurnal({ "вид": "пробег", "кто": kto, "почему": "остановлено" })
    } else {
      $t3 = UronitProcess({ "кто": kto, "код": "FLANG_PROCESS_STOPPED", "текст": pochemu })
    }
    $t1 = { "узел": $t4, "веления": $b_dobavit($t3, $field(hod, "веления")) }
  } else {
    $matchFail($t2)
  }
  let $t5
  if ($cond($equal(naytiProcess($field($field(hod, "узел"), "процессы"), kto), NetProcessa({})))) {
    $t5 = $equal($t1, hod)
  } else {
    $t5 = true
  }
  // постусловие «без такого процесса ход не меняется»
  if (!$post($t5, "без такого процесса ход не меняется", "Остановить")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «без такого процесса ход не меняется» функции «Остановить»", { "line": 709, "column": 3 })
  }
  return $t1
}

/**
 * Функция flang «Пробег сорвался».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Uzel} uzel — «узел»
 * @param {string} kod — «код»
 * @param {string} tekst — «текст»
 * @returns {HodUzla}
 */
export function probegSorvalsya(uzel, kod, tekst) {
  let $t1
  const $t2 = naytiProcess($field(uzel, "процессы"), $field(uzel, "кто бежит"))
  if ($isVariant($t2) && $t2.variant === "Нет процесса") {
    $t1 = { "узел": uzelSHodom(uzel, "", 0), "веления": [] }
  } else if ($isVariant($t2) && $t2.variant === "Есть процесс") {
    const p = $variantField($t2, "процесс")
    $t1 = { "узел": uzelSHodom(sProcessom(uzel, umertvit(p, kod)), "", 0), "веления": [ZapisatVZhurnal({ "вид": "отказ", "кто": $field(uzel, "кто бежит"), "почему": tekst }), UronitProcess({ "кто": $field(uzel, "кто бежит"), "код": kod, "текст": tekst })] }
  } else {
    $matchFail($t2)
  }
  let $t3
  if ($cond($equal(naytiProcess($field(uzel, "процессы"), $field(uzel, "кто бежит")), NetProcessa({})))) {
    $t3 = $equal($t1, { "узел": uzelSHodom(uzel, "", 0), "веления": [] })
  } else {
    $t3 = true
  }
  // постусловие «сорвался без бегущего — только сброс хода»
  if (!$post($t3, "сорвался без бегущего — только сброс хода", "Пробег сорвался")) {
    $fail("FLANG_PROPERTY", "нарушено свойство «сорвался без бегущего — только сброс хода» функции «Пробег сорвался»", { "line": 723, "column": 3 })
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
    ["Первый процесс", pervyyProcess],
    ["Найти процесс", naytiProcess],
    ["Заменить процесс", zamenitProcess],
    ["С процессом", sProcessom],
    ["Узел с ходом", uzelSHodom],
    ["Узел со связями", uzelSoSvyazyami],
    ["Процесс заново", processZanovo],
    ["С ящиком", sYaschikom],
    ["Умертвить", umertvit],
    ["Оживить", ozhivit],
    ["Оживить процесс", ozhivitProcess],
    ["Уложить процесс", ulozhitProcess],
    ["Остановить узел", ostanovitUzel],
    ["Ящик полон", yaschikPolon],
    ["В ящик", vYaschik],
    ["Исход положить", ishodPolozhit],
    ["Легло ли", legloLi],
    ["Положить", polozhit],
    ["Связь есть", svyazEst],
    ["Отправить", otpravit],
    ["Отправить найденному", otpravitNaydennomu],
    ["Отправить своему", otpravitSvoemu],
    ["Почему ящик полон", pochemuYaschikPolon],
    ["Отправить чужому", otpravitChuzhomu],
    ["Готовые", gotovye],
    ["Номер по жребию", nomerPoZhrebiyu],
    ["Целая часть", celayaChast],
    ["Не больше", neBolshe],
    ["Жил на узле", zhilNaUzle],
    ["Почему узел пропал", pochemuUzelPropal],
    ["Похоронить жильцов", pohoronitZhilcov],
    ["Веления пропажи", veleniyaPropazhi],
    ["Узел с процессами", uzelSProcessami],
    ["Пропажа узла", propazhaUzla],
    ["Это падение", etoPadenie],
    ["Подхватить", podhvatit],
    ["Поднять процесс", podnyatProcess],
    ["Шаг узла", shagUzla],
    ["Письмо с провода", pismoSProvoda],
    ["Пробежать", probezhat],
    ["Пробежать выбранного", probezhatVybrannogo],
    ["Первое письмо", pervoePismo],
    ["Отклик разобран", otklikRazobran],
    ["Слить ход", slitHod],
    ["Одно действие", odnoDeystvie],
    ["Остановить", ostanovit],
    ["Пробег сорвался", probegSorvalsya],
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
