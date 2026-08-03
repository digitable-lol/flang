import { readFile } from "node:fs/promises"

import { locate, outline } from "../../../../tools/locate/index.mjs"

import { diagnosticToAnnotation } from "./annotate.mjs"
import { listAllFtsFiles, listChangedFiles, parsePatterns, resolveBaseRef } from "./discover.mjs"
import { findTool, resolveToolDiagnosticFile, runTool } from "./externalTools.mjs"
import { checkFtsSource, loadFts, locateFtsPackageRoot } from "./ftsRuntime.mjs"
import { buildSummaryMarkdown } from "./summaryReport.mjs"
import { relative } from "node:path"

/**
 * Run the full check and return everything the caller (index.mjs, or a test)
 * needs: the annotation lines to print, the summary markdown, the output
 * counts, and whether the run should fail the step.
 *
 * Kept free of any GitHub Actions I/O (no reading env vars, no printing, no
 * process.exit) so it can be exercised directly against a fixture directory
 * in tests.
 *
 * `options`:
 *   - workspaceDir (string, required)
 *   - paths (string) — raw `paths` input, default "**\/*.fts"
 *   - changedOnly (boolean)
 *   - failOnWarning (boolean)
 *   - runFtsc (boolean)
 *   - runFtspec (boolean)
 *   - env (object) — for resolveBaseRef; defaults to process.env
 *   - loadFtsImpl / findToolImpl / runToolImpl / locateFtsPackageRootImpl — injectable for tests
 */
export async function run(options) {
  const {
    workspaceDir,
    paths = "**/*.fts",
    changedOnly = false,
    failOnWarning = false,
    runFtsc = false,
    runFtspec = false,
    env = process.env,
    loadFtsImpl = loadFts,
    locateFtsPackageRootImpl = locateFtsPackageRoot,
    findToolImpl = findTool,
    runToolImpl = runTool,
  } = options

  const patterns = parsePatterns(paths)
  const files = changedOnly
    ? listChangedFiles(workspaceDir, resolveBaseRef(env), patterns)
    : listAllFtsFiles(workspaceDir, patterns)

  const fts = await loadFtsImpl(workspaceDir)

  const models = []
  const annotations = []

  for (const file of files) {
    const relPath = relative(workspaceDir, file).split("\\").join("/")
    const source = await readFile(file, "utf8")
    /* One outline per file, shared by every diagnostic it produces. It also
       carries `compileSource`: the same text with an ftsc module header
       blanked out (the core does not compile headers) but with line numbers
       untouched, so annotations still point at lines of the real file. */
    const view = outline(source)
    const result = checkFtsSource(fts, view.compileSource)
    models.push({
      file: relPath,
      hasUtilities: result.hasUtilities,
      examplesTotal: result.examplesTotal,
      examplesFailed: result.examplesFailed,
      diagnostics: result.diagnostics,
    })
    /* `fallback: "none"` on purpose. In an editor, guessing a line from a name
       quoted in the message is a cheap affordance — the cursor is already
       there. On a pull request a guessed annotation lands on a diff line and
       misleads, so a diagnostic that carries no location at all keeps the
       documented line-1 pin instead. */
    for (const diagnostic of result.diagnostics) {
      const spot = locate(diagnostic, view, { origin: "core", fallback: "none" })
      annotations.push(diagnosticToAnnotation(diagnostic, relPath, spot))
    }
  }

  const tools = []
  const packageRoot = await locateFtsPackageRootImpl(workspaceDir)

  for (const [flag, toolName] of [
    [runFtsc, "ftsc"],
    [runFtspec, "ftspec"],
  ]) {
    if (!flag) continue
    const binPath = findToolImpl(packageRoot, toolName)
    if (!binPath) continue
    const { diagnostics } = runToolImpl(binPath, workspaceDir)
    tools.push({ name: toolName, diagnostics })
    for (const diagnostic of diagnostics) {
      const file = resolveToolDiagnosticFile(diagnostic, workspaceDir, workspaceDir)
      /* `origin: "tool"` tells `locate` that `diagnostic.path` is a file name
         and not a pointer into a document, so it never resolves it against an
         outline of some other file. */
      annotations.push(diagnosticToAnnotation(diagnostic, file, locate(diagnostic, null, { origin: "tool" })))
    }
  }

  const allDiagnostics = [...models.flatMap((m) => m.diagnostics), ...tools.flatMap((t) => t.diagnostics)]
  const errors = allDiagnostics.filter((d) => d.severity !== "warning").length
  const warnings = allDiagnostics.length - errors
  const examplesFailed = models.reduce((sum, m) => sum + m.examplesFailed, 0)

  const failed = errors > 0 || (failOnWarning && warnings > 0)

  return {
    models,
    tools,
    annotations,
    summaryMarkdown: buildSummaryMarkdown(models, tools),
    counts: {
      models: models.length,
      diagnostics: allDiagnostics.length,
      errors,
      warnings,
      examplesFailed,
    },
    failed,
  }
}
