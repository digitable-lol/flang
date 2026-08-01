import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { prove, resolvePath } from "../src/interpreter.js"
import { compile } from "../src/parser.js"

const source = `
category Board {
  structure Task { id: string
    status: string }
  proposition witness Task.status {
    selector { id: "T-1" }
    value "done"
    path ["tasks", { id: "T-1" }, "status"]
  }
}
`

describe("prove", () => {
  it("verifies a witness through a generic object/array path", () => {
    const proof = prove(compile(source), { tasks: [{ id: "T-1", status: "done" }] })
    assert.equal(proof.categorical.category, "Board")
    assert.match(proof.curry_howard.witness, /π_status/)
  })

  it("rejects a witness that does not match context", () => {
    assert.throws(() => prove(compile(source), { tasks: [{ id: "T-1", status: "todo" }] }), /witness does not match/)
  })

  it("keeps witnesses symbolic when no context is supplied", () => {
    assert.match(prove(compile(source)).proof, /Board\.Task\.status/)
  })

  it("resolves object selectors as path segments", () => {
    assert.deepEqual(resolvePath({ rows: [{ id: 7, value: "x" }] }, ["rows", { id: 7 }, "value"]), {
      found: true,
      value: "x",
    })
  })
})
