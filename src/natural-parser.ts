import { diagnosticError } from "./diagnostics.js"
import type { FtsDocument, FtsField, FtsFunctor, FtsProposition, FtsScalar, FtsStructure } from "./model.js"

interface SourceLine {
  number: number
  indent: number
  text: string
}

interface TheoremDraft {
  title: string
  structure?: string
  field?: string
  expected?: FtsScalar
  collection?: string
  selectorField?: string
  selectorValue?: FtsScalar
  morphisms: string[]
  conclusion?: string
}

const builtinTypes: Record<string, string> = {
  строкой: "Строка",
  текстом: "Строка",
  числом: "Число",
  датой: "Дата",
  деньгами: "Деньги",
  признаком: "Признак",
}

export function looksLikeNaturalSurface(source: string): boolean {
  const first = source
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .map((line) => stripLineComment(line).trim())
    .find((line) => line.length > 0)
  return first !== undefined && /^категория(?:\s|$)/u.test(first) && !first.includes("{")
}

export function parseNaturalSurface(source: string): FtsDocument {
  const lines = sourceLines(source)
  const first = lines[0]
  if (!first || !first.text.startsWith("категория ")) {
    throw naturalError("FTS_NATURAL_CATEGORY", "документ должен начинаться со строки 'категория «Имя»'", first)
  }
  const category = readWholeName(first.text.slice("категория".length), first)
  const structures: FtsStructure[] = []
  const morphisms: FtsFunctor[] = []
  const theorems: TheoremDraft[] = []

  let index = 1
  while (index < lines.length) {
    const header = lines[index]!
    if (header.indent <= first.indent) {
      throw naturalError("FTS_NATURAL_INDENT", "объявление должно иметь отступ относительно категории", header)
    }
    const body: SourceLine[] = []
    index += 1
    while (index < lines.length && lines[index]!.indent > header.indent) body.push(lines[index++]!)

    if (header.text.startsWith("объект ") || header.text.startsWith("структура ")) {
      structures.push(parseObject(header, body))
    } else if (header.text.startsWith("морфизм ")) {
      morphisms.push(parseMorphism(header, body))
    } else if (header.text.startsWith("теорема ")) {
      theorems.push(parseTheorem(header, body))
    } else {
      throw naturalError("FTS_NATURAL_DECLARATION", "ожидались объект, структура, морфизм или теорема", header)
    }
  }

  if (theorems.length > 1) {
    throw naturalError("FTS_MULTIPLE_PROPOSITIONS", "версия FTS 0.1 допускает одну теорему в документе", lines[0])
  }
  const proposition = theorems.length === 0 ? null : buildProposition(theorems[0]!, structures, morphisms)
  return { category, structures, functors: morphisms, proposition, ts_compat: {} }
}

function parseObject(header: SourceLine, body: SourceLine[]): FtsStructure {
  const keyword = header.text.startsWith("структура ") ? "структура" : "объект"
  const name = readWholeName(header.text.slice(keyword.length), header)
  if (body.length === 0) throw naturalError("FTS_NATURAL_OBJECT", `объект «${name}» не содержит полей`, header)
  const fields: FtsField[] = body.map((line) => parseField(line))
  return { name, fields }
}

function parseField(line: SourceLine): FtsField {
  if (line.text.startsWith("вложен объект ") || line.text.startsWith("вложена структура ")) {
    const prefix = line.text.startsWith("вложен объект ") ? "вложен объект" : "вложена структура"
    const name = readWholeName(line.text.slice(prefix.length), line)
    return { name, type: name }
  }

  const namePart = readName(line.text, line)
  let rest = namePart.rest
  let optional = false
  if (rest.startsWith("иногда является ")) {
    optional = true
    rest = rest.slice("иногда является".length).trim()
  } else if (rest.startsWith("является ")) {
    rest = rest.slice("является".length).trim()
  } else {
    throw naturalError("FTS_NATURAL_FIELD", "поле записывается как '«имя» является типом'", line)
  }

  let type: string
  if (rest.startsWith("состоянием ")) {
    type = readWholeName(rest.slice("состоянием".length), line)
  } else {
    type = builtinTypes[rest] ?? readWholeName(rest, line)
  }
  return { name: namePart.value, type: optional ? `${type} | undefined` : type }
}

