/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
import { analyzeCoverage } from "./coverage.js"
import type { Diagnostic } from "./diagnostics.js"
import { FtsError } from "./diagnostics.js"
import type { FtsDocument, FtsFunctor, FtsProposition, FtsScalar, FtsStructure, FtsUtilityOperand } from "./model.js"
import { normalizeDocument } from "./parser.js"
import { spanOf } from "./spans.js"
import { builtinFunctors } from "./stdlib.js"

export interface ValidationResult {
  valid: boolean
  document: FtsDocument
  diagnostics: Diagnostic[]
}

export interface ValidateOptions {
  /**
   * Analyse the input space of the utilities: holes in rule coverage,
   * order-dependent overlaps, properties whose limit is never reached. On by
   * default — a check that stays silent unless asked does not get read.
   */
  coverage?: boolean
}

export function validate(input: unknown, options: ValidateOptions = {}): ValidationResult {
  const document = normalizeDocument(input)
  const diagnostics: Diagnostic[] = []
  const report = (code: string, message: string, path: string): void => {
    diagnostics.push({ code, message, path, severity: "error" })
  }

  if (!isName(document.category)) {
    report("FTS_CATEGORY_NAME", "category must have a non-empty normalized name", "$.category")
  }

  const structures = new Set<string>()
  document.structures.forEach((structure, structureIndex) => {
    const path = `$.structures[${structureIndex}]`
    if (!structure || typeof structure !== "object" || !isName(structure.name)) {
      report("FTS_STRUCTURE_NAME", "structure requires a valid name", `${path}.name`)
      return
    }
    if (structures.has(structure.name)) report("FTS_DUPLICATE_STRUCTURE", `duplicate structure '${structure.name}'`, `${path}.name`)
    structures.add(structure.name)
    if (!Array.isArray(structure.fields)) {
      report("FTS_STRUCTURE_FIELDS", `structure '${structure.name}' requires a fields array`, `${path}.fields`)
      return
    }
    const fields = new Set<string>()
    structure.fields.forEach((field, fieldIndex) => {
      const fieldPath = `${path}.fields[${fieldIndex}]`
      if (!field || typeof field !== "object" || !isName(field.name)) {
        report("FTS_FIELD_NAME", "field requires a valid name", `${fieldPath}.name`)
        return
      }
      if (fields.has(field.name)) report("FTS_DUPLICATE_FIELD", `duplicate field '${structure.name}.${field.name}'`, `${fieldPath}.name`)
      fields.add(field.name)
      if (typeof field.type !== "string" || field.type.trim() === "") {
        report("FTS_FIELD_TYPE", `field '${structure.name}.${field.name}' requires a type`, `${fieldPath}.type`)
      }
    })
  })

  const functors = new Set(builtinFunctors.map((functor) => functor.name))
  document.functors.forEach((functor, functorIndex) => {
    const path = `$.functors[${functorIndex}]`
    if (!functor || typeof functor !== "object" || !isName(functor.name)) {
      report("FTS_FUNCTOR_NAME", "functor requires a valid name", `${path}.name`)
      return
    }
    if (functors.has(functor.name)) report("FTS_DUPLICATE_FUNCTOR", `duplicate functor '${functor.name}'`, `${path}.name`)
    functors.add(functor.name)
    if (typeof functor.domain !== "string" || functor.domain.trim() === "") {
      report("FTS_FUNCTOR_DOMAIN", `functor '${functor.name}' requires a domain`, `${path}.domain`)
    }
    if (typeof functor.codomain !== "string" || functor.codomain.trim() === "") {
      report("FTS_FUNCTOR_CODOMAIN", `functor '${functor.name}' requires a codomain`, `${path}.codomain`)
    }
  })

  if (document.proposition !== null) {
    validateProposition(document.proposition, "$.proposition", structures, functors, document, report)
  }

  validateUtilities(document, structures, report)

  /* Only `error` decides validity: everything below is advisory and must never
     turn a well-formed document into a rejected one. */
  const valid = !diagnostics.some((diagnostic) => diagnostic.severity === "error")
  if (valid) {
    validateComposition(document, diagnostics)
    if (options.coverage !== false) diagnostics.push(...analyzeCoverage(document))
  }

  return { valid, document, diagnostics }
}

