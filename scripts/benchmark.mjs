import { performance } from "node:perf_hooks"
import process from "node:process"
import { cpus, totalmem } from "node:os"
import ts from "typescript"
import {
  assertValid,
  compile,
  executeUtility,
  generateTypeScript,
  testUtilities,
  validate,
} from "../dist/src/index.js"

const quick = process.argv.includes("--quick")
const scales = quick ? [10, 100] : [10, 100, 1000]
const results = []

for (const scale of scales) {
  const modelSource = createSource({ fields: scale, rules: scale, examples: 1 })
  const modelDocument = assertValid(compile(modelSource))
  const ruleSource = createSource({ fields: 2, rules: scale, examples: 1 })
  const ruleDocument = assertValid(compile(ruleSource))
  const exampleSource = createSource({ fields: 2, rules: 10, examples: scale })
  const exampleDocument = assertValid(compile(exampleSource))
  const iterations = quick ? (scale === 10 ? 20 : 8) : scale === 10 ? 100 : scale === 100 ? 50 : 20

  results.push(measure("compile", scale, modelSource.length, iterations, () => compile(modelSource)))
  results.push(measure("validate", scale, modelSource.length, iterations, () => validate(modelDocument)))
  results.push(measure("execute", scale, ruleSource.length, iterations, () =>
    executeUtility(ruleDocument, "Суммировать правила", { значение: 1, ...fieldInput(2) }),
  ))
  const generation = generateTypeScript(ruleDocument)
  results.push({
    ...measure("generate_typescript", scale, ruleSource.length, iterations, () => generateTypeScript(ruleDocument)),
    generated_bytes: generation.files.reduce((sum, file) => sum + Buffer.byteLength(file.content), 0),
  })
  results.push(measure("transpile_generated_typescript", scale, ruleSource.length, iterations, () => {
    for (const file of generation.files) {
      ts.transpileModule(file.content, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
    }
  }))
  results.push(measure("test_examples", scale, exampleSource.length, iterations, () => testUtilities(exampleDocument)))
}

process.stdout.write(`${JSON.stringify({
  schema: "fts-benchmark/1",
  generated_at: new Date().toISOString(),
  runtime: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: cpus()[0]?.model ?? "unknown",
    logical_cores: cpus().length,
    memory_bytes: totalmem(),
  },
  mode: quick ? "quick" : "full",
  units: { latency: "milliseconds", throughput: "operations/second" },
  methodology: {
    samples_are_normalized_batches: true,
    minimum_batch_time_ms: 2,
    warmup_calls: 5,
    execute_scale: "number of rules; all rules match",
    compile_and_validate_scale: "number of fields and rules",
    transpile_scale: "generated implementation and test source for the number of rules",
    test_examples_scale: "number of examples; utility has 10 matching rules",
  },
  results,
}, null, 2)}\n`)

function measure(operation, scale, sourceBytes, iterations, operationCall) {
  for (let index = 0; index < 5; index += 1) operationCall()
  let batchSize = 1
  while (batchSize < 16384) {
    const start = performance.now()
    for (let index = 0; index < batchSize; index += 1) operationCall()
    if (performance.now() - start >= 2) break
    batchSize *= 2
  }
  const samples = []
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now()
    for (let batch = 0; batch < batchSize; batch += 1) operationCall()
    samples.push((performance.now() - start) / batchSize)
  }
  samples.sort((left, right) => left - right)
  const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length
  return {
    operation,
    scale,
    source_bytes: sourceBytes,
    iterations,
    batch_size: batchSize,
    mean_ms: round(mean),
    median_ms: round(percentile(samples, 0.5)),
    p95_ms: round(percentile(samples, 0.95)),
    ops_per_second: round(1000 / mean),
  }
}

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]
}

function round(value) {
  return Number(value.toFixed(4))
}

function fieldInput(count) {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [`поле ${index + 1}`, index]))
}

function createSource({ fields, rules, examples }) {
  const lines = [
    "категория «Benchmark»",
    "",
    "  объект Вход",
    "    значение является числом",
  ]
  for (let index = 0; index < fields; index += 1) lines.push(`    «поле ${index + 1}» является числом`)
  lines.push(
    "",
    "  утилита «Суммировать правила»",
    "    принимает Вход",
    "    возвращает число",
    "    начинает с 0",
  )
  for (let index = 0; index < rules; index += 1) {
    lines.push(
      "",
      `    правило «Правило ${index + 1}»`,
      "      если значение не меньше 0",
      "      то добавить 1",
    )
  }
  lines.push(
    "",
    "    свойство «Результат ограничен»",
    `      результат не больше ${rules}`,
  )
  for (let index = 0; index < examples; index += 1) {
    lines.push(
      "",
      `    пример «Пример ${index + 1}»`,
      `      дано значение равно ${index}`,
    )
    for (let field = 0; field < fields; field += 1) lines.push(`      дано «поле ${field + 1}» равно ${field}`)
    lines.push(`      ожидается результат равен ${rules}`)
  }
  return `${lines.join("\n")}\n`
}
