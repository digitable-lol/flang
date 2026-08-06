/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * JIT: превращает утилиту IR в исходник JavaScript и создаёт из него функцию
 * через `new Function`.
 *
 * Зачем это вообще нужно. Интерпретатор на каждый вызов обходит структуру IR:
 * массив правил, массив условий, объекты-операнды с полем `kind`, по которому
 * каждый раз ветвится switch. Вся эта работа не зависит от входных данных —
 * она зависит только от программы. JIT выполняет её один раз и оставляет
 * линейный код: последовательность `if` с уже подставленными именами полей,
 * константами и операторами. Обхода IR в горячем пути не остаётся.
 *
 * Специализация по типам — вторая половина выигрыша. Из объявления структуры
 * известно, что поле «сумма» имеет тип «Деньги», а вход уже проверен, значит
 * в этом месте лежит конечное число. Поэтому сравнение печатается как `a >= b`
 * без проверки типов, а не как вызов общего `compare`, который обязан
 * проверять. Там, где тип доказать нельзя (необязательное поле, поле чужого
 * типа, результат неопределённого типа), печатается вызов рантайм-помощника
 * с ровно той же проверкой и той же диагностикой, что в ядре. Специализация
 * не имеет права менять поведение — только убирать заведомо лишние проверки.
 *
 * О безопасности `new Function`. Это единственное место во всём ftsvm, где
 * код собирается в рантайме, и вход у него — не пользовательская строка,
 * а IR: разобранный и проверенный компилятором документ. В позицию кода
 * не попадает ни один фрагмент внешнего текста:
 *   - имена полей и все скалярные литералы печатаются через JSON.stringify
 *     и дополнительно сверяются обратным разбором (см. literal): если строка
 *     не восстанавливается в исходное значение, генерация прекращается
 *     ошибкой FTSVM_CODEGEN, а не «как-нибудь» экранируется;
 *   - имена правил, свойств и утилит попадают только внутрь строковых
 *     литералов сообщений — тем же путём;
 *   - операторы, порядок правил и структура — из фиксированного набора
 *     `switch`, а не из данных.
 * Иначе говоря, генератор печатает код по типизированному дереву, а не
 * склеивает строки от пользователя. Если бы источником IR был непроверенный
 * ввод, JIT надо было бы выключать: тогда `new Function` стал бы обычным eval
 * над чужими данными.
 */
import { escapeBidiUnicode4 } from "../../ftsc/src/bidi.mjs"

import { vmError } from "./errors.mjs"
import { findUtility, isOptional } from "./program.mjs"

/* --- рантайм-помощники: медленные пути, которые печатает генератор --- */

const RUNTIME = {
  /** Чтение поля, присутствие которого не доказано (необязательное поле). */
  field(input, name) {
    if (!(name in input)) throw vmError("FTS_UTILITY_INPUT", `во входных данных отсутствует поле «${name}»`)
    return input[name]
  },
  percent(value, name, percent) {
    if (typeof value !== "number") {
      throw vmError("FTS_UTILITY_PERCENT_TYPE", `процент можно вычислить только от числового поля «${name}»`)
    }
    return (percent / 100) * value
  },
  cmp(left, operator, right) {
    if (operator === "eq") return Object.is(left, right)
    if (operator === "neq") return !Object.is(left, right)
    if (typeof left !== "number" || typeof right !== "number") {
      throw vmError("FTS_UTILITY_COMPARE_TYPE", "сравнения порядка допустимы только для чисел")
    }
    if (operator === "gte") return left >= right
    if (operator === "lte") return left <= right
    if (operator === "gt") return left > right
    return left < right
  },
  add(result, value, ruleName) {
    if (typeof result !== "number" || typeof value !== "number") {
      throw vmError("FTS_UTILITY_ADD_TYPE", `правило «${ruleName}» может складывать только числа`)
    }
    return result + value
  },
  fail(propertyName, utilityName) {
    throw vmError("FTS_UTILITY_PROPERTY", `нарушено свойство «${propertyName}» утилиты «${utilityName}»`)
  },
  missing(name) {
    throw vmError("FTS_UTILITY_INPUT", `во входных данных отсутствует поле «${name}»`)
  },
  badType(name, type) {
    throw vmError("FTS_UTILITY_INPUT_TYPE", `поле «${name}» не соответствует типу «${type}»`)
  },
  extra(structureName, name) {
    throw vmError("FTS_UTILITY_INPUT_FIELD", `входная структура «${structureName}» не содержит поле «${name}»`)
  },
}

