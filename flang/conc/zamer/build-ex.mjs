/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/** Печать стенда в Elixir и сборка elixirc. */
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const дов = new Map()
for (const кусок of process.argv.slice(2)) {
  const [имя, значение] = кусок.replace(/^--/, "").split("=")
  дов.set(имя, значение)
}
const корень = дов.get("root")
const исходник = дов.get("src")
const каталог = дов.get("dir")

const { parse } = await import(`${корень}/flang/src/parser.mjs`)
const { emitElixir } = await import(`${корень}/flang/src/emit/elixir.mjs`)

const программа = parse(readFileSync(исходник, "utf8"), "стенд.flang")
const напечатано = emitElixir(программа)
mkdirSync(каталог, { recursive: true })
for (const файл of напечатано.files) {
  mkdirSync(dirname(join(каталог, файл.path)), { recursive: true })
  writeFileSync(join(каталог, файл.path), файл.content, "utf8")
}
const исходники = напечатано.files.filter((ф) => ф.path.endsWith(".ex")).map((ф) => ф.path)
const модульФайл = исходники.find((путь) => !путь.startsWith("flang_"))
const текст = напечатано.files.find((ф) => ф.path === модульФайл).content
const модуль = текст.match(/^defmodule ([A-Za-z0-9_.]+) do$/mu)[1]
mkdirSync(join(каталог, "_build"), { recursive: true })
const начало = Date.now()
execFileSync("elixirc", ["--warnings-as-errors", "-o", "_build", ...исходники], {
  cwd: каталог,
  encoding: "utf8",
  env: { ...process.env, ELIXIR_ERL_OPTIONS: "+fnu" },
  maxBuffer: 256 * 1024 * 1024,
})
console.log(JSON.stringify({ модуль, elixircМс: Date.now() - начало, файлов: напечатано.files.length }))
