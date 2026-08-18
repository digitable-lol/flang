/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * `flang check` ПРОГОНЯЕТ ПРИМЕРЫ, и потому программа с ложным примером не
 * печатается ни в одну цель.
 *
 * ── Улика ДО правки, снятая прогоном ────────────────────────────────────────
 *
 * Файл на девять строк — `«Удвоить»` от 2 при `ожидается 5`:
 *
 *   $ flang check  проба.flang   → {"valid":true,…,"diagnostics":[]}   код 0
 *   $ flang test   проба.flang   → {"valid":false,…,"failed":1}        код 1
 *   $ flang emit --target c      → код 0, 46 937 байт flang_cli.c и Makefile
 *   $ flang emit --target rust   → код 0, Cargo.toml, Makefile и src
 *
 * То есть программа с заведомо ложным примером ПЕЧАТАЛАСЬ в цель, а сказать об
 * этом умела ровно одна команда из трёх. `commandCheck` не звала прогона
 * примеров вовсе.
 *
 * Это ровно та же дыра, что была здесь с надзором: список проверок жил внутри
 * одной команды, а весь смысл проверок в том, что непроверенное НЕ ПЕЧАТАЕТСЯ.
 * `flang/conc/examples/supervision.flang` без блока `надзор «Цех»` давал `check`
 * с кодом 1 и `FLANG_UNCOVERED_FAILURE`, а `emit --target go` — код 0 и 80 155
 * байт Go; починено это было переносом проверок в `checkProgram`, то есть в
 * общее место на все команды. Примеры переехали туда же и той же дорогой.
 *
 * Контракт языка говорит про `пример` прямо: он часть программы, а не тест
 * сбоку, и прогоняется при КАЖДОЙ проверке (`docs/site/getting-started.ru.md`,
 * там же и слова «`check` считает их и без `test`»). Проза обещала это раньше,
 * чем реализация делала.
 *
 * ── Почему изъятием, а не выдумкой ──────────────────────────────────────────
 *
 * Улика ниже строится ИЗЪЯТИЕМ из живого файла дерева: у `stdlib/lists.flang`
 * в одном примере подменяется ожидаемое число. Выдуманная программа доказывала
 * бы, что дыра бывает; изъятие доказывает, что она есть на том коде, который
 * лежит в дереве. И обе половины изъятия проверяются: ЦЕЛЫЙ файл обязан
 * проходить `check` и печататься — иначе проба зеленела бы от того, что не
 * проходит ничего.
 *
 * ── Чего этот файл НЕ утверждает ────────────────────────────────────────────
 *
 * Он не утверждает, что примеры заменяют доказательство. Пример говорит о тех
 * значениях, которые автор назвал сам, и ведомость (`--proof`) отличает его от
 * доказанного словом «сетка». Здесь закрыт зазор, в котором ложный пример НЕ
 * МЕШАЛ печати, — не больше и не меньше.
 */

import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { рабочийКаталог } from "./tempdir.mjs"

const run = promisify(execFile)
const cli = fileURLToPath(new URL("../bin/flang.mjs", import.meta.url))
const lists = fileURLToPath(new URL("../stdlib/lists.flang", import.meta.url))

const workdir = рабочийКаталог("check-primery")

let счётчик = 0
async function песочница(имя, текст) {
  const каталог = join(workdir, `s${(счётчик += 1)}`)
  await mkdir(каталог, { recursive: true })
  const путь = join(каталог, имя)
  await writeFile(путь, текст, "utf8")
  return путь
}

/** Успешный прогон: JSON из stdout. */
async function успех(аргументы) {
  const { stdout } = await run("node", [cli, ...аргументы], { maxBuffer: 64 * 1024 * 1024 })
  return JSON.parse(stdout)
}

/** Отказ: код возврата, stdout и разобранный отчёт из stderr. */
async function отказ(аргументы) {
  try {
    await run("node", [cli, ...аргументы], { maxBuffer: 64 * 1024 * 1024 })
  } catch (error) {
    return { code: error.code, stdout: error.stdout, report: JSON.parse(error.stderr) }
  }
  assert.fail(`вызов ${аргументы.join(" ")} обязан был отказать`)
}

/**
 * Изъятие: у ПЕРВОГО примера ожидаемое число сдвигается на единицу.
 *
 * Меняется один литерал, всё остальное остаётся тем же файлом: ни типы, ни
 * тотальность, ни ядро от этого не меняются — значит отказ, если он будет,
 * может прийти только от примера.
 */
const ЛОЖНЫЙ_ПРИМЕР = (исходник) => {
  const строки = исходник.split("\n")
  const место = строки.findIndex((строка) => /^\s+ожидается -?\d+$/u.test(строка))
  assert.notEqual(место, -1, "в lists.flang не стало примеров с числом — изъятию нечего портить")
  строки[место] = строки[место].replace(/(-?\d+)$/u, (число) => String(Number(число) + 1))
  return строки.join("\n")
}

