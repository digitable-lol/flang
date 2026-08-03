/**
 * `flang emit` — печать программы в целевой язык из командной строки.
 *
 * До этой команды бэкенды (src/emit/*.mjs) были доступны только из Node:
 * чтобы получить нативный бинарник, пользователь обязан был написать скрипт,
 * который сам загрузит программу, сам вызовет `emitC` и сам разложит файлы.
 * Язык при этом кончался там, где кончался JavaScript, — а весь смысл бэкенда
 * C в том, чтобы программа работала там, где Node нет.
 *
 * Поэтому здесь проверяется не «команда что-то напечатала», а три вещи, каждая
 * из которых способна тихо сломаться:
 *
 *   1. РЕЗУЛЬТАТ ТОТ ЖЕ, ЧТО У ПРОГРАММНОГО ВЫЗОВА. CLI не имеет права быть
 *      «почти тем же»: файлы, их пути и байты сверяются с прямым вызовом
 *      emitC/emitGo/emitJs. Иначе у пользователя CLI и у пользователя Node
 *      получались бы разные программы из одного исходника.
 *
 *   2. ПРОГРАММА ЗАГРУЖАЕТСЯ СО СВЯЗЫВАНИЕМ. `использует «Модуль» из "…"`
 *      действует только через `loadProgram`; печать из голого `parse` дала бы
 *      неполную программу. Это самая дорогая из возможных ошибок: она видна не
 *      как отказ CLI, а как несобирающийся C у пользователя, — поэтому ниже
 *      зафиксировано и то, что связанная программа печатается целиком, и то,
 *      что несвязанная не печатается вовсе.
 *
 *   3. СПИСОК ЦЕЛЕЙ — ЭТО КАТАЛОГ src/emit. Ни одна цель не перечислена в
 *      bin/flang.mjs руками, поэтому новый бэкенд (rust.mjs, python.mjs, …)
 *      подхватывается без правок CLI. Тест сверяет список команды с каталогом,
 *      а не с константой, — иначе «расширяемость» пришлось бы принимать на
 *      слово.
 *
 * ── Если компилятора C нет ──────────────────────────────────────────────────
 * Тесты, которым нужен `cc`, честно пропускаются через `missingToolchain`
 * (tools/ftsc/test/toolchain-guard.mjs) — тем же способом, что в
 * flang/test/emit-go.test.mjs. `FTS_REQUIRE_TOOLCHAINS=c` превращает пропуск в
 * падение, каталог с компилятором вне PATH указывается в `FTS_TOOLCHAIN_PATH`.
 */
import assert from "node:assert/strict"
import { execFile, execFileSync } from "node:child_process"
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { emitTargets, loadEmitter, loadProgram } from "../bin/flang.mjs"
import { emitC } from "../src/emit/c.mjs"
import { emitGo } from "../src/emit/go.mjs"
import { emitJs } from "../src/emit/js.mjs"
import { parse } from "../src/parser.mjs"
import { findExecutable } from "../../tools/ftsc/src/toolchain.mjs"
import { missingToolchain } from "../../tools/ftsc/test/toolchain-guard.mjs"

const run = promisify(execFile)
const cli = fileURLToPath(new URL("../bin/flang.mjs", import.meta.url))
const emitDirectory = fileURLToPath(new URL("../src/emit/", import.meta.url))
const lists = fileURLToPath(new URL("../stdlib/lists.flang", import.meta.url))
const core = fileURLToPath(new URL("../core/", import.meta.url))
const cc = findExecutable("cc") ?? findExecutable("gcc")

const workdir = await mkdtemp(join(tmpdir(), "flang-cli-emit-"))
after(async () => {
  await rm(workdir, { recursive: true, force: true })
})

let counter = 0
/** Пустой каталог под каждый прогон: печать обязана работать «в чистое поле». */
async function sandbox(files = {}) {
  const directory = join(workdir, `s${(counter += 1)}`)
  await mkdir(directory, { recursive: true })
  for (const [name, text] of Object.entries(files)) await writeFile(join(directory, name), text, "utf8")
  return directory
}

