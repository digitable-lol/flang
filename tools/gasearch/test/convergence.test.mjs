/**
 * Сходимость на задачах с известным оптимумом.
 *
 * Оптимумы обеих моделей посчитаны на бумаге и независимо подтверждены полным
 * перебором в models.test.mjs. Здесь проверяется, что эволюция до них
 * добирается — и что она добирается ЛУЧШЕ, чем случайный перебор того же
 * бюджета: иначе движок был бы дорогим способом бросать кости.
 *
 * Все прогоны идут на фиксированных семенах. Это не подгонка результата, а
 * единственный способ не получить «мигающий» тест: у стохастического поиска
 * без фиксации семени порог всегда либо слишком слаб, либо иногда падает.
 * Порог при этом задан как известный оптимум, а не как «то, что вышло».
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { CATALOG, loadModel } from "../src/catalog.mjs"
import { createEvaluator } from "../src/fitness.mjs"
import { buildSpec, createPopulation } from "../src/population.mjs"
import { createStream } from "../src/random.mjs"
import { evolve } from "../src/evolve.mjs"

function search(name, seed, options = {}) {
  const model = loadModel(name)
  const spec = buildSpec(model.document, model.entry["объект"], model.entry["диапазоны"])
  const evaluate = createEvaluator({
    document: model.document,
    utility: model.entry["утилита"],
    admissibility: model.entry["допуск"],
    direction: model.entry["направление"],
  })
  return { spec, evaluate, result: evolve({ spec, evaluate, seed, options }) }
}

test("расписание: эволюция находит известный оптимум", () => {
  for (const seed of [1, 42, 2024]) {
    const { result } = search("расписание", seed, { populationSize: 40, generations: 60 })
    assert.equal(result["лучшая особь"]["допустима"], true)
    assert.equal(result["лучшая особь"]["оценка"], CATALOG["расписание"]["известный оптимум"], `семя ${seed}`)
    assert.deepEqual(result["лучшая особь"]["гены"], {
      "смен днём": 8,
      "смен ночью": 4,
      "резервных смен": 2,
      "доплата за ночь": true,
    })
  }
})

test("конфигурация: эволюция находит известный оптимум", () => {
  for (const seed of [1, 42, 2024]) {
    const { result } = search("конфигурация", seed, { populationSize: 60, generations: 120 })
    assert.equal(result["лучшая особь"]["допустима"], true)
    assert.equal(result["лучшая особь"]["оценка"], CATALOG["конфигурация"]["известный оптимум"], `семя ${seed}`)
  }
})

test("эволюция обыгрывает случайный перебор того же бюджета", () => {
  const seed = 7
  const populationSize = 40
  const generations = 40
  const { spec, evaluate, result } = search("конфигурация", seed, { populationSize, generations })

  // Случайный перебор получает ровно столько же оценок утилиты.
  const budget = populationSize * (generations + 1)
  const random = createPopulation(spec, budget, createStream(seed).fork("случайный перебор"))
  const bestRandom = random
    .map(evaluate)
    .filter((entry) => entry.feasible)
    .reduce((best, entry) => Math.max(best, entry.score), -Infinity)

  assert.ok(
    result["лучшая особь"]["оценка"] > bestRandom,
    `эволюция ${result["лучшая особь"]["оценка"]} не обыграла перебор ${bestRandom}`,
  )
})

test("лучшая оценка не убывает: элитизм работает", () => {
  const { result } = search("расписание", 3, { populationSize: 30, generations: 40, elite: 2 })
  const best = result["история"].map((entry) => entry["лучший фитнес"])
  for (let index = 1; index < best.length; index += 1) {
    assert.ok(best[index] >= best[index - 1], `поколение ${index} потеряло чемпиона: ${best[index - 1]} → ${best[index]}`)
  }
})

test("без элиты чемпион может теряться — элитизм не декорация", () => {
  const { result } = search("расписание", 3, { populationSize: 30, generations: 40, elite: 0 })
  // Итоговый чемпион всё равно запоминается снаружи популяции, поэтому
  // сравниваем не «хуже ли ответ», а падала ли лучшая оценка поколения.
  const best = result["история"].map((entry) => entry["лучший фитнес"])
  assert.ok(best.some((value, index) => index > 0 && value < best[index - 1]), "без элиты популяция ни разу не ухудшилась")
})

test("останов по стагнации срабатывает и не портит ответ", () => {
  const long = search("расписание", 42, { populationSize: 40, generations: 200 }).result
  const short = search("расписание", 42, { populationSize: 40, generations: 200, stagnation: 15 }).result
  assert.ok(short["поколений"] < long["поколений"], "стагнация не сократила прогон")
  assert.match(short["останов"], /стагнация/u)
  assert.equal(short["лучшая особь"]["оценка"], long["лучшая особь"]["оценка"])
})

test("минимизация ищет худший вариант — направление действительно управляет поиском", () => {
  const model = loadModel("расписание")
  const spec = buildSpec(model.document, model.entry["объект"], model.entry["диапазоны"])
  const evaluate = createEvaluator({ document: model.document, utility: "Оценить вариант", direction: "минимум" })
  const result = evolve({ spec, evaluate, seed: 5, options: { populationSize: 40, generations: 60 } })
  assert.equal(result["лучшая особь"]["допустима"], true)
  // Ноль — точная нижняя граница допустимой области: свойство «Вариант не
  // убыточен» отсекает всё, что ниже. Достигается она по-разному (нулём смен
  // или дорогим вариантом, где польза ровно съедена стоимостью), поэтому
  // сверяется оценка, а не набор генов.
  assert.equal(result["лучшая особь"]["оценка"], 0)
})

test("недопустимые особи не мешают поиску, но и не побеждают", () => {
  const { result } = search("конфигурация", 11, { populationSize: 40, generations: 30 })
  const infeasible = result["история"].some((entry) => entry["допустимых"] < entry["всего"])
  assert.ok(infeasible, "в прогоне не встретилось ни одной недопустимой особи — правило не проверено")
  assert.equal(result["лучшая особь"]["допустима"], true)
})
