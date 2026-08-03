import assert from "node:assert/strict"
import test from "node:test"

import { FlangError, keywordId, tokenize } from "../src/lexer.mjs"

const kinds = (source) => tokenize(source).map((token) => token.kind)
const values = (source) => tokenize(source).filter((token) => token.kind !== "eof").map((token) => token.value)

function lexError(source) {
  try {
    tokenize(source)
  } catch (error) {
    assert.ok(error instanceof FlangError, `ожидалась FlangError, получено ${error}`)
    return error.diagnostics[0]
  }
  return assert.fail(`ожидалась ошибка лексера для: ${source}`)
}

test("отступ открывает и закрывает блок", () => {
  assert.deepEqual(kinds("объект X\n  цена является числом\n"), [
    "keyword",
    "name",
    "newline",
    "indent",
    "name",
    "keyword",
    "keyword",
    "newline",
    "dedent",
    "eof",
  ])
})

test("вложенные блоки закрываются по одному DEDENT на уровень", () => {
  const source = "утилита «У»\n  правило «П»\n    если поле равен 1\nобъект X\n"
  const dedents = tokenize(source).filter((token) => token.kind === "dedent")
  assert.equal(dedents.length, 2)
})

test("пустые строки и строки-комментарии не участвуют в отступах", () => {
  const source = "объект X\n\n  // комментарий\n\n  поле является числом\n"
  assert.equal(kinds(source).filter((kind) => kind === "indent").length, 1)
  assert.equal(kinds(source).filter((kind) => kind === "newline").length, 2)
})

test("рваный отступ — это FLANG_LEX с точным местом", () => {
  const diagnostic = lexError("объект X\n    цена является числом\n  вес является числом\n")
  assert.equal(diagnostic.code, "FLANG_LEX")
  assert.match(diagnostic.message, /рваный отступ/u)
  assert.deepEqual(diagnostic.span, { line: 3, column: 3 })
})

test("табуляция считается шириной два, как в ядре FTS", () => {
  assert.deepEqual(kinds("объект X\n\tполе является числом\n").slice(2, 4), ["newline", "indent"])
})

test("имя пишется ёлочками, обычными кавычками или одним словом", () => {
  const tokens = tokenize("«Строка счёта» \"Строка счёта\" Заказ\n").filter((token) => token.kind !== "eof")
  assert.equal(tokens[0].kind, "name")
  assert.equal(tokens[0].value, "Строка счёта")
  assert.equal(tokens[0].quoted, true)
  assert.equal(tokens[1].kind, "string")
  assert.equal(tokens[1].value, "Строка счёта")
  assert.equal(tokens[2].kind, "name")
  assert.equal(tokens[2].quoted, false)
})

test("имя в кавычках никогда не становится ключевым словом", () => {
  const [quoted, bare] = tokenize("«поле» поле\n")
  assert.equal(quoted.kind, "name")
  assert.equal(bare.kind, "keyword")
  assert.equal(bare.value, "field")
})

test("имена нормализуются в NFC", () => {
  const composed = tokenize("«счёт»\n")[0]
  const decomposed = tokenize("«счёт»\n".normalize("NFD"))[0]
  assert.equal(decomposed.value, composed.value)
  assert.equal(decomposed.value, "счёт")
})

test("числа разбираются в IEEE-754 double", () => {
  assert.deepEqual(values("0 -7 12.5 1e3 -0.25\n").slice(0, 5), [0, -7, 12.5, 1000, -0.25])
})

test("строковый литерал понимает экранирование", () => {
  assert.deepEqual(values('"a\\nb" "кавычка \\" внутри"\n').slice(0, 2), ["a\nb", 'кавычка " внутри'])
})

test("комментарии // и /* */ выбрасываются", () => {
  assert.deepEqual(values("объект X // хвост строки\n/* блок\n   через строки */\n"), ["object", "X", "\n"])
})

test("комментарий внутри строки остаётся данными", () => {
  assert.deepEqual(values('"http://пример"\n').slice(0, 1), ["http://пример"])
})

test("каждый токен несёт span со строкой и колонкой", () => {
  const tokens = tokenize("объект X\n  цена является числом\n")
  assert.deepEqual(tokens[0].span, { line: 1, column: 1 })
  assert.deepEqual(tokens[1].span, { line: 1, column: 8 })
  const price = tokens.find((token) => token.value === "цена")
  assert.deepEqual(price.span, { line: 2, column: 3 })
})

test("многословные ключевые слова склеиваются в один токен", () => {
  const pairs = [
    ["не меньше", "cmpGte"],
    ["не больше", "cmpLte"],
    ["не равен", "cmpNeq"],
    ["голова и хвост", "headTail"],
    ["отображается в поле", "mapsToField"],
    ["затем по морфизму", "byMorphism"],
    ["начинает с", "startsWith"],
    ["начиная с", "startingWith"],
    ["в данных", "inData"],
    ["is at least", "cmpGte"],
    ["maps to morphism", "mapsToMorphism"],
  ]
  for (const [phrase, id] of pairs) {
    const [token] = tokenize(`${phrase}\n`)
    assert.equal(token.kind, "keyword", phrase)
    assert.equal(token.value, id, phrase)
    assert.equal(token.text, phrase)
  }
})

test("длинная фраза выигрывает у короткой", () => {
  assert.equal(tokenize("отображается в поле a\n")[0].value, "mapsToField")
  assert.equal(tokenize("отображается в «Б»\n")[0].value, "mapsTo")
  assert.equal(tokenize("голова и хвост\n")[0].value, "headTail")
  assert.equal(tokenize("голова г и хвост х\n")[0].value, "head")
})

test("русская и английская поверхности дают один идентификатор", () => {
  assert.equal(keywordId("функция"), keywordId("function"))
  assert.equal(keywordId("свёртка"), keywordId("fold"))
  assert.equal(keywordId("не меньше"), keywordId("is at least"))
  assert.equal(keywordId("вложен объект"), keywordId("nested object"))
})

test("стрелка пишется как → или ->", () => {
  assert.equal(tokenize("a → b\n")[1].kind, "arrow")
  assert.equal(tokenize("a -> b\n")[1].kind, "arrow")
  assert.equal(tokenize("a -> b\n")[1].value, "→")
})

test("внутри скобок отступы не значимы", () => {
  const tokens = tokenize("path [\n  1,\n  2\n]\n")
  assert.equal(tokens.filter((token) => token.kind === "indent").length, 0)
})

test("незакрытая кавычка и незакрытый комментарий — FLANG_LEX", () => {
  assert.match(lexError("«без конца\n").message, /ёлочка/u)
  assert.equal(lexError('"без конца\n').code, "FLANG_LEX")
  assert.match(lexError("/* без конца\n").message, /комментарий/u)
})

test("недопустимый символ сообщает своё место", () => {
  const diagnostic = lexError("объект X\n  @\n")
  assert.equal(diagnostic.code, "FLANG_LEX")
  assert.deepEqual(diagnostic.span, { line: 2, column: 3 })
})

test("файл заканчивается newline, DEDENT и EOF", () => {
  const tail = kinds("объект X\n  поле является числом").slice(-3)
  assert.deepEqual(tail, ["newline", "dedent", "eof"])
})
