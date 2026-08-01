#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { errorResult } from "./diagnostics.js"
import { assertVerified, certify } from "./certificate.js"
import { prove } from "./interpreter.js"
import type { FtsDocument, VisualizationMode } from "./model.js"
import { compile } from "./parser.js"
import { pipeline } from "./pipeline.js"
import { runMcpServer } from "./mcp.js"
import { validate } from "./validate.js"
import { visualize } from "./visualize.js"

interface CliOptions {
  command: string
  file: string
  contextFile?: string
  certificateFile?: string
  mode: VisualizationMode
  pretty: boolean
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
    process.stdout.write("0.1.0\n")
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
        const result = validate(compile(source))
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
  let mode: VisualizationMode = "all"
  let pretty = false

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
    } else if (arg === "--pretty") {
      pretty = true
    } else {
      positional.push(arg)
    }
  }

  const result: CliOptions = {
    command: positional[0] ?? "help",
    file: positional[1] ?? "-",
    mode,
    pretty,
  }
  if (contextFile !== undefined) result.contextFile = contextFile
  if (certificateFile !== undefined) result.certificateFile = certificateFile
  return result
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

function isMode(value: string | undefined): value is VisualizationMode {
  return value === "all" || value === "category" || value === "morphisms" || value === "functors" || value === "proof"
}

const helpText = `FTS — Formal Type Surface

Usage:
  fts compile [file|-] [--pretty]
  fts check [file|-] [--pretty]
  fts prove [file|-] [--context context.json] [--pretty]
  fts certify [file|-] [--context context.json] [--pretty]
  fts verify [file|-] --context context.json --certificate proof.json [--pretty]
  fts visualize [file|-] [--context context.json] [--mode all|category|morphisms|proof]
  fts pipeline [file|-] [--context context.json] [--mode all|category|morphisms|proof]
  fts mcp
  fts version

Commands emit JSON to stdout. Diagnostics are JSON on stderr and failures use a non-zero exit code.
`

const invokedPath = process.argv[1]
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = await main()
}
