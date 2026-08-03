/**
 * `textDocument/documentSymbol` — дерево модели для навигации по файлу.
 *
 * Категория → объекты → поля, утилиты → правила, свойства, примеры,
 * морфизмы и теорема. Это тот же порядок, в котором документ читает
 * человек, и тот же, в котором его строит ядро.
 */

const Kind = {
  namespace: 3,
  class: 5,
  method: 6,
  property: 7,
  field: 8,
  interface: 11,
  function: 12,
  constant: 14,
  struct: 23,
  event: 24,
}

/** @param {{ outline: any }} analysis */
export function documentSymbols(analysis) {
  const { outline } = analysis
  if (outline.surface !== "natural" || !outline.category) return []
  return [
    {
      name: outline.category.name || "категория",
      detail: "категория",
      kind: Kind.namespace,
      range: outline.category.range,
      selectionRange: outline.category.nameRange,
      children: outline.category.children.map(symbol).filter(Boolean),
    },
  ]
}

function symbol(node) {
  switch (node.kind) {
    case "object":
      return make(node, Kind.struct, `объект · ${node.fields.length} полей`, node.fields.map((field) =>
        make(field, Kind.field, field.type, []),
      ))
    case "utility":
      return make(
        node,
        Kind.function,
        `${node.input ?? "?"} → ${node.output ?? "?"}`,
        node.children.map((child) => {
          if (child.kind === "rule") return make(child, Kind.method, `правило · ${child.conditions.length} условий`, [])
          if (child.kind === "property") return make(child, Kind.property, "свойство", [])
          if (child.kind === "example") return make(child, Kind.constant, `пример · ожидается ${child.expectedNode?.operand ?? "?"}`, [])
          return null
        }).filter(Boolean),
      )
    case "morphism":
      return make(node, Kind.interface, `${node.domain ?? "?"} → ${node.codomain ?? "?"}`, [])
    case "theorem":
      return make(node, Kind.event, node.conclusion ? `следовательно ${node.conclusion}` : "теорема", [])
    default:
      return null
  }
}

function make(node, kind, detail, children) {
  return {
    name: node.name || node.kind,
    detail,
    kind,
    range: node.range,
    selectionRange: inside(node.nameRange, node.range) ? node.nameRange : node.range,
    children,
  }
}

function inside(inner, outer) {
  if (!inner || !outer) return false
  if (inner.start.line < outer.start.line || inner.end.line > outer.end.line) return false
  return true
}