/**
 * Does the chain of morphisms compose?
 *
 * `certify` walks exactly this chain and refuses when a morphism receives a
 * type other than its domain (`FTS_PROOF_TYPE_MISMATCH`), and the indented
 * surface refuses at parse time. A document written as canonical JSON or in
 * the braced surface had nobody to tell it — `check` passed and only `certify`
 * later failed. Now the mismatch is named where the model is read, with the
 * position of the proposition that carries it.
 */
function validateComposition(document: FtsDocument, diagnostics: Diagnostic[]): void {
  const proposition = document.proposition
  if (proposition === null) return
  const functors = [...document.functors, ...builtinFunctors]

  const report = (message: string, hint: string): void => {
    const span = spanOf(proposition)
    diagnostics.push({
      code: "FTS_COMPOSE_MISMATCH",
      message,
      severity: "warning",
      path: "$.proposition",
      hint,
      ...(span === undefined ? {} : { span }),
    })
  }

  const step = (name: string, incoming: string | null): string | null => {
    const functor = functors.find((item) => item.name === name)
    if (!functor) return null
    if (incoming !== null && functor.domain !== "*" && incoming !== functor.domain) {
      report(
        `morphism '${name}' expects '${functor.domain}', receives '${incoming}'`,
        `insert a morphism from '${incoming}' to '${functor.domain}', or declare '${name}' over '${incoming}'` +
          ` — otherwise certify rejects this document with FTS_PROOF_TYPE_MISMATCH`,
      )
      return null
    }
    return functor.codomain
  }

  const walk = (node: FtsProposition): string | null => {
    if (node.kind === "witness") {
      const structure = document.structures.find((item) => item.name === node.structure)
      return structure?.fields.find((item) => item.name === node.field)?.type ?? null
    }
    if (node.kind === "apply") return step(node.functor, walk(node.arg))
    return (node.functors ?? []).reduce<string | null>((incoming, name) => step(name, incoming), walk(node.arg))
  }

  walk(proposition)
}

