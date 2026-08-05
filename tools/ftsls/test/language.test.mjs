/**
 * Тесты разметки и возможностей поверх неё — без подпроцесса.
 *
 * Главное, что здесь проверяется: индексы разметки совпадают с индексами
 * канонической модели ядра. Если это перестанет быть правдой, диагностика
 * `$.utilities[0].rules[1]...` подчеркнёт не ту строку.
 *
 * Запуск: node --test tools/ftsls/test/language.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { test } from "node:test"

import { compile } from "../../../dist/src/index.js"
import { Severity, analyze } from "../src/analysis.mjs"
import { resolvePath, scanDocument, scanLines } from "../src/outline.mjs"
import { complete } from "../src/features/completion.mjs"
import { definition } from "../src/features/definition.mjs"
import { formatDocument } from "../src/features/format.mjs"
import { hover } from "../src/features/hover.mjs"
import { inlayHints } from "../src/features/inlay.mjs"

const repo = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")
const read = (path) => readFileSync(resolve(repo, path), "utf8")

test("разбиение на строки повторяет правила ядра", () => {
  const lines = scanLines(["категория «А» // хвост", "\tобъект Б", "  /* блок", "     всё ещё блок */ поле", ""].join("\n"))
  assert.equal(lines[0].text, "категория «А»")
  assert.equal(lines[0].indent, 0)
  assert.equal(lines[1].indent, 2, "табуляция считается за два пробела")
  assert.equal(lines[2].text, "", "строка внутри блочного комментария пуста")
  assert.equal(lines[3].text, "поле")
  assert.equal(lines[3].startChar, 21, "колонки после блочного комментария не съезжают")
  assert.equal(lines[4].text, "")
})

test("комментарий внутри кавычек не считается комментарием", () => {
  const [line] = scanLines("объект «а//б»")
  assert.equal(line.text, "объект «а//б»")
})

test("индексы разметки совпадают с канонической моделью ядра", () => {
  const source = read("examples/utilities/discount.fts")
  const document = compile(source)
  const outline = scanDocument(source)

  assert.equal(outline.category.name, document.category)
  assert.deepEqual(outline.objects.map((item) => item.name), document.structures.map((item) => item.name))
  assert.deepEqual(
    outline.objects[0].fields.map((item) => ({ name: item.name, type: item.type })),
    document.structures[0].fields.map((item) => ({ name: item.name, type: item.type })),
  )
  assert.deepEqual(outline.utilities.map((item) => item.name), document.utilities.map((item) => item.name))

  const utility = outline.utilities[0]
  const model = document.utilities[0]
  assert.equal(utility.input, model.input)
  assert.equal(utility.output, model.output)
  assert.deepEqual(utility.rules.map((item) => item.name), model.rules.map((item) => item.name))
  assert.deepEqual(utility.properties.map((item) => item.name), model.properties.map((item) => item.name))
  assert.deepEqual(utility.examples.map((item) => item.name), model.examples.map((item) => item.name))
  utility.rules.forEach((rule, index) => {
    assert.equal(rule.conditions.length, model.rules[index].when.length, `условия правила ${index}`)
    rule.conditions.forEach((condition, position) => {
      assert.equal(condition.name, model.rules[index].when[position].field)
      assert.equal(condition.operator, model.rules[index].when[position].operator)
    })
  })
})

test("путь канонической модели превращается в диапазон", () => {
  const source = read("examples/utilities/discount.fts")
  const outline = scanDocument(source)
  const lines = source.split("\n")

  const field = resolvePath(outline, "$.utilities[0].rules[1].when[0].field")
  assert.equal(lines[field.start.line].slice(field.start.character, field.end.character), "«постоянный клиент»")

  const expected = resolvePath(outline, "$.utilities[0].examples[2].expected")
  assert.equal(lines[expected.start.line].slice(expected.start.character, expected.end.character), "ожидается результат равен 3000")

  /* Неизвестный хвост пути сползает к ближайшему известному предку. */
  const fallback = resolvePath(outline, "$.utilities[0].examples[2].expected.deep.unknown")
  assert.deepEqual(fallback, expected)
  assert.ok(resolvePath(outline, "$.structures[0].fields[1].type"))
})

