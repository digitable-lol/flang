import type { SourceSpan } from "./model.js"

/**
 * Source positions of document nodes, kept beside the document instead of
 * inside it.
 *
 * Canonical JSON and `schema/document.schema.json` are compatibility surfaces:
 * a utility, a rule and a property declare exactly their own fields
 * (`additionalProperties: false`), and the document digest is computed from
 * that same JSON. Storing a `span` field on the nodes would change both. A
 * weak table keyed by the node itself changes neither: positions exist for
 * documents parsed from source text and are absent for documents that arrived
 * as JSON — which is exactly where they can and cannot exist.
 */
const positions = new WeakMap<object, SourceSpan>()

/** Remember where `node` was written, and return the node unchanged. */
export function withSpan<T extends object>(node: T, span: SourceSpan): T {
  positions.set(node, span)
  return node
}

/** Where `node` was written, if it came from source text. */
export function spanOf(node: unknown): SourceSpan | undefined {
  if (typeof node !== "object" || node === null) return undefined
  return positions.get(node)
}
