/**
 * Стенд эксперимента: 30 прогонов, заполненная таблица, воспроизводимость серии.
 *
 * Протокол раздела 3.3.1 требует не менее 30 прогонов на конфигурацию при
 * фиксированных seed. Проверяется именно это: серия доходит до конца, в
 * таблице нет пропусков, и повторный запуск даёт те же числа — иначе
 * «p = 0,003» в таблице 3.2 ничем не отличается от гадания.
 *
 * Бюджет здесь меньше основного (640 против 1200): проверяется устройство
 * стенда, а не результат эксперимента. Фактические числа получены отдельным
 * прогоном и лежат в results/.
 */

import assert from "node:assert/strict"
import { test } from "node:test"

import { METRICS, REFERENCE_MODE, renderMarkdown, runExperiment, toJSON } from "../src/experiment.mjs"
import { modeNames } from "../src/cascade.mjs"

const RUNS = 30
const BUDGET = 640

let cached = null
function experiment() {
  cached ??= runExperiment({ runs: RUNS, budget: BUDGET, classes: ["dense_dependencies"], sizes: ["S"] })
  return cached
}

test("серия из 30 прогонов на каждый режим доходит до конца", () => {
  const result = experiment()
  assert.equal(result["параметры"]["прогонов на конфигурацию"], RUNS)
  assert.equal(result["группы"].length, 1)
  const group = result["группы"][0]
  assert.equal(group["протокол соблюдён"], true)
  assert.equal(group["прогоны"].length, RUNS * modeNames().length)
  for (const mode of modeNames()) {
    assert.equal(group["прогоны"].filter((record) => record["режим"] === mode).length, RUNS)
  }
})

test("сводная таблица заполнена: ни одной метрики без числа", () => {
  const group = experiment()["группы"][0]
  assert.equal(group["сводка"].length, modeNames().length)
  for (const row of group["сводка"]) {
    assert.equal(row["прогонов"], RUNS)
    for (const name of Object.keys(METRICS)) {
      const statistic = row[name]
      assert.equal(statistic["n"], RUNS, `${row["режим"]}/${name}: не все прогоны дали значение`)
      for (const field of ["среднее", "медиана", "ст. отклонение", "минимум", "максимум"]) {
        assert.ok(Number.isFinite(statistic[field]), `${row["режим"]}/${name}: ${field} не число`)
      }
      assert.ok(Number.isFinite(statistic["ДИ 95%"]["нижняя"]), `${row["режим"]}/${name}: нет доверительного интервала`)
    }
    assert.ok(row["доля допустимых"] >= 0 && row["доля допустимых"] <= 1)
  }
})

test("каждый режим сравнён с каскадом по каждой метрике, p-value скорректированы", () => {
  const group = experiment()["группы"][0]
  const expected = (modeNames().length - 1) * Object.keys(METRICS).length
  assert.equal(group["сравнения"].length, expected)
  for (const comparison of group["сравнения"]) {
    assert.ok(comparison["сравнение"].startsWith(REFERENCE_MODE))
    assert.ok(comparison["p"] >= 0 && comparison["p"] <= 1, `p вне [0;1]: ${comparison["p"]}`)
    assert.ok(comparison["p Холма"] >= comparison["p"] - 1e-12, "поправка Холма смягчила p-value")
    assert.equal(typeof comparison["значимо"], "boolean")
    assert.ok(comparison["Уилкоксон"], "связанный критерий обязателен: экземпляры общие")
    assert.ok(comparison["Манн — Уитни"], "несвязанная оценка приводится рядом")
  }
})

test("режимы соревнуются на одних и тех же экземплярах", () => {
  const group = experiment()["группы"][0]
  const bySeed = new Map()
  for (const record of group["прогоны"]) {
    const key = record["семя"]
    const previous = bySeed.get(key)
    if (previous) assert.deepEqual(record["сценарий"], previous, `seed ${key}: режимы получили разные экземпляры`)
    else bySeed.set(key, record["сценарий"])
  }
  assert.equal(bySeed.size, RUNS)
})

test("бюджет соблюдён во всех прогонах серии", () => {
  const group = experiment()["группы"][0]
  for (const record of group["прогоны"]) {
    const limit = record["режим"] === "heuristic" ? 1 : BUDGET
    assert.ok(record["N*"] <= limit, `${record["режим"]}/seed ${record["семя"]}: ${record["N*"]} при пределе ${limit}`)
  }
})

test("Markdown-таблица построена и не содержит незаполненных ячеек", () => {
  const markdown = renderMarkdown(experiment())
  assert.ok(markdown.includes("Таблица 3.1"))
  assert.ok(markdown.includes("Таблица 3.2"))
  assert.ok(markdown.includes("Таблица 3.3"))
  assert.ok(!markdown.includes("TBD"), "в таблице остались заглушки TBD")
  for (const mode of modeNames()) assert.ok(markdown.includes(mode), `в таблице нет режима ${mode}`)
  // Прочерк допустим только там, где величина не определена по существу
  // (компоненты c у эвристики), но не в строках сводки по J_p и N.
  const summaryLines = markdown.split("\n").filter((line) => line.startsWith("| cascade |") || line.startsWith("| single |"))
  for (const line of summaryLines) assert.ok(!line.includes(" — "), `незаполненная ячейка: ${line}`)
  assert.ok(markdown.includes("не являются утверждением о промышленном эффекте"))
})

test("JSON сериализуется и содержит параметры воспроизведения", () => {
  const json = JSON.parse(JSON.stringify(toJSON(experiment(), { includeRuns: true })))
  assert.equal(json["параметры"]["прогонов на конфигурацию"], RUNS)
  assert.equal(json["параметры"]["N_max"], BUDGET)
  assert.ok(json["параметры"]["c_min"] > 0)
  assert.equal(json["параметры"]["примеров модели пройдено"], "15/15")
  assert.equal(json["группы"][0]["прогоны"].length, RUNS * modeNames().length)
  // X* в сводный JSON не попадает: вектор длиной n на каждый прогон.
  assert.equal(json["группы"][0]["прогоны"][0]["X*"], undefined)
})

test("серия воспроизводится: повтор даёт те же числа", () => {
  const first = runExperiment({ runs: 30, budget: BUDGET, modes: ["single", "cascade"] })
  const second = runExperiment({ runs: 30, budget: BUDGET, modes: ["single", "cascade"] })
  const strip = (result) => result["группы"].map((group) => ({
    "сводка": group["сводка"].map(({ "τ": _tau, ...row }) => row),
    "сравнения": group["сравнения"].filter((item) => item["метрика"] !== "τ"),
  }))
  assert.deepEqual(strip(second), strip(first))
})
