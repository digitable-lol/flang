/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Мост «назначение → утилиты FTS → J_p, Δ, допустимость».
 *
 * Загрузка и проверка модели повторяют gasearch/src/catalog.mjs: компиляция,
 * validate и прогон примеров выполняются ДО поиска и всегда. Модель, чьи
 * примеры не сходятся, — это неверная целевая функция, и запускать по ней
 * тысячу оценок незачем.
 *
 * Числовые утилиты вызываются через `createEvaluator` из gasearch: там уже
 * решено, что делать с нарушением свойства FTS (штраф, а не отбраковка) и
 * что считать ошибкой движка (любая иная диагностика пробрасывается). Логическая
 * утилита «Назначение допустимо» вызывается напрямую через `executeUtility` —
 * `createEvaluator` работает только с числовыми оценками.
 *
 * ПОЧЕМУ ДОПУСТИМОСТЬ НЕ ПОДКЛЮЧЕНА КАК `admissibility`. У `createEvaluator`
 * есть режим «утилита допуска вернула нет → штраф». Здесь он НЕ используется
 * намеренно. Раздел 2.3 говорит, что поиск идёт по множеству X⁺, включающему
 * почти допустимые назначения, а недопустимость наказывается величиной Δ
 * внутри J_p. Подключение допуска схлопнуло бы все недопустимые планы в одну
 * константу и уничтожило бы градиент штрафа — поиск перестал бы отличать
 * план с одним нарушением компетенций от плана с двадцатью. Допустимость
 * здесь — признак для отчёта, а не фильтр отбора.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { compile, executeUtility, testUtilities, validate } from "../../../dist/src/index.js"
import { createEvaluator } from "../../gasearch/src/fitness.mjs"
import { planCriteria, toAssignmentRecord, SCALE } from "./plan.mjs"

const here = dirname(fileURLToPath(import.meta.url))
export const MODEL_PATH = join(here, "..", "models", "assignment.fts")

export const UTILITY_SCORE = "Оценить назначение"
export const UTILITY_PENALTY = "Штраф ограничений"
export const UTILITY_FEASIBLE = "Назначение допустимо"
export const STRUCTURE = "Назначение"

/** Компиляция модели с полной проверкой. Кэш — по пути файла: модель неизменна в пределах процесса. */
let cached = null
export function loadModel() {
  if (cached) return cached

  const source = readFileSync(MODEL_PATH, "utf8")
  const document = compile(source)

  const validation = validate(document)
  if (!validation.valid) {
    const messages = (validation.diagnostics ?? []).map((item) => `${item.code}: ${item.message}`).join("; ")
    throw new Error(`модель назначения не проходит validate: ${messages}`)
  }

  const tests = testUtilities(document)
  if (!tests.valid) {
    const failed = tests.results.filter((item) => !item.passed).map((item) => `${item.utility} / ${item.example}`).join("; ")
    throw new Error(`примеры модели назначения не сходятся: ${failed}`)
  }

  cached = { path: MODEL_PATH, document, tests }
  return cached
}

/**
 * Оценщик планов для одного сценария.
 *
 * Возвращает функцию `(assignment) → запись оценки`. Одна оценка плана — это
 * ТРИ вызова утилит FTS (штраф, функционал, допустимость), но ОДНА единица
 * бюджета: бюджет в диссертации измеряется числом оценок целевой функции
 * (раздел 3.3.1), а не числом обращений к интерпретатору.
 */
export function createPlanEvaluator(scenario, model = loadModel()) {
  const penaltyOf = createEvaluator({ document: model.document, utility: UTILITY_PENALTY, direction: "минимум" })
  const scoreOf = createEvaluator({ document: model.document, utility: UTILITY_SCORE, direction: "минимум" })

  return function evaluatePlan(assignment) {
    const criteria = planCriteria(scenario, assignment)
    const record = toAssignmentRecord(criteria)

    const penalty = penaltyOf(record)
    if (!penalty.feasible) throw new Error(`утилита «${UTILITY_PENALTY}» отклонила запись: ${penalty.reason}`)
    record["штраф ограничений"] = penalty.score

    const score = scoreOf(record)
    if (!score.feasible) throw new Error(`утилита «${UTILITY_SCORE}» отклонила запись: ${score.reason}`)

    const feasible = executeUtility(model.document, UTILITY_FEASIBLE, record)
    if (typeof feasible !== "boolean") throw new Error(`утилита «${UTILITY_FEASIBLE}» вернула не признак`)

    return {
      // J_p и Δ приводятся из десятитысячных обратно в доли [0;1]: именно в
      // этой шкале записаны нормировки показателя готовности c (раздел 2.3),
      // и смешение шкал сломало бы пороги 0,02 и 0,15 в его формулах.
      "J_p": score.score / SCALE,
      "Δ": penalty.score / SCALE,
      "допустим": feasible,
      "критерии": {
        "нарушения компетенций": criteria["нарушения компетенций"],
        "превышение ёмкости": criteria["превышение ёмкости"],
        "просрочка": criteria["просрочка"],
        "σ": criteria["дисбаланс загрузки"],
        "длительность расписания": criteria["длительность расписания"],
        "доля переназначений": criteria["доля переназначений"],
      },
      "загрузки": Array.from(criteria["расписание"]["загрузки"]),
      "длительность расписания, ед": criteria["расписание"]["длительность"],
      "нарушений компетенций, шт": criteria["нарушений компетенций, шт"],
      "запись FTS": record,
    }
  }
}
