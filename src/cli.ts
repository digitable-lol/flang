#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { invokedDirectly } from "./invoked-directly.js"
import { errorResult } from "./diagnostics.js"
import { assertVerified, certify } from "./certificate.js"
import { prove } from "./interpreter.js"
import type { FtsDocument, VisualizationMode } from "./model.js"
import { compile } from "./parser.js"
import { pipeline } from "./pipeline.js"
import { runMcpServer } from "./mcp.js"
import { executeUtility, generateTypeScript, testUtilities } from "./utility.js"
import { assertValid, validate } from "./validate.js"
import { visualize } from "./visualize.js"

interface CliOptions {
  command: string
  file: string
  contextFile?: string
  certificateFile?: string
  outDir?: string
  utilityName?: string
  inputFile?: string
  mode: VisualizationMode
  pretty: boolean
  coverage: boolean
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  let options: CliOptions
  try {
    options = parseArgs(argv)
  } catch (error) {
    writeJson(errorResult(error), false, process.stderr)
    return 2
  }
  if (options.command === "help" || options.command === "--help" || options.command === "-h") {
    process.stdout.write(helpText)
    return 0
  }
  if (options.command === "version" || options.command === "--version" || options.command === "-v") {
    process.stdout.write("0.3.0\n")
    return 0
  }
  if (options.command === "mcp") {
    await runMcpServer()
    return 0
  }

  try {
    const source = await readInput(options.file)
    const context = options.contextFile === undefined ? undefined : JSON.parse(await readInput(options.contextFile))
    const certificate = options.certificateFile === undefined ? undefined : JSON.parse(await readInput(options.certificateFile))
    let output: unknown
    switch (options.command) {
      case "compile":
        output = compile(source)
        break
      case "check": {
        const result = validate(compile(source), { coverage: options.coverage })
        output = result
        if (!result.valid) {
          writeJson(output, options.pretty, process.stderr)
          return 1
        }
        break
      }
      case "prove":
        output = prove(compile(source), context)
        break
      case "certify":
        output = certify(compile(source), context)
        break
      case "verify":
        if (certificate === undefined) throw new Error("verify requires --certificate proof.json")
        output = assertVerified(compile(source), certificate, context)
        break
      case "visualize": {
        const document = compile(source)
        const proof = document.proposition === null ? null : prove(document, context)
        output = visualize(document, proof, options.mode)
        break
      }
      case "pipeline":
        output = pipeline({ source, context, viz: options.mode })
        break
      case "generate":
        output = await emitGeneration(generateTypeScript(assertValid(compile(source))), options.outDir)
        break
      case "test": {
        const result = testUtilities(assertValid(compile(source)))
        output = result
        if (!result.valid) {
          writeJson(output, options.pretty, process.stderr)
          return 1
        }
        break
      }
      case "run": {
        if (options.utilityName === undefined) throw new Error("run requires --utility name")
        if (options.inputFile === undefined) throw new Error("run requires --input input.json")
        const input = parseUtilityInput(JSON.parse(await readInput(options.inputFile)))
        output = {
          utility: options.utilityName,
          result: executeUtility(assertValid(compile(source)), options.utilityName, input),
        }
        break
      }
      default:
        process.stderr.write(`unknown command '${options.command}'\n\n${helpText}`)
        return 2
    }
    writeJson(output, options.pretty, process.stdout)
    return 0
  } catch (error) {
    writeJson(errorResult(error), options.pretty, process.stderr)
    return 1
  }
}

