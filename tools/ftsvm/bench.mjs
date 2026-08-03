#!/usr/bin/env node
/**
 * Бенчмарк ftsvm: ядро против интерпретатора против JIT.
 *
 * Методика взята из examples/fts/benchmark/measure.mjs, а не придумана заново:
 *   - прогрев перед измерением (первые вызовы систематически медленнее, пока
 *     JIT самого V8 не разогрелся);
 *   - МЕДИАНА по батчам, а не среднее: одна пауза GC тянет среднее на себя,
 *     а медиану почти нет; min/max/p95 показывают разброс, чтобы один прогон
 *     не выдавался за гарантию;
 *   - окружение (node, платформа, процессор) печатается вместе с числами —
 *     цифра без окружения ничего не значит.
 * Отличие одно: размер батча здесь не подбирается автоматически, а задан
 * условием задачи — 10³, 10⁴ и 10⁵ вызовов.
 *
 * Что именно сравнивается — публичные точки входа, как их вызвал бы человек:
 *   ядро          executeUtility(document, «утилита», вход)
 *   интерпретатор run(program, модуль, «утилита», вход)
 *   JIT           compiled(вход), где compiled получен один раз
 * Поиск утилиты в документе и проверка входа входят в замер у всех троих;
 * у JIT поиск происходит один раз при компиляции — это и есть часть выигрыша,
 * а не подтасовка. Стоимость самой компиляции измеряется отдельно.
 *
 * Вход не один, а цикл из нескольких наборов: иначе V8 вправе свернуть
 * весь цикл в константу, и мерили бы мы не исполнитель, а оптимизатор.
 * Контрольная сумма по всем вызовам печатается для каждого движка — она
 * обязана совпадать, иначе сравнивать нечего.
 *
 * Запуск:
 *   node tools/ftsvm/bench.mjs
 *   node tools/ftsvm/bench.mjs --json
 *   node tools/ftsvm/bench.mjs --quick
 */
import { performance } from "node:perf_hooks"
import process from "node:process"
import { arch, cpus, platform } from "node:os"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { executeUtility } from "../../dist/src/index.js"

import { compileUtility, generateSource, resetJitCache, run } from "./src/index.mjs"
import { findUtility } from "./src/program.mjs"
import { loadProgram } from "./src/load-fts.mjs"

const here = fileURLToPath(new URL(".", import.meta.url))
const repo = resolve(here, "../..")

/* --- измерение --- */

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]
}

const round = (value, digits = 4) => Number(value.toFixed(digits))

function summarize(name, samples, calls, checksum) {
  const sorted = [...samples].sort((left, right) => left - right)
  const median = percentile(sorted, 0.5)
  return {
    engine: name,
    calls,
    repeats: sorted.length,
    checksum,
    median_batch_ms: round(median),
    min_batch_ms: round(sorted[0]),
    max_batch_ms: round(sorted[sorted.length - 1]),
    p95_batch_ms: round(percentile(sorted, 0.95)),
    ns_per_call: round((median * 1e6) / calls, 1),
    ops_per_second: Math.round((calls / median) * 1000),
  }
}

/**
 * Замер нескольких движков ЧЕРЕДУЯ их: повтор 1 — ядро, интерпретатор, JIT;
 * повтор 2 — снова все трое, и так далее.
 *
 * Это важнее, чем кажется. Если мерить движки подряд блоками, то пауза GC,
 * прогрев кэшей или смена частоты процессора попадают целиком в один блок
 * и сдвигают именно его — сравнение превращается в сравнение моментов
 * времени, а не движков. Чередование раздаёт такие помехи всем поровну.
 *
 * @param {Array<{ name: string, batch: (calls: number) => number }>} engines
 * @param {number} calls
 * @param {number} repeats
 */
function measureEngines(engines, calls, repeats) {
  // Прогрев: по два батча на движок, до всяких замеров. Первые вызовы
  // систематически медленнее, пока V8 не оптимизировал горячий код.
  for (const engine of engines) {
    engine.batch(1000)
    engine.batch(1000)
  }

  const samples = new Map(engines.map((engine) => [engine.name, []]))
  const checksums = new Map()
  for (let repeat = 0; repeat < repeats; repeat += 1) {
    for (const engine of engines) {
      const start = performance.now()
      const checksum = engine.batch(calls)
      samples.get(engine.name).push(performance.now() - start)
      checksums.set(engine.name, checksum)
    }
  }
  return engines.map((engine) => summarize(engine.name, samples.get(engine.name), calls, checksums.get(engine.name)))
}

/* --- сценарии --- */

