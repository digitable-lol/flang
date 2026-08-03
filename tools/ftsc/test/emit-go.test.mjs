/**
 * Тесты бэкенда Go (tools/ftsc/src/emit/go.mjs).
 *
 * Требования из SPEC.md/задания к тестам бэкенда:
 *   1. emit() отрабатывает на всех фикстурах, список файлов непустой;
 *   2. вывод детерминирован — два вызова дают побайтово одинаковый результат;
 *   3. discount/delivery/gateway/shop реально собираются и проходят go test
 *      настоящим тулчейном;
 *   4. shipment (без утилит) даёт валидный компилируемый код;
 *   5. настоящий проект tools/ftsc/stdlib — собранный резолвером и линковщиком,
 *      а не заранее записанным IR — печатается, форматируется, проходит vet и
 *      go test.
 * Если тулчейна нет — тесты 3, 4 и 5 пропускаются (t.skip), без имитации успеха.
 *
 * Пункт 5 добавлен не для полноты: фикстуры покрывают лишь те конструкции,
 * которые в них попали, а stdlib содержит и совпадение имени утилиты с именем
 * состояния, и функтор, переносящий поле-состояние между категориями. Обе
 * конструкции давали не компилирующийся Go, и ни один тест на фикстурах этого
 * не видел.
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { emit, target } from "../src/emit/go.mjs"
import { link } from "../src/link.mjs"
import { resolveProject } from "../src/resolve.mjs"
import { findExecutable } from "../src/toolchain.mjs"
import { missingToolchain } from "./toolchain-guard.mjs"

const here = fileURLToPath(new URL(".", import.meta.url))
const fixturesDir = join(here, "fixtures")
const stdlibDir = resolve(here, "../stdlib")
/* gateway — фикстура краевых случаев: имя утилиты совпадает с именем состояния
   (в Go это переобъявление в одном пространстве имён пакета), необязательное
   поле стоит перед обязательным, а функтор переносит и состояние в состояние
   другой категории, и обязательное поле в необязательное. */
const FIXTURE_NAMES = ["discount", "delivery", "gateway", "shipment", "shop"]

async function loadFixture(name) {
  return JSON.parse(await readFile(join(fixturesDir, `${name}.ir.json`), "utf8"))
}

/** Проект stdlib как его собирает сам ftsc: резолвер + линковщик, не фикстура. */
async function stdlibProgram() {
  return link(await resolveProject(stdlibDir), { project: "project" })
}

const goBin = findExecutable("go")
const gofmtBin = findExecutable("gofmt")

function run(command, args, options) {
  return spawnSync(command, args, {
    encoding: "utf8",
    env: { ...process.env, GOFLAGS: "-mod=mod", GOPROXY: "off", GOSUMDB: "off" },
    ...options,
  })
}

async function writeFiles(root, files) {
  for (const file of files) {
    const full = join(root, file.path)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, file.content, "utf8")
  }
}

test("target: описывает id/name/extension/toolchain бэкенда Go", () => {
  assert.equal(target.id, "go")
  assert.equal(target.extension, ".go")
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
    /* go.mod и хотя бы один .go файл обязаны быть в любом выводе. */
    assert.ok(
      files.some((f) => f.path === "go.mod"),
      `${name}: нет go.mod`,
    )
    assert.ok(
      files.some((f) => f.path.endsWith(".go")),
      `${name}: нет ни одного .go файла`,
    )
  }
})

test("emit(): вывод детерминирован — два вызова дают побайтово одинаковый результат", async () => {
  for (const name of FIXTURE_NAMES) {
    const program = await loadFixture(name)
    const first = emit(program, { projectName: program.project })
    const second = emit(program, { projectName: program.project })
    assert.deepEqual(first, second, `${name}: emit() не детерминирован`)
    /* На случай, если бы кто-то сравнивал объекты по ссылкам полей — сверяем
       и сериализованный вид, это и есть «побайтово одинаковый результат». */
    assert.equal(JSON.stringify(first), JSON.stringify(second), `${name}: сериализованный вывод отличается`)
  }
})

