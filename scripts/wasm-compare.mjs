#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/*
  Сверка: одна и та же программа flang, напечатанная в C, собранная ДВАЖДЫ —
  обычным `cc` и `clang --target=wasm32-wasi`, — обязана отвечать знак в знак.

  Зачем это, а не «цель печати в WebAssembly». Вопрос стоял так: нужна ли
  девятая цель печати. Проверяемая гипотеза — не нужна, потому что путь уже
  есть: мы печатаем в C, а C компилируется в wasm. Гипотезу нельзя принять на
  слово, потому что «собралось» и «считает то же самое» — разные утверждения:
  у wasm другая модель памяти, нет потоков и нет системных вызовов, кроме
  выданных WASI. Значит надо взять корпус, прогнать его через ОБА бинарника и
  сравнить ответы побайтово, включая коды отказов.

  Корпус берётся тот же, которым сверяются шесть целей печати
  (`flang/test/corpus-grid.mjs`): `flang/stdlib/*.flang` и
  `flang/examples/leetcode/*.flang`, сетка входов — аргументы примеров плюс их
  порча чужими значениями. Сверяется не значение, а ВСЯ строка ответа
  прогонщика: `{"ok":true,"value":…}` либо `{"ok":false,"code":…,"message":…}`.
  Побайтово — потому что расхождение в тексте диагностики это тоже расхождение.

  Эталон здесь — обычная сборка, а не интерпретатор. С интерпретатором обычную
  сборку уже сверяет `flang/test/emit-c.test.mjs`; повторять это тут значило бы
  мерить не то, что спрашивали. Спрашивали: теряет ли что-нибудь ПЕРЕХОД в wasm.

  Запуск:
    node scripts/wasm-compare.mjs                # весь корпус
    node scripts/wasm-compare.mjs --limit 10     # первые 10 программ
    node scripts/wasm-compare.mjs --keep         # не удалять каталог сборки

  Нужны: `cc`, `clang` с целью wasm32-wasi и установленным wasi-libc
  (Ubuntu: пакеты `clang`, `lld`, `wasi-libc`, `libclang-rt-dev-wasm32`),
  Node с `node:wasi`.

  Код возврата 1, если хоть одна точка разошлась либо хоть одна программа не
  собралась.
*/

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync, rmSync, statSync, openSync, closeSync, readFileSync } from "node:fs"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const { emitC } = await import(new URL("../flang/src/emit/c.mjs", import.meta.url).href)
const { functionGrid, loadPrograms, ПРЕДЕЛЫ, ПРЕДЕЛ_УБЕГАЮЩЕЙ, убегающая } = await import(
  new URL("../flang/test/corpus-grid.mjs", import.meta.url).href
)

const args = process.argv.slice(2)
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity
const keep = args.includes("--keep")
/*
 * Размер теневого стека wasm. По умолчанию wasm-ld даёт 64 КиБ, и этого мало:
 * глубже отказывает сторож. Отказ при этом ОБЪЯВЛЕННЫЙ — рантайм читает
 * настоящий размер теневого стека из разметки модуля (`fl_wasm_room` в
 * flang_runtime.c), — но мелкий стек всё равно разводит wasm с эталоном там,
 * где эталон досчитывает: 7 расхождений из 9139 точек без флага и 0 с
 * `--stack 1048576`.
 *
 * Раньше здесь стояло другое, и для своего времени стояло верно: сторож считал
 * по FL_STACK_ROOM_FALLBACK (1 МиБ), пропускал вызов, для которого места нет, и
 * теневой стек молча заезжал в кучу — сторожевой страницы у wasm нет. Тогда без
 * флага замер мерял эту ловушку. Ловушки больше нет; без флага замер меряет
 * мелкий стек.
 */
const stack = args.includes("--stack") ? Number(args[args.indexOf("--stack") + 1]) : 0
/*
 * Чем запускать wasm. `node` — через node:wasi (есть везде, где есть Node, но
 * ТЕРЯЕТ хвост стандартного ввода за ~128 КиБ: см. wasm-run.mjs). `wasmtime` —
 * настоящая среда WASI, ввод не теряет; ей нужен свой предел стека, потому что
 * по умолчанию она даёт 512 КиБ и обрывает рекурсию раньше обычной сборки.
 */
