/**
 * Кодогенерация выражений Elixir из операндов/условий/действий утилиты.
 *
 * Семантика в точности повторяет интерпретатор ядра
 * (src/utility.ts: resolveOperand/compare/evaluateUtility):
 *   - "value"   → буквальное значение;
 *   - "field"   → поле ВХОДНОЙ структуры (не аккумулятора);
 *   - "percent" → operand.percent% от ВХОДНОГО поля (не от текущего результата);
 *   - "result"  → текущее накопленное значение результата.
 * Это не наша интерпретация «что логично» — это то, что реально проверяет
 * evaluateUtility ядра, и генератор обязан её сохранить дословно.
 */
import { literalFor, kindOfLiteral } from "./types.mjs"

const COMPARATORS = { eq: "==", neq: "!=", gte: ">=", lte: "<=", gt: ">", lt: "<" }

/**
 * @param {object} ctx
 * @param {string} ctx.inputVar — имя переменной входной структуры в Elixir.
 * @param {string} ctx.resultVar — имя переменной текущего результата.
 * @param {Map<string,string>} ctx.fields — оригинальное имя поля → snake-идентификатор.
 */
function fieldAccess(ctx, fieldName) {
  const identifier = ctx.fields.get(fieldName)
  if (identifier === undefined) {
    throw new Error(`утилита ссылается на неизвестное поле входной структуры: «${fieldName}»`)
  }
  return `${ctx.inputVar}.${identifier}`
}

export function renderOperand(operand, ctx) {
  switch (operand.kind) {
    case "value":
      return literalFor(kindOfLiteral(operand.value), operand.value)
    case "field":
      return fieldAccess(ctx, operand.field)
    case "result":
      return ctx.resultVar
    case "percent":
      return `(${operand.percent} / 100 * ${fieldAccess(ctx, operand.field)})`
    default:
      throw new Error(`неизвестный вид операнда: ${operand.kind}`)
  }
}

function comparator(operator) {
  const symbol = COMPARATORS[operator]
  if (!symbol) throw new Error(`неизвестный оператор сравнения: ${operator}`)
  return symbol
}

/** Условие `when[]` — соединение через логическое И (`and`), как того требует SPEC.md. */
export function renderCondition(when, ctx) {
  if (when.length === 0) return "true"
  return when
    .map(
      (condition) =>
        `${fieldAccess(ctx, condition.field)} ${comparator(condition.operator)} ${renderOperand(condition.value, ctx)}`,
    )
    .join(" and ")
}

/** Правая часть действия `set`/`add` — выражение, которое действие применяет к результату. */
export function renderAction(action, ctx) {
  const operand = renderOperand(action.value, ctx)
  if (action.kind === "set") return operand
  if (action.kind === "add") return `${ctx.resultVar} + ${operand}`
  throw new Error(`неизвестный вид действия: ${action.kind}`)
}

/** Постусловие свойства: `result <operator> <value>`. */
export function renderPropertyCheck(property, ctx) {
  return `${ctx.resultVar} ${comparator(property.operator)} ${renderOperand(property.value, ctx)}`
}

/** Ссылается ли операнд на поле входной структуры (напрямую или через процент). */
function operandUsesInput(operand) {
  return operand.kind === "field" || operand.kind === "percent"
}

/** Нужен ли параметр входной структуры хотя бы одному из свойств утилиты. */
export function propertiesUseInput(properties) {
  return properties.some((property) => operandUsesInput(property.value))
}
