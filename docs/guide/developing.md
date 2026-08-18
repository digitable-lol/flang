[Back to README](../../README.md) · [Documentation index](../README.md)

# Developing the language

The JavaScript reference implementation stays for good: it is what the fixed point is checked
against, and deleting it would delete the check. Working on it takes a clone:

```bash
npm install
npm run build
node scripts/build-release-c.mjs     # prints the release C and builds it
```

A change to the compiler in `flang/self/` must reprint the bootstrap point in the same commit, or
`bootstrap/` starts building the previous compiler silently:

```bash
node scripts/bootstrap-c.mjs           # reprint bootstrap/ (~10 s of CPU)
node scripts/bootstrap-c.mjs --check   # compare against the sources byte for byte, exit 1 on drift
```

The guard is the test «точка раскрутки `bootstrap/` совпадает с печатью текущих исходников,
побайтово» in `flang/test/self-bootstrap.test.mjs`. It needs no C compiler, so it always runs —
unlike the fixed point itself, which needs `cc` and which CI turns on with
`FTS_REQUIRE_TOOLCHAINS=c`.

The commands the language answers to:

```bash
# parse, type-check, prove totality
flang check flang/examples/leetcode/035-search-insert-position.flang --pretty

# run the examples declared inside the functions
flang test flang/examples/leetcode/035-search-insert-position.flang --pretty

# call a function
flang run flang/examples/leetcode/035-search-insert-position.flang \
  --function "Место вставки" --args '{"элементы":[1,3,5,6],"цель":2}'
# {"function":"Место вставки","args":{...},"result":1}

# print it — targets: c | csharp | elixir | go | java | js | python | rust
flang emit flang/examples/leetcode/035-search-insert-position.flang \
  --target python --out ./out-python
```

Any `.fts` model is a valid flang program, so the same commands take one directly. That path goes
through the compatibility bridge, which needs the built TypeScript core — so `npm install && npm
run build` inside the clone comes first:

```bash
flang check examples/utilities/discount.fts --pretty
flang emit examples/utilities/discount.fts --target go --out ./out-go
```

FTS's own CLI, for models specifically:

```bash
fts pipeline examples/real-world/order-shipment.fts --pretty
fts test examples/utilities/discount.fts --pretty
fts run examples/utilities/discount.fts \
  --utility "Рассчитать скидку" --input examples/utilities/discount.input.json --pretty
fts certify examples/real-world/order-shipment.fts \
  --context examples/real-world/order-shipment.context.json --pretty
fts generate examples/utilities/discount.fts --out generated
```

Tests:

```bash
npm run test:flang    # the language: parser, types, totality, backends, the core and compiler in flang
npm test              # everything: core, tools, flang
```

Every command writes JSON to stdout, diagnostics to stderr, and returns non-zero on failure —
the same contract everywhere, which is what makes it usable from CI, editors and agents. The one
exception is `flang repl`, which talks to a human.
