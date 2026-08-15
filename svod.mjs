import { сводКорпуса, ФАЙЛЫ } from "./flang/scripts/proof-ledger.mjs"
const свод = await сводКорпуса()
const и = свод.итог
console.log(JSON.stringify({
  файлов: ФАЙЛЫ.length, отказы: свод.отказы.length,
  functions: и.functions, total: и.total, ordinary: и.ordinary,
  carriers: и.carriers, guardSites: и.guardSites, unaccounted: и.unaccounted,
  partialSites: и.partialSites, partialFunctions: и.partialFunctions, partialTotal: и.partialTotal,
  noRuntimeCheck: и.noRuntimeCheck, noRuntimeCheckDeep: и.noRuntimeCheckDeep,
  claims: и.claims, laws: и.laws,
}, null, 1))
