# What you are trusting

This page answers one question: how far can you trust the word «доказано»
(proved) in a flang report, and how is it weaker than a proof in Lean 4.

In short:

- flang checks preconditions and postconditions automatically with a closed
  list of rules. Its relatives are Dafny, F\*, Liquid Haskell and SPARK, minus
  the external SMT solver. It is not an interactive theorem prover like Lean or Coq.
- «Доказано» means: the proof kernel derived the postcondition for all inputs
  of the declared types.
- A second, independent program repeats part of what was proved. The rest
  stands on the kernel alone, and the report gives both shares as numbers.
- Release 0.7.40 has a known error with functions that carry the line
  `убывает` (decreases). It is described
  [below](#a-known-error-a-function-with-убывает).

## What «доказано» means

File `docs/examples/proofs/discount.flang`:

```flang insert docs/examples/proofs/discount.flang
модуль «Discount»

тотальная функция «Цена со скидкой»
  принимает цена: неотрицательное, скидка: неотрицательное
  требует «скидка не больше цены» скидка не больше цена
  возвращает число
  обеспечивает «в минус не уходим» результат не меньше 0
  пример «сто минус десять»
    дано цена равно 100
    дано скидка равно 10
    ожидается 90
  цена минус скидка
```

```bash
flang check discount.flang --proof
```

```
постусловие «в минус не уходим» функции «Цена со скидкой» — доказано по
объявленным типам аргументов: цель сведена правилом «неотрицательность по
построению» …
…
discount.flang: независимо, сверщиком, проиграно 1 из 1 доказанных; на слове ядра 0 …
```

The first line: the postcondition holds for any price and any discount not
above the price. The kernel derived it with the rule named «неотрицательность по
построению» (non-negative by construction). The `пример` test took no part in
the derivation.

The second line is about the independent check. It is explained in the section
[«N of M»](#the-line-n-of-m-the-independent-check).

## Whom you have to trust

For «доказано» to be true, four programs must be correct:

| What | What is known about it |
| --- | --- |
| The proof kernel | about 11 thousand lines inside the compiler; proof steps come in 93 kinds, and each kind has a lemma in Lean 4 |
| The flang compiler | parsing, type checking and code generation; covered by tests, no theorems about it |
| The C compiler | an external program (`cc`); flang does not check it |
| The runtime library | written in C by hand; covered by tests |

A kind of step is the short name in the `вывод` lines of the report: `Н3`,
`Разв2`. A Lean lemma says: such a step is correct in a model of the language. The model is
written by people and is simpler than the language. A finite number in it is an
integer; it knows no fractional values. Whether the kernel code matches the step
in the lemma is not proved: tests check that.

## The line «N of M»: the independent check

`flang check --proof` writes every proof down step by step. A separate program,
`checker`, written in C with no code shared with the compiler, reads the record.
It takes the source and the record and repeats the steps itself.

The result is in the next-to-last line of the report. Look for the word
«независимо» (independently) and a pair of numbers:

```
discount.flang: независимо, сверщиком, проиграно 1 из 1 доказанных; на слове ядра 0 …
```

The second number, M, is how many postconditions the kernel called proved. The
first, N, is how many of them `checker` repeated on its own. «Сверщик» in this
line is the `checker` program; «на слове ядра» means accepted without a
re-check. The remaining M − N stand on the kernel alone.

Not everything is repeated. The file `docs/examples/proofs/largest.flang` has
three proved statements, and none is repeated:

```flang insert docs/examples/proofs/largest.flang
модуль «Largest»

тотальная функция «Наибольшее»
  принимает а: точное целое, б: точное целое
  возвращает точное целое
  обеспечивает «не меньше первого» результат не меньше а
  обеспечивает «не меньше второго» результат не меньше б
  если а больше б
    то а
    иначе б

утверждение «наибольшее перестановочно»
  для всех а: точное целое и б: точное целое
  утверждаем («Наибольшее» от а и б) равен («Наибольшее» от б и а)
```

```
largest.flang: независимо, сверщиком, проиграно 0 из 3 доказанных; на слове ядра 3 …
```

Nothing is wrong with the program: `checker` cannot yet repeat every kernel
rule. On the set of 60 tasks used to compare flang with Lean, the kernel proved
55 statements, and `checker` repeated 30 of them.

What to do with this number:

- N equals M: two different programs confirmed the proof;
- N is less than M: some postconditions have one confirmation only. For
  critical code, keep tests for those postconditions.

How to run `checker` by hand and see its answer for each postcondition:
[The proof record](record-format.html).

## Who checks the checkers

Two programs, written apart, read the proof record:

| Program | What is proved about it | What else checks it |
| --- | --- | --- |
| `checker` in C | no theorems | 833 deliberately corrupted records: none accepted |
| the second one, in Lean 4 | a theorem for 45 of the 52 paths by which it accepts a record | its answers are compared with `checker` on the same records |

The seven paths without a theorem include linear arithmetic and the arithmetic
of exact integers.

There are no theorems about the kernel itself. It rests on the lemmas about the
steps, on tests, and on a set of corrupted proofs it must reject.

## A known error: a function with `убывает`

The line `убывает` names an expression that gets smaller on every recursive
call. Sometimes the kernel cannot derive that it really does. Then the
termination of the function is accepted without proof, and a run-time check is
added to the code.

In the file `docs/examples/proofs/termination.flang` the last function is one:

```flang insert docs/examples/proofs/termination.flang
модуль «Termination»

тотальная функция «Вдвое»
  принимает х: число
  возвращает число
  х умножить на 2

тотальная функция «Сумма списка»
  принимает ряд: список числа
  возвращает число
  разбор ряд
    случай пусто
      то 0
    случай голова первый и хвост остальные
      первый плюс («Сумма списка» от остальные)

тотальная функция «Отсчёт»
  принимает н: неотрицательное
  возвращает число
  если н не больше 0
    то 0
    иначе 1 плюс («Отсчёт» от (н минус 1))

тотальная функция «Отсчёт дробного»
  принимает н: число
  возвращает число
  если н не больше 0
    то 0
    иначе 1 плюс («Отсчёт дробного» от (н минус 1))

тотальная функция «Шагов до края»
  принимает место: число, край: число
  возвращает число
  убывает край минус место
  если место не меньше край
    то 0
    иначе 1 плюс («Шагов до края» от (место плюс 1) и край)
```

```bash
flang check termination.flang --proof
```

```
«Шагов до края»  доказано объявленной мерой: убывает «край» минус «место»;
спуск ядром не выведен — на веру: мера объявлена автором, сторож считает её при
работе на каждом витке — 1 место
```

The sign is the words «спуск ядром не выведен — на веру» (the kernel did not
derive the descent — taken on faith). They mean: termination is accepted without
proof. The word `сторож` here is the run-time check.

On ordinary numbers this function terminates. On NaN it does not: a comparison
with NaN is always false, and the run-time check stops it. That is by design.

The error is elsewhere. In release 0.7.40 the kernel uses the postconditions of
such a function as proved facts. If the function does not in fact terminate, a
false statement can be derived from its postconditions, and the report says
«доказано» about it.

A rule for reading the report:

- if a function shows «спуск ядром не выведен», everything proved with its help
  is true on the condition that the function terminates;
- check the termination of such a function yourself: by tests or by reasoning;
- in our checks `checker` did not repeat the false conclusion: it stayed among
  the M − N.

The run-time check stops a non-terminating function on the very first repeat.
But by then the report has already been issued.

You cannot declare an axiom in flang: the language has no such construct. Apart
from the one above, there are two assumptions. The key `--trust` runs a program
with unproved postconditions and says so in the first line of output. A mapping
between categories that has no implementation is checked by nothing. The report
lists such declarations in the section «принято на веру» (taken on faith).

## «Not proved» does not mean «false»

The list of rules is closed. A true postcondition with no matching rule stays
unproved. In the file `docs/examples/proofs/insertion-sort.flang` two
postconditions are proved and a third is not:

```flang insert docs/examples/proofs/insertion-sort.flang
модуль «Insertion sort»

тотальная функция «Вставить»
  принимает значение: неотрицательное, элементы: список неотрицательное
  возвращает список неотрицательное
  обеспечивает «вставка удлиняет на один» (длина результат) равен ((длина элементы) плюс 1)
  разбор элементы
    случай пусто
      то [значение]
    случай голова и хвост
      если значение не больше голова
        то приписать значение к элементы
        иначе приписать голова к («Вставить» от значение и хвост)

тотальная функция «Упорядочить»
  принимает элементы: список неотрицательное
  возвращает список неотрицательное
  обеспечивает «сортировка сохраняет длину» (длина результат) равен (длина элементы)
  разбор элементы
    случай пусто
      то пустой список
    случай голова и хвост
      то «Вставить» от голова и («Упорядочить» от хвост)

тотальная функция «Не меньше всех»
  принимает граница: неотрицательное, элементы: список неотрицательное
  возвращает признак
  разбор элементы
    случай пусто
      то да
    случай голова и хвост
      то (граница не больше голова) и притом («Не меньше всех» от граница и хвост)

тотальная функция «По порядку»
  принимает элементы: список неотрицательное
  возвращает признак
  разбор элементы
    случай пусто
      то да
    случай голова и хвост
      то («Не меньше всех» от голова и хвост) и притом («По порядку» от хвост)

утверждение «сортировка упорядочивает»
  для всех а: список неотрицательное
  утверждаем («По порядку» от («Упорядочить» от а)) равен да
```

```bash
flang check insertion-sort.flang --proof; echo "код $?"
```

```
постусловие «вставка удлиняет на один» функции «Вставить» — доказано индукцией по «список» …
постусловие «сортировка сохраняет длину» функции «Упорядочить» — доказано индукцией по «список» …
утверждение «сортировка упорядочивает» — объявлено, не доказано: ни теоремы, ни примеров …
код 3
```

That sorting keeps the length of the list, the kernel derived by itself. That
the result is ordered is true, but the kernel did not derive it. Lean proves
both facts.

On the same set of 60 tasks flang proves 33 by itself. Another 18 are proved
after the programmer rewrites the postcondition or adds a theorem. Nine are not
proved at all. Lean 4 proves all 60. A detailed comparison:
[flang for Lean and Dafny users](flang-for-lean-and-dafny-users.html).

A false postcondition looks different. The compiler searches for an input that
breaks it and shows that input with the code `FLANG_PROPERTY`. How to tell one
from the other: [When it is not proved](proof-refused.html).

## What a proof does not say

A proof ties the code to the postcondition. Whether the postcondition describes
the task correctly is for you to decide. File
`docs/examples/proofs/wrong-largest.flang`:

```flang insert docs/examples/proofs/wrong-largest.flang
модуль «Wrong largest»

тотальная функция «Большее из двух»
  принимает а: неотрицательное, б: неотрицательное
  возвращает число
  обеспечивает «не меньше первого» результат не меньше а
  обеспечивает «не меньше второго» результат не меньше б
  пример «два и три»
    дано а равно 2
    дано б равно 3
    ожидается 5
  а плюс б
```

```bash
flang check wrong-largest.flang --proof --strict; echo "код $?"
```

```
постусловие «не меньше первого» функции «Большее из двух» — доказано …
постусловие «не меньше второго» функции «Большее из двух» — доказано …
код 0
```

Both postconditions are proved, and the function returns the sum. The
postconditions left out the main thing: the result equals one of the arguments.
The test was written for the sum as well.

One way to test a postcondition: replace the function body with a stub, for
example `0`. If the postcondition is still proved, it says nothing about the
function.

## For language developers: where the numbers come from

These commands work in a clone of the repository; an installed `flang` does not
need them. The last three need Lean 4.

| Number on the page | Command |
| --- | --- |
| about 11 thousand lines of kernel | `flang run-script trust:ceiling` |
| 93 kinds of steps, a lemma for each | `flang run-script lean-rules:check` |
| 833 corrupted records, 0 accepted | `flang run-script checker:check` |
| 45 paths of 52 | `flang run-script lean-soundness:check` |
| 33, 18 and 9 tasks of 60 | `flang run-script lean-parity:probe` |
| 30 of 55 | `flang check --proof` on every file of the set `parity/programs` in the proof directory |

## Next

- [How to read the report](how-proofs-work.html) — the other lines of the
  `--proof` output.
- [flang for Lean and Dafny users](flang-for-lean-and-dafny-users.html) — a
  table of differences and one example in three languages.
- [What is proved in flang itself](what-is-proved.html) — numbers for the
  compiler and the standard library.
