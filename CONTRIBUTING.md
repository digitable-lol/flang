# Contributing

This page is what you need to build flang, run the checks and send a change.

The tree is written in Russian: identifiers and most prose. Commit messages are
English. An English surface of the language exists and lexes to the same
identifiers, and a patch written in English is accepted.

## Build it

There is one compiler here, written in flang itself. The tree carries a
bootstrap point: that compiler printed to C99. A C compiler and `make` are the
whole dependency list:

```bash
git clone https://github.com/digitable-lol/flang && cd flang
make -C bootstrap
bootstrap/flang --version
```

`bootstrap/compiler_flang.c` is one 56 MB translation unit, so the build takes
minutes and `-j` does not shorten it: `make -C bootstrap -j8 CFLAGS='-std=c99 -O2'`
took 12 min 56 s on the development machine on 27 November 2026. What the
directory holds: [`docs/bootstrap-point.md`](docs/bootstrap-point.md).

The built binary is what you then run:

```bash
bootstrap/flang check docs/examples/rosetta/towers-of-hanoi.flang
```

The tree has no package manager on the build path. The language server is a
subcommand of the binary: `flang lsp --stdio`.

## Run the checks

```bash
bootstrap/flang check <file> --proof     # the proof report of one file
bootstrap/flang test <file|directory>    # the examples written inside functions
sh flang/test/обход.sh                   # the checks written in flang, against the recorded ledger
sh flang/test/обход-примеров.sh          # the examples of every program in the tree
```

`bootstrap/flang run-script tests` runs three plans written in flang: they print
the link, the scheduler and the supervisor of the node into nine targets, build
each with its real toolchain and compare the answers. A target whose toolchain is
missing is red, not skipped, so the command needs all nine toolchains (`node`
among them, as the toolchain of the `js` target). A test skipped for a missing
toolchain is not a passing test.

If you have a machine with every toolchain on it, `tests:remote` copies the tree
there and runs the suite over ssh. You name the host yourself:

```bash
FLANG_REMOTE=<your ssh alias> bootstrap/flang run-script tests:remote
```

CI does not use it.

## The bootstrap point lags the compiler sources

`bootstrap/` is printed by the compiler and never edited by hand. An edit to
`flang/self/` reaches `bootstrap/flang` only when the directory is printed again:

```bash
sh scripts/bootstrap-reprint.sh           # reprint bootstrap/: the binary prints itself
sh scripts/bootstrap-reprint.sh --check   # print again and compare byte for byte, exit 1 on drift
sh scripts/bootstrap-reprint.sh --bystro  # compare only the inputs of the print, seconds
sh scripts/bootstrap-reprint.sh --stroki  # every C string literal in the runtime is closed
```

A print and a `--check` each take hours on one core. The last rows of
[`docs/reprint-ledger.tsv`](docs/reprint-ledger.tsv): a print on 22 November 2026
took 6886 s with a 69.2 GiB peak, a check on 15 November 2026 took 6246 s with a
68.2 GiB peak, both on a machine busy with other runs. So the maintainers
reprint in batches, in a commit of its own (`chore(seed): …`), and you are not
expected to reprint in your change. Say in the commit body that the edit waits
for a reprint: checks that run on `bootstrap/flang` do not see it yet. The cost
is in [`docs/reprint-cost.md`](docs/reprint-cost.md).

## Short commands, and who runs them

A short command is a name with a command line behind it. The list is in the
settings file `.flangrc`, one line per command:

```
script.specs:check = bootstrap/flang run-script seed:freshness --what specs:check >&2 && bootstrap/flang io fspec/guard.flang --на-веру
```

The binary runs them itself: `bootstrap/flang run-script <name>`. The command
line is handed to `/bin/sh -c` in the directory of `.flangrc`, and the exit code
is the command's own. The decision is recorded in
[ADR-0049](docs/adr/0049-short-commands-live-in-the-settings-file.md).

