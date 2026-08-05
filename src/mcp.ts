#!/usr/bin/env node
import { createInterface } from "node:readline"
import { invokedDirectly } from "./invoked-directly.js"
import { errorResult } from "./diagnostics.js"
import { assertVerified, certify } from "./certificate.js"
import { prove } from "./interpreter.js"
import type { FtsDocument, FtsProofCertificate, VisualizationMode } from "./model.js"
import { compile, normalizeDocument } from "./parser.js"
import { pipeline } from "./pipeline.js"
import { executeUtility, generateTypeScript, testUtilities } from "./utility.js"
import { assertValid, validate } from "./validate.js"
import { visualize } from "./visualize.js"

const protocolVersion = "2025-06-18"

interface JsonRpcRequest {
  jsonrpc: "2.0"
  id?: string | number
  method: string
  params?: Record<string, unknown>
}

interface ToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations: Record<string, unknown>
}

class RpcError extends Error {
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

const sourceOrDocument = {
  type: "object",
  properties: {
    source: { type: "string", description: "FTS source, canonical JSON, or export default JSON" },
    document: { type: "object", description: "Canonical FTS document" },
  },
  oneOf: [{ required: ["source"] }, { required: ["document"] }],
  additionalProperties: false,
}

export const tools: ToolDefinition[] = [
  {
    name: "fts_compile",
    title: "Compile FTS",
    description: "Compile Formal Type Surface source into its canonical JSON document.",
    inputSchema: {
      type: "object",
      properties: { source: { type: "string", description: "FTS source text" } },
      required: ["source"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fts_check",
    title: "Check FTS",
    description: "Parse and semantically validate an FTS source or canonical document, returning machine-readable diagnostics.",
    inputSchema: sourceOrDocument,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fts_test",
    title: "Run FTS examples",
    description: "Execute utility examples and verify their expected results and declared properties.",
    inputSchema: sourceOrDocument,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fts_generate",
    title: "Generate utility implementation",
    description: "Generate deterministic TypeScript implementation and node:test files from FTS utilities.",
    inputSchema: sourceOrDocument,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fts_execute",
    title: "Execute an FTS utility",
    description: "Execute a named deterministic utility with scalar JSON input.",
    inputSchema: {
      ...sourceOrDocument,
      properties: {
        ...sourceOrDocument.properties,
        utility: { type: "string", description: "Utility name" },
        input: {
          type: "object",
          description: "Scalar input values keyed by FTS field name",
          additionalProperties: { type: ["string", "number", "boolean", "null"] },
        },
      },
      required: ["utility", "input"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fts_prove",
    title: "Evaluate an FTS proposition",
    description: "Build a human-readable symbolic derivation; use fts_certify and fts_verify for strict verification.",
    inputSchema: {
      ...sourceOrDocument,
      properties: {
        ...sourceOrDocument.properties,
        context: { description: "Optional JSON value used for witness path verification" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fts_visualize",
    title: "Visualize FTS",
    description: "Return Mermaid diagrams for FTS categories, morphisms, and proofs.",
    inputSchema: {
      ...sourceOrDocument,
      properties: {
        ...sourceOrDocument.properties,
        context: { description: "Optional JSON value used for witness path verification" },
        mode: { enum: ["all", "category", "morphisms", "functors", "proof"], default: "all" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fts_certify",
    title: "Create an FTS proof certificate",
    description: "Create a deterministic typed proof certificate, verified against JSON context when complete evidence is supplied.",
    inputSchema: {
      ...sourceOrDocument,
      properties: {
        ...sourceOrDocument.properties,
        context: { description: "Optional JSON evidence context; omission produces a symbolic certificate" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fts_verify",
    title: "Verify an FTS proof certificate",
    description: "Independently reconstruct and strictly verify a proof certificate against its FTS document and JSON evidence context.",
    inputSchema: {
      ...sourceOrDocument,
      properties: {
        ...sourceOrDocument.properties,
        context: { description: "JSON evidence context" },
        certificate: { type: "object", description: "FTS proof certificate to verify" },
      },
      required: ["context", "certificate"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "fts_pipeline",
    title: "Run the full FTS pipeline",
    description: "Compile, validate, prove, and visualize FTS in one deterministic call.",
    inputSchema: {
      ...sourceOrDocument,
      properties: {
        ...sourceOrDocument.properties,
        context: { description: "Optional JSON value used for witness path verification" },
        viz: { enum: ["all", "category", "morphisms", "functors", "proof"], default: "all" },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
]

export async function runMcpServer(): Promise<void> {
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
  for await (const line of input) {
    if (line.trim() === "") continue
    let request: JsonRpcRequest
    try {
      request = JSON.parse(line) as JsonRpcRequest
    } catch {
      write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })
      continue
    }

    if (request.id === undefined) continue
    try {
      const result = handleRequest(request)
      write({ jsonrpc: "2.0", id: request.id, result })
    } catch (error) {
      write({
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: error instanceof RpcError ? error.code : -32603,
          message: error instanceof Error ? error.message : String(error),
        },
      })
    }
  }
}

export function handleRequest(request: JsonRpcRequest): Record<string, unknown> {
  switch (request.method) {
    case "initialize":
      return {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "fts", title: "Formal Type Surface", version: "0.3.0" },
        instructions: "Use FTS tools to compile, check, test, generate, prove, and visualize .fts sources.",
      }
    case "ping":
      return {}
    case "tools/list":
      return { tools }
    case "tools/call": {
      const name = request.params?.name
      if (typeof name !== "string" || !tools.some((tool) => tool.name === name)) {
        throw new RpcError(-32602, `unknown tool: ${String(name)}`)
      }
      const args = isRecord(request.params?.arguments) ? request.params.arguments : {}
      return callTool(name, args)
    }
    default:
      throw new RpcError(-32601, `method not found: ${request.method}`)
  }
}

function callTool(name: string, args: Record<string, unknown>): Record<string, unknown> {
  try {
    const document = (): FtsDocument => {
      if (typeof args.source === "string") return compile(args.source)
      if (args.document !== undefined) return normalizeDocument(args.document)
      throw new Error("provide source or document")
    }

    let result: unknown
    switch (name) {
      case "fts_compile":
        if (typeof args.source !== "string") throw new Error("source must be a string")
        result = { document: compile(args.source) }
        break
      case "fts_check":
        result = validate(document())
        break
      case "fts_test":
        result = { tests: testUtilities(assertValid(document())) }
        break
      case "fts_generate":
        result = { generation: generateTypeScript(assertValid(document())) }
        break
      case "fts_execute":
        if (typeof args.utility !== "string") throw new Error("utility must be a string")
        if (!isScalarRecord(args.input)) throw new Error("input must be an object with scalar JSON values")
        result = { execution: { utility: args.utility, result: executeUtility(assertValid(document()), args.utility, args.input) } }
        break
      case "fts_prove":
        result = { proof: prove(document(), args.context) }
        break
      case "fts_visualize": {
        const doc = document()
        const proof = doc.proposition === null ? null : prove(doc, args.context)
        result = { viz: visualize(doc, proof, toMode(args.mode)) }
        break
      }
      case "fts_certify":
        result = { certificate: certify(document(), args.context) }
        break
      case "fts_verify":
        if (!isRecord(args.certificate)) throw new Error("certificate must be an object")
        result = { verification: assertVerified(document(), args.certificate as unknown as FtsProofCertificate, args.context) }
        break
      case "fts_pipeline":
        result = pipeline({
          ...(typeof args.source === "string" ? { source: args.source } : { document: document() }),
          context: args.context,
          viz: toMode(args.viz),
        })
        break
      default:
        throw new Error(`unknown tool: ${name}`)
    }
    const structuredContent = asStructuredContent(result)
    return {
      content: [{ type: "text", text: JSON.stringify(structuredContent) }],
      structuredContent,
      isError: false,
    }
  } catch (error) {
    const structuredContent = errorResult(error)
    return {
      content: [{ type: "text", text: JSON.stringify(structuredContent) }],
      structuredContent,
      isError: true,
    }
  }
}

function asStructuredContent(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : { result: value }
}

function toMode(value: unknown): VisualizationMode {
  return value === "category" || value === "morphisms" || value === "functors" || value === "proof" ? value : "all"
}

function write(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isScalarRecord(value: unknown): value is Record<string, import("./model.js").FtsScalar> {
  return isRecord(value) && Object.values(value).every(
    (item) => item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean",
  )
}

if (invokedDirectly(import.meta.url)) {
  await runMcpServer()
}