const host = args.includes("--host") ? args[args.indexOf("--host") + 1] : "node"
const wasmtime = args.includes("--wasmtime")
  ? args[args.indexOf("--wasmtime") + 1]
  : join(process.env.HOME ?? "", ".local", "bin", "wasmtime")
const hostStack = args.includes("--host-stack") ? Number(args[args.indexOf("--host-stack") + 1]) : 8388608

const CFLAGS = ["-std=c99", "-Wall", "-Wextra", "-Werror", "-pedantic", "-O2"]
const WASM_CC = ["clang", "--target=wasm32-wasi"]
const NATIVE_CC = ["cc"]
const runner = join(root, "scripts", "wasm-run.mjs")

const workdir = mkdtempSync(join(tmpdir(), "flang-wasm-compare-"))

/* ── значения на проводе: как в emit-c.test.mjs ───────────────────────────── */

const isVariantLike = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value) &&
  typeof value.variant === "string" && typeof value.fields === "object" && value.fields !== null

function encode(value) {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value
  if (typeof value === "number") return { n: Object.is(value, -0) ? "-0" : String(value) }
  if (typeof value === "string") return { s: value }
  if (Array.isArray(value)) return { l: value.map(encode) }
  if (isVariantLike(value)) {
    return { v: value.variant, f: Object.entries(value.fields).map(([k, i]) => [k, encode(i)]) }
  }
  if (typeof value === "object") return { r: Object.entries(value).map(([k, i]) => [k, encode(i)]) }
  throw new Error(`нечего кодировать: ${typeof value}`)
}

/* ── сборка ───────────────────────────────────────────────────────────────── */

function build(program, name, index) {
  const directory = join(workdir, `p${index}`)
  mkdirSync(directory, { recursive: true })
  const emitted = emitC(program, {})
  for (const file of emitted.files) writeFileSync(join(directory, file.path), file.content, "utf8")
  const sources = emitted.files.filter((f) => f.path.endsWith(".c")).map((f) => f.path)

  const compile = (cc, out, libs) => {
    const started = process.hrtime.bigint()
    try {
      execFileSync(cc[0], [...cc.slice(1), ...CFLAGS, ...sources, "-o", out, ...libs], {
        cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      })
    } catch (error) {
      return { ok: false, diagnostic: String(error.stderr ?? error.message).slice(0, 4000) }
    }
    return {
      ok: true,
      seconds: Number(process.hrtime.bigint() - started) / 1e9,
      bytes: statSync(join(directory, out)).size,
    }
  }

  /* -lpthread у wasm нет смысла: в wasi-libc это заглушка, а расчёт на
     отдельном потоке (`fl_call_deep`) отключён самим рантаймом — платформенная
     часть закрыта проверкой `__unix__`, которой у wasm32-wasi нет. */
  const native = compile(NATIVE_CC, "cli_native", ["-lm", "-lpthread"])
  const wasm = compile(WASM_CC, "cli.wasm", stack > 0 ? ["-lm", `-Wl,-z,stack-size=${stack}`] : ["-lm"])
  return { directory, native, wasm, cliNative: join(directory, "cli_native"), cliWasm: join(directory, "cli.wasm") }
}

/* ── прогон: один процесс на сколько угодно запросов ──────────────────────── */

function askNative(built, input) {
  return execFileSync(built.cliNative, { input, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 })
}

/*
 * Вывод wasm забирается ЧЕРЕЗ ФАЙЛ, а не через трубу, и это вынужденно.
 * `node:wasi` пишет в трубу асинхронно и теряет хвост: 8 прогонов одного и того
 * же модуля через трубу дали 171819 байт пять раз и 158167, 163072, 166220
 * остальные три; тот же модуль в файл — 10 прогонов из 10 по 171819 байт, а
 * обычный бинарник и через трубу давал 171819 все восемь раз. Через трубу
 * сверка ловила бы собственный обрыв и называла бы его расхождением wasm.
 */
function askWasm(built, input) {
  const путь = join(built.directory, "wasm.out")
  const fd = openSync(путь, "w")
  const [кмд, арг] = host === "wasmtime"
    ? [wasmtime, ["run", "-W", `max-wasm-stack=${hostStack}`, built.cliWasm]]
    : [process.execPath, ["--no-warnings", runner, built.cliWasm]]
  try {
    execFileSync(кмд, арг, {
      input, stdio: ["pipe", fd, "pipe"],
      env: { ...process.env, LC_ALL: "C.UTF-8" },
    })
  } finally {
    closeSync(fd)
  }
  return readFileSync(путь, "utf8")
}

