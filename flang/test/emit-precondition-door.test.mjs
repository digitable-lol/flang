/**
 * ДОГОВОР НА ГРАНИЦЕ НАПЕЧАТАННОЙ ПРОГРАММЫ: `требует` обязано отказать тем же
 * кодом и тем же текстом, что у интерпретатора, — во всех восьми целях.
 *
 * ── Улика, с которой это начиналось ────────────────────────────────────────
 *
 * Снята прогоном на живом файле дерева `flang/proof/examples/precondition.flang`
 * («Удвоить» принимает `н: число` и требует `н не меньше 0`):
 *
 *   интерпретатор, --args {"н": -5}   → FLANG_PRECONDITION «не выполнено
 *                                       требование «вход неотрицателен»»
 *   напечатанный JS, тот же вход      → FLANG_PROPERTY «нарушено свойство
 *                                       «удвоенное неотрицательно»»
 *
 * Второе — отказ ПОСТусловия вместо отказа входа, и он случился только потому,
 * что у этой функции постусловие есть. У функции с `требует` и без
 * `обеспечивает` не было бы и его: напечатанная программа посчитала бы ответ на
 * входе, которого договор не допускает, и молча вернула бы его наружу. Именно
 * это значило «интерпретатор договор блюдёт, а уехавшая пользователю программа
 * — нет».
 *
 * ── ГДЕ проверка стоит, и почему не везде ──────────────────────────────────
 *
 * В flang предусловие снимает ВЫЗЫВАЮЩИЙ: каждое место вызова обязано доказать
 * `требует` вызываемой, иначе программа отвергается кодом
 * FLANG_PRECONDITION_CALL и до печати не доезжает вовсе. Значит ВНУТРИ
 * программы требование уже истинно — не «проверено», а известно, — и печать его
 * проверки в тело каждой функции была бы платой временем каждого вызова и
 * каждого витка рекурсии за то, что доказано статически.
 *
 * Недоказанное входит ровно на ГРАНИЦЕ, где значение приезжает от хозяина. У
 * интерпретатора эта дверь одна и названа поимённо: `callFunction` в
 * src/interpret.mjs (её зовёт только `createRuntime().call`), а `applyFunction`
 * предусловий не знает. У напечатанной программы дверь — вызов по имени
 * (`prefix_call` в C, `Call` в Go/Java/C#, `call` в Python/Rust/Elixir, таблица
 * `$PROGRAM` у JavaScript): внутренние вызовы идут прямо на функцию и в дверь не
 * заходят. Проверка встала туда.
 *
 * ── Чем эта проверка отличается от `emit-entry-types.test.mjs` ─────────────
 *
 * Там эталон — `checkArguments` (значение против объявленного ТИПА). Здесь
 * эталон — сам ИНТЕРПРЕТАТОР, потому что предусловие типом не выражается
 * («ширина не меньше длины» — не тип) и проверяется вычислением. Сверка идёт
 * равенством строк: и код, и текст. Отвечай напечатанная программа своими
 * словами — у языка было бы два ответа на один вопрос, и разошлись бы они молча.
 *
 * ── Половина, без которой вторая ничего не значит ──────────────────────────
 *
 * В сетке есть годные входы, и они обязаны СЧИТАТЬСЯ с тем же значением, что у
 * интерпретатора. Без них зелень означала бы, что не проходит ничего. И есть
 * точка, где вход лжёт про ТИП: там отказ обязан прийти от границы типов
 * (FLANG_TYPE), а не от договора, — предусловие о значении вне типа не значит
 * ничего, и порядок дверей проверяется этой строкой.
 */
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

import { evaluate } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"
import { checkArguments } from "../src/types.mjs"
import { emitC } from "../src/emit/c.mjs"
import { emitCsharp } from "../src/emit/csharp.mjs"
import { emitElixir } from "../src/emit/elixir.mjs"
import { emitGo } from "../src/emit/go.mjs"
import { emitJava } from "../src/emit/java.mjs"
import { emitJs } from "../src/emit/js.mjs"
import { emitPython } from "../src/emit/python.mjs"
import { emitRust } from "../src/emit/rust.mjs"
import { findExecutable } from "../src/toolchain.mjs"
import { missingToolchain } from "./toolchain-guard.mjs"

