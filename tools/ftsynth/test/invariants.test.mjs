/**
 * Главный инвариант синтеза: особь всегда остаётся моделью FTS.
 *
 * Не «на выходе получается валидная модель», а именно «любая особь любого
 * поколения». Если инвариант держится только для победителя, значит поиск шёл
 * по пространству, часть которого не является программами, и весь смысл
 * работы с моделью, а не со строкой, теряется.
 *
 * Проверка идёт через настоящее ядро: печать в текст, разбор естественной
 * поверхности, `validate`. Проверять собственным кодом здесь бессмысленно —
 * авторитет по вопросу «компилируется ли» только один.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { evaluateUtility, parseNaturalSurface, validate } from "../../../dist/src/index.js"
import { buildDocument, buildUtility, renderDocument } from "../src/individual.mjs"
import { buildSpace, normalizeDataset } from "../src/schema.mjs"
import { generateDataset } from "../src/generate.mjs"
import { synthesize } from "../src/evolve.mjs"

for (const набор of ["discounts", "admission"]) {
  test(`«${набор}»: любая особь любого поколения печатается и компилируется`, () => {
    const dataset = normalizeDataset(generateDataset(набор, { seed: 5, noise: 0.1 }))
    const space = buildSpace(dataset, {})
    const проба = dataset["наблюдения"].slice(0, 4).map((row) => row["вход"])
    let проверено = 0
    const seen = new Set()

    const результат = synthesize(dataset, {
      seed: 21,
      generations: 40,
      population: 30,
      onIndividual: (individual) => {
        const key = JSON.stringify(individual)
        if (seen.has(key)) return
        seen.add(key)
        const text = renderDocument(buildDocument(individual, space))
        const document = parseNaturalSurface(text)
        const отчёт = validate(document)
        assert.ok(отчёт.valid, `особь не проходит validate: ${JSON.stringify(отчёт.diagnostics)}\n${text}`)

        // Текст обязан описывать ровно ту же модель: печать не имеет права
        // терять или округлять параметры.
        const прямая = buildUtility(individual, space)
        const разобранная = document.utilities[0]
        for (const вход of проба) {
          assert.deepEqual(safe(разобранная, вход), safe(прямая, вход), `текст ведёт себя иначе:\n${text}`)
        }
        проверено += 1
      },
    })

    assert.ok(проверено > 300, `проверено слишком мало особей: ${проверено}`)
    assert.ok(результат.best.rules.length >= 1)
  })
}

function safe(utility, вход) {
  try {
    return { значение: evaluateUtility(utility, вход) }
  } catch (error) {
    return { ошибка: error instanceof Error ? error.message : String(error) }
  }
}
