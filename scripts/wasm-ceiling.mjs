#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/*
  Потолок памяти: на каком размере входа программа перестаёт помещаться в wasm.

  Вопрос не праздный. Область памяти рантайма не отдаёт ничего до конца вызова,
  поэтому расход растёт быстрее самой задачи: у сортировки вставками — кубически
  по числу элементов. У обычной сборки потолок — это память машины; у wasm32
  адресное пространство 32-битное, то есть 4 ГиБ в пределе и меньше на практике.
  Значит одна и та же программа упрётся в wasm РАНЬШЕ, и насколько раньше —
  число, а не мнение.

  Меряется на настоящей программе корпуса (`flang/stdlib/lists.flang`,
  «Сортировать» — сортировка вставками) на худшем входе: список, убывающий от N
  до 1. Для каждой стороны записывается исход (значение, честный отказ,
  падение), время и пик памяти: у обычной сборки — RSS, у wasm — размер линейной
  памяти модуля (RSS процесса мерил бы заодно и сам Node).

  Запуск:
    node scripts/wasm-ceiling.mjs
    node scripts/wasm-ceiling.mjs --n 100,250,500,1000,1500,2000
    node scripts/wasm-ceiling.mjs --stack 1048576
*/

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync, readFileSync, openSync, closeSync, statSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const { emitC } = await import(new URL("../flang/src/emit/c.mjs", import.meta.url).href)
const { parse } = await import(new URL("../flang/src/parser.mjs", import.meta.url).href)
const { markMeasureGuards } = await import(new URL("../flang/src/totality.mjs", import.meta.url).href)

const args = process.argv.slice(2)
const читать = (ключ, умолчание) => args.includes(ключ) ? args[args.indexOf(ключ) + 1] : умолчание
const размеры = читать("--n", "100,250,500,750,1000,1250,1500,2000,3000,4000")
  .split(",").map(Number).filter((n) => n > 0)
const stack = Number(читать("--stack", "1048576"))
const функция = читать("--fn", "Сортировать")
const исходник = читать("--file", "flang/stdlib/lists.flang")

const CFLAGS = ["-std=c99", "-Wall", "-Wextra", "-Werror", "-pedantic", "-O2"]
const workdir = mkdtempSync(join(tmpdir(), "flang-wasm-ceiling-"))
const runner = join(root, "scripts", "wasm-run.mjs")

/* ── сборка обеих сторон из одного напечатанного C ───────────────────────── */

const программа = markMeasureGuards(parse(readFileSync(join(root, исходник), "utf8"), исходник))
const emitted = emitC(программа, {})
mkdirSync(workdir, { recursive: true })
for (const file of emitted.files) writeFileSync(join(workdir, file.path), file.content, "utf8")
const sources = emitted.files.filter((f) => f.path.endsWith(".c")).map((f) => f.path)

const собрать = (cc, out, libs) => {
  execFileSync(cc[0], [...cc.slice(1), ...CFLAGS, ...sources, "-o", out, ...libs],
    { cwd: workdir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  return join(workdir, out)
}
const nativeCli = собрать(["cc"], "cli_native", ["-lm", "-lpthread"])
const wasmCli = собрать(["clang", "--target=wasm32-wasi"], "cli.wasm",
  ["-lm", `-Wl,-z,stack-size=${stack}`])

console.log(`программа: ${исходник}, функция «${функция}», стек wasm ${stack} байт`)
console.log(`обычный ${statSync(nativeCli).size} байт, wasm ${statSync(wasmCli).size} байт\n`)

/* ── прогон одной точки ──────────────────────────────────────────────────── */

/* Худший вход для вставки: список идёт вниз, каждый элемент едет до конца. */
const вход = (n) => ({
  fn: функция,
  args: [{ l: Array.from({ length: n }, (_, i) => ({ n: String(n - i) })) }],
  depth: "10000",
  steps: "1000000000",
})

function прогон(кто, кмд, арг, окружение, n) {
  const запрос = JSON.stringify(вход(n)) + "\n"
  const путьВыход = join(workdir, `out_${кто}`)
  const путьОшибки = join(workdir, `err_${кто}`)
  const fdO = openSync(путьВыход, "w")
  const fdE = openSync(путьОшибки, "w")
  const t0 = process.hrtime.bigint()
  let code = 0
  try {
    execFileSync("/usr/bin/time", ["-f", "RSS=%M", кмд, ...арг],
      { input: запрос, stdio: ["pipe", fdO, fdE], env: { ...process.env, ...окружение } })
  } catch (e) {
    code = e.status ?? -1
  }
  const сек = Number(process.hrtime.bigint() - t0) / 1e9
  closeSync(fdO); closeSync(fdE)
  const вывод = readFileSync(путьВыход, "utf8").trim()
  const ошибки = readFileSync(путьОшибки, "utf8")
  const rss = Number((ошибки.match(/RSS=(\d+)/) ?? [])[1] ?? 0) / 1024
  const линейная = Number((ошибки.match(/линейная память wasm: (\d+)/) ?? [])[1] ?? 0) / 1048576
  return { вывод, ошибки, code, сек, rss, линейная }
}

const исход = (р) => {
  if (р.вывод.startsWith('{"ok":true')) return `значение (${р.вывод.length} б)`
  const код = (р.вывод.match(/"code":"([A-Z_]+)"/) ?? [])[1]
  if (код) return `отказ ${код}`
  if (р.вывод.length === 0) {
    if (/out of bounds|RuntimeError|signature mismatch/.test(р.ошибки)) {
      return `ПАДЕНИЕ (${(р.ошибки.match(/(out of bounds|signature mismatch|unreachable)/) ?? [])[1] ?? "wasm"})`
    }
    return `пусто, код ${р.code}`
  }
  return р.вывод.slice(0, 40)
}

console.log("N\tобычный\t\t\tМиБ\tс\twasm\t\t\tМиБ лин.\tс\tсовпало")
for (const n of размеры) {
  const N = прогон("native", nativeCli, [], {}, n)
  const W = прогон("wasm", process.execPath, ["--no-warnings", runner, wasmCli],
    { LC_ALL: "C.UTF-8", FLANG_WASM_PAMYAT: "1" }, n)
  const совпало = N.вывод === W.вывод && N.code === W.code
  console.log([
    n,
    исход(N).padEnd(22),
    N.rss.toFixed(0),
    N.сек.toFixed(2),
    исход(W).padEnd(22),
    W.линейная.toFixed(0),
    W.сек.toFixed(2),
    совпало ? "да" : "НЕТ",
  ].join("\t"))
}

rmSync(workdir, { recursive: true, force: true })
