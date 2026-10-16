# Proving by hand

The kernel first tries to prove an `обеспечивает` postcondition on its own. Most
of the time it succeeds and no theorem is needed. This page is about the times
it does not: how to tell that the kernel gave up, which of three techniques to
take, and how to read the refusal when the theorem is wrong. Every program below
passes `flang check`, and the reports under them are compiler output.

## How to tell that the kernel gave up

`flang check` without keys says nothing about postconditions: an unproved
postcondition is not an error, it is checked at run time after every return.
Ask for the proof report:

```bash
flang check file.flang --proof
```

In the section «что высказано и чем это несётся» every postcondition gets one
of four answers:

| Answer | Meaning | What to do |
| --- | --- | --- |
| `доказано …` | holds for every input | nothing |
| `сетка N значений` | checked on the function's examples only | write a theorem |
| `объявлено, не доказано` | neither a proof nor examples | write a theorem |
| `НАРУШЕНО` / `ЛОЖНО` | a counterexample was found | fix the function or the postcondition; do not prove it |

The `--strict` key turns the answer into an exit code: 0 — everything is
proved, 1 — refuted, 3 — something rests on examples or is not proved. It is
the key to put into a build.

## The shape of a theorem

```flang fragment
теорема «имя постусловия»
  дано параметр: тип
  утверждаем то же, что после имени в обеспечивает
  обоснование
  следовательно доказано
```

A theorem attaches to a postcondition **by name**, not by meaning, and the
`утверждаем` line repeats the postcondition word for word. `дано` lists the
function's parameters with the same types. There are three kinds of
justification:

| Technique | When to take it |
| --- | --- |
| `индукция по` + `по предположению` / `по примеру` | the function walks its own type with variants by `разбор` |
| `по свойству «name»` | the function calls another one whose postcondition is already proved |
| steps `затем … по закону «rule» из …` | the argument is a chain of facts the kernel does not build by itself |

## First technique: induction

The function counts the height of a stack from a given floor. The floor is
non-negative by the precondition, so the result is non-negative too.

```flang
модуль «Высота стопки»

тип «Стопка»
  вариант «Пусто»
  вариант «Звено» содержит голова: число, хвост: «Стопка»

тотальная функция «Высота от дна»
  принимает стопка: «Стопка», дно: число
  возвращает число
  требует «дно неотрицательно» дно не меньше 0
  для всех стопка обеспечивает «высота от дна неотрицательна» результат не меньше 0
  пример «пустая от нуля»
    дано стопка равно вариант «Пусто»
    дано дно равно 0
    ожидается 0
  разбор стопка
    случай вариант «Пусто»
      то дно
    случай вариант «Звено» с голова как г и хвост как х
      то («Высота от дна» от х и дно) плюс 1
```

The kernel does not prove it on its own:

```
постусловие «высота от дна неотрицательна» функции «Высота от дна» — сетка 1 значение (примеры функции): нарушений НЕ ИСКАЛИ — прогона примеров не было, посчитано только их число. Это не доказательство — теоремы при утверждении нет
```

The theorem runs induction over the stack. Its cases repeat the cases of the
`разбор` one for one. In an empty stack the result is the floor itself, and the
support is the precondition; in a link the result is one more than the height of
the tail, and the support is the same claim about the tail. Both assumptions are
taken with `по предположению`:

```flang
модуль «Высота стопки»

тип «Стопка»
  вариант «Пусто»
  вариант «Звено» содержит голова: число, хвост: «Стопка»

тотальная функция «Высота от дна»
  принимает стопка: «Стопка», дно: число
  возвращает число
  требует «дно неотрицательно» дно не меньше 0
  для всех стопка обеспечивает «высота от дна неотрицательна» результат не меньше 0
  пример «пустая от нуля»
    дано стопка равно вариант «Пусто»
    дано дно равно 0
    ожидается 0
  разбор стопка
    случай вариант «Пусто»
      то дно
    случай вариант «Звено» с голова как г и хвост как х
      то («Высота от дна» от х и дно) плюс 1

теорема «высота от дна неотрицательна»
  дано стопка: «Стопка»
  дано дно: число
  утверждаем результат не меньше 0
  индукция по стопка
    случай вариант «Пусто»
      то по предположению
    случай вариант «Звено» с голова как г и хвост как х
      то по предположению
  следовательно доказано
```

