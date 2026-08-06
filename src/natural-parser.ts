/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
import { diagnosticError } from "./diagnostics.js"
import type {
  FtsDocument,
  FtsField,
  FtsFunctor,
  FtsProposition,
  FtsScalar,
  FtsStructure,
  FtsUtility,
  FtsUtilityComparison,
  FtsUtilityCondition,
  FtsUtilityExample,
  FtsUtilityOperand,
  FtsUtilityProperty,
  FtsUtilityRule,
  SourceSpan,
} from "./model.js"
import { withSpan } from "./spans.js"

interface SourceLine {
  number: number
  indent: number
  text: string
  /** Column of the first meaningful character, from one, as in `SourceSpan`. */
  column: number
  /** Offset of that character, and how far the meaningful text runs. */
  offset: number
  length: number
}

/** The meaningful part of a line — what a diagnostic about it should underline. */
function lineSpan(line: SourceLine): SourceSpan {
  return {
    start: { offset: line.offset, line: line.number, column: line.column },
    end: { offset: line.offset + line.length, line: line.number, column: line.column + line.length },
  }
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

const returnedTypes: Record<string, string> = {
  строку: "Строка",
  число: "Число",
  дату: "Дата",
  деньги: "Деньги",
  признак: "Признак",
}

export function looksLikeNaturalSurface(source: string): boolean {
  const first = source
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .map((line) => stripLineComment(line).trim())
    .find((line) => line.length > 0)
  return first !== undefined && /^(?:категория|category)(?:\s|$)/u.test(first) && !first.includes("{")
}

export function parseNaturalSurface(source: string): FtsDocument {
  const lines = sourceLines(normalizeEnglishNaturalSurface(source), source)
  const first = lines[0]
  if (!first || !first.text.startsWith("категория ")) {
    throw naturalError("FTS_NATURAL_CATEGORY", "документ должен начинаться со строки 'категория «Имя»'", first)
  }
  const category = readWholeName(first.text.slice("категория".length), first)
  const structures: FtsStructure[] = []
  const morphisms: FtsFunctor[] = []
  const theorems: TheoremDraft[] = []
  const utilities: FtsUtility[] = []

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
    } else if (header.text.startsWith("утилита ")) {
      utilities.push(parseUtility(header, body))
    } else {
      throw naturalError("FTS_NATURAL_DECLARATION", "ожидались объект, структура, морфизм, теорема или утилита", header)
    }
  }

  if (theorems.length > 1) {
    throw naturalError("FTS_MULTIPLE_PROPOSITIONS", "версия FTS 0.2 допускает одну теорему в документе", lines[0])
  }
  const proposition = theorems.length === 0 ? null : buildProposition(theorems[0]!, structures, morphisms)
  return {
    category,
    structures,
    functors: morphisms,
    proposition,
    ts_compat: {},
    ...(utilities.length > 0 ? { utilities } : {}),
  }
}

/**
 * English is a second authoring surface over the same parser and canonical
 * model, not a second runtime.  The rewrite is deliberately line-oriented:
 * indentation, quoted domain names, comments and source line numbers stay
 * intact, while only reserved phrases at syntactic positions are translated.
 */
function normalizeEnglishNaturalSurface(source: string): string {
  const first = source
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .map((line) => stripLineComment(line).trim())
    .find((line) => line.length > 0)
  if (!first || !/^category(?:\s|$)/u.test(first) || first.includes("{")) return source

  return source.split(/\r?\n/u).map((raw) => {
    const indentation = raw.match(/^[ \t]*/u)?.[0] ?? ""
    const text = raw.slice(indentation.length)
    if (!text.trim() || text.trimStart().startsWith("//")) return raw
    return indentation + translateEnglishLine(text)
  }).join("\n")
}

