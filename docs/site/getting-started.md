# Your first program

Five steps: write a file, check it, run its unit tests, run a function,
generate C from it. You need `flang` installed — [how to install it](install.html).

Every output block below is copied from a real run of the current binary. The
commands can be copied one after another.

## Write

Put this in `hello.flang`:

```flang
module «Hello»

total function «Twice»
  accepts n: nat
  returns number
  ensures «the doubled value is at least the original» result is at least n
  example «twice two»
    given n equals 2
    expected 4
  n plus n
```

What each part does:

| Part | Usual name | What the compiler does with it |
| --- | --- | --- |
| `total` | a function that always terminates | proves termination; if it cannot, the file is rejected |
| `accepts` / `returns` | parameter and return types | checks them before anything runs |
| `ensures` | postcondition | the prover tries to prove it for every input. The name in `«…»` is required: the proof report refers to the postcondition by it |
| `example` | a unit test inside the function | runs it on every `check` |
| the last line | the body | — |

Names of modules, functions and examples are always written in guillemets
`«…»`. `"` or `'` do not work instead: the guillemets tell the parser that this
is your name and not a keyword.

The parameter is declared `nat` (non-negative), not `number`, and this matters.
With `accepts n: number` the check fails, because `number` includes "not a
number" (for example, the result of `0 divided by 0`), and that value is neither
greater nor smaller than anything:

```
FLANG_BOUND_ON_NAN в файле hello.flang, строка 6, столбец 3: постусловие
«the doubled value is at least the original» функции «Twice» ЛОЖНО, и
контрпример назван: «n» объявлен типом «число», а «не число» живёт в этом типе
и стоит ВНЕ ПОРЯДКА — оно не больше и не меньше ничего, включая самоё себя.
…
```

The error message offers three fixes. This page uses the first one: declare the
parameter `nat`, so NaN cannot get in. The second is a precondition,
`requires «n is at least zero» n is at least 0`; then every caller must
guarantee it.

## Check

```bash
flang check hello.flang
```

```
модуль «Hello»: функций 1, из них с доказанным завершением 1; типов 0
hello.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

Exit code 0. `check` runs five steps in order: parsing, types, termination, the
prover («ядро» in the output), the unit tests. If any step fails, `emit` will
not generate code either.

The compiler answers in Russian whichever spelling of keywords you use. Words
quoted from your code stay yours: in an English file an error quotes `'if'`,
not `'если'`.

## Run the unit tests

```bash
flang test hello.flang
```

```
hello.flang: примеров 1, прошло 1, не прошло 0
```

One example, one passed, none failed.

## Run

```bash
flang run hello.flang --function Twice --args '{"n": 21}'
```

```
доказано: утверждений 1
42
```

The first line says the one postcondition of the file is proved; `run` refuses
to compute anything while a postcondition is unproved. The second line is the
value.

On the command line the function name is written **without guillemets**.

`--args` takes a JSON object whose keys are the parameter names from
`accepts`. It accepts **only a flat object of scalars**: numbers, strings,
`true`, `false`, `null`. A list is rejected:

```bash
flang run sum.flang --function Sum --args '{"items": [1,2,3]}'
```

```
flang run: «--args» разобрать не удалось — ждался плоский объект скаляров, вроде '{"н":10}'
```

Exit code 2. How to pass a list or a record: [Operations](operations.html),
the `--args` section.

`flang run` checks argument types. `«Factorial»` is declared over `nat`; called
with −3 it answers, with exit code 1:

```
FLANG_TYPE: вызов функции «Factorial»: аргумент «n»: -3 вне неотрицательное
```

## Read the proof report

```bash
flang check hello.flang --proof
```

The prover tries to show that the postcondition holds for every input, not
only for the 2 from the example. For this program the report says:

```
чем несётся обещание «тотальная»:
  «Twice»  доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт

что высказано и чем это несётся:
  постусловие «the doubled value is at least the original» функции «Twice» — доказано по
  объявленным типам аргументов: цель сведена правилом «порядок по построению» — утверждение
  обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
```

The first part: `«Twice»` terminates because it has no recursion and calls only
functions that terminate. The second part: the postcondition is proved from the
parameter type alone — `n` is non-negative, so `n plus n` is at least `n`. You
did not have to write a proof. The last line of the report ends with
`код возврата 0` (exit code 0).

A postcondition can end up in one of three states:

| The report says | What it means |
| --- | --- |
| доказано (proved) | true for **all** inputs |
| сетка N (grid of N) | checked only on your N examples, like unit tests; **there is no proof** |
| объявлено, не доказано (declared, not proved) | the prover could not prove it and there are no examples; the generated code checks it at run time |

How to get a postcondition to "proved": [tutorial](tutorial.html), chapter 6.

## Generate C

```bash
flang emit hello.flang --target c --out ./output
```

```
проверок при работе снято 1: постусловие доказано ядром обо всех входах и
проверено примерами функции — в напечатанный код оно не едет.
напечатано файлов 6, байт 435850, в ./output
аргументы напечатанной программы по типам не проверяются: это ограничение двоичного flang, полная проверка есть в версии для Node
проверено перед печатью — разбор, типы, завершаемость и ядро доказательств.
ПРИМЕРЫ НЕ ПРОГНАНЫ: их считает вычислитель на самом языке, и на самых больших
программах он в предел шагов этого бинарника не укладывается — свяжи с ними
печать, и компилятор перестал бы печатать сам себя. Прогоните их отдельно:
flang test <файл>
```

How to read it:

- The first line: the postcondition is proved, so no runtime check for it goes
  into the C code.
- The second: six files were written to `./output`.
- The third mentions "a version for Node". That message is outdated: there is no
  Node version, and the arguments of the generated program are not
  type-checked anywhere.
- The last lines: `emit` does not run the unit tests. Run `flang test` for that.

The output directory is created for you. The generated code builds with plain
`make`:

```bash
make -C ./output
```

```
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto   -c -o flang_runtime.o flang_runtime.c
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto   -c -o hello.o hello.c
ar rcs libhello.a flang_runtime.o hello.o
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto   -c -o flang_cli.o flang_cli.c
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto -o flang_cli flang_cli.o flang_runtime.o hello.o -lm -lpthread
```

No warnings under `-Wall -Wextra -Werror -pedantic`.

One pitfall: your names become identifiers in the target language, and a
clash is an error, not a silent rename. Call the function `«Double»` and C
generation fails, exit code 1:

```
FLANG_CLI: имена «Double» и «зарезервировано в целевом языке: double» дают один идентификатор «double» — переименуйте одно из них в модели
flang emit: печать отменена — программа не проходит проверку, замечаний 1.
```

The message names both sides of the clash (`double` is a C keyword). Rename the
function and run `emit` again.

## Other target languages

There are {{цели.поАнглийски}} target languages: {{цели.список}}. The command
is the same, only `--target` changes:

```bash
flang emit hello.flang --target rust --out ./output-rust
```

```
напечатано файлов 7, байт 138939, в ./output-rust
…
собрать: cd <каталог> && cargo build, запустить target/debug/flang_cli <модуль>
```

The output directory contains a `Makefile` and a `Cargo.toml`; `cargo build`
builds `target/debug/flang_cli`, which calls the same function.

## Next

- [Tutorial](tutorial.html) — six chapters from your first function to a
  postcondition the prover proves
- [Which construct to use when](which-construct.html) — what to write for a
  task: enum, Optional, Result, map, filter, reduce
- [Operations](operations.html) — standard library functions for lists,
  strings and numbers