/* --- печать литералов --- */

/**
 * Литерал JavaScript для скаляра из IR.
 *
 * Проверка обратным разбором — не паранойя ради красоты: она формально
 * доказывает, что напечатанный текст обозначает ровно то же значение,
 * что лежало в IR, и ничего сверх того. -0 обрабатывается отдельно,
 * потому что JSON его не различает.
 * @param {unknown} value
 */
function literal(value) {
  if (typeof value === "number") {
    if (Object.is(value, -0)) return "-0"
    if (!Number.isFinite(value)) throw vmError("FTSVM_CODEGEN", "нечисловой литерал не может быть напечатан")
    return String(value)
  }
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "string") {
    const printed = JSON.stringify(value)
    if (JSON.parse(printed) !== value) throw vmError("FTSVM_CODEGEN", "строковый литерал не восстанавливается")
    return printed
  }
  throw vmError("FTSVM_CODEGEN", `литерал типа ${typeof value} не поддерживается`)
}

/** Строковый литерал для имени поля/правила/свойства. @param {unknown} name */
function nameLiteral(name) {
  if (typeof name !== "string") throw vmError("FTSVM_CODEGEN", "имя должно быть строкой")
  return literal(name)
}

/**
 * Текст для комментария в сгенерированном коде. Комментарий — тоже позиция
 * кода: имя с последовательностью «звёздочка-слэш» или с переводом строки
 * закрыло бы комментарий и превратило остаток имени в инструкции.
 * @param {unknown} text
 */
