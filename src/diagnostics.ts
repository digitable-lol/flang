import type { SourceSpan } from "./model.js"

export type DiagnosticSeverity = "error" | "warning"

export interface Diagnostic {
  code: string
  message: string
  severity: DiagnosticSeverity
  path?: string
  span?: SourceSpan
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
