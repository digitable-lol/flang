# Categories and functors

Beyond functions and types, flang has declarations of structures: `моноид` (monoid), `монада`
(monad), `морфизм` (morphism), `категория` (category), `функтор` (functor), `преобразование`
(natural transformation), `изоморфизм` (isomorphism). A declaration says which laws must hold,
and the compiler answers what was done with each law: proved by the kernel for all values, or
computed on a finite grid of values taken from the examples.

## A monad: the kernel proves all three laws

A monad is declared by a type and two functions, `возврат` (return) and `соединение` (join):

```flang
модуль «Maybe»

тип «Возможно» от «А»
  вариант «Ничего»
  вариант «Нечто» содержит значение: «А»

тотальная функция «Обернуть» от «А»
  принимает значение: «А»
  возвращает «Возможно» от «А»
  пример «число в обёртке»
    дано значение равно 5
    ожидается вариант «Нечто» с значение равным 5
  вариант «Нечто» с значение равным значение

тотальная функция «Сплющить» от «А»
  принимает вложенное: «Возможно» от («Возможно» от «А»)
  возвращает «Возможно» от «А»
  пример «две обёртки становятся одной»
    дано вложенное равно вариант «Нечто» с значение равным (вариант «Нечто» с значение равным 5)
    ожидается вариант «Нечто» с значение равным 5
  пример «пустое остаётся пустым»
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
$ flang check --proof maybe.flang
…
законы как утверждения (ядро судит о ВСЕХ значениях носителя, а не о написанных):
  закон «Возможно — левая единица» — доказано сведением цели с телом функции: …
  закон «Возможно — правая единица» — доказано индукцией по «Возможно»: …
  закон «Возможно — ассоциативность связывания» — доказано индукцией по «Возможно»: …
  законов утверждениями 3: доказано ядром 3, не доказано 0
…
$ echo $?
0
```

All three laws are proved — left unit, right unit and associativity. The grid is still computed,
but only to look for a counterexample. Examples on `возврат` or `соединение` are required:
without them there is nothing to build the grid from, and the compiler refuses with
`FLANG_MONAD`.

Plain `flang check` prints only the grid for this monad — «ПОСЧИТАНО НА СЕТКЕ, не доказано»
("computed on a grid, not proved"). What the kernel proved is shown by `check --proof`.

## The list functor: two laws proved

The laws of `отобразить` (map) — identity, and fusion of two maps into one — are written as
statements, and the kernel proves them:

```flang
модуль «List functor»

утверждение «отображение тождеством не меняет список»
  для всех а: список числа
  утверждаем (отобразить а как э → э) равен а

утверждение «два отображения есть одно»
  для всех а: список числа
  утверждаем ((отобразить (отобразить а как э → э плюс 1) как э → э умножить на 2)
    равен (отобразить а как э → (э плюс 1) умножить на 2))
```

```
$ flang check --proof listmap.flang
…
  утверждений 2: доказано 2 (из них без теоремы 2), сетка 0, объявлено, не доказано 0
$ echo $?
0
```

## A monoid: laws are computed on a grid

```flang
модуль «Monoids»

тотальная функция «Сложить»
  принимает первое: число, второе: число
  возвращает число
  пример «два числа»
    дано первое равно 2
    дано второе равно 3
    ожидается 5
  первое плюс второе

тотальная функция «Обратить»
  принимает значение: число
  возвращает число
  пример «положительное»
    дано значение равно 3
    ожидается -3
  0 минус значение

моноид «Сумма»
  носитель число
  операция «Сложить»
  единица 0
  обратный элемент «Обратить»

тотальная функция «Склеить»
  принимает первая: строка, вторая: строка
  возвращает строка
  пример «две части»
    дано первая равно "аб"
    дано вторая равно "вг"
    ожидается "абвг"
  соединить первая с вторая

моноид «Склейка»
  носитель строка
  операция «Склеить»
  единица ""
```

`обратный элемент` (inverse) turns a monoid into a group; the language has no separate word for
a group.

```
$ flang check monoid.flang
моноид «Сумма»: сетка 5 значений, троек 125, нарушений 0 — ПОСЧИТАНО НА СЕТКЕ, не доказано
моноид «Склейка»: сетка 4 значений, троек 64, нарушений 0 — ПОСЧИТАНО НА СЕТКЕ, не доказано
…
```

Here the kernel does not prove the laws, and `check --proof` says why: «законов утверждениями 8:
доказано ядром 0, не доказано 8», exit code 3. For «Сумма» the reason is the carrier: `число` is
a binary float, addition rounds, and the sum is not associative above 2⁵³; the report suggests
the carrier `точное целое` (exact integer). "Computed on a grid" is not "proved": five values
are five values, and a sixth may break the law.

