import { existsSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, join } from "node:path"

/**
 * Load the compiled FTS core (`compile`, `validate`, `testUtilities`).
 *
 * This action deliberately does not vendor or rebuild the core itself: it
 * expects the workflow to have already produced a built `@digitable/fts`
 * before this step runs (`npm ci && npm run build` when checking this very
 * repository, or a plain `npm install` in any project that depends on it).
 *
 * Resolution order:
 *   1. `import("@digitable/fts")` — resolves via Node's package
 *      self-reference when this action runs inside the fts repo itself
 *      (its own package.json declares `"name": "@digitable/fts"` and an
 *      `exports` map), and resolves the normal way via `node_modules` when
 *      this action is vendored into a *different* project that installed
 *      `@digitable/fts` as a dependency.
 *   2. `<workspace>/dist/src/index.js` — a plain relative fallback for
 *      layouts where neither of the above applies.
 */
export async function loadFts(workspaceDir) {
  try {
    return await import("@digitable/fts")
  } catch (selfReferenceError) {
    const fallback = join(workspaceDir, "dist", "src", "index.js")
    if (existsSync(fallback)) return import(pathToFileURL(fallback).href)
    throw new Error(
      "could not load @digitable/fts (tried package resolution and " +
        `${fallback}). Run "npm ci && npm run build" (or install @digitable/fts) before this step. ` +
        `Underlying error: ${selfReferenceError instanceof Error ? selfReferenceError.message : String(selfReferenceError)}`,
    )
  }
}

/** Resolve the on-disk root of the @digitable/fts package, for locating tools/ftsc and tools/ftspec. */
export async function locateFtsPackageRoot(workspaceDir) {
  try {
    const pkgUrl = await import.meta.resolve("@digitable/fts/package.json")
    return dirname(fileURLToPath(pkgUrl))
  } catch {
    return workspaceDir
  }
}

function diagnosticsFromError(error) {
  if (error && Array.isArray(error.diagnostics)) return error.diagnostics
  return [{ code: "FTS_INTERNAL", severity: "error", message: error instanceof Error ? error.message : String(error) }]
}

/**
 * Run `compile`, `validate`, and (when the model declares any utilities)
 * `testUtilities` against one `.fts` source file, per the CLI's own contract
 * (src/cli.ts: JSON result / thrown FtsError, both carrying `diagnostics`).
 *
 * A document with zero utilities (e.g. a pure structures/functors/proposition
 * model, like examples/socrates.fts) is not an error — `testUtilities` is
 * simply skipped for it, matching how `fts test` itself would reject such a
 * document (`FTS_NO_UTILITIES`) even though the model is perfectly valid.
 */
export function checkFtsSource(fts, source) {
  let document
  try {
    document = fts.compile(source)
  } catch (error) {
    return { diagnostics: diagnosticsFromError(error), examplesTotal: 0, examplesFailed: 0, hasUtilities: false }
  }

  const validation = fts.validate(document)
  const diagnostics = [...validation.diagnostics]
  const hasUtilities = (document.utilities ?? []).length > 0

  let examplesTotal = 0
  let examplesFailed = 0

  if (validation.valid && hasUtilities) {
    try {
      const testResult = fts.testUtilities(validation.document)
      examplesTotal = testResult.total
      examplesFailed = testResult.failed
      for (const result of testResult.results) {
        if (result.passed) continue
        diagnostics.push({
          code: "FTS_EXAMPLE_MISMATCH",
          severity: "error",
          /* `testUtilities` reports a non-converging example with no location
             at all — only the names of the utility and the example it ran.
             Carrying those two names through is what lets `tools/locate` put
             the annotation on the `expected` line instead of on line 1. */
          utility: result.utility,
          example: result.example,
          message: result.error
            ? `utility '${result.utility}', example '${result.example}': ${result.error}`
            : `utility '${result.utility}', example '${result.example}': expected ${JSON.stringify(result.expected)}, got ${JSON.stringify(result.actual)}`,
        })
      }
    } catch (error) {
      diagnostics.push(...diagnosticsFromError(error))
    }
  }

  return { diagnostics, examplesTotal, examplesFailed, hasUtilities }
}
