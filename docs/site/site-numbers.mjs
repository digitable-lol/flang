#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Сторож чисел на СОБСТВЕННЫХ страницах сайта.
 *
 *   node docs/site/site-numbers.mjs           напечатать измеренное
 *   node docs/site/site-numbers.mjs --check    сверить страницы с измерителем
 *
 * ── Зачем ещё один сторож ───────────────────────────────────────────────────
 * `flang/scripts/count-guard.mjs` сторожит «N строк рядом с путём» и ведомость
 * доказательств в `docs/overview.ru.md`. Числа `docs/site/*.md` он не видит по
 * двум причинам, и обе — не его вина:
 *
 *   · порядок слов. Правило ведомости ищет «высказано N утверждений», а на
 *     главной стоит таблицей: «| Утверждений о поведении высказано | 138 |».
 *     Число ПОСЛЕ слов, и регэксп молчит;
 *   · целей печати он не считает вовсе — измерителя у этого числа не было.
 *
 * Цена молчания измерена: на 17 августа 2026 главная страница сайта врала
 * шестью числами разом (6429/4893/138/111 вместо 6433/4897/142/115), а число
 * целей печати называла семью при восьми — и называла его в заголовке.
 *
 * ── Что здесь меряется ──────────────────────────────────────────────────────
 * Цели печати — по каталогу `flang/src/emit/`, близнецы на flang — по
 * `flang/self/emit-*.flang`. Ведомость — `flang/scripts/proof-ledger.mjs`, тот
 * же измеритель, что у `count-guard`, чтобы два числа не разъехались.
 *
 * Приём сверки тот же, что у `readme-layout.test.mjs`: фраза СОБИРАЕТСЯ из
 * измеренного и обязана найтись в странице буква в букву. Регэксп по числу
 * молчит, когда число со страницы убрали; собранная фраза — нет.
 */
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { сводКорпуса } from "../../flang/scripts/proof-ledger.mjs"

const КОРЕНЬ = fileURLToPath(new URL("../../", import.meta.url))
const прочесть = (путь) => readFileSync(КОРЕНЬ + путь, "utf8")

/* ── Измерители ──────────────────────────────────────────────────────────── */

/** Цели печати — по каталогу бэкендов, а не по списку в прозе. */
export function цели() {
  const все = readdirSync(КОРЕНЬ + "flang/src/emit")
    .filter((ф) => ф.endsWith(".mjs"))
    .map((ф) => ф.replace(/\.mjs$/u, ""))
    .sort()
  const близнецы = readdirSync(КОРЕНЬ + "flang/self")
    .filter((ф) => /^emit-.+\.flang$/u.test(ф))
    .map((ф) => ф.replace(/^emit-|\.flang$/gu, ""))
    .sort()
  return { все, близнецы, безБлизнеца: все.filter((ц) => !близнецы.includes(ц)) }
}

/** Функций в `flang/stdlib` — по объявлениям, а не по памяти. */
export function функцийВБиблиотеке() {
  let н = 0
  for (const ф of readdirSync(КОРЕНЬ + "flang/stdlib")) {
    if (!ф.endsWith(".flang")) continue
    н += (prochest(ф).match(/^\s*(?:тотальная функция|функция)\s/gmu) ?? []).length
  }
  return н
  function prochest(ф) {
    return readFileSync(`${КОРЕНЬ}flang/stdlib/${ф}`, "utf8")
  }
}

/* ── Что каждая страница обязана содержать ───────────────────────────────── */

