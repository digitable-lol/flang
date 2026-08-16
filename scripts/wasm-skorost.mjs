#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/*
  Что стоит WebAssembly: размер модуля, цена запуска, скорость счёта.

  Меряется на одном и том же напечатанном C, собранном дважды. Каждая точка
  гоняется несколько раз, и в отчёт идёт медиана с разбросом (мин—макс): машина
  занята другими работами, и одиночный замер на ней ничего не значит.

  Цена запуска считается отдельно от счёта, потому что складывать их нельзя: у
  wasm запуск дорог (среда обязана разобрать и оттранслировать модуль), а счёт
  может быть быстрее. Для программы, которую зовут тысячу раз через трубу, важен
  счёт; для программы, которую запускают на каждый запрос, — запуск.

  Запуск:
    node scripts/wasm-skorost.mjs
    node scripts/wasm-skorost.mjs --repeats 9 --host wasmtime
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
const читать = (к, у) => args.includes(к) ? args[args.indexOf(к) + 1] : у
const повторов = Number(читать("--repeats", "7"))
const host = читать("--host", "wasmtime")
const wasmtime = читать("--wasmtime", join(process.env.HOME ?? "", ".local", "bin", "wasmtime"))
const hostStack = Number(читать("--host-stack", "8388608"))
/*
 * 8 МиБ — не круглое число, а FL_STACK_MIN рантайма: столько обычная сборка
 * заводит потоку под объявленный предел глубины. Стек и сторож поднимаются
 * ВМЕСТЕ: сторож считает по FL_STACK_ROOM_FALLBACK, константе сборки, и один
 * флаг линковки ему ничего не сообщает. С 1 МиБ сортировка слиянием на 2000
 * элементах отказывает FLANG_RECURSION_LIMIT там, где обычная сборка считает.
 */
const стек = Number(читать("--stack", "8388608"))

const CFLAGS = ["-std=c99", "-Wall", "-Wextra", "-Werror", "-pedantic", "-O2"]
const workdir = mkdtempSync(join(tmpdir(), "flang-wasm-skorost-"))

/* ── задачи: настоящие программы, а не «hello world» ─────────────────────── */

const ЗАДАЧИ = [
  { файл: "flang/stdlib/lists.flang", fn: "Сортировать", арг: (n) => [{ l: Array.from({ length: n }, (_, i) => ({ n: String(n - i) })) }], n: 2000, имя: "сортировка вставками, 2000" },
  { файл: "flang/examples/rosetta/merge-sort.flang", fn: "Сортировка слиянием", арг: (n) => [{ l: Array.from({ length: n }, (_, i) => ({ n: String((i * 7919) % n) })) }], n: 2000, имя: "сортировка слиянием, 2000" },
  { файл: "flang/examples/rosetta/fibonacci.flang", fn: "Фибоначчи", арг: () => [{ n: "27" }], n: 0, имя: "Фибоначчи 27" },
  { файл: "flang/stdlib/strings.flang", fn: "Перевернуть", арг: () => [{ s: "яблоко груша слива ".repeat(400) }], n: 0, имя: "перевернуть строку 7600 симв." },
]

const медиана = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

function собрать(файл) {
  const каталог = join(workdir, файл.replace(/[^a-z0-9]/gi, "_"))
  mkdirSync(каталог, { recursive: true })
  const программа = markMeasureGuards(parse(readFileSync(join(root, файл), "utf8"), файл))
  const emitted = emitC(программа, {})
  for (const f of emitted.files) writeFileSync(join(каталог, f.path), f.content, "utf8")
  const sources = emitted.files.filter((f) => f.path.endsWith(".c")).map((f) => f.path)
  execFileSync("cc", [...CFLAGS, ...sources, "-o", "cli_native", "-lm", "-lpthread"],
    { cwd: каталог, stdio: ["ignore", "pipe", "pipe"] })
  execFileSync("clang", ["--target=wasm32-wasi", ...CFLAGS, `-DFL_STACK_ROOM_FALLBACK=${стек}u`,
    ...sources, "-o", "cli.wasm", "-lm", `-Wl,-z,stack-size=${стек}`],
    { cwd: каталог, stdio: ["ignore", "pipe", "pipe"] })
  return {
    каталог,
    native: join(каталог, "cli_native"),
    wasm: join(каталог, "cli.wasm"),
    байтN: statSync(join(каталог, "cli_native")).size,
    байтW: statSync(join(каталог, "cli.wasm")).size,
  }
}

