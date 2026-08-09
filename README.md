**English** · [Русский](README.ru.md)

# FTS and flang — a specification that runs, and prints itself into your language

A written specification drifts from the code the day after it is merged. This repository takes
the other route: the specification **is** the program. You write the rules once, run them, test
them against their own examples, and then print them into C, Go, Rust, Python, Java, C#, Elixir
or JavaScript — where the printed code is required to produce the same values and the same error
codes as the interpreter, checked input by input.

The authoring surface is Russian; an English surface exists and lexes to the same identifiers
(`функция` / `function`, `свёртка` / `fold`). The prose below is English, the code is not
translated — names in a specification belong to the domain that wrote them.

## How FTS and flang relate

- **FTS** (`.fts`) — an indentation-based executable specification language for domain objects,
  deterministic utilities, examples, checked properties, morphisms and machine-checkable evidence.
  Its reference implementation is the TypeScript core in [`src/`](src).
- **[`flang`](flang/SPEC.md)** (`.flang`) — the full language FTS grew into: sum types, lists,
  strings as data, recursion, pattern matching, module linking, a category surface, a concurrency
  surface and eight code generators. Its implementation is [`flang/src/`](flang/src).

FTS is the total subset of flang: every existing `.fts` model is a valid flang program. That is
not a slogan but a differential test — both engines run every utility of every model over a grid
of inputs, and both the values and the error codes must agree. The run prints its own numbers:

```
сверка: файлов 22, документов 20, из них с утилитами 13; утилит 24, входов 23084,
из них с ошибкой 773 (коды: FTS_UTILITY_PROPERTY), расхождений 0
```

Two documents carry the rest: [`docs/overview.ru.md`](docs/overview.ru.md) describes the language
and draws the line between what is *proven* and what is *checked*, and
[`flang/SPEC.md`](flang/SPEC.md) is the specification. This page does not go past that line.

---

## Where things live

The layout follows from the section above, and it surprises on first sight: 13 directories at
the root, several of the names repeated. There is `src/` and there is `flang/src/`; there is `test/`
and `flang/test/`; there is `examples/` and `flang/examples/`. Two languages mean two
implementations, two test runs and two example corpora. Merging them would erase the seam the
checking runs along — each side is the reference the other is compared against, and with one
directory there would be nothing left to compare.

<!-- КАРТА-НАЧАЛО. Каталоги ниже сверяются с деревом: flang/test/readme-layout.test.mjs
     падает, если названный каталог исчез или если появился каталог верхнего уровня,
     о котором обе редакции README молчат. Правьте карту вместе с деревом. -->

```
src/              the FTS core in TypeScript — the reference everything else is true against
test/             its test run; built into dist/ and executed from there
flang/src/        the flang implementation in JavaScript — the reference for the language
flang/self/       the same compiler, written in flang itself
flang/core/       the same FTS core, written in flang: lexer, parser, evaluator, JSON printing
flang/stdlib/     the standard library; its index is printed from the modules themselves
flang/examples/   flang programs: leetcode, rosetta, cat, monad, io, web, errors
flang/test/       the language test run — from the lexer to all eight backends
flang/bin/        flang and flang-lsp: adapters over flang/src, never a home for meaning
flang/cat/        the category-surface contract
flang/conc/       the concurrency contract and its examples
examples/         .fts models, and library-api — a whole REST service on FTS and flang
schema/           the interchange format: JSON Schema for the document and the certificate
tools/            9 tools built on top of the compiled core
editors/          .fts syntax highlighting and the .flang language server
web/              the same compiler as a page element — no server, no build step
packaging/        Homebrew, asdf and the flang.1 man page
scripts/          printing the library index, the changelog and the release C
benchmarks/       the harness and a checked-in measurement baseline
docs/             documentation; README and SPEC files stay next to the code they describe
.github/          CI and the fts-check action
```

<!-- КАРТА-КОНЕЦ -->

**How to tell what checks a file without opening it.** By its directory and extension: `src/` and
`test/` go through `npm run test:core`, everything under `flang/` through `npm run test:flang`, each
tool carries its own `tools/*/test/`, and `npm test` runs all three suites. A file you cannot
immediately assign to one of those commands is filed in the wrong place.

Laying out **your own** project on FTS and flang is a separate document:
[Раскладка проекта](docs/project-layout.ru.md).

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

