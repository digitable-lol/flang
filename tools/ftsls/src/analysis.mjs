/**
 * Анализ документа: компиляция ядром, проверка, исполнение примеров.
 *
 * Сервер ничего не вычисляет сам. Он вызывает `compile`, `validate` и
 * `testUtilities` из ядра и переводит их результат в координаты редактора.
 * Именно поэтому подсказки в редакторе не могут разойтись с `fts test`:
 * это один и тот же вызов.
 *
 * Отдельная ценность — несходящиеся примеры. Ядро возвращает их как
 * `{ passed: false, expected, actual }` без координат; здесь они становятся
 * диагностикой на строке `ожидается` с обоими числами в тексте.
 */
import { compile, testUtilities, validate } from "../../../dist/src/index.js"

import { resolvePath, scanDocument } from "./outline.mjs"

export const Severity = { error: 1, warning: 2, information: 3, hint: 4 }

/* Заголовок модуля понимает ftsc, а не ядро (см. tools/ftsc/src/parse-module.mjs).
   Границу кириллического слова приходится задавать явно: \b в JavaScript
   определяется по латинице. */
const MODULE_HEADER = /^\s*(?:модуль|использует|экспортирует|module|uses|exports)(?![\p{L}])/u
const FUNCTOR_HEADER = /^\s*(?:функтор|functor)(?![\p{L}])/u
const COMMENT_LINE = /^\s*\/\//u

/**
 * Снять заголовок модуля, сохранив нумерацию строк.
 *
 * Строки заголовка не удаляются, а заменяются пустыми: и ядро, и разметка
 * считают строки по исходному файлу, поэтому координаты диагностик обязаны
 * остаться прежними.
 *
 * @param {string} text
 * @returns {{ source: string, kind: "document" | "functor" }}
 */
export function prepare(text) {
  const lines = text.split(/\r?\n/u)
  const first = lines.find((line) => line.trim() && !COMMENT_LINE.test(line)) ?? ""
  if (FUNCTOR_HEADER.test(first)) return { source: text, kind: "functor" }

  const stripped = [...lines]
  for (let index = 0; index < stripped.length; index += 1) {
    const line = stripped[index]
    if (!line.trim() || COMMENT_LINE.test(line)) continue
    if (!MODULE_HEADER.test(line)) break
    stripped[index] = ""
  }
  return { source: stripped.join("\n"), kind: "document" }
}

/**
 * @param {string} text
 * @returns {{ outline: any, document: any, tests: any, diagnostics: any[] }}
 */
export function analyze(text) {
  const prepared = prepare(text)
  const outline = scanDocument(prepared.source)
  const result = { outline, document: null, tests: null, diagnostics: [] }
  /* Файл-функтор ftsc — отображение между категориями, ядру он не документ:
     разбирать его умеет только ftsc, и придумывать по нему ошибки нельзя. */
  if (prepared.kind === "functor") return result
  if (outline.logical.length === 0) return result /* пустой буфер не подчёркиваем */

  try {
    result.document = compile(prepared.source)
  } catch (error) {
    result.diagnostics.push(...coreDiagnostics(error, outline, text))
    return result
  }

  try {
    for (const diagnostic of validate(result.document).diagnostics) {
      result.diagnostics.push(toLspDiagnostic(diagnostic, outline, text))
    }
  } catch (error) {
    result.diagnostics.push(...coreDiagnostics(error, outline, text))
  }

  if ((result.document.utilities ?? []).length > 0) {
    const invalid = result.diagnostics.length > 0
    try {
      result.tests = testUtilities(result.document)
    } catch {
      /* «нет примеров» — не ошибка модели, а её состояние */
    }
    for (const item of result.tests?.results ?? []) {
      /* Пример, упавший на уже сообщённой ошибке модели, второй раз не жалуемся. */
      if (item.passed || (item.error && invalid)) continue
      result.diagnostics.push(exampleDiagnostic(item, outline))
    }
  }

  return result
}

