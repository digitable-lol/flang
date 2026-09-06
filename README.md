**English** · [Русский](README.ru.md) · [Documentation site](https://digitable-lol.github.io/flang/en/index.html)

# flang — a language whose specification runs, and prints itself into your language

Write a rule once, in the words its domain already uses, and the same file is the
implementation, the test suite and the documentation at once: the examples sit inside the
function and run on every check, the compiler *proves* termination instead of taking your word
for it, and one command prints the rule into C, C++, Go, Rust, Java, JavaScript, Elixir,
Python or C#. A written specification drifts from the code the day after it is merged. Here there is
nothing to drift, because the specification **is** the program.

The authoring surface is Russian; an English surface exists and lexes to the same identifiers
(`функция` / `function`, `свёртка` / `fold`). The prose below is English, the code is not
translated — names in a specification belong to the domain that wrote them.

## The language in one paragraph

flang is a **pure functional language with strong static typing**, where checking is
mandatory and happens before anything runs. Values are **immutable**; there is no
assignment. Functions are values, but there are **no closures**: a function value is a
tag naming a declared function (defunctionalisation, Reynolds 1972), which is why it
can be printed even into target languages that have no closures at all. A program has
**no side effects whatsoever** — it does not reach the network, read files or know the
time; it has arguments and a result. Effects are described as **orders**, and a host
carries them out: the program builds a value that says "do this", the host does it and
returns a response.

What sets it apart from other pure languages is that **the compiler proves rather than
trusts**. The word `total` in front of a function is a promise that it terminates on
every input, and the compiler **proves** it, refusing the file when it cannot. A
promise about the result (`ensures`) is not a comment either: some of those the proof
kernel proves for ALL inputs rather than checking on a few. A function's examples live
next to its body and run on every check of the file.

The rest of the shape: sum types, pattern matching, lists, strings as data, a module
system that links by name, indentation instead of brackets, and two keyword surfaces —
Russian and English — that lex into the very same identifiers. One source is printed
into nine target languages. The compiler is written in flang itself.

## What kind of language this is

**[`flang`](flang/SPEC.md)** (`.flang`, `.fp`, `.фп` or `.фланг` — the four extensions are equal,
[ADR-0018](docs/adr/0018-file-extensions-are-one-list.md)) is an indentation-based language where a function
carries its own examples and its own promise about the result right next to its body. The
`тотальная` marker is not a wish: the compiler proves termination itself and refuses a function
it cannot prove. The language has sum types, lists, strings as data, recursion, pattern
matching, module linking, a category surface and a concurrency surface, and one source is
printed into nine target languages.

**There is one compiler, and it is written in flang.** It lives in
[`flang/self/`](flang/self) — 57 files, 113,693 lines (measured 29 August 2026; 60 files and 118,918 lines
counting the three in subdirectories) — and it builds into a single binary that
needs nothing but a C compiler:

```bash
make -C bootstrap -j8    # cc -std=c99 -Wall -Wextra -Werror -pedantic -O2, no warnings
./bootstrap/flang --version
```

It also prints itself. `sh scripts/raskrutka.sh` runs the binary over the compiler's own
sources and reproduces the seven C files the binary was built from — 7 files (six `*.c`/`*.h`
plus the `Makefile`), 26,598,071 bytes;
`--check` compares them with what is committed, and `--bystro` asks the cheap question first,
whether the inputs still match the ones the seed was printed from.

**Right now that cheap check is red, and this is the tree's largest open item:**

```
sh scripts/raskrutka.sh --bystro
→ 45 discrepancies. The compiler was edited, the seed was not reprinted.   (exit 1)
```

Everything below still builds and runs — the seed is a working compiler. What it is not is
*today's* compiler: edits made to `flang/self/**` since the last reprint are not in the binary
you get from `make`. Emitting a process plan into C, for instance, is written in the sources and
absent from the seed (`grep -c 'flang_conc.c' bootstrap/compiler_flang.c` → `0`). The reprint
costs hours and hundreds of gigabytes, so it is done deliberately, not on every merge.

The specification is [`flang/SPEC.md`](flang/SPEC.md); what the compiler's five layers owe each
other is [`flang/self/SPEC.md`](flang/self/SPEC.md). This page does not go past those.

---

## Where things live

There are 11 directories at the root, and the layout is plain: nearly everything about the
language lives inside `flang/`, and outside it is only what is not the language — the bootstrap
point, packaging, measurements, documentation and the example programs.

<!-- КАРТА-НАЧАЛО. Каталоги ниже сверял с деревом flang/test/readme-layout.test.mjs; проба
     удалена вместе с реализацией на JavaScript, и полгода карта держалась рукой — держалась
     плохо. С 29 августа 2026 её снова сверяет прогон, и без единой зависимости:
     `sh scripts/published-vs-tree.sh --карта` сличает число у корня и состав карты с деревом,
     работа `published` в binary.yml зовёт его на каждый пуш. Правьте карту вместе с деревом —
     теперь об этом скажет проверка, а не читатель. -->

```
bootstrap/        the bootstrap point: the compiler printed to C99 — «make -C bootstrap»
flang/self/       the compiler: lexer, parser, types, totality, proof core, nine printers
flang/core/       a lexer, a parser, an evaluator and JSON printing, written in flang
flang/src/        the target runtimes, copied verbatim into printed code — C, C++, Go, Rust, Java, JS, Elixir, Python, C#
flang/stdlib/     the standard library; its index is printed from the modules themselves
flang/proof/      what the proof core may and may not conclude, and why
flang/проверки/   checks written in flang, walked by the binary
flang/test/       the old test run: written against the deleted implementation, and today it does not start
flang/cat/        the category-surface contract
flang/conc/       the concurrency contract and its examples
examples/         193 flang programs in 22 sets: leetcode, rosetta, crypto, io, web, db, wal, library-api and fourteen more
editors/          the .flang language server, a vim plugin and a github-linguist submission stub
packaging/        Homebrew, asdf and the flang.1 man page
scripts/          reprinting the bootstrap point, the library index, the changelog and the release C
benchmarks/       the harness, a checked-in baseline and the model-authoring measurement
web/              flang in a tab: building a program to WebAssembly and running it in a browser
.claude/          developer assistant skills: knowledge-base rules
fspec/            the system's specification written in the language itself, and its guard
docs/             documentation; README and SPEC files stay next to the code they describe
tasks/            the open work of the tree: one file per task, taken and closed by hand
.github/          CI and the release
```

<!-- КАРТА-КОНЕЦ -->

<!-- КОРЕНЬ-НАЧАЛО. Файлы корня сверялись той же пробой и по той же причине сегодня не
     сверяются. Правьте таблицу вместе с корнем. -->

**The loose files in the root, and what keeps each one there.**

| file | what keeps it in the root specifically |
| --- | --- |
| `README.md` · `README.ru.md` | the repository front page. GitHub would take it from `.github/` or `docs/` too, but the root copy is the one a reader opening the repository lands on |
| `LICENSE` · `LICENSE-RU.md` | the BSD-2-Clause licence and its Russian edition. GitHub's licence detection reads **the root only**: move `LICENSE` and the repository becomes "no licence". The translation carries no legal force, but it is the one people read |
| `CONTRIBUTING.md` | GitHub puts it into the issue and pull-request forms; it looks in the root, in `.github/` and in `docs/` |
| `CHANGELOG.md` · `changelog.json` | one structure, two printings: the page is for a human, the JSON is for a program. Both are printed from tags and commit subjects (`scripts/build-changelog.mjs`); hand-editing is forbidden |
| `AGENTS.md` | guidance for agents: an assistant looks for a file of that name in the root of the working tree |
| `package.json` | where the **version** lives, and nothing else of consequence. It is **printed** from `scripts/emit-package.flang` and never hand-edited: `./ярлык пакет` prints it, `./ярлык пакет:проверка` refuses if the file and the declaration have drifted. Three programs read it — the site build, the Homebrew formula guard and the release workflow — and none of them is npm: publishing was removed on 3 September 2026, and with it `bin`, `files`, `scripts` and `package-lock.json`. What is left carries `"private": true`, so `npm publish` refuses on its own |
| `ярлык` · `ярлыки.flang` | the shortcuts of this tree and the entry point that runs them. `ярлыки.flang` is the list — a flang program, type-checked, with a plan that goes red when a shortcut names a file that is not there; `ярлык` is `sh` — 69 lines of code inside 160 — that asks the binary for a command line and runs it. Both sit in the root because that is where a person types `./ярлык спеки:проверка`, and because `ярлык` resolves its own paths from its own directory |
| `.gitignore` · `.gitattributes` | git reads them from the root |

**The binary builds with a single `cc`.** `make -C bootstrap` — that is all; no package
manager and no second language sit on the build path. There are two ways in: the release archive
`flang-<version>-c.tar.gz` on GitHub, and `brew install digitable-lol/tap/flang`. Both hand you
the same binary compiler.

**There is no third way in, and Windows is the one that lost it.** Until 3 September 2026 the
tree also published an npm package, and `bin` in npm must be a file Node can start — which is
why `packaging/flang-launch.mjs` and `flang/bin/flang-lsp.mjs` existed at all. They are gone
with the package. Homebrew does not install on Windows, and the release archive is C99 sources
under `make`. Nothing here was ever tested on Windows either: `install-path.yml` says so in its
own header. What was lost is a claim, not a working path — but it was the only claim there
was.

<!-- КОРЕНЬ-КОНЕЦ -->

**What checks a file today, and what does not.** Two runs cover the language, and both are
driven by the binary: `sh flang/проверки/обход.sh` — 180 checks written in flang itself, three
<!-- СНЯТО 2026-08-31 строк flang/проверки/ведомость.txt = 180 -->
seconds — and `flang test <directory>`, which runs the examples declared inside functions
(806 of them in the LeetCode set). The recorded ledger the walk is diffed against is
`flang/проверки/ведомость.txt`, one line per check — `wc -l` on it is where the 180 comes from.
<!-- СНЯТО 2026-08-31 строк flang/проверки/ведомость.txt = 180 -->
On every push CI builds the binary and runs those checks and the library-and-core examples with
it; the LeetCode set and the rest of the tree are walked on a tag, because that walk takes over
an hour.

**`flang/test/` is a remnant, and small.** It holds 187 files (`git ls-files flang/test | wc -l`),
<!-- СНЯТО 2026-09-04 файлов flang/test/* = 187 -->
of which 163 are fixtures and only four are still runnable test files.
<!-- СНЯТО 2026-08-31 файлов flang/test/fixtures/* = 163 --> `./ярлык тесты`
runs those four. The old JavaScript
implementation these tests were written against is gone, and what remains was pruned to what
still resolves — every import in those four files points at a file that exists (all fifteen of
them, checked 29 August 2026). **That is not the same as green**, and the difference is worth
stating: `./ярлык тесты` fails today — 38 checks, 29 pass, 9 fail (measured 29 August 2026). Six of
the nine are the jargon guard: it reads the tree's own prose, finds 18 pieces of jargon, and one
file it is handed has no recorded debt. The other three are the `go` target failing to build in
this environment, not a defect of the tree. Said here rather than left to be discovered from a
red log.

Laying out **your own** project is a separate document:
[Раскладка проекта](docs/guide/project-layout.ru.md).

---

## Install

**Installing flang needs a C99 compiler and nothing else.** The compiler is written in flang
itself and prints to C, so the release ships that C already printed.

```bash
brew install digitable-lol/tap/flang
```

Or straight from the release archive, with nothing but `cc` and `make`:

```bash
tar -xzf flang-*-c.tar.gz   # inside: C99 sources, a Makefile and the flang.1 man page
make                        # cc -std=c99 -Wall -Wextra -Werror -pedantic -O2
sudo make install           # from 0.5.1; in the 0.5.0 archive there is no such
                            # target — copy `flang_cli` to bin/flang by hand
flang --help                # thirteen commands, the language server among them
flang check m.flang         # parse, types, totality, proofs, examples — in words, not JSON
flang                       # on a terminal: the shell. Piped: JSON in, JSON out
```

**What gets installed, not just what gets printed.** `flang emit` copies a target's runtime
sources into the output **verbatim**, so it reads them from disk — in turn from `--runtime <dir>`,
from `$FLANG_RUNTIME_DIR`, and from `share/flang/<target>` next to the command. Nothing found and
`flang emit` answers «не найдены исходники рантайма» and prints nothing at all.

**The installation carries the runtimes of all nine targets** — 32 files, 2,435,747 bytes, in nine
`share/flang/<target>` directories. <!-- СНЯТО 2026-09-05 файлов flang/src/emit/*/* = 32 --> The
Homebrew formula, the asdf plugin and the release archive all do this (the archive carries them in
a `runtime/` directory). Verified by a run on 5 September 2026: archive built, installed by the
plugin, and from the installed prefix all nine targets print with no flags at all.

**Until 5 September 2026 one target out of nine was installed.** Both packagings shipped only
`share/flang/c`, so `--target js`, `--target go` and six others did not work for anyone who
installed — although all of them are promised here, in `man`, and in the binary's own help. The
same old shape of bug: the formula's test exercised the single target `c`, and so it was green
every single time. It now exercises two (`c` and `js`) and counts the nine directories. Fixed by
task 7261.

While version 0.7.11 or older is installed, here is the **temporary workaround**, verified by a
run: take the runtime from a clone.

```bash
git clone https://github.com/digitable-lol/flang
flang emit m.flang --target js --out out --runtime flang/flang/src/emit/js
# the same, once: export FLANG_RUNTIME_DIR=$PWD/flang/flang/src/emit/js
```

The `cpp` target has a different contract: both the flag and the variable expect the **root**
(`flang/src/emit`), not the target directory, because three of its four files come from `c/` and
only its own `cpp/flang_cpp.hpp` comes from `cpp/`.

The files at the top of the unpacked archive will **not** do, despite the identical names: those
are printed copies whose first line is the «Сгенерировано flang» header, and printing rejects them
so as not to stamp that header a second time.

The Homebrew formula is [`packaging/homebrew/flang.rb`](packaging/homebrew/flang.rb) and the
tap — [`digitable-lol/homebrew-tap`](https://github.com/digitable-lol/homebrew-tap) — serves it.
The asdf (and mise) plugin installs the same archive from the same releases, and its source is
[`packaging/asdf/`](packaging/asdf/README.md) — but asdf clones a plugin as a whole repository:
[`digitable-lol/asdf-flang`](https://github.com/digitable-lol/asdf-flang), published, though it
can lag behind this tree's latest release. Neither needs anything but a C compiler. This is how
self-hosting languages ship — Go carried generated C for years, Nim still does.

**Be clear about what that binary is.** It answers to all thirteen commands, the editor
language server among them: `check`, `test`, `run`, `emit`, `ast`, `tokens`, `facts`, `io`,
`lock`, `package`, `new`, `repl` and `lsp`. It prints into all nine targets. What it does not have is a separate
evaluator — which is why `flang repl` evaluates the only honest way it can: it prints the
session to C, builds it with the system `cc` against the runtime installed beside it, and runs
that. Without a `cc` the shell does not switch off — it keeps checking parse, types and
totality, and says so once. What it also does not judge is the category and concurrency
surface: monoids, monads, morphisms, processes and the declared properties. It does not pass
such a program in silence either — `flang check` names what it left unchecked and exits with
code 2, because saying "no findings" there would be untrue.

**Install from the clone, from the release archive or from brew — the registry is not an
option any more.** Nothing was ever published under the name `@digitable-lol/flang`, and nothing
will be: npm publishing was removed on 3 September 2026. What still sits on npm is a build from
7 August under the previous name, and it drags commands into your `$PATH` that this tree no
longer has — do not install it. Take the clone and build the compiler out of it:

```bash
git clone https://github.com/digitable-lol/flang && cd flang
make -C bootstrap -j4        # only cc and make
sudo make -C bootstrap install
flang --version
```

What the bootstrap point is, what guards it and how it is updated:
[`bootstrap/README.md`](bootstrap/README.md).

---

## One function, nine targets

This is `examples/leetcode/035-search-insert-position.flang` — LeetCode 35, the position
where a value belongs in a sorted list. One fold, proven terminating:

```flang
тотальная функция «Место вставки»
  принимает элементы: список числа, цель: число
  возвращает число
  пример «Пример 1 из условия»
    дано элементы равно [1, 3, 5, 6]
    дано цель равно 5
    ожидается 2
  свёртка элементы начиная с 0 как акк и эл → если эл меньше цель то акк плюс 1 иначе акк
```

Everything below was produced by running

```bash
flang emit examples/leetcode/035-search-insert-position.flang --target c --out ./out-c
#              …and again with go, rust, python, java, csharp, elixir, js
```

and is pasted verbatim, not written by hand. Eight backends emit the module, a runtime, a
JSON-in/JSON-out driver, a build file and — where the target has one — a package manifest
(`go.mod`, `Cargo.toml`, `flang.csproj`); the JavaScript backend emits a single self-contained
module plus the same driver next to it (`flang_cli.js`, dropped by `--no-cli`) — the driver is
what makes the declared call-depth limit real for an ordinary run. Two of the nine are shown
here, and only the function itself; the other six read the same way — run the command and look.

<details open>
<summary><b>C</b> — <code>out-c/mesto_vstavki.c</code></summary>

```c
/*
 * Функция flang «Место вставки».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param elementy — «элементы»: список: число
 * @param cel — «цель»: число
 * @return значение: число
 */
fl_status mesto_vstavki_mesto_vstavki(fl_ctx *ctx, fl_value elementy, fl_value cel, fl_value *result, fl_error *error) {
  fl_value fl_t1 = fl_nothing();
  FL_TRY(fl_require_list(ctx, elementy, "свёртка", &fl_t1, error));
  fl_value akk = fl_number(0.0); /* «акк» */
  const fl_mark fl_t3 = fl_region_open(ctx);
  for (size_t fl_t2 = 0; fl_t2 < fl_t1.as.list.count; fl_t2 += 1) {
    const fl_value el = fl_t1.as.list.items[fl_t2]; /* «эл» */
    if (el.tag != FL_NUMBER || cel.tag != FL_NUMBER) FL_TRY(fl_not_order(ctx, el, cel, error));
    bool fl_t4 = false;
    FL_TRY(fl_cond(ctx, fl_flag(el.as.number < cel.as.number), &fl_t4, error));
    fl_value fl_t5 = fl_nothing();
    if (fl_t4) {
      if (akk.tag != FL_NUMBER) FL_TRY(fl_not_numbers(ctx, "add", akk, fl_number(1.0), error));
      fl_t5 = fl_number(akk.as.number + 1.0);
    } else {
      fl_t5 = akk;
    }
    akk = fl_t5;
    FL_TRY(fl_region_recycle(ctx, fl_t3, &akk, error));
  }
  FL_TRY(fl_region_close(ctx, fl_t3, FL_OK, &akk, error));
  *result = akk;
  return FL_OK;
}
```

The header of that file still names `totality.mjs` — a file this tree no longer has. The
printer writes that string, and it is left here exactly as printed rather than tidied: a paste
that has been corrected by hand is no longer evidence of anything.

</details>

<details>
<summary><b>JavaScript</b> — <code>out-js/mesto_vstavki.js</code>, a single dependency-free file</summary>

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
    let $t2
    if ($cond($lt(el, cel))) {
      $t2 = $add(akk, 1)
    } else {
      $t2 = akk
    }
    akk = $t2
  }
  return akk
}
```

The JS backend inlines only the runtime helpers this module actually uses, so the module itself
stays one self-contained file that runs in Node and in the browser. The driver is emitted beside
it as a separate file and is not part of the module: the browser does not need it, and under Node
it is what makes the declared call-depth limit real.

</details>

The generated code is not a sketch you finish by hand. It carries the domain names in comments,
it reports the compiler's diagnostic codes and messages verbatim, and the header says what it
is: *«Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.»*

### How far the backends are actually checked

Honestly, and the answer is uneven.

**C is checked hardest, and by the strongest program there is — the compiler itself.**
`sh scripts/raskrutka.sh` prints the compiler to C — `flang/self/bootstrap/compiler.flang` and
the 41 flang files it pulls in, plus four C files copied verbatim; the list is recorded in
`scripts/otpechatok-semeni`, one hashed line each — 46 lines — and that record is honestly
behind the tree right now: 41 of the 46 hashes do not match the sources (`sha256sum -c` over
that file), because the record is rewritten only by a reprint, and none has run since it was
taken. It would be easy to make this line read "0 stale" by re-stamping the record from the
current tree instead of reprinting — `sh scripts/raskrutka.sh --otpechatok` does exactly that —
but the result would be a lie with a green face: the tool would be comparing the tree to a
snapshot of itself, not to a real print. See
`docs/zettel/re-taking-a-fingerprint-turns-red-green-without-reprinting.md` for the case this
was caught on, and `tasks/9611` for what an honest fix costs (a real reprint, hours). `make -C
bootstrap` compiles the resulting
25 MiB under `-std=c99 -Wall -Wextra -Werror -pedantic -O2` without one warning. Then the binary
built from that C prints the same sources again and the result is compared with what is
committed, all 26,598,071 bytes of it. A backend that miscompiled anything at that scale would
not survive being run through itself.

The caveat from the top of this page applies here too: that comparison is red today, because the
sources moved and the seed has not been reprinted since.

**The other seven have no automated check running today.** Each of them was checked
differentially against the deleted implementation — the same program printed into an empty
directory, built with the real toolchain and run as a real process on a grid of inputs from its
own examples plus deliberately wrong arguments. Those runs lived in `flang/test/emit-*.test.mjs`,
they went with the implementation they compared against, and nothing has replaced them. What can
be said today is only that all nine targets print, which is checked by running each of them.

The cost of that gap is named where the difference shows: `flang emit` does not check the
program at all — not types, not totality — so run `flang check` first and read what it says.

---

## Why this exists

A rule is written once, in the form a domain expert reads, not only a programmer. From that
single source come the implementation, the tests and the checks — in nine languages at once,
and a declared `свойство` becomes a postcondition of the emitted code: a Python service, a Go
service and a C binary refuse the same input with the same words.

The worked example, from source to emitted postcondition — [Why this
exists](docs/guide/single-source.md).

---

## A real problem, not a hello world

LeetCode 121 — best profit from one buy and one sell, one pass, state in a two-field record.
This is `examples/leetcode/121-best-time-to-buy-and-sell-stock.flang` in full:

```flang
объект «Сделка»
  минимум является числом
  прибыль является числом

тотальная функция «Лучшая прибыль»
  принимает цены: список числа
  возвращает число
  пример «Пример 1 из условия»
    дано цены равно [7, 1, 5, 3, 6, 4]
    ожидается 5
  пример «Пример 2 из условия»
    дано цены равно [7, 6, 4, 3, 1]
    ожидается 0
  пример «Пустой список»
    дано цены равно пустой список
    ожидается 0
  разбор цены
    случай пусто
      то 0
    случай голова и хвост
      пусть начальное равно запись «Сделка» с минимум равным голова и прибыль равным 0
      пусть итог равно свёртка хвост начиная с начальное как акк и цена
        пусть минимум равно если цена меньше акк.минимум то цена иначе акк.минимум
        пусть сегодня равно цена минус акк.минимум
        пусть прибыль равно если сегодня больше акк.прибыль то сегодня иначе акк.прибыль
        запись «Сделка» с минимум равным минимум и прибыль равным прибыль
      итог.прибыль
```

It reads as Russian prose — "разбор цены / случай пусто / то 0" — and the `тотальная` keyword on
the first line is a claim the compiler had to prove before accepting the file. The examples are
part of the function, not a separate test file:

```bash
flang test examples/leetcode/121-best-time-to-buy-and-sell-stock.flang
flang test examples/leetcode/     # all 82 files, 806 examples, one run
```

Two example sets are kept. [`examples/leetcode/`](examples/leetcode) holds
82 solutions with 301 functions between them, 299 of them proven total; the two exceptions are
deliberate and explained in the file (`202-happy-number.flang`: the "until the number repeats"
loop does terminate, but the language has nothing to prove it with). Each carries a comment
explaining not only the algorithm but where the language pushed back — why "is this character
already in the window" is linear (there is no set in the language), why a dynamic-programming
table costs a square (appending copies the list), why Single Number is O(n²) because there are no
bitwise operations.
[`examples/rosetta/`](examples/rosetta) holds 14 canonical Rosetta Code tasks, each
written twice — 28 files: once on the Russian surface and once on the English one. The standard
library ([`flang/stdlib/`](flang/stdlib)) is written the same way — **42 modules, 1474
functions, of which 1467 are proven total, and 2713 examples** that run on every check:

```bash
ls flang/stdlib/*.flang | wc -l
cat flang/stdlib/*.flang | awk '/^(тотальная )?функция «/{f++} /^тотальная функция «/{t++} \
  /^[[:space:]]+пример «/{e++} END{print f, t, e}'
```

Beyond the everyday modules (`lists`, `strings`, `numbers`, `sets`, `hashmap`, `dictionary`,
`tree`, `json`, `utf8`, `datetime`, `higher-order`, `optional`, `result`) it now carries two
database drivers (`postgres` over the wire, `sqlite` reading and building a file), networking
(`http`, `wire`, `redis`, `tls`), a cryptography set written in flang itself (`aes`, `x25519`,
`sha1`, `sha256`, `hmac`, `kdf`, `der`, `x509`, `crl`, `rsa`, `ecdsa`, `scram`) and a
backtracking-free regular-expression engine (`automaton`, 63 functions, every one proven total).
`higher-order` is the one built on first-class functions: fold, map, filter, search, sort and
composition take a function as an argument.

---

## What `тотальная` buys you

Turing completeness and guaranteed termination are incompatible, so flang does not choose
between them: it splits programs into two classes, and the compiler decides which class yours
is in. A `тотальная` function has its termination proven, and only such a function is admitted
into fact-checking, which is not allowed to hang.

Which kinds of descent are accepted, what a declared measure is, and why this is not pedantry —
[What `тотальная` buys you](docs/guide/totality.md).

---

## One compiler, and how it is rebuilt

The compiler that builds and the compiler that is written in flang are the same compiler. It is
[`flang/self/`](flang/self) — five layers, lexer through printing — plus
[`flang/core/`](flang/core), a lexer, parser, evaluator and JSON printer also written in flang.
Nothing in the tree is a second implementation of any of it.

That leaves the classic question of where the first binary comes from, and the answer is
committed rather than promised: `bootstrap/` holds this compiler already printed to C99 — seven
files, 26,598,071 bytes — so `make` alone turns it into a working `flang`. That binary then
prints the compiler's sources again and the result should be identical to what is in
`bootstrap/`; `sh scripts/raskrutka.sh --check` is that comparison, and a compiler whose
printing had drifted from the tree fails it. It fails right now: the sources have moved ahead of
the seed by 45 inputs, and reprinting is the tree's first open item.

**Two things about that circle are worth knowing before you rely on it.**

The check is expensive now. The recorded measurement is 19 minutes 58 seconds and 25.1 GiB of
peak memory on 256 cores (`scripts/raskrutka.sh`, 22 August 2026), and it needs `cc` and `make`.
That figure is a floor, not a promise: the closure has grown since it was taken. While a second
implementation was there to do the comparing, the same check took 3.4 seconds and no C compiler
at all — so the strongest check in the repository grew roughly three hundred times dearer. It does not fit on an ordinary GitHub
runner, so it is not in CI; it is called by hand before a change to `flang/self/` or
`flang/src/emit/c/` goes in.

And the binary cannot check its own sources. `flang check flang/self/bootstrap/compiler.flang`
runs out of its step budget and answers `FLANG_RECURSION_LIMIT`; the step budget is one per
command rather than one per evaluation, and `check` has no flag to raise it. `flang emit` does
not check the program at all, which is why printing still works. So the compiler can be
rebuilt, but confirming that the thing you rebuilt is sound needs something this tree does
not have.

---

## Modules, the standard library, and a whole project

[`examples/import-check.flang`](examples/import-check.flang):

```flang
модуль «Проба импорта»
  использует «Lists»

тотальная функция «Сумма пробы»
  принимает элементы: список числа
  возвращает число
  «Сумма» от элементы
```

There is no path in the line: a module is found by its name — the one written on the file's first
line as `модуль «Списки»`. The search looks in the file's own directory, then in every directory
above it while that directory still holds `.flang` files, then in the library shipped with the
compiler. Moving a module to another directory does not break anything; a module off that road is
named directly — `использует «Lists» из "path"`.

A selective form takes only what you name — `использует «Lists» только «Сумма», «Длина»` —
which is also how a name conflict between two modules is resolved.

How that scales to a full-size project is shown by two examples that are worth telling apart.

[`examples/library-api`](examples/library-api/README.md) is the **domain half** of a library
service — the rules, the parsing and the data handling, seven flang modules. Its HTTP and
storage once lived in a host on Node; that host was deleted on 20 August 2026 along with the
rest of the JavaScript, and nothing replaced it. So this example shows how to lay a project out,
not how to serve a request.

[`examples/web/shortener`](examples/web/shortener/README.md) is the one that serves: a
link shortener where **between the incoming and the outgoing bytes there is not one line written
in anything but flang** — storage, routing, processes and supervision included. It answers `GET
/здоровье` with 200, `POST /ссылки` with 201, `GET /с/{код}` with 301 and a counted redirect,
and `DELETE` with 204.

The rule the split follows is one sentence — *if a piece of logic can have an example, it moves
into a module, where the example is executable* — and the naming, layout, module-splitting and
CI conventions derived from these are collected in
[Раскладка проекта](docs/guide/project-layout.ru.md).

---

## Developing the language

Work happens in a clone, and the only thing to build is the compiler itself:
`make -C bootstrap -j8` takes about a minute and gives you `bootstrap/flang`, which answers
`./bootstrap/flang check flang/stdlib/lists.flang` straight away.

What to run after a change:

```bash
sh flang/проверки/обход.sh            # 180 checks written in flang, three seconds
./bootstrap/flang test flang/stdlib/  # the library's examples — 2287 are written in the modules
./bootstrap/flang test flang/core/    # the core's examples
sh scripts/raskrutka.sh               # only after flang/self/ or the C runtime changed
sh scripts/raskrutka.sh --check       # …and confirm the reprint matches the tree
```

The bootstrap point is reprinted in the same commit as the change that moved it. CI runs the
first three on every push.

`flang/test/` is not part of that list, and will not be until it is rewritten: see the note
above about `./ярлык тесты`.

---

## The rest of the repository

- **A working service** — [`examples/web/shortener`](examples/web/shortener/README.md): a link
  shortener with nothing but flang between the request bytes and the response bytes.
- **A full-size layout** — [`examples/library-api`](examples/library-api/README.md): the domain
  half of a library REST service, seven flang modules. It answers one question: what goes where,
  and why there.
- **The other examples** — 178 more programs in [`examples/`](examples), in 22 sets; what sits
  where is listed in [`examples/README.md`](examples/README.md).
- **Editors** — the `.flang` language server (`flang lsp`, described in
  [`editors/flang-lsp`](editors/flang-lsp/README.md)) and a vim plugin with syntax highlighting
  in [`editors/vim`](editors/vim/README.md).
- **Measurements** — the speed harness and the model-authoring measurement in
  [`benchmarks/`](benchmarks).

All documentation, with an index — [`docs/README.md`](docs/README.md): the guide, measurement
reports, the knowledge base and the conference submission. Parts of it still describe a tree
with two implementations in it and have not caught up with this page.

Further reading — in Russian (the language surface is Russian, and so is most of the prose):
[Раскладка проекта](docs/guide/project-layout.ru.md) ·
[flang SPEC](flang/SPEC.md) · [self-hosting contract](flang/self/SPEC.md) ·
[core-in-flang contract](flang/core/SPEC.md) · [proof core](flang/proof/SPEC.md) ·
[category contract](flang/cat/SPEC.md) · [concurrency contract](flang/conc/SPEC.md).

The documentation naming rule: an `.md` file with no language suffix is English, `X.ru.md` is its
Russian version. The exception is `README.md` and `SPEC.md` next to code — they keep those names
in whichever language they are written, because GitHub shows them as a directory's front page.

---

## Built with flang

Four applications outside this repository, not examples but working code:

- **[flang-tui](https://github.com/digitable-lol/flang-tui)** — terminal screen layout in
  flang: strips, clipping by printable cells, stacking, tabs, scrolling. Printed to Go and C.
- **[digitdisk](https://github.com/digitable-lol/digitdisk)** — a disk and system overview for
  Linux: the rules are decided by a kernel written in flang, the system calls by a Go host.
- **[flang-ribbon](https://github.com/digitable-lol/flang-ribbon)** — window-ribbon arithmetic
  in flang: offsets, column width, window height, insertion, panes. Carried over from digitwm
  and checked to match it exactly on 526,871 inputs. Printed to C and to Go.
- **[flang-env](https://github.com/digitable-lol/flang-env)** — parsing environment values in
  flang: color depth, language, `NO_COLOR`. The rules are pure; reading the environment is left
  to the host.

---

## Known limits

Stated plainly, because a project with unmarked boundaries cannot be relied on.

- **Proving an ordinary library function is still mostly out of reach.** The repeatable measure
  is twenty functions of the standard library taken in file-and-declaration order, every ninth
  one, so that convenient ones cannot be picked: on that sample the proof core closes claims for
  **fourteen** functions out of twenty, and **eleven** of those say something about the function:
  the rest are either weakened (the claim survives replacing the body with a stub of the same
  signature, so it holds of any such function) or restate the body. A run tells them apart,
  not a reading: `./ярлык доказательства:20`. Day by day: 0 → 2 → 4 → 5 → 9 → 11.
  And two of the twenty are unprovable because they are **false**: one fails at infinity,
  the other writes "or" where an implication was meant.
- **There is no second opinion about the language any more.** The comparison that used to matter
  proved that two independent implementations understood the same program the same way. What is
  left proves that the committed C matches what today's sources print — which catches a stale
  artefact, and cannot catch a misunderstanding, because there is no second understanding to
  disagree with.
- **Eight of the nine backends have no check running.** See above.
- **The category and concurrency surface is not judged by the binary.** It says so and exits 2
  rather than passing such a program in silence.

The longer list — what *proven* means against *checked*, what the language does not have, where
the categorical surface stops — is [Known limits](docs/guide/limits.md) and
[`flang/SPEC.md`](flang/SPEC.md) §10; both were written while there were two implementations and
still say so in places.

---

## Status

`0.x` is the language-design phase. The canonical JSON shape and the diagnostic codes are treated
as compatibility surfaces; syntax may grow through documented proposals.

## License

BSD 2-Clause — see [LICENSE](LICENSE). Earlier versions were released under Apache-2.0, and
anyone who received the code that way keeps those rights: the change applies to versions from
here on.
