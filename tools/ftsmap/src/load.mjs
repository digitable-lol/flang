/**
 * Загрузка одной модели `.fts` в документ ядра.
 *
 * ftsmap ничего не парсит сам. Разбор заголовка модуля — работа ftsc, разбор
 * тела — работа ядра; обе задачи уже решены в `tools/ftsvm/src/load-fts.mjs`,
 * и повторять их здесь незачем. Отсюда единственная добавка: понятная ошибка,
 * когда файл не читается или не проходит проверку, чтобы CLI мог отдать её в
 * stderr одним и тем же способом с остальными инструментами репозитория.
 */
import { readFile } from "node:fs/promises"
import { basename } from "node:path"

import { validate } from "../../../dist/src/index.js"
import { compileModuleSource } from "../../ftsvm/src/load-fts.mjs"

/** Ошибка ftsmap в том же виде, в каком её ждут CLI и тесты. */
export function mapError(code, message, details = {}) {
  const error = new Error(message)
  error.diagnostics = [{ code, message, severity: "error", ...details }]
  return error
}

/**
 * Прочитать и скомпилировать модель.
 *
 * @param {string} file путь к `.fts`
 * @returns {Promise<import("../../../dist/src/model.js").FtsDocument>}
 */
export async function loadModel(file) {
  let source
  try {
    source = await readFile(file, "utf8")
  } catch (error) {
    throw mapError("FTSMAP_READ", `не удалось прочитать «${file}»: ${error.message}`, { path: file })
  }

  let document
  try {
    document = compileModuleSource(source)
  } catch (error) {
    const inner = error.diagnostics?.map((item) => `${item.code}: ${item.message}`).join("; ") ?? error.message
    throw mapError("FTSMAP_COMPILE", `модель «${basename(file)}» не компилируется: ${inner}`, { path: file })
  }

  const report = validate(document)
  if (!report.valid) {
    const inner = report.diagnostics.map((item) => `${item.code}: ${item.message}`).join("; ")
    throw mapError("FTSMAP_INVALID", `модель «${basename(file)}» не прошла проверку: ${inner}`, { path: file })
  }

  return document
}
