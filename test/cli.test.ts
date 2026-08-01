import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { describe, it } from "node:test"

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
