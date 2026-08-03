import { test } from "node:test"
import assert from "node:assert/strict"

import { buildSummaryMarkdown } from "../lib/summaryReport.mjs"

test("builds a model/examples/diagnostics table", () => {
  const models = [
    { file: "examples/discount.fts", hasUtilities: true, examplesTotal: 3, examplesFailed: 0, diagnostics: [] },
    {
      file: "examples/broken.fts",
      hasUtilities: false,
      examplesTotal: 0,
      examplesFailed: 0,
      diagnostics: [{ code: "FTS_UNEXPECTED_TOKEN", message: "boom", severity: "error" }],
    },
    {
      file: "examples/socrates.fts",
      hasUtilities: false,
      examplesTotal: 0,
      examplesFailed: 0,
      diagnostics: [],
    },
  ]

  const markdown = buildSummaryMarkdown(models)

  assert.match(markdown, /\| Model \| Examples \| Diagnostics \|/)
  assert.match(markdown, /\| examples\/discount\.fts \| 3\/3 \| 0 \|/)
  assert.match(markdown, /\| examples\/broken\.fts \| — \| 1 error \|/)
  assert.match(markdown, /\| examples\/socrates\.fts \| — \| 0 \|/)
  assert.match(markdown, /3 model\(s\) checked/)
  assert.match(markdown, /3\/3 example\(s\) converge/)
  assert.match(markdown, /1 error\(s\), 0 warning\(s\)/)
})

test("escapes pipes and newlines out of file names so the table can't break", () => {
  const markdown = buildSummaryMarkdown([
    { file: "weird|name\nwith newline.fts", hasUtilities: false, examplesTotal: 0, examplesFailed: 0, diagnostics: [] },
  ])
  assert.match(markdown, /weird\\\|name with newline\.fts/)
})

test("includes an ftsc/ftspec row when tool diagnostics are supplied", () => {
  const markdown = buildSummaryMarkdown(
    [],
    [{ name: "ftsc", diagnostics: [{ code: "FTSC_IMPORT_NOT_FOUND", message: "x", severity: "error" }] }],
  )
  assert.match(markdown, /\| ftsc \| — \| 1 error \|/)
})
