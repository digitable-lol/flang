/** Escape a cell so it can't break out of the markdown table it's rendered into. */
function cell(text) {
  return String(text).replace(/\|/g, "\\|").replace(/\r?\n/g, " ")
}

/**
 * Counted by declared severity, and an unknown severity counts as an error:
 * a level this action has not heard of must not be quietly downgraded.
 */
function countBySeverity(diagnostics) {
  const warnings = diagnostics.filter((d) => d.severity === "warning").length
  const notices = diagnostics.filter((d) => d.severity === "info").length
  return { errors: diagnostics.length - warnings - notices, warnings, notices }
}

function diagnosticsCell(diagnostics) {
  if (diagnostics.length === 0) return "0"
  const { errors, warnings, notices } = countBySeverity(diagnostics)
  const parts = []
  if (errors > 0) parts.push(`${errors} error${errors === 1 ? "" : "s"}`)
  if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? "" : "s"}`)
  if (notices > 0) parts.push(`${notices} notice${notices === 1 ? "" : "s"}`)
  return parts.join(", ")
}

/**
 * Build the "model — examples converge — diagnostics" Job Summary table
 * required by the spec: a result visible on the PR without opening the logs.
 *
 * `models` is an array of `{ file, hasUtilities, examplesTotal, examplesFailed, diagnostics }`.
 * `tools` is an array of `{ name, diagnostics }` for any ftsc/ftspec runs.
 */
export function buildSummaryMarkdown(models, tools = []) {
  const lines = []
  lines.push("# FTS check")
  lines.push("")
  lines.push("| Model | Examples | Diagnostics |")
  lines.push("| --- | --- | --- |")

  for (const model of models) {
    const examplesCell = model.hasUtilities ? `${model.examplesTotal - model.examplesFailed}/${model.examplesTotal}` : "—"
    lines.push(`| ${cell(model.file)} | ${examplesCell} | ${diagnosticsCell(model.diagnostics)} |`)
  }

  for (const tool of tools) {
    lines.push(`| ${cell(tool.name)} | — | ${diagnosticsCell(tool.diagnostics)} |`)
  }

  const allDiagnostics = [...models.flatMap((m) => m.diagnostics), ...tools.flatMap((t) => t.diagnostics)]
  const totalExamplesFailed = models.reduce((sum, m) => sum + m.examplesFailed, 0)
  const totalExamples = models.reduce((sum, m) => sum + m.examplesTotal, 0)
  const { errors, warnings, notices } = countBySeverity(allDiagnostics)

  lines.push("")
  lines.push(
    `**${models.length} model(s) checked** · ${totalExamples - totalExamplesFailed}/${totalExamples} example(s) converge · ` +
      `${errors} error(s), ${warnings} warning(s), ${notices} notice(s)`,
  )
  lines.push("")

  return `${lines.join("\n")}\n`
}