/** Успешный вызов: JSON из stdout, ничего в stderr. */
async function emit(args) {
  const { stdout, stderr } = await run("node", [cli, "emit", ...args], { maxBuffer: 256 * 1024 * 1024 })
  assert.equal(stderr, "", "успешная печать не пишет в stderr")
  return JSON.parse(stdout)
}

/** Отказ: код возврата и разобранная диагностика из stderr. */
async function emitFails(args) {
  try {
    await run("node", [cli, "emit", ...args], { maxBuffer: 64 * 1024 * 1024 })
  } catch (error) {
    return { code: error.code, stdout: error.stdout, report: JSON.parse(error.stderr) }
  }
  return assert.fail(`ожидался отказ: flang emit ${args.join(" ")}`)
}

/* ─────────────────────────── печать в каждую цель ───────────────────────── */

test("печать в C даёт рантайм, модуль и Makefile", async () => {
  const result = await emit([lists, "--target", "c"])
  assert.equal(result.target, "c")
  assert.equal(result.module, "Списки")
  const paths = result.files.map((file) => file.path)
  for (const expected of ["flang_runtime.h", "flang_runtime.c", "flang_cli.c", "Makefile"]) {
    assert.ok(paths.includes(expected), `в печати C нет ${expected}: ${paths.join(", ")}`)
  }
  assert.ok(
    paths.some((path) => path.endsWith(".c") && !path.startsWith("flang_")),
    `в печати C нет файла модуля: ${paths.join(", ")}`,
  )
  for (const file of result.files) assert.ok(file.content.length > 0, `пустой файл ${file.path}`)
})

test("печать в Go даёт go.mod и пакеты", async () => {
  const result = await emit([lists, "--target", "go"])
  assert.equal(result.target, "go")
  const paths = result.files.map((file) => file.path)
  assert.ok(paths.includes("go.mod"), `в печати Go нет go.mod: ${paths.join(", ")}`)
  assert.ok(
    paths.some((path) => path.endsWith(".go")),
    `в печати Go нет ни одного .go: ${paths.join(", ")}`,
  )
})

test("печать в JS даёт один модуль с экспортами", async () => {
  const result = await emit([lists, "--target", "js"])
  assert.equal(result.target, "js")
  assert.equal(result.files.length, 1, "одна программа — один файл JS")
  assert.ok(result.files[0].path.endsWith(".js"))
  assert.match(result.files[0].content, /export /u)
})

/* ──────────────────────── stdout, каталог, коды возврата ────────────────── */

test("без --out файлы уходят в stdout вместе с путями и ничего не пишут на диск", async () => {
  const directory = await sandbox()
  const { stdout } = await run("node", [cli, "emit", lists, "--target", "c"], {
    cwd: directory,
    maxBuffer: 256 * 1024 * 1024,
  })
  const result = JSON.parse(stdout)
  assert.ok(result.files.length > 1)
  for (const file of result.files) {
    assert.equal(typeof file.path, "string")
    assert.equal(typeof file.content, "string")
  }
  assert.deepEqual(await readdir(directory), [], "печать в stdout не имеет права трогать файловую систему")
})

test("--out записывает ровно то, что уходит в stdout, и создаёт каталоги", async () => {
  const directory = join(await sandbox(), "нет", "такого", "каталога")
  const printed = await emit([lists, "--target", "c"])
  const written = await emit([lists, "--target", "c", "--out", directory])

  assert.equal(written.out, directory)
  assert.deepEqual(
    written.files.map((file) => file.path),
    printed.files.map((file) => file.path),
  )
  for (const file of printed.files) {
    assert.equal(await readFile(join(directory, file.path), "utf8"), file.content, `файл ${file.path} записан иначе`)
  }
  for (const file of written.files) {
    assert.equal(typeof file.bytes, "number", "отчёт о записи называет размер каждого файла")
  }
})

