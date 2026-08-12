/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

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

export interface UtilityTrace {
  /** `false` when the core refused the input: the point decides nothing. */
  ok: boolean
  result: FtsScalar
  /** Per rule, in declaration order: did it fire on this input? */
  fired: boolean[]
  error?: string
}

export function evaluateUtility(utility: FtsUtility, input: Record<string, FtsScalar>): FtsScalar {
  const { result } = applyRules(utility, input)

  for (const property of utility.properties) {
    const limit = resolveOperand(property.value, input, result)
    if (!compare(result, property.operator, limit)) {
      throw diagnosticError("FTS_UTILITY_PROPERTY", `нарушено свойство «${property.name}» утилиты «${utility.name}»`)
    }
  }
  return result
}

/**
 * Evaluate a utility and record which rules fired, without enforcing its
 * properties.
 *
 * Analysis outside the core has to probe: run the utility once per rule with a
 * marker action to learn whether that rule fired, then once more per property
 * to learn its limit. Inside the core the same knowledge costs one pass,
 * because the evaluator is right here — and a violated property is a finding
 * for the caller, not a reason to abort.
 */
export function traceUtility(utility: FtsUtility, input: Record<string, FtsScalar>): UtilityTrace {
  try {
    const { result, fired } = applyRules(utility, input)
    return { ok: true, result, fired }
  } catch (error) {
    return {
      ok: false,
      result: utility.initial,
      fired: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** The limit a property compares the result against, for this input. */
export function propertyLimit(
  property: FtsUtility["properties"][number],
  input: Record<string, FtsScalar>,
  result: FtsScalar,
): FtsScalar {
  return resolveOperand(property.value, input, result)
}

/** Does the result satisfy the comparison? Throws for order over non-numbers. */
export function compareValues(left: FtsScalar, operator: FtsUtilityComparison, right: FtsScalar): boolean {
  return compare(left, operator, right)
}

function applyRules(utility: FtsUtility, input: Record<string, FtsScalar>): { result: FtsScalar; fired: boolean[] } {
  const fired = utility.rules.map(() => false)
  let result = utility.initial
  utility.rules.forEach((rule, index) => {
    if (!rule.when.every((condition) => compare(resolveField(input, condition.field), condition.operator, resolveOperand(condition.value, input, result)))) {
      return
    }
    fired[index] = true
    const value = resolveOperand(rule.action.value, input, result)
    if (rule.action.kind === "set") {
      result = value
      return
    }
    if (typeof result !== "number" || typeof value !== "number") {
      throw diagnosticError("FTS_UTILITY_ADD_TYPE", `правило «${rule.name}» может складывать только числа`)
    }
    result += value
  })
  return { result, fired }
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

/**
 * The error the generated code raises — the core's code and the core's text.
 *
 * The generated file goes into somebody else's TypeScript, so it cannot import
 * `FtsError` from this package: it carries its own, shaped so that a caller who
 * already reads `error.diagnostics[0].code` from `fts` reads it here unchanged.
 * `name` is `"FtsError"` for the same reason.
 *
 * Before this existed the generated code threw `new Error("Нарушено свойство
 * «…»")` — no code, and a text that differed from the core's by its very first
 * letter. Anything catching the core's refusal by code caught nothing here.
 */
const RUNTIME_PRELUDE = [
  "export interface FtsDiagnostic {",
  "  code: string",
  "  message: string",
  '  severity: "error"',
  "}",
  "",
  "export class FtsError extends Error {",
  "  readonly diagnostics: FtsDiagnostic[]",
  "",
  "  constructor(code: string, message: string) {",
  "    super(message)",
  '    this.name = "FtsError"',
  '    this.diagnostics = [{ code, message, severity: "error" }]',
  "  }",
  "}",
  "",
]

/** Helpers emitted only where the input's declared types leave work at runtime. */
const RUNTIME_HELPERS: Record<string, readonly string[]> = {
  ftsField: [
    "function ftsField(input: Record<string, unknown>, field: string): unknown {",
    '  if (!(field in input)) throw new FtsError("FTS_UTILITY_INPUT", `во входных данных отсутствует поле «${field}»`)',
    "  return input[field]",
    "}",
    "",
  ],
  ftsPercent: [
    "function ftsPercent(input: Record<string, unknown>, field: string, percent: number): number {",
    "  const value = ftsField(input, field)",
    "  if (typeof value !== \"number\") {",
    '    throw new FtsError("FTS_UTILITY_PERCENT_TYPE", `процент можно вычислить только от числового поля «${field}»`)',
    "  }",
    "  return (percent / 100) * value",
    "}",
    "",
  ],
  ftsOrder: [
    'function ftsOrder(left: unknown, operator: "gte" | "lte" | "gt" | "lt", right: unknown): boolean {',
    '  if (typeof left !== "number" || typeof right !== "number") {',
    '    throw new FtsError("FTS_UTILITY_COMPARE_TYPE", "сравнения порядка допустимы только для чисел")',
    "  }",
    '  if (operator === "gte") return left >= right',
    '  if (operator === "lte") return left <= right',
    '  if (operator === "gt") return left > right',
    "  return left < right",
    "}",
    "",
  ],
  ftsAdd: [
    "function ftsAdd(result: unknown, value: unknown, rule: string): number {",
    '  if (typeof result !== "number" || typeof value !== "number") {',
    '    throw new FtsError("FTS_UTILITY_ADD_TYPE", `правило «${rule}» может складывать только числа`)',
    "  }",
    "  return result + value",
    "}",
    "",
  ],
}

/**
 * The input check, in the core's order.
 *
 * The order is not a detail: `executeUtility` walks the declared fields in
 * declaration order, refusing the first one that is missing or of the wrong
 * type, and only then looks for fields the structure does not declare. A
 * generated file that checked the same things in another order would answer a
 * different refusal to the same input, which is the divergence this whole
 * function exists to remove.
 */
function renderInputCheck(shape: InputShape, indent: string): string[] {
  if (shape.structure === undefined) return []
  const lines: string[] = []
  for (const [name, field] of shape.fields) {
    const access = `data[${JSON.stringify(name)}]`
    if (!field.optional) {
      lines.push(
        `${indent}if (!(${JSON.stringify(name)} in data)) {`,
        `${indent}  throw new FtsError("FTS_UTILITY_INPUT", ${JSON.stringify(`во входных данных отсутствует поле «${name}»`)})`,
        `${indent}}`,
      )
    }
    /* An unmapped declared type (a phrase rather than a scalar) is exactly what
       `matchesRuntimeType` returns `true` for: it checks nothing, so neither
       does this. Emitting a check here would refuse inputs the core accepts. */
    const test = runtimeTypeTest(access, field.type)
    if (test === undefined) continue
    const guard = field.optional ? `${JSON.stringify(name)} in data && ` : ""
    lines.push(
      `${indent}if (${guard}!(${test})) {`,
      `${indent}  throw new FtsError("FTS_UTILITY_INPUT_TYPE", ${JSON.stringify(`поле «${name}» не соответствует типу «${field.type}»`)})`,
      `${indent}}`,
    )
  }
  const declared = [...shape.fields.keys()]
  lines.push(
    `${indent}for (const field of Object.keys(data)) {`,
    `${indent}  if (![${declared.map((name) => JSON.stringify(name)).join(", ")}].includes(field)) {`,
    `${indent}    throw new FtsError(`,
    `${indent}      "FTS_UTILITY_INPUT_FIELD",`,
    `${indent}      \`входная структура «${shape.structure}» не содержит поле «\${field}»\`,`,
    `${indent}    )`,
    `${indent}  }`,
    `${indent}}`,
  )
  return lines
}

/** The emitted twin of `matchesRuntimeType`; `undefined` where it checks nothing. */
function runtimeTypeTest(access: string, type: string): string | undefined {
  switch (typescriptType(type).replace(" | undefined", "")) {
    case "string":
      return `typeof ${access} === "string"`
    case "number":
      return `typeof ${access} === "number" && Number.isFinite(${access}) && !Object.is(${access}, -0)`
    case "boolean":
      return `typeof ${access} === "boolean"`
    default:
      return undefined
  }
}

function renderImplementation(utilities: FtsUtility[], structures: Map<string, FtsStructure>): string {
  const shapes = utilities.map((utility) => inputShape(utility, structures))
  const body: string[] = []
  const used = new Set<string>()

  body.push("export const ftsUtilities = {")
  utilities.forEach((utility, index) => {
    const shape = shapes[index]!
    const output = typescriptType(utility.output)
    body.push(`  ${JSON.stringify(utility.name)}: (input: FtsInput${index}): ${output} => {`)
    if (shape.structure === undefined) {
      /* The core refuses before evaluating anything when the input structure is
         not declared, and so must this: without the structure there is nothing
         to check the input against. */
      body.push(
        `    throw new FtsError("FTS_UTILITY_INPUT", ${JSON.stringify(`не найдена входная структура «${utility.input}»`)})`,
        "  },",
      )
      return
    }
    /* Through `unknown` rather than straight across: `FtsInput0` is an interface
       with no index signature, and a direct cast to `Record<string, unknown>` is
       TS2352 under strict. The cast is needed at all because the types state a
       CONTRACT while the input check exists for callers who did not keep it — a
       JavaScript caller, parsed JSON, somebody else's HTTP. */
    body.push("    const data = input as unknown as Record<string, unknown>")
    body.push(...renderInputCheck(shape, "    "))
    body.push(`    let result: ${output} = ${renderScalar(utility.initial)}`)
    for (const rule of utility.rules) {
      const condition =
        rule.when.map((item) => renderCondition(item.field, item.operator, item.value, shape, utility.output)).join(" && ") || "true"
      body.push(`    if (${condition}) {`)
      const operand = renderOperand(rule.action.value, shape, utility.output)
      if (rule.action.kind === "set") {
        body.push(`      result = ${operand} as ${output}`)
      } else if (staticallyNumeric(rule.action.value, shape, utility.output) && output === "number") {
        body.push(`      result += ${operand}`)
      } else {
        /* `add` over anything but two numbers is `FTS_UTILITY_ADD_TYPE` in the
           core, and `+` in JavaScript is string concatenation instead. */
        body.push(`      result = ftsAdd(result, ${operand}, ${JSON.stringify(rule.name)}) as ${output}`)
        used.add("ftsAdd")
      }
      body.push("    }")
    }
    for (const property of utility.properties) {
      const comparison = renderComparison(
        "result",
        property.operator,
        renderOperand(property.value, shape, utility.output),
        {
          numeric: output === "number" && staticallyNumeric(property.value, shape, utility.output),
          exact:
            staticallyExact({ kind: "result" }, shape, utility.output) &&
            staticallyExact(property.value, shape, utility.output),
        },
      )
      body.push(
        `    if (!(${comparison})) {`,
        `      throw new FtsError(`,
        `        "FTS_UTILITY_PROPERTY",`,
        `        ${JSON.stringify(`нарушено свойство «${property.name}» утилиты «${utility.name}»`)},`,
        `      )`,
        `    }`,
      )
    }
    body.push("    return result", "  },")
  })
  body.push("} as const", "")

  const emitted = body.join("\n")
  for (const helper of Object.keys(RUNTIME_HELPERS)) {
    if (new RegExp(`\\b${helper}\\(`, "u").test(emitted)) used.add(helper)
  }
  /* `ftsPercent` reads its field through `ftsField`, so asking for it asks for
     `ftsField` too — even when no operand names a field directly. */
  if (used.has("ftsPercent")) used.add("ftsField")

  const lines = ["// Generated by FTS. Do not edit by hand.", "", ...RUNTIME_PRELUDE]
  for (const [helper, text] of Object.entries(RUNTIME_HELPERS)) {
    if (used.has(helper)) lines.push(...text)
  }
  utilities.forEach((utility, index) => {
    const structure = structures.get(utility.input)
    lines.push(`export interface FtsInput${index} {`)
    for (const field of structure?.fields ?? []) {
      const optional = field.type.includes("undefined") ? "?" : ""
      lines.push(`  ${JSON.stringify(field.name)}${optional}: ${typescriptType(field.type)}`)
    }
    lines.push("}", "")
  })
  lines.push(emitted)
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

/**
 * What the generated file knows about one utility's input.
 *
 * The generator needs two things per field, and both decide emitted code rather
 * than decorate it: the declared type says whether a plain `>=` is already the
 * core's `compare` (it is, once the field has been checked to be a finite
 * number), and `optional` says whether reading the field may itself refuse
 * (`resolveField` throws `FTS_UTILITY_INPUT` for an absent field, and the input
 * check deliberately lets optional ones through).
 */
interface InputShape {
  /** Structure name, needed verbatim by the `FTS_UTILITY_INPUT_FIELD` text. */
  readonly structure: string | undefined
  readonly fields: Map<string, { readonly type: string; readonly optional: boolean }>
}

function inputShape(utility: FtsUtility, structures: Map<string, FtsStructure>): InputShape {
  const structure = structures.get(utility.input)
  return {
    structure: structure?.name,
    fields: new Map(
      (structure?.fields ?? []).map((field) => [
        field.name,
        { type: field.type, optional: field.type.includes("undefined") },
      ]),
    ),
  }
}

/**
 * `true` when `===` on this operand is `Object.is` on it.
 *
 * They part on `NaN` and on `-0` and nowhere else. A field whose declared type
 * the generator maps to a scalar has been checked — the numeric check rejects
 * both of those values outright — and a literal written in the model cannot be
 * either. What is left is a field whose declared type is a phrase (`unknown`),
 * which the core checks not at all: there `NaN` really can arrive, and there the
 * cheap operator would answer where the core answers otherwise.
 */
function staticallyExact(operand: FtsUtilityOperand, shape: InputShape, output: string): boolean {
  switch (operand.kind) {
    case "value":
      return true
    case "percent":
      return true
    case "result":
      return typescriptType(output).replace(" | undefined", "") !== "unknown"
    case "field": {
      const field = shape.fields.get(operand.field)
      return field !== undefined && typescriptType(field.type).replace(" | undefined", "") !== "unknown"
    }
  }
}

/** `true` when the emitted expression cannot be anything but a finite number. */
function staticallyNumeric(operand: FtsUtilityOperand, shape: InputShape, output: string): boolean {
  switch (operand.kind) {
    case "value":
      return typeof operand.value === "number"
    case "result":
      return typescriptType(output) === "number"
    case "field":
    case "percent": {
      const field = shape.fields.get(operand.field)
      return field !== undefined && !field.optional && typescriptType(field.type) === "number"
    }
  }
}

/**
 * Read a field.
 *
 * A required field has already been checked for presence and type by the input
 * check, so `input["…"]` IS what the core returns — the helper would only add
 * noise to the code someone is going to read. An optional one has not: absent,
 * the core refuses with `FTS_UTILITY_INPUT` at the moment of reading, and only
 * `ftsField` reproduces that.
 */
function renderField(field: string, shape: InputShape): string {
  const known = shape.fields.get(field)
  if (known !== undefined && !known.optional) return `input[${JSON.stringify(field)}]`
  return `ftsField(data, ${JSON.stringify(field)})`
}

function renderCondition(
  field: string,
  operator: FtsUtilityComparison,
  operand: FtsUtilityOperand,
  shape: InputShape,
  output: string,
): string {
  const left: FtsUtilityOperand = { kind: "field", field }
  return renderComparison(renderField(field, shape), operator, renderOperand(operand, shape, output), {
    numeric: staticallyNumeric(left, shape, output) && staticallyNumeric(operand, shape, output),
    exact: staticallyExact(left, shape, output) && staticallyExact(operand, shape, output),
  })
}

/**
 * Render one comparison with the core's meaning, not JavaScript's.
 *
 * Two places where the obvious operator is the wrong one:
 *
 * `eq`/`neq` are `Object.is` in the core, and `===` differs from it on `NaN`
 * and on `-0`. For a checked numeric field the two agree (the check rejects
 * both), but a field whose declared type is a phrase the generator does not map
 * is `unknown`, and the core checks nothing there — so `NaN` reaches the
 * comparison and the two answers part. `Object.is` costs a word and is right
 * everywhere.
 *
 * Order comparisons over anything but two numbers are a refusal in the core
 * (`FTS_UTILITY_COMPARE_TYPE`), while JavaScript happily compares a string to a
 * number and answers. Where both sides are known to be numbers the plain
 * operator IS the core; where they are not, `ftsOrder` refuses as the core does.
 */
function renderComparison(
  left: string,
  operator: FtsUtilityComparison,
  right: string,
  { numeric, exact }: { numeric: boolean; exact: boolean },
): string {
  if (operator === "eq") return exact ? `${left} === ${right}` : `Object.is(${left}, ${right})`
  if (operator === "neq") return exact ? `${left} !== ${right}` : `!Object.is(${left}, ${right})`
  if (!numeric) return `ftsOrder(${left}, ${JSON.stringify(operator)}, ${right})`
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

function renderOperand(operand: FtsUtilityOperand, shape: InputShape, output: string): string {
  if (operand.kind === "value") return renderScalar(operand.value)
  if (operand.kind === "result") return "result"
  if (operand.kind === "field") return renderField(operand.field, shape)
  /* Percent of a checked numeric field is plain arithmetic and identical to the
     core; percent of anything else is `FTS_UTILITY_PERCENT_TYPE` there, so it
     has to go through the helper that raises it. */
  if (staticallyNumeric(operand, shape, output)) {
    return `(${operand.percent} / 100) * input[${JSON.stringify(operand.field)}]`
  }
  return `ftsPercent(data, ${JSON.stringify(operand.field)}, ${operand.percent})`
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
