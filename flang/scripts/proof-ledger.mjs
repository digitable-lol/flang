#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Свод ведомости доказательства по всему корпусу `.flang`.
 *
 * `flang check --proof` печатает ведомость одного модуля. Этапы плана меряются
 * не модулем, а корпусом, и складывать вывод глазами — то же самое, что не
 * мерить: числа надо получать одной командой и одним способом.
 *
 * ── Почему свод считает не так, как первый замер ─────────────────────────────
 * Первый замер поверхности доказуемости разбирал каждый файл ОТДЕЛЬНО и не
 * связывал импорты. На восьми файлах корпуса это даёт другой ответ, и ответ
 * этот неверный: `flang/self/lexer.flang` зовёт функции из
 * `flang/self/strings.flang`, и в одиночку его тотальные функции не проходят
 * анализ вовсе («вызывает неизвестную функцию»). Недоказанность заразна, весь
 * цикл уходит в отказ, и рекурсия, которую он несёт, в свод рекурсий не
 * попадает. Замер при этом считал рекурсию своим обходом AST, без анализа, и
 * потому её видел — а сторожа брал из анализа, уже отфильтрованного. Две
 * половины одного числа считались по разным правилам.
 *
 * Здесь программа загружается ТЕМ ЖЕ загрузчиком, что у `flang check`: со
 * связыванием, с отметкой меры, целиком. Цена — импортированные функции
 * приезжают в программу вместе со своими, поэтому в свод от каждого файла
 * берутся только СВОИ объявления: те, что есть в его собственном разборе. Иначе
 * `flang/stdlib/lists.flang` посчитался бы столько раз, сколько модулей его
 * зовут.
 *
 * Запуск:
 *   node flang/scripts/proof-ledger.mjs             свод словами
 *   node flang/scripts/proof-ledger.mjs --json      свод машине
 *   node flang/scripts/proof-ledger.mjs --files     ещё и по файлу на строку
 */
