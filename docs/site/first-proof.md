# Your first proof

How do you prove that a function is correct on every input? In ten minutes you
will write a function, let the compiler find a bug in it, fix the bug and write
a proof. You need `flang` installed ([Installation](install.html)).

If you know Dafny or SPARK: `требует` and `обеспечивает` work like `requires`
and `ensures`. If you know Lean or Coq: a `теорема` is a proof written step by
step, and the compiler checks each step; there are no tactics and no search.

The code on this page uses the Russian keyword spelling. The compiler writes
its messages in Russian, and each one is translated under its block.

| Russian keyword | English spelling |
| --- | --- |
| `модуль`, `тотальная функция` | `module`, `total function` |
| `принимает`, `возвращает` | `accepts`, `returns` |
| `требует`, `обеспечивает` | `requires`, `ensures` |
| `пример`, `дано`, `ожидается` | `example`, `given`, `expected` |
| `разбор`, `случай`, `то` | `match`, `case`, `then` |
| `теорема`, `утверждаем`, `индукция по` | `theorem`, `claim`, `induction on` |
| `по предположению`, `следовательно доказано` | `by hypothesis`, `therefore proved` |

## 1. A function and a postcondition

File `change.flang`:

```flang refused
модуль «Касса»

тотальная функция «Сдача»
  принимает внесено: неотрицательное, цена: неотрицательное
  возвращает число
  обеспечивает «сдача не отрицательна» результат не меньше 0
  пример «сто за девяносто»
    дано внесено равно 100
    дано цена равно 90
    ожидается 10
  внесено минус цена
```

The module is «Till» and the function is «Change»: it takes `внесено` (paid)
and `цена` (price). Three things here are new:

| Line | What it is | In other languages |
| --- | --- | --- |
| `обеспечивает «name» condition` | a postcondition: what holds for the result for any arguments. Here: the result is at least 0 | `ensures` in Dafny |
| `пример` | a test written inside the function | a unit test |
| `неотрицательное` | a type: an integer from 0 to 2⁵³−1 (`nat` in the English spelling) | `nat` in Lean |

The test passes: 100 − 90 = 10. Check the file:

```bash
flang check change.flang
```

The compiler answers:

```text
модуль «Касса»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_EXAMPLE: FLANG_PROPERTY: постусловие «сдача не отрицательна» функции «Сдача»
нарушено на входе внесено = 0, цена = 1 — посчитано вычислителем на этом входе
change.flang: не проверено — замечаний 1
```

Exit code 1. The test passed, but the compiler itself found an input on which
the postcondition is false. The second and third lines read: postcondition
«change is not negative» of function «Change» is violated on the input paid = 0,
price = 1 — computed by the evaluator on this input. The evaluator is the
interpreter inside the compiler. The last line reads "not checked — 1 error".

## 2. A precondition

The function makes sense only when the money is enough. The line `требует`
after the line `принимает` says so. The whole file `change.flang`:

```flang
модуль «Касса»

тотальная функция «Сдача»
  принимает внесено: неотрицательное, цена: неотрицательное
  требует «денег хватает» цена не больше внесено
  возвращает число
  обеспечивает «сдача не отрицательна» результат не меньше 0
  пример «сто за девяносто»
    дано внесено равно 100
    дано цена равно 90
    ожидается 10
  внесено минус цена
```

`требует` is a precondition (`requires` in Dafny): a condition on the arguments
that the caller must meet. Here: price is at most paid. Check again with the
`--proof` flag. It adds a proof report:

```bash
flang check change.flang --proof
```

The report is long. One entry matters now:

```text
…
  постусловие «сдача не отрицательна» функции «Сдача» — доказано по объявленным
типам аргументов: … — утверждение обо ВСЕХ входах, а не о написанных; теоремы при
нём нет и не нужно
…
```

Exit code 0. The entry reads: postcondition «change is not negative» of
function «Change» — proved from the declared argument types … a statement about
all inputs, not only the written ones; there is no theorem and none is needed.
"Proved" covers every pair of arguments that meets the precondition; 100 and 90
from the test are one case. The compiler found the proof itself. A theorem is a
hand-written proof; step 4 gets to it.

The precondition is also checked at run time:

```bash
flang run change.flang --function Сдача --args '{"внесено": 50, "цена": 90}'
```

```text
доказано: утверждений 1
FLANG_PRECONDITION: не выполнено требование «денег хватает» функции «Сдача»
```

Exit code 1. The first line is about the file: "proved: 1 postcondition". The
second is about this call: the precondition «enough money» of function «Change»
is not met, and the function was not computed.

## 3. The compiler could not do it alone

The next function is recursive. File `total.flang`:

```flang
модуль «Касса»

тотальная функция «Итог»
  принимает цены: список неотрицательное, доставка: число
  требует «доставка не отрицательна» доставка не меньше 0
  возвращает число
  обеспечивает «итог не отрицателен» результат не меньше 0
  пример «две покупки и доставка»
    дано цены равно [100, 50]
    дано доставка равно 30
    ожидается 180
  разбор цены
    случай пусто
      то доставка
    случай голова и хвост
      то голова плюс («Итог» от хвост и доставка)
```

«Total» takes a list of prices (`цены`) and a shipping cost (`доставка`).
`разбор` is pattern matching (`match`). An empty list gives the shipping cost,
a non-empty one gives the first price plus the total of the rest.

```bash
flang check total.flang --proof
```

The compiler answers:

```text
…
  постусловие «итог не отрицателен» функции «Итог» — сетка 1 значение (примеры
функции): нарушений на них нет: … Это не доказательство — теоремы при утверждении нет
…
```

