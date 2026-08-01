import assert from "node:assert/strict"
import { describe, it } from "node:test"
import * as browser from "../src/browser.js"

describe("browser entrypoint", () => {
  it("parses Russian UI models without exposing server certificate functions", () => {
    const document = browser.compile(`категория «Карточка клиента» {
      структура «Контактные данные» {
        «полное имя»: Строка
        «электронная почта»: Email
      }
    }`)
    assert.equal(document.category, "Карточка клиента")
    assert.equal(document.structures[0]?.fields[0]?.name, "полное имя")
    assert.equal("certify" in browser, false)
    assert.equal("assertVerified" in browser, false)
  })
})
