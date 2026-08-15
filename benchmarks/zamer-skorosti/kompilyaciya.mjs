#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Замер времени КОМПИЛЯЦИИ: от исходника flang до работающей программы.
 *
 * Меряется процессами, а не вызовами внутри одного Node: пользователь платит
 * за запуск Node каждый раз, и прятать это было бы приукрашиванием. Разложение
 * по шагам считает соседний faz.mjs — там всё внутри одного процесса, и одно
 * другому не противоречит: здесь итог, там слагаемые.
 *
 *   flang check     разбор + типы + тотальность + законы + доказательства
 *   flang emit c    то же плюс генератор кода C (печать сначала ПРОВЕРЯЕТ)
 *   make            сборка полученного C компилятором cc
 *
 * Точки сравнения на той же машине и в том же чередовании:
 *   python3 -c pass     компиляции нет, но запуск и разбор есть
 *   node -e ""          то же
 *   cc на C сопоставимого размера
 *
 * Запуск: node benchmarks/zamer-skorosti/kompilyaciya.mjs [--кругов N]
 */
import { spawnSync } from "node:child_process"
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { performance } from "node:perf_hooks"
import { fileURLToPath } from "node:url"

const корень = fileURLToPath(new URL("../../", import.meta.url))

let кругов = 5
const аргументы = process.argv.slice(2)
for (let i = 0; i < аргументы.length; i += 1) {
  if (аргументы[i] === "--кругов") кругов = Number(аргументы[i + 1])
}

/* Лестница размеров: от одной функции до самого большого файла репозитория. */
const ФАЙЛЫ = [
  "flang/examples/leetcode/509-fibonacci-number.flang",
  "flang/examples/rosetta/quicksort.flang",
  "benchmarks/zamer-skorosti/programs/zadachi.flang",
  "flang/stdlib/lists.flang",
  "flang/self/lexer.flang",
  "flang/self/parser.flang",
  "flang/self/types.flang",
]

function прогон(команда, аргс, опции = {}) {
  const т0 = performance.now()
  const итог = spawnSync(команда, аргс, {
    encoding: "utf8",
    maxBuffer: 1 << 28,
    cwd: опции.cwd ?? корень,
    env: { ...process.env, LC_ALL: "C.UTF-8" },
  })
  const мс = performance.now() - т0
  if (итог.status !== 0 && опции.мягко !== true) {
    throw new Error(`${команда} ${аргс.join(" ")} → ${итог.status}: ${(итог.stderr ?? "").slice(0, 400)}`)
  }
  return { мс, вывод: итог.stdout ?? "", ошибка: итог.stderr ?? "", код: итог.status }
}

function свод(значения) {
  const s = [...значения].sort((a, b) => a - b)
  const медиана = s.length % 2 === 1 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
  return {
    медиана: Number(медиана.toFixed(1)),
    минимум: Number(s[0].toFixed(1)),
    максимум: Number(s[s.length - 1].toFixed(1)),
  }
}

const каталог = mkdtempSync(join(tmpdir(), "zamer-kompilyacii-"))
const собрано = {}
const размеры = {}
const итоги = {}
const прибавить = (ключ, шаг, мс) => (((итоги[ключ] ??= {})[шаг] ??= []).push(мс))

/* Сведения о файле — строки и функции — берутся у самого компилятора: считать
   функции регулярным выражением значило бы считать не то, что он видит. */
for (const файл of ФАЙЛЫ) {
  const { вывод } = прогон("node", ["flang/bin/flang.mjs", "check", файл])
  const итог = JSON.parse(вывод)
  const строк = прогон("bash", ["-c", `wc -l < ${JSON.stringify(файл)}`]).вывод.trim()
  собрано[файл] = {
    строк: Number(строк),
    функций: итог.functions.length,
    тотальных: итог.functions.filter((f) => f.total).length,
  }
}

/* Прогрев: по разу на каждый шаг, чтобы кэш страниц не достался только первому
   участнику чередования. */
