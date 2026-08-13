/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * `flang/stdlib/hashmap.flang` во ВСЕХ ВОСЬМИ целях печати.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ТЕСТ, ЕСЛИ ЕСТЬ `emit-*.test.mjs`. Те сверяют цели на
 * корпусе моделей `.fts` и на программах, написанных внутри самих тестов;
 * модулей библиотеки в их корпусе нет. А словарь хешем опирается ровно на то,
 * в чём восемь рантаймов расходятся легче всего, — на арифметику IEEE-754:
 * остаток от отрицательного, остаток от 1e308, −0 в остатке, деление на
 * степень двойки. Ошибись хоть одна цель на последнем бите — и ключ уедет в
 * другую ветвь дерева, то есть словарь ПОТЕРЯЕТ КЛЮЧ, а не «слегка ошибётся».
 * Такое обязано ловиться сверкой, а не рассуждением.
 *
 * Сверяется значение: вычислитель — эталон, каждая цель обязана дать то же
 * самое на каждом входе сетки. Значения ездят размеченным JSON (числа
 * строкой), иначе −0, ±∞ и NaN не доехали бы — а половина сетки именно про них.
 *
 * Цель без тулчейна ПРОПУСКАЕТСЯ, и число пропущенных печатается: тест,
 * молчащий о том, что половина целей не проверялась, даёт ложную уверенность.
 * Полный прогон — `FTS_REQUIRE_TOOLCHAINS=all` или `scripts/test-remote.sh`.
 */
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

import { evaluate, variant } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"
import { markMeasureGuards } from "../src/totality.mjs"
import { emitC } from "../src/emit/c.mjs"
import { emitCsharp } from "../src/emit/csharp.mjs"
import { emitElixir } from "../src/emit/elixir.mjs"
import { emitGo } from "../src/emit/go.mjs"
import { emitJava } from "../src/emit/java.mjs"
import { emitJs } from "../src/emit/js.mjs"
import { emitPython } from "../src/emit/python.mjs"
import { emitRust } from "../src/emit/rust.mjs"
import { camel, pascal } from "../../tools/ftsc/src/naming.mjs"


const корень = fileURLToPath(new URL("..", import.meta.url))
const программа = markMeasureGuards(
  parse(readFileSync(`${корень}/stdlib/hashmap.flang`, "utf8"), "stdlib/hashmap.flang"),
)

const работа = mkdtempSync(join(tmpdir(), "flang-hashmap-targets-"))
after(() => rmSync(работа, { recursive: true, force: true }))

/** Инструмент в PATH; null, если его нет. */
function найти(имя) {
  const итог = spawnSync(process.platform === "win32" ? "where" : "which", [имя], { encoding: "utf8" })
  return итог.status === 0 ? итог.stdout.split("\n")[0].trim() : null
}

const ИНСТРУМЕНТ = {
  cc: найти("cc") ?? найти("gcc"),
  go: найти("go"),
  rustc: найти("rustc"),
  python: найти("python3") ?? найти("python"),
  javac: найти("javac"),
  java: найти("java"),
  dotnet: найти("dotnet"),
  elixirc: найти("elixirc"),
  elixir: найти("elixir"),
}

/* ───────────────────── сетка входов ───────────────────── */

const ПОРЯДОК = {
  "В кольцо": ["значение"],
  "Хеш числа": ["значение"],
  "Целая часть": ["значение"],
  "Путь хеша": ["хеш"],
  "Хеш ключа": ["ключ"],
  "Гнездо": ["звенья", "спуск"],
  "Развести": ["путь", "первые", "спуск", "вторые", "прежний"],
  "Положить в словарь": ["словарь", "ключ", "значение"],
  "Найти в словаре": ["словарь", "искомый", "запасное"],
  "Есть ключ в словаре": ["словарь", "искомый"],
  "Звенья словаря": ["словарь"],
  "Размер словаря": ["словарь"],
  "Ключи словаря": ["словарь"],
  "Значения словаря": ["словарь"],
  "Глубина словаря": ["словарь"],
  "Словарь из ключей": ["ключи"],
}

