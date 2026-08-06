#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * gasearch — эволюционный поиск, у которого фитнес-функция записана на FTS.
 *
 * Контракт вывода тот же, что у ядра FTS, ftsc и ftspec: результат — JSON в
 * stdout, диагностики — в stderr, ненулевой код возврата при неудаче. Поэтому
 * прогон встраивается в CI и в агентов без обёрток, а stdout можно смело
 * направлять в jq.
 */
import { evolve } from "../src/evolve.mjs"
import { createEvaluator } from "../src/fitness.mjs"
import { buildSpec } from "../src/population.mjs"
import { CATALOG, loadModel, modelNames } from "../src/catalog.mjs"

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

const positional = argv.slice(1).filter((item, index, list) => !item.startsWith("--") && !list[index - 1]?.startsWith("--"))

const out = (value) => process.stdout.write(`${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`)
const note = (value) => process.stderr.write(`${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`)

const usage = [
  "gasearch — эволюционный поиск с фитнес-функцией на FTS",
  "",
  "  gasearch models                       список моделей каталога",
  "  gasearch check <модель>               компиляция, validate и примеры модели",
  "  gasearch run <модель> [параметры]     прогон эволюции",
  "",
  "Параметры прогона:",
  "  --utility «имя»       утилита-фитнес (по умолчанию из каталога)",
  "  --admissibility «имя» утилита допуска; --no-admissibility отключает",
  "  --direction максимум|минимум",
  "  --seed 42             целое семя; один и тот же прогон повторяется побитово",
  "  --generations 100     предел поколений",
  "  --population 50       размер популяции",
  "  --elite 2             сколько лучших переносится без изменений",
  "  --selection турнирная|рулетка",
  "  --tournament 3        размер турнира",
  "  --crossover равномерный|одноточечный",
  "  --crossover-rate 0.9",
  "  --mutation-rate 0.15  вероятность мутации отдельного поля",
  "  --mutation-sigma 0.15 сигма гауссовой мутации как доля размаха поля",
  "  --stagnation 0        останов после N поколений без улучшения (0 — не применять)",
  "  --history             включить историю поколений в вывод",
  "",
].join("\n")

try {
  switch (command) {
    case "models": {
      out(Object.fromEntries(modelNames().map((name) => [name, {
        "описание": CATALOG[name]["описание"],
        "утилита": CATALOG[name]["утилита"],
        "допуск": CATALOG[name]["допуск"],
        "направление": CATALOG[name]["направление"],
        "известный оптимум": CATALOG[name]["известный оптимум"],
      }])))
      break
    }

    case "check": {
      const name = positional[0]
      if (!name) throw new Error("укажите модель: gasearch check <модель>")
      const model = loadModel(name)
      out({
        "модель": name,
        "файл": model.path,
        "категория": model.document.category,
        "утилиты": (model.document.utilities ?? []).map((item) => item.name),
        "примеров": model.tests.total,
        "прошло": model.tests.passed,
        "validate": true,
      })
      break
    }

    case "run": {
      const name = positional[0]
      if (!name) throw new Error("укажите модель: gasearch run <модель>")
      const model = loadModel(name)
      const entry = model.entry

      const utility = option("utility", entry["утилита"])
      const admissibility = flag("no-admissibility") ? null : option("admissibility", entry["допуск"])
      const direction = option("direction", entry["направление"])
      const seed = Math.trunc(number("seed", 42))

      const spec = buildSpec(model.document, entry["объект"], entry["диапазоны"])
      const evaluate = createEvaluator({ document: model.document, utility, admissibility, direction })

      const result = evolve({
        spec,
        evaluate,
        seed,
        options: {
          populationSize: Math.trunc(number("population", 50)),
          generations: Math.trunc(number("generations", 100)),
          elite: Math.trunc(number("elite", 2)),
          selection: option("selection", "турнирная"),
          tournamentSize: Math.trunc(number("tournament", 3)),
          crossover: option("crossover", "равномерный"),
          crossoverRate: number("crossover-rate", 0.9),
          mutationRate: number("mutation-rate", 0.15),
          mutationSigma: number("mutation-sigma", 0.15),
          stagnation: Math.trunc(number("stagnation", 0)),
        },
      })

      // История поколений — по флагу: она нужна для графиков сходимости, но в
      // обычном прогоне это сотня записей поверх единственного ответа.
      const { "история": history, ...core } = result
      const report = {
        "модель": name,
        "утилита": utility,
        "допуск": admissibility,
        "направление": direction,
        "известный оптимум": entry["известный оптимум"] ?? null,
        ...core,
      }
      if (flag("history")) report["история"] = history

      note({
        "примеров модели пройдено": `${model.tests.passed}/${model.tests.total}`,
        "разных особей оценено": result["разных особей"],
      })
      out(report)
      break
    }

    case "help":
    case "--help":
    case "-h":
    case undefined: {
      out(usage)
      break
    }

    default:
      throw new Error(`неизвестная команда «${command}»`)
  }
  process.exit(0)
} catch (error) {
  note({ error: error instanceof Error ? error.message : String(error) })
  process.exit(1)
}
