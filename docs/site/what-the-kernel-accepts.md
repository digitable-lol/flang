# What the kernel can do

This reference answers the question: which ways of writing a postcondition the
kernel proves by itself, and how to rewrite one it did not prove. Under each
example is the output of `flang check file --proof` from
`flang {{выпуск.версия}}`. The files are in `docs/examples/proofs/kernel`.

The postcondition names in the examples start with a label (`g1`, `e2`) so that
the text can refer to them.

## Table of forms

| You wrote | Proved | What to write | Section |
| --- | --- | --- | --- |
| a statement about one branch of an `если` without a condition | no | `если <branch condition> то <statement> иначе да` | [1](#1-a-body-with-branches-add-the-branch-condition) |
| `(длина результат) больше 0` or `пусто результат` under a condition | no | equality to a value: `результат равен пустой список` | [2](#2-under-a-condition-write-equality-to-a-value) |
| `а не больше результат` with `а: число` | the error `FLANG_BOUND_ON_NAN` | `а: неотрицательное` or `требует а не меньше 0` | [3](#3-inequalities-depend-on-the-types) |
| a condition with the sides of the comparison swapped | no | the condition in the same form as in the body | [3](#3-inequalities-depend-on-the-types) |
| a strict inequality over the arguments | no | a non-strict one: `не больше` | [3](#3-inequalities-depend-on-the-types) |
| a statement about the result of a recursive function with no postcondition | no | a postcondition on the called function | [5](#5-calls-a-proved-postcondition-of-the-called-function-is-needed) |
| `(свёртка …) плюс 0`, a fold through `пусть`, a fold over a field | no | the fold as the whole body of a separate function | [6](#6-a-fold-must-be-the-whole-body) |
| a statement about one variant of the argument | yes, with a condition | `если отклик равен (вариант «…») то … иначе да` | [7](#7-a-type-with-variants-a-condition-by-equality-to-a-variant) |
| a `разбор` inside a postcondition | no | a condition by equality to a variant | [7](#7-a-type-with-variants-a-condition-by-equality-to-a-variant) |

Without rewriting the kernel also proves free statements: properties of
functions over lists, linear inequalities over `точное целое`, the laws of a
monoid and a monad. Examples:
[Theorems step by step](manual-proofs.html#4-a-statement-without-a-function).

## 1. A body with branches: add the branch condition

If the body starts with `если` (if), the kernel splits the postcondition by the
body's condition. A statement about one branch needs a condition that names
that branch. File `branch-condition.flang`:

```flang insert docs/examples/proofs/kernel/branch-condition.flang
модуль «Branch condition»

тотальная функция «Имя кода»
  принимает код: число
  возвращает строка
  обеспечивает «g1 охрана слово в слово» если (код меньше 1) или (код больше 3) то (результат равен "нет") иначе да
  обеспечивает «g2 без охраны» (результат равен "нет") или (код не меньше 1)
  обеспечивает «g4 охрана своими словами» если код меньше 1 то (результат равен "нет") иначе да
  обеспечивает «g5 двойник» не ((код меньше 1) или (код больше 3)) или (результат равен "нет")
  обеспечивает «g6 ветвь иначе» если не ((код меньше 1) или (код больше 3)) то (результат равен "есть") иначе да
  пример «чужой»
    дано код равно 7
    ожидается "нет"
  пример «первый»
    дано код равно 1
    ожидается "есть"
  если (код меньше 1) или (код больше 3)
    то "нет"
    иначе "есть"
```

```
постусловие «g1 охрана слово в слово» … доказано сведением цели с телом функции: правило «разбор цели по условию» …
постусловие «g2 без охраны» … сетка 2 значения (примеры функции) …
постусловие «g4 охрана своими словами» … доказано сведением цели с телом функции …
постусловие «g5 двойник» … доказано … правило «разбор случаев по внутреннему условию цели» …
постусловие «g6 ветвь иначе» … доказано сведением цели с телом функции …
```

With the word «сетка» (grid) the compiler names the answer «checked on tests
only».

- the condition can be copied from the body (`g1`) or be a narrower one (`g4`);
- both spellings are proved: `если У то Ц иначе да` and `не (У) или (Ц)` (`g1`, `g5`);
- a statement about the `иначе` (else) branch is written with the negated
  condition (`g6`);
- without a condition (`g2`) a true statement stays unproved.

## 2. Under a condition write equality to a value

The kernel compares the result with the value the branch returns. It does not
derive properties of that value: neither the length of a string nor the
emptiness of a list. File `empty-at-zero.flang`:

```flang insert docs/examples/proofs/kernel/empty-at-zero.flang
модуль «Equality to a value»

тотальная функция «Пустой при нуле»
  принимает корень: число, все: список числа
  возвращает список числа
  обеспечивает «e1 предикат пусто» если корень не больше 0 то (пусто результат) иначе да
  обеспечивает «e2 равенство пустому» если корень не больше 0 то (результат равен пустой список) иначе да
  обеспечивает «e3 равенство без охраны» (результат равен пустой список) или (корень больше 0)
  пример «ноль»
    дано корень равно 0
    дано все равно [1]
    ожидается пустой список
  если корень не больше 0
    то пустой список
    иначе все
```

```
постусловие «e1 предикат пусто» … сетка 1 значение (примеры функции) …
постусловие «e2 равенство пустому» … доказано сведением цели с телом функции …
постусловие «e3 равенство без охраны» … сетка 1 значение (примеры функции) …
```

Both parts are needed: the condition from the body and equality to what the
branch returns. Equality alone (`e3`) is not enough. The value can be any
expression of the branch: `результат равен (весь минус сколько)` with the body
`весь минус сколько` is proved.

## 3. Inequalities depend on the types

`число` is binary64, and NaN in it is unordered. So `а не больше (а плюс б)` is
false when `а` is NaN. The compiler rejects such a postcondition with the error
`FLANG_BOUND_ON_NAN`. The message names three fixes, and all three are proved.
File `sum-bounds.flang`:

```flang insert docs/examples/proofs/kernel/sum-bounds.flang
модуль «Sum bounds»

тотальная функция «Сумма двух»
  принимает а: неотрицательное, б: неотрицательное
  возвращает число
  обеспечивает «m1 а не больше суммы» а не больше результат
  обеспечивает «m2 б не больше суммы» б не больше результат
  а плюс б

тотальная функция «Сумма с требованием»
  принимает а: число, б: неотрицательное
  возвращает число
  требует «а неотрицательно» а не меньше 0
  обеспечивает «h1 при требовании» а не больше результат
  а плюс б

тотальная функция «Сумма с оговоркой»
  принимает а: число, б: неотрицательное
  возвращает число
  обеспечивает «h2 с оговоркой» не ((а минус а) равен 0) или (а не больше результат)
  а плюс б
```

```
постусловие «m1 а не больше суммы» … доказано по объявленным типам аргументов: цель сведена правилом «порядок по построению» …
постусловие «h1 при требовании» … доказано по объявленным типам аргументов …
постусловие «h2 с оговоркой» … доказано по объявленным типам аргументов …
```

The value being added needs both bounds, lower and upper. The type
`неотрицательное` gives both.

`(а минус б) плюс б равен а` is wrong for binary64 above 2⁵³. To say «nothing
was lost», write equality to the expression of the branch.

In a statement the sides of a comparison may be swapped: `результат не меньше
а` and `а не больше результат` are proved alike. In a condition they may not.
File `threshold.flang`:

```flang insert docs/examples/proofs/kernel/threshold.flang
модуль «Threshold»

тотальная функция «Порог»
  принимает место: число
  возвращает число
  обеспечивает «r1 охрана как в теле» если место не меньше 1 то (результат равен место) иначе да
  обеспечивает «r2 охрана зеркалом» если 1 не больше место то (результат равен место) иначе да
  если место не меньше 1
    то место
    иначе 1
```

```
постусловие «r1 охрана как в теле» … доказано сведением цели с телом функции …
постусловие «r2 охрана зеркалом» … объявлено, не доказано …
```

A strict inequality over the arguments is not proved. For a remainder write a
non-strict bound. File `remainder-bound.flang`:

```flang insert docs/examples/proofs/kernel/remainder-bound.flang
модуль «Remainder bound»

тотальная функция «Остаток бит целый»
  принимает ч: неотрицательное
  возвращает число
  обеспечивает «q2 остаток неотрицательного» результат меньше 65536
  обеспечивает «q3 остаток неотрицательного не больше» результат не больше 65535
  ч остаток от 65536
```

```
постусловие «q2 остаток неотрицательного» … объявлено, не доказано …
постусловие «q3 остаток неотрицательного не больше» … доказано по объявленным типам аргументов:
цель сведена правилом «ограниченность точным потолком по построению» …
```

## 4. A postcondition without arguments is computed

If a postcondition does not depend on the arguments, the kernel computes it.
Any comparison fits, a strict one too. File `closed-goal.flang`:

```flang insert docs/examples/proofs/kernel/closed-goal.flang
модуль «Closed goal»

тотальная функция «Пять»
  возвращает число
  обеспечивает «z1 замкнутая строго» результат меньше 6
  обеспечивает «z2 замкнутая больше» результат больше 0
  5

тотальная функция «Метка»
  возвращает список числа
  обеспечивает «z3 длина литерала» (длина результат) равен 3
  [100, 101, 114]
```

```
постусловие «z1 замкнутая строго» … доказано вычислением замкнутой цели …
постусловие «z3 длина литерала» … доказано сведением цели с телом функции …
```

For a function that returns a constant you can write down the value, the length
and the bounds at no effort.

## 5. Calls: a proved postcondition of the called function is needed

The kernel does not put the body of a recursive function into the call site.
About the result of a call it knows only what the proved postconditions of the
called function say. File `copy-length.flang`:

```flang insert docs/examples/proofs/kernel/copy-length.flang
модуль «Copy length»

тотальная функция «Копия без»
  принимает х: список число
  возвращает список число
  разбор х
    случай пусто
      то пустой список
    случай голова и хвост
      то приписать голова к («Копия без» от хвост)

тотальная функция «Копия с»
  принимает х: список число
  возвращает список число
  обеспечивает «k1 длина копии» (длина результат) равен (длина х)
  разбор х
    случай пусто
      то пустой список
    случай голова и хвост
      то приписать голова к («Копия с» от хвост)

тотальная функция «Верх без»
  принимает х: список число
  возвращает список число
  обеспечивает «k2 верх над голым звеном» (длина результат) равен (длина х)
  «Копия без» от х

тотальная функция «Верх с»
  принимает х: список число
  возвращает список число
  обеспечивает «k3 верх над звеном с обещанием» (длина результат) равен (длина х)
  «Копия с» от х
```

```
постусловие «k1 длина копии» … доказано индукцией по «список» …
постусловие «k2 верх над голым звеном» … объявлено, не доказано …
постусловие «k3 верх над звеном с обещанием» … доказано сведением цели с телом функции:
правило «цель есть допущение» …
```

«Копия без» has no postcondition, and the statement about its result (`k2`) is
not proved. «Копия с» has one and it is proved, so `k3` passes. A postcondition
checked on tests only does not help the calling function.

The kernel puts a non-recursive function without postconditions in by itself.

If the kernel did not apply the postcondition of the called function, refer to
it with a one-line theorem. File `call-by-property.flang`:

```flang insert docs/examples/proofs/kernel/call-by-property.flang
модуль «Property of the called»

тотальная функция «Копия»
  принимает х: список число
  возвращает список число
  обеспечивает «копия той же длины» (длина результат) не больше (длина х)
  разбор х
    случай пусто
      то пустой список
    случай голова и хвост
      то приписать голова к («Копия» от хвост)

тотальная функция «Голый вызов»
  принимает х: список число
  возвращает список число
  обеспечивает «t1 голый вызов» (длина результат) не больше (длина х)
  «Копия» от х

теорема «t1 голый вызов»
  дано х: список число
  утверждаем (длина результат) не больше (длина х)
  по свойству «копия той же длины»
  следовательно доказано
```

```
постусловие «t1 голый вызов» … доказано: терм принят ядром, 1 шаг, правило «цель есть допущение»,
основания: постусловие «копия той же длины» функции «Копия» …
```

A theorem with a mistake rejects the whole file: exit code 1, no report. Add
theorems one at a time.

## 6. A fold must be the whole body

The kernel proves a statement about a `свёртка` (fold) by induction over the
fold. File `fold-count.flang`:

```flang insert docs/examples/proofs/kernel/fold-count.flang
модуль «Count by fold»

тотальная функция «Счёт лямбдой»
  принимает х: список число
  возвращает число
  обеспечивает «f7 счёт лямбдой» результат равен (длина х)
  свёртка х начиная с 0 как акк и эл → акк плюс 1
```

```
постусловие «f7 счёт лямбдой» … доказано индукцией по СВЁРТКЕ тела: начало 1 случай,
виток при допущении о накопителе «акк» (1 случай) …
```

«Виток» in the output is one step of the fold. This works only when the fold is
the whole body and runs over an argument:

| Body | Answer |
| --- | --- |
| `свёртка х начиная с 0 как акк и эл → «Счёт шагом» от акк и эл` | proved |
| `(свёртка х … ) плюс 0` | not proved |
| `пусть н равно (свёртка х …)`, then `н` | not proved |
| `свёртка куча.свободные …` (a field of the argument) | not proved |

The fix is in the program: make the fold the body of a separate function that
takes the list as an argument, and call it.

## 7. A type with variants: a condition by equality to a variant

The kernel splits a `разбор` (match) body over an argument by a condition that
compares the argument with a variant. File `variant-answer.flang`:

```flang insert docs/examples/proofs/kernel/variant-answer.flang
модуль «Variant answer»

тип «Ответ»
  вариант «Пока ничего»
  вариант «Текст» содержит текст: строка

тотальная функция «Текст ответа»
  принимает отклик: «Ответ»
  возвращает строка
  обеспечивает «v2 равенство варианту» если отклик равен (вариант «Пока ничего») то (результат равен "") иначе да
  разбор отклик
    случай «Пока ничего»
      то ""
    случай вариант «Текст» с текст как т
      то т
```

```
постусловие «v2 равенство варианту» … доказано сведением цели с телом функции:
правило «разбор цели по условию» …
```

A `разбор` inside the postcondition itself is not supported: write such a
condition in its place.

For a list both conditions fit: `если х равен пустой список то …` and
`если (длина х) равен 0 то …`.

## 8. A predicate call and a conjunction

A postcondition that is a predicate call is written two ways: on its own and
with `равен да`. If one spelling was not proved, try the other.

The kernel often proves a conjunction `Ц1 и притом Ц2` whole. If it did not,
split it into separate `обеспечивает` lines. The report will show which part is
the problem.

A conjunction in a condition must not be split: `если А и притом Б то В` is
weaker than `если А то В`. A disjunction in a condition can be split: `если (А
или Б) то В` is equivalent to the pair `если А то В` and `если Б то В`.

## What the report does not say

For an unproved postcondition without a theorem the report writes the same text
whatever the cause:

```
объявлено, не доказано: ни теоремы, ни примеров. Его считает рантайм после каждого возврата …
```

It does not say which rule was missing. A false postcondition gets the same
answer as a true one the kernel did not derive. Before rewriting a
postcondition, write a test that would break it.

A file with many postconditions may run out of steps: the check stops with
`FLANG_RECURSION_LIMIT`. The key `--step-limit N` raises the limit.

## The order of work

1. Run `flang check file --proof` and note the last line of the report.
2. For a body with branches add the conditions from the body (sections 1 and 2).
3. Where there is an inequality, change the argument types to `неотрицательное`
   or add a `требует` (section 3).
4. For the rest give the called functions the postconditions they need
   (section 5).
5. Run the check again and compare the number proved. If it did not grow, undo
   the change.

## Next

- [When it is not proved](proof-refused.html) — recipes with before and after
  files.
- [Theorems step by step](manual-proofs.html) — when rewriting did not help.
- [How to read the report](how-proofs-work.html) — what each output line means.
