/**
 * Главный тест инструмента: воспроизведение находки на `examples/utilities/discount.fts`.
 *
 * Что именно проверяется. У модели есть свойство «Скидка ограничена» — скидка
 * не больше 20 % от суммы. Правила дают максимум 15 % (10 % за большую покупку
 * плюс 5 % постоянному клиенту), поэтому НА ВСЕХ ПОЛОЖИТЕЛЬНЫХ СУММАХ предел
 * недостижим: свойство ничего не проверяет и его можно ужесточить вдвое, не
 * сломав ни одного примера. А на отрицательной сумме знак процента
 * переворачивается, правила молчат, и то же свойство ломается.
 *
 * Тест не верит карте на слово: каждый найденный свидетель прогоняется через
 * ядро. Если ядро на нём не падает — карта соврала, и тест обязан упасть.
 */
import assert from "node:assert/strict"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { executeUtility } from "../../../dist/src/index.js"
import { analyzeDocument, reportOf } from "../src/coverage.mjs"
import { loadModel } from "../src/load.mjs"

const DISCOUNT = fileURLToPath(new URL("../../../examples/utilities/discount.fts", import.meta.url))

const load = async () => {
  const document = await loadModel(DISCOUNT)
  const report = reportOf(analyzeDocument(document))
  return { document, report, utility: report.utilities[0] }
}

const propertyNamed = (utility, name) => utility.properties.find((item) => item.name === name)

test("«Скидка ограничена» помечено недостижимым: предел не берётся ни на одном входе, где правила работают", async () => {
  const { utility } = await load()
  const property = propertyNamed(utility, "Скидка ограничена")

  assert.ok(property, "свойство «Скидка ограничена» должно попасть в отчёт")
  assert.equal(property.unattainable, true)
  /* 15 % при потолке 20 % — ровно три четверти предела и ни разу больше. */
  assert.equal(property.maxRatio, 0.75)
  assert.match(property.message, /предел недостижим/u)
})

test("на положительных суммах предел «Скидки ограниченной» не достигается и не нарушается", async () => {
  const { utility } = await load()
  const property = propertyNamed(utility, "Скидка ограничена")

  for (const record of property.violated) {
    assert.ok(record.input["сумма"] < 0, `нарушение обязано быть на отрицательной сумме, а не на ${record.input["сумма"]}`)
  }
  /* Равенство результата пределу бывает только в вырожденной точке «сумма» = 0,
     где обе стороны нули: про правила это ничего не говорит. */
  for (const record of property.attained) {
    assert.equal(record.degenerate, true)
    assert.equal(record.input["сумма"], 0)
  }
  assert.ok(property.slackRegions.some((region) => region.includes("(0, +∞)")))
})

test("на отрицательной сумме «Скидка ограничена» нарушается, и ядро подтверждает свидетеля", async () => {
  const { document, utility } = await load()
  const property = propertyNamed(utility, "Скидка ограничена")

  assert.ok(property.violatedCount > 0, "карта обязана найти нарушение")
  const witness = property.violated[0]
  assert.ok(witness.input["сумма"] < 0)

  assert.throws(
    () => executeUtility(document, "Рассчитать скидку", witness.input),
    (error) => /нарушено свойство «Скидка ограничена»/u.test(error.message),
    "свидетель из карты обязан ронять ядро на том же свойстве",
  )
})

test("положительные суммы ядро считает без отказа — предел действительно недостижим", async () => {
  const { document } = await load()
  assert.equal(executeUtility(document, "Рассчитать скидку", { "сумма": 10000, "постоянный клиент": true }), 1500)
  assert.equal(
    executeUtility(document, "Рассчитать скидку", { "сумма": 999999, "постоянный клиент": true }),
    149999.85,
  )
})

test("дыра на суммах меньше 10000 без постоянного клиента", async () => {
  const { utility } = await load()
  assert.equal(utility.holes.length, 1)
  const hole = utility.holes[0]
  assert.match(hole.where, /«сумма» ∈ \(−∞, 10000\)/u)
  assert.match(hole.where, /«постоянный клиент» = нет/u)
  assert.equal(hole.result, 0)
  assert.ok(hole.witness["сумма"] < 10000)
  assert.equal(hole.witness["постоянный клиент"], false)
})

test("пересечение правил найдено и помечено как накопление", async () => {
  const { utility } = await load()
  assert.equal(utility.overlaps.length, 1)
  const overlap = utility.overlaps[0]
  assert.deepEqual(overlap.names, ["Большая покупка", "Постоянный клиент"])
  assert.equal(overlap.orderDependent, false)
  assert.equal(overlap.kind, "накопление")
  assert.equal(overlap.proven, true)
  assert.deepEqual(overlap.witness, { "сумма": 10000, "постоянный клиент": true })
})

test("диагностики: недостижимость — предупреждение, нарушение — ошибка", async () => {
  const { report } = await load()
  const unattainable = report.diagnostics.filter((item) => item.code === "FTSMAP_PROPERTY_UNATTAINABLE")
  const violated = report.diagnostics.filter((item) => item.code === "FTSMAP_PROPERTY_VIOLATED")

  assert.ok(unattainable.some((item) => item.message.includes("Скидка ограничена")))
  assert.ok(violated.some((item) => item.message.includes("Скидка ограничена")))
  assert.ok(violated.every((item) => item.severity === "error"))
  assert.ok(unattainable.every((item) => item.severity === "warning"))
  assert.equal(report.ok, false)
})

test("карта находит и второе нарушение: скидка уходит в минус на отрицательной сумме", async () => {
  const { document, utility } = await load()
  const property = propertyNamed(utility, "Скидка неотрицательна")
  assert.ok(property.violatedCount > 0)

  const witness = property.violated[0]
  assert.equal(witness.input["постоянный клиент"], true)
  assert.ok(witness.result < 0)
  assert.throws(() => executeUtility(document, "Рассчитать скидку", witness.input))
})
