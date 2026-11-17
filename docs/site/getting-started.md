# Your first program

How do you write a function in flang, check it and run it? Four steps: a file,
a check, the tests, a run. You need `flang` installed —
[how to install it](install.html).

## Write

File `hello.flang`:

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

| Part | Familiar name | What the compiler does with it |
| --- | --- | --- |
| `total` | a function that always terminates | proves termination; if it cannot, the file fails the check |
| `accepts` / `returns` | parameter and result types | checks them before anything runs |
| `ensures` | postcondition | tries to prove it for every input; the name in `«…»` is required, messages refer to the postcondition by it |
| `example` | a unit test inside the function | runs it on every check |
| last line | the function body | — |

Names of modules, functions and tests are written in guillemets `«…»`. The
quotes `"` and `'` do not work for names: guillemets are how the compiler
tells your name from a keyword.

## Check

```bash
flang check hello.flang
```

```text
модуль «Hello»: функций 1, из них с доказанным завершением 1; типов 0
hello.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

Exit code 0. The compiler writes its messages in Russian with either keyword
spelling. The first line reads "module «Hello»: 1 function, 1 of them proved to
terminate; 0 types". The second lists five checks that passed — syntax, types,
termination, proofs, tests — and ends with "no errors".

### Why the parameter has the type `nat`

Replace the parameter type with `number` in `hello.flang` and check again:

```bash
flang check hello.flang
```

```text
модуль «Hello»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_BOUND_ON_NAN в файле hello.flang, строка 6, столбец 3: постусловие
«the doubled value is at least the original» функции «Twice» ЛОЖНО, и контрпример назван:
«n» объявлен типом «число», а «не число» живёт в этом типе и стоит ВНЕ ПОРЯДКА
…
hello.flang: не проверено — замечаний 1
```

Exit code 1. The message reads: line 6, column 3, the postcondition is false,
and the counterexample is NaN. The type `number` is a floating-point number and
includes NaN. NaN is neither greater nor less than any number, so the
postcondition fails for it. The type `nat` is an integer from 0 to 2⁵³−1 and
has no NaN. Put `nat` back.

## Run the tests

```bash
flang test hello.flang
```

```text
hello.flang: примеров 1, прошло 1, не прошло 0
```

Exit code 0. The line reads "1 test, 1 passed, 0 failed".

## Run a function

```bash
flang run hello.flang --function Twice --args '{"n": 21}'
```

```text
доказано: утверждений 1
42
```

Exit code 0. The first line reads "proved: 1 postcondition". The second is the
result. When a file has a postcondition without a proof, `run` computes
nothing.

On the command line the function name is written without guillemets. `--args`
takes a JSON object whose keys are the parameter names from the `accepts` line.
Each argument is checked against the declared type before the computation:

```bash
flang run hello.flang --function Twice --args '{"n": -3}'
```

```text
доказано: утверждений 1
FLANG_TYPE: вызов функции «Twice»: аргумент «n»: -3 вне неотрицательное
```

Exit code 1. The second line reads "argument «n»: -3 is outside `nat`". The
function was not computed.

## See what is proved

The `--proof` flag adds a proof report to the check:

```bash
flang check hello.flang --proof
```

The report is long. Two of its entries matter for this program:

```text
…
чем несётся обещание «тотальная»:
  «Twice»  доказано композицией: рекурсии нет, …
…
  постусловие «the doubled value is at least the original» функции «Twice» — доказано по объявленным
типам аргументов: … — утверждение обо ВСЕХ входах, а не о написанных; теоремы при
нём нет и не нужно
…
```

Exit code 0. The first entry is about termination: the function has no
recursion, so it terminates. The second is about the postcondition: it is
proved from the parameter type for all inputs, and the test with 2 is one case.
"Теорема" is a hand-written proof; none was needed here.

What to do when the compiler does not prove a postcondition by itself is shown
in [Your first proof](first-proof.html).

## Code in another language

The command `flang emit hello.flang --target c --out ./out` generates a C
project from the program; `make -C ./out` builds it. There are
{{цели.поАнглийски}} target languages: {{цели.список}}. Step by step:
[Generating C and JavaScript](emit-walkthrough.html).

## Next

- [Your first proof](first-proof.html) — the compiler finds a bug, you fix it
  and write a proof
- [Tutorial](tutorial.html) — the language in order, six chapters with
  exercises
- [Which construct to use when](which-construct.html) — what to write instead
  of enum, Optional, Result, map, filter, reduce
