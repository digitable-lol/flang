#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * gacascade — каскадный двухуровневый генетический алгоритм GA0 → GA1 → GA2
 * для задачи назначения задач исполнителям.
 *
 * Контракт вывода тот же, что у ядра FTS, ftsc, ftspec и gasearch: результат —
 * JSON в stdout, диагностики — в stderr, ненулевой код возврата при неудаче.
 * Поэтому прогон встраивается в CI без обёрток, а stdout можно направить в jq.
 */

import { writeFileSync } from "node:fs"

import { MODES, RUN_DEFAULTS, modeNames, runMode } from "../src/cascade.mjs"
import { loadModel } from "../src/fitness.mjs"
import { CONFIGURATIONS, configurationNames } from "../src/ga2.mjs"
import { CLASSES, SIZES, classNames, createScenario, sizeNames } from "../src/scenario.mjs"
import { renderMarkdown, runExperiment, toJSON } from "../src/experiment.mjs"
import { planBudget } from "../src/budget.mjs"

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

function list(name, fallback) {
  const raw = option(name)
  if (raw === null) return fallback
  if (raw === "all") return null
  return raw.split(",").map((item) => item.trim()).filter(Boolean)
}

const out = (value) => process.stdout.write(`${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`)
const note = (value) => process.stderr.write(`${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`)

const usage = [
  "gacascade — каскад GA0 → GA1 → GA2 для задачи назначения",
  "",
  "  gacascade check                       компиляция модели FTS, validate и примеры",
  "  gacascade scenarios                   классы сценариев и размерности",
  "  gacascade run [параметры]             один прогон одного режима",
  "  gacascade experiment [параметры]      серия прогонов и сводная таблица",
  "",
  "Режимы (раздел 2.4.4 диссертации):",
  "  cascade    ga0_ga1_ga2  пилот GA1 + GA2 + ранняя остановка по c_min",
  "  two-level  ga1_ga2      пилот GA1 + GA2, без ранней остановки",
  "  single     ga_single    GA2 с фиксированной конфигурацией balanced",
  "  heuristic  greedy       конструктивное назначение без поиска",
  "",
  "Параметры run:",
  "  --mode cascade|single|two-level|heuristic",
  "  --seed 42             целое семя; прогон повторяется побитово",
  "  --class dense_dependencies|priority_changes|noisy_inputs",
  "  --size S|M|L          размерность сценария",
  "  --budget 1200         N_max — общий бюджет оценок целевой функции",
  "  --cmin 0.85           порог ранней остановки GA0",
  "  --pilot-share 0.08    доля общего бюджета на один пилот GA1",
  "  --pilot-min 128       минимум оценок на один пилот GA1",
  "  --history             включить историю поколений финального GA2 в вывод",
  "  --plan                включить найденное назначение X* в вывод",
  "",
  "Параметры experiment:",
  "  --runs 30             повторов на конфигурацию (протокол требует ≥ 30)",
  "  --modes cascade,single,two-level,heuristic",
  "  --classes ...|all     классы сценариев",
  "  --sizes S,M,L|all     размерности",
  "  --seed 1              начальное семя; прогон i использует seed + i",
  "  --budget / --cmin / --pilot-share / --pilot-min  как у run",
  "  --format md|json      формат вывода (по умолчанию md)",
  "  --out файл.md         записать результат в файл",
  "  --json файл.json      дополнительно записать полный JSON",
  "  --quiet               не печатать ход выполнения в stderr",
  "",
].join("\n")

