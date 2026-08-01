import type { Diagnostic } from "./diagnostics.js"
import { FtsError } from "./diagnostics.js"
import type { FtsDocument, FtsProposition } from "./model.js"
import { normalizeDocument } from "./parser.js"
import { builtinFunctors } from "./stdlib.js"

export interface ValidationResult {
  valid: boolean
  document: FtsDocument
  diagnostics: Diagnostic[]
}

export function validate(input: unknown): ValidationResult {
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

  return { valid: diagnostics.length === 0, document, diagnostics }
}

export function assertValid(input: unknown): FtsDocument {
  const result = validate(input)
  if (!result.valid) throw new FtsError("invalid FTS document", result.diagnostics)
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
