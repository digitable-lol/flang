import assert from "node:assert/strict"
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
})
