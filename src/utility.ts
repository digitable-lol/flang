import { diagnosticError } from "./diagnostics.js"
import type {
  FtsDocument,
  FtsScalar,
  FtsStructure,
  FtsUtility,
  FtsUtilityComparison,
  FtsUtilityOperand,
  UtilityGeneration,
} from "./model.js"

export interface UtilityExampleResult {
  utility: string
  example: string
  passed: boolean
  expected: FtsScalar
  actual?: FtsScalar
  error?: string
}

export interface UtilityTestResult {
  valid: boolean
  total: number
  passed: number
  failed: number
  results: UtilityExampleResult[]
}

export function executeUtility(
  document: FtsDocument,
  utilityName: string,
  input: Record<string, FtsScalar>,
): FtsScalar {
  const utility = document.utilities?.find((item) => item.name === utilityName)
  if (!utility) throw diagnosticError("FTS_UNKNOWN_UTILITY", `не найдена утилита «${utilityName}»`)
  const structure = document.structures.find((item) => item.name === utility.input)
  if (!structure) throw diagnosticError("FTS_UTILITY_INPUT", `не найдена входная структура «${utility.input}»`)
  for (const field of structure.fields) {
    const optional = field.type.includes("undefined")
    if (!(field.name in input)) {
      if (!optional) throw diagnosticError("FTS_UTILITY_INPUT", `во входных данных отсутствует поле «${field.name}»`)
      continue
    }
    if (!matchesRuntimeType(input[field.name]!, field.type)) {
      throw diagnosticError("FTS_UTILITY_INPUT_TYPE", `поле «${field.name}» не соответствует типу «${field.type}»`)
    }
  }
  for (const field of Object.keys(input)) {
    if (!structure.fields.some((item) => item.name === field)) {
      throw diagnosticError("FTS_UTILITY_INPUT_FIELD", `входная структура «${utility.input}» не содержит поле «${field}»`)
    }
  }
  return evaluateUtility(utility, input)
}

export function evaluateUtility(utility: FtsUtility, input: Record<string, FtsScalar>): FtsScalar {
  let result = utility.initial
  for (const rule of utility.rules) {
    if (!rule.when.every((condition) => compare(resolveField(input, condition.field), condition.operator, resolveOperand(condition.value, input, result)))) {
      continue
    }
    const value = resolveOperand(rule.action.value, input, result)
    if (rule.action.kind === "set") {
      result = value
    } else {
      if (typeof result !== "number" || typeof value !== "number") {
        throw diagnosticError("FTS_UTILITY_ADD_TYPE", `правило «${rule.name}» может складывать только числа`)
      }
      result += value
    }
  }

  for (const property of utility.properties) {
    const limit = resolveOperand(property.value, input, result)
    if (!compare(result, property.operator, limit)) {
      throw diagnosticError("FTS_UTILITY_PROPERTY", `нарушено свойство «${property.name}» утилиты «${utility.name}»`)
    }
  }
  return result
}

