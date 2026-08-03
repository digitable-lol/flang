/**
 * Контракт CLI: тот же, что у ядра, ftsc и ftspec.
 *
 * Машинный результат — в stdout, диагностики — в stderr, ненулевой код
 * возврата при ошибке. Проверяется именно разделение потоков: если бы
 * предупреждения шли в stdout, `ftsmap --json | jq` перестал бы работать, а
 * ради этого конвейера инструмент и делается.
 */
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { parseXml } from "./xml.mjs"

const run = promisify(execFile)
const BIN = fileURLToPath(new URL("../bin/ftsmap.mjs", import.meta.url))
const at = (path) => fileURLToPath(new URL(path, import.meta.url))
const DISCOUNT = at("../../../examples/utilities/discount.fts")

/** execFile бросает при ненулевом коде; нам код нужен как обычное значение. */
async function ftsmap(...args) {
  try {
    const { stdout, stderr } = await run(process.execPath, [BIN, ...args])
    return { code: 0, stdout, stderr }
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" }
  }
}

test("--json: отчёт в stdout, диагностики в stderr, код 1 при нарушенном свойстве", async () => {
  const result = await ftsmap(DISCOUNT, "--json")
  assert.equal(result.code, 1)

  const report = JSON.parse(result.stdout)
  assert.equal(report.ok, false)
  assert.equal(report.utilities[0].name, "Рассчитать скидку")
  assert.equal(report.utilities[0].holes.length, 1)
  assert.equal(report.summary.unattainable, 2)
  /* Служебные поля отрисовки в машинный отчёт не попадают. */
  assert.equal(report.utilities[0].internal, undefined)

  const diagnostics = JSON.parse(result.stderr)
  assert.ok(diagnostics.diagnostics.some((item) => item.code === "FTSMAP_PROPERTY_VIOLATED"))
})

test("--text: человекочитаемый отчёт в stdout", async () => {
  const result = await ftsmap(DISCOUNT, "--text")
  assert.equal(result.code, 1)
  assert.match(result.stdout, /Карта покрытия правил/u)
  assert.match(result.stdout, /Дыры \(не срабатывает ни одно правило\)/u)
  assert.match(result.stdout, /Скидка ограничена.*НАРУШЕНО/u)
})

test("модель без ошибок даёт код 0, предупреждения — в stderr", async () => {
  const result = await ftsmap(at("../examples/holes.fts"), "--text")
  assert.equal(result.code, 0)
  assert.match(result.stdout, /«вес» ∈ \(−∞, 10\)/u)
  assert.match(result.stderr, /FTSMAP_HOLE/u)
})

test("--out: SVG пишется в файл, stdout остаётся машинным", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ftsmap-"))
  try {
    const file = join(directory, "map.svg")
    const result = await ftsmap(DISCOUNT, "--utility", "Рассчитать скидку", "--out", file)
    assert.equal(result.code, 1)

    const svg = await readFile(file, "utf8")
    assert.equal(parseXml(svg).name, "svg")
    JSON.parse(result.stdout)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("--out -: SVG в stdout", async () => {
  const result = await ftsmap(at("../examples/holes.fts"), "--out", "-")
  assert.equal(result.code, 0)
  assert.equal(parseXml(result.stdout).name, "svg")
})

test("неизвестная утилита и несуществующий файл: код 1 и диагностика в stderr", async () => {
  const unknown = await ftsmap(DISCOUNT, "--utility", "Нет такой")
  assert.equal(unknown.code, 1)
  assert.equal(JSON.parse(unknown.stderr).diagnostics[0].code, "FTSMAP_UNKNOWN_UTILITY")

  const missing = await ftsmap(at("../examples/нет.fts"))
  assert.equal(missing.code, 1)
  assert.equal(JSON.parse(missing.stderr).diagnostics[0].code, "FTSMAP_READ")
})

test("вызов без модели: код 2 и подсказка в stderr", async () => {
  const result = await ftsmap()
  assert.equal(result.code, 2)
  assert.match(result.stderr, /ftsmap — карта покрытия правил/u)
  assert.equal(result.stdout, "")
})