function parseMorphism(header: SourceLine, body: SourceLine[]): FtsFunctor {
  const name = readWholeName(header.text.slice("морфизм".length), header)
  let domain: string | undefined
  let codomain: string | undefined
  let law = "morphism.declared"
  for (const line of body) {
    if (line.text.startsWith("если ")) domain = readWholeName(line.text.slice("если".length), line)
    else if (line.text.startsWith("то ")) codomain = readWholeName(line.text.slice("то".length), line)
    else if (line.text.startsWith("из ")) domain = readWholeName(line.text.slice(2), line)
    else if (line.text.startsWith("в ")) codomain = readWholeName(line.text.slice(1), line)
    else if (line.text.startsWith("по закону ")) law = readWholeName(line.text.slice("по закону".length), line)
    else throw naturalError("FTS_NATURAL_MORPHISM", "в морфизме ожидаются строки 'если', 'то' или 'по закону'", line)
  }
  if (!domain || !codomain) throw naturalError("FTS_NATURAL_MORPHISM", `морфизм «${name}» требует строки 'если' и 'то'`, header)
  return { name, domain, codomain, law }
}

function parseTheorem(header: SourceLine, body: SourceLine[]): TheoremDraft {
  const theorem: TheoremDraft = {
    title: readWholeName(header.text.slice("теорема".length), header),
    morphisms: [],
  }
  for (const line of body) {
    if (line.text.startsWith("дано ")) parseGiven(line.text.slice("дано".length), line, theorem)
    else if (line.text.startsWith("в данных ")) parseDataLookup(line.text.slice("в данных".length), line, theorem)
    else if (line.text.startsWith("по морфизму ")) {
      theorem.morphisms.push(readWholeName(line.text.slice("по морфизму".length), line))
    } else if (line.text.startsWith("затем по морфизму ")) {
      theorem.morphisms.push(readWholeName(line.text.slice("затем по морфизму".length), line))
    } else if (line.text.startsWith("применить морфизм ")) {
      theorem.morphisms.push(readWholeName(line.text.slice("применить морфизм".length), line))
    } else if (line.text.startsWith("затем применить морфизм ")) {
      theorem.morphisms.push(readWholeName(line.text.slice("затем применить морфизм".length), line))
    } else if (line.text.startsWith("следовательно ")) {
      theorem.conclusion = readWholeName(line.text.slice("следовательно".length), line)
    } else if (line.text.startsWith("получаем ")) {
      theorem.conclusion = readWholeName(line.text.slice("получаем".length), line)
    } else {
      throw naturalError("FTS_NATURAL_THEOREM", "неизвестная строка теоремы", line)
    }
  }
  return theorem
}

function parseGiven(text: string, line: SourceLine, theorem: TheoremDraft): void {
  const structure = readName(text, line)
  if (!structure.rest.startsWith("имеет ")) {
    throw naturalError("FTS_NATURAL_GIVEN", "ожидалось 'дано «Объект» имеет «поле» равное значение'", line)
  }
  const field = readName(structure.rest.slice("имеет".length).trim(), line)
  if (!field.rest.startsWith("равное ")) {
    throw naturalError("FTS_NATURAL_GIVEN", "после поля ожидалось слово 'равное'", line)
  }
  theorem.structure = structure.value
  theorem.field = field.value
  theorem.expected = parseScalar(field.rest.slice("равное".length).trim(), line)
}

function parseDataLookup(text: string, line: SourceLine, theorem: TheoremDraft): void {
  const collection = readName(text, line)
  if (!collection.rest.startsWith("найти где ")) {
    throw naturalError("FTS_NATURAL_DATA", "ожидалось 'в данных «коллекция» найти где «поле» равен значению'", line)
  }
  const field = readName(collection.rest.slice("найти где".length).trim(), line)
  if (!field.rest.startsWith("равен ")) {
    throw naturalError("FTS_NATURAL_DATA", "после поля selector ожидалось слово 'равен'", line)
  }
  theorem.collection = collection.value
  theorem.selectorField = field.value
  theorem.selectorValue = parseScalar(field.rest.slice("равен".length).trim(), line)
}

