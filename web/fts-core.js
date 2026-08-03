/**
 * Pure logic behind <fts-playground>.
 *
 * Nothing here touches the DOM, the network or the compiler: the module takes
 * strings and plain FTS documents and returns descriptors. That split exists so
 * the parts that usually break — attribute parsing, tab resolution, building a
 * form out of an object's fields, turning a thrown compiler error into a list of
 * diagnostics — can be tested with `node --test` instead of a browser.
 *
 * The custom element in fts-playground.js is the only consumer, and it is
 * deliberately thin: it renders what these functions decide.
 */

/** Result tabs, in display order. */
export const VIEWS = ["check", "examples", "run", "typescript", "proof", "diagram", "model"]

const TEXT = {
  ru: {
    source: "Исходный текст FTS-модели",
    loading: "Компилятор загружается…",
    idle: "Компилятор загрузится, когда компонент появится на экране.",
    ok: "Модель валидна",
    parseError: "Ошибка разбора",
    invalid: "Модель разобрана, но не проходит проверку",
    tabs: "Что сделать с моделью",
    check: "Проверка",
    examples: "Примеры",
    run: "Выполнить",
    typescript: "TypeScript",
    proof: "Доказательство",
    diagram: "Диаграмма",
    model: "Модель JSON",
    category: "Категория",
    objects: "Объекты",
    morphisms: "Морфизмы",
    utilities: "Утилиты",
    rules: "Правила",
    exampleCount: "Примеры",
    theorem: "Теорема",
    parseTime: "Разбор",
    present: "есть",
    absent: "нет",
    ms: "мс",
    noUtilities: "В модели нет утилит: выполнять нечего.",
    noExamples: "В этой модели нет утилит с примерами.",
    noTypescript: "TypeScript генерируется из утилит: в этой модели их нет.",
    noTheorem: "В модели нет теоремы.",
    noModel: "Модель не собрана: сначала исправьте ошибку на вкладке «Проверка».",
    utility: "Утилита",
    passing: (passed, total) => `${passed}/${total} примеров проходит`,
    columnExample: "Пример",
    columnExpected: "Ожидалось",
    columnActual: "Получено",
    ruleFailed: "Правило не выполнено",
    context: "Данные, на которых проверяется теорема",
    proved: "Теорема доказана на этих данных",
    denied: "Допуск не выдан",
    proofPath: "Путь к факту",
    proofMorphism: "Морфизм",
    proofCurryHoward: "Соответствие Карри — Ховарда",
    badJson: (message) => `данные не разобрались как JSON: ${message}`,
    diagramSource: "Исходник Mermaid",
    diagramFallback: "Рендерер диаграмм не загрузился — ниже исходник, его понимает любой просмотрщик Mermaid.",
    copy: "Скопировать",
    copied: "Скопировано",
    copyFailed: "Не удалось",
    reset: "Вернуть исходник",
    line: (line, column) => `строка ${line}, столбец ${column}`,
  },
  en: {
    source: "FTS model source",
    loading: "Loading the compiler…",
    idle: "The compiler loads when the component scrolls into view.",
    ok: "Model is valid",
    parseError: "Parse error",
    invalid: "Model parses but does not validate",
    tabs: "What to do with the model",
    check: "Check",
    examples: "Examples",
    run: "Run",
    typescript: "TypeScript",
    proof: "Proof",
    diagram: "Diagram",
    model: "JSON model",
    category: "Category",
    objects: "Objects",
    morphisms: "Morphisms",
    utilities: "Utilities",
    rules: "Rules",
    exampleCount: "Examples",
    theorem: "Theorem",
    parseTime: "Parsed in",
    present: "yes",
    absent: "no",
    ms: "ms",
    noUtilities: "This model has no utilities, so there is nothing to run.",
    noExamples: "This model has no utilities with examples.",
    noTypescript: "TypeScript is generated from utilities, and this model has none.",
    noTheorem: "This model states no theorem.",
    noModel: "No document was built — fix the error on the Check tab first.",
    utility: "Utility",
    passing: (passed, total) => `${passed}/${total} examples pass`,
    columnExample: "Example",
    columnExpected: "Expected",
    columnActual: "Actual",
    ruleFailed: "Property violated",
    context: "Data the theorem is checked against",
    proved: "Theorem proved on this data",
    denied: "Permission denied",
    proofPath: "Path to the fact",
    proofMorphism: "Morphism",
    proofCurryHoward: "Curry — Howard correspondence",
    badJson: (message) => `data is not valid JSON: ${message}`,
    diagramSource: "Mermaid source",
    diagramFallback: "The diagram renderer did not load — the Mermaid source below works in any viewer.",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Failed",
    reset: "Reset",
    line: (line, column) => `line ${line}, column ${column}`,
  },
}

