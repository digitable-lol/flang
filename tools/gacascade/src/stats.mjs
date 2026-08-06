/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Статистическая обработка серии прогонов.
 *
 * Источник: раздел 3.3.2 диссертации и раздел «Статистический протокол»
 * файла 04-chapter3-experiment-plan.md — среднее, медиана, стандартное
 * отклонение, доверительный интервал, p-value сравнения с каскадом,
 * непараметрический критерий (Манна — Уитни или Уилкоксона), α = 0,05,
 * поправка Холма на семейство гипотез.
 *
 * ЗАВИСИМОСТЕЙ НЕТ, ВСЁ СЧИТАЕТСЯ ЗДЕСЬ. Это не самоцель: критерий, взятый
 * из библиотеки, пришлось бы принимать на веру, а критерий, проверенный
 * тестами на выборках с известным ответом (test/stats.test.mjs), можно
 * предъявить вместе с результатом.
 *
 * КАКОЙ КРИТЕРИЙ КОГДА. Прогоны разных режимов выполняются на ОДНИХ И ТЕХ ЖЕ
 * экземплярах при общих seed (раздел 3.3.1), то есть выборки СВЯЗАННЫЕ.
 * Поэтому основным берётся критерий Уилкоксона для связанных выборок, а
 * Манна — Уитни приводится рядом как несвязанная оценка: если они расходятся,
 * это сигнал, что различие держится на парности, и об этом надо знать.
 *
 * ПРИБЛИЖЕНИЕ. Оба критерия считаются через нормальную аппроксимацию с
 * поправкой на непрерывность и с поправкой на связи рангов. При n ≥ 30
 * (минимум протокола) приближение состоятельно; при меньших n возвращается
 * признак «приближение ненадёжно» — вместо того чтобы молча печатать число.
 */

import { createStream } from "../../gasearch/src/random.mjs"

export const ALPHA = 0.05

/** Минимальный объём выборки, при котором нормальная аппроксимация считается пригодной. */
export const MIN_NORMAL = 10

/**
 * Дополнительная функция ошибок.
 *
 * Рациональное приближение Чебышёва (Numerical Recipes, erfcc): относительная
 * погрешность не хуже 1,2·10⁻⁷ на всей оси. Для p-value на уровне 0,05 этого
 * достаточно с запасом в пять порядков, а собственный ряд Тейлора у нуля
 * потерял бы точность как раз в хвостах, где живут интересные p.
 */
function erfc(x) {
  const z = Math.abs(x)
  const t = 2 / (2 + z)
  const ty = 4 * t - 2
  const coefficients = [
    -1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2,
    -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4,
    4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6,
    1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8,
    6.529054439e-9, 5.059343495e-9, -9.91364156e-10,
    -2.27365122e-10, 9.6467911e-11, 2.394038e-12,
    -6.886027e-12, 8.94487e-13, 3.13092e-13,
    -1.12708e-13, 3.81e-16, 7.106e-15,
  ]
  let d = 0
  let dd = 0
  for (let index = coefficients.length - 1; index > 0; index -= 1) {
    const tmp = d
    d = ty * d - dd + coefficients[index]
    dd = tmp
  }
  const answer = t * Math.exp(-z * z + 0.5 * (coefficients[0] + ty * d) - dd)
  return x >= 0 ? answer : 2 - answer
}

/** Двусторонний p-value по z-статистике стандартной нормали. */
export function twoSidedP(z) {
  return Math.min(1, erfc(Math.abs(z) / Math.SQRT2))
}

/**
 * Средние ранги с обработкой связей.
 *
 * @returns {{ranks: number[], tieCorrection: number}} tieCorrection = Σ(t³ − t)
 */
function averageRanks(values) {
  const indexed = values.map((value, index) => ({ value, index }))
  indexed.sort((left, right) => left.value - right.value)
  const ranks = new Array(values.length)
  let tieCorrection = 0
  let position = 0
  while (position < indexed.length) {
    let end = position
    while (end + 1 < indexed.length && indexed[end + 1].value === indexed[position].value) end += 1
    const groupSize = end - position + 1
    const rank = (position + end + 2) / 2
    for (let k = position; k <= end; k += 1) ranks[indexed[k].index] = rank
    if (groupSize > 1) tieCorrection += groupSize ** 3 - groupSize
    position = end + 1
  }
  return { ranks, tieCorrection }
}

