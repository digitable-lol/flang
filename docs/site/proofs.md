# What a proof is in flang

This page answers the question: what does the word «доказано» (proved) in the
compiler output mean, and when do you need it. Five minutes to read.

## A test and a proof

A test checks the inputs you thought of. A proof answers for all inputs at
once. In flang both are written inside the function:

| Line | What it is | In other languages |
| --- | --- | --- |
| `пример` (example) | a test with concrete arguments | a unit test |
| `требует` (requires) | a precondition: what the caller must ensure | `requires` in Dafny |
| `обеспечивает` (ensures) | a postcondition: what holds for the result | `ensures` in Dafny |

File `docs/examples/proofs/discount.flang`:

```flang insert docs/examples/proofs/discount.flang
модуль «Скидка»

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
построению» — утверждение обо ВСЕХ входах, а не о написанных; теоремы при
нём нет и не нужно
```

The test speaks about one input: 100 and 10. The line «доказано» speaks about
any price and any discount not above the price. The compiler found the proof.
All it needed from you was the argument types and the `требует` line.

The part of the compiler that looks for proofs is called the proof kernel, «the
kernel» from here on. It works by a closed list of rules. The kernel has 20
rules. The rule name is in the output: here it is «неотрицательность по
построению» (non-negative by construction).

## Four answers of the compiler

For every postcondition the compiler gives one of four answers:

| In the output | What it means | What to do |
| --- | --- | --- |
| `доказано` | true for all inputs of the declared types | nothing |
| `сетка N` | passed on N tests, no proof | [prove it or keep it as a check](proof-refused.html) |
| `объявлено, не доказано` | neither a proof nor tests | the same |
| `FLANG_PROPERTY … нарушено на входе` | an input was found on which the postcondition is false | fix the code or the postcondition |

With the word «сетка» (grid) the compiler names the answer «checked on tests
only».

The last answer is an error; the file does not pass the check. The same file
without the `требует` line is in `docs/examples/proofs/before/discount.flang`:

```bash
flang check before/discount.flang; echo "код $?"
```

```
FLANG_EXAMPLE: FLANG_PROPERTY: постусловие «в минус не уходим» функции «Цена
со скидкой» нарушено на входе цена = 0, скидка = 1 — посчитано вычислителем на
этом входе
before/discount.flang: не проверено — замечаний 1
код 1
```

The compiler picked the input itself: price 0, discount 1, result −1.

## What changes in the program

A precondition is checked at compile time at every call site. At run time it
is checked once, where data comes in from outside:

```bash
flang run discount.flang --function 'Цена со скидкой' --args '{"цена": 100, "скидка": 130}'
```

```
доказано: утверждений 1
FLANG_PRECONDITION: не выполнено требование «скидка не больше цены» функции «Цена со скидкой»
```

The first line is about the file: its only postcondition is proved. The second
is about this call: the arguments failed the precondition, and the function was
not computed. Exit code 1.

An unproved postcondition is checked on every return from the function.
`flang run` starts a program with such a postcondition only with the key
`--trust`.

A proved postcondition does not get into the generated code if the function has
at least one `пример`. For a function without tests the check stays even for a
proved postcondition.

## When you need a proof

Write a postcondition where a mistake is expensive and the condition is short:

- bounds: a sum is not negative, an index is inside the list, a percentage is at
  most a hundred;
- lengths: the result is as long as the input;
- case analysis: every input has an answer;
- money and counters on exact types: `неотрицательное`, `точное целое`.

Make do with a test where the property is long or the kernel does not derive
it: the order after sorting, properties of floating-point numbers, work with
the outside world.

## What «доказано» does not mean

A proof ties the code to the postcondition. Whether the postcondition describes
the task correctly is for you to decide: a function that always returns 0 also
passes the check «the result is at least 0».

Behind the word «доказано» stand the kernel, the compiler and the C compiler. A
second, independent program repeats part of the proofs. Which part, and where
the check has a known error: [What you are trusting](trust.html).

flang does not replace Lean or Coq. It proves pre- and postconditions of
programs; arbitrary theorems are out of its reach. The comparison:
[flang for Lean and Dafny users](flang-for-lean-and-dafny-users.html).

## Next

- [How to read the report](how-proofs-work.html) — every line of the `--proof`
  output.
- [When it is not proved](proof-refused.html) — recipes for each kind of answer.
- [What you are trusting](trust.html) — what stands behind the word «доказано».