const БОЛЬШОЕ = { maxSteps: 400_000_000, maxDepth: 200_000 }
const зови = (имя, аргументы) => evaluate(программа, имя, аргументы, БОЛЬШОЕ)
const ключНомер = (номер) => `ключ-${String(номер).padStart(6, "0")}`
const набор = (сколько) => Array.from({ length: сколько }, (_, к) => ключНомер(к + 1))

const вопросы = []
const спроси = (имя, аргументы) => vопрос(имя, аргументы)
function vопрос(имя, аргументы) {
  вопросы.push({ имя, аргументы })
}

/* 1. Углы IEEE-754 — то, ради чего этот файл существует. */
for (const значение of [
  0, -0, 1, -1, 2, -2, 0.5, -0.5, 3.9999, -3.9999,
  4, 4 ** 13, 4 ** 14, 100000006, 100000007, 100000008,
  -100000006, -100000007, -100000008, 2 ** 31, 2 ** 32, 2 ** 52, 2 ** 53, 2 ** 53 + 2, -(2 ** 53),
  1e15, 1e16, 1e21, 1e100, 1e308, -1e308, 5e-324, -5e-324, 1e-320,
  Number.MAX_VALUE, Number.MIN_VALUE, Number.EPSILON, Infinity, -Infinity, NaN,
]) {
  спроси("В кольцо", { значение })
  спроси("Хеш числа", { значение })
  спроси("Целая часть", { значение })
  спроси("Путь хеша", { хеш: значение })
}

/* 2. Хеш строки: кириллица, суррогатные пары, пробельное, длинное. */
const лемер = (семя) => () => (семя = (семя * 48271) % 2147483647)
{
  const дальше = лемер(20260813)
  const алфавит = [..."абвгдеёжзийклмнопрстуфхцчшщъыьэюяABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_./"]
  const строки = [
    "", "a", "b", "ab", "ba", "я", "Я", "имя", "город", "страна", "ключ-000001",
    "Content-Type", "x-request-id", "😀", "😀😀", "中文", "a😀b", " ", "\n", "\t",
    "ключ с пробелом", "ОЧЕНЬ-длинный-ключ-".repeat(8),
  ]
  for (let и = 0; и < 200; и += 1) {
    let текст = ""
    for (let к = 0, длина = 1 + (дальше() % 24); к < длина; к += 1) текст += алфавит[дальше() % алфавит.length]
    строки.push(текст)
  }
  for (const ключ of строки) спроси("Хеш ключа", { ключ })
}

/* 3. Кирпичи дерева на выдуманных спусках: так проверяется само разведение. */
{
  const звено = (к, з) => ({ variant: "Звено", fields: { ключ: к, значение: з } })
  for (const спуск of [0, 1, 2, 3, 4, 5, 17, 63, 64, 4 ** 7, 100000006]) {
    for (const прежний of [0, 1, 2, 3, 5, 17, 64, 4 ** 7, 100000006]) {
      спроси("Развести", {
        путь: зови("Путь хеша", { хеш: спуск }),
        первые: [звено("а", "1")],
        спуск,
        вторые: [звено("б", "2")],
        прежний,
      })
    }
  }
  for (const звенья of [[], [звено("а", "1")], [звено("а", "1"), звено("б", "2")]]) {
    for (const спуск of [0, 7, 100000006]) спроси("Гнездо", { звенья, спуск })
  }
}