/** Picks a label dictionary; anything that is not Russian falls back to English. */
export function labels(language) {
  return /^ru\b/i.test(String(language || "")) ? TEXT.ru : TEXT.en
}

/**
 * Removes the indentation the host page used to nest the model inside the tag.
 *
 * Written as markup, a model is indented to match the surrounding HTML, and FTS
 * is indentation-sensitive — so the common prefix has to go before the compiler
 * ever sees the text. Tabs count as themselves; only the shared prefix is cut,
 * so the model's own nesting survives.
 */
export function dedent(text) {
  if (typeof text !== "string" || text.trim() === "") return ""
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  while (lines.length > 0 && lines[0].trim() === "") lines.shift()
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop()
  let indent = Infinity
  for (const line of lines) {
    if (line.trim() === "") continue
    indent = Math.min(indent, line.length - line.trimStart().length)
  }
  if (!Number.isFinite(indent) || indent === 0) return lines.join("\n")
  return lines.map((line) => (line.trim() === "" ? "" : line.slice(indent))).join("\n")
}

/** Attribute presence semantics: `readonly`, `readonly=""` and `readonly="true"` all mean true. */
export function booleanAttribute(value) {
  if (value === null || value === undefined || value === "false" || value === "0") return false
  return true
}

/** `auto` follows prefers-color-scheme; anything unknown degrades to `auto`. */
export function normalizeTheme(value) {
  const theme = String(value || "auto").trim().toLowerCase()
  return theme === "light" || theme === "dark" ? theme : "auto"
}

/** A bare number means pixels, so `height="420"` works like the CSS a user meant. */
export function normalizeHeight(value) {
  if (value === null || value === undefined) return null
  const height = String(value).trim()
  if (height === "") return null
  if (/^\d+(\.\d+)?$/.test(height)) return `${height}px`
  if (!/^[\w.%()\-+*/ ]+$/.test(height)) return null
  return height
}

