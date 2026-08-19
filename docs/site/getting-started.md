# Your first program

Five minutes: write a function, check it, run it, read the proof ledger, and emit
the program into C. You need `flang` installed — [how to install
it](install.html).

## Write

Put this in `hello.flang`:

```
module «Hello»

total function «Twice»
  accepts n: number
  returns number
  ensures «the doubled value is at least the original» result is at least n
  example «twice two»
    given n equals 2
    expected 4
  n plus n
```

Five parts, each doing its own job:

- `total` — a promise that the function terminates on every input. The compiler
  **checks** it and refuses the file if it cannot prove it;
- `accepts` / `returns` — types, checked before the run;
- `ensures` — a postcondition about the result. The name in guillemets is
  required: that is how the claim is found in the ledger;
- `example` — an executable example. It is part of the program, not a test on
  the side, and it runs on EVERY check: if it does not hold, `check` answers
  `FLANG_EXAMPLE` with a non-zero exit code, and the compiler refuses to emit
  the program;
- the last line is the body.

### One language, four sets of words

The words above are not the only ones. flang keywords come on **four surfaces —
Russian, English, Esperanto and Chinese** — and that is not four languages and
not a translation: `если`, `if`, `se` and `如果` are the **same word of the
language**, written four ways, and all four parse to **one tree**.

The same line of the Rosetta factorial, taken from four files of the tree:

```
если н не больше 1       то 1    иначе н умножить на («Факториал» от (н минус 1))
if n is at most 1        then 1  else n times («Factorial» of (n minus 1))
se n ne pli granda ol 1  tiam 1  alie n fojoj («Faktorialo» de (n minus 1))
如果 n 不大于 1           那么 1   否则 n 乘以 （«阶乘» 的 （n 减 1））
```

Write your file on whichever surface you like — the compiler decides which one
it is by a majority of the keywords in it, not by the first word. There is one
table of words, `SURFACE_TABLE` in `flang/src/lexer.mjs`, and every English word
on this page is taken from its English column; the surface is a column of that
table, never a dialect with its own grammar.

The table is honest about where it is thin: of {{словарь.понятий}} concepts,
{{словарь.наЧетырёх}} are open on all four surfaces and {{словарь.дырявых}} are
not, because a made-up word is worse than a missing one. The gap worth knowing
before you start is the **proof vocabulary** — `requires`, `ensures`, `for all`,
`claim`, `induction on`, `by hypothesis`, `by example`, `by property`,
`therefore proved`, `decreases` — which exists only on the Russian and English
surfaces. A program can be written on all four; a proof, on two — and English is
one of them.

Where else the table is thin, and why each hole is a decision: [Four writing
surfaces](../surfaces.html) (in Russian).

### `«…»` is part of the language, not Russian typography

Names — of modules, functions, examples, claims — are written in guillemets on
**every** surface. They are not quotation marks you may swap for `"` or `'`: the
guillemets are how the parser tells a name you invented from a word of the
language. `«Twice»` stays `«Twice»` in English exactly as `«阶乘»` stays in
guillemets in Chinese.

The one place they come off is the command line, below.

## Check

```bash
flang check hello.flang
```

