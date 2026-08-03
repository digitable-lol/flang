import { formatCommand } from "./commands.mjs"

/**
 * Turn one FTS `Diagnostic` (see src/diagnostics.ts: `{ code, message,
 * severity, path?, span? }`) into a GitHub workflow-command annotation line.
 *
 * Two different notions of "path" collide here and must be told apart:
 *
 *  - `file` (this function's second argument) is a real filesystem path,
 *    supplied by the caller, that GitHub can point an annotation at.
 *  - `diagnostic.path`, when core `fts` produces it, is a JSON-pointer-style
 *    locator *inside the document* (e.g. "$.utilities[0].examples[1].expected"),
 *    not a filesystem path — the parser's own diagnostics use `span` for real
 *    source coordinates, and only the *validator* (which only ever sees an
 *    already-parsed document, not source text) falls back to a JSON pointer.
 *    ftsc/ftspec diagnostics, by contrast, put a real module file path in
 *    `diagnostic.path` — the caller resolves that distinction before calling
 *    us and passes the result through as `file`.
 *
 * When there is no `span`, the annotation is pinned to line 1 of `file` (per
 * spec) and `diagnostic.path`, if present, is folded into the message text so
 * the location information is not silently dropped.
 */
export function diagnosticToAnnotation(diagnostic, file) {
  const severity = diagnostic.severity === "warning" ? "warning" : "error"
  const properties = {}
  if (file !== undefined) properties.file = file

  const span = diagnostic.span
  if (span) {
    properties.line = span.start.line
    properties.col = span.start.column
    if (span.end.line !== span.start.line) properties.endLine = span.end.line
    if (span.end.line !== span.start.line || span.end.column !== span.start.column) {
      properties.endColumn = span.end.column
    }
  } else if (file !== undefined) {
    properties.line = 1
    properties.col = 1
  }
  if (diagnostic.code) properties.title = diagnostic.code

  const message = span || !diagnostic.path ? diagnostic.message : `${diagnostic.message} (${diagnostic.path})`

  return formatCommand(severity, properties, message)
}