```
постусловие «высота от дна неотрицательна» функции «Высота от дна» — доказано индукцией по «Стопка»: база 1 случай, шаг при допущении на частях (1 случай), правила сведения: цель есть допущение; неотрицательность по построению — утверждение обо ВСЕХ входах типа «Стопка», а не о написанных
```

When a case covers a single value (`случай вариант «Пусто»`, `случай пусто`,
`случай 0`) and the function has an example with exactly that value, the case
may cite the example instead: `то по примеру «пустая от нуля»`. A case with bound
names cannot: an example is one value, and the case covers infinitely many.

Induction works over a type with variants (your own or a list) and over
`неотрицательное` with a descent of exactly one. There is no induction over
`число` or `целое`: the kernel answers `FLANG_PROOF_INDUCTION_TYPE`.

## Second technique: a property of a called function

Add a function that counts the height from a zero floor:

```flang fragment
тотальная функция «Высота»
  принимает стопка: «Стопка»
  возвращает число
  для всех стопка обеспечивает «высота неотрицательна» результат не меньше 0
  пример «у пустой стопки высоты нет»
    дано стопка равно вариант «Пусто»
    ожидается 0
  «Высота от дна» от стопка и 0
```

The kernel leaves its postcondition on examples as well. The argument is short:
the body is a call of «Высота от дна», whose postcondition is already proved.
That is what the theorem says:

```flang
модуль «Высота стопки»

тип «Стопка»
  вариант «Пусто»
  вариант «Звено» содержит голова: число, хвост: «Стопка»

тотальная функция «Высота от дна»
  принимает стопка: «Стопка», дно: число
  возвращает число
  требует «дно неотрицательно» дно не меньше 0
  для всех стопка обеспечивает «высота от дна неотрицательна» результат не меньше 0
  пример «пустая от нуля»
    дано стопка равно вариант «Пусто»
    дано дно равно 0
    ожидается 0
  разбор стопка
    случай вариант «Пусто»
      то дно
    случай вариант «Звено» с голова как г и хвост как х
      то («Высота от дна» от х и дно) плюс 1

тотальная функция «Высота»
  принимает стопка: «Стопка»
  возвращает число
  для всех стопка обеспечивает «высота неотрицательна» результат не меньше 0
  пример «у пустой стопки высоты нет»
    дано стопка равно вариант «Пусто»
    ожидается 0
  «Высота от дна» от стопка и 0

теорема «высота от дна неотрицательна»
  дано стопка: «Стопка»
  дано дно: число
  утверждаем результат не меньше 0
  индукция по стопка
    случай вариант «Пусто»
      то по предположению
    случай вариант «Звено» с голова как г и хвост как х
      то по предположению
  следовательно доказано

теорема «высота неотрицательна»
  дано стопка: «Стопка»
  утверждаем результат не меньше 0
  по свойству «высота от дна неотрицательна»
  следовательно доказано
```

```
постусловие «высота неотрицательна» функции «Высота» — доказано: терм принят ядром, 1 шаг, правило «цель есть допущение», основания: постусловие «высота от дна неотрицательна» функции «Высота от дна» — утверждение обо ВСЕХ входах
```

`flang check file.flang --proof --strict` answers 0 on this file; without the
two theorems it answers 3.

`по свойству` substitutes the called function's postcondition: its parameters
become the arguments of the call, `результат` becomes the call itself. Citing the
postcondition being proved is a circle, and the kernel names it.

## Third technique: a chain of steps that name their rules

Sometimes the argument is a chain of several facts, and the kernel does not
assemble it by itself. The function returns its first argument; the
preconditions say it is not greater than the second, and the second is not
greater than ten:

```flang
модуль «Через середину»

тотальная функция «Меньшее из пары»
  принимает а: число, б: число
  требует «а не больше б» а не больше б
  требует «б не больше десяти» б не больше 10
  возвращает число
  обеспечивает «результат не больше десяти» результат не больше 10
  пример «три и семь»
    дано а равно 3
    дано б равно 7
    ожидается 3
  а
```

```
постусловие «результат не больше десяти» функции «Меньшее из пары» — сетка 1 значение (примеры функции): нарушений НЕ ИСКАЛИ — прогона примеров не было, посчитано только их число. Это не доказательство — теоремы при утверждении нет
```

The theorem writes the chain one step per line. Every step is `затем fact по
закону «rule» из supports`; a support is a source line (`из строки 5`) or the
number of an earlier step (`из 1 и 2`). The last step, without `затем`, closes
the goal:

