/**
 * Воспроизводимость.
 *
 * Требование «фиксация seed, не менее 30 прогонов» (раздел 3.3.1) выполнимо
 * ровно настолько, насколько честна воспроизводимость. Здесь проверяется не
 * «совпал итоговый J_p», а совпадение ВСЕЙ истории поколений: одинаковый
 * итог при разошедшихся траекториях означал бы, что совпадение случайно.
 *
 * Отдельно проверяется свойство именованных подпотоков: результат не зависит
 * от ПОРЯДКА вычислений. Ради него в gasearch и заведено расщепление по
 * именам, и если бы каскад брал случайность из общего курсора, перестановка
 * пилотов GA1 меняла бы ответ.
 */

import assert from "node:assert/strict"
import { test } from "node:test"

import { createStream } from "../../gasearch/src/random.mjs"
import { Budget } from "../src/budget.mjs"
import { runMode } from "../src/cascade.mjs"
import { createPlanEvaluator, loadModel } from "../src/fitness.mjs"
import { CONFIGURATIONS, buildAssignmentSpec, configurationNames, runGA2 } from "../src/ga2.mjs"
import { createScenario } from "../src/scenario.mjs"

/** Прогон GA2 «под ключ» — используется несколькими проверками ниже. */
function ga2(seedOrLabel, configurationName, { budget = 640, scenarioSeed = 3 } = {}) {
  const scenario = createScenario({ class: "dense_dependencies", size: "S", seed: scenarioSeed })
  return runGA2({
    scenario,
    spec: buildAssignmentSpec(scenario),
    evaluatePlan: createPlanEvaluator(scenario, loadModel()),
    configuration: CONFIGURATIONS[configurationName],
    budget: new Budget(budget),
    stream: createStream(seedOrLabel).fork(`GA2:${configurationName}`),
    cmin: null,
  })
}

test("сценарий воспроизводится побитово при одном семени", () => {
  for (const className of ["dense_dependencies", "priority_changes", "noisy_inputs"]) {
    const first = createScenario({ class: className, size: "S", seed: 17 })
    const second = createScenario({ class: className, size: "S", seed: 17 })
    assert.deepEqual(second, first, `${className}: сценарий не воспроизвёлся`)
  }
})

test("разные семена дают разные сценарии", () => {
  const first = createScenario({ class: "dense_dependencies", size: "S", seed: 17 })
  const second = createScenario({ class: "dense_dependencies", size: "S", seed: 18 })
  assert.notDeepEqual(second["задачи"], first["задачи"])
})

test("GA2 воспроизводит всю историю поколений, а не только итог", () => {
  const first = ga2(101, "balanced")
  const second = ga2(101, "balanced")

  assert.equal(second["история"].length, first["история"].length)
  assert.ok(first["история"].length >= 5, "история слишком коротка, чтобы что-то доказывать")
  assert.deepEqual(second["история"], first["история"])
  assert.deepEqual(second["лучший"].genes, first["лучший"].genes)
  assert.equal(second["разных планов"], first["разных планов"])
})

test("порядок вычислений не влияет на результат: подпотоки именованные", () => {
  // Прогон конфигурации exploratory сам по себе и он же — после того, как в
  // том же процессе отработали две другие конфигурации. Общий курсор
  // случайности дал бы здесь расхождение.
  const alone = ga2(202, "exploratory")
  ga2(202, "compact")
  ga2(202, "balanced")
  const afterOthers = ga2(202, "exploratory")
  assert.deepEqual(afterOthers["история"], alone["история"])
})

test("каждый прогон runMode воспроизводится целиком, кроме измеренного времени", () => {
  for (const mode of ["heuristic", "single", "two-level", "cascade"]) {
    const first = runMode({ mode, seed: 31, includeHistory: true })
    const second = runMode({ mode, seed: 31, includeHistory: true })
    delete first["τ, мс"]
    delete second["τ, мс"]
    assert.deepEqual(second, first, `режим ${mode} не воспроизвёлся`)
    if (mode !== "heuristic") {
      assert.ok(first["история"].length >= 5, `${mode}: история слишком коротка, чтобы что-то доказывать`)
      // Совпадение одного лишь итога не доказывает воспроизводимости:
      // разошедшиеся траектории могут сойтись в одну точку случайно.
      assert.deepEqual(second["история"], first["история"], `${mode}: разошлась история поколений`)
    }
  }
})

test("каскад — это двухуровневый режим, оборванный правилом c ≥ c_min", () => {
  // Ключевое условие честности сравнения: до момента остановки траектории
  // совпадают, поэтому разница в таблице относится к GA0, а не к другому
  // жребию. Проверяется на нескольких семенах, среди которых есть и такие,
  // где ранняя остановка срабатывает.
  let earlyStops = 0
  for (let seed = 1; seed <= 12; seed += 1) {
    const twoLevel = runMode({ mode: "two-level", seed })
    const cascade = runMode({ mode: "cascade", seed })
    assert.deepEqual(cascade["θ*"], twoLevel["θ*"], `seed ${seed}: GA1 выбрал разные конфигурации`)
    assert.ok(cascade["N*"] <= twoLevel["N*"], `seed ${seed}: каскад израсходовал больше оценок`)
    if (cascade["останов"] === "готовность достигнута") {
      earlyStops += 1
      assert.ok(cascade["N*"] < twoLevel["N*"], `seed ${seed}: ранняя остановка не сэкономила бюджет`)
    } else {
      assert.equal(cascade["J_p"], twoLevel["J_p"], `seed ${seed}: без ранней остановки режимы обязаны совпасть`)
    }
  }
  assert.ok(earlyStops > 0, "ни на одном семени GA0 не сработал — правило остановки не проверено")
})

test("выбор θ* не зависит от порядка перебора конфигураций", () => {
  const names = configurationNames()
  assert.deepEqual([...names].sort(), ["balanced", "compact", "exploratory"])
  // Пилоты форкаются от ИМЕНИ конфигурации (GA1:пилот:<имя>), поэтому
  // результат каждого пилота — функция имени, а не позиции в списке.
  const run = runMode({ mode: "two-level", seed: 44 })
  const pilots = run["пилоты"]
  assert.equal(pilots.length, 3)
  const best = [...pilots].sort((left, right) => left["J_p"] - right["J_p"] || left["N_pop"] - right["N_pop"])[0]
  assert.equal(run["θ*"]["имя"], best["конфигурация"])
})
