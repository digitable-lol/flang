# Contributing

flang is a language whose specification runs. Everything in this tree is either
that language, a program written in it, or a guard that keeps a written claim
honest. This page is what you need to build it, run the checks, and send a change.

The tree is written in Russian: identifiers, commit messages and most prose. An
English surface of the language exists and lexes to the same identifiers, and a
patch written in English is welcome — nobody will ask you to write Russian to be
read.

## Build it

There are two implementations here, and either one builds on its own.

**The compiler, without Node.** The tree carries a bootstrap point — the
self-hosted compiler printed to C99. A C compiler and `make` are the whole
dependency list:

```bash
git clone https://github.com/digitable-lol/flang && cd flang
make -C bootstrap
bootstrap/flang_cli --version
```

That binary is the five layers of [`flang/self/`](flang/self): lexer, parser,
types, totality, printing to C. There is no evaluator among them — what it is and
what guards it: [`bootstrap/README.md`](bootstrap/README.md).

**The reference implementation, with Node.js 20 or newer.** It is the
interpreter, the language server and all eight backends, and it needs neither a
build step nor an install step:

```bash
node flang/bin/flang.mjs check flang/examples/rosetta/towers-of-hanoi.flang
```

The package declares zero dependencies — `npm ls --all` prints `(empty)` — so
`npm install` has nothing to fetch. To get the two commands on `$PATH` inside a
clone, `npm link` gives you `flang` and `flang-lsp`.

## Run the checks

```bash
npm test
```

One suite — `flang/test/*.test.mjs`, the whole language. It is long: plan for
tens of minutes, and reach for `npm run test:backends` when you only touched a
code generator.

Before the run, the preflight prints what is actually going to be checked:

```
Бэкенды кодогенерации: 8 целей
  ЦЕЛЬ         ПРОБА                  СТАТУС   ВЕРСИЯ ИЛИ ПРИЧИНА
  ------------------------------------------------------------------
  c            cc --version           ЕСТЬ     cc (Ubuntu 13.3.0) 13.3.0
  elixir       elixir --version       НЕТ      «elixir» не запускается
  ...
  Проверяется по-настоящему: 7 из 8 — c, csharp, go, java, python, rust, typescript
  Пропускается:              1 из 8 — elixir (нет elixir)
  Скрыто тестов:             33 — elixir 33
```

Run it on its own with `npm run preflight`. This report is why the suite can be
believed at all. A backend test proves code generation exactly one way: a real
compiler accepted the emitted code, and the result agreed with the interpreter.
Eight toolchains rarely live on one machine, the tests of the missing ones skip,
and the suite goes green while half the backends were never checked. That is how
0.4.6 shipped with a Go code-generation defect: green on a machine without Go,
red in CI.

So **a test skipped for a missing toolchain is not a passing test.**
`FTS_REQUIRE_TOOLCHAINS` turns such a skip into a failure, and it does so for the
toolchains you *name*: `FTS_REQUIRE_TOOLCHAINS=c` means "C must be here", not
"all eight must be here" — which is exactly what CI sets, because the image it
runs on has `cc` and little else. `--strict` is the separate switch that demands
every one. Either way the preflight stops the run before it starts, rather than
forty minutes in.

`--fast` skips the hidden-test count; `--registry` also checks the published
version. The hidden-test count is measured, not estimated: the tests of an absent
toolchain skip instantly, so counting them is cheap, and a number written into
the source would be stale by the next test added. The same report checks that the
lockfile matches `package.json` and that `node_modules` matches the lockfile.
That second check is dormant today and says so (`зависимостей у пакета нет —
ставить нечего`); it stays because the day a dependency returns is exactly the
day nobody remembers to add it back.

If you do have a machine with all eight toolchains on it, `npm run test:remote`
will copy the tree there and run the suite over ssh with
`FTS_REQUIRE_TOOLCHAINS=all`. You name the host yourself:

```bash
FLANG_REMOTE=<your ssh alias> npm run test:remote
```

It is a convenience and nothing more — CI does not use it, and no change is
expected to have gone through it.

## The bootstrap point travels with the compiler

A change to `flang/self/` must reprint the bootstrap point in the same commit:

```bash
node scripts/bootstrap-c.mjs           # reprint bootstrap/ (~10 s of CPU)
node scripts/bootstrap-c.mjs --check   # compare it against the sources, exit 1 on drift
```

`bootstrap/` is an artifact, never edited by hand. The guard "точка раскрутки
bootstrap/ совпадает с печатью текущих исходников, побайтово" in
`flang/test/self-bootstrap.test.mjs` compares bytes and needs no C compiler, so
it runs everywhere.

## Every script `package.json` declares, and who runs it

A script nobody ever names is dead weight that still looks like a promise, so
every name below is named here, and `flang/test/readme-layout.test.mjs` fails if
`package.json` grows one this page is silent about.

