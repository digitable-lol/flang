# Contributing

flang is a language whose specification runs. Everything in this tree is either
that language, a program written in it, or a guard that keeps a written claim
honest. This page is what you need to build it, run the checks, and send a change.

The tree is written in Russian: identifiers, commit messages and most prose. An
English surface of the language exists and lexes to the same identifiers, and a
patch written in English is welcome — nobody will ask you to write Russian to be
read.

## Build it

There is one compiler here, written in flang itself, and it builds without Node.
The tree carries a bootstrap point — that compiler printed to C99. A C compiler
and `make` are the whole dependency list:

```bash
git clone https://github.com/digitable-lol/flang && cd flang
make -C bootstrap
bootstrap/flang_cli --version
```

That binary is the five layers of [`flang/self/`](flang/self): lexer, parser,
types, totality, printing to C. There is no evaluator among them — what it is and
what guards it: [`bootstrap/README.md`](bootstrap/README.md).

The built binary is what you then run:

```bash
bootstrap/flang check examples/rosetta/towers-of-hanoi.flang
```

The tree declares zero dependencies and has no package manager on the build
path. The language server is a subcommand of the binary: `flang lsp --stdio`.

## Run the checks

```bash
sh flang/проверки/обход.sh
sh flang/проверки/обход-примеров.sh
sh scripts/raskrutka.sh --check
```

These three run on the binary and need no Node. The JavaScript suite —
`./ярлык тесты` — **does not start on this tree**:
its preparation step imports a module of the removed second implementation and
fails before the first check. Moving the suite onto the binary is separate work.
Until it is done, the three commands above are the checks there are; two of them
are red today for reasons named on the page about what is proved.

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

There is no such report in the tree any more: `scripts/preflight.mjs` imported
`flang/src/targets.mjs`, which went away with the JavaScript implementation, and
the script was deleted on 20 August together with the list of targets that lived
only there. There is no `preflight` shortcut either — the list in
`ярлыки.flang` never had one. The argument below still holds, and it is the reason the table above was worth printing. A backend test proves code generation exactly one way: a real
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

If you do have a machine with all eight toolchains on it, `./ярлык тесты:по-ssh`
will copy the tree there and run the suite over ssh with
`FTS_REQUIRE_TOOLCHAINS=all`. You name the host yourself:

```bash
FLANG_REMOTE=<your ssh alias> ./ярлык тесты:по-ssh
```

It is a convenience and nothing more — CI does not use it, and no change is
expected to have gone through it.

## The bootstrap point travels with the compiler

A change to `flang/self/` must reprint the bootstrap point in the same commit:

```bash
sh scripts/raskrutka.sh           # reprint bootstrap/ (~11 min: the binary prints itself)
sh scripts/raskrutka.sh --check   # compare it against the sources, exit 1 on drift
sh scripts/raskrutka.sh --stroki  # 0.4 s: every C string literal in the runtime is closed
```

`bootstrap/` is an artifact, never edited by hand. Reprinting is done by the
binary itself (`bootstrap/flang emit … --target c`), so no Node is involved; if
the binary is missing, the script builds it from `bootstrap/` first.

The check now costs what the print costs — about eleven minutes, plus a `make`
if the binary is not built. It used to be seconds, because a JavaScript
implementation printed the same bytes; that implementation is gone (commit
`fe8e8a37`), and with it the cheap second opinion. Run `--check` before a merge
that touches `flang/self/` or `flang/src/emit/c/`, not on every save.

## Every shortcut, and who runs it

A shortcut is a name with a command line behind it. They used to live in
`package.json`, which meant typing `npm run спеки:проверка` to run a command that is
`bootstrap/flang io fspec/guard.flang` — npm substituted a string and did
nothing else, yet everyone who read the page concluded the language needs
Node.js. It does not: one compiler, written in flang, built by one `make`.

The list now lives in `ярлыки.flang`. It is a flang program, not a settings
file: the names and the command lines are type-checked, the functions that take
them apart carry examples, and the plan `Целость` walks the tree and goes red
when a shortcut names a file that is not there. The entry point is `./ярлык` —
`sh`, 66 lines of code inside 143 with the reasoning written down, which asks
the binary for the command line and runs it. It holds no list of its own.

