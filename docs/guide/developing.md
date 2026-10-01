[Back to README](../../README.md) · [Documentation index](../README.md)

# Developing the language

There is one compiler, written in flang itself and built into a binary. Working on it takes a
clone and nothing else: the package has no dependencies, so the commands run straight after
`git clone`.

A change to the compiler in `flang/self/` must reprint the bootstrap point in the same commit, or
`bootstrap/` starts building the previous compiler silently:

```bash
sh scripts/bootstrap-reprint.sh           # reprint bootstrap/ (hours: 7 h 28 min on 11 September 2026, commit 0ce948bfd)
sh scripts/bootstrap-reprint.sh --check   # compare against the sources byte for byte, exit 1 on drift
sh scripts/bootstrap-reprint.sh --stroki  # 0.6 s (11 September 2026): every C string literal in the runtime is closed
```

The binary compiler itself does the printing (`bootstrap/flang emit … --target c`); if the binary
is missing, the script builds it from `bootstrap/` first.

The check re-emits and so costs what the print costs (7 h 28 min on the 11 September 2026 reprint),
plus a `make` if the binary is not built. Call `--check` before merging a change under `flang/self/` or `flang/src/emit/c/`, not on
every save.

To try an edited compiler source on one program before a print, let the built binary interpret the
sources: `flang/self/bootstrap/check-with-source-compiler.flang` checks one file with them and
prints the proof ledger in words and the proof record. `--trust` skips the verdict over the
compiler itself; a small program takes about ten minutes and 12 GiB:

```bash
bootstrap/flang run flang/self/bootstrap/check-with-source-compiler.flang \
  --function 'Проверить исходным компилятором' --trust --max-steps 2000000000 \
  --args "$(jq -n --arg path FILE --rawfile text FILE '{"путь": $path, "текст": $text}')"
```

The order of imports in that module matters: linking takes a module's declarations through
whoever imports it first, together with that importer's `только` list, so «Compiler flang» comes
first, as in `compiler.flang`. With «Печать в C» first, a checked program with `требует` stops at
`FLANG_UNKNOWN_NAME` for «Печать значения».

The commands the language answers to:

```bash
# parse, type-check, prove totality
flang check docs/examples/leetcode/035-search-insert-position.flang --pretty

# run the examples declared inside the functions
flang test docs/examples/leetcode/035-search-insert-position.flang --pretty

# the same over a CORPUS: a directory or a glob instead of a file (binary only).
# Every failing example and every file not taken is named; the passing ones are
# a count. Exit code 0 — clean, 1 — something failed or a file was not taken,
# 2 — bad invocation.
flang test flang/stdlib/
flang test 'docs/examples/**/*.flang' --json

# call a function: --args takes a FLAT object of scalars, a list cannot go there
flang run docs/examples/leetcode/035-search-insert-position.flang \
  --function "Место вставки" --args '{"цель":2}'
# functions with a list argument are called by their own examples: flang test <file>

# print it — targets: c | cpp | csharp | elixir | go | java | js | python | rust | ts
flang emit docs/examples/leetcode/035-search-insert-position.flang \
  --target python --out ./out-python
```

Checks:

```bash
sh flang/test/обход.sh          # the walker's checks, run by the binary
sh flang/test/обход-примеров.sh # every example in the tree
sh scripts/bootstrap-reprint.sh --check  # the seed against what the sources emit
bootstrap/flang run-script                                  # every check in the tree, each with one line of explanation
bootstrap/flang run-script tests                            # the whole set at once
```

A single check is called by its name from that list: `bootstrap/flang run-script specs:check`, `bootstrap/flang run-script links:check`,
`bootstrap/flang run-script site:check`. Each has its own exit code: 0 — clean, non-zero — the culprit is named.

Every command writes JSON to stdout, diagnostics to stderr, and returns non-zero on failure —
the same contract everywhere, which is what makes it usable from CI, editors and agents. The one
exception is `flang repl`, which talks to a human.
