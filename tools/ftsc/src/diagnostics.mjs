/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Диагностики ftsc.
 *
 * Формат совпадает с диагностиками ядра FTS (code, message, severity, path),
 * чтобы редакторы, CI и агенты обрабатывали ошибки компилятора проекта тем же
 * кодом, что и ошибки одиночной модели.
 */
export class FtscError extends Error {
  constructor(message, diagnostics) {
    super(message)
    this.name = "FtscError"
    this.diagnostics = diagnostics
  }
}

export function fail(code, message, path) {
  return new FtscError(message, [{ code, message, severity: "error", ...(path ? { path } : {}) }])
}

/** Собирает несколько проблем в одну ошибку: проекту полезно увидеть весь список сразу. */
export function failAll(diagnostics) {
  const first = diagnostics[0]
  const rest = diagnostics.length - 1
  return new FtscError(rest > 0 ? `${first.message} (и ещё ${rest})` : first.message, diagnostics)
}

export const codes = {
  moduleHeader: "FTSC_MODULE_HEADER",
  moduleName: "FTSC_MODULE_NAME",
  duplicateModule: "FTSC_DUPLICATE_MODULE",
  importNotFound: "FTSC_IMPORT_NOT_FOUND",
  importCategory: "FTSC_IMPORT_CATEGORY",
  notExported: "FTSC_NOT_EXPORTED",
  exportUnknown: "FTSC_EXPORT_UNKNOWN",
  cycle: "FTSC_MODULE_CYCLE",
  functorHeader: "FTSC_FUNCTOR_HEADER",
  functorCategory: "FTSC_FUNCTOR_CATEGORY_UNKNOWN",
  functorObjectMissing: "FTSC_FUNCTOR_OBJECT_MISSING",
  functorTargetUnknown: "FTSC_FUNCTOR_TARGET_UNKNOWN",
  functorFieldMissing: "FTSC_FUNCTOR_FIELD_MISSING",
  functorFieldUnknown: "FTSC_FUNCTOR_FIELD_UNKNOWN",
  functorFieldType: "FTSC_FUNCTOR_FIELD_TYPE",
  functorStateConflict: "FTSC_FUNCTOR_STATE_CONFLICT",
  functorMorphismShape: "FTSC_FUNCTOR_MORPHISM_SHAPE",
  functorComposition: "FTSC_FUNCTOR_COMPOSITION",
  targetUnknown: "FTSC_TARGET_UNKNOWN",
  empty: "FTSC_EMPTY_PROJECT",
}
