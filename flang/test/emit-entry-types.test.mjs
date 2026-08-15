/**
 * ГРАНИЦА ВХОДА НАПЕЧАТАННОЙ ПРОГРАММЫ: значение вне объявленного типа
 * отвергается ДО вычисления — во всех целях, у которых есть прогонщик.
 *
 * Улика, с которой это начиналось (снята замером на живом файле дерева
 * flang/examples/measure/natural.flang, где «Факториал» принимает `н: нат`;
 * одинаково во всех семи целях с прогонщиком):
 *
 *   {"fn":"Факториал","args":[{"n":"-3"}]}     → {"ok":true,"value":{"n":"1"}}
 *   {"fn":"Факториал","args":[{"n":"2.5"}]}    → {"ok":true,"value":{"n":"3.75"}}
 *   {"fn":"Факториал","args":[{"s":"строка"}]} → FLANG_TYPE «сравнения порядка
 *                                                допустимы только для чисел»
 *   {"fn":"Факториал","args":[{"n":"1e300"}]}  → FLANG_RECURSION_LIMIT на 10001
 *
 * Четвёртая строка — худшая. Доказательство завершения `тотальной` стоит НА
 * ТИПЕ: у `нат` есть потолок 2^53−1, ниже которого `н минус 1` точно меньше
 * `н`, и сторож убывания в такую функцию не печатается ВОВСЕ. Значение вне
 * типа выносит вместе с типом и доказательство: 1e300 минус 1 равно 1e300,
 * цепочка вечна, ловить её нечем. Тотальная функция отказывала кодом,
 * отведённым обычной.
 *
 * ── Чем сверяется ──────────────────────────────────────────────────────────
 * Эталон здесь один и тот же, что у `flang run --args`: `checkArguments` из
 * flang/src/types.mjs. Текст отказа сверяется РАВЕНСТВОМ СТРОК, а не образцом:
 * если бы напечатанная программа отказывала своими словами, у языка было бы
 * два ответа на один вопрос, и разошлись бы они молча.
 *
 * Ожидание не выписано в тесте руками, а взято у эталона: выписанное руками
 * разошлось бы с эталоном при первой же правке текста. Поэтому отдельно
 * проверяется, что эталон на каждой лжи действительно ОТКАЗЫВАЕТ, — иначе
 * сверка «оба промолчали» проходила бы сама собой.
 *
 * Последняя проверка набора — «годный вход считается». Без неё зелень означала
 * бы всего лишь, что не проходит ничего.
 */
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { mkdtempSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

import { parse } from "../src/parser.mjs"
import { checkArguments } from "../src/types.mjs"
import { emitC } from "../src/emit/c.mjs"
import { emitCsharp } from "../src/emit/csharp.mjs"
import { emitElixir } from "../src/emit/elixir.mjs"
import { emitGo } from "../src/emit/go.mjs"
import { emitJava } from "../src/emit/java.mjs"
import { emitPython } from "../src/emit/python.mjs"
import { emitRust } from "../src/emit/rust.mjs"
import { findExecutable } from "../../tools/ftsc/src/toolchain.mjs"
import { missingToolchain } from "../../tools/ftsc/test/toolchain-guard.mjs"

const источник = fileURLToPath(new URL("../examples/measure/natural.flang", import.meta.url))
const натуральное = parse(readFileSync(источник, "utf8"), "examples/measure/natural.flang")

/*
 * Второй кусок программы — про то, чего в `natural.flang` нет: запись с
 * необязательным полем (`иногда является`) и сумма с полями. Без него сетка
 * проверяла бы только числа и списки, а виды `запись` и `сумма` в таблице
 * остались бы словом.
 *
 * Приклеивается он к натуральному ОДНОЙ программой, а не печатается второй:
 * семь целей — это семь сборок, и вторая стоила бы вдвое дороже ровно за то же
 * знание.
 */
const ДОБАВКА = `модуль «Границы»

тип «Дерево»
  вариант «Лист» содержит значение: нат
  вариант «Ветвь» содержит левое: «Дерево», правое: «Дерево»

объект «Позиция»
  «название»: строка
  «цена»: число
  «примечание» иногда является строкой

тотальная функция «Цена позиции»
  принимает позиция: «Позиция»
  возвращает число
  пример «Без скидки»
    дано позиция равно запись «Позиция» с название равным "а" и цена равным 10
    ожидается 10
  позиция.цена

тотальная функция «Сумма дерева»
  принимает дерево: «Дерево»
  возвращает число
  пример «Лист»
    дано дерево равно вариант «Лист» с значение равным 7
    ожидается 7
  разбор дерево
    случай вариант «Лист» с значение как зн
      то зн
    случай вариант «Ветвь» с левое как л и правое как п
      то («Сумма дерева» от л) плюс («Сумма дерева» от п)
`

const добавка = parse(ДОБАВКА, "границы.flang")

/** Одна программа из двух: слияние объявлений, как это делает связывание. */
const программа = {
  ...натуральное,
  types: [...(натуральное.types ?? []), ...(добавка.types ?? [])],
  functions: [...натуральное.functions, ...добавка.functions],
}

const рабочий = mkdtempSync(join(tmpdir(), "flang-entry-types-"))
after(() => {
  rmSync(рабочий, { recursive: true, force: true })
})

/* Локаль машины бывает сломана (`LC_CTYPE=UTF-8` — такой локали нет): BEAM
   уходит в latin1, JDK откатывается к ASCII. Имена функций здесь кириллические,
   и без этого прогонщик отвечал бы про другую функцию. */
const СРЕДА = { ...process.env, LC_ALL: "C.UTF-8" }

/* ─────────────────────────── сетка входов ─────────────────────────── */

/**
 * Каждая строка — один вопрос к границе: имя функции, значения по именам
 * параметров (для эталона) и они же по порядку (для прогонщика).
 *
 * `ложь` говорит, чего мы ждём: `true` — эталон обязан отказать, и напечатанная
 * программа обязана отказать тем же кодом и тем же текстом; `false` — обе
 * стороны обязаны посчитать.
 */
const СЕТКА = [
  { имя: "Факториал", args: { "н": -3 }, ложь: true },
  { имя: "Факториал", args: { "н": 2.5 }, ложь: true },
  { имя: "Факториал", args: { "н": "строка" }, ложь: true },
  { имя: "Факториал", args: { "н": 1e300 }, ложь: true },
  { имя: "Факториал", args: { "н": Infinity }, ложь: true },
  { имя: "Сумма списка", args: { "элементы": 5 }, ложь: true },
  { имя: "Сумма списка", args: { "элементы": [1, "два", 3] }, ложь: true },
  { имя: "Сумма до места", args: { "элементы": [1, 2, 3], "место": -1 }, ложь: true },
  { имя: "Сумма пары", args: { "первое": 1, "второе": -1 }, ложь: true },
  /* Запись: не запись вовсе, пропущенное поле, лишнее поле, поле не того типа. */
  { имя: "Цена позиции", args: { "позиция": 7 }, ложь: true },
  { имя: "Цена позиции", args: { "позиция": { "название": "а" } }, ложь: true },
  { имя: "Цена позиции", args: { "позиция": { "название": "а", "цена": 1, "лишнее": 2 } }, ложь: true },
  { имя: "Цена позиции", args: { "позиция": { "название": "а" } }, ложь: true },
  { имя: "Цена позиции", args: { "позиция": { "название": 1, "цена": 1 } }, ложь: true },
  /* Необязательное поле — про ТИП значения, а не про его наличие: не задавать
     его можно, соврать про него нельзя. */
  { имя: "Цена позиции", args: { "позиция": { "название": "а", "цена": 1, "примечание": 7 } }, ложь: true },
  /* Сумма: чужой вариант, вариант без обязательного поля, поле вне типа поля. */
  { имя: "Сумма дерева", args: { "дерево": { variant: "Чужое", fields: {} } }, ложь: true },
  { имя: "Сумма дерева", args: { "дерево": { variant: "Лист", fields: {} } }, ложь: true },
  { имя: "Сумма дерева", args: { "дерево": { variant: "Лист", fields: { "значение": -1 } } }, ложь: true },
  {
    имя: "Сумма дерева",
    args: {
      "дерево": {
        variant: "Ветвь",
        fields: { "левое": { variant: "Лист", fields: { "значение": 1.5 } }, "правое": { variant: "Лист", fields: { "значение": 2 } } },
      },
    },
    ложь: true,
  },
  /* Годный вход обязан считаться — иначе зелень означала бы, что дверь просто
     заперта. Семь штук, и каждая про свой вид типа: `нат`, `целое` (у которого
     −2 внутри типа), список числа, запись, запись с необязательным полем
     (заданным и незаданным) и вложенная сумма.

     Необязательное поле в сетке стоит ОБЯЗАТЕЛЬНО: `иногда является` — та
     единственная форма, где эталон и таблица могли бы разойтись молча. Таблица
     помечает такой тип `ничто: true` и пропускает отсутствие; эталон
     (`checkValue`) обязан сделать ровно то же. Расходились они ровно до тех
     пор, пока `fieldMap` терял пометку, живущую на поле, а не на типе поля, —
     и тогда две строки ниже были красными на всех восьми целях. */
  { имя: "Факториал", args: { "н": 5 }, ложь: false },
  { имя: "Столько же звёзд", args: { "сколько": -2 }, ложь: false },
  { имя: "Сумма списка", args: { "элементы": [1, 2, 3] }, ложь: false },
  { имя: "Цена позиции", args: { "позиция": { "название": "а", "цена": 10 } }, ложь: false },
  { имя: "Цена позиции", args: { "позиция": { "название": "а", "цена": 10, "примечание": "спешно" } }, ложь: false },
  { имя: "Цена позиции", args: { "позиция": { "название": "а", "цена": 10, "примечание": null } }, ложь: false },
  {
    имя: "Сумма дерева",
    args: {
      "дерево": {
        variant: "Ветвь",
        fields: { "левое": { variant: "Лист", fields: { "значение": 1 } }, "правое": { variant: "Лист", fields: { "значение": 2 } } },
      },
    },
    ложь: false,
  },
]

/** Ожидание эталона: отказ (код и текст) либо «посчиталось». */
function эталон(точка) {
  const итог = checkArguments(программа, точка.имя, точка.args)
  if (точка.ложь) {
    assert.equal(итог.ok, false, `${точка.имя}: эталон обязан отвергнуть ${JSON.stringify(точка.args)}`)
    return { ok: false, code: итог.diagnostics[0].code, message: итог.diagnostics[0].message }
  }
  assert.equal(итог.ok, true, `${точка.имя}: эталон обязан принять ${JSON.stringify(точка.args)}`)
  return { ok: true }
}

const ОЖИДАНИЯ = СЕТКА.map(эталон)

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

/**
 * Сверка ответов прогонщика с эталоном. Равенством строк — и кода, и текста.
 */
function сверить(цель, ответы) {
  assert.equal(ответы.length, СЕТКА.length, `${цель}: прогонщик обязан ответить на каждый запрос`)
  ОЖИДАНИЯ.forEach((ждём, индекс) => {
    const точка = СЕТКА[индекс]
    const ответ = ответы[индекс]
    const кто = `${цель} / «${точка.имя}» на ${JSON.stringify(точка.args)}`
    if (ждём.ok) {
      assert.equal(ответ.ok, true, `${кто}: годный вход обязан считаться, а пришло ${JSON.stringify(ответ)}`)
      return
    }
    assert.equal(ответ.ok, false, `${кто}: значение вне типа обязано быть отвергнуто, а пришло ${JSON.stringify(ответ)}`)
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
const rustcBin = findExecutable("rustc", CARGO_BIN)
const goBin = findExecutable("go")
const javacBin = findExecutable("javac")
const javaBin = findExecutable("java")
const dotnetBin = findExecutable("dotnet")
const pythonBin = findExecutable("python3") ?? findExecutable("python")
const elixirBin = findExecutable("elixir")
const elixircBin = findExecutable("elixirc")

test("C: значение вне объявленного типа отвергается до вычисления", (t) => {
  if (!ccBin) {
    missingToolchain(t, "c", "компилятор C не найден — пропуск")
    return
  }
  const напечатано = emitC(программа, {})
  const каталог = разложить(напечатано.files)
  const исходники = напечатано.files.filter((файл) => файл.path.endsWith(".c")).map((файл) => файл.path)
  собрать(ccBin, ["-std=c99", "-Wall", "-Wextra", "-Werror", "-pedantic", ...исходники, "-o", "flang_cli", "-lm"], {
    cwd: каталог,
  })
  сверить("C", спросить(join(каталог, "flang_cli"), [], { cwd: каталог }))
})

test("Rust: значение вне объявленного типа отвергается до вычисления", (t) => {
  if (!rustcBin) {
    missingToolchain(t, "rust", "тулчейн Rust не найден — пропуск")
    return
  }
  const каталог = разложить(emitRust(программа, {}).files)
  mkdirSync(join(каталог, "build"), { recursive: true })
  const флаги = ["--edition", "2021", "-D", "warnings", "-C", "debuginfo=0"]
  собрать(rustcBin, [...флаги, "--crate-type", "lib", "--crate-name", "flangprogram",
    "-o", "build/libflangprogram.rlib", "src/lib.rs"], { cwd: каталог, env: { ...СРЕДА, CARGO_NET_OFFLINE: "true" } })
  собрать(rustcBin, [...флаги, "--extern", "flangprogram=build/libflangprogram.rlib",
    "-o", "build/flang_cli", "src/main.rs"], { cwd: каталог, env: { ...СРЕДА, CARGO_NET_OFFLINE: "true" } })
  сверить("Rust", спросить(join(каталог, "build", "flang_cli"), [], { cwd: каталог }))
})

test("Go: значение вне объявленного типа отвергается до вычисления", (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  const каталог = разложить(emitGo(программа, {}).files)
  const среда = {
    ...СРЕДА,
    GOFLAGS: "-mod=mod",
    GOPATH: join(рабочий, "gopath"),
    GOCACHE: join(рабочий, "gocache"),
    GO111MODULE: "on",
    GOPROXY: "off",
  }
  собрать(goBin, ["build", "-o", "flang_cli", "./cli"], { cwd: каталог, env: среда })
  сверить("Go", спросить(join(каталог, "flang_cli"), [], { cwd: каталог, env: среда }))
})

test("Java: значение вне объявленного типа отвергается до вычисления", (t) => {
  if (!javacBin || !javaBin) {
    missingToolchain(t, "java", "JDK не найден — пропуск")
    return
  }
  const напечатано = emitJava(программа, {})
  const каталог = разложить(напечатано.files)
  const исходники = напечатано.files.filter((файл) => файл.path.endsWith(".java")).map((файл) => файл.path)
  const свой = исходники.find((путь) =>
    !["Value.java", "Field.java", "FlangError.java", "Ctx.java", "Flang.java", "FlangCli.java"].includes(путь))
  собрать(javacBin, ["-Xlint:all", "-Werror", "-d", ".", ...исходники], { cwd: каталог })
  сверить("Java", спросить(javaBin, ["-cp", ".", "FlangCli", свой.replace(/\.java$/u, "")], { cwd: каталог }))
})

test("C#: значение вне объявленного типа отвергается до вычисления", (t) => {
  if (!dotnetBin) {
    missingToolchain(t, "csharp", "dotnet не найден — пропуск")
    return
  }
  const напечатано = emitCsharp(программа, {})
  const каталог = разложить(напечатано.files)
  const свой = напечатано.files.map((файл) => файл.path).find((путь) =>
    путь.endsWith(".cs")
      && !["Value.cs", "Field.cs", "FlangError.cs", "Ctx.cs", "Flang.cs", "FlangCli.cs"].includes(путь))
  const среда = {
    ...СРЕДА,
    DOTNET_CLI_TELEMETRY_OPTOUT: "1",
    DOTNET_NOLOGO: "1",
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
    DOTNET_CLI_HOME: join(рабочий, ".dotnet-home"),
  }
  собрать(dotnetBin, ["build", "-v", "quiet", "--nologo", "-o", "out"], { cwd: каталог, env: среда })
  сверить(
    "C#",
    спросить(dotnetBin, [join(каталог, "out", "flang.dll"), свой.replace(/\.cs$/u, "")], { cwd: каталог, env: среда }),
  )
})

test("Python: значение вне объявленного типа отвергается до вычисления", (t) => {
  if (!pythonBin) {
    missingToolchain(t, "python", "интерпретатор Python не найден — пропуск")
    return
  }
  const напечатано = emitPython(программа, {})
  const каталог = разложить(напечатано.files)
  const свой = напечатано.files.find((файл) => файл.path.endsWith(".py") && !файл.path.startsWith("flang_"))
  сверить("Python", спросить(pythonBin, ["-B", "flang_cli.py", свой.path.replace(/\.py$/u, "")], { cwd: каталог }))
})

test("Elixir: значение вне объявленного типа отвергается до вычисления", (t) => {
  if (!elixirBin || !elixircBin) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const напечатано = emitElixir(программа, {})
  const каталог = разложить(напечатано.files)
  const исходники = напечатано.files.filter((файл) => файл.path.endsWith(".ex")).map((файл) => файл.path)
  const свой = исходники.find((путь) => !["flang_runtime.ex", "flang_cli.ex"].includes(путь))
  const имя = напечатано.files.find((файл) => файл.path === свой).content
    .match(/^defmodule ([A-Za-z0-9_.]+) do$/mu)[1]
  const среда = { ...СРЕДА, MIX_ENV: "prod", ERL_CRASH_DUMP_SECONDS: "0" }
  mkdirSync(join(каталог, "_build"), { recursive: true })
  собрать(elixircBin, ["--warnings-as-errors", "-o", "_build", ...исходники], { cwd: каталог, env: среда })
  сверить(
    "Elixir",
    спросить(elixirBin, ["-pa", "_build", "-e", `Flang.Cli.main(["${имя}"])`], { cwd: каталог, env: среда }),
  )
})
