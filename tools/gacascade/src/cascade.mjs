/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Уровни GA1 и GA0 и четыре сравниваемых режима.
 *
 * ── GA1: выбор конфигурации (раздел 2.4.2) ────────────────────────────────
 * Рассматриваются три заранее определённые конфигурации `compact`,
 * `balanced`, `exploratory` (таблица раздела 2.4.2). Каждой выделяется пилот,
 * конфигурация выбирается по минимальному наблюдаемому J_p:
 *
 *   θ* = argmin_{θ∈Θ} J_p( X_pilot(θ) ),   при равенстве — меньшая популяция.
 *
 * Стоимость пилота входит в общий N_max и не скрывается при сравнении.
 *
 * ── GA0: управление бюджетом (раздел 2.4.3) ───────────────────────────────
 *   N* = min{ N ≤ N_max | c(N) ≥ c_min }.
 * Если множество пусто, расчёт завершается при N_max. Пилотные оценки GA1
 * входят в N*, поэтому каскад не получает скрытого бюджета.
 *
 * ── Режимы (раздел 2.4.4) ─────────────────────────────────────────────────
 *   heuristic  = `greedy`       — конструктивный, без настройки и без остановки
 *   single     = `ga_single`    — GA2 с фиксированной `balanced`
 *   two-level  = `ga1_ga2`      — пилот GA1 + GA2, без ранней остановки
 *   cascade    = `ga0_ga1_ga2`  — пилот GA1 + GA2 + ранняя остановка по c_min
 *
 * Все эволюционные режимы имеют ОДИНАКОВЫЙ N_max (раздел 3.3.1).
 *
 * ── ОДНО МЕСТО, ГДЕ ТЕКСТ ДОПУСКАЕТ ДВА ПРОЧТЕНИЯ ────────────────────────
 * Раздел 2.4.2 говорит: «Оставшийся бюджет используется для финального
 * запуска выбранного GA2», а раздел 2.4.5, шаг 6: «Вернуть лучшее
 * назначение». Неясно, лучшее — за финальный запуск или за весь прогон,
 * включая пилоты. Реализованы ОБА: в протоколе есть и «J_p финала», и
 * «J_p лучший за прогон». Головным считается второй (система, увидевшая
 * хороший план на пилоте, не имеет права его забыть), но оба числа
 * присутствуют в JSON, и таблицу можно построить по любому из них.
 */

import { createStream } from "../../gasearch/src/random.mjs"
import { Budget, planBudget, DEFAULT_PILOT_MIN, DEFAULT_PILOT_SHARE } from "./budget.mjs"
import { createPlanEvaluator, loadModel } from "./fitness.mjs"
import { CONFIGURATIONS, DEFAULT_CONFIGURATION, buildAssignmentSpec, configurationNames, runGA2, toAssignment } from "./ga2.mjs"
import { heuristicReadiness } from "./readiness.mjs"
import { createScenario, describeScenario, greedyAssignment } from "./scenario.mjs"

export const MODES = {
  cascade: "ga0_ga1_ga2",
  single: "ga_single",
  "two-level": "ga1_ga2",
  heuristic: "greedy",
}

export function modeNames() {
  return Object.keys(MODES)
}

export const RUN_DEFAULTS = {
  "бюджет": 1200,
  "c_min": 0.85,
  "доля пилота": DEFAULT_PILOT_SHARE,
  "минимум пилота": DEFAULT_PILOT_MIN,
  "класс": "dense_dependencies",
  "размер": "S",
}

/**
 * Один прогон одного режима.
 *
 * Протокол результата соответствует записи ℓ раздела 2.4.3:
 * ⟨scenario, seed, θ*, N*, τ, X*, c, Q(X*), J_p(X*), reason⟩.
 */
