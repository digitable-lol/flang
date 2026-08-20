#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * flang-lsp — команда языкового сервера из пакета npm.
 *
 * Здесь ничего не решается: вызов уходит двоичному компилятору, `flang lsp`.
 * Тот же приём и та же причина, что у команды `flang`
 * (`packaging/flang-zapusk.mjs`): `bin` в npm обязан быть файлом, который
 * запустит `node`, иначе на Windows пакет не поставится.
 *
 * ЧТО ЗДЕСЬ БЫЛО. Транспорт LSP на JavaScript — рамки `Content-Length`, склейка
 * потока, очередь сообщений, — 190 строк, а решал, чем является сообщение,
 * `flang/src/lsp.mjs`. Его удалили вместе со всей реализацией на JavaScript
 * (коммит fe8e8a37), и эта команда перестала запускаться вовсе: «Cannot find
 * module flang/src/lsp.mjs». При этом `bin` в package.json на неё по-прежнему
 * указывал, то есть пакет вёз человеку заведомо мёртвую команду.
 *
 * Сервер у двоичного — тот же слой языка (`flang/self/lsp.flang`), и разбирает
 * он те же рамки. Расхождение со свидетелем одно, и двоичный называет его сам в
 * «flang lsp --help»: у программы с «использует» беда импортированного модуля
 * уходит в журнал редактора, а не подчёркивается в его буфере.
 *
 * Доводы не разбираются и не отсеиваются: их разбирает двоичный, и второй
 * разборщик рядом разошёлся бы с ним первым же ключом. `--help` и неизвестный
 * довод — тоже его дело.
 */
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { ОТКАЗ } from "../../packaging/postinstall.mjs"

const корень = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const бинарник = join(корень, "dvoichnyy", process.platform === "win32" ? "flang.exe" : "flang")

if (existsSync(бинарник)) {
  const итог = spawnSync(бинарник, ["lsp", ...process.argv.slice(2)], { stdio: "inherit" })
  process.exit(итог.status ?? 1)
} else {
  /* В stderr, а не в stdout: редактор читает оттуда рамки протокола и на первом
     же лишнем байте теряет связь. Код 3 — «сломался инструмент». */
  process.stderr.write(`${ОТКАЗ("его не собрали при установке").join("\n")}\n`)
  process.exit(3)
}
