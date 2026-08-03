/**
 * Модель FTS: компиляция, validate, сходимость примеров и инварианты.
 *
 * Смысл этих проверок — не «код работает», а «целевая функция та самая».
 * Если веса скаляризации в assignment.fts разойдутся с разделом 2.3
 * диссертации, вся сводная таблица окажется аккуратным ответом не на тот
 * вопрос, и заметить это по числам J_p будет невозможно.
 */

import assert from "node:assert/strict"
import { test } from "node:test"

import { executeUtility } from "../../../dist/src/index.js"
import { UTILITY_FEASIBLE, UTILITY_PENALTY, UTILITY_SCORE, createPlanEvaluator, loadModel } from "../src/fitness.mjs"
import { SCALE, planCriteria, toAssignmentRecord } from "../src/plan.mjs"
import { createScenario, greedyAssignment } from "../src/scenario.mjs"

test("модель компилируется, проходит validate и все примеры сходятся", () => {
  const model = loadModel()
  assert.equal(model.tests.valid, true)
  assert.equal(model.tests.failed, 0)
  assert.ok(model.tests.total >= 15, `примеров должно быть не меньше 15, найдено ${model.tests.total}`)
  assert.deepEqual(
    (model.document.utilities ?? []).map((item) => item.name),
    [UTILITY_PENALTY, UTILITY_SCORE, UTILITY_FEASIBLE],
  )
})

test("Δ = 0,70·V_skill + 0,30·V_over — веса раздела 2.3", () => {
  const { document } = loadModel()
  const record = {
    "нарушения компетенций": 4000,
    "превышение ёмкости": 2000,
    "штраф ограничений": 0,
    "просрочка": 0,
    "дисбаланс загрузки": 0,
    "длительность расписания": 0,
    "доля переназначений": 0,
  }
  assert.equal(executeUtility(document, UTILITY_PENALTY, record), 0.7 * 4000 + 0.3 * 2000)
})

test("J_p = 0,45·Δ + 0,25·T + 0,15·B + 0,10·R + 0,05·H — веса раздела 2.3", () => {
  const { document } = loadModel()
  const record = {
    "нарушения компетенций": 0,
    "превышение ёмкости": 0,
    "штраф ограничений": 1000,
    "просрочка": 2000,
    "дисбаланс загрузки": 3000,
    "длительность расписания": 4000,
    "доля переназначений": 5000,
  }
  const expected = 0.45 * 1000 + 0.25 * 2000 + 0.15 * 3000 + 0.10 * 4000 + 0.05 * 5000
  assert.equal(executeUtility(document, UTILITY_SCORE, record), expected)
})

test("веса скаляризации в сумме дают единицу: угол шкалы отображается в себя", () => {
  const { document } = loadModel()
  const corner = Object.fromEntries([
    "нарушения компетенций", "превышение ёмкости", "штраф ограничений",
    "просрочка", "дисбаланс загрузки", "длительность расписания", "доля переназначений",
  ].map((name) => [name, SCALE]))
  assert.equal(executeUtility(document, UTILITY_PENALTY, corner), SCALE)
  assert.equal(executeUtility(document, UTILITY_SCORE, corner), SCALE)
})

test("допустимость: V_skill = 0 и V_over ≤ 0,05 — порог раздела 2.3", () => {
  const { document } = loadModel()
  const base = {
    "нарушения компетенций": 0,
    "превышение ёмкости": 0,
    "штраф ограничений": 0,
    "просрочка": 0,
    "дисбаланс загрузки": 0,
    "длительность расписания": 0,
    "доля переназначений": 0,
  }
  assert.equal(executeUtility(document, UTILITY_FEASIBLE, { ...base, "превышение ёмкости": 500 }), true)
  assert.equal(executeUtility(document, UTILITY_FEASIBLE, { ...base, "превышение ёмкости": 501 }), false)
  assert.equal(executeUtility(document, UTILITY_FEASIBLE, { ...base, "нарушения компетенций": 1 }), false)
})

test("инвариант «Ограничения учтены полностью» держится на всей сетке", () => {
  const { document } = loadModel()
  for (let penalty = 0; penalty <= SCALE; penalty += 250) {
    const record = {
      "нарушения компетенций": 0,
      "превышение ёмкости": 0,
      "штраф ограничений": penalty,
      "просрочка": 0,
      "дисбаланс загрузки": 0,
      "длительность расписания": 0,
      "доля переназначений": 0,
    }
    // Свойство внутри модели бросило бы FTS_UTILITY_PROPERTY; отсутствие
    // исключения и есть проверка инварианта.
    const score = executeUtility(document, UTILITY_SCORE, record)
    assert.ok(score >= 0.45 * penalty, `J_p = ${score} меньше вклада штрафа при Δ = ${penalty}`)
  }
})

test("компоненты вектора качества лежат в [0;1] на случайных и вырожденных планах", () => {
  for (const size of ["S", "M"]) {
    for (const className of ["dense_dependencies", "priority_changes", "noisy_inputs"]) {
      const scenario = createScenario({ class: className, size, seed: 11 })
      const plans = [
        greedyAssignment(scenario),
        scenario["действующий план"],
        // Вырожденный случай: всё одному исполнителю. Именно здесь нормировки
        // ломаются, если опорные величины выбраны неверно.
        new Array(scenario["задач"]).fill(0),
        new Array(scenario["задач"]).fill(scenario["исполнителей"] - 1),
      ]
      for (const plan of plans) {
        const criteria = planCriteria(scenario, plan)
        for (const [name, value] of Object.entries(criteria)) {
          if (typeof value !== "number") continue
          if (name === "нарушений компетенций, шт") continue
          assert.ok(value >= 0 && value <= 1, `${className}/${size}: ${name} = ${value} вне [0;1]`)
        }
        const record = toAssignmentRecord(criteria)
        for (const [name, value] of Object.entries(record)) {
          assert.ok(Number.isInteger(value) && value >= 0 && value <= SCALE, `${name} = ${value} вне сетки 0…${SCALE}`)
        }
      }
    }
  }
})

test("оценщик планов возвращает J_p, Δ, допустимость и σ", () => {
  const scenario = createScenario({ class: "dense_dependencies", size: "S", seed: 5 })
  const evaluate = createPlanEvaluator(scenario)
  const evaluation = evaluate(greedyAssignment(scenario))
  assert.ok(evaluation["J_p"] >= 0 && evaluation["J_p"] <= 1)
  assert.ok(evaluation["Δ"] >= 0 && evaluation["Δ"] <= 1)
  assert.equal(typeof evaluation["допустим"], "boolean")
  assert.ok(Number.isFinite(evaluation["критерии"]["σ"]))
})

test("жадный план не нарушает компетенций, когда компетентный исполнитель существует", () => {
  // Раздел 2.4.4: greedy задаёт быструю базовую границу. Если бы он нарушал
  // компетенции там, где этого можно избежать, граница была бы занижена, и
  // любой эволюционный режим выигрывал бы у соломенного чучела.
  for (const className of ["dense_dependencies", "priority_changes", "noisy_inputs"]) {
    for (let seed = 1; seed <= 5; seed += 1) {
      const scenario = createScenario({ class: className, size: "S", seed })
      const evaluation = createPlanEvaluator(scenario)(greedyAssignment(scenario))
      assert.equal(evaluation["нарушений компетенций, шт"], 0, `${className}/seed ${seed}: жадный план нарушил компетенции`)
    }
  }
})