export function runMode({
  mode,
  seed,
  scenario = null,
  model = loadModel(),
  budget: budgetLimit = RUN_DEFAULTS["бюджет"],
  cmin = RUN_DEFAULTS["c_min"],
  pilotShare = RUN_DEFAULTS["доля пилота"],
  pilotMin = RUN_DEFAULTS["минимум пилота"],
  class: className = RUN_DEFAULTS["класс"],
  size = RUN_DEFAULTS["размер"],
  ga2Options = {},
  includeHistory = false,
} = {}) {
  if (!MODES[mode]) throw new Error(`неизвестный режим «${mode}»; доступны: ${modeNames().join(", ")}`)
  if (!Number.isInteger(seed)) throw new Error("seed должен быть целым числом")

  const instance = scenario ?? createScenario({ class: className, size, seed })
  const evaluatePlan = createPlanEvaluator(instance, model)
  const started = process.hrtime.bigint()

  const result = mode === "heuristic"
    ? runHeuristic({ scenario: instance, evaluatePlan })
    : runEvolutionary({ mode, seed, scenario: instance, evaluatePlan, budgetLimit, cmin, pilotShare, pilotMin, ga2Options, includeHistory })

  // τ — фактическое время расчёта (раздел 2.3: P(t) = (1−c, τ, N)). Оно
  // аппаратно-зависимо, поэтому в выводах ведущим показателем экономии служит
  // N — число оценок целевой функции (раздел 3.3.2).
  const tau = Number(process.hrtime.bigint() - started) / 1e6

  return {
    "режим": mode,
    "режим по диссертации": MODES[mode],
    "сценарий": describeScenario(instance),
    "семя": seed,
    "θ*": result["θ*"],
    "N*": result["N*"],
    "N_max": result["N_max"],
    "τ, мс": tau,
    "c": result["c"],
    "компоненты c": result["компоненты c"],
    "J_p": result["J_p"],
    "J_p финала": result["J_p финала"],
    "Δ": result["Δ"],
    "σ": result["критерии"]["σ"],
    "допустим": result["допустим"],
    "Q(X*)": result["критерии"],
    "X*": result["X*"],
    "останов": result["останов"],
    "поколений": result["поколений"],
    "разных планов": result["разных планов"],
    "пилоты": result["пилоты"] ?? null,
    "бюджет": result["бюджет"],
    // История поколений финального GA2: траектория J_p и покомпонентная
    // готовность c. По ней строятся графики сходимости раздела 3.4 и по ней
    // же проверяется воспроизводимость — совпадения одного лишь итога мало.
    ...(includeHistory ? { "история": result["история"] ?? null } : {}),
  }
}

/** Режим `greedy`: конструктивный план, одна оценка целевой функции. */
function runHeuristic({ scenario, evaluatePlan }) {
  const assignment = greedyAssignment(scenario)
  const evaluation = evaluatePlan(assignment)
  const c = heuristicReadiness(evaluation["Δ"])
  return {
    "θ*": null,
    "N*": 1,
    "N_max": 1,
    "c": c["c"],
    "компоненты c": c,
    "J_p": evaluation["J_p"],
    "J_p финала": evaluation["J_p"],
    "Δ": evaluation["Δ"],
    "критерии": evaluation["критерии"],
    "допустим": evaluation["допустим"],
    "X*": assignment,
    "останов": "конструктивное построение завершено",
    "поколений": 0,
    "разных планов": 1,
    "бюджет": { "предел": 1, "израсходовано": 1, "остаток": 0 },
  }
}

