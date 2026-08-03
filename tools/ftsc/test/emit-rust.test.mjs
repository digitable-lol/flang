/**
 * Тесты бэкенда Rust.
 *
 * Главная проверка здесь не «строка содержит подстроку», а «rustc принял этот
 * код и тесты примеров прошли»: бэкенд кодогенерации доказан только тем, что
 * целевой компилятор согласен, а модель и программа считают одинаково.
 *
 * Почему `rustc`, а не `cargo test`: cargo создаёт `target/`, читает конфиги и в
 * недоверенной среде норовит сходить в сеть, а нам нужен один детерминированный
 * прогон в каталоге из mkdtemp. `rustc --test src/lib.rs` собирает крейт целиком
 * (файлы модулей подтягиваются по `mod`) и сразу даёт бинарник с тестами.
 * Сгенерированный `Cargo.toml` при этом печатается и проверяется отдельно —
 * `cargo test --offline` в каталоге --out тоже обязан работать.
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { emit, target } from "../src/emit/rust.mjs"
import { missingToolchain } from "./toolchain-guard.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const FIXTURES = ["discount", "delivery", "shipment", "shop"]

const fixture = async (name) => JSON.parse(await readFile(join(here, "fixtures", `${name}.ir.json`), "utf8"))

/* Тулчейн может отсутствовать: тогда тест пропускается, но никогда не
   притворяется успешным. */
const rustcAvailable = (() => {
  const probe = spawnSync(target.toolchain.probe[0], target.toolchain.probe.slice(1), { encoding: "utf8" })
  return probe.error === undefined && probe.status === 0
})()

async function writeCrate(files) {
  const directory = await mkdtemp(join(tmpdir(), "ftsc-rust-"))
  for (const file of files) {
    const full = join(directory, file.path)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, file.content, "utf8")
  }
  return directory
}

/**
 * Собирает крейт дважды: как библиотеку (там виден мёртвый код и неиспользованные
 * импорты) и как тестовый бинарник, оба раза с `-D warnings`. Затем гоняет тесты.
 */
function build(directory, crate) {
  const source = join(directory, "src", "lib.rs")
  const common = ["--edition", "2021", "--crate-name", crate, "-D", "warnings"]
  const library = spawnSync(
    "rustc",
    [...common, "--crate-type=lib", "--emit=metadata", "-o", join(directory, "lib.rmeta"), source],
    { encoding: "utf8" },
  )
  const tests = spawnSync("rustc", [...common, "--test", "-o", join(directory, "tests"), source], { encoding: "utf8" })
  const run =
    tests.status === 0
      ? spawnSync(join(directory, "tests"), ["--test-threads", "1"], { encoding: "utf8" })
      : { status: null, stdout: "", stderr: "" }
  return { library, tests, run }
}

test("emit печатает непустой набор файлов для каждой фикстуры", async () => {
  for (const name of FIXTURES) {
    const files = emit(await fixture(name), { projectName: name })
    assert.ok(files.length > 0, `${name}: пустой вывод`)
    const paths = files.map((file) => file.path)
    assert.ok(paths.includes("Cargo.toml"), `${name}: нет Cargo.toml`)
    assert.ok(paths.includes("src/lib.rs"), `${name}: нет src/lib.rs`)
    assert.ok(paths.includes("src/error.rs"), `${name}: нет src/error.rs`)
    for (const file of files) {
      assert.ok(file.content.length > 0, `${name}: пустой файл ${file.path}`)
      assert.match(file.content, /Сгенерировано ftsc, бэкенд rust/u, `${name}: нет шапки в ${file.path}`)
      assert.match(file.content, /Не редактировать руками/u, `${name}: нет запрета правок в ${file.path}`)
    }
    /* Модуль IR — модуль Rust: файл на категорию, не больше и не меньше. */
    const program = await fixture(name)
    const moduleFiles = paths.filter(
      (path) => path.startsWith("src/") && !["src/lib.rs", "src/error.rs", "src/functors.rs"].includes(path),
    )
    assert.equal(moduleFiles.length, program.modules.length, `${name}: файлов модулей не столько, сколько категорий`)
  }
})

test("вывод детерминирован: два вызова дают побайтово одинаковый результат", async () => {
  for (const name of FIXTURES) {
    const first = emit(await fixture(name), { projectName: name })
    const second = emit(await fixture(name), { projectName: name })
    assert.deepEqual(
      first.map((file) => file.path),
      second.map((file) => file.path),
      `${name}: разошёлся состав файлов`,
    )
    for (const [index, file] of first.entries()) {
      assert.equal(
        Buffer.from(file.content, "utf8").toString("hex"),
        Buffer.from(second[index].content, "utf8").toString("hex"),
        `${name}: файл ${file.path} не совпал побайтово`,
      )
    }
  }
})

