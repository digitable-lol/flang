/**
 * Тесты бэкенда ftsc → TypeScript.
 *
 * Настоящего `typescript` в репозитории нет и не будет (раздел «Проверка» в
 * задании: пакет ставится во ВРЕМЕННЫЙ каталог, package.json репозитория не
 * трогаем). Если сеть недоступна или `npm i` не удался — компиляционный тест
 * пропускается через `t.skip` с объяснением, а синтаксис всё равно проверяется
 * через `node --experimental-strip-types --check` (Node 24 умеет это без
 * какой-либо установки).
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { emit } from "../src/emit/typescript.mjs"

const execFileAsync = promisify(execFile)
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
      assert.ok(file.path.length > 0)
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
  assert.equal((program.document ?? {}).utilities, undefined, "фикстура и правда без утилит верхнего уровня")
  for (const mod of program.modules) {
    assert.equal((mod.document.utilities ?? []).length, 0, "shipment не должен содержать утилит")
  }
  // Код обязан появиться, даже когда генерировать нечего, кроме типов, морфизма
  // и теоремы: интерфейс, алиасы состояний и функция морфизма — тому подтверждение.
  const moduleFile = files.find(
    (file) => file.path.endsWith(".ts") && !file.path.includes("index") && !file.path.includes("runtime"),
  )
  assert.ok(moduleFile, "должен быть файл модуля")
  assert.match(moduleFile.content, /export interface/u)
  assert.match(moduleFile.content, /export type \w+ = boolean;/u)
  assert.match(moduleFile.content, /export function \w+\(proof: /u)
  assert.ok(!files.some((file) => file.path.endsWith(".test.ts")), "без утилит не может быть тестов примеров")
})

/** Синтаксическая проверка без установки чего-либо: node 24 умеет это сам. */
test("сгенерированный TypeScript синтаксически валиден (node --experimental-strip-types)", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "ftsc-ts-syntax-"))
  try {
    for (const name of FIXTURES) {
      const { files } = await emitFixture(name)
      const dir = join(tmp, name)
      await mkdir(dir, { recursive: true })
      for (const file of files) {
        await writeFile(join(dir, file.path), file.content, "utf8")
      }
      for (const file of files) {
        await execFileAsync(process.execPath, ["--experimental-strip-types", "--check", join(dir, file.path)])
      }
    }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})

/** Пытается поставить typescript+@types/node во временный каталог. null, если не вышло. */
async function setupTypeScriptToolchain(root) {
  try {
    await execFileAsync("npm", ["i", "--no-save", "--no-audit", "--no-fund", "typescript", "@types/node"], {
      cwd: root,
      timeout: 180000,
    })
    const tsc = join(root, "node_modules", ".bin", "tsc")
    await execFileAsync(tsc, ["--version"])
    return tsc
  } catch {
    return null
  }
}

test("компиляция настоящим tsc (strict) и прогон тестов примеров через node:test", async (t) => {
  const tmp = await mkdtemp(join(tmpdir(), "ftsc-ts-build-"))
  try {
    const tsc = await setupTypeScriptToolchain(tmp)
    if (!tsc) {
      t.skip("сеть недоступна или npm i typescript не удался — компиляция пропущена (см. отчёт агента)")
      return
    }

    let expectedTests = 0
    for (const name of FIXTURES) {
      const { program, files } = await emitFixture(name)
      const dir = join(tmp, "src", name)
      await mkdir(dir, { recursive: true })
      for (const file of files) {
        await writeFile(join(dir, file.path), file.content, "utf8")
      }
      for (const mod of program.modules) {
        for (const utility of mod.document.utilities ?? []) {
          expectedTests += (utility.examples ?? []).length
        }
      }
    }

    const tsconfig = {
      compilerOptions: {
        target: "ES2020",
        module: "CommonJS",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        types: ["node"],
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src/**/*.ts"],
    }
    await writeFile(join(tmp, "tsconfig.json"), JSON.stringify(tsconfig, null, 2), "utf8")

    await execFileAsync(tsc, ["-p", "tsconfig.json"], { cwd: tmp })

    const testFiles = []
    for (const name of FIXTURES) {
      const { files } = await emitFixture(name)
      for (const file of files) {
        if (file.path.endsWith(".test.ts")) {
          testFiles.push(join(tmp, "dist", name, file.path.replace(/\.ts$/u, ".js")))
        }
      }
    }
    assert.ok(testFiles.length > 0, "должен быть хотя бы один скомпилированный тестовый файл")

    /* node:test отказывается запускать вложенный прогон, если видит свои же
       переменные окружения (NODE_TEST_CONTEXT/NODE_TEST_WORKER_ID) — этот файл
       сам выполняется под `node --test`, поэтому переменные нужно убрать перед
       запуском дочернего прогона по сгенерированному коду. */
    const childEnv = { ...process.env }
    delete childEnv.NODE_TEST_CONTEXT
    delete childEnv.NODE_TEST_WORKER_ID

    const { stdout } = await execFileAsync(process.execPath, ["--test", "--test-reporter=tap", ...testFiles], {
      cwd: tmp,
      env: childEnv,
    })
    assert.match(stdout, /# pass \d+/u, `не нашли строку с числом пройденных тестов в выводе:\n${stdout}`)
    assert.doesNotMatch(stdout, /# fail [1-9]/u, `в выводе node --test есть провалы:\n${stdout}`)
    const passMatch = stdout.match(/# pass (\d+)/u)
    assert.equal(Number(passMatch[1]), expectedTests, "число пройденных тестов должно совпадать с числом примеров в IR")
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})
