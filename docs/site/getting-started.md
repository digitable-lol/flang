# Your first program

Five steps: write a file, check it, run the examples, run a function, emit the
program into C. You need `flang` installed — [how to install it](install.html).

Every output block below is the answer of a real run. The commands can be copied
one after another.

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

Five parts, each doing its own job:

| part | what it does |
| --- | --- |
| `total` | a promise that the function terminates on every input; the compiler checks it and refuses the file without a proof |
| `accepts` / `returns` | types, checked before the run |
| `ensures` | a postcondition about the result. The name in guillemets is required — that is how the claim is found in the report |
| `example` | an executable example: part of the program, not a test on the side. It runs on every check |
| the last line | the body |

Names — of the module, the function, the example — are written in guillemets
`«…»` on every writing surface. You may not swap them for `"` or `'`: the
guillemets are how the parser tells a name you invented from a word of the
language.

The input is declared `nat`, not `number`, and that is not a detail. Declare
`accepts n: number` and the check refuses, because the type `number` holds "not
a number" (you get it from `0 divided by 0`, for one), and that value compares
to nothing at all:

```
FLANG_BOUND_ON_NAN в файле hello.flang, строка 6, столбец 3: постусловие
«the doubled value is at least the original» функции «Twice» ЛОЖНО, и
контрпример назван: «n» объявлен типом «число», а «не число» живёт в этом типе
и стоит ВНЕ ПОРЯДКА — оно не больше и не меньше ничего, включая самоё себя.
…
```

The refusal names three cures; the one taken here is the first — declare the
input over the segment `nat`. The second is a precondition, `requires «n is at
least zero» n is at least 0`, which the caller pays for.

## Check

```bash
flang check hello.flang
```

```
модуль «Hello»: функций 1, из них с доказанным завершением 1; типов 0
hello.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

Exit code 0. Behind the single word `check` stand five jobs in a row: parsing,
types, termination, the proof kernel, the examples. Stopping at any of them
means there will be no emission: what is not checked is not emitted.

The answer comes in Russian whichever surface you write on. The word quoted back
at you is yours: an English file gets `'if'` in the message, not `'если'`.

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
in `accepts`. It reads **a flat object of scalars** — a number, a string,
`true`, `false`, `null`. A list does not go through it:

```bash
flang run sum.flang --function Sum --args '{"items": [1,2,3]}'
```

```
flang run: «--args» разобрать не удалось — ждался плоский объект скаляров, вроде '{"н":10}'
```

Exit code 2. How to pass a list and a record is on
[Operations](operations.html), the `--args` section.

Argument types `flang run` does check. `«Factorial»` is declared over `nat`, and
on −3 it answers:

```
FLANG_TYPE: вызов функции «Factorial»: аргумент «n»: -3 вне неотрицательное
```

## What the proof report says

```bash
flang check hello.flang --proof
```

The kernel tries to prove the postcondition — to show it holds on every input,
not only on the 2 from the example. About this program it answers:

```
чем несётся обещание «тотальная»:
  «Twice»  доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт

что высказано и чем это несётся:
  постусловие «the doubled value is at least the original» функции «Twice» — сетка
  1 значение (примеры функции): нарушений НЕ ИСКАЛИ — прогона примеров не было,
  посчитано только их число. Это не доказательство — теоремы при утверждении нет
```

Three words of that report, and they are not interchangeable:

| word | what it means |
| --- | --- |
| доказано (proved) | true for **all** inputs |
| сетка N (grid of N) | computed on N values of yours; **this is not a proof** |
| объявлено, не доказано (stated, not proved) | the kernel ran out of rules; the claim is checked at run time |

How to get a claim all the way to "proved" is in the
[tutorial](tutorial.html), chapter 6.

## Emit into C

```bash
flang emit hello.flang --target c --out ./output
```

```
напечатано файлов 6, байт 297283, в ./output
аргументы напечатанной программы по типам не проверяются: это ограничение двоичного flang, полная проверка есть в версии для Node
проверено перед печатью — разбор, типы, завершаемость и ядро доказательств.
ПРИМЕРЫ НЕ ПРОГНАНЫ: их считает вычислитель на самом языке, и на самых больших
программах он в предел шагов этого бинарника не укладывается — свяжи с ними
печать, и компилятор перестал бы печатать сам себя. Прогоните их отдельно:
flang test <файл>
```

The output directory is created for you. What is emitted builds with an ordinary
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

Not one warning under `-Wall -Wextra -Werror -pedantic`.

One trap: a name becomes an identifier of the target language, and a collision
is a refusal rather than a silent rename. Call the function `«Double»` and there
is no emission into C at all:

```
flang emit: печать отказала — имена «Double» и «зарезервировано в целевом языке: double» дают один идентификатор «double» — переименуйте одно из них в модели
```

The refusal names both sides of the collision, so the fix is one word in the
model.

## Emitting into the other targets

There are {{цели.поАнглийски}} emit targets: {{цели.список}}. The command is the
same one:

```bash
flang emit hello.flang --target rust --out ./output-rust
```

```
напечатано файлов 7, байт 134379, в ./output-rust
…
собрать: cd <каталог> && cargo build, запустить target/debug/flang_cli <модуль>
```

Next to the emitted sources lie a `Makefile` and a `Cargo.toml`: `cargo build`
builds it, and the resulting `flang_cli` calls the same function.

## Next

- [Tutorial](tutorial.html) — six chapters from your first function to a claim
  proved by the kernel
- [Operations](operations.html) — what does what: lists, strings, numbers