/* 4. Словари целиком: значение, поиск, размер, глубина, ключи. */
for (const n of [0, 1, 2, 3, 4, 5, 8, 16, 33, 64, 129, 256]) {
  const ключи = набор(n)
  спроси("Словарь из ключей", { ключи })
  const словарь = зови("Словарь из ключей", { ключи })
  for (const имя of ["Размер словаря", "Глубина словаря", "Ключи словаря", "Значения словаря", "Звенья словаря"]) {
    спроси(имя, { словарь })
  }
  const пробы = [
    ...ключи.slice(0, 4),
    ...(n > 0 ? [ключНомер(n), ключНомер(Math.ceil(n / 2))] : []),
    "нет такого", "", "😀", "ключ-999999",
  ]
  for (const искомый of пробы) {
    спроси("Найти в словаре", { словарь, искомый, запасное: "—" })
    спроси("Есть ключ в словаре", { словарь, искомый })
  }
  спроси("Положить в словарь", { словарь, ключ: "новичок", значение: "🌍" })
  if (n > 0) спроси("Положить в словарь", { словарь, ключ: ключНомер(1), значение: "переписано" })
}

/* 5. Настоящее столкновение хеша: гроздь обязана вести себя одинаково везде. */
{
  const по = new Map()
  const дальше = лемер(7)
  let пара = null
  for (let и = 0; и < 200000 && пара === null; и += 1) {
    const текст = `с${дальше().toString(36)}`
    const х = зови("Хеш ключа", { ключ: текст })
    if (по.has(х) && по.get(х) !== текст) пара = [по.get(х), текст]
    else по.set(х, текст)
  }
  if (пара !== null) {
    const ключи = [пара[0], пара[1], "имя", "город"]
    спроси("Словарь из ключей", { ключи })
    const словарь = зови("Словарь из ключей", { ключи })
    for (const искомый of [...ключи, "нет такого"]) {
      спроси("Найти в словаре", { словарь, искомый, запасное: "—" })
      спроси("Есть ключ в словаре", { словарь, искомый })
    }
    спроси("Размер словаря", { словарь })
    спроси("Положить в словарь", { словарь, ключ: пара[0], значение: "переписано" })
  }
}

const эталон = вопросы.map((в) => {
  try {
    return { ok: true, значение: зови(в.имя, в.аргументы) }
  } catch (беда) {
    return { ok: false, код: беда?.code ?? "?" }
  }
})

/* ───────────────────── значения на проводе ───────────────────── */

const похожеНаВариант = (з) =>
  typeof з === "object" && з !== null && !Array.isArray(з) && typeof з.variant === "string" &&
  typeof з.fields === "object" && з.fields !== null

function закодировать(значение) {
  if (значение === null || значение === undefined) return null
  if (typeof значение === "boolean") return значение
  if (typeof значение === "number") return { n: Object.is(значение, -0) ? "-0" : String(значение) }
  if (typeof значение === "string") return { s: значение }
  if (Array.isArray(значение)) return { l: значение.map(закодировать) }
  if (похожеНаВариант(значение)) {
    return { v: значение.variant, f: Object.entries(значение.fields).map(([к, э]) => [к, закодировать(э)]) }
  }
  return { r: Object.entries(значение).map(([к, э]) => [к, закодировать(э)]) }
}

function раскодировать(узел) {
  if (узел === null) return null
  if (typeof узел === "boolean") return узел
  if (Object.hasOwn(узел, "n")) return Number(узел.n)
  if (Object.hasOwn(узел, "s")) return узел.s
  if (Object.hasOwn(узел, "l")) return узел.l.map(раскодировать)
  if (Object.hasOwn(узел, "r")) {
    const запись = {}
    for (const [к, э] of узел.r) запись[к] = раскодировать(э)
    return запись
  }
  const поля = {}
  for (const [к, э] of узел.f ?? []) поля[к] = раскодировать(э)
  return variant(узел.v, поля)
}

