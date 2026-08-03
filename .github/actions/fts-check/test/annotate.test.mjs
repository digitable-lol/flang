import { test } from "node:test"
import assert from "node:assert/strict"

import { diagnosticToAnnotation } from "../lib/annotate.mjs"

test("diagnostic with span produces line/col from span.start", () => {
  const diagnostic = {
    code: "FTS_UNEXPECTED_TOKEN",
    message: "expected '}'",
    severity: "error",
    span: { start: { offset: 10, line: 3, column: 5 }, end: { offset: 11, line: 3, column: 6 } },
  }
  const line = diagnosticToAnnotation(diagnostic, "model.fts")
  assert.equal(line, "::error file=model.fts,line=3,col=5,endColumn=6,title=FTS_UNEXPECTED_TOKEN::expected '}'")
})

test("diagnostic with a multi-line span includes endLine", () => {
  const diagnostic = {
    code: "FTS_UNCLOSED_COMMENT",
    message: "unclosed block comment",
    severity: "error",
    span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 40, line: 4, column: 3 } },
  }
  const line = diagnosticToAnnotation(diagnostic, "model.fts")
  assert.equal(
    line,
    "::error file=model.fts,line=1,col=1,endLine=4,endColumn=3,title=FTS_UNCLOSED_COMMENT::unclosed block comment",
  )
})

test("diagnostic without span falls back to line 1 and folds path into the message", () => {
  const diagnostic = { code: "FTS_CATEGORY_NAME", message: "category must have a non-empty normalized name", severity: "error", path: "$.category" }
  const line = diagnosticToAnnotation(diagnostic, "model.fts")
  assert.equal(
    line,
    "::error file=model.fts,line=1,col=1,title=FTS_CATEGORY_NAME::category must have a non-empty normalized name ($.category)",
  )
})

test("diagnostic without span and without path leaves the message untouched", () => {
  const diagnostic = { code: "FTS_INTERNAL", message: "boom", severity: "error" }
  const line = diagnosticToAnnotation(diagnostic, "model.fts")
  assert.equal(line, "::error file=model.fts,line=1,col=1,title=FTS_INTERNAL::boom")
})

test("warning severity produces a ::warning:: command", () => {
  const diagnostic = { code: "FTS_SOMETHING", message: "heads up", severity: "warning" }
  const line = diagnosticToAnnotation(diagnostic, "model.fts")
  assert.match(line, /^::warning /)
})

test("diagnostic with no resolvable file omits file/line/col but keeps the path in the message", () => {
  const diagnostic = { code: "FTSC_IMPORT_NOT_FOUND", message: "module not found", severity: "error", path: "some/unresolvable/module.fts" }
  const line = diagnosticToAnnotation(diagnostic, undefined)
  assert.equal(line, "::error title=FTSC_IMPORT_NOT_FOUND::module not found (some/unresolvable/module.fts)")
})
