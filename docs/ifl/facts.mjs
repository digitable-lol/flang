/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Числа о самоприменении, которые попадают в подачу на IFL.
 *
 * Считается ровно то и ровно так, как это делает `flang/test/self-bootstrap.test.mjs`:
 * тот же вход (`flang/self/bootstrap/compiler.flang`), то же связывание
 * (`src/link.mjs`), те же настройки печати (строка 335 того теста). Иначе числа
 * в статье и числа в проверке разошлись бы, и обе стороны были бы бесполезны.
 *
 * Запуск: node docs/ifl/facts.mjs   (из корня репозитория; ставить и собирать нечего)
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { emitC } from "../../flang/src/emit/c.mjs"
import { linkProgram } from "../../flang/src/link.mjs"
import { parse } from "../../flang/src/parser.mjs"
import { checkTotality, markMeasureGuards } from "../../flang/src/totality.mjs"
import { checkTypes } from "../../flang/src/types.mjs"
import { globSync } from "../../flang/test/glob.mjs"

const корень = fileURLToPath(new URL("../..", import.meta.url))
const ВХОД = "flang/self/bootstrap/compiler.flang"

/* Те же настройки, что у сверки: с прогонщиком и оболочкой — иначе бэкенд
   напечатает шесть файлов вместо семи, и «семь файлов» в статье повиснет. */
const ПРЕДЕЛЫ = { cli: true, repl: true, maxSteps: 40_000_000, maxDepth: 20_000 }

const исходник = readFileSync(join(корень, ВХОД), "utf8")
const { diagnostics, ...компилятор } = await linkProgram(join(корень, ВХОД), исходник, parse)

const тотальных = компилятор.functions.filter((ф) => ф.total).length
const сМерой = компилятор.functions.filter((ф) => ф.decreases != null).length
const тотальность = checkTotality(компилятор)

console.log("связывание, диагностик:            ", diagnostics.length)
console.log("функций в связанном компиляторе:   ", компилятор.functions.length)
console.log("  из них тотальных:                ", тотальных)
console.log("  из них обычных:                  ", компилятор.functions.length - тотальных)
console.log("  из них с объявленной мерой:      ", сМерой)
console.log("типов:                             ", компилятор.types.length)
console.log("проверка типов, диагностик:        ", checkTypes(компилятор).diagnostics.length)
console.log("завершаемость, диагностик:         ", тотальность.diagnostics.length)
console.log("завершаемость, спусков со сторожем:", тотальность.descents.length)

const напечатано = emitC(markMeasureGuards(компилятор), ПРЕДЕЛЫ)
const байт = напечатано.files.reduce((с, ф) => с + Buffer.byteLength(ф.content, "utf8"), 0)
console.log("напечатано файлов C:               ", напечатано.files.length)
console.log("напечатано байт C:                 ", байт, `(${(байт / 1024 / 1024).toFixed(2)} МиБ)`)
for (const ф of напечатано.files) {
  console.log("   ", ф.path.padEnd(24), Buffer.byteLength(ф.content, "utf8"))
}

/* Корпус — тот же список, что в тесте (`flang/test/self-bootstrap.test.mjs`,
   `const КОРПУС`). Число программ печатается, а не пишется словами: оно росло
   уже дважды, и оба раза документ отставал. */
const КОРПУС = [
  ...globSync("flang/stdlib/*.flang", { cwd: корень }),
  ...globSync("flang/examples/*.flang", { cwd: корень }),
  ...globSync("flang/examples/leetcode/*.flang", { cwd: корень }),
  "flang/core/json.flang",
  "flang/core/lexer.flang",
  "flang/core/parser.flang",
  "flang/core/evaluate.flang",
  "flang/self/lexer.flang",
  "flang/self/parser.flang",
].sort()
console.log("программ в корпусе побайтовой сверки:", КОРПУС.length)