function runEvolutionary({ mode, seed, scenario, evaluatePlan, budgetLimit, cmin, pilotShare, pilotMin, ga2Options, includeHistory = false }) {
  const spec = buildAssignmentSpec(scenario)
  const budget = new Budget(budgetLimit, `прогон ${mode}`)
  // ИМЯ РЕЖИМА В ПОТОК НЕ ВХОДИТ, И ЭТО ГЛАВНОЕ УСЛОВИЕ ЧЕСТНОСТИ СРАВНЕНИЯ.
  //
  // Раздел 3.3.1: «Алгоритмы сравниваются попарно на одних и тех же
  // экземплярах, при общих seed». Если бы корневой поток форкался от имени
  // режима, `two-level` и `cascade` пошли бы по РАЗНЫМ случайным траекториям,
  // и разница в таблице складывалась бы из вклада GA0 и из вклада другого
  // жребия — разделить их было бы нечем.
  //
  // При таком именовании cascade — это в точности two-level, оборванный
  // правилом c ≥ c_min: до момента остановки обе траектории совпадают до
  // бита. А если GA1 выбирает `balanced`, то и финальный GA2 двухуровневого
  // режима идёт по тому же потоку, что одноуровневый, отличаясь только
  // доступным бюджетом. Сравнение измеряет ровно вклад уровня, и ничего кроме.
  const root = createStream(seed).fork("прогон")
  const usesGA1 = mode === "cascade" || mode === "two-level"
  const usesGA0 = mode === "cascade"

  let pilots = null
  let chosen = DEFAULT_CONFIGURATION
  let overall = null

  if (usesGA1) {
    const share = planBudget({ total: budgetLimit, configurations: configurationNames().length, pilotShare, pilotMin })
    pilots = []
    // Пилоты идут в порядке объявления конфигураций, но КАЖДЫЙ получает поток
    // от своего ИМЕНИ, а не от порядкового номера. Перестановка строк таблицы
    // раздела 2.4.2 не изменит ни одного результата.
    for (const name of configurationNames()) {
      const sub = budget.sub(share["на один пилот"], `пилот GA1: ${name}`)
      const pilot = runGA2({
        scenario,
        spec,
        evaluatePlan,
        configuration: CONFIGURATIONS[name],
        budget: sub,
        stream: root.fork(`GA1:пилот:${name}`),
        cmin: null,
        options: ga2Options,
      })
      pilots.push({
        "конфигурация": name,
        "N_pop": CONFIGURATIONS[name]["N_pop"],
        "J_p": pilot["лучший"]["J_p"],
        "оценок": sub.spent,
        "поколений": pilot["поколений"],
      })
      overall = keepBest(overall, pilot["лучший"])
    }

    // θ* = argmin J_p; при равенстве — меньшая популяция (раздел 2.4.2).
    chosen = pilots.reduce((best, candidate) => {
      if (candidate["J_p"] < best["J_p"]) return candidate
      if (candidate["J_p"] > best["J_p"]) return best
      return candidate["N_pop"] < best["N_pop"] ? candidate : best
    })["конфигурация"]
  }

  const final = runGA2({
    scenario,
    spec,
    evaluatePlan,
    configuration: CONFIGURATIONS[chosen],
    budget,
    stream: root.fork(`GA2:финал:${chosen}`),
    cmin: usesGA0 ? cmin : null,
    options: ga2Options,
  })
  overall = keepBest(overall, final["лучший"])

  const readinessOfFinal = final["готовность"]
  return {
    "θ*": { "имя": chosen, ...CONFIGURATIONS[chosen] },
    "N*": budget.spent,
    "N_max": budgetLimit,
    "c": readinessOfFinal["c"],
    "компоненты c": readinessOfFinal,
    "J_p": overall["J_p"],
    "J_p финала": final["лучший"]["J_p"],
    "Δ": overall["Δ"],
    "критерии": overall["критерии"],
    "допустим": overall["допустим"],
    "X*": toAssignment(spec, overall.genes),
    "останов": final["останов"],
    "поколений": final["поколений"],
    "разных планов": final["разных планов"],
    "пилоты": pilots,
    "бюджет": budget.toJSON(),
    "история": includeHistory ? final["история"] : null,
  }
}

/** Меньший J_p побеждает; при равенстве остаётся действующий чемпион — сравнение детерминировано. */
function keepBest(current, candidate) {
  if (current === null) return candidate
  return candidate["J_p"] < current["J_p"] ? candidate : current
}
