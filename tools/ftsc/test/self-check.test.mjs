/**
 * Тесты той части компилятора, которая написана на самом FTS.
 *
 * Запуск: node --test tools/ftsc/test/self-check.test.mjs
 *
 * Главный тест здесь — «решение принимает модель, а не мост»: он подставляет
 * изменённую копию `self/admission.fts` и требует, чтобы на неизменном IR
 * изменился вердикт. Если однажды кто-то перенесёт порог в JavaScript, этот
 * тест покраснеет — утверждение о bootstrap перестанет быть словами.
 */

import assert from "node:assert/strict"
import { cp, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { after, test } from "node:test"

import { compile, testUtilities, validate } from "../../../dist/src/index.js"
import { MODELS_DIR, functorFacts, loadModels, moduleFacts, selfCheck } from "../src/self-check.mjs"

const here = fileURLToPath(new URL(".", import.meta.url))
const fixtures = resolve(here, "fixtures")

const fixture = async (name) => JSON.parse(await readFile(resolve(fixtures, `${name}.ir.json`), "utf8"))
const clone = (value) => JSON.parse(JSON.stringify(value))
const reported = (result) => result.report.join("\n")

const temporary = []
after(async () => {
  const { rm } = await import("node:fs/promises")
  for (const directory of temporary) await rm(directory, { recursive: true, force: true })
})

/** Копия каталога моделей с одной точечной правкой — для теста bootstrap. */
async function patchedModels(replacements) {
  const directory = await mkdtemp(join(tmpdir(), "ftsc-self-"))
  temporary.push(directory)
  await cp(MODELS_DIR, directory, { recursive: true })
  const path = join(directory, "admission.fts")
  let source = await readFile(path, "utf8")
  for (const [from, to] of replacements) {
    assert.ok(source.includes(from), `в admission.fts нет строки «${from}» — тест устарел`)
    source = source.replace(from, to)
  }
  await writeFile(path, source, "utf8")
  return directory
}

test("модели self/ компилируются, валидны и их примеры сходятся", async () => {
  const files = (await readdir(MODELS_DIR)).filter((name) => name.endsWith(".fts"))
  assert.ok(files.length >= 2, "ожидались метамодель и модель допуска")

  for (const file of files) {
    const document = compile(await readFile(resolve(MODELS_DIR, file), "utf8"))
    const report = validate(document)
    /* Именно ошибки. `validate` теперь разбирает и область входов утилиты, а у
       моделей self/ она разобрана честно: при нулях по всем счётчикам не
       срабатывает ни одно правило — результат остаётся начальным, так и
       задумано; а свойство «оценка неотрицательна» берёт свой предел только
       там же, где результат остался начальным, и потому не проверяет ни одного
       правила. Обе находки верны и к валидности документа отношения не имеют:
       предупреждение — не ошибка. Полный разбор: tools/ftsmap. */
    const errors = report.diagnostics.filter((item) => item.severity === "error")
    assert.deepEqual(errors, [], `${file}: диагностика валидации`)
    assert.equal(report.valid, true, `${file}: документ невалиден`)

    const tests = testUtilities(document)
    const failed = tests.results.filter((item) => !item.passed)
    assert.deepEqual(failed, [], `${file}: примеры не сошлись`)
    assert.equal(tests.valid, true)
    assert.ok(tests.total > 0, `${file}: у утилит нет примеров`)
  }
})

test("каждая утилита моделей self/ имеет примеры", async () => {
  const files = (await readdir(MODELS_DIR)).filter((name) => name.endsWith(".fts"))
  for (const file of files) {
    const document = compile(await readFile(resolve(MODELS_DIR, file), "utf8"))
    for (const utility of document.utilities ?? []) {
      assert.ok((utility.examples ?? []).length > 0, `${file}: утилита «${utility.name}» без примеров`)
    }
  }
})

test("факты моста совпадают по именам с полями объектов FTS", async () => {
  const { admission } = await loadModels()
  const fields = (name) => admission.structures.find((structure) => structure.name === name).fields.map((field) => field.name)

  const program = await fixture("shop")
  assert.deepEqual(Object.keys(moduleFacts(program.modules[0], program.functors)), fields("Факты модуля"))
  assert.deepEqual(Object.keys(functorFacts(program.functors[0], program.modules)), fields("Факты функтора"))
})

test("фикстура discount допускается к кодогенерации", async () => {
  const result = await selfCheck(await fixture("discount"))
  assert.equal(result.allowed, true)
  assert.equal(result.verdict, 1)
  assert.equal(result.blocking, 0)
  assert.equal(result.modules.length, 1)
  assert.deepEqual(result.modules[0].causes, [])
  assert.match(reported(result), /проект допущен к кодогенерации/u)
})

test("все фикстуры репозитория допускаются", async () => {
  for (const name of ["discount", "delivery", "shipment", "shop"]) {
    const result = await selfCheck(await fixture(name))
    assert.equal(result.allowed, true, `${name}: ${reported(result)}`)
  }
})

test("модуль без утилит допускается: описание данных — законный модуль", async () => {
  const result = await selfCheck(await fixture("shipment"))
  assert.equal(result.modules[0].facts["утилит"], 0)
  assert.equal(result.modules[0].blocking, 0)
  assert.equal(result.allowed, true)
})

test("метамодель считает элементы модуля и уровень самоописания", async () => {
  const result = await selfCheck(await fixture("discount"))
  const { facts, elements, selfDescription } = result.modules[0].meta
  assert.deepEqual(facts, {
    объектов: 1,
    утилит: 1,
    правил: 2,
    примеров: 3,
    морфизмов: 0,
    "теорема доказана": false,
  })
  assert.equal(elements, 7)
  assert.equal(selfDescription, 2)
})

test("утилита без примеров блокирует сборку, и причина названа", async () => {
  const program = await fixture("discount")
  program.modules[0].document.utilities[0].examples = []

  const result = await selfCheck(program)
  assert.equal(result.allowed, false)
  assert.equal(result.verdict, 0)
  assert.equal(result.blocking, 1)
  assert.deepEqual(result.modules[0].causes, [{ fact: "утилит без примеров", value: 1, blocking: 1 }])
  assert.match(reported(result), /«утилит без примеров» = 1/u)
  assert.match(reported(result), /сборка запрещена/u)
})

test("несходящийся пример блокирует сборку, и причина названа", async () => {
  const program = await fixture("discount")
  program.modules[0].document.utilities[0].examples[0].expected = 999

  const result = await selfCheck(program)
  assert.equal(result.allowed, false)
  assert.deepEqual(result.modules[0].causes, [{ fact: "примеров не сошлось", value: 1, blocking: 1 }])
  assert.match(reported(result), /«примеров не сошлось» = 1/u)
})

test("функтор с непокрытым полем блокирует сборку, и причина названа", async () => {
  const program = await fixture("shop")
  program.functors[0].objects[0].fields.pop()

  const result = await selfCheck(program)
  assert.equal(result.allowed, false)
  assert.equal(result.functors[0].blocking, 1)
  assert.deepEqual(result.functors[0].causes, [{ fact: "полей без образа", value: 1, blocking: 1 }])
  assert.match(reported(result), /функтор «Заказ в счёт».*«полей без образа» = 1/u)
})

test("функтор с непокрытым объектом и неизвестной категорией блокирует сборку", async () => {
  const program = await fixture("shop")
  program.functors[0].to = "Биллинг которого нет"

  const result = await selfCheck(program)
  assert.equal(result.allowed, false)
  assert.equal(result.functors[0].facts["категорий не найдено"], 1)
  assert.match(reported(result), /«категорий не найдено» = 1/u)
})

test("объект, нужный функтору, но не экспортированный, блокирует сборку", async () => {
  const program = await fixture("shop")
  program.modules[0].exports.structures = []

  const result = await selfCheck(program)
  assert.equal(result.allowed, false)
  assert.deepEqual(result.modules[0].causes, [{ fact: "объектов вне экспорта", value: 1, blocking: 1 }])
})

test("поле без типа блокирует сборку", async () => {
  const program = await fixture("shipment")
  program.modules[0].document.structures[0].fields[0].type = ""

  const result = await selfCheck(program)
  assert.equal(result.allowed, false)
  assert.match(reported(result), /«полей без типа» = 1/u)
})

test("пустой проект не допускается: решает правило «Проект без модулей»", async () => {
  const result = await selfCheck({ ir: 1, project: "пусто", modules: [], functors: [], order: [] })
  assert.equal(result.blocking, 0)
  assert.equal(result.allowed, false)
})

/*
 * Ключевой тест bootstrap.
 *
 * IR не меняется, JavaScript не меняется — меняется только порог в
 * `self/admission.fts`. Если решение принимает модель, вердикт обязан
 * измениться; если бы порог жил в мосте, тест бы не сдвинулся.
 */
test("решение принимает модель FTS: изменение порога в .fts меняет вердикт", async () => {
  const program = await fixture("discount")
  program.modules[0].document.utilities[0].examples = []

  const strict = await selfCheck(program)
  assert.equal(strict.allowed, false, "исходная модель обязана запретить сборку")

  const directory = await patchedModels([
    ["      если «блокирующих проблем» больше 0", "      если «блокирующих проблем» больше 5"],
    ["      дано «блокирующих проблем» равно 3", "      дано «блокирующих проблем» равно 9"],
  ])

  /* Изменённая модель остаётся моделью: её собственные примеры обязаны
     сходиться, иначе тест доказывал бы работоспособность сломанного файла. */
  const patched = compile(await readFile(join(directory, "admission.fts"), "utf8"))
  assert.equal(validate(patched).valid, true)
  assert.equal(testUtilities(patched).valid, true)

  const lenient = await selfCheck(program, { modelsDir: directory })

  assert.equal(lenient.allowed, true, "модель с порогом 5 обязана допустить проект с одной проблемой")
  assert.equal(lenient.verdict, 1)
  /* Факты те же — изменилось только решение по ним. */
  assert.deepEqual(lenient.blocking, strict.blocking)
  assert.deepEqual(lenient.modules[0].facts, strict.modules[0].facts)
  assert.equal(basename(lenient.modelsDir), basename(directory))
})

test("копия моделей без правок даёт то же решение", async () => {
  const program = await fixture("discount")
  program.modules[0].document.utilities[0].examples = []

  const directory = await patchedModels([])
  const copied = await selfCheck(program, { modelsDir: directory })
  assert.equal(copied.allowed, false, "копирование само по себе не должно менять решение")
})

test("невалидная модель допуска останавливает проверку, а не пропускает сборку", async () => {
  const directory = await patchedModels([
    ["      то добавить поле «утилит без примеров»", "      то добавить поле «поле которого нет»"],
  ])
  await assert.rejects(
    () => selfCheck({ ir: 1, project: "x", modules: [], functors: [] }, { modelsDir: directory }),
    /невалидна|FTS_/u,
  )
})
