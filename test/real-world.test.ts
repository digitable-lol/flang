import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { describe, it } from "node:test"
import { certify, verifyCertificate } from "../src/certificate.js"
import { compile } from "../src/parser.js"

const root = process.cwd()
const cases = [
  ["customer-onboarding", "РегистрацияРазрешена"],
  ["invoices-table", "ТребуетсяКонтроль"],
  ["order-shipment", "ОтгрузитьЗаказРазрешено"],
  ["credit-limit", "ЛимитМожетБытьУстановлен"],
] as const

describe("real-world Russian examples", () => {
  for (const [name, conclusion] of cases) {
    it(`strictly verifies ${name}`, async () => {
      const source = await readFile(resolve(root, `examples/real-world/${name}.fts`), "utf8")
      const context = JSON.parse(await readFile(resolve(root, `examples/real-world/${name}.context.json`), "utf8"))
      const document = compile(source)
      const certificate = certify(document, context)

      assert.equal(certificate.status, "verified")
      assert.equal(certificate.conclusion.type, conclusion)
      assert.equal(verifyCertificate(document, certificate, context).valid, true)
    })
  }

  it("generates a form descriptor from a Russian structure", () => {
    const output = runUtility("form-schema.mjs", "customer-onboarding.fts", "АнкетаКлиента")
    assert.equal(output.kind, "form")
    assert.equal(output.title, "Анкета Клиента")
    assert.equal(output.fields.find((field: { name: string }) => field.name === "электроннаяПочта")?.control, "email")
    assert.equal(output.fields.find((field: { name: string }) => field.name === "телефон")?.required, false)
  })

  it("generates table columns from a Russian structure", () => {
    const output = runUtility("table-columns.mjs", "invoices-table.fts", "СтрокаСчёта")
    assert.equal(output.kind, "table")
    assert.equal(output.columns.find((column: { key: string }) => column.key === "сумма")?.align, "end")
    assert.equal(output.columns.find((column: { key: string }) => column.key === "просрочен")?.format, "badge")
  })

  it("guards a DDD command with a verified certificate", () => {
    const script = resolve(root, "examples/utilities/command-guard.mjs")
    const model = resolve(root, "examples/real-world/order-shipment.fts")
    const context = resolve(root, "examples/real-world/order-shipment.context.json")
    const result = spawnSync(process.execPath, [script, model, context], { cwd: root, encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(output.allowed, true)
    assert.equal(output.command, "ОтгрузитьЗаказРазрешено")
  })

  it("blocks a DDD command when the snapshot contradicts its witness", () => {
    const script = resolve(root, "examples/utilities/command-guard.mjs")
    const model = resolve(root, "examples/real-world/order-shipment.fts")
    const context = resolve(root, "examples/real-world/order-shipment.blocked.context.json")
    const result = spawnSync(process.execPath, [script, model, context], { cwd: root, encoding: "utf8" })
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(output.allowed, false)
    assert.match(output.reason, /witness does not match context/)
  })
})

function runUtility(scriptName: string, modelName: string, structure: string): any {
  const script = resolve(root, `examples/utilities/${scriptName}`)
  const model = resolve(root, `examples/real-world/${modelName}`)
  const result = spawnSync(process.execPath, [script, model, structure], { cwd: root, encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr)
  return JSON.parse(result.stdout)
}
