import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { certify } from "../src/certificate.js"
import { compile } from "../src/parser.js"

describe("natural Russian surface", () => {
  it("accepts the Russian structure keyword and both quote styles", () => {
    const document = compile(`категория "Каталог товаров"
      структура «Карточка товара»
        "торговое имя" является строкой`)
    assert.equal(document.category, "Каталог товаров")
    assert.equal(document.structures[0]?.name, "Карточка товара")
    assert.equal(document.structures[0]?.fields[0]?.name, "торговое имя")
  })

  it("compiles an indentation-based syllogism without structural punctuation", async () => {
    const source = await readFile(new URL("../../examples/real-world/order-shipment.fts", import.meta.url), "utf8")
    const document = compile(source)
    assert.equal(document.category, "Исполнение заказа")
    assert.equal(document.structures[0]?.name, "Заказ")
    assert.equal(document.structures[0]?.fields.at(-1)?.name, "готов к отгрузке")
    assert.equal(document.functors[0]?.name, "Готовый заказ можно отгрузить")
    assert.equal(document.proposition?.kind, "apply")
  })

  it("strictly certifies the concrete theorem", async () => {
    const source = await readFile(new URL("../../examples/real-world/order-shipment.fts", import.meta.url), "utf8")
    const context = JSON.parse(await readFile(new URL("../../examples/real-world/order-shipment.context.json", import.meta.url), "utf8"))
    const certificate = certify(compile(source), context)
    assert.equal(certificate.status, "verified")
    assert.equal(certificate.conclusion.type, "Отгрузить заказ разрешено")
    assert.match(certificate.assumptions[0] ?? "", /morphism\.declared/)
  })

  it("rejects a theorem whose stated conclusion differs from its derivation", () => {
    assert.throws(
      () => compile(`категория «Проверка»
        объект Заказ
          готовность является состоянием «Готов»
        морфизм «Разрешить»
          если «Готов»
          то «Разрешено»
        теорема «Ошибка»
          дано Заказ имеет готовность равное да
          в данных заказы найти где номер равен «1»
          по морфизму «Разрешить»
          следовательно «Запрещено»`),
      /вывод имеет тип «Разрешено»/,
    )
  })

  it("composes multiple morphisms in the written order", async () => {
    const source = await readFile(new URL("../../examples/real-world/credit-limit.fts", import.meta.url), "utf8")
    const document = compile(source)
    assert.equal(document.proposition?.kind, "compose")
    if (document.proposition?.kind !== "compose") assert.fail("expected compose")
    assert.deepEqual(document.proposition.functors, [
      "Пройденный скоринг открывает риск-проверку",
      "Успешная риск-проверка разрешает лимит",
    ])
  })
})

describe("natural English surface", () => {
  it("compiles to the same canonical utility model as Russian", () => {
    const english = compile(`category "Sales"
      object Purchase
        amount is money
        "loyal customer" is boolean

      utility "Calculate discount"
        accepts Purchase
        returns money
        starts with 0

        rule "Large purchase"
          if amount is at least 10000
          then add 10 percent of field amount

        property "Discount is capped"
          result is at most 20 percent of field amount

        example "Twenty thousand purchase"
          given amount equals 20000
          given "loyal customer" equals false
          expected result equals 2000`)

    assert.equal(english.category, "Sales")
    assert.equal(english.structures[0]?.fields[0]?.type, "Деньги")
    assert.equal(english.structures[0]?.fields[1]?.type, "Признак")
    assert.equal(english.utilities?.[0]?.output, "Деньги")
    assert.equal(english.utilities?.[0]?.rules[0]?.when[0]?.operator, "gte")
    assert.equal(english.utilities?.[0]?.examples[0]?.expected, 2000)
  })

  it("supports English morphisms and concrete theorems without braces", () => {
    const document = compile(`category "Order execution"
      object Order
        number is string
        ready is state "Ready to ship"

      morphism "Ready order can ship"
        if "Ready to ship"
        then "Shipping allowed"

      theorem "Order A-1 can ship"
        given Order has ready equal to true
        in data orders find where number equals "A-1"
        by morphism "Ready order can ship"
        therefore "Shipping allowed"`)

    assert.equal(document.category, "Order execution")
    assert.equal(document.functors[0]?.domain, "Ready to ship")
    assert.equal(document.proposition?.kind, "apply")
  })
})