```bash
./ярлык                        print every shortcut
./ярлык спеки:проверка         run one
./ярлык слово:занятость это    anything after the name goes to the command
./ярлык сборка                 build the binary compiler (see below)
```

**The first shortcut cannot be written in flang, and that is stated rather than
hidden.** Reading `ярлыки.flang` needs the binary, and the binary is what the
first shortcut builds. Exactly one line resolves it: `make -C bootstrap` is
known to the shell script itself, before it ever calls the binary. On a fresh
clone any shortcut therefore works — the script builds the binary first and says
so, the way `scripts/raskrutka.sh` already does (38 s measured on a cold tree).
The same line also stands in `ярлыки.flang`, and the script compares the two on
every run, so the duplicate cannot drift in silence.

| shortcut | who runs it |
| --- | --- |
| `./ярлык сборка` | build the binary compiler from the C99 in `bootstrap/`; the one shortcut the shell script knows by itself |
| `./ярлык ярлыки` | every shortcut names a file that exists in the tree |
| `./ярлык тесты` | the whole suite, `flang/test/*.test.mjs`, preflight first |
| `./ярлык тесты:по-ssh` | the same suite on a host of your choosing, over ssh |
| `./ярлык раскрутка` · `./ярлык раскрутка:проверка` · `./ярлык строки:проверка` | reprint `bootstrap/` from the current sources, compare it byte for byte, and the fast literal check |
| `./ярлык утверждения:проверка` · `./ярлык подсчёты:проверка` · `./ярлык коды:проверка` · `./ярлык печать:проверка` · `./ярлык имена:проверка` | the five prose guards below |
| `./ярлык лицензии:проверка` | SPDX marking of every code file under `flang/` and `examples/` (not `bootstrap/` — see below); **CI runs the file directly** (`bootstrap/flang io scripts/license-guard.flang`), not through the shortcut |
| `./ярлык ссылки:проверка` | every Markdown link in the tree that points at a file; **CI runs the file directly** (`bootstrap/flang io scripts/link-guard.flang`) |
| `./ярлык сайт` · `./ярлык сайт:проверка` | build the documentation site and check its links; **Pages runs the file directly** |
| `./ярлык числа` · `./ярлык числа:проверка` | reprint the site pages' own numbers from the measurer, and check them against it |
| `./ярлык словарь` · `./ярлык словарь:проверка` | print `docs/glossary.md` from the surface table, and check it is fresh |
| `./ярлык поверхности:прогон` · `./ярлык поверхности:проверка` | measure the four writing surfaces, and check the page against the run |
| `./ярлык журнал` · `./ярлык журнал:проверка` | print `CHANGELOG.md` and `changelog.json` from the tags, and check they match the history |
| `./ярлык журнал:страница` · `./ярлык журнал:страница:проверка` | print the merge page of the site, and check it against the history; **Pages runs the file directly** |
| `./ярлык выпуски:страница` · `./ярлык выпуски:страница:проверка` | print the releases page, both halves of it, and check it against the tags |
| `./ярлык спеки:проверка` | a spec written in flang must be proven from zero axioms, and the next spec must leave the previous one's claims proven |
| `./ярлык правила:проверка` | the guard that the two implementations judge a program by the same set of rules — every rule the binary lacks must be named, and named in its own help |
| `./ярлык память:проверка` | every peak-memory number stated in prose, remeasured by a run |
| `./ярлык времянки:проверка` | a run that leaves temporary directories behind is required to say so, with a number |
| `./ярлык занятые:проверка` | how many modules of the corpus would collide with names each target reserves |
| `./ярлык подделки:проверка` | a program that tries to prove a falsehood must be refused, and the refusal must name it |
| `./ярлык столкновения:проверка` | name collisions inside the closure of imports |
| `./ярлык доказательства:ведомость` | the proof ledger over the corpus |
| `./ярлык сторожа:проверка` | every check file of the tree LOADS; the ones that do not are named, with the verbatim refusal |
| `./ярлык коды:подлог` | the code guard turns red on a planted code and goes silent once it is removed |
| `./ярлык слово:занятость` | how many written programs would break if a given word became a keyword; takes arguments |

