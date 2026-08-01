import type { FtsDocument, FtsProof, FtsVisualization, VisualizationMode } from "./model.js"

export function visualize(
  document: FtsDocument,
  proof: FtsProof | null = null,
  mode: VisualizationMode = "all",
): FtsVisualization {
  const mermaid_category = mermaidCategory(document)
  const mermaid_functors = mermaidFunctors(document)
  const mermaid_proof = proof === null ? null : mermaidProof(proof)
  const available = [mermaid_category, mermaid_functors, mermaid_proof].filter((item): item is string => Boolean(item))
  const selected =
    mode === "category"
      ? mermaid_category
      : mode === "functors"
        ? mermaid_functors || mermaid_category
        : mode === "proof"
          ? mermaid_proof ?? mermaid_category
          : available.join("\n\n")
  return { mermaid: selected, mermaid_category, mermaid_functors, mermaid_proof }
}

export function mermaidCategory(document: FtsDocument): string {
  const lines = ["flowchart LR", `  subgraph CAT["category: ${escapeMermaid(document.category)}"]`]
  const ids = new Map<string, string>()
  for (const structure of document.structures) {
    const id = nodeId(structure.name)
    ids.set(structure.name, id)
    const fields = structure.fields.map((field) => `${field.name}: ${field.type}`).join("<br/>")
    lines.push(`    ${id}["structure ${escapeMermaid(structure.name)}<br/><small>${escapeMermaid(fields)}</small>"]`)
  }
  for (const functor of document.functors) {
    const from = ensureNode(functor.domain, ids, lines)
    const to = ensureNode(functor.codomain, ids, lines)
    lines.push(`    ${from} -->|"functor ${escapeMermaid(functor.name)}"| ${to}`)
  }
  lines.push("  end")
  return lines.join("\n")
}

export function mermaidFunctors(document: FtsDocument): string {
  if (document.functors.length === 0) return ""
  const lines = ["flowchart TB", "  subgraph FUNCTORS[\"functors\"]"]
  document.functors.forEach((functor, index) => {
    lines.push(`    f${index}a["${escapeMermaid(functor.domain)}"]`)
    lines.push(`    f${index}b["${escapeMermaid(functor.codomain)}"]`)
    lines.push(`    f${index}a -->|"${escapeMermaid(functor.name)}"| f${index}b`)
  })
  lines.push("  end")
  return lines.join("\n")
}

export function mermaidProof(proof: FtsProof): string {
  if (proof.morphisms.length === 0) return "flowchart LR\n  empty[\"(no morphisms)\"]"
  const lines = ["flowchart LR"]
  proof.morphisms.forEach((morphism, index) => lines.push(`  m${index}["${escapeMermaid(morphism)}"]`))
  for (let index = 0; index < proof.morphisms.length - 1; index += 1) lines.push(`  m${index} --> m${index + 1}`)
  lines.push(`  W["witness: ${escapeMermaid(proof.curry_howard.witness)}"]`)
  lines.push(`  m${proof.morphisms.length - 1} -.-> W`)
  return lines.join("\n")
}

function ensureNode(name: string, ids: Map<string, string>, lines: string[]): string {
  const existing = ids.get(name)
  if (existing !== undefined) return existing
  const id = nodeId(name)
  ids.set(name, id)
  lines.push(`    ${id}["${escapeMermaid(name)}"]`)
  return id
}

function nodeId(name: string): string {
  const encoded = Array.from(name, (character) =>
    /[A-Za-z0-9_]/.test(character) ? character : `u${character.codePointAt(0)!.toString(16)}_`,
  ).join("")
  return `n_${encoded}`
}

function escapeMermaid(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "'")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/[\r\n]+/g, " ")
}
