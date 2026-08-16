import { readFileSync } from "node:fs"
const КОРЕНЬ = "/home/a/projects/flang/.claude/worktrees/agent-a4daa59c6b3b8bbfc"
const { parse } = await import(КОРЕНЬ + "/flang/src/parser.mjs")
const ast = parse(readFileSync(КОРЕНЬ + "/flang/stdlib/dictionary.flang", "utf8"), "dictionary.flang")
console.log("тип:", JSON.stringify(ast.types[0].span), Object.keys(ast.types[0]))
for (const ф of ast.functions.slice(0, 3)) console.log(ф.name, JSON.stringify(ф.span))
