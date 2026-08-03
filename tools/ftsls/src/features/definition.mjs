/**
 * `textDocument/definition` — от употребления к объявлению.
 *
 * В FTS почти всё именование — ссылки: `принимает Покупка`, `если сумма`,
 * `по морфизму «...»`, `является состоянием «...»`. Переход работает для
 * всех этих случаев в пределах документа: модулей у ядра нет, `.fts`-файл
 * самодостаточен.
 */
import { blockAt, morphismByName, objectByName, states, tokenAt, utilityByName } from "../lookup.mjs"

/**
 * @param {{ outline: any }} analysis
 * @param {string} uri
 * @param {{ line: number, character: number }} position
 */
export function definition(analysis, uri, position) {
  const { outline } = analysis
  if (outline.surface !== "natural") return null
  const token = tokenAt(outline, position)
  if (!token) return null

  const object = objectByName(outline, token.value)
  if (object && !contains(object.nameRange, position)) return location(uri, object.nameRange)

  const utility = utilityByName(outline, token.value)
  if (utility && !contains(utility.nameRange, position)) return location(uri, utility.nameRange)

  const morphism = morphismByName(outline, token.value)
  if (morphism && !contains(morphism.nameRange, position)) return location(uri, morphism.nameRange)

  /* Поле: сначала объект, который принимает окружающая утилита, потом
     объект, названный в строке `дано` теоремы, потом любой объект. */
  const block = blockAt(outline, position.line)
  const candidates = []
  if (block?.kind === "utility" && block.input) candidates.push(objectByName(outline, block.input))
  if (block?.kind === "theorem" && block.structure) candidates.push(objectByName(outline, block.structure))
  candidates.push(...outline.objects)
  for (const candidate of candidates) {
    const field = candidate?.fields.find((item) => item.name === token.value)
    if (field && !contains(field.nameRange, position)) return location(uri, field.nameRange)
  }

  const state = states(outline).get(token.value)
  if (state?.kind === "field") return location(uri, state.source.typeRange ?? state.source.nameRange)

  return null
}

function location(uri, range) {
  return { uri, range }
}

function contains(range, position) {
  if (!range) return false
  return range.start.line === position.line && range.start.character <= position.character && position.character <= range.end.character
}
