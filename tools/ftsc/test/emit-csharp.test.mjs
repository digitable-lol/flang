/**
 * Тесты бэкенда ftsc → C#.
 *
 * В этой системе, скорее всего, нет ни dotnet SDK, ни mono — проверяем это
 * честно через `command -v`, а не притворяемся. Если тулчейна нет — тест
 * компиляции пропускается (`t.skip`) и вместо него делаются структурные
 * проверки сгенерированного текста (SPEC.md этого достаточно не считает
 * заменой компиляции, но это единственное, что можно проверить без
 * тулчейна, и явно честнее, чем ничего).
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFile, exec } from "node:child_process"
import { promisify } from "node:util"

import { emit } from "../src/emit/csharp.mjs"

const execFileAsync = promisify(execFile)
const execAsync = promisify(exec)
const FIXTURES = ["discount", "delivery", "shipment", "shop"]

async function loadFixture(name) {
  const url = new URL(`./fixtures/${name}.ir.json`, import.meta.url)
  return JSON.parse(await readFile(url, "utf8"))
}

async function emitFixture(name) {
  const program = await loadFixture(name)
  return { program, files: emit(program, { projectName: program.project }) }
}

test("emit() возвращает непустой список файлов для всех фикстур", async () => {
  for (const name of FIXTURES) {
    const { files } = await emitFixture(name)
    assert.ok(Array.isArray(files), `${name}: результат должен быть массивом`)
    assert.ok(files.length > 0, `${name}: список файлов не должен быть пустым`)
    for (const file of files) {
      assert.equal(typeof file.path, "string")
      assert.ok(file.path.endsWith(".cs"), `${name}: ${file.path} должен иметь расширение .cs`)
      assert.equal(typeof file.content, "string")
      assert.ok(file.content.length > 0, `${name}/${file.path}: файл не должен быть пустым`)
    }
  }
})

test("emit() детерминирован: два вызова дают побайтово одинаковый результат", async () => {
  for (const name of FIXTURES) {
    const program = await loadFixture(name)
    const first = emit(program, { projectName: program.project })
    const second = emit(program, { projectName: program.project })
    assert.deepEqual(first, second, `${name}: повторный вызов emit() дал другой результат`)
  }
})

test("shipment (морфизмы и теорема, без утилит) даёт валидный код", async () => {
  const { program, files } = await emitFixture("shipment")
  for (const mod of program.modules) {
    assert.equal((mod.document.utilities ?? []).length, 0, "shipment не должен содержать утилит")
  }
  const moduleFile = files.find((file) => !["FtsRuntime.cs", "FtsTests.cs"].includes(file.path))
  assert.ok(moduleFile, "должен быть файл модуля")
  assert.match(moduleFile.content, /namespace \w+/u)
  assert.match(moduleFile.content, /public sealed record \w+/u)
  assert.match(moduleFile.content, /using \w+ = System\.Boolean;/u, "именованное состояние обязано стать булевым алиасом")
  assert.match(moduleFile.content, /public static class Morphisms/u)
  assert.match(moduleFile.content, /public static \w+ \w+\(\w+ proof\)/u)
  // Без утилит нет примеров — самостоятельного тестового раннера быть не должно.
  assert.ok(!files.some((file) => file.path === "FtsTests.cs"), "без утилит не может быть раннера тестов")
})

test("структура сгенерированного кода: namespace, record, модификаторы, все примеры на месте", async () => {
  for (const name of FIXTURES) {
    const { program, files } = await emitFixture(name)
    const runtime = files.find((file) => file.path === "FtsRuntime.cs")
    assert.ok(runtime, `${name}: должен быть общий FtsRuntime.cs`)
    assert.match(runtime.content, /class FtsPropertyViolationException/u)

    for (const mod of program.modules) {
      const utilities = mod.document.utilities ?? []
      const examples = utilities.flatMap((u) => u.examples ?? [])
      if (examples.length === 0) continue
      const tests = files.find((file) => file.path === "FtsTests.cs")
      assert.ok(tests, `${name}: должен быть FtsTests.cs, раз есть примеры`)
      assert.match(tests.content, /public static class Program/u)
      assert.match(tests.content, /public static int Main\(string\[\] args\)/u)
      assert.match(tests.content, /passed\}\/\{total\} passed/u)
      for (const example of examples) {
        assert.ok(tests.content.includes(example.name), `${name}: пример «${example.name}» должен упоминаться в FtsTests.cs`)
      }
    }

    for (const mod of program.modules) {
      const file = files.find(
        (f) => !["FtsRuntime.cs", "FtsTests.cs"].includes(f.path) && f.content.includes(`Модуль FTS: «${mod.name}»`),
      )
      assert.ok(file, `${name}: должен быть файл для модуля «${mod.name}»`)
      assert.match(file.content, /namespace \w+(\.\w+)*\s*\n\{/u)
      for (const structure of mod.document.structures ?? []) {
        assert.ok(
          file.content.includes(`Объект FTS «${structure.name}»`),
          `${name}: структура «${structure.name}» должна быть подписана исходным именем`,
        )
        assert.match(file.content, /public sealed record \w+/u)
      }
      for (const utility of mod.document.utilities ?? []) {
        assert.ok(
          file.content.includes(`Утилита FTS «${utility.name}»`),
          `${name}: утилита «${utility.name}» должна быть подписана исходным именем`,
        )
        assert.match(file.content, /public static \w+ \w+\(\w+ input\)/u)
      }
    }
  }
})

test("функтор между модулями печатает функцию преобразования домен → кодомен", async () => {
  const { program, files } = await emitFixture("shop")
  assert.ok((program.functors ?? []).length > 0, "фикстура shop обязана содержать функтор")
  for (const functor of program.functors) {
    const file = files.find((f) => f.content.includes(`Функтор FTS: «${functor.name}»`))
    assert.ok(file, `функтор «${functor.name}» должен получить отдельный файл`)
    assert.match(file.content, /public static class Transform/u)
    for (const object of functor.objects) {
      assert.ok(
        file.content.includes(`объект «${object.from}» → «${object.to}»`),
        "комментарий должен называть исходный и целевой объект",
      )
    }
  }
})

/** Возвращает имя первого найденного тулчейна C# или null. */
async function detectCsharpToolchain() {
  for (const candidate of ["dotnet", "csc", "mcs", "mono"]) {
    try {
      await execAsync(`command -v ${candidate}`)
      return candidate
    } catch {
      // пробуем следующий кандидат
    }
  }
  return null
}

