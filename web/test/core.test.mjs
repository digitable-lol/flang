/**
 * Unit tests for the logic behind <fts-playground>.
 *
 * A custom element is awkward to test without a browser, so everything that can
 * be decided without the DOM lives in fts-core.js and is tested here: attribute
 * parsing, tab resolution, the form built out of an object's fields, and the way
 * a thrown compiler error becomes a list of diagnostics. The browser run in
 * browser.test.mjs then only has to prove that the element wires these together.
 *
 * The compiler is the vendored browser build, not a stub: a form descriptor is
 * only meaningful if it came from a document the real parser produced.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  VIEWS,
  booleanAttribute,
  collectInput,
  decodeSource,
  dedent,
  describeField,
  describeForm,
  diagnosticsOf,
  encodeSource,
  escapeHtml,
  formatValue,
  labels,
  normalizeHeight,
  normalizeTheme,
  parseAttributes,
  readControlValue,
  resolveView,
  resolveViews,
  slug,
  stepView,
  summarize,
} from "../fts-core.js"
import { compile, executeUtility, validate } from "../vendor/fts/browser.js"

const models = fileURLToPath(new URL("../demo/models/", import.meta.url))
const discount = readFileSync(`${models}order-discount.fts`, "utf8")
const shipment = readFileSync(`${models}order-shipment.fts`, "utf8")

test("the vendored runtime is the real compiler", () => {
  const document = compile(discount)
  assert.equal(document.category, "Продажи")
  assert.equal(validate(document).valid, true)
})

test("dedent removes the markup indentation but keeps the model's own nesting", () => {
  const markup = `
      категория «Продажи»

        объект Покупка
          сумма является деньгами
    `
  const source = dedent(markup)
  assert.equal(source.split("\n")[0], "категория «Продажи»")
  assert.equal(source.split("\n")[2], "  объект Покупка")
  assert.equal(source.split("\n")[3], "    сумма является деньгами")
  /* Whatever the host page indented with, the result has to compile. */
  assert.equal(compile(source).structures[0].name, "Покупка")
})

test("dedent handles CRLF, blank lines and empty input", () => {
  assert.equal(dedent("  a\r\n\r\n    b\r\n"), "a\n\n  b")
  assert.equal(dedent(""), "")
  assert.equal(dedent("   \n  \n"), "")
  assert.equal(dedent("no indent\n  child"), "no indent\n  child")
})

test("boolean attributes follow HTML presence semantics", () => {
  assert.equal(booleanAttribute(null), false)
  assert.equal(booleanAttribute(""), true)
  assert.equal(booleanAttribute("readonly"), true)
  assert.equal(booleanAttribute("true"), true)
  assert.equal(booleanAttribute("false"), false)
})

test("theme falls back to auto, height accepts a bare number", () => {
  assert.equal(normalizeTheme(null), "auto")
  assert.equal(normalizeTheme("DARK"), "dark")
  assert.equal(normalizeTheme("solarized"), "auto")
  assert.equal(normalizeHeight("420"), "420px")
  assert.equal(normalizeHeight("60vh"), "60vh")
  assert.equal(normalizeHeight("calc(100% - 20px)"), "calc(100% - 20px)")
  assert.equal(normalizeHeight(null), null)
  /* An injected value must never reach the style attribute. */
  assert.equal(normalizeHeight("420px; background: url(javascript:alert(1))"), null)
})

test("views can be narrowed and a typo never blanks the panel", () => {
  assert.deepEqual(resolveViews(null), VIEWS)
  assert.deepEqual(resolveViews("check run"), ["check", "run"])
  assert.deepEqual(resolveViews("run, check , run"), ["run", "check"])
  assert.deepEqual(resolveViews("nope"), VIEWS)
  assert.equal(resolveView("proof", VIEWS), "proof")
  assert.equal(resolveView("nope", VIEWS), "check")
  assert.equal(resolveView("proof", ["check", "run"]), "check")
})

