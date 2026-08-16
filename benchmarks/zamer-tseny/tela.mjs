/* Чем написаны тела функций stdlib: `разбор` по параметру (единственная форма,
   с которой ядро строит заключение посылки индукции) — или чем-то ещё. */
import { readFileSync, readdirSync } from "node:fs"
const КОРЕНЬ = "/home/a/projects/flang/.claude/worktrees/agent-a4daa59c6b3b8bbfc"
const { parse } = await import(КОРЕНЬ + "/flang/src/parser.mjs")
const dir = КОРЕНЬ + "/flang/stdlib"
const счёт = {}
const двадцать = new Set([
  "Ключ связи", "Ключ звена", "Вписать", "Размер словаря", "Противоположное",
  "Приписать в начало", "Вставить по", "Максимум", "Взять первые", "Двоичный поиск",
  "Уникальные", "Следует", "Чётное", "Дерево из чисел", "Первый элемент или запасное",
  "Успешно", "Есть в множестве", "Приписать строку в начало", "Строчная буква",
  "Обрезать пробелы",
])
const счёт20 = {}
for (const f of readdirSync(dir).filter((f) => f.endsWith(".flang")).sort()) {
  const ast = parse(readFileSync(dir + "/" + f, "utf8"), f)
  for (const ф of ast.functions) {
    const тело = Array.isArray(ф.body) ? ф.body[ф.body.length - 1] : ф.body
    const вид = тело?.kind ?? "?"
    const имена = new Set((ф.params ?? []).map((п) => п.name))
    const поПараметру = вид === "match" && имена.has(тело.target?.name ?? "")
    const ключ = вид === "match" ? (поПараметру ? "разбор ПО ПАРАМЕТРУ" : "разбор по чему-то ещё") : вид
    счёт[ключ] = (счёт[ключ] ?? 0) + 1
    if (двадцать.has(ф.name)) счёт20[ключ] = (счёт20[ключ] ?? 0) + 1
  }
}
console.log("вся stdlib (208 функций):")
for (const [к, н] of Object.entries(счёт).sort((а, б) => б[1] - а[1])) console.log("  ", к, н)
console.log("двадцать замера:")
for (const [к, н] of Object.entries(счёт20).sort((а, б) => б[1] - а[1])) console.log("  ", к, н)
