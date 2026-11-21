# Theorems step by step

This page answers the question: how to write a proof yourself when the compiler
did not find one without a hint. There are five recipes, one per kind of
theorem. The files are in `docs/examples/proofs`; all pass `flang check`.

A theorem in flang is a record of steps that the kernel checks one by one.
There are no tactics and no search, unlike Lean or Coq.

## The skeleton of a theorem

```flang fragment
теорема «имя постусловия»
  дано параметр: тип
  утверждаем то же, что после имени в обеспечивает
  обоснование
  следовательно доказано
```

- the theorem's name equals the postcondition's name: that is how they are tied;
- `дано` (given) lists the function's parameters with the same types;
- `утверждаем` (we claim) repeats the condition from `обеспечивает` word for word.

There are three kinds of justification:

| Justification | When to take it |
| --- | --- |
| `индукция по` with `по предположению` or `по примеру` | the function walks its argument with a `разбор` |
| `по свойству «имя»` | the function calls another one whose needed postcondition is proved |
| steps `затем … по закону «правило» из …` | a chain of facts is needed |

## 1. Induction over your own type

The function computes the height of a stack from a given bottom. The theorem
runs an induction over the stack; its cases repeat the cases of the `разбор`.
File `stack-height.flang`:

```flang insert docs/examples/proofs/stack-height.flang
модуль «Stack height»

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

```bash
flang check stack-height.flang --proof
```

```
постусловие «высота от дна неотрицательна» функции «Высота от дна» — доказано
индукцией по «Стопка»: база 1 случай, шаг при допущении на частях (1 случай) …
постусловие «высота неотрицательна» функции «Высота» — доказано: терм принят
ядром, 1 шаг, … основания: постусловие «высота от дна неотрицательна» …
```

In the empty stack the result equals the bottom, and `по предположению` (by
assumption) takes the precondition. In a link the result is one more than the
height of the tail, and `по предположению` takes the same statement for the tail.

Induction runs over a type with variants, a list, a string and
`неотрицательное`. For `неотрицательное` you write `индукция по н убывает н`,
and the function must call itself on `н минус 1`. There is no induction over
`число`.

If a case covers a single value and the function has a test with that value,
you can refer to it: `то по примеру «пустая от нуля»`.

## 2. Referring to a proved postcondition

The second function in the same file, «Высота», calls the first. Its theorem
takes one line: `по свойству «высота от дна неотрицательна»`.

`по свойству` (by the property) substitutes the postcondition of the called
function: its parameters are replaced by the call's arguments, the word
`результат` by the call itself. The second output line above names that
postcondition after the word «основания» (grounds).

## 3. A chain of steps

The function returns its first argument. The preconditions say: it is at most
the second, and the second is at most ten. The theorem writes the chain out, one
step per line. File `chain.flang`:

```flang insert docs/examples/proofs/chain.flang
модуль «Through the middle»

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

```bash
flang check chain.flang --proof
```

```
постусловие «результат не больше десяти» функции «Меньшее из пары» — доказано:
терм принят ядром, 4 шага …
```

A step is written `затем факт по закону «правило» из опор`. A support is a line
of the source (`из строки 5`) or the number of an earlier step (`из 1 и 2`). The
last step, without the word `затем`, finishes the proof. There are six rules:

| Rule | What it gives |
| --- | --- |
| `Н1` | a literal is at least zero: `0 не меньше 0` |
| `Н3` | `х не меньше 0` from the line that says so: a precondition or the type `неотрицательное` |
| `Н5` | the sum of two non-negative values is non-negative |
| `О1` | `а не больше б` from the line that says so |
| `О10` | from `а не больше б` and `б не больше в` follows `а не больше в` |
| `Разв2` | puts the function body in place of the word `результат` |

The line number in a support changes when you edit the file above the theorem.
The compiler notices: a step with a wrong line gives the error
`FLANG_PROOF_STEP`.

## 4. A statement without a function

An `утверждение` (statement) speaks about all values of a type and is not tied
to a postcondition. The kernel proves it by itself; a theorem is not always
needed. File `statements.flang`:

```flang insert docs/examples/proofs/statements.flang
модуль «Statements»

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

```bash
flang check statements.flang --proof
```

```
утверждение «удвоение сохраняет длину» — доказано индукцией по «список» …
утверждение «два отображения есть одно» — доказано сведением цели с телом функции:
правило «переписка доказанными равенствами» …
утверждение «порядок транзитивен» — доказано по объявленным типам аргументов …
утверждение «общее слагаемое сохраняет порядок» — доказано по объявленным типам аргументов …
```

All four are proved without a theorem: a property of a recursive function over
a list, the fusion of two `отобразить` (map) into one, two inequalities over
`точное целое`.

The type decides here. The kernel will not prove the same inequalities over
`число`: `число` is binary64, and its addition rounds.

## 5. Laws of a monoid and a monad

Declare a structure, and its laws become statements about all values. File
`maybe-monad.flang`:

```flang insert docs/examples/proofs/maybe-monad.flang
модуль «Maybe monad»

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

```bash
flang check maybe-monad.flang --proof
```

```
закон «Возможно — левая единица» — доказано сведением цели с телом функции …
закон «Возможно — правая единица» — доказано индукцией по «Возможно» …
закон «Возможно — ассоциативность связывания» — доказано индукцией по «Возможно» …
законов утверждениями 3: доказано ядром 3, не доказано 0
```

All three monad laws are proved. For a `моноид` associativity and both
identities are proved the same way when the values have the type `точное
целое`. Over `число` the monoid laws are not proved: binary64 addition is not
associative.

## The order of work

1. Write the postcondition and run `flang check file --proof`.
2. «Доказано»: no theorem is needed.
3. `FLANG_PROPERTY`: the postcondition is false on the input found; fix the code
   or the postcondition.
4. Another answer: first try the recipes on
   [When it is not proved](proof-refused.html), then write a theorem.

The full syntax of a theorem is in the
[Language reference](language.html#theorem).

## Next

- [When it is not proved](proof-refused.html) — recipes without a theorem and
  the `FLANG_PROOF_…` codes.
- [What the kernel can do](what-the-kernel-accepts.html) — which postconditions
  are proved by themselves.
- [What you are trusting](trust.html) — what stands behind the word «доказано».