function translateEnglishLine(line: string): string {
  const declarations: Array<[RegExp, string]> = [
    [/^category\s+/u, "категория "],
    [/^object\s+/u, "объект "],
    [/^structure\s+/u, "структура "],
    [/^morphism\s+/u, "морфизм "],
    [/^theorem\s+/u, "теорема "],
    [/^utility\s+/u, "утилита "],
    [/^rule\s+/u, "правило "],
    [/^property\s+/u, "свойство "],
    [/^example\s+/u, "пример "],
    [/^nested object\s+/u, "вложен объект "],
    [/^nested structure\s+/u, "вложена структура "],
    [/^accepts\s+/u, "принимает "],
    [/^starts with\s+/u, "начинает с "],
    [/^then by morphism\s+/u, "затем по морфизму "],
    [/^by morphism\s+/u, "по морфизму "],
    [/^then apply morphism\s+/u, "затем применить морфизм "],
    [/^apply morphism\s+/u, "применить морфизм "],
    [/^therefore\s+/u, "следовательно "],
    [/^under law\s+/u, "по закону "],
  ]
  for (const [pattern, replacement] of declarations) {
    if (pattern.test(line)) return line.replace(pattern, replacement)
  }

  const returnTypes: Record<string, string> = {
    string: "строку",
    number: "число",
    date: "дату",
    money: "деньги",
    boolean: "признак",
  }
  const returns = line.match(/^returns\s+(.+)$/u)
  if (returns?.[1] !== undefined) return `возвращает ${returnTypes[returns[1]] ?? returns[1]}`

  const fieldType = line.match(/^(.+?)\s+(is|may be)\s+(string|number|date|money|boolean)$/u)
  if (fieldType?.[1] && fieldType[2] && fieldType[3]) {
    const types: Record<string, string> = {
      string: "строкой",
      number: "числом",
      date: "датой",
      money: "деньгами",
      boolean: "признаком",
    }
    return `${fieldType[1]} ${fieldType[2] === "may be" ? "иногда является" : "является"} ${types[fieldType[3]]}`
  }
  const stateField = line.match(/^(.+?)\s+is state\s+(.+)$/u)
  if (stateField?.[1] && stateField[2]) return `${stateField[1]} является состоянием ${stateField[2]}`

  if (/^given\s+.+?\s+has\s+/u.test(line)) {
    return line
      .replace(/^given\s+/u, "дано ")
      .replace(/\s+has\s+/u, " имеет ")
      .replace(/\s+equal to\s+/u, " равное ")
  }
  if (/^in data\s+/u.test(line)) {
    return line
      .replace(/^in data\s+/u, "в данных ")
      .replace(/\s+find where\s+/u, " найти где ")
      .replace(/\s+equals\s+/u, " равен ")
  }

  let translated = line
    .replace(/^expected\s+/u, "ожидается ")
    .replace(/^then add\s+/u, "то добавить ")
    .replace(/^then result\s+/u, "то результат ")
    .replace(/^then\s+/u, "то ")
    .replace(/^if\s+/u, "если ")
    .replace(/^and\s+/u, "и ")
    .replace(/^from\s+/u, "из ")
    .replace(/^to\s+/u, "в ")
    .replace(/^result\s+/u, "результат ")
    .replace(/^given\s+/u, "дано ")

  translated = translated
    .replace(/\s+is at least\s+/u, " не меньше ")
    .replace(/\s+is at most\s+/u, " не больше ")
    .replace(/\s+is not equal to\s+/u, " не равен ")
    .replace(/\s+is greater than\s+/u, " больше ")
    .replace(/\s+is less than\s+/u, " меньше ")
    .replace(/\s+equals\s+/u, " равен ")
    .replace(/\s+percent(?:s)? of field\s+/u, " процентов от поля ")
    .replace(/^field\s+/u, "поле ")
  return translated
}