function validateUtilities(
  document: FtsDocument,
  structures: Set<string>,
  report: (code: string, message: string, path: string) => void,
): void {
  const names = new Set<string>()
  for (const [utilityIndex, utility] of (document.utilities ?? []).entries()) {
    const path = `$.utilities[${utilityIndex}]`
    if (!isName(utility?.name)) {
      report("FTS_UTILITY_NAME", "utility requires a valid name", `${path}.name`)
      continue
    }
    if (names.has(utility.name)) report("FTS_DUPLICATE_UTILITY", `duplicate utility '${utility.name}'`, `${path}.name`)
    names.add(utility.name)
    if (!isName(utility.input) || !structures.has(utility.input)) {
      report("FTS_UTILITY_INPUT", `utility '${utility.name}' references unknown input structure '${utility.input}'`, `${path}.input`)
    }
    if (!isName(utility.output)) report("FTS_UTILITY_OUTPUT", `utility '${utility.name}' requires an output type`, `${path}.output`)
    if (!isScalar(utility.initial) || !scalarMatchesType(utility.initial, utility.output)) {
      report("FTS_UTILITY_INITIAL_TYPE", `utility '${utility.name}' initial value does not match '${utility.output}'`, `${path}.initial`)
    }
    const structure = document.structures.find((item) => item.name === utility.input)
    const fields = new Map((structure?.fields ?? []).map((field) => [field.name, field.type]))

    for (const [ruleIndex, rule] of (utility.rules ?? []).entries()) {
      const rulePath = `${path}.rules[${ruleIndex}]`
      if (!isName(rule.name)) report("FTS_UTILITY_RULE_NAME", "utility rule requires a name", `${rulePath}.name`)
      if (!Array.isArray(rule.when) || rule.when.length === 0) {
        report("FTS_UTILITY_RULE_CONDITION", `rule '${rule.name}' requires conditions`, `${rulePath}.when`)
      } else {
        rule.when.forEach((condition, conditionIndex) => {
          const conditionPath = `${rulePath}.when[${conditionIndex}]`
          const fieldType = fields.get(condition.field)
          if (!isComparison(condition.operator)) report("FTS_UTILITY_COMPARISON", `unknown comparison '${String(condition.operator)}'`, `${conditionPath}.operator`)
          if (!fieldType) report("FTS_UTILITY_FIELD", `unknown utility input field '${condition.field}'`, `${conditionPath}.field`)
          validateOperand(condition.value, fields, `${conditionPath}.value`, report)
          if (["gte", "lte", "gt", "lt"].includes(condition.operator) && fieldType && !isNumericType(fieldType)) {
            report("FTS_UTILITY_COMPARE_TYPE", `field '${condition.field}' is not numeric`, conditionPath)
          }
          const leftKind = fieldType ? typeKind(fieldType) : "unknown"
          const rightKind = operandKind(condition.value, fields, utility.output)
          if (leftKind !== "unknown" && rightKind !== "unknown" && leftKind !== rightKind) {
            report("FTS_UTILITY_COMPARE_TYPE", `comparison for '${condition.field}' uses incompatible values`, conditionPath)
          }
        })
      }
      if (!rule.action || (rule.action.kind !== "set" && rule.action.kind !== "add")) {
        report("FTS_UTILITY_ACTION", `rule '${rule.name}' requires a set or add action`, `${rulePath}.action`)
      } else {
        validateOperand(rule.action.value, fields, `${rulePath}.action.value`, report)
        if (rule.action.kind === "add" && !isNumericType(utility.output)) {
          report("FTS_UTILITY_ADD_TYPE", `rule '${rule.name}' can add only to a numeric output`, `${rulePath}.action`)
        }
        const actionKind = operandKind(rule.action.value, fields, utility.output)
        const outputKind = typeKind(utility.output)
        if (rule.action.kind === "add" && actionKind !== "number" && actionKind !== "unknown") {
          report("FTS_UTILITY_ADD_TYPE", `rule '${rule.name}' can add only a numeric value`, `${rulePath}.action.value`)
        }
        if (rule.action.kind === "set" && outputKind !== "unknown" && actionKind !== "unknown" && outputKind !== actionKind) {
          report("FTS_UTILITY_ACTION_TYPE", `rule '${rule.name}' result does not match '${utility.output}'`, `${rulePath}.action.value`)
        }
      }
    }

    for (const [propertyIndex, property] of (utility.properties ?? []).entries()) {
      const propertyPath = `${path}.properties[${propertyIndex}]`
      if (!isName(property.name)) report("FTS_UTILITY_PROPERTY_NAME", "utility property requires a name", `${propertyPath}.name`)
      if (!isComparison(property.operator)) report("FTS_UTILITY_COMPARISON", `unknown comparison '${String(property.operator)}'`, `${propertyPath}.operator`)
      validateOperand(property.value, fields, `${propertyPath}.value`, report)
      if (["gte", "lte", "gt", "lt"].includes(property.operator) && !isNumericType(utility.output)) {
        report("FTS_UTILITY_PROPERTY_TYPE", `property '${property.name}' requires a numeric output`, propertyPath)
      }
      const propertyKind = operandKind(property.value, fields, utility.output)
      const outputKind = typeKind(utility.output)
      if (propertyKind !== "unknown" && outputKind !== "unknown" && propertyKind !== outputKind) {
        report("FTS_UTILITY_PROPERTY_TYPE", `property '${property.name}' compares incompatible values`, propertyPath)
      }
    }

    for (const [exampleIndex, example] of (utility.examples ?? []).entries()) {
      const examplePath = `${path}.examples[${exampleIndex}]`
      if (!isName(example.name)) report("FTS_UTILITY_EXAMPLE_NAME", "utility example requires a name", `${examplePath}.name`)
      for (const [fieldName, value] of Object.entries(example.input ?? {})) {
        const fieldType = fields.get(fieldName)
        if (!fieldType) report("FTS_UTILITY_FIELD", `unknown example field '${fieldName}'`, `${examplePath}.input.${fieldName}`)
        else if (!isScalar(value) || !scalarMatchesType(value, fieldType)) {
          report("FTS_UTILITY_EXAMPLE_TYPE", `example field '${fieldName}' does not match '${fieldType}'`, `${examplePath}.input.${fieldName}`)
        }
      }
      for (const field of requiredFields(structure)) {
        if (!(field.name in (example.input ?? {}))) {
          report("FTS_UTILITY_EXAMPLE_FIELD", `example '${example.name}' misses '${field.name}'`, `${examplePath}.input`)
        }
      }
      if (!isScalar(example.expected) || !scalarMatchesType(example.expected, utility.output)) {
        report("FTS_UTILITY_EXPECTED_TYPE", `example '${example.name}' result does not match '${utility.output}'`, `${examplePath}.expected`)
      }
    }
  }
}

