/* Разложение отказов по коду — до и после, одним прогоном. */
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), "..")
const { parse } = await import(join(КОРЕНЬ, "flang/src/parser.mjs"))
const { checkTypes } = await import(join(КОРЕНЬ, "flang/src/types.mjs"))
const { checkTotality } = await import(join(КОРЕНЬ, "flang/src/totality.mjs"))
const { obligations } = await import(join(КОРЕНЬ, "flang/src/obligations.mjs"))
const { checkProofs } = await import(join(КОРЕНЬ, "flang/src/proofterm.mjs"))

const каталог = join(КОРЕНЬ, "docs/zamer2")
const счёт = {}
const поФайлам = {}
let доказано = 0
let всего = 0
for (const ф of readdirSync(каталог).filter((f) => f.endsWith(".flang")).sort()) {
  const program = parse(readFileSync(join(каталог, ф), "utf8"), ф)
  const results = {}
  try { results.types = checkTypes(program) } catch { /**/ }
  try { results.totality = checkTotality(program) } catch { /**/ }
  const итог = obligations(program, results)
  const в = checkProofs(program, итог.obligations)
  for (const о of итог.obligations.filter((о) => о.kind === "postcondition")) {
    всего += 1
    const к = в.checked.find((з) => з.id === о.id)
    if (к?.verdict === "доказано") { доказано += 1; continue }
    const код = в.diagnostics.find((д) => (д.message ?? "").includes(`«${о.name}»`))?.code
      ?? (к === undefined ? "НЕТ ТЕОРЕМЫ, ЯДРО НЕ ВЗЯЛО" : "ОТВЕРГНУТО")
    счёт[код] = (счёт[код] ?? 0) + 1
    ;(поФайлам[код] ??= []).push(`${ф.slice(0, 2)} «${о.name}»`)
  }
}
console.log(`доказано ${доказано} из ${всего}`)
for (const [к, н] of Object.entries(счёт).sort((а, б) => б[1] - а[1])) {
  console.log(`  ${к}: ${н}`)
  console.log(`      ${поФайлам[к].join("; ")}`)
}
