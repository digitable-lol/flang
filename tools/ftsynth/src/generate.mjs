/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Генератор наборов данных.
 *
 * Метки не выдуманы: они вычислены ядром FTS по настоящей модели из
 * `data/*.truth.fts`. Поэтому у синтеза есть проверяемая цель — на данных без
 * шума найденная модель обязана вести себя как истинная на всей сетке входов.
 * Синтез, который нельзя проверить на задаче с известным ответом, невозможно
 * отличить от подгонки.
 *
 * Шум моделирует то, что происходит в реальных журналах решений: часть случаев
 * решена не по политике. Он применяется к части наблюдений целиком, а не
 * размазан по всем, — так ближе к «менеджер отклонился», чем к «датчик врёт».
 */
import { readFileSync } from "node:fs"
import { evaluateUtility, parseNaturalSurface } from "../../../dist/src/index.js"
import { createRng } from "./prng.mjs"

export const DOMAINS = {
  discounts: {
    truth: "discounts.truth.fts",
    utility: "Рассчитать скидку",
    поля: {
      "сумма": range(1000, 30000, 1000),
      "статус клиента": ["новый", "постоянный", "партнёр"],
      "объём": [1, 5, 10, 20, 50, 100],
    },
    строк: 320,
  },
  admission: {
    truth: "admission.truth.fts",
    utility: "Допустить заявку",
    поля: {
      "стаж": range(0, 10, 1),
      "доход": range(10000, 100000, 10000),
      "поручитель": [false, true],
      "в чёрном списке": [false, true],
    },
    строк: 300,
  },
}

export function gridOf(domain) {
  const names = Object.keys(domain["поля"])
  let combinations = [{}]
  for (const name of names) {
    const next = []
    for (const partial of combinations) {
      for (const value of domain["поля"][name]) next.push({ ...partial, [name]: value })
    }
    combinations = next
  }
  return combinations
}

export function generateDataset(name, options = {}) {
  const domain = DOMAINS[name]
  if (!domain) throw new Error(`неизвестный набор «${name}», доступны: ${Object.keys(DOMAINS).join(", ")}`)
  const seed = options.seed ?? 7
  const noise = options.noise ?? 0
  const wanted = options.строк ?? domain["строк"]

  const truthPath = new URL(`../data/${domain.truth}`, import.meta.url)
  const document = parseNaturalSurface(readFileSync(truthPath, "utf8"))
  const utility = document.utilities.find((item) => item.name === domain.utility)
  if (!utility) throw new Error(`в «${domain.truth}» нет утилиты «${domain.utility}»`)

  const rng = createRng(`data:${name}:${seed}`)
  // Без повторов: дубликаты наблюдений не добавляют сведений, но перекашивают
  // и обучение, и оценку.
  const grid = rng.shuffled(gridOf(domain)).slice(0, Math.min(wanted, gridOf(domain).length))

  const наблюдения = grid.map((вход) => {
    const истинное = evaluateUtility(utility, вход)
    const искажено = noise > 0 && rng.chance(noise)
    return { "вход": вход, "решение": искажено ? distort(истинное, rng) : истинное }
  })

  return {
    "набор": name,
    "категория": document.category,
    "структура": document.structures[0],
    "утилита": utility.name,
    "возвращает": utility.output,
    "свойства": utility.properties,
    "происхождение": { "истина": domain.truth, "семя": seed, "шум": noise, "строк": наблюдения.length },
    "наблюдения": наблюдения,
  }
}

function distort(value, rng) {
  if (typeof value === "boolean") return !value
  if (typeof value === "number") return Math.max(0, value + rng.pick([-500, -200, -100, 100, 200, 500]))
  return value
}

function range(from, to, step) {
  const values = []
  for (let value = from; value <= to; value += step) values.push(Number(value.toFixed(6)))
  return values
}