async function scenarios() {
  const fixture = async (name) => JSON.parse(await readFile(resolve(repo, `tools/ftsc/test/fixtures/${name}.ir.json`), "utf8"))

  const discount = await fixture("discount")
  const delivery = await fixture("delivery")
  const supervision = await loadProgram([resolve(repo, "tools/ftsc/stdlib/supervision/supervision.fts")], {
    project: "supervision",
  })

  const process0 = {
    "перезапусков за окно": 1,
    "лимит перезапусков": 3,
    "окно секунд": 5,
    "секунд с первого перезапуска": 1,
    критичный: true,
    "номер попытки": 1,
    "базовая задержка": 100,
    "потолок задержки": 5000,
  }

  return [
    {
      title: "discount / Рассчитать скидку",
      program: discount,
      module: "Продажи",
      utility: "Рассчитать скидку",
      inputs: [
        { сумма: 5000, "постоянный клиент": false },
        { сумма: 20000, "постоянный клиент": true },
        { сумма: 10000, "постоянный клиент": false },
        { сумма: 999, "постоянный клиент": true },
      ],
    },
    {
      title: "delivery / Рассчитать доставку",
      program: delivery,
      module: "Логистика",
      utility: "Рассчитать доставку",
      inputs: [
        { вес: 3, расстояние: 20, "срочная доставка": false, "страховая сумма": 0 },
        { вес: 18, расстояние: 900, "срочная доставка": false, "страховая сумма": 0 },
        { вес: 4, расстояние: 60, "срочная доставка": true, "страховая сумма": 50000 },
        { вес: 11, расстояние: 500, "срочная доставка": true, "страховая сумма": 1000 },
      ],
    },
    {
      title: "supervision / Рассчитать задержку перезапуска",
      program: supervision,
      module: "Надзор",
      utility: "Рассчитать задержку перезапуска",
      inputs: [
        { ...process0, "номер попытки": 1 },
        { ...process0, "номер попытки": 4 },
        { ...process0, "номер попытки": 8 },
        { ...process0, "номер попытки": 0 },
      ],
    },
  ]
}

/**
 * Считает результат числом, чтобы контрольная сумма была осмысленной
 * и для числовых, и для логических утилит.
 */
const asNumber = (value) => (typeof value === "number" ? value : value === true ? 1 : 0)

/**
 * @param {{ scales?: number[], repeats?: (calls: number) => number }} [options]
 */
export async function runBenchmark(options = {}) {
  const scales = options.scales ?? [1000, 10000, 100000]
  const repeatsFor = options.repeats ?? ((calls) => (calls <= 1000 ? 15 : calls <= 10000 ? 9 : 5))

  const results = []
  const compilation = []
  const prepared = []

  for (const scenario of await scenarios()) {
    const { program, module: moduleName, utility: utilityName, inputs, title } = scenario
    const { utility, module } = findUtility(program, moduleName, utilityName)
    const document = module.document
    const compiled = compileUtility(program, moduleName, utilityName)

    const engines = [
      {
        name: "ядро",
        batch: (calls) => {
          let checksum = 0
          for (let index = 0; index < calls; index += 1) {
            checksum += asNumber(executeUtility(document, utilityName, inputs[index & 3]))
          }
          return checksum
        },
      },
      {
        name: "интерпретатор",
        batch: (calls) => {
          let checksum = 0
          for (let index = 0; index < calls; index += 1) {
            checksum += asNumber(run(program, moduleName, utilityName, inputs[index & 3]))
          }
          return checksum
        },
      },
      {
        name: "JIT",
        batch: (calls) => {
          let checksum = 0
          for (let index = 0; index < calls; index += 1) {
            checksum += asNumber(compiled(inputs[index & 3]))
          }
          return checksum
        },
      },
    ]

    for (const calls of scales) {
      for (const row of measureEngines(engines, calls, repeatsFor(calls))) {
        results.push({ scenario: title, rules: (utility.rules ?? []).length, ...row })
      }
    }
    prepared.push({ scenario, utility, module, title })
  }

  /* Стоимость компиляции меряется последней и отдельно: каждый замер создаёт
     новую функцию через new Function, а это давление на пространство кода
     и сборщик — измеряй мы её вперемешку, она искажала бы всё остальное. */
  for (const { scenario, utility, module, title } of prepared) {
    const { program, module: moduleName, utility: utilityName } = scenario
    const structure = module.document.structures.find((item) => item.name === utility.input)
    const compileOnce = () => {
      resetJitCache(program)
      return compileUtility(program, moduleName, utilityName)
    }
    for (let index = 0; index < 20; index += 1) compileOnce()
    const samples = []
    for (let repeat = 0; repeat < 7; repeat += 1) {
      const start = performance.now()
      for (let index = 0; index < 50; index += 1) compileOnce()
      samples.push((performance.now() - start) / 50)
    }
    samples.sort((left, right) => left - right)
    compilation.push({
      scenario: title,
      rules: (utility.rules ?? []).length,
      generated_bytes: Buffer.byteLength(generateSource(utility, structure).source),
      median_us: round(percentile(samples, 0.5) * 1000, 1),
    })
  }

  const speedups = []
  const scenarioTitles = [...new Set(results.map((row) => row.scenario))]
  for (const scenario of scenarioTitles) {
    for (const calls of scales) {
      const pick = (engine) => results.find((row) => row.scenario === scenario && row.calls === calls && row.engine === engine)
      const core = pick("ядро")
      const interpreter = pick("интерпретатор")
      const jit = pick("JIT")
      speedups.push({
        scenario,
        calls,
        checksums_equal: core.checksum === interpreter.checksum && core.checksum === jit.checksum,
        jit_vs_core: round(core.median_batch_ms / jit.median_batch_ms, 2),
        jit_vs_interpreter: round(interpreter.median_batch_ms / jit.median_batch_ms, 2),
        interpreter_vs_core: round(core.median_batch_ms / interpreter.median_batch_ms, 2),
      })
    }
  }

  return {
    schema: "ftsvm-benchmark/1",
    generated_at: new Date().toISOString(),
    runtime: {
      node: process.version,
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model ?? "unknown",
      logical_cores: cpus().length,
    },
    methodology: {
      statistic: "медиана времени батча по повторам, прогрев 2×1000 вызовов",
      batch_sizes: scales,
      inputs: "цикл из 4 наборов, чтобы вызов нельзя было свернуть в константу",
      note: "у ядра и интерпретатора поиск утилиты и проверка входа входят в каждый вызов; у JIT поиск сделан один раз при компиляции",
    },
    compilation,
    results,
    speedups,
  }
}

