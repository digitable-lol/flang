import { diagnosticError } from "./diagnostics.js"
import type { FtsDocument, FtsProof, FtsProposition, FtsValue, PathSegment } from "./model.js"
import { assertValid } from "./validate.js"

interface EvaluatedProposition {
  path: PathSegment[]
  morphism: string
  proposition: string
  witness: string
  detail: string
  structure: string
  field: string
}

export function prove(input: FtsDocument, context?: unknown): FtsProof {
  const document = assertValid(input)
  const evaluated = document.proposition === null ? trivial() : evaluate(document, document.proposition, context)
  return bundle(document, evaluated)
}

function evaluate(document: FtsDocument, proposition: FtsProposition, context: unknown): EvaluatedProposition {
  switch (proposition.kind) {
    case "witness": {
      const path = proposition.path ?? []
      if (context !== undefined && proposition.value !== undefined && path.length > 0) {
        const resolved = resolvePath(context, path)
        if (!resolved.found || !deepEqual(resolved.value, proposition.value)) {
          throw diagnosticError(
            "FTS_WITNESS_MISMATCH",
            `witness does not match context at ${formatPath(path)}: expected ${JSON.stringify(proposition.value)}, got ${resolved.found ? JSON.stringify(resolved.value) : "<missing>"}`,
            { path: "$.proposition" },
          )
        }
      }

      return {
        path,
        morphism: `π_${proposition.field}`,
        proposition: `Π (x:${proposition.structure}). ${proposition.field}(x)`,
        witness: `λx. π_${proposition.field}(x)`,
        detail: proposition.detail ?? "",
        structure: proposition.structure,
        field: proposition.field,
      }
    }
    case "apply": {
      const inner = evaluate(document, proposition.arg, context)
      return {
        ...inner,
        morphism: `${proposition.functor} ∘ ${inner.morphism}`,
        proposition: `${proposition.functor}(${inner.proposition})`,
        witness: `${proposition.functor} (${inner.witness})`,
        detail: proposition.detail ?? `apply ${proposition.functor}`,
        field: "Type",
      }
    }
    case "compose": {
      const inner = evaluate(document, proposition.arg, context)
      const chain = proposition.functors.join(" ∘ ")
      return {
        ...inner,
        morphism: chain,
        proposition: `(${chain}) ${inner.proposition}`,
        witness: `(${chain}) ${inner.witness}`,
        detail: proposition.detail ?? `compose [${proposition.functors.join(", ")}]`,
        field: "Type",
      }
    }
  }
}

function trivial(): EvaluatedProposition {
  return {
    path: [],
    morphism: "id",
    proposition: "⊤",
    witness: "tt",
    detail: "trivial",
    structure: "Obj",
    field: "Type",
  }
}

function bundle(document: FtsDocument, proposition: EvaluatedProposition): FtsProof {
  const path = formatPath(proposition.path)
  const detail = proposition.detail.length > 0 ? ` (${proposition.detail})` : ""
  return {
    proof: `${document.category}.${proposition.structure}.${proposition.field} — ${path}${detail}`.trim(),
    curry_howard: {
      proposition: proposition.proposition,
      witness: proposition.witness,
    },
    categorical: {
      category: document.category,
      morphism: proposition.morphism,
      domain: proposition.structure,
      codomain: proposition.field,
    },
    morphisms: [document.category, proposition.structure, proposition.morphism],
    path: proposition.path,
  }
}

export function resolvePath(context: unknown, path: PathSegment[]): { found: boolean; value?: unknown } {
  let current = context
  for (const segment of path) {
    if (typeof segment === "string") {
      if (!isRecord(current) || !(segment in current)) return { found: false }
      current = current[segment]
    } else if (typeof segment === "number") {
      if (!Array.isArray(current) || segment < 0 || segment >= current.length) return { found: false }
      current = current[segment]
    } else {
      if (!Array.isArray(current)) return { found: false }
      const matches = current.filter(
        (item) => isRecord(item) && Object.entries(segment).every(([key, value]) => deepEqual(item[key], value)),
      )
      if (matches.length !== 1) return { found: false }
      current = matches[0]
    }
  }
  return { found: true, value: current }
}

function formatPath(path: PathSegment[]): string {
  if (path.length === 0) return "(symbolic)"
  return path
    .map((segment, index) => {
      if (typeof segment === "number") return `[${segment}]`
      if (typeof segment === "object") {
        const selector = Object.entries(segment).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(",")
        return `[${selector}]`
      }
      return index === 0 ? segment : `.${segment}`
    })
    .join("")
}

function deepEqual(left: unknown, right: FtsValue | unknown): boolean {
  if (Object.is(left, right)) return true
  if (typeof left !== typeof right) return false
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => deepEqual(value, right[index]))
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    return leftKeys.length === rightKeys.length && leftKeys.every((key) => key in right && deepEqual(left[key], right[key]))
  }
  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