/** Диагностики из брошенного ядром `FtsError`. */
function coreDiagnostics(error, outline, text) {
  const list = Array.isArray(error?.diagnostics) && error.diagnostics.length > 0
    ? error.diagnostics
    : [{ code: "FTS_INTERNAL", message: error instanceof Error ? error.message : String(error), severity: "error" }]
  return list.map((diagnostic) => toLspDiagnostic(diagnostic, outline, text))
}

/**
 * Перевод диагностики ядра в диагностику LSP.
 *
 * Источников координат три, и они не равноценны:
 *  - `span` (скобочная поверхность) — точные строка и колонка;
 *  - `path: "строка N"` (отступная поверхность) — только строка, колонки
 *    берём по содержимому строки без отступа и комментария;
 *  - `path: "$.utilities[0]..."` (validate) — координат нет вовсе, ищем
 *    по разметке; если хвост пути неизвестен, подчёркивание сползает к
 *    ближайшему известному предку.
 */
function toLspDiagnostic(diagnostic, outline, text) {
  return {
    range: diagnosticRange(diagnostic, outline, text),
    severity: diagnostic.severity === "warning" ? Severity.warning : Severity.error,
    code: diagnostic.code,
    source: "fts",
    message: diagnostic.message,
  }
}

function diagnosticRange(diagnostic, outline, text) {
  if (diagnostic.span) {
    const start = { line: Math.max(0, diagnostic.span.start.line - 1), character: Math.max(0, diagnostic.span.start.column - 1) }
    const end = { line: Math.max(0, diagnostic.span.end.line - 1), character: Math.max(0, diagnostic.span.end.column - 1) }
    return end.line < start.line || (end.line === start.line && end.character <= start.character)
      ? { start, end: { line: start.line, character: start.character + 1 } }
      : { start, end }
  }

  const naturalLine = /^(?:строка|line)\s+(\d+)$/u.exec(diagnostic.path ?? "")
  if (naturalLine) {
    const line = outline.lines[Number(naturalLine[1]) - 1]
    if (line) return { start: { line: line.number, character: line.startChar }, end: { line: line.number, character: Math.max(line.endChar, line.startChar + 1) } }
  }

  if (diagnostic.path?.startsWith("$")) {
    const resolved = resolvePath(outline, diagnostic.path)
    if (resolved) return resolved
  }

  /* Часть ошибок ядра приходит вообще без координат — например
     «не найден морфизм «X»». Имя в кавычках есть в самом тексте
     сообщения, и по нему строка находится однозначно. */
  const quoted = /[«"']([^«»"']+)[»"']/u.exec(diagnostic.message ?? "")
  if (quoted) {
    const line = outline.logical.find((item) => item.text.includes(quoted[1]))
    if (line) return { start: { line: line.number, character: line.startChar }, end: { line: line.number, character: Math.max(line.endChar, line.startChar + 1) } }
  }

  const first = outline.logical[0] ?? outline.lines[0]
  if (!first) return { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }
  return { start: { line: first.number, character: first.startChar }, end: { line: first.number, character: Math.max(first.endChar, first.startChar + 1) } }
}

/** Несходящийся пример → диагностика на строке `ожидается`. */
function exampleDiagnostic(item, outline) {
  const utility = outline.utilities.find((node) => node.name === item.utility)
  const example = utility?.examples.find((node) => node.name === item.example)
  const target = example?.expectedNode ?? example ?? utility
  const english = outline.language === "en"
  const message = item.error
    ? english
      ? `example "${item.example}" failed: ${item.error}`
      : `пример «${item.example}» завершился ошибкой: ${item.error}`
    : english
      ? `example "${item.example}": expected ${format(item.expected)}, actual ${format(item.actual)}`
      : `пример «${item.example}»: ожидается ${format(item.expected)}, фактически ${format(item.actual)}`
  return {
    range: target?.valueRange ?? target?.lineRange ?? { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    severity: Severity.error,
    code: item.error ? "FTS_UTILITY_EXAMPLE_ERROR" : "FTS_UTILITY_EXAMPLE_MISMATCH",
    source: "fts",
    message,
  }
}

/** Скаляр ядра в текст поверхности. */
export function format(value) {
  if (value === undefined) return "—"
  if (value === null) return "ничто"
  if (value === true) return "да"
  if (value === false) return "нет"
  return String(value)
}
