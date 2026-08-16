// Команды пакета обязаны работать так, как их ставит npm — символьной ссылкой.
//
// Версия 0.4.0 уехала в реестр молчащей: `flang`, `fts` и `fts-mcp` после
// установки печатали ноль байт и завершались с кодом 0. Причина — страж точки
// входа, сравнивавший `import.meta.url` с `process.argv[1]` как строки. npm
// кладёт в node_modules/.bin/ ссылку, Node ссылки разрешает, пути расходятся,
// main() не вызывается. Ни один прогон этого не поймал: тесты и проверка в
// конвейере публикации запускали файлы напрямую через `node <путь>`, где пути
// совпадают.
//
// Поэтому проверка идёт именно через ссылку, а не через прямой путь: прямой
// путь был зелёным всё это время.

import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)))

// Те же цели, что объявлены в bin пакета, — и это не список руками: он
// вычитывается из самого package.json. Пять команд из семи уехали вместе со
// старым проектом FTS (тег `fts-pered-udaleniem`), и список, записанный здесь
// константой, пережил бы это молча — проверка осталась бы зелёной, проверяя
// команды, которых пакет больше не объявляет.
const КОМАНДЫ = Object.entries(JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).bin)
  .map(([имя, файл]) => ({ имя, файл: файл.replace(/^\.\//u, "") }))
  .sort((а, б) => а.имя.localeCompare(б.имя))

test("команды пакета отвечают при запуске через символьную ссылку", () => {
  // Пустой или урезанный список — не «нечего проверять», а поломка: проверка,
  // которой нечего перебирать, зелена ровно так же, как исправная.
  assert.ok(КОМАНДЫ.length >= 2, `в bin пакета команд ${КОМАНДЫ.length} — package.json урезали?`)
  const каталог = mkdtempSync(join(tmpdir(), "flang-bin-"))
  try {
    for (const { имя, файл } of КОМАНДЫ) {
      assert.ok(existsSync(join(ROOT, файл)), `bin «${имя}» указывает на ${файл}, которого в дереве нет`)
      const ссылка = join(каталог, имя)
      symlinkSync(join(ROOT, файл), ссылка)

      // Смотрим оба потока и не смотрим на код возврата: справка у команд
      // называется по-разному, и отказ «неизвестный ключ» — это тоже ответ.
      // Дефект был не в тексте, а в полной немоте при коде 0, поэтому проверка
      // ровно одна: программа хоть что-то сказала.
      const итог = spawnSync(process.execPath, [ссылка, "help"], {
        encoding: "utf8",
        timeout: 30_000,
      })
      const сказано = `${итог.stdout ?? ""}${итог.stderr ?? ""}`.trim()

      assert.notEqual(
        сказано.length,
        0,
        `${имя} через ссылку не напечатал ничего (код ${итог.status}) — ровно так молчала 0.4.0`,
      )
    }
  } finally {
    rmSync(каталог, { recursive: true, force: true })
  }
})

test("flang через ссылку разбирает модуль и отдаёт JSON", () => {
  const каталог = mkdtempSync(join(tmpdir(), "flang-bin-"))
  try {
    const ссылка = join(каталог, "flang")
    symlinkSync(join(ROOT, "flang/bin/flang.mjs"), ссылка)

    const вывод = execFileSync(
      process.execPath,
      [ссылка, "check", join(ROOT, "flang/stdlib/lists.flang")],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    )

    const итог = JSON.parse(вывод)
    assert.equal(итог.valid, true)
    assert.ok(итог.functions.length > 0, "разбор дал пустой список функций")
  } finally {
    rmSync(каталог, { recursive: true, force: true })
  }
})
