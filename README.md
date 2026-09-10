**English** · [Русский](docs/README.ru.md) · [Documentation site](https://digitable-lol.github.io/flang/en/index.html)

# flang — a language whose specification is the program

flang is a pure functional language with strict static typing, written in words rather than
symbols. A function carries its examples and its claims about the result next to its body; the
compiler checks the file before anything runs, and `flang emit` prints a checked program into a
target language — C, C++, Go, Rust, Java, JavaScript, TypeScript, Elixir, Python or C#. There is one
compiler,
and it is written in flang itself; the tree carries it already printed to C99, so building it
needs a C compiler and `make` and nothing else.

The authoring surface is Russian: `модуль`, `тотальная функция`, `принимает`, `возвращает`,
`обеспечивает`, `пример`. An English surface exists and lexes to the same identifiers
(`функция` / `function`, `свёртка` / `fold`), so a file may be written on either. Names in
guillemets — `«Место вставки»` — belong to the domain that wrote them and are not translated by
anyone: they appear as written in the source, in the report and, transliterated, in the printed
code.

Two words carry the promises. `тотальная` in front of a function claims that it terminates on
every input; the compiler proves that itself, by structural descent or a declared measure, and
refuses the file when it cannot. `обеспечивает` states a postcondition; the proof kernel closes
it over all inputs where it can, and says in words when it could not. The full definition of the
language is [`flang/SPEC.md`](flang/SPEC.md); the reference by construct is on the site —
[Language](https://digitable-lol.github.io/flang/en/language.html).

## What is proved today, and what is not

The kernel that judges claims is `flang/self/proof-kernel.flang`; `flang check <file> --proof`
prints, function by function, what carries each promise — a proof, a grid of the author's own
values, or nothing. `--записать <file>` writes the proof record out, and an independent checker
reads it back: [`flang/proof/чекер/сверщик.c`](flang/proof/чекер/сверщик.c), a C program that
takes the source and the record and answers whether they agree, with no line of the compiler in
it. What the kernel may conclude and what it may not is [`flang/proof/SPEC.md`](flang/proof/SPEC.md).

The measure of that checker is the share of proof obligations in the repository that it replays
independently, rather than takes on the kernel's word:

```bash
sh flang/proof/доля-корпуса.sh --набор корпус --проигрыванием
# → доля-проигрыванием = 517 / 665 = 77.74 %      (8 September 2026, this tree)
# → порог Г4 = 95 %; добрала ли доля порога: НЕТ
sh scripts/доказуемость.sh          # → НЕ ДОКАЗУЕМ, exit 1
```

Read the fraction as a fraction. The numerator, 517, is what the C checker established without
asking the kernel: 390 obligations replayed from the recorded moves, 93 recomputed on the spot
where the record says «по примеру» or «по свойству», and 34 totality nodes walked again
structurally. The denominator, 665, is every obligation in that record set, so the 148 that are
missing from the numerator are the honest cost: 109 premises and claims and 17 steps that the
checker takes on the kernel's word, 8 closed by computing an identity rather than by replaying it,
and 14 belonging to the one record of 86 the checker refused outright. The denominator is what
caps the number: it counts the deliberate forgeries the record set keeps, and a forgery is never
supposed to be replayable, so 100 % is not the target — the gate asks for 95 %.

The second command is the verdict in one word: the language is **not** formally provable today,
and it exits 1. The reason is not the share. The checker still contains a step that proves an
equation by computing it instead of replaying recorded steps (`перепиской` appears twice in
`сверщик.c`), and `scripts/доказуемость.sh` stops on that alone: while a checker can compute, the
share it reports is not an independent measure and the rest of the run is beside the point. Both
numbers are printed by a run, and they will move; the commands are how to re-take them. The
longer account is on the site — [What is proved and what is
not](https://digitable-lol.github.io/flang/en/what-is-proved.html) — and in
[`docs/what-blocks-1-0.md`](docs/what-blocks-1-0.md).

What the compiler hands the checker grew on 8 September 2026: the kernel now prints the moves of
its proof for two families instead of asserting the conclusion — «тождество после переписки», 18
places, and «разбор цели по условию», 33 places — and the checker replays them. That is where most
of the 108 obligations the numerator gained came from.

Two surfaces the binary does not judge at all: the categorical surface (monoids, monads, functors,
declared properties) and processes with supervision. `flang check` names what it left unchecked
and exits with code 2 rather than pass such a program in silence.

## Install

A C99 compiler and `make` are the whole dependency list. All three ways give the same binary,
with the runtimes of every target under `share/flang/<target>/` beside it.

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

The Homebrew formula is [`packaging/homebrew/flang.rb`](packaging/homebrew/flang.rb), served
from [`digitable-lol/homebrew-tap`](https://github.com/digitable-lol/homebrew-tap); the asdf
plugin (mise reads it too) is [`packaging/asdf/`](packaging/asdf/README.md), published as
[`digitable-lol/asdf-flang`](https://github.com/digitable-lol/asdf-flang). Both published
repositories are kept here as submodules — `packaging/homebrew-tap` and `packaging/asdf-plugin` —
and each is checked against the source in this tree before every release. Both install the release
archive `flang-<version>-c.tar.gz` from GitHub Releases: printed C99 sources, a Makefile and the
`flang.1` man page. Details and what each path installs —
[Install](https://digitable-lol.github.io/flang/en/install.html).

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

Exit code 0 in all three cases. The type is spelled `неотрицательное`; `нат` and `натуральное`
lex to the same type and stay accepted as synonyms until 1.0. Declare `н: число` instead and the
check refuses
with `FLANG_BOUND_ON_NAN`: the type `число` contains "not a number", which is outside every
order, so the postcondition is false and the counterexample is named. The rest of the walk —
[Your first program](https://digitable-lol.github.io/flang/en/getting-started.html), then the
[Tutorial](https://digitable-lol.github.io/flang/en/tutorial.html).

## What the compiler does

`bootstrap/flang --help` is the authority; the man page `packaging/flang.1` and this list are
checked against it on every push. The binary answers to thirteen commands, the editor
language server among them: `check`, `test`, `run`, `emit`, `ast`, `tokens`, `facts`, `io`,
`lock`, `package`, `new`, `repl` and `lsp`. It prints into 10 target languages.
<!-- СНЯТО 2026-09-08 файлов flang/self/emit-*.flang = 10 -->

One place where the authority is behind the binary it describes: the tenth target, `ts`, works —
`flang emit … --target ts` exits 0 and writes four files — but `flang emit --help` still says
«во все восемь целей» and lists nine, and the refusal for an unknown target still says «целей
здесь ДЕВЯТЬ». That text is compiled into the binary and only a reprint of the seed can move it,
so it is named here rather than papered over.

| command | what it does |
| --- | --- |
| `flang check <file>` | parsing, linking, types, totality, the proof kernel, the examples. `--proof` prints what carries each promise; `--быстро` skips the kernel and the examples and says so, exit 4 |
| `flang test <file\|dir>` | runs the examples declared inside functions, one file or a whole directory |
| `flang run <file> --function «Имя» --args '{…}'` | evaluates one function and prints the value |
| `flang emit <file> --target <t> --out <dir>` | prints the program into `c`, `cpp`, `go`, `rust`, `java`, `js`, `ts`, `elixir`, `python` or `csharp`. The program is checked first — the same road as `check` — and nothing is written when it fails |
| `flang io <file>` | runs a plan: files, directories, processes, network. Every check in this tree that is written in flang runs this way |
| `flang ast`, `flang tokens` | the parsed program as JSON; the token stream |
| `flang facts <file> --claims '[…]'` | checks claims against facts |
| `flang lock`, `flang package`, `flang new` | a lock file that carries the dependencies themselves; a package with a name, a version and a manifest — `package` builds none today, it exits 1 on `FLANG_TYPE` (task 3401, open); a new package from scratch |
| `flang`, `flang repl` | the shell: declare and evaluate at once. Piped, with no terminal, the binary is a JSON-in/JSON-out driver instead |
| `flang lsp --stdio` | the language server for editors; `flang --mcp-mode` is the service for an AI assistant |

**Under a terminal the shell edits the line and wears the digitable colours.** When both ends are a
terminal, `flang repl` leaves canonical mode and reads keys itself: ←/→, Home/End, Ctrl-A/E move
along the line; ⌥←/⌥→, Alt-←/→ and Ctrl-←/→ move by words; Backspace, Delete, ⌥Backspace and
Ctrl-W erase a character or a word; Ctrl-U/K erase to either edge; ↑/↓ walk the session history.
An arrow no longer prints as `^[[A`. The line you type is highlighted as you go — keywords, «names»,
numbers, "strings", comments — in the Digitable portal palette (`digitable.tokens.css`, the same one
as the owner's dotfiles); an answer is white, a failure code red. Colour depth follows
[flang-env](https://github.com/digitable-lol/flang-env): `NO_COLOR` switches colour off by its mere
presence, so does `TERM=dumb`; `COLORTERM=truecolor` gives true colour, a `TERM` containing `256`
the palette. ⌘-arrows never reach the shell — the terminal application takes them; in Terminal.app
and iTerm2 word moves need Option sent as Esc+. Under a pipe (`flang repl < script`) none of this
exists: the same `fgets`, the output byte for byte as before and without a single ESC — held by
`scripts/repl-proba.sh`.

Tab completes: a session name in guillemets (`«Втр` → `«Втрое»`), a keyword of the language, a dot
command; at the start of a line it still indents by two spaces. Pasting a multi-line declaration is
taken exactly as typed. History survives restarts — `$XDG_STATE_HOME/flang/repl-history`, or the file
named by `FLANG_HISTORY` (`FLANG_HISTORY=нет` switches the file off). What YOUR build can do the
build says itself: `flang --version` prints a second line with the shell fingerprint and its
abilities, and `.помощь` reports whether the shell edits the line in this terminal, which colour
depth it uses, what it evaluates with and where it keeps the history. A binary installed before this
work prints no second line at all — that is how you tell them apart.

Command reference with every flag — [Commands](https://digitable-lol.github.io/flang/en/cli.html);
the codes a refusal carries — [Diagnostics](https://digitable-lol.github.io/flang/en/diagnostics.html).

### Printing into a target language

This is [`examples/leetcode/035-search-insert-position.flang`](examples/leetcode/035-search-insert-position.flang)
as it stands in the tree — the position where a value belongs in a sorted list:

```flang
модуль «Search insert position»

тотальная функция «Шаг места вставки»
  принимает акк: число, эл: число, цель: число
  возвращает число
  обеспечивает «элемент меньше цели двигает место на единицу» если эл меньше цель то (результат равен (акк плюс 1)) иначе да
  обеспечивает «иначе место стоит на прежнем» если не (эл меньше цель) то (результат равен акк) иначе да
  пример «Элемент меньше цели — шаг вперёд»
    дано акк равно 2
    дано эл равно 3
    дано цель равно 5
    ожидается 3
  пример «Элемент не меньше цели — место не двигается»
    дано акк равно 2
    дано эл равно 7
    дано цель равно 5
    ожидается 2
  если эл меньше цель то акк плюс 1 иначе акк

тотальная функция «Место вставки»
  принимает элементы: список числа, цель: число
  возвращает число
  пример «Пример 1 из условия»
    дано элементы равно [1, 3, 5, 6]
    дано цель равно 5
    ожидается 2
  пример «Пример 2 из условия»
    дано элементы равно [1, 3, 5, 6]
    дано цель равно 2
    ожидается 1
  пример «Пример 3 из условия»
    дано элементы равно [1, 3, 5, 6]
    дано цель равно 7
    ожидается 4
  свёртка элементы начиная с 0 как акк и эл → «Шаг места вставки» от акк и эл и цель
```

```bash
flang emit examples/leetcode/035-search-insert-position.flang --target c  --out out-c
flang emit examples/leetcode/035-search-insert-position.flang --target js --out out-js
```

Eight backends emit the module, a runtime, a JSON-in/JSON-out driver, a build file and — where
the target has one — a package manifest (`go.mod`, `Cargo.toml`, `flang.csproj`); the JavaScript
backend emits a single self-contained module plus the same driver next to it (`flang_cli.js`,
dropped by `--no-cli`), and the module itself stays one self-contained file that runs in Node and
in the browser. The two without a `Makefile` are those last two: `js`, and `ts`, which prints the
module as one `.ts` file beside the JavaScript runtime, the same driver and a `tsconfig.json` —
`tsc -p .` is its build step. Two of the ten are shown here, only the second function of each,
pasted from the run above and not edited:

<details>
<summary><b>C</b> — <code>out-c/search_insert_position.c</code></summary>

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

</details>

<details>
<summary><b>JavaScript</b> — <code>out-js/search_insert_position.js</code></summary>

```js
/**
 * Функция flang «Место вставки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * @param {Array<number>} elementy — «элементы»
 * @param {number} cel — «цель»
 * @returns {number}
 */
export function mestoVstavki(elementy, cel) {
  const $t1 = $requireList(elementy, "свёртка")
  let akk = 0
  for (const el of $t1) {
    akk = shagMestaVstavki(akk, el, cel)
  }
  return akk
}
```

</details>

The printed code carries the domain names in comments, reports the compiler's diagnostic codes
verbatim, and its header says what it is: *«Правьте исходник на flang и печатайте заново: любая
правка здесь потеряется.»* The JavaScript header still names a file the tree no longer has; the
printer writes that string, and the paste is left as printed. Every target's runtime sources are
copied into the output verbatim from `share/flang/<target>/` next to the binary, or from
`--runtime <dir>`. How the targets are checked, and how unevenly —
[Known limits](docs/guide/limits.md).

## Documentation

The site is built from `docs/site/` in two editions —
[English](https://digitable-lol.github.io/flang/en/index.html) ·
[Русский](https://digitable-lol.github.io/flang/) — and is the place to read; the index of
everything else under `docs/` is [`docs/README.md`](docs/README.md).

| to… | read |
| --- | --- |
| write the first file | [Your first program](https://digitable-lol.github.io/flang/en/getting-started.html) · [Tutorial](https://digitable-lol.github.io/flang/en/tutorial.html) |
| look a construct up | [Language](https://digitable-lol.github.io/flang/en/language.html) · [Standard library](https://digitable-lol.github.io/flang/en/stdlib.html) · [Diagnostics](https://digitable-lol.github.io/flang/en/diagnostics.html) |
| understand the proofs | [What is proved](https://digitable-lol.github.io/flang/en/what-is-proved.html) · [Which claims the kernel takes](https://digitable-lol.github.io/flang/en/kak-dokazat.html) · [The kernel refused: whose error](https://digitable-lol.github.io/flang/en/proof-refused.html) |
| run it somewhere | [Install](https://digitable-lol.github.io/flang/en/install.html) · [Commands](https://digitable-lol.github.io/flang/en/cli.html) · [Editor](https://digitable-lol.github.io/flang/en/editor.html) · [Processes and supervision](https://digitable-lol.github.io/flang/en/processes.html) |
| see real programs | [Examples](https://digitable-lol.github.io/flang/en/examples.html) — the sets under [`examples/`](examples) |
| read the contracts | [`flang/SPEC.md`](flang/SPEC.md) · [`flang/self/SPEC.md`](flang/self/SPEC.md) · [`flang/proof/SPEC.md`](flang/proof/SPEC.md) · [`flang/conc/SPEC.md`](flang/conc/SPEC.md) · [`docs/ct/spec.md`](docs/ct/spec.md) |
| know where it is going | [`ROADMAP.md`](ROADMAP.md) · [`docs/road-to-1-0.md`](docs/road-to-1-0.md) · [`docs/open-work.md`](docs/open-work.md) |

Naming rule: a file with no language suffix is English; the suffix `.ru.md` marks its Russian
edition. The exception is `README.md` and `SPEC.md` next to code, which keep those names in
whichever language they are written, because GitHub shows them as a directory's front page.

## How the repository is laid out

There are 11 directories at the root. Everything that is the language lives under `flang/`;
outside it is what the language is not: the bootstrap point, packaging, examples, measurements,
documentation and the task list. `sh scripts/published-vs-tree.sh --карта` checks this map
against the tree on every push.

<!-- КАРТА-НАЧАЛО: между этими метками каждая строка начинается с имени каталога корня;
     sh scripts/published-vs-tree.sh --карта сличает состав с деревом. -->

```
bootstrap/        the compiler printed to C99 and its Makefile: «make -C bootstrap» builds the binary
flang/            the language: self/ (the compiler), core/, stdlib/, proof/, conc/, ct/, src/emit/ (target runtimes), scripts/, проверки/, test/, SPEC.md
examples/         185 flang programs in 22 sets: leetcode, rosetta, crypto, db, io, wal, web, library-api and others
editors/          the language server, syntax for Vim and VS Code, a github-linguist submission
packaging/        the Homebrew formula, the asdf plugin, the flang.1 man page, install checks
scripts/          guards of the tree, the reprint of the bootstrap point, the release archive, the changelog
benchmarks/       measurements: speed against Python and Node, the cost of a proof, model authoring
web/              flang in a browser: a WebAssembly build, a browser application, the link shortener
fspec/            business rules written as proved specifications, and the check that a new rule does not undo an old one
docs/             documentation: the site sources, the guide, decisions (adr/), measurement reports, the knowledge base
tasks/            the open and closed work of the tree, one file per task
.github/          CI and release workflows
.ai/              what an assistant working in this tree reads: AGENTS.md and .claude/skills; the root keeps `AGENTS.md` and `.claude` as symbolic links into it, and both are still found by their old names
```

<!-- КАРТА-КОНЕЦ -->

Inside `flang/`: [`flang/self/`](flang/self) is the compiler, 63 files of flang —
<!-- СНЯТО 2026-09-08 файлов flang/self/*.flang = 63 -->
lexer, parser, types, totality, proof kernel and one printer per target; what the layers owe each
other is [`flang/self/SPEC.md`](flang/self/SPEC.md). [`flang/stdlib/`](flang/stdlib) is the
standard library — **50 modules, 1474 functions and 3663 examples** that run on every check:
<!-- СНЯТО 2026-09-10 файлов flang/stdlib/*.flang = 50 -->
<!-- СНЯТО 2026-09-10 примеров-в flang/stdlib/*.flang = 3663 -->
lists, strings, numbers, sets, maps, JSON, UTF-8, dates, and beyond them two database drivers
(`postgres`, `sqlite`), networking (`http`, `tls`, `redis`), a cryptography set written in flang
(`aes`, `x25519`, `sha256`, `hmac`, `x509`, `rsa`, `ecdsa`) and a regular-expression engine.
[`flang/src/emit/`](flang/src/emit) holds the runtime of each target, copied into printed code
verbatim. [`flang/проверки/`](flang/проверки) holds the checks written in flang that the binary
walks; [`flang/test/`](flang/test) is what is left of a test suite written against a deleted
JavaScript implementation, kept as fixtures.

Two of the example sets are full-size projects — [`examples/web/shortener`](examples/web/shortener/README.md),
a link shortener with nothing but flang between the request bytes and the response bytes, and
[`examples/library-api`](examples/library-api/README.md), the domain half of a library service;
the 170 more programs in the other sets are single files, the LeetCode set among them:
82 solutions carrying 806 examples.
<!-- СНЯТО 2026-09-08 файлов examples/leetcode/*.flang = 82 -->
<!-- СНЯТО 2026-09-08 примеров-в examples/leetcode/*.flang = 806 -->

**The bootstrap point.** `bootstrap/` holds the compiler already printed to C99, which is why
`make` alone gives a working `flang`. That binary prints the compiler's sources again, and the
result is compared with what is committed: `sh scripts/raskrutka.sh --check`. The inputs of the
last print are recorded in `scripts/otpechatok-semeni`, one hashed line each — 48 lines. The
seed lags the sources today, in three files and 77 functions: `sh scripts/chto-otstalo-ot-semeni.sh`
lists which files and functions are newer than the seed, and a reprint (`sh scripts/raskrutka.sh`, hours on one core)
is how edits to `flang/self/` reach the binary. What the seed is and what guards it —
[`bootstrap/README.md`](bootstrap/README.md) and [the bootstrap circle](docs/guide/bootstrap-circle.md).

The loose files in the root: `README.md` (this page; the Russian edition is a page of its own,
[`docs/README.ru.md`](docs/README.ru.md)), `LICENSE` · `LICENSE-RU.md`,
`CONTRIBUTING.md`, `AGENTS.md` (guidance for an agent working in the tree — a symbolic link to
`.ai/AGENTS.md`, as `.claude` is a link to `.ai/.claude`), `DESCRIPTION.md` (a
long-form description of the language, in Russian), `ROADMAP.md` (measured, not intended),
`CHANGELOG.md` · `changelog.json` (printed from tags and commit subjects, never edited by hand),
`package.json` (the version lives here; printed by `./ярлык пакет`, not published anywhere) and
`ярлык` · `ярлыки.flang` — the shortcuts of the tree and the `sh` entry point that runs them:
`./ярлык задачник:доска`, `./ярлык спеки:проверка`.

## Contributing

Work happens in a clone; the only thing to build is the compiler.

```bash
make -C bootstrap -j8                    # about a minute; gives bootstrap/flang
sh flang/проверки/обход.sh               # the checks written in flang, seconds
./bootstrap/flang test flang/stdlib/     # the library's examples
git config core.hooksPath .githooks      # the pre-push hook: the cheap guards, before CI
```

The walk runs 180 checks written in flang and diffs the result against
<!-- СНЯТО 2026-09-08 строк flang/проверки/ведомость.txt = 180 -->
`flang/проверки/ведомость.txt`, one line per check. The hook runs the guards that finish in
seconds and names what it did not run; the long ones are CI (`.github/workflows/binary.yml`). Work is tracked in [`tasks/`](tasks/README.md), one file per
task, taken and closed by a commit — `./ярлык задачник:доска` prints the board. A task can also
end without being done: `tasks/rejected/` holds the ones that were considered and turned down, so
the reason survives the decision. The rules of the
tree that are not visible from the code — what breaks silently, the cost of a reprint, what a
guard is for — are in [`AGENTS.md`](AGENTS.md); how to build, run the checks and send a change is
[`CONTRIBUTING.md`](CONTRIBUTING.md). Decisions are recorded in [`docs/adr/`](docs/adr); the
knowledge base of measured facts and rejected paths is [`docs/zettel/`](docs/zettel/README.md).

Prose in this tree is held to the tree by runs, not by memory: a number written by hand carries a
note saying how it was measured (`scripts/prose-numbers-guard.sh`), a path in a link must exist
(`scripts/link-guard.flang`), and a word of internal jargon on a page for an outside reader is
refused (`flang/scripts/jargon-guard.flang`). This page is one of the pages those checks read.

## Status

`0.x` is the language-design phase: the JSON shape and the diagnostic codes are compatibility
surfaces, syntax grows through documented proposals. Four programs outside this repository are
built with it — [flang-tui](https://github.com/digitable-lol/flang-tui),
[digitdisk](https://github.com/digitable-lol/digitdisk),
[flang-ribbon](https://github.com/digitable-lol/flang-ribbon) and
[flang-env](https://github.com/digitable-lol/flang-env). What stands between the tree and 1.0
is listed, with numbers, in [`docs/what-blocks-1-0.md`](docs/what-blocks-1-0.md).

## License

BSD 2-Clause — [LICENSE](LICENSE); a Russian edition without legal force is
[LICENSE-RU.md](LICENSE-RU.md). Earlier versions were released under Apache-2.0, and anyone who
received the code that way keeps those rights.
