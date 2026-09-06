/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

// СГЕНЕРИРОВАНО flang — НЕ ПРАВИТЬ РУКАМИ. Переиздать из корня дерева flang:
// bootstrap/flang emit examples/frameworks/vue-roman/core/roman-numerals.flang --target js --out examples/frameworks/vue-roman/printed
// Сгенерировано flang (бэкенд JavaScript, flang/self/emit-js.flang). Не редактировать руками.
// Модуль flang: «Roman numerals».
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

function $requireList(value, label) {
  if (!$isList(value)) {
    $fail("FLANG_TYPE", `«${label}» работает только со списком, получено ${$typeName(value)}`)
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

function $div(left, right) {
  $nums("div", left, right)
  return left / right
}

function $mod(left, right) {
  $nums("mod", left, right)
  return left % right
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

function $b_simvoly(text) {
  $expectString("символы", text, "строка")
  /* Array.from идёт по кодовым точкам, а не по единицам UTF-16: [...text] и
     text.split("") разошлись бы на первом же символе вне BMP. То же деление,
     что у «длина» и «подстрока» в builtins.mjs. */
  return Array.from(text)
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

/** Запись FTS «Разбор римского». */
/** @typedef {{ "итог": number, "максимум": number }} RazborRimskogo */

/**
 * Фабрика записи «Разбор римского».
 *
 * Запись flang тотальна: у неё есть все объявленные поля. Отсутствующее
 * поле — это «ничто» (null), а не дырка в объекте, иначе доступ к полю дал
 * бы FLANG_UNKNOWN_NAME там, где интерпретатор возвращает значение.
 *
 * @param {Partial<RazborRimskogo>} [fields]
 * @returns {RazborRimskogo}
 */
export function sozdatRazborRimskogo(fields = {}) {
  return {
    "итог": fields["итог"] ?? null,
    "максимум": fields["максимум"] ?? null,
  }
}

/**
 * Функция flang «Повторить знак».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} znak — «знак»
 * @param {number} skolko — «сколько»
 * @returns {string}
 */
export function povtoritZnak(znak, skolko) {
  const $t1 = $requireList([1, 2, 3], "свёртка")
  let akk = ""
  for (const shag of $t1) {
    let $t2
    if ($cond($lte(shag, skolko))) {
      $t2 = $concat(akk, znak)
    } else {
      $t2 = akk
    }
    akk = $t2
  }
  return akk
}

/**
 * Функция flang «Римская группа».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} cifra — «цифра»
 * @param {string} malyy — «малый»
 * @param {string} sredniy — «средний»
 * @param {string} starshiy — «старший»
 * @returns {string}
 */
export function rimskayaGruppa(cifra, malyy, sredniy, starshiy) {
  if ($cond($equal(cifra, 9))) {
    return $concat(malyy, starshiy)
  } else {
    if ($cond($equal(cifra, 4))) {
      return $concat(malyy, sredniy)
    } else {
      if ($cond($gte(cifra, 5))) {
        return $concat(sredniy, povtoritZnak(malyy, $sub(cifra, 5)))
      } else {
        return povtoritZnak(malyy, cifra)
      }
    }
  }
}

/**
 * Функция flang «Цифра разряда».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} chislo — «число»
 * @param {number} razryad — «разряд»
 * @returns {number}
 */
export function cifraRazryada(chislo, razryad) {
  return $mod($div($sub(chislo, $mod(chislo, razryad)), razryad), 10)
}

/**
 * Функция flang «Тысяч».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} chislo — «число»
 * @returns {number}
 */
export function tysyach(chislo) {
  return $div($sub(chislo, $mod(chislo, 1000)), 1000)
}

/**
 * Функция flang «В римские».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} chislo — «число»
 * @returns {string}
 */
export function vRimskie(chislo) {
  const tysyachi = povtoritZnak("M", tysyach(chislo))
  const sotni = rimskayaGruppa(cifraRazryada(chislo, 100), "C", "D", "M")
  const desyatki = rimskayaGruppa(cifraRazryada(chislo, 10), "X", "L", "C")
  const shtuki = rimskayaGruppa(cifraRazryada(chislo, 1), "I", "V", "X")
  return $concat($concat($concat(tysyachi, sotni), desyatki), shtuki)
}

/**
 * Функция flang «Значение цифры».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} znak — «знак»
 * @returns {number}
 */
export function znachenieCifry(znak) {
  if ($cond($equal(znak, "M"))) {
    return 1000
  } else {
    if ($cond($equal(znak, "D"))) {
      return 500
    } else {
      if ($cond($equal(znak, "C"))) {
        return 100
      } else {
        if ($cond($equal(znak, "L"))) {
          return 50
        } else {
          if ($cond($equal(znak, "X"))) {
            return 10
          } else {
            if ($cond($equal(znak, "V"))) {
              return 5
            } else {
              if ($cond($equal(znak, "I"))) {
                return 1
              } else {
                return 0
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Функция flang «Приписать знак в начало».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} pervyy — «первый»
 * @param {Array<string>} elementy — «элементы»
 * @returns {Array<string>}
 */
export function pripisatZnakVNachalo(pervyy, elementy) {
  const $t1 = $requireList(elementy, "свёртка")
  let akk = [pervyy]
  for (const el of $t1) {
    akk = $b_dobavit(el, akk)
  }
  return akk
}

/**
 * Функция flang «Обратить символы».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<string>} elementy — «элементы»
 * @returns {Array<string>}
 */
export function obratitSimvoly(elementy) {
  const $t1 = $requireList(elementy, "свёртка")
  let akk = []
  for (const znak of $t1) {
    akk = pripisatZnakVNachalo(znak, akk)
  }
  return akk
}

/**
 * Функция flang «Из римских».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {string} tekst — «текст»
 * @returns {number}
 */
export function izRimskih(tekst) {
  const $t1 = $requireList(obratitSimvoly($b_simvoly(tekst)), "свёртка")
  let akk = { "итог": 0, "максимум": 0 }
  for (const znak of $t1) {
    const znachenie = znachenieCifry(znak)
    let $t2
    if ($cond($lt(znachenie, $field(akk, "максимум")))) {
      $t2 = { "итог": $sub($field(akk, "итог"), znachenie), "максимум": $field(akk, "максимум") }
    } else {
      $t2 = { "итог": $add($field(akk, "итог"), znachenie), "максимум": znachenie }
    }
    akk = $t2
  }
  const razobrano = akk
  return $field(razobrano, "итог")
}

/**
 * Функция flang «Туда и обратно».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {number} chislo — «число»
 * @returns {*}
 */
export function tudaIObratno(chislo) {
  return $equal(izRimskih(vRimskie(chislo)), chislo)
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
    ["Повторить знак", povtoritZnak],
    ["Римская группа", rimskayaGruppa],
    ["Цифра разряда", cifraRazryada],
    ["Тысяч", tysyach],
    ["В римские", vRimskie],
    ["Значение цифры", znachenieCifry],
    ["Приписать знак в начало", pripisatZnakVNachalo],
    ["Обратить символы", obratitSimvoly],
    ["Из римских", izRimskih],
    ["Туда и обратно", tudaIObratno],
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
