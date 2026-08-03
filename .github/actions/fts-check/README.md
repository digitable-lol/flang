# fts-check

A GitHub Action that compiles, validates, and runs the executable examples of
every `.fts` model touched by a change, and reports each diagnostic as an
inline annotation on the diff — so a broken business rule shows up as a red
line on the PR, not as a 300-line log a reviewer has to open.

## Quick start

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 } # only needed for changed-only: true
- uses: actions/setup-node@v4
  with: { node-version: 20 }
- run: npm ci && npm run build
- uses: ./ # or digitable/fts@<ref> from another repository
  with:
    paths: examples/**/*.fts
    changed-only: true
```

See `.github/workflows/fts-example.yml` in this repository for a complete,
runnable version (`workflow_dispatch`, so it doesn't also fire on every push).

## Why a dependency-free JavaScript action

The brief for this action was Node 20+, no external dependencies — including
`@actions/core`. That's a smaller ask than it sounds: `@actions/core`'s own
`getInput`/`setOutput`/`setFailed` are themselves thin wrappers over two
mechanisms GitHub documents directly —  `INPUT_*` environment variables and
workflow commands (`::error ...::`, appends to `$GITHUB_OUTPUT` /
`$GITHUB_STEP_SUMMARY`). `lib/core.mjs` reimplements exactly that surface in
about 40 lines, with no HTTP client, no transitive tree, and no version drift
risk against the runner. A composite action was the other option on the table,
but the actual work here — diagnostic → annotation formatting, glob/changed-
file selection, table rendering — is logic that wants unit tests, not another
layer of `run:` shell steps.

## Inputs

| Input | Default | Meaning |
| --- | --- | --- |
| `paths` | `**/*.fts` | Newline- or comma-separated glob patterns (`*`, `**`) selecting which `.fts` files to check, relative to the repo root. |
| `changed-only` | `false` | Only check files that differ from the PR base (`git diff --name-only`), instead of every file matched by `paths`. Needs enough history to reach the base ref (`fetch-depth: 0`, or `2+` on `push`). |
| `fail-on-warning` | `false` | Also fail the step when only warning-severity diagnostics were found. |
| `ftsc` | `false` | Also run `ftsc check` over the repo root (module imports, cross-category functors) if `tools/ftsc` exists in this checkout. Silently skipped otherwise. |
| `ftspec` | `false` | Also run `ftspec check` over the repo root (specification corpus integrity) if `tools/ftspec` exists in this checkout. Silently skipped otherwise. |
| `summary` | `true` | Write a "model — examples converge — diagnostics" table to `$GITHUB_STEP_SUMMARY`. |

## Outputs

| Output | Meaning |
| --- | --- |
| `models` | Number of `.fts` models (files) checked. |
| `diagnostics` | Total diagnostics reported (errors + warnings). |
| `errors` | Error-severity diagnostics. |
| `warnings` | Warning-severity diagnostics. |
| `examples-failed` | Executable examples whose actual result didn't match the expected one. |

## What the annotations look like

Each diagnostic (`{ code, message, severity, path?, span? }` — see
`src/diagnostics.ts`) becomes one workflow command printed to stdout:

```
::error file=examples/discount.fts,line=14,col=7,title=FTS_UTILITY_COMPARE_TYPE::field 'amount' is not numeric
::error file=examples/discount.fts,line=1,col=1,title=FTS_EXAMPLE_MISMATCH::utility 'Calculate discount', example 'Large purchase': expected 2000, got 1000
```

A diagnostic with a `span` (a parser error, most often) is pinned to that
exact line/column. One without a span — the validator only ever sees an
already-parsed document, so it locates problems with a JSON pointer like
`$.utilities[0].examples[1].expected` rather than a line number — is pinned to
line 1 of the file, with that pointer folded into the message text so the
location isn't silently lost. A non-converging example gets a synthetic
`FTS_EXAMPLE_MISMATCH` diagnostic carrying the expected and actual value.

## What this action does not do

- It does not fix models, suggest patches, or judge whether a passing example
  is the *right* one — it runs `compile` → `validate` → `testUtilities`
  exactly as `fts check`/`fts test` would and reports what comes back.
- It does not build or vendor the FTS core itself. The workflow must produce
  a built `@digitable/fts` before this step (`npm ci && npm run build` when
  checking this repository; a plain `npm install` in a project that merely
  depends on it).
- It does not evaluate `.fts` files that use `ftsc`'s module header (`модуль` /
  `module`, `использует` / `uses`) through the plain per-file path — those are
  project-level constructs the core parser doesn't understand on their own.
  Point `paths` away from them, or turn on `ftsc: true` to check that project
  the way it's meant to be checked.
- A model with zero utilities (a pure structures/functors/proposition model)
  is not treated as an error — `testUtilities` is simply skipped for it, the
  same way it declares nothing to test either way.
