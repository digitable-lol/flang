/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"

/**
 * Запущен ли этот модуль как программа, а не подключён как библиотека.
 *
 * Наивная проверка `import.meta.url === pathToFileURL(process.argv[1]).href`
 * ломается ровно там, где эти файлы и живут — в установленном пакете. npm
 * ставит объявленные в `bin` команды СИМВОЛЬНЫМИ ССЫЛКАМИ в
 * `node_modules/.bin/`, а Node по умолчанию разрешает ссылки: `argv[1]` —
 * путь ссылки, `import.meta.url` — путь настоящего файла. Строки не совпадают,
 * условие ложно, `main()` не вызывается. Программа завершается с кодом 0, не
 * напечатав ни байта — то есть самым тихим из возможных способов.
 *
 * Так и вышло с 0.4.0: `flang`, `fts` и `fts-mcp` после `npm i` молчали, при
 * том что тот же файл, запущенный через `node путь/к/файлу`, работал. Три
 * остальные команды пакета этой проверки не имели и потому уцелели.
 *
 * Сравниваем разрешённые пути. `realpathSync` бросает, если пути нет, —
 * в этом случае честно отвечаем «нет»: причин запускаться у модуля тоже нет.
 */
export function invokedDirectly(moduleUrl: string): boolean {
  const invoked = process.argv[1]
  if (invoked === undefined) return false
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(invoked)
  } catch {
    return false
  }
}
