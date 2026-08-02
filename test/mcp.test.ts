import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { handleRequest, tools } from "../src/mcp.js"

describe("MCP server", () => {
  it("advertises all read-only tools", () => {
    assert.deepEqual(
      tools.map((tool) => tool.name),
      [
        "fts_compile",
        "fts_check",
        "fts_test",
        "fts_generate",
        "fts_prove",
        "fts_visualize",
        "fts_certify",
        "fts_verify",
        "fts_pipeline",
      ],
    )
    assert.ok(tools.every((tool) => tool.annotations.readOnlyHint === true))
  })

  it("negotiates the current protocol and exposes tool schemas", () => {
    const initialized = handleRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })
    assert.equal(initialized.protocolVersion, "2025-06-18")
    const listed = handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" })
    assert.equal((listed.tools as unknown[]).length, 9)
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

  it("tests and generates an executable utility for an agent", () => {
    const source = `категория «Расчёт»
      объект Вход
        число является числом
      утилита «Удвоить»
        принимает Вход
        возвращает числом
        начинает с 0
        правило «Добавить значение»
          если число не меньше 0
          то добавить поле число
        правило «Добавить ещё раз»
          если число не меньше 0
          то добавить поле число
        пример «Два»
          дано число равно 2
          ожидается результат равен 4`
    const tested = handleRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "fts_test", arguments: { source } },
    })
    assert.equal(tested.isError, false)
    assert.equal(((tested.structuredContent as { tests: { passed: number } }).tests).passed, 1)

    const generated = handleRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "fts_generate", arguments: { source } },
    })
    assert.equal(generated.isError, false)
    assert.equal(((generated.structuredContent as { generation: { files: unknown[] } }).generation).files.length, 2)
  })
})
