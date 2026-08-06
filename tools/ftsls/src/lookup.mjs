/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Поиск по разметке: имя под курсором, окружающий блок, таблицы имён.
 *
 * Разделено с `outline.mjs` намеренно: там — построение дерева, здесь —
 * вопросы, которые задают возможности редактора.
 */
import { PHRASES, matchPhrase, readName } from "./outline.mjs"

const TOKEN_PATTERN = new RegExp(
  "«[^»]*»|\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|[\\p{ID_Start}_$][\\p{ID_Continue}$\\u200C\\u200D-]*|-?\\d+(?:\\.\\d+)?",
  "gu",
)

/**
 * Имя под курсором вместе с его диапазоном. Кавычки и «ёлочки» считаются
 * частью одного имени: `«постоянный клиент»` — это одно слово языка.
 *
 * @param {any} outline
 * @param {{ line: number, character: number }} position
 */
export function tokenAt(outline, position) {
  const line = outline.lines[position.line]
  if (!line || line.text.length === 0) return null
  const index = position.character - line.startChar
  if (index < 0 || index > line.text.length) return null
  TOKEN_PATTERN.lastIndex = 0
  for (let match = TOKEN_PATTERN.exec(line.text); match; match = TOKEN_PATTERN.exec(line.text)) {
    const start = match.index
    const end = start + match[0].length
    if (index < start || index > end) continue
    const quoted = /^[«"']/u.test(match[0])
    return {
      value: (quoted ? match[0].slice(1, -1) : match[0]).normalize("NFC"),
      quoted,
      range: {
        start: { line: line.number, character: line.startChar + start },
        end: { line: line.number, character: line.startChar + end },
      },
    }
  }
  return null
}

/** Узел разметки, начинающийся на этой строке (самый вложенный). */
export function nodeAtLine(outline, line, kinds) {
  const nodes = outline.byLine.get(line) ?? []
  const filtered = kinds ? nodes.filter((node) => kinds.includes(node.kind)) : nodes
  return filtered[0] ?? null
}

/** Блок (утилита, объект, морфизм, теорема), внутрь которого попадает строка. */
export function blockAt(outline, line) {
  const kinds = ["utility", "object", "morphism", "theorem"]
  let found = null
  for (const node of outline.category?.children ?? []) {
    if (!kinds.includes(node.kind)) continue
    if (node.range.start.line <= line && line <= node.range.end.line) found = node
  }
  return found
}

export function objectByName(outline, name) {
  return outline.objects.find((node) => node.name === name) ?? null
}

export function utilityByName(outline, name) {
  return outline.utilities.find((node) => node.name === name) ?? null
}

export function morphismByName(outline, name) {
  return outline.morphisms.find((node) => node.name === name) ?? null
}

/** Поля объекта, который принимает утилита в этой строке. */
export function inputFields(outline, line) {
  const block = blockAt(outline, line)
  if (!block || block.kind !== "utility" || !block.input) return []
  return objectByName(outline, block.input)?.fields ?? []
}

/** Имена состояний: объявленные полями и упомянутые морфизмами. */
export function states(outline) {
  const names = new Map()
  for (const object of outline.objects) {
    for (const field of object.fields) {
      if (field.state) names.set(field.state, { source: field, kind: "field" })
    }
  }
  for (const morphism of outline.morphisms) {
    for (const name of [morphism.domain, morphism.codomain]) {
      if (name && !names.has(name)) names.set(name, { source: morphism, kind: "morphism" })
    }
  }
  return names
}

/** Предки строки: заголовки блоков с меньшим отступом, снаружи внутрь. */
export function ancestors(outline, line, indent) {
  const result = []
  let need = indent
  for (let index = line - 1; index >= 0; index -= 1) {
    const item = outline.lines[index]
    if (!item || item.text.length === 0) continue
    if (item.indent < need) {
      result.unshift(item)
      need = item.indent
    }
  }
  return result
}

/** Вид блока по строке-заголовку. */
export function blockKind(line) {
  if (!line) return null
  if (matchPhrase(line.text, PHRASES.category)) return "category"
  if (matchPhrase(line.text, PHRASES.object)) return "object"
  if (matchPhrase(line.text, PHRASES.morphism)) return "morphism"
  if (matchPhrase(line.text, PHRASES.theorem)) return "theorem"
  if (matchPhrase(line.text, PHRASES.utility)) return "utility"
  if (matchPhrase(line.text, PHRASES.rule)) return "rule"
  if (matchPhrase(line.text, PHRASES.property)) return "property"
  if (matchPhrase(line.text, PHRASES.example)) return "example"
  return null
}

/** Имя объявлено полностью и за ним стоит пробел? */
export function nameComplete(text) {
  const name = readName(text)
  if (!name) return false
  return name.end < text.length && /\s/u.test(text[name.end])
}

/** Запись имени на поверхности: с пробелами — в кавычках. */
export function quoteName(name, language) {
  if (/^[\p{ID_Start}_$][\p{ID_Continue}$-]*$/u.test(name)) return name
  return language === "en" ? `"${name}"` : `«${name}»`
}
