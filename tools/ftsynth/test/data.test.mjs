/**
 * Наборы данных обязаны быть воспроизводимы из истинных политик.
 *
 * Иначе `data/*.json` со временем становится набором чисел неизвестного
 * происхождения, и утверждение «синтез восстановил истину» проверить нечем.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { evaluateUtility, parseNaturalSurface, validate } from "../../../dist/src/index.js"
import { DOMAINS, generateDataset, gridOf } from "../src/generate.mjs"
import { loadDataset } from "../src/schema.mjs"

const ФАЙЛЫ = [
  ["discounts", "discounts.clean.json", { seed: 7, noise: 0 }],
  ["discounts", "discounts.json", { seed: 7, noise: 0.15 }],
  ["admission", "admission.clean.json", { seed: 7, noise: 0 }],
  ["admission", "admission.json", { seed: 7, noise: 0.1 }],
]

for (const [набор, файл, параметры] of ФАЙЛЫ) {
  test(`«${файл}» воспроизводится генератором дословно`, () => {
    const ожидаемый = JSON.parse(readFileSync(new URL(`../data/${файл}`, import.meta.url), "utf8"))
    assert.deepEqual(generateDataset(набор, параметры), ожидаемый)
  })
}

for (const набор of Object.keys(DOMAINS)) {
  test(`истинная политика «${DOMAINS[набор].truth}» валидна и покрывает всю сетку входов`, () => {
    const document = parseNaturalSurface(readFileSync(new URL(`../data/${DOMAINS[набор].truth}`, import.meta.url), "utf8"))
    assert.ok(validate(document).valid)
    const utility = document.utilities.find((item) => item.name === DOMAINS[набор].utility)
    // Истинная политика не имеет права нарушать собственные свойства ни на
    // одной точке сетки: иначе часть меток была бы не решением, а ошибкой.
    for (const вход of gridOf(DOMAINS[набор])) evaluateUtility(utility, вход)
  })
}

test("шум искажает объявленную долю наблюдений и только её", () => {
  const чистый = generateDataset("discounts", { seed: 7, noise: 0 })
  const шумный = generateDataset("discounts", { seed: 7, noise: 0.15 })
  assert.deepEqual(
    чистый["наблюдения"].map((row) => row["вход"]),
    шумный["наблюдения"].map((row) => row["вход"]),
    "шум обязан менять решения, но не входы",
  )
  const искажено = чистый["наблюдения"].filter((row, index) => row["решение"] !== шумный["наблюдения"][index]["решение"])
  assert.ok(искажено.length > 20 && искажено.length < 80, `искажено ${искажено.length} из ${чистый["наблюдения"].length}`)
})

test("схема набора не содержит правил истинной политики", () => {
  const dataset = loadDataset(new URL("../data/discounts.json", import.meta.url))
  const сериализованный = JSON.stringify(dataset)
  assert.ok(!сериализованный.includes("rules"), "правила истинной политики просочились в набор данных")
  assert.ok(dataset["свойства"].length > 0, "свойства-инварианты аналитик объявляет заранее")
})