test("check на ложном примере: код 1, FLANG_EXAMPLE и имя примера в отказе", async () => {
  /* Половина изъятия, без которой вторая ничего не значит: ЦЕЛЫЙ файл проходит
     проверку, и примеры у него есть. Иначе отказ ниже мог бы случиться по любой
     другой причине. */
  const исходник = await readFile(lists, "utf8")
  const целое = await успех(["check", lists])
  assert.equal(целое.valid, true, "stdlib/lists.flang обязан проходить проверку")
  const прогон = await успех(["test", lists])
  assert.ok(прогон.total > 0, "в lists.flang не стало примеров — мерить нечего")

  const порченый = await песочница("списки.flang", ЛОЖНЫЙ_ПРИМЕР(исходник))
  const { code, stdout, report } = await отказ(["check", порченый])
  assert.equal(code, 1, "ошибка модели, а не вызова — код 1")
  assert.equal(stdout, "", "отказ не имеет права оставить в stdout зелёный отчёт")
  assert.equal(report.valid, false)

  const примерные = report.diagnostics.filter((беда) => беда.code === "FLANG_EXAMPLE")
  assert.equal(
    примерные.length,
    1,
    `подменён один пример, а диагностик про примеры ${примерные.length}: ` +
      JSON.stringify(report.diagnostics.map((б) => б.code)),
  )
  /* Отказ обязан назвать ФУНКЦИЮ, ИМЯ ПРИМЕРА, ожидавшееся и полученное — всё
     то же, что называет `flang test`. Отказ, по которому не найти испорченную
     строку, заставляет искать её вторым инструментом. */
  const сорванный = прогон.results[0]
  assert.match(примерные[0].message, new RegExp(`пример «${сорванный.example}»`, "u"), примерные[0].message)
  assert.match(примерные[0].message, new RegExp(`функции «${сорванный.function}»`, "u"), примерные[0].message)
  assert.match(примерные[0].message, /ожидалось .+, получено /u, примерные[0].message)
})

test("emit не печатает программу с ложным примером — ни в одну цель", async () => {
  const порченый = await песочница("списки.flang", ЛОЖНЫЙ_ПРИМЕР(await readFile(lists, "utf8")))
  const цели = (await readdir(fileURLToPath(new URL("../src/emit", import.meta.url)), { withFileTypes: true }))
    .filter((запись) => запись.isFile() && запись.name.endsWith(".mjs"))
    .map((запись) => запись.name.replace(/\.mjs$/u, ""))
  assert.ok(цели.length >= 7, `целей печати нашлось ${цели.length} — список не собрался`)

  for (const цель of цели) {
    const { code, stdout, report } = await отказ(["emit", порченый, "--target", цель])
    assert.equal(code, 1, `цель ${цель}: печать не отменена`)
    assert.equal(stdout, "", `цель ${цель}: напечатано ${stdout.length} байт непроверенного`)
    assert.ok(
      report.diagnostics.some((беда) => беда.code === "FLANG_EXAMPLE"),
      `цель ${цель}: печать отменена не примером: ${JSON.stringify(report.diagnostics.map((б) => б.code))}`,
    )
  }
})

test("отказ идёт от ПРОВЕРКИ, а не от печати: --no-check печатает то же, что и до правки", async () => {
  /* Без этой пробы «emit отказал» можно было бы объяснить сломанным бэкендом.
     Ключ снимает проверку — и та же программа печатается, значит отменяла её
     именно проверка, и отменяла ровно примером. */
  const порченый = await песочница("списки.flang", ЛОЖНЫЙ_ПРИМЕР(await readFile(lists, "utf8")))
  const напечатано = await успех(["emit", порченый, "--target", "c", "--no-check"])
  assert.ok(
    напечатано.files.some((файл) => (файл.content ?? "").length > 0),
    "--no-check не напечатал ничего — проба про отмену печати ничего не доказывает",
  )
})

test("check и test судят одинаково: ложный пример красен у обоих", async () => {
  /* Два места, где решают, годна ли программа, разошлись бы молча. */
  const порченый = await песочница("списки.flang", ЛОЖНЫЙ_ПРИМЕР(await readFile(lists, "utf8")))
  const проверка = await отказ(["check", порченый])
  const прогон = await отказ(["test", порченый])
  assert.equal(проверка.code, 1)
  assert.equal(прогон.code, 1)
  /* `test` печатает подробности прогона, `check` — диагностику; общее у них то,
     что оба назвали сорвавшимся ОДИН и тот же пример. */
  const сорванные = прогон.report.results.filter((строка) => строка.passed === false)
  assert.equal(сорванные.length, 1, "прогон нашёл не один сорванный пример")
  assert.match(
    проверка.report.diagnostics.find((беда) => беда.code === "FLANG_EXAMPLE").message,
    new RegExp(`пример «${сорванные[0].example}»`, "u"),
  )
})

test("ведомость тоже не печатается на ложном примере", async () => {
  /* `check --proof` — та же команда проверки, и зелёная ведомость на программе,
     чей пример не сходится, обещала бы читателю больше, чем есть. */
  const порченый = await песочница("списки.flang", ЛОЖНЫЙ_ПРИМЕР(await readFile(lists, "utf8")))
  const { code, stdout, report } = await отказ(["check", порченый, "--proof"])
  assert.equal(code, 1)
  assert.equal(stdout, "", "ведомость напечатана на непроверенной программе")
  assert.ok(report.diagnostics.some((беда) => беда.code === "FLANG_EXAMPLE"))
})

test("цена: у целой программы отчёты команд не изменились", async () => {
  /* Правка обязана краснеть только там, где пример ложен. На целом файле
     `check` отвечает ровно тем же, чем отвечал: `valid` истинно, диагностик
     нет, а поля отчёта — те же. */
  const проверка = await успех(["check", lists])
  assert.deepEqual(проверка.diagnostics, [])
  assert.equal(проверка.valid, true)
  assert.ok(Array.isArray(проверка.functions) && проверка.functions.length > 0)
})
