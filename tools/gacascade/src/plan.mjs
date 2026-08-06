/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Вектор качества плана Q(X) и его перевод в объект FTS «Назначение».
 *
 * Источник: раздел 2.3 диссертации.
 *
 *   Q(X) = (Δ(X), T(X), B(X), R_ms(X), H(X)),
 *   Δ    = 0,70·V_skill + 0,30·V_over,
 *   J_p  = 0,45·Δ + 0,25·T + 0,15·B + 0,10·R_ms + 0,05·H.
 *
 * Здесь считается только левая часть — сами компоненты. Свёртка в J_p живёт
 * в models/assignment.fts, потому что веса и коэффициенты штрафа — предмет
 * протокола и обязаны быть читаемыми (раздел 2.3: «в протоколе фиксируются
 * веса J_p, коэффициенты штрафов, правила нормировки»).
 *
 * ОБОЗНАЧЕНИЯ МЕТРИК. Работа использует σ для дисперсии загрузки
 * (04-chapter3-experiment-plan.md, раздел «Метрики») и B для того же
 * показателя в финальной редакции главы 2 (chapter2-03-multiobjective-model.md).
 * Это одна величина: нормированная дисперсия загрузок исполнителей. В коде
 * поле называется «дисбаланс загрузки», в отчётах — σ.
 */

import { hasCompetence, buildSchedule } from "./scenario.mjs"

/** Шкала передачи компонент в FTS: десятитысячные доли, целые 0…10000. */
export const SCALE = 10000

function clip01(value) {
  if (!Number.isFinite(value)) return 1
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/** Перевод доли из [0;1] в целую десятитысячную. Округление к ближайшему — единственный источник дискретизации. */
export function toScale(value) {
  const scaled = Math.round(clip01(value) * SCALE)
  return scaled < 0 ? 0 : scaled > SCALE ? SCALE : scaled
}

/**
 * Компоненты вектора качества по назначению.
 *
 * @param scenario   экземпляр сценария
 * @param assignment массив длины n: исполнитель каждой задачи
 * @returns объект с компонентами в [0;1] и вспомогательными величинами
 */
export function planCriteria(scenario, assignment) {
  const n = scenario["задач"]
  const tasks = scenario["задачи"]
  const executors = scenario["исполнители"]
  const capacities = scenario["ёмкости"]
  const references = scenario["опорные величины"]
  const schedule = buildSchedule(scenario, assignment)

  // V_skill — нормированная доля нарушений компетенций.
  let skillViolations = 0
  for (let j = 0; j < n; j += 1) {
    if (!hasCompetence(executors[assignment[j]]["компетенции"], tasks[j]["компетенция"])) skillViolations += 1
  }
  const vSkill = skillViolations / n

  // V_over — нормированное превышение ёмкости. Знаменатель — суммарная
  // ёмкость сценария, а не суммарная трудоёмкость: превышение измеряется
  // относительно того, что исполнители в принципе способны взять.
  let overload = 0
  for (let m = 0; m < executors.length; m += 1) {
    const excess = schedule["загрузки"][m] - capacities[m]
    if (excess > 0) overload += excess
  }
  const vOver = clip01(overload / references["ёмкость всего"])

  // T — нормированная просрочка, взвешенная приоритетом. Опорная величина
  // T_ref = Σ p_j·e_j: масштаб суммарной взвешенной работы. Просрочка,
  // сравнимая со всей работой итерации, — это уже единица.
  let tardiness = 0
  for (let j = 0; j < n; j += 1) {
    const late = schedule["завершение"][j] - tasks[j]["срок"]
    if (late > 0) tardiness += tasks[j]["приоритет"] * late
  }
  const tardy = clip01(tardiness / references["T_ref"])

  // B (σ) — нормированная дисперсия загрузок. B_ref = (средняя загрузка)²,
  // поэтому B — это квадрат коэффициента вариации: величина безразмерная и
  // сопоставимая между размерностями S, M и L.
  let mean = 0
  for (let m = 0; m < executors.length; m += 1) mean += schedule["загрузки"][m]
  mean /= executors.length
  let variance = 0
  for (let m = 0; m < executors.length; m += 1) {
    const deviation = schedule["загрузки"][m] - mean
    variance += deviation * deviation
  }
  variance /= executors.length
  const imbalance = clip01(variance / references["B_ref"])

  // R_ms — нормированная длительность расписания. R_ref — длительность, если
  // бы всё сделал один исполнитель: верхняя граница, достижимая назначением.
  const makespan = clip01(schedule["длительность"] / references["R_ref"])

  // H — доля назначений, изменённых относительно действующего плана.
  const base = scenario["действующий план"]
  let changed = 0
  for (let j = 0; j < n; j += 1) if (assignment[j] !== base[j]) changed += 1
  const churn = changed / n

  return {
    "нарушения компетенций": vSkill,
    "превышение ёмкости": vOver,
    "просрочка": tardy,
    "дисбаланс загрузки": imbalance,
    "длительность расписания": makespan,
    "доля переназначений": churn,
    "расписание": schedule,
    "нарушений компетенций, шт": skillViolations,
  }
}

/**
 * Объект FTS «Назначение» из компонент.
 *
 * Поле «штраф ограничений» заполняется отдельно: его считает утилита
 * «Штраф ограничений», а не этот модуль. До вызова утилиты оно равно нулю —
 * значение-заглушка, которую fitness.mjs обязан перезаписать.
 */
export function toAssignmentRecord(criteria) {
  return {
    "нарушения компетенций": toScale(criteria["нарушения компетенций"]),
    "превышение ёмкости": toScale(criteria["превышение ёмкости"]),
    "штраф ограничений": 0,
    "просрочка": toScale(criteria["просрочка"]),
    "дисбаланс загрузки": toScale(criteria["дисбаланс загрузки"]),
    "длительность расписания": toScale(criteria["длительность расписания"]),
    "доля переназначений": toScale(criteria["доля переназначений"]),
  }
}