That gives the commands used on this page: `flang` for the language, `fts` for models, `fts-mcp`
for the MCP server, plus `ftsc`, `ftsvm` and `ftspec`. Inside a clone the same commands are
`node flang/bin/flang.mjs` and `node dist/src/cli.js` — and a clone is what you need for anything
newer than the last published release. The bootstrap problem stays with those who develop the
language itself; see [Developing the language](#developing-the-language).

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
file. Two of the eight are shown here, and only the function itself; the other six read the same
way — run the command and look.

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

The JS backend inlines only the runtime helpers this module actually uses, so the output is one
self-contained file that runs in Node and in the browser.

</details>

The generated code is not a sketch you finish by hand. It carries the domain names in comments,
it reports the interpreter's diagnostic codes and messages verbatim, and the header says what it
is: *«Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.»*

### Why the backends are believable

Each backend is checked differentially, not by golden files. The corpus is the standard library
and the LeetCode solutions — `flang/stdlib/*.flang` and `flang/examples/leetcode/*.flang`,
36 programs with 227 functions and 458 examples between them. For every function a grid of inputs
is built from its own examples plus deliberately wrong arguments (`null`, a string where a list is
wanted, a variant that does not exist), the program is printed into an empty directory, compiled
with the real toolchain from nothing but what the backend emitted, and run as a real process.
The run reports what it covered, so the claim is checkable rather than quoted:

```
✔ stdlib и leetcode: собранный Rust совпадает с интерпретатором
ℹ программ: 36, функций: 227, сверенных входов: 3274, за 6 с
✔ примеры stdlib и leetcode сходятся у собранного Rust так же, как у интерпретатора
ℹ сверенных примеров: 458
```

The C backend additionally compiles under `gcc` *and* `clang` with
`-std=c99 -Wall -Wextra -Werror -pedantic -O2` and is checked under `valgrind` for zero
unreachable bytes.

---

## Why this exists

Here the rule is written once, in a form a domain expert can read
(an excerpt from [`examples/utilities/discount.fts`](examples/utilities/discount.fts)):

```fts
категория «Продажи»

  объект Покупка
    сумма является деньгами
    «постоянный клиент» является признаком

  утилита «Рассчитать скидку»
    принимает Покупка
    возвращает деньги
    начинает с 0

    правило «Большая покупка»
      если сумма не меньше 10000
      то добавить 10 процентов от поля сумма

    правило «Постоянный клиент»
      если «постоянный клиент» равен да
      то добавить 5 процентов от поля сумма

    свойство «Скидка ограничена»
      результат не больше 20 процентов от поля сумма

    пример «Большая покупка»
      дано сумма равна 20000
      дано «постоянный клиент» равен нет
      ожидается результат равен 2000
```

No braces, no arrows, no colons: the surface is indentation-based and syllogistic, and readable
names may use guillemets. A legacy braced dialect is still accepted for compatibility.

From that single source you get the implementation, the tests, and the checks — in eight
languages at once. The `свойство` above is not a comment: it becomes a postcondition in the
emitted code. Printing `examples/utilities/discount.fts` to Python produces, verbatim:

```python
    # постусловие «Скидка ограничена»
    if not rt.post(ctx, rt.lte(ctx, _t3, rt.percent(ctx, rt.number(20.0), rt.field_get(ctx, vhod, "сумма"))), "Скидка ограничена", "Рассчитать скидку"):
        raise rt.fail("FTS_UTILITY_PROPERTY", "нарушено свойство «Скидка ограничена» утилиты «Рассчитать скидку»")
```

`FTS_UTILITY_PROPERTY` is the FTS core's own diagnostic code, and the message is the core's own
wording. A Python service, a Go service and a C binary generated from this model refuse the same
inputs with the same words. That is what "one source of truth" has to mean to be worth anything.

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
[`flang/examples/leetcode/`](flang/examples/leetcode) holds 26 solutions, every one of them total
throughout; each carries a comment explaining not only the algorithm but where the language
pushed back — why binary search needs a "fuel" list to be accepted as terminating, why Single
Number is O(n²) because there are no bitwise operations.
[`flang/examples/rosetta/`](flang/examples/rosetta) holds 14 canonical Rosetta Code tasks, each
written twice — 28 files: once on the Russian surface and once on the English one, with a test
comparing each pair as trees, up to a renaming of names. That test also pins the number of
functions each file proves total: the set exists to show the
border of the language, so a border that moves has to break a test rather than quietly outdate a
comment. The standard library ([`flang/stdlib/`](flang/stdlib): `dictionary`, `higher-order`,
`lists`, `logic`, `numbers`, `optional`, `result`, `sets`, `strings`, `tree`) is written the same
way —
10 modules, 148 functions, of which 144 are proven total. `higher-order` is the one built on
first-class functions: fold, map, filter, search, sort and composition take a function as an
argument.

---

## What `тотальная` buys you

Turing completeness and guaranteed termination are incompatible, so flang does not choose: it
splits programs into two classes and has the compiler decide which one you are in.

|                              | `тотальная`                     | plain                      |
|------------------------------|----------------------------------|----------------------------|
| recursion                    | decreasing: by value part or by numeric measure | any         |
| termination                  | proven by the compiler           | not guaranteed             |
| its examples                 | are guaranteed to finish         | may need a step limit      |
| accepted by the fact-checker | yes                              | no                         |

`тотальная` requires every recursive call to receive a decreasing argument, and two kinds of
decrease are accepted: structural — the tail of a list, a field of a variant or a record — and
numeric, by measure. A measure is `н минус <number>` provided the parameter is bounded from below
at the call site by an inequality check (`если н не больше 0`). Both conditions are required:
without a constant step the chain may not decrease at all, without a floor it runs to minus
infinity. A PARAMETER also works as the step (`н минус ш`) — provided it arrives in the call
unchanged in its own position and is known to be strictly `ш больше 0`: the same number is then
subtracted along the whole chain. Without the strict bound the step may be zero, and a changing
step never reaches the floor at all — `ш`, `ш делить на 2`, … add up to less than `2ш`. If the analysis cannot prove it, you get `FLANG_NOT_TOTAL` and the file does not
compile. Every existing `.fts` model lands in the total class by construction.

Counting UP is not a measure and stays out of the total class: `«Числа от и до» от 1 и н` grows
the start, and the end is a parameter rather than a number, so it cannot serve as a floor. String
code crossed the border earlier and differently: the built-in form `разложить … на символы` turns
a string into a list of one-character strings by code points, and the walk becomes recursion over
a tail. `flang/examples/rosetta/reverse-string.flang` is total throughout because of it, emoji and
Cyrillic included.

This is not pedantry, and the reason is concrete. The embedded fact-checking mode
([`flang/src/factcheck.mjs`](flang/src/factcheck.mjs)) answers "does this claim hold about this
data" — and a system that must answer yes or no is not allowed to hang. So it refuses to run a
function that was not proven to terminate, before evaluating anything — `flang facts` answers with
`holds: false` and says why. The mode has no file, network or clock access, and a hard step budget:
the answer depends only on `(program, facts, claims, limits)`.

---

## Two implementations, and the fixed point

Two implementations exist, and both are kept deliberately. The **reference** one is written in
TypeScript and JavaScript and defines the behaviour of the language. The **self-hosted** one is
written in flang.

### The FTS core, written in flang

[`flang/core/`](flang/core) is the FTS core — lexer, parser, evaluator, JSON printer — rewritten
in flang: 300 functions, every one of them `тотальная` and proven so. `fts check` is not allowed
to hang either.

The correctness criterion is not "its own tests pass". It is a differential one, stated in
[`flang/core/SPEC.md`](flang/core/SPEC.md): run the whole chain — *text → lexer in flang →
parser in flang → JSON printer in flang* — and require the output string to equal
`JSON.stringify(compile(text))` of the TypeScript core **byte for byte**. It runs over every
`.fts` model in this repository — 50 of them on a clean clone, on both surfaces (47 indentation,
3 braced) — with zero divergences. If an external model directory is present, its models join the
same run, so your local count may be higher; the promise is the corpus, not the number.
Diagnostics are compared separately, on 34 deliberately broken indentation models and 13 braced
ones — code *and* message text.

### The compiler, written in flang, and the fixed point

[`flang/self/`](flang/self) is the flang compiler written in flang. Five layers, each with its
own JavaScript reference to be compared against — not "roughly the same", but to the last
component of the result:

| Layer                 | Functions | Reference          | What must match                                                     |
|-----------------------|----------:|--------------------|---------------------------------------------------------------------|
| `self/lexer.flang`    |        88 | `src/lexer.mjs`    | token stream: kind, value, quotedness, line and column               |
| `self/parser.flang`   |       372 | `src/parser.mjs`   | the AST — **byte for byte** after serialization                      |
| `self/types.flang`    |       276 | `src/types.mjs`    | diagnostics (code, text, line, column) and the signature table       |
| `self/totality.flang` |       124 | `src/totality.mjs` | the verdict: proven functions in the same order, diagnostics, `ok`   |
| `self/emit-c.flang`   |       328 | `src/emit/c.mjs`   | the printed C — **byte for byte**, and it compiles without warnings  |

Readiness is not "it built". It is the classical fixed point:

```
1. the JS compiler prints self/*.flang      → C → build → flang₁
2. flang₁ prints the same self/*.flang      → C → build → flang₂
3. the C printed by flang₁ and the C printed by flang₂ are identical byte for byte
```

**The fixed point has converged.** The reference, `flang₁` and `flang₂` print the compiler
identically — all seven printed C files — which means the compiler understands the language the way the
reference does, and no test suite substitutes for that. The check is
`flang/test/self-bootstrap.test.mjs`, and it prints the result:

```
✔ шаги 2 и 3: flang₁ печатает сам себя, flang₂ печатает то же самое
ℹ неподвижная точка сошлась: 7 файлов совпали побайтово у эталона, flang₁ и flang₂
```

This is where the release comes from: the C in the release archive is printed from these sources. The reference implementation is not deleted, and will not be — convergence is
measured against it, and deleting it would delete the check.

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
[Раскладка проекта](docs/project-layout.ru.md).

---

## Developing the language

The JavaScript reference implementation stays for good: it is what the fixed point is checked
against, and deleting it would delete the check. Working on it takes a clone:

```bash
npm install
npm run build
node scripts/build-release-c.mjs     # prints the release C and builds it
```

The commands the language answers to:

```bash
# parse, type-check, prove totality
flang check flang/examples/leetcode/035-search-insert-position.flang --pretty

# run the examples declared inside the functions
flang test flang/examples/leetcode/035-search-insert-position.flang --pretty

# call a function
flang run flang/examples/leetcode/035-search-insert-position.flang \
  --function "Место вставки" --args '{"элементы":[1,3,5,6],"цель":2}'
# {"function":"Место вставки","args":{...},"result":1}

# print it — targets: c | csharp | elixir | go | java | js | python | rust
flang emit flang/examples/leetcode/035-search-insert-position.flang \
  --target python --out ./out-python
```

Any `.fts` model is a valid flang program, so the same commands take one directly. That path goes
through the compatibility bridge, which needs the built TypeScript core — so `npm install && npm
run build` inside the clone comes first:

```bash
flang check examples/utilities/discount.fts --pretty
flang emit examples/utilities/discount.fts --target go --out ./out-go
```

FTS's own CLI, for models specifically:

```bash
fts pipeline examples/real-world/order-shipment.fts --pretty
fts test examples/utilities/discount.fts --pretty
fts run examples/utilities/discount.fts \
  --utility "Рассчитать скидку" --input examples/utilities/discount.input.json --pretty
fts certify examples/real-world/order-shipment.fts \
  --context examples/real-world/order-shipment.context.json --pretty
fts generate examples/utilities/discount.fts --out generated
```

Tests:

```bash
npm run test:flang    # the language: parser, types, totality, backends, the core and compiler in flang
npm test              # everything: core, tools, flang
```

Every command writes JSON to stdout, diagnostics to stderr, and returns non-zero on failure —
the same contract everywhere, which is what makes it usable from CI, editors and agents. The one
exception is `flang repl`, which talks to a human.

---

## The rest of the repository

- **Library** — `compile`, `validate`, `executeUtility`, `testUtilities`, `generateTypeScript`,
  `certify`, `verifyCertificate`, `pipeline`. No runtime dependencies, no I/O from the library
  API. The interchange format is [`schema/document.schema.json`](schema/document.schema.json);
  the `./browser` entrypoint gives parsing, validation and visualization without Node.js
  cryptography, so strict certificate decisions stay on the server.
- **[`tools/ftsc`](tools/ftsc/README.md)** — the project compiler: trees of `.fts` modules,
  checked functors between categories, code generation for eight languages (C, Rust, C#, Java,
  Elixir, Go, Python, TypeScript).
- **[`tools/ftsvm`](tools/ftsvm/README.md)** — executes utilities from the `ftsc` IR by
  interpretation or by JIT to JavaScript.
- **[`tools/ftspec`](tools/ftspec/README.md)** — finds conflicts between specifications,
  constitution invariants and recorded decisions, before implementation starts.
- Six more tools in [`tools/`](tools), each with its own README, and the read-only MCP server
  `fts-mcp` over stdio — see [Agent integration](docs/agents.md).
- **Editors** — syntax highlighting for `.fts` (Vim, VS Code, tree-sitter, Chroma, Linguist) in
  [`editors/`](editors/README.md), and the `.flang` language server in
  [`editors/flang-lsp`](editors/flang-lsp/README.md).
- **Benchmarks** — `npm run benchmark` (`benchmark:quick` for a short run); the harness and a
  checked-in Apple M1 Max baseline are in [`benchmarks/`](benchmarks/README.md).

Further reading — in English: [Architecture](docs/architecture.md) ·
[Adoption](docs/adoption.md) · [Agents](docs/agents.md).
In Russian (the language surface is Russian, and so is most of the prose):
[Описание языка](docs/overview.ru.md) · [Справочник языка](docs/language.ru.md) ·
[Как это работает](docs/how-it-works.ru.md) ·
[Исполняемые утилиты](docs/executable-utilities.ru.md) ·
[Прикладные примеры](docs/examples.ru.md) · [Раскладка проекта](docs/project-layout.ru.md) ·
[Зачем нужен FTS и как его интегрировать](docs/why-and-integration.ru.md) ·
[flang SPEC](flang/SPEC.md) · [core-in-flang contract](flang/core/SPEC.md) ·
[self-hosting contract](flang/self/SPEC.md) · [category contract](flang/cat/SPEC.md) ·
[concurrency contract](flang/conc/SPEC.md).

The documentation naming rule: an `.md` file with no language suffix is English, `X.ru.md` is its
Russian version. The exception is `README.md` and `SPEC.md` next to code — they keep those names
in whichever language they are written, because GitHub shows them as a directory's front page.

---

## Known limits

Stated plainly, because a project with undrawn borders is not one you can rely on. The same line
is drawn in [`docs/overview.ru.md`](docs/overview.ru.md); the full lists are in
[`flang/SPEC.md`](flang/SPEC.md) §10 and the "Долги" sections of the contracts.

**Proven versus checked.** The distinction matters and the words sound alike, so:

- *proven* — statements about **all** inputs, established by the compiler: termination
  (`тотальная`), types and exhaustiveness of `разбор`, composition and chain wiring, and the
  three functor laws;
- *checked* — statements about a **finite** set: utility properties, declared examples,
  concurrency runs, and the agreement between the interpreter and the eight backends. "Checked on
  N inputs" is not "proven", and this page does not use one word for the other.

Extending what is proven is possible — conditions that fit linear arithmetic are decidable — but
attaching a solver to the verification conditions is an open task, not a feature.

**The language.**

- Functions are first-class values in the language, and they print to all eight targets. The
  restriction was lifted by defunctionalization (Reynolds, 1972): a function value is a tag,
  `функция «Удвоить»`, and an application `ф от 5` is a dispatcher over a finite list of tags — so
  targets without closures and the termination proof both survive (`flang/cat/HOF.md`). The
  lowering is ONE pass before printing (`flang/src/defunc.mjs`): each backend receives a
  first-order program, so none of the eight sees higher order at all. The printed code is built
  with real toolchains and checked against the interpreter over a grid of inputs. What is still
  missing is self-application: `self/` does not know the new form, so the repository's own
  programs (`stdlib`, `examples`) do not use it.
- Effects are described, not performed — and this works: `вариант «Прочитать файл» с путь
  равным …` builds a value, and the host executes it (`flang io`, `flang/src/host/node.mjs`).
  There are five orders — read a file, write a file, make a network request, read the clock,
  draw a random number — and the set is closed. There is no I/O monad, though, and the reason is
  no longer polymorphism: parametric types are in the language, in self-application and in the
  standard library (`«Возможно» от «А»` in `flang/stdlib/optional.flang`). What is missing is the
  category layer: `checkFunctors` knows a type's name, not its application — phase 3 in
  `flang/cat/POLY.md`. Until then, sequencing is expressed by a continuation machine where the
  continuation is a declared value rather than a hidden closure; how that differs from a monad is
  in `flang/cat/SPEC.md`. The execution layer exists for one target out of eight (Node); emitting
  a program with a plan works for all eight.
- An array is read by index in constant time (`элемент N в СПИСОК`, seven targets out of eight), and
  a dictionary comes in two kinds: a list of pairs with linear lookup (`dictionary.flang`) and a
  search tree whose priority is the hash of the key, O(log n) (`tree.flang`). What is missing is
  WRITING by index: values are immutable, and "the list with its Nth replaced" would have to be
  rebuilt whole. Until that exists, table-driven dynamic programming (Coin Change, Edit Distance)
  does not transfer and a constant-time hash table cannot be built. No bitwise operations either.
- The totality analysis INFERS structural decrease and a numeric measure with a CONSTANT step —
  either a literal (`н минус 1`) or a parameter that arrives in the call unchanged and is strictly
  positive (`н минус ш` under `если ш не больше 0`). Where the step CHANGES from turn to turn there
  is nothing to infer it from, so the author NAMES the measure — a `убывает <expression>` line.
  That is how binary search (`убывает верх минус низ плюс 1`), Euclid (`убывает б`) and counting up
  (`убывает предел минус н`) are written; they no longer need a "fuel" list — see
  `flang/examples/measure/`. Decrease with a floor is not enough: 1, ½, ¼ … stays above zero
  forever, so the guard on a declared measure checks three things at once — strict decrease,
  non-negativity and WHOLENESS. The constant-step measure is propped up by the same guard for a
  different reason: flang numbers are IEEE-754 doubles and `x минус 1` equals x for large |x|. No
  decrease means a `FLANG_MEASURE` refusal — identical in the interpreter and in all eight targets
  — not a hang.
- A variant named like a keyword (`Да`, `Плюс`, `Больше`) is not matched in patterns, and the
  diagnostic blames the pattern instead of naming the real cause. Workaround: rename it, or use
  the explicit `случай вариант «Имя»` form the stdlib uses.

**The category surface.** Morphisms, composition, chains, identities, functors, bifunctors,
isomorphisms, monoids, groups and monads are implemented; a monad also comes with the binding form
`в монаде`. Set relations are said with two words: `вложение` is a subobject (an arrow that glues
nothing together), `пересечение` is a pullback over the ambient set. The shape of both is proved by
matching declarations; injectivity of an embedding is checked on the author's own values and, when
the arrow glues, the message presents the counterexample; non-emptiness of a common part is
confirmed by a witness. Universality of the common part stays the author's assumption, and the
compiler draws no consequences from it ([`flang/cat/SETS.md`](flang/cat/SETS.md)). Union did NOT
become a word: the coproduct is already in the language — it is `тип … вариант …` with exhaustive
`разбор`. An arrow may carry a law: `даёт` names the function, `закон` carries the examples, and
a broken law fails `flang test` naming both the arrow and the law. Isomorphism invertibility is
checked wherever both arrows are named through `даёт`, and stays the author's assumption wherever
at least one is not. The precondition (`требует`) is not implemented: it stands in the contract as
intended, not as done. Natural transformations are specified in
[`flang/cat/SPEC.md`](flang/cat/SPEC.md) and are not implemented. Category names in a functor declaration are a note for the reader, not a
checked claim. A list — and anything recursive, I/O included — cannot be declared a monad today:
the endofunctor map is printed in place, so the parameter must occupy a whole field
([`flang/cat/MONAD.md`](flang/cat/MONAD.md)).

**Concurrency.** All seven steps, but the sixth only halfway. The scheduler in the C runtime is
the checking one: a single thread, interleaving by seed, matching the reference byte for byte;
there is no working thread pool, and its price has been measured on two machines (handing a run to
another thread costs four to fourteen runs, depending on the box). Processes are printed only to Elixir and C, and the other six
targets turn a program with `процесс` into ordinary functions and nothing else. There is no `породить`, so the process set is fixed by
the declarations and there is no dynamic tree as in OTP; a message addressee must be a literal;
there is no distribution. The seed grid checks a finite set of interleavings — a checked claim, not
a proof — and it gives no freedom from deadlock. The measurement was taken on a busy machine (load
average 18–76 with eight cores available), so every time figure in it is an upper bound quoted next to the load
it was taken under; the figures that do not depend on load (interpreter steps, reductions, bytes)
are given separately and repeat run to run.

## Status

`0.x` is the language-design phase. The canonical JSON shape and the diagnostic codes are treated
as compatibility surfaces; syntax may grow through documented proposals.

## License

BSD 2-Clause. The project previously carried Apache-2.0, inherited from the repository it grew
out of rather than chosen; BSD 2-Clause is the deliberate choice. See [LICENSE](LICENSE).
