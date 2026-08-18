/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/* Сколько тел библиотеки ядро теперь умеет читать: `разбор` по параметру ИЛИ
   `свёртка` по параметру. Тело нормализуется — `пусть` перед формой это запись. */
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const { parse } = await import(join(КОРЕНЬ, "flang/src/parser.mjs"))
const { нормализовать } = await import(join(КОРЕНЬ, "flang/proof/reduce.mjs"))
const каталог = join(КОРЕНЬ, "flang/stdlib")

const счёт = {}
let всего = 0
let читаемых = 0
for (const ф of readdirSync(каталог).filter((f) => f.endsWith(".flang")).sort()) {
  const ast = parse(readFileSync(join(каталог, ф), "utf8"), ф)
  for (const fn of ast.functions) {
    всего += 1
    const имена = new Set((fn.params ?? []).map((п) => п.name))
    const сырое = Array.isArray(fn.body) ? fn.body[fn.body.length - 1] : fn.body
    const тело = нормализовать(сырое)
    const разбором = тело?.kind === "match" && имена.has(тело.target?.name ?? "")
    const свёрткой = тело?.kind === "fold" && имена.has(тело.over?.name ?? "")
    const ключ = разбором ? "разбор по параметру" : свёрткой ? "свёртка по параметру" : (тело?.kind ?? "?")
    счёт[ключ] = (счёт[ключ] ?? 0) + 1
    if (разбором || свёрткой) читаемых += 1
  }
}
console.log(`функций в flang/stdlib: ${всего}`)
console.log(`тел, с которых ядро СТРОИТ посылки: ${читаемых}`)
for (const [к, н] of Object.entries(счёт).sort((а, б) => б[1] - а[1])) console.log(`   ${к}: ${н}`)