export function testUtilities(document: FtsDocument): UtilityTestResult {
  if ((document.utilities ?? []).length === 0) throw diagnosticError("FTS_NO_UTILITIES", "документ не содержит утилит")
  const results: UtilityExampleResult[] = []
  for (const utility of document.utilities ?? []) {
    for (const example of utility.examples) {
      try {
        const actual = evaluateUtility(utility, example.input)
        results.push({
          utility: utility.name,
          example: example.name,
          passed: Object.is(actual, example.expected),
          expected: example.expected,
          actual,
        })
      } catch (error) {
        results.push({
          utility: utility.name,
          example: example.name,
          passed: false,
          expected: example.expected,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }
  if (results.length === 0) throw diagnosticError("FTS_NO_UTILITY_EXAMPLES", "утилиты не содержат примеров")
  const passed = results.filter((result) => result.passed).length
  return { valid: passed === results.length, total: results.length, passed, failed: results.length - passed, results }
}

export function generateTypeScript(document: FtsDocument): UtilityGeneration {
  const utilities = document.utilities ?? []
  if (utilities.length === 0) throw diagnosticError("FTS_NO_UTILITIES", "документ не содержит утилит")
  const structures = new Map(document.structures.map((structure) => [structure.name, structure]))
  const implementation = renderImplementation(utilities, structures)
  const tests = renderTests(utilities)
  return {
    target: "typescript",
    utilities: utilities.map((utility) => utility.name),
    files: [
      { path: "fts.utilities.ts", content: implementation },
      { path: "fts.utilities.test.ts", content: tests },
    ],
  }
}

function resolveField(input: Record<string, FtsScalar>, field: string): FtsScalar {
  if (!(field in input)) throw diagnosticError("FTS_UTILITY_INPUT", `во входных данных отсутствует поле «${field}»`)
  return input[field]!
}

function resolveOperand(operand: FtsUtilityOperand, input: Record<string, FtsScalar>, result: FtsScalar): FtsScalar {
  switch (operand.kind) {
    case "value":
      return operand.value
    case "field":
      return resolveField(input, operand.field)
    case "result":
      return result
    case "percent": {
      const value = resolveField(input, operand.field)
      if (typeof value !== "number") {
        throw diagnosticError("FTS_UTILITY_PERCENT_TYPE", `процент можно вычислить только от числового поля «${operand.field}»`)
      }
      return (operand.percent / 100) * value
    }
  }
}

function compare(left: FtsScalar, operator: FtsUtilityComparison, right: FtsScalar): boolean {
  if (operator === "eq") return Object.is(left, right)
  if (operator === "neq") return !Object.is(left, right)
  if (typeof left !== "number" || typeof right !== "number") {
    throw diagnosticError("FTS_UTILITY_COMPARE_TYPE", "сравнения порядка допустимы только для чисел")
  }
  if (operator === "gte") return left >= right
  if (operator === "lte") return left <= right
  if (operator === "gt") return left > right
  return left < right
}

function renderImplementation(utilities: FtsUtility[], structures: Map<string, FtsStructure>): string {
  const lines = [
    "// Generated by FTS. Do not edit by hand.",
    "",
  ]
  utilities.forEach((utility, index) => {
    const structure = structures.get(utility.input)
    lines.push(`export interface FtsInput${index} {`)
    for (const field of structure?.fields ?? []) {
      const optional = field.type.includes("undefined") ? "?" : ""
      lines.push(`  ${JSON.stringify(field.name)}${optional}: ${typescriptType(field.type)}`)
    }
    lines.push("}", "")
  })

  lines.push("export const ftsUtilities = {")
  utilities.forEach((utility, index) => {
    lines.push(`  ${JSON.stringify(utility.name)}: (input: FtsInput${index}): ${typescriptType(utility.output)} => {`)
    lines.push(`    let result: ${typescriptType(utility.output)} = ${renderScalar(utility.initial)}`)
    for (const rule of utility.rules) {
      const condition = rule.when.map((item) => renderCondition(item.field, item.operator, item.value)).join(" && ") || "true"
      lines.push(`    if (${condition}) {`)
      const operand = renderOperand(rule.action.value)
      lines.push(rule.action.kind === "add" ? `      result += ${operand}` : `      result = ${operand}`)
      lines.push("    }")
    }
    for (const property of utility.properties) {
      const comparison = renderComparison("result", property.operator, renderOperand(property.value))
      lines.push(`    if (!(${comparison})) throw new Error(${JSON.stringify(`Нарушено свойство «${property.name}»`)})`)
    }
    lines.push("    return result", "  },")
  })
  lines.push("} as const", "")
  return lines.join("\n")
}

function renderTests(utilities: FtsUtility[]): string {
  const lines = [
    "// Generated by FTS. Do not edit by hand.",
    'import assert from "node:assert/strict"',
    'import { test } from "node:test"',
    'import { ftsUtilities } from "./fts.utilities.js"',
    "",
  ]
  for (const utility of utilities) {
    for (const example of utility.examples) {
      lines.push(`test(${JSON.stringify(`${utility.name}: ${example.name}`)}, () => {`)
      lines.push(`  const actual = ftsUtilities[${JSON.stringify(utility.name)}](${JSON.stringify(example.input)})`)
      lines.push(`  assert.deepEqual(actual, ${renderScalar(example.expected)})`)
      lines.push("})", "")
    }
  }
  return lines.join("\n")
}

function renderCondition(field: string, operator: FtsUtilityComparison, operand: FtsUtilityOperand): string {
  return renderComparison(`input[${JSON.stringify(field)}]`, operator, renderOperand(operand))
}

function renderComparison(left: string, operator: FtsUtilityComparison, right: string): string {
  const operators: Record<FtsUtilityComparison, string> = {
    eq: "===",
    neq: "!==",
    gte: ">=",
    lte: "<=",
    gt: ">",
    lt: "<",
  }
  return `${left} ${operators[operator]} ${right}`
}

function renderOperand(operand: FtsUtilityOperand): string {
  if (operand.kind === "value") return renderScalar(operand.value)
  if (operand.kind === "result") return "result"
  if (operand.kind === "field") return `input[${JSON.stringify(operand.field)}]`
  return `(${operand.percent} / 100) * input[${JSON.stringify(operand.field)}]`
}

function renderScalar(value: FtsScalar): string {
  return JSON.stringify(value)
}

function typescriptType(type: string): string {
  const normalized = type.replace(/\s*\|\s*undefined/gu, "")
  const base =
    normalized === "Строка" || normalized === "Дата" ? "string"
      : normalized === "Число" || normalized === "Деньги" ? "number"
        : normalized === "Признак" ? "boolean"
          : "unknown"
  return type.includes("undefined") ? `${base} | undefined` : base
}

function matchesRuntimeType(value: FtsScalar, type: string): boolean {
  const normalized = type.replace(/\s*\|\s*undefined/gu, "")
  if (normalized === "Строка" || normalized === "Дата" || normalized === "string") return typeof value === "string"
  if (normalized === "Число" || normalized === "Деньги" || normalized === "number") {
    return typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)
  }
  if (normalized === "Признак" || normalized === "boolean") return typeof value === "boolean"
  return true
}
