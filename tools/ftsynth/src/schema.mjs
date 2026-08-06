/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Схема задачи синтеза: что известно до поиска и какими «кубиками» разрешено
 * собирать правила.
 *
 * Разделение принципиальное. Аналитик даёт форму данных (объект и его поля),
 * тип ответа и свойства-инварианты — то, что он готов подписать заранее.
 * Синтез ищет только правила и начальное значение. Поэтому найденная модель
 * по построению типизирована правильно и проходит `validate` ядра FTS: сюда
 * зашиты ровно те же типовые ограничения, что проверяет `src/validate.ts`.
 */
import { readFileSync } from "node:fs"

export const TYPES = {
  число: "Число",
  деньги: "Деньги",
  строка: "Строка",
  дата: "Дата",
  признак: "Признак",
}

export const RETURN_WORD = {
  Число: "число",
  Деньги: "деньги",
  Строка: "строку",
  Дата: "дату",
  Признак: "признак",
}

export const COMPARISON_WORD = {
  eq: "равен",
  neq: "не равен",
  gte: "не меньше",
  lte: "не больше",
  gt: "больше",
  lt: "меньше",
}

export function typeKind(type) {
  if (type === "Число" || type === "Деньги") return "number"
  if (type === "Строка" || type === "Дата") return "string"
  if (type === "Признак") return "boolean"
  return "unknown"
}

export function loadDataset(path) {
  return normalizeDataset(JSON.parse(readFileSync(path, "utf8")), path)
}

export function normalizeDataset(raw, source = "<память>") {
  const structure = raw["структура"]
  if (!structure || !Array.isArray(structure.fields)) {
    throw new Error(`набор данных «${source}» не содержит «структура» с полями`)
  }
  if (!Array.isArray(raw["наблюдения"]) || raw["наблюдения"].length === 0) {
    throw new Error(`набор данных «${source}» не содержит наблюдений`)
  }
  return {
    название: raw["набор"] ?? source,
    категория: raw["категория"] ?? "Синтез",
    структура: structure,
    утилита: raw["утилита"] ?? "Утилита",
    возвращает: raw["возвращает"] ?? "Число",
    свойства: raw["свойства"] ?? [],
    наблюдения: raw["наблюдения"],
    происхождение: raw["происхождение"] ?? null,
  }
}

/**
 * Пространство поиска, выведенное из данных.
 *
 * Пороги берутся не из воздуха, а из наблюдённых значений поля. Это не только
 * ускоряет поиск: порог между двумя наблюдениями неразличим на данных, поэтому
 * любой промежуточный порог — произвол, который нечем обосновать.
 *
 * Константы действия берутся с «человеческой лестницы» 1-2-5 x 10^k. Политика,
 * написанная человеком, почти никогда не содержит числа 4837; ограничение
 * лестницей делает результат таким, какой аналитик готов прочитать вслух.
 */
export function buildSpace(dataset, options = {}) {
  const outputType = TYPES[dataset["возвращает"]] ?? dataset["возвращает"]
  const outputKind = typeKind(outputType)
  const rows = dataset["наблюдения"]

  const fields = dataset["структура"].fields.map((field) => {
    const kind = typeKind(field.type)
    const values = rows.map((row) => row["вход"][field.name]).filter((value) => value !== undefined)
    const unique = [...new Set(values)]
    return {
      name: field.name,
      type: field.type,
      kind,
      // Пороги: только наблюдённые значения, по возрастанию.
      thresholds: kind === "number" ? unique.slice().sort((left, right) => left - right) : [],
      // Категориальные значения: наблюдённые строки; для признака — да/нет.
      values: kind === "string" ? unique.slice().sort() : kind === "boolean" ? [false, true] : [],
    }
  })

  const numericFields = fields.filter((field) => field.kind === "number" && field.thresholds.length > 1)
  const targets = rows.map((row) => row["решение"])
  const numericTargets = targets.filter((value) => typeof value === "number")
  const scale = numericTargets.length > 0 ? Math.max(...numericTargets.map((value) => Math.abs(value)), 1) : 1

  return {
    category: dataset["категория"],
    structure: dataset["структура"],
    utility: dataset["утилита"],
    outputType,
    outputKind,
    properties: dataset["свойства"],
    fields,
    numericFields,
    // Кандидаты в константы действия.
    constants: outputKind === "number" ? roundLadder(scale * 2) : outputKind === "boolean" ? [false, true] : [...new Set(targets)],
    // Кандидаты в проценты: круглая лестница + целые, чтобы шаг мутации был плавным.
    percents: options.percents ?? PERCENTS,
    initials: outputKind === "number" ? [0, ...roundLadder(scale)] : outputKind === "boolean" ? [false, true] : [...new Set(targets)],
    maxRules: options.maxRules ?? 6,
    maxConditions: options.maxConditions ?? 3,
  }
}

const PERCENTS = (() => {
  const values = new Set()
  for (let percent = 1; percent <= 50; percent += 1) values.add(percent)
  return [...values].sort((left, right) => left - right)
})()

// Лестница круглых чисел 1-2-5 x 10^k, ограниченная сверху пределом.
export function roundLadder(limit) {
  const values = [0]
  for (let exponent = 0; exponent <= 9; exponent += 1) {
    for (const base of [1, 2, 5]) {
      const value = base * 10 ** exponent
      if (value <= limit) values.push(value)
    }
  }
  return values
}
