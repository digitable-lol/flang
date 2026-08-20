#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Команда `flang` из пакета npm: кто на самом деле отвечает на вызов.
 *
 * ПРАВИЛО ОДНО, И ТЕПЕРЬ БЕЗ ИСКЛЮЧЕНИЙ: отвечает ДВОИЧНЫЙ компилятор — тот же,
 * что ставит brew и что лежит в релизном архиве.
 *
 * Исключение было: печать в семь целей, которых в двоичном не было вовсе (js,
 * go, rust, python, java, csharp, elixir), уходила реализации на Node. Теперь
 * все восемь целей живут в замыкании двоичного и печатает их он сам (проверено
 * запуском по каждой), а реализации на Node не существует — её удалили коммитом
 * fe8e8a37. Оставь этот список непустым — и `flang emit --target go` из пакета
 * npm отвечал бы «Cannot find module flang/bin/flang.mjs».
 *
 * ПОЧЕМУ БЕЗ «УМНОГО» ОТКАТА НА NODE. Молчаливый откат и есть та беда, ради
 * которой всё это затевалось: две программы под одним именем, расходящиеся в
 * мелочах, — 54 расхождения из 59 вызовов, замер
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
 */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { ОТКАЗ } from "./postinstall.mjs"

const корень = dirname(dirname(fileURLToPath(import.meta.url)))
const бинарник = join(корень, "dvoichnyy", process.platform === "win32" ? "flang.exe" : "flang")

const доводы = process.argv.slice(2)

if (existsSync(бинарник)) {
  const итог = spawnSync(бинарник, доводы, { stdio: "inherit" })
  process.exit(итог.status ?? 1)
} else {
  process.stderr.write(`${ОТКАЗ("его не собрали при установке").join("\n")}\n`)
  /* Код 3 — «сломался инструмент», а не «кривой вызов» (2) и не «нашлась беда в
     предмете» (1). Разница та же, что у `flang io`, и нужна тем, кто ставит
     flang в CI: 3 означает «чините машину», а не «чините программу». */
  process.exit(3)
}
