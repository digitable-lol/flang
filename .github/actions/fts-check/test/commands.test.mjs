import { test } from "node:test"
import assert from "node:assert/strict"

import { escapeData, escapeProperty, formatCommand } from "../lib/commands.mjs"

test("escapeData escapes % first, then \\r, then \\n", () => {
  assert.equal(escapeData("100%"), "100%25")
  assert.equal(escapeData("line1\rline2"), "line1%0Dline2")
  assert.equal(escapeData("line1\nline2"), "line1%0Aline2")
  // if % were escaped after \r/\n, this would double-escape the %0D it just produced
  assert.equal(escapeData("100%\r"), "100%25%0D")
})

test("escapeProperty additionally escapes : and ,", () => {
  assert.equal(escapeProperty("a:b"), "a%3Ab")
  assert.equal(escapeProperty("a,b"), "a%2Cb")
  assert.equal(escapeProperty("100%"), "100%25")
  assert.equal(escapeProperty("line1\rline2"), "line1%0Dline2")
  assert.equal(escapeProperty("line1\nline2"), "line1%0Aline2")
})

test("escapeProperty does not double-escape when both % and : are present", () => {
  // '%3A' must not itself get percent-re-escaped
  assert.equal(escapeProperty("a:b%c"), "a%3Ab%25c")
})

test("formatCommand renders properties in insertion order, comma separated", () => {
  const line = formatCommand("error", { file: "a.fts", line: 3, col: 1 }, "boom")
  assert.equal(line, "::error file=a.fts,line=3,col=1::boom")
})

test("formatCommand omits undefined/null properties", () => {
  const line = formatCommand("warning", { file: "a.fts", line: undefined, col: null }, "careful")
  assert.equal(line, "::warning file=a.fts::careful")
})

test("formatCommand with no properties at all", () => {
  const line = formatCommand("error", {}, "boom")
  assert.equal(line, "::error::boom")
})

test("formatCommand escapes message and property values independently", () => {
  const line = formatCommand("error", { file: "a,b.fts", title: "x:y" }, "100% broken\nsee above")
  assert.equal(line, "::error file=a%2Cb.fts,title=x%3Ay::100%25 broken%0Asee above")
})