import { readFileSync, realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { externalChecks, loadProgram } from "../bin/flang.mjs"
import { parse } from "../src/parser.mjs"
import { proofLedger } from "../src/proof.mjs"
import { globSync } from "../test/glob.mjs"

const корень = fileURLToPath(new URL("../..", import.meta.url))

/**
 * Файлы корпуса.
 *
 * Склеенный самоприменением компилятор исключён по той же причине, по которой
 * его исключал первый замер: это не отдельный модуль, а сборка всех остальных,
 * и его функции посчитались бы дважды.
 */
export const ФАЙЛЫ = globSync("flang/**/*.flang", { cwd: корень })
  .filter((путь) => путь !== "flang/self/bootstrap/compiler.flang")
  .sort()

/**
 * Ведомость одного файла, суженная до его собственных объявлений.
 *
 * @param {string} путь путь от корня репозитория
 * @returns {Promise<{путь: string, ведомость: object|null, беда: string|null}>}
 */
export async function ведомостьФайла(путь) {
  const полный = `${корень}${путь}`
  let свои
  try {
    /* Свои имена — из ОДИНОЧНОГО разбора: связанная программа не помнит, что в
       ней откуда, а нам нужно ровно то, что объявлено здесь. */
    свои = собственные(parse(readFileSync(полный, "utf8"), путь))
  } catch (беда) {
    return { путь, ведомость: null, беда: `разбор: ${беда?.message ?? String(беда)}` }
  }
  let программа
  try {
    программа = await loadProgram(полный)
  } catch (беда) {
    return { путь, ведомость: null, беда: `загрузка: ${беда?.message ?? String(беда)}` }
  }
  const внешнее = await externalChecks(программа)
  const отказы = внешнее.diagnostics.filter((беда) => беда?.severity !== "warning")
  if (отказы.length > 0) {
    return { путь, ведомость: null, беда: `проверка: ${отказы[0].message}` }
  }
  return { путь, ведомость: сузить(proofLedger(программа, внешнее.results), свои), беда: null }
}

/** Имена, объявленные в самом файле: функции и все четыре вида законов. */
function собственные(программа) {
  const имена = (список, поле) =>
    new Set((Array.isArray(список) ? список : []).map((узел) => узел?.[поле]).filter((имя) => typeof имя === "string"))
  return {
    функции: имена(программа?.functions, "name"),
    законы: new Set([
      ...имена(программа?.monoids, "name"),
      ...имена(программа?.monads, "name"),
      ...имена(программа?.isomorphisms, "name"),
      ...имена(программа?.embeddings, "name"),
      ...имена(программа?.intersections, "name"),
    ]),
  }
}

/**
 * Ведомость связанной программы, суженная до своих объявлений.
 *
 * Итоги пересчитываются, а не режутся: сумма по суженным строкам — это и есть
 * итог файла, а взять его из полной ведомости значило бы посчитать чужое.
 */
function сузить(ведомость, свои) {
  const суженная = {
    ...ведомость,
    functions: ведомость.functions.filter((строка) => свои.функции.has(строка.name)),
    laws: ведомость.laws.filter((закон) => свои.законы.has(закон.name)),
    assumed: ведомость.assumed.filter((запись) => свои.законы.has(запись.name)),
  }
  return { ...суженная, totals: сложить([{ ведомость: суженная }]) }
}

/** Свод итогов по любому набору ведомостей — тем же счётом, что в одной. */
function сложить(записи) {
  const итог = {
    functions: 0,
    total: 0,
    ordinary: 0,
    carriers: { composition: 0, structure: 0, exact: 0, step: 0, measure: 0 },
    unaccounted: 0,
    guardSites: 0,
    laws: { grid: 0, assumed: 0, gridValues: 0, gridPoints: 0 },
  }
  for (const { ведомость } of записи) {
    if (ведомость === null) continue
    for (const строка of ведомость.functions) {
      итог.functions += 1
      if (строка.total !== true) {
        итог.ordinary += 1
        continue
      }
      итог.total += 1
      итог.guardSites += строка.guardSites
      if (строка.carrier === null) итог.unaccounted += 1
      else итог.carriers[строка.carrier] += 1
    }
    for (const закон of ведомость.laws) {
      итог.laws.grid += 1
      итог.laws.gridValues += закон.grid?.values ?? 0
      итог.laws.gridPoints += закон.grid?.points ?? 0
    }
    итог.laws.assumed += ведомость.assumed.length
  }
  return итог
}

/**
 * Свод по всему корпусу.
 *
 * @returns {Promise<{файлы: object[], итог: object, отказы: object[]}>}
 */
export async function сводКорпуса() {
  const файлы = []
  for (const путь of ФАЙЛЫ) файлы.push(await ведомостьФайла(путь))
  return {
    файлы,
    итог: сложить(файлы),
    /* Файл, о котором ведомости нет, называется отдельно и по имени. Тихо
       пропущенный файл — это охват, который меняется молча, и число, которое
       нельзя перепроверить (та же беда, что у корпуса моделей ядра). */
    отказы: файлы.filter((запись) => запись.ведомость === null),
  }
}

function печать(свод, поФайлам) {
  const и = свод.итог
  const строки = ["── свод ведомости доказательства по корпусу ──"]
  if (поФайлам) {
    for (const запись of свод.файлы) {
      if (запись.ведомость === null) {
        строки.push(`  ${запись.путь}: ведомости нет — ${запись.беда}`)
        continue
      }
      const ф = сложить([запись])
      строки.push(
        `  ${запись.путь}: функций ${ф.functions}, тотальных ${ф.total} `
          + `(композиция ${ф.carriers.composition}, структура ${ф.carriers.structure}, `
          + `точный шаг ${ф.carriers.exact}, шаг ${ф.carriers.step}, мера ${ф.carriers.measure}), сторожей ${ф.guardSites}, `
          + `законов на сетке ${ф.laws.grid}, на веру ${ф.laws.assumed}`,
      )
    }
    строки.push("")
  }
  строки.push(
    `файлов в корпусе: ${свод.файлы.length}, из них с ведомостью: ${свод.файлы.length - свод.отказы.length}`,
    `функций: ${и.functions} — тотальных ${и.total}, обычных ${и.ordinary}`,
    `чем несётся обещание «тотальная» (доказано — про ВСЕ входы):`,
    `  композицией (рекурсии нет):        ${и.carriers.composition}`,
    `  структурой (часть значения):       ${и.carriers.structure}`,
    `  точным шагом (нат/целое, без сторожа): ${и.carriers.exact}`,
    `  постоянным шагом (число + сторож): ${и.carriers.step}`,
    `  объявленной мерой (+ сторож):      ${и.carriers.measure}`,
    `сторожей в рантайме: ${и.guardSites} мест у ${и.carriers.step + и.carriers.measure} функций`,
    `законы (сетка конечна, доказательством не является):`,
    `  на сетке: ${и.laws.grid}, значений в сетках ${и.laws.gridValues}, троек ${и.laws.gridPoints}`,
    `  на веру:  ${и.laws.assumed}`,
  )
  if (и.unaccounted > 0) строки.push(`РАСХОЖДЕНИЕ: носитель не назван у ${и.unaccounted} тотальных функций`)
  for (const запись of свод.отказы) строки.push(`без ведомости: ${запись.путь} — ${запись.беда}`)
  return `${строки.join("\n")}\n`
}

/* Сравниваются РАЗРЕШЁННЫЕ пути, а не строки, — по той же причине, что в
   `flang/bin/flang.mjs`: npm ставит команды символьными ссылками, и путь ссылки с
   путём файла не совпадает. Сравнение строк дало бы ложь, свод не запустился бы и
   вышел с кодом 0, не напечатав ни байта. */
let запущен = false
if (process.argv[1] !== undefined) {
  try {
    запущен = realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
  } catch {
    запущен = false
  }
}
if (запущен) {
  const свод = await сводКорпуса()
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({ итог: свод.итог, отказы: свод.отказы.map((з) => ({ путь: з.путь, беда: з.беда })) }, null, 2)}\n`)
  } else {
    process.stdout.write(печать(свод, process.argv.includes("--files")))
  }
  process.exitCode = свод.итог.unaccounted === 0 ? 0 : 1
}