export async function ожидания() {
  const ц = цели()
  const и = (await сводКорпуса()).итог
  const библиотека = функцийВБиблиотеке()
  const списокЦелей = ц.все.map((т) => `\`${т}\``).join(", ")

  return [
    // ── docs/site/index.md ──
    ["docs/site/index.md", "целей печати", `печатается в ${словом(ц.все.length)} языков`],
    ["docs/site/index.md", "тотальных из корпуса", `**${и.total} функций из ${и.functions}** его несут`],
    ["docs/site/index.md", "функций в корпусе", `| Функций в корпусе | ${и.functions} |`],
    [
      "docs/site/index.md",
      "тотальных таблицей",
      `| Из них тотальных (завершаемость доказана) | ${и.total} |`,
    ],
    [
      "docs/site/index.md",
      "утверждений высказано",
      `| Утверждений о поведении высказано | ${и.claims.total} |`,
    ],
    [
      "docs/site/index.md",
      "доказано ядром",
      `| Из них **доказано ядром** — про все входы | ${и.claims.proved} |`,
    ],
    ["docs/site/index.md", "функций библиотеки", `из всех ${библиотека}, чтобы не выбирать удобные`],
    [
      "docs/site/index.md",
      "генераторов на flang",
      `${словом(ц.близнецы.length)} генераторов кода из ${изСловом(ц.все.length)} — тоже да`,
    ],

    // ── docs/site/getting-started.md ──
    ["docs/site/getting-started.md", "целей печати списком", `Целей ${словом(ц.все.length)}: ${списокЦелей}.`],

    // ── docs/site/proofs.md ──
    [
      "docs/site/proofs.md",
      "композицией",
      `| Композицией — рекурсии нет вовсе | ${и.carriers.composition} |`,
    ],
    [
      "docs/site/proofs.md",
      "структурой",
      `| Структурой — обход части значения | ${и.carriers.structure} |`,
    ],
    [
      "docs/site/proofs.md",
      "точным шагом",
      `| Точным шагом по натуральному числу | ${и.carriers.exact} |`,
    ],
    [
      "docs/site/proofs.md",
      "постоянным шагом",
      `| Постоянным шагом с проверкой во время работы | ${и.carriers.step} |`,
    ],
    [
      "docs/site/proofs.md",
      "объявленной мерой",
      `| Объявленной мерой с проверкой во время работы | ${и.carriers.measure} |`,
    ],
    [
      "docs/site/proofs.md",
      "сторож меры",
      `**${и.guardSites} место у ${и.carriers.step + и.carriers.measure} функций**`,
    ],
    ["docs/site/proofs.md", "доказано из высказанного", `Таких **${и.claims.proved} из ${и.claims.total}**`],
    ["docs/site/proofs.md", "функций библиотеки", `**каждую девятую из всех ${библиотека}**`],
  ]
}

/**
 * Числа до десяти на сайте пишутся словом — так они и стоят в прозе, и сторож
 * обязан собирать фразу теми же словами, иначе он сторожит не то, что написано.
 */
function словом(н) {
  const слова = ["ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять"]
  return слова[н] ?? String(н)
}

/** Тот же счёт в родительном падеже: «семь генераторов из ВОСЬМИ». */
function изСловом(н) {
  const слова = ["нуля", "одного", "двух", "трёх", "четырёх", "пяти", "шести", "семи", "восьми", "девяти", "десяти"]
  return слова[н] ?? String(н)
}

const плоско = (текст) => текст.replace(/\s+/gu, " ")

export async function сверить() {
  const беды = []
  const кэш = new Map()
  for (const [файл, имя, фраза] of await ожидания()) {
    if (!кэш.has(файл)) кэш.set(файл, плоско(прочесть(файл)))
    if (!кэш.get(файл).includes(плоско(фраза))) беды.push(`${файл} — ${имя}: нет фразы «${фраза}»`)
  }
  // Ни одна страница сайта не вправе называть цели печати семью: их восемь.
  const ц = цели()
  for (const файл of ["docs/site/index.md", "docs/site/getting-started.md", "docs/site/proofs.md"]) {
    const текст = прочесть(файл)
    const врёт = /печата[а-я]*\s+(?:во?\s+)?сем[ьи]\s+(?:язык|цел)/iu.exec(текст)
    if (врёт) беды.push(`${файл}: «${врёт[0]}» — целей печати ${ц.все.length}, а не семь`)
  }
  return беды
}

/* ── Запуск ──────────────────────────────────────────────────────────────── */

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const беды = await сверить()
    if (беды.length) {
      console.error("Числа сайта ОТКАЗЫВАЮТ — проза разошлась с измерителем:")
      for (const б of беды) console.error("  · " + б)
      console.error(`\nвсего бед: ${беды.length}. Измерьте: node docs/site/site-numbers.mjs`)
      process.exit(1)
    }
    console.log(`числа сайта: чисто — ${(await ожидания()).length} чисел собственных страниц сошлись с измерителем.`)
    process.exit(0)
  }

  const ц = цели()
  const и = (await сводКорпуса()).итог
  console.log(`целей печати:        ${ц.все.length} — ${ц.все.join(", ")}`)
  console.log(`из них с близнецом:  ${ц.близнецы.length} — без близнеца: ${ц.безБлизнеца.join(", ") || "нет"}`)
  console.log(`функций в корпусе:   ${и.functions}, тотальных ${и.total}`)
  console.log(`утверждений:         высказано ${и.claims.total}, доказано ядром ${и.claims.proved}`)
  console.log(`                     сеткой ${и.claims.grid}, отвергнуто ядром ${и.claims.refused ?? 0}`)
  console.log(`носители обещания:   композиция ${и.carriers.composition}, структура ${и.carriers.structure},`)
  console.log(`                     точный шаг ${и.carriers.exact}, постоянный ${и.carriers.step}, мера ${и.carriers.measure}`)
  console.log(`сторож меры:         ${и.guardSites} мест у ${и.carriers.step + и.carriers.measure} функций`)
  console.log(`функций в stdlib:    ${функцийВБиблиотеке()}`)
}
