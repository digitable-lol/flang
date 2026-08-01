import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { handleRequest, tools } from "../src/mcp.js"

describe("MCP server", () => {
  it("advertises all read-only tools", () => {
    assert.deepEqual(
      tools.map((tool) => tool.name),
      ["fts_compile", "fts_check", "fts_prove", "fts_visualize", "fts_certify", "fts_verify", "fts_pipeline"],
    )
    assert.ok(tools.every((tool) => tool.annotations.readOnlyHint === true))
  })

  it("negotiates the current protocol and exposes tool schemas", () => {
    const initialized = handleRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })
    assert.equal(initialized.protocolVersion, "2025-06-18")
    const listed = handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" })
    assert.equal((listed.tools as unknown[]).length, 7)
  })

  it("returns structured content from tool calls", () => {
    const result = handleRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "fts_compile",
        arguments: { source: "category C {}" },
      },
    })
    assert.equal(result.isError, false)
    assert.equal(((result.structuredContent as { document: { category: string } }).document).category, "C")
  })
})
