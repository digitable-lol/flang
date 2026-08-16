import { readFileSync } from "node:fs"
const КОРЕНЬ = "/home/a/projects/flang/.claude/worktrees/agent-a4daa59c6b3b8bbfc"
const { parse } = await import(КОРЕНЬ + "/flang/src/parser.mjs")
const ast = parse(readFileSync(КОРЕНЬ + "/flang/stdlib/dictionary.flang", "utf8"), "d.flang")
const ф = ast.functions.find((ф) => ф.name === "Ключ связи")
const тело = Array.isArray(ф.body) ? ф.body[ф.body.length - 1] : ф.body
console.log(Object.keys(тело), JSON.stringify(тело).slice(0, 200))
