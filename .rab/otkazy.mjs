/* Полные отказы ядра по каждому из двадцати файлов замера. */
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), "..")
const { parse } = await import(join(КОРЕНЬ, "flang/src/parser.mjs"))
const { checkTypes } = await import(join(КОРЕНЬ, "flang/src/types.mjs"))
const { checkTotality } = await import(join(КОРЕНЬ, "flang/src/totality.mjs"))
const { obligations } = await import(join(КОРЕНЬ, "flang/src/obligations.mjs"))
const { checkProofs } = await import(join(КОРЕНЬ, "flang/src/proofterm.mjs"))

const каталог = process.argv[2] ?? join(КОРЕНЬ, "docs/zamer2")
const отбор = process.argv[3] ?? ""
for (const ф of readdirSync(каталог).filter((f) => f.endsWith(".flang")).sort()) {
  if (отбор !== "" && !ф.startsWith(отбор)) continue
  const program = parse(readFileSync(join(каталог, ф), "utf8"), ф)
  const results = {}
  try { results.types = checkTypes(program) } catch { /**/ }
  try { results.totality = checkTotality(program) } catch { /**/ }
  const итог = obligations(program, results)
  const в = checkProofs(program, итог.obligations)
  console.log("===== " + ф)
  for (const к of в.checked) console.log(`  [${к.verdict}] «${к.name}»: ${к.says}`)
  for (const д of в.diagnostics) console.log(`  ! ${д.code}: ${д.message}`)
  console.log()
}
