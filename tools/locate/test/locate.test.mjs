/**
 * Тесты общего модуля: разметка и приведение диагностик к координатам.
 *
 * Проверяется каждый из четырёх источников координат по отдельности, их
 * различение между собой и с путём к файлу, а также поведение на документах,
 * на которых легко ошибиться: пустом, с BOM, с CRLF, с заголовком модуля
 * ftsc и со скобочной поверхностью.
 *
 * Запуск: node --test tools/locate/test/locate.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { test } from "node:test"

import { compile, validate } from "../../../dist/src/index.js"
import { classifyPath, locate, outline, resolvePath, toLspRange } from "../index.mjs"

const repo = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")
const read = (path) => readFileSync(resolve(repo, path), "utf8")

const DISCOUNT = "examples/utilities/discount.fts"

/** Текст, который диагностика подчеркнула, — так ошибку видит человек. */
function underlined(source, spot) {
  const lines = source.split(/\r?\n/u)
  if (spot.endLine !== spot.line) return lines.slice(spot.line - 1, spot.endLine).join("\n")
  return lines[spot.line - 1].slice(spot.column - 1, spot.endColumn - 1)
}

/* ── Источник 1: span скобочной поверхности ─────────────────────────────── */

test("span ядра переносится в координаты один в один", () => {
  const source = "category X {\n  structure S {\n    a: \n  }\n}\n"
  const view = outline(source)
  assert.equal(view.surface, "bracket")

  let diagnostic
  try {
    compile(source)
  } catch (error) {
    diagnostic = error.diagnostics[0]
  }
  assert.ok(diagnostic.span, "у скобочной поверхности есть span")

  const spot = locate(diagnostic, view)
  assert.equal(spot.line, diagnostic.span.start.line)
  assert.equal(spot.column, diagnostic.span.start.column)
})

test("span длиной в ноль расширяется до одного символа", () => {
  const span = { start: { line: 4, column: 7 }, end: { line: 4, column: 7 } }
  const spot = locate({ code: "X", message: "m", span }, outline(""))
  assert.deepEqual(spot, { line: 4, column: 7, endLine: 4, endColumn: 8 })
})

test("многострочный span сохраняет обе границы", () => {
  const span = { start: { line: 1, column: 1 }, end: { line: 4, column: 3 } }
  const spot = locate({ code: "X", message: "m", span }, outline(""))
  assert.deepEqual(spot, { line: 1, column: 1, endLine: 4, endColumn: 3 })
})

test("span сильнее всех прочих источников: он единственный полный", () => {
  const source = read(DISCOUNT)
  const span = { start: { line: 2, column: 1 }, end: { line: 2, column: 5 } }
  const spot = locate({ code: "X", message: "m", span, path: "$.utilities[0]" }, outline(source))
  assert.equal(spot.line, 2, "путь не перебивает настоящие координаты")
})

/* ── Источник 2: `строка N` отступной поверхности ───────────────────────── */

test("«строка N» подчёркивает строку без отступа и без комментария", () => {
  const source = read(DISCOUNT)
  const spot = locate({ code: "FTS_NATURAL_FIELD", message: "m", path: "строка 4" }, outline(source))
  assert.equal(spot.line, 4)
  assert.equal(underlined(source, spot), "сумма является деньгами")
  assert.equal(spot.column, 5, "отступ в подчёркивание не входит")
})

test("«строка N» получается из ядра именно в таком виде", () => {
  /* Поле без связки — ошибка отступной поверхности, а не проверки. */
  const source = "категория «А»\n  объект Б\n    поле без связки\n"
  let diagnostic
  try {
    compile(source)
  } catch (error) {
    diagnostic = error.diagnostics[0]
  }
  assert.equal(diagnostic.path, "строка 3", "ядро сообщает строку и только строку")
  assert.equal(diagnostic.span, undefined, "колонок у отступной поверхности нет")

  const spot = locate(diagnostic, outline(source))
  assert.equal(spot.line, 3)
  assert.equal(underlined(source, spot), "поле без связки")
})