## A category: objects, arrows and its own equality

A category is a set of objects, arrows between them, and a rule by which two values of an object
count as equal. A piece of `flang/ct/order-shipment.flang` — order, shipment, invoice:

```
морфизм «отгрузить» из «Заказ» в «Отгрузка»
  даёт «Отгрузить заказ»
  закон «номер отгрузки берётся из суммы заказа»
    пример «обычный заказ»
      дано заказ равно запись «Заказ» с сумма равным 500
      ожидается запись «Отгрузка» с номер равным 500

морфизм «выписать» из «Отгрузка» в «Накладная»
  даёт «Выписать накладную»

морфизм «оформить» это «выписать» после «отгрузить»

единица «Заказ»
единица «Отгрузка»
единица «Накладная»

категория «Отгрузки»
  морфизм «отгрузить»
  морфизм «выписать»
  морфизм «оформить»
  объект «Заказ» даёт «Заказы равны»
  объект «Отгрузка» даёт «Отгрузки равны»
  объект «Накладная» даёт «Накладные равны»
```

`даёт` on a morphism names the function that computes it. `даёт` on an object names the
equality function for the values of that object; equality of arrows is derived from it.

Three things are computed: the declared equality is an equivalence (reflexive, symmetric,
transitive), composition respects it, composition is associative. For a transformation the
commuting square is computed, for an isomorphism the inverses. Values come from the examples on
the arrows, and the report names the grid size:

```
$ flang check flang/ct/order-shipment.flang
категория «Отгрузки»: сетка 5 значений на 3 объектах, троек стрелок 7, нарушений 0 — ПОСЧИТАНО НА СЕТКЕ, не доказано
изоморфизм «Отгрузка и накладная»: сетка 2 значений, нарушений 0 — ПОСЧИТАНО НА СЕТКЕ, не доказано
модуль «Order shipment»: функций 6, из них с доказанным завершением 6; типов 3
flang/ct/order-shipment.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

## A violation is a refusal, and printing is cancelled

An equality that is not an equality is rejected, with the pair of values that shows it:

```
$ flang check flang/test/fixtures/binary-rules/equality-not-symmetric.flang
категория «Отгрузки»: сетка 4 значений на 2 объектах, троек стрелок 0, нарушений 1 — ПОСЧИТАНО НА СЕТКЕ, не доказано;
оборвано: объявленное равенство не эквивалентность: …
FLANG_EQUALITY_NOT_SYMMETRIC в файле …/equality-not-symmetric.flang, строка 37, столбец 1: категория «Отгрузки»:
равенство на «Заказ» не симметрично: {"сумма":500} и {"сумма":0} — нет, а {"сумма":0} и {"сумма":500} — да
$ echo $?
1
```

On such a file `flang emit` answers «печать отменена — программа не проходит проверку»
("printing cancelled — the program does not pass the check") and writes no file.

The structure of declarations is checked too. A category that is not closed, a transformation
square that does not commute — these are refusals with exit code 1:

| problem | diagnostic code |
|---|---|
| equality is not symmetric | `FLANG_EQUALITY_NOT_SYMMETRIC` |
| a composition is built from an arrow the category does not have | `FLANG_CATEGORY_NOT_CLOSED` |
| a transformation square does not commute | `FLANG_TRANSFORM_NOT_NATURAL` |
| a monad has no example at all | `FLANG_MONAD` |

A category with no declared equality is not computed at all, and the compiler says so in words:
«НЕ СЧИТАЛАСЬ — своего равенства не объявлено».

## What is done with what

| declaration | what the compiler does |
|---|---|
| `монада` | the kernel proves three laws for all values; the grid looks for a counterexample |
| statements about `отобразить` over a list | identity and fusion are proved by the kernel |
| `функтор`, `преобразование` | laws are handed to the kernel as statements; unproved ones are named |
| `моноид` | laws are handed to the kernel; on `число` and `строка` they are not proved and are computed on a grid |
| `категория` with equality, `изоморфизм` | laws are computed on a grid, the grid size is named |
| `категория` without equality | not computed, said in words |
| a law on an arrow | run as an example by `flang test` |

For functors and transformations the proved share is in the same section of `check --proof`: on
`flang/ct/yoneda-preorder.flang` it is «законов утверждениями 9: доказано ядром 9, не доказано 0».

The full form of every declaration and the diagnostic codes are in `docs/ct/spec.md` in the
repository; examples are in the directory `flang/ct/`.

## Where next

- [What is proved and what is not](what-is-proved.html) — the same line drawn across the whole language.
- [Processes, supervision, distribution](processes.html)
- [How to keep learning the language](learning.html)
