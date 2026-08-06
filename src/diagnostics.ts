/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */

import type { SourceSpan } from "./model.js"

/**
 * `error` — the document is not a valid FTS document.
 * `warning` — the document is valid, but says something its author is unlikely
 *   to have meant: an unreachable property limit, a hole in rule coverage.
 * `info` — true and worth printing, but nothing is wrong: two rules that both
 *   add to the result overlap, and their order does not matter.
 *
 * Only `error` decides validity, so a consumer may filter by severity and
 * never lose a reason to reject a document.
 */
export type DiagnosticSeverity = "error" | "warning" | "info"

export interface Diagnostic {
  code: string
  message: string
  severity: DiagnosticSeverity
  path?: string
  span?: SourceSpan
  /** What to do about it: a concrete edit, not "review the logic". */
  hint?: string
}

export class FtsError extends Error {
  readonly diagnostics: Diagnostic[]

  constructor(message: string, diagnostics: Diagnostic[]) {
    super(message)
    this.name = "FtsError"
    this.diagnostics = diagnostics
  }
}

export function diagnosticError(
  code: string,
  message: string,
  options: { path?: string; span?: SourceSpan } = {},
): FtsError {
  const diagnostic: Diagnostic = { code, message, severity: "error" }
  if (options.path !== undefined) diagnostic.path = options.path
  if (options.span !== undefined) diagnostic.span = options.span
  return new FtsError(message, [diagnostic])
}

export function errorResult(error: unknown): { error: string; diagnostics: Diagnostic[] } {
  if (error instanceof FtsError) {
    return { error: error.message, diagnostics: error.diagnostics }
  }

  const message = error instanceof Error ? error.message : String(error)
  return {
    error: message,
    diagnostics: [{ code: "FTS_INTERNAL", message, severity: "error" }],
  }
}