test("английское «line N» разбирается так же, как русское", () => {
  const source = read(DISCOUNT)
  const spot = locate({ code: "X", message: "m", path: "line 4" }, outline(source))
  assert.equal(spot.line, 4)
})

test("«строка N» за пределами файла не выдумывает координат", () => {
  const source = read(DISCOUNT)
  const spot = locate({ code: "X", message: "m", path: "строка 9999" }, outline(source), { fallback: "none" })
  assert.equal(spot, null)
})

/* ── Источник 3: JSON-указатель проверки ────────────────────────────────── */

test("указатель на поле условия подчёркивает само имя поля", () => {
  const source = read(DISCOUNT)
  const path = "$.utilities[0].rules[1].when[0].field"
  const spot = locate({ code: "FTS_UTILITY_FIELD", message: "m", path }, outline(source))
  assert.equal(underlined(source, spot), "«постоянный клиент»")
})

test("указатель на ожидание примера подчёркивает строку «ожидается»", () => {
  const source = read(DISCOUNT)
  const path = "$.utilities[0].examples[2].expected"
  const spot = locate({ code: "FTS_UTILITY_EXPECTED_TYPE", message: "m", path }, outline(source))
  assert.equal(underlined(source, spot), "ожидается результат равен 3000")
})

test("указатель проверки — тот же, что порождает ядро", () => {
  /* Пример обещает строку там, где утилита возвращает деньги. */
  const source = read(DISCOUNT).replace("ожидается результат равен 3000", "ожидается результат равен «много»")
  const report = validate(compile(source))
  const diagnostic = report.diagnostics.find((item) => item.code === "FTS_UTILITY_EXPECTED_TYPE")
  assert.ok(diagnostic, "проверка нашла несоответствие типа")
  assert.match(diagnostic.path, /^\$\.utilities\[0\]\.examples\[2\]\.expected$/u)

  const spot = locate(diagnostic, outline(source))
  assert.equal(underlined(source, spot), "ожидается результат равен «много»")
})

test("неизвестный хвост указателя сползает к ближайшему известному предку", () => {
  const source = read(DISCOUNT)
  const known = locate({ code: "X", message: "m", path: "$.utilities[0].examples[2].expected" }, outline(source))
  const deep = locate(
    { code: "X", message: "m", path: "$.utilities[0].examples[2].expected.deep.unknown" },
    outline(source),
  )
  assert.deepEqual(deep, known, "хвост отброшен, предок найден")
})

test("указатель без единого известного сегмента не роняет и не врёт", () => {
  const source = read(DISCOUNT)
  const spot = locate({ code: "X", message: "m", path: "$.utilities[42]" }, outline(source), { fallback: "none" })
  assert.equal(spot, null, "утилиты с таким номером нет — координат нет")
})

test("указатель на поле объекта разрешается наравне с утилитами", () => {
  const source = read(DISCOUNT)
  const spot = locate({ code: "X", message: "m", path: "$.structures[0].fields[1].type" }, outline(source))
  assert.equal(underlined(source, spot), "признаком")
})

/* ── Источник 4: несходящийся пример из testUtilities ───────────────────── */

test("несходящийся пример подчёркивает строку «ожидается»", () => {
  const source = read(DISCOUNT)
  const item = { utility: "Рассчитать скидку", example: "Большая покупка", passed: false, expected: 2000, actual: 3000 }
  const spot = locate(item, outline(source))
  assert.equal(spot.line, 34)
  assert.equal(underlined(source, spot), "2000", "подчёркнуто неоправдавшееся ожидание")
})

test("пример, упавший с ошибкой, локализуется так же", () => {
  const source = read(DISCOUNT)
  const item = { utility: "Рассчитать скидку", example: "Обычная покупка", passed: false, error: "деление на ноль" }
  const spot = locate(item, outline(source))
  assert.equal(spot.line, 29)
})

