# Proving by hand

The kernel — the prover, a part of the compiler — proves most postconditions by
itself. When `flang check --proof` answers «сетка N» (grid of N) or «объявлено,
не доказано» (declared, not proved)
([the three answers](how-proofs-work.html#обеспечивает-the-postcondition-and-the-three-answers)),
you can prove the postcondition with a theorem. The kernel checks every step of
it and searches for nothing by itself. Every program below passes
`flang check`; the reports under them are the output of
`flang {{выпуск.версия}}`.

## The skeleton of a theorem

```flang fragment
теорема «имя постусловия»
  дано параметр: тип
  утверждаем то же, что после имени в обеспечивает
  обоснование
  следовательно доказано
```

That is: `теорема` (theorem) «the postcondition's name», `дано` (given) the
parameters, `утверждаем` (we claim) the postcondition, a justification,
`следовательно доказано` (hence proved). A theorem is tied to its postcondition
by name. `утверждаем` repeats the postcondition word for word, and `дано` lists
the function's parameters with the same types. There are three kinds of
justification:

| Technique | When to take it |
| --- | --- |
| `индукция по` (induction on) + `по предположению` (by the hypothesis) / `по примеру` (by the example) | the function walks its argument with a `разбор` (match) |
| `по свойству «имя»` (by the property) | the function calls another one whose postcondition is already proved |
| steps `затем … по закону «правило» из …` (then … by the law … from …) | you need a chain of facts the kernel does not build by itself |

## Induction

The function computes the height of a stack above a given floor. The floor is
non-negative by the precondition, so the result is too. Without a theorem the
kernel answers «сетка 1 значение». The theorem runs an induction over the
stack, and its cases repeat the cases of the `разбор`:

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
постусловие «высота от дна неотрицательна» функции «Высота от дна» — доказано
индукцией по «Стопка»: база 1 случай, шаг при допущении на частях (1 случай),
правила сведения: цель есть допущение; неотрицательность по построению —
утверждение обо ВСЕХ входах типа «Стопка», а не о написанных
```

"Proved by induction over «Стопка»: 1 base case, 1 step case — a statement
about ALL inputs of the type." In the empty stack the result is the floor
itself, and `по предположению` takes the precondition. In a link the result is
one more than the height of the tail, and `по предположению` takes the same
claim for the tail.

If a case covers a single value (`случай вариант «Пусто»`, `случай пусто`,
`случай 0`) and the function has an example with that value, you may cite it:
`то по примеру «пустая от нуля»`.

Induction runs over a type with variants, over a list and over
`неотрицательное` (non-negative) — then it is written
`индукция по н убывает н`, and the function has to descend by exactly one.
There is no induction over `число` (number). What the kernel answers when the
form is wrong: [The kernel refused](proof-refused.html).

## A property of the called function

Add to the same module a function whose body is a call of «Высота от дна». The
argument takes one line: the callee already has the needed postcondition
proved.

```flang fragment
тотальная функция «Высота»
  принимает стопка: «Стопка»
  возвращает число
  для всех стопка обеспечивает «высота неотрицательна» результат не меньше 0
  пример «у пустой стопки высоты нет»
    дано стопка равно вариант «Пусто»
    ожидается 0
  «Высота от дна» от стопка и 0

теорема «высота неотрицательна»
  дано стопка: «Стопка»
  утверждаем результат не меньше 0
  по свойству «высота от дна неотрицательна»
  следовательно доказано
```

```
постусловие «высота неотрицательна» функции «Высота» — доказано: терм принят
ядром, 1 шаг, правило «цель есть допущение», основания: постусловие «высота от
дна неотрицательна» функции «Высота от дна» — утверждение обо ВСЕХ входах
```

`по свойству` substitutes the callee's postcondition: its parameters become
the call's arguments, `результат` becomes the call itself. With both theorems
`flang check --proof --strict` exits with 0, without them with 3.

## A chain of steps

The function returns its first argument. The preconditions say it is not
greater than the second, and the second is not greater than ten. The kernel
does not assemble this chain by itself; the theorem writes it out one step per
line:

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
постусловие «результат не больше десяти» функции «Меньшее из пары» — доказано:
терм принят ядром, 4 шага — утверждение обо ВСЕХ входах
```

A step is `затем fact по закону «rule» из supports`. A support is a source
line (`из строки 5`: a precondition; `из строки 13`: the body) or the number of
an earlier step (`из 1 и 2`). The last step, without `затем`, closes the goal.
There are six rules:

| Rule | What it gives |
| --- | --- |
| `Н1` | a literal is not less than zero: `0 не меньше 0` |
| `Н3` | `х не меньше 0` from the line that says so: a precondition or the type `неотрицательное` |
| `Н5` | the sum of two non-negatives is non-negative (from two steps) |
| `О1` | `а не больше б` from the line that says so |
| `О10` | from `а не больше б` and `б не больше в`: `а не больше в` |
| `Разв2` | substitutes the function body for `результат` and closes the goal |

The kernel names the step that did not fit. Here step 1 cited line 6 instead
of line 5:

```
FLANG_PROOF_STEP в файле m3.flang, строка 19, столбец 3: теорема «результат не
больше десяти»: шаг 1 (О1, строка 6): О1 — допущение даёт «б не больше 10», а
заключено «а не больше б»
```

## A statement without a function

`утверждение` (statement) is a theorem about all values of a type, not tied to
a postcondition. The kernel proves it by itself, including by induction over a
list:

```flang
модуль «Утверждения»

тотальная функция «Удвоить каждое»
  принимает ряд: список числа
  возвращает список числа
  разбор ряд
    случай пусто
      то пустой список
    случай голова первый и хвост остальные
      то приписать (первый умножить на 2) к («Удвоить каждое» от остальные)

утверждение «удвоение сохраняет длину»
  для всех ряд: список числа
  утверждаем (длина («Удвоить каждое» от ряд)) равен (длина ряд)

утверждение «два отображения есть одно»
  для всех ряд: список числа
  утверждаем ((отобразить (отобразить ряд как э → э плюс 1) как э → э умножить на 2)
    равен (отобразить ряд как э → (э плюс 1) умножить на 2))

утверждение «порядок транзитивен»
  для всех а: точное целое и б: точное целое и ц: точное целое
  утверждаем если а больше б и притом б больше ц то а больше ц иначе да

утверждение «общее слагаемое сохраняет порядок»
  для всех а: точное целое и б: точное целое и ц: точное целое
  утверждаем если а не меньше б то (а плюс ц) не меньше (б плюс ц) иначе да
```

```
$ flang check --proof utverzhdeniya.flang
  утверждение «удвоение сохраняет длину» — доказано индукцией по «список»: база
  1 случай, шаг при допущении на частях (1 случай) …
  утверждение «два отображения есть одно» — доказано … правило «переписка
  доказанными равенствами» … основания: … закон «Слияние отображений» …
  утверждение «порядок транзитивен» — доказано по объявленным типам аргументов …
  утверждение «общее слагаемое сохраняет порядок» — доказано по объявленным
  типам аргументов …
  утверждений 4: доказано 4 (из них индукцией 1) (из них без теоремы 3,
  объявленным типом 2), сетка 0, объявлено, не доказано 0
```

What is proved here:

- a property of a recursive function over a list — by induction over the list;
- the functor laws of the list: two `отобразить` (map) fused into one, and
  `(отобразить а как э → э) равен а`;
- linear inequalities and polynomial equalities over `точное целое` (exact
  integer).

The type matters. The same two inequalities over `число` stay «объявлено, не
доказано»: `число` is a float, and its addition rounds.

## The laws of a monoid and a monad

Declare a structure, and the kernel judges its laws as statements about all
values:

```flang
модуль «Монада может быть»

тип «Возможно» от «А»
  вариант «Ничего»
  вариант «Нечто» содержит значение: «А»

тотальная функция «Обернуть» от «А»
  принимает значение: «А»
  возвращает «Возможно» от «А»
  вариант «Нечто» с значение равным значение

тотальная функция «Сплющить» от «А»
  принимает вложенное: «Возможно» от («Возможно» от «А»)
  возвращает «Возможно» от «А»
  пример «два слоя дают один»
    дано вложенное равно вариант «Нечто» с значение равным (вариант «Нечто» с значение равным 5)
    ожидается вариант «Нечто» с значение равным 5
  пример «пустой внешний слой»
    дано вложенное равно вариант «Ничего»
    ожидается вариант «Ничего»
  разбор вложенное
    случай вариант «Ничего»
      то вариант «Ничего»
    случай вариант «Нечто» с значение как внутри
      то внутри

монада «Возможно» от «А»
  возврат «Обернуть»
  соединение «Сплющить»
```

```
$ flang check --proof monada.flang; echo "exit $?"
  закон «Возможно — левая единица» — доказано сведением цели с телом функции …
  закон «Возможно — правая единица» — доказано индукцией по «Возможно» …
  закон «Возможно — ассоциативность связывания» — доказано индукцией по
  «Возможно»: база 2 случая, шаг при допущении на частях (0 случаев) …
  законов утверждениями 3: доказано ядром 3, не доказано 0
exit 0
```

All three monad laws — left unit, right unit, associativity of bind — are
proved. For a `моноид` (monoid) associativity and both units are proved the
same way over `точное целое`. Over `число` the kernel refuses and names the
reason:

```
закон «Сумма — ассоциативность» — ядром НЕ доказан и доказан не будет: носитель
— двоичное «число» …, где сложение и умножение округляют, сумма не сочетательна
выше 2⁵³, а ноль не нейтрален к минус нулю; объявите носитель «точное целое»
```

"Not proved and will not be: the carrier is the binary `число`, where addition
and multiplication round; declare the carrier `точное целое`."

## When a hand proof is not possible

The six step rules do not cover subtraction. The postcondition
`результат не меньше 0` with the body `ширина минус длина` and the precondition
`ширина не меньше длина` over `число` is true, but neither the kernel nor a
theorem built from these rules proves it. It stays a grid and is checked at run
time after every return; the program still builds. If there must be no check,
change the spelling: declare the parameters `неотрицательное` or state the
postcondition differently —
[What the kernel proves by itself](what-the-kernel-accepts.html).

## The working order

1. Write the postcondition and ask `flang check --proof`.
2. «Доказано» — no theorem is needed.
3. `FLANG_EXAMPLE: FLANG_PROPERTY` — the postcondition is false on the input
   found: fix the function or the postcondition.
4. «Сетка» or «объявлено, не доказано» — first try to
   [rewrite the postcondition](what-the-kernel-accepts.html), then write a
   theorem.
5. The kernel rejected the theorem —
   [The kernel refused: whose mistake is it](proof-refused.html).

The full syntax of a theorem is in the
[Language reference](language.html#theorem).
