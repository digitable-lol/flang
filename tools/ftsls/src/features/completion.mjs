/**
 * `textDocument/completion` — ключевые слова по контексту и имена документа.
 *
 * Контекст определяется двумя вещами: блоком, в котором стоит курсор (его
 * находим по отступам вверх от строки), и уже набранной частью строки.
 * Поэтому после `если` предлагаются поля объекта, который принимает эта
 * утилита, а не весь словарь языка.
 *
 * Поверхность выбирается по документу: в русской модели подсказки русские,
 * в английской — английские. Смешивать поверхности в одном файле нельзя.
 */
import { PHRASES, matchComparison, matchPhrase, readName } from "../outline.mjs"
import { ancestors, blockAt, blockKind, nameComplete, objectByName, quoteName, states } from "../lookup.mjs"

const Kind = { method: 2, function: 3, field: 5, class: 7, interface: 8, value: 12, keyword: 14, enumMember: 20, operator: 24 }

/** Фразы для вставки: то, что сервер печатает пользователю. */
const SURFACE = {
  ru: {
    object: "объект",
    morphism: "морфизм",
    utility: "утилита",
    theorem: "теорема",
    rule: "правило",
    property: "свойство",
    example: "пример",
    accepts: "принимает",
    returns: "возвращает",
    starts: "начинает с",
    if: "если",
    and: "и",
    thenAdd: "то добавить",
    thenResult: "то результат равен",
    given: "дано",
    expected: "ожидается",
    expectedResult: "ожидается результат равен",
    result: "результат",
    resultEquals: "результат равен",
    dataLookup: "в данных",
    byMorphism: "по морфизму",
    thenByMorphism: "затем по морфизму",
    therefore: "следовательно",
    is: "является",
    maybe: "иногда является",
    isState: "является состоянием",
    law: "по закону",
    nested: "вложен объект",
    field: "поле",
    percent: "процентов от поля",
    types: [["строкой", "Строка"], ["числом", "Число"], ["датой", "Дата"], ["деньгами", "Деньги"], ["признаком", "Признак"]],
    returnTypes: [["строку", "Строка"], ["число", "Число"], ["дату", "Дата"], ["деньги", "Деньги"], ["признак", "Признак"]],
    comparisons: ["равен", "не равен", "больше", "меньше", "не больше", "не меньше"],
    exampleComparisons: ["равно", "равен", "равна"],
    values: ["да", "нет", "ничто"],
  },
  en: {
    object: "object",
    morphism: "morphism",
    utility: "utility",
    theorem: "theorem",
    rule: "rule",
    property: "property",
    example: "example",
    accepts: "accepts",
    returns: "returns",
    starts: "starts with",
    if: "if",
    and: "and",
    thenAdd: "then add",
    thenResult: "then result equals",
    given: "given",
    expected: "expected",
    expectedResult: "expected result equals",
    result: "result",
    resultEquals: "result equals",
    dataLookup: "in data",
    byMorphism: "by morphism",
    thenByMorphism: "then by morphism",
    therefore: "therefore",
    is: "is",
    maybe: "may be",
    isState: "is state",
    law: "under law",
    nested: "nested object",
    field: "field",
    percent: "percent of field",
    types: [["string", "Строка"], ["number", "Число"], ["date", "Дата"], ["money", "Деньги"], ["boolean", "Признак"]],
    returnTypes: [["string", "Строка"], ["number", "Число"], ["date", "Дата"], ["money", "Деньги"], ["boolean", "Признак"]],
    comparisons: ["equals", "is not equal to", "is greater than", "is less than", "is at most", "is at least"],
    exampleComparisons: ["equals"],
    values: ["true", "false", "null"],
  },
}

/**
 * @param {{ outline: any }} analysis
 * @param {string} lineText полный текст строки курсора
 * @param {{ line: number, character: number }} position
 */
