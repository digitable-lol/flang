# When it is not proved

This page answers the question: what to do when the compiler did not write
«доказано» (proved). Find your case in the table and go to the recipe. Each
recipe has two files: before the change and after.

| What you see | Recipe |
| --- | --- |
| `FLANG_PROPERTY … нарушено на входе` | [1. The postcondition is false](#1-the-postcondition-is-false-add-a-precondition) |
| `FLANG_PRECONDITION_CALL` | [2. A call does not pass the precondition](#2-a-call-does-not-pass-the-precondition) |
| `сетка N` on a recursive function | [3. A theorem by induction](#3-a-recursive-function-a-theorem-by-induction) |
| `объявлено, не доказано` over the type `число` | [4. An exact type](#4-a-floating-point-number-take-an-exact-type) |
| a property where the function is called twice is not proved | [5. The property as a postcondition](#5-a-property-about-two-calls-write-it-as-a-postcondition) |
| `FLANG_PROOF_…` | [6. The compiler did not accept the theorem](#6-the-compiler-did-not-accept-the-theorem) |
| nothing fits | [7. Keep the check](#7-nothing-fits-keep-the-check) |

With the word «сетка» (grid) the compiler names the answer «checked on tests
only». All files are in `docs/examples/proofs`; run the commands from there.

## First check that the postcondition is true

«Not proved» has two causes: the kernel has no matching rule, or the
postcondition is false. They look the same in the report. Before rewriting
code, test the postcondition at the edges: `0`, `−0`, infinity, NaN, 2⁵³, the
empty string, the empty list.

## 1. The postcondition is false: add a precondition

Before, `before/discount.flang`:

```flang refused insert docs/examples/proofs/before/discount.flang
модуль «Скидка без предусловия»

тотальная функция «Цена со скидкой»
  принимает цена: неотрицательное, скидка: неотрицательное
  возвращает число
  обеспечивает «в минус не уходим» результат не меньше 0
  пример «сто минус десять»
    дано цена равно 100
    дано скидка равно 10
    ожидается 90
  цена минус скидка
```

```bash
flang check before/discount.flang; echo "код $?"
```

```
FLANG_EXAMPLE: FLANG_PROPERTY: постусловие «в минус не уходим» функции «Цена
со скидкой» нарушено на входе цена = 0, скидка = 1 — посчитано вычислителем на
этом входе
код 1
```

The compiler found an input on which the result is negative. The function makes
sense only when the discount is not above the price. Say so with a `требует`
(requires) line.

After, `discount.flang`:

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
объявленным типам аргументов …
```

If a precondition does not fit here, the mistake is in the code or in the
postcondition itself.

## 2. A call does not pass the precondition

The calling function proves the precondition. Before, `before/order.flang`:

```flang refused insert docs/examples/proofs/before/order.flang
модуль «Заказ без предусловия»

тотальная функция «Цена заказа»
  принимает цена: неотрицательное, скидка: неотрицательное
  требует «скидка не больше цены» скидка не больше цена
  возвращает число
  цена минус скидка

тотальная функция «Счёт»
  принимает цена: неотрицательное, скидка: неотрицательное
  возвращает число
  «Цена заказа» от цена и скидка
```

```bash
flang check before/order.flang; echo "код $?"
```

```
FLANG_PRECONDITION_CALL в файле before/order.flang, строка 12, столбец 3: вызов
«Цена заказа» в функции «Счёт» не снимает предусловие «скидка не больше цены»: …
вызывающему здесь известно: собственных «требует» — 0, объявленных типов у
параметров — 2, доказанных обещаний вызванных в доводе — 0 …
код 1
```

Read the beginning and the end of the message. The beginning names the call
and the precondition. The end lists what the function «Счёт» knows: it has no
preconditions of its own. «Снять предусловие» (to discharge a precondition)
means to prove it at the call site.

A fact for a precondition comes from three places: the caller's own `требует`,
the type of its parameter, a proved postcondition of the function that computed
the argument. An `если` (if) test before the call does not count as such a fact.

After, `order.flang`:

```flang insert docs/examples/proofs/order.flang
модуль «Заказ»

тотальная функция «Цена заказа»
  принимает цена: неотрицательное, скидка: неотрицательное
  требует «скидка не больше цены» скидка не больше цена
  возвращает число
  цена минус скидка

тотальная функция «Счёт»
  принимает цена: неотрицательное, скидка: неотрицательное
  требует «скидка по карману» скидка не больше цена
  возвращает число
  «Цена заказа» от цена и скидка
```

```bash
flang check order.flang; echo "код $?"
```

```
order.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
код 0
```

## 3. A recursive function: a theorem by induction

Before, `before/total.flang`:

```flang insert docs/examples/proofs/before/total.flang
модуль «Итог без теоремы»

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

```bash
flang check before/total.flang --proof; echo "код $?"
```

```
постусловие «итог не отрицателен» функции «Итог» — сетка 1 значение (примеры
функции): нарушений на них нет … Это не доказательство — теоремы при утверждении нет
код 3
```

The test passed; nothing is known about other inputs. A person sees the reason:

- the list is empty: the total equals the delivery, which is not negative by the
  precondition;
- the list is not empty: the total equals the first price plus the total of the
  rest. The first price is not negative by its type, the total of the rest by
  the same statement for the tail.

This is induction over the list; the same example is explained in section 4 of
the lesson [First proof](first-proof.html). Write it as a theorem with the
same name as the postcondition. After, `total.flang`:

```flang insert docs/examples/proofs/total.flang
модуль «Итог»

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

```bash
flang check total.flang --proof; echo "код $?"
```

```
постусловие «итог не отрицателен» функции «Итог» — доказано индукцией по
«список»: база 1 случай, шаг при допущении на частях (1 случай) …
код 0
```

`по предположению` (by assumption) means «follows from what is already known»:
in the first case that is the precondition, in the second the statement for the
tail. The other kinds of theorems: [Theorems step by step](manual-proofs.html).

## 4. A floating-point number: take an exact type

Before, `before/remainder.flang`:

```flang insert docs/examples/proofs/before/remainder.flang
модуль «Остаток на складе, число»

тотальная функция «Остаток»
  принимает было: число, ушло: число
  требует «ушло не больше, чем было» ушло не больше было
  возвращает число
  обеспечивает «остаток не отрицателен» результат не меньше 0
  было минус ушло
```

```bash
flang check before/remainder.flang --proof; echo "код $?"
```

```
постусловие «остаток не отрицателен» функции «Остаток» — объявлено, не
доказано: ни теоремы, ни примеров …
код 3
```

`число` (number) is binary64 with all its values. If `было` and `ушло` are both
infinity, the precondition holds and the difference is NaN. NaN is neither above
nor below zero, so the postcondition is false, and the kernel does not prove it.

A quantity of goods is an integer and not negative. Say so with the type
`неотрицательное`: an integer from 0 to 2⁵³−1. After, `remainder.flang`:

```flang insert docs/examples/proofs/remainder.flang
модуль «Остаток на складе»

тотальная функция «Остаток»
  принимает было: неотрицательное, ушло: неотрицательное
  требует «ушло не больше, чем было» ушло не больше было
  возвращает число
  обеспечивает «остаток не отрицателен» результат не меньше 0
  было минус ушло
```

```bash
flang check remainder.flang --proof; echo "код $?"
```

```
постусловие «остаток не отрицателен» функции «Остаток» — доказано по
объявленным типам аргументов …
код 0
```

The exact types: `неотрицательное`, `целое`, `точное целое` (no upper bound),
`сотых` and `тысячных` for money.

## 5. A property about two calls: write it as a postcondition

The statement compares two calls of one function. Before,
`before/monotone.flang`:

```flang insert docs/examples/proofs/before/monotone.flang
модуль «Тариф без подсказки»

тотальная функция «Один»
  возвращает точное целое
  [1]

тотальная функция «Два»
  возвращает точное целое
  [2]

тотальная функция «Тариф»
  принимает минут: точное целое
  возвращает точное целое
  ((«Два») умножить на минут) плюс («Один»)

утверждение «дольше не дешевле»
  для всех а: точное целое и б: точное целое
  утверждаем если а не больше б то ((«Тариф» от а) не больше («Тариф» от б)) иначе да
```

```bash
flang check before/monotone.flang --proof; echo "код $?"
```

```
утверждение «дольше не дешевле» — объявлено, не доказано: ни теоремы, ни примеров …
код 3
```

The kernel does not put the function body into both calls by itself. Help it in
two steps. Write what the result equals as a postcondition of the function. Then
refer to that postcondition in a theorem with the words `по свойству` (by the
property). After, `monotone.flang`:

```flang insert docs/examples/proofs/monotone.flang
модуль «Тариф»

тотальная функция «Один»
  возвращает точное целое
  [1]

тотальная функция «Два»
  возвращает точное целое
  [2]

тотальная функция «Тариф»
  принимает минут: точное целое
  возвращает точное целое
  обеспечивает «развёрнуто» результат равен ((минут плюс минут) плюс («Один»))
  ((«Два») умножить на минут) плюс («Один»)

утверждение «дольше не дешевле»
  для всех а: точное целое и б: точное целое
  утверждаем если а не больше б то ((«Тариф» от а) не больше («Тариф» от б)) иначе да

теорема «дольше не дешевле»
  дано а: точное целое
  дано б: точное целое
  утверждаем если а не больше б то ((«Тариф» от а) не больше («Тариф» от б)) иначе да
  по свойству «развёрнуто»
  следовательно доказано
```

```bash
flang check monotone.flang --proof; echo "код $?"
```

```
постусловие «развёрнуто» функции «Тариф» — доказано по объявленным типам
аргументов: цель сведена правилом «линейная арифметика» …
утверждение «дольше не дешевле» — доказано: терм принят ядром, 1 шаг …
основания: постусловие «развёрнуто» функции «Тариф» …
код 0
```

The constants `«Один»` and `«Два»` are functions because `точное целое` does
not mix with a literal of type `число`.

## 6. The compiler did not accept the theorem

A theorem with a mistake gives exit code 1 and a message with a `FLANG_PROOF_…`
code. Before, `before/fine.flang`: the theorem is named differently from the
postcondition.

```flang refused insert docs/examples/proofs/before/fine.flang
модуль «Штраф с ошибкой в имени»

тип «Светофор»
  вариант «Красный»
  вариант «Зелёный»

тотальная функция «Штраф»
  принимает свет: «Светофор»
  возвращает число
  для всех свет обеспечивает «штраф неотрицателен» результат не меньше 0
  пример «красный»
    дано свет равно вариант «Красный»
    ожидается 500
  пример «зелёный»
    дано свет равно вариант «Зелёный»
    ожидается 0
  разбор свет
    случай вариант «Красный»
      то 500
    случай вариант «Зелёный»
      то 0

теорема «штраф положителен»
  дано свет: «Светофор»
  утверждаем результат не меньше 0
  индукция по свет
    случай вариант «Красный»
      то по примеру «красный»
    случай вариант «Зелёный»
      то по примеру «зелёный»
  следовательно доказано
```

```bash
flang check before/fine.flang; echo "код $?"
```

```
FLANG_PROOF_NO_GOAL в файле before/fine.flang, строка 23, столбец 1: теорема
«штраф положителен» ничего не закрывает: постусловия «штраф положителен» нет
ни у одной функции модуля …
код 1
```

A theorem is tied to its postcondition by name. After, `fine.flang`:

```flang insert docs/examples/proofs/fine.flang
модуль «Штраф»

тип «Светофор»
  вариант «Красный»
  вариант «Зелёный»

тотальная функция «Штраф»
  принимает свет: «Светофор»
  возвращает число
  для всех свет обеспечивает «штраф неотрицателен» результат не меньше 0
  пример «красный»
    дано свет равно вариант «Красный»
    ожидается 500
  пример «зелёный»
    дано свет равно вариант «Зелёный»
    ожидается 0
  разбор свет
    случай вариант «Красный»
      то 500
    случай вариант «Зелёный»
      то 0

теорема «штраф неотрицателен»
  дано свет: «Светофор»
  утверждаем результат не меньше 0
  индукция по свет
    случай вариант «Красный»
      то по примеру «красный»
    случай вариант «Зелёный»
      то по примеру «зелёный»
  следовательно доказано
```

```bash
flang check fine.flang --proof; echo "код $?"
```

```
постусловие «штраф неотрицателен» функции «Штраф» — доказано индукцией по
«Светофор»: база 2 случая …
код 0
```

Codes that are fixed in the theorem itself:

| Code | What happened | What to change |
| --- | --- | --- |
| `FLANG_PROOF_NO_GOAL` | no postcondition has that name | the theorem's name |
| `FLANG_PROOF_AMBIGUOUS` | the name fits two postconditions | give the postconditions different names |
| `FLANG_PROOF_DUPLICATE` | a postcondition has two theorems | keep one |
| `FLANG_PROOF_CLAIM_MISMATCH` | `утверждаем` differs from the postcondition | copy it word for word |
| `FLANG_PROOF_UNFINISHED` | the line `следовательно доказано` is missing | add it |
| `FLANG_PROOF_UNKNOWN_VAR` | `дано` introduces a name the function does not have | use the parameter's name |
| `FLANG_PROOF_VAR_TYPE` | the type in `дано` differs from the parameter's type | use the parameter's type |
| `FLANG_PROOF_INDUCTION_CASES` | the theorem's cases do not match the variants of the type | list the same cases as in `разбор` |
| `FLANG_PROOF_INDUCTION_STEP` | `по предположению` stands where there is nothing to lean on | add a `требует` to the function |

Codes that speak of a limit of the kernel:

| Code | What happened | What to do |
| --- | --- | --- |
| `FLANG_PROOF_INDUCTION_TYPE` | induction over `число` | declare the parameter `неотрицательное` |
| `FLANG_PROOF_INDUCTION_BRANCH` | the function body is neither `разбор` nor `свёртка` over the same variable | rewrite the body as a `разбор` |
| `FLANG_PROOF_INDUCTION_DESCENT` | recursion over `неотрицательное` goes down by something other than 1 | go down by `н минус 1` |
| `FLANG_PROOF_STEP` | a step fits no rule | read the message up to the word `известно:` |

### `FLANG_PROOF_INDUCTION_STEP`

The file `before/total-no-precondition.flang` is recipe 3 with the `требует`
line removed:

```flang refused insert docs/examples/proofs/before/total-no-precondition.flang
модуль «Итог без предусловия»

тотальная функция «Итог покупок»
  принимает цены: список неотрицательное, доставка: число
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
      то голова плюс («Итог покупок» от хвост и доставка)

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

```bash
flang check before/total-no-precondition.flang; echo "код $?"
```

```
FLANG_PROOF_INDUCTION_STEP в файле before/total-no-precondition.flang, строка 23,
столбец 10: шаг 1, база «пусто» теоремы «итог не отрицателен»: «по предположению»
стоит в базе «пусто», где предположения индукции нет … а предусловий у функции не
объявлено ни одного …
код 1
```

«База» (the base) is the first case of the induction, the empty list. There
`по предположению` can refer only to a precondition, and there is none: the
delivery may be negative. Put the `требует` line back.

### `FLANG_PROOF_STEP`

With `FLANG_PROOF_STEP` the end of the message lists what was known at that
point. If the needed fact is not there, add a `требует`. If the fact is there
and the step still failed, the kernel does not derive a postcondition of that
shape; go to recipe 7.

## 7. Nothing fits: keep the check

An unproved postcondition stays in the program as a check on every return from
the function. That is a working option. Do three things:

- add tests (`пример`) for the edges: the answer `сетка N` is better than
  `объявлено, не доказано`;
- run the program with the key `--trust`: without it `flang run` will not start
  a file with an unproved postcondition;
- in CI decide what you need: `flang check file` allows unproved postconditions,
  `flang check file --proof --strict` does not.

A true postcondition the kernel did not derive stays true. Examples of such
postconditions: [What you are trusting](trust.html#not-proved-does-not-mean-false).

## Next

- [Theorems step by step](manual-proofs.html) — all kinds of theorems.
- [What the kernel can do](what-the-kernel-accepts.html) — which postconditions
  are proved by themselves.
- [Error codes](diagnostics.html) — all compiler codes.