```bash
bootstrap/flang run-script                        print every short command
bootstrap/flang run-script specs:check            run one
bootstrap/flang run-script word:occupancy это     anything after the name goes to the command
bootstrap/flang run-script build                  rebuild the binary compiler
```

On a fresh clone there is no `bootstrap/flang` yet, so the first command is
`make -C bootstrap`; every workflow that calls a short command builds the binary
in a step of its own before that.

`bootstrap/flang run-script scripts:check` goes red when a short command names a
file that is not there, or when a line disagrees with the declaration written
inside the script it calls.

The list is long; these are the ones a contributor meets first:

| short command | what it does |
| --- | --- |
| `build` | rebuild the binary from the C99 in `bootstrap/`: the printed files are checked against their fingerprint first |
| `scripts:check` | every short command names a file that exists, and agrees with the declaration inside its script |
| `tests` · `tests:remote` | the link, the scheduler and the supervisor of the node, printed into nine targets and compared; the same on a host of your choosing |
| `reprint` · `reprint:check` · `seed-lines:check` | reprint `bootstrap/`, compare the print with the committed files, and the fast literal check |
| `claims:check` · `counts:check` · `codes:check` · `emit-promises:check` · `names:check` | the five prose guards below |
| `licenses:check` | `LICENSE` carries the text of the licence named by `license` in `.flangrc` and the Digitable copyright line |
| `links:check` | every Markdown link in the tree that points at a file |
| `docs:build` · `docs:check` · `docs:changed` | rebuild the inserts that pages take from the code, and check them |
| `site:build` · `site:check` | build the documentation site and check its links |
| `jargon:changed` · `jargon:check` | internal words on the pages for visitors: the pages your branch touched, or all of them |
| `tasks:board` · `tasks:check` · `tasks:number` | the task list in `docs/tasks/` |
| `changelog:build` · `changelog:check` | print `CHANGELOG.md` and `changelog.json` from the history, and check they match it |
| `releases:page` · `releases:page:check` | print the releases page, and check it |
| `specs:check` | a spec written in flang must be proven from zero axioms, and the next spec must leave the previous one's claims proven |
| `kernel-forgeries:check` | a program that tries to prove a falsehood must be refused, and the refusal must name it |
| `word:occupancy` | how many written programs would break if a given word became a keyword; takes arguments |

Some short commands start with `node`, because the program they run is still
written in JavaScript (`flang/scripts/*.mjs`, `docs/site/*.mjs`). CI calls some
checks by file (`bootstrap/flang io scripts/guards/license-guard.fscript`)
rather than by short name; `scripts:check` keeps the two spellings together.

The version, the name, the licence and the two addresses of the project are keys
of `.flangrc`; `bootstrap/flang run-script version <N>` spreads a new version
over the tree. There is no `package.json`.

## Prose is checked, not trusted

Documentation in this tree makes claims a machine can settle. Five guards run
them:

```bash
bootstrap/flang run-script claims:check          # "the language has no such form" — asked of the real lexer
bootstrap/flang run-script counts:check          # every "N lines of `path`" and every ledger count, remeasured
bootstrap/flang run-script codes:check           # every FLANG_* named in any .md must exist in the sources
bootstrap/flang run-script emit-promises:check   # the prose promises about targets and the cost claims
bootstrap/flang run-script names:check           # naming rules, against the parse tree of the whole corpus
```

What this means when you write:

- **Numbers.** Put the path in backticks next to the count — either order works:
  `` `flang/self/parser.flang`, N lines `` or `` N lines in `flang/self/parser.flang` ``.
  It will be remeasured against the tree. If you mean an approximation, write
  `~3900`: the guard leaves those alone. Both languages are read: `строк` and
  `lines`, `в` and `in`. How to mark a measured number so that the push hook
  rechecks it: [`docs/prose-numbers.md`](docs/prose-numbers.md).
