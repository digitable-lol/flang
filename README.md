**English** · [Русский](README.ru.md)

# flang

`flang` is a small, checkable programming language. It has sum types, lists,
strings as data, recursion and pattern matching — and it splits every program
into two classes, one of which the compiler proves terminating. Programs in the
proved class can be printed to C, Go and JavaScript and run natively.

The language grew out of **FTS (Formal Type Surface)**, the executable-specification
language that also lives in this repository: an indentation-based, brace-free
surface in which a `.fts` model declares domain objects, deterministic utilities
with rules, checked properties, executable examples, morphisms and
machine-checkable evidence. FTS deliberately has no sum types, no collections, no
recursion and no strings-as-data. flang adds exactly those, and it keeps every
existing `.fts` model a valid flang program.

```flang
модуль «Списки»

тотальная функция «Длина»
  принимает элементы: список числа
  возвращает число
  пример «Три элемента»
    дано элементы равно [7, 8, 9]
    ожидается 3
  разбор элементов
    случай пусто
      то 0
    случай голова и хвост
      то 1 плюс «Длина» от хвоста
```

## How FTS and flang relate

This is the question the repository layout does not answer on its own, so here
it is spelled out.

- **FTS is the surface.** Its reference implementation is TypeScript in
  [`src/`](src) (3 155 lines), which compiles `.fts` text into one canonical JSON
  `FtsDocument`. Everything else in the FTS world — validation, utility
  execution, code generation, proof certificates, the MCP server, the tools in
  [`tools/`](tools) — reads that document, not the parser.
- **flang is the language.** Its implementation is JavaScript in
  [`flang/src/`](flang/src): lexer, parser, type checker, totality analysis,
  interpreter, a module linker, and three emitters (JavaScript, C99, Go). The
  spec is [`flang/SPEC.md`](flang/SPEC.md).
- **FTS compiles into flang.** [`flang/src/compat.mjs`](flang/src/compat.mjs)
  translates an `FtsDocument` into a flang AST: object → record, utility → total
  function, rules → a chain of `if`, properties → postconditions, examples →
  examples. `npm test` re-checks that translation differentially against the
  TypeScript core on every model in the repository — on this checkout: 19 files,
  22 utilities, **19 593 inputs, zero divergences**, including diagnostic codes.
- **flang is used to rewrite FTS.** [`flang/core/`](flang/core) is the FTS core —
  lexer, parser, evaluator, JSON printer, 3 444 lines — written in flang itself,
  against the contract in [`flang/core/SPEC.md`](flang/core/SPEC.md). The point
  is stated there: print it to C and get a native `fts` that needs no Node. This
  became possible only because flang made strings data; in FTS a string is a
  field type, not something you can compute over, so a parser cannot be written
  in it.

**What is not settled, stated plainly.** The TypeScript core is still the
production implementation of FTS and still the reference the flang rewrite is
measured against — not the other way round. `flang/core/` reproduces it but does
not yet replace it: the legacy braced dialect is not parsed (53 of 56 corpus
models round-trip byte-for-byte; the other three are braced), `executeUtility`
and `testUtilities` remain core-only, and every remaining gap is written down as
a debt in `flang/core/SPEC.md`. The npm package is still named `@digitable/fts`.
So the repository is named for the language it is becoming, while a large part of
its contents is still the FTS toolchain.

## Two classes of function

Turing completeness and guaranteed termination are incompatible, so flang does
not choose: it splits programs, and the compiler checks the split.

| | `тотальная` (total) | ordinary |
|---|---|---|
| recursion | structurally decreasing only | any |
| termination | proved by the compiler | not guaranteed |
| example tests | always terminate | may hit the step limit |
| emitted to C / Go | yes | JavaScript only |
| usable for fact-checking | yes | no |

Failing to prove decrease is the error `FLANG_NOT_TOTAL`, not a warning. Every
`.fts` model lands wholly inside the total class, which is why compatibility is
checkable rather than declared.

## Quick start

Node.js 20 or newer.

```bash
npm install
npm test
npm run build
```

flang:

```bash
node flang/bin/flang.mjs check flang/stdlib/lists.flang
node flang/bin/flang.mjs test  flang/examples/leetcode/509-fibonacci-number.flang
node flang/bin/flang.mjs ast   flang/stdlib/strings.flang --pretty
node flang/bin/flang.mjs emit  flang/examples/leetcode/509-fibonacci-number.flang \
  --target c --out generated
```

The same CLI accepts an FTS model, because an `.fts` file is a flang program
(this path uses the compat bridge, so run `npm run build` first):

```bash
node flang/bin/flang.mjs check examples/utilities/discount.fts
```

FTS:

