/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/* Замер: что из двадцати функций замера ядро принимает СЕЙЧАС.
   Считает per-постусловие, а не per-файл: отвергнутая теорема в файле не должна
   прятать вердикт соседнего утверждения. */
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const { parse } = await import(join(КОРЕНЬ, "flang/src/parser.mjs"))
const { checkTypes } = await import(join(КОРЕНЬ, "flang/src/types.mjs"))
const { checkTotality } = await import(join(КОРЕНЬ, "flang/src/totality.mjs"))
const { obligations } = await import(join(КОРЕНЬ, "flang/src/obligations.mjs"))
const { checkProofs } = await import(join(КОРЕНЬ, "flang/src/proofterm.mjs"))

const каталог = process.argv[2] ?? join(КОРЕНЬ, "docs/benchmark2")
const файлы = readdirSync(каталог).filter((ф) => ф.endsWith(".flang")).sort()

let доказано = 0
let всего = 0
const строки = []
for (const ф of файлы) {
  const путь = join(каталог, ф)
  let program
  try {
    program = parse(readFileSync(путь, "utf8"), ф)
  } catch (е) {
    строки.push([ф, "РАЗБОР", е.message.slice(0, 120)])
    continue
  }
  const results = {}
  try { results.types = checkTypes(program) } catch { /* нет — считаем без */ }
  try { results.totality = checkTotality(program) } catch { /* нет */ }
  let итог
  try { итог = obligations(program, results) } catch (е) {
    строки.push([ф, "ОБЯЗАТЕЛЬСТВА", е.message.slice(0, 120)])
    continue
  }
  const вердикты = checkProofs(program, итог.obligations)
  const пост = (итог.obligations ?? []).filter((о) => о.kind === "postcondition")
  if (пост.length === 0) { строки.push([ф, "—", "постусловий нет"]); continue }
  for (const о of пост) {
    всего += 1
    const в = вердикты.checked.find((к) => к.id === о.id)
    const вердикт = в?.verdict ?? "объявлено, не доказано"
    if (вердикт === "доказано") доказано += 1
    const почему = в?.says
      ?? (вердикты.diagnostics.find((д) => (д.message ?? "").includes(`«${о.name}»`))?.message ?? "теоремы нет, ядро не взяло")
    строки.push([ф, `${о.of} / «${о.name}»`, вердикт, почему.slice(0, 200)])
  }
}

for (const с of строки) {
  console.log(`${с[0]}\n    ${с[1]}\n    ${с[2]}\n    ${(с[3] ?? "").replace(/\s+/g, " ")}\n`)
}
console.log(`ИТОГ: доказано ${доказано} из ${всего} постусловий в ${файлы.length} файлах`)
