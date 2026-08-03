/**
 * Устройство фитнеса: штраф за сложность, недоминируемая сортировка и
 * детерминированное разбиение выборки.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { buildSpace, normalizeDataset } from "../src/schema.mjs"
import { createScorer, dominates, nonDominatedSort } from "../src/fitness.mjs"
import { splitRows } from "../src/evolve.mjs"
import { generateDataset } from "../src/generate.mjs"

const dataset = normalizeDataset(generateDataset("discounts", { seed: 3, noise: 0 }))
const space = buildSpace(dataset, {})
const scorer = createScorer(space, dataset["наблюдения"], {})

// Одна и та же политика, записанная тремя и четырьмя правилами: четвёртое
// правило дублирует условие третьего с тем же действием, поэтому предсказания
// совпадают до последней копейки.
const трёхПравильная = {
  initial: 0,
  rules: [
    правило([условие("сумма", "gte", 10000)], "add", { kind: "percent", percent: 10, field: "сумма" }),
    правило([условие("статус клиента", "eq", "постоянный")], "add", { kind: "percent", percent: 5, field: "сумма" }),
    правило([условие("объём", "gte", 50), условие("сумма", "gte", 5000)], "add", { kind: "value", value: 500 }),
  ],
}

const четырёхПравильная = {
  initial: 0,
  rules: [
    ...трёхПравильная.rules,
    правило([условие("сумма", "gte", 30000)], "add", { kind: "value", value: 0 }),
  ],
}

test("при равной точности штраф за сложность выбирает модель с меньшим числом правил", () => {
  const простая = scorer.objectives(трёхПравильная)
  const сложная = scorer.objectives(четырёхПравильная)

  assert.equal(простая["ошибка"], сложная["ошибка"], "модели обязаны совпадать по точности")
  assert.equal(простая["ошибка"], 0, "обе модели должны воспроизводить данные без шума точно")
  assert.ok(простая["сложность"] < сложная["сложность"])
  assert.ok(простая["фитнес"] < сложная["фитнес"], "фитнес не наказывает лишнее правило")
})

test("нулевой вес простоты снимает штраф, и модели становятся неразличимы", () => {
  const безбритвы = createScorer(space, dataset["наблюдения"], { weights: { "простота": 0 } })
  assert.equal(безбритвы.objectives(трёхПравильная)["фитнес"], безбритвы.objectives(четырёхПравильная)["фитнес"])
})

test("нарушение свойства наказывается тяжелее любой неточности", () => {
  // Скидка в 90 процентов нарушает свойство «результат не больше 20 процентов».
  const негодная = {
    initial: 0,
    rules: [правило([условие("сумма", "gte", 1000)], "add", { kind: "percent", percent: 90, field: "сумма" })],
  }
  const оценка = scorer.objectives(негодная)
  assert.ok(оценка["нарушения"] > 0)
  assert.ok(оценка["фитнес"] > scorer.objectives(трёхПравильная)["фитнес"] + 1)
})

test("доминирование и недоминируемая сортировка", () => {
  assert.ok(dominates([1, 1], [2, 2]))
  assert.ok(dominates([1, 2], [1, 3]))
  assert.ok(!dominates([1, 3], [2, 2]))
  assert.ok(!dominates([1, 1], [1, 1]), "равные точки не доминируют друг друга")

  const фронты = nonDominatedSort([[1, 4], [2, 2], [4, 1], [3, 3], [5, 5]])
  assert.deepEqual(фронты[0].slice().sort(), [0, 1, 2])
  assert.deepEqual(фронты[1], [3])
  assert.deepEqual(фронты[2], [4])
})

test("разбиение на обучение и контроль детерминировано по семени и не пересекается", () => {
  const первое = splitRows(dataset["наблюдения"], 42, 0.3)
  const второе = splitRows(dataset["наблюдения"], 42, 0.3)
  const другое = splitRows(dataset["наблюдения"], 43, 0.3)

  assert.deepEqual(первое["контроль"], второе["контроль"])
  assert.notDeepEqual(первое["контроль"], другое["контроль"])
  assert.equal(первое["обучение"].length + первое["контроль"].length, dataset["наблюдения"].length)
  assert.equal(первое["контроль"].length, Math.round(dataset["наблюдения"].length * 0.3))

  const ключи = new Set(первое["обучение"].map((row) => JSON.stringify(row["вход"])))
  for (const row of первое["контроль"]) {
    assert.ok(!ключи.has(JSON.stringify(row["вход"])), "контрольное наблюдение попало в обучение")
  }
})

function правило(when, kind, value) {
  return { when, action: { kind, value } }
}

function условие(field, operator, value) {
  return { field, operator, value: { kind: "value", value } }
}
