/**
 * Анализ документа: компиляция ядром, проверка, исполнение примеров.
 *
 * Сервер ничего не вычисляет сам. Он вызывает `compile`, `validate` и
 * `testUtilities` из ядра, а координаты для их диагностик берёт у общего
 * модуля `tools/locate`. Именно поэтому подсказки в редакторе не могут
 * разойтись ни с `fts test`, ни с аннотациями CI: и вычисление, и разметка —
 * один и тот же код.
 *
 * Своего здесь остаётся ровно то, что своим и является: какие вызовы ядра
 * делать и в каком порядке, и как звучит сообщение — по-русски или
 * по-английски. Где его подчеркнуть, решает `locate`.
 */
import { compile, testUtilities, validate } from "../../../dist/src/index.js"

import { locate, outline, toLspRange } from "./outline.mjs"

export const Severity = { error: 1, warning: 2, information: 3, hint: 4 }

const START = { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }

/**
 * @param {string} text
 * @returns {{ outline: any, document: any, tests: any, diagnostics: any[] }}
 */
export function analyze(text) {
  const view = outline(text)
  const result = { outline: view, document: null, tests: null, diagnostics: [] }
  /* Файл-функтор ftsc — отображение между категориями, ядру он не документ:
     разбирать его умеет только ftsc, и придумывать по нему ошибки нельзя. */
  if (view.kind === "functor") return result
  if (view.logical.length === 0) return result /* пустой буфер не подчёркиваем */

  try {
    /* `compileSource` — текст без заголовка модуля ftsc, но с прежней
       нумерацией строк: заголовок ядру не по зубам, а координаты обязаны
       остаться координатами файла, который открыт в редакторе. */
    result.document = compile(view.compileSource)
  } catch (error) {
    result.diagnostics.push(...coreDiagnostics(error, view))
    return result
  }

  try {
    for (const diagnostic of validate(result.document).diagnostics) {
      result.diagnostics.push(toLspDiagnostic(diagnostic, view))
    }
  } catch (error) {
    result.diagnostics.push(...coreDiagnostics(error, view))
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
      result.diagnostics.push(exampleDiagnostic(item, view))
    }
  }

  return result
}

/** Диагностики из брошенного ядром `FtsError`. */
function coreDiagnostics(error, view) {
  const list = Array.isArray(error?.diagnostics) && error.diagnostics.length > 0
    ? error.diagnostics
    : [{ code: "FTS_INTERNAL", message: error instanceof Error ? error.message : String(error), severity: "error" }]
  return list.map((diagnostic) => toLspDiagnostic(diagnostic, view))
}

/** Диагностика ядра → диагностика LSP. */
function toLspDiagnostic(diagnostic, view) {
  return {
    range: toLspRange(locate(diagnostic, view, { origin: "core" })) ?? START,
    severity: diagnostic.severity === "warning" ? Severity.warning : Severity.error,
    code: diagnostic.code,
    source: "fts",
    message: diagnostic.message,
  }
}

/**
 * Несходящийся пример → диагностика на строке `ожидается`.
 *
 * Ядро возвращает такие примеры как `{ passed: false, expected, actual }`
 * без координат вовсе; строку по именам утилиты и примера находит `locate`,
 * а здесь остаётся только текст с обоими числами.
 */
function exampleDiagnostic(item, view) {
  const english = view.language === "en"
  const message = item.error
    ? english
      ? `example "${item.example}" failed: ${item.error}`
      : `пример «${item.example}» завершился ошибкой: ${item.error}`
    : english
      ? `example "${item.example}": expected ${format(item.expected)}, actual ${format(item.actual)}`
      : `пример «${item.example}»: ожидается ${format(item.expected)}, фактически ${format(item.actual)}`
  return {
    range: toLspRange(locate(item, view, { origin: "core" })) ?? START,
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
