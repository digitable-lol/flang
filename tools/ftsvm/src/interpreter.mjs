/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Интерпретатор: исполняет утилиту прямо по IR, шаг за шагом.
 *
 * Никакой подготовки: на каждый вызов заново обходятся правила, условия и
 * операнды как структуры данных. Это медленнее JIT, зато у него нет фазы
 * компиляции — он полезен там, где утилиту вызывают один раз (проверка
 * примеров при сборке, разовый расчёт в CLI), и служит эталоном, с которым
 * сверяется сгенерированный код.
 *
 * Семантика — ровно ядерная (src/utility.ts):
 *   - исполняются ВСЕ правила с истинным условием, в порядке объявления;
 *     никакого else, никакого выхода после первого срабатывания;
 *   - свойства проверяются после всех правил, и нарушение свойства —
 *     ошибка FTS_UTILITY_PROPERTY, а не «поправить результат до допустимого».
 *     Свойство здесь постусловие, а не ограничение-корректор.
 */
import { vmError } from "./errors.mjs"
import { checkInput, findUtility } from "./program.mjs"

/**
 * @param {Record<string, unknown>} input
 * @param {string} field
 */
function resolveField(input, field) {
  // Необязательное поле может отсутствовать во входе, пройдя проверку
  // структуры: тогда обращение к нему из правила — ошибка исполнения.
  if (!(field in input)) throw vmError("FTS_UTILITY_INPUT", `во входных данных отсутствует поле «${field}»`)
  return input[field]
}

/**
 * @param {{ kind: string, value?: unknown, field?: string, percent?: number }} operand
 * @param {Record<string, unknown>} input
 * @param {unknown} result
 */
function resolveOperand(operand, input, result) {
  switch (operand.kind) {
    case "value":
      return operand.value
    case "field":
      return resolveField(input, /** @type {string} */ (operand.field))
    case "result":
      return result
    case "percent": {
      const value = resolveField(input, /** @type {string} */ (operand.field))
      if (typeof value !== "number") {
        throw vmError("FTS_UTILITY_PERCENT_TYPE", `процент можно вычислить только от числового поля «${operand.field}»`)
      }
      return /** @type {number} */ ((operand.percent) / 100) * value
    }
    default:
      throw vmError("FTSVM_UNKNOWN_OPERAND", `неизвестный операнд «${String(operand.kind)}»`)
  }
}

/**
 * @param {unknown} left
 * @param {string} operator
 * @param {unknown} right
 */
function compare(left, operator, right) {
  // eq/neq — через Object.is, а не ===: это единственный способ одинаково
  // повести себя на NaN и -0 в интерпретаторе, в JIT и в ядре.
  if (operator === "eq") return Object.is(left, right)
  if (operator === "neq") return !Object.is(left, right)
  if (typeof left !== "number" || typeof right !== "number") {
    throw vmError("FTS_UTILITY_COMPARE_TYPE", "сравнения порядка допустимы только для чисел")
  }
  if (operator === "gte") return left >= right
  if (operator === "lte") return left <= right
  if (operator === "gt") return left > right
  return left < right
}

/**
 * Исполняет утилиту по её описанию из IR. Вход уже проверен вызывающим.
 * @param {object} utility
 * @param {Record<string, unknown>} input
 */
export function evaluate(utility, input) {
  let result = utility.initial
  for (const rule of utility.rules ?? []) {
    let matched = true
    for (const condition of rule.when) {
      if (!compare(resolveField(input, condition.field), condition.operator, resolveOperand(condition.value, input, result))) {
        matched = false
        break
      }
    }
    if (!matched) continue
    const value = resolveOperand(rule.action.value, input, result)
    if (rule.action.kind === "set") {
      result = value
    } else {
      if (typeof result !== "number" || typeof value !== "number") {
        throw vmError("FTS_UTILITY_ADD_TYPE", `правило «${rule.name}» может складывать только числа`)
      }
      result += value
    }
  }
  for (const property of utility.properties ?? []) {
    const limit = resolveOperand(property.value, input, result)
    if (!compare(result, property.operator, limit)) {
      throw vmError("FTS_UTILITY_PROPERTY", `нарушено свойство «${property.name}» утилиты «${utility.name}»`)
    }
  }
  return result
}

/**
 * Исполнить утилиту программы на входных данных.
 *
 * @param {object} program IR (SPEC.md §4)
 * @param {string | null} moduleName имя модуля; null — искать по всей программе
 * @param {string} utilityName имя утилиты
 * @param {Record<string, unknown>} input факты
 */
export function run(program, moduleName, utilityName, input) {
  const { utility, structure } = findUtility(program, moduleName, utilityName)
  checkInput(structure, input)
  return evaluate(utility, input)
}
