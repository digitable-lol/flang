/**
 * Стенд вычислительного эксперимента.
 *
 * Источник: раздел 3.3 диссертации (методика), раздел 3.4 (форма таблиц 3.1,
 * 3.2 и 3.3) и файл 04-chapter3-experiment-plan.md.
 *
 * ПРОТОКОЛ. Не менее 30 прогонов на конфигурацию, фиксированные seed,
 * одинаковый N_max у всех эволюционных режимов, парное сравнение на ОДНИХ И
 * ТЕХ ЖЕ экземплярах: прогон с номером i у всех режимов идёт по сценарию,
 * построенному от seed = baseSeed + i. Поэтому применим критерий для
 * связанных выборок, и поэтому же разница между режимами не может объясняться
 * тем, что кому-то достались более лёгкие экземпляры.
 *
 * ЧТО СТЕНД НЕ ДЕЛАЕТ. Он не формулирует выводов. Он заполняет таблицу
 * фактическими числами и печатает результат критерия; интерпретация — в
 * README и в отчёте. Раздел 3.4 диссертации устроен так же: сначала таблица,
 * потом выводы «только с числами».
 */

import { MODES, modeNames, runMode } from "./cascade.mjs"
import { loadModel } from "./fitness.mjs"
import { createScenario, classNames, sizeNames } from "./scenario.mjs"
import { ALPHA, cliffsDelta, describe, holm, mannWhitneyU, wilcoxonSignedRank } from "./stats.mjs"

/** Метрики, ради которых ставится эксперимент. Обозначения сохранены из диссертации. */
export const METRICS = {
  "c": { "поле": "c", "подпись": "c — вычислительная готовность", "лучше": "больше" },
  "τ": { "поле": "τ, мс", "подпись": "τ — время расчёта, мс", "лучше": "меньше" },
  "σ": { "поле": "σ", "подпись": "σ — нормированная дисперсия загрузки", "лучше": "меньше" },
  "Δ": { "поле": "Δ", "подпись": "Δ — штраф нарушений ограничений", "лучше": "меньше" },
  "J_p": { "поле": "J_p", "подпись": "J_p — итоговый функционал", "лучше": "меньше" },
  "N": { "поле": "N*", "подпись": "N — число оценок целевой функции", "лучше": "меньше" },
}

export const REFERENCE_MODE = "cascade"

/**
 * Прогон эксперимента.
 *
 * @param options.runs     число повторов на конфигурацию (протокол требует ≥ 30)
 * @param options.modes    сравниваемые режимы
 * @param options.classes  классы сценариев
 * @param options.sizes    размерности
 * @param options.baseSeed начальное семя; прогон i использует baseSeed + i
 */
export function runExperiment({
  runs = 30,
  modes = modeNames(),
  classes = ["dense_dependencies"],
  sizes = ["S"],
  baseSeed = 1,
  budget = 1200,
  cmin = 0.85,
  pilotShare = 0.08,
  pilotMin = 128,
  onProgress = null,
} = {}) {
  if (!Number.isInteger(runs) || runs < 1) throw new Error("число прогонов должно быть положительным целым")
  for (const mode of modes) if (!MODES[mode]) throw new Error(`неизвестный режим «${mode}»`)
  for (const item of classes) if (!classNames().includes(item)) throw new Error(`неизвестный класс «${item}»`)
  for (const item of sizes) if (!sizeNames().includes(item)) throw new Error(`неизвестная размерность «${item}»`)

  const model = loadModel()
  const groups = []
  const started = Date.now()

  for (const className of classes) {
    for (const size of sizes) {
      const label = `${className}/${size}`
      const records = []

      for (let index = 0; index < runs; index += 1) {
        const seed = baseSeed + index
        // Сценарий строится ОДИН раз на прогон и передаётся всем режимам.
        // Это и есть «одни и те же экземпляры» из раздела 3.3.1: режимы
        // соревнуются на одном экземпляре, а не на одинаково устроенных.
        const scenario = createScenario({ class: className, size, seed })
        for (const mode of modes) {
          records.push(runMode({ mode, seed, scenario, model, budget, cmin, pilotShare, pilotMin }))
        }
        if (onProgress) onProgress({ "группа": label, "прогон": index + 1, "всего": runs })
      }

      groups.push(summarizeGroup({ label, className, size, modes, records, runs }))
    }
  }

  return {
    "параметры": {
      "прогонов на конфигурацию": runs,
      "режимы": modes,
      "классы": classes,
      "размерности": sizes,
      "начальное семя": baseSeed,
      "N_max": budget,
      "c_min": cmin,
      "доля пилота": pilotShare,
      "минимум пилота": pilotMin,
      "уровень значимости": ALPHA,
      "опорный режим": REFERENCE_MODE,
      "модель FTS": model.path,
      "примеров модели пройдено": `${model.tests.passed}/${model.tests.total}`,
    },
    "группы": groups,
    "длительность стенда, с": (Date.now() - started) / 1000,
  }
}