/* ── главная сверка ───────────────────────────────────────────────────────── */

const programs = loadPrograms().slice(0, limit)
let сверено = 0
let расхождений = 0
let программ = 0
const беды = []
const размеры = []

for (const [index, { file, program }] of programs.entries()) {
  let built
  try {
    built = build(program, file, index)
  } catch (error) {
    беды.push(`${file}: печать не удалась — ${error.message}`)
    continue
  }
  if (!built.native.ok) { беды.push(`${file}: cc не собрал:\n${built.native.diagnostic}`); continue }
  if (!built.wasm.ok) { беды.push(`${file}: clang wasm32-wasi не собрал:\n${built.wasm.diagnostic}`); continue }
  программ += 1
  размеры.push({ file, native: built.native.bytes, wasm: built.wasm.bytes,
                 tNative: built.native.seconds, tWasm: built.wasm.seconds })

  const requests = []
  const метки = []
  for (const fn of program.functions ?? []) {
    for (const точка of functionGrid(fn)) {
      const бежит = убегающая(file, fn.name, точка)
      requests.push({
        fn: fn.name,
        args: точка.map(encode),
        depth: String(ПРЕДЕЛЫ.maxDepth),
        steps: String(бежит ? ПРЕДЕЛ_УБЕГАЮЩЕЙ : ПРЕДЕЛЫ.maxSteps),
      })
      метки.push(`${file} / «${fn.name}» ${JSON.stringify(точка)}`)
    }
  }
  if (requests.length === 0) continue
  const input = `${requests.map((r) => JSON.stringify(r)).join("\n")}\n`

  let выводN, выводW
  try { выводN = askNative(built, input) } catch (e) { беды.push(`${file}: обычный бинарник упал — ${e.message}`); continue }
  try { выводW = askWasm(built, input) } catch (e) { беды.push(`${file}: wasm упал — ${String(e.stderr ?? e.message).slice(0, 2000)}`); continue }

  const строкиN = выводN.split("\n").filter((s) => s.length > 0)
  const строкиW = выводW.split("\n").filter((s) => s.length > 0)
  if (строкиN.length !== requests.length) { беды.push(`${file}: обычный ответил ${строкиN.length} раз на ${requests.length} запросов`); continue }
  if (строкиW.length !== requests.length) { беды.push(`${file}: wasm ответил ${строкиW.length} раз на ${requests.length} запросов`); continue }

  for (let i = 0; i < requests.length; i += 1) {
    сверено += 1
    if (строкиN[i] !== строкиW[i]) {
      расхождений += 1
      if (беды.length < 40) {
        беды.push(`РАСХОЖДЕНИЕ ${метки[i]}\n  обычный: ${строкиN[i].slice(0, 400)}\n  wasm:    ${строкиW[i].slice(0, 400)}`)
      }
    }
  }
  process.stderr.write(`${file}: ${requests.length} точек, ${расхождений === 0 ? "сошлось" : `расхождений ${расхождений}`}\n`)
}

/* ── отчёт ────────────────────────────────────────────────────────────────── */

const сумма = (поле) => размеры.reduce((a, s) => a + s[поле], 0)
console.log(JSON.stringify({
  среда: host === "wasmtime" ? `wasmtime, max-wasm-stack=${hostStack}` : "node:wasi",
  стекWasm: stack > 0 ? stack : "по умолчанию (wasm-ld: 64 КиБ)",
  программ: программ,
  всегоПрограмм: programs.length,
  сверенныхТочек: сверено,
  расхождений,
  байтНативно: сумма("native"),
  байтWasm: сумма("wasm"),
  отношениеРазмера: Number((сумма("wasm") / сумма("native")).toFixed(3)),
  секундСборкиНативно: Number(сумма("tNative").toFixed(1)),
  секундСборкиWasm: Number(сумма("tWasm").toFixed(1)),
  беды: беды.slice(0, 40),
}, null, 2))

if (!keep) rmSync(workdir, { recursive: true, force: true })
else console.log(`каталог сборки: ${workdir}`)

assert.equal(расхождений, 0, `сверка не сошлась на ${расхождений} точках`)
assert.equal(беды.length, 0, `бед: ${беды.length}`)
