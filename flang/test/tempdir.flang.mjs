/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Тот же интерфейс, что «tempdir.mjs», подкреплённый «tempdir.flang» (пакет
 * Ч385, задача 9960). Импортируйте этот файл ВМЕСТО «tempdir.mjs», не
 * трогая его.
 *
 * ЧТО ОСТАЁТСЯ ЗДЕСЬ, А НЕ УЕЗЖАЕТ НА FLANG, И ПОЧЕМУ (шапка «tempdir.flang»
 * — та же мысль подробнее): устойчивость к сигналу — свойство ЭТОГО
 * процесса («node --test» гоняет каждый файл теста отдельным процессом и
 * убивает его сигналом), а не плана внутри чужого короткоживущего
 * `flang io`. Три крючка ниже — `after()`, `process.on("exit")`,
 * SIGINT/SIGTERM/SIGHUP/SIGQUIT — байт в байт то же устройство, что было в
 * оригинале; поменялось только ЧТО они зовут внутри (план «Убрать каталог»
 * вместо `rmSync` напрямую).
 */
import { existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after } from "node:test"

import { прогнатьПлан, прогнатьФункцию } from "./flang-bridge.mjs"

/** Сигналы, после которых `after()` уже не позовут. */
const СИГНАЛЫ = ["SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"]

/** Заведённые этим процессом каталоги — всё, что предстоит убрать. */
const свои = new Set()

let крючкиПовешены = false

/** Куда класть каталоги прогона: корень сторожа, если он задан, иначе `os.tmpdir()`. */
export function корень() {
  const заданный = process.env.FLANG_TEST_TMPDIR
  if (заданный !== undefined && заданный !== "") {
    mkdirSync(заданный, { recursive: true })
    return заданный
  }
  return tmpdir()
}

/** Убрать всё своё. Синхронно и молча: зовётся в том числе из обработчика выхода. */
export function убратьЗаСобой() {
  for (const путь of свои) {
    try {
      прогнатьПлан("tempdir.flang", "Убрать каталог", { путь })
    } catch {
      /* Уборка не имеет права уронить прогон: код выхода принадлежит тестам. */
    }
    свои.delete(путь)
  }
}

function повеситьКрючки() {
  if (крючкиПовешены) return
  крючкиПовешены = true

  try {
    after(убратьЗаСобой)
  } catch {
    /* Прогон не имеет права упасть об устройство уборки. */
  }

  process.on("exit", убратьЗаСобой)

  for (const сигнал of СИГНАЛЫ) {
    const крючок = () => {
      убратьЗаСобой()
      process.off(сигнал, крючок)
      process.kill(process.pid, сигнал)
    }
    process.on(сигнал, крючок)
  }
}

/**
 * Завести временный каталог прогона под именем `flang-<метка>-XXXXXX`.
 *
 * Каталог убирается при любом исходе: зелёном, красном и убитом сигналом.
 */
export function рабочийКаталог(метка) {
  повеситьКрючки()
  const итог = прогнатьПлан("tempdir.flang", "Завести рабочий каталог", { корень: корень(), метка })
  const путь = итог.путь
  свои.add(путь)
  return путь
}

/** Подкаталог, куда уводится временное чужих инструментов. */
export function чужоеВремя(каталог) {
  const путь = join(каталог, "tmp")
  if (!existsSync(путь)) mkdirSync(путь, { recursive: true })
  return путь
}

/**
 * Окружение для сборки: `process.env` плюс увод чужого временного внутрь
 * `каталог`, плюс `добавки` теста (они сильнее — тест знает про свою цель).
 * Спред `process.env`/`добавки` не вычисление — он остаётся здесь тем же
 * выражением, что был; ПЯТЬ ключей и их общее значение считает flang.
 */
export function средаСборки(каталог, добавки = {}) {
  const переменные = прогнатьФункцию("tempdir.flang", "Переменные чужого времени", { каталог })
  return {
    ...process.env,
    TMPDIR: переменные.tmpdir,
    TMP: переменные.tmp,
    TEMP: переменные.temp,
    GOTMPDIR: переменные.gotmpdir,
    MSBUILDDISABLENODEREUSE: переменные.msbuilddisablenodereuse,
    ...добавки,
  }
}
