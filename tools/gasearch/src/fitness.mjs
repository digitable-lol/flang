/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Мост «особь → утилита FTS → число».
 *
 * Здесь проходит граница ответственности всего инструмента. Ниже по стеку —
 * ядро FTS: чистое, детерминированное, с примерами-тестами и свойствами.
 * Выше — обычный JavaScript, который ничего не доказывает, а только перебирает.
 * Движок не имеет права «улучшать» оценку: всё, что он делает с числом,
 * которое вернула утилита, — меняет знак при минимизации.
 *
 * ЧТО ДЕЛАТЬ С НЕДОПУСТИМОЙ ОСОБЬЮ. Выбран ШТРАФ, а не отбраковка.
 *
 * Аргумент первый — вырождение. В модели «Распределение смен» ночные смены без
 * доплаты нарушают свойство, и на старте таких особей примерно половина
 * (признак «доплата за ночь» ставится честной монетой). Отбраковка означала бы
 * либо ресемплинг до посинения, либо популяцию вдвое меньше запрошенной; и то
 * и другое ломает воспроизводимость по числу обращений к генератору.
 *
 * Аргумент второй — недопустимость не бинарна по последствиям, но бинарна по
 * сигналу. FTS сообщает «свойство нарушено», и всё: степени нарушения нет,
 * потому что вычисление прервалось исключением ДО возврата значения. Значит,
 * градуированный штраф (чем сильнее нарушение, тем больше вычет) физически
 * неоткуда взять, и штраф обязан быть константой. Константа выбрана заведомо
 * ниже любой достижимой оценки, поэтому допустимая особь всегда бьёт
 * недопустимую — это правило Деба «feasibility first», выраженное одним числом.
 *
 * Аргумент третий — недопустимые особи полезны как носители генов. Особь с
 * идеальными числами смен и неверным признаком доплаты — это одна мутация до
 * оптимума. Отбраковка выбросила бы её, штраф оставляет ей шанс попасть в
 * турнир против такой же недопустимой и передать числа дальше.
 *
 * Что НЕ считается недопустимостью: любая иная диагностика FTS
 * (FTS_UTILITY_INPUT_TYPE, FTS_UNKNOWN_UTILITY и прочие) — это ошибка движка,
 * а не свойство особи, и она пробрасывается наружу. Молча штрафовать
 * собственный баг — самый быстрый способ получить «работающий» поиск, который
 * ищет не то.
 */

import { executeUtility } from "../../../dist/src/index.js"

export const PROPERTY_CODE = "FTS_UTILITY_PROPERTY"

/** Штраф по умолчанию: ниже любой оценки, достижимой на моделях каталога. */
export const DEFAULT_PENALTY = -1e6

export const REASON_PROPERTY = "нарушено свойство утилиты"
export const REASON_ADMISSION = "утилита допуска вернула «нет»"

function diagnosticCode(error) {
  const diagnostics = error?.diagnostics
  return Array.isArray(diagnostics) && diagnostics.length > 0 ? diagnostics[0].code : null
}

/**
 * Замыкает документ и имена утилит в функцию оценки.
 *
 * @param options.document      скомпилированный документ FTS
 * @param options.utility       имя утилиты-фитнеса (возвращает число)
 * @param options.admissibility имя утилиты допуска (возвращает признак) либо null
 * @param options.direction     "максимум" или "минимум"
 * @param options.penalty       фитнес недопустимой особи
 */
export function createEvaluator(options) {
  const { document, utility, admissibility = null, direction = "максимум", penalty = DEFAULT_PENALTY } = options
  if (!document) throw new Error("оценщику нужен скомпилированный документ FTS")
  const known = (document.utilities ?? []).map((item) => item.name)
  if (!known.includes(utility)) throw new Error(`в модели нет утилиты «${utility}»; есть: ${known.join(", ")}`)
  if (admissibility !== null && !known.includes(admissibility)) {
    throw new Error(`в модели нет утилиты допуска «${admissibility}»; есть: ${known.join(", ")}`)
  }
  if (direction !== "максимум" && direction !== "минимум") throw new Error("направление задаётся как «максимум» или «минимум»")

  const sign = direction === "максимум" ? 1 : -1

  return function evaluate(genes) {
    // Допуск проверяется первым: если конфигурация запрещена эксплуатацией,
    // её оценка не нужна и может ввести в заблуждение.
    if (admissibility !== null) {
      const admitted = executeUtility(document, admissibility, genes)
      if (typeof admitted !== "boolean") throw new Error(`утилита допуска «${admissibility}» вернула не признак`)
      if (!admitted) return { genes, score: null, fitness: penalty, feasible: false, reason: REASON_ADMISSION }
    }

    let score
    try {
      score = executeUtility(document, utility, genes)
    } catch (error) {
      if (diagnosticCode(error) !== PROPERTY_CODE) throw error
      return { genes, score: null, fitness: penalty, feasible: false, reason: REASON_PROPERTY, detail: error.message }
    }

    if (typeof score !== "number" || !Number.isFinite(score)) {
      throw new Error(`утилита «${utility}» вернула не конечное число: ${String(score)}`)
    }
    return { genes, score, fitness: sign * score, feasible: true, reason: null }
  }
}