function buildProposition(theorem: TheoremDraft, structures: FtsStructure[], morphisms: FtsFunctor[]): FtsProposition {
  if (!theorem.structure || !theorem.field || theorem.expected === undefined) {
    throw naturalError("FTS_NATURAL_THEOREM", `теорема «${theorem.title}» требует строку 'дано'`)
  }
  if (!theorem.collection || !theorem.selectorField || theorem.selectorValue === undefined) {
    throw naturalError("FTS_NATURAL_THEOREM", `теорема «${theorem.title}» требует строку 'в данных'`)
  }
  const structure = structures.find((item) => item.name === theorem.structure)
  const field = structure?.fields.find((item) => item.name === theorem.field)
  if (!field) throw naturalError("FTS_UNKNOWN_FIELD", `не найдено поле «${theorem.structure}».«${theorem.field}»`)

  const witness: FtsProposition = {
    kind: "witness",
    structure: theorem.structure,
    field: theorem.field,
    selector: { [theorem.selectorField]: theorem.selectorValue },
    value: theorem.expected,
    path: [theorem.collection, { [theorem.selectorField]: theorem.selectorValue }, theorem.field],
    detail: theorem.title,
  }
  let resultingType = field.type.replace(/\s*\|\s*undefined$/u, "")
  for (const name of theorem.morphisms) {
    const morphism = morphisms.find((item) => item.name === name)
    if (!morphism) throw naturalError("FTS_UNKNOWN_FUNCTOR", `не найден морфизм «${name}»`)
    if (morphism.domain !== resultingType) {
      throw naturalError(
        "FTS_PROOF_TYPE_MISMATCH",
        `морфизм «${name}» ожидает «${morphism.domain}», получено «${resultingType}»`,
      )
    }
    resultingType = morphism.codomain
  }
  if (theorem.conclusion && theorem.conclusion !== resultingType) {
    throw naturalError(
      "FTS_THEOREM_CONCLUSION",
      `теорема объявляет «${theorem.conclusion}», но вывод имеет тип «${resultingType}»`,
    )
  }
  if (theorem.morphisms.length === 0) return witness
  if (theorem.morphisms.length === 1) {
    return { kind: "apply", functor: theorem.morphisms[0]!, arg: witness, detail: theorem.title }
  }
  return { kind: "compose", functors: theorem.morphisms, arg: witness, detail: theorem.title }
}

function sourceLines(source: string): SourceLine[] {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/g, " "))
  return withoutBlocks
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .map((raw, index) => {
      const text = stripLineComment(raw)
      const prefix = text.match(/^[ \t]*/u)?.[0] ?? ""
      const indent = Array.from(prefix).reduce((total, character) => total + (character === "\t" ? 2 : 1), 0)
      return { number: index + 1, indent, text: text.trim() }
    })
    .filter((line) => line.text.length > 0)
}

function stripLineComment(line: string): string {
  let quote: string | undefined
  for (let index = 0; index < line.length - 1; index += 1) {
    const character = line[index]!
    if (quote === undefined && (character === '"' || character === "'" || character === "«")) {
      quote = character === "«" ? "»" : character
    } else if (quote !== undefined && character === quote) {
      quote = undefined
    } else if (quote === undefined && character === "/" && line[index + 1] === "/") {
      return line.slice(0, index)
    }
  }
  return line
}

function readWholeName(text: string, line?: SourceLine): string {
  const parsed = readName(text.trim(), line)
  if (parsed.rest.length > 0) throw naturalError("FTS_NATURAL_NAME", `лишний текст после имени: '${parsed.rest}'`, line)
  return parsed.value
}

function readName(text: string, line?: SourceLine): { value: string; rest: string } {
  const source = text.trim()
  if (source.startsWith("«")) {
    const end = source.indexOf("»", 1)
    if (end < 0) throw naturalError("FTS_UNCLOSED_STRING", "не закрыта кавычка-ёлочка", line)
    return { value: source.slice(1, end).normalize("NFC"), rest: source.slice(end + 1).trim() }
  }
  if (source.startsWith('"') || source.startsWith("'")) {
    const quote = source[0]!
    let value = ""
    for (let index = 1; index < source.length; index += 1) {
      const character = source[index]!
      if (character === quote) return { value: value.normalize("NFC"), rest: source.slice(index + 1).trim() }
      if (character === "\\" && index + 1 < source.length) value += source[++index]
      else value += character
    }
    throw naturalError("FTS_UNCLOSED_STRING", "не закрыта кавычка", line)
  }
  const match = source.match(/^[\p{ID_Start}_$][\p{ID_Continue}$\u200C\u200D-]*/u)
  if (!match) throw naturalError("FTS_NATURAL_NAME", "ожидалось имя", line)
  return { value: match[0].normalize("NFC"), rest: source.slice(match[0].length).trim() }
}

function parseScalar(text: string, line: SourceLine): FtsScalar {
  if (text === "да" || text === "true") return true
  if (text === "нет" || text === "false") return false
  if (text === "ничто" || text === "null") return null
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u.test(text)) return Number(text)
  return readWholeName(text, line)
}

function naturalError(code: string, message: string, line?: SourceLine): Error {
  return diagnosticError(code, message, line ? { path: `строка ${line.number}` } : undefined)
}