const источник = fileURLToPath(new URL("../proof/examples/precondition.flang", import.meta.url))
const программа = parse(readFileSync(источник, "utf8"), "proof/examples/precondition.flang")

const рабочий = mkdtempSync(join(tmpdir(), "flang-precondition-door-"))
after(() => {
  rmSync(рабочий, { recursive: true, force: true })
})

/* Локаль машины бывает сломана (`LC_CTYPE=UTF-8` — такой локали нет): BEAM
   уходит в latin1, JDK откатывается к ASCII. Имена функций здесь кириллические,
   и без этого прогонщик отвечал бы про другую функцию. */
const СРЕДА = { ...process.env, LC_ALL: "C.UTF-8" }

/* ─────────────────────────── сетка входов ─────────────────────────── */

/**
 * Каждая строка — один вопрос двери. `нарушает` говорит, чего мы ждём:
 * `true` — интерпретатор обязан отказать, и напечатанная программа обязана
 * отказать тем же кодом и тем же текстом.
 */
const СЕТКА = [
  { имя: "Удвоить", args: { "н": -5 }, нарушает: true },
  { имя: "Удвоить", args: { "н": 5 }, нарушает: false },
  { имя: "Удвоить", args: { "н": 0 }, нарушает: false },
  { имя: "Сколько дополнить", args: { "ширина": 3, "длина": 8 }, нарушает: true },
  { имя: "Сколько дополнить", args: { "ширина": 8, "длина": 3 }, нарушает: false },
  { имя: "Сколько дополнить", args: { "ширина": 5, "длина": 5 }, нарушает: false },
  /* Ложь про ТИП, а не про договор: отказ обязан прийти от границы типов и
     назвать тип, а не требование. Порядок дверей и проверяется этой строкой. */
  { имя: "Высота от дна", args: { "стопка": 7, "дно": 0 }, нарушает: true, поТипу: true },
]

/**
 * Ожидание эталона — самой ДВЕРИ интерпретатора, а не второго свода правил.
 *
 * Дверь эта из двух половин, и порядок у них тот же, что печатается: сначала
 * значение против объявленного ТИПА (`checkArguments`), потом вычисление,
 * внутри которого `callFunction` снимает договор. Ровно так устроен
 * `flang run --args` (flang/bin/flang.mjs), и брать эталоном одну половину
 * значило бы сверять напечатанную дверь с половиной двери.
 *
 * Отказ приезжает исключением с полем `code`; годный вход возвращает значение,
 * и оно тоже сверяется — иначе «оба промолчали» проходило бы само собой.
 */
function эталон(точка) {
  const типы = checkArguments(программа, точка.имя, точка.args)
  if (!типы.ok) {
    assert.equal(точка.нарушает, true, `${точка.имя}: эталон обязан принять ${JSON.stringify(точка.args)}`)
    return { ok: false, code: типы.diagnostics[0].code, message: типы.diagnostics[0].message }
  }
  try {
    const значение = evaluate(программа, точка.имя, точка.args)
    assert.equal(точка.нарушает, false, `${точка.имя}: эталон обязан отвергнуть ${JSON.stringify(точка.args)}`)
    return { ok: true, значение }
  } catch (беда) {
    assert.equal(точка.нарушает, true, `${точка.имя}: эталон обязан принять ${JSON.stringify(точка.args)}: ${беда.message}`)
    assert.equal(typeof беда.code, "string", `${точка.имя}: у отказа эталона нет кода`)
    return { ok: false, code: беда.code, message: беда.message }
  }
}

const ОЖИДАНИЯ = СЕТКА.map(эталон)

/* Сам эталон обязан отвечать ДОГОВОРОМ там, где нарушен договор, а не чем
   придётся: без этой проверки сверка «оба сказали FLANG_PROPERTY» была бы
   зелёной ровно на том дефекте, ради которого она заведена. */
