import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  assertValid,
  compile,
  executeUtility,
  generateTypeScript,
  testUtilities,
} from "../../../dist/src/index.js"

export async function calculateDiscount(modelFile, inputFile) {
  const [source, inputText] = await Promise.all([
    readFile(modelFile, "utf8"),
    readFile(inputFile, "utf8"),
  ])
  const document = assertValid(compile(source))
  const tests = testUtilities(document)
  if (!tests.valid) throw new Error("FTS business examples failed")

  return {
    result: executeUtility(document, "Рассчитать скидку", JSON.parse(inputText)),
    tests: { passed: tests.passed, total: tests.total },
    generated: generateTypeScript(document).files.map((file) => file.path),
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const modelFile = resolve(process.argv[2] ?? "examples/utilities/discount.fts")
  const inputFile = resolve(process.argv[3] ?? "examples/utilities/discount.input.json")
  process.stdout.write(`${JSON.stringify(await calculateDiscount(modelFile, inputFile), null, 2)}\n`)
}
