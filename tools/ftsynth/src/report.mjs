/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Оформление результата: текст модели и отчёт о прогоне.
 *
 * Про примеры важно сказать прямо. `пример` в выдаваемой модели фиксирует
 * поведение найденной модели на выбранных входах, а не подтверждает её
 * правильность: ожидание в примере — это то, что модель предсказывает, а не
 * то, что решил человек. Такой пример работает как регрессионный тест
 * артефакта (`fts test` на нём зелёный и обязан оставаться зелёным), а
 * правильность измеряется ошибкой на контрольной выборке — она в отчёте.
 */
import { evaluateUtility } from "../../../dist/src/index.js"
import { buildDocument, buildUtility, renderDocument } from "./individual.mjs"
import { createRng } from "./prng.mjs"

export function behaviourExamples(individual, space, rows, count, seed) {
  const utility = buildUtility(individual, space)
  const rng = createRng(`examples:${seed}`)
  const chosen = rng.shuffled(rows.map((_, index) => index)).slice(0, count).sort((left, right) => left - right)
  const examples = []
  for (const index of chosen) {
    const вход = rows[index]["вход"]
    let expected
    try {
      expected = evaluateUtility(utility, вход)
    } catch {
      continue
    }
    examples.push({ name: `Снимок поведения ${examples.length + 1}`, input: вход, expected })
  }
  return examples
}

export function renderModel(result, options = {}) {
  const examples = options.examples ?? []
  return renderDocument(buildDocument(result.best, result.space, examples))
}

export function buildReport(result, dataset) {
  return {
    "набор": dataset["название"],
    "утилита": result.space.utility,
    "объект": result.space.structure.name,
    "режим отбора": result["режим"],
    "веса": result["веса"],
    "поколений": result["поколений"],
    "найдено на поколении": result["найдено на поколении"],
    "перезапусков при застое": result["перезапусков"],
    "правил": result["обучение"]["правил"],
    "условий": result["обучение"]["условий"],
    "обучение": metrics(result["обучение"], result.split["обучение"].length),
    "контроль": metrics(result["контроль"], result.split["контроль"].length),
    ...(result["фронт"] ? { "фронт парето": result["фронт"].map(({ особь, ...rest }) => rest) } : {}),
  }
}

function metrics(measured, size) {
  return {
    "наблюдений": size,
    "относительная ошибка": round(measured["ошибка"]),
    ...(measured["mae"] === null ? {} : { "средняя абсолютная ошибка": round(measured["mae"]) }),
    "доля точных попаданий": round(measured["точность"]),
    "доля нарушений свойств": round(measured["нарушения"]),
  }
}

export function renderTextReport(report) {
  const lines = [
    `набор: ${report["набор"]}   утилита: «${report["утилита"]}»   режим отбора: ${report["режим отбора"]}`,
    `поколений: ${report["поколений"]} (лучшая найдена на ${report["найдено на поколении"]}, перезапусков при застое ${report["перезапусков при застое"]})`,
    `размер модели: правил ${report["правил"]}, условий ${report["условий"]}`,
    line("обучение", report["обучение"]),
    line("контроль", report["контроль"]),
  ]
  if (report["фронт парето"]) {
    lines.push(`фронт парето: ${report["фронт парето"].length} недоминируемых моделей`)
    for (const item of report["фронт парето"]) {
      lines.push(`  правил ${item["правил"]}, условий ${item["условий"]}, `
        + `ошибка обучение ${round(item["ошибка на обучении"])} / контроль ${round(item["ошибка на контроле"])}`)
    }
  }
  return `${lines.join("\n")}\n`
}

function line(label, block) {
  const mae = block["средняя абсолютная ошибка"] === undefined ? "" : `, MAE ${block["средняя абсолютная ошибка"]}`
  return `${label}: наблюдений ${block["наблюдений"]}, относительная ошибка ${block["относительная ошибка"]}${mae}`
    + `, точных попаданий ${block["доля точных попаданий"]}, нарушений свойств ${block["доля нарушений свойств"]}`
}

function round(value) {
  return Number(value.toFixed(4))
}
