/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Фитнес: три критерия и два способа их сравнивать.
 *
 * Однокритериальный синтез по точности даёт переобученный мусор — набор из
 * двадцати правил, каждое из которых объясняет три наблюдения. Поэтому
 * критериев три:
 *
 *  1. точность    — насколько модель воспроизводит исторические решения;
 *  2. простота    — штраф за число правил и условий (бритва Оккама);
 *  3. допустимость — доля наблюдений, на которых модель нарушает свои свойства.
 *
 * Выбор меры точности. Для числового ответа берётся средняя абсолютная ошибка,
 * а не доля точных попаданий: скидка непрерывна, попадание «в копейку» —
 * случайность, а MAE даёт поиску градиент — модель, промахнувшаяся на 50
 * рублей, лучше промахнувшейся на 5000, и отбор это видит. Для категориального
 * ответа (допустить / отказать) метрики расстояния между метками нет, поэтому
 * точность — доля точных совпадений.
 *
 * MAE нормируется на среднее абсолютное отклонение цели от её среднего по
 * обучающей выборке. Тогда 1.0 — качество тривиальной модели «всегда среднее»,
 * 0.0 — идеальное совпадение, и веса критериев можно задавать в одной шкале
 * независимо от того, в рублях цель или в штуках.
 */
import { evaluateUtility } from "../../../dist/src/index.js"
import { buildUtility } from "./individual.mjs"

export const DEFAULT_WEIGHTS = {
  точность: 1,
  простота: 0.05,
  допустимость: 10,
}

export const TOLERANCE = 1e-6

/**
 * Бюджет нарушений — оптимизация поиска, а не метрики.
 *
 * Ядро сообщает о нарушении свойства исключением, а бросок исключения в V8
 * стоит примерно в тридцать раз дороже успешного вычисления утилиты. В первых
 * поколениях почти вся популяция нарушает свойства, и синтез упирается не в
 * поиск, а в раскрутку стеков. Модель, нарушившая инварианты на два десятке
 * наблюдений, уже отвергнута — досчитывать остальные незачем.
 *
 * Итоговые метрики в отчёте считаются без бюджета, по всем наблюдениям.
 */
export const VIOLATION_BUDGET = 8

export function createScorer(space, trainRows, options = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights ?? {}) }
  const baseline = deviationBaseline(space, trainRows)
  const cache = new Map()

  const measure = (individual, rows, budget = Infinity) => {
    const utility = buildUtility(individual, space)
    let absolute = 0
    let exact = 0
    let violations = 0
    let seen = 0
    for (const row of rows) {
      seen += 1
      let actual
      try {
        actual = evaluateUtility(utility, row["вход"])
      } catch {
        // Нарушение свойства или типовая ошибка исполнения: наблюдение не
        // объяснено вовсе. Считаем его и промахом, и нарушением.
        violations += 1
        absolute += baseline
        if (violations >= budget) break
        continue
      }
      const expected = row["решение"]
      if (typeof expected === "number" && typeof actual === "number") {
        const difference = Math.abs(actual - expected)
        absolute += difference
        if (difference <= TOLERANCE) exact += 1
      } else {
        const hit = Object.is(actual, expected)
        absolute += hit ? 0 : baseline
        if (hit) exact += 1
      }
    }
    const count = Math.max(seen, 1)
    const size = shape(individual)
    return {
      mae: space.outputKind === "number" ? absolute / count : null,
      ошибка: absolute / count / baseline,
      точность: exact / count,
      нарушения: violations / count,
      правил: size.rules,
      условий: size.conditions,
      сложность: complexity(size, space),
    }
  }

  const objectives = (individual) => {
    const key = keyOf(individual)
    const cached = cache.get(key)
    if (cached) return cached
    const measured = measure(individual, trainRows, options.violationBudget ?? VIOLATION_BUDGET)
    const value = {
      ...measured,
      // Взвешенная свёртка. Минимизируется.
      фитнес: weights["точность"] * measured["ошибка"]
        + weights["простота"] * measured["сложность"]
        + weights["допустимость"] * measured["нарушения"],
    }
    cache.set(key, value)
    return value
  }

  return { measure, objectives, weights, baseline, cacheSize: () => cache.size }
}

export function shape(individual) {
  return {
    rules: individual.rules.length,
    conditions: individual.rules.reduce((sum, rule) => sum + rule.when.length, 0),
  }
}

/**
 * Сложность приведена к [0, 1] по потолку пространства поиска, чтобы вес
 * простоты означал одно и то же в разных задачах. Условие дешевле правила
 * вдвое: лишнее правило — это отдельный абзац политики, лишнее условие —
 * уточнение уже существующего.
 */
export function complexity(size, space) {
  const limit = space.maxRules * (1 + 0.5 * space.maxConditions)
  return Math.min(1, (size.rules + 0.5 * size.conditions) / limit)
}

function deviationBaseline(space, rows) {
  if (space.outputKind !== "number") return 1
  const targets = rows.map((row) => row["решение"]).filter((value) => typeof value === "number")
  if (targets.length === 0) return 1
  const mean = targets.reduce((sum, value) => sum + value, 0) / targets.length
  const deviation = targets.reduce((sum, value) => sum + Math.abs(value - mean), 0) / targets.length
  return Math.max(deviation, 1e-9)
}

export function keyOf(individual) {
  return JSON.stringify(individual)
}

/**
 * Недоминируемая сортировка (быстрая, как в NSGA-II).
 * Возвращает фронты: индексы особей, сгруппированные по рангу.
 */
export function nonDominatedSort(points) {
  const dominated = points.map(() => [])
  const counts = points.map(() => 0)
  const fronts = [[]]
  for (let left = 0; left < points.length; left += 1) {
    for (let right = 0; right < points.length; right += 1) {
      if (left === right) continue
      if (dominates(points[left], points[right])) dominated[left].push(right)
      else if (dominates(points[right], points[left])) counts[left] += 1
    }
    if (counts[left] === 0) fronts[0].push(left)
  }
  let index = 0
  while (fronts[index].length > 0) {
    const next = []
    for (const item of fronts[index]) {
      for (const other of dominated[item]) {
        counts[other] -= 1
        if (counts[other] === 0) next.push(other)
      }
    }
    index += 1
    fronts.push(next)
  }
  fronts.pop()
  return fronts
}

export function dominates(left, right) {
  let better = false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] > right[index]) return false
    if (left[index] < right[index]) better = true
  }
  return better
}

/** Скученность по Деб: расстояние до соседей по каждому критерию. */
export function crowdingDistance(points, front) {
  const distance = new Map(front.map((index) => [index, 0]))
  const dimensions = points[front[0]]?.length ?? 0
  for (let dimension = 0; dimension < dimensions; dimension += 1) {
    const sorted = front.slice().sort((left, right) => points[left][dimension] - points[right][dimension])
    distance.set(sorted[0], Infinity)
    distance.set(sorted[sorted.length - 1], Infinity)
    const span = points[sorted[sorted.length - 1]][dimension] - points[sorted[0]][dimension]
    if (span === 0) continue
    for (let index = 1; index < sorted.length - 1; index += 1) {
      const delta = points[sorted[index + 1]][dimension] - points[sorted[index - 1]][dimension]
      distance.set(sorted[index], distance.get(sorted[index]) + delta / span)
    }
  }
  return distance
}

export function objectiveVector(measured) {
  return [measured["ошибка"], measured["сложность"], measured["нарушения"]]
}
