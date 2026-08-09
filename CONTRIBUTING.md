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
npm install
npm test
```

`npm test` is three suites — `test:core` (the FTS core in TypeScript),
`test:tools` (the tools in `tools/`), `test:flang` (the language). All three
must pass.

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

The same report checks that `node_modules` matches `package-lock.json` and that
the lockfile matches `package.json`. A vendored copy two releases behind is a
watchman that keeps quiet: the suite passes, and it passed against the old tree.

A test skipped for a missing native toolchain is not a passing test. Set
`FTS_REQUIRE_TOOLCHAINS` where the toolchain is supposed to exist — with it set,
the preflight stops the run before it starts rather than forty minutes in.

Changes to the FTS surface must include:

- a canonical JSON representation;
- parser and semantic-validation tests;
- a schema update when the model changes;
- an example for user-visible syntax.

Changes to flang must include:

- the corresponding section of `flang/SPEC.md`, updated in the same change;
- a type-checker or totality test, whichever the change touches;
- matching behaviour in the interpreter and in every emitter — the emitter tests
  compare a compiled binary against the interpreter, so a divergence is a failure,
  not a note;
- a debt entry in `flang/core/SPEC.md` when a divergence from the TypeScript core
  is left in deliberately.

Do not add product-specific structures, filesystem access, or network access to the core library. Build integrations as separate packages over the public `FtsDocument` API.
