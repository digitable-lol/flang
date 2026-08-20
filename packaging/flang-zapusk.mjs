#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Команда `flang` из пакета npm: кто на самом деле отвечает на вызов.
 *
 * ПРАВИЛО ОДНО: отвечает ДВОИЧНЫЙ компилятор — тот же, что ставит brew и что
 * лежит в релизном архиве. Реализация на Node зовётся ровно в одном случае:
 * печать в одну из семи целей, которых в двоичном нет вовсе (js, go, rust,
 * python, java, csharp, elixir). Всё остальное, включая `emit --target c`,
 * `--help` и неизвестные цели, идёт двоичному.
 *
 * ПОЧЕМУ НЕ НАОБОРОТ И ПОЧЕМУ БЕЗ «УМНОГО» ОТКАТА НА NODE. Молчаливый откат и
 * есть та беда, ради которой всё это затевалось: две программы под одним именем,
 * расходящиеся в мелочах, — 54 расхождения из 59 вызовов, замер
 * `packaging/sverka-ustanovok.flang`. Поэтому, если двоичного нет, здесь ОТКАЗ с
 * названной причиной, а не тихая подмена компилятора.
 *
 * ЧЕМ ЭТО СТОИТ. Один запуск Node поверх бинарника: 36 мс на этой машине против
 * 956 мс, которые сам бинарник тратит на `check flang/stdlib/lists.flang`, —
 * 3,8 %. Реализация на Node тот же вызов делает за 4036 мс. Так делают esbuild и
 * swc, и по той же причине: `bin` в npm обязан быть файлом, который запустит
 * `node`, иначе на Windows пакет не поставится.
 *
 * ПОЧЕМУ ЭТО НЕ НА FLANG. Запускателю нужно отдать чужой программе свой stdin,
 * stdout и код возврата, а до его работы никакого flang в системе ещё нет: на
 * flang эта программа была бы кругом — чтобы её прочитать, нужен компилятор,
 * который она и запускает. Это названная граница, а не обход правила.
 *
 * Ключи среды:
 *   FLANG_CHEREZ_NODE=1   принудительно звать реализацию на Node
 */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { ОТКАЗ } from "./postinstall.mjs"

const корень = dirname(dirname(fileURLToPath(import.meta.url)))
const бинарник = join(корень, "dvoichnyy", process.platform === "win32" ? "flang.exe" : "flang")
const наNode = join(корень, "flang", "bin", "flang.mjs")

/* Семь целей печати, написанных на flang, но не входящих в замыкание бинарника
   (`flang/self/emit-*.flang`). Список выписан здесь, а не выведен: у бинарника
   спросить нечего — он про них знает только то, что их у него нет. Разойдётся
   список с бинарником — покраснеет сверка установок, у неё все восемь целей в
   корпусе. */
const ЦЕЛИ_ЧЕРЕЗ_NODE = new Set(["js", "go", "rust", "python", "java", "csharp", "elixir"])

/** Нужна ли этому вызову реализация на Node. */
export function черезNode(доводы) {
  if (доводы[0] !== "emit") return false
  for (let место = 1; место < доводы.length; место += 1) {
    const довод = доводы[место]
    if (довод === "--target") return ЦЕЛИ_ЧЕРЕЗ_NODE.has(доводы[место + 1])
    if (довод.startsWith("--target=")) return ЦЕЛИ_ЧЕРЕЗ_NODE.has(довод.slice("--target=".length))
  }
  return false
}

const доводы = process.argv.slice(2)

if (черезNode(доводы) || process.env.FLANG_CHEREZ_NODE === "1") {
  const итог = spawnSync(process.execPath, [наNode, ...доводы], { stdio: "inherit" })
  process.exit(итог.status ?? 1)
} else if (existsSync(бинарник)) {
  const итог = spawnSync(бинарник, доводы, { stdio: "inherit" })
  process.exit(итог.status ?? 1)
} else {
  process.stderr.write(`${ОТКАЗ("его не собрали при установке").join("\n")}\n`)
  /* Код 3 — «сломался инструмент», а не «кривой вызов» (2) и не «нашлась беда в
     предмете» (1). Разница та же, что у `flang io`, и нужна тем, кто ставит
     flang в CI: 3 означает «чините машину», а не «чините программу». */
  process.exit(3)
}