try {
  switch (command) {
    case "check": {
      const model = loadModel()
      out({
        "модель": model.path,
        "категория": model.document.category,
        "утилиты": (model.document.utilities ?? []).map((item) => item.name),
        "объекты": model.document.structures.map((item) => item.name),
        "примеров": model.tests.total,
        "прошло": model.tests.passed,
        "validate": true,
      })
      break
    }

    case "scenarios": {
      out({
        "классы": CLASSES,
        "размерности": SIZES,
        "конфигурации GA1": CONFIGURATIONS,
        "режимы": MODES,
      })
      break
    }

    case "run": {
      const mode = option("mode", "cascade")
      if (!MODES[mode]) throw new Error(`неизвестный режим «${mode}»; доступны: ${modeNames().join(", ")}`)
      const seed = Math.trunc(number("seed", 42))
      const className = option("class", RUN_DEFAULTS["класс"])
      const size = option("size", RUN_DEFAULTS["размер"])
      const budget = Math.trunc(number("budget", RUN_DEFAULTS["бюджет"]))
      const cmin = number("cmin", RUN_DEFAULTS["c_min"])
      const pilotShare = number("pilot-share", RUN_DEFAULTS["доля пилота"])
      const pilotMin = Math.trunc(number("pilot-min", RUN_DEFAULTS["минимум пилота"]))

      // Распределение бюджета проверяется ДО прогона: узнать, что пилотам не
      // осталось места, после 1200 оценок — плохой способ узнавать.
      if (mode === "cascade" || mode === "two-level") {
        planBudget({ total: budget, configurations: configurationNames().length, pilotShare, pilotMin })
      }

      const scenario = createScenario({ class: className, size, seed })
      const model = loadModel()
      const result = runMode({ mode, seed, scenario, model, budget, cmin, pilotShare, pilotMin, includeHistory: flag("history") })

      if (!flag("plan")) delete result["X*"]

      note({
        "примеров модели пройдено": `${model.tests.passed}/${model.tests.total}`,
        "режим": `${mode} (${MODES[mode]})`,
        "оценок израсходовано": `${result["N*"]} из ${result["N_max"]}`,
      })
      out(result)
      break
    }

    case "experiment": {
      const runs = Math.trunc(number("runs", 30))
      const modes = list("modes", modeNames()) ?? modeNames()
      const classes = list("classes", ["dense_dependencies"]) ?? classNames()
      const sizes = list("sizes", ["S"]) ?? sizeNames()
      const quiet = flag("quiet")

      if (runs < 30) note(`ВНИМАНИЕ: протокол диссертации требует не менее 30 прогонов, задано ${runs}`)

      const experiment = runExperiment({
        runs,
        modes,
        classes,
        sizes,
        baseSeed: Math.trunc(number("seed", 1)),
        budget: Math.trunc(number("budget", RUN_DEFAULTS["бюджет"])),
        cmin: number("cmin", RUN_DEFAULTS["c_min"]),
        pilotShare: number("pilot-share", RUN_DEFAULTS["доля пилота"]),
        pilotMin: Math.trunc(number("pilot-min", RUN_DEFAULTS["минимум пилота"])),
        onProgress: quiet ? null : ({ "группа": group, "прогон": index, "всего": total }) => {
          process.stderr.write(`\r${group}: прогон ${index}/${total}   `)
        },
      })
      if (!quiet) process.stderr.write("\n")

      const format = option("format", "md")
      const markdown = renderMarkdown(experiment)
      const json = toJSON(experiment, { includeRuns: true })

      const target = option("out")
      if (target) {
        writeFileSync(target, `${markdown}\n`, "utf8")
        note(`сводная таблица записана в ${target}`)
      }
      const jsonTarget = option("json")
      if (jsonTarget) {
        writeFileSync(jsonTarget, `${JSON.stringify(json, null, 2)}\n`, "utf8")
        note(`полный JSON записан в ${jsonTarget}`)
      }

      if (format === "json") out(json)
      else if (format === "md") {
        if (!target) out(markdown)
      } else throw new Error(`неизвестный формат «${format}»; доступны: md, json`)
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
} catch (error) {
  note({ error: error instanceof Error ? error.message : String(error) })
  // process.exitCode, а НЕ process.exit(1).
  //
  // process.exit завершает процесс немедленно, не дожидаясь, пока опустеет
  // буфер stdout. Когда stdout — труба (а это обычный случай: `| jq`,
  // `> файл`), запись выполняется асинхронно, и мегабайтный JSON команды
  // `experiment --format json` обрывается на середине. Отладить такое тяжело:
  // на терминале, где stdout синхронен, всё выглядит правильно.
  //
  // Присваивание exitCode даёт тот же код возврата, но позволяет процессу
  // завершиться самому — после того, как всё записано.
  process.exitCode = 1
}
