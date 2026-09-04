/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Тот же интерфейс, что «glob.mjs», подкреплённый «glob.flang» (пакет Ч385,
 * задача 9960). Импортируйте этот файл ВМЕСТО «glob.mjs», не трогая его.
 *
 * НЕ ПЕРЕНЕСЕНО: довод `exclude`. Ни один из трёх «.test.mjs» этого пакета и
 * «uzel-osnastka.mjs» не зовут `globSync` с ним (проверено `grep`ом, см.
 * ОТЧЁТ.md) — он нужен только полным обходам всего дерева
 * (`count-guard.mjs`, `word-occupancy.mjs`, `proof-ledger.mjs`), которые НЕ
 * входят в пакет Ч385 и остаются на старом `glob.mjs`. Позвавший этот файл с
 * `exclude` получит громкий отказ, а не молча иное поведение.
 */
import { resolve } from "node:path"

import { прогнатьПлан } from "./flang-bridge.mjs"

export function globSync(образец, { cwd = process.cwd(), exclude } = {}) {
  if (exclude !== undefined) {
    throw new Error(
      "glob.flang.mjs: довод «exclude» не перенесён на flang (шапка glob.flang объясняет, почему) — " +
        "для обходов, которым он нужен, зовите старый flang/test/glob.mjs",
    )
  }
  const итог = прогнатьПлан("glob.flang", "Обойти по образцу", { образец, cwd: resolve(cwd) })
  return итог.найдено ?? []
}