function validateOperand(
  operand: FtsUtilityOperand,
  fields: Map<string, string>,
  path: string,
  report: (code: string, message: string, path: string) => void,
): void {
  if (!operand || typeof operand !== "object") {
    report("FTS_UTILITY_OPERAND", "utility operand must be an object", path)
    return
  }
  if (operand.kind === "field" || operand.kind === "percent") {
    const type = fields.get(operand.field)
    if (!type) report("FTS_UTILITY_FIELD", `unknown utility input field '${operand.field}'`, `${path}.field`)
    if (operand.kind === "percent" && type && !isNumericType(type)) {
      report("FTS_UTILITY_PERCENT_TYPE", `percentage field '${operand.field}' is not numeric`, path)
    }
    if (operand.kind === "percent" && (!Number.isFinite(operand.percent) || Object.is(operand.percent, -0))) {
      report("FTS_UTILITY_PERCENT", "percentage must be a finite canonical number", `${path}.percent`)
    }
  } else if (operand.kind === "value") {
    if (!isScalar(operand.value)) report("FTS_UTILITY_VALUE", "utility literal must be scalar", `${path}.value`)
  } else if (operand.kind !== "result") {
    report("FTS_UTILITY_OPERAND", `unknown utility operand '${String((operand as { kind?: unknown }).kind)}'`, `${path}.kind`)
  }
}

function requiredFields(structure: FtsStructure | undefined): FtsStructure["fields"] {
  return (structure?.fields ?? []).filter((field) => !field.type.includes("undefined"))
}

function isNumericType(type: string): boolean {
  const normalized = type.replace(/\s*\|\s*undefined/gu, "")
  return normalized === "Число" || normalized === "Деньги" || normalized === "number"
}

function typeKind(type: string): "number" | "string" | "boolean" | "unknown" {
  const normalized = type.replace(/\s*\|\s*undefined/gu, "")
  if (normalized === "Число" || normalized === "Деньги" || normalized === "number") return "number"
  if (normalized === "Строка" || normalized === "Дата" || normalized === "string") return "string"
  if (normalized === "Признак" || normalized === "boolean") return "boolean"
  return "unknown"
}

function operandKind(
  operand: FtsUtilityOperand,
  fields: Map<string, string>,
  output: string,
): "number" | "string" | "boolean" | "unknown" {
  if (!operand || typeof operand !== "object") return "unknown"
  if (operand.kind === "percent") return "number"
  if (operand.kind === "field") return typeKind(fields.get(operand.field) ?? "")
  if (operand.kind === "result") return typeKind(output)
  if (operand.kind === "value") {
    if (typeof operand.value === "number") return "number"
    if (typeof operand.value === "string") return "string"
    if (typeof operand.value === "boolean") return "boolean"
  }
  return "unknown"
}

