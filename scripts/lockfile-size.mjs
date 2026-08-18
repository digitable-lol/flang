/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * ЦЕНА ЗАМКА БЕЗ СКЛАДА — замер к `docs/lockfile-without-store.md`.
 *
 * Замок, в котором лежат сами зависимости, стоит места. Сколько именно — здесь
 * меряется, а не оценивается, и меряется на настоящих программах дерева.
 *
 * Отдельно меряется ЦЕНА ИМЁН. Самодостаточный адрес из
 * `docs/self-contained-address-length.md` считался по `нормализованные` —
 * форме, из которой имена ВЫЧЕРКНУТЫ. Для замка она не годится: связывание в
 * flang работает именами. Разница между двумя формами и есть то, чего стоит
 * «починить» потерю имён, и она называется числом.
 *
 * Запуск: `node scripts/lockfile-size.mjs`
 */
import { readFileSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { brotliCompressSync, constants } from "node:zlib"

import { безМест, собратьЗамок } from "../flang/src/lockfile.mjs"
import { адресаОпределений, каноническийJSON } from "../flang/src/digest.mjs"
import { importsOf } from "../flang/src/link.mjs"
import { parse } from "../flang/src/parser.mjs"

const КОРЕНЬ = new URL("..", import.meta.url).pathname
const сжать = (буфер) =>
  brotliCompressSync(буфер, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: буфер.length },
  })
const кб = (байт) => `${(байт / 1024).toFixed(1)} КБ`

/** Замыкание импортов — те самые файлы, которые замок обязан унести с собой. */
function зависимости(входной) {
  const вход = resolve(входной)
  const найдено = []
  const пройдено = new Set([вход])
  const очередь = []
  const поставить = (откуда, запись) => {
    const цель = resolve(dirname(откуда), запись.from)
    if (пройдено.has(цель)) return
    пройдено.add(цель)
    очередь.push(цель)
  }
  for (const запись of importsOf(parse(readFileSync(вход, "utf8"), вход))) поставить(вход, запись)
  while (очередь.length > 0) {
    const файл = очередь.shift()
    const дерево = parse(readFileSync(файл, "utf8"), файл)
    for (const запись of importsOf(дерево)) поставить(файл, запись)
    найдено.push({ файл, дерево })
  }
  return найдено
}

const ПРОГРАММЫ = [
  "flang/examples/web/orders-api.flang",
  "examples/library-api/lib/api.flang",
  "flang/examples/import-check.flang",
]

console.log(`${"═".repeat(78)}`)
console.log("РАЗМЕР ЗАМКА, В КОТОРОМ ЛЕЖАТ САМИ ЗАВИСИМОСТИ")
console.log(`${"═".repeat(78)}`)
console.log(
  "программа".padEnd(38) +
    "модулей".padStart(8) +
    "функций".padStart(9) +
    "исходники".padStart(11) +
    "замок".padStart(9) +
    "на функцию".padStart(12),
)

for (const путь of ПРОГРАММЫ) {
  const полный = `${КОРЕНЬ}${путь}`
  const замок = await собратьЗамок(полный, parse)
  const размерЗамка = Buffer.byteLength(`${JSON.stringify(замок)}\n`, "utf8")
  const зав = зависимости(полный)
  const исходники = зав.reduce((сумма, { файл }) => сумма + statSync(файл).size, 0)
  const функций = замок.модули.reduce((сумма, м) => сумма + м.функций, 0)
  console.log(
    путь.padEnd(38) +
      String(замок.модули.length).padStart(8) +
      String(функций).padStart(9) +
      кб(исходники).padStart(11) +
      кб(размерЗамка).padStart(9) +
      `${Math.round(размерЗамка / Math.max(функций, 1))} Б`.padStart(12),
  )
}

console.log(`\n${"═".repeat(78)}`)
console.log("ЦЕНА ИМЁН: адрес без имён против адреса с именами")
console.log(`${"═".repeat(78)}`)
console.log(
  "модуль".padEnd(30) +
    "функций".padStart(9) +
    "без имён".padStart(10) +
    "с именами".padStart(11) +
    "цена имён".padStart(11),
)

let всегоБез = 0
let всегоС = 0
let всегоФункций = 0
for (const путь of ["flang/stdlib/strings.flang", "flang/stdlib/dictionary.flang", "flang/stdlib/sets.flang"]) {
  const дерево = parse(readFileSync(`${КОРЕНЬ}${путь}`, "utf8"), путь)
  /* Форма замера самодостаточного адреса: имена вычеркнуты канонизатором. */
  const без = сжать(Buffer.from(каноническийJSON([...адресаОпределений(дерево).нормализованные.values()]), "utf8")).length
  /* Форма замка: сняты только позиции, имена целы. */
  const с = сжать(Buffer.from(JSON.stringify(безМест(дерево)), "utf8")).length
  const функций = (дерево.functions ?? []).length
  всегоБез += без
  всегоС += с
  всегоФункций += функций
  console.log(
    путь.replace("flang/stdlib/", "").padEnd(30) +
      String(функций).padStart(9) +
      `${без} Б`.padStart(10) +
      `${с} Б`.padStart(11) +
      `+${(((с - без) * 100) / без).toFixed(0)} %`.padStart(11),
  )
}
console.log(
  "итого".padEnd(30) +
    String(всегоФункций).padStart(9) +
    `${всегоБез} Б`.padStart(10) +
    `${всегоС} Б`.padStart(11) +
    `+${(((всегоС - всегоБез) * 100) / всегоБез).toFixed(0)} %`.padStart(11),
)
console.log(
  `\nимена стоят ${всегоС - всегоБез} байт на ${всегоФункций} функций — ` +
    `${Math.round((всегоС - всегоБез) / всегоФункций)} Б на функцию.`,
)
console.log("Без них модуль не связывается вовсе: `использует «Строки» только «Длина»` — про ИМЕНА.")

console.log(`\n${"═".repeat(78)}`)
console.log("ЧТО С ОБНОВЛЕНИЕМ: правка одной функции переписывает модуль целиком")
console.log(`${"═".repeat(78)}`)
{
  const путь = `${КОРЕНЬ}flang/stdlib/sets.flang`
  const было = readFileSync(путь, "utf8")
  /* Правка на один знак — в теле функции, а не в примечании. */
  const стало = было.replace("Размер множества", "Размер множеств")
  if (стало === было) throw new Error("подделка не сработала: имени в файле нет")
  const адрес = (текст) => сжать(Buffer.from(JSON.stringify(безМест(parse(текст, путь))), "utf8"))
  const прежний = адрес(было)
  const новый = адрес(стало)
  let одинаковых = 0
  for (let место = 0; место < Math.min(прежний.length, новый.length); место++) {
    if (прежний[место] !== новый[место]) break
    одинаковых++
  }
  console.log(`адрес модуля до правки:    ${прежний.length} Б`)
  console.log(`адрес модуля после правки: ${новый.length} Б`)
  console.log(`совпадающая приставка:     ${одинаковых} Б (${((100 * одинаковых) / прежний.length).toFixed(0)} % груза)`)
  console.log(
    "Переименована ОДНА функция — груз переписан почти целиком. Так и должно быть:\n" +
      "в замке лежит код, а не ссылка, и сжатие размазывает правку по всему потоку.",
  )
}
