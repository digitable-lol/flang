/**
 * Тесты ядра ftsc: разбор заголовков, резолвер, линковка, законы функторов.
 *
 * Запуск: node --test tools/ftsc/test/core.test.mjs
 */
import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

import { parseModuleFile } from "../src/parse-module.mjs"
import { resolveProject } from "../src/resolve.mjs"
import { link } from "../src/link.mjs"
import { mermaid } from "../src/graph.mjs"

const repo = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")
const shop = resolve(repo, "tools/ftsc/examples/shop")

/** Проект во временном каталоге: {'a/x.fts': '...'} → путь к корню. */
async function project(files) {
  const root = await mkdtemp(join(tmpdir(), "ftsc-core-"))
  for (const [path, content] of Object.entries(files)) {
    const file = resolve(root, path)
    await mkdir(resolve(file, ".."), { recursive: true })
    await writeFile(file, content, "utf8")
  }
  return root
}

const build = async (files, options) => {
  const root = await project(files)
  try {
    return link(await resolveProject(root), options)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function problems(files) {
  try {
    await build(files)
    return []
  } catch (error) {
    return error.diagnostics ?? []
  }
}

test("заголовок модуля снимается, тело достаётся ядру без сдвига строк", () => {
  const parsed = parseModuleFile(
    [
      "модуль «Продажи»",
      "  экспортирует «Покупка»",
      "",
      "категория «Продажи»",
      "",
      "  объект Покупка",
      "    сумма является деньгами",
    ].join("\n"),
    "x.fts",
  )
  assert.equal(parsed.kind, "module")
  assert.equal(parsed.name, "Продажи")
  assert.deepEqual(parsed.exports, ["Покупка"])
  /* Номер строки «категория» в теле обязан совпасть с номером в файле: иначе
     диагностика ядра указала бы читателю не на ту строку. */
  assert.equal(parsed.body.split("\n")[3], "категория «Продажи»")
})

test("файл, начинающийся с комментария, всё равно распознаётся как функтор", () => {
  const parsed = parseModuleFile(["// пояснение", "функтор «Ф» из «А» в «Б»"].join("\n"), "f.fts")
  assert.equal(parsed.kind, "functor")
  assert.equal(parsed.name, "Ф")
})

test("английская запись заголовка равноправна русской", () => {
  const parsed = parseModuleFile(['module "Sales"', '  exports "Purchase"', 'category "Sales"'].join("\n"), "x.fts")
  assert.equal(parsed.name, "Sales")
  assert.deepEqual(parsed.exports, ["Purchase"])
})

test("проект собирается: модули, функтор и топологический порядок", async () => {
  const program = link(await resolveProject(shop), { project: "shop" })
  assert.equal(program.ir, 1)
  assert.deepEqual(program.modules.map((module) => module.name).sort(), ["Биллинг", "Продажи"])
  assert.equal(program.functors.length, 1)
  assert.equal(program.functors[0].from, "Продажи")
  const sales = program.modules.find((module) => module.name === "Продажи")
  assert.deepEqual(sales.exports, { structures: ["Покупка"], utilities: ["Рассчитать скидку"] })
})

test("импорт по относительному пути связывает модули", async () => {
  const program = await build({
    "a/x.fts": "модуль «А»\nкатегория «А»\n\n  объект Т\n    цена является деньгами\n",
    "b/y.fts": "модуль «Б»\n  использует «А» из «../a/x.fts»\nкатегория «Б»\n\n  объект П\n    цена является деньгами\n",
  })
  const b = program.modules.find((module) => module.name === "Б")
  assert.deepEqual(b.imports, [{ category: "А", module: "А" }])
  /* Зависимость обязана оказаться раньше зависимого. */
  assert.ok(program.order.indexOf("А") < program.order.indexOf("Б"))
})

test("несуществующий импорт называет модуль и файл", async () => {
  const found = await problems({
    "a/x.fts": "модуль «А»\n  использует «Б» из «../нет.fts»\nкатегория «А»\n\n  объект Т\n    цена является деньгами\n",
  })
  assert.equal(found[0]?.code ?? "нет ошибки", "FTSC_IMPORT_NOT_FOUND")
})

test("импорт файла с другой категорией — ошибка, а не молчаливая связь", async () => {
  const found = await problems({
    "a/x.fts": "категория «А»\n\n  объект Т\n    цена является деньгами\n",
    "b/y.fts": "модуль «Б»\n  использует «Каталог» из «../a/x.fts»\nкатегория «Б»\n\n  объект П\n    цена является деньгами\n",
  })
  assert.equal(found[0]?.code, "FTSC_IMPORT_CATEGORY")
})

test("экспорт несуществующего имени ловится", async () => {
  const found = await problems({
    "a/x.fts": "модуль «А»\n  экспортирует «Нет такого»\nкатегория «А»\n\n  объект Т\n    цена является деньгами\n",
  })
  assert.equal(found[0]?.code, "FTSC_EXPORT_UNKNOWN")
})

test("циклический импорт ловится и печатает цепочку", async () => {
  const found = await problems({
    "a.fts": "модуль «А»\n  использует «Б» из «./b.fts»\nкатегория «А»\n\n  объект Т\n    цена является деньгами\n",
    "b.fts": "модуль «Б»\n  использует «А» из «./a.fts»\nкатегория «Б»\n\n  объект П\n    цена является деньгами\n",
  })
  assert.equal(found[0]?.code, "FTSC_MODULE_CYCLE")
  assert.match(found[0].message, /→/)
})

test("функтор обязан покрыть все объекты и поля домена", async () => {
  const found = await problems({
    "a.fts": "категория «А»\n\n  объект Т\n    цена является деньгами\n    вес является числом\n",
    "b.fts": "категория «Б»\n\n  объект П\n    стоимость является деньгами\n",
    "f.fts":
      "функтор «Ф» из «А» в «Б»\n  использует «А» из «./a.fts»\n  использует «Б» из «./b.fts»\n\n  объект Т отображается в «П»\n    поле цена отображается в поле стоимость\n",
  })
  assert.deepEqual(
    found.map((problem) => problem.code),
    ["FTSC_FUNCTOR_FIELD_MISSING"],
  )
  assert.match(found[0].message, /вес/)
})

test("несовпадение формы данных в образе — ошибка", async () => {
  const found = await problems({
    "a.fts": "категория «А»\n\n  объект Т\n    цена является деньгами\n",
    "b.fts": "категория «Б»\n\n  объект П\n    стоимость является строкой\n",
    "f.fts":
      "функтор «Ф» из «А» в «Б»\n  использует «А» из «./a.fts»\n  использует «Б» из «./b.fts»\n\n  объект Т отображается в «П»\n    поле цена отображается в поле стоимость\n",
  })
  assert.equal(found[0]?.code, "FTSC_FUNCTOR_FIELD_TYPE")
})

test("состояние законно переименовывается в другой категории", async () => {
  /* Ради переименования состояний функтор и нужен: требовать одинаковых имён
     в разных предметных областях было бы бессмысленно. */
  const program = await build({
    "a.fts":
      "категория «А»\n\n  объект Заявка\n    проверена является состоянием «Заявка проверена»\n\n  морфизм «Проверенная заявка допускает выдачу»\n    если «Заявка проверена»\n    то «Выдача разрешена»\n",
    "b.fts":
      "категория «Б»\n\n  объект Договор\n    основание является состоянием «Основание подтверждено»\n\n  морфизм «Подтверждённое основание допускает выдачу»\n    если «Основание подтверждено»\n    то «Выдача разрешена»\n",
    "f.fts":
      "функтор «Ф» из «А» в «Б»\n  использует «А» из «./a.fts»\n  использует «Б» из «./b.fts»\n\n" +
      "  объект Заявка отображается в «Договор»\n    поле проверена отображается в поле основание\n" +
      "  морфизм «Проверенная заявка допускает выдачу» отображается в морфизм «Подтверждённое основание допускает выдачу»\n",
  })
  assert.equal(program.functors.length, 1)
})

test("морфизм с несогласованным доменом образа отклоняется", async () => {
  const found = await problems({
    "a.fts":
      "категория «А»\n\n  объект Заявка\n    проверена является состоянием «Заявка проверена»\n\n  морфизм «М»\n    если «Заявка проверена»\n    то «Выдача разрешена»\n",
    "b.fts":
      "категория «Б»\n\n  объект Договор\n    основание является состоянием «Основание подтверждено»\n\n  морфизм «Н»\n    если «Другое состояние»\n    то «Выдача разрешена»\n",
    "f.fts":
      "функтор «Ф» из «А» в «Б»\n  использует «А» из «./a.fts»\n  использует «Б» из «./b.fts»\n\n" +
      "  объект Заявка отображается в «Договор»\n    поле проверена отображается в поле основание\n" +
      "  морфизм «М» отображается в морфизм «Н»\n",
  })
  assert.equal(found[0]?.code, "FTSC_FUNCTOR_MORPHISM_SHAPE")
})

test("диаграмма содержит категории, импорт и функтор", async () => {
  const program = link(await resolveProject(shop), { project: "shop" })
  const diagram = mermaid(program)
  assert.match(diagram, /^flowchart LR/)
  assert.match(diagram, /функтор Заказ в счёт/)
  assert.equal(diagram.split("\n").filter((line) => line.includes('["')).length, 2)
})
