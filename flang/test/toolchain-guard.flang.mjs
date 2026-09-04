/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Тот же интерфейс, что «toolchain-guard.mjs», подкреплённый «toolchain-guard.flang»
 * (пакет Ч385, задача 9960). Решение «обязателен ли тулчейн» и «куда ещё
 * смотреть, кроме PATH» считает flang; «t.skip»/«assert.fail» — дело
 * `node:test`, которого flang не знает и не обязан знать, — остаётся здесь.
 *
 * Импортируйте этот файл ВМЕСТО «toolchain-guard.mjs», не трогая его: он не
 * удалён и не изменён, это ровно то же место, на которое переключается
 * тестовый файл, когда переходит на новую обвязку (см. ОТЧЁТ.md, «Граница
 * вызова»).
 */
import assert from "node:assert/strict"
import { homedir } from "node:os"
import { delimiter, join } from "node:path"

import { прогнатьПлан, прогнатьФункцию } from "./flang-bridge.mjs"

/** Бэкенды, тулчейн которых обязан присутствовать в этом прогоне. */
export function requiredToolchains() {
  const значение = String(process.env.FTS_REQUIRE_TOOLCHAINS ?? "")
  return прогнатьФункцию("toolchain-guard.flang", "Токены тулчейнов", { значение })
}

/** Обязан ли тулчейн бэкенда `id` быть в системе. */
export function toolchainRequired(id) {
  const значение = String(process.env.FTS_REQUIRE_TOOLCHAINS ?? "")
  return прогнатьФункцию("toolchain-guard.flang", "Тулчейн обязателен ли", {
    значение,
    идентификатор: String(id),
  })
}

/**
 * Единственная точка, где решается судьба отсутствующего тулчейна: пропуск
 * или падение. Байт в байт то же сообщение, что было у оригинала — это
 * текст, который читает человек в логе CI, а не решение, которое считает
 * flang.
 */
export function missingToolchain(t, id, reason) {
  if (toolchainRequired(id)) {
    assert.fail(
      `тулчейн «${id}» обязан быть в этой джобе (FTS_REQUIRE_TOOLCHAINS=${process.env.FTS_REQUIRE_TOOLCHAINS}), ` +
        `но его нет: ${reason}. Поставьте тулчейн, укажите каталог в FTS_TOOLCHAIN_PATH или уберите «${id}» ` +
        `из FTS_REQUIRE_TOOLCHAINS — молча пропустить этот тест нельзя.`,
    )
  }
  return t.skip(reason)
}

/** Каталоги, где имеет смысл искать компилятор помимо `PATH`. */
export function extraBinDirectories() {
  const путьТулчейнов = String(process.env.FTS_TOOLCHAIN_PATH ?? "")
  const домашний = homedir() ?? ""
  return прогнатьФункцию("toolchain-guard.flang", "Домашние каталоги бинарников", {
    путьТулчейнов,
    домашний,
  })
}

/**
 * Абсолютный путь к исполняемому файлу или `null`, если его нет в системе.
 * Список каталогов (PATH-каталоги, затем `extra`, затем стандартные) считает
 * JS — он и раньше был просто перечислением без логики; логика («какие
 * каталоги», «в каком порядке») считается уже на flang, в
 * `extraBinDirectories`. Проверка «существует ли» — план, и план ПЕРЕЧИСЛЯЕТ
 * каждый каталог-кандидат и смотрит, есть ли `name` среди имён: словарь
 * поручений не даёт отдельного «есть ли файл», а читать СОДЕРЖИМОЕ кандидата
 * ради одной проверки существования непосильно дорого на настоящих
 * исполняемых — `/usr/local/bin/node` весит 205 380 840 байт (шапка
 * `toolchain-guard.flang` называет число и первую версию, которая на этом
 * встала).
 */
export function findExecutable(name, extra = []) {
  const каталоги = []
  for (const каталог of String(process.env.PATH ?? "").split(delimiter)) {
    if (каталог) каталоги.push(каталог)
  }
  for (const каталог of [...extra, ...extraBinDirectories()]) {
    каталоги.push(каталог)
  }
  if (каталоги.length === 0) return null
  const итог = прогнатьПлан("toolchain-guard.flang", "Найти исполняемый", { имя: name, каталоги })
  return итог.найдено ? итог.путь : null
}
