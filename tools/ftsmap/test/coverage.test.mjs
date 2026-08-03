/**
 * Разбор пространства входов: дыры, пересечения, честность на неразрешимом.
 *
 * Модели лежат рядом в `examples/` и подобраны так, чтобы каждая проверяла
 * ровно один вопрос: покрывают ли правила весь диапазон, встречаются ли два
 * правила на общей области, что инструмент говорит, когда условие сравнивает
 * поля между собой, и не падает ли он на модели без утилит.
 */
import assert from "node:assert/strict"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { analyzeDocument, describeRange, mergeBoxes, reportOf } from "../src/coverage.mjs"
import { loadModel } from "../src/load.mjs"

const at = (name) => fileURLToPath(new URL(`../examples/${name}`, import.meta.url))

const mapOf = async (name, options) => {
  const document = await loadModel(at(name))
  return reportOf(analyzeDocument(document, options))
}

const codesOf = (report) => report.diagnostics.map((item) => item.code)

test("дыра находится: правила покрывают только середину диапазона", async () => {
  const report = await mapOf("holes.fts")
  const utility = report.utilities[0]

  assert.deepEqual(
    utility.holes.map((hole) => hole.where),
    ["«вес» ∈ (−∞, 10)", "«вес» ∈ [100, +∞)"],
  )
  /* Границы дыр обязаны совпадать с порогами условий, а не «примерно». */
  assert.deepEqual(utility.axes[0].thresholds, [0, 10, 50, 100])
  assert.equal(utility.summary.cellsHoles, 5)
  assert.ok(utility.holes.every((hole) => hole.result === 0))
  assert.ok(codesOf(report).includes("FTSMAP_HOLE"))
  /* Дыры — предупреждение: модель работает, просто автор о крайних весах молчит. */
  assert.equal(report.ok, true)
})

test("пересечение находится: два правила с общей областью и спором за результат", async () => {
  const report = await mapOf("overlap.fts")
  const utility = report.utilities[0]

  assert.equal(utility.overlaps.length, 1)
  const overlap = utility.overlaps[0]
  assert.deepEqual(overlap.names, ["Крупный заказ", "Много позиций"])
  assert.deepEqual(overlap.regions, ["«сумма» ∈ [5000, +∞), «количество» ∈ [10, +∞)"])
  assert.equal(overlap.proven, true)
  assert.equal(overlap.orderDependent, true)
  assert.equal(overlap.kind, "перезапись")
  assert.deepEqual(overlap.witness, { "сумма": 5000, "количество": 10 })
  assert.ok(codesOf(report).includes("FTSMAP_OVERLAP_ORDER"))
})

test("свидетель пересечения действительно попадает в область обоих правил", async () => {
  const report = await mapOf("overlap.fts")
  const witness = report.utilities[0].overlaps[0].witness
  assert.ok(witness["сумма"] >= 5000)
  assert.ok(witness["количество"] >= 10)
})

test("непроанализируемое условие помечается честно и не выдаётся за проверенное", async () => {
  const report = await mapOf("opaque.fts")
  const utility = report.utilities[0]
  const rule = utility.rules.find((item) => item.name === "Платёж больше дохода")

  assert.equal(rule.analyzable, false)
  assert.equal(rule.unanalyzedField, "платёж")
  assert.deepEqual(rule.unanalyzed, [
    { field: "платёж", operator: "gt", operand: "field", text: "«платёж» > поле «доход»" },
  ])
  /* Область не доказана — значит и «свободных» полей у правила не называем. */
  assert.deepEqual(rule.free, [])
  assert.ok(codesOf(report).includes("FTSMAP_UNANALYZED"))
  /* Клетки, где правило ведёт себя по-разному, посчитаны отдельно. */
  assert.ok(utility.summary.cellsMixed > 0)
  assert.equal(utility.summary.rulesUnanalyzed, 1)
})

test("модель без утилит даёт отчёт, а не падение", async () => {
  const report = await mapOf("silent.fts")
  assert.deepEqual(report.utilities, [])
  assert.equal(report.ok, true)
  assert.deepEqual(codesOf(report), ["FTSMAP_NO_UTILITIES"])
  assert.equal(report.summary.utilities, 0)
})

test("выбор утилиты по имени; неизвестное имя — ошибка с перечислением известных", async () => {
  const one = await mapOf("holes.fts", { utility: "Рассчитать доплату" })
  assert.equal(one.utilities.length, 1)

  const document = await loadModel(at("holes.fts"))
  assert.throws(
    () => analyzeDocument(document, { utility: "Нет такой" }),
    (error) => {
      assert.equal(error.diagnostics[0].code, "FTSMAP_UNKNOWN_UTILITY")
      assert.match(error.diagnostics[0].message, /«Рассчитать доплату»/u)
      return true
    },
  )
})

test("свободное поле не раздувает разбиение и названо в сводке", async () => {
  const report = await mapOf("holes.fts")
  assert.deepEqual(report.utilities[0].summary.freeFields, [])

  const overlap = await mapOf("overlap.fts")
  const rule = overlap.utilities[0].rules[0]
  assert.deepEqual(rule.free, ["количество"])
})

test("склейка клеток даёт минимальные прямоугольники, а не список точек", () => {
  /* Четыре клетки квадрата 2×2 обязаны склеиться в одну область. */
  const boxes = mergeBoxes([
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ])
  assert.deepEqual(boxes, [
    [
      [0, 1],
      [0, 1],
    ],
  ])
})

test("описание диапазона повторяет скобки интервального анализа", () => {
  const axis = {
    kind: "число",
    cells: [
      { kind: "interval", lo: -Infinity, loOpen: true, hi: 0, hiOpen: true },
      { kind: "point", value: 0 },
      { kind: "interval", lo: 0, loOpen: true, hi: 10, hiOpen: true },
      { kind: "point", value: 10 },
      { kind: "interval", lo: 10, loOpen: true, hi: Infinity, hiOpen: true },
    ],
  }
  assert.equal(describeRange(axis, [0, 0]), "∈ (−∞, 0)")
  assert.equal(describeRange(axis, [1, 1]), "= 0")
  assert.equal(describeRange(axis, [1, 2]), "∈ [0, 10)")
  assert.equal(describeRange(axis, [3, 4]), "∈ [10, +∞)")
  assert.equal(describeRange(axis, [0, 4]), null, "полная ось — не ограничение")
})

test("битый путь и битый исходник дают диагностику, а не исключение без кода", async () => {
  await assert.rejects(
    () => loadModel(at("нет-такого-файла.fts")),
    (error) => error.diagnostics[0].code === "FTSMAP_READ",
  )
})
