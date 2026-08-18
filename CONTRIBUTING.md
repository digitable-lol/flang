# Contributing

## Run the suite on a host that has all eight toolchains

```bash
scripts/test-remote.sh                # the whole suite, FTS_REQUIRE_TOOLCHAINS=all
scripts/test-remote.sh test:backends  # any script from package.json
scripts/test-remote.sh --info         # what the host is and what is installed on it
```

This is the default way to run the suite, and the reason is arithmetic. A
backend test proves code generation exactly one way: a real compiler accepted
the emitted code and the examples agreed with the interpreter. Eight toolchains
rarely live on a laptop, and the tests for the missing ones skip — the suite
goes green while half the backends were never checked. That is how 0.4.6
shipped with a Go code-generation defect: green locally (no Go), red in CI.

Measured on this project, same commit, same suite:

| | local (8 cores, shared) | `dev` (256 cores) |
|---|---|---|
| whole suite | 522 s | 252 s |
| `test:backends` | 855 s | 15 s |
| skipped for a missing toolchain | 0 (after installing all eight) | 0 by construction |

The host comes from `FLANG_REMOTE` (default `dev`, an alias in `~/.ssh/config`).
The working tree is rsynced to `~/.cache/flang-remote/<name>` on that host —
deliberately not `~/projects/flang`, which is a real clone with real branches.
`node_modules` and `dist` are not copied: the host installs and builds its own,
because copying someone else's build is another way of measuring the wrong tree.

The remote run sets `FTS_REQUIRE_TOOLCHAINS=all`, so a missing toolchain there
is a failure, not a skip.

## Running locally

```bash
npm test
```

There is no install step: the package has no dependencies, so `npm install` has
nothing to fetch. `npm test` is one suite — `flang/test/*.test.mjs`, the whole
language. It must pass with zero failures.

Before the run, `npm test` prints what it is actually going to check:

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

Run it on its own with `npm run preflight`. The hidden-test count is measured,
not estimated: the tests of an absent toolchain skip instantly, so counting them
is cheap, and a number written down in the source would be stale by the next
test added. `--fast` skips the counting, `--registry` also checks the published
version.

The same report checks that the lockfile matches `package.json`, and that
`node_modules` matches the lockfile — a vendored copy two releases behind is a
watchman that keeps quiet: the suite passes, and it passed against the old tree.
That second check is dormant today and says so (`зависимостей у пакета нет —
ставить нечего`): the tree's one dependency was `typescript`, and it left with
the old FTS project. The check stays because the day a dependency returns is
exactly the day nobody remembers to add it back.

A test skipped for a missing native toolchain is not a passing test. Set
`FTS_REQUIRE_TOOLCHAINS` where the toolchain is supposed to exist — with it set,
the preflight stops the run before it starts rather than forty minutes in.
Strictness applies to the toolchains you **name**: `FTS_REQUIRE_TOOLCHAINS=c`
means "C must be here", not "all eight must be here", so CI can require the one
toolchain it installs. `--strict` is the separate switch that demands every one.

Changes to the compiler in `flang/self/` must reprint the bootstrap point in the
same commit:

```
node scripts/bootstrap-c.mjs           # reprint bootstrap/ (~10 s of CPU)
node scripts/bootstrap-c.mjs --check   # compare it against the sources, exit 1 on drift
```

`bootstrap/` is the compiler printed to C99 — what makes `cc` and `make` enough to
build flang without Node. It is an artifact, never edited by hand; the guard
"точка раскрутки bootstrap/ совпадает с печатью текущих исходников, побайтово" in
`flang/test/self-bootstrap.test.mjs` compares bytes and needs no C compiler, so it
runs everywhere. See `bootstrap/README.md`.

## Every script `package.json` declares, and who runs it

`package.json` is the manifest of the **second mould** — the one that embeds the
language into a Node project. It is not how the language is built: `make -C
bootstrap` builds the compiler with a single `cc`, and the package declares zero
dependencies (`npm ls --all` prints `(empty)`).

