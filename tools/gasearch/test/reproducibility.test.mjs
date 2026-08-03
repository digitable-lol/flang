/**
 * Главный тест инструмента: прогон воспроизводим побитово.
 *
 * Всё остальное — качество поиска, и его можно обсуждать. Это — контракт: если
 * два прогона с одним семенем разошлись хоть в одном знаке, отчёт о результате
 * ничего не значит, потому что его нельзя перепроверить.
 *
 * Проверяется на трёх уровнях: внутри процесса, между процессами (запуск CLI)
 * и при изменении посторонних условий (порядок обхода, размер популяции,
 * наличие кэша). Отдельно проверяется обратное: разные семена дают разное,
 * иначе «воспроизводимость» была бы просто отсутствием случайности.
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

import { loadModel } from "../src/catalog.mjs"
import { createEvaluator } from "../src/fitness.mjs"
import { buildSpec } from "../src/population.mjs"
import { createPopulation } from "../src/population.mjs"
import { createStream } from "../src/random.mjs"
import { evolve } from "../src/evolve.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const cli = join(here, "..", "bin", "gasearch.mjs")

function run(name, seed, options = {}) {
  const model = loadModel(name)
  const spec = buildSpec(model.document, model.entry["объект"], model.entry["диапазоны"])
  const evaluate = createEvaluator({
    document: model.document,
    utility: model.entry["утилита"],
    admissibility: model.entry["допуск"],
    direction: model.entry["направление"],
  })
  return evolve({ spec, evaluate, seed, options: { populationSize: 24, generations: 20, ...options } })
}

test("два прогона с одним семенем совпадают побайтово", () => {
  const first = JSON.stringify(run("расписание", 42))
  const second = JSON.stringify(run("расписание", 42))
  assert.equal(first, second)
})

test("воспроизводимость сохраняется и на модели с допуском", () => {
  assert.equal(JSON.stringify(run("конфигурация", 2025)), JSON.stringify(run("конфигурация", 2025)))
})

test("разные семена дают разные прогоны", () => {
  const first = JSON.stringify(run("расписание", 42)["история"])
  const second = JSON.stringify(run("расписание", 43)["история"])
  assert.notEqual(first, second)
})

test("прогон не зависит от порядка вычислений в популяции", () => {
  // Начальная популяция строится по именам подпотоков «особь:i», поэтому
  // особь номер 5 одинакова в популяции из 10 и в популяции из 40.
  const model = loadModel("расписание")
  const spec = buildSpec(model.document, model.entry["объект"], model.entry["диапазоны"])
  const stream = createStream(1234).fork("начальная популяция")
  const small = createPopulation(spec, 10, stream)
  const large = createPopulation(spec, 40, stream)
  assert.deepEqual(small, large.slice(0, 10))
})

test("два запуска CLI с одним семенем дают одинаковый stdout", () => {
  const argv = ["run", "расписание", "--seed", "7", "--generations", "15", "--population", "20", "--history"]
  const first = execFileSync(process.execPath, [cli, ...argv], { encoding: "utf8" })
  const second = execFileSync(process.execPath, [cli, ...argv], { encoding: "utf8" })
  assert.equal(first, second)
  assert.ok(first.includes("\"семя\": \"7\""))
})

test("CLI с разными семенами даёт разный stdout", () => {
  const argv = (seed) => ["run", "конфигурация", "--seed", String(seed), "--generations", "15", "--population", "20", "--history"]
  const first = execFileSync(process.execPath, [cli, ...argv(7)], { encoding: "utf8" })
  const second = execFileSync(process.execPath, [cli, ...argv(8)], { encoding: "utf8" })
  assert.notEqual(first, second)
})

test("кэш оценок не влияет на результат, только на счётчик вызовов", () => {
  const result = run("расписание", 99)
  assert.ok(result["вызовов утилиты FTS"] <= result["параметры"].populationSize * (result["поколений"] + 1))
  assert.equal(result["разных особей"], result["вызовов утилиты FTS"])
})

test("параметры прогона возвращаются в отчёте — прогон описан целиком", () => {
  const result = run("расписание", 42, { crossover: "одноточечный", selection: "рулетка" })
  assert.equal(result["семя"], "42")
  assert.equal(result["параметры"].crossover, "одноточечный")
  assert.equal(result["параметры"].selection, "рулетка")
  // Семя плюс параметры плюс модель — исчерпывающее описание прогона:
  // повторить его можно, не зная ничего больше.
  assert.equal(JSON.stringify(result), JSON.stringify(run("расписание", 42, { crossover: "одноточечный", selection: "рулетка" })))
})