for (const name of ["discount", "delivery", "shop"]) {
  test(`${name}: код компилируется rustc и тесты примеров проходят`, async (t) => {
    if (!rustcAvailable) return missingToolchain(t, "rust", "rustc не найден")
    const program = await fixture(name)
    const directory = await writeCrate(emit(program, { projectName: name }))
    try {
      const { library, tests, run } = build(directory, name)
      assert.equal(library.status, 0, `сборка библиотеки не прошла:\n${library.stderr}`)
      assert.equal(tests.status, 0, `сборка тестов не прошла:\n${tests.stderr}`)
      assert.equal(run.status, 0, `тесты примеров не прошли:\n${run.stdout}${run.stderr}`)
      assert.match(run.stdout, /test result: ok\./u, run.stdout)

      /* Каждый пример каждой утилиты обязан стать отдельным `#[test]`. */
      const expected = program.modules
        .flatMap((module) => module.document.utilities ?? [])
        .flatMap((utility) => utility.examples ?? []).length
      assert.ok(expected > 0, "фикстура без примеров — тест бессмыслен")
      assert.match(run.stdout, new RegExp(`running ${expected} tests?`, "u"), run.stdout)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
}

test("shipment: категория без единой утилиты даёт валидный код без функций-утилит", async (t) => {
  const program = await fixture("shipment")
  const files = emit(program, { projectName: "shipment" })
  const modules = files.filter((file) => file.path.startsWith("src/") && !["src/lib.rs", "src/error.rs"].includes(file.path))
  assert.equal(modules.length, 1)
  const [module] = modules

  /* Утилит нет — значит нет ни функций с Result, ни блока тестов, ни импорта
     ошибки: неиспользованный `use` был бы предупреждением. */
  assert.doesNotMatch(module.content, /Result<[^>]*FtsError>/u, "напечатана функция-утилита, которой нет в модели")
  assert.doesNotMatch(module.content, /use crate::FtsError;/u, "импортирован неиспользуемый тип ошибки")
  assert.doesNotMatch(module.content, /#\[cfg\(test\)\]/u, "напечатан блок тестов без единого примера")
  /* Но типы, состояния и морфизмы категории на месте. */
  assert.match(module.content, /pub struct Zakaz \{/u)
  assert.match(module.content, /pub struct GotovKOtgruzke\(pub bool\);/u)
  assert.match(module.content, /pub fn gotovyy_zakaz_mozhno_otgruzit/u)
  assert.match(module.content, /Теорема «Заказ ЗК-7781 можно отгрузить» доказана компилятором FTS/u)

  if (!rustcAvailable) return missingToolchain(t, "rust", "rustc не найден")
  const directory = await writeCrate(files)
  try {
    const { library, tests, run } = build(directory, "shipment")
    assert.equal(library.status, 0, `сборка библиотеки не прошла:\n${library.stderr}`)
    assert.equal(tests.status, 0, `сборка тестов не прошла:\n${tests.stderr}`)
    assert.equal(run.status, 0, `прогон не прошёл:\n${run.stdout}${run.stderr}`)
    assert.match(run.stdout, /running 0 tests/u, run.stdout)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("shop: функтор напечатан функцией преобразования объекта", async () => {
  const files = emit(await fixture("shop"), { projectName: "shop" })
  const functors = files.find((file) => file.path === "src/functors.rs")
  assert.ok(functors, "нет файла функторов")
  assert.match(functors.content, /pub fn zakaz_v_schyot_pokupka\(source: &crate::prodazhi::Pokupka\) -> crate::billing::Schyot/u)
  /* Каждое поле образа получает значение — иначе структура не собралась бы. */
  assert.match(functors.content, /summa_bez_nds: source\.summa/u)
  assert.match(functors.content, /loyalnyy: source\.postoyannyy_klient/u)
  assert.match(files.find((file) => file.path === "src/lib.rs").content, /pub mod functors;/u)
})

test("коллизия транслитерации — ошибка сборки, а не молчаливое переименование", async () => {
  const program = await fixture("discount")
  /* Мягкий знак при транслитерации исчезает, поэтому «конь» и «кон» дают один
     идентификатор `Kon`. Человек, читающий код рядом с моделью, обязан узнать
     об этом от компилятора, а не гадать, какой из двух объектов перед ним. */
  program.modules[0].document.structures.push({ name: "конь", fields: [] }, { name: "кон", fields: [] })
  assert.throws(() => emit(program, { projectName: "discount" }), /дают один идентификатор/u)
})

test("утилиты возвращают Result, а свойство несёт имя утилиты и свойства", async () => {
  const files = emit(await fixture("discount"), { projectName: "discount" })
  const module = files.find((file) => file.path === "src/prodazhi.rs")
  assert.match(module.content, /pub fn rasschitat_skidku\(input: &Pokupka\) -> Result<f64, FtsError>/u)
  assert.match(
    module.content,
    /return Err\(FtsError::PropertyViolated \{ utility: "Рассчитать скидку", property: "Скидка ограничена" \}\);/u,
  )
  /* Правила идут подряд отдельными `if` — ни одной ветки else. */
  assert.doesNotMatch(module.content, /\}\s*else\b/u)
  assert.equal(module.content.match(/^ {4}if /gmu).length, 4, "ожидались два правила и два свойства отдельными if")
  assert.equal(files.find((file) => file.path === "src/error.rs").content.includes("FTS_UTILITY_PROPERTY"), true)
})
