/**
 * `textDocument/hover` — тип поля, сигнатура утилиты, домен и кодомен морфизма.
 *
 * Статистика утилиты берётся из того же `testUtilities`, что и диагностики,
 * поэтому наведение мыши отвечает на вопрос «а этот расчёт вообще сходится?»
 * без запуска CLI.
 */
import { format } from "../analysis.mjs"
import { canonicalType } from "../outline.mjs"
import { blockAt, inputFields, morphismByName, nodeAtLine, objectByName, states, tokenAt, utilityByName } from "../lookup.mjs"

/**
 * @param {{ outline: any, tests: any }} analysis
 * @param {{ line: number, character: number }} position
 */
export function hover(analysis, position) {
  const { outline } = analysis
  if (outline.surface !== "natural") return null
  const token = tokenAt(outline, position)
  const english = outline.language === "en"
  const label = (ru, en) => (english ? en : ru)

  if (token) {
    const object = objectByName(outline, token.value)
    if (object) return markdown(objectHover(object, label), token.range)

    const utility = utilityByName(outline, token.value)
    if (utility) return markdown(utilityHover(utility, analysis, label), token.range)

    const morphism = morphismByName(outline, token.value)
    if (morphism) return markdown(morphismHover(morphism, label), token.range)

    const field = inputFields(outline, position.line).find((item) => item.name === token.value)
    if (field) return markdown(fieldHover(field, label), token.range)

    const own = blockAt(outline, position.line)
    if (own?.kind === "object") {
      const declared = own.fields.find((item) => item.name === token.value)
      if (declared) return markdown(fieldHover(declared, label), token.range)
    }

    const state = states(outline).get(token.value)
    if (state) return markdown(stateHover(token.value, outline, label), token.range)

    const builtin = canonicalType(token.value)
    if (builtin) return markdown([`**${builtin}**`, "", label("встроенный тип FTS", "built-in FTS type")], token.range)
  }

  /* Курсор не на имени — отвечаем по узлу строки. */
  const node = nodeAtLine(outline, position.line)
  if (!node) return null
  if (node.kind === "field") return markdown(fieldHover(node, label), node.lineRange)
  if (node.kind === "utility") return markdown(utilityHover(node, analysis, label), node.lineRange)
  if (node.kind === "object") return markdown(objectHover(node, label), node.lineRange)
  if (node.kind === "morphism") return markdown(morphismHover(node, label), node.lineRange)
  if (node.kind === "expected" || node.kind === "example") {
    const utility = utilityByName(outline, node.utility)
    const example = utility?.examples.find((item) => item.name === (node.example ?? node.name))
    if (example) return markdown(exampleHover(example, analysis, label), node.lineRange)
  }
  if (node.kind === "theorem") return markdown(theoremHover(node, label), node.lineRange)
  return null
}

function markdown(lines, range) {
  return { contents: { kind: "markdown", value: lines.join("\n") }, range }
}

function objectHover(node, label) {
  const lines = [`**${label("объект", "object")} «${node.name}»**`, ""]
  for (const field of node.fields) lines.push(`- \`${field.name}\`: ${field.type}`)
  if (node.fields.length === 0) lines.push(label("_полей нет_", "_no fields_"))
  return lines
}

function fieldHover(node, label) {
  return [
    `**${label("поле", "field")} \`${node.name}\`**: ${node.type}`,
    "",
    node.state
      ? label(`состояние «${node.state}»`, `state "${node.state}"`)
      : label(`объект «${node.owner}»`, `object "${node.owner}"`),
    ...(node.optional ? ["", label("значение может отсутствовать", "value may be absent")] : []),
  ]
}

function utilityHover(node, analysis, label) {
  const results = (analysis.tests?.results ?? []).filter((item) => item.utility === node.name)
  const passed = results.filter((item) => item.passed).length
  const lines = [
    `**${label("утилита", "utility")} «${node.name}»**`,
    "",
    "```fts",
    `${label("принимает", "accepts")} ${node.input ?? "?"}`,
    `${label("возвращает", "returns")} ${node.output ?? "?"}`,
    `${label("начинает с", "starts with")} ${node.initial ?? "?"}`,
    "```",
    "",
    `- ${label("правил", "rules")}: ${node.rules.length}`,
    `- ${label("свойств", "properties")}: ${node.properties.length}`,
    `- ${label("примеров", "examples")}: ${node.examples.length}${results.length > 0 ? ` (${label("сходятся", "passing")} ${passed}/${results.length})` : ""}`,
  ]
  for (const item of results.filter((entry) => !entry.passed)) {
    lines.push(
      item.error
        ? `- ⚠ «${item.example}»: ${item.error}`
        : `- ⚠ «${item.example}»: ${label("ожидается", "expected")} ${format(item.expected)}, ${label("фактически", "actual")} ${format(item.actual)}`,
    )
  }
  return lines
}

function exampleHover(node, analysis, label) {
  const result = (analysis.tests?.results ?? []).find((item) => item.utility === node.utility && item.example === node.name)
  const lines = [`**${label("пример", "example")} «${node.name}»**`, ""]
  for (const given of node.input) lines.push(`- \`${given.name}\` = ${given.operand}`)
  if (result) {
    lines.push(
      "",
      result.passed
        ? `✓ ${label("фактический результат", "actual result")}: ${format(result.actual)}`
        : `✗ ${label("ожидается", "expected")} ${format(result.expected)}, ${label("фактически", "actual")} ${format(result.actual ?? result.error)}`,
    )
  }
  return lines
}

function morphismHover(node, label) {
  return [
    `**${label("морфизм", "morphism")} «${node.name}»**`,
    "",
    `\`${node.domain ?? "?"}\` → \`${node.codomain ?? "?"}\``,
    "",
    `${label("закон", "law")}: \`${node.law}\``,
  ]
}

function stateHover(name, outline, label) {
  const lines = [`**${label("состояние", "state")} «${name}»**`, ""]
  for (const object of outline.objects) {
    for (const field of object.fields) {
      if (field.state === name) lines.push(`- ${label("объявлено", "declared by")} \`${object.name}.${field.name}\``)
    }
  }
  for (const morphism of outline.morphisms) {
    if (morphism.domain === name) lines.push(`- ${label("домен морфизма", "domain of")} «${morphism.name}»`)
    if (morphism.codomain === name) lines.push(`- ${label("кодомен морфизма", "codomain of")} «${morphism.name}»`)
  }
  return lines
}

function theoremHover(node, label) {
  return [
    `**${label("теорема", "theorem")} «${node.name}»**`,
    "",
    ...(node.structure ? [`${label("объект", "object")}: «${node.structure}»`] : []),
    ...node.morphisms.map((item) => `- ${label("по морфизму", "by morphism")} «${item.name}»`),
    ...(node.conclusion ? ["", `${label("вывод", "conclusion")}: \`${node.conclusion}\``] : []),
  ]
}