| script | who runs it |
| --- | --- |
| `npm test` | the whole suite, `flang/test/*.test.mjs`; CI runs it on every tag, on Node 20, 22 and 24 |
| `npm run pretest` · `npm run pretest:backends` | npm lifecycle hooks — the preflight report, run automatically before the suite |
| `npm run prepublishOnly` | npm lifecycle hook — the suite again, before a publish |
| `npm run preflight` | the toolchain report on its own |
| `npm run test:backends` | the emit tests alone, when you do not want the full suite |
| `npm run test:remote` | the same suite on a host of your choosing, over ssh |
| `npm run bootstrap` · `npm run bootstrap:check` | reprint `bootstrap/` from the current sources, and compare it byte for byte |
| `npm run claims:check` · `npm run counts:check` · `npm run codes:check` · `npm run emit:check` · `npm run names:check` | the five prose guards below |
| `npm run license:check` | SPDX marking of every file the package ships; **CI runs the file directly** (`node scripts/check-licensing.mjs`), not through npm |
| `npm run links:check` | every Markdown link in the tree that points at a file; **CI runs the file directly** (`node scripts/link-guard.mjs`) |
| `npm run site` · `npm run site:check` | build the documentation site and check its links; **Pages runs the file directly** |
| `npm run numbers` · `npm run numbers:check` | reprint the site pages' own numbers from the measurer, and check them against it |
| `npm run glossary` · `npm run glossary:check` | print `docs/glossary.md` from the surface table, and check it is fresh |
| `npm run surfaces:run` · `npm run surfaces:check` | measure the four writing surfaces, and check the page against the run |
| `npm run changelog` · `npm run changelog:check` | print `CHANGELOG.md` and `changelog.json` from the tags, and check they match the history |
| `npm run changelog:page` · `npm run changelog:page:check` | print the merge page of the site, and check it against the history; **Pages runs the file directly** |
| `npm run releases:page` · `npm run releases:page:check` | print the releases page, both halves of it, and check it against the tags |
| `npm run spec:check` | a spec written in flang must be proven from zero axioms, and the next spec must leave the previous one's claims proven |
| `npm run comparison:check` | the guard that a comparison does not preprocess the witness the way it preprocesses the reference |
| `npm run memory:check` | every peak-memory number stated in prose, remeasured by a run |
| `npm run tmp:check` | a run that leaves temporary directories behind is required to say so, with a number |
| `npm run occupied:check` | how many modules of the corpus would collide with names each target reserves |
| `npm run proof:ledger` · `npm run proof:search` | the proof ledger over the corpus, and the search behind it |
| `npm run word:occupancy` | how many written programs would break if a given word became a keyword; takes arguments |

Four of these CI and Pages run as `node …` directly rather than through npm.
That is a place two spellings can drift apart, and it is written down here rather
than discovered later.

## Prose is checked, not trusted

Documentation in this tree makes claims a machine can settle, and a claim nobody
runs goes stale silently. Five guards run them instead. Each is a script you can
run on its own and a test that also proves the guard itself can go red:

```bash
npm run claims:check   # "the language has no such form" — asked of the real lexer
npm run counts:check   # every "N lines of `path`" and every ledger count, remeasured
npm run codes:check    # every FLANG_* named in any .md must exist in the sources
npm run emit:check     # "seven backends emit …, JavaScript emits one file", and the cost table
npm run names:check    # naming rules, against the parse tree of the whole corpus
```

What this means when you write:

- **Numbers.** Put the path in backticks next to the count — either order works:
  `` `flang/src/parser.mjs`, 4704 lines `` or `` 4704 lines in `flang/src/parser.mjs` ``.
  It will be remeasured against the tree. If you mean an approximation, write
  `~3900` — the guard leaves those alone, on purpose. Both languages are read:
  `строк` and `lines`, `в` and `in`.
- **Diagnostic codes.** A `FLANG_*` in prose must exist in a non-test source file.
  If it is a promise rather than a fact, mark it *объявлено, не сделано* in the
  prose and add an entry with a reason to `ОБЪЯВЛЕНО_НЕ_СДЕЛАНО` in
  `flang/scripts/code-guard.mjs`. That list goes red in both directions: once the
  code exists, the entry must go.
- **Names.** A parameter, a `пусть` binding or a fold item may not be one letter,
  may not be shorter than three letters (two characters on the Chinese surface),
  and may not be a clipped word from the closed list in
  `flang/scripts/name-guard.mjs`. The rules, what is deliberately *not* a rule,
  and how the threshold is stated for each of the four surfaces are in
  [Names in code](docs/guide/naming.md) · [ru](docs/guide/naming.ru.md).
  The corpus does not satisfy them yet — 2759 sites in 141 files of 190 — so the
  debt is recorded by name in `flang/scripts/name-debt.json` and compared as a
  diff of lists, not of counts. New code goes red; the debt must shrink. Do not
  add to it, and do not rewrite it to make your change pass.
- **Cost claims.** The one cost table is in `flang/SPEC.md`. Each cell is backed by
  an exact snippet of the target's runtime in `flang/scripts/emit-guard.mjs`;
  change the runtime and the guard demands the table be revisited.
- **Licence headers.** Every file the package ships carries an SPDX header. The
  file list is derived from the tree, not written down, so a new file without a
  header fails the gate rather than leaving the repository quietly unmarked.

None of them may be "fixed" by loosening the guard. The tree is the measurer.

## What a change to the language must include

- the corresponding section of `flang/SPEC.md`, updated in the same change;
- a type-checker or totality test, whichever the change touches;
- matching behaviour in the interpreter and in every emitter — the emitter tests
  compare a compiled binary against the interpreter, so a divergence is a failure,
  not a note;
- a debt entry in `flang/core/SPEC.md` when a divergence from the frozen answer
  table (`flang/test/fts-oracle.mjs`) is left in deliberately.

Do not add product-specific structures, filesystem access, or network access to
the language. Build integrations as separate packages over the JSON that
`flang ast` prints.

## Sending the change

Fork the repository, branch off `main`, and open a pull request. Small first: one
change, one reason, and a commit message that says what the tree now does that it
did not do before.

CI runs on tags and on demand, not on every push, so a pull request does not turn
green by itself. Say in the description what you ran. If you could not run
something — a backend whose toolchain you do not have, the full suite on a laptop
— say that too: a named gap is worth more than a tick nobody earned.

Bugs and questions go to
[issues](https://github.com/digitable-lol/flang/issues). A report that carries
the `.flang` file and the exact output of `flang check` is a report that can be
turned into a test.

The project is BSD-2-Clause ([LICENSE](LICENSE)); by sending a change you agree
that it goes out under the same terms.