const командаWasm = (модуль) => host === "wasmtime"
  ? [wasmtime, ["run", "-W", `max-wasm-stack=${hostStack}`, модуль]]
  : [process.execPath, ["--no-warnings", join(root, "scripts", "wasm-run.mjs"), модуль]]

function замер(кмд, арг, вход, раз) {
  const o = join(workdir, "o")
  const времена = []
  let вывод = ""
  for (let i = 0; i < раз; i += 1) {
    const fd = openSync(o, "w")
    const t0 = process.hrtime.bigint()
    try {
      execFileSync(кмд, арг, { input: вход, stdio: ["pipe", fd, "pipe"],
        env: { ...process.env, LC_ALL: "C.UTF-8" } })
    } catch { /* исход разберёт вызывающий */ }
    времена.push(Number(process.hrtime.bigint() - t0) / 1e6)
    closeSync(fd)
    вывод = readFileSync(o, "utf8").trim()
  }
  return { мс: медиана(времена), мин: Math.min(...времена), макс: Math.max(...времена), вывод }
}

/* ── 1. цена запуска: пустой вход, работы ноль ───────────────────────────── */

console.log(`среда: ${host === "wasmtime" ? `wasmtime -W max-wasm-stack=${hostStack}` : "node:wasi"}, ` +
            `стек модуля ${стек} байт, повторов ${повторов}\n`)

const первая = собрать(ЗАДАЧИ[0].файл)
let пускN = 0
let пускW = 0
{
  const пусто = ""
  const N = замер(первая.native, [], пусто, повторов)
  const [к, а] = командаWasm(первая.wasm)
  const W = замер(к, а, пусто, повторов)
  пускN = N.мс
  пускW = W.мс
  console.log("ЦЕНА ЗАПУСКА (пустой вход, работы ноль)")
  console.log(`  обычный: ${N.мс.toFixed(1)} мс (${N.мин.toFixed(1)}—${N.макс.toFixed(1)})`)
  console.log(`  wasm:    ${W.мс.toFixed(1)} мс (${W.мин.toFixed(1)}—${W.макс.toFixed(1)})`)
  console.log(`  запуск дороже в ${(W.мс / N.мс).toFixed(1)} раза, разница ${(W.мс - N.мс).toFixed(1)} мс\n`)
}

/* ── 2. размер и скорость счёта ──────────────────────────────────────────── */

console.log("РАЗМЕР И СКОРОСТЬ")
console.log("«всего» — от запуска процесса до ответа; «счёт» — то же за вычетом цены")
console.log("запуска, потому что у маленькой задачи весь разрыв даёт запуск, а не счёт.\n")
console.log("задача\tбайт обычн.\tбайт wasm\tраз\tвсего N\tвсего W\tсчёт N\tсчёт W\tсчёт медл.\tсовпало")
for (const з of ЗАДАЧИ) {
  let с
  try { с = собрать(з.файл) } catch (e) { console.log(`${з.имя}\tне собралось`); continue }
  const вход = JSON.stringify({ fn: з.fn, args: з.арг(з.n), depth: "10000", steps: "1000000000" }) + "\n"
  const N = замер(с.native, [], вход, повторов)
  const [к, а] = командаWasm(с.wasm)
  const W = замер(к, а, вход, повторов)
  const совпало = N.вывод === W.вывод
  const счётN = Math.max(0.1, N.мс - пускN)
  const счётW = Math.max(0.1, W.мс - пускW)
  console.log([
    з.имя,
    с.байтN,
    с.байтW,
    (с.байтW / с.байтN).toFixed(2),
    `${N.мс.toFixed(1)} (${N.мин.toFixed(0)}—${N.макс.toFixed(0)})`,
    `${W.мс.toFixed(1)} (${W.мин.toFixed(0)}—${W.макс.toFixed(0)})`,
    счётN.toFixed(1),
    счётW.toFixed(1),
    `${(счётW / счётN).toFixed(2)}×`,
    совпало ? "да" : "НЕТ",
  ].join("\t"))
}

rmSync(workdir, { recursive: true, force: true })