test("эталон: нарушенный договор — это FLANG_PRECONDITION, а не отказ постусловия", () => {
  const договорные = СЕТКА.map((точка, индекс) => [точка, ОЖИДАНИЯ[индекс]])
    .filter(([точка]) => точка.нарушает && точка.поТипу !== true)
  assert.ok(договорные.length >= 2, "в сетке обязаны быть нарушения договора, иначе сверять нечего")
  for (const [точка, ждём] of договорные) {
    assert.equal(ждём.code, "FLANG_PRECONDITION", `${точка.имя}: эталон отказал не договором, а ${ждём.code}`)
    assert.match(ждём.message, /^не выполнено требование «/u, `${точка.имя}: текст отказа не про требование`)
  }
  const поТипу = СЕТКА.map((точка, индекс) => [точка, ОЖИДАНИЯ[индекс]]).filter(([точка]) => точка.поТипу === true)
  for (const [точка, ждём] of поТипу) {
    assert.equal(ждём.code, "FLANG_TYPE", `${точка.имя}: ложь про тип обязана отказывать типом, а не ${ждём.code}`)
  }
})

/* Значения на проводе: число едет строкой, иначе NaN, Infinity и −0 не доедут. */
function кодировать(значение) {
  if (значение === null || значение === undefined) return null
  if (typeof значение === "boolean") return значение
  if (typeof значение === "number") return { n: Object.is(значение, -0) ? "-0" : String(значение) }
  if (typeof значение === "string") return { s: значение }
  if (Array.isArray(значение)) return { l: значение.map(кодировать) }
  if (typeof значение === "object" && typeof значение.variant === "string") {
    return { v: значение.variant, f: Object.entries(значение.fields).map(([имя, поле]) => [имя, кодировать(поле)]) }
  }
  if (typeof значение === "object") {
    return { r: Object.entries(значение).map(([имя, поле]) => [имя, кодировать(поле)]) }
  }
  throw new Error(`нечем закодировать ${String(значение)}`)
}

/** Запросы прогонщику: значения по ПОРЯДКУ параметров, как их ждёт вызов по имени. */
const ЗАПРОСЫ = СЕТКА.map((точка) => ({
  fn: точка.имя,
  args: (программа.functions.find((fn) => fn.name === точка.имя).params ?? []).map((param) =>
    кодировать(точка.args[param.name])),
}))

/** Сверка ответов прогонщика с эталоном — равенством строк, и кода, и текста. */
function сверить(цель, ответы) {
  assert.equal(ответы.length, СЕТКА.length, `${цель}: прогонщик обязан ответить на каждый запрос`)
  ОЖИДАНИЯ.forEach((ждём, индекс) => {
    const точка = СЕТКА[индекс]
    const ответ = ответы[индекс]
    const кто = `${цель} / «${точка.имя}» на ${JSON.stringify(точка.args)}`
    if (ждём.ok) {
      assert.equal(ответ.ok, true, `${кто}: годный вход обязан считаться, а пришло ${JSON.stringify(ответ)}`)
      assert.deepEqual(
        ответ.value,
        кодировать(ждём.значение),
        `${кто}: значение разошлось с эталоном`,
      )
      return
    }
    assert.equal(ответ.ok, false, `${кто}: договор нарушен, а напечатанное посчитало ${JSON.stringify(ответ)}`)
    assert.equal(ответ.code, ждём.code, `${кто}: код отказа разошёлся с эталоном`)
    assert.equal(ответ.message, ждём.message, `${кто}: текст отказа разошёлся с эталоном`)
  })
}

/* ─────────────────────────── печать и сборка ─────────────────────────── */

let счёт = 0

function разложить(файлы) {
  счёт += 1
  const каталог = join(рабочий, `p${счёт}`)
  mkdirSync(каталог, { recursive: true })
  for (const файл of файлы) {
    mkdirSync(dirname(join(каталог, файл.path)), { recursive: true })
    writeFileSync(join(каталог, файл.path), файл.content, "utf8")
  }
  return каталог
}

function собрать(команда, аргументы, опции) {
  const итог = spawnSync(команда, аргументы, { encoding: "utf8", env: СРЕДА, ...опции })
  assert.equal(итог.status, 0, `${команда} не собрал напечатанное:\n${итог.stdout}\n${итог.stderr}`)
}

/** Один процесс на все запросы: сборка дорога, запрос дёшев. */
function спросить(команда, аргументы, опции) {
  const вход = `${ЗАПРОСЫ.map((запрос) => JSON.stringify(запрос)).join("\n")}\n`
  const вывод = execFileSync(команда, аргументы, {
    input: вход,
    encoding: "utf8",
    env: СРЕДА,
    maxBuffer: 512 * 1024 * 1024,
    ...опции,
  })
  return вывод.split("\n").filter((строка) => строка.length > 0).map((строка) => JSON.parse(строка))
}

