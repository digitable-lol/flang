[Back to README](../../README.md) · [Documentation index](../README.md)

# Developing the language

The JavaScript witness implementation stays for good: it is what the fixed point is checked
against, and deleting it would delete the check. Working on it takes a clone and nothing else:
the package has no dependencies and there is nothing to build, so the scripts run straight after
`git clone`.

```bash
node scripts/build-release-c.mjs     # prints the release C and builds it
```

A change to the compiler in `flang/self/` must reprint the bootstrap point in the same commit, or
`bootstrap/` starts building the previous compiler silently:

```bash
sh scripts/raskrutka.sh           # reprint bootstrap/ (~11 min: the binary prints itself)
sh scripts/raskrutka.sh --check   # compare against the sources byte for byte, exit 1 on drift
sh scripts/raskrutka.sh --stroki  # 0.4 s: every C string literal in the runtime is closed
```

The binary itself does the printing (`bootstrap/flang emit … --target c`), so no Node is
involved; if the binary is missing, the script builds it from `bootstrap/` first.

The check now costs what the print costs — about eleven minutes, plus a `make` if the binary
is not built. It used to be seconds, because a JavaScript implementation printed the same
bytes; that implementation is gone (commit `fe8e8a37`), and with it the cheap second opinion.

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

**There are exactly two commands in this tree.** `flang/bin/` holds `flang` and `flang-lsp`,
nothing more; `npm link` puts those same two into `$PATH`.

Tests:

```bash
npm test              # one suite: flang/test/*.test.mjs, the whole language
npm run test:backends # the eight code generators on their own
```

Every command writes JSON to stdout, diagnostics to stderr, and returns non-zero on failure —
the same contract everywhere, which is what makes it usable from CI, editors and agents. The one
exception is `flang repl`, which talks to a human.
