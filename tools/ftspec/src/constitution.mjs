/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Проверка спек против конституции проекта.
 *
 * Конституция — обычная модель FTS, чьи утилиты играют роль инвариантов:
 * принимают факты решения и возвращают ЧИСЛО НАРУШЕНИЙ (0 — всё в порядке).
 * Это даёт инварианту ровно ту же проверяемость, что и любой другой утилите:
 * у него есть примеры, и они обязаны сходиться.
 *
 * Как инвариант связывается со спекой: по именам полей. Инвариант применим к
 * утилите, если каждое обязательное поле его входа либо совпадает по имени и
 * типу с полем входа утилиты, либо это служебное поле «итог» — в него
 * подставляется результат утилиты.
 *
 * Где здесь честная граница. Инвариант проверяется не «для всех входов», а на
 * КОНЕЧНОЙ СЕТКЕ, выведенной из условий самой спеки: пороги условий и точки
 * непосредственно рядом с ними. Обоснование не логическое, а эмпирическое:
 * поведение правил меняется только на границах условий, поэтому именно там
 * нарушения и живут. Между границами поведение постоянно по каждому полю
 * отдельно, но зависимости вида «процент от другого поля» делают результат
 * непрерывно растущим — такое нарушение сетка ловит на краю интервала, а не в
 * произвольной внутренней точке. Пропуск возможен; это не доказательство.
 */
import { executeUtility } from "../../../dist/src/index.js"

import { RESULT_FIELD, codes, structureOf } from "./corpus.mjs"
import { BOOLEAN, NUMBER, STRING, formatValue, isConstantOperand, typeKind } from "./intervals.mjs"

const MAX_VALUES_PER_FIELD = 9
const MAX_POINTS = 1024

const isOptional = (type) => String(type).includes("undefined")

/**
 * Сетка входов утилиты: значения, на которых её поведение меняется.
 *
 * Для числового поля это каждый порог из условий и его соседи `порог ± шаг`
 * (граница «не меньше 10000» отличает 9999 от 10000 — обе точки нужны).
 * Для признака — оба значения. Для строки — все константы из условий плюс одна
 * посторонняя.
 */
export function buildGrid(structure, utility, { step = 1 } = {}) {
  const thresholds = new Map()
  for (const rule of utility.rules ?? []) {
    for (const condition of rule.when) {
      if (!isConstantOperand(condition.value)) continue
      if (!thresholds.has(condition.field)) thresholds.set(condition.field, [])
      thresholds.get(condition.field).push(condition.value.value)
    }
  }

  const axes = []
  for (const field of structure?.fields ?? []) {
    const kind = typeKind(field.type)
    const seen = thresholds.get(field.name) ?? []
    let values
    if (kind === NUMBER) {
      const numbers = new Set([0])
      for (const value of seen) {
        if (typeof value !== "number") continue
        numbers.add(value - step)
        numbers.add(value)
        numbers.add(value + step)
      }
      values = [...numbers].sort((a, b) => a - b)
    } else if (kind === BOOLEAN) {
      values = [false, true]
    } else if (kind === STRING) {
      const strings = new Set(seen.filter((value) => typeof value === "string"))
      strings.add("")
      values = [...strings].sort()
    } else {
      values = [...new Set(seen)]
      if (!values.length) values = [null]
    }
    axes.push({ field: field.name, values: values.slice(0, MAX_VALUES_PER_FIELD), optional: isOptional(field.type) })
  }

  /* Детерминированное усечение: отрезаем хвосты осей по кругу, пока
     произведение не влезет в бюджет. Порядок обхода при этом не меняется, и
     повторный запуск даёт ту же сетку. */
  let truncated = false
  const size = () => axes.reduce((total, axis) => total * Math.max(axis.values.length, 1), 1)
  for (let guard = 0; size() > MAX_POINTS && guard < 1000; guard += 1) {
    const widest = axes.reduce((best, axis) => (axis.values.length > best.values.length ? axis : best), axes[0])
    if (widest.values.length <= 1) break
    widest.values.pop()
    truncated = true
  }

  const points = [{}]
  for (const axis of axes) {
    const next = []
    for (const point of points) for (const value of axis.values) next.push({ ...point, [axis.field]: value })
    points.length = 0
    points.push(...next)
  }

  return { axes, points, truncated }
}

/** Инвариант применим, если все его обязательные поля можно заполнить из спеки. */
export function applicable(invariantStructure, specStructure) {
  const specFields = new Map((specStructure?.fields ?? []).map((field) => [field.name, typeKind(field.type)]))
  for (const field of invariantStructure?.fields ?? []) {
    if (field.name === RESULT_FIELD) continue
    if (isOptional(field.type)) continue
    if (specFields.get(field.name) !== typeKind(field.type)) return false
  }
  return true
}

function invariantInput(invariantStructure, point, outcome) {
  const input = {}
  for (const field of invariantStructure.fields) {
    if (field.name === RESULT_FIELD) {
      input[field.name] = outcome
      continue
    }
    if (field.name in point) input[field.name] = point[field.name]
  }
  return input
}

const describePoint = (point) =>
  Object.entries(point)
    .map(([field, value]) => `«${field}» = ${formatValue(value)}`)
    .join(", ")

export function checkConstitution(corpus, options = {}) {
  const diagnostics = []
  const stats = { invariants: 0, utilities: 0, points: 0, truncated: [] }
  const constitution = corpus.constitution
  if (!constitution) return { diagnostics, stats }

  const invariants = constitution.document.utilities ?? []
  stats.invariants = invariants.length

  for (const spec of corpus.specs) {
    for (const utility of spec.document.utilities ?? []) {
      const structure = structureOf(spec.document, utility.input)
      if (!structure) continue
      const grid = buildGrid(structure, utility, options)
      stats.utilities += 1
      stats.points += grid.points.length
      if (grid.truncated) stats.truncated.push(`${spec.specId}/${utility.name}`)

      for (const invariant of invariants) {
        const invariantStructure = structureOf(constitution.document, invariant.input)
        if (!invariantStructure || !applicable(invariantStructure, structure)) continue

        for (const point of grid.points) {
          let outcome
          try {
            outcome = executeUtility(spec.document, utility.name, point)
          } catch {
            /* Утилита сама отвергла вход (нарушено её собственное свойство).
               Спорить с моделью о её же допусках не наше дело — точка выбывает. */
            continue
          }

          const input = invariantInput(invariantStructure, point, outcome)
          let violations
          let broke = null
          try {
            violations = executeUtility(constitution.document, invariant.name, input)
          } catch (error) {
            /* Свойство самого инварианта — тоже способ сказать «так нельзя». */
            violations = 1
            broke = error.message
          }

          const violated = typeof violations === "number" ? violations > 0 : violations === true
          if (!violated) continue

          diagnostics.push({
            code: codes.constitution,
            message:
              `утилита «${utility.name}» из ${spec.source} нарушает инвариант «${invariant.name}» ` +
              `конституции при ${describePoint(point)}: результат ${formatValue(outcome)}` +
              (broke ? ` (${broke})` : `, нарушений ${formatValue(violations)}`),
            severity: "error",
            path: spec.source,
            specs: [spec.specId],
            details: {
              spec: spec.specId,
              utility: utility.name,
              invariant: invariant.name,
              input: point,
              outcome,
              violations,
              ...(broke ? { property: broke } : {}),
            },
          })
          break /* одна диагностика на пару «утилита × инвариант»: первого входа достаточно, чтобы требование не приняли */
        }
      }
    }
  }

  return { diagnostics, stats }
}
