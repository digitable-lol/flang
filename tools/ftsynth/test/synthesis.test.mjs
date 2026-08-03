/**
 * Проверки самого синтеза: воспроизводимость, восстановление истинной
 * политики, поведение на шуме и годность выданного артефакта.
 *
 * Восстановление проверяется по поведению на полной сетке входов, а не по
 * тексту. Истинную политику можно записать десятком эквивалентных способов, и
 * требовать совпадения букв — значит проверять форму вместо смысла.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { parseNaturalSurface, testUtilities, validate } from "../../../dist/src/index.js"
import { compareBehaviour } from "../src/behaviour.mjs"
import { buildUtility } from "../src/individual.mjs"
import { DOMAINS, generateDataset, gridOf } from "../src/generate.mjs"
import { behaviourExamples, buildReport, renderModel } from "../src/report.mjs"
import { loadDataset, normalizeDataset } from "../src/schema.mjs"
import { synthesize } from "../src/evolve.mjs"

const БЮДЖЕТ = { generations: 600, population: 120 }

function истина(набор) {
  const path = new URL(`../data/${DOMAINS[набор].truth}`, import.meta.url)
  return parseNaturalSurface(readFileSync(path, "utf8")).utilities[0]
}

test("одно семя — один результат, разные семена расходятся", () => {
  const dataset = normalizeDataset(generateDataset("discounts", { seed: 3, noise: 0.15 }))
  const параметры = { generations: 60, population: 40 }
  const первый = synthesize(dataset, { ...параметры, seed: 42 })
  const второй = synthesize(dataset, { ...параметры, seed: 42 })
  const третий = synthesize(dataset, { ...параметры, seed: 43 })

  assert.deepEqual(первый.best, второй.best)
  assert.deepEqual(первый["обучение"], второй["обучение"])
  assert.deepEqual(первый["история"], второй["история"])
  assert.notDeepEqual(первый.best, третий.best)
})

for (const набор of ["discounts", "admission"]) {
  test(`«${набор}»: на данных без шума синтез восстанавливает истинную политику`, () => {
    const dataset = normalizeDataset(generateDataset(набор, { seed: 7, noise: 0 }))
    const результат = synthesize(dataset, { ...БЮДЖЕТ, seed: 42 })

    assert.equal(результат["обучение"]["ошибка"], 0, "модель не объясняет обучающую выборку")
    assert.equal(результат["контроль"]["ошибка"], 0, "модель не объясняет контрольную выборку")

    const сравнение = compareBehaviour(
      buildUtility(результат.best, результат.space),
      истина(набор),
      gridOf(DOMAINS[набор]),
    )
    assert.ok(
      сравнение.equal,
      `поведение расходится с истинной политикой на ${сравнение.mismatches.length} из ${сравнение.checked} входов: `
      + JSON.stringify(сравнение.mismatches.slice(0, 3)),
    )
  })
}

test("«discounts»: на зашумлённых данных ошибка на контроле не хуже порога", () => {
  const dataset = loadDataset(new URL("../data/discounts.json", import.meta.url))
  const результат = synthesize(dataset, { ...БЮДЖЕТ, seed: 42 })

  // Порог заведомо мягче достигнутого: тест ловит развал поиска, а не
  // колебания в третьем знаке.
  assert.ok(результат["контроль"]["ошибка"] <= 0.2, `ошибка на контроле ${результат["контроль"]["ошибка"]}`)
  assert.ok(результат["обучение"]["ошибка"] <= 0.2, `ошибка на обучении ${результат["обучение"]["ошибка"]}`)
  // Переобучение выглядит как «на обучении отлично, на контроле плохо».
  assert.ok(результат["контроль"]["ошибка"] < результат["обучение"]["ошибка"] + 0.1, "признаки переобучения")
  assert.ok(результат["обучение"]["правил"] <= 6)
})

test("«admission»: на зашумлённых данных доля точных решений на контроле не ниже порога", () => {
  const dataset = loadDataset(new URL("../data/admission.json", import.meta.url))
  const результат = synthesize(dataset, { ...БЮДЖЕТ, seed: 42 })
  assert.ok(результат["контроль"]["точность"] >= 0.85, `точность на контроле ${результат["контроль"]["точность"]}`)
})

test("выданная модель проходит validate ядра и собственные примеры", () => {
  const dataset = loadDataset(new URL("../data/discounts.json", import.meta.url))
  const результат = synthesize(dataset, { generations: 120, population: 60, seed: 4 })
  const примеры = behaviourExamples(результат.best, результат.space, результат.split["контроль"], 5, 4)
  const текст = renderModel(результат, { examples: примеры })

  const документ = parseNaturalSurface(текст)
  const проверка = validate(документ)
  assert.ok(проверка.valid, JSON.stringify(проверка.diagnostics))

  const примерыОтчёт = testUtilities(документ)
  assert.equal(примерыОтчёт.failed, 0, JSON.stringify(примерыОтчёт.results))
  assert.equal(примерыОтчёт.total, 5)

  const отчёт = buildReport(результат, dataset)
  assert.equal(отчёт["обучение"]["наблюдений"] + отчёт["контроль"]["наблюдений"], dataset["наблюдения"].length)
  assert.ok(отчёт["обучение"]["доля нарушений свойств"] === 0, "победитель не имеет права нарушать свойства")
})

test("режим парето возвращает фронт компромиссов от простого к точному", () => {
  const dataset = loadDataset(new URL("../data/discounts.json", import.meta.url))
  const результат = synthesize(dataset, { generations: 200, population: 80, seed: 42, pareto: true })
  const фронт = результат["фронт"]

  assert.ok(фронт.length >= 3, `фронт слишком беден: ${фронт.length}`)
  for (let index = 1; index < фронт.length; index += 1) {
    assert.ok(
      фронт[index]["ошибка на обучении"] >= фронт[index - 1]["ошибка на обучении"],
      "фронт не отсортирован по точности",
    )
    // Компромисс: платя точностью, получаем простоту. Если и точность, и
    // сложность растут одновременно, точка не была недоминируемой.
    assert.ok(
      фронт[index]["правил"] + фронт[index]["условий"] <= фронт[index - 1]["правил"] + фронт[index - 1]["условий"]
      || фронт[index]["нарушения"] < фронт[index - 1]["нарушения"],
      "на фронте есть доминируемая точка",
    )
  }
  assert.ok(фронт.some((точка) => точка["правил"] === 1), "фронт обязан содержать простейшую модель")
})
