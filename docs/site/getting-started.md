# Your first program

Five minutes: write a function, check it, run it, read the proof ledger, and emit
the program into C. You need `flang` installed — [how to install
it](install.html).

## Write

Put this in `hello.flang`:

```
модуль «Привет»

тотальная функция «Удвоить»
  принимает н: число
  возвращает число
  обеспечивает «удвоенное не меньше исходного» результат не меньше н
  пример «дважды два»
    дано н равно 2
    ожидается 4
  н плюс н
```

Five parts, each doing its own job:

- `тотальная` (total) — a promise that the function terminates on every input.
  The compiler **checks** it and refuses the file if it cannot prove it;
- `принимает` / `возвращает` (accepts / returns) — types, checked before the run;
- `обеспечивает` (ensures) — a postcondition about the result. The name in
  guillemets is required: that is how the claim is found in the ledger;
- `пример` (example) — an executable example. It is part of the program, not a
  test on the side;
- the last line is the body.

## Check

```bash
flang check hello.flang
```

```
модуль «Привет»: функций 1, из них с доказанным завершением 1; типов 0
hello.flang: проверено — разбор, типы, завершаемость; замечаний нет
```

Exit code 0. Had termination not been provable, it would be exit code 1 and a
diagnostic with a code, a line and a column.

## Run the examples

```bash
flang test hello.flang
```

```
hello.flang: примеров 1, прошло 1, не прошло 0
```

## Run

```bash
flang run hello.flang --function Удвоить --args '{"н": 21}'
```

```
42
```

The function name here carries **no guillemets**: in a declaration they are part
of the spelling, on the command line they are not.

## The shell

The bare command opens the shell — like `iex` for Elixir, like `python`:

```bash
flang
```

```
flang 0.5.0 — оболочка. «.помощь» — команды, «.выход» или Ctrl-D — конец.
Объявление заканчивается пустой строкой, выражение вычисляется сразу.
» 2 плюс 2
4
```

The same thing by name is `flang repl`, and that is also how a file is loaded
into the session:

```bash
flang repl hello.flang
```

```
объявлено: тотальная функция «Удвоить» — завершение доказано
загружено из hello.flang
```

From there you type expressions of the language and get the answer at once:

```
«Удвоить» от 21
42
```

`.выход` or Ctrl-D leaves. Guillemets are needed here: this is language text
now, not a command-line argument.

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
постусловие «удвоенное не меньше исходного» функции «Удвоить» —
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
flang emit hello.flang --target c --out ./вывод
make -C ./вывод
```

Emitting gives **6 files, 264 365 bytes**; `make` builds them in 0.7 s with the
same `cc`, with no warning at all under `-Wall -Wextra -Werror -pedantic`. The
output directory is not created for you.

While emitting, the binary states its own boundary: it has no table of declared
types, so the emitted program does not check arguments against declared types.
`flang run` itself does check: `Факториал` is declared over `нат`, and on −3 it
answers `FLANG_TYPE: … -3 вне нат` with exit code 1.

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
  reference implementation.

On permitted inputs the binary and the reference answer the same:
`Факториал(12) = 479001600`, `Фибоначчи(20) = 6765`,
`Палиндром("шалаш") = true`.

## Next

- [Tutorial](tutorial.html) — from the first function to a claim proved by the kernel
- [Operations](operations.html) — what does what: lists, strings, numbers
- [Proofs: why and how](proofs.html) — the kernel's three answers and zero axioms

### For those developing the language itself

The reference implementation lives in the repository and runs from it. It is
what emits into the other seven targets — into Rust, for example:

```bash
node flang/bin/flang.mjs emit hello.flang --target rust --out ./вывод-rust
```

Seven files, 126 815 bytes. It also builds this site and computes the number
guards. Someone who merely writes in the language does not need it: everything
above was done by the binary.
