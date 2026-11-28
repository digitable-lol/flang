[Back to README](../../README.md) · [Documentation index](../README.md)

# Developing the language

There is one compiler, written in flang itself and built into a binary. Working on it takes a
clone and nothing else: the package has no dependencies, so the commands run straight after
`git clone`.

A change to the compiler in `flang/self/` re-emits `bootstrap/` in the same commit. Otherwise
`bootstrap/` builds the previous compiler, and nothing reports it:

```bash
sh scripts/bootstrap-reprint.sh           # reprint bootstrap/ (hours)
sh scripts/bootstrap-reprint.sh --check   # compare against the sources byte for byte, exit 1 on drift
sh scripts/bootstrap-reprint.sh --stroki  # under a second: every C string literal in the runtime is closed
```

The binary compiler itself does the printing (`bootstrap/flang emit … --target c`); if the binary
is missing, the script builds it from `bootstrap/` first.

The check re-emits and so takes as long as the emission (hours), plus a `make` if the binary is
not built. Run `--check` before merging a change under `flang/self/` or `flang/src/emit/c/`, not
on every save.

To check an edited compiler source on one program before an emission, the built binary runs the
sources in its interpreter: `flang/self/bootstrap/check-with-source-compiler.flang` checks one file with them and
prints the proof report in words and the proof record. `--trust` skips the proof check of the
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

The compiler's commands:

```bash
# parse, type-check, prove totality
flang check docs/examples/leetcode/035-search-insert-position.flang

# run the examples declared inside the functions
flang test docs/examples/leetcode/035-search-insert-position.flang

# the same over a set of files: a directory or a glob instead of a file.
# Every failing example and every file not taken is named; the passing ones are
# a count. Exit code 0 — everything passed, 1 — an example failed or a file was not
# taken, 2 — an error in the invocation.
flang test flang/stdlib/
flang test 'docs/examples/**/*.flang' --json

# call a function: --args takes a JSON object, lists and records included
flang run docs/examples/leetcode/035-search-insert-position.flang \
  --function "Место вставки" --args '{"элементы": [1,3,5,6], "цель": 5}'

# print it — targets: c | cpp | csharp | elixir | go | java | js | python | rust | ts
flang emit docs/examples/leetcode/035-search-insert-position.flang \
  --target python --out ./out-python
```

Checks:

```bash
sh flang/test/обход.sh          # the walker's checks, run by the binary
sh flang/test/обход-примеров.sh # every example in the tree
sh scripts/bootstrap-reprint.sh --check  # the seed against what the sources emit
bootstrap/flang run-script                                  # the tree's shortcut commands and what each one runs
bootstrap/flang run-script tests                            # linking, the scheduler and supervision on the emit targets
```

A single check is run by its name from that list: `bootstrap/flang run-script specs:check`,
`bootstrap/flang run-script links:check`, `bootstrap/flang run-script site:check`. Exit code 0 means
no errors; with a non-zero code the output names what failed.

Commands print their result as text to stdout and error messages to stderr, and return non-zero
on an error. `flang test --json` and `flang check --proof --json` give JSON instead of text;
`flang io` and `flang run-script` print a record of the run as a JSON line.