- **Diagnostic codes.** A `FLANG_*` in prose must exist in a non-test source file.
  If it is a promise, mark it *объявлено, не сделано* in the prose and add an
  entry with a reason to the list in `flang/scripts/code-guard.fscript`. That
  list goes red in both directions: once the code exists, the entry must go.
- **Names.** A parameter, a `пусть` binding or a fold item may not be one letter,
  may not be shorter than three letters (two characters on the Chinese surface),
  and may not be a clipped word from the closed list in
  `flang/scripts/name-guard.mjs`. The rules are in
  [Names in code](docs/guide/naming.md) · [ru](docs/guide/naming.ru.md).
  The programs of the tree do not satisfy them yet, so the debt is recorded by name in
  `flang/scripts/name-debt.json` and compared as a diff of lists. New code goes
  red; the debt must shrink. Do not add to it.
- **Cost claims.** The one cost table is in `docs/flang/SPEC.md`. Each cell is
  backed by an exact snippet of the target's runtime in
  `scripts/guards/emit-promises-guard.fscript`; change the runtime and the guard
  demands the table be revisited.
- **Licence.** The licence is in one file, `LICENSE` at the root. A source file
  needs no licence header or SPDX line. The guard reads the `license` key of
  `.flangrc`, then requires the Digitable copyright line and the key sentences of
  that licence's text in `LICENSE`.
- **Words.** Pages for visitors do not use the project's internal words. The
  rules and the list of checked pages:
  [`docs/guide/writing-documentation.ru.md`](docs/guide/writing-documentation.ru.md).

Do not make a guard pass by loosening it.

## What a change to the language must include

- the corresponding section of `docs/flang/SPEC.md`, updated in the same change;
- a type-checker or totality test, whichever the change touches;
- matching behaviour in the interpreter and in every emitter: the emitter tests
  compare a compiled binary against the interpreter, so a divergence is a failure;
- a debt entry in `docs/flang/core/SPEC.md` when a divergence from the frozen answer
  table (`flang/test/fixtures/fts-oracle.json`) is left in deliberately.

Do not add product-specific structures, filesystem access, or network access to
the language. Build integrations as separate packages over the JSON that
`flang ast` prints.

## Sending the change

Fork the repository, branch off `dev`, and open a pull request into `dev`. Small
first: one change, one reason.

The commit message is English and follows Conventional Commits:
`type(scope): what is now true`. The header says what the tree now does; it goes
into the changelog verbatim. The rules are in
[`docs/commit-messages.md`](docs/commit-messages.md). The `commit-msg` hook
checks the message on commit, and the `commit-messages` job checks every commit
of a pull request. Do not add a `Co-Authored-By` trailer.

The same job and the `pre-commit` hook refuse three kinds of growth: a shell or
Python script that gets longer (write a plan in flang, `.fscript`, instead), a
Markdown file that grows outside `docs/`, and an added flang line over the limits of
`.flangrc` (120 characters, conditionals nested two deep).

Say in the description what you ran. If you could not run something — a backend
whose toolchain you do not have, the full suite on a laptop — say that too.
The workflows and their jobs are listed in
[`docs/ci-inventory.md`](docs/ci-inventory.md).

### Run the cheap guards before you push

Install the hooks once:

```sh
git config core.hooksPath .githooks
```

The `pre-push` hook runs 31 quick checks and stops the push if one is red,
printing the guard and its output. It does not run the whole suite: the tests, the proof checker's probes and the bootstrap
build stay in CI.

`--no-verify` is for a working branch that is not merged directly, for fixing
the hook itself, or for a tree that is knowingly red on a named debt.

Bugs and questions go to
[issues](https://github.com/digitable-lol/flang/issues). A report that carries
the `.flang` file and the exact output of `flang check` can be turned into a
test. How defects are prioritised: [`docs/zero-bug-policy.md`](docs/zero-bug-policy.md).

The project is BSD-2-Clause ([LICENSE](LICENSE)); by sending a change you agree
that it goes out under the same terms.