function summarizeGroup({ label, className, size, modes, records, runs }) {
  const byMode = new Map(modes.map((mode) => [mode, records.filter((record) => record["режим"] === mode)]))

  const summary = modes.map((mode) => {
    const own = byMode.get(mode)
    const row = { "режим": mode, "режим по диссертации": MODES[mode], "прогонов": own.length }
    for (const [name, metric] of Object.entries(METRICS)) {
      row[name] = describe(own.map((record) => record[metric["поле"]]), { seed: `${label}:${mode}:${name}` })
    }
    row["доля допустимых"] = own.filter((record) => record["допустим"]).length / own.length
    row["ранних остановок"] = own.filter((record) => record["останов"] === "готовность достигнута").length
    row["выбор θ*"] = countBy(own.map((record) => record["θ*"]?.["имя"] ?? "—"))
    return row
  })

  // Парные сравнения: каждый режим против каскада, по каждой метрике.
  const reference = byMode.get(REFERENCE_MODE)
  const comparisons = []
  if (reference && reference.length > 0) {
    for (const mode of modes) {
      if (mode === REFERENCE_MODE) continue
      const own = byMode.get(mode)
      for (const [name, metric] of Object.entries(METRICS)) {
        const cascadeValues = reference.map((record) => record[metric["поле"]]).filter(Number.isFinite)
        const otherValues = own.map((record) => record[metric["поле"]]).filter(Number.isFinite)
        if (cascadeValues.length !== reference.length || otherValues.length !== own.length) {
          comparisons.push({ "сравнение": `${REFERENCE_MODE} против ${mode}`, "метрика": name, "p": 1, "замечание": "метрика не определена для одного из режимов" })
          continue
        }
        const paired = cascadeValues.length === otherValues.length
        const wilcoxon = paired ? wilcoxonSignedRank(cascadeValues, otherValues) : null
        const mann = mannWhitneyU(cascadeValues, otherValues)
        comparisons.push({
          "сравнение": `${REFERENCE_MODE} против ${mode}`,
          "метрика": name,
          "медиана каскада": describe(cascadeValues)["медиана"],
          "медиана сравниваемого": describe(otherValues)["медиана"],
          "Уилкоксон": wilcoxon,
          "Манн — Уитни": mann,
          "Клифф": cliffsDelta(cascadeValues, otherValues),
          // Ведущим берётся связанный критерий: экземпляры общие (раздел 3.3.1).
          "p": (wilcoxon ?? mann)["p"],
        })
      }
    }
  }

  return {
    "сценарий": label,
    "класс": className,
    "размер": size,
    "прогонов": runs,
    "протокол соблюдён": runs >= 30,
    "сводка": summary,
    "сравнения": adjustByMetric(comparisons),
    "прогоны": records,
  }
}

/**
 * Поправка Холма применяется ВНУТРИ каждой метрики, а не ко всем сравнениям разом.
 *
 * Семейство гипотез здесь — «каскад против остальных режимов ПО ДАННОЙ
 * метрике»: три сравнения на метрику. Причина не только методическая.
 *
 * Метрика τ — фактическое время, и она аппаратно-зависима: её p-value меняется
 * от запуска к запуску. При поправке на всё семейство разом порядок сортировки
 * p-value зависел бы от τ, а вместе с ним менялись бы скорректированные
 * p-value ДЕТЕРМИНИРОВАННЫХ метрик — J_p, N, c, σ, Δ. Значимость вывода про
 * `J_p` не должна зависеть от того, насколько занят процессор.
 *
 * Раздел 3.3.2 прямо называет число оценок целевой функции основным
 * аппаратно-независимым показателем, а τ — вспомогательным; такое разделение
 * семейств этому соответствует. Плата за развязку — процедура менее
 * консервативна, чем поправка на все 18 сравнений сразу, и это надо
 * учитывать, читая таблицу 3.2.
 */
