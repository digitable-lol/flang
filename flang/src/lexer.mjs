/**
 * flang — лексер: текст → токены.
 *
 * Почему отдельный лексер, а не построчные регулярки как в `src/natural-parser.ts`:
 * в flang появились выражения, которые не помещаются в строку (тело функции,
 * ветки `если`, случаи `разбор`), поэтому парсеру нужен поток токенов с
 * настоящими INDENT/DEDENT, а не массив `SourceLine`. Всё остальное — приёмы
 * ядра FTS дословно: имена в «ёлочках»/кавычках/одним словом, нормализация NFC,
 * табуляция шириной 2, комментарии `//` и `/* *\/`, диагностика с точным местом.
 *
 * Виды токенов:
 *   name    имя: «…», одно слово, — `value` уже нормализовано в NFC
 *   string  строка в обычных кавычках: и литерал данных, и имя (совместимость с FTS,
 *           где `category "Sales"` — это имя; парсер решает по позиции)
 *   number  IEEE-754 double в записи ядра FTS
 *   keyword ключевое слово или фраза; `value` — канонический идентификатор,
 *           `text` — исходные слова (нужен, когда слово стоит в позиции имени)
 *   punct   одиночный знак: `:` `,` `.` `{` `}` `[` `]` `(` `)` `;` `?` `<` `>`
 *   arrow   `→`, `->`, `=>`
 *   newline конец значащей строки
 *   indent / dedent  вход в блок и выход из него
 *   eof
 *
 * Ключевые слова склеиваются вторым проходом (`foldKeywords`) из уже разобранных
 * слов. Так проще, чем munch по символам: фраза «не меньше» или «отображается в
 * поле» — это несколько слов, а имя в кавычках ключевым словом стать не может
 * никогда, поэтому `«поле»` и `поле` различаются без специальных правил.
 */

const TAB_WIDTH = 2

const NAME_START = /[\p{ID_Start}_$]/u
const NAME_PART = /[\p{ID_Continue}$\u200C\u200D-]/u
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u

/** Диагностика в формате ядра FTS: `{ code, message, severity, span }`. */
export class FlangError extends Error {
  constructor(message, diagnostics) {
    super(message)
    this.name = "FlangError"
    this.diagnostics = diagnostics
  }
}

export function flangError(code, message, span) {
  const diagnostic = { code, message, severity: "error" }
  if (span !== undefined) diagnostic.span = span
  return new FlangError(message, [diagnostic])
}

/**
 * Таблица ключевых слов: канонический идентификатор → поверхности.
 * Русская и английская поверхности равноправны и дают один и тот же токен,
 * поэтому парсер ниже не знает, на каком языке написан исходник.
 */