function commentText(text) {
  return String(text)
    .replace(/[\r\n\u2028\u2029]/gu, " ")
    .replace(/\*\//gu, "* /")
}

/* --- статические типы --- */

/** @param {string} type @returns {'number'|'string'|'boolean'|'unknown'} */
function typeKind(type) {
  const normalized = type.replace(/\s*\|\s*undefined/gu, "")
  if (normalized === "Число" || normalized === "Деньги" || normalized === "number") return "number"
  if (normalized === "Строка" || normalized === "Дата" || normalized === "string") return "string"
  if (normalized === "Признак" || normalized === "boolean") return "boolean"
  return "unknown"
}

/** Объединение известных типов: разные типы дают «неизвестно». */
function join(left, right) {
  return left === right ? left : "unknown"
}

/**
 * Собирает исходник функции для утилиты.
 *
 * Возвращает и текст, и метаданные: текст полезен для отладки и для README —
 * сгенерированный код можно прочитать глазами и сверить с правилами модели.
 *
 * @param {object} utility утилита из IR
 * @param {{ name: string, fields: Array<{ name: string, type: string }> }} structure
 */
export function generateSource(utility, structure) {
  /** @type {Map<string, { type: string, kind: string, optional: boolean, local: string | null }>} */
  const fields = new Map()
  structure.fields.forEach((field, index) => {
    fields.set(field.name, {
      type: field.type,
      kind: typeKind(field.type),
      optional: isOptional(field),
      // Обязательное поле после проверки входа гарантированно на месте,
      // поэтому его читают один раз в локальную переменную: дальше это
      // обычный доступ к слоту, а не поиск свойства в объекте.
      local: isOptional(field) ? null : `f${index}`,
    })
  })

  const body = []

  /* --- проверка входа: развёрнутая, без цикла по описанию структуры --- */
  body.push("  /* проверка входа */")
  structure.fields.forEach((field, index) => {
    const info = /** @type {NonNullable<ReturnType<typeof fields.get>>} */ (fields.get(field.name))
    const name = nameLiteral(field.name)
    const check = (expr) => {
      if (info.kind === "number") {
        return `typeof ${expr} !== "number" || !Number.isFinite(${expr}) || Object.is(${expr}, -0)`
      }
      if (info.kind === "string") return `typeof ${expr} !== "string"`
      if (info.kind === "boolean") return `typeof ${expr} !== "boolean"`
      return null
    }
    if (info.optional) {
      const condition = check(`input[${name}]`)
      // Необязательное поле проверяется, только если оно есть: отсутствие —
      // законное состояние, а не ошибка входа.
      if (condition) body.push(`  if (${name} in input && (${condition})) badType(${name}, ${nameLiteral(field.type)});`)
      return
    }
    body.push(`  if (!(${name} in input)) missing(${name});`)
    body.push(`  const f${index} = input[${name}];`)
    const condition = check(`f${index}`)
    if (condition) body.push(`  if (${condition}) badType(${name}, ${nameLiteral(field.type)});`)
  })
  // Чужие поля — после проверки объявленных, в порядке ключей объекта:
  // тот же порядок диагностик, что у ядра, если дефектов сразу несколько.
  body.push("  for (const key of Object.keys(input)) if (!allowed.has(key)) extra(structureName, key);")

  /**
   * Ссылка на поле: локальная переменная для обязательного поля,
   * вызов помощника — для необязательного или необъявленного.
   * @param {string} name
   */
  const fieldRef = (name) => {
    const info = fields.get(name)
    if (!info) return { expr: `field(input, ${nameLiteral(name)})`, kind: "unknown" }
    if (info.local) return { expr: info.local, kind: info.kind }
    return { expr: `field(input, ${nameLiteral(name)})`, kind: info.kind }
  }

  /**
   * @param {{ kind: string, value?: unknown, field?: string, percent?: number }} operand
   * @param {string} resultKind
   */
  const operandRef = (operand, resultKind) => {
    switch (operand.kind) {
      case "value":
        return { expr: literal(operand.value), kind: typeof operand.value }
      case "field":
        return fieldRef(/** @type {string} */ (operand.field))
      case "result":
        return { expr: "result", kind: resultKind }
      case "percent": {
        const reference = fieldRef(/** @type {string} */ (operand.field))
        const percent = literal(/** @type {number} */ (operand.percent))
        if (reference.kind === "number") {
          // Скобки и порядок как в ядре: (percent / 100) * value,
          // иначе результат мог бы отличаться на последний бит.
          return { expr: `((${percent} / 100) * ${reference.expr})`, kind: "number" }
        }
        return {
          expr: `percent(${reference.expr}, ${nameLiteral(operand.field)}, ${percent})`,
          kind: "number",
        }
      }
      default:
        throw vmError("FTSVM_CODEGEN", `неизвестный операнд «${String(operand.kind)}»`)
    }
  }

  /**
   * Сравнение. Object.is отличается от === только на NaN и ±0 — то есть
   * только на числах; если хотя бы одна сторона доказуемо не число,
   * печатается быстрое ===, и это не догадка, а тождество.
   */
  const comparison = (left, operator, right) => {
    if (operator === "eq" || operator === "neq") {
      const decidable = left.kind === "boolean" || left.kind === "string" || right.kind === "boolean" || right.kind === "string"
      if (decidable) return `${left.expr} ${operator === "eq" ? "===" : "!=="} ${right.expr}`
      const test = `Object.is(${left.expr}, ${right.expr})`
      return operator === "eq" ? test : `!${test}`
    }
    if (left.kind === "number" && right.kind === "number") {
      const operators = { gte: ">=", lte: "<=", gt: ">", lt: "<" }
      return `${left.expr} ${operators[operator]} ${right.expr}`
    }
    return `cmp(${left.expr}, ${literal(operator)}, ${right.expr})`
  }

  /* --- правила --- */
  let resultKind = typeof utility.initial
  body.push("  /* правила: выполняются все, у кого истинно условие */")
  body.push(`  let result = ${literal(utility.initial)};`)
  for (const rule of utility.rules ?? []) {
    const conditions = rule.when.map((condition) =>
      comparison(fieldRef(condition.field), condition.operator, operandRef(condition.value, resultKind)),
    )
    // && повторяет короткое замыкание ядра: второе условие не вычисляется,
    // если первое ложно, — и не бросает своих ошибок раньше времени.
    const guard = conditions.length > 0 ? conditions.join(" && ") : "true"
    body.push(`  /* правило «${commentText(rule.name)}» */`)
    body.push(`  if (${guard}) {`)
    const value = operandRef(rule.action.value, resultKind)
    if (rule.action.kind === "set") {
      body.push(`    result = ${value.expr};`)
      // Правило условное: после него результат — либо старый, либо новый.
      resultKind = join(resultKind, value.kind)
    } else {
      if (resultKind === "number" && value.kind === "number") {
        body.push(`    result += ${value.expr};`)
      } else {
        body.push(`    result = add(result, ${value.expr}, ${nameLiteral(rule.name)});`)
      }
      resultKind = join(resultKind, "number")
    }
    body.push("  }")
  }

  /* --- свойства: постусловия, нарушение прекращает выполнение --- */
  if ((utility.properties ?? []).length > 0) body.push("  /* свойства */")
  for (const property of utility.properties ?? []) {
    const limit = operandRef(property.value, resultKind)
    const test = comparison({ expr: "result", kind: resultKind }, property.operator, limit)
    body.push(`  if (!(${test})) fail(${nameLiteral(property.name)}, utilityName);`)
  }

  body.push("  return result;")

  const source = [
    '"use strict";',
    "const { field, percent, cmp, add, fail, missing, badType, extra } = rt;",
    "const { allowed, structureName, utilityName } = meta;",
    `/* утилита «${commentText(utility.name)}» из объекта «${commentText(structure.name)}» */`,
    "return function ftsvmCompiled(input) {",
    ...body,
    "};",
  ].join("\n")

  return {
    /*
     * Двунаправленные управляющие Unicode не уезжают в исходник сырыми — ни в
     * комментарий, ни в литерал. Это третья поверхность печати репозитория, и
     * она осталась незакрытой, когда первые две (восемь бэкендов flang и
     * восемь ftsc) уже были закрыты: правило жило в их модулях, а сюда никто
     * его не принёс. Модуль общий — тот же, что у ftsc.
     *
     * Форма `\uXXXX` работает по обе стороны и по разным причинам. В литерале
     * это настоящее экранирование: JavaScript вернёт ту же кодовую точку, и
     * значение правила не изменится. В комментарии это просто шесть печатных
     * знаков — но именно они и нужны: раскладку они не переставляют, а читатель
     * видит, что символ здесь был.
     *
     * Экранируется весь исходник разом, а не отдельные места склейки. Мест
     * склейки тут два (комментарий утилиты и комментарий правила), но их станет
     * больше, и правило, записанное по местам, держится ровно до следующего
     * нового места — так эта дыра и появилась.
     */
    source: escapeBidiUnicode4(source),
    meta: {
      allowed: new Set(structure.fields.map((field) => field.name)),
      structureName: structure.name,
      utilityName: utility.name,
    },
  }
}

/**
 * Создаёт функцию из исходника. Отдельная функция — чтобы `new Function`
 * встречался в модуле ровно один раз и его было видно целиком.
 * @param {{ source: string, meta: object }} generated
 */
export function instantiate(generated) {
  const factory = new Function("rt", "meta", generated.source)
  return factory(RUNTIME, generated.meta)
}

/* Кэш компиляции: программа → «модуль\0утилита» → функция.
   WeakMap по программе, потому что программа — обычный объект IR: когда
   вызывающий её отпустит, кэш не удержит её в памяти. */
const cache = new WeakMap()

/**
 * Компилирует утилиту в функцию `(input) => результат`.
 * Повторный вызов для той же утилиты возвращает ту же функцию: компиляция
 * стоит заметно дороже одного исполнения и обязана происходить один раз.
 *
 * @param {object} program IR
 * @param {string | null} moduleName
 * @param {string} utilityName
 * @returns {(input: Record<string, unknown>) => unknown}
 */
export function compileUtility(program, moduleName, utilityName) {
  const { module, utility, structure } = findUtility(program, moduleName, utilityName)
  const key = `${module.name}\u0000${utility.name}`
  let byUtility = cache.get(program)
  if (!byUtility) {
    byUtility = new Map()
    cache.set(program, byUtility)
  }
  const cached = byUtility.get(key)
  if (cached) return cached
  const compiled = instantiate(generateSource(utility, structure))
  byUtility.set(key, compiled)
  return compiled
}

/**
 * Исходник, который JIT напечатал бы для утилиты. Нужен для отладки,
 * README и теста, который читает сгенерированный код глазами.
 */
export function sourceOf(program, moduleName, utilityName) {
  const { utility, structure } = findUtility(program, moduleName, utilityName)
  return generateSource(utility, structure).source
}

/**
 * Сбрасывает кэш компиляции для программы. Нужен бенчмарку, который меряет
 * стоимость самой компиляции, и тестам. Целиком кэш не сбрасывается и не
 * может: WeakMap не перечисляется — и не должен, иначе он удерживал бы
 * программы в памяти.
 */
export function resetJitCache(program) {
  if (program) cache.delete(program)
}

/**
 * Разовый вызов через JIT — удобная обёртка: компилирует (или берёт из кэша)
 * и сразу исполняет. Проверка входа встроена в сгенерированный код, поэтому
 * отдельно её вызывать не нужно.
 */
export function runCompiled(program, moduleName, utilityName, input) {
  return compileUtility(program, moduleName, utilityName)(input)
}
