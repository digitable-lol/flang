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

function $concat(left, right) {
  if (typeof left !== "string" || typeof right !== "string") {
    $fail("FLANG_TYPE", `«соединить» допустимо только для строк, получено ${$typeName(left)} и ${$typeName(right)}`)
  }
  return left + right
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

/** Сумма типов FTS «Что случилось с узлом»: «Письмо снаружи» | «Обработчик вернул» | «Обработчик отказал» | «Таймер сработал» | «Связь готова» | «Связь потеряна» | «Пора бежать». */
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
  if ($chainEmpty(processy)) {
    return NetProcessa({})
  } else if ($chainCons(processy)) {
    const golova = $chainHead(processy)
    const hvost = $chainTail(processy)
    return EstProcess({ "процесс": golova })
  } else {
    $matchFail(processy)
  }
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
  return pervyyProcess($t2)
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
  return { "имя": $field(uzel, "имя"), "процессы": zamenitProcess($field(uzel, "процессы"), novyy), "связи": $field(uzel, "связи"), "кто бежит": $field(uzel, "кто бежит"), "что бежит": $field(uzel, "что бежит"), "работает": $field(uzel, "работает") }
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
  return { "имя": $field(uzel, "имя"), "процессы": $field(uzel, "процессы"), "связи": $field(uzel, "связи"), "кто бежит": ktoBezhit, "что бежит": chtoBezhit, "работает": $field(uzel, "работает") }
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
  return { "имя": $field(uzel, "имя"), "процессы": $field(uzel, "процессы"), "связи": svyazi, "кто бежит": $field(uzel, "кто бежит"), "что бежит": $field(uzel, "что бежит"), "работает": $field(uzel, "работает") }
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
  return { "имя": imya, "свой": svoy, "на каком": naKakom, "жив": zhiv, "причина": prichina, "потолок": potolok, "в лёте": vLyote, "ящик": yaschik }
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
  return processZanovo($field(process, "имя"), $field(process, "свой"), $field(process, "на каком"), $field(process, "жив"), $field(process, "причина"), $field(process, "потолок"), $field(process, "в лёте"), yaschik)
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
  return processZanovo($field(process, "имя"), $field(process, "свой"), $field(process, "на каком"), false, prichina, $field(process, "потолок"), $field(process, "в лёте"), $field(process, "ящик"))
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
  if ($cond(vperyod)) {
    return $b_pripisat(pismo, yaschik)
  } else {
    return $b_dobavit(pismo, yaschik)
  }
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
  const $t1 = naytiProcess($field(uzel, "процессы"), komu)
  if ($isVariant($t1) && $t1.variant === "Нет процесса") {
    return Nekomu({})
  } else if ($isVariant($t1) && $t1.variant === "Есть процесс") {
    const p = $variantField($t1, "процесс")
    let $t2
    if ($cond($field(p, "свой"))) {
      $t2 = false
    } else {
      $t2 = true
    }
    let $t3
    if ($cond($t2)) {
      $t3 = true
    } else {
      let $t4
      if ($cond($field(p, "жив"))) {
        $t4 = false
      } else {
        $t4 = true
      }
      $t3 = $t4
    }
    if ($cond($t3)) {
      return Nekomu({})
    } else {
      let $t5
      if ($cond(mestoZanyato)) {
        $t5 = false
      } else {
        $t5 = true
      }
      let $t6
      if ($cond($t5)) {
        $t6 = yaschikPolon(p)
      } else {
        $t6 = false
      }
      if ($cond($t6)) {
        return Polon({})
      } else {
        return Leglo({})
      }
    }
  } else {
    $matchFail($t1)
  }
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
  if ($isVariant(ishod) && ishod.variant === "Легло") {
    return true
  } else if ($isVariant(ishod) && ishod.variant === "Некому") {
    return false
  } else if ($isVariant(ishod) && ishod.variant === "Полон") {
    return false
  } else {
    $matchFail(ishod)
  }
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
  const $t1 = naytiProcess($field(uzel, "процессы"), komu)
  if ($isVariant($t1) && $t1.variant === "Нет процесса") {
    return uzel
  } else if ($isVariant($t1) && $t1.variant === "Есть процесс") {
    const p = $variantField($t1, "процесс")
    if ($cond(legloLi(ishodPolozhit(uzel, komu, mestoZanyato)))) {
      return sProcessom(uzel, sYaschikom(p, vYaschik($field(p, "ящик"), { "билет": bilet, "начатое": nachatoe }, vperyod)))
    } else {
      return uzel
    }
  } else {
    $matchFail($t1)
  }
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
  if ($cond($b_pusto($t2))) {
    return false
  } else {
    return true
  }
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
  const $t1 = naytiProcess($field(uzel, "процессы"), komu)
  if ($isVariant($t1) && $t1.variant === "Нет процесса") {
    return { "узел": uzel, "веления": [PismoPropalo({ "кому": komu, "почему": "такого процесса нет" })] }
  } else if ($isVariant($t1) && $t1.variant === "Есть процесс") {
    const p = $variantField($t1, "процесс")
    return otpravitNaydennomu(uzel, p, bilet)
  } else {
    $matchFail($t1)
  }
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
  if ($cond($field(p, "свой"))) {
    return otpravitSvoemu(uzel, p, bilet)
  } else {
    return otpravitChuzhomu(uzel, p, bilet)
  }
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
  const $t1 = ishodPolozhit(uzel, $field(p, "имя"), false)
  if ($isVariant($t1) && $t1.variant === "Легло") {
    return { "узел": polozhit(uzel, $field(p, "имя"), bilet, false, false, false), "веления": [] }
  } else if ($isVariant($t1) && $t1.variant === "Некому") {
    return { "узел": uzel, "веления": [PismoPropalo({ "кому": $field(p, "имя"), "почему": "процесс не жив" })] }
  } else if ($isVariant($t1) && $t1.variant === "Полон") {
    return { "узел": uzel, "веления": [UronitProcess({ "кто": $field(uzel, "кто бежит"), "код": "FLANG_MAILBOX_FULL", "текст": pochemuYaschikPolon($field(p, "имя")) })] }
  } else {
    $matchFail($t1)
  }
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
  if ($cond($t2)) {
    return { "узел": uzel, "веления": [PismoPropalo({ "кому": $field(p, "имя"), "почему": "связи нет" })] }
  } else {
    return { "узел": uzel, "веления": [PoslatPoProvodu({ "узел": $field(p, "на каком"), "кому": $field(p, "имя"), "билет": bilet })] }
  }
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
  if ($cond($gte(chto, predel))) {
    return predel
  } else {
    if ($cond($lte(chto, 0))) {
      return 0
    } else {
      return chto
    }
  }
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
  if ($isVariant(chto) && chto.variant === "Письмо снаружи") {
    const komu = $variantField(chto, "кому")
    const bilet = $variantField(chto, "билет")
    return pismoSProvoda(uzel, komu, bilet)
  } else if ($isVariant(chto) && chto.variant === "Таймер сработал") {
    const komu$2 = $variantField(chto, "кому")
    const bilet$2 = $variantField(chto, "билет")
    return otpravit(uzel, komu$2, bilet$2)
  } else if ($isVariant(chto) && chto.variant === "Связь готова") {
    const sosed = $variantField(chto, "узел")
    let $t1
    if ($cond(svyazEst(uzel, sosed))) {
      $t1 = $field(uzel, "связи")
    } else {
      $t1 = $b_dobavit(sosed, $field(uzel, "связи"))
    }
    return { "узел": uzelSoSvyazyami(uzel, $t1), "веления": [] }
  } else if ($isVariant(chto) && chto.variant === "Связь потеряна") {
    const sosed$2 = $variantField(chto, "узел")
    const pochemu = $variantField(chto, "почему")
    const $t2 = $requireList($field(uzel, "связи"), "отфильтровать")
    const $t3 = []
    for (const s of $t2) {
      let $t4
      if ($cond($equal(s, sosed$2))) {
        $t4 = false
      } else {
        $t4 = true
      }
      if ($keep($t4)) $t3.push(s)
    }
    return { "узел": uzelSoSvyazyami(uzel, $t3), "веления": [ZapisatVZhurnal({ "вид": "связь", "кто": sosed$2, "почему": pochemu })] }
  } else if ($isVariant(chto) && chto.variant === "Пора бежать") {
    const zhrebiy = $variantField(chto, "жребий")
    return probezhat(uzel, zhrebiy)
  } else if ($isVariant(chto) && chto.variant === "Обработчик вернул") {
    const deystviya = $variantField(chto, "действия")
    return otklikRazobran(uzel, deystviya)
  } else if ($isVariant(chto) && chto.variant === "Обработчик отказал") {
    const kod = $variantField(chto, "код")
    const tekst = $variantField(chto, "текст")
    return probegSorvalsya(uzel, kod, tekst)
  } else {
    $matchFail(chto)
  }
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
  const $t1 = ishodPolozhit(uzel, komu, false)
  if ($isVariant($t1) && $t1.variant === "Легло") {
    return { "узел": polozhit(uzel, komu, bilet, false, false, false), "веления": [] }
  } else if ($isVariant($t1) && $t1.variant === "Некому") {
    return { "узел": uzel, "веления": [PismoPropalo({ "кому": komu, "почему": "адресата на этом узле нет" })] }
  } else if ($isVariant($t1) && $t1.variant === "Полон") {
    return { "узел": uzel, "веления": [PismoPropalo({ "кому": komu, "почему": pochemuYaschikPolon(komu) })] }
  } else {
    $matchFail($t1)
  }
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
  if ($cond($t2)) {
    return { "узел": uzel, "веления": [] }
  } else {
    return probezhatVybrannogo(uzel, $b_element($add(1, nomerPoZhrebiyu($b_dlina(gotovye(uzel)), zhrebiy)), gotovye(uzel)))
  }
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
  const $t1 = pervoePismo($field(p, "ящик"))
  if ($isVariant($t1) && $t1.variant === "Нет письма") {
    return { "узел": uzel, "веления": [] }
  } else if ($isVariant($t1) && $t1.variant === "Есть письмо") {
    const pismo = $variantField($t1, "письмо")
    return { "узел": uzelSHodom(sProcessom(uzel, sYaschikom(p, $b_hvost($field(p, "ящик")))), $field(p, "имя"), $field(pismo, "билет")), "веления": [PozvatObrabotchik({ "кто": $field(p, "имя"), "билет": $field(pismo, "билет") })] }
  } else {
    $matchFail($t1)
  }
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
  if ($chainEmpty(yaschik)) {
    return NetPisma({})
  } else if ($chainCons(yaschik)) {
    const golova = $chainHead(yaschik)
    const hvost = $chainTail(yaschik)
    return EstPismo({ "письмо": golova })
  } else {
    $matchFail(yaschik)
  }
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
  return { "узел": $t2, "веления": akk }
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
  if ($isVariant(d) && d.variant === "Велено слать") {
    const komu = $variantField(d, "кому")
    const bilet = $variantField(d, "билет")
    return slitHod(hod, otpravit($field(hod, "узел"), komu, bilet))
  } else if ($isVariant(d) && d.variant === "Велено слать позже") {
    const komu$2 = $variantField(d, "кому")
    const bilet$2 = $variantField(d, "билет")
    const zaderzhka = $variantField(d, "задержка")
    return { "узел": $field(hod, "узел"), "веления": $b_dobavit(PostavitTaymer({ "кому": komu$2, "билет": bilet$2, "задержка": zaderzhka }), $field(hod, "веления")) }
  } else if ($isVariant(d) && d.variant === "Велено отложить") {
    return { "узел": polozhit($field(hod, "узел"), kto, chto, false, true, true), "веления": $field(hod, "веления") }
  } else if ($isVariant(d) && d.variant === "Велено продолжить") {
    return { "узел": polozhit($field(hod, "узел"), kto, chto, true, true, true), "веления": $field(hod, "веления") }
  } else if ($isVariant(d) && d.variant === "Велено остановить") {
    const pochemu = $variantField(d, "почему")
    return ostanovit(hod, kto, pochemu)
  } else {
    $matchFail(d)
  }
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
  const $t1 = naytiProcess($field($field(hod, "узел"), "процессы"), kto)
  if ($isVariant($t1) && $t1.variant === "Нет процесса") {
    return hod
  } else if ($isVariant($t1) && $t1.variant === "Есть процесс") {
    const p = $variantField($t1, "процесс")
    const $t3 = sProcessom($field(hod, "узел"), umertvit(p, pochemu))
    let $t2
    if ($cond($equal(pochemu, "остановлен"))) {
      $t2 = ZapisatVZhurnal({ "вид": "пробег", "кто": kto, "почему": "остановлено" })
    } else {
      $t2 = UronitProcess({ "кто": kto, "код": "FLANG_PROCESS_STOPPED", "текст": pochemu })
    }
    return { "узел": $t3, "веления": $b_dobavit($t2, $field(hod, "веления")) }
  } else {
    $matchFail($t1)
  }
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
  const $t1 = naytiProcess($field(uzel, "процессы"), $field(uzel, "кто бежит"))
  if ($isVariant($t1) && $t1.variant === "Нет процесса") {
    return { "узел": uzelSHodom(uzel, "", 0), "веления": [] }
  } else if ($isVariant($t1) && $t1.variant === "Есть процесс") {
    const p = $variantField($t1, "процесс")
    return { "узел": uzelSHodom(sProcessom(uzel, umertvit(p, kod)), "", 0), "веления": [ZapisatVZhurnal({ "вид": "отказ", "кто": $field(uzel, "кто бежит"), "почему": tekst }), UronitProcess({ "кто": $field(uzel, "кто бежит"), "код": kod, "текст": tekst })] }
  } else {
    $matchFail($t1)
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
    ["Первый процесс", pervyyProcess],
    ["Найти процесс", naytiProcess],
    ["Заменить процесс", zamenitProcess],
    ["С процессом", sProcessom],
    ["Узел с ходом", uzelSHodom],
    ["Узел со связями", uzelSoSvyazyami],
    ["Процесс заново", processZanovo],
    ["С ящиком", sYaschikom],
    ["Умертвить", umertvit],
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