/** `views="check run"` (or comma separated) narrows the tab strip; unknown ids are dropped. */
export function resolveViews(value) {
  if (value === null || value === undefined || String(value).trim() === "") return [...VIEWS]
  const requested = String(value)
    .split(/[\s,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => VIEWS.includes(item))
  const unique = [...new Set(requested)]
  return unique.length > 0 ? unique : [...VIEWS]
}

/** Falls back to the first available tab so a typo in `view` never blanks the panel. */
export function resolveView(requested, available = VIEWS) {
  const views = available.length > 0 ? available : VIEWS
  const view = String(requested || "").trim().toLowerCase()
  return views.includes(view) ? view : views[0]
}

/** Arrow-key navigation across the tab strip, wrapping at both ends. */
export function stepView(views, current, step) {
  if (views.length === 0) return current
  const index = views.indexOf(current)
  const from = index === -1 ? 0 : index
  const size = views.length
  return views[(((from + step) % size) + size) % size]
}

/** Everything the element needs to know, derived from the host attributes. */
export function parseAttributes(attributes = {}) {
  const get = (name) => {
    const value = attributes[name]
    return value === undefined ? null : value
  }
  const views = resolveViews(get("views"))
  const lang = get("lang")
  return {
    src: get("src"),
    contextSrc: get("context-src"),
    views,
    view: resolveView(get("view"), views),
    readonly: booleanAttribute(get("readonly")),
    height: normalizeHeight(get("height")),
    theme: normalizeTheme(get("theme")),
    /* `null` means "inherit from the page" — the element reads <html lang> then. */
    language: lang === null || lang.trim() === "" ? null : /^ru\b/i.test(lang) ? "ru" : "en",
    runtime: get("runtime"),
    mermaid: get("mermaid"),
    lazy: !booleanAttribute(get("eager")),
  }
}

/**
 * Turns a thrown compiler error into a flat list of renderable diagnostics.
 *
 * `FtsError` carries `diagnostics`; a plain `Error` (a bug, or JSON that failed
 * to parse) carries only a message. Both have to look the same on screen,
 * otherwise the panel would have to branch everywhere.
 */
export function diagnosticsOf(error, text = TEXT.en) {
  if (!error) return []
  const list = Array.isArray(error.diagnostics) && error.diagnostics.length > 0 ? error.diagnostics : [{ message: error.message ?? String(error) }]
  return list.map((diagnostic) => ({
    code: diagnostic.code || "FTS_ERROR",
    message: String(diagnostic.message ?? ""),
    place: diagnostic.span ? text.line(diagnostic.span.start.line, diagnostic.span.start.column) : diagnostic.path || "",
  }))
}

/** Facts for the Check tab: the same counts `fts check` prints. */
export function summarize(document, elapsed, text = TEXT.en) {
  const utilities = document.utilities || []
  return [
    { term: text.category, value: document.category },
    { term: text.objects, value: document.structures.length },
    { term: text.morphisms, value: document.functors.length },
    { term: text.utilities, value: utilities.length },
    { term: text.rules, value: utilities.reduce((total, utility) => total + utility.rules.length, 0) },
    { term: text.exampleCount, value: utilities.reduce((total, utility) => total + utility.examples.length, 0) },
    { term: text.theorem, value: document.proposition ? text.present : text.absent },
    { term: text.parseTime, value: `${Number(elapsed).toFixed(3)} ${text.ms}` },
  ]
}

const NUMERIC = /^(деньги|money|число|number|integer)$/iu
const BOOLEAN = /^(признак|boolean|bool)$/iu
const DATE = /^(дата|date)$/iu

/**
 * Chooses an input control for one object field.
 *
 * FTS types are domain words, not HTML input types, so the mapping lives here:
 * money and number become a spinner, a flag becomes a checkbox, a date becomes a
 * date picker, and everything else — including `состояние «…»` — stays text.
 * `| undefined` is stripped first: optionality changes validation, not the widget.
 */
export function describeField(field, previous) {
  const type = String(field.type).replace(/\s*\|\s*undefined\s*/gu, "").trim()
  const optional = String(field.type).includes("undefined")
  if (BOOLEAN.test(type)) {
    return { name: field.name, type, optional, control: "checkbox", value: previous === true }
  }
  const control = NUMERIC.test(type) ? "number" : DATE.test(type) ? "date" : "text"
  const fallback = control === "number" ? 0 : ""
  return {
    name: field.name,
    type,
    optional,
    control,
    value: previous === undefined || previous === null ? fallback : previous,
  }
}

/**
 * Everything the Run tab needs: which utility is selected and what its input
 * object looks like as a form. Keeping the previously typed values means a tab
 * switch or a recompile does not wipe what the reader entered.
 */
export function describeForm(document, requestedUtility, previousValues = {}) {
  const utilities = (document && document.utilities) || []
  if (utilities.length === 0) return { utilities: [], utility: null, fields: [] }
  const name = utilities.some((utility) => utility.name === requestedUtility) ? requestedUtility : utilities[0].name
  const utility = utilities.find((item) => item.name === name)
  const structure = document.structures.find((item) => item.name === utility.input)
  return {
    utilities: utilities.map((item) => item.name),
    utility: name,
    input: utility.input,
    output: utility.output,
    fields: (structure ? structure.fields : []).map((field) => describeField(field, previousValues[field.name])),
  }
}

/** Reads one control back into the scalar the interpreter expects. */
export function readControlValue(descriptor, raw) {
  if (descriptor.control === "checkbox") return raw === true || raw === "true" || raw === "on"
  if (descriptor.control === "number") return raw === "" || raw === null || raw === undefined ? 0 : Number(raw)
  return raw === null || raw === undefined ? "" : String(raw)
}

/** Collects a whole form into the input record `executeUtility` takes. */
export function collectInput(fields, values) {
  const input = {}
  for (const field of fields) input[field.name] = readControlValue(field, values[field.name])
  return input
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)
}

export function formatValue(value) {
  return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)
}

/** Stable id for a field, safe to put in `id`/`for` even for Cyrillic names. */
export function slug(value) {
  const cleaned = String(value)
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
  return cleaned === "" ? "field" : cleaned
}

/** base64url of the UTF-8 source — used by share links, safe inside a URL hash. */
export function encodeSource(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function decodeSource(value) {
  const base64 = String(value).replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))
}
