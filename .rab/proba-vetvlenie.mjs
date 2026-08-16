/* Проба пятого хода: цель «Следует» без теоремы. */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), "..")
const { parse } = await import(join(КОРЕНЬ, "flang/src/parser.mjs"))
const { свести } = await import(join(КОРЕНЬ, "flang/proof/reduce.mjs"))
const { подставить } = await import(join(КОРЕНЬ, "flang/proof/initial.mjs"))

const исходник = readFileSync(join(КОРЕНЬ, "docs/zamer2/12-sleduet.flang"), "utf8")
const program = parse(исходник, "12")
const fn = program.functions.find((ф) => ф.name === "Следует")
const пост = fn.postconditions[0]
const цель = подставить(пост.expr, { результат: fn.body })
const итог = свести(цель, [], (fn.params ?? []).map((п) => ({ name: п.name, type: п.type ?? null })), new Map(program.functions.map((ф) => [ф.name, ф])))
console.log(JSON.stringify(итог, null, 1).slice(0, 1200))
