import { appendFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"

/**
 * Minimal, dependency-free stand-in for the two `@actions/core` features this
 * action actually needs: reading `inputs.*` and writing `outputs.*`/the job
 * summary. Both are, under the hood, nothing more than environment variables
 * and a couple of files — `@actions/core` itself is a thin wrapper around
 * exactly this, so reimplementing it avoids pulling in a dependency (and its
 * transitive `@actions/http-client`) for nine lines of logic.
 *
 * - inputs: GitHub exposes `with:` values as `INPUT_<NAME>` env vars, name
 *   upper-cased and spaces turned into underscores (dashes are kept as-is).
 * - outputs: appended to the file at `$GITHUB_OUTPUT`, `key=value` per line,
 *   or a `key<<DELIM / value / DELIM` heredoc when the value contains a
 *   newline.
 * - job summary: raw markdown appended to the file at `$GITHUB_STEP_SUMMARY`.
 */

export function getInput(name, env = process.env) {
  const key = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`
  return env[key]?.trim() ?? ""
}

export function getBooleanInput(name, env = process.env) {
  return getInput(name, env).toLowerCase() === "true"
}

export async function setOutput(name, value, env = process.env) {
  const file = env.GITHUB_OUTPUT
  const text = String(value)
  if (!file) return
  if (text.includes("\n")) {
    const delimiter = `ghadelimiter_${randomUUID()}`
    await appendFile(file, `${name}<<${delimiter}\n${text}\n${delimiter}\n`)
  } else {
    await appendFile(file, `${name}=${text}\n`)
  }
}

export async function appendSummary(markdown, env = process.env) {
  const file = env.GITHUB_STEP_SUMMARY
  if (!file) return
  await appendFile(file, markdown.endsWith("\n") ? markdown : `${markdown}\n`)
}

export function notice(message) {
  process.stdout.write(`::notice::${message}\n`)
}

export function setFailed(message) {
  process.stdout.write(`::error::${message}\n`)
  process.exitCode = 1
}
