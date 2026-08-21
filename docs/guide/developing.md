[Back to README](../../README.md) · [Documentation index](../README.md)

# Developing the language

There is one compiler, written in flang itself and built into a binary. Working on it takes a
clone and nothing else: the package has no dependencies, so the commands run straight after
`git clone`.

A change to the compiler in `flang/self/` must reprint the bootstrap point in the same commit, or
`bootstrap/` starts building the previous compiler silently:

```bash
sh scripts/raskrutka.sh           # reprint bootstrap/ (~11 min: the binary prints itself)
sh scripts/raskrutka.sh --check   # compare against the sources byte for byte, exit 1 on drift
sh scripts/raskrutka.sh --stroki  # 0.4 s: every C string literal in the runtime is closed
```

The binary compiler itself does the printing (`bootstrap/flang emit … --target c`); if the binary
is missing, the script builds it from `bootstrap/` first.

The check costs what the print costs — about eleven minutes, plus a `make` if the binary is not
built. Call `--check` before merging a change under `flang/self/` or `flang/src/emit/c/`, not on
every save.

The commands the language answers to:

```bash
# parse, type-check, prove totality
flang check flang/examples/leetcode/035-search-insert-position.flang --pretty

# run the examples declared inside the functions
flang test flang/examples/leetcode/035-search-insert-position.flang --pretty

# the same over a CORPUS: a directory or a glob instead of a file (binary only).
# Every failing example and every file not taken is named; the passing ones are
# a count. Exit code 0 — clean, 1 — something failed or a file was not taken,
# 2 — bad invocation.
flang test flang/stdlib/
flang test 'flang/examples/**/*.flang' --json

# call a function
flang run flang/examples/leetcode/035-search-insert-position.flang \
  --function "Место вставки" --args '{"элементы":[1,3,5,6],"цель":2}'
# {"function":"Место вставки","args":{...},"result":1}

# print it — targets: c | csharp | elixir | go | java | js | python | rust
flang emit flang/examples/leetcode/035-search-insert-position.flang \
  --target python --out ./out-python
```

Checks:

```bash
sh flang/проверки/обход.sh          # the walker's checks, run by the binary
sh flang/проверки/обход-примеров.sh # every example in the tree
sh scripts/raskrutka.sh --check     # the seed against what the sources emit
./ярлык                             # every check in the tree, each with one line of explanation
./ярлык тесты                       # the whole set at once
```

A single check is called by its name from that list: `./ярлык spec:check`, `./ярлык links:check`,
`./ярлык site:check`. Each has its own exit code: 0 — clean, non-zero — the culprit is named.

Every command writes JSON to stdout, diagnostics to stderr, and returns non-zero on failure —
the same contract everywhere, which is what makes it usable from CI, editors and agents. The one
exception is `flang repl`, which talks to a human.
