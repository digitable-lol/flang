#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Замер охвата по ЗАДАННОЙ ЦЕЛИ: какие функции корпуса приняли бы утверждение.
 *
 * ── Зачем он рядом с `proof-search.mjs`, а не внутри ────────────────────────
 * Оракул (`flang/scripts/proof-search.mjs`) отвечает на вопрос «есть ли
 * доказательство у утверждения, КОТОРОЕ УЖЕ НАПИСАНО». Вопрос этой работы
 * другой и стоит раньше: «а какие утверждения вообще стоит писать». Ответ на
 * него нельзя получить чтением ядра — только прогоном, и прогон обязан быть
 * воспроизводимым, иначе числа вида «по всему корпусу РОВНО НОЛЬ» останутся
 * настроением.
 *
 * ── Как он работает, и почему ему нельзя верить меньше, чем `flang check` ───
 * Для каждой функции корпуса, подходящей под шаблон, в КОПИЮ исходника
 * вписывается постусловие с заданной целью — обычной строкой, обычным
 * `обеспечивает`. Дальше всё делает обычный путь: `loadProgramFromSource`,
 * `externalChecks`, `obligations`, а если обязательство осталось открытым —
 * оракул и ПРОВЕРКА его находки обычной ведомостью. Своей проверки здесь нет ни
 * строки; инструмент, который отвечает на свой вопрос сам, меряет себя.
 *
 * Дерево не меняется: исходник читается, копия живёт в памяти.
 *
 * ── Шаблоны ────────────────────────────────────────────────────────────────
 *   неотрицательность  `результат не меньше 0` — функциям в число
 *   длина-сохранена    `(длина результат) равен (длина <список>)` — список → список
 *   длина-не-больше    `(длина результат) не больше (длина <список>)` — им же
 *   граница-сверху     `результат не больше <числовой параметр>` — функциям в число
 *   граница-снизу      `результат не меньше <числовой параметр>` — им же
 *   строка-непуста     `(длина результат) больше 0` — функциям в строку
 *
 * Запуск:
 *   node flang/scripts/claim-scan.mjs                     все шаблоны
 *   node flang/scripts/claim-scan.mjs неотрицательность   один шаблон
 *   node flang/scripts/claim-scan.mjs все stdlib          с сужением по пути
 */
