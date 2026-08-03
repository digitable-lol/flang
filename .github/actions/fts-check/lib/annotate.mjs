import { locate } from "../../../../tools/locate/index.mjs"

import { formatCommand } from "./commands.mjs"

/**
 * Turn one FTS `Diagnostic` (see src/diagnostics.ts: `{ code, message,
 * severity, path?, span? }`) into a GitHub workflow-command annotation line.
 *
 * Where the diagnostic belongs is not decided here: `tools/locate` decides it,
 * the same module the language server uses, so an annotation on a pull request
 * and a squiggle in the editor land on the same character. This function only
 * formats what it is given.
 *
 * `spot` is the result of `locate(...)` — `{ line, column, endLine, endColumn }`
 * or `null`. The default resolves what can be resolved without the document
 * text (that is: a `span`, and nothing else), which is what a caller that has
 * only the diagnostic in hand can honestly offer.
 *
 * Two different notions of "path" collide in `diagnostic.path` and must be told
 * apart — a JSON pointer into the document (core `fts`) versus a real file path
 * (`ftsc`/`ftspec`). `locate` makes that distinction; see its `classifyPath`.
 * The `file` argument here is always a real filesystem path, resolved by the
 * caller, that GitHub can point an annotation at.
 *
 * When nothing located the diagnostic, the annotation is pinned to line 1 of
 * `file` (per spec) and `diagnostic.path`, if present, is folded into the
 * message text so the location information is not silently dropped.
 */
export function diagnosticToAnnotation(diagnostic, file, spot = locate(diagnostic, null, { fallback: "none" })) {
  const severity = diagnostic.severity === "warning" ? "warning" : "error"
  const properties = {}
  if (file !== undefined) properties.file = file

  if (spot) {
    properties.line = spot.line
    properties.col = spot.column
    if (spot.endLine !== spot.line) properties.endLine = spot.endLine
    if (spot.endLine !== spot.line || spot.endColumn !== spot.column) properties.endColumn = spot.endColumn
  } else if (file !== undefined) {
    properties.line = 1
    properties.col = 1
  }
  if (diagnostic.code) properties.title = diagnostic.code

  const message = spot || !diagnostic.path ? diagnostic.message : `${diagnostic.message} (${diagnostic.path})`

  return formatCommand(severity, properties, message)
}