```bash
node dist/src/cli.js pipeline examples/real-world/order-shipment.fts --pretty
node dist/src/cli.js certify  examples/real-world/order-shipment.fts \
  --context examples/real-world/order-shipment.context.json --pretty
node dist/src/cli.js test examples/utilities/discount.fts --pretty
node dist/src/cli.js run  examples/utilities/discount.fts \
  --utility "Рассчитать скидку" --input examples/utilities/discount.input.json --pretty
node dist/src/cli.js generate examples/utilities/discount.fts --out generated
```

Every CLI in this repository keeps one contract: JSON on stdout, diagnostics as
JSON on stderr, non-zero exit on failure. That makes them composable in shells,
CI, editors and agent runtimes.

## Emitting to C, Go and JavaScript

`flang emit --target c|go|js` prints a whole program to the target language.
Without `--out` the files go to stdout together with their paths; with `--out`
they are written to a directory.

The C backend ships a value runtime, an arena, UTF-8 handling
([`flang/src/emit/c/`](flang/src/emit/c)) and a `Makefile`; the emitted sources
build with a plain C99 compiler and the resulting binary is expected to answer
exactly what the interpreter answers — same value, same error code. That equality
is the test, not a hope: `flang/test/emit-c.test.mjs` and `emit-go.test.mjs` run
both engines over the standard library and the LeetCode corpus and compare.

Two decisions worth knowing before reading generated code: numbers are IEEE-754
doubles and equality is `Object.is`, matching the FTS core bit for bit; and string
indexing is 1-based over code points, because the surface is a domain language in
which "the first character" means the first one.

## The FTS toolchain

The core library compiles one file. Nine tools in [`tools/`](tools) build on its
public API and add the layers above a single document. They are plain ES modules
over `dist/src`, so `npm run build` comes first.

- [`ftsc`](tools/ftsc/README.md) — the project compiler: trees of `.fts` modules,
  imports between categories, checked functors between domains, and code
  generation for **eight** languages (C, Rust, C#, Java, Elixir, Go, Python,
  TypeScript). Spec: [`tools/ftsc/SPEC.md`](tools/ftsc/SPEC.md).
- [`ftsvm`](tools/ftsvm/README.md) — the executor: runs utilities from the `ftsc`
  IR by interpretation or by JIT-compiling them to JavaScript, and carries
  supervision policies expressed as FTS models.
- [`ftspec`](tools/ftspec/README.md) — requirement-integrity checking before
  implementation: conflicts between specifications, constitution invariants and
  recorded decisions.
- [`ftsls`](tools/ftsls/README.md) — the language server: one LSP server gives
  `.fts` support in VS Code, Neovim, JetBrains, Zed, Emacs and Helix.
- [`ftsmap`](tools/ftsmap/README.md) — rule-coverage map: colours a utility's
  input space by which rules apply there, and shows what no rule covers.
- [`ftsynth`](tools/ftsynth/README.md) — synthesis of FTS models from historical
  decisions; the population consists of FTS rules, so the result is a readable
  executable specification rather than a black box.
- [`gasearch`](tools/gasearch/README.md) — evolutionary search whose fitness
  function and constraints are an FTS utility, validated before the search starts.
- [`gacascade`](tools/gacascade/README.md) — the GA0 → GA1 → GA2 cascade for
  iteration planning.
- [`locate`](tools/locate/README.md) — one implementation of "which line and
  column is this diagnostic on", shared by `ftsls` and the GitHub Action.

```bash
node tools/ftsc/bin/ftsc.mjs check tools/ftsc/stdlib
node tools/ftsc/bin/ftsc.mjs build tools/ftsc/stdlib --target rust --out generated
node tools/ftsvm/bin/ftsvm.mjs bench --quick
node tools/ftspec/bin/ftspec.mjs check tools/ftspec/examples/clean
```

`npm test` runs core, tools and flang; `npm run test:ftsc`, `test:ftsvm`,
`test:ftspec` and `test:flang` run one set. `npm run test:fast` skips the
backends, `npm run test:backends` runs only them. Backend tests compile generated
code with the real toolchain and skip by name when it is absent; extra lookup
directories come from `FTS_TOOLCHAIN_PATH`.

A skipped test is not a passing test. Where a toolchain is supposed to be
installed — CI, a release machine — set `FTS_REQUIRE_TOOLCHAINS`: `1` requires
every backend, `rust,go` requires the listed ones, and a missing compiler then
fails the test by name instead of being silently skipped.

## Library API

```ts
import { compile, executeUtility, generateTypeScript, testUtilities, validate } from "@digitable/fts"

const document = compile(source)
const checked = validate(document)
const tests = testUtilities(document)
const generated = generateTypeScript(document)
```

The canonical interchange format is documented by
[`schema/document.schema.json`](schema/document.schema.json). The core package
has no runtime dependencies and does no I/O from the library API. Browser
applications import `@digitable/fts/browser`, which provides parsing, validation
and visualization without Node.js cryptography; strict certificate decisions stay
on the server.

## AI agents

