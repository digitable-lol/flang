import { execFileSync } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { join, relative, sep } from "node:path"

const DEFAULT_IGNORED_DIRS = new Set([".git", "node_modules"])

/** Split the `paths` input into individual glob patterns. Accepts newline- or comma-separated lists. */
export function parsePatterns(raw) {
  return raw
    .split(/\r?\n|,/)
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0)
}

/**
 * Convert one glob pattern (supporting `*`, `**`, `?`, and literal text) into
 * a RegExp matched against a repository-relative, forward-slash path. This is
 * hand-rolled rather than a dependency because that is the whole of what the
 * `paths` input needs.
 */
export function globToRegExp(pattern) {
  let source = "^"
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        if (pattern[index + 2] === "/") {
          source += "(?:.*/)?"
          index += 2
        } else {
          source += ".*"
          index += 1
        }
      } else {
        source += "[^/]*"
      }
    } else if (char === "?") {
      source += "[^/]"
    } else if ("\\^$.|+()[]{}".includes(char)) {
      source += `\\${char}`
    } else {
      source += char
    }
  }
  return new RegExp(`${source}$`)
}

/** Recursively list every file under `root` whose repo-relative path matches one of `patterns`. */
export function listAllFtsFiles(root, patterns, ignoredDirs = DEFAULT_IGNORED_DIRS) {
  const regexes = patterns.map(globToRegExp)
  const results = []

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) continue
        walk(join(dir, entry.name))
        continue
      }
      if (!entry.isFile()) continue
      const full = join(dir, entry.name)
      const rel = relative(root, full).split(sep).join("/")
      if (regexes.some((regex) => regex.test(rel))) results.push(full)
    }
  }

  walk(root)
  return results.sort()
}

/** Resolve the git ref to diff against, from GitHub Actions' own environment. */
export function resolveBaseRef(env = process.env) {
  if (env.GITHUB_BASE_REF) return `origin/${env.GITHUB_BASE_REF}`
  if (env.GITHUB_EVENT_NAME === "push" && env.GITHUB_EVENT_BEFORE && !/^0+$/.test(env.GITHUB_EVENT_BEFORE)) {
    return env.GITHUB_EVENT_BEFORE
  }
  return "HEAD~1"
}

/**
 * List `.fts` files changed relative to `baseRef`, restricted to files that
 * still exist (so deletions don't get handed to the checker) and still match
 * `patterns`. Tries the three-dot form first (diff against the merge base,
 * which is what you want for a PR); falls back to a plain two-ref diff if
 * that fails (e.g. shallow clone without the merge base available).
 */
export function listChangedFiles(root, baseRef, patterns, execFile = execFileSync) {
  const regexes = patterns.map(globToRegExp)
  const run = (range) => execFile("git", ["diff", "--name-only", "--diff-filter=ACMR", ...range], { cwd: root, encoding: "utf8" })

  let output
  try {
    output = run([`${baseRef}...HEAD`])
  } catch {
    output = run([baseRef, "HEAD"])
  }

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => regexes.some((regex) => regex.test(line)))
    .map((line) => join(root, line))
    .filter((file) => existsSync(file))
    .sort()
}