function adjustByMetric(comparisons) {
  const byMetric = new Map()
  for (const comparison of comparisons) {
    if (!byMetric.has(comparison["метрика"])) byMetric.set(comparison["метрика"], [])
    byMetric.get(comparison["метрика"]).push(comparison)
  }
  const adjusted = new Map()
  for (const [metric, family] of byMetric) adjusted.set(metric, holm(family))

  // Порядок строк сохраняется прежним: сначала режим, потом метрика.
  const cursors = new Map([...adjusted.keys()].map((metric) => [metric, 0]))
  return comparisons.map((comparison) => {
    const metric = comparison["метрика"]
    const index = cursors.get(metric)
    cursors.set(metric, index + 1)
    return adjusted.get(metric)[index]
  })
}

function countBy(values) {
  const counts = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

// ─────────────────────────── отрисовка таблиц ────────────────────────────

function fixed(value, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  return value.toFixed(digits)
}

function pm(stat, digits = 4) {
  if (!stat || stat["среднее"] === null) return "—"
  return `${fixed(stat["среднее"], digits)} ± ${fixed(stat["ст. отклонение"], digits)}`
}

/**
 * Сводная таблица в Markdown.
 *
 * Форма повторяет таблицы 3.1, 3.2 и 3.3 раздела 3.4 диссертации, где вместо
 * TBD стоят фактические числа этого прогона.
 */
export function renderMarkdown(experiment) {
  const parameters = experiment["параметры"]
  const lines = []

  lines.push("# Результаты вычислительного эксперимента gacascade", "")
  lines.push("Числа получены прогоном стенда `tools/gacascade` на **синтетических сценариях**.")
  lines.push("Они характеризуют свойства модели и алгоритма и **не являются утверждением о промышленном эффекте**.", "")

  lines.push("## Параметры серии", "")
  lines.push("| Параметр | Значение |", "| --- | --- |")
  lines.push(`| Прогонов на конфигурацию | ${parameters["прогонов на конфигурацию"]} |`)
  lines.push(`| Начальное семя | ${parameters["начальное семя"]} (прогон i использует seed = ${parameters["начальное семя"]} + i) |`)
  lines.push(`| N_max (бюджет оценок) | ${parameters["N_max"]} |`)
  lines.push(`| c_min | ${parameters["c_min"]} |`)
  lines.push(`| Доля бюджета на один пилот GA1 | ${parameters["доля пилота"]} (не менее ${parameters["минимум пилота"]} оценок) |`)
  lines.push(`| Уровень значимости | ${parameters["уровень значимости"]} |`)
  // Путь показывается относительно корня репозитория: абсолютный путь сделал
  // бы файл результатов машинно-зависимым, а он предъявляется как evidence.
  lines.push(`| Модель FTS | \`${String(parameters["модель FTS"]).replace(/^.*?(?=tools\/gacascade\/)/u, "")}\` |`)
  lines.push(`| Примеров модели пройдено | ${parameters["примеров модели пройдено"]} |`)
  lines.push(`| Время стенда | ${fixed(experiment["длительность стенда, с"], 1)} с |`)
  lines.push("")

  lines.push("Обозначения метрик — по разделам 2.3 и 3.3.1 диссертации:", "")
  for (const metric of Object.values(METRICS)) lines.push(`- ${metric["подпись"]} (${metric["лучше"] === "больше" ? "больше — лучше" : "меньше — лучше"});`)
  lines.push("- доля допустимых — планы с V_skill = 0 и V_over ≤ 0,05.", "")

  for (const group of experiment["группы"]) {
    lines.push(`## Сценарий ${group["сценарий"]}`, "")
    if (!group["протокол соблюдён"]) lines.push(`> Протокол требует не менее 30 прогонов; выполнено ${group["прогонов"]}.`, "")

    lines.push("### Таблица 3.1 — результаты по режимам", "")
    lines.push("| Режим | Обозначение | `c` | `τ`, мс | `σ` | `Δ` | `J_p` | `N` | Доля допустимых |")
    lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    for (const row of group["сводка"]) {
      lines.push([
        `| ${row["режим"]}`,
        `\`${row["режим по диссертации"]}\``,
        pm(row["c"], 3),
        pm(row["τ"], 1),
        pm(row["σ"], 4),
        pm(row["Δ"], 4),
        pm(row["J_p"], 5),
        pm(row["N"], 0),
        `${fixed(row["доля допустимых"] * 100, 1)} % |`,
      ].join(" | "))
    }
    lines.push("")

    lines.push("Медианы тех же величин:", "")
    lines.push("| Режим | `c` | `τ`, мс | `σ` | `Δ` | `J_p` | `N` | Ранних остановок | Выбор θ* |")
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |")
    for (const row of group["сводка"]) {
      const theta = Object.entries(row["выбор θ*"]).map(([name, count]) => `${name}: ${count}`).join(", ")
      lines.push([
        `| ${row["режим"]}`,
        fixed(row["c"]["медиана"], 3),
        fixed(row["τ"]["медиана"], 1),
        fixed(row["σ"]["медиана"], 4),
        fixed(row["Δ"]["медиана"], 4),
        fixed(row["J_p"]["медиана"], 5),
        fixed(row["N"]["медиана"], 0),
        String(row["ранних остановок"]),
        `${theta} |`,
      ].join(" | "))
    }
    lines.push("")

    lines.push("### Таблица 3.2 — статистические сравнения с каскадом", "")
    lines.push("Связанные выборки (общие экземпляры и seed), ведущий критерий — Уилкоксона;")
    lines.push("рядом приведён Манна — Уитни как несвязанная оценка. Поправка Холма — внутри каждой метрики")
    lines.push("(три сравнения на метрику), чтобы аппаратно-зависимое τ не влияло на значимость остальных.", "")
    lines.push("| Сравнение | Метрика | Медиана каскада | Медиана режима | W | p (Уилкоксон) | p (Манн — Уитни) | p Холма | Клифф δ | Вывод при α = 0,05 |")
    lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |")
    for (const comparison of group["сравнения"]) {
      const wilcoxon = comparison["Уилкоксон"]
      const mann = comparison["Манн — Уитни"]
      const digits = comparison["метрика"] === "N" ? 0 : comparison["метрика"] === "τ" ? 1 : 5
      lines.push([
        `| ${comparison["сравнение"]}`,
        `\`${comparison["метрика"]}\``,
        fixed(comparison["медиана каскада"], digits),
        fixed(comparison["медиана сравниваемого"], digits),
        wilcoxon ? String(wilcoxon["W"]) : "—",
        wilcoxon ? formatP(wilcoxon["p"]) : "—",
        mann ? formatP(mann["p"]) : "—",
        formatP(comparison["p Холма"]),
        fixed(comparison["Клифф"]?.["δ"], 3),
        `${comparison["значимо"] ? "различие значимо" : "различие не значимо"} (${comparison["Клифф"]?.["величина"] ?? "—"}) |`,
      ].join(" | "))
    }
    lines.push("")

    lines.push("### Таблица 3.3 — вклад уровней каскада", "")
    lines.push("| Режим | Что добавлено | `N` медиана | `τ`, мс медиана | `J_p` медиана | Доля допустимых |")
    lines.push("| --- | --- | ---: | ---: | ---: | ---: |")
    const contribution = {
      heuristic: "конструктивное построение, без поиска",
      single: "GA2, фиксированная `balanced`",
      "two-level": "+ GA1: пилотный выбор θ*",
      cascade: "+ GA0: ранняя остановка по c ≥ c_min",
    }
    for (const key of ["heuristic", "single", "two-level", "cascade"]) {
      const row = group["сводка"].find((item) => item["режим"] === key)
      if (!row) continue
      lines.push(`| ${key} | ${contribution[key]} | ${fixed(row["N"]["медиана"], 0)} | ${fixed(row["τ"]["медиана"], 1)} | ${fixed(row["J_p"]["медиана"], 5)} | ${fixed(row["доля допустимых"] * 100, 1)} % |`)
    }
    lines.push("")
  }

  return lines.join("\n")
}

function formatP(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  if (value < 1e-4) return value.toExponential(2)
  return value.toFixed(4)
}

/** JSON без поштучных прогонов: сводка и сравнения. Полные прогоны — по флагу. */
export function toJSON(experiment, { includeRuns = false } = {}) {
  return {
    "параметры": experiment["параметры"],
    "длительность стенда, с": experiment["длительность стенда, с"],
    "группы": experiment["группы"].map((group) => {
      const { "прогоны": runs, ...rest } = group
      // X* — вектор длиной n; в сводке он не нужен и раздувает JSON на порядок.
      return includeRuns
        ? { ...rest, "прогоны": runs.map(({ "X*": _plan, ...record }) => record) }
        : rest
    }),
  }
}
