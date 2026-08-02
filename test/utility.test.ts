import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import ts from "typescript"
import type { FtsDocument } from "../src/model.js"
import { compile } from "../src/parser.js"
import { executeUtility, generateTypeScript, testUtilities } from "../src/utility.js"
import { validate } from "../src/validate.js"

async function discountDocument(): Promise<FtsDocument> {
  const source = await readFile(new URL("../../examples/utilities/discount.fts", import.meta.url), "utf8")
  return compile(source)
}

describe("executable utilities", () => {
  it("parses and executes Russian rules in their written order", async () => {
    const document = await discountDocument()
    assert.equal(document.utilities?.[0]?.name, "Рассчитать скидку")
    assert.equal(executeUtility(document, "Рассчитать скидку", { сумма: 20_000, "постоянный клиент": true }), 3_000)
  })

  it("runs authored examples as deterministic specification tests", async () => {
    const result = testUtilities(await discountDocument())
    assert.deepEqual({ valid: result.valid, total: result.total, passed: result.passed }, { valid: true, total: 3, passed: 3 })
  })

  it("reports an example that contradicts the generated behavior", async () => {
    const document = structuredClone(await discountDocument())
    document.utilities![0]!.examples[1]!.expected = 999
    const result = testUtilities(document)
    assert.equal(result.valid, false)
    assert.equal(result.results[1]?.actual, 2_000)
  })

  it("rejects unknown fields before generation", async () => {
    const document = structuredClone(await discountDocument())
    document.utilities![0]!.rules[0]!.when[0]!.field = "несуществующее поле"
    const result = validate(document)
    assert.equal(result.valid, false)
    assert.equal(result.diagnostics[0]?.code, "FTS_UTILITY_FIELD")
  })

  it("generates executable TypeScript and node:test source", async () => {
    const generation = generateTypeScript(await discountDocument())
    const implementation = generation.files.find((file) => file.path === "fts.utilities.ts")?.content
    const tests = generation.files.find((file) => file.path === "fts.utilities.test.ts")?.content
    assert.ok(implementation)
    assert.match(tests ?? "", /node:test/)

    const javascript = ts.transpileModule(implementation, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const generated = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`) as {
      ftsUtilities: Record<string, (input: Record<string, unknown>) => unknown>
    }
    assert.equal(generated.ftsUtilities["Рассчитать скидку"]?.({ сумма: 20_000, "постоянный клиент": true }), 3_000)
  })

  it("turns a violated property into a runtime failure", async () => {
    const document = structuredClone(await discountDocument())
    document.utilities![0]!.rules.push({
      name: "Ошибочное правило",
      when: [{ field: "сумма", operator: "gte", value: { kind: "value", value: 0 } }],
      action: { kind: "add", value: { kind: "percent", percent: 50, field: "сумма" } },
    })
    assert.throws(
      () => executeUtility(document, "Рассчитать скидку", { сумма: 20_000, "постоянный клиент": false }),
      /Скидка ограничена/,
    )
  })
})
