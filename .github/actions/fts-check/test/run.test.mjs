import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { run } from "../lib/run.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const fixtures = join(here, "fixtures")

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" })
}

async function makeWorkspace() {
  const dir = await mkdtemp(join(tmpdir(), "fts-check-run-"))
  await mkdir(join(dir, "examples"), { recursive: true })
  return dir
}

test("a valid model: zero diagnostics, exit not failed, correct counts", async () => {
  const dir = await makeWorkspace()
  try {
    await copyFile(join(fixtures, "valid.fts"), join(dir, "examples", "valid.fts"))
    const result = await run({ workspaceDir: dir, paths: "**/*.fts" })

    assert.equal(result.failed, false)
    assert.deepEqual(result.annotations, [])
    assert.equal(result.counts.models, 1)
    assert.equal(result.counts.diagnostics, 0)
    assert.equal(result.counts.errors, 0)
    assert.equal(result.counts.examplesFailed, 0)
    assert.match(result.summaryMarkdown, /examples\/valid\.fts \| 2\/2 \| 0 \|/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("a broken model: annotation with the right line, and a failed run", async () => {
  const dir = await makeWorkspace()
  try {
    await copyFile(join(fixtures, "broken.fts"), join(dir, "examples", "broken.fts"))
    const result = await run({ workspaceDir: dir, paths: "**/*.fts" })

    assert.equal(result.failed, true)
    assert.equal(result.annotations.length, 1)
    assert.match(result.annotations[0], /^::error file=examples\/broken\.fts,line=6,col=1/)
    assert.equal(result.counts.errors, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("a model with a non-converging example: annotation carries expected/actual, and a failed run", async () => {
  const dir = await makeWorkspace()
  try {
    await copyFile(join(fixtures, "mismatch.fts"), join(dir, "examples", "mismatch.fts"))
    const result = await run({ workspaceDir: dir, paths: "**/*.fts" })

    assert.equal(result.failed, true)
    assert.equal(result.counts.examplesFailed, 1)
    const mismatchAnnotation = result.annotations.find((line) => line.includes("FTS_EXAMPLE_MISMATCH"))
    assert.ok(mismatchAnnotation)
    assert.match(mismatchAnnotation, /expected 9999/)
    assert.match(mismatchAnnotation, /got 2000/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("fail-on-warning: false by default, a warning alone does not fail the run", async () => {
  const dir = await makeWorkspace()
  try {
    await copyFile(join(fixtures, "valid.fts"), join(dir, "examples", "valid.fts"))
    const result = await run({
      workspaceDir: dir,
      paths: "**/*.fts",
      failOnWarning: false,
      loadFtsImpl: async () => ({
        compile: (source) => ({ source }),
        validate: () => ({ valid: true, document: {}, diagnostics: [{ code: "FTS_HINT", message: "consider X", severity: "warning" }] }),
        testUtilities: () => ({ valid: true, total: 0, passed: 0, failed: 0, results: [] }),
      }),
    })
    assert.equal(result.counts.warnings, 1)
    assert.equal(result.counts.errors, 0)
    assert.equal(result.failed, false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("fail-on-warning: true makes a warning-only run fail", async () => {
  const dir = await makeWorkspace()
  try {
    await copyFile(join(fixtures, "valid.fts"), join(dir, "examples", "valid.fts"))
    const result = await run({
      workspaceDir: dir,
      paths: "**/*.fts",
      failOnWarning: true,
      loadFtsImpl: async () => ({
        compile: (source) => ({ source }),
        validate: () => ({ valid: true, document: {}, diagnostics: [{ code: "FTS_HINT", message: "consider X", severity: "warning" }] }),
        testUtilities: () => ({ valid: true, total: 0, passed: 0, failed: 0, results: [] }),
      }),
    })
    assert.equal(result.counts.warnings, 1)
    assert.equal(result.failed, true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("changed-only restricts the run to files touched since the base commit", async () => {
  const dir = await makeWorkspace()
  try {
    git(dir, "init", "-q", "-b", "main")
    git(dir, "config", "user.email", "test@example.invalid")
    git(dir, "config", "user.name", "Test")
    await copyFile(join(fixtures, "valid.fts"), join(dir, "examples", "valid.fts"))
    await copyFile(join(fixtures, "broken.fts"), join(dir, "examples", "broken.fts"))
    git(dir, "add", ".")
    git(dir, "commit", "-q", "-m", "base")
    const base = git(dir, "rev-parse", "HEAD").trim()

    // Only touch valid.fts after the base commit; broken.fts is untouched and
    // must not be picked up in changed-only mode even though it fails.
    const original = await readFile(join(fixtures, "valid.fts"), "utf8")
    await writeFile(join(dir, "examples", "valid.fts"), `${original}\n`)
    git(dir, "add", ".")
    git(dir, "commit", "-q", "-m", "touch valid only")

    const result = await run({ workspaceDir: dir, paths: "**/*.fts", changedOnly: true, env: {} })

    // env has no GITHUB_BASE_REF/GITHUB_EVENT_BEFORE, so resolveBaseRef falls back to HEAD~1,
    // which is exactly the base commit here.
    assert.deepEqual(
      result.models.map((m) => m.file),
      ["examples/valid.fts"],
    )
    assert.equal(result.failed, false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("ftsc/ftspec diagnostics are folded in when the corresponding flag is set and the tool is found", async () => {
  const dir = await makeWorkspace()
  try {
    const result = await run({
      workspaceDir: dir,
      paths: "**/*.fts",
      runFtsc: true,
      loadFtsImpl: async () => ({ compile: () => ({}), validate: () => ({ valid: true, document: {}, diagnostics: [] }) }),
      locateFtsPackageRootImpl: async () => dir,
      findToolImpl: (root, name) => (name === "ftsc" ? "/fake/ftsc.mjs" : null),
      runToolImpl: () => ({
        exitCode: 1,
        diagnostics: [{ code: "FTSC_IMPORT_NOT_FOUND", message: "module not found", severity: "error" }],
      }),
    })

    assert.equal(result.tools.length, 1)
    assert.equal(result.tools[0].name, "ftsc")
    assert.equal(result.counts.errors, 1)
    assert.equal(result.failed, true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("ftsc/ftspec are silently skipped when the tool binary is not found", async () => {
  const dir = await makeWorkspace()
  try {
    const result = await run({
      workspaceDir: dir,
      paths: "**/*.fts",
      runFtsc: true,
      runFtspec: true,
      loadFtsImpl: async () => ({ compile: () => ({}), validate: () => ({ valid: true, document: {}, diagnostics: [] }) }),
      locateFtsPackageRootImpl: async () => dir,
      findToolImpl: () => null,
    })
    assert.deepEqual(result.tools, [])
    assert.equal(result.failed, false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