test("--out разворачивает и вложенные пути бэкенда", async () => {
  const directory = join(await sandbox(), "go")
  const written = await emit([lists, "--target", "go", "--out", directory])
  const nested = written.files.filter((file) => file.path.includes("/"))
  assert.ok(nested.length > 0, "бэкенд Go печатает файлы в подкаталогах — иначе тест ничего не проверяет")
  for (const file of nested) assert.ok((await readFile(join(directory, file.path), "utf8")).length > 0)
})

test("неизвестная цель — диагностика с перечислением доступных, а не падение", async () => {
  const { code, report } = await emitFails([lists, "--target", "фортран"])
  assert.equal(code, 2, "ошибка вызова — код 2, как у остальных команд")
  const [diagnostic] = report.diagnostics
  assert.equal(diagnostic.code, "FLANG_CLI")
  assert.equal(diagnostic.severity, "error")
  assert.match(diagnostic.message, /неизвестная цель «фортран»/u)
  for (const target of await emitTargets()) {
    assert.ok(diagnostic.message.includes(target), `в списке доступных целей нет «${target}»: ${diagnostic.message}`)
  }
})

test("цель обязательна, и отказ сразу называет доступные", async () => {
  const { code, report } = await emitFails([lists])
  assert.equal(code, 2)
  assert.equal(report.diagnostics[0].code, "FLANG_CLI")
  assert.match(report.diagnostics[0].message, /--target/u)
  assert.match(report.diagnostics[0].message, /\bc\b/u)
})

test("отсутствующий файл — диагностика в stderr и ненулевой код", async () => {
  const missing = join(workdir, "такого-файла-нет.flang")
  const { code, stdout, report } = await emitFails([missing, "--target", "c"])
  assert.equal(code, 1, "ошибка модели, а не вызова — код 1")
  assert.equal(stdout, "", "при отказе в stdout не должно быть ничего")
  assert.equal(report.diagnostics.length, 1)
  const [diagnostic] = report.diagnostics
  assert.equal(typeof diagnostic.code, "string")
  assert.equal(diagnostic.severity, "error")
  assert.match(diagnostic.message, /такого-файла-нет\.flang/u)
})

test("неизвестная цель проверяется до разбора файла", async () => {
  /* Иначе о неверном ключе сообщалось бы после связывания всех модулей. */
  const missing = join(workdir, "такого-файла-нет.flang")
  const { report } = await emitFails([missing, "--target", "фортран"])
  assert.match(report.diagnostics[0].message, /неизвестная цель/u)
})

/* ───────────────────────────── ключи печати ─────────────────────────────── */

test("--no-cli убирает прогонщик, --cli оставляет", async () => {
  const withCli = await emit([lists, "--target", "c", "--cli"])
  const withoutCli = await emit([lists, "--target", "c", "--no-cli"])
  assert.ok(withCli.files.some((file) => file.path === "flang_cli.c"))
  assert.ok(!withoutCli.files.some((file) => file.path === "flang_cli.c"))
})