/* ─────────────────────────── цели ─────────────────────────── */

const ccBin = findExecutable("cc") ?? findExecutable("gcc")
const CARGO_BIN = [join(homedir(), ".cargo", "bin")]
const cargoBin = findExecutable("cargo", CARGO_BIN)
const goBin = findExecutable("go")
const javacBin = findExecutable("javac")
const javaBin = findExecutable("java")
const dotnetBin = findExecutable("dotnet")
const pythonBin = findExecutable("python3") ?? findExecutable("python")
const elixirBin = findExecutable("elixir")
const elixircBin = findExecutable("elixirc")

test("C: нарушенный договор отвергается на границе тем же кодом", (t) => {
  if (!ccBin) {
    missingToolchain(t, "c", "компилятор C не найден — пропуск")
    return
  }
  const каталог = разложить(emitC(программа, {}).files)
  собрать("make", [], { cwd: каталог })
  сверить("C", спросить(join(каталог, "flang_cli"), [], { cwd: каталог }))
})

test("Rust: нарушенный договор отвергается на границе тем же кодом", (t) => {
  if (!cargoBin) {
    missingToolchain(t, "rust", "cargo не найден — пропуск")
    return
  }
  const каталог = разложить(emitRust(программа, {}).files)
  собрать(cargoBin, ["build", "--quiet"], { cwd: каталог })
  сверить("Rust", спросить(join(каталог, "target", "debug", "flang_cli"), [], { cwd: каталог }))
})

test("Go: нарушенный договор отвергается на границе тем же кодом", (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "go не найден — пропуск")
    return
  }
  const каталог = разложить(emitGo(программа, {}).files)
  собрать(goBin, ["build", "-o", "flang_cli", "./cli"], { cwd: каталог })
  сверить("Go", спросить(join(каталог, "flang_cli"), [], { cwd: каталог }))
})

test("Java: нарушенный договор отвергается на границе тем же кодом", (t) => {
  if (!javacBin || !javaBin) {
    missingToolchain(t, "java", "javac или java не найден — пропуск")
    return
  }
  const каталог = разложить(emitJava(программа, {}).files)
  собрать("make", [], { cwd: каталог })
  сверить("Java", спросить(javaBin, ["-cp", ".", "FlangCli", "Preduslovie"], { cwd: каталог }))
})

test("C#: нарушенный договор отвергается на границе тем же кодом", (t) => {
  if (!dotnetBin) {
    missingToolchain(t, "csharp", "dotnet не найден — пропуск")
    return
  }
  const каталог = разложить(emitCsharp(программа, {}).files)
  собрать(dotnetBin, ["build", "-v", "quiet", "--nologo"], {
    cwd: каталог,
    env: { ...СРЕДА, DOTNET_CLI_TELEMETRY_OPTOUT: "1" },
  })
  сверить("C#", спросить(dotnetBin, [join(каталог, "bin", "Debug", "net8.0", "flang.dll"), "Preduslovie"], {
    cwd: каталог,
    env: { ...СРЕДА, DOTNET_CLI_TELEMETRY_OPTOUT: "1" },
  }))
})

test("Python: нарушенный договор отвергается на границе тем же кодом", (t) => {
  if (!pythonBin) {
    missingToolchain(t, "python", "python3 не найден — пропуск")
    return
  }
  const каталог = разложить(emitPython(программа, {}).files)
  сверить("Python", спросить(pythonBin, ["-B", "flang_cli.py", "preduslovie"], { cwd: каталог }))
})

test("JavaScript: нарушенный договор отвергается на границе тем же кодом", () => {
  const каталог = разложить(emitJs(программа, {}).files)
  сверить("JavaScript", спросить(process.execPath, ["flang_cli.js", "./preduslovie.js"], { cwd: каталог }))
})

test("Elixir: нарушенный договор отвергается на границе тем же кодом", (t) => {
  if (!elixirBin || !elixircBin) {
    missingToolchain(t, "elixir", "elixir или elixirc не найден — пропуск")
    return
  }
  const каталог = разложить(emitElixir(программа, {}).files)
  собрать("make", ["build"], { cwd: каталог })
  сверить("Elixir", спросить(elixirBin, ["-pa", "_build", "-e", 'Flang.Cli.main(["Preduslovie"])'], { cwd: каталог }))
})
