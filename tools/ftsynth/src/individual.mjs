/**
 * Особь популяции — это модель FTS, а не строка и не дерево выражений.
 *
 * Генотип: начальное значение плюс упорядоченный список правил в точности той
 * формы, что описана в `src/model.ts` ядра (`FtsUtilityRule`). Мутация меняет
 * структуру, текст печатается только на выходе. Обратный порядок (мутировать
 * текст) неизбежно порождает то, что не разбирается, и весь инвариант
 * «любая особь компилируется» рассыпается.
 *
 * Имена правил в генотипе не хранятся: имя выводится из условий при печати.
 * Иначе кроссовер таскал бы за правилами устаревшие имена, и читаемость —
 * единственное, ради чего всё затевалось, — терялась бы к десятому поколению.
 */
import { COMPARISON_WORD, RETURN_WORD } from "./schema.mjs"

export function cloneIndividual(individual) {
  return {
    initial: individual.initial,
    rules: individual.rules.map((rule) => ({
      when: rule.when.map((condition) => ({ ...condition, value: { ...condition.value } })),
      action: { kind: rule.action.kind, value: { ...rule.action.value } },
    })),
  }
}

export function randomIndividual(space, rng) {
  const count = rng.between(1, Math.min(3, space.maxRules))
  return {
    initial: rng.pick(space.initials),
    rules: Array.from({ length: count }, () => randomRule(space, rng)),
  }
}

export function randomRule(space, rng) {
  const conditions = rng.between(1, Math.min(2, space.maxConditions))
  const when = []
  for (let index = 0; index < conditions; index += 1) {
    const condition = randomCondition(space, rng)
    // Два условия на одно поле в конъюнкции почти всегда либо избыточны, либо
    // противоречивы, поэтому поле не повторяем.
    if (!when.some((item) => item.field === condition.field)) when.push(condition)
  }
  if (when.length === 0) when.push(randomCondition(space, rng))
  return { when, action: randomAction(space, rng) }
}

export function randomCondition(space, rng) {
  const usable = space.fields.filter((field) => field.thresholds.length > 0 || field.values.length > 0)
  const field = rng.pick(usable)
  if (field.kind === "number") {
    // gte/lte встречаются в человеческих политиках намного чаще строгих.
    const operator = rng.pick(["gte", "gte", "lte", "lte", "gt", "lt"])
    if (space.numericFields.length > 1 && rng.chance(0.04)) {
      const other = rng.pick(space.numericFields.filter((item) => item.name !== field.name))
      if (other) return { field: field.name, operator, value: { kind: "field", field: other.name } }
    }
    return { field: field.name, operator, value: { kind: "value", value: rng.pick(field.thresholds) } }
  }
  const operator = rng.pick(["eq", "eq", "eq", "neq"])
  return { field: field.name, operator, value: { kind: "value", value: rng.pick(field.values) } }
}

export function randomAction(space, rng) {
  if (space.outputKind !== "number") {
    return { kind: "set", value: { kind: "value", value: rng.pick(space.constants) } }
  }
  const kind = rng.chance(0.75) ? "add" : "set"
  return { kind, value: randomNumericOperand(space, rng) }
}

export function randomNumericOperand(space, rng) {
  if (space.numericFields.length > 0 && rng.chance(0.55)) {
    return { kind: "percent", percent: rng.pick(space.percents), field: rng.pick(space.numericFields).name }
  }
  if (space.numericFields.length > 0 && rng.chance(0.06)) {
    return { kind: "field", field: rng.pick(space.numericFields).name }
  }
  return { kind: "value", value: rng.pick(space.constants) }
}

/** Генотип -> исполняемая структура ядра FTS. */
export function buildUtility(individual, space, examples = []) {
  return {
    name: space.utility,
    input: space.structure.name,
    output: space.outputType,
    initial: individual.initial,
    rules: individual.rules.map((rule, index) => ({
      name: ruleName(rule, index),
      when: rule.when.map((condition) => ({ ...condition })),
      action: { ...rule.action },
    })),
    properties: space.properties,
    examples,
  }
}