test("пример, которого нет в разметке, не выдумывает строки", () => {
  const source = read(DISCOUNT)
  const item = { utility: "Нет такой", example: "И такого нет", passed: false, expected: 1, actual: 2 }
  assert.equal(locate(item, outline(source), { fallback: "none" }), null)
})

/* ── Пятый случай: path — это файл, а не указатель ──────────────────────── */

test("диагностика ftsc с путём к файлу не разрешается по разметке", () => {
  const source = read(DISCOUNT)
  const diagnostic = { code: "FTSC_IMPORT_NOT_FOUND", message: "модуль не найден", path: "../sales/purchase.fts" }
  assert.equal(locate(diagnostic, outline(source), { origin: "tool" }), null)
})

test("файл, имя которого начинается с $, не принимается за указатель", () => {
  assert.equal(classifyPath("$.fts"), "file")
  assert.equal(classifyPath("$/models/a.fts"), "file")
  assert.equal(classifyPath("./$.utilities.fts"), "file")
  assert.equal(classifyPath("specs/001-скидка/model.fts"), "file")
})

test("указателем считается только `$.` плюс ключ канонического документа", () => {
  assert.equal(classifyPath("$.category"), "model-pointer")
  assert.equal(classifyPath("$.structures[0].fields[1].type"), "model-pointer")
  assert.equal(classifyPath("$.utilities[0].rules[1].when[0].field"), "model-pointer")
  assert.equal(classifyPath("$.proposition.functors[0]"), "model-pointer")
  assert.equal(classifyPath("$.выдуманный[0]"), "file", "чужой корень — не указатель ядра")
})

test("«строка N» и пустота различаются от прочего", () => {
  assert.equal(classifyPath("строка 13"), "source-line")
  assert.equal(classifyPath("line 7"), "source-line")
  assert.equal(classifyPath(""), "none")
  assert.equal(classifyPath(undefined), "none")
})

test("происхождение сильнее формы строки", () => {
  const source = read(DISCOUNT)
  const looksLikePointer = { code: "FTSC_X", message: "m", path: "$.utilities[0]" }
  assert.equal(
    locate(looksLikePointer, outline(source), { origin: "tool" }),
    null,
    "инструмент сообщает о файле, даже если имя похоже на указатель",
  )
  assert.ok(locate(looksLikePointer, outline(source), { origin: "core" }), "у ядра это указатель")
})

/* ── Документы, на которых легко ошибиться ──────────────────────────────── */

test("заголовок модуля ftsc снят, а координаты остались координатами файла", () => {
  const source = read("tools/ftsc/examples/shop/sales/purchase.fts")
  const view = outline(source)
  assert.equal(view.kind, "document")
  assert.equal(view.surface, "natural")
  assert.equal(view.category.name, "Продажи")

  /* Заголовок занимает две строки: без их сохранения всё съехало бы вверх. */
  assert.match(source.split("\n")[0], /^модуль/u)
  assert.equal(view.compileSource.split("\n")[0], "", "строка заголовка стала пустой, а не исчезла")

  const spot = locate({ code: "X", message: "m", path: "$.structures[0].fields[0]" }, view)
  assert.equal(spot.line, 7)
  assert.equal(underlined(source, spot), "сумма является деньгами")
})

test("ядро компилирует `compileSource` модуля, а разметка совпадает с ним", () => {
  const source = read("tools/ftsc/examples/shop/sales/purchase.fts")
  const view = outline(source)
  const document = compile(view.compileSource)
  assert.equal(document.category, view.category.name)
  assert.deepEqual(view.utilities.map((item) => item.name), document.utilities.map((item) => item.name))
})

test("файл-функтор ftsc опознаётся и не выдаётся за документ", () => {
  const view = outline(read("tools/ftsc/examples/shop/mapping/sales-to-billing.fts"))
  assert.equal(view.kind, "functor")
  assert.equal(view.compileSource, read("tools/ftsc/examples/shop/mapping/sales-to-billing.fts"))
})

