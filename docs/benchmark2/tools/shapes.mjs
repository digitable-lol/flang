/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/* Какой формой написано тело каждой из двадцати и что о ней утверждается. */
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const КОРЕНЬ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const { parse } = await import(join(КОРЕНЬ, "flang/src/parser.mjs"))

const каталог = process.argv[2] ?? join(КОРЕНЬ, "docs/benchmark2")
for (const ф of readdirSync(каталог).filter((f) => f.endsWith(".flang")).sort()) {
  const ast = parse(readFileSync(join(каталог, ф), "utf8"), ф)
  const главная = ast.functions.filter((f) => (f.postconditions ?? []).length > 0)
  for (const fn of главная) {
    const тело = Array.isArray(fn.body) ? fn.body[fn.body.length - 1] : fn.body
    console.log(`${ф}  «${fn.name}»`)
    console.log(`   тело: ${тело?.kind}${тело?.kind === "match" ? ` по ${тело.target?.name ?? "?"}` : ""}`)
    if (тело?.kind === "fold") {
      console.log(`   свёртка по ${JSON.stringify(тело.over?.name ?? тело.over?.kind)} нач=${JSON.stringify(тело.init)} акк=${тело.acc} эл=${тело.item}`)
      console.log(`   шаг: ${JSON.stringify(тело.body)}`)
    }
    for (const п of fn.postconditions ?? []) {
      console.log(`   пост «${п.name}» forall=${п.param ?? п.forall ?? "?"} bind=${п.bind ?? "результат"}`)
      console.log(`      цель: ${JSON.stringify(п.expr ?? п.goal)}`)
    }
    console.log()
  }
}
