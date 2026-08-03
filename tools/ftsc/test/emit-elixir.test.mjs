/**
 * Тесты бэкенда Elixir (tools/ftsc/src/emit/elixir.mjs).
 *
 * Требования из SPEC.md/задания к тестам бэкенда:
 *   1. emit() отрабатывает на всех четырёх фикстурах, список файлов непустой;
 *   2. вывод детерминирован — два вызова дают побайтово одинаковый результат;
 *   3. discount/delivery/shop реально собираются (elixirc
 *      --warnings-as-errors) и проходят ExUnit-тесты примеров настоящим
 *      тулчейном;
 *   4. shipment (без утилит) даёт валидный компилируемый код.
 * Если тулчейна (elixir/elixirc) нет — тесты 3 и 4 пропускаются (t.skip),
 * без имитации успеха.
 *
 * Как запускается компиляция и тесты без mix (см. также комментарий в
 * src/emit/elixir.mjs):
 *   - `elixirc --warnings-as-errors -o <каталог> <все .ex файлы>` — один
 *     вызов на ВСЕ файлы lib/ сразу. Порядок аргументов неважен: elixirc сам
 *     разрешает ссылки между модулями (в том числе `%Модуль{}` на структуру
 *     из другого файла) за несколько проходов компиляции пакета файлов —
 *     проверено эмпирически, а не предположено.
 *   - Для запуска тестов каждый `test/**\/*_test.exs` выполняется ОТДЕЛЬНЫМ
 *     вызовом `elixir -pa <каталог с .beam> <файл>`: `-pa` добавляет уже
 *     скомпилированные .beam в путь кода, поэтому файлу теста не нужен `-r`
 *     каждого lib-файла по отдельности. Раздельные вызовы нужны потому, что
 *     `ExUnit.start()` внутри файла теста не рассчитан на повторный вызов в
 *     одном процессе (см. tools/ftsc/SPEC.md, раздел 5, пункт 4: тесты
 *     обязаны реально проходить на штатном фреймворке — ExUnit).
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { emit, target } from "../src/emit/elixir.mjs"
import { findExecutable } from "../src/toolchain.mjs"
import { missingToolchain } from "./toolchain-guard.mjs"

const here = fileURLToPath(new URL(".", import.meta.url))
const fixturesDir = join(here, "fixtures")
const FIXTURE_NAMES = ["discount", "delivery", "shipment", "shop"]

async function loadFixture(name) {
  return JSON.parse(await readFile(join(fixturesDir, `${name}.ir.json`), "utf8"))
}

const elixirBin = findExecutable("elixir")
const elixircBin = findExecutable("elixirc")

function run(command, args, options) {
  return spawnSync(command, args, { encoding: "utf8", ...options })
}

async function writeFiles(root, files) {
  for (const file of files) {
    const full = join(root, file.path)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, file.content, "utf8")
  }
}

/* Рекурсивно ищет файлы с данным расширением под каталогом (без внешних
   зависимостей — глобы вида "lib/**\/*.ex" в spawnSync не раскрываются
   оболочкой, потому что мы не используем шелл). */
async function findFiles(root, extension) {
  const found = []
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith(extension)) found.push(full)
    }
  }
  if (existsSync(root)) await walk(root)
  return found
}

test("target: описывает id/name/extension/toolchain бэкенда Elixir", () => {
  assert.equal(target.id, "elixir")
  assert.equal(target.extension, ".ex")
  assert.ok(Array.isArray(target.toolchain.probe))
  assert.ok(Array.isArray(target.toolchain.test))
})

test("emit(): отрабатывает на всех фикстурах и печатает непустой список файлов", async () => {
  for (const name of FIXTURE_NAMES) {
    const program = await loadFixture(name)
    const files = emit(program, { projectName: program.project })
    assert.ok(Array.isArray(files), `${name}: emit() обязан вернуть массив`)
    assert.ok(files.length > 0, `${name}: список файлов не должен быть пустым`)
    for (const file of files) {
      assert.equal(typeof file.path, "string")
      assert.equal(typeof file.content, "string")
      assert.ok(file.content.length > 0, `${name}: ${file.path} не должен быть пустым`)
    }
    assert.ok(
      files.some((f) => f.path.endsWith(".ex")),
      `${name}: нет ни одного .ex файла`,
    )
  }
})

test("emit(): вывод детерминирован — два вызова дают побайтово одинаковый результат", async () => {
  for (const name of FIXTURE_NAMES) {
    const program = await loadFixture(name)
    const first = emit(program, { projectName: program.project })
    const second = emit(program, { projectName: program.project })
    assert.deepEqual(first, second, `${name}: emit() не детерминирован`)
    assert.equal(JSON.stringify(first), JSON.stringify(second), `${name}: сериализованный вывод отличается`)
  }
})

/** Компилирует все .ex из <root>/lib одним вызовом elixirc в <root>/_build. */
function compile(root) {
  const sources = []
  return findFiles(join(root, "lib"), ".ex").then((files) => {
    sources.push(...files)
    return run(elixircBin, ["--warnings-as-errors", "-o", join(root, "_build"), ...sources], { cwd: root })
  })
}

test("discount/delivery/shop: сгенерированный Elixir реально собирается и проходит ExUnit", async (t) => {
  if (!elixircBin || !elixirBin) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден (ни в PATH, ни в FTS_TOOLCHAIN_PATH) — пропуск")
    return
  }
  for (const name of ["discount", "delivery", "shop"]) {
    await t.test(name, async () => {
      const program = await loadFixture(name)
      const files = emit(program, { projectName: program.project })
      const root = await mkdtemp(join(tmpdir(), `ftsc-elixir-${name}-`))
      try {
        await writeFiles(root, files)

        const built = await compile(root)
        assert.equal(built.status, 0, `elixirc --warnings-as-errors упал:\n${built.stdout}\n${built.stderr}`)

        const testFiles = await findFiles(join(root, "test"), "_test.exs")
        assert.ok(testFiles.length > 0, `${name}: не найдено ни одного файла тестов ExUnit`)

        for (const testFile of testFiles) {
          const result = run(elixirBin, ["-pa", join(root, "_build"), testFile], { cwd: root })
          assert.equal(result.status, 0, `ExUnit упал для ${testFile}:\n${result.stdout}\n${result.stderr}`)
          assert.match(result.stdout, /\d+ passed/u, `нет признака прогона тестов в выводе ExUnit:\n${result.stdout}`)
        }
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    })
  }
})

test("shipment: без утилит даёт валидный компилируемый Elixir (elixirc --warnings-as-errors)", async (t) => {
  if (!elixircBin) {
    missingToolchain(t, "elixir", "тулчейн Elixir не найден — пропуск")
    return
  }
  const program = await loadFixture("shipment")
  const files = emit(program, { projectName: program.project })
  const root = await mkdtemp(join(tmpdir(), "ftsc-elixir-shipment-"))
  try {
    await writeFiles(root, files)

    const built = await compile(root)
    assert.equal(built.status, 0, `elixirc --warnings-as-errors упал:\n${built.stdout}\n${built.stderr}`)

    /* Утилит нет — тестировать нечего, но список сгенерированных файлов не
       должен внезапно содержать тесты примеров (их не из чего строить). */
    const testFiles = await findFiles(join(root, "test"), "_test.exs")
    assert.equal(testFiles.length, 0, "shipment не содержит утилит — тестов примеров быть не должно")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