test("--index-base и --max-depth доезжают до бэкенда", async () => {
  const result = await emit([lists, "--target", "c", "--index-base", "0", "--max-depth", "77"])
  const header = result.files.find((file) => file.path === "flang_runtime.h").content
  assert.match(header, /#define FL_INDEX_BASE 0/u)
  assert.match(header, /#define FL_MAX_DEPTH 77/u)
})

test("негодные значения ключей — отказ вызова, а не тихая подстановка", async () => {
  for (const args of [
    [lists, "--target", "c", "--index-base", "2"],
    [lists, "--target", "c", "--max-depth", "0"],
    [lists, "--target", "c", "--max-depth", "полтора"],
  ]) {
    const { code, report } = await emitFails(args)
    assert.equal(code, 2, `${args.join(" ")} обязан быть ошибкой вызова`)
    assert.equal(report.diagnostics[0].code, "FLANG_CLI")
  }
})

/* ─────────────── совпадение с программным вызовом бэкенда ───────────────── */

test("печать из CLI совпадает с программным вызовом бэкенда до байта", async () => {
  const program = await loadProgram(lists)
  for (const [target, emitter] of [["c", emitC], ["go", emitGo], ["js", emitJs]]) {
    const printed = await emit([lists, "--target", target])
    assert.deepEqual(printed.files, emitter(program, {}).files, `цель ${target} расходится с прямым вызовом`)
  }
})

test("--cli в CLI — это { cli: true } в вызове бэкенда", async () => {
  const program = await loadProgram(lists)
  const printed = await emit([lists, "--target", "c", "--cli"])
  assert.deepEqual(printed.files, emitC(program, { cli: true }).files)
})

/* ─────────────────── реестр целей: каталог, а не константа ──────────────── */

test("список целей — это каталог src/emit, а не перечень в CLI", async () => {
  const expected = (await readdir(emitDirectory))
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => name.slice(0, -".mjs".length))
    .sort()
  assert.deepEqual(await emitTargets(), expected)
  assert.ok(expected.includes("c") && expected.includes("go") && expected.includes("js"))
})

test("бэкенд подключается по имени файла и соглашению emit<Цель>", async () => {
  for (const target of await emitTargets()) {
    const backend = await loadEmitter(target)
    assert.equal(typeof backend.emit, "function", `бэкенд «${target}» не дал функции печати`)
  }
  assert.equal((await loadEmitter("c")).emit, emitC)
  assert.equal((await loadEmitter("go")).emit, emitGo)
  assert.equal((await loadEmitter("js")).emit, emitJs)
})

test("новый бэкенд в src/emit подхватывается без правок CLI", async () => {
  /* Проверяется не выдумкой, а тем же кодом: реестр строится по каталогу,
     поэтому достаточно показать, что имя файла и есть идентификатор цели, а
     функция печати ищется по соглашению. Правок в bin/flang.mjs новый бэкенд
     не требует — ни для списка, ни для справки, ни для диагностики. */
  const registry = await emitTargets()
  const { report } = await emitFails([lists, "--target", "такого-языка-нет"])
  assert.equal(report.diagnostics[0].message, `неизвестная цель «такого-языка-нет»; доступны: ${registry.join(", ")}`)
})

/* ──────────────────────── связывание модулей при печати ─────────────────── */

const MODULES = {
  "числа.flang": `модуль «Числа»

тотальная функция «Удвоить»
  принимает значение: число
  возвращает число
  значение умножить на 2
`,
  "строки.flang": `модуль «Строки»
  использует «Числа» из "числа.flang"

тотальная функция «Повтор длины»
  принимает текст: строка
  возвращает число
  «Удвоить» от (длина текст)
`,
  "главный.flang": `модуль «Главный»
  использует «Строки» из "строки.flang"

тотальная функция «Итог»
  принимает текст: строка
  возвращает число
  «Повтор длины» от текст плюс 1
`,
}

async function modulesSandbox() {
  return join(await sandbox(MODULES), "главный.flang")
}

test("программа со связыванием модулей печатается целиком", async () => {
  const entry = await modulesSandbox()
  const linked = await loadProgram(entry)
  assert.deepEqual(
    linked.functions.map((fn) => fn.name).sort(),
    ["Итог", "Повтор длины", "Удвоить"],
    "loadProgram обязан собрать функции всех трёх модулей",
  )

  for (const [target, emitter] of [["c", emitC], ["go", emitGo], ["js", emitJs]]) {
    const printed = await emit([entry, "--target", target])
    assert.deepEqual(printed.files, emitter(linked, {}).files, `цель ${target}: печать не совпала со связанной программой`)
  }
})

test("без связывания та же программа не печатается вовсе — значит, печать идёт через loadProgram", async () => {
  /* Голый разбор входного файла знает только «Итог»; «Повтор длины» для него —
     неизвестное имя, и бэкенд обязан отказать. Именно поэтому команда обязана
     звать loadProgram: иначе пользователь получил бы не отказ, а неполную
     программу, которая не собирается уже у компилятора C. */
  const entry = await modulesSandbox()
  const single = parse(await readFile(entry, "utf8"), entry)
  assert.equal(single.functions.length, 1)
  assert.throws(() => emitJs(single, {}), /Повтор длины/u)

  const printed = await emit([entry, "--target", "js"])
  assert.match(printed.files[0].content, /Повтор длины|Удвоить/u)
})

/* ────────────────────────── настоящее дело: C и cc ──────────────────────── */

const CFLAGS = ["-std=c99", "-Werror", "-pedantic"]

/** Собирает всё, что напечатал бэкенд, ровно из того каталога, куда напечатал. */
function build(directory, sources) {
  execFileSync(cc, [...CFLAGS, ...sources, "-o", "flang_cli", "-lm"], { cwd: directory, stdio: "pipe" })
  return join(directory, "flang_cli")
}

function ask(binary, requests) {
  const output = execFileSync(binary, {
    input: `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  return output.split("\n").filter((line) => line.length > 0).map((line) => JSON.parse(line))
}

test("программа с модулями: emit --target c → cc -std=c99 -Werror -pedantic → запуск", async (t) => {
  if (cc === null) {
    missingToolchain(t, "c", "компилятора C нет (ни cc, ни gcc в PATH и в FTS_TOOLCHAIN_PATH) — пропуск")
    return
  }
  const entry = await modulesSandbox()
  const directory = join(await sandbox(), "c")
  const written = await emit([entry, "--target", "c", "--out", directory])
  const sources = written.files.map((file) => file.path).filter((path) => path.endsWith(".c"))
  assert.ok(sources.includes("flang_cli.c"), "прогонщик печатается по умолчанию")

  const binary = build(directory, sources)
  const [answer] = ask(binary, [{ fn: "Итог", args: [{ s: "мир 🌍" }] }])
  /* «мир 🌍» — пять кодовых точек: 5 × 2 + 1. Заодно видно, что функции обоих
     импортированных модулей действительно попали в напечатанный C. */
  assert.deepEqual(answer, { ok: true, value: { n: "11" } })
})

test("ядро FTS из flang/core печатается в C и собирается", async (t) => {
  if (cc === null) {
    missingToolchain(t, "c", "компилятора C нет (ни cc, ни gcc в PATH и в FTS_TOOLCHAIN_PATH) — пропуск")
    return
  }
  const entry = join(await sandbox({
    "ядро.flang": `модуль «Ядро FTS»
  использует «Парсер FTS» из ${JSON.stringify(join(core, "parser.flang"))}
  использует «Вычислитель утилит» из ${JSON.stringify(join(core, "evaluate.flang"))}

тотальная функция «Версия ядра»
  возвращает строка
  "ядро FTS на flang"
`,
  }), "ядро.flang")

  /* Само ядро пишут соседние слои, и его поломка — не отказ этой команды:
     если программа сегодня не загружается, честнее пропустить, чем показать
     красным чужое состояние flang/core. */
  let program
  try {
    program = await loadProgram(entry)
  } catch (error) {
    t.skip(`ядро FTS сейчас не загружается (${error.message}) — печать проверить не на чем`)
    return
  }
  assert.ok(program.functions.length >= 200, `в ядре ожидались сотни функций, а их ${program.functions.length}`)

  const directory = join(await sandbox(), "ядро-c")
  const written = await emit([entry, "--target", "c", "--out", directory])
  assert.deepEqual(
    written.files.map((file) => file.path),
    emitC(program, {}).files.map((file) => file.path),
  )
  for (const file of emitC(program, {}).files) {
    assert.equal(await readFile(join(directory, file.path), "utf8"), file.content, `${file.path} расходится с emitC`)
  }

  const binary = build(directory, written.files.map((file) => file.path).filter((path) => path.endsWith(".c")))
  const [answer] = ask(binary, [{ fn: "Версия ядра", args: [] }])
  assert.deepEqual(answer, { ok: true, value: { s: "ядро FTS на flang" } })
})
