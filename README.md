**English** · [Русский](docs/README.ru.md) · [Documentation site](https://digitable-lol.github.io/flang/en/index.html)

# flang — a language whose specification is the program

flang is a pure functional language with strict static typing, written in words rather than
symbols. A function carries its examples and its claims about the result next to its body; the
compiler checks the file before anything runs, and `flang emit` prints a checked program into C,
C++, Go, Rust, Java, JavaScript, TypeScript, Elixir, Python or C#. There is one compiler, written
in flang itself; the tree carries it already printed to C99, so building it needs a C compiler and
`make` and nothing else.

Two words carry the promises. `тотальная` in front of a function claims that it terminates on
every input; the compiler proves that by structural descent or a declared measure, and refuses the
file when it cannot. `обеспечивает` states a postcondition; the proof kernel closes it over all
inputs where it can, and says in words when it could not.

The authoring surface is Russian (`модуль`, `функция`, `принимает`, `обеспечивает`, `пример`); an
English surface lexes to the same identifiers, so a file may be written on either. Names in
guillemets — `«Место вставки»` — belong to the domain that wrote them and are never translated.
The language definition is [`docs/flang/SPEC.md`](docs/flang/SPEC.md); the reference by construct
is [Language](https://digitable-lol.github.io/flang/en/language.html).

## Install

A C99 compiler and `make` are the whole dependency list. All three ways give the same binary, with
the runtimes of every target under `share/flang/<target>/` beside it.

```bash
brew install digitable-lol/tap/flang
```

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang latest
asdf set -u flang latest
```

```bash
git clone https://github.com/digitable-lol/flang && cd flang
make -C bootstrap -j4
sudo make -C bootstrap install        # or PREFIX=$HOME/.local, without sudo
flang --version
```

The Homebrew formula is [`packaging/homebrew/flang.rb`](packaging/homebrew/flang.rb), served from
[`digitable-lol/homebrew-tap`](https://github.com/digitable-lol/homebrew-tap); the asdf plugin
(mise reads it too) is [`packaging/asdf/`](packaging/asdf/README.md), published as
[`digitable-lol/asdf-flang`](https://github.com/digitable-lol/asdf-flang). Both are kept here as
submodules and checked against this tree before every release. Both install the release archive
`flang-<version>-c.tar.gz` from GitHub Releases: printed C99 sources, a Makefile, the `flang.1`
man page and `flangtutor` — a guided walk through the language in the spirit of `vimtutor`.
Details — [Install](https://digitable-lol.github.io/flang/en/install.html).

## First program

```flang
модуль «Привет»

тотальная функция «Удвоить»
  принимает н: неотрицательное
  возвращает число
  обеспечивает «удвоенное не меньше исходного» результат не меньше н
  пример «дважды два»
    дано н равно 2
    ожидается 4
  н плюс н
```

Five parts: the module name; `тотальная` — the termination promise; `принимает` / `возвращает` —
the types; `обеспечивает` — a named postcondition; `пример` — an executable example that runs on
every check; the last line is the body. Save it as **привет.flang** and run the compiler on it:

```
$ flang check привет.flang
модуль «Привет»: функций 1, из них с доказанным завершением 1; типов 0
привет.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет

$ flang test привет.flang
привет.flang: примеров 1, прошло 1, не прошло 0

$ flang run привет.flang --function «Удвоить» --args '{"н": 21}'
42
```

Exit code 0 in all three cases. Declare `н: число` instead of `неотрицательное` and the check
refuses with `FLANG_BOUND_ON_NAN`: the type `число` contains "not a number", which is outside every
order, so the postcondition is false and the counterexample is named. The rest of the walk —
[Your first program](https://digitable-lol.github.io/flang/en/getting-started.html), then the
[Tutorial](https://digitable-lol.github.io/flang/en/tutorial.html).

## What the compiler does

`bootstrap/flang --help` is the authority; the man page `packaging/flang.1` and this list are
checked against it on every push. The binary answers to thirteen commands, the editor
language server among them: `check`, `test`, `run`, `emit`, `ast`, `tokens`, `facts`, `io`,
`lock`, `package`, `new`, `repl` and `lsp`. It prints into 10 target languages.
<!-- СНЯТО 2026-09-08 файлов flang/self/emit-*.flang = 10 -->

| command | what it does |
| --- | --- |
| `flang check <file>` | parsing, linking, types, totality, the proof kernel, the examples. `--proof` prints what carries each promise; `--быстро` skips the kernel and the examples and says so, exit 4 |
| `flang test <file\|dir>` | runs the examples declared inside functions, one file or a whole directory |
| `flang run <file> --function «Имя» --args '{…}'` | evaluates one function and prints the value |
| `flang emit <file> --target <t> --out <dir>` | prints the program into `c`, `cpp`, `go`, `rust`, `java`, `js`, `ts`, `elixir`, `python` or `csharp`. The program is checked first — the same road as `check` — and nothing is written when it fails |
| `flang io <file>` | runs a plan: files, directories, processes, network. Every check in this tree that is written in flang runs this way |
| `flang ast`, `flang tokens` | the parsed program as JSON; the token stream |
| `flang facts <file> --claims '[…]'` | checks claims against facts |
| `flang lock`, `flang package`, `flang new` | a lock file that carries the dependencies themselves; a package with a name, a version and a manifest; a new package from scratch |
| `flang`, `flang repl` | the shell: declare and evaluate at once. Under a terminal it edits the line (arrows, word moves, history, Tab completion, syntax colour); piped, it is a JSON-in/JSON-out driver instead |
| `flang lsp --stdio` | the language server for editors; `flang --mcp-mode` is the service for an AI assistant |

Every flag — [Commands](https://digitable-lol.github.io/flang/en/cli.html); the codes a refusal
carries — [Diagnostics](https://digitable-lol.github.io/flang/en/diagnostics.html).

Two surfaces the binary does not judge at all: the categorical surface (monoids, monads, functors,
declared properties) and processes with supervision. `flang check` names what it left unchecked and
exits with code 2 rather than pass such a program in silence.

## Proofs: four separate coverages, and what each one is not

`flang check <file> --proof` prints, function by function, what carries each promise — a proof, a
grid of the author's own values, or nothing. `--записать <file>` writes the proof record out, and
an **independent proof checker** reads it back:
[`flang/proof/checker/checker.c`](flang/proof/checker/checker.c), a C program that takes the source and
the record and answers whether they agree, with no line of the compiler in it.

There is no single number that says "the language is proved", and this page does not print one.
Four different coverages are measured separately, by one instrument:

```bash
sh scripts/four-coverages.sh
```

It prints the date, the commit of the tree, the seed fingerprint, the version and sha256 of the
built binary, the sha256 of the checker source and the version of the inference-rule list, and
then the four numbers below. Taken on this tree on **19 September 2026** (commit `404c4ec0a`,
binary 0.7.20):

| coverage | measured | what it is **not** |
| --- | --- | --- |
| **Own proof records** — places in the compiler's *own* proof records replayed independently | 650 / 650 = 100 % of the obligations in 91 records; 27 places excluded (records rejected outright as deliberate forgeries); 16 records get exit 0 with nothing proved in them at all | not "100 % of programs are proved", not a statement about your code, and not a statement about the built binary |
| **Formalization** — inference rules judged by a second, foreign judge (the Lean 4 kernel) | 109 of 109 rows of the inference-rule list have a lemma; the Lean acceptance relation covers 76 of the 97 inference rules — 21 are outside it (Выч, Р2, Р3, Р5, Р6, Инд1–Инд4 and others) | a lemma about a rule is not a check of your program that uses the rule; how many record blocks fall outside the acceptance relation needs a Lean run, and `lean` is not installed here |
| **Known soundness violations** — where two independent checks disagree, or where success does not mean what it reads as | 2 open (the third was closed on 19 September 2026), listed by name in [`flang/proof/tables/consistency-violations.tsv`](flang/proof/tables/consistency-violations.tsv) | the list is open — it does not claim there are no others |
| **Translation** — the printer's per-run proof replayed against the printed C | 23 experiments pass; of 41 print rules, 24 are checked against the source text and 10 are not replayed at all | the matcher judges *one run* of the printer, not the printer itself |

The full page, with what each coverage does and does not license you to say, is
[`docs/four-coverages.md`](docs/four-coverages.md).

`sh scripts/доказуемость.sh` reduces the first coverage and three guards on the checker to one
word, **ДОКАЗУЕМ** or **НЕ ДОКАЗУЕМ**, against a 100 % gate. That word is about the first
coverage and the probe set — not about the language. Measured on 19 September 2026: the same
command prints ДОКАЗУЕМ and exits 0 **even with `bootstrap/flang` removed from the tree**, because
none of its four checks calls the built binary. The check that does judge the final binary —
reprinting every proof record with it and comparing the bytes — is
`sh flang/proof/corpus-share.sh --вложенность`, and it now runs in
[`.github/workflows/provability.yml`](.github/workflows/provability.yml) beside the verdict.

## What is not covered

Named here because leaving them out would read as a promise.

- **The printed code is covered by no proof.** `flang check` proves postconditions of the *source*;
  what `flang emit` prints into C, or into any of the other nine targets, is not proved. The same
  gap exists in Coq, Lean and Idris (CompCert closes only C → machine). How it is to be closed —
  [ADR-0030](docs/adr/0030-the-printer-proves-each-run-not-itself.md).
- **State over time, side effects and concurrency.** The logic knows nothing about them: there is
  no place in the language to write such a claim at all.
- **The base you have to trust is large and grew.** The deciding part of the kernel is 5068 lines,
  4669 in August; the standing order to bring it under 4000 is not done.
- **Not for medicine, aviation or space.** Those standards ask for tool qualification, proved
  response bounds and behaviour on hardware failure, and none of that exists here
  ([ADR-0031](docs/adr/0031-certification-is-a-process-not-a-property-of-the-language.md),
  [ADR-0033](docs/adr/0033-termination-is-not-a-bound-on-steps.md),
  [ADR-0034](docs/adr/0034-hardware-failure-is-described-not-proved.md)).

What provability gives a developer today, on real runs, and how far it is from "right" —
[`docs/what-provability-gives-today.md`](docs/what-provability-gives-today.md); the longer account
is [What is proved and what is not](https://digitable-lol.github.io/flang/en/what-is-proved.html).

## Printing into a target language

This is [`docs/examples/leetcode/035-search-insert-position.flang`](docs/examples/leetcode/035-search-insert-position.flang)
as it stands in the tree — the position where a value belongs in a sorted list:

```flang
тотальная функция «Место вставки»
  принимает элементы: список числа, цель: число
  возвращает число
  пример «Пример 1 из условия»
    дано элементы равно [1, 3, 5, 6]
    дано цель равно 5
    ожидается 2
  свёртка элементы начиная с 0 как акк и эл → «Шаг места вставки» от акк и эл и цель
```

```bash
flang emit docs/examples/leetcode/035-search-insert-position.flang --target c  --out out-c
flang emit docs/examples/leetcode/035-search-insert-position.flang --target js --out out-js
```

Each target gets the module, a runtime, a JSON-in/JSON-out driver, a build file and — where the
target has one — a package manifest (`go.mod`, `Cargo.toml`, `flang.csproj`, `package.json`). The
C output of the function above, pasted from the run and not edited:

```c
fl_status search_insert_position_mesto_vstavki(fl_ctx *ctx, fl_value elementy, fl_value cel, fl_value *result, fl_error *error) {
  fl_value fl_t2 = fl_nothing();
  FL_TRY(fl_require_list(ctx, elementy, "свёртка", &fl_t2, error));
  fl_value akk = fl_number(0.0); /* «акк» */
  const fl_mark fl_t4 = fl_region_open(ctx);
  for (size_t fl_t3 = 0; fl_t3 < fl_t2.as.list.count; fl_t3 += 1) {
    const fl_value el = fl_t2.as.list.items[fl_t3]; /* «эл» */
    fl_value fl_t5 = fl_nothing();
    FL_TRY(search_insert_position_shag_mesta_vstavki(ctx, akk, el, cel, &fl_t5, error));
    akk = fl_t5;
    FL_TRY(fl_region_recycle(ctx, fl_t4, &akk, error));
  }
  FL_TRY(fl_region_close(ctx, fl_t4, FL_OK, &akk, error));
  *result = akk;
  return FL_OK;
}
```

The printed code carries the domain names in comments and reports the compiler's diagnostic codes
verbatim. Every target's runtime sources are copied into the output verbatim from
`share/flang/<target>/` next to the binary, or from `--runtime <dir>`. The same walk for all ten
targets — [`docs/guide/emit-walkthrough.md`](docs/guide/emit-walkthrough.md); how the targets are
checked, and how unevenly — [Known limits](docs/guide/limits.md).

## Documentation

The site is built from `docs/site/` in two editions —
[English](https://digitable-lol.github.io/flang/en/index.html) ·
[Русский](https://digitable-lol.github.io/flang/) — and is the place to read; the index of
everything else under `docs/` is [`docs/README.md`](docs/README.md).

| to… | read |
| --- | --- |
| write the first file | [Your first program](https://digitable-lol.github.io/flang/en/getting-started.html) · [Tutorial](https://digitable-lol.github.io/flang/en/tutorial.html) |
| look a construct up | [Language](https://digitable-lol.github.io/flang/en/language.html) · [Standard library](https://digitable-lol.github.io/flang/en/stdlib.html) · [Diagnostics](https://digitable-lol.github.io/flang/en/diagnostics.html) |
| understand the proofs | [Four coverages](docs/four-coverages.md) · [What is proved](https://digitable-lol.github.io/flang/en/what-is-proved.html) · [Which claims the kernel takes](https://digitable-lol.github.io/flang/en/what-the-kernel-accepts.html) · [The kernel refused: whose error](https://digitable-lol.github.io/flang/en/proof-refused.html) |
| run it somewhere | [Install](https://digitable-lol.github.io/flang/en/install.html) · [Commands](https://digitable-lol.github.io/flang/en/cli.html) · [Editor](https://digitable-lol.github.io/flang/en/editor.html) · [Processes and supervision](https://digitable-lol.github.io/flang/en/processes.html) |
| see real programs | [Examples](https://digitable-lol.github.io/flang/en/examples.html) — the sets under [`docs/examples/`](docs/examples) |
| read the contracts | [`docs/flang/SPEC.md`](docs/flang/SPEC.md) · [`docs/flang/self/SPEC.md`](docs/flang/self/SPEC.md) · [`docs/flang/proof/SPEC.md`](docs/flang/proof/SPEC.md) · [`docs/flang/conc/SPEC.md`](docs/flang/conc/SPEC.md) · [`docs/ct/spec.md`](docs/ct/spec.md) |
| know where it is going | [`docs/ROADMAP.md`](docs/ROADMAP.md) — five stages, what each changes for a developer · [`docs/what-provability-gives-today.md`](docs/what-provability-gives-today.md) · [`docs/road-to-1-0.md`](docs/road-to-1-0.md) |

Naming rule: a file with no language suffix is English; the suffix `.ru.md` marks its Russian
edition. The exception is `README.md` and `SPEC.md` next to code, which keep those names in
whichever language they are written, because GitHub shows them as a directory's front page.

## How the repository is laid out

There are 6 directories at the root. Everything that is the language lives under `flang/`; outside
it is what the language is not: the bootstrap point, packaging, examples, measurements,
documentation and the task list. `sh scripts/guards/published-vs-tree.sh --карта` checks this map
against the tree on every push.

<!-- КАРТА-НАЧАЛО: между этими метками каждая строка начинается с имени каталога корня;
     sh scripts/guards/published-vs-tree.sh --карта сличает состав с деревом. -->

```
bootstrap/      the compiler printed to C99 and its Makefile: «make -C bootstrap» builds the binary
flang/          the language: self/ (the compiler), core/, stdlib/, proof/, concurrency/, ct/, src/emit/ (target runtimes), scripts/, test/, bin/ (flangtutor) — code only; its contracts are in docs/flang/
docs/examples/  205 flang programs in 25 sets: leetcode, rosetta, crypto, db, io, wal, web, library-api and others
docs/editors/   the language server, syntax for Vim and VS Code, a github-linguist submission
packaging/      the Homebrew formula, the asdf plugin, the flang.1 man page, install checks
scripts/        guards of the tree, the reprint of the bootstrap point, the release archive, the changelog
fspec/          business rules written as proved specifications, and the check that a new rule does not undo an old one
docs/           documentation: the site sources, the guide, decisions (adr/), measurement reports, the knowledge base, and flang/ — the contracts of the language, moved out of the code
docs/flang/     the contracts of the language — one SPEC.md per layer, moved out of the code; next to the code only a pointer is left
docs/tasks/     the open and closed work of the tree, one file per task
.github/        CI and release workflows
.ai/            what an assistant working in this tree reads: AGENTS.md and .claude/skills; the root keeps `AGENTS.md` and `.claude` as symbolic links into it, and both are still found by their old names
```

<!-- КАРТА-КОНЕЦ -->

Inside `flang/`: [`flang/self/`](flang/self) is the compiler, 67 files of flang —
<!-- СНЯТО 2026-09-17 файлов flang/self/*.flang = 67 -->
lexer, parser, types, totality, proof kernel and one printer per target.
[`flang/stdlib/`](flang/stdlib) is the standard library — **51 modules, 1764 functions and 3745
examples** that run on every check:
<!-- СНЯТО 2026-09-13 файлов flang/stdlib/*.flang = 51 -->
<!-- СНЯТО 2026-09-13 примеров-в flang/stdlib/*.flang = 3745 -->
lists, strings, numbers, sets, maps, JSON, UTF-8, dates, two database drivers (`postgres`,
`sqlite`), networking (`http`, `tls`, `redis`), a cryptography set written in flang (`aes`,
`x25519`, `sha256`, `hmac`, `x509`, `rsa`, `ecdsa`) and a regular-expression engine.
[`flang/src/emit/`](flang/src/emit) holds the runtime of each target; [`flang/test/`](flang/test)
holds the checks written in flang that the binary walks.

Two of the example sets are full-size projects —
[`docs/examples/web/shortener`](docs/examples/web/shortener/README.md), a link shortener with
nothing but flang between the request bytes and the response bytes, and
[`docs/examples/library-api`](docs/examples/library-api/README.md), the domain half of a library
service; the 190 more programs in the other sets are single files, the LeetCode set among them:
82 solutions carrying 806 examples.
<!-- СНЯТО 2026-09-08 файлов docs/examples/leetcode/*.flang = 82 -->
<!-- СНЯТО 2026-09-08 примеров-в docs/examples/leetcode/*.flang = 806 -->

**The bootstrap point.** `bootstrap/` holds the compiler already printed to C99, which is why
`make` alone gives a working `flang`. That binary prints the compiler's sources again, and the
result is compared with what is committed: `sh scripts/raskrutka.sh --check`. The inputs of the
last print are recorded in `scripts/otpechatok-semeni`, one hashed line each — 48 lines in the
input half; with the second half, the seed body, the file is 65 lines.
<!-- СНЯТО 2026-09-13 строк scripts/otpechatok-semeni = 65 -->
The seed lags the sources: `sh scripts/seed/what-lags-the-seed.sh` lists which files and functions
are newer than the seed, and a reprint (`sh scripts/raskrutka.sh`, hours on one core) is how edits
to `flang/self/` reach the binary. **An edit to the sources is not in the binary until that
reprint** — which is why the checks above distinguish source from binary.
[`bootstrap/README.md`](bootstrap/README.md) · [the bootstrap circle](docs/guide/bootstrap-circle.md).

The loose files in the root: `README.md` (this page), `LICENSE` · `LICENSE-RU.md`,
`CONTRIBUTING.md`, `AGENTS.md` (a symbolic link to `.ai/AGENTS.md`),
[`docs/DESCRIPTION.md`](docs/DESCRIPTION.md) (a long-form description, in Russian) and
[`docs/ROADMAP.md`](docs/ROADMAP.md) (measured, not intended) — both reachable through symbolic
links in the root, which keep the addresses other repositories already point at; `CHANGELOG.md` ·
`changelog.json` (printed from tags and commit subjects, never edited by hand); `.flangrc` (the
settings file, and the one place the version, the licence and the two addresses are read from —
[the settings page](docs/guide/settings.ru.md)); `ярлык` · `ярлыки.flang` — the shortcuts of the
tree and the `sh` entry point that runs them.

## Contributing

Work happens in a clone; the only thing to build is the compiler.

```bash
make -C bootstrap -j8                    # about a minute; gives bootstrap/flang
sh flang/test/обход.sh                   # the checks written in flang, seconds
./bootstrap/flang test flang/stdlib/     # the library's examples
git config core.hooksPath .githooks      # the pre-push hook: the cheap guards, before CI
```

The walk runs 211 checks written in flang and diffs the result against
<!-- СНЯТО 2026-09-13 строк flang/test/ведомость.txt = 211 -->
`flang/test/ведомость.txt`, one line per check. The hook runs the guards that finish in seconds and
names what it did not run; the long ones are CI (`.github/workflows/binary.yml`). Work is tracked
in [`docs/tasks/`](docs/tasks/README.md), one file per task; `docs/tasks/rejected/` holds the ones
that were considered and turned down, so the reason survives the decision. The rules of the tree
that are not visible from the code are in [`AGENTS.md`](.ai/AGENTS.md); how to build, run the
checks and send a change is [`CONTRIBUTING.md`](CONTRIBUTING.md). Decisions are recorded in
[`docs/adr/`](docs/adr); the knowledge base of measured facts and rejected paths is
[`docs/zettel/`](docs/zettel/README.md).

Prose in this tree is held to the tree by runs, not by memory: a number written by hand carries a
note saying how it was measured (`scripts/guards/prose-numbers-guard.sh`), a path in a link must
exist (`scripts/guards/link-guard.fscript`), and a word of internal jargon on a page for an outside
reader is refused (`scripts/guards/jargon-guard.fscript`). This page is one of the pages those
checks read.

## Status

`0.x` is the language-design phase: the JSON shape and the diagnostic codes are compatibility
surfaces, syntax grows through documented proposals. Four programs outside this repository are
built with it — [flang-tui](https://github.com/digitable-lol/flang-tui),
[digitdisk](https://github.com/digitable-lol/digitdisk),
[flang-ribbon](https://github.com/digitable-lol/flang-ribbon) and
[flang-env](https://github.com/digitable-lol/flang-env). What stands between the tree and 1.0 is
the five stages of [`docs/ROADMAP.md`](docs/ROADMAP.md), each tied to a decision in `docs/adr/` and
to tasks in `docs/tasks/`.

## License

BSD 2-Clause — [LICENSE](LICENSE); a Russian edition without legal force is
[LICENSE-RU.md](LICENSE-RU.md). Earlier versions were released under Apache-2.0, and anyone who
received the code that way keeps those rights.
