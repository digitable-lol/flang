/**
 * Диаграмма: валидность, детерминированность, читаемость без интерактива.
 *
 * «Читаемость» проверяется буквально — по тексту внутри SVG: имена правил,
 * значения порогов, слово «дыра» и легенда обязаны присутствовать. Картинка,
 * которую нельзя понять без наведения мышью, инструменту не годится.
 */
import assert from "node:assert/strict"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { analyzeDocument } from "../src/coverage.mjs"
import { loadModel } from "../src/load.mjs"
import { chooseMode, renderSvg } from "../src/svg.mjs"
import { elements, parseXml } from "./xml.mjs"

const at = (path) => fileURLToPath(new URL(path, import.meta.url))
const DISCOUNT = at("../../../examples/utilities/discount.fts")

const svgOf = async (file, options) => {
  const document = await loadModel(file)
  return renderSvg(analyzeDocument(document, options))
}

const textOf = (root) =>
  elements(root)
    .filter((node) => node.name === "text")
    .map((node) => node.text)

test("SVG разбирается обратно как XML и объявляет размеры", async () => {
  const svg = await svgOf(DISCOUNT)
  const root = parseXml(svg)

  assert.equal(root.name, "svg")
  assert.equal(root.attributes.xmlns, "http://www.w3.org/2000/svg")
  assert.ok(Number(root.attributes.width) > 0)
  assert.ok(Number(root.attributes.height) > 0)
  assert.equal(root.attributes.viewBox, `0 0 ${root.attributes.width} ${root.attributes.height}`)
})

test("SVG детерминирован: один вход — байт-в-байт один файл", async () => {
  const first = await svgOf(DISCOUNT)
  const second = await svgOf(DISCOUNT)
  assert.equal(first, second)
  /* Ни дат, ни случайных идентификаторов: и то и другое ломает сравнение в git. */
  assert.doesNotMatch(first, /\d{4}-\d{2}-\d{2}/u)
  assert.doesNotMatch(first, /id="[^"]*(?:random|uuid)/iu)
})

test("диаграмма читается без интерактива: имена правил, пороги, дыра, легенда", async () => {
  const root = parseXml(await svgOf(DISCOUNT))
  const texts = textOf(root)
  const joined = texts.join("\n")

  assert.ok(texts.includes("Большая покупка"))
  assert.ok(texts.includes("Постоянный клиент"))
  assert.ok(texts.includes("10000"), "порог условия обязан быть подписан числом")
  assert.ok(texts.includes("дыра"))
  assert.ok(joined.includes("Как читать"))
  assert.ok(joined.includes("Скидка ограничена"))
  assert.ok(joined.includes("предел недостижим"))
})

test("тема: цвета заданы дважды — базовые и под prefers-color-scheme: dark", async () => {
  const svg = await svgOf(DISCOUNT)
  const style = elements(parseXml(svg)).find((node) => node.name === "style")

  assert.ok(style.text.includes("@media (prefers-color-scheme:dark)"))
  assert.ok(style.text.includes("#ffffff"), "светлый фон")
  assert.ok(style.text.includes("#05080d"), "тёмный фон из фирменных токенов")
  /* var(--x) не понимают librsvg и часть просмотрщиков — цвета только литералами. */
  assert.doesNotMatch(style.text, /var\(--/u)
})

test("одно числовое поле — вид «ось»", async () => {
  const document = await loadModel(at("../examples/holes.fts"))
  const analysis = analyzeDocument(document)
  assert.equal(chooseMode(analysis.utilities[0]).mode, "line")

  const texts = textOf(parseXml(renderSvg(analysis)))
  assert.ok(texts.join("\n").includes("вид: числовая ось «вес»"))
  for (const threshold of ["10", "50", "100"]) assert.ok(texts.includes(threshold))
})

test("два числовых поля — вид «плоскость»", async () => {
  const document = await loadModel(at("../examples/overlap.fts"))
  const analysis = analyzeDocument(document)
  assert.equal(chooseMode(analysis.utilities[0]).mode, "plane")

  const texts = textOf(parseXml(renderSvg(analysis)))
  const joined = texts.join("\n")
  assert.ok(joined.includes("вид: плоскость «сумма» × «количество»"))
  assert.ok(texts.includes("×2"), "клетка с двумя правилами подписана")
})

test("признак в наборе — вид «решётка» со строкой на каждое значение", async () => {
  const document = await loadModel(DISCOUNT)
  const analysis = analyzeDocument(document)
  assert.equal(chooseMode(analysis.utilities[0]).mode, "grid")

  const texts = textOf(parseXml(renderSvg(analysis)))
  assert.ok(texts.includes("«постоянный клиент» = нет"))
  assert.ok(texts.includes("«постоянный клиент» = да"))
})

test("модель без утилит рисуется в пустую, но валидную карту", async () => {
  const svg = await svgOf(at("../examples/silent.fts"))
  const root = parseXml(svg)
  assert.ok(textOf(root).join("\n").includes("нет утилит"))
})

test("тексты экранированы: угловые скобки и амперсанд в имени не ломают разметку", () => {
  const analysis = {
    category: "A & B <c>",
    summary: { utilities: 0, holes: 0, overlaps: 0, unattainable: 0, violated: 0 },
    utilities: [],
    diagnostics: [],
    ok: true,
  }
  const svg = renderSvg(analysis)
  assert.ok(svg.includes("A &amp; B &lt;c&gt;"))
  assert.equal(parseXml(svg).name, "svg")
})

test("ширина диаграммы настраивается и попадает в разметку", async () => {
  const document = await loadModel(DISCOUNT)
  const svg = renderSvg(analyzeDocument(document), { width: 1400 })
  assert.equal(parseXml(svg).attributes.width, "1400")
})