Exit code 3. The entry reads: postcondition «total is not negative» of function
«Total» — grid of 1 value (the function's tests): no violations on them … This
is not a proof — there is no theorem for the statement. "Сетка" (grid) is the
compiler's word for "tested only". There is one test, it passed, and nothing is
known about other inputs. Every postcondition gets one of three answers in the
report:

| In the report | What it means | What happens at run time |
| --- | --- | --- |
| `доказано` (proved) | true for all inputs | the program has no check |
| `сетка N` (grid N) | passed on N tests, there is no proof | the condition is checked on every call |
| `объявлено, не доказано` (declared, not proved) | no proof and no tests | the condition is checked on every call |

While a file has a postcondition without a proof, `flang run` does not run the
program and returns code 3. The `--trust` flag runs it without the proof.

## 4. A proof by induction

Why the total is not negative is clear to a person:

- the list is empty — the total equals the shipping cost, which is not negative
  by the precondition;
- the list is not empty — the total is the first price plus the total of the
  rest. The first price is not negative by its type. The total of the rest is
  not negative if the statement already holds for the shorter list.

That is induction on the list. Add it to the end of the file. The whole file
`total.flang`:

```flang
модуль «Касса»

тотальная функция «Итог»
  принимает цены: список неотрицательное, доставка: число
  требует «доставка не отрицательна» доставка не меньше 0
  возвращает число
  обеспечивает «итог не отрицателен» результат не меньше 0
  пример «две покупки и доставка»
    дано цены равно [100, 50]
    дано доставка равно 30
    ожидается 180
  разбор цены
    случай пусто
      то доставка
    случай голова и хвост
      то голова плюс («Итог» от хвост и доставка)

теорема «итог не отрицателен»
  дано цены: список неотрицательное
  дано доставка: число
  утверждаем результат не меньше 0
  индукция по цены
    случай пусто
      то по предположению
    случай голова и хвост
      то по предположению
  следовательно доказано
```

How to read the theorem:

- the name of the theorem equals the name of the postcondition — that is how
  the compiler links them;
- `дано` (given) repeats the parameters of the function, `утверждаем` (claim)
  repeats the condition from `обеспечивает`;
- `индукция по цены` (induction on the prices) goes through the same two cases
  as `разбор` in the function;
- `по предположению` (by hypothesis) reads "follows from what is already
  known". In the first case that is the precondition, in the second the
  statement for the tail.

```bash
flang check total.flang --proof
```

```text
…
  постусловие «итог не отрицателен» функции «Итог» — доказано индукцией по
«список»: база 1 случай, шаг при допущении на частях (1 случай), … — утверждение
обо ВСЕХ входах типа «список», а не о написанных
…
```

Exit code 0. The entry reads: proved by induction on «list»: base 1 case, step
under the assumption on the parts (1 case) … a statement about all inputs of
type «list». The base is the empty list. The step is the non-empty list, where
the statement is assumed for the tail.

The program runs:

```bash
flang run total.flang --function Итог --args '{"цены": [100, 50], "доставка": 30}'
```

```text
доказано: утверждений 1
180
```

## 5. A wrong proof does not pass

The compiler checks every step of a theorem. Delete the line `требует` from
`total.flang`, keep the theorem and check again:

```bash
flang check total.flang --proof
```

The compiler answers:

```text
FLANG_PROOF_INDUCTION_STEP в файле total.flang, строка 23, столбец 10: шаг 1,
база «пусто» теоремы «итог не отрицателен»: «по предположению» стоит в базе
«пусто», где предположения индукции нет: … а предусловий у функции не объявлено
ни одного. …
…
```

Exit code 1. The message reads: line 23, column 10, step 1, base «empty» of
theorem «total is not negative»: "by hypothesis" stands in the base, where
there is no induction hypothesis … and the function declares no preconditions.
Without the precondition the first case has nothing to rely on: the shipping
cost may be negative. A file with errors gets no proof report.

## What you can do now

- write a postcondition (`обеспечивает`) and a precondition (`требует`);
- tell "proved" from "tested only" in the report;
- write a proof by induction when the compiler did not find one itself.

## What a proof does not give you

A proof says that the code meets the postcondition. Whether the postcondition
describes the task correctly is up to you. A function that always returns 0
would also pass the check `результат не меньше 0`.

A second program, `checker`, re-checks the proofs. It is written separately
from the compiler and ships with the prebuilt builds. Its answer is the line
before the last in the `--proof` report. For `change.flang` from step 2 and
`total.flang` from step 4:

```text
change.flang: независимо, сверщиком, проиграно 1 из 1 доказанных; на слове ядра 0 — код сверщика 0
total.flang: независимо, сверщиком, проиграно 0 из 1 доказанных; на слове ядра 1 — код сверщика 3
```

The first line reads "independently, by the checker, replayed 1 of 1 proved; 0
taken on the compiler's word": the checker repeated the proof and agreed. The
second reads "replayed 0 of 1; 1 taken on the compiler's word": that proof is
accepted without a re-check, because `checker` does not replay every proof by
induction yet. This line does not change the exit code of `flang check`.

With the English keyword spelling step 1 gives a different answer: the compiler
does not search for a counterexample there and reports the postcondition as
tested only.

## Next

- [How to read the proof report](how-proofs-work.html) — the other entries of
  the `--proof` output.
- [Theorems step by step](manual-proofs.html) — induction on a number and on
  your own type, a reference to the postcondition of another function.
- [The compiler rejected a proof](proof-refused.html) — what each
  `FLANG_PROOF_…` message means and how to fix it.