test("скобочная поверхность подчёркивается по span ядра", () => {
  const source = "category X {\n  structure S {\n    a: \n  }\n}\n"
  const core = (() => {
    try {
      compile(source)
      return null
    } catch (error) {
      return error.diagnostics[0]
    }
  })()
  assert.ok(core.span, "у скобочной поверхности есть span")

  const analysis = analyze(source)
  assert.equal(analysis.outline.surface, "bracket")
  const [diagnostic] = analysis.diagnostics
  assert.equal(diagnostic.range.start.line, core.span.start.line - 1)
  assert.equal(diagnostic.range.start.character, core.span.start.column - 1)
})

test("английская поверхность разбирается и отвечает по-английски", () => {
  const source = read("examples/utilities/discount.en.fts").replace("expected result equals 3000", "expected result equals 1")
  const analysis = analyze(source)
  assert.equal(analysis.outline.language, "en")
  assert.equal(analysis.outline.utilities[0].output, "Деньги")
  /* Диагностика примера ищется по коду, а не по первому месту в списке: перед
     ней идут находки разбора области входов — у discount.en.fts есть
     настоящая дыра на суммах меньше 10000 и недостижимый предел скидки. */
  const diagnostic = analysis.diagnostics.find((item) => item.code === "FTS_UTILITY_EXAMPLE_MISMATCH")
  assert.ok(diagnostic, "несошедшийся пример сообщён")
  assert.match(diagnostic.message, /expected 1, actual 3000/u)

  const hints = inlayHints(analysis, null)
  assert.ok(hints.some((hint) => hint.label.includes("3000")))

  const line = source.split("\n").findIndex((item) => item.includes("if amount is at least"))
  const items = complete(analysis, "      if ", { line, character: 9 })
  assert.ok(items.some((item) => item.label === "amount"))
  assert.ok(items.some((item) => item.label === '"loyal customer"'), "имя с пробелом в английских кавычках")
})

test("наведение на морфизм показывает домен и кодомен", () => {
  const source = read("examples/real-world/credit-limit.fts")
  const analysis = analyze(source)
  const lines = source.split("\n")
  const line = lines.findIndex((item) => item.startsWith("  морфизм"))
  const info = hover(analysis, { line, character: 15 })
  assert.match(info.contents.value, /Скоринг пройден/u)
  assert.match(info.contents.value, /Риск-проверка разрешена/u)
  assert.match(info.contents.value, /morphism\.declared/u)
})

test("переход от «по морфизму» ведёт к объявлению морфизма", () => {
  const source = read("examples/real-world/credit-limit.fts")
  const analysis = analyze(source)
  const lines = source.split("\n")
  const usage = lines.findIndex((item) => item.trim().startsWith("по морфизму"))
  const declaration = lines.findIndex((item) => item.startsWith("  морфизм"))
  const target = definition(analysis, "file:///m.fts", { line: usage, character: lines[usage].indexOf("«") + 3 })
  assert.equal(target.range.start.line, declaration)
})

test("переход от состояния ведёт к полю, которое его объявляет", () => {
  const source = read("examples/real-world/credit-limit.fts")
  const analysis = analyze(source)
  const lines = source.split("\n")
  const usage = lines.findIndex((item) => item.trim().startsWith("если «Скоринг пройден»"))
  const target = definition(analysis, "file:///m.fts", { line: usage, character: lines[usage].indexOf("«") + 3 })
  assert.equal(lines[target.range.start.line].trim(), "«скоринг пройден» является состоянием «Скоринг пройден»")
})

test("форматирование готовой модели ничего не меняет", () => {
  for (const path of ["examples/utilities/discount.fts", "examples/real-world/credit-limit.fts", "examples/utilities/discount.en.fts"]) {
    const source = read(path)
    const analysis = analyze(source)
    assert.deepEqual(formatDocument(analysis, source, { tabSize: 2, insertSpaces: true }), [], path)
  }
})

test("форматирование исправляет отступы, сохраняя текст и комментарии", () => {
  /* Уровень берётся из относительных отступов: восемь пробелов под
     категорией — это первый уровень, тринадцать под ними — второй.
     Вложенность сохраняется, ширина нормализуется. */
  const source = [
    "категория «А» // заголовок",
    "        объект Б",
    "             поле является строкой   ",
    "",
    "/* блочный",
    "   комментарий */",
  ].join("\n")
  const [edit] = formatDocument(analyze(source), source, { tabSize: 2, insertSpaces: true })
  assert.deepEqual(edit.newText.split("\n"), [
    "категория «А» // заголовок",
    "  объект Б",
    "    поле является строкой",
    "",
    "/* блочный",
    "   комментарий */",
  ])
})