test("arrow keys walk the tab strip and wrap", () => {
  const views = ["check", "run", "model"]
  assert.equal(stepView(views, "check", 1), "run")
  assert.equal(stepView(views, "model", 1), "check")
  assert.equal(stepView(views, "check", -1), "model")
  assert.equal(stepView(views, "unknown", 1), "run")
})

test("parseAttributes turns markup into the element's configuration", () => {
  const bare = parseAttributes({})
  assert.deepEqual(bare, {
    src: null,
    contextSrc: null,
    views: VIEWS,
    view: "check",
    readonly: false,
    height: null,
    theme: "auto",
    language: null,
    runtime: null,
    mermaid: null,
    lazy: true,
  })

  const configured = parseAttributes({
    src: "models/order-shipment.fts",
    "context-src": "models/order-shipment.context.json",
    view: "proof",
    views: "check proof",
    readonly: "",
    height: "440",
    theme: "dark",
    lang: "ru-RU",
    eager: "",
  })
  assert.equal(configured.src, "models/order-shipment.fts")
  assert.equal(configured.contextSrc, "models/order-shipment.context.json")
  assert.deepEqual(configured.views, ["check", "proof"])
  assert.equal(configured.view, "proof")
  assert.equal(configured.readonly, true)
  assert.equal(configured.height, "440px")
  assert.equal(configured.theme, "dark")
  assert.equal(configured.language, "ru")
  assert.equal(configured.lazy, false)

  /* A view outside the narrowed strip is not a reason to show nothing. */
  assert.equal(parseAttributes({ views: "check run", view: "diagram" }).view, "check")
  assert.equal(parseAttributes({ lang: "de" }).language, "en")
})

test("labels follow the page language and default to English", () => {
  assert.equal(labels("ru").run, "Выполнить")
  assert.equal(labels("ru-RU").run, "Выполнить")
  assert.equal(labels("en").run, "Run")
  assert.equal(labels(undefined).run, "Run")
  assert.equal(labels("ru").passing(3, 3), "3/3 примеров проходит")
})

test("a field becomes the control its FTS type implies", () => {
  assert.deepEqual(describeField({ name: "сумма", type: "Деньги" }, undefined), {
    name: "сумма",
    type: "Деньги",
    optional: false,
    control: "number",
    value: 0,
  })
  assert.equal(describeField({ name: "флаг", type: "Признак" }, undefined).control, "checkbox")
  assert.equal(describeField({ name: "флаг", type: "Признак" }, true).value, true)
  assert.equal(describeField({ name: "when", type: "Дата" }, undefined).control, "date")
  assert.equal(describeField({ name: "город", type: "Строка" }, undefined).control, "text")
  assert.equal(describeField({ name: "amount", type: "money" }, undefined).control, "number")
  /* A state type is a domain word, not a widget: it stays a text input. */
  assert.equal(describeField({ name: "готов", type: "Состояние «Готов»" }, undefined).control, "text")

  const optional = describeField({ name: "скидка", type: "Деньги | undefined" }, undefined)
  assert.equal(optional.optional, true)
  assert.equal(optional.type, "Деньги")
  assert.equal(optional.control, "number")
})

test("describeForm builds the input form of the selected utility", () => {
  const document = compile(discount)
  const form = describeForm(document, null, {})
  assert.equal(form.utility, "Рассчитать скидку")
  assert.equal(form.input, "Покупка")
  assert.equal(form.output, "Деньги")
  assert.deepEqual(
    form.fields.map((field) => [field.name, field.control]),
    [
      ["сумма", "number"],
      ["постоянный клиент", "checkbox"],
    ],
  )

  /* Typed values survive a recompile: nothing the reader entered is thrown away. */
  const reused = describeForm(document, "Рассчитать скидку", { сумма: "20000", "постоянный клиент": true })
  assert.equal(reused.fields[0].value, "20000")
  assert.equal(reused.fields[1].value, true)

  /* An unknown utility name (a stale selection after an edit) picks the first. */
  assert.equal(describeForm(document, "нет такой", {}).utility, "Рассчитать скидку")
  assert.deepEqual(describeForm(compile(shipment), null, {}), { utilities: [], utility: null, fields: [] })
})

