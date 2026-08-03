/**
 * Четыре режима: отработка, соблюдение бюджета, разделение ответственности уровней.
 *
 * Главное здесь — бюджет. Раздел 2.4.3: «Пилотные оценки GA1 входят в N*,
 * поэтому каскад не получает дополнительного скрытого бюджета». Режим,
 * незаметно потративший больше оценок, выиграл бы в таблице по причине,
 * не имеющей отношения к устройству каскада.
 */

import assert from "node:assert/strict"
import { test } from "node:test"

import { Budget, planBudget } from "../src/budget.mjs"
import { MODES, modeNames, runMode } from "../src/cascade.mjs"
import { CONFIGURATIONS, configurationNames } from "../src/ga2.mjs"
import { CLASSES, SIZES, createScenario } from "../src/scenario.mjs"
import { WINDOW } from "../src/readiness.mjs"

const BUDGET = 1200

test("объявлены ровно четыре сравниваемых режима с обозначениями раздела 2.4.4", () => {
  assert.deepEqual(modeNames(), ["cascade", "single", "two-level", "heuristic"])
  assert.deepEqual(MODES, {
    cascade: "ga0_ga1_ga2",
    single: "ga_single",
    "two-level": "ga1_ga2",
    heuristic: "greedy",
  })
})

test("конфигурации GA1 совпадают с таблицей раздела 2.4.2", () => {
  assert.deepEqual(CONFIGURATIONS, {
    compact: { "N_pop": 32, "p_mut": 0.06, "p_cross": 0.80 },
    balanced: { "N_pop": 48, "p_mut": 0.10, "p_cross": 0.82 },
    exploratory: { "N_pop": 64, "p_mut": 0.18, "p_cross": 0.85 },
  })
})

test("каждый режим отрабатывает и укладывается в бюджет", () => {
  for (const size of ["S", "M"]) {
    for (const mode of modeNames()) {
      const result = runMode({ mode, seed: 9, size, budget: BUDGET })
      assert.equal(result["режим"], mode)
      assert.ok(Number.isFinite(result["J_p"]), `${mode}/${size}: J_p не число`)
      assert.ok(result["J_p"] >= 0 && result["J_p"] <= 1, `${mode}/${size}: J_p вне [0;1]`)
      assert.ok(Number.isFinite(result["τ, мс"]) && result["τ, мс"] >= 0)
      assert.equal(typeof result["допустим"], "boolean")
      assert.equal(result["X*"].length, SIZES[size]["задач"])
      for (const executor of result["X*"]) {
        assert.ok(Number.isInteger(executor) && executor >= 0 && executor < SIZES[size]["исполнителей"])
      }
      const limit = mode === "heuristic" ? 1 : BUDGET
      assert.ok(result["N*"] <= limit, `${mode}/${size}: израсходовано ${result["N*"]} при пределе ${limit}`)
    }
  }
})

test("все эволюционные режимы имеют один и тот же N_max (раздел 3.3.1)", () => {
  const evolutionary = ["single", "two-level", "cascade"]
  const limits = evolutionary.map((mode) => runMode({ mode, seed: 12, budget: BUDGET })["N_max"])
  assert.deepEqual(limits, [BUDGET, BUDGET, BUDGET])
})

test("пилоты GA1 входят в N*: скрытого бюджета у каскада нет", () => {
  const plan = planBudget({ total: BUDGET, configurations: configurationNames().length, pilotShare: 0.08, pilotMin: 128 })
  assert.equal(plan["на один пилот"], 128, "max(128, 0.08·1200) = 128 — раздел 2.4.2")
  assert.equal(plan["на все пилоты"], 384)

  for (const mode of ["two-level", "cascade"]) {
    const result = runMode({ mode, seed: 21, budget: BUDGET })
    const pilotCost = result["пилоты"].reduce((sum, pilot) => sum + pilot["оценок"], 0)
    const ledger = result["бюджет"]["статьи"].reduce((sum, item) => sum + item["оценок"], 0)
    assert.ok(pilotCost > 0, `${mode}: пилоты не израсходовали ничего`)
    assert.equal(ledger, pilotCost, `${mode}: в книге бюджета учтены не все пилотные оценки`)
    assert.ok(result["N*"] <= BUDGET, `${mode}: перерасход ${result["N*"]} при N_max ${BUDGET}`)
    for (const pilot of result["пилоты"]) {
      assert.ok(pilot["оценок"] <= plan["на один пилот"], `${mode}/${pilot["конфигурация"]}: пилот вышел за свой потолок`)
    }
  }
})

