/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * ЦЕНА ЗАМКА БЕЗ СКЛАДА — замер к `docs/lockfile-without-store.md`.
 *
 * Замок, в котором лежат сами зависимости, стоит места. Сколько именно — здесь
 * меряется, а не оценивается, и меряется на настоящих программах дерева.
 *
 * С 19 августа 2026 замок схемы 2: сжатия в формате нет вовсе, груз — исходник
 * модуля, адрес — sha256 по нему (довод целиком — в шапке
 * `flang/src/lockfile.mjs`). Поэтому здесь меряется ровно то, чем за это
 * заплачено:
 *
 *   1. РАЗМЕР ЗАМКА на настоящих программах;
 *   2. ЧЕГО СТОИЛ ОТКАЗ ОТ СЖАТИЯ — тот же замок против самого себя, если бы
 *      груз жали. Число берётся через `zlib`, но НЕ форматом, а мерилом:
 *      сжатия в замке нет, и жмётся здесь готовый файл целиком — ровно так,
 *      как это делает git со своими объектами;
 *   3. СКОЛЬКО ЗАМОК ЗАНИМАЕТ В GIT — то есть сколько за него платят на самом
 *      деле, а не на глаз по размеру файла.
 *
 * Запуск: `node scripts/lockfile-size.mjs`
 */
import { deflateSync, gzipSync } from "node:zlib"
import { readFileSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"

import { собратьЗамок } from "../flang/src/lockfile.mjs"
import { importsOf } from "../flang/src/link.mjs"
import { parse } from "../flang/src/parser.mjs"

const КОРЕНЬ = new URL("..", import.meta.url).pathname
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

console.log(`${"═".repeat(84)}`)
console.log("РАЗМЕР ЗАМКА СХЕМЫ 2 — груз исходником, сжатия в формате нет")
console.log(`${"═".repeat(84)}`)
console.log(
  "программа".padEnd(38) +
    "модулей".padStart(8) +
    "функций".padStart(9) +
    "исходники".padStart(11) +
    "замок".padStart(9) +
    "на функцию".padStart(12),
)

const замки = []
for (const путь of ПРОГРАММЫ) {
  const полный = `${КОРЕНЬ}${путь}`
  const замок = await собратьЗамок(полный, parse)
  const текст = `${JSON.stringify(замок)}\n`
  const размерЗамка = Buffer.byteLength(текст, "utf8")
  const зав = зависимости(полный)
  const исходники = зав.reduce((сумма, { файл }) => сумма + statSync(файл).size, 0)
  const функций = замок.модули.reduce((сумма, м) => сумма + м.функций, 0)
  замки.push({ путь, текст, размерЗамка, исходники, функций, модулей: замок.модули.length })
  console.log(
    путь.padEnd(38) +
      String(замок.модули.length).padStart(8) +
      String(функций).padStart(9) +
      кб(исходники).padStart(11) +
      кб(размерЗамка).padStart(9) +
      `${Math.round(размерЗамка / Math.max(функций, 1))} Б`.padStart(12),
  )
}

console.log(
  "\nЗамок больше своих исходников на 2—3 %: экранирование JSON в тексте на flang\n" +
    "почти ничего не стоит (кавычек мало), а сверх груза лежат только имя, путь,\n" +
    "число функций и адрес каждого модуля. Порядок величины у замка тот же, что у\n" +
    "кода, который в нём лежит, и иначе быть не может.",
)

console.log(`\n${"═".repeat(84)}`)
console.log("ЧЕГО СТОИЛ ОТКАЗ ОТ СЖАТИЯ — и кому за это платить")
console.log(`${"═".repeat(84)}`)
console.log(
  "программа".padEnd(38) + "замок".padStart(10) + "в git (zlib)".padStart(14) + "gzip".padStart(9) + "доля".padStart(8),
)
for (const з of замки) {
  const вGit = deflateSync(Buffer.from(з.текст, "utf8"), { level: 9 }).length
  const вGzip = gzipSync(Buffer.from(з.текст, "utf8"), { level: 9 }).length
  console.log(
    з.путь.padEnd(38) +
      кб(з.размерЗамка).padStart(10) +
      кб(вGit).padStart(14) +
      кб(вGzip).padStart(9) +
      `${((100 * вGit) / з.размерЗамка).toFixed(0)} %`.padStart(8),
  )
}
console.log(
  "\nНа диске замок большой, в репозитории — нет: git держит объекты сжатыми zlib\n" +
    "и делает это сам. То есть сжатие никуда не делось — оно ушло из доверенного\n" +
    "основания туда, где уже было. Именно этим и заплачено за уход brotli: не\n" +
    "местом в репозитории, а местом в рабочем каталоге.",
)