test("collected form values execute the utility for real", () => {
  const document = compile(discount)
  const form = describeForm(document, null, {})
  const input = collectInput(form.fields, { сумма: "20000", "постоянный клиент": true })
  assert.deepEqual(input, { сумма: 20000, "постоянный клиент": true })
  assert.equal(executeUtility(document, form.utility, input), 3000)

  /* An empty number field is zero, not NaN: the interpreter refuses NaN. */
  assert.deepEqual(collectInput(form.fields, { сумма: "", "постоянный клиент": false }), { сумма: 0, "постоянный клиент": false })
  assert.equal(readControlValue({ control: "checkbox" }, "on"), true)
  assert.equal(readControlValue({ control: "text" }, undefined), "")
})

test("a compile failure becomes renderable diagnostics with a position", () => {
  let error
  try {
    compile("категория «Продажи»\n  объектт Покупка\n")
  } catch (failure) {
    error = failure
  }
  assert.ok(error, "a broken model must throw")
  const diagnostics = diagnosticsOf(error, labels("ru"))
  assert.ok(diagnostics.length >= 1)
  assert.match(diagnostics[0].code, /^FTS_/)
  /* The natural surface localizes the position into `path`… */
  assert.match(diagnostics[0].place, /^строка \d+$/)

  /* …while the brace surface reports a span, which has to be formatted here. */
  let spanned
  try {
    compile("category X {\n  structure  {\n")
  } catch (failure) {
    spanned = failure
  }
  assert.equal(diagnosticsOf(spanned, labels("ru"))[0].place, "строка 2, столбец 14")
  assert.equal(diagnosticsOf(spanned, labels("en"))[0].place, "line 2, column 14")

  /* A plain error — a bug, or unparsable JSON in the proof tab — renders too. */
  assert.deepEqual(diagnosticsOf(new Error("boom"), labels("en")), [{ code: "FTS_ERROR", message: "boom", place: "" }])
  assert.deepEqual(diagnosticsOf(null), [])

  /* Validation diagnostics carry a JSON path instead of a span. */
  const invalid = diagnosticsOf({ diagnostics: [{ code: "FTS_STRUCTURE_NAME", message: "bad", path: "$.structures[0].name" }] })
  assert.equal(invalid[0].place, "$.structures[0].name")
})

test("summarize counts what fts check prints", () => {
  const facts = Object.fromEntries(summarize(compile(discount), 1.5, labels("en")).map((fact) => [fact.term, fact.value]))
  assert.equal(facts.Category, "Продажи")
  assert.equal(facts.Objects, 1)
  assert.equal(facts.Utilities, 1)
  assert.equal(facts.Rules, 2)
  assert.equal(facts.Examples, 3)
  assert.equal(facts.Theorem, "no")
  assert.equal(facts["Parsed in"], "1.500 ms")
  assert.equal(Object.fromEntries(summarize(compile(shipment), 1, labels("en")).map((f) => [f.term, f.value])).Theorem, "yes")
})

test("small helpers do not leak markup or mangle Cyrillic", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&#60;img src=x onerror=&#34;alert(1)&#34;&#62;")
  assert.equal(formatValue({ a: 1 }), '{"a":1}')
  assert.equal(formatValue(3000), "3000")
  assert.equal(slug("постоянный клиент"), "постоянный-клиент")
  assert.equal(slug("!!!"), "field")
  const source = "категория «Продажи»\n  объект Покупка\n"
  assert.equal(decodeSource(encodeSource(source)), source)
  assert.doesNotMatch(encodeSource(source), /[+/=]/)
})
