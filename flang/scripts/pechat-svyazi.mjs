/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Напечатать модули узла в цель JavaScript и положить результат рядом с
 * исходником: `flang/conc/svyaz.flang` → `flang/conc/svyaz.js`,
 * `flang/conc/planirovshchik.flang` → `flang/conc/planirovshchik.js`.
 *
 * Зачем это отдельным шагом, а не печатью при запуске: узел — работающая
 * программа, и печатать компилятором на старте значило бы ввозить в неё весь
 * компилятор. Ровно ту же цену уже посчитали у хозяина вкладки: 1 768 447 байт
 * против 102 675, потому что три ввезённых имени тянули за собой всё дерево.
 *
 * Напечатанное КОММИТИТСЯ, и это не небрежность: `flang/test/svyaz-pechat.test.mjs`
 * печатает заново и сверяет побайтово, поэтому разойтись с исходником файл не
 * может — он покраснеет раньше.
 *
 *   node flang/scripts/pechat-svyazi.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { emitJs } from "../src/emit/js.mjs"
import { linkProgram } from "../src/link.mjs"
import { parse } from "../src/parser.mjs"

const корень = fileURLToPath(new URL("../../", import.meta.url))
const ШАПКА = [
  "/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */",
  "/* SPDX-License-Identifier: BSD-2-Clause */",
].join("\n")
export const ИСХОДНИК = "flang/conc/svyaz.flang"
export const НАПЕЧАТАННОЕ = "flang/conc/svyaz.js"

/**
 * Модули узла, которые печатаются заранее. Два, и оба по одной причине: узел —
 * работающая программа, и звать компилятор на старте значило бы ввозить его
 * целиком.
 */
export const МОДУЛИ = Object.freeze([
  Object.freeze({ исходник: ИСХОДНИК, напечатанное: НАПЕЧАТАННОЕ }),
  Object.freeze({ исходник: "flang/conc/planirovshchik.flang", напечатанное: "flang/conc/planirovshchik.js" }),
])

/** Напечатать модуль связи в JavaScript. Возвращает содержимое файла. */
export async function напечататьСвязь() {
  return напечатать(ИСХОДНИК)
}

/** Напечатать один модуль узла в JavaScript. Возвращает содержимое файла. */
export async function напечатать(ИСХОДНИК) {
  const путь = корень + ИСХОДНИК
  const { diagnostics, ...программа } = await linkProgram(путь, readFileSync(путь, "utf8"), parse)
  const беды = (diagnostics ?? []).filter((это) => это.severity === "error")
  if (беды.length > 0) throw new Error(`«${ИСХОДНИК}» не собрался: ${беды[0].message}`)
  const напечатано = emitJs(программа)
  const модуль = напечатано.files.find((файл) => !файл.path.startsWith("flang_cli"))
  if (модуль === undefined) throw new Error("печать не отдала модуля")
  /* Лицензионная шапка дописывается ЗДЕСЬ, а не печатью. Печать её не ставит и
     ставить не должна: напечатанное принадлежит автору программы, и клеймить
     чужой код своей лицензией язык не вправе. Но ЭТОТ напечатанный файл лежит в
     нашем дереве и публикуется вместе с ним, значит разметка на нём наша. */
  return `${ШАПКА}\n${модуль.content}`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const модуль of МОДУЛИ) {
    const содержимое = await напечатать(модуль.исходник)
    writeFileSync(корень + модуль.напечатанное, содержимое, "utf8")
    console.log(`${модуль.напечатанное}: ${Buffer.byteLength(содержимое, "utf8")} байт`)
  }
}