function scalarMatchesType(value: FtsScalar, type: string): boolean {
  const normalized = type.replace(/\s*\|\s*undefined/gu, "")
  if (normalized === "Число" || normalized === "Деньги" || normalized === "number") return typeof value === "number"
  if (normalized === "Строка" || normalized === "Дата" || normalized === "string") return typeof value === "string"
  if (normalized === "Признак" || normalized === "boolean") return typeof value === "boolean"
  return true
}

function isScalar(value: unknown): value is FtsScalar {
  return value === null || typeof value === "string" || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0))
}

function isComparison(value: unknown): boolean {
  return value === "eq" || value === "neq" || value === "gte" || value === "lte" || value === "gt" || value === "lt"
}

/**
 * The document, or an exception carrying the reasons it is not one.
 *
 * Coverage analysis is skipped here on purpose, and skipping it changes
 * nothing: it never produces an `error`, so it cannot influence the outcome —
 * while `prove`, `certify`, `generate` and `run` all pass through this
 * function and have no reason to pay for it.
 */
export function assertValid(input: unknown): FtsDocument {
  const result = validate(input, { coverage: false })
  if (!result.valid) throw new FtsError("invalid FTS document", result.diagnostics.filter((item) => item.severity === "error"))
  return result.document
}

function validateProposition(
  proposition: FtsProposition,
  path: string,
  structures: Set<string>,
  functors: Set<string>,
  document: FtsDocument,
  report: (code: string, message: string, path: string) => void,
): void {
  if (!proposition || typeof proposition !== "object") {
    report("FTS_PROPOSITION_TYPE", "proposition must be an object", path)
    return
  }

  switch (proposition.kind) {
    case "witness": {
      if (!isName(proposition.structure)) {
        report("FTS_WITNESS_STRUCTURE", "witness requires a structure", `${path}.structure`)
      } else if (!structures.has(proposition.structure)) {
        report("FTS_UNKNOWN_STRUCTURE", `unknown structure '${proposition.structure}'`, `${path}.structure`)
      }
      if (!isName(proposition.field)) {
        report("FTS_WITNESS_FIELD", "witness requires a field", `${path}.field`)
      } else {
        const structure = document.structures.find((item) => item.name === proposition.structure)
        if (structure && !structure.fields.some((field) => field.name === proposition.field)) {
          report("FTS_UNKNOWN_FIELD", `unknown field '${proposition.structure}.${proposition.field}'`, `${path}.field`)
        }
      }
      if (proposition.path !== undefined && !Array.isArray(proposition.path)) {
        report("FTS_WITNESS_PATH", "witness path must be an array", `${path}.path`)
      }
      break
    }
    case "apply":
      if (!functors.has(proposition.functor)) {
        report("FTS_UNKNOWN_FUNCTOR", `unknown functor '${proposition.functor}'`, `${path}.functor`)
      }
      validateProposition(proposition.arg, `${path}.arg`, structures, functors, document, report)
      break
    case "compose":
      if (!Array.isArray(proposition.functors) || proposition.functors.length === 0) {
        report("FTS_COMPOSE_FUNCTORS", "compose requires one or more functors", `${path}.functors`)
      } else {
        proposition.functors.forEach((functor, index) => {
          if (!functors.has(functor)) report("FTS_UNKNOWN_FUNCTOR", `unknown functor '${functor}'`, `${path}.functors[${index}]`)
        })
      }
      validateProposition(proposition.arg, `${path}.arg`, structures, functors, document, report)
      break
    default:
      report("FTS_PROPOSITION_KIND", `unknown proposition kind '${String((proposition as { kind?: unknown }).kind)}'`, `${path}.kind`)
  }
}

function isName(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return false
  if (value !== value.trim() || value !== value.normalize("NFC")) return false
  if (/\p{Cc}|\p{Cs}/u.test(value)) return false
  return true
}
