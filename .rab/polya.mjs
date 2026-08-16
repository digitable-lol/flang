import { readFileSync, readdirSync } from "node:fs"
const КОРЕНЬ = "/home/a/projects/flang/.claude/worktrees/agent-a4daa59c6b3b8bbfc"
const { parse } = await import(КОРЕНЬ + "/flang/src/parser.mjs")
const ast = parse(readFileSync(КОРЕНЬ + "/flang/stdlib/numbers.flang", "utf8"), "numbers.flang")
const ф = ast.functions.find((ф) => ф.name === "Чётное")
console.log(Object.keys(ф))
console.log(JSON.stringify(ф.ensures ?? ф.postconditions ?? ф.claims ?? null).slice(0, 400))
/* сколько функций stdlib имеют хоть одно постусловие / предусловие */
const dir = КОРЕНЬ + "/flang/stdlib"
let всего = 0, сПост = 0, сПред = 0
const имена = []
for (const f of readdirSync(dir).filter((f) => f.endsWith(".flang")).sort()) {
  const a = parse(readFileSync(dir + "/" + f, "utf8"), f)
  for (const g of a.functions) {
    всего++
    const п = (g.ensures ?? g.postconditions ?? g.claims ?? [])
    const т = (g.requires ?? g.preconditions ?? [])
    if (п.length) { сПост++; имена.push(f + ":" + g.name) }
    if (т.length) сПред++
  }
}
console.log("всего", всего, "с постусловием", сПост, "с предусловием", сПред)
console.log(имена.join("\n"))