function parseArgs(argv: string[]): CliOptions {
  const positional: string[] = []
  let contextFile: string | undefined
  let certificateFile: string | undefined
  let outDir: string | undefined
  let utilityName: string | undefined
  let inputFile: string | undefined
  let mode: VisualizationMode = "all"
  let pretty = false
  let coverage = true

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!
    if (arg === "--context") {
      contextFile = argv[++index]
      if (contextFile === undefined) throw new Error("--context requires a JSON file")
    } else if (arg === "--certificate") {
      certificateFile = argv[++index]
      if (certificateFile === undefined) throw new Error("--certificate requires a JSON file")
    } else if (arg === "--mode") {
      const candidate = argv[++index]
      if (!isMode(candidate)) throw new Error("--mode must be all, category, morphisms, or proof")
      mode = candidate
    } else if (arg === "--out") {
      outDir = argv[++index]
      if (outDir === undefined) throw new Error("--out requires a directory")
    } else if (arg === "--utility") {
      utilityName = argv[++index]
      if (utilityName === undefined) throw new Error("--utility requires a name")
    } else if (arg === "--input") {
      inputFile = argv[++index]
      if (inputFile === undefined) throw new Error("--input requires a JSON file")
    } else if (arg === "--pretty") {
      pretty = true
    } else if (arg === "--no-coverage") {
      coverage = false
    } else {
      positional.push(arg)
    }
  }

  const result: CliOptions = {
    command: positional[0] ?? "help",
    file: positional[1] ?? "-",
    mode,
    pretty,
    coverage,
  }
  if (!coverage && result.command !== "check") throw new Error("--no-coverage is available only for check")
  if (outDir !== undefined && result.command !== "generate") throw new Error("--out is available only for generate")
  if (utilityName !== undefined && result.command !== "run") throw new Error("--utility is available only for run")
  if (inputFile !== undefined && result.command !== "run") throw new Error("--input is available only for run")
  if (contextFile !== undefined) result.contextFile = contextFile
  if (certificateFile !== undefined) result.certificateFile = certificateFile
  if (outDir !== undefined) result.outDir = outDir
  if (utilityName !== undefined) result.utilityName = utilityName
  if (inputFile !== undefined) result.inputFile = inputFile
  return result
}

function parseUtilityInput(value: unknown): Record<string, import("./model.js").FtsScalar> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("utility input must be a JSON object")
  }
  for (const [field, item] of Object.entries(value)) {
    if (item !== null && typeof item !== "string" && typeof item !== "number" && typeof item !== "boolean") {
      throw new Error(`utility input field '${field}' must be a scalar JSON value`)
    }
  }
  return value as Record<string, import("./model.js").FtsScalar>
}

async function readInput(file: string): Promise<string> {
  if (file !== "-") return readFile(file, "utf8")
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString("utf8")
}

function writeJson(value: unknown, pretty: boolean, stream: NodeJS.WritableStream): void {
  stream.write(`${JSON.stringify(value, null, pretty ? 2 : 0)}\n`)
}

async function emitGeneration(generation: ReturnType<typeof generateTypeScript>, outDir: string | undefined): Promise<unknown> {
  if (outDir === undefined) return generation
  const directory = resolve(outDir)
  await mkdir(directory, { recursive: true })
  for (const file of generation.files) await writeFile(join(directory, file.path), file.content, "utf8")
  return {
    target: generation.target,
    utilities: generation.utilities,
    files: generation.files.map((file) => join(directory, file.path)),
  }
}

function isMode(value: string | undefined): value is VisualizationMode {
  return value === "all" || value === "category" || value === "morphisms" || value === "functors" || value === "proof"
}

const helpText = `FTS — Formal Type Surface

Usage:
  fts compile [file|-] [--pretty]
  fts check [file|-] [--pretty] [--no-coverage]
  fts prove [file|-] [--context context.json] [--pretty]
  fts certify [file|-] [--context context.json] [--pretty]
  fts verify [file|-] --context context.json --certificate proof.json [--pretty]
  fts visualize [file|-] [--context context.json] [--mode all|category|morphisms|proof]
  fts pipeline [file|-] [--context context.json] [--mode all|category|morphisms|proof]
  fts generate [file|-] [--out directory] [--pretty]
  fts test [file|-] [--pretty]
  fts run [file|-] --utility name --input input.json [--pretty]
  fts mcp
  fts version

Commands emit JSON to stdout. Diagnostics are JSON on stderr and failures use a non-zero exit code.

check also reads the input space of every utility: holes in rule coverage, overlaps whose
outcome depends on declaration order, property limits no input ever reaches. Those are
warnings — they never make a document invalid. --no-coverage turns the analysis off.
`

if (invokedDirectly(import.meta.url)) {
  process.exitCode = await main()
}