export function complete(analysis, lineText, position) {
  const { outline } = analysis
  if (outline.surface === "bracket") return []
  const words = SURFACE[outline.language] ?? SURFACE.ru
  const raw = lineText.slice(0, position.character)
  const indentPrefix = /^[ \t]*/u.exec(raw)?.[0] ?? ""
  const indent = [...indentPrefix].reduce((total, character) => total + (character === "\t" ? 2 : 1), 0)
  const prefix = raw.slice(indentPrefix.length)
  const chain = ancestors(outline, position.line, indent)
  const parent = chain[chain.length - 1]
  const kind = blockKind(parent)
  const items = []
  /* Остаток строки после ключевой фразы — БЕЗ обрезки хвостовых пробелов:
     пробел после имени поля и есть сигнал «имя набрано, дальше сравнение». */
  const tail = (matched) => prefix.slice(matched.restStart)
  const add = (label, itemKind, detail, insertText) => {
    items.push({ label, kind: itemKind, detail, ...(insertText && insertText !== label ? { insertText } : {}) })
  }

  const names = (nodes, itemKind, detail) => {
    for (const node of nodes) add(quoteName(node.name, outline.language), itemKind, detail(node))
  }

  const fieldsOfUtility = () => {
    const utility = blockAt(outline, position.line)
    const object = utility?.kind === "utility" ? objectByName(outline, utility.input) : null
    return object?.fields ?? []
  }

  const fieldItems = (fields) => {
    for (const field of fields) add(quoteName(field.name, outline.language), Kind.field, `${field.type}`)
  }

  const comparisonItems = (list) => {
    for (const phrase of list) add(phrase, Kind.operator, "сравнение / comparison")
  }

  const valueItems = () => {
    for (const value of words.values) add(value, Kind.value, "значение / value")
  }

  /**
   * Условие набирается в три шага: имя поля → сравнение → операнд.
   * Что предложить, видно по тому, сколько из них уже набрано.
   */
  const conditionItems = (rest, comparisons) => {
    const name = readName(rest)
    if (!name || !nameComplete(rest)) {
      fieldItems(fieldsOfUtility())
      return items
    }
    if (!matchComparison(rest.slice(name.end).trimStart())) {
      comparisonItems(comparisons)
      return items
    }
    add(words.field, Kind.keyword, "поле / field")
    add(words.percent, Kind.keyword, "процент от поля / percent of field")
    fieldItems(fieldsOfUtility())
    valueItems()
    return items
  }

  if (kind === "rule") {
    const condition = matchPhrase(prefix, PHRASES.if) ?? matchPhrase(prefix, PHRASES.and)
    const action = matchPhrase(prefix, PHRASES.thenAdd) ?? matchPhrase(prefix, PHRASES.thenResult)
    if (action) {
      add(words.field, Kind.keyword, "поле / field")
      add(words.percent, Kind.keyword, "процент от поля / percent of field")
      fieldItems(fieldsOfUtility())
      valueItems()
      return items
    }
    if (matchPhrase(prefix, PHRASES.then)) {
      add(words.thenAdd.replace(/^\S+\s/u, ""), Kind.keyword, words.thenAdd)
      add(words.thenResult.replace(/^\S+\s/u, ""), Kind.keyword, words.thenResult)
      return items
    }
    if (condition) return conditionItems(tail(condition), words.comparisons)
    add(words.if, Kind.keyword, "условие / condition")
    add(words.and, Kind.keyword, "ещё одно условие / another condition")
    add(words.thenAdd, Kind.keyword, "прибавить / add")
    add(words.thenResult, Kind.keyword, "задать результат / set result")
    return items
  }

  if (kind === "example") {
    const given = matchPhrase(prefix, PHRASES.given)
    const expected = matchPhrase(prefix, PHRASES.expected)
    if (expected) {
      if (matchPhrase(tail(expected), PHRASES.result)) {
        comparisonItems(words.exampleComparisons)
        valueItems()
      } else add(words.result, Kind.keyword, "результат / result")
      return items
    }
    if (given) return conditionItems(tail(given), words.exampleComparisons)
    add(words.given, Kind.keyword, "вход примера / example input")
    add(words.expectedResult, Kind.keyword, "ожидаемый результат / expected result")
    return items
  }

  if (kind === "property") {
    const result = matchPhrase(prefix, PHRASES.result)
    if (result) {
      comparisonItems(words.comparisons)
      add(words.percent, Kind.keyword, "процент от поля / percent of field")
      fieldItems(fieldsOfUtility())
      return items
    }
    add(words.result, Kind.keyword, "постусловие / postcondition")
    return items
  }

  if (kind === "utility") {
    const accepts = matchPhrase(prefix, PHRASES.accepts)
    const returns = matchPhrase(prefix, PHRASES.returns)
    if (accepts) {
      names(outline.objects, Kind.class, (node) => `${node.fields.length} полей / fields`)
      return items
    }
    if (returns) {
      for (const [phrase, canonical] of words.returnTypes) add(phrase, Kind.keyword, canonical)
      return items
    }
    if (matchPhrase(prefix, PHRASES.starts)) {
      valueItems()
      return items
    }
    add(words.accepts, Kind.keyword, "входной объект / input object")
    add(words.returns, Kind.keyword, "тип результата / result type")
    add(words.starts, Kind.keyword, "начальное значение / initial value")
    add(words.rule, Kind.method, "правило / rule")
    add(words.property, Kind.method, "постусловие / property")
    add(words.example, Kind.method, "исполняемый пример / executable example")
    return items
  }

  if (kind === "object") {
    const name = readName(prefix)
    if (name && nameComplete(prefix)) {
      const rest = prefix.slice(name.end).trimStart()
      const copula = matchPhrase(rest, [words.isState, words.is, words.maybe])
      if (copula) {
        if (copula.phrase === words.isState) {
          for (const state of states(outline).keys()) add(quoteName(state, outline.language), Kind.enumMember, "состояние / state")
          return items
        }
        for (const [phrase, canonical] of words.types) add(phrase, Kind.keyword, canonical)
        add(words.isState.split(" ").pop(), Kind.keyword, "состояние / state")
        return items
      }
      add(words.is, Kind.keyword, "тип поля / field type")
      add(words.maybe, Kind.keyword, "необязательное поле / optional field")
      return items
    }
    add(words.nested, Kind.keyword, "вложенный объект / nested object")
    return items
  }

  if (kind === "morphism") {
    const source = matchPhrase(prefix, PHRASES.if) ?? matchPhrase(prefix, PHRASES.then) ?? matchPhrase(prefix, PHRASES.law)
    if (source) {
      for (const state of states(outline).keys()) add(quoteName(state, outline.language), Kind.enumMember, "состояние / state")
      return items
    }
    add(words.if, Kind.keyword, "домен / domain")
    add(words.thenResult.split(" ")[0], Kind.keyword, "кодомен / codomain")
    add(words.law, Kind.keyword, "закон / law")
    return items
  }

  if (kind === "theorem") {
    const given = matchPhrase(prefix, PHRASES.given)
    const byMorphism = matchPhrase(prefix, PHRASES.byMorphism)
    const therefore = matchPhrase(prefix, PHRASES.therefore)
    if (byMorphism) {
      names(outline.morphisms, Kind.interface, (node) => `${node.domain} → ${node.codomain}`)
      return items
    }
    if (therefore) {
      for (const state of states(outline).keys()) add(quoteName(state, outline.language), Kind.enumMember, "состояние / state")
      return items
    }
    if (given) {
      const structure = readName(tail(given))
      if (structure && nameComplete(tail(given))) {
        const object = objectByName(outline, structure.value)
        if (object) fieldItems(object.fields)
        return items
      }
      names(outline.objects, Kind.class, (node) => `${node.fields.length} полей / fields`)
      return items
    }
    add(words.given, Kind.keyword, "исходный факт / given fact")
    add(words.dataLookup, Kind.keyword, "путь к данным / data path")
    add(words.byMorphism, Kind.keyword, "морфизм / morphism")
    add(words.thenByMorphism, Kind.keyword, "композиция / composition")
    add(words.therefore, Kind.keyword, "вывод / conclusion")
    return items
  }

  /* Пустой файл: единственная осмысленная строка — заголовок категории. */
  if (!parent) {
    add(outline.language === "en" ? "category" : "категория", Kind.keyword, "категория / category")
    return items
  }

  /* Верхний уровень: прямые дети категории. */
  if (kind === "category") {
    add(words.object, Kind.keyword, "объект / object")
    add(words.morphism, Kind.keyword, "морфизм / morphism")
    add(words.utility, Kind.keyword, "утилита / utility")
    add(words.theorem, Kind.keyword, "теорема / theorem")
  }
  return items
}
