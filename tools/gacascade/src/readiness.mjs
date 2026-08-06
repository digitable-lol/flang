/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Показатель вычислительной готовности c(t) — то, чем управляет GA0.
 *
 * Источник: раздел 2.3 диссертации (операциональная формула) и раздел 3.3.1
 * (та же формула в записи методики).
 *
 *   c(t) = clip_[0,1]( 0,25·C(t) + 0,35·S(t) + 0,30·I(t) + 0,10·Q_s(t) )
 *
 *   C(t) = 1 − Δ(X_t)                                     — ограничения
 *   I(t) = clip( (J_p(X_0) − J_p(X_t)) / max(0,02; 0,25·|J_p(X_0)|) )  — улучшение
 *   S(t) = 1 − clip( (max W_t − min W_t) / (0,02 + 0,15·|W̄_t|) )      — устойчивость
 *   Q_s(t) — отделимость лучшего значения от медианы популяции
 *
 * ЧТО ЗДЕСЬ ДОСТРОЕНО. Для C, I и S формулы в тексте выписаны полностью.
 * Для Q_s сказано только «отделимость лучшего значения от медианы популяции»,
 * без нормировки. Взята та же форма, что у S, — разность, отнесённая к
 * 0,02 + 0,15·|медиана|:
 *
 *   Q_s(t) = clip( (J_p^med(t) − J_p^best(t)) / (0,02 + 0,15·|J_p^med(t)|) )
 *
 * Это ДОСТРОЙКА, а не цитата. Вес Q_s равен 0,10 — наименьший из четырёх,
 * поэтому выбор нормировки влияет на c не сильнее чем на 0,10, но замалчивать
 * его нельзя: при другой нормировке момент ранней остановки сдвинется.
 *
 * ЧТО НЕ ДЕЛАЕТ c. Раздел 2.3: «c_min не гарантирует оптимальности и не
 * означает допустимости плана». Поэтому c нигде не участвует в отборе особей
 * и не входит в J_p — он только даёт GA0 право остановиться.
 *
 * ШКАЛА. Все J_p подаются сюда в долях [0;1]. Константы 0,02 и 0,15 в
 * знаменателях — абсолютные, и в другой шкале они означали бы другое.
 */

/** Размер окна устойчивости: пять поколений (разделы 2.3, 2.4.3). */
export const WINDOW = 5

function clip01(value) {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * Расчёт c(t) и его компонент.
 *
 * @param options.delta      Δ(X_t) лучшего плана, доля [0;1]
 * @param options.initialJp  J_p(X_0) — функционал начального плана прогона
 * @param options.bestJp     J_p(X_t) — функционал лучшего плана на шаге t
 * @param options.medianJp   медиана J_p текущей популяции
 * @param options.window     массив лучших J_p за последние поколения
 * @returns {{c: number|null, C: number, S: number|null, I: number, Q: number, "окно заполнено": boolean}}
 */
export function readiness({ delta, initialJp, bestJp, medianJp, window }) {
  const constraints = clip01(1 - delta)

  const improvementScale = Math.max(0.02, 0.25 * Math.abs(initialJp))
  const improvement = clip01((initialJp - bestJp) / improvementScale)

  const separationScale = 0.02 + 0.15 * Math.abs(medianJp)
  const separation = clip01((medianJp - bestJp) / separationScale)

  const filled = Array.isArray(window) && window.length >= WINDOW
  let stability = null
  if (filled) {
    const recent = window.slice(-WINDOW)
    const max = Math.max(...recent)
    const min = Math.min(...recent)
    const mean = recent.reduce((sum, value) => sum + value, 0) / recent.length
    stability = 1 - clip01((max - min) / (0.02 + 0.15 * Math.abs(mean)))
  }

  // Пока окно не заполнено, c не определён: раздел 2.4.3 — «Условие готовности
  // проверяется только после заполнения окна устойчивости из пяти поколений».
  // Возвращать здесь частичную сумму было бы удобно для графиков и неверно
  // по существу: GA0 не имеет права смотреть на такое число.
  const value = filled
    ? clip01(0.25 * constraints + 0.35 * stability + 0.30 * improvement + 0.10 * separation)
    : null

  return { "c": value, "C": constraints, "S": stability, "I": improvement, "Q_s": separation, "окно заполнено": filled }
}

/**
 * Готовность конструктивной эвристики.
 *
 * У жадного алгоритма нет ни траектории, ни популяции: компоненты S, I и Q_s
 * не определены в принципе, а не «равны нулю по неудаче». Определён только
 * C = 1 − Δ. Возвращается c = 0,25·C, то есть заведомо не больше 0,25.
 *
 * Это ДЕФИНИЦИОННОЕ следствие, а не результат сравнения: показатель c
 * описывает состояние ПОИСКА (раздел 2.3: «эти показатели характеризуют
 * стоимость и состояние алгоритма»), а поиска у эвристики нет. Сравнивать
 * эвристику с эволюционными режимами по c бессмысленно; сравнивать по J_p,
 * Δ, σ и τ — осмысленно.
 */
export function heuristicReadiness(delta) {
  const constraints = clip01(1 - delta)
  return { "c": clip01(0.25 * constraints), "C": constraints, "S": null, "I": null, "Q_s": null, "окно заполнено": false }
}

/** Медиана выборки. Для чётной длины — полусумма середин. */
export function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = sorted.length >> 1
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