function тоЖе(левое, правое) {
  if (typeof левое !== "object" || левое === null || typeof правое !== "object" || правое === null) {
    return Object.is(левое, правое)
  }
  if (Array.isArray(левое) || Array.isArray(правое)) {
    if (!Array.isArray(левое) || !Array.isArray(правое) || левое.length !== правое.length) return false
    return левое.every((э, и) => тоЖе(э, правое[и]))
  }
  if (похожеНаВариант(левое) || похожеНаВариант(правое)) {
    if (!похожеНаВариант(левое) || !похожеНаВариант(правое)) return false
    return левое.variant === правое.variant && тоЖе(левое.fields, правое.fields)
  }
  const кл = Object.keys(левое).sort()
  const кп = Object.keys(правое).sort()
  return кл.length === кп.length && кл.every((к, и) => к === кп[и]) && кл.every((к) => тоЖе(левое[к], правое[к]))
}

const запросы = вопросы.map((в) => ({
  fn: в.имя,
  args: ПОРЯДОК[в.имя].map((имя) => закодировать(в.аргументы[имя])),
}))

/* ───────────────────── печать, сборка, прогон ───────────────────── */

let счёт = 0
function разложить(печать) {
  счёт += 1
  const каталог = join(работа, `ц${счёт}`)
  mkdirSync(каталог, { recursive: true })
  for (const файл of печать.files) {
    mkdirSync(dirname(join(каталог, файл.path)), { recursive: true })
    writeFileSync(join(каталог, файл.path), файл.content, "utf8")
  }
  return каталог
}

function собери(бинарь, аргументы, каталог, среда, что) {
  const итог = spawnSync(бинарь, аргументы, { cwd: каталог, encoding: "utf8", env: среда, maxBuffer: 512 * 1024 * 1024 })
  assert.equal(итог.status, 0, `${что} не собрал напечатанное:\n${итог.stdout}\n${итог.stderr}`)
}

/** Один процесс на всю сетку: сборка дорога, запрос дёшев. */
function спросиУЦели(бинарь, аргументы, каталог, среда) {
  const вывод = execFileSync(бинарь, аргументы, {
    cwd: каталог,
    input: `${запросы.map((з) => JSON.stringify(з)).join("\n")}\n`,
    encoding: "utf8",
    env: среда ?? process.env,
    maxBuffer: 1024 * 1024 * 1024,
  })
  const строки = вывод.split("\n").filter((с) => с.length > 0)
  assert.equal(строки.length, запросы.length, "прогонщик обязан ответить на каждый запрос ровно один раз")
  return строки.map((с) => JSON.parse(с)).map((о) =>
    о.ok ? { ok: true, значение: раскодировать(о.value) } : { ok: false, код: о.code },
  )
}

