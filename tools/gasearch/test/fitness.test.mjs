/**
 * Мост к FTS.
 *
 * Здесь проверяется, что движок ничего не добавляет от себя: число, попавшее
 * в отчёт, — это в точности то, что вернула утилита FTS при прямом вызове.
 * И что выбранное правило обращения с недопустимой особью (штраф, а не
 * отбраковка) выполняется буквально, включая отказ штрафовать собственные
 * ошибки движка.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { executeUtility } from "../../../dist/src/index.js"
import { loadModel } from "../src/catalog.mjs"
import { DEFAULT_PENALTY, REASON_ADMISSION, REASON_PROPERTY, createEvaluator } from "../src/fitness.mjs"
import { buildSpec, createPopulation } from "../src/population.mjs"
import { createStream } from "../src/random.mjs"

const schedule = loadModel("расписание")
const config = loadModel("конфигурация")

const scheduleSpec = buildSpec(schedule.document, schedule.entry["объект"], schedule.entry["диапазоны"])
const configSpec = buildSpec(config.document, config.entry["объект"], config.entry["диапазоны"])

const scheduleFitness = createEvaluator({ document: schedule.document, utility: "Оценить вариант" })
const configFitness = createEvaluator({
  document: config.document,
  utility: "Оценить конфигурацию",
  admissibility: "Конфигурация допустима",
})

test("фитнес совпадает с прямым вызовом executeUtility", () => {
  const population = createPopulation(scheduleSpec, 200, createStream(31).fork("выборка"))
  let checked = 0
  for (const genes of population) {
    const evaluated = scheduleFitness(genes)
    if (!evaluated.feasible) continue
    assert.equal(evaluated.score, executeUtility(schedule.document, "Оценить вариант", genes))
    assert.equal(evaluated.fitness, evaluated.score)
    checked += 1
  }
  assert.ok(checked > 0, "в выборке не оказалось ни одной допустимой особи")
})

test("минимизация меняет знак фитнеса, но не оценку", () => {
  const minimizing = createEvaluator({ document: schedule.document, utility: "Оценить вариант", direction: "минимум" })
  const genes = { "смен днём": 8, "смен ночью": 4, "резервных смен": 2, "доплата за ночь": true }
  assert.equal(minimizing(genes).score, 130)
  assert.equal(minimizing(genes).fitness, -130)
})

test("нарушение свойства — недопустимая особь, а не падение прогона", () => {
  // Ночные смены без доплаты запрещены правилом модели: оценка уходит в -100
  // и не проходит свойство «Вариант не убыточен».
  const genes = { "смен днём": 8, "смен ночью": 4, "резервных смен": 2, "доплата за ночь": false }
  assert.throws(() => executeUtility(schedule.document, "Оценить вариант", genes), /FTS_UTILITY_PROPERTY|свойство/u)

  const evaluated = scheduleFitness(genes)
  assert.equal(evaluated.feasible, false)
  assert.equal(evaluated.reason, REASON_PROPERTY)
  assert.equal(evaluated.score, null, "у недопустимой особи не может быть оценки: вычисление прервалось")
  assert.equal(evaluated.fitness, DEFAULT_PENALTY)
})

test("штраф строго ниже любой достижимой оценки", () => {
  const population = createPopulation(scheduleSpec, 500, createStream(77).fork("выборка"))
  const feasible = population.map(scheduleFitness).filter((entry) => entry.feasible)
  assert.ok(feasible.length > 0)
  assert.ok(Math.min(...feasible.map((entry) => entry.fitness)) > DEFAULT_PENALTY)
})

test("недопустимые особи остаются в популяции, а не выбрасываются", () => {
  const population = createPopulation(scheduleSpec, 300, createStream(5).fork("выборка"))
  const evaluated = population.map(scheduleFitness)
  assert.equal(evaluated.length, population.length, "оценка не имеет права менять размер популяции")
  assert.ok(evaluated.some((entry) => !entry.feasible), "выборка обязана содержать недопустимые особи")
})

test("утилита допуска отклоняет конфигурацию отдельно от оценки", () => {
  const genes = { "размер пула": 2, "таймаут мс": 400, "размер кэша мб": 64, "повторы включены": false }
  assert.equal(executeUtility(config.document, "Конфигурация допустима", genes), false)

  const evaluated = configFitness(genes)
  assert.equal(evaluated.feasible, false)
  assert.equal(evaluated.reason, REASON_ADMISSION)
  assert.equal(evaluated.fitness, DEFAULT_PENALTY)

  // Оценка сама по себе для этой конфигурации считается без ошибок — именно
  // поэтому допуск и вынесен в отдельную утилиту: он не следует из оценки.
  assert.equal(typeof executeUtility(config.document, "Оценить конфигурацию", genes), "number")
})

test("отключённый допуск возвращает недопустимую особь в игру", () => {
  const genes = { "размер пула": 2, "таймаут мс": 400, "размер кэша мб": 64, "повторы включены": false }
  const withoutAdmission = createEvaluator({ document: config.document, utility: "Оценить конфигурацию" })
  const evaluated = withoutAdmission(genes)
  assert.equal(evaluated.feasible, true)
  assert.equal(evaluated.score, executeUtility(config.document, "Оценить конфигурацию", genes))
})

test("ошибки движка не маскируются под недопустимость", () => {
  // Неверный тип поля — это баг движка, а не свойство особи. Штраф здесь
  // означал бы «поиск работает», хотя он ищет по сломанному входу.
  assert.throws(() => scheduleFitness({ "смен днём": "восемь", "смен ночью": 0, "резервных смен": 0, "доплата за ночь": false }), /FTS_UTILITY_INPUT_TYPE|не соответствует типу/u)
  assert.throws(() => scheduleFitness({ "смен днём": 8 }), /отсутствует поле/u)
  assert.throws(() => createEvaluator({ document: schedule.document, utility: "Нет такой" }), /нет утилиты/u)
  assert.throws(() => createEvaluator({ document: config.document, utility: "Оценить конфигурацию", admissibility: "Нет такой" }), /допуска/u)
})

test("спецификация генов берёт роды полей из модели", () => {
  assert.deepEqual(configSpec.genes.map((gene) => `${gene.name}:${gene.kind}`), [
    "размер пула:число",
    "таймаут мс:число",
    "размер кэша мб:число",
    "повторы включены:признак",
  ])
  assert.throws(() => buildSpec(config.document, "Конфигурация", {}), /не задан диапазон/u)
  assert.throws(() => buildSpec(config.document, "Нет такого", {}), /нет объекта/u)
})