function parseUtility(header: SourceLine, body: SourceLine[]): FtsUtility {
  const name = readWholeName(header.text.slice("утилита".length), header)
  if (body.length === 0) throw naturalError("FTS_NATURAL_UTILITY", `утилита «${name}» не содержит определения`, header)
  const directIndent = Math.min(...body.map((line) => line.indent))
  let input: string | undefined
  let output: string | undefined
  let initial: FtsScalar | undefined
  const rules: FtsUtilityRule[] = []
  const properties: FtsUtilityProperty[] = []
  const examples: FtsUtilityExample[] = []

  let index = 0
  while (index < body.length) {
    const line = body[index]!
    if (line.indent !== directIndent) {
      throw naturalError("FTS_NATURAL_UTILITY_INDENT", "строка утилиты имеет лишний отступ", line)
    }
    if (line.text.startsWith("принимает ")) {
      input = readWholeName(line.text.slice("принимает".length), line)
      index += 1
      continue
    }
    if (line.text.startsWith("возвращает ")) {
      output = normalizeNaturalType(line.text.slice("возвращает".length), line)
      index += 1
      continue
    }
    if (line.text.startsWith("начинает с ")) {
      initial = parseScalar(line.text.slice("начинает с".length).trim(), line)
      index += 1
      continue
    }

    const nested: SourceLine[] = []
    index += 1
    while (index < body.length && body[index]!.indent > directIndent) nested.push(body[index++]!)
    if (line.text.startsWith("правило ")) rules.push(parseUtilityRule(line, nested))
    else if (line.text.startsWith("свойство ")) properties.push(parseUtilityProperty(line, nested))
    else if (line.text.startsWith("пример ")) examples.push(parseUtilityExample(line, nested))
    else throw naturalError("FTS_NATURAL_UTILITY", "ожидались принимает, возвращает, начинает с, правило, свойство или пример", line)
  }

  if (!input) throw naturalError("FTS_UTILITY_INPUT", `утилита «${name}» требует строку 'принимает'`, header)
  if (!output) throw naturalError("FTS_UTILITY_OUTPUT", `утилита «${name}» требует строку 'возвращает'`, header)
  if (initial === undefined) throw naturalError("FTS_UTILITY_INITIAL", `утилита «${name}» требует строку 'начинает с'`, header)
  return withSpan({ name, input, output, initial, rules, properties, examples }, lineSpan(header))
}

function parseUtilityRule(header: SourceLine, body: SourceLine[]): FtsUtilityRule {
  const name = readWholeName(header.text.slice("правило".length), header)
  const when: FtsUtilityCondition[] = []
  let action: FtsUtilityRule["action"] | undefined
  for (const line of body) {
    if (line.text.startsWith("если ")) when.push(parseUtilityCondition(line.text.slice("если".length), line))
    else if (line.text.startsWith("и ")) when.push(parseUtilityCondition(line.text.slice(1), line))
    else if (line.text.startsWith("то добавить ")) {
      action = { kind: "add", value: parseUtilityOperand(line.text.slice("то добавить".length), line) }
    } else if (line.text.startsWith("то результат ")) {
      const comparison = parseUtilityComparison(line.text.slice("то результат".length), line)
      if (comparison.operator !== "eq") throw naturalError("FTS_UTILITY_ACTION", "результат правила задаётся через 'равен'", line)
      action = { kind: "set", value: comparison.value }
    } else {
      throw naturalError("FTS_UTILITY_RULE", "в правиле ожидаются если, и или то", line)
    }
  }
  if (when.length === 0) throw naturalError("FTS_UTILITY_RULE", `правило «${name}» требует условие 'если'`, header)
  if (!action) throw naturalError("FTS_UTILITY_RULE", `правило «${name}» требует действие 'то'`, header)
  return withSpan({ name, when, action }, lineSpan(header))
}

function parseUtilityCondition(text: string, line: SourceLine): FtsUtilityCondition {
  const field = readName(text.trim(), line)
  const comparison = parseUtilityComparison(field.rest, line)
  return { field: field.value, operator: comparison.operator, value: comparison.value }
}

function parseUtilityProperty(header: SourceLine, body: SourceLine[]): FtsUtilityProperty {
  const name = readWholeName(header.text.slice("свойство".length), header)
  if (body.length !== 1 || !body[0]!.text.startsWith("результат ")) {
    throw naturalError("FTS_UTILITY_PROPERTY", `свойство «${name}» должно содержать одно сравнение результата`, header)
  }
  const comparison = parseUtilityComparison(body[0]!.text.slice("результат".length), body[0]!)
  return withSpan({ name, operator: comparison.operator, value: comparison.value }, lineSpan(header))
}

function parseUtilityExample(header: SourceLine, body: SourceLine[]): FtsUtilityExample {
  const name = readWholeName(header.text.slice("пример".length), header)
  const input: Record<string, FtsScalar> = {}
  let expected: FtsScalar | undefined
  for (const line of body) {
    if (line.text.startsWith("дано ")) {
      const field = readName(line.text.slice("дано".length).trim(), line)
      const comparison = parseUtilityComparison(field.rest, line)
      if (comparison.operator !== "eq" || comparison.value.kind !== "value") {
        throw naturalError("FTS_UTILITY_EXAMPLE", "пример задаёт вход как 'дано поле равно значению'", line)
      }
      input[field.value] = comparison.value.value
    } else if (line.text.startsWith("ожидается ")) {
      const result = readName(line.text.slice("ожидается".length).trim(), line)
      const comparison = parseUtilityComparison(result.rest, line)
      if (comparison.operator !== "eq" || comparison.value.kind !== "value") {
        throw naturalError("FTS_UTILITY_EXAMPLE", "ожидание задаётся как 'ожидается результат равен значению'", line)
      }
      expected = comparison.value.value
    } else {
      throw naturalError("FTS_UTILITY_EXAMPLE", "в примере ожидаются строки 'дано' или 'ожидается'", line)
    }
  }
  if (expected === undefined) throw naturalError("FTS_UTILITY_EXAMPLE", `пример «${name}» требует строку 'ожидается'`, header)
  return { name, input, expected }
}