test("компиляция настоящим тулчейном C# и прогон FtsTests.cs", async (t) => {
  const toolchain = await detectCsharpToolchain()
  if (!toolchain) {
    t.skip("ни dotnet, ни csc, ни mcs, ни mono не найдены в этой системе — компиляция пропущена (см. отчёт агента)")
    return
  }

  const tmp = await mkdtemp(join(tmpdir(), "ftsc-cs-build-"))
  try {
    const allFiles = []
    for (const name of FIXTURES) {
      const { files } = await emitFixture(name)
      allFiles.push(...files.map((file) => ({ ...file, fixture: name })))
    }
    // Одно приложение из всех фикстур сразу дало бы по несколько FtsRuntime/FtsTests
    // с одинаковыми namespace — компилируем каждую фикстуру в своей папке отдельным
    // мини-проектом, как и предполагает контракт emit() (раздел 5 SPEC.md).
    for (const name of FIXTURES) {
      const dir = join(tmp, name)
      await mkdir(dir, { recursive: true })
      const { files } = await emitFixture(name)
      for (const file of files) await writeFile(join(dir, file.path), file.content, "utf8")
      const hasEntryPoint = files.some((file) => file.path === "FtsTests.cs")
      if (!hasEntryPoint) continue // shipment: компилировать саму библиотеку можно, но нечего запускать

      if (toolchain === "dotnet") {
        await writeFile(
          join(dir, "app.csproj"),
          `<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <OutputType>Exe</OutputType>\n    <TargetFramework>net8.0</TargetFramework>\n    <Nullable>enable</Nullable>\n    <ImplicitUsings>disable</ImplicitUsings>\n  </PropertyGroup>\n</Project>\n`,
          "utf8",
        )
        const { stdout } = await execFileAsync("dotnet", ["run", "--project", dir], { cwd: dir, timeout: 180000 })
        assert.match(stdout, /\d+\/\d+ passed/u)
        assert.match(stdout, /^(\d+)\/\1 passed/mu, `не все примеры прошли:\n${stdout}`)
      } else {
        const compiler = toolchain === "csc" ? "csc" : "mcs"
        const sources = files.map((file) => join(dir, file.path))
        await execFileAsync(compiler, ["-out:app.exe", ...sources], { cwd: dir })
        const runner = compiler === "csc" ? ["dotnet", [join(dir, "app.exe")]] : ["mono", [join(dir, "app.exe")]]
        const { stdout } = await execFileAsync(runner[0], runner[1], { cwd: dir })
        assert.match(stdout, /\d+\/\d+ passed/u)
        assert.match(stdout, /^(\d+)\/\1 passed/mu, `не все примеры прошли:\n${stdout}`)
      }
    }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})