Run `node dist/src/mcp.js` as a stdio MCP server. It exposes ten read-only tools:
`fts_compile`, `fts_check`, `fts_test`, `fts_generate`, `fts_execute`,
`fts_prove`, `fts_visualize`, `fts_certify`, `fts_verify`, `fts_pipeline`. Results
carry both `structuredContent` and a JSON text block. See
[Agent integration](docs/agents.md).

## Documentation

Naming rule: a `.md` file with no language suffix is English and `X.ru.md` is its
Russian counterpart, with one exception — a `README.md` or `SPEC.md` sitting next
to code keeps that exact name in whatever language it is written, because GitHub
renders it as the folder's front page.

Not every document exists in both languages; the language is marked below.

- [`flang/SPEC.md`](flang/SPEC.md) — the flang specification (ru).
- [`flang/core/SPEC.md`](flang/core/SPEC.md) — the contract for the FTS core
  written in flang, including its debt list (ru).
- [Language reference](docs/language.ru.md) — the FTS surface (ru).
- [How it works](docs/how-it-works.ru.md) — the FTS working cycle (ru).
- [Architecture](docs/architecture.md) — FTS modules and design constraints (en).
- [Adoption](docs/adoption.md) — how an application integrates FTS (en).
- [Agent integration](docs/agents.md) — MCP and CLI conventions (en).
- [Executable utilities](docs/executable-utilities.ru.md) (ru),
  [FTS на прикладных примерах](docs/examples.ru.md) (ru),
  [Зачем нужен FTS и как его интегрировать](docs/why-and-integration.ru.md) (ru).

Runnable integrations: a [Node.js CLI utility](examples/integrations/node/discount-cli.mjs),
a [Node.js HTTP service](examples/integrations/node/discount-http-server.mjs), a
standalone [React calculator](examples/integrations/react/FtsDiscountCalculator.tsx),
a React example over the shared [`FtsForm`](examples/integrations/react/DigitableFtsDiscountForm.tsx),
and a [Python CLI client](examples/integrations/python/calculate_discount.py).

Both FTS surfaces are indentation-based and brace-free; compare
[`examples/utilities/discount.fts`](examples/utilities/discount.fts) with
[`examples/utilities/discount.en.fts`](examples/utilities/discount.en.fts). All
authored FTS source uses `.fts` and all authored flang source uses `.flang`; JSON
is the sole interchange form.

## Performance

```bash
npm run benchmark
```

The reproducible harness and a checked-in Apple M1 Max baseline are in
[`benchmarks/`](benchmarks/README.md). In that baseline a synthetic FTS model with
1000 fields and 1000 rules compiles in 4.36 ms on average and validates in
1.02 ms; executing 1000 matching rules takes 0.0157 ms. These are
microbenchmarks, not a promise about a host application's bundler or `tsc` build.

## Status

`0.x`. The canonical JSON shape and the diagnostic codes are treated as
compatibility surfaces; syntax grows through documented proposals.

`npm test` runs three suites. On this checkout, with Node 24, `cc`, `javac` and
`python3` present:

| Suite | Tests | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|
| `test:core` — the FTS core in TypeScript | 59 | 59 | 0 | 0 |
| `test:tools` — the nine tools in `tools/` | 402 | 392 | 0 | 10 |
| `test:flang` — the language | 1073 | 1050 | 0 | 23 |
| **total** | **1534** | **1501** | **0** | **33** |

Every skip is a missing native toolchain, reported by name. Here Rust, C#,
Elixir and Go were absent, so those `ftsc` backend tests and all 23 flang Go
tests skipped; C, Java, Python, TypeScript and JavaScript were present, so those
backends really compiled the generated code and ran it.

What works today: the flang front end (lexer, parser, type checker, totality
analysis, module linking) and interpreter; the JavaScript and C emitters, both
checked here against the interpreter on the standard library and the LeetCode
corpus; the Go emitter, whose comparison tests need a Go toolchain and skipped on
this machine; `flang check | run | test | facts | ast | emit`; the FTS→flang
bridge, checked differentially on 19 593 inputs; all four layers of the FTS core
in `flang/core/`, linked into one program and verified against the TypeScript
core.

What does not, yet: `flang/core/` does not replace `src/` — the braced FTS dialect
is not parsed, and the debts in `flang/core/SPEC.md` (no NFC normalization, no
column in some diagnostics, `executeUtility`/`testUtilities` absent) are open. The
package is not published: `package.json` still carries `"private": true` and
`@digitable/fts` is not in the npm registry, so every command above runs through
`node` from a checkout.

## License

BSD 2-Clause. [LICENSE](LICENSE) holds the verbatim license text and nothing
else. [LICENSE-RU.md](LICENSE-RU.md) explains the intent in Russian and has no
legal force.

Earlier versions were released under Apache-2.0, inherited from the original
repository rather than chosen. Anyone who received the code under Apache-2.0
keeps those rights; the change applies to later versions.
