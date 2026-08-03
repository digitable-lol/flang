/**
 * Модели каталога: компиляция, validate, примеры.
 *
 * Это тот же контракт, что и у остальных .fts-моделей репозитория. Отдельно
 * проверяется согласованность каталога с моделью: диапазон задан для каждого
 * числового поля и ни для одного лишнего, а объявленный «известный оптимум»
 * действительно достижим и действительно не превзойдён — иначе тест на
 * сходимость сравнивал бы результат с выдумкой.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { evaluateUtility, executeUtility, testUtilities, validate } from "../../../dist/src/index.js"
import { CATALOG, loadModel, modelNames } from "../src/catalog.mjs"
import { buildSpec, createPopulation, withinBounds } from "../src/population.mjs"
import { createEvaluator } from "../src/fitness.mjs"
import { createStream } from "../src/random.mjs"

for (const name of modelNames()) {
  test(`модель «${name}» компилируется и проходит validate`, () => {
    const model = loadModel(name)
    assert.equal(validate(model.document).valid, true)
    assert.ok((model.document.utilities ?? []).length > 0)
  })

  test(`примеры модели «${name}» сходятся`, () => {
    const model = loadModel(name)
    const results = testUtilities(model.document)
    assert.equal(results.valid, true, JSON.stringify(results.results.filter((item) => !item.passed)))
    assert.ok(results.total >= 4, "модель обязана нести не меньше четырёх примеров")
  })

  test(`каталог согласован с объектом модели «${name}»`, () => {
    const model = loadModel(name)
    const spec = buildSpec(model.document, model.entry["объект"], model.entry["диапазоны"])
    const structure = model.document.structures.find((item) => item.name === model.entry["объект"])
    assert.deepEqual(spec.genes.map((gene) => gene.name), structure.fields.map((field) => field.name))
  })

  test(`случайные особи модели «${name}» принимаются утилитой без ошибок типов`, () => {
    const model = loadModel(name)
    const spec = buildSpec(model.document, model.entry["объект"], model.entry["диапазоны"])
    const evaluate = createEvaluator({
      document: model.document,
      utility: model.entry["утилита"],
      admissibility: model.entry["допуск"],
    })
    for (const genes of createPopulation(spec, 300, createStream(19).fork(`модель:${name}`))) {
      assert.ok(withinBounds(spec, genes))
      // Единственное, что здесь допустимо, — недопустимость особи.
      // Любая другая диагностика FTS вылетит наружу и уронит тест.
      evaluate(genes)
    }
  })
}

test("объявленный оптимум расписания достижим и не превзойдён перебором", () => {
  const model = loadModel("расписание")
  const evaluate = createEvaluator({ document: model.document, utility: "Оценить вариант" })
  let best = -Infinity
  let argument = null
  for (let day = 0; day <= 14; day += 1) {
    for (let night = 0; night <= 14; night += 1) {
      for (let reserve = 0; reserve <= 8; reserve += 1) {
        for (const extra of [false, true]) {
          const evaluated = evaluate({ "смен днём": day, "смен ночью": night, "резервных смен": reserve, "доплата за ночь": extra })
          if (evaluated.feasible && evaluated.score > best) {
            best = evaluated.score
            argument = { day, night, reserve, extra }
          }
        }
      }
    }
  }
  assert.equal(best, CATALOG["расписание"]["известный оптимум"])
  assert.deepEqual(argument, { day: 8, night: 4, reserve: 2, extra: true })
})

test("объявленный оптимум конфигурации достижим и не превзойдён перебором", () => {
  const model = loadModel("конфигурация")
  // Полный перебор сетки — 1.6 млн точек, поэтому здесь вызывается
  // evaluateUtility напрямую: он считает ту же арифметику, но не перепроверяет
  // типы полей на каждой точке. Соответствие evaluateUtility и executeUtility
  // на этих моделях закрыто отдельным тестом в fitness.test.mjs.
  const score = model.document.utilities.find((item) => item.name === "Оценить конфигурацию")
  const admitted = model.document.utilities.find((item) => item.name === "Конфигурация допустима")

  let best = -Infinity
  let argument = null
  for (let pool = 1; pool <= 64; pool += 1) {
    for (let timeout = 50; timeout <= 5000; timeout += 50) {
      for (let cache = 0; cache <= 1024; cache += 8) {
        for (const retries of [false, true]) {
          const genes = {
            "размер пула": pool,
            "таймаут мс": timeout,
            "размер кэша мб": cache,
            "повторы включены": retries,
          }
          if (!evaluateUtility(admitted, genes)) continue
          const value = evaluateUtility(score, genes)
          if (value > best) {
            best = value
            argument = { pool, timeout, cache, retries }
          }
        }
      }
    }
  }
  assert.equal(best, CATALOG["конфигурация"]["известный оптимум"])
  assert.deepEqual(argument, { pool: 16, timeout: 400, cache: 256, retries: true })
})

test("свойство модели расписания действительно отсекает часть пространства", () => {
  const model = loadModel("расписание")
  const violates = (genes) => assert.throws(
    () => executeUtility(model.document, "Оценить вариант", genes),
    /свойство/u,
    "модель без достижимых нарушений свойства не проверяет обработку недопустимых особей",
  )

  // Убыточный вариант: ночных смен куплено вдвое больше нужного.
  violates({ "смен днём": 0, "смен ночью": 12, "резервных смен": 0, "доплата за ночь": true })
  // Жёсткое ограничение: ночная работа без доплаты.
  violates({ "смен днём": 8, "смен ночью": 4, "резервных смен": 2, "доплата за ночь": false })
})
