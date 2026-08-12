import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import ts from "typescript"
import type { FtsDocument, FtsUtility } from "../src/model.js"
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

/**
 * The generated TypeScript against the core, on every model in the repository.
 *
 * Why a grid and not a handful of cases: the generated file used to answer where
 * the core refuses, and it did so on the inputs nobody writes a test for — a
 * missing field, a string where a number was declared, a value the model never
 * mentions. Measured before this guard existed, 665 of 966 inputs got a
 * different answer from the two, and the worst of them were not refusals against
 * refusals but a NUMBER against a refusal: `generate` returned 2000 where the
 * core said `FTS_UTILITY_INPUT_TYPE`. Silence that looks like success is exactly
 * what the emitters elsewhere in this repository already refuse to produce
 * (`tools/ftsvm/src/jit.mjs`, `tools/ftsc/src/emit/rust.mjs`), so the
 * TypeScript path was the only one still doing it.
 *
 * The grid is built from the DECLARATION, not written by hand, so it grows with
 * the corpus instead of ageing next to it.
 */
const HOSTILE_VALUES: readonly unknown[] = [42, "строка", true, null, Number.NaN, -0, 1.5]

function inputGrid(document: FtsDocument, utility: FtsUtility): Record<string, unknown>[] {
  const fields = document.structures.find((item) => item.name === utility.input)?.fields ?? []
  const wellTyped: Record<string, unknown> = {}
  for (const field of fields) {
    const type = field.type.replace(/\s*\|\s*undefined/gu, "")
    wellTyped[field.name] = type === "Признак" ? true : type === "Строка" || type === "Дата" ? "х" : 1
  }
  const grid: Record<string, unknown>[] = utility.examples.map((example) => ({ ...example.input }))
  grid.push({ ...wellTyped }, {})
  for (const field of fields) {
    const missing = { ...wellTyped }
    delete missing[field.name]
    grid.push(missing)
    for (const value of HOSTILE_VALUES) grid.push({ ...wellTyped, [field.name]: value })
  }
  grid.push({ ...wellTyped, "поле, которого структура не объявляла": 1 })
  return grid
}

type Answer =
  | { readonly kind: "value"; readonly value: unknown }
  | { readonly kind: "refusal"; readonly code: string | null; readonly name: string; readonly message: string }

function answer(attempt: () => unknown): Answer {
  try {
    return { kind: "value", value: attempt() }
  } catch (error) {
    const failure = error as { diagnostics?: { code?: string }[]; name?: string; message?: string }
    return {
      kind: "refusal",
      code: failure.diagnostics?.[0]?.code ?? null,
      name: failure.name ?? "",
      message: failure.message ?? "",
    }
  }
}

function agrees(core: Answer, generated: Answer): boolean {
  if (core.kind !== generated.kind) return false
  if (core.kind === "value" && generated.kind === "value") return Object.is(core.value, generated.value)
  if (core.kind === "refusal" && generated.kind === "refusal") {
    /* The code is what a caller branches on, the text is what a caller reads,
       and `name` is what `instanceof`-less checks fall back to. All three. */
    return core.code === generated.code && core.message === generated.message && core.name === generated.name
  }
  return false
}

describe("generated TypeScript answers what the core answers", () => {
  it("agrees on every model in the repository, refusal codes and texts included", async () => {
    const root = new URL("../../", import.meta.url)
    const models = (await readdir(root, { recursive: true, encoding: "utf8" }))
      .filter((name) => name.endsWith(".fts"))
      .filter((name) => !name.includes("node_modules") && !name.startsWith("dist"))
      .sort()
    assert.ok(models.length > 0, "в дереве не нашлось ни одной модели — сетка стерегла бы пустоту")

    let checked = 0
    let utilities = 0
    const divergences: string[] = []

    for (const name of models) {
      let document: FtsDocument
      try {
        document = compile(await readFile(new URL(name, root), "utf8"))
      } catch {
        /* Not every `.fts` in the tree is meant to compile: `tools/ftspec` keeps
           deliberately stale models. A model the core cannot read is not a
           divergence between core and generator. */
        continue
      }
      if ((document.utilities ?? []).length === 0) continue

      const implementation = generateTypeScript(document).files
        .find((file) => file.path === "fts.utilities.ts")!.content
      const javascript = ts.transpileModule(implementation, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText
      const { ftsUtilities } = await import(
        `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
      ) as { ftsUtilities: Record<string, (input: Record<string, unknown>) => unknown> }

      for (const utility of document.utilities ?? []) {
        utilities += 1
        const generated = ftsUtilities[utility.name]
        assert.ok(generated, `${name}: напечатанное не содержит утилиты «${utility.name}»`)
        for (const input of inputGrid(document, utility)) {
          checked += 1
          const fromCore = answer(() => executeUtility(document, utility.name, input as Record<string, never>))
          const fromGenerated = answer(() => generated(input))
          if (agrees(fromCore, fromGenerated)) continue
          divergences.push(
            `${name} / «${utility.name}» / ${JSON.stringify(input)}\n` +
              `    ядро:      ${JSON.stringify(fromCore)}\n` +
              `    напечатано: ${JSON.stringify(fromGenerated)}`,
          )
        }
      }
    }

    assert.ok(utilities > 0, "ни одной утилиты не нашлось — сетка стерегла бы пустоту")
    assert.deepEqual(
      divergences,
      [],
      `напечатанный TypeScript расходится с ядром на ${divergences.length} входах из ${checked} ` +
        `(утилит ${utilities}):\n${divergences.slice(0, 10).join("\n")}`,
    )
  })
})
