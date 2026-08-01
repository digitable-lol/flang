import assert from "node:assert/strict"
import { describe, it } from "node:test"
import * as browser from "../src/browser.js"

describe("browser entrypoint", () => {
  it("parses Russian UI models without exposing server certificate functions", () => {
    const document = browser.compile(`категория «Карточка клиента»
      объект «Контактные данные»
        «полное имя» является строкой
        «электронная почта» является Email`)
    assert.equal(document.category, "Карточка клиента")
    assert.equal(document.structures[0]?.fields[0]?.name, "полное имя")
    assert.equal(browser.objects(document)[0]?.name, "Контактные данные")
    assert.equal("certify" in browser, false)
    assert.equal("assertVerified" in browser, false)
  })
})