```
модуль «Hello»: функций 1, из них с доказанным завершением 1; типов 0
hello.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

Exit code 0. Had termination not been provable, it would be exit code 1 and a
diagnostic with a code, a line and a column.

**The answer comes in Russian, and that is not a fault of your file.** The
surfaces are about the words of the language, not about the compiler's own
prose: the prose of a diagnostic is Russian whichever surface you write on, and
choosing otherwise is the owner's decision, not something a fourth column in the
table would settle. What does follow your file is the **quoted word**: an
English file that opens `if` and never gets to `then` gets `FLANG_PARSE` with
the message `у 'if' нет ветки 'then'` — quoting `'if'` and `'then'`, not
`'если'` and `'то'`. A message naming a word that cannot appear in your file
would not merely be untranslated; it would point at the wrong place.

## Run the examples

```bash
flang test hello.flang
```

```
hello.flang: примеров 1, прошло 1, не прошло 0
```

## Run

```bash
flang run hello.flang --function Twice --args '{"n": 21}'
```

```
42
```

The function name here carries **no guillemets**: in a declaration they are part
of the spelling, on the command line they are not.

`--args` takes a JSON object: the key is the parameter name exactly as written
in `accepts`. The binary reads **a flat object of scalars only** in it — a
number, a string, `true`, `false`, `null`. It does not parse a list or a record;
how to pass those is on [Operations](operations.html), the `--args` section.

## The shell

The bare command opens the shell — like `iex` for Elixir, like `python`:

```bash
flang
```

```
flang 0.5.0 — оболочка. «.помощь» — команды, «.выход» или Ctrl-D — конец.
Объявление заканчивается пустой строкой, выражение вычисляется сразу.
» 2 plus 2
4
```

The greeting is Russian; the expression is yours. `2 plus 2` is the English
surface, and the shell reads it exactly as readily as `2 плюс 2`.

The same thing by name is `flang repl`, and that is also how a file is loaded
into the session:

```bash
flang repl hello.flang
```

```
объявлено: тотальная функция «Twice» — завершение доказано
загружено из hello.flang
```

From there you type expressions of the language and get the answer at once:

```
«Twice» of 21
42
```

Guillemets are needed here: this is language text now, not a command-line
argument. `.quit` or Ctrl-D leaves. The shell commands are spelled on two
surfaces as well, and `.help` prints the list, ending it with the line

```
По-английски: .help .list .source .save .load .reset .quit
```

When standard input is not a terminal (`flang < script.flang`, a pipe), the
shell reads it as a script: no prompts, diagnostics to the error stream, and a
non-zero exit code means there was diagnostics.

## What the ledger says

```bash
flang check hello.flang --proof
```

The kernel tries to **prove** the postcondition — to show it holds on every
input, not only on the 2 from the example. About this program it answers:

```
постусловие «the doubled value is at least the original» функции «Twice» —
сетка 1 значение (примеры функции): нарушений НЕ ИСКАЛИ — прогона примеров
не было, посчитано только их число. Это не доказательство — теоремы при
утверждении нет
```

Three words of the ledger, and they are not interchangeable:

| word | what it means |
| --- | --- |
| доказано (proved) | true for **all** inputs |
| сетка N (grid of N) | computed on N values of yours; **this is not a proof** |
| объявлено, не доказано (stated, not proved) | the kernel ran out of rules; the claim is checked at run time |

How to get a claim all the way to "proved" is in the
[tutorial](tutorial.html), the chapter on theorems.

## Emit into C

```bash
flang emit hello.flang --target c --out ./output
make -C ./output
```

Emitting gives **6 files, 266 373 bytes**; `make` builds them in 0.6 s with the
same `cc`, with no warning at all under `-Wall -Wextra -Werror -pedantic`. The
output directory is not created for you.

One trap that bites on the English surface and never on the Russian one: a name
becomes an identifier of the target language, and a collision is refused **by
name** rather than silently renamed. Calling this function `«Double»` does not
emit into C at all —

```
flang emit: печать отказала — имена «Double» и «зарезервировано в целевом языке: double» дают один идентификатор «double» — переименуйте одно из них в модели
```

— and the shell refuses to evaluate a call to it for the same reason. That is
why the function above is `«Twice»`. The refusal names both sides of the
collision, so the fix is one word in the model.

While emitting, the binary states its own boundary: it has no table of declared
types, so the emitted program does not check arguments against declared types.
`flang run` itself does check — in `flang/examples/rosetta/factorial-english.flang`
the function `«Factorial»` is declared over `nat`, and on −3 it answers
`FLANG_TYPE: вызов функции «Factorial»: аргумент «n»: -3 вне нат` with exit
code 1.

## Boundaries of the binary

`check`, `run`, `test`, `repl`, `emit --target c` — that is all it has, and it
names its boundaries itself instead of staying quiet about them:

- **the ledger does not search for violations over examples** — it writes
  "нарушений НЕ ИСКАЛИ" (did not look) where the reference implementation writes
  "нарушений не найдено (искали прогоном)" (looked and found none);
- **the binary does not check laws on a grid** — monoid, monad, isomorphism,
  category, sets and the five declared properties are checked by computation, and
  that layer is not in it. A program declaring one of those gets a refusal
  naming the obstacle, not a green ledger with an empty section;
- **it has one emit target** — `c`. There are eight targets: `c`, `csharp`,
  `elixir`, `go`, `java`, `js`, `python`, `rust`. The other seven stayed with the
  reference implementation;
- **`--args` takes a flat object of scalars only** — the binary does not parse
  `[…]` or `{…}` at all and answers `flang run: «--args» разобрать не удалось —
  ждался плоский объект скаляров, вроде '{"н":10}'` with exit code 2. The
  reference implementation takes a list and a record as ordinary JSON; the binary
  is given a composite value through the shell (`flang repl`). Both ways, with
  runs, are on [Operations](operations.html).

On permitted inputs the binary and the reference answer the same — measured on
the English-surface Rosetta files in the tree: `Factorial(12) = 479001600`,
`Fibonacci(20) = 6765`, `Palindrome("racecar") = true`.

## Next

- [Tutorial](tutorial.html) — from the first function to a claim proved by the kernel
- [Operations](operations.html) — what does what: lists, strings, numbers
- [Proofs: why and how](proofs.html) — the kernel's three answers and zero axioms
- [Four writing surfaces](../surfaces.html) (in Russian) — the same program in
  Russian, English, Esperanto and Chinese, and one tree under all four

### For those developing the language itself

The reference implementation lives in the repository and runs from it. It is
what emits into the other seven targets — into Rust, for example:

```bash
node flang/bin/flang.mjs emit hello.flang --target rust --out ./output-rust
```

Seven files, 126 679 bytes. It also builds this site and computes the number
guards. Someone who merely writes in the language does not need it: everything
above was done by the binary.
