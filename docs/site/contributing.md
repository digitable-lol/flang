# For language developers

This page is for changing flang itself. If you came to write in it, go here:
[Install](install.html) → [Your first program](getting-started.html)
→ [Tutorial](tutorial.html).

Everything internal is collected here: decisions, tasks, working plans and how
the compiler is built. Pages for users of the language link to internal
documents only through this page.

The tree is written in Russian: identifiers and most of the prose. Commit
messages are English. An English form of the language exists and lexes to the same
identifiers. A patch written in English is accepted.

## What is where

| What | Where | What is in it |
|---|---|---|
| Conditions for release 1.0 | [`docs/road-to-1-0.md`](https://github.com/digitable-lol/flang/blob/main/docs/road-to-1-0.md) | seven conditions: what exists, what is missing, the command and threshold that check it (in Russian) |
| Working roadmap | [`docs/ROADMAP.md`](https://github.com/digitable-lol/flang/blob/main/docs/ROADMAP.md) | stages of work, measurements, what the language does not have (in Russian) |
| Decisions | [`docs/adr/`](https://github.com/digitable-lol/flang/tree/main/docs/adr) | why it is done this way: one decision, one numbered file |
| Tasks | [`docs/tasks/`](https://github.com/digitable-lol/flang/tree/main/docs/tasks) | what is in progress and what is free: one task, one file |
| Repository layout | [Repository layout](project-layout.html) | which directory is responsible for what |
| Lists of checks and files | [`docs/ci-inventory.md`](https://github.com/digitable-lol/flang/blob/main/docs/ci-inventory.md), [`docs/tree-inventory.md`](https://github.com/digitable-lol/flang/blob/main/docs/tree-inventory.md) | which checks run in CI and what the tree consists of |
| Numbers in documents | [`docs/prose-numbers.md`](https://github.com/digitable-lol/flang/blob/main/docs/prose-numbers.md) | how to mark a number so an automatic check re-measures it |
| Building the compiler | [The compiler builds itself](bootstrap-circle.html), [`docs/reprint-cost.md`](https://github.com/digitable-lol/flang/blob/main/docs/reprint-cost.md) | how the compiler rebuilds itself and what it costs |

## Build it

There is one compiler here, written in flang itself, and it builds without Node.
The tree carries a bootstrap point — that same compiler printed to C99. The whole
dependency list is a C compiler and `make`:

```bash
git clone https://github.com/digitable-lol/flang && cd flang
make -C bootstrap
bootstrap/flang --version
```

```
flang {{выпуск.версия}}
```

The built binary is what you run from then on:

```bash
bootstrap/flang check docs/examples/rosetta/towers-of-hanoi.flang
```

The compiler does not need Node: the language server ships inside the same
binary — `flang lsp --stdio` (see [the editor page](editor.html)). Node is needed
only by the site build and by the `js` target.

## Run the checks

Two checks run on the built binary and need no Node:

```bash
sh flang/test/обход.sh
sh flang/test/обход-примеров.sh
```

The first walks the tree with the compiler, the second runs the examples of
every program in the tree.

A third check compares the printed C against what sits in `bootstrap/`:

```bash
sh scripts/bootstrap-reprint.sh --bystro   # the inputs of the print only, seconds
sh scripts/bootstrap-reprint.sh --check    # print again and compare byte for byte
```

The full `--check` takes hours on one core and tens of gigabytes of memory (the
numbers are in [`docs/reprint-ledger.tsv`](https://github.com/digitable-lol/flang/blob/main/docs/reprint-ledger.tsv)), so the
maintainers reprint `bootstrap/` in batches. Your change to `flang/self/` is not
expected to do it; say in the commit message that it waits for a reprint.

If you touched the site pages, add:

```bash
node docs/site/build.mjs --check
```

It turns red on a link to nowhere, a page without its English pair, and a
substitution with no value.

Code, output of the binary, error codes and the help of the commands stand on
the pages as inserts from the tree, not typed by hand: the word `insert` in the
first line of a fenced block or in an HTML remark above a table names the source.
After changing an example or the compiler, rebuild the inserts and check that the
pages agree with the code:

```bash
bootstrap/flang run-script docs:build
bootstrap/flang run-script docs:check
```

`docs:check` compares every page. The hook before a push runs `docs:changed`: it
compares only the pages whose text or sources the branch changed against the dev
of its remote — an inserted file, a file named in an inserted run, the binary
under `bootstrap/`, the compiler sources for the table of codes, `flang/stdlib`
for the library tables — and every page when the insert plan itself changed. CI
runs the full `docs:check`.

How inserts work: [ADR-0151](../adr/0151-a-page-is-prose-plus-inserts-taken-from-the-code.md).

## Send a change

1. Branch off `dev`: `git switch -c my-change origin/dev`.
2. Write it. Put examples inside the function — they run with the same
   `flang test` command as everything else.
3. Run the checks above. A red check is not something to explain away: the
   change is not ready.
4. Commit message: English, in the form `type(scope): what is now true`; the
   rules are in [`docs/commit-messages.md`](https://github.com/digitable-lol/flang/blob/main/docs/commit-messages.md).
5. Open a pull request into `dev` at
   [github.com/digitable-lol/flang](https://github.com/digitable-lol/flang).

For a bug without a fix, open an issue in the same repository. Attach the
program text and the verbatim command output with its exit code: that is enough
to reproduce it.

## Read this before changing the language

- [Language specification](../spec.html) — forms, values, types, diagnostic codes.
- [Categories and functors](../spec-cat.html) — what the binary judges and what it does not.
- [Processes and fault tolerance](../spec-conc.html) — the whole process model.
- [Kernel specification](../spec-proof.html) — what the proof kernel accepts.
- [Repository layout](../project-layout.html) — what lives where.
- [Developing the language](../developing.html) — how something new gets added.
- [Known limitations](../limits.html) — what the language cannot do and knows it.
