#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * ftsynth — синтез моделей FTS из исторических данных генетическим поиском.
 *
 * Контракт вывода тот же, что у ядра FTS и у соседних инструментов: полезный
 * результат в stdout, отчёт и диагностика в stderr, ненулевой код возврата при
 * ошибке. Поэтому `ftsynth fit ... > политика.fts` даёт сразу пригодный файл,
 * а отчёт остаётся видимым в терминале и в логе CI.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { loadDataset, normalizeDataset } from "../src/schema.mjs"
import { synthesize, DEFAULTS } from "../src/evolve.mjs"
import { behaviourExamples, buildReport, renderModel, renderTextReport } from "../src/report.mjs"
import { generateDataset, DOMAINS } from "../src/generate.mjs"

const argv = process.argv.slice(2)
const command = argv[0]

function option(name, fallback = null) {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? fallback : (argv[index + 1] ?? fallback)
}

function flag(name) {
  return argv.includes(`--${name}`)
}

function number(name, fallback) {
  const raw = option(name)
  if (raw === null) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`параметр --${name} должен быть числом, получено «${raw}»`)
  return value
}

const usage = [
  "ftsynth — синтез исполняемых моделей FTS из исторических решений",
  "",
  "  ftsynth fit --data data/discounts.json [--seed 42] [--generations 600]",
  "  ftsynth fit ... --pareto            недоминируемая сортировка вместо взвешенной суммы",
  "  ftsynth fit ... --json              отчёт машинно-читаемо в stdout вместо текста модели",
  "  ftsynth gen-data --set discounts --seed 7 --noise 0.15 --out data/discounts.json",
  "  ftsynth sets                        какие наборы умеет порождать генератор",
  "",
  "  --object «Покупка»      имя входного объекта (по умолчанию из набора)",
  "  --utility «Скидка»      имя утилиты (по умолчанию из набора)",
  "  --population 120        размер популяции",
  "  --holdout 0.3           доля контрольной выборки",
  "  --max-rules 6           потолок числа правил",
  "  --max-conditions 3      потолок числа условий в правиле",
  "  --w-accuracy 1          вес точности во взвешенной свёртке",
  "  --w-simplicity 0.05     вес простоты",
  "  --w-admissibility 10    вес допустимости (нарушения свойств)",
  "  --examples 3            сколько снимков поведения вложить в модель",
  "  --out путь.fts          записать модель в файл, а не только в stdout",
  "",
].join("\n")

try {
  switch (command) {
    case "fit": {
      const dataPath = option("data")
      if (!dataPath) throw new Error("укажите набор данных: --data data/discounts.json")
      const dataset = loadDataset(resolve(process.cwd(), dataPath))
      runFit(dataset)
      break
    }
    case "gen-data": {
      const name = option("set", "discounts")
      const dataset = generateDataset(name, {
        seed: number("seed", 7),
        noise: number("noise", 0),
        "строк": option("rows") === null ? undefined : number("rows"),
      })
      const target = option("out")
      const text = `${JSON.stringify(dataset, null, 2)}\n`
      if (target) {
        const full = resolve(process.cwd(), target)
        mkdirSync(dirname(full), { recursive: true })
        writeFileSync(full, text)
        process.stderr.write(`набор «${name}»: ${dataset["наблюдения"].length} наблюдений, шум ${dataset["происхождение"]["шум"]} -> ${target}\n`)
      } else {
        process.stdout.write(text)
      }
      break
    }
    case "sets": {
      for (const [name, domain] of Object.entries(DOMAINS)) {
        process.stdout.write(`${name}: истина ${domain.truth}, утилита «${domain.utility}», строк по умолчанию ${domain["строк"]}\n`)
      }
      break
    }
    default:
      process.stdout.write(usage)
      process.exit(command === undefined || flag("help") ? 0 : 1)
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}

function runFit(rawDataset) {
  const dataset = normalizeDataset({
    "набор": rawDataset["название"],
    "категория": rawDataset["категория"],
    "структура": option("object") ? { ...rawDataset["структура"], name: option("object") } : rawDataset["структура"],
    "утилита": option("utility") ?? rawDataset["утилита"],
    "возвращает": rawDataset["возвращает"],
    "свойства": rawDataset["свойства"],
    "наблюдения": rawDataset["наблюдения"],
    "происхождение": rawDataset["происхождение"],
  })

  const result = synthesize(dataset, {
    seed: option("seed") ?? DEFAULTS.seed,
    generations: number("generations", DEFAULTS.generations),
    population: number("population", DEFAULTS.population),
    holdout: number("holdout", DEFAULTS.holdout),
    maxRules: number("max-rules", 6),
    maxConditions: number("max-conditions", 3),
    pareto: flag("pareto"),
    weights: {
      "точность": number("w-accuracy", 1),
      "простота": number("w-simplicity", 0.05),
      "допустимость": number("w-admissibility", 10),
    },
  })

  const examples = behaviourExamples(
    result.best,
    result.space,
    result.split["контроль"],
    number("examples", 3),
    option("seed") ?? DEFAULTS.seed,
  )
  const text = renderModel(result, { examples })
  const report = buildReport(result, dataset)

  if (flag("json")) {
    process.stdout.write(`${JSON.stringify({ ...report, "модель": text }, null, 2)}\n`)
  } else {
    process.stdout.write(text)
    process.stderr.write(renderTextReport(report))
  }

  const target = option("out")
  if (target) {
    const full = resolve(process.cwd(), target)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, text)
  }
}
