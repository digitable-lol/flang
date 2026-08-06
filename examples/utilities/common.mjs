/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { assertValid, compile } from "../../dist/src/index.js"

export async function loadDocument(file) {
  if (!file) throw new Error("укажите путь к .fts файлу")
  return assertValid(compile(await readFile(resolve(file), "utf8")))
}

export async function loadJson(file) {
  if (!file) throw new Error("укажите путь к JSON-контексту")
  return JSON.parse(await readFile(resolve(file), "utf8"))
}

export function findStructure(document, name) {
  const structure = document.structures.find((item) => item.name === name)
  if (!structure) throw new Error(`структура '${name}' не найдена`)
  return structure
}

export function label(identifier) {
  const spaced = identifier
    .replace(/_/g, " ")
    .replace(/([\p{Ll}\p{Nd}])(\p{Lu})/gu, "$1 $2")
  return spaced.charAt(0).toLocaleUpperCase("ru-RU") + spaced.slice(1)
}

export function write(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

export function fail(error) {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`)
  process.exitCode = 1
}
