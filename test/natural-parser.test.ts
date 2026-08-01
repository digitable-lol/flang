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
