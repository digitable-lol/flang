import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { compile } from "../src/parser.js"
import { validate } from "../src/validate.js"

describe("validate", () => {
  it("validates declared structures, fields, and functors", () => {
    const result = validate(
      compile(`
        category Logic {
          structure A { truth: boolean }
          functor lift: A -> B
          proposition apply lift {
            witness A.truth { value true }
          }
        }
      `),
    )
    assert.equal(result.valid, true)
    assert.deepEqual(result.diagnostics, [])
  })

  it("returns stable JSON paths for semantic failures", () => {
    const result = validate({
      category: "C",
      structures: [{ name: "A", fields: [{ name: "x", type: "string" }] }],
      functors: [],
      proposition: { kind: "witness", structure: "A", field: "missing" },
    })
    assert.equal(result.valid, false)
    assert.equal(result.diagnostics[0]?.code, "FTS_UNKNOWN_FIELD")
    assert.equal(result.diagnostics[0]?.path, "$.proposition.field")
  })

  it("validates Unicode identifiers used by Russian domain models", () => {
    const result = validate(
      compile(`category Склад {
        structure Остаток { доступен: Доступен }
        proposition witness Остаток.доступен { value true }
      }`),
    )
    assert.equal(result.valid, true)
    assert.deepEqual(result.diagnostics, [])
  })

  it("publishes the same Unicode rule in the canonical JSON schema", async () => {
    const schema = JSON.parse(await readFile(new URL("../../schema/document.schema.json", import.meta.url), "utf8"))
    const pattern = new RegExp(schema.$defs.identifier.pattern, "u")
    assert.equal(pattern.test("КредитнаяПолитика"), true)
    assert.equal(pattern.test("статусОплаты"), true)
    assert.equal(pattern.test("не валидно"), false)
  })
})