Some of these still start with `node`, because the program they run is written
in JavaScript and lives in the tree (`flang/scripts/*.mjs`, `docs/site/*.mjs`).
Moving those programs to flang is separate work; a shortcut substitutes a string
and does not decide what is in it.

Four of these CI and Pages run as `node …` directly rather than through the
shortcut. That is a place two spellings can drift apart, and it is written down
here rather than discovered later.

### What is left in `package.json`

**No `scripts` section at all, and no `bin`.** All three entries that used to sit
here were npm lifecycle hooks — `postinstall` built the binary during
`npm install`, `test` forwarded to `./ярлык тесты`, `prepublishOnly` ran the
suite before publishing. npm was removed from the tree on 3 September 2026
(task 8649), and they went with it; the file now carries `"private": true`, so
`npm publish` refuses on its own.

What is left is the **version**, the licence and the two addresses — read by the
site build, by the Homebrew formula guard and by the release workflow. The file
is printed from `scripts/emit-package.flang` and never hand-edited:
`./ярлык пакет` prints it, `./ярлык пакет:проверка` refuses if the two have
drifted.

## Prose is checked, not trusted

Documentation in this tree makes claims a machine can settle, and a claim nobody
runs goes stale silently. Five guards run them instead. Each is a script you can
run on its own and a test that also proves the guard itself can go red:

```bash
./ярлык утверждения:проверка  # "the language has no such form" — asked of the real lexer
./ярлык подсчёты:проверка     # every "N lines of `path`" and every ledger count, remeasured
./ярлык коды:проверка         # every FLANG_* named in any .md must exist in the sources
./ярлык печать:проверка       # "seven backends emit …", the ten prose promises and the eight cost claims
./ярлык имена:проверка        # naming rules, against the parse tree of the whole corpus
```

What this means when you write:

- **Numbers.** Put the path in backticks next to the count — either order works:
  `` `flang/self/parser.flang`, 7247 lines `` or `` 7247 lines in `flang/self/parser.flang` ``.
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
  an exact snippet of the target's runtime in `scripts/emit-promises-guard.flang`;
  change the runtime and the guard demands the table be revisited.
- **Licence headers.** Every source file under `flang/` and `examples/` with one
  of thirteen code extensions carries an SPDX header — 75 files as of 29 August
  2026. The list is derived from the tree, not written down, so a new file
  without a header fails the gate rather than leaving the repository quietly
  unmarked. Say the area precisely: the guard walks those two directories, and
  `bootstrap/` — which the release archive is printed from — is **not** among
  them. Three
  files there carry no header (`compiler_flang.c`, `compiler_flang.h`,
  `flang_runtime.h`); they are printed by the compiler, so a header appears there
  only through the printer, not by hand.

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

CI runs on pushes to `main` and `dev`, on tags, and on demand. It is not cheap:
one push costs about 134 minutes of runner time, because 27 of its 38 jobs build
the bootstrap compiler again from scratch. Say in the description what you ran.
If you could not run something — a backend whose toolchain you do not have, the
full suite on a laptop — say that too: a named gap is worth more than a tick
nobody earned.

### Run the cheap guards before you push

There is a hook that runs the guards that cost seconds, so that red does not
reach the runner in the first place. Install it once:

```sh
git config core.hooksPath .githooks
```

It runs nine checks in parallel and takes about 50 seconds on a loaded machine
(the slowest single one, `задачник:проверка`, is 48 of those seconds; run one
after another they would be 83). On success it says so; on failure it stops the
push and prints the guard, the file and the line.

**It does not run the whole suite, and it says so out loud every time.** The
tests, the checker's probe battery, the trust-ceiling guard and the bootstrap
build are minutes each and stay in CI. A hook that took 134 minutes would be
bypassed with `--no-verify` and would then be worse than no hook at all: it
would create the feeling of being checked without checking.

`--no-verify` stays available on purpose. It is legitimate when you push a
working branch that is not merged directly, when you are fixing the hook itself,
or when the tree is knowingly red on a named debt. Otherwise it means "let CI
burn the minutes instead of me".

Bugs and questions go to
[issues](https://github.com/digitable-lol/flang/issues). A report that carries
the `.flang` file and the exact output of `flang check` is a report that can be
turned into a test.

The project is BSD-2-Clause ([LICENSE](LICENSE)); by sending a change you agree
that it goes out under the same terms.
