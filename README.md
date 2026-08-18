**English** · [Русский](README.ru.md)

# flang — a language whose specification runs, and prints itself into your language

A written specification drifts from the code the day after it is merged. This repository takes
the other route: the specification **is** the program. You write the rules once, run them, test
them against their own examples, and then print them into C, Go, Rust, Python, Java, C#, Elixir
or JavaScript — where the printed code is required to produce the same values and the same error
codes as the interpreter, checked input by input.

The authoring surface is Russian; an English surface exists and lexes to the same identifiers
(`функция` / `function`, `свёртка` / `fold`). The prose below is English, the code is not
translated — names in a specification belong to the domain that wrote them.

## Where the language came from

**[`flang`](flang/SPEC.md)** (`.flang`) grew out of FTS — an indentation-based executable
specification language with domain objects, deterministic utilities, examples and checked
properties. The language added sum types, lists, strings as data, recursion, pattern matching,
module linking, a category surface, a concurrency surface and eight code generators. Its
implementation is [`flang/src/`](flang/src).

**The older project was taken out of this repository on 16 August 2026.** Its home is
[digitable-lol/fts](https://github.com/digitable-lol/fts); the state on the day it left is kept
under the `fts-pered-udaleniem` tag. What is left here is the language alone: 179 thousand lines
went, and with them the TypeScript reference core, nine tools built on it, `.fts` highlighting for
four editors and a GitHub Action. The language no longer reads `.fts` and says so plainly —
`FLANG_FTS_REMOVED`, naming where the removed part can be found.

The FTS surface itself stayed IN THE LANGUAGE: the parser reads `категория`, `объект` and
`утилита` into legacy nodes, and a corpus of fifty-three models lives as fixtures
(`flang/test/fixtures/fts/`), holding up the checks over the four `flang/core/*.flang` programs —
the largest in the tree.

Two documents carry the rest: [`docs/overview.ru.md`](docs/overview.ru.md) describes the language
and draws the line between what is *proven* and what is *checked*, and
[`flang/SPEC.md`](flang/SPEC.md) is the specification. This page does not go past that line.

---

## Where things live

There are 11 directories at the root, and the layout is plain: nearly everything about the
language lives inside `flang/`, and outside it is only what is not the language — the bootstrap
point, packaging, measurements, documentation and one full-size example project.

<!-- КАРТА-НАЧАЛО. Каталоги ниже сверяются с деревом: flang/test/readme-layout.test.mjs
     падает, если названный каталог исчез или если появился каталог верхнего уровня,
     о котором обе редакции README молчат. Правьте карту вместе с деревом. -->

```
bootstrap/        the bootstrap point: the compiler printed to C99 — «make -C bootstrap», no Node
flang/src/        the flang implementation in JavaScript — the reference for the language
flang/self/       the same compiler, written in flang itself
flang/core/       a lexer, a parser, an evaluator and JSON printing, written in flang
flang/stdlib/     the standard library; its index is printed from the modules themselves
flang/examples/   flang programs: leetcode, rosetta, cat, monad, io, web, errors
flang/test/       the language test run — from the lexer to all eight backends
flang/bin/        flang and flang-lsp: adapters over flang/src, never a home for meaning
flang/cat/        the category-surface contract
flang/conc/       the concurrency contract and its examples
examples/         library-api — a whole REST service on flang and Node
editors/          the .flang language server and a github-linguist submission stub
packaging/        Homebrew, asdf and the flang.1 man page
scripts/          printing the library index, the changelog and the release C
benchmarks/       the harness, a checked-in baseline and the model-authoring measurement
web/              flang in a tab: building a program to WebAssembly and running it in a browser
.claude/          developer assistant skills: knowledge-base rules
docs/             documentation; README and SPEC files stay next to the code they describe
.github/          CI and the npm release
```

<!-- КАРТА-КОНЕЦ -->

<!-- КОРЕНЬ-НАЧАЛО. The root files are checked against the tree the same way the directories
     above are: flang/test/readme-layout.test.mjs fails if a file appears in the root that both
     editions of the README are silent about, or if a named root file is gone. -->

**The loose files in the root, and what keeps each one there.**

| file | what keeps it in the root specifically |
| --- | --- |
| `README.md` · `README.ru.md` | the front page: GitHub serves it from the root and nowhere else |
| `LICENSE` · `LICENSE-RU.md` | the BSD-2-Clause licence and its Russian edition; the translation carries no legal force, but it is the one people read |
| `CONTRIBUTING.md` | GitHub puts it into the issue and pull-request forms — also only from the root |
| `CHANGELOG.md` · `changelog.json` | one structure, two printings: the page is for a human, the JSON is for a program. Both are printed from tags and commit subjects (`scripts/build-changelog.mjs`); hand-editing is forbidden |
| `AGENTS.md` | guidance for agents: an assistant looks for a file of that name in the root of the working tree |
| `package.json` · `package-lock.json` | the manifest of the **second mould** — the one that embeds the language into somebody else's Node project. npm reads them only from the root of the package it publishes |
| `.gitignore` · `.gitattributes` | git reads them from the root |

**Nothing in that set builds the binary.** `make -C bootstrap` builds the compiler with a single
`cc` — no Node, no npm, not one line from here. `package.json` does not describe how the language
is built; it describes the package the language is embedded with. It declares zero dependencies
(`npm ls --all` prints `(empty)`), and `npm install` in a clone is needed for exactly one thing:
to put `flang` into `node_modules/.bin`.

<!-- КОРЕНЬ-КОНЕЦ -->

**How to tell what checks a file without opening it.** There is one run: `npm test` executes
`flang/test/*.test.mjs`, and everything is checked there — from the lexer to all eight backends,
including the `examples/library-api/` project (wired in through an adapter file). A file you
cannot immediately assign to a check is filed in the wrong place.

Laying out **your own** project is a separate document:
[Раскладка проекта](docs/rukovodstvo/project-layout.ru.md).

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
./flang_cli --help          # what it does: check, repl, --version
./flang_cli check m.flang   # parse, types, totality — in words, not JSON
./flang_cli                 # with no arguments: JSON in, JSON out, one request per line
```

The Homebrew formula is [`packaging/homebrew/flang.rb`](packaging/homebrew/flang.rb) and the
tap serves it. The asdf (and mise) plugin installs the same archive from the same releases, and
its source is [`packaging/asdf/`](packaging/asdf/README.md) — but asdf clones a plugin as a whole
repository, and that repository is not published yet, so for now the plugin is source rather than
an install path. Neither needs anything but a C compiler. This is how self-hosting languages
ship — Go carried generated C for years, Nim still does.

**Be clear about what that binary is.** It is the five layers of [`flang/self/`](flang/self):
lexer, parser, types, totality, printing to C. There is no evaluator among them — which is why
`flang repl` there evaluates the only honest way this binary can: it prints the session to C,
builds it with the system `cc` against the runtime installed beside it, and runs that. Without a
`cc` the shell does not switch off — it keeps checking parse, types and totality, and says so
once. Checking a file needs nothing else: `flang check file.flang` runs parse, linking, types and
totality and prints its findings in words — with a code and a place, not JSON. `flang --help`
lists the commands and `man flang` describes them. Running a program or its examples
non-interactively still needs the full toolchain below.

**The full toolchain does need Node.js 20 or newer**, and here is exactly why: the interpreter,
the language server, the MCP server and seven of the eight backends exist only in JavaScript. The
self-hosted compiler — the one in the release — prints to **C and nothing else**.

```bash
npm install -g @digitable-lol/fts
```

That gives the two commands used on this page: `flang` for the language and `flang-lsp` for the
editor language server. Inside a clone they are `node flang/bin/flang.mjs` and
`node flang/bin/flang-lsp.mjs` — and a clone is what you need for anything newer than the last
published release.

**In a clone, too, the compiler builds without Node.** The tree carries a bootstrap point — the
same compiler printed to C99, 7 files and 5,823,370 bytes:

```bash
git clone https://github.com/digitable-lol/flang && cd flang
make -C bootstrap            # only cc and make; about 4 minutes of CPU
bootstrap/flang_cli --version
```

What it is, what guards it and how it is updated: [`bootstrap/README.md`](bootstrap/README.md).
Node is still needed for the reference implementation and seven of the eight backends, but not to
build the compiler; see [Developing the language](#developing-the-language).

---

## One function, eight targets

This is `flang/examples/leetcode/035-search-insert-position.flang` — LeetCode 35, the position
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
flang emit flang/examples/leetcode/035-search-insert-position.flang --target c --out ./out-c
#              …and again with go, rust, python, java, csharp, elixir, js
```

and is pasted verbatim, not written by hand. Seven backends emit the module, a runtime, a
JSON-in/JSON-out driver, a build file and — where the target has one — a package manifest
(`go.mod`, `Cargo.toml`, `flang.csproj`); the JavaScript backend emits a single self-contained
module plus the same driver next to it (`flang_cli.js`, dropped by `--no-cli`) — the driver is
what makes the declared call-depth limit real for an ordinary run. Two of the eight are shown
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
  for (size_t fl_t2 = 0; fl_t2 < fl_t1.as.list.count; fl_t2 += 1) {
    const fl_value el = fl_t1.as.list.items[fl_t2]; /* «эл» */
    fl_value fl_t3 = fl_nothing();
    FL_TRY(fl_lt(ctx, el, cel, &fl_t3, error));
    bool fl_t4 = false;
    FL_TRY(fl_cond(ctx, fl_t3, &fl_t4, error));
    fl_value fl_t5 = fl_nothing();
    if (fl_t4) {
      fl_value fl_t6 = fl_nothing();
      FL_TRY(fl_add(ctx, akk, fl_number(1.0), &fl_t6, error));
      fl_t5 = fl_t6;
    } else {
      fl_t5 = akk;
    }
    akk = fl_t5;
  }
  *result = akk;
  return FL_OK;
}
```

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
it reports the interpreter's diagnostic codes and messages verbatim, and the header says what it
is: *«Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.»*

### Why the backends are believable

Each backend is checked differentially, not by golden files. The corpus is the standard library
and the LeetCode solutions — `flang/stdlib/*.flang` and `flang/examples/leetcode/*.flang`,
95 programs with 511 functions and 1291 examples between them. For every function a grid of inputs
is built from its own examples plus deliberately wrong arguments (`null`, a string where a list is
wanted, a variant that does not exist), the program is printed into an empty directory, compiled
with the real toolchain from nothing but what the backend emitted, and run as a real process.
The run reports what it covered, so the claim is checkable rather than quoted:

```
✔ stdlib и leetcode: собранный C# совпадает с интерпретатором
ℹ программ: 95, функций: 511, сверенных входов: 8151, из них по лимиту шагов только по коду: 3, за 754 с
✔ примеры stdlib и leetcode сходятся у C# так же, как у интерпретатора
ℹ сверенных примеров: 1291
```

The C backend additionally compiles under `gcc` *and* `clang` with
`-std=c99 -Wall -Wextra -Werror -pedantic -O2` and is checked under `valgrind` for zero
unreachable bytes.

---

## Why this exists

A rule is written once, in the form a domain expert reads, not only a programmer. From that
single source come the implementation, the tests and the checks — in eight languages at once,
and a declared `свойство` becomes a postcondition of the emitted code: a Python service, a Go
service and a C binary refuse the same input with the same words.

The worked example, from source to emitted postcondition — [Why this
exists](docs/rukovodstvo/single-source.md).

---

## A real problem, not a hello world

LeetCode 121 — best profit from one buy and one sell, one pass, state in a two-field record.
This is `flang/examples/leetcode/121-best-time-to-buy-and-sell-stock.flang` in full:

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
flang test flang/examples/leetcode/121-best-time-to-buy-and-sell-stock.flang --pretty
```

Two example sets are kept, and both are guarded by tests rather than by good intentions.
[`flang/examples/leetcode/`](flang/examples/leetcode) holds 82 solutions; 81 of them are total,
as are 301 functions out of 303 — the single exception is deliberate and explained in the file
(`202-happy-number.flang`: the "until the number repeats" loop does terminate, but the language
has nothing to prove it with). Each carries a comment explaining not only the algorithm but where
the language pushed back — why "is this character already in the window" is linear (there is no set
in the language), why a dynamic-programming table costs a square (appending copies the list), why
Single Number is O(n²) because there are no bitwise operations. Of the twelve tasks previously
listed as inexpressible, eight are solved by this batch, and their entries in `index.json` have
been rewritten.
[`flang/examples/rosetta/`](flang/examples/rosetta) holds 14 canonical Rosetta Code tasks, each
written twice — 28 files: once on the Russian surface and once on the English one, with a test
comparing each pair as trees, up to a renaming of names. That test also pins the number of
functions each file proves total: the set exists to show the
border of the language, so a border that moves has to break a test rather than quietly outdate a
comment. The standard library ([`flang/stdlib/`](flang/stdlib): `dictionary`, `hashmap`, `higher-order`,
`lists`, `logic`, `numbers`, `numtree`, `optional`, `result`, `sets`, `strings`, `strlists`, `tree`) is written the same
way —
13 modules, 208 functions, of which 204 are proven total. `higher-order` is the one built on
first-class functions: fold, map, filter, search, sort and composition take a function as an
argument.

---

## What `тотальная` buys you

Turing completeness and guaranteed termination are incompatible, so flang does not choose
between them: it splits programs into two classes, and the compiler decides which class yours
is in. A `тотальная` function has its termination proven, and only such a function is admitted
into fact-checking, which is not allowed to hang.

Which kinds of descent are accepted, what a declared measure is, and why this is not pedantry —
[What `тотальная` buys you](docs/rukovodstvo/totality.md).

---

## Two implementations, and the fixed point

There are two implementations, and both are maintained on purpose. The **reference** one is
written in TypeScript and JavaScript and defines the behaviour of the language. The
**self-hosted** one is written in flang itself: [`flang/core/`](flang/core) is the FTS core,
[`flang/self/`](flang/self) is the compiler — five layers, each checked byte for byte against
its own reference.

Readiness is not "it built" but the classical fixed point, and it **has converged**. How it
works, what checks it and where the release comes from — [Two implementations, and the fixed
point](docs/rukovodstvo/two-implementations.md).

---

## Modules, the standard library, and a whole project

[`flang/examples/import-check.flang`](flang/examples/import-check.flang):

```flang
модуль «Проба импорта»
  использует «Списки» из "../stdlib/lists.flang"

тотальная функция «Сумма пробы»
  принимает элементы: список числа
  возвращает число
  «Сумма» от элементы
```

A selective form takes only what you name — `использует «Списки» из "…" только «Сумма», «Длина»` —
which is also how a name conflict between two modules is resolved.

How that scales to a full-size project is shown by
[`examples/library-api`](examples/library-api/README.md), a REST service for a library: the
domain is two FTS models, parsing and data handling are five flang modules, and HTTP and storage
stay with the host on Node. The rule the split follows is one sentence — *if a piece of logic can
have an example, it moves into a model or a module, where the example is executable* — and the
naming, layout, module-splitting and CI conventions derived from that project are collected in
[Раскладка проекта](docs/rukovodstvo/project-layout.ru.md).

---

## Developing the language

The JavaScript reference implementation stays forever: the fixed point is checked against it,
and removing it would make that check impossible. Work happens in a clone, and **there is nothing
to build**: the package declares zero dependencies (`npm ls --all` prints `(empty)`), and the
language reads its sources instead of compiling them. A fresh clone answers
`node flang/bin/flang.mjs check flang/stdlib/lists.flang` straight away; `npm install` only puts
`flang` into `node_modules/.bin`.

What to run when you change the compiler, how the bootstrap point is guarded, and the full list
of commands the language answers to — [Developing the
language](docs/rukovodstvo/developing.md).

**The language no longer reads `.fts` models.** It did until 16 August 2026 — through a bridge to
the older project's TypeScript core; the project left the repository, and the bridge lost its
other side. The refusal is explicit and says where the removed part now lives:

```bash
flang check model.fts
# {"diagnostics":[{"code":"FLANG_FTS_REMOVED","message":"формат .fts больше не читается: …
#   … github.com/digitable-lol/fts …"}]}
```

---

## The rest of the repository

- **A full-size example** — [`examples/library-api`](examples/library-api/README.md): a REST
  service on flang and Node, six routes, storage, response codes. It answers one question: what
  goes where, and why there.
- **Editors** — the `.flang` language server in
  [`editors/flang-lsp`](editors/flang-lsp/README.md). There is no `.flang` syntax highlighting in
  the tree at all, and that is a named debt, not a forgotten task.
- **Measurements** — the speed harness and the model-authoring measurement in
  [`benchmarks/`](benchmarks).

All documentation, with an index — [`docs/README.md`](docs/README.md): the guide, measurement
reports, the knowledge base and the conference submission.

**What is no longer here.** Until 16 August 2026 this repository carried a second project, FTS:
the TypeScript reference core, nine tools built on it (`ftsc`, `ftsvm`, `ftspec` and the rest), an
MCP server, `.fts` highlighting for four editors, a demo page and a GitHub Action. All of it was
taken out — 357 files, 180 thousand lines — and lives at
[digitable-lol/fts](https://github.com/digitable-lol/fts); the state on the day it left is kept
under the `fts-pered-udaleniem` tag.

Further reading — in Russian (the language surface is Russian, and so is most of the prose):
[Описание языка](docs/overview.ru.md) · [Раскладка проекта](docs/rukovodstvo/project-layout.ru.md) ·
[flang SPEC](flang/SPEC.md) · [core-in-flang contract](flang/core/SPEC.md) ·
[self-hosting contract](flang/self/SPEC.md) · [category contract](flang/cat/SPEC.md) ·
[concurrency contract](flang/conc/SPEC.md).

The documentation naming rule: an `.md` file with no language suffix is English, `X.ru.md` is its
Russian version. The exception is `README.md` and `SPEC.md` next to code — they keep those names
in whichever language they are written, because GitHub shows them as a directory's front page.

---

## Known limits

Stated plainly, because a project with unmarked boundaries cannot be relied on. The full list
is [Known limits](docs/rukovodstvo/limits.md): what *proven* means against *checked*, what the
language does not have, where the categorical surface stops, and what is done in concurrency.
The same boundary is drawn in [`docs/overview.ru.md`](docs/overview.ru.md); the complete lists
are in [`flang/SPEC.md`](flang/SPEC.md) §10 and in the "Долги" sections of the contracts.

---

## Status

`0.x` is the language-design phase. The canonical JSON shape and the diagnostic codes are treated
as compatibility surfaces; syntax may grow through documented proposals.

## License

BSD 2-Clause. The project previously carried Apache-2.0, inherited from the repository it grew
out of rather than chosen; BSD 2-Clause is the deliberate choice. See [LICENSE](LICENSE).
