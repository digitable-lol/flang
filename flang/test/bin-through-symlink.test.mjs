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
import { mkdtempSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)))

// Те же цели, что объявлены в bin пакета. ftsc, ftsvm и ftspec стража не имели
// и потому уцелели, но проверяются наравне: завтра страж может появиться и там.
const КОМАНДЫ = [
  { имя: "flang", файл: "flang/bin/flang.mjs" },
  { имя: "fts", файл: "dist/src/cli.js" },
  { имя: "ftsc", файл: "tools/ftsc/bin/ftsc.mjs" },
  { имя: "ftsvm", файл: "tools/ftsvm/bin/ftsvm.mjs" },
  { имя: "ftspec", файл: "tools/ftspec/bin/ftspec.mjs" },
]

test("команды пакета отвечают при запуске через символьную ссылку", () => {
  const каталог = mkdtempSync(join(tmpdir(), "flang-bin-"))
  try {
    for (const { имя, файл } of КОМАНДЫ) {
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
