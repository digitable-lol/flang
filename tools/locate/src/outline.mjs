/**
 * Разметка документа FTS в дерево с координатами.
 *
 * Зачем она нужна. Ядро сообщает об ошибках четырьмя разными способами, и ни
 * один не полон: `src/parser.ts` даёт настоящий `span` со строкой и колонкой,
 * `src/natural-parser.ts` — только `path: "строка N"`, `src/validate.ts` —
 * только указатель по канонической модели `$.utilities[0].rules[0].when[0]`,
 * а `testUtilities` — вообще ничего, кроме `{ expected, actual }`. Чтобы
 * подчеркнуть ошибку в редакторе или поставить аннотацию в CI, нужен мост:
 * этот модуль строит по исходнику те же индексы, что строит ядро, и помнит,
 * из какой строки и с какой колонки взялся каждый узел.
 *
 * Это разметка, а не второй парсер: семантики она не знает и ошибок не
 * выносит — компилирует по-прежнему ядро. Единственное, что она обязана
 * делать безошибочно, — нумеровать объекты, утилиты, правила и примеры в том
 * же порядке, что и `compile()`. Это проверяется тестом на всех `.fts`
 * репозитория, а не подразумевается.
 *
 * Координаты узлов — нумерация LSP: строки и символы с нуля. Перевод в
 * нумерацию ядра (с единицы) делает `locate`, чтобы одно соглашение
 * не протекало в другое.
 */
import {
  BUILTIN_TYPES,
  FIELD_COPULAS,
  PHRASES,
  STATE_MARKERS,
  matchComparison,
  matchPhrase,
  readName,
  scanLines,
  stripModuleHeader,
} from "./surface.mjs"

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
 * Заголовок модуля ftsc (`модуль` / `использует` / `экспортирует`) снимается
 * здесь же: ядро его не компилирует, а координаты обязаны остаться
 * координатами исходного файла — поэтому строки заголовка заменяются
 * пустыми, а не вырезаются. Текст, который следует отдать `compile()`,
 * лежит в `compileSource`.
 *
 * @param {string} source
 * @returns {{
 *   surface: "natural" | "bracket" | "empty",
 *   language: "ru" | "en",
 *   kind: "document" | "functor",
 *   compileSource: string,
 *   lines: ReturnType<typeof scanLines>,
 *   logical: ReturnType<typeof scanLines>,
 *   category: any,
 *   objects: any[], morphisms: any[], utilities: any[], theorem: any,
 *   nodes: any[], byLine: Map<number, any[]>, byPath: Map<string, any>
 * }}
 */
export function outline(source) {
  const prepared = stripModuleHeader(typeof source === "string" ? source : "")
  const lines = scanLines(prepared.source)
  const logical = lines.filter((line) => line.text.length > 0)
  const view = {
    surface: "empty",
    language: "ru",
    kind: prepared.kind,
    compileSource: prepared.source,
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
  if (logical.length === 0) return view

  const first = logical[0]
  if (matchPhrase(first.text, ["category"]) && !first.text.includes("{")) view.language = "en"
  const natural = matchPhrase(first.text, PHRASES.category) !== null && !first.text.includes("{")
  view.surface = natural ? "natural" : "bracket"
  if (!natural) return view

  const register = (node) => {
    view.nodes.push(node)
    const line = node.lineRange.start.line
    if (!view.byLine.has(line)) view.byLine.set(line, [])
    view.byLine.get(line).push(node)
    if (node.path && !view.byPath.has(node.path)) view.byPath.set(node.path, node)
    return node
  }

  const categoryName = readName(first.text, matchPhrase(first.text, PHRASES.category).restStart)
  view.category = register({
    kind: "category",
    name: categoryName?.value ?? "",
    path: "$.category",
    lineRange: wholeLine(first),
    range: {
      start: { line: first.number, character: first.startChar },
      end: { line: lastLine(logical).number, character: lastLine(logical).endChar },
    },
    nameRange: categoryName ? range(first, categoryName.start, categoryName.end) : wholeLine(first),
    children: [],
  })

  for (const block of groupBlocks(logical.slice(1))) {
    const { header, body } = block
    if (matchPhrase(header.text, PHRASES.object)) {
      const node = buildObject(header, body, view.objects.length, register)
      view.category.children.push(node)
      view.objects.push(node)
    } else if (matchPhrase(header.text, PHRASES.morphism)) {
      const node = buildMorphism(header, body, view.morphisms.length, register)
      view.category.children.push(node)
      view.morphisms.push(node)
    } else if (matchPhrase(header.text, PHRASES.utility)) {
      const node = buildUtility(header, body, view.utilities.length, register)
      view.category.children.push(node)
      view.utilities.push(node)
    } else if (matchPhrase(header.text, PHRASES.theorem)) {
      const node = buildTheorem(header, body, register)
      view.category.children.push(node)
      view.theorem = node
    } else {
      view.category.children.push(
        register({
          kind: "unknown",
          name: header.text,
          path: null,
          lineRange: wholeLine(header),
          range: blockRange(header, body),
          children: [],
        }),
      )
    }
  }

  return view
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
      register({
        kind: "morphismLaw",
        name: node.law,
        path: `${path}.law`,
        lineRange: wholeLine(line),
        range: wholeLine(line),
        owner: value,
      })
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
      register({
        kind: "unknown",
        name: line.text,
        path: null,
        lineRange: wholeLine(line),
        range: wholeLine(line),
        owner: value,
      })
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
    register({
      kind: "unknown",
      name: line.text,
      path: null,
      lineRange: wholeLine(line),
      range: wholeLine(line),
      owner: value,
    })
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
      register({
        ...node.action,
        kind: "actionValueField",
        path: `${path}.action.value.field`,
        lineRange: node.action.nameRange,
      })
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
    register({
      kind: "unknown",
      name: line.text,
      path: null,
      lineRange: wholeLine(line),
      range: wholeLine(line),
      utility: utility.name,
    })
  }
  return node
}

function comparisonOperand(clause) {
  const comparison = matchComparison(clause.rest, clause.restStart)
  return comparison
    ? { value: comparison.value, valueStart: comparison.valueStart }
    : { value: clause.rest, valueStart: clause.restStart }
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
  register({
    kind: "exampleInput",
    name: value,
    path: `${path}.input`,
    lineRange: nameRange,
    range: node.range,
    nameRange,
    utility: utility.name,
  })

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
      const comparison = matchComparison(
        result ? result.rest : expected.rest,
        expected.restStart + (result ? result.restStart : 0),
      )
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
    register({
      kind: "unknown",
      name: line.text,
      path: null,
      lineRange: wholeLine(line),
      range: wholeLine(line),
      utility: utility.name,
    })
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
