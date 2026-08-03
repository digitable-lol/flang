/**
 * Тесты бэкенда Python (tools/ftsc/src/emit/python.mjs).
 *
 * Требования из SPEC.md/задания к тестам бэкенда:
 *   1. emit() отрабатывает на всех фикстурах, список файлов непустой;
 *   2. вывод детерминирован — два вызова дают побайтово одинаковый результат;
 *   3. discount/delivery/gateway/shop реально проходят `python3 -m unittest discover`;
 *   4. shipment (без утилит) даёт валидный импортируемый код;
 *   5. настоящий проект tools/ftsc/stdlib — собранный резолвером и линковщиком,
 *      а не заранее записанным IR — импортируется и проходит unittest discover.
 * Если python3 не найден — тесты 3, 4 и 5 пропускаются (t.skip), без имитации успеха.
 *
 * Пункт 5 добавлен не для полноты: в фикстурах не было ни одного объекта с
 * необязательным полем («иногда является»), поэтому dataclass без значения по
 * умолчанию и падающие на этом примеры утилит жили в продакшене незамеченными.
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { emit, target } from "../src/emit/python.mjs"
import { link } from "../src/link.mjs"
import { resolveProject } from "../src/resolve.mjs"
import { findExecutable } from "../src/toolchain.mjs"
import { missingToolchain } from "./toolchain-guard.mjs"

const here = fileURLToPath(new URL(".", import.meta.url))
const fixturesDir = join(here, "fixtures")
const stdlibDir = resolve(here, "../stdlib")
/* gateway — фикстура краевых случаев: необязательное поле объявлено раньше
   обязательного (Python запрещает аргумент без умолчания после аргумента с
   умолчанием), пример утилиты необязательное поле не задаёт, а имя утилиты
   совпадает с именем состояния. */
const FIXTURE_NAMES = ["discount", "delivery", "gateway", "shipment", "shop"]

async function loadFixture(name) {
  return JSON.parse(await readFile(join(fixturesDir, `${name}.ir.json`), "utf8"))
}

/** Проект stdlib как его собирает сам ftsc: резолвер + линковщик, не фикстура. */
async function stdlibProgram() {
  return link(await resolveProject(stdlibDir), { project: "project" })
}

const python3 = findExecutable("python3")

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

test("target: описывает id/name/extension/toolchain бэкенда Python", () => {
  assert.equal(target.id, "python")
  assert.equal(target.extension, ".py")
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
      files.some((f) => f.path === `${program.project}/__init__.py`),
      `${name}: нет __init__.py пакета`,
    )
    assert.ok(
      files.some((f) => f.path.endsWith(".py")),
      `${name}: нет ни одного .py файла`,
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

test("discount/delivery/gateway/shop: сгенерированный Python реально проходит unittest discover", async (t) => {
  if (!python3) {
    missingToolchain(t, "python", "python3 не найден — пропуск")
    return
  }
  for (const name of ["discount", "delivery", "gateway", "shop"]) {
    await t.test(name, async () => {
      const program = await loadFixture(name)
      const files = emit(program, { projectName: program.project })
      const root = await mkdtemp(join(tmpdir(), `ftsc-py-${name}-`))
      try {
        await writeFiles(root, files)

        const unittest = run(python3, ["-m", "unittest", "discover", "-v"], { cwd: root })
        assert.equal(unittest.status, 0, `unittest discover упал:\n${unittest.stdout}\n${unittest.stderr}`)
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    })
  }
})

test("stdlib: настоящий проект библиотеки компилируется, импортируется и проходит unittest", async (t) => {
  if (!python3) {
    t.skip("python3 не найден — пропуск")
    return
  }
  const program = await stdlibProgram()
  /* Проект должен быть не пустее, чем есть: иначе тест «зазеленел» бы на
     сломанном резолвере, ничего не напечатав и ничего не прогнав. */
  assert.ok(program.modules.length >= 8, `в stdlib ожидались модули, найдено ${program.modules.length}`)
  assert.ok(program.functors.length >= 2, `в stdlib ожидались функторы, найдено ${program.functors.length}`)

  const files = emit(program, { projectName: program.project })
  const root = await mkdtemp(join(tmpdir(), "ftsc-py-stdlib-"))
  try {
    await writeFiles(root, files)

    /* compileall ловит синтаксис, импорт — исполнение тела модуля: dataclass с
       неправильным порядком полей падает именно на импорте, а не на разборе. */
    const compile = run(python3, ["-m", "compileall", "-q", "."], { cwd: root })
    assert.equal(compile.status, 0, `compileall упал:\n${compile.stdout}\n${compile.stderr}`)

    for (const file of files.filter((f) => f.path.startsWith(`${program.project}/`) && !f.path.endsWith("__init__.py"))) {
      const moduleName = file.path.slice(0, -3).replaceAll("/", ".")
      const importCheck = run(python3, ["-c", `import ${moduleName}`], { cwd: root })
      assert.equal(importCheck.status, 0, `import ${moduleName} упал:\n${importCheck.stdout}\n${importCheck.stderr}`)
    }

    /* Примеры утилит stdlib — проверка смысла напечатанного кода, а не только
       его импортируемости. */
    const unittest = run(python3, ["-m", "unittest", "discover"], { cwd: root })
    assert.equal(unittest.status, 0, `unittest discover упал:\n${unittest.stdout}\n${unittest.stderr}`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("shipment: без утилит даёт валидный импортируемый Python", async (t) => {
  if (!python3) {
    missingToolchain(t, "python", "python3 не найден — пропуск")
    return
  }
  const program = await loadFixture("shipment")
  const files = emit(program, { projectName: program.project })
  const root = await mkdtemp(join(tmpdir(), "ftsc-py-shipment-"))
  try {
    await writeFiles(root, files)

    /* Синтаксическая валидность каждого сгенерированного файла. */
    for (const file of files.filter((f) => f.path.endsWith(".py"))) {
      const compile = run(python3, ["-m", "py_compile", file.path], { cwd: root })
      assert.equal(compile.status, 0, `py_compile ${file.path} упал:\n${compile.stderr}`)
    }

    /* Импортируемость: без утилит нет ни одного примера-теста, но модуль
       обязан быть валидным импортируемым кодом (требование 4). */
    const modulePath = files.find((f) => f.path.startsWith(`${program.project}/`) && !f.path.endsWith("__init__.py")).path
    const moduleName = modulePath.slice(0, -3).replaceAll("/", ".")
    const importCheck = run(python3, ["-c", `import ${moduleName}`], { cwd: root })
    assert.equal(importCheck.status, 0, `import ${moduleName} упал:\n${importCheck.stdout}\n${importCheck.stderr}`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
