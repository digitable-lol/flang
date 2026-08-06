/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Сравнение моделей по поведению, а не по тексту.
 *
 * Одна и та же политика записывается по-разному: `не меньше 10000` и
 * `больше 9000` неразличимы на сетке с шагом 1000, порядок независимых правил
 * не важен, а условие `«статус» равен «постоянный»` при трёх статусах
 * эквивалентно паре неравенств. Требовать текстового совпадения с истинной
 * политикой — значит проверять форму вместо смысла.
 */
import { evaluateUtility } from "../../../dist/src/index.js"

export function compareBehaviour(left, right, grid, tolerance = 1e-6) {
  const mismatches = []
  for (const вход of grid) {
    const a = safeEvaluate(left, вход)
    const b = safeEvaluate(right, вход)
    if (!same(a, b, tolerance)) mismatches.push({ "вход": вход, "слева": a, "справа": b })
  }
  return { equal: mismatches.length === 0, checked: grid.length, mismatches }
}

function safeEvaluate(utility, вход) {
  try {
    return evaluateUtility(utility, вход)
  } catch (error) {
    return { "ошибка": error instanceof Error ? error.message : String(error) }
  }
}

function same(left, right, tolerance) {
  if (typeof left === "number" && typeof right === "number") return Math.abs(left - right) <= tolerance
  return Object.is(left, right)
}
