/**
 * Минимальный разбор XML для тестов.
 *
 * Зачем свой: в Node нет DOMParser, а тянуть зависимость ради одной проверки
 * «SVG действительно разбирается обратно» — плохой обмен. Парсер намеренно
 * строгий: несбалансированный тег, кавычки не на месте, голый `&` или `<` в
 * тексте — исключение. Ровно те ошибки, которые может допустить генератор,
 * собирающий разметку строками.
 */

const NAME = /[A-Za-z_:][-A-Za-z0-9_:.]*/y
const ENTITY = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9A-Fa-f]+);/y

class Cursor {
  constructor(source) {
    this.source = source
    this.at = 0
  }

  fail(message) {
    const around = this.source.slice(Math.max(this.at - 30, 0), this.at + 30)
    throw new Error(`XML: ${message} на позиции ${this.at}: …${around}…`)
  }

  eat(literal) {
    if (!this.source.startsWith(literal, this.at)) return false
    this.at += literal.length
    return true
  }

  expect(literal) {
    if (!this.eat(literal)) this.fail(`ожидалось «${literal}»`)
  }

  skipSpace() {
    while (this.at < this.source.length && /\s/u.test(this.source[this.at])) this.at += 1
  }

  name() {
    NAME.lastIndex = this.at
    const match = NAME.exec(this.source)
    if (!match) this.fail("ожидалось имя")
    this.at = NAME.lastIndex
    return match[0]
  }

  /** Текст до `<`, с проверкой, что все `&` — настоящие ссылки на сущности. */
  textUntilTag() {
    const start = this.at
    while (this.at < this.source.length && this.source[this.at] !== "<") {
      if (this.source[this.at] === "&") {
        ENTITY.lastIndex = this.at
        if (!ENTITY.exec(this.source)) this.fail("голый «&» в тексте")
        this.at = ENTITY.lastIndex
        continue
      }
      this.at += 1
    }
    return this.source.slice(start, this.at)
  }
}

function parseAttributes(cursor) {
  const attributes = {}
  for (;;) {
    cursor.skipSpace()
    if (cursor.source[cursor.at] === ">" || cursor.source.startsWith("/>", cursor.at)) return attributes
    const name = cursor.name()
    cursor.skipSpace()
    cursor.expect("=")
    cursor.skipSpace()
    const quote = cursor.source[cursor.at]
    if (quote !== '"' && quote !== "'") cursor.fail("значение атрибута должно быть в кавычках")
    cursor.at += 1
    const end = cursor.source.indexOf(quote, cursor.at)
    if (end === -1) cursor.fail("незакрытая кавычка атрибута")
    if (name in attributes) cursor.fail(`атрибут «${name}» повторяется`)
    attributes[name] = cursor.source.slice(cursor.at, end)
    cursor.at = end + 1
  }
}

function parseElement(cursor) {
  cursor.expect("<")
  const name = cursor.name()
  const attributes = parseAttributes(cursor)
  if (cursor.eat("/>")) return { name, attributes, children: [], text: "" }
  cursor.expect(">")

  const children = []
  let text = ""
  for (;;) {
    text += cursor.textUntilTag()
    if (cursor.at >= cursor.source.length) cursor.fail(`тег «${name}» не закрыт`)
    if (cursor.source.startsWith("</", cursor.at)) {
      cursor.at += 2
      const closing = cursor.name()
      if (closing !== name) cursor.fail(`закрыт «${closing}», а открыт «${name}»`)
      cursor.skipSpace()
      cursor.expect(">")
      return { name, attributes, children, text }
    }
    if (cursor.source.startsWith("<!--", cursor.at)) {
      const end = cursor.source.indexOf("-->", cursor.at)
      if (end === -1) cursor.fail("незакрытый комментарий")
      cursor.at = end + 3
      continue
    }
    children.push(parseElement(cursor))
  }
}

/** Разобрать документ; бросает при любой неправильности. */
export function parseXml(source) {
  const cursor = new Cursor(source)
  cursor.skipSpace()
  if (cursor.source.startsWith("<?", cursor.at)) {
    const end = cursor.source.indexOf("?>", cursor.at)
    if (end === -1) cursor.fail("незакрытый пролог")
    cursor.at = end + 2
  }
  cursor.skipSpace()
  const root = parseElement(cursor)
  cursor.skipSpace()
  if (cursor.at !== cursor.source.length) cursor.fail("мусор после корневого элемента")
  return root
}

/** Все элементы документа в порядке обхода. */
export function elements(node, found = []) {
  found.push(node)
  for (const child of node.children) elements(child, found)
  return found
}
