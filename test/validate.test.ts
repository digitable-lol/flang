import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { compile } from "../src/parser.js"
import { validate } from "../src/validate.js"

describe("validate", () => {
  it("validates declared structures, fields, and functors", () => {
    /* `lift` is declared over `boolean` because that is what the witness
       produces: `A.truth` has type `boolean`, and `certify` composes the chain
       by exactly this rule. The earlier fixture declared `lift: A -> B` and
       therefore could not be certified at all — `certify` rejected it with
       FTS_PROOF_TYPE_MISMATCH while `check` stayed silent. That silence is now
       a diagnostic of its own, exercised in the test below, so the fixture
       here is a document that really is clean. */
    const result = validate(
      compile(`
        category Logic {
          structure A { truth: boolean }
          functor lift: boolean -> B
          proposition apply lift {
            witness A.truth { value true }
          }
        }
      `),
    )
    assert.equal(result.valid, true)
    assert.deepEqual(result.diagnostics, [])
  })

  it("warns when a morphism cannot receive what the witness produces", () => {
    const source = `
        category Logic {
          structure A { truth: boolean }
          functor lift: A -> B
          proposition apply lift {
            witness A.truth { value true }
          }
        }
      `
    const result = validate(compile(source))

    /* A composition that does not compose does not make the document
       malformed — every declaration in it is well formed — so it is a warning
       and `valid` stays true. It is still worth saying: `certify` refuses this
       exact document, and until now nothing said so before it did. */
    assert.equal(result.valid, true)
    const mismatch = result.diagnostics.find((item) => item.code === "FTS_COMPOSE_MISMATCH")
    assert.ok(mismatch, "composition mismatch is reported")
    assert.equal(mismatch.severity, "warning")
    assert.match(mismatch.message, /'lift' expects 'A', receives 'boolean'/u)
    assert.ok(mismatch.hint?.includes("FTS_PROOF_TYPE_MISMATCH"))
    assert.equal(mismatch.span?.start.line, 5, "points at the proposition that carries the chain")
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
      compile(`категория «Управление складом» {
        структура «Остаток товара» { «доступен для заказа»: «Товар доступен» }
        утверждение свидетельство «Остаток товара».«доступен для заказа» { значение true }
      }`),
    )
    assert.equal(result.valid, true)
    assert.deepEqual(result.diagnostics, [])
  })

  it("publishes the same Unicode rule in the canonical JSON schema", async () => {
    const schema = JSON.parse(await readFile(new URL("../../schema/document.schema.json", import.meta.url), "utf8"))
    const pattern = new RegExp(schema.$defs.identifier.pattern, "u")
    assert.equal(pattern.test("Кредитная политика"), true)
    assert.equal(pattern.test("статус оплаты"), true)
    assert.equal(pattern.test(" не валидно"), false)
  })
})