export const KEYWORDS = {
  // ── документ и модульность ────────────────────────────────────────────────
  module: ["модуль", "module"],
  exports: ["экспортирует", "exports"],
  uses: ["использует", "uses"],
  category: ["категория", "category"],
  object: ["объект", "структура", "object", "structure"],
  record: ["запись", "record"],
  type: ["тип", "type"],
  variant: ["вариант", "variant"],
  alias: ["это"],
  nested: ["вложен объект", "вложена структура", "nested object", "nested structure"],

  // ── функции ───────────────────────────────────────────────────────────────
  total: ["тотальная", "total"],
  function: ["функция", "function"],
  accepts: ["принимает", "accepts"],
  returns: ["возвращает", "returns"],
  example: ["пример", "example"],
  given: ["дано", "given"],
  expected: ["ожидается", "expected"],

  // ── выражения ─────────────────────────────────────────────────────────────
  let: ["пусть", "let"],
  if: ["если", "if"],
  then: ["то", "then"],
  else: ["иначе", "else"],
  match: ["разбор", "match"],
  case: ["случай", "case"],
  of: ["от", "of"],
  and: ["и", "and"],
  with: ["с", "with"],
  from: ["из", "from"],
  only: ["только", "only"],
  to: ["в", "к", "to", "into", "in", "onto"],
  by: ["по", "by"],
  at: ["у", "at"],
  as: ["как", "as"],
  where: ["где", "where"],
  startingWith: ["начиная с", "starting with"],

  // ── встроенные формы ──────────────────────────────────────────────────────
  map: ["отобразить", "map"],
  filter: ["отфильтровать", "filter"],
  fold: ["свёртка", "свертка", "fold"],
  length: ["длина", "length"],
  char: ["символ", "char"],
  /* Разложение строки в список — форма из двух частей, `разложить … на
     символы`, а не одно слово «символы».
     
     Причина не в красоте. Ключевое слово запрещает имя: параметр с таким
     именем перестаёт разбираться. Слово «символы» в этой роли встретилось
     дважды в сорока файлах репозитория — и оба раза именно там, где решение
     обходилось списком, потому что этой формы не было. Резервировать его
     значило бы сломать чужой код ради своего удобства. «Разложить» в роли
     имени переменной не встречается и не ожидается.
     
     Сама форма нужна не для краткости: посимвольный проход по индексу уменьшает
     «размер минус позиция» — число, а числа анализ завершаемости частью
     значения не считает. Разложив строку в список, тот же проход становится
     рекурсией по хвосту и доказывается. */
  decompose: ["разложить", "decompose"],
  intoCharacters: ["на символы", "into characters"],
  substring: ["подстрока", "substring"],
  join: ["соединить", "join"],
  split: ["разделить", "split"],
  contains: ["содержит", "contains"],
  beginsWith: ["начинается с", "begins with"],
  toNumber: ["к числу", "to number"],
  toText: ["к строке", "to text"],
  head: ["голова", "head"],
  tail: ["хвост", "tail"],
  headTail: ["голова и хвост", "head and tail"],
  empty: ["пусто", "empty"],
  emptyList: ["пустой список", "empty list"],
  listOf: ["список из", "list of"],
  list: ["список", "list"],
  add: ["добавить", "add"],
  any: ["любое", "any"],

  // ── арифметика и сравнения ────────────────────────────────────────────────
  opAdd: ["плюс", "plus"],
  opSub: ["минус", "minus"],
  opMul: ["умножить на", "times", "multiplied by"],
  opDiv: ["делить на", "divided by"],
  opMod: ["остаток от", "modulo"],
  opPercent: ["процентов", "процента", "процент", "percent", "percents"],
  cmpEq: ["равен", "равна", "равно", "равным", "равной", "равное", "equals", "equal to"],
  cmpNeq: ["не равен", "не равна", "не равно", "is not equal to", "not equals"],
  cmpGt: ["больше", "is greater than", "greater than"],
  cmpLt: ["меньше", "is less than", "less than"],
  cmpLte: ["не больше", "is at most", "at most"],
  cmpGte: ["не меньше", "is at least", "at least"],

  // ── значения и типы ───────────────────────────────────────────────────────
  litTrue: ["да", "true", "yes"],
  litFalse: ["нет", "false", "no"],
  litNull: ["ничто", "null"],
  tNumber: ["число", "числа", "числом", "числу", "number"],
  /* «текст» и «text» намеренно не ключевые слова: это слишком частое имя поля
     (`вариант Слово содержит текст: строка` прямо из SPEC). Форму творительного
     падежа `текстом` ядро FTS понимает как тип, её и оставляем. */
  tString: ["строка", "строки", "строкой", "строку", "текстом", "string"],
  tFlag: ["признак", "признака", "признаком", "boolean", "flag"],
  tMoney: ["деньги", "деньгами", "money"],
  tDate: ["дата", "даты", "дату", "датой", "date"],
  state: ["состояние", "состоянием", "state"],
  is: ["является", "is"],
  maybeIs: ["иногда является", "may be"],

  // ── наследие FTS ──────────────────────────────────────────────────────────
  utility: ["утилита", "utility"],
  rule: ["правило", "rule"],
  property: ["свойство", "property"],
  result: ["результат", "result"],
  startsWith: ["начинает с", "starts with"],
  /* «поля» — родительный падеж из оборота «10 процентов от поля сумма»:
     ядро FTS срезает его как служебное слово, значит и здесь оно служебное. */
  field: ["поле", "поля", "field"],
  morphism: ["морфизм", "morphism"],
  /* Теоркат-поверхность (flang/cat/SPEC.md, шаг 1). Только слова: «после» —
     композиция в математическом порядке, «цепочка» с «сначала»/«затем» — она
     же в порядке чтения, потому что «в после (б после а)» читается наизнанку.
     Символов вроде «∘» здесь нет и не будет: их не набрать на клавиатуре. */
  after: ["после", "after"],
  chain: ["цепочка", "chain"],
  firstStep: ["сначала", "first"],
  nextStep: ["затем", "next"],
  identity: ["единица", "identity"],
  theorem: ["теорема", "theorem"],
  functor: ["функтор", "functor"],
  proposition: ["утверждение", "proposition"],
  has: ["имеет", "has"],
  inData: ["в данных", "in data"],
  findWhere: ["найти где", "find where"],
  byMorphism: [
    "по морфизму",
    "затем по морфизму",
    "применить морфизм",
    "затем применить морфизм",
    "by morphism",
    "then by morphism",
    "apply morphism",
    "then apply morphism",
  ],
  therefore: ["следовательно", "получаем", "therefore"],
  law: ["по закону", "under law"],
  mapsTo: ["отображается в", "maps to"],
  mapsToField: ["отображается в поле", "maps to field"],
  mapsToMorphism: ["отображается в морфизм", "maps to morphism"],
}

