import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { describe, it } from "node:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

describe("CLI", () => {
  it("compiles from stdin with machine-readable stdout", async () => {
    const result = await runCli(["compile"], "category C {}")
    assert.equal(result.code, 0)
    assert.equal(JSON.parse(result.stdout).category, "C")
    assert.equal(result.stderr, "")
  })

  it("uses non-zero exit status and JSON diagnostics", async () => {
    const result = await runCli(["check"], "category C { proposition witness Missing.x {} }")
    assert.equal(result.code, 1)
    assert.equal(JSON.parse(result.stderr).valid, false)
  })

  it("runs utility examples and generates implementation files", async () => {
    const source = await readFile(new URL("../../examples/utilities/discount.fts", import.meta.url), "utf8")
    const tested = await runCli(["test"], source)
    assert.equal(tested.code, 0)
    assert.equal(JSON.parse(tested.stdout).passed, 3)

    const failed = await runCli(["test"], source.replace("ожидается результат равен 2000", "ожидается результат равен 999"))
    assert.equal(failed.code, 1)
    assert.equal(JSON.parse(failed.stderr).failed, 1)

    const generated = await runCli(["generate"], source)
    assert.equal(generated.code, 0)
    assert.deepEqual(JSON.parse(generated.stdout).files.map((file: { path: string }) => file.path), [
      "fts.utilities.ts",
      "fts.utilities.test.ts",
    ])

    const directory = await mkdtemp(join(tmpdir(), "fts-generate-"))
    try {
      const emitted = await runCli(["generate", "--out", directory], source)
      assert.equal(emitted.code, 0)
      assert.match(await readFile(join(directory, "fts.utilities.ts"), "utf8"), /Рассчитать скидку/)
      assert.match(await readFile(join(directory, "fts.utilities.test.ts"), "utf8"), /node:test/)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it("executes one utility with JSON input", async () => {
    const source = await readFile(new URL("../../examples/utilities/discount.fts", import.meta.url), "utf8")
    const directory = await mkdtemp(join(tmpdir(), "fts-run-"))
    const inputFile = join(directory, "input.json")
    try {
      await (await import("node:fs/promises")).writeFile(inputFile, JSON.stringify({ сумма: 20000, "постоянный клиент": true }))
      const result = await runCli(["run", "--utility", "Рассчитать скидку", "--input", inputFile], source)
      assert.equal(result.code, 0, result.stderr)
      assert.deepEqual(JSON.parse(result.stdout), { utility: "Рассчитать скидку", result: 3000 })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})

function runCli(args: string[], stdin: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [new URL("../src/cli.js", import.meta.url).pathname, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()))
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, stdout, stderr }))
    child.stdin.end(stdin)
  })
}