test("одноуровневый режим не тратит бюджет на пилоты и берёт фиксированную balanced", () => {
  const result = runMode({ mode: "single", seed: 21, budget: BUDGET })
  assert.equal(result["пилоты"], null)
  assert.equal(result["θ*"]["имя"], "balanced")
  // Одноуровневый обязан израсходовать бюджет целиком с точностью до остатка,
  // меньшего размера популяции: ранней остановки у него нет.
  assert.ok(BUDGET - result["N*"] < CONFIGURATIONS.balanced["N_pop"], `остаток ${BUDGET - result["N*"]} слишком велик`)
})

test("GA0 не может остановиться раньше пятого поколения", () => {
  // c_min = 0 разрешает остановку при любом значении готовности; окно
  // устойчивости всё равно обязано заполниться (разделы 2.4.3 и 2.4.5).
  const result = runMode({ mode: "cascade", seed: 4, budget: BUDGET, cmin: 0 })
  assert.equal(result["останов"], "готовность достигнута")
  assert.ok(result["поколений"] >= WINDOW, `останов на поколении ${result["поколений"]}, окно требует ${WINDOW}`)
})

test("недостижимый порог готовности превращает каскад в двухуровневый режим", () => {
  const cascade = runMode({ mode: "cascade", seed: 4, budget: BUDGET, cmin: 1.01 })
  const twoLevel = runMode({ mode: "two-level", seed: 4, budget: BUDGET })
  assert.equal(cascade["останов"], "исчерпан бюджет")
  assert.equal(cascade["N*"], twoLevel["N*"])
  assert.equal(cascade["J_p"], twoLevel["J_p"])
})

test("бюджет отказывается работать при заведомо неверном распределении между уровнями", () => {
  assert.throws(
    () => planBudget({ total: 300, configurations: 3, pilotShare: 0.08, pilotMin: 128 }),
    /финальному GA2 не остаётся ничего/u,
  )
  assert.throws(() => new Budget(0), /положительным целым/u)
  const budget = new Budget(10)
  budget.spend(10)
  assert.throws(() => budget.spend(1), /перерасход/u)
})

test("распределение бюджета между уровнями — параметр, а не константа", () => {
  const narrow = runMode({ mode: "two-level", seed: 6, budget: 2000, pilotShare: 0.05, pilotMin: 64 })
  const wide = runMode({ mode: "two-level", seed: 6, budget: 2000, pilotShare: 0.20, pilotMin: 64 })
  const narrowPilots = narrow["пилоты"].reduce((sum, pilot) => sum + pilot["оценок"], 0)
  const widePilots = wide["пилоты"].reduce((sum, pilot) => sum + pilot["оценок"], 0)
  assert.ok(widePilots > narrowPilots, `доля пилота не влияет на расход: ${widePilots} против ${narrowPilots}`)
  assert.ok(narrow["N*"] <= 2000 && wide["N*"] <= 2000)
})

test("все классы сценариев и все размерности отрабатывают в каскаде", () => {
  for (const className of Object.keys(CLASSES)) {
    const scenario = createScenario({ class: className, size: "S", seed: 3 })
    const result = runMode({ mode: "cascade", seed: 3, scenario, budget: 640 })
    assert.ok(Number.isFinite(result["J_p"]), `${className}: J_p не число`)
    assert.ok(result["N*"] <= 640)
  }
})
