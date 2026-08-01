import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { compile } from "../src/parser.js"

describe("compile", () => {
  it("compiles .fts syntax", async () => {
    const source = await readFile(new URL("../../examples/task-status.fts", import.meta.url), "utf8")
    const document = compile(source)
    assert.equal(document.category, "IterationSnapshot")
    assert.equal(document.structures[0]?.name, "TaskRow")
    assert.equal(document.functors[0]?.name, "statusOf")
    assert.deepEqual(document.proposition, {
      kind: "witness",
      structure: "TaskRow",
      field: "status",
      selector: { id: "MOB-1842" },
      value: "in_progress",
      path: ["tasks", { id: "MOB-1842" }, "status"],
    })
  })

  it("compiles canonical compose syntax with a nested witness", async () => {
    const source = await readFile(new URL("../../examples/socrates.fts", import.meta.url), "utf8")
    const document = compile(source)
    assert.equal(document.proposition?.kind, "compose")
    if (document.proposition?.kind !== "compose") assert.fail("expected compose")
    assert.deepEqual(document.proposition.functors, ["humanImpliesMortal"])
    assert.equal(document.proposition.arg.kind, "witness")
  })

  it("accepts canonical JSON and export default JSON", () => {
    const json = '{"category":"C","structures":[],"functors":[]}'
    assert.equal(compile(json).category, "C")
    assert.equal(compile(`export default ${json} as const`).category, "C")
  })

  it("parses Unicode escapes and numeric values without swallowing operators", () => {
    const document = compile(`category C {
      structure A { value: number }
      proposition witness A.value { selector { label: "\\u0424" } value -1.5e2 }
    }`)
    assert.equal(document.proposition?.kind, "witness")
    if (document.proposition?.kind !== "witness") assert.fail("expected witness")
    assert.deepEqual(document.proposition.selector, { label: "Ф" })
    assert.equal(document.proposition.value, -150)
  })

  it("accepts Russian keywords, quoted names, guillemets, and NFC", () => {
    const document = compile(`категория «Продажи и склад» {
      структура «Заказ клиента» { номер: Строка
        «статус оплаты»: «Заказ оплачен» }
      функтор «разрешить отгрузку»: «Заказ оплачен» -> «Отгрузка разрешена»
      утверждение применить «разрешить отгрузку» {
        свидетельство «Заказ клиента».«статус оплаты» {
          значение "да"
          путь ["заказы", { номер: "А-42" }, "статус оплаты"]
        }
      }
    }`)
    assert.equal(document.category, "Продажи и склад")
    assert.equal(document.structures[0]?.name, "Заказ клиента")
    assert.equal(document.structures[0]?.fields[1]?.name, "статус оплаты")
    assert.equal(document.functors[0]?.name, "разрешить отгрузку")
    assert.equal(document.functors[0]?.domain, "Заказ оплачен")
    assert.equal(compile("category И\u0306ога {}").category, "Йога")
  })

  it("reports source spans for invalid syntax", () => {
    assert.throws(
      () => compile("category C { nonsense X }"),
      (error: unknown) => {
        assert.equal((error as { diagnostics: Array<{ code: string }> }).diagnostics[0]?.code, "FTS_UNEXPECTED_TOKEN")
        return true
      },
    )
  })
})
