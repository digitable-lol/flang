/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * ЗАМОК БЕЗ СКЛАДА — проверки того единственного утверждения, ради которого он
 * заводился: **программа собирается из замка, когда исходников зависимостей на
 * диске нет вовсе.**
 *
 * Проверка устроена подделкой, а не осмотром: настоящая программа с тремя
 * импортами копируется в пустой каталог ВМЕСТЕ С ЗАМКОМ И БЕЗ ЗАВИСИМОСТЕЙ, и
 * `flang check` обязан отдать то же самое, байт в байт. Контрольный опыт
 * рядом: тот же каталог без замка обязан отказать `FLANG_IMPORT_NOT_FOUND` —
 * иначе проверка доказывала бы не работу замка, а то, что зависимости где-то
 * нашлись.
 *
 * Остальное — отказы. Замок, которому верят на слово, ничем не лучше
 * отсутствия замка: испорченный груз и правленый список обязаны отвергаться, а
 * не собираться «из того, что распаковалось».
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { СХЕМА_ЗАМКА, адресМодуля, модулиЗамка, разборИзАдреса, собратьЗамок } from "../src/lockfile.mjs"
import { каноническийJSON, снятьПозиции } from "../src/digest.mjs"
import { parse } from "../src/parser.mjs"

const корень = fileURLToPath(new URL("../..", import.meta.url))
const CLI = join(корень, "flang", "bin", "flang.mjs")
/* Настоящая программа, а не заготовка: три импорта из stdlib, 78 КБ
   исходников зависимостей, и она проверяется целиком. */
const ПРОГРАММА = join(корень, "flang", "examples", "web", "orders-api.flang")

const позвать = (аргументы, {ждатьОтказ = false} = {}) => {
  try {
    return execFileSync(process.execPath, [CLI, ...аргументы], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  } catch (ошибка) {
    if (!ждатьОтказ) throw ошибка
    return `${ошибка.stdout ?? ""}${ошибка.stderr ?? ""}`
  }
}

const вовремя = () => mkdtempSync(join(tmpdir(), "flang-zamok-"))

test("замок собирается и разворачивается в тот же разбор", () => {
  const текст = readFileSync(join(корень, "flang", "stdlib", "sets.flang"), "utf8")
  const дерево = parse(текст, "sets.flang")
  const снято = снятьПозиции(дерево)
  assert.equal(каноническийJSON(разборИзАдреса(адресМодуля(дерево))), каноническийJSON(снято))
})

test("в замке лежат сами зависимости, а не ссылки на них", async () => {
  const замок = await собратьЗамок(ПРОГРАММА, parse)
  assert.equal(замок.схема, СХЕМА_ЗАМКА)
  assert.equal(замок.модули.length, 3)
  assert.deepEqual(
    замок.модули.map((м) => м.имя).sort(),
    ["Множество строк", "Словарь", "Строки"],
  )
  /* Ссылка на склад была бы короткой; здесь лежит КОД, и он длинный. Это цена
     подхода, и её надо видеть в проверке, а не только в отчёте. */
  for (const модуль of замок.модули) {
    assert.ok(модуль.адрес.length > 200, `адрес «${модуль.имя}» подозрительно короток`)
    assert.ok(модуль.функций > 0)
  }
  const модули = модулиЗамка(замок, join(корень, "flang", "examples", "web"))
  assert.equal(модули.size, 3)
})

test("испорченный груз и правленый список замка отвергаются", async () => {
  const замок = await собратьЗамок(ПРОГРАММА, parse)
  const корневой = join(корень, "flang", "examples", "web")

  const сГрузом = JSON.parse(JSON.stringify(замок))
  /* Порча внутри груза: печать модуля пересчитывается по РАСПАКОВАННОМУ, а не
     читается, поэтому подмена обязана вскрыться. */
  const другой = await собратьЗамок(ПРОГРАММА, parse)
  сГрузом.модули[0].адрес = другой.модули[1].адрес
  assert.throws(() => модулиЗамка(сГрузом, корневой), /печать/)

  const сПечатью = JSON.parse(JSON.stringify(замок))
  сПечатью.модули[0].печать = "0".repeat(64)
  assert.throws(() => модулиЗамка(сПечатью, корневой), /печать замка/)

  const чужаяСхема = { ...замок, схема: СХЕМА_ЗАМКА + 1 }
  assert.throws(() => модулиЗамка(чужаяСхема, корневой), /схем/)
})

test("программа собирается из замка, когда исходников зависимостей нет", () => {
  const где = вовремя()
  try {
    const эталон = позвать(["check", ПРОГРАММА])
    const замок = позвать(["lock", ПРОГРАММА])
    cpSync(ПРОГРАММА, join(где, "orders-api.flang"))

    /* Контрольный опыт ПЕРВЫМ и без замка: тот же каталог обязан отказать.
       Без него проверка ниже доказывала бы не работу замка, а то, что
       зависимости где-то нашлись. */
    const безЗамка = позвать(["check", join(где, "orders-api.flang")], { ждатьОтказ: true })
    assert.match(безЗамка, /FLANG_IMPORT_NOT_FOUND/)

    writeFileSync(join(где, "flang.lock"), замок, "utf8")
    const изЗамка = позвать(["check", join(где, "orders-api.flang")])
    /* Побайтово: замок обязан давать ТО ЖЕ дерево, а не похожее. */
    assert.equal(изЗамка, эталон)
  } finally {
    rmSync(где, { recursive: true, force: true })
  }
})

test("испорченный замок — отказ, а не тихая сборка из чего попало", () => {
  const где = вовремя()
  try {
    const замок = JSON.parse(позвать(["lock", ПРОГРАММА]))
    cpSync(ПРОГРАММА, join(где, "orders-api.flang"))
    замок.модули[0].печать = "0".repeat(64)
    writeFileSync(join(где, "flang.lock"), `${JSON.stringify(замок)}\n`, "utf8")
    const вывод = позвать(["check", join(где, "orders-api.flang")], { ждатьОтказ: true })
    assert.match(вывод, /FLANG_LOCK/)
  } finally {
    rmSync(где, { recursive: true, force: true })
  }
})
