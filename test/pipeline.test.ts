import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { pipeline } from "../src/pipeline.js"

describe("pipeline", () => {
  it("returns canonical document, proof, and Mermaid", async () => {
    const source = await readFile(new URL("../../examples/socrates.fts", import.meta.url), "utf8")
    const result = pipeline({ source })
    assert.equal(result.document.category, "ClassicalLogic")
    assert.match(result.proof?.categorical.morphism ?? "", /humanImpliesMortal/)
    assert.match(result.viz.mermaid, /flowchart/)
    assert.match(result.viz.mermaid_category, /category: ClassicalLogic/)
  })
})
