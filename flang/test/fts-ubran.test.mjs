/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Формат `.fts` убран, и отказ обязан быть внятным.
 *
 * ── Что здесь ловится ───────────────────────────────────────────────────────
 * До 16 августа 2026 команда читала `.fts` — модель старого проекта переводилась
 * мостом в программу flang. Проект вынесен из репозитория. Убрать чтение и не
 * поставить отказ значило бы получить на `.fts` одно из двух, и оба плохи:
 *
 *   • ERR_MODULE_NOT_FOUND на `dist/src/index.js` — сообщение про внутренности
 *     чужой сборки, из которого не понять ни что случилось, ни что делать;
 *   • разбор `.fts` разборщиком flang — гора диагностик про незнакомые слова,
 *     то есть отказ, называющий следствие вместо причины.
 *
 * ── Чего этот тест требует ──────────────────────────────────────────────────
 * Отказ приходит СВОИМ кодом, а не общим FLANG_PARSE: инструмент, читающий
 * диагностику машиной, обязан отличать «я не понял этот текст» от «этот формат
 * больше не читается». И текст обязан назвать, где взять убранное и чем
 * пользоваться сейчас: отказ без указания, что делать, стоит столько же,
 * сколько молчание.
 */
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const CLI = fileURLToPath(new URL("../bin/flang.mjs", import.meta.url))
const run = promisify(execFile)
const каталог = await mkdtemp(join(tmpdir(), "flang-fts-"))
after(() => rm(каталог, { recursive: true, force: true }))

/* Настоящая модель старого проекта, а не выдумка: ровно такой файл лежал в
   дереве и читался этой командой. */
const МОДЕЛЬ = [
  "категория «Продажи»",
  "",
  "  объект Покупка",
  "    сумма является деньгами",
  "",
  "  утилита «Рассчитать скидку»",
  "    принимает Покупка",
  "    возвращает деньги",
  "    начинает с 0",
  "",
].join("\n")

async function позвать(аргументы) {
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, ...аргументы])
    return { код: 0, stdout, stderr }
  } catch (ошибка) {
    return { код: ошибка.code ?? 1, stdout: ошибка.stdout ?? "", stderr: ошибка.stderr ?? "" }
  }
}

test("модель .fts — отказ своим кодом, а не падение и не гора диагностик разбора", async () => {
  const файл = join(каталог, "скидка.fts")
  await writeFile(файл, МОДЕЛЬ)

  const итог = await позвать(["check", файл])
  assert.notEqual(итог.код, 0, "отказ обязан быть ненулевым кодом возврата")

  const диагностика = JSON.parse(итог.stderr)
  assert.equal(диагностика.diagnostics.length, 1, "одна причина, а не список следствий")
  assert.equal(диагностика.diagnostics[0].code, "FLANG_FTS_REMOVED")

  const текст = диагностика.diagnostics[0].message
  assert.match(текст, /\.fts/u, "отказ обязан назвать формат")
  assert.match(текст, /fts-pered-udaleniem/u, "отказ обязан сказать, откуда достать убранное")
  assert.match(текст, /\.flang/u, "отказ обязан сказать, чем пользоваться сейчас")

  /* Ни следа падения на чужом модуле: именно так выглядел бы отказ, если бы
     чтение просто убрали, не поставив на его место ничего. */
  assert.doesNotMatch(итог.stderr, /ERR_MODULE_NOT_FOUND|dist\/src/u)
})

test("отказ один и тот же у всех команд, читающих файл", async () => {
  const файл = join(каталог, "скидка.fts")
  for (const команда of [["ast", файл], ["run", файл, "--function", "Рассчитать скидку"], ["test", файл], ["facts", файл, "--claims", "[]"]]) {
    const итог = await позвать(команда)
    assert.notEqual(итог.код, 0, `«${команда[0]}» не отказала`)
    assert.match(итог.stderr, /FLANG_FTS_REMOVED/u, `«${команда[0]}» отказала другим кодом: ${итог.stderr.slice(0, 200)}`)
  }
})

test("документ FTS без расширения тоже отвергается, а не даёт зелёное «функций 0»", async () => {
  /* Улика, снятая прогоном ДО этой правки: разборщик языка сам понимает
     поверхность FTS и раскладывает утилиту в `legacy` до правил и примеров, но
     функцию из неё не делает никто — это делал мост из документа ядра. Ответ
     был такой:
         flang check модель-без-расширения → {"valid":true,"functions":[]}
     то есть «проверено» на файле, из которого не проверено ничего. */
  const файл = join(каталог, "безымянная")
  await writeFile(файл, МОДЕЛЬ)
  const итог = await позвать(["check", файл])
  assert.notEqual(итог.код, 0, "зелёный ответ на документе FTS — это ложь, а не проверка")
  assert.match(итог.stderr, /FLANG_FTS_REMOVED/u)
  assert.match(итог.stderr, /утилиты наследия FTS/u)
})

test("обычная программа языка с утилитой наследия рядом продолжает работать", async () => {
  /* Отказ выше обязан ловить ровно один случай — «утилита есть, функций нет».
     Файл, где есть и то и другое, — законная программа языка. */
  const файл = join(каталог, "смешанная.flang")
  await writeFile(файл, МОДЕЛЬ + "\nтотальная функция «Удвоить»\n  принимает н: число\n  возвращает число\n  н плюс н\n")
  const итог = await позвать(["check", файл])
  assert.equal(итог.код, 0, `программа с функцией отвергнута: ${итог.stderr.slice(0, 300)}`)
  assert.equal(JSON.parse(итог.stdout).functions.length, 1)
})