A script nobody ever names is dead weight that still looks like a promise, so
every name below is named here, and `flang/test/readme-layout.test.mjs` fails if
`package.json` grows one that this page is silent about.

| script | who runs it |
| --- | --- |
| `npm test` | the whole suite, `flang/test/*.test.mjs`; CI runs it on every tag |
| `npm run pretest` · `npm run pretest:backends` | npm lifecycle hooks — the preflight report, run automatically before the suite |
| `npm run prepublishOnly` | npm lifecycle hook — the suite again, before a publish |
| `npm run preflight` | the toolchain report on its own |
| `npm run claims:check` · `npm run counts:check` · `npm run codes:check` · `npm run emit:check` | the four prose guards below |
| `npm run license:check` | SPDX marking; **CI runs the file directly** (`node scripts/check-licensing.mjs`), not through npm |
| `npm run changelog` · `npm run changelog:check` | print `CHANGELOG.md` and `changelog.json` from tags, and check they match the history |
| `npm run izmeneniya` · `npm run izmeneniya:check` | print the merge journal; **Pages runs the file directly** before building the site |
| `npm run site` · `npm run site:check` | build the documentation site and check its links; **Pages runs the file directly** |
| `npm run bootstrap` · `npm run bootstrap:check` | reprint `bootstrap/` from the current sources, and compare byte for byte |
| `npm run proof:ledger` · `npm run proof:search` | the proof ledger over the corpus, and the search behind it |
| `npm run word:occupancy` | which words of the language a given name would collide with; takes arguments |
| `npm run spec:check` · `npm run comparison:check` | the FTS-surface spec guard, and the guard that a comparison does not preprocess the reference the way it preprocesses the twin |
| `npm run changelog:page` · `npm run changelog:page:check` | print the merge page of the site and check it against the history |
| `npm run links:check` | the site link guard on its own |
| `npm run glossary` · `npm run glossary:check` | print `docs/glossary.md` from the surface table, and check it is fresh |
| `npm run surfaces:run` · `npm run surfaces:check` | measure the four writing surfaces, and check the page against the run |
| `npm run numbers:check` | check the site pages' own numbers against the measurer |
| `npm run test:backends` | the emit tests alone, when you do not want the full suite |
| `npm run test:remote` | the same suite on another host, over ssh |

Three of these are run by CI as `node …` directly rather than through npm. That
is a place two spellings can drift apart, and it is written down here rather
than discovered later.

## Prose is checked, not trusted

Documentation in this tree makes claims a machine can settle, and a claim nobody
runs goes stale silently. Four guards run them instead. Each is a script you can
run on its own and a test that also proves the guard itself can go red:

```bash
npm run claims:check   # "the language has no such form" — asked of the real lexer
npm run counts:check   # every "N lines of `path`" and every ledger count, remeasured
npm run codes:check    # every FLANG_* named in any .md must exist in the sources
npm run emit:check     # "seven backends emit …, JavaScript emits one file", and the cost table
```

What this means when you write:

- **Numbers.** Put the path in backticks next to the count — either order works:
  `` `flang/src/parser.mjs`, 4590 lines `` or `` 4590 lines in `flang/src/parser.mjs` ``.
  It will be remeasured against the tree. If you mean an approximation, write
  `~3900` — the guard leaves those alone, on purpose. Both languages are read:
  `строк` and `lines`, `в` and `in`.
- **Diagnostic codes.** A `FLANG_*` in prose must exist in a non-test source file.
  If it is a promise rather than a fact, mark it *объявлено, не сделано* in the
  prose and add an entry with a reason to `ОБЪЯВЛЕНО_НЕ_СДЕЛАНО` in
  `flang/scripts/code-guard.mjs`. That list goes red in both directions: once the
  code exists, the entry must go.
- **Cost claims.** The one cost table is in `flang/SPEC.md`. Each cell is backed by
  an exact snippet of the target's runtime in `flang/scripts/emit-guard.mjs`;
  change the runtime and the guard demands the table be revisited.

None of them may be "fixed" by loosening the guard. The tree is the measurer.

Changes to flang must include:

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
