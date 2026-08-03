/**
 * Статистический аппарат на выборках с известным ответом.
 *
 * Критерий, который нельзя проверить, нельзя и предъявить: p-value из
 * таблицы 3.2 — это утверждение о мире, и оно стоит ровно столько, сколько
 * стоит реализация критерия. Поэтому здесь есть три рода проверок:
 *
 *   1) сверка нормального хвоста с табличными значениями (1,96 → 0,05);
 *   2) поведение на одинаковых и на сдвинутых выборках;
 *   3) сверка статистики U и W с ручным расчётом на крошечных примерах,
 *      где ранги можно выписать на бумаге.
 */

import assert from "node:assert/strict"
import { test } from "node:test"

import { createStream } from "../../gasearch/src/random.mjs"
import { ALPHA, bootstrapCI, cliffsDelta, describe, holm, mannWhitneyU, median, quantile, stdev, twoSidedP, wilcoxonSignedRank } from "../src/stats.mjs"

/** Воспроизводимая выборка из нормального распределения со сдвигом. */
function sample(label, size, shift = 0, scale = 1) {
  const stream = createStream(`выборка:${label}`)
  return Array.from({ length: size }, (_unused, index) => stream.fork(`элемент:${index}`).nextGaussian() * scale + shift)
}

test("нормальный хвост совпадает с табличными значениями", () => {
  assert.ok(Math.abs(twoSidedP(1.959964) - 0.05) < 1e-6)
  assert.ok(Math.abs(twoSidedP(2.575829) - 0.01) < 1e-6)
  assert.ok(Math.abs(twoSidedP(3.290527) - 0.001) < 1e-6)
  assert.equal(twoSidedP(0), 1)
})

test("описательные статистики считаются верно на выборке с известным ответом", () => {
  const values = [2, 4, 4, 4, 5, 5, 7, 9]
  assert.equal(median(values), 4.5)
  assert.equal(quantile(values, 0), 2)
  assert.equal(quantile(values, 1), 9)
  // Выборочное стандартное отклонение (делитель n − 1) для этого ряда — √(32/7).
  assert.ok(Math.abs(stdev(values) - Math.sqrt(32 / 7)) < 1e-12)
})

test("Манн — Уитни: U сверен с ручным расчётом", () => {
  // Выборки [1,2,3,4] и [5,6,7,8] полностью разделены: U = 0.
  const separated = mannWhitneyU([1, 2, 3, 4], [5, 6, 7, 8])
  assert.equal(separated["U"], 0)
  // Полное чередование [1,3,5,7] против [2,4,6,8]: ранги 1,3,5,7 и 2,4,6,8,
  // сумма рангов первой выборки 16, U₁ = 16 − 10 = 6, U₂ = 10, U = 6.
  const interleaved = mannWhitneyU([1, 3, 5, 7], [2, 4, 6, 8])
  assert.equal(interleaved["U"], 6)
})

test("Манн — Уитни: две одинаковые выборки — различия нет", () => {
  const first = sample("а", 30)
  const second = sample("б", 30)
  const result = mannWhitneyU(first, second)
  assert.ok(result["p"] > ALPHA, `p = ${result["p"]} — критерий увидел различие там, где его нет`)
  assert.equal(result["приближение надёжно"], true)
  // Побитово совпадающие выборки — вырожденный случай, он не должен ломаться.
  assert.equal(mannWhitneyU(first, first)["p"], 1)
})

test("Манн — Уитни: сдвинутая выборка — различие есть", () => {
  const result = mannWhitneyU(sample("а", 30), sample("в", 30, 1.5))
  assert.ok(result["p"] < ALPHA, `p = ${result["p"]} — критерий не увидел сдвига на 1,5σ`)
  assert.ok(result["z"] < 0, "знак z должен указывать, что первая выборка меньше")
})

test("Уилкоксон: W сверен с ручным расчётом", () => {
  // Разности +1, +2, +3, −4: ранги |d| = 1, 2, 3, 4;
  // W⁺ = 1 + 2 + 3 = 6, W⁻ = 4, W = min(6, 4) = 4.
  const result = wilcoxonSignedRank([2, 4, 6, 4], [1, 2, 3, 8])
  assert.equal(result["W"], 4)
  assert.equal(result["n"], 4)
  assert.equal(result["нулевых разностей"], 0)
})

test("Уилкоксон: две одинаковые выборки — различия нет", () => {
  const result = wilcoxonSignedRank(sample("а", 30), sample("б", 30))
  assert.ok(result["p"] > ALPHA, `p = ${result["p"]} — критерий увидел различие там, где его нет`)
})

test("Уилкоксон: сдвинутая выборка — различие есть", () => {
  const result = wilcoxonSignedRank(sample("а", 30), sample("в", 30, 1.5))
  assert.ok(result["p"] < ALPHA, `p = ${result["p"]} — критерий не увидел сдвига на 1,5σ`)
})

test("Уилкоксон: побитово совпадающие выборки не выдают ложного различия", () => {
  const values = sample("а", 30)
  const result = wilcoxonSignedRank(values, values)
  assert.equal(result["p"], 1)
  assert.equal(result["нулевых разностей"], 30)
  assert.equal(result["приближение надёжно"], false)
  assert.ok(result["замечание"].includes("нулевые"))
})

test("связи рангов учитываются: сплошные повторы не дают ложной значимости", () => {
  const first = new Array(30).fill(1)
  const second = new Array(30).fill(1)
  assert.equal(mannWhitneyU(first, second)["p"], 1)
  assert.equal(wilcoxonSignedRank(first, second)["p"], 1)
})

test("малая выборка помечается как ненадёжная для нормального приближения", () => {
  const result = mannWhitneyU([1, 2, 3], [4, 5, 6])
  assert.equal(result["приближение надёжно"], false)
})

test("размер эффекта Клиффа указывает направление и величину", () => {
  assert.equal(cliffsDelta([1, 2, 3], [4, 5, 6])["δ"], -1)
  assert.equal(cliffsDelta([4, 5, 6], [1, 2, 3])["δ"], 1)
  assert.equal(cliffsDelta([1, 2, 3], [1, 2, 3])["δ"], 0)
  assert.equal(cliffsDelta([1, 2, 3], [1, 2, 3])["величина"], "пренебрежимая")
  assert.equal(cliffsDelta([4, 5, 6], [1, 2, 3])["величина"], "большая")
})

test("поправка Холма монотонна и не смягчает ни одного p-value", () => {
  const adjusted = holm([{ p: 0.01 }, { p: 0.04 }, { p: 0.03 }])
  assert.deepEqual(adjusted.map((entry) => entry["p Холма"]), [0.03, 0.06, 0.06])
  for (const entry of adjusted) assert.ok(entry["p Холма"] >= entry["p"])
  assert.deepEqual(adjusted.map((entry) => entry["значимо"]), [true, false, false])
  // Единственная гипотеза не корректируется вовсе.
  assert.equal(holm([{ p: 0.02 }])[0]["p Холма"], 0.02)
})

test("bootstrap-интервал воспроизводим и накрывает среднее", () => {
  const values = sample("а", 30, 5)
  const first = bootstrapCI(values, { seed: "проверка" })
  const second = bootstrapCI(values, { seed: "проверка" })
  assert.deepEqual(second, first)
  const summary = describe(values, { seed: "проверка" })
  assert.ok(first["нижняя"] <= summary["среднее"] && summary["среднее"] <= first["верхняя"])
  assert.equal(summary["n"], 30)
})
