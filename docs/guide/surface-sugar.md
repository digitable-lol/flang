[Back to README](../../README.md) · [Documentation index](../README.md)

# Sugar: loops, one-line headers, classes and interfaces

Four short forms the compiler expands into ordinary flang before the lexer reads the
text: a fold, a total function, an `объект`, a `тип` with variants and functions. No kernel
rule is involved; types, totality, proofs and both checkers judge the expanded text as any
other program. The decisions are
[ADR-0206](../adr/0206-a-loop-with-kept-state-expands-to-a-fold-or-a-total-function.md) and
[ADR-0208](../adr/0208-a-class-is-a-record-its-methods-and-a-closed-variant-and-nothing-mutable.md).

The expansion is the module `«Surface sugar»` (`flang/self/sugar.flang`). The expanded text
can be read by eye:

```
bootstrap/flang run-script sugar:expand -- task.flang expanded.flang
```

A diagnostic in the expanded text names the line and column of the source: the line of
the loop or method body, and for lines the expansion made itself, the line of
`цикл «…»`, `метод «…»` or the header.

## One-line header

```
тотальная функция «Меньшее из двух» принимает первый: число, второй: число возвращает число
```

is the same as the three lines `тотальная функция «Меньшее из двух»`, `принимает …`,
`возвращает …`. Without parameters: `функция «Ноль» возвращает число`.

## Loops: kept values and `дальше`

```
цикл «Сужение»
  пока лево меньше право
  убывает право минус лево плюс 1
  храним лево: число равным 1, право: число равным длина элементы, лучшее: число равным 0
  в конце лучшее
  пусть итог равно …
  если слева меньше справа
    то дальше: лево станет лево плюс 1, лучшее станет итог
    иначе дальше: право станет право минус 1, лучшее станет итог
```

| line | meaning |
|---|---|
| `для каждого х[: тип] из список` | walk a list; the type is needed when a branch leaves early |
| `пока условие` | repeat while the condition holds |
| `убывает мера` | the measure of a `пока` loop; a guard checks it at run time |
| `шагов не больше n, иначе v` | the step budget of a `пока` loop and the value when it runs out; no guard |
| `храним имя: тип равным начало, …` | the values kept between steps |
| `в конце значение` | the value when the list or the condition ends |
| `дальше: имя станет значение, …` | the next step; unnamed kept values stay as they are |

A branch without `дальше` is the answer of the loop: an early return.

| loop | expansion | totality |
|---|---|---|
| `для каждого`, the body ends with one `дальше` | `свёртка` over a record `«Имя — состояние»` | by construction |
| `для каждого` with an early return | a function with `разбор` over the rest of the list | by structure |
| `пока` with `шагов не больше` | a function with a `неотрицательное` budget that drops by one | by exact step |
| `пока` with `убывает` | a function with the declared measure | by declared measure |

The new function takes the parameters of the enclosing function that the loop mentions,
then the kept values. A name bound by `пусть` before the loop enters through `храним`.

## Classes

```
класс «Счёт»
  владелец: строка
  остаток: число
  всегда «остаток не отрицателен» остаток не меньше 0

  метод «Положить» принимает сумма: число
    требует «сумма не отрицательна» сумма не меньше 0
    остаток станет остаток плюс сумма
```

A class is `объект «Счёт»` and functions `«Счёт: Положить»` whose first parameter is
`этот`. A field is written by its bare name in a method and becomes `этот.остаток`. A
method that ends with lines `поле станет значение` returns a new `«Счёт»`; fields it does
not name stay as they were. `всегда` gives every method a `требует`, and a method that
returns `«Счёт»` also an `обеспечивает` about the result. A call is
`«Счёт: Положить» от счёт и 30`.

## Interfaces

```
интерфейс «Фигура»
  метод «Площадь» возвращает число
  метод «Название» возвращает строка
    обеспечивает «название не пусто» (длина результат) больше 0
    "фигура"

класс «Квадрат» есть «Фигура»
  сторона: число
  метод «Площадь» возвращает число
    сторона умножить на сторона
```

An interface is `тип «Фигура»` with a variant for every class of the file that says
`есть «Фигура»`, and functions `«Фигура: Площадь»` with a `разбор` over the classes. A
method without a body is required; a method with a body is the default. An `обеспечивает`
of an interface method is a law: it goes to the method of every class and to
`«Фигура: Название»`.

## Refusals

| code | when |
|---|---|
| `FLANG_SUGAR_LOOP` | the loop has no `в конце`, neither `для каждого` nor `пока`, a `пока` without a bound, `дальше` changes a name not in `храним` |
| `FLANG_SUGAR_HEADER` | `возвращает` before `принимает`; a word said twice; nothing after a word |
| `FLANG_SUGAR_CLASS` | a class line that is not a field, `всегда` or `метод`; `станет` changes a field that does not exist; a field bound again |
| `FLANG_SUGAR_INTERFACE` | a class lacks a required method; a class method has another header than the interface; an interface without classes |

The probes live in `flang/proof/probes/surface-sugar`: for every form, a program with sugar
and its expanded text get the same `check --proof` verdict, and every malformed form is
refused with a line and a column.
