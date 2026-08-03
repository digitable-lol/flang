import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { appendSummary, getBooleanInput, getInput, setOutput } from "../lib/core.mjs"

test("getInput reads INPUT_<NAME> with spaces uppercased to underscores, dashes kept literal", () => {
  const env = { "INPUT_FAIL-ON-WARNING": "true", INPUT_PATHS: "examples/**/*.fts" }
  assert.equal(getBooleanInput("fail-on-warning", env), true)
  assert.equal(getInput("paths", env), "examples/**/*.fts")
})

test("getInput returns empty string, and getBooleanInput false, when unset", () => {
  assert.equal(getInput("missing", {}), "")
  assert.equal(getBooleanInput("missing", {}), false)
})

test("setOutput appends a single-line key=value to $GITHUB_OUTPUT", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fts-check-core-"))
  const file = join(dir, "output")
  await writeFile(file, "")
  await setOutput("models", 3, { GITHUB_OUTPUT: file })
  const content = await readFile(file, "utf8")
  assert.equal(content, "models=3\n")
})

test("setOutput uses a heredoc delimiter for multiline values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fts-check-core-"))
  const file = join(dir, "output")
  await writeFile(file, "")
  await setOutput("summary", "line one\nline two", { GITHUB_OUTPUT: file })
  const content = await readFile(file, "utf8")
  assert.match(content, /^summary<<ghadelimiter_[\w-]+\nline one\nline two\nghadelimiter_[\w-]+\n$/)
})

test("appendSummary appends markdown to $GITHUB_STEP_SUMMARY", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fts-check-core-"))
  const file = join(dir, "summary")
  await writeFile(file, "# existing\n")
  await appendSummary("# new section\n", { GITHUB_STEP_SUMMARY: file })
  const content = await readFile(file, "utf8")
  assert.equal(content, "# existing\n# new section\n")
})
