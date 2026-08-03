import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { globToRegExp, listAllFtsFiles, listChangedFiles, parsePatterns } from "../lib/discover.mjs"

test("parsePatterns splits on newlines and commas, trims, drops blanks", () => {
  assert.deepEqual(parsePatterns("a/**/*.fts\n\nb/*.fts, c.fts"), ["a/**/*.fts", "b/*.fts", "c.fts"])
})

test("globToRegExp: ** matches any depth including zero", () => {
  const re = globToRegExp("**/*.fts")
  assert.ok(re.test("a.fts"))
  assert.ok(re.test("a/b.fts"))
  assert.ok(re.test("a/b/c.fts"))
  assert.ok(!re.test("a/b.ts"))
})

test("globToRegExp: * does not cross directory boundaries", () => {
  const re = globToRegExp("examples/*.fts")
  assert.ok(re.test("examples/a.fts"))
  assert.ok(!re.test("examples/nested/a.fts"))
})

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" })
}

async function makeTempRepo() {
  const dir = await mkdtemp(join(tmpdir(), "fts-check-discover-"))
  git(dir, "init", "-q", "-b", "main")
  git(dir, "config", "user.email", "test@example.invalid")
  git(dir, "config", "user.name", "Test")
  return dir
}

test("listAllFtsFiles finds every matching file regardless of git history, and skips node_modules/.git", async () => {
  const dir = await makeTempRepo()
  try {
    await mkdir(join(dir, "examples"), { recursive: true })
    await mkdir(join(dir, "node_modules", "whatever"), { recursive: true })
    await writeFile(join(dir, "examples", "a.fts"), "x")
    await writeFile(join(dir, "node_modules", "whatever", "b.fts"), "x")
    await writeFile(join(dir, "readme.md"), "x")

    const found = listAllFtsFiles(dir, ["**/*.fts"])
    assert.deepEqual(found, [join(dir, "examples", "a.fts")])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("listChangedFiles returns only .fts files touched since the base commit", async () => {
  const dir = await makeTempRepo()
  try {
    await mkdir(join(dir, "examples"), { recursive: true })
    await writeFile(join(dir, "examples", "unchanged.fts"), "1")
    await writeFile(join(dir, "examples", "will-change.fts"), "1")
    await writeFile(join(dir, "readme.md"), "1")
    git(dir, "add", ".")
    git(dir, "commit", "-q", "-m", "base")
    const base = git(dir, "rev-parse", "HEAD").trim()

    await writeFile(join(dir, "examples", "will-change.fts"), "2")
    await writeFile(join(dir, "examples", "new.fts"), "1")
    await writeFile(join(dir, "readme.md"), "2")
    git(dir, "add", ".")
    git(dir, "commit", "-q", "-m", "change")

    const changed = listChangedFiles(dir, base, ["**/*.fts"])
    assert.deepEqual(changed.sort(), [join(dir, "examples", "new.fts"), join(dir, "examples", "will-change.fts")].sort())
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("listChangedFiles omits files deleted since the base commit", async () => {
  const dir = await makeTempRepo()
  try {
    await mkdir(join(dir, "examples"), { recursive: true })
    await writeFile(join(dir, "examples", "gone.fts"), "1")
    git(dir, "add", ".")
    git(dir, "commit", "-q", "-m", "base")
    const base = git(dir, "rev-parse", "HEAD").trim()

    await rm(join(dir, "examples", "gone.fts"))
    git(dir, "add", ".")
    git(dir, "commit", "-q", "-m", "delete")

    const changed = listChangedFiles(dir, base, ["**/*.fts"])
    assert.deepEqual(changed, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