for (const файл of ФАЙЛЫ) {
  прогон("node", ["flang/bin/flang.mjs", "check", файл])
  const где = join(каталог, "прогрев")
  rmSync(где, { recursive: true, force: true })
  прогон("node", ["flang/bin/flang.mjs", "emit", файл, "--target", "c", "--out", где])
  прогон("make", ["-C", где, "-j4"], { мягко: true })
}
прогон("python3", ["-c", "pass"])
прогон("node", ["-e", ""])

for (let круг = 0; круг < кругов; круг += 1) {
  /* Точки сравнения — внутри того же круга, а не отдельным блоком. */
  прибавить("python3 -c pass", "запуск", прогон("python3", ["-c", "pass"]).мс)
  прибавить('node -e ""', "запуск", прогон("node", ["-e", ""]).мс)
  /* Написанный руками C того же порядка размера — чтобы было видно, стоит ли
     напечатанный C компилятору дороже обычного при равном числе строк. */
  прибавить("etalon.c (223 строки, C руками)", "cc -O2", прогон("bash", [
    "-c",
    `cc -std=c99 -O2 -o ${JSON.stringify(join(каталог, "etalon"))} benchmarks/zamer-skorosti/programs/etalon.c -lm`,
  ]).мс)

  for (const файл of ФАЙЛЫ) {
    прибавить(файл, "flang check", прогон("node", ["flang/bin/flang.mjs", "check", файл]).мс)

    const где = join(каталог, `круг${круг}`)
    rmSync(где, { recursive: true, force: true })
    прибавить(файл, "flang emit c", прогон("node", ["flang/bin/flang.mjs", "emit", файл, "--target", "c", "--out", где]).мс)

    if (размеры[файл] === undefined) {
      let байт = 0
      let строкC = 0
      for (const имя of readdirSync(где)) {
        if (!имя.endsWith(".c") && !имя.endsWith(".h")) continue
        байт += statSync(join(где, имя)).size
      }
      /* Отдельно — только модуль программы, без рантайма: рантайм одинаков у
         всех и его рост от размера программы не зависит. */
      const модуль = readdirSync(где).filter((и) => и.endsWith(".c") && !и.startsWith("flang_"))
      for (const имя of модуль) {
        строкC += прогон("bash", ["-c", `wc -l < ${JSON.stringify(join(где, имя))}`]).вывод.trim() * 1
      }
      размеры[файл] = { "байт C всего": байт, "строк C модуля": строкC }
    }

    прибавить(файл, "make (cc -O2)", прогон("make", ["-C", где, "-j4"], { мягко: true }).мс)
    /* Сборка одного только модуля, без рантайма: рантайм собирается всегда
       одинаково, и его секунда не должна выглядеть ростом от программы. */
    rmSync(где, { recursive: true, force: true })
  }
}

/* Сборка рантайма отдельно: постоянная часть make, одна на любую программу. */
{
  const где = join(каталог, "рантайм")
  rmSync(где, { recursive: true, force: true })
  прогон("node", [
    "flang/bin/flang.mjs",
    "emit",
    "flang/examples/leetcode/509-fibonacci-number.flang",
    "--target",
    "c",
    "--out",
    где,
  ])
  прогон("bash", ["-c", `cd ${JSON.stringify(где)} && make flang_runtime.o`], { мягко: true })
  for (let круг = 0; круг < кругов; круг += 1) {
    прогон("bash", ["-c", `cd ${JSON.stringify(где)} && rm -f flang_runtime.o`])
    прибавить("рантайм C (9 628 строк)", "cc -O2 -c flang_runtime.c", прогон("bash", ["-c", `cd ${JSON.stringify(где)} && make flang_runtime.o`]).мс)
  }
  rmSync(где, { recursive: true, force: true })
}

rmSync(каталог, { recursive: true, force: true })

const вывод = {}
for (const [ключ, шаги] of Object.entries(итоги)) {
  вывод[ключ] = { ...(собрано[ключ] ?? {}), ...(размеры[ключ] ?? {}) }
  for (const [шаг, значения] of Object.entries(шаги)) вывод[ключ][шаг] = свод(значения)
}

process.stdout.write(`${JSON.stringify({ кругов, замеры: вывод }, null, 2)}\n`)