```flang
модуль «Через середину»

тотальная функция «Меньшее из пары»
  принимает а: число, б: число
  требует «а не больше б» а не больше б
  требует «б не больше десяти» б не больше 10
  возвращает число
  обеспечивает «результат не больше десяти» результат не больше 10
  пример «три и семь»
    дано а равно 3
    дано б равно 7
    ожидается 3
  а

теорема «результат не больше десяти»
  дано а: число
  дано б: число
  утверждаем результат не больше 10
  затем а не больше б по закону «О1» из строки 5
  затем б не больше 10 по закону «О1» из строки 6
  затем а не больше 10 по закону «О10» из 1 и 2
  по закону «Разв2» из 3 и строки 13
  следовательно доказано
```

```
постусловие «результат не больше десяти» функции «Меньшее из пары» — доказано: терм принят ядром, 4 шага — утверждение обо ВСЕХ входах
```

Lines 5 and 6 are the preconditions, line 13 is the function body. Six rules can
be named in a step:

| Rule | What it gives |
| --- | --- |
| `Н1` | a literal is not below zero: `0 не меньше 0` |
| `Н3` | `х не меньше 0` from the line that says so: a precondition or the type `неотрицательное` |
| `Н5` | the sum of two non-negatives is non-negative (from two steps) |
| `О1` | an order fact `а не больше б` from the line that states it |
| `О10` | through the middle: from `а не больше б` and `б не больше в`, `а не больше в` |
| `Разв2` | substitutes the function body for `результат` and closes the goal |

The kernel checks every step and names the one that does not fit. A step cites
the wrong line:

```
FLANG_PROOF_STEP в файле m3.flang, строка 19, столбец 3: теорема «результат не больше десяти»: шаг 1 (О1, строка 6): О1 — допущение даёт «б не больше 10», а заключено «а не больше б»
```

The supports are swapped:

```
FLANG_PROOF_STEP в файле m4.flang, строка 21, столбец 3: теорема «результат не больше десяти»: шаг 3 (О10, шаг 2 и шаг 1): О10 — середина не сходится: шаг 2 кончается «10», шаг 1 начинается «а»
```

A step that names its rule is worth it for one more reason: the independent
checker (`flang/proof/checker/checker.c`) replays it, while a step without a
name has to be taken on the kernel's word.

Any other rule name is refused, and the message lists the ones that exist:

```
FLANG_PROOF_STEP … правило «чего не бывает» ведомости ядро пока не проверяет; проверяет шесть: Н1, Н3, Н5, О1, О10, Разв2
```

## When it cannot be proved by hand

The six rules do not cover subtraction. The postcondition below holds, but
neither the kernel nor a theorem built from these rules proves it:

```flang
модуль «Дополнение»

тотальная функция «Сколько дополнить»
  принимает ширина: число, длина: число
  требует «ширина конечна» (ширина минус ширина) равно 0
  требует «длина конечна» (длина минус длина) равно 0
  требует «ширина не меньше длины» ширина не меньше длина
  обеспечивает «дополнение неотрицательно» результат не меньше 0
  пример «ровно по ширине»
    дано ширина равно 5
    дано длина равно 5
    ожидается 0
  пример «дописать три»
    дано ширина равно 8
    дано длина равно 5
    ожидается 3
  ширина минус длина
```

Such a postcondition stays on examples and is checked at run time after every
return. That is an honest outcome, not an error: the program builds, and the
check sits in the generated code. If the run-time check must go, look for
another way to write it: make the parameter `неотрицательное`, move the
subtraction into a function with a proved postcondition, or state the promise
differently. Which shapes of postcondition the kernel takes on its own is on the
page [What postconditions the prover proves](what-the-kernel-accepts.html).

## The order of work

1. Write the postcondition and ask `flang check --proof`.
2. `доказано` — stop, no theorem is needed.
3. `НАРУШЕНО` or `ЛОЖНО` — fix the function or the postcondition.
4. Examples only, or «объявлено, не доказано» — write a theorem: induction if
   the function goes by `разбор`; `по свойству` if the body calls a function with
   a proved postcondition; steps with rules if the argument is a chain of facts.
5. A refusal from the kernel — read the tail of the message; what each code
   means is on the page [The kernel refused: whose mistake is it](proof-refused.html).

The full syntax of a theorem is in the [Language reference](language.html#theorem).
