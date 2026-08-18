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
