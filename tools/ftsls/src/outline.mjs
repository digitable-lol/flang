/**
 * Разметка отступной поверхности FTS в дерево с координатами.
 *
 * Зачем она нужна. Ядро сообщает об ошибках двумя разными способами:
 * `src/natural-parser.ts` кладёт в диагностику `path: "строка N"` (номер
 * строки, но без колонки), а `src/validate.ts` — путь по канонической
 * модели, `$.utilities[0].rules[0].when[0].field` (без строки вообще).
 * Настоящий `span` с `line`/`column` есть только у скобочной поверхности
 * (`src/parser.ts`). Чтобы подчеркнуть ошибку в редакторе, нужен мост:
 * этот модуль строит по исходнику те же индексы, что строит ядро, и
 * помнит, из какой строки и с какой колонки взялся каждый узел.
 *
 * Разбиение на строки повторяет `sourceLines` ядра (блочные комментарии
 * заменяются пробелами, строчные срезаются, табуляция считается за два),
 * поэтому нумерация узлов здесь и в ядре совпадает.
 *
 * Это разметка, а не второй парсер: семантики она не знает и ошибок не
 * выносит — компилирует по-прежнему ядро.
 */

const NAME_PATTERN = new RegExp("^[\\p{ID_Start}_$][\\p{ID_Continue}$\\u200C\\u200D-]*", "u")

/** Ключевые фразы обеих поверхностей: русская первой, английская второй. */
export const PHRASES = {
  category: ["категория", "category"],
  object: ["объект", "структура", "object", "structure"],
  morphism: ["морфизм", "morphism"],
  theorem: ["теорема", "theorem"],
  utility: ["утилита", "utility"],
  rule: ["правило", "rule"],
  property: ["свойство", "property"],
  example: ["пример", "example"],
  accepts: ["принимает", "accepts"],
  returns: ["возвращает", "returns"],
  starts: ["начинает с", "starts with"],
  nested: ["вложен объект", "вложена структура", "nested object", "nested structure"],
  law: ["по закону", "under law"],
  dataLookup: ["в данных", "in data"],
  byMorphism: [
    "затем по морфизму",
    "затем применить морфизм",
    "по морфизму",
    "применить морфизм",
    "then by morphism",
    "then apply morphism",
    "by morphism",
    "apply morphism",
  ],
  therefore: ["следовательно", "получаем", "therefore"],
  given: ["дано", "given"],
  expected: ["ожидается", "expected"],
  result: ["результат", "result"],
  thenAdd: ["то добавить", "then add"],
  thenResult: ["то результат", "then result"],
  then: ["то", "then"],
  if: ["если", "if"],
  and: ["и", "and"],
  from: ["из", "from"],
  to: ["в", "to"],
  field: ["поле", "field"],
}

/** Формы объявления типа поля. */
const FIELD_COPULAS = [
  { phrase: "иногда является", optional: true },
  { phrase: "является", optional: false },
  { phrase: "may be", optional: true },
  { phrase: "is state", optional: false, state: true },
  { phrase: "is", optional: false },
]

const STATE_MARKERS = ["состоянием", "state"]

/** Встроенные типы: обе поверхности приводятся к каноническим русским именам. */
const BUILTIN_TYPES = {
  строкой: "Строка",
  текстом: "Строка",
  числом: "Число",
  датой: "Дата",
  деньгами: "Деньги",
  признаком: "Признак",
  строку: "Строка",
  число: "Число",
  дату: "Дата",
  деньги: "Деньги",
  признак: "Признак",
  string: "Строка",
  text: "Строка",
  number: "Число",
  date: "Дата",
  money: "Деньги",
  boolean: "Признак",
}

/** Сравнения: фраза → канонический оператор ядра. Длинные фразы идут первыми. */
export const COMPARISONS = [
  ["не меньше", "gte"],
  ["не больше", "lte"],
  ["не равен", "neq"],
  ["не равна", "neq"],
  ["не равно", "neq"],
  ["равен", "eq"],
  ["равна", "eq"],
  ["равно", "eq"],
  ["равное", "eq"],
  ["больше", "gt"],
  ["меньше", "lt"],
  ["is at least", "gte"],
  ["is at most", "lte"],
  ["is not equal to", "neq"],
  ["is greater than", "gt"],
  ["is less than", "lt"],
  ["equals", "eq"],
  ["equal to", "eq"],
]