import { readFileSync, realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { externalChecks, loadProgramFromSource } from "../bin/flang.mjs"
import { искатьДоказательство } from "../proof/search.mjs"
import { parse } from "../src/parser.mjs"
import { proofLedger, ФАЙЛЫ } from "./proof-ledger.mjs"

const корень = fileURLToPath(new URL("../..", import.meta.url))

/** Имя пробного постусловия. Оно живёт только в копии и в дерево не попадает. */
const ИМЯ = "проба охвата"

/**
 * Шаблоны целей. Каждый говорит, каким функциям он подходит и какие цели у них
 * пробует: одну на функцию либо по одной на подходящий параметр.
 */
export const ШАБЛОНЫ = Object.freeze({
  "неотрицательность": {
    подходит: (fn) => fn.returns?.kind === "number",
    цели: () => [["результат не меньше 0", "результат не меньше 0"]],
  },
  "длина-сохранена": {
    подходит: (fn) => fn.returns?.kind === "list",
    цели: (fn) => (fn.params ?? []).filter((п) => п.type?.kind === "list")
      .map((п) => [`по «${п.name}»`, `(длина результат) равен (длина ${п.name})`]),
  },
  "длина-не-больше": {
    подходит: (fn) => fn.returns?.kind === "list",
    цели: (fn) => (fn.params ?? []).filter((п) => п.type?.kind === "list")
      .map((п) => [`по «${п.name}»`, `(длина результат) не больше (длина ${п.name})`]),
  },
  "граница-сверху": {
    подходит: (fn) => fn.returns?.kind === "number",
    цели: (fn) => (fn.params ?? []).filter((п) => п.type?.kind === "number")
      .map((п) => [`по «${п.name}»`, `результат не больше ${п.name}`]),
  },
  "граница-снизу": {
    подходит: (fn) => fn.returns?.kind === "number",
    цели: (fn) => (fn.params ?? []).filter((п) => п.type?.kind === "number")
      .map((п) => [`по «${п.name}»`, `результат не меньше ${п.name}`]),
  },
  "строка-непуста": {
    подходит: (fn) => fn.returns?.kind === "string",
    цели: () => [["(длина результат) больше 0", "(длина результат) больше 0"]],
  },
})

/** Обязательства копии исходника — обычным путём и только своих функций. */
async function обязательства(исходник, путь) {
  const свои = new Set(parse(исходник, путь).functions?.map((ф) => ф.name) ?? [])
  const программа = await loadProgramFromSource(исходник, путь)
  const внешнее = await externalChecks(программа)
  if (внешнее.diagnostics.some((беда) => беда?.severity !== "warning")) return null
  const список = (внешнее.results?.obligations?.obligations ?? [])
    .filter((о) => о.kind === "postcondition" && свои.has(о.of))
  return { программа, список }
}

/** Находка оракула проверяется ВЕДОМОСТЬЮ, а не словом оракула. */
async function сверить(исходник, текст, путь) {
  const собрано = `${исходник.replace(/\s*$/u, "")}\n\n${текст}`
  try {
    const программа = await loadProgramFromSource(собрано, путь)
    const внешнее = await externalChecks(программа)
    if (внешнее.diagnostics.some((беда) => беда?.severity !== "warning")) return null
    const запись = (proofLedger(программа, внешнее.results).claims ?? []).find((з) => з.name === ИМЯ)
    return запись?.verdict === "proved" || запись?.verdict === "proved-induction" ? запись : null
  } catch {
    return null
  }
}

/** Строка объявления функции — с параметром типа и без него. */
function заголовокФункции(строки, имя) {
  return строки.findIndex(
    (с) => с === `тотальная функция «${имя}»`
      || с === `функция «${имя}»`
      || с.startsWith(`тотальная функция «${имя}» от `)
      || с.startsWith(`функция «${имя}» от `),
  )
}

/**
 * Замер по одному шаблону.
 *
 * @param {string} имяШаблона ключ из `ШАБЛОНЫ`
 * @param {string|null} сужение подстрока пути или `null`
 * @returns {Promise<{шаблон: string, взято: number, безТеоремы: object[], сТеоремой: object[]}>}
 */
export async function замер(имяШаблона, сужение = null) {
  const шаблон = ШАБЛОНЫ[имяШаблона]
  if (шаблон === undefined) throw new Error(`нет шаблона «${имяШаблона}»`)
  const итог = { шаблон: имяШаблона, взято: 0, безТеоремы: [], сТеоремой: [] }

  for (const путь of ФАЙЛЫ) {
    if (сужение !== null && !путь.includes(сужение)) continue
    /* Файлы доказательств пропускаются: у их функций утверждение уже написано,
       и мерить на них охват значило бы считать сделанное за возможное. */
    if (путь.startsWith("flang/proof/examples/")) continue
    const исходник = readFileSync(`${корень}${путь}`, "utf8")
    let дерево
    try {
      дерево = parse(исходник, путь)
    } catch {
      continue
    }
    const строки = исходник.split("\n")
    for (const fn of дерево.functions ?? []) {
      if (!шаблон.подходит(fn)) continue
      /* У функции с постусловием мерить нечего: автор уже сказал своё. */
      if ((fn.postconditions ?? []).length > 0) continue
      const заголовок = заголовокФункции(строки, fn.name)
      if (заголовок < 0) continue
      let возврат = -1
      for (let и = заголовок + 1; и < строки.length && и < заголовок + 8; и += 1) {
        if (строки[и].startsWith("  возвращает ")) {
          возврат = и
          break
        }
      }
      if (возврат < 0) continue

      for (const [метка, цель] of шаблон.цели(fn)) {
        итог.взято += 1
        const собрано = [
          ...строки.slice(0, возврат + 1),
          `  обеспечивает «${ИМЯ}» ${цель}`,
          ...строки.slice(возврат + 1),
        ].join("\n")
        let собранные
        try {
          собранные = await обязательства(собрано, путь)
        } catch {
          continue
        }
        if (собранные === null) continue
        const о = собранные.список.find((з) => з.name === ИМЯ)
        if (о === undefined) continue
        if (о.discharge !== null && о.discharge !== undefined) {
          итог.безТеоремы.push({ путь, функция: fn.name, метка, says: о.discharge.says ?? "" })
          continue
        }
        const найдено = искатьДоказательство(о, собранные.программа, собрано)
        if (!найдено.ok) continue
        const вердикт = await сверить(собрано, найдено.текст, путь)
        if (вердикт !== null) итог.сТеоремой.push({ путь, функция: fn.name, метка, says: вердикт.says })
      }
    }
  }
  return итог
}

function печать(итоги) {
  const строки = ["── охват по шаблонам целей ──"]
  for (const итог of итоги) {
    строки.push(
      `${итог.шаблон}: проб ${итог.взято},`
        + ` закрыто без теоремы ${итог.безТеоремы.length},`
        + ` доказано с теоремой ${итог.сТеоремой.length}`,
    )
    for (const з of [...итог.безТеоремы, ...итог.сТеоремой]) {
      строки.push(`    ${з.путь} «${з.функция}» ${з.метка}`)
    }
  }
  return `${строки.join("\n")}\n`
}

let запущен = false
if (process.argv[1] !== undefined) {
  try {
    запущен = realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
  } catch {
    запущен = false
  }
}
if (запущен) {
  const первый = process.argv[2] ?? "все"
  const сужение = process.argv[3] ?? null
  const имена = первый === "все" ? Object.keys(ШАБЛОНЫ) : [первый]
  const итоги = []
  for (const имя of имена) итоги.push(await замер(имя, сужение))
  process.stdout.write(печать(итоги))
}
