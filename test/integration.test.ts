import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { describe, it } from "node:test"

const root = process.cwd()

describe("integration surfaces", () => {
  it("executes the Node.js service boundary with Russian names", () => {
    const program = `
      import { readFile } from "node:fs/promises";
      import { execute } from "./examples/integrations/node/service.mjs";
      const source = await readFile("./examples/real-world/order-shipment.fts", "utf8");
      const context = JSON.parse(await readFile("./examples/real-world/order-shipment.context.json", "utf8"));
      process.stdout.write(JSON.stringify(execute("certify", { source, context })));
    `
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", program], {
      cwd: root,
      encoding: "utf8",
    })
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(output.certificate.status, "verified")
    assert.equal(output.certificate.conclusion.type, "Отгрузить заказ разрешено")
  })

  it("ships the browser entrypoint as a separate package export", async () => {
    const packageJson = JSON.parse(
      await (await import("node:fs/promises")).readFile(resolve(root, "package.json"), "utf8"),
    )
    assert.equal(packageJson.exports["./browser"].import, "./dist/src/browser.js")
  })
})
