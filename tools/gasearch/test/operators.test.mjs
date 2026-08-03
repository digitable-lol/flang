/**
 * Свойства генетических операторов.
 *
 * Операторы — единственное место, где особь меняется, поэтому здесь
 * проверяются инварианты представления: набор полей и их типы не плывут,
 * числа остаются в границах и на сетке, гены потомка происходят от родителей,
 * а отбор действительно предпочитает лучших.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { loadModel } from "../src/catalog.mjs"
import { buildSpec, createPopulation, withinBounds } from "../src/population.mjs"
import { mutate, onePointCrossover, rouletteSelection, tournamentSelection, uniformCrossover } from "../src/operators.mjs"
import { createStream } from "../src/random.mjs"

const model = loadModel("конфигурация")
const spec = buildSpec(model.document, model.entry["объект"], model.entry["диапазоны"])
const names = spec.genes.map((gene) => gene.name)

function parents(seed) {
  const [first, second] = createPopulation(spec, 2, createStream(seed).fork("родители"))
  return [first, second]
}

for (const [label, crossover] of [["одноточечный", onePointCrossover], ["равномерный", uniformCrossover]]) {
  test(`${label} кроссовер сохраняет набор полей и типы`, () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const [first, second] = parents(seed)
      const children = crossover(spec, first, second, createStream(seed).fork("кроссовер"))
      assert.equal(children.length, 2)
      for (const child of children) {
        assert.deepEqual(Object.keys(child), names, "порядок и набор полей изменились")
        for (const gene of spec.genes) {
          assert.equal(typeof child[gene.name], gene.kind === "признак" ? "boolean" : "number")
        }
        assert.ok(withinBounds(spec, child), "потомок вышел за границы полей")
      }
    }
  })

  test(`${label} кроссовер не выдумывает генов: каждое поле взято у родителя`, () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const [first, second] = parents(seed)
      for (const child of crossover(spec, first, second, createStream(seed).fork("кроссовер"))) {
        for (const name of names) {
          assert.ok(child[name] === first[name] || child[name] === second[name], `поле «${name}» появилось из ниоткуда`)
        }
      }
    }
  })

  test(`${label} кроссовер: пара потомков вместе содержит все гены обоих родителей`, () => {
    // Обмен, а не потеря: то, чего нет в первом потомке, обязано быть во втором.
    for (let seed = 0; seed < 100; seed += 1) {
      const [first, second] = parents(seed)
      const [left, right] = crossover(spec, first, second, createStream(seed).fork("кроссовер"))
      for (const name of names) {
        assert.deepEqual([left[name], right[name]].sort(), [first[name], second[name]].sort())
      }
    }
  })
}

test("мутация остаётся в границах поля и на сетке", () => {
  const [individual] = parents(1)
  for (let seed = 0; seed < 500; seed += 1) {
    // Ставка на вероятность 1 и огромную сигму: мутация обязана удержать
    // границы даже там, где гауссов сдвиг заведомо выбрасывает за пределы.
    const mutated = mutate(spec, individual, { rate: 1, sigma: 10 }, createStream(seed).fork("мутация"))
    assert.ok(withinBounds(spec, mutated), `вышли за границы: ${JSON.stringify(mutated)}`)
    assert.deepEqual(Object.keys(mutated), names)
  }
})

test("мутация с нулевой вероятностью не меняет особь", () => {
  const [individual] = parents(2)
  assert.deepEqual(mutate(spec, individual, { rate: 0, sigma: 1 }, createStream(3).fork("мутация")), individual)
})

test("мутация признака — переворот, а не новый бросок монеты", () => {
  const [individual] = parents(4)
  const mutated = mutate(spec, individual, { rate: 1, sigma: 0.01 }, createStream(5).fork("мутация"))
  assert.equal(mutated["повторы включены"], !individual["повторы включены"])
})

test("мутация детерминирована при одном имени потока", () => {
  const [individual] = parents(6)
  const once = mutate(spec, individual, { rate: 0.5, sigma: 0.3 }, createStream(8).fork("мутация:1"))
  const twice = mutate(spec, individual, { rate: 0.5, sigma: 0.3 }, createStream(8).fork("мутация:1"))
  assert.deepEqual(once, twice)
})

const evaluated = Array.from({ length: 20 }, (_unused, index) => ({
  genes: { метка: index },
  score: index,
  fitness: index,
  feasible: true,
  reason: null,
}))

test("турнирная селекция статистически предпочитает лучших", () => {
  const stream = createStream(2024).fork("турнир")
  let sum = 0
  const trials = 4000
  const winners = new Map()
  for (let trial = 0; trial < trials; trial += 1) {
    const winner = tournamentSelection(evaluated, 3, stream)
    sum += winner.fitness
    winners.set(winner.fitness, (winners.get(winner.fitness) ?? 0) + 1)
  }
  const populationMean = evaluated.reduce((total, entry) => total + entry.fitness, 0) / evaluated.length
  assert.ok(sum / trials > populationMean + 3, "турнир не поднял среднее качество отобранных")
  assert.ok((winners.get(19) ?? 0) > (winners.get(0) ?? 0) * 20, "лучшая особь выигрывает не чаще худшей")
})

test("давление отбора растёт с размером турнира", () => {
  const mean = (size) => {
    const stream = createStream(11).fork(`турнир:${size}`)
    let sum = 0
    for (let trial = 0; trial < 3000; trial += 1) sum += tournamentSelection(evaluated, size, stream).fitness
    return sum / 3000
  }
  assert.ok(mean(2) < mean(5), "турнир из пяти не строже турнира из двух")
})

test("рулетка тоже предпочитает лучших и не делит на ноль", () => {
  const stream = createStream(31).fork("рулетка")
  const trials = 4000
  let sum = 0
  for (let trial = 0; trial < trials; trial += 1) sum += rouletteSelection(evaluated, stream).fitness
  const populationMean = evaluated.reduce((total, entry) => total + entry.fitness, 0) / evaluated.length
  assert.ok(sum / trials > populationMean, "рулетка не поднимает среднее")

  // Вырожденный случай: все оценки равны. Без страховочной добавки к весам
  // сумма обнулилась бы и рулетка сломалась.
  const flat = evaluated.map((entry) => ({ ...entry, fitness: 5 }))
  assert.equal(rouletteSelection(flat, createStream(1).fork("плоская")).fitness, 5)
})

test("рулетка работает при отрицательном фитнесе", () => {
  const negative = evaluated.map((entry) => ({ ...entry, fitness: entry.fitness - 30 }))
  const stream = createStream(41).fork("отрицательная рулетка")
  let sum = 0
  for (let trial = 0; trial < 3000; trial += 1) sum += rouletteSelection(negative, stream).fitness
  const populationMean = negative.reduce((total, entry) => total + entry.fitness, 0) / negative.length
  assert.ok(sum / 3000 > populationMean, "на отрицательных значениях рулетка перестала различать особей")
})
