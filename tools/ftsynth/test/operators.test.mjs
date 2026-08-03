/**
 * Свойства операторов и генератора случайных чисел.
 *
 * Проверяется не «работает ли мутация», а инварианты, на которые опирается
 * весь остальной синтез: чистота операторов, воспроизводимость потока и то,
 * что ни один оператор не выводит особь за границы пространства поиска.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { createRng } from "../src/prng.mjs"
import { buildSpace, normalizeDataset } from "../src/schema.mjs"
import { randomIndividual } from "../src/individual.mjs"
import { MUTATIONS, crossover, crossoverConditions, crossoverRules, mutate } from "../src/operators.mjs"
import { generateDataset } from "../src/generate.mjs"

const dataset = normalizeDataset(generateDataset("discounts", { seed: 3, noise: 0 }))
const space = buildSpace(dataset, { maxRules: 5, maxConditions: 3 })

test("поток случайных чисел воспроизводим и расщепляется независимо", () => {
  const first = createRng("семя")
  const second = createRng("семя")
  const sample = Array.from({ length: 50 }, () => first.next())
  assert.deepEqual(sample, Array.from({ length: 50 }, () => second.next()))

  const branch = createRng("семя").fork("ветка")
  const same = createRng("семя").fork("ветка")
  assert.equal(branch.next(), same.next())
  assert.notEqual(createRng("семя").next(), createRng("другое семя").next())
})

test("каждый оператор мутации не трогает вход", () => {
  const rng = createRng(11)
  for (const [name, operator] of MUTATIONS) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const individual = randomIndividual(space, rng)
      const snapshot = JSON.stringify(individual)
      operator(individual, space, rng)
      assert.equal(JSON.stringify(individual), snapshot, `оператор «${name}» изменил вход`)
    }
  }
})

test("кроссовер не трогает родителей", () => {
  const rng = createRng(12)
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const first = randomIndividual(space, rng)
    const second = randomIndividual(space, rng)
    const before = [JSON.stringify(first), JSON.stringify(second)]
    crossoverRules(first, second, space, rng)
    crossoverConditions(first, second, space, rng)
    assert.deepEqual([JSON.stringify(first), JSON.stringify(second)], before)
  }
})

test("операторы держат особь в границах пространства поиска", () => {
  const rng = createRng(13)
  let individual = randomIndividual(space, rng)
  for (let step = 0; step < 4000; step += 1) {
    individual = step % 3 === 0
      ? crossover(individual, randomIndividual(space, rng), space, rng)
      : mutate(individual, space, rng)
    assert.ok(individual.rules.length >= 1, "правил не может быть ноль")
    assert.ok(individual.rules.length <= space.maxRules, "превышен потолок правил")
    for (const rule of individual.rules) {
      assert.ok(rule.when.length >= 1, "правило без условий ядро отвергает")
      assert.ok(rule.when.length <= space.maxConditions, "превышен потолок условий")
      const fields = rule.when.map((condition) => condition.field)
      assert.equal(new Set(fields).size, fields.length, "поле повторяется в конъюнкции")
    }
  }
})