/**
 * Разбить исходник на строки с координатами.
 * @param {string} source
 */
export function scanLines(source) {
  /* Блочные комментарии заменяются пробелами — колонки остаются на месте. */
  const withoutBlocks = source
    .replace(/^﻿/u, " ")
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, " "))
  return withoutBlocks.split(/\r?\n/u).map((raw, index) => {
    const stripped = stripLineComment(raw)
    const prefix = /^[ \t]*/u.exec(stripped)?.[0] ?? ""
    const text = stripped.trim()
    const indent = [...prefix].reduce((total, character) => total + (character === "\t" ? 2 : 1), 0)
    return { number: index, indent, text, startChar: prefix.length, endChar: prefix.length + text.length, raw }
  })
}

function stripLineComment(line) {
  let quote
  for (let index = 0; index < line.length - 1; index += 1) {
    const character = line[index]
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

/**
 * Прочитать имя так же, как `readName` ядра: «ёлочки», кавычки или слово.
 * @param {string} text
 * @param {number} [from]
 */
export function readName(text, from = 0) {
  let index = from
  while (index < text.length && (text[index] === " " || text[index] === "\t")) index += 1
  const start = index
  const character = text[index]
  if (character === "«") {
    const end = text.indexOf("»", index + 1)
    if (end < 0) return null
    return finish(text, text.slice(index + 1, end), start, end + 1)
  }
  if (character === '"' || character === "'") {
    let value = ""
    for (let cursor = index + 1; cursor < text.length; cursor += 1) {
      if (text[cursor] === character) return finish(text, value, start, cursor + 1)
      if (text[cursor] === "\\" && cursor + 1 < text.length) value += text[++cursor]
      else value += text[cursor]
    }
    return null
  }
  const match = NAME_PATTERN.exec(text.slice(index))
  if (!match) return null
  return finish(text, match[0], start, index + match[0].length)
}

function finish(text, value, start, end) {
  const rest = text.slice(end)
  const trimmed = rest.trimStart()
  return { value: value.normalize("NFC"), start, end, rest: trimmed.trimEnd(), restStart: end + (rest.length - trimmed.length) }
}

/**
 * Сопоставить начало строки с одной из фраз.
 * @param {string} text
 * @param {string[]} phrases
 */
export function matchPhrase(text, phrases) {
  for (const phrase of phrases) {
    if (text === phrase) return { phrase, rest: "", restStart: text.length }
    if (text.startsWith(`${phrase} `)) {
      const after = phrase.length + 1
      const rest = text.slice(after)
      const trimmed = rest.trimStart()
      return { phrase, rest: trimmed.trimEnd(), restStart: after + (rest.length - trimmed.length) }
    }
  }
  return null
}

/** Разбить сравнение: `не меньше 10000` → оператор и операнд. */
export function matchComparison(text, offset = 0) {
  for (const [phrase, operator] of COMPARISONS) {
    const found = matchPhrase(text, [phrase])
    if (found) return { operator, phrase, value: found.rest, valueStart: offset + found.restStart }
  }
  return null
}

function range(line, from, to) {
  return {
    start: { line: line.number, character: line.startChar + from },
    end: { line: line.number, character: line.startChar + to },
  }
}

function wholeLine(line) {
  return {
    start: { line: line.number, character: line.startChar },
    end: { line: line.number, character: line.endChar },
  }
}

function blockRange(header, body) {
  const last = body.length > 0 ? body[body.length - 1] : header
  return {
    start: { line: header.number, character: header.startChar },
    end: { line: last.number, character: last.endChar },
  }
}

/** Сгруппировать строки в блоки «заголовок + тело» по отступу. */
function groupBlocks(lines) {
  const blocks = []
  let index = 0
  while (index < lines.length) {
    const header = lines[index]
    index += 1
    const body = []
    while (index < lines.length && lines[index].indent > header.indent) body.push(lines[index++])
    blocks.push({ header, body })
  }
  return blocks
}

/**
 * Построить разметку документа.
 *
 * @param {string} source
 * @returns {{
 *   surface: "natural" | "bracket" | "empty",
 *   language: "ru" | "en",
 *   lines: ReturnType<typeof scanLines>,
 *   logical: ReturnType<typeof scanLines>,
 *   category: any,
 *   objects: any[], morphisms: any[], utilities: any[], theorem: any,
 *   nodes: any[], byLine: Map<number, any[]>, byPath: Map<string, any>
 * }}
 */
export function scanDocument(source) {
  const lines = scanLines(source)
  const logical = lines.filter((line) => line.text.length > 0)
  const outline = {
    surface: "empty",
    language: "ru",
    lines,
    logical,
    category: null,
    objects: [],
    morphisms: [],
    utilities: [],
    theorem: null,
    nodes: [],
    byLine: new Map(),
    byPath: new Map(),
  }
  if (logical.length === 0) return outline

  const first = logical[0]
  if (matchPhrase(first.text, ["category"]) && !first.text.includes("{")) outline.language = "en"
  const natural = (matchPhrase(first.text, PHRASES.category) !== null) && !first.text.includes("{")
  outline.surface = natural ? "natural" : "bracket"
  if (!natural) return outline

  const register = (node) => {
    outline.nodes.push(node)
    const line = node.lineRange.start.line
    if (!outline.byLine.has(line)) outline.byLine.set(line, [])
    outline.byLine.get(line).push(node)
    if (node.path && !outline.byPath.has(node.path)) outline.byPath.set(node.path, node)
    return node
  }

  const categoryName = readName(first.text, matchPhrase(first.text, PHRASES.category).restStart)
  outline.category = register({
    kind: "category",
    name: categoryName?.value ?? "",
    path: "$.category",
    lineRange: wholeLine(first),
    range: { start: { line: first.number, character: first.startChar }, end: { line: lastLine(logical).number, character: lastLine(logical).endChar } },
    nameRange: categoryName ? range(first, categoryName.start, categoryName.end) : wholeLine(first),
    children: [],
  })

  for (const block of groupBlocks(logical.slice(1))) {
    const { header, body } = block
    if (matchPhrase(header.text, PHRASES.object)) {
      const node = buildObject(header, body, outline.objects.length, register)
      outline.category.children.push(node)
      outline.objects.push(node)
    } else if (matchPhrase(header.text, PHRASES.morphism)) {
      const node = buildMorphism(header, body, outline.morphisms.length, register)
      outline.category.children.push(node)
      outline.morphisms.push(node)
    } else if (matchPhrase(header.text, PHRASES.utility)) {
      const node = buildUtility(header, body, outline.utilities.length, register)
      outline.category.children.push(node)
      outline.utilities.push(node)
    } else if (matchPhrase(header.text, PHRASES.theorem)) {
      const node = buildTheorem(header, body, register)
      outline.category.children.push(node)
      outline.theorem = node
    } else {
      outline.category.children.push(
        register({ kind: "unknown", name: header.text, path: null, lineRange: wholeLine(header), range: blockRange(header, body), children: [] }),
      )
    }
  }

  return outline
}

function lastLine(logical) {
  return logical[logical.length - 1]
}

function headerName(line, phrases) {
  const keyword = matchPhrase(line.text, phrases)
  if (!keyword) return { value: "", nameRange: wholeLine(line), keyword: null }
  const name = readName(line.text, keyword.restStart)
  return {
    value: name?.value ?? "",
    nameRange: name ? range(line, name.start, name.end) : wholeLine(line),
    keyword,
  }
}

function buildObject(header, body, index, register) {
  const path = `$.structures[${index}]`
  const { value, nameRange } = headerName(header, PHRASES.object)
  const node = register({
    kind: "object",
    name: value,
    path,
    lineRange: wholeLine(header),
    range: blockRange(header, body),
    nameRange,
    children: [],
    fields: [],
  })
  register({ kind: "objectName", name: value, path: `${path}.name`, lineRange: nameRange, range: nameRange, nameRange })

  body.forEach((line, fieldIndex) => {
    const fieldPath = `${path}.fields[${fieldIndex}]`
    const nested = matchPhrase(line.text, PHRASES.nested)
    if (nested) {
      const name = readName(line.text, nested.restStart)
      const field = register({
        kind: "field",
        name: name?.value ?? "",
        type: name?.value ?? "",
        optional: false,
        owner: value,
        path: fieldPath,
        lineRange: wholeLine(line),
        range: wholeLine(line),
        nameRange: name ? range(line, name.start, name.end) : wholeLine(line),
        typeRange: name ? range(line, name.start, name.end) : wholeLine(line),
        children: [],
      })
      node.fields.push(field)
      node.children.push(field)
      register({ ...field, kind: "fieldName", path: `${fieldPath}.name` })
      register({ ...field, kind: "fieldType", path: `${fieldPath}.type`, lineRange: field.typeRange })
      return
    }

    const name = readName(line.text)
    let typeText = ""
    let typeRange = wholeLine(line)
    let optional = false
    let stateType = null
    if (name) {
      const copula = FIELD_COPULAS.find((item) => matchPhrase(name.rest, [item.phrase]))
      if (copula) {
        const after = matchPhrase(name.rest, [copula.phrase])
        optional = copula.optional
        let tail = after.rest
        let tailStart = name.restStart + after.restStart
        const stateMarker = matchPhrase(tail, STATE_MARKERS)
        if (copula.state) {
          stateType = readName(tail)?.value ?? tail
        } else if (stateMarker) {
          tailStart += stateMarker.restStart
          tail = stateMarker.rest
          stateType = readName(tail)?.value ?? tail
        }
        typeText = tail
        typeRange = range(line, tailStart, tailStart + tail.length)
      }
    }
    const canonical = stateType ?? BUILTIN_TYPES[typeText] ?? readName(typeText)?.value ?? typeText
    const field = register({
      kind: "field",
      name: name?.value ?? line.text,
      type: optional ? `${canonical} | undefined` : canonical,
      optional,
      state: stateType,
      owner: value,
      path: fieldPath,
      lineRange: wholeLine(line),
      range: wholeLine(line),
      nameRange: name ? range(line, name.start, name.end) : wholeLine(line),
      typeRange,
      children: [],
    })
    node.fields.push(field)
    node.children.push(field)
    register({ ...field, kind: "fieldName", path: `${fieldPath}.name` })
    register({ ...field, kind: "fieldType", path: `${fieldPath}.type`, lineRange: typeRange })
  })

  return node
}

function buildMorphism(header, body, index, register) {
  const path = `$.functors[${index}]`
  const { value, nameRange } = headerName(header, PHRASES.morphism)
  const node = register({
    kind: "morphism",
    name: value,
    path,
    lineRange: wholeLine(header),
    range: blockRange(header, body),
    nameRange,
    children: [],
    domain: null,
    codomain: null,
    law: "morphism.declared",
  })
  register({ kind: "morphismName", name: value, path: `${path}.name`, lineRange: nameRange, range: nameRange, nameRange })

  for (const line of body) {
    const law = matchPhrase(line.text, PHRASES.law)
    const domain = matchPhrase(line.text, PHRASES.if) ?? matchPhrase(line.text, PHRASES.from)
    const codomain = matchPhrase(line.text, PHRASES.then) ?? matchPhrase(line.text, PHRASES.to)
    if (law) {
      node.law = readName(law.rest)?.value ?? law.rest
      register({ kind: "morphismLaw", name: node.law, path: `${path}.law`, lineRange: wholeLine(line), range: wholeLine(line), owner: value })
    } else if (domain) {
      node.domain = readName(domain.rest)?.value ?? domain.rest
      register({
        kind: "morphismDomain",
        name: node.domain,
        path: `${path}.domain`,
        lineRange: wholeLine(line),
        range: wholeLine(line),
        nameRange: range(line, domain.restStart, line.text.length),
        owner: value,
      })
    } else if (codomain) {
      node.codomain = readName(codomain.rest)?.value ?? codomain.rest
      register({
        kind: "morphismCodomain",
        name: node.codomain,
        path: `${path}.codomain`,
        lineRange: wholeLine(line),
        range: wholeLine(line),
        nameRange: range(line, codomain.restStart, line.text.length),
        owner: value,
      })
    } else {
      register({ kind: "unknown", name: line.text, path: null, lineRange: wholeLine(line), range: wholeLine(line), owner: value })
    }
  }
  return node
}

function buildUtility(header, body, index, register) {
  const path = `$.utilities[${index}]`
  const { value, nameRange } = headerName(header, PHRASES.utility)
  const node = register({
    kind: "utility",
    name: value,
    path,
    lineRange: wholeLine(header),
    range: blockRange(header, body),
    nameRange,
    children: [],
    input: null,
    output: null,
    initial: null,
    rules: [],
    properties: [],
    examples: [],
  })
  register({ kind: "utilityName", name: value, path: `${path}.name`, lineRange: nameRange, range: nameRange, nameRange })

  for (const block of groupBlocks(body)) {
    const line = block.header
    const accepts = matchPhrase(line.text, PHRASES.accepts)
    const returns = matchPhrase(line.text, PHRASES.returns)
    const starts = matchPhrase(line.text, PHRASES.starts)
    if (accepts) {
      const name = readName(line.text, accepts.restStart)
      node.input = name?.value ?? accepts.rest
      register({
        kind: "utilityInput",
        name: node.input,
        path: `${path}.input`,
        lineRange: wholeLine(line),
        range: wholeLine(line),
        nameRange: name ? range(line, name.start, name.end) : wholeLine(line),
        owner: value,
      })
      continue
    }
    if (returns) {
      const raw = returns.rest
      node.output = BUILTIN_TYPES[raw] ?? readName(raw)?.value ?? raw
      register({
        kind: "utilityOutput",
        name: node.output,
        path: `${path}.output`,
        lineRange: wholeLine(line),
        range: wholeLine(line),
        nameRange: range(line, returns.restStart, line.text.length),
        owner: value,
      })
      continue
    }
    if (starts) {
      node.initial = starts.rest
      register({
        kind: "utilityInitial",
        name: starts.rest,
        path: `${path}.initial`,
        lineRange: wholeLine(line),
        range: wholeLine(line),
        nameRange: range(line, starts.restStart, line.text.length),
        owner: value,
      })
      continue
    }
    if (matchPhrase(line.text, PHRASES.rule)) {
      const rule = buildRule(line, block.body, `${path}.rules[${node.rules.length}]`, node, register)
      node.rules.push(rule)
      node.children.push(rule)
      continue
    }
    if (matchPhrase(line.text, PHRASES.property)) {
      const property = buildProperty(line, block.body, `${path}.properties[${node.properties.length}]`, node, register)
      node.properties.push(property)
      node.children.push(property)
      continue
    }
    if (matchPhrase(line.text, PHRASES.example)) {
      const example = buildExample(line, block.body, `${path}.examples[${node.examples.length}]`, node, register)
      node.examples.push(example)
      node.children.push(example)
      continue
    }
    register({ kind: "unknown", name: line.text, path: null, lineRange: wholeLine(line), range: wholeLine(line), owner: value })
  }
  return node
}

function buildRule(header, body, path, utility, register) {
  const { value, nameRange } = headerName(header, PHRASES.rule)
  const node = register({
    kind: "rule",
    name: value,
    path,
    lineRange: wholeLine(header),
    range: blockRange(header, body),
    nameRange,
    utility: utility.name,
    conditions: [],
    action: null,
    children: [],
  })
  register({ kind: "ruleName", name: value, path: `${path}.name`, lineRange: nameRange, range: nameRange, nameRange })

  for (const line of body) {
    const add = matchPhrase(line.text, PHRASES.thenAdd)
    const set = matchPhrase(line.text, PHRASES.thenResult)
    const condition = matchPhrase(line.text, PHRASES.if) ?? matchPhrase(line.text, PHRASES.and)
    if (add || set) {
      const clause = add ?? set
      const operand = add ? { value: add.rest, valueStart: add.restStart } : comparisonOperand(set)
      node.action = register({
        kind: "action",
        name: clause.rest,
        path: `${path}.action`,
        lineRange: wholeLine(line),
        range: wholeLine(line),
        nameRange: range(line, operand.valueStart, line.text.length),
        utility: utility.name,
        rule: value,
        operand: operand.value,
        children: [],
      })
      register({ ...node.action, kind: "actionValue", path: `${path}.action.value`, lineRange: node.action.nameRange })
      register({ ...node.action, kind: "actionValueField", path: `${path}.action.value.field`, lineRange: node.action.nameRange })
      node.children.push(node.action)
      continue
    }
    if (condition) {
      const conditionPath = `${path}.when[${node.conditions.length}]`
      const field = readName(line.text, condition.restStart)
      const comparison = field ? matchComparison(field.rest, field.restStart) : null
      const fieldRange = field ? range(line, field.start, field.end) : wholeLine(line)
      const valueRange = comparison ? range(line, comparison.valueStart, line.text.length) : wholeLine(line)
      const item = register({
        kind: "condition",
        name: field?.value ?? condition.rest,
        path: conditionPath,
        lineRange: wholeLine(line),
        range: wholeLine(line),
        nameRange: fieldRange,
        fieldRange,
        valueRange,
        operator: comparison?.operator ?? null,
        operand: comparison?.value ?? "",
        utility: utility.name,
        rule: value,
        children: [],
      })
      register({ ...item, kind: "conditionField", path: `${conditionPath}.field`, lineRange: fieldRange })
      register({ ...item, kind: "conditionValue", path: `${conditionPath}.value`, lineRange: valueRange })
      register({ ...item, kind: "conditionValueField", path: `${conditionPath}.value.field`, lineRange: valueRange })
      node.conditions.push(item)
      node.children.push(item)
      continue
    }
    register({ kind: "unknown", name: line.text, path: null, lineRange: wholeLine(line), range: wholeLine(line), utility: utility.name })
  }
  return node
}

function comparisonOperand(clause) {
  const comparison = matchComparison(clause.rest, clause.restStart)
  return comparison ? { value: comparison.value, valueStart: comparison.valueStart } : { value: clause.rest, valueStart: clause.restStart }
}

function buildProperty(header, body, path, utility, register) {
  const { value, nameRange } = headerName(header, PHRASES.property)
  const node = register({
    kind: "property",
    name: value,
    path,
    lineRange: wholeLine(header),
    range: blockRange(header, body),
    nameRange,
    utility: utility.name,
    children: [],
  })
  register({ kind: "propertyName", name: value, path: `${path}.name`, lineRange: nameRange, range: nameRange, nameRange })

  for (const line of body) {
    const result = matchPhrase(line.text, PHRASES.result)
    const comparison = result ? matchComparison(result.rest, result.restStart) : null
    const valueRange = comparison ? range(line, comparison.valueStart, line.text.length) : wholeLine(line)
    node.operator = comparison?.operator ?? null
    node.operand = comparison?.value ?? line.text
    const item = register({
      kind: "propertyValue",
      name: node.operand,
      path: `${path}.value`,
      lineRange: wholeLine(line),
      range: wholeLine(line),
      nameRange: valueRange,
      utility: utility.name,
      children: [],
    })
    register({ ...item, kind: "propertyValueField", path: `${path}.value.field`, lineRange: valueRange })
    node.children.push(item)
  }
  return node
}

function buildExample(header, body, path, utility, register) {
  const { value, nameRange } = headerName(header, PHRASES.example)
  const node = register({
    kind: "example",
    name: value,
    path,
    lineRange: wholeLine(header),
    range: blockRange(header, body),
    nameRange,
    utility: utility.name,
    input: [],
    expectedNode: null,
    children: [],
  })
  register({ kind: "exampleName", name: value, path: `${path}.name`, lineRange: nameRange, range: nameRange, nameRange })
  register({ kind: "exampleInput", name: value, path: `${path}.input`, lineRange: nameRange, range: node.range, nameRange, utility: utility.name })

  for (const line of body) {
    const given = matchPhrase(line.text, PHRASES.given)
    const expected = matchPhrase(line.text, PHRASES.expected)
    if (given) {
      const field = readName(line.text, given.restStart)
      const comparison = field ? matchComparison(field.rest, field.restStart) : null
      const fieldRange = field ? range(line, field.start, field.end) : wholeLine(line)
      const item = register({
        kind: "given",
        name: field?.value ?? given.rest,
        path: `${path}.input.${field?.value ?? given.rest}`,
        lineRange: wholeLine(line),
        range: wholeLine(line),
        nameRange: fieldRange,
        fieldRange,
        valueRange: comparison ? range(line, comparison.valueStart, line.text.length) : wholeLine(line),
        operand: comparison?.value ?? "",
        utility: utility.name,
        example: value,
        children: [],
      })
      node.input.push(item)
      node.children.push(item)
      continue
    }
    if (expected) {
      const result = matchPhrase(expected.rest, PHRASES.result)
      const comparison = matchComparison(result ? result.rest : expected.rest, expected.restStart + (result ? result.restStart : 0))
      const item = register({
        kind: "expected",
        name: comparison?.value ?? expected.rest,
        path: `${path}.expected`,
        lineRange: wholeLine(line),
        range: wholeLine(line),
        nameRange: comparison ? range(line, comparison.valueStart, line.text.length) : wholeLine(line),
        valueRange: comparison ? range(line, comparison.valueStart, line.text.length) : wholeLine(line),
        operand: comparison?.value ?? "",
        utility: utility.name,
        example: value,
        children: [],
      })
      node.expectedNode = item
      node.children.push(item)
      continue
    }
    register({ kind: "unknown", name: line.text, path: null, lineRange: wholeLine(line), range: wholeLine(line), utility: utility.name })
  }
  return node
}

function buildTheorem(header, body, register) {
  const { value, nameRange } = headerName(header, PHRASES.theorem)
  const node = register({
    kind: "theorem",
    name: value,
    path: "$.proposition",
    lineRange: wholeLine(header),
    range: blockRange(header, body),
    nameRange,
    morphisms: [],
    children: [],
  })

  for (const line of body) {
    const given = matchPhrase(line.text, PHRASES.given)
    const data = matchPhrase(line.text, PHRASES.dataLookup)
    const byMorphism = matchPhrase(line.text, PHRASES.byMorphism)
    const therefore = matchPhrase(line.text, PHRASES.therefore)
    if (given) {
      const structure = readName(line.text, given.restStart)
      const field = structure ? readName(structure.rest.replace(/^(?:имеет|has)\s+/u, "")) : null
      node.structure = structure?.value ?? null
      const item = register({
        kind: "theoremGiven",
        name: structure?.value ?? given.rest,
        path: "$.proposition.structure",
        lineRange: wholeLine(line),
        range: wholeLine(line),
        nameRange: structure ? range(line, structure.start, structure.end) : wholeLine(line),
        structure: structure?.value ?? null,
        field: field?.value ?? null,
        children: [],
      })
      register({ ...item, kind: "theoremField", path: "$.proposition.field" })
      node.children.push(item)
      continue
    }
    if (data) {
      node.children.push(
        register({
          kind: "theoremData",
          name: data.rest,
          path: "$.proposition.path",
          lineRange: wholeLine(line),
          range: wholeLine(line),
          nameRange: range(line, data.restStart, line.text.length),
          children: [],
        }),
      )
      continue
    }
    if (byMorphism) {
      const name = readName(line.text, byMorphism.restStart)
      const index = node.morphisms.length
      const item = register({
        kind: "theoremMorphism",
        name: name?.value ?? byMorphism.rest,
        path: `$.proposition.functors[${index}]`,
        lineRange: wholeLine(line),
        range: wholeLine(line),
        nameRange: name ? range(line, name.start, name.end) : wholeLine(line),
        children: [],
      })
      if (index === 0) register({ ...item, kind: "theoremMorphism", path: "$.proposition.functor" })
      node.morphisms.push(item)
      node.children.push(item)
      continue
    }
    if (therefore) {
      const name = readName(line.text, therefore.restStart)
      node.conclusion = name?.value ?? therefore.rest
      node.children.push(
        register({
          kind: "theoremConclusion",
          name: node.conclusion,
          path: null,
          lineRange: wholeLine(line),
          range: wholeLine(line),
          nameRange: name ? range(line, name.start, name.end) : wholeLine(line),
          children: [],
        }),
      )
      continue
    }
    register({ kind: "unknown", name: line.text, path: null, lineRange: wholeLine(line), range: wholeLine(line) })
  }
  return node
}

/**
 * Найти диапазон по пути канонической модели: `$.utilities[0].rules[0].when[0].field`.
 * Неизвестный хвост отбрасывается — подчёркивание сползает к ближайшему
 * известному предку, но никогда не теряется.
 *
 * @param {ReturnType<typeof scanDocument>} outline
 * @param {string} path
 */
export function resolvePath(outline, path) {
  let current = path
  while (current.length > 0) {
    const node = outline.byPath.get(current)
    if (node) return node.lineRange ?? node.range
    const cut = Math.max(current.lastIndexOf("."), current.lastIndexOf("["))
    if (cut <= 0) return null
    current = current.slice(0, cut)
  }
  return null
}

/** Каноническое имя типа по слову поверхности. */
export function canonicalType(word) {
  return BUILTIN_TYPES[word] ?? null
}

