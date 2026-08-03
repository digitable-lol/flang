import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { checkFtsSource, loadFts } from "../lib/ftsRuntime.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, "fixtures")
// This test file lives inside the @digitable/fts repo tree, so `loadFts`
// resolves the package via Node's self-reference against the repo's own
// (built) dist/src — see lib/ftsRuntime.mjs. workspaceDir only matters for
// the fallback path, so any value is fine here.
const workspaceDir = join(here, "..", "..", "..", "..")

test("a fully valid model with converging examples produces zero diagnostics", async () => {
  const fts = await loadFts(workspaceDir)
  const source = await readFile(join(fixtures, "valid.fts"), "utf8")
  const result = checkFtsSource(fts, source)
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.hasUtilities, true)
  assert.equal(result.examplesTotal, 2)
  assert.equal(result.examplesFailed, 0)
})

test("a syntactically broken model produces a span-carrying diagnostic and no example run", async () => {
  const fts = await loadFts(workspaceDir)
  const source = await readFile(join(fixtures, "broken.fts"), "utf8")
  const result = checkFtsSource(fts, source)
  assert.equal(result.diagnostics.length, 1)
  assert.equal(result.diagnostics[0].severity, "error")
  assert.ok(result.diagnostics[0].span, "expected a span on a parse error")
  assert.equal(result.diagnostics[0].span.start.line, 6)
  assert.equal(result.examplesTotal, 0)
  assert.equal(result.examplesFailed, 0)
})

test("a model with a non-converging example reports expected vs. actual", async () => {
  const fts = await loadFts(workspaceDir)
  const source = await readFile(join(fixtures, "mismatch.fts"), "utf8")
  const result = checkFtsSource(fts, source)
  assert.equal(result.examplesTotal, 2)
  assert.equal(result.examplesFailed, 1)
  const mismatch = result.diagnostics.find((d) => d.code === "FTS_EXAMPLE_MISMATCH")
  assert.ok(mismatch, "expected an FTS_EXAMPLE_MISMATCH diagnostic")
  assert.match(mismatch.message, /expected 9999/)
  assert.match(mismatch.message, /got 2000/)
})