test("форматирование не выдумывает вложенность там, где её нет", () => {
  const source = ["категория «А»", "    объект Б", "  поле является строкой"].join("\n")
  const [edit] = formatDocument(analyze(source), source, { tabSize: 2, insertSpaces: true })
  assert.deepEqual(edit.newText.split("\n"), ["категория «А»", "  объект Б", "  поле является строкой"])
})

test("теорема и морфизмы попадают в разметку целиком", () => {
  const source = read("examples/real-world/credit-limit.fts")
  const outline = scanDocument(source)
  assert.equal(outline.morphisms.length, 2)
  assert.equal(outline.theorem.morphisms.length, 2)
  assert.equal(outline.theorem.structure, "Заявка на лимит")
  assert.equal(outline.theorem.conclusion, "Лимит может быть установлен")
  assert.equal(outline.objects[0].fields[3].state, "Скоринг пройден")
})

test("автодополнение верхнего уровня зависит от того, есть ли категория", () => {
  assert.deepEqual(complete(analyze(""), "", { line: 0, character: 0 }).map((item) => item.label), ["категория"])
  assert.deepEqual(
    complete(analyze("категория «А»\n  "), "  ", { line: 1, character: 2 }).map((item) => item.label),
    ["объект", "морфизм", "утилита", "теорема"],
  )
  assert.deepEqual(complete(analyze('category "A"\n  '), "  ", { line: 1, character: 2 }).map((item) => item.label), [
    "object",
    "morphism",
    "utility",
    "theorem",
  ])
})

test("после «принимает» предлагаются объекты, после «возвращает» — типы", () => {
  const source = read("examples/utilities/discount.fts")
  const analysis = analyze(source)
  const line = source.split("\n").findIndex((item) => item.trim().startsWith("принимает"))
  const objects = complete(analysis, "    принимает ", { line, character: 14 }).map((item) => item.label)
  assert.deepEqual(objects, ["Покупка"])
  const types = complete(analysis, "    возвращает ", { line: line + 1, character: 15 }).map((item) => item.label)
  assert.ok(types.includes("деньги") && types.includes("строку"))
})

test("модуль ftsc разбирается: заголовок снят, координаты не съехали", () => {
  const source = read("tools/ftsc/examples/shop/sales/purchase.fts")
  const analysis = analyze(source)
  /* Тест про заголовок модуля, а не про содержание модели: сама модель — та же
     скидка с настоящей дырой и недостижимым пределом «20 % от суммы», и разбор
     области входов говорит о ней предупреждениями. Ошибок тут быть не должно
     по-прежнему: заголовок «модуль/экспортирует» ядру не показывают. */
  const errors = analysis.diagnostics.filter((item) => item.severity === Severity.error)
  assert.deepEqual(errors, [], "заголовок «модуль/экспортирует» не считается ошибкой ядра")
  assert.equal(analysis.outline.surface, "natural")
  assert.equal(analysis.outline.category.name, "Продажи")

  const lines = source.split("\n")
  const hints = inlayHints(analysis, null)
  const onExpected = hints.filter((hint) => hint.label.startsWith("→"))
  assert.ok(onExpected.length > 0)
  for (const hint of onExpected) {
    assert.match(lines[hint.position.line], /ожидается/u, "подсказка стоит на своей строке")
  }
})

test("файл-функтор ftsc не вызывает ложных ошибок", () => {
  const analysis = analyze(read("tools/ftsc/examples/shop/mapping/sales-to-billing.fts"))
  assert.deepEqual(analysis.diagnostics, [], "отображение категорий разбирает ftsc, а не ядро")
})

test("модель без утилит не даёт ни подсказок, ни ложных диагностик", () => {
  const analysis = analyze(read("examples/real-world/credit-limit.fts"))
  assert.deepEqual(analysis.diagnostics, [])
  assert.deepEqual(inlayHints(analysis, null), [])
})