function parseUtilityComparison(text: string, line: SourceLine): { operator: FtsUtilityComparison; value: FtsUtilityOperand } {
  const comparisons: Array<[string, FtsUtilityComparison]> = [
    ["не меньше ", "gte"],
    ["не больше ", "lte"],
    ["не равен ", "neq"],
    ["не равна ", "neq"],
    ["не равно ", "neq"],
    ["равен ", "eq"],
    ["равна ", "eq"],
    ["равно ", "eq"],
    ["больше ", "gt"],
    ["меньше ", "lt"],
  ]
  const source = text.trim()
  for (const [phrase, operator] of comparisons) {
    if (source.startsWith(phrase)) {
      return { operator, value: parseUtilityOperand(source.slice(phrase.length), line) }
    }
  }
  throw naturalError("FTS_UTILITY_COMPARISON", "ожидалось сравнение: равен, не равен, больше, меньше, не больше или не меньше", line)
}

function parseUtilityOperand(text: string, line: SourceLine): FtsUtilityOperand {
  const source = text.trim()
  if (source === "результат") return { kind: "result" }
  const percent = source.match(/^(-?(?:0|[1-9]\d*)(?:\.\d+)?)\s+процент(?:а|ов)?\s+(.+)$/u)
  if (percent?.[1] !== undefined && percent[2] !== undefined) {
    const reference = percent[2].startsWith("от поля ") ? percent[2].slice("от поля".length) : percent[2]
    return { kind: "percent", percent: Number(percent[1]), field: readWholeName(reference, line) }
  }
  if (source.startsWith("поле ")) return { kind: "field", field: readWholeName(source.slice("поле".length), line) }
  return { kind: "value", value: parseScalar(source, line) }
}

function normalizeNaturalType(text: string, line: SourceLine): string {
  const source = text.trim()
  return returnedTypes[source] ?? builtinTypes[source] ?? readWholeName(source, line)
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

/**
 * Splits the document into meaningful lines, with the coordinates of each.
 *
 * `original` is the text as the author wrote it; `source` may be the English
 * surface already rewritten into reserved Russian phrases. The rewrite is
 * line-oriented and keeps indentation, so line numbers coincide \u2014 but phrase
 * lengths do not, and coordinates must belong to the file that is open in the
 * editor. Hence the split walks both: text to parse from one, positions from
 * the other.
 */
function sourceLines(source: string, original: string = source): SourceLine[] {
  const blank = (text: string): string =>
    text.replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/g, " ")).replace(/^\uFEFF/u, "")
  const parsed = blank(source).split(/\r?\n/u)
  const written = blank(original)
  const rawLines = written.split(/\r?\n/u)

  const lines: SourceLine[] = []
  let offset = 0
  parsed.forEach((raw, index) => {
    const rawLine = rawLines[index] ?? raw
    const lineOffset = offset
    offset += rawLine.length + (written[lineOffset + rawLine.length] === "\r" ? 2 : 1)

    const text = stripLineComment(raw)
    const prefix = text.match(/^[ \t]*/u)?.[0] ?? ""
    const indent = Array.from(prefix).reduce((total, character) => total + (character === "\t" ? 2 : 1), 0)
    const trimmed = text.trim()
    if (trimmed.length === 0) return

    const shown = stripLineComment(rawLine)
    const shownPrefix = shown.match(/^[ \t]*/u)?.[0] ?? ""
    lines.push({
      number: index + 1,
      indent,
      text: trimmed,
      column: shownPrefix.length + 1,
      offset: lineOffset + shownPrefix.length,
      length: Math.max(shown.trim().length, 1),
    })
  })
  return lines
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
