/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Каталог моделей: что искать и в каких границах.
 *
 * Почему границы живут здесь, а не в .fts. В объекте FTS поле объявляется
 * типом («является числом»), но не диапазоном: язык описывает форму данных и
 * правила вывода, а не пространство поиска. Диапазон — это решение о том, где
 * мы согласны искать, и оно принадлежит прогону, а не спецификации. Смешать
 * их значило бы объявить «пул до 64 соединений» частью бизнес-правила.
 *
 * Роль этого файла — только маршрутизация. Ни одно число, влияющее на оценку,
 * сюда не просачивается: шаг сетки и границы задают, какие точки вообще
 * рассматриваются, но не то, чего они стоят.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { compile, testUtilities, validate } from "../../../dist/src/index.js"

const here = dirname(fileURLToPath(import.meta.url))
const modelsDirectory = join(here, "..", "models")

export const CATALOG = {
  "расписание": {
    "файл": "schedule.fts",
    "объект": "Вариант",
    "утилита": "Оценить вариант",
    "допуск": null,
    "направление": "максимум",
    "известный оптимум": 130,
    "описание": "распределение дневных, ночных и резервных смен",
    "диапазоны": {
      "смен днём": { min: 0, max: 14, step: 1 },
      "смен ночью": { min: 0, max: 14, step: 1 },
      "резервных смен": { min: 0, max: 8, step: 1 },
    },
  },
  "конфигурация": {
    "файл": "config.fts",
    "объект": "Конфигурация",
    "утилита": "Оценить конфигурацию",
    "допуск": "Конфигурация допустима",
    "направление": "максимум",
    "известный оптимум": 135.5,
    "описание": "подбор пула, таймаута, кэша и политики повторов",
    "диапазоны": {
      // Границы шире эксплуатационных рамок из «Конфигурация допустима»:
      // поиск обязан САМ упереться в допуск, иначе мы бы проверяли не движок,
      // а собственную честность при выборе диапазонов.
      "размер пула": { min: 1, max: 64, step: 1 },
      "таймаут мс": { min: 50, max: 5000, step: 50 },
      "размер кэша мб": { min: 0, max: 1024, step: 8 },
    },
  },
}

export function modelNames() {
  return Object.keys(CATALOG)
}

/**
 * Загрузка модели с полной проверкой.
 *
 * Компиляция, validate и прогон примеров делаются ДО поиска и всегда, а не по
 * флагу. Модель, чьи примеры не сходятся, — это неверная фитнес-функция, и
 * запускать по ней сто поколений незачем: результат будет аккуратным ответом
 * не на тот вопрос.
 */
export function loadModel(name) {
  const entry = CATALOG[name]
  if (!entry) throw new Error(`неизвестная модель «${name}»; доступны: ${modelNames().join(", ")}`)

  const path = join(modelsDirectory, entry["файл"])
  const document = compile(readFileSync(path, "utf8"))

  const validation = validate(document)
  if (!validation.valid) {
    const messages = (validation.diagnostics ?? []).map((item) => `${item.code}: ${item.message}`).join("; ")
    throw new Error(`модель «${name}» не проходит validate: ${messages}`)
  }

  const tests = testUtilities(document)
  if (!tests.valid) {
    const failed = tests.results.filter((item) => !item.passed).map((item) => `${item.utility} / ${item.example}`).join("; ")
    throw new Error(`примеры модели «${name}» не сходятся: ${failed}`)
  }

  return { name, path, entry, document, tests }
}
