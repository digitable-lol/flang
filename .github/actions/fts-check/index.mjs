#!/usr/bin/env node
import { appendSummary, getBooleanInput, getInput, setFailed, setOutput } from "./lib/core.mjs"
import { run } from "./lib/run.mjs"

async function main() {
  const workspaceDir = process.env.GITHUB_WORKSPACE ?? process.cwd()

  const paths = getInput("paths") || "**/*.fts"
  const changedOnly = getBooleanInput("changed-only")
  const failOnWarning = getBooleanInput("fail-on-warning")
  const runFtsc = getBooleanInput("ftsc")
  const runFtspec = getBooleanInput("ftspec")
  const writeSummary = getInput("summary") === "" ? true : getBooleanInput("summary")

  let result
  try {
    result = await run({ workspaceDir, paths, changedOnly, failOnWarning, runFtsc, runFtspec })
  } catch (error) {
    setFailed(error instanceof Error ? error.message : String(error))
    return
  }

  for (const line of result.annotations) process.stdout.write(`${line}\n`)

  if (writeSummary) await appendSummary(result.summaryMarkdown)

  await setOutput("models", result.counts.models)
  await setOutput("diagnostics", result.counts.diagnostics)
  await setOutput("errors", result.counts.errors)
  await setOutput("warnings", result.counts.warnings)
  await setOutput("examples-failed", result.counts.examplesFailed)

  if (result.failed) {
    setFailed(
      `fts-check found ${result.counts.errors} error(s)` +
        (failOnWarning ? ` and ${result.counts.warnings} warning(s)` : "") +
        ` across ${result.counts.models} model(s).`,
    )
  }
}

await main()