export function buildDocument(individual, space, examples = []) {
  return {
    category: space.category,
    structures: [space.structure],
    functors: [],
    proposition: null,
    ts_compat: {},
    utilities: [buildUtility(individual, space, examples)],
  }
}

function ruleName(rule, index) {
  const description = rule.when.map(conditionPhrase).join(" и ")
  return `Правило ${index + 1} — ${sanitizeName(description)}`
}

// Имя правила печатается внутри «ёлочек», поэтому закрывающая кавычка внутри
// имени сломала бы разбор. Поля из наших наборов её не содержат, но особь
// собирается из данных, а данные приходят снаружи.
function sanitizeName(text) {
  return text.replace(/[«»"']/gu, "").trim() || "без условий"
}

function conditionPhrase(condition) {
  return `${condition.field} ${COMPARISON_WORD[condition.operator]} ${operandPhrase(condition.value)}`
}

function operandPhrase(operand) {
  if (operand.kind === "result") return "результат"
  if (operand.kind === "field") return `поле ${operand.field}`
  if (operand.kind === "percent") return `${formatNumber(operand.percent)} процентов от поля ${operand.field}`
  // Имя правила читает человек, поэтому значения в нём записаны словами языка
  // («да», «нет»), а не так, как их печатает JavaScript.
  return renderScalar(operand.value).replace(/[«»]/gu, "")
}

/** Печать модели в естественную поверхность FTS. */
export function renderDocument(document) {
  const lines = [`категория «${document.category}»`, ""]
  for (const structure of document.structures) {
    lines.push(`  объект «${structure.name}»`)
    for (const field of structure.fields) lines.push(`    «${field.name}» является ${typeWord(field.type)}`)
    lines.push("")
  }
  for (const utility of document.utilities ?? []) {
    lines.push(`  утилита «${utility.name}»`)
    lines.push(`    принимает «${utility.input}»`)
    lines.push(`    возвращает ${RETURN_WORD[utility.output] ?? utility.output}`)
    lines.push(`    начинает с ${renderScalar(utility.initial)}`)
    lines.push("")
    for (const rule of utility.rules) {
      lines.push(`    правило «${rule.name}»`)
      rule.when.forEach((condition, index) => {
        const keyword = index === 0 ? "если" : "и"
        lines.push(`      ${keyword} «${condition.field}» ${COMPARISON_WORD[condition.operator]} ${renderOperand(condition.value)}`)
      })
      lines.push(rule.action.kind === "add"
        ? `      то добавить ${renderOperand(rule.action.value)}`
        : `      то результат равен ${renderOperand(rule.action.value)}`)
      lines.push("")
    }
    for (const property of utility.properties) {
      lines.push(`    свойство «${property.name}»`)
      lines.push(`      результат ${COMPARISON_WORD[property.operator]} ${renderOperand(property.value)}`)
      lines.push("")
    }
    for (const example of utility.examples) {
      lines.push(`    пример «${example.name}»`)
      for (const [field, value] of Object.entries(example.input)) {
        lines.push(`      дано «${field}» равен ${renderScalar(value)}`)
      }
      lines.push(`      ожидается результат равен ${renderScalar(example.expected)}`)
      lines.push("")
    }
  }
  return `${lines.join("\n").replace(/\n+$/u, "")}\n`
}

function typeWord(type) {
  const words = { Число: "числом", Деньги: "деньгами", Строка: "строкой", Дата: "датой", Признак: "признаком" }
  return words[type] ?? type
}

export function renderOperand(operand) {
  if (operand.kind === "result") return "результат"
  if (operand.kind === "field") return `поле «${operand.field}»`
  if (operand.kind === "percent") return `${formatNumber(operand.percent)} процентов от поля «${operand.field}»`
  return renderScalar(operand.value)
}

export function renderScalar(value) {
  if (value === true) return "да"
  if (value === false) return "нет"
  if (value === null) return "ничто"
  if (typeof value === "number") return formatNumber(value)
  return `«${value}»`
}

// Числа печатаются без экспоненты и без хвоста двоичной арифметики: разбор
// процентов в ядре принимает только десятичную запись.
export function formatNumber(value) {
  const rounded = Number(value.toFixed(6))
  return Object.is(rounded, -0) ? "0" : String(rounded)
}
