# For contributors

This page is for changing flang itself rather than writing in it. If you came to
write in it: [Install](install.html) → [Your first program](getting-started.html)
→ [Tutorial](tutorial.html).

The tree is written in Russian: identifiers, commit messages and most of the
prose. An English surface of the language exists and lexes to the same
identifiers; a patch written in English is accepted — nobody will ask you to
write Russian.

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
bootstrap/flang check examples/rosetta/towers-of-hanoi.flang
```

The package declares zero dependencies: `npm install` has nothing to fetch. Only
the language server runs on Node — `node flang/bin/flang-lsp.mjs`.

## Run the checks

Three checks run on the built binary and need no Node:

```bash
sh flang/проверки/обход.sh
sh flang/проверки/обход-примеров.sh
sh scripts/raskrutka.sh --check
```

The first walks the tree with the compiler, the second runs the examples of
every program in the tree, the third compares the printed C against what sits in
`bootstrap/`: a change in `flang/self/` must produce the byte-identical
bootstrap file.

If you touched the site pages, add:

```bash
node docs/site/build.mjs --check
```

It turns red on a link to nowhere, a page without its English pair, and a
substitution with no value.

## Send a change

1. Branch off the trunk: `git switch -c my-change`.
2. Write it. Put examples inside the function — they run with the same
   `flang test` command as everything else.
3. Run the checks above. A red check is not something to explain away: the
   change is not ready.
4. Commit message: one line saying what changed and why.
5. Open a pull request at
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