/* --- вывод --- */

export function printReport(report) {
  const { runtime } = report
  process.stdout.write(
    `окружение: node ${runtime.node}, ${runtime.platform}/${runtime.arch}, ${runtime.cpu} (${runtime.logical_cores} ядер)\n\n`,
  )

  const header = ["движок", "вызовов", "медиана мс", "нс/вызов", "опс/с", "p95 мс"]
  for (const scenario of [...new Set(report.results.map((row) => row.scenario))]) {
    const rows = report.results.filter((row) => row.scenario === scenario)
    process.stdout.write(`${scenario} (${rows[0].rules} правил)\n`)
    process.stdout.write(`  ${header.map((cell, index) => (index === 0 ? cell.padEnd(14) : cell.padStart(12))).join(" ")}\n`)
    for (const row of rows) {
      const cells = [row.calls, row.median_batch_ms, row.ns_per_call, row.ops_per_second, row.p95_batch_ms]
      process.stdout.write(`  ${row.engine.padEnd(14)} ${cells.map((cell) => String(cell).padStart(12)).join(" ")}\n`)
    }
    process.stdout.write("\n")
  }

  process.stdout.write("ускорение (во сколько раз быстрее)\n")
  process.stdout.write(
    `  ${"сценарий".padEnd(46)} ${"вызовов".padStart(8)} ${"JIT/ядро".padStart(10)} ${"JIT/инт.".padStart(10)} ${"инт./ядро".padStart(10)}  суммы\n`,
  )
  for (const row of report.speedups) {
    process.stdout.write(
      `  ${row.scenario.padEnd(46)} ${String(row.calls).padStart(8)} ${String(row.jit_vs_core).padStart(10)} ${String(row.jit_vs_interpreter).padStart(10)} ${String(row.interpreter_vs_core).padStart(10)}  ${row.checksums_equal ? "совпали" : "РАЗОШЛИСЬ"}\n`,
    )
  }

  process.stdout.write("\nстоимость компиляции JIT (генерация исходника + new Function)\n")
  process.stdout.write(
    `  ${"сценарий".padEnd(46)} ${"правил".padStart(7)} ${"байт кода".padStart(10)} ${"мкс/компиляцию".padStart(15)}\n`,
  )
  for (const row of report.compilation) {
    process.stdout.write(
      `  ${row.scenario.padEnd(46)} ${String(row.rules).padStart(7)} ${String(row.generated_bytes).padStart(10)} ${String(row.median_us).padStart(15)}\n`,
    )
  }
}

/* Запуск как программы — только когда файл вызван напрямую, иначе тест,
   импортирующий runBenchmark, запускал бы полный прогон при импорте. */
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const quick = process.argv.includes("--quick")
  const report = await runBenchmark(quick ? { scales: [1000, 10000], repeats: () => 5 } : {})
  if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  else printReport(report)
}