const PHRASES = new Map()
let MAX_PHRASE_WORDS = 1
for (const [id, phrases] of Object.entries(KEYWORDS)) {
  for (const phrase of phrases) {
    const words = phrase.split(" ")
    if (words.length > MAX_PHRASE_WORDS) MAX_PHRASE_WORDS = words.length
    /* Первая победившая фраза остаётся за своим идентификатором: таблица выше
       читается сверху вниз, поэтому конфликт виден глазами при правке. */
    if (!PHRASES.has(phrase)) PHRASES.set(phrase, id)
  }
}

/** Ключевое слово по одной поверхности — нужно тестам и парсеру для сообщений. */
export function keywordId(text) {
  return PHRASES.get(text.toLowerCase()) ?? null
}

export function tokenize(source) {
  if (typeof source !== "string") {
    throw flangError("FLANG_LEX", "исходник должен быть строкой")
  }

  const text = source.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n")
  const tokens = []
  const indents = [0]
  let offset = 0
  let line = 1
  let column = 1
  let depth = 0
  let atLineStart = true
  let lineHasTokens = false

  const here = () => ({ line, column })

  const advance = () => {
    const character = text[offset]
    offset += 1
    if (character === "\n") {
      line += 1
      column = 1
    } else {
      column += 1
    }
    return character
  }

  const push = (token) => {
    tokens.push(token)
    if (token.kind !== "indent" && token.kind !== "dedent" && token.kind !== "newline") lineHasTokens = true
  }

  const skipBlockComment = () => {
    const start = here()
    advance()
    advance()
    while (offset < text.length && !(text[offset] === "*" && text[offset + 1] === "/")) advance()
    if (offset >= text.length) throw flangError("FLANG_LEX", "не закрыт блочный комментарий", start)
    advance()
    advance()
  }

  /**
   * Начало значащей строки: измеряем отступ, пропуская пустые строки и
   * комментарии. Возвращает false, если значащих строк больше нет.
   */
  const openLine = () => {
    let width = 0
    for (;;) {
      const character = text[offset]
      if (character === undefined) return false
      if (character === " ") {
        width += 1
        advance()
        continue
      }
      if (character === "\t") {
        width += TAB_WIDTH
        advance()
        continue
      }
      if (character === "\n") {
        width = 0
        advance()
        continue
      }
      if (character === "/" && text[offset + 1] === "/") {
        while (offset < text.length && text[offset] !== "\n") advance()
        continue
      }
      if (character === "/" && text[offset + 1] === "*") {
        const before = line
        skipBlockComment()
        /* Комментарий через несколько строк обнуляет измеренный отступ:
           значащим считается отступ той строки, где стоит первый токен. */
        if (line !== before) width = 0
        continue
      }
      break
    }

    const top = indents[indents.length - 1]
    if (width > top) {
      indents.push(width)
      push({ kind: "indent", value: "", span: here() })
      return true
    }
    while (width < indents[indents.length - 1]) {
      indents.pop()
      push({ kind: "dedent", value: "", span: here() })
    }
    if (width !== indents[indents.length - 1]) {
      throw flangError(
        "FLANG_LEX",
        `рваный отступ: ${width} не совпадает ни с одним открытым уровнем (${indents.join(", ")})`,
        here(),
      )
    }
    return true
  }

  const readQuoted = (open, close) => {
    const start = here()
    advance()
    let value = ""
    let closed = false
    while (offset < text.length) {
      const character = advance()
      if (character === close) {
        closed = true
        break
      }
      if (character === "\\" && offset < text.length) {
        const escaped = advance()
        const escapes = { n: "\n", r: "\r", t: "\t", '"': '"', "'": "'", "\\": "\\" }
        if (escaped === "u") {
          const hex = text.slice(offset, offset + 4)
          if (!/^[0-9A-Fa-f]{4}$/u.test(hex)) throw flangError("FLANG_LEX", "неверный Unicode-escape", start)
          for (let index = 0; index < 4; index += 1) advance()
          value += String.fromCharCode(Number.parseInt(hex, 16))
        } else {
          value += escapes[escaped] ?? escaped
        }
        continue
      }
      value += character
    }
    if (!closed) {
      throw flangError("FLANG_LEX", open === "«" ? "не закрыта кавычка-ёлочка" : "не закрыта кавычка", start)
    }
    return { value: value.normalize("NFC"), span: start }
  }

  while (offset < text.length) {
    if (atLineStart && depth === 0) {
      if (!openLine()) break
      atLineStart = false
      continue
    }
    atLineStart = false

    const character = text[offset]

    if (character === "\n") {
      const start = here()
      advance()
      if (lineHasTokens) {
        tokens.push({ kind: "newline", value: "\n", span: start })
        lineHasTokens = false
      }
      atLineStart = true
      continue
    }
    if (character === " " || character === "\t") {
      advance()
      continue
    }
    if (character === "/" && text[offset + 1] === "/") {
      while (offset < text.length && text[offset] !== "\n") advance()
      continue
    }
    if (character === "/" && text[offset + 1] === "*") {
      skipBlockComment()
      continue
    }
    if (character === "→") {
      const start = here()
      advance()
      push({ kind: "arrow", value: "→", span: start })
      continue
    }
    if ((character === "-" || character === "=") && text[offset + 1] === ">") {
      const start = here()
      advance()
      advance()
      push({ kind: "arrow", value: "→", span: start })
      continue
    }
    if (character === "«") {
      const { value, span } = readQuoted("«", "»")
      push({ kind: "name", value, quoted: true, span })
      continue
    }
    if (character === '"' || character === "'") {
      const { value, span } = readQuoted(character, character)
      push({ kind: "string", value, quoted: true, span })
      continue
    }
    if (/\d/u.test(character) || (character === "-" && /\d/u.test(text[offset + 1] ?? ""))) {
      const start = here()
      const match = NUMBER.exec(text.slice(offset))
      if (match === null) throw flangError("FLANG_LEX", "неверное число", start)
      for (let index = 0; index < match[0].length; index += 1) advance()
      push({ kind: "number", value: Number(match[0]), text: match[0], span: start })
      continue
    }
    if (NAME_START.test(character)) {
      const start = here()
      let value = advance()
      while (offset < text.length && NAME_PART.test(text[offset])) value += advance()
      push({ kind: "name", value: value.normalize("NFC"), quoted: false, span: start })
      continue
    }
    if ("{}[]()<>:;,.?=|&+*%!".includes(character)) {
      const start = here()
      push({ kind: "punct", value: advance(), span: start })
      if (character === "{" || character === "[" || character === "(") depth += 1
      if (character === "}" || character === "]" || character === ")") depth = Math.max(0, depth - 1)
      continue
    }

    throw flangError("FLANG_LEX", `недопустимый символ '${character}'`, here())
  }

  if (lineHasTokens) tokens.push({ kind: "newline", value: "\n", span: here() })
  while (indents.length > 1) {
    indents.pop()
    tokens.push({ kind: "dedent", value: "", span: here() })
  }
  tokens.push({ kind: "eof", value: "", span: here() })

  return foldKeywords(tokens)
}

/** Склейка соседних незакавыченных слов в ключевые слова и фразы (жадно, длинные вперёд). */
function foldKeywords(tokens) {
  const result = []
  let index = 0
  while (index < tokens.length) {
    const token = tokens[index]
    if (token.kind !== "name" || token.quoted) {
      result.push(token)
      index += 1
      continue
    }
    let size = Math.min(MAX_PHRASE_WORDS, tokens.length - index)
    let id = null
    for (; size >= 1; size -= 1) {
      const run = tokens.slice(index, index + size)
      if (run.some((item) => item.kind !== "name" || item.quoted)) continue
      const found = PHRASES.get(run.map((item) => item.value.toLowerCase()).join(" "))
      if (found !== undefined) {
        id = found
        break
      }
    }
    if (id === null) {
      result.push(token)
      index += 1
      continue
    }
    const run = tokens.slice(index, index + size)
    result.push({ kind: "keyword", value: id, text: run.map((item) => item.value).join(" "), span: token.span })
    index += size
  }
  return result
}
