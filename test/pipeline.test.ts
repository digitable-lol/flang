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

  it("keeps Russian labels and generates distinct Mermaid node ids", () => {
    const result = pipeline({
      source: `category Логистика {
        structure Заказ { номер: string }
        structure Склад { код: string }
      }`,
    })
    assert.match(result.viz.mermaid_category, /category: Логистика/)
    assert.match(result.viz.mermaid_category, /structure Заказ/)
    assert.match(result.viz.mermaid_category, /structure Склад/)
    const ids = [...result.viz.mermaid_category.matchAll(/^\s+(n_[^\[]+)\[/gm)].map((match) => match[1])
    assert.equal(new Set(ids).size, 2)
  })

  it("uses morphisms as the public visualization mode", async () => {
    const source = await readFile(new URL("../../examples/real-world/order-shipment.fts", import.meta.url), "utf8")
    const result = pipeline({ source, viz: "morphisms" })
    assert.match(result.viz.mermaid, /morphisms/)
    assert.doesNotMatch(result.viz.mermaid, /category:/)
  })
})
