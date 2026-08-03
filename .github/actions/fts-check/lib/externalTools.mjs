import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { isAbsolute, join, relative } from "node:path"

/**
 * Run `ftsc check <projectDir>` or `ftspec check <projectDir>` (both share
 * the same output contract as the core CLI: JSON on stdout, `{ diagnostics }`
 * JSON on stderr on failure, non-zero exit on problems — see
 * tools/ftsc/bin/ftsc.mjs and tools/ftspec/bin/ftspec.mjs).
 *
 * Per spec, these are best-effort extras: if the tool isn't present in this
 * checkout (e.g. a consumer of `@digitable/fts` that doesn't vendor `tools/`),
 * `run` is skipped rather than failing the action.
 */
export function findTool(packageRoot, toolName) {
  const binPath = join(packageRoot, "tools", toolName, "bin", `${toolName}.mjs`)
  return existsSync(binPath) ? binPath : null
}

export function runTool(binPath, projectDir) {
  const result = spawnSync("node", [binPath, "check", projectDir], { encoding: "utf8" })
  const stderrText = result.stderr?.trim()
  let diagnostics = []

  if (stderrText) {
    try {
      const parsed = JSON.parse(stderrText)
      diagnostics = Array.isArray(parsed.diagnostics) ? parsed.diagnostics : []
    } catch {
      diagnostics = [{ code: "FTS_TOOL_ERROR", severity: "error", message: stderrText }]
    }
  } else if (result.status !== 0) {
    diagnostics = [{ code: "FTS_TOOL_ERROR", severity: "error", message: `${binPath} exited with code ${result.status}` }]
  }

  return { exitCode: result.status ?? 1, diagnostics }
}

/**
 * ftsc/ftspec diagnostics use `path` for a *real* project-relative file path
 * (unlike core `fts`, where `path` is a JSON pointer into the document — see
 * lib/annotate.mjs). Resolve it to a file annotation can point at, when it
 * refers to a file that actually exists in this checkout; otherwise leave it
 * for the message-text fallback in lib/annotate.mjs.
 */
export function resolveToolDiagnosticFile(diagnostic, projectDir, workspaceDir) {
  if (typeof diagnostic.path !== "string" || diagnostic.path.length === 0) return undefined
  const candidate = isAbsolute(diagnostic.path) ? diagnostic.path : join(projectDir, diagnostic.path)
  if (!existsSync(candidate)) return undefined
  return relative(workspaceDir, candidate).split("\\").join("/")
}