test("пустой файл: разметка пуста, координат нет", () => {
  const view = outline("")
  assert.equal(view.surface, "empty")
  assert.deepEqual(view.utilities, [])
  assert.equal(view.category, null)
  assert.equal(locate({ code: "FTS_EMPTY_SOURCE", message: "empty source" }, view), null)
})

test("файл из одних пробелов и переводов строк тоже пуст", () => {
  const view = outline("\n   \n\t\n")
  assert.equal(view.surface, "empty")
  assert.equal(locate({ code: "X", message: "m", path: "$.category" }, view), null)
})

test("BOM не сдвигает колонки первой строки", () => {
  const source = `﻿категория «А»\n  объект Б\n    поле является строкой\n`
  const view = outline(source)
  assert.equal(view.surface, "natural")
  assert.equal(view.category.name, "А")
  const spot = locate({ code: "X", message: "m", path: "$.structures[0].fields[0]" }, view)
  assert.equal(spot.line, 3)
  assert.equal(underlined(source, spot), "поле является строкой")
})

test("CRLF не попадает в подчёркивание и не сбивает нумерацию", () => {
  const source = "категория «А»\r\n  объект Б\r\n    поле является строкой\r\n"
  const view = outline(source)
  const spot = locate({ code: "X", message: "m", path: "$.structures[0].fields[0]" }, view)
  assert.equal(spot.line, 3)
  assert.equal(underlined(source, spot), "поле является строкой")
  assert.ok(!underlined(source, spot).includes("\r"), "возврат каретки не подчёркивается")
})

test("скобочная поверхность размечается как таковая и не индексируется", () => {
  const view = outline('{"category":"A","structures":[],"functors":[],"proposition":null}')
  assert.equal(view.surface, "bracket")
  assert.equal(view.byPath.size, 0, "указателей у скобочной поверхности нет — у неё есть span")
})

/* ── Диагностика без всякого места ──────────────────────────────────────── */

test("диагностика без места находится по имени в кавычках из сообщения", () => {
  const source = read("examples/real-world/credit-limit.fts")
  const diagnostic = { code: "FTS_UNKNOWN_FUNCTOR", message: "не найден морфизм «Риск-проверка»", severity: "error" }
  const spot = locate(diagnostic, outline(source))
  assert.ok(spot, "имя из сообщения нашлось в тексте")
  assert.match(source.split("\n")[spot.line - 1], /Риск-проверка/u)
})

test("догадку по сообщению можно выключить — в CI она вредна", () => {
  const source = read(DISCOUNT)
  const diagnostic = { code: "FTS_INTERNAL", message: "не найден морфизм «Покупка»", severity: "error" }
  assert.ok(locate(diagnostic, outline(source), { fallback: "document" }))
  assert.equal(locate(diagnostic, outline(source), { fallback: "none" }), null)
})

test("диагностика вовсе без места и без разметки — это null, а не выдумка", () => {
  assert.equal(locate({ code: "FTS_INTERNAL", message: "boom" }, null), null)
  assert.equal(locate(null, outline("")), null)
  assert.equal(locate(undefined, undefined), null)
})

/* ── Перевод в нумерацию редактора ──────────────────────────────────────── */

test("toLspRange переводит в нумерацию с нуля и обратно не теряет ширины", () => {
  const spot = { line: 3, column: 5, endLine: 3, endColumn: 9 }
  assert.deepEqual(toLspRange(spot), {
    start: { line: 2, character: 4 },
    end: { line: 2, character: 8 },
  })
  assert.equal(toLspRange(null), null)
})

test("resolvePath отдаёт диапазон в нумерации разметки, а locate — в нумерации ядра", () => {
  const view = outline(read(DISCOUNT))
  const range = resolvePath(view, "$.utilities[0].examples[2].expected")
  const spot = locate({ code: "X", message: "m", path: "$.utilities[0].examples[2].expected" }, view)
  assert.equal(range.start.line + 1, spot.line, "разница ровно в единице, и она осознанная")
})