export function mean(values) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function median(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = sorted.length >> 1
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** Выборочное стандартное отклонение (делитель n − 1). */
export function stdev(values) {
  if (values.length < 2) return 0
  const average = mean(values)
  const sum = values.reduce((accumulated, value) => accumulated + (value - average) ** 2, 0)
  return Math.sqrt(sum / (values.length - 1))
}

export function quantile(values, probability) {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const position = (sorted.length - 1) * probability
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

/**
 * Bootstrap-интервал среднего.
 *
 * Пересэмплирование берёт случайность из того же воспроизводимого источника,
 * что и весь стенд: интервал в таблице обязан повторяться при повторном
 * запуске, иначе «95% ДИ» превращается в украшение.
 */
export function bootstrapCI(values, { resamples = 2000, level = 0.95, seed = "bootstrap" } = {}) {
  if (values.length < 2) return { "нижняя": null, "верхняя": null }
  const stream = createStream(seed)
  const means = new Array(resamples)
  for (let index = 0; index < resamples; index += 1) {
    const own = stream.fork(`выборка:${index}`)
    let sum = 0
    for (let k = 0; k < values.length; k += 1) sum += values[own.nextInt(0, values.length - 1)]
    means[index] = sum / values.length
  }
  const tail = (1 - level) / 2
  return { "нижняя": quantile(means, tail), "верхняя": quantile(means, 1 - tail) }
}

/** Полное описание выборки для строки сводной таблицы. */
export function describe(values, options = {}) {
  const clean = values.filter((value) => Number.isFinite(value))
  return {
    "n": clean.length,
    "среднее": mean(clean),
    "медиана": median(clean),
    "ст. отклонение": stdev(clean),
    "минимум": clean.length === 0 ? null : Math.min(...clean),
    "максимум": clean.length === 0 ? null : Math.max(...clean),
    "МКР": clean.length === 0 ? null : quantile(clean, 0.75) - quantile(clean, 0.25),
    "ДИ 95%": bootstrapCI(clean, options),
  }
}

/**
 * Критерий Манна — Уитни для двух независимых выборок.
 *
 * H0: распределения совпадают. Нормальная аппроксимация с поправкой на связи
 * и на непрерывность.
 */
export function mannWhitneyU(first, second) {
  const n1 = first.length
  const n2 = second.length
  if (n1 === 0 || n2 === 0) throw new Error("критерий Манна — Уитни требует непустых выборок")

  const { ranks, tieCorrection } = averageRanks([...first, ...second])
  let rankSum = 0
  for (let index = 0; index < n1; index += 1) rankSum += ranks[index]

  const u1 = rankSum - (n1 * (n1 + 1)) / 2
  const u2 = n1 * n2 - u1
  const u = Math.min(u1, u2)
  const total = n1 + n2
  const expected = (n1 * n2) / 2
  const variance = total < 2
    ? 0
    : ((n1 * n2) / 12) * (total + 1 - tieCorrection / (total * (total - 1)))

  if (variance <= 0) {
    return { "критерий": "Манна — Уитни", "U": u, "z": 0, "p": 1, "n1": n1, "n2": n2, "приближение надёжно": false, "замечание": "нулевая дисперсия рангов: выборки неразличимы" }
  }

  // Поправка на непрерывность: непрерывная нормаль приближает дискретную U.
  const z = (Math.abs(u - expected) - 0.5) / Math.sqrt(variance)
  return {
    "критерий": "Манна — Уитни",
    "U": u,
    "z": u < expected ? -Math.max(0, z) : Math.max(0, z),
    "p": twoSidedP(Math.max(0, z)),
    "n1": n1,
    "n2": n2,
    "приближение надёжно": Math.min(n1, n2) >= MIN_NORMAL,
  }
}

/**
 * Критерий Уилкоксона для связанных выборок.
 *
 * H0: медиана разностей равна нулю. Нулевые разности отбрасываются
 * (классическое правило Уилкоксона) и их число возвращается: если отброшена
 * большая часть пар, критерий говорит уже не о том, о чём думает читатель.
 */
export function wilcoxonSignedRank(first, second) {
  if (first.length !== second.length) throw new Error("критерий Уилкоксона требует выборок одинаковой длины")
  if (first.length === 0) throw new Error("критерий Уилкоксона требует непустых выборок")

  const differences = []
  let zeros = 0
  for (let index = 0; index < first.length; index += 1) {
    const difference = first[index] - second[index]
    if (difference === 0) zeros += 1
    else differences.push(difference)
  }

  const n = differences.length
  if (n === 0) {
    return { "критерий": "Уилкоксона", "W": 0, "z": 0, "p": 1, "n": 0, "нулевых разностей": zeros, "приближение надёжно": false, "замечание": "все разности нулевые: режимы дали совпадающие значения" }
  }

  const { ranks, tieCorrection } = averageRanks(differences.map(Math.abs))
  let positive = 0
  for (let index = 0; index < n; index += 1) if (differences[index] > 0) positive += ranks[index]
  const negative = (n * (n + 1)) / 2 - positive
  const w = Math.min(positive, negative)

  const expected = (n * (n + 1)) / 4
  const variance = (n * (n + 1) * (2 * n + 1)) / 24 - tieCorrection / 48
  if (variance <= 0) {
    return { "критерий": "Уилкоксона", "W": w, "z": 0, "p": 1, "n": n, "нулевых разностей": zeros, "приближение надёжно": false, "замечание": "нулевая дисперсия рангов" }
  }

  const z = (Math.abs(w - expected) - 0.5) / Math.sqrt(variance)
  return {
    "критерий": "Уилкоксона",
    "W": w,
    "z": positive < negative ? -Math.max(0, z) : Math.max(0, z),
    "p": twoSidedP(Math.max(0, z)),
    "n": n,
    "нулевых разностей": zeros,
    "приближение надёжно": n >= MIN_NORMAL,
  }
}

/**
 * Размер эффекта Клиффа δ ∈ [−1;1].
 *
 * Непараметрический и не зависящий от шкалы: доля пар, в которых первая
 * выборка больше, минус доля пар, в которых она меньше. p-value говорит
 * только «различие есть», δ говорит «насколько».
 */
export function cliffsDelta(first, second) {
  let greater = 0
  let less = 0
  for (const left of first) {
    for (const right of second) {
      if (left > right) greater += 1
      else if (left < right) less += 1
    }
  }
  const total = first.length * second.length
  const delta = total === 0 ? 0 : (greater - less) / total
  const magnitude = Math.abs(delta)
  return {
    "δ": delta,
    "величина": magnitude < 0.147 ? "пренебрежимая" : magnitude < 0.33 ? "малая" : magnitude < 0.474 ? "средняя" : "большая",
  }
}

/**
 * Поправка Холма на множественные сравнения (раздел 3.3.2).
 *
 * Нисходящая процедура: p-value сортируются по возрастанию, i-й умножается на
 * (m − i), результат монотонизируется. Контролирует групповую вероятность
 * ошибки первого рода без предположения о независимости гипотез.
 */
export function holm(entries) {
  const sorted = entries
    .map((entry, index) => ({ ...entry, "исходный порядок": index }))
    .sort((left, right) => left["p"] - right["p"])
  let running = 0
  sorted.forEach((entry, index) => {
    const adjusted = Math.min(1, (sorted.length - index) * entry["p"])
    running = Math.max(running, adjusted)
    entry["p Холма"] = running
    entry["значимо"] = running < ALPHA
  })
  return sorted.sort((left, right) => left["исходный порядок"] - right["исходный порядок"]).map((entry) => {
    const { "исходный порядок": _drop, ...rest } = entry
    return rest
  })
}