test("discount/delivery/gateway/shop: сгенерированный Go реально собирается и проходит go test", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден (ни в PATH, ни в FTS_TOOLCHAIN_PATH) — пропуск")
    return
  }
  for (const name of ["discount", "delivery", "gateway", "shop"]) {
    await t.test(name, async () => {
      const program = await loadFixture(name)
      const files = emit(program, { projectName: program.project })
      const root = await mkdtemp(join(tmpdir(), `ftsc-go-${name}-`))
      try {
        await writeFiles(root, files)

        if (gofmtBin) {
          const fmt = run(gofmtBin, ["-l", "."], { cwd: root })
          assert.equal(fmt.status, 0, `gofmt -l упал: ${fmt.stderr}`)
          assert.equal(fmt.stdout.trim(), "", `gofmt -l нашёл неотформатированные файлы:\n${fmt.stdout}`)
        }

        const vet = run(goBin, ["vet", "./..."], { cwd: root })
        assert.equal(vet.status, 0, `go vet упал:\n${vet.stdout}\n${vet.stderr}`)

        const goTest = run(goBin, ["test", "./..."], { cwd: root })
        assert.equal(goTest.status, 0, `go test упал:\n${goTest.stdout}\n${goTest.stderr}`)
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    })
  }
})

test("stdlib: настоящий проект библиотеки печатается, форматируется и проходит go test", async (t) => {
  if (!goBin) {
    t.skip("тулчейн Go не найден — пропуск")
    return
  }
  const program = await stdlibProgram()
  /* Проект должен быть не пустее, чем есть: иначе тест «зазеленел» бы на
     сломанном резолвере, ничего не напечатав и ничего не собрав. */
  assert.ok(program.modules.length >= 8, `в stdlib ожидались модули, найдено ${program.modules.length}`)
  assert.ok(program.functors.length >= 2, `в stdlib ожидались функторы, найдено ${program.functors.length}`)

  const files = emit(program, { projectName: program.project })
  const root = await mkdtemp(join(tmpdir(), "ftsc-go-stdlib-"))
  try {
    await writeFiles(root, files)

    if (gofmtBin) {
      const fmt = run(gofmtBin, ["-l", "."], { cwd: root })
      assert.equal(fmt.status, 0, `gofmt -l упал: ${fmt.stderr}`)
      assert.equal(fmt.stdout.trim(), "", `gofmt -l нашёл неотформатированные файлы:\n${fmt.stdout}`)
    }

    const build = run(goBin, ["build", "./..."], { cwd: root })
    assert.equal(build.status, 0, `go build упал:\n${build.stdout}\n${build.stderr}`)

    const vet = run(goBin, ["vet", "./..."], { cwd: root })
    assert.equal(vet.status, 0, `go vet упал:\n${vet.stdout}\n${vet.stderr}`)

    /* Примеры утилит stdlib — это и есть проверка смысла напечатанного кода:
       компиляция говорит лишь, что код собрался. */
    const goTest = run(goBin, ["test", "./..."], { cwd: root })
    assert.equal(goTest.status, 0, `go test упал:\n${goTest.stdout}\n${goTest.stderr}`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("shipment: без утилит даёт валидный компилируемый Go (go build + go vet)", async (t) => {
  if (!goBin) {
    missingToolchain(t, "go", "тулчейн Go не найден — пропуск")
    return
  }
  const program = await loadFixture("shipment")
  const files = emit(program, { projectName: program.project })
  const root = await mkdtemp(join(tmpdir(), "ftsc-go-shipment-"))
  try {
    await writeFiles(root, files)

    if (gofmtBin) {
      const fmt = run(gofmtBin, ["-l", "."], { cwd: root })
      assert.equal(fmt.stdout.trim(), "", `gofmt -l нашёл неотформатированные файлы:\n${fmt.stdout}`)
    }

    const build = run(goBin, ["build", "./..."], { cwd: root })
    assert.equal(build.status, 0, `go build упал:\n${build.stdout}\n${build.stderr}`)

    const vet = run(goBin, ["vet", "./..."], { cwd: root })
    assert.equal(vet.status, 0, `go vet упал:\n${vet.stdout}\n${vet.stderr}`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