const ЦЕЛИ = [
  {
    имя: "c",
    нужен: () => ИНСТРУМЕНТ.cc,
    прогон() {
      const печать = emitC(программа)
      const каталог = разложить(печать)
      const исходники = печать.files.filter((ф) => ф.path.endsWith(".c")).map((ф) => ф.path)
      собери(ИНСТРУМЕНТ.cc, ["-std=c99", "-O1", "-w", ...исходники, "-o", "flang_cli", "-lm"], каталог, process.env, "cc")
      return спросиУЦели(join(каталог, "flang_cli"), [], каталог)
    },
  },
  {
    имя: "go",
    нужен: () => ИНСТРУМЕНТ.go,
    прогон() {
      const каталог = разложить(emitGo(программа))
      const среда = { ...process.env, GOFLAGS: "-mod=mod", GOPROXY: "off", GOSUMDB: "off" }
      собери(ИНСТРУМЕНТ.go, ["build", "-o", "flang_cli", "./cli"], каталог, среда, "go build")
      return спросиУЦели(join(каталог, "flang_cli"), [], каталог, среда)
    },
  },
  {
    имя: "rust",
    нужен: () => ИНСТРУМЕНТ.rustc,
    прогон() {
      const каталог = разложить(emitRust(программа))
      const среда = { ...process.env, CARGO_NET_OFFLINE: "true" }
      const сборка = join(каталог, "сборка")
      mkdirSync(сборка, { recursive: true })
      const крейт = "flangprogram"
      const библиотека = join(сборка, `lib${крейт}.rlib`)
      const флаги = ["--edition", "2021", "-A", "warnings", "-C", "debuginfo=0"]
      собери(ИНСТРУМЕНТ.rustc, [...флаги, "--crate-type", "lib", "--crate-name", крейт, "-o", библиотека, "src/lib.rs"], каталог, среда, "rustc lib")
      собери(ИНСТРУМЕНТ.rustc, [...флаги, "--extern", `${крейт}=${библиотека}`, "-o", join(сборка, "flang_cli"), "src/main.rs"], каталог, среда, "rustc bin")
      return спросиУЦели(join(сборка, "flang_cli"), [], каталог, среда)
    },
  },
  {
    имя: "python",
    нужен: () => ИНСТРУМЕНТ.python,
    прогон() {
      const печать = emitPython(программа)
      const каталог = разложить(печать)
      const модуль = печать.files.find((ф) => ф.path.endsWith(".py") && !ф.path.startsWith("flang_")).path.replace(/\.py$/u, "")
      const среда = { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }
      return спросиУЦели(ИНСТРУМЕНТ.python, ["-B", "flang_cli.py", модуль], каталог, среда)
    },
  },
  {
    имя: "java",
    нужен: () => ИНСТРУМЕНТ.javac && ИНСТРУМЕНТ.java,
    прогон() {
      const печать = emitJava(программа)
      const каталог = разложить(печать)
      const исходники = печать.files.filter((ф) => ф.path.endsWith(".java")).map((ф) => ф.path)
      const класс = исходники
        .find((п) => !["Value.java", "Field.java", "FlangError.java", "Ctx.java", "Flang.java", "FlangCli.java"].includes(п))
        .replace(/\.java$/u, "")
      const среда = { ...process.env, JAVA_TOOL_OPTIONS: "", _JAVA_OPTIONS: "" }
      собери(ИНСТРУМЕНТ.javac, ["-encoding", "UTF-8", "-nowarn", "-d", ".", ...исходники], каталог, среда, "javac")
      return спросиУЦели(ИНСТРУМЕНТ.java, ["-cp", ".", "FlangCli", класс], каталог, среда)
    },
  },
  {
    имя: "csharp",
    нужен: () => ИНСТРУМЕНТ.dotnet,
    прогон() {
      const печать = emitCsharp(программа)
      const каталог = разложить(печать)
      const класс = печать.files
        .map((ф) => ф.path)
        .find((п) => п.endsWith(".cs") && !["Value.cs", "Field.cs", "FlangError.cs", "Ctx.cs", "Flang.cs", "FlangCli.cs"].includes(п))
        .replace(/\.cs$/u, "")
      const среда = { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" }
      собери(ИНСТРУМЕНТ.dotnet, ["build", "-v", "quiet", "--nologo", "-o", "out"], каталог, среда, "dotnet build")
      return спросиУЦели(ИНСТРУМЕНТ.dotnet, [join(каталог, "out", "flang.dll"), класс], каталог, среда)
    },
  },
  {
    имя: "elixir",
    нужен: () => ИНСТРУМЕНТ.elixirc && ИНСТРУМЕНТ.elixir,
    прогон() {
      const печать = emitElixir(программа)
      const каталог = разложить(печать)
      const исходники = печать.files.filter((ф) => ф.path.endsWith(".ex")).map((ф) => ф.path)
      const главный = исходники.find((п) => !["flang_runtime.ex", "flang_cli.ex"].includes(п))
      const псевдоним = печать.files.find((ф) => ф.path === главный).content.match(/^defmodule ([A-Za-z0-9_.]+) do$/mu)[1]
      mkdirSync(join(каталог, "_build"), { recursive: true })
      собери(ИНСТРУМЕНТ.elixirc, ["-o", "_build", ...исходники], каталог, process.env, "elixirc")
      return спросиУЦели(ИНСТРУМЕНТ.elixir, ["-pa", "_build", "-e", `Flang.Cli.main(["${псевдоним}"])`], каталог)
    },
  },
  {
    имя: "js",
    нужен: () => true,
    async прогон() {
      const печать = emitJs(программа)
      const каталог = разложить(печать)
      const модуль = await import(pathToFileURL(join(каталог, печать.files[0].path)).href)
      /* У напечатанного модуля СВОЙ класс варианта (у модуля с нулём
         зависимостей другого выбора нет), и разбор узнаёт вариант через
         `instanceof`. Значит аргументы надо строить его же конструкторами —
         та же оговорка, что в emit-js.test.mjs. */
      const переложить = (значение) => {
        if (Array.isArray(значение)) return значение.map(переложить)
        if (похожеНаВариант(значение)) {
          const собрать = модуль[pascal(значение.variant)] ?? модуль[`_${pascal(значение.variant)}`]
          assert.equal(typeof собрать, "function", `в напечатанном JS нет конструктора «${значение.variant}»`)
          const поля = {}
          for (const [имя, поле] of Object.entries(значение.fields)) поля[имя] = переложить(поле)
          return собрать(поля)
        }
        return значение
      }
      return вопросы.map((в) => {
        const функция = модуль[camel(в.имя)] ?? модуль[`_${camel(в.имя)}`]
        assert.equal(typeof функция, "function", `в напечатанном JS нет «${в.имя}»`)
        try {
          return { ok: true, значение: функция(...ПОРЯДОК[в.имя].map((п) => переложить(в.аргументы[п]))) }
        } catch (беда) {
          return { ok: false, код: беда?.code ?? "?" }
        }
      })
    },
  },
]

const проверено = []
const пропущено = []

for (const цель of ЦЕЛИ) {
  test(`hashmap.flang в цели ${цель.имя}: ${вопросы.length} входов, расхождений ноль`, async (ctx) => {
    if (!цель.нужен()) {
      пропущено.push(цель.имя)
      ctx.skip(`нет тулчейна для ${цель.имя}`)
      return
    }
    const ответы = await цель.прогон()
    let расхождений = 0
    const первые = []
    for (let и = 0; и < вопросы.length; и += 1) {
      const наш = эталон[и]
      const их = ответы[и]
      const сошлось = наш.ok && их.ok
        ? тоЖе(наш.значение, их.значение)
        : !наш.ok && !их.ok && наш.код === их.код
      if (!сошлось) {
        расхождений += 1
        if (первые.length < 3) {
          первые.push(
            `${вопросы[и].имя}(${JSON.stringify(вопросы[и].аргументы).slice(0, 200)}): ` +
            `эталон ${JSON.stringify(наш).slice(0, 200)}, цель ${JSON.stringify(их).slice(0, 200)}`,
          )
        }
      }
    }
    проверено.push(цель.имя)
    assert.equal(расхождений, 0, `расхождений ${расхождений} из ${вопросы.length}:\n${первые.join("\n")}`)
  })
}

test("охват сверки напечатан, а не подразумевается", () => {
  /* Число входов и число проверенных целей печатаются всегда: прогон, в
     котором половина целей молча пропущена, обязан отличаться от полного по
     одному взгляду на вывод. */
  console.log(
    `сетка словаря хешем: входов ${вопросы.length}; целей проверено ${проверено.length} из ${ЦЕЛИ.length}` +
    (пропущено.length > 0 ? `; пропущено (нет тулчейна): ${пропущено.join(", ")}` : "; пропущено 0"),
  )
  assert.ok(вопросы.length > 500, `сетка обязана быть не игрушечной, а в ней ${вопросы.length} входов`)
  assert.ok(проверено.includes("js"), "цель js доступна всегда и обязана быть проверена")
})
