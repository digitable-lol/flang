[Back to README](../../README.md) · [Documentation index](../README.md)

# What loops and classes are rewritten into

How to write loops and classes is shown on the tour page
[Loops, classes, interfaces](../site/tour-loops-and-classes.md). This page
answers a different question: what the compiler rewrites `цикл` (loop), `класс`
(class) and `интерфейс` (interface) into, what proves termination and which
errors there are.

The compiler rewrites these forms into plain flang: functions, records, types
with variants. Then it checks the result: types, termination, proofs. An error
message names the line of your file.

The words `цикл`, `класс`, `интерфейс` and `метод` (method) have no English
spelling, so the examples are in Russian.

## The one-line header

```flang
тотальная функция «Меньшее из двух» принимает первый: число, второй: число возвращает число
```

The same as three lines: `тотальная функция «Меньшее из двух»`, `принимает …`,
`возвращает …`. Without parameters: `функция «Ноль» возвращает число`.

## A loop

The file `countdown.flang` sums the numbers from 1 to `н`:

```flang
модуль «Счёт»

тотальная функция «Сумма до» принимает н: число возвращает число
  пример «от одного до четырёх»
    дано н равно 4
    ожидается 10
  цикл «Сложение»
    пока осталось больше 0
    убывает осталось
    храним осталось: число равным н, сумма: число равным 0
    в конце сумма
    дальше: осталось станет осталось минус 1, сумма станет сумма плюс осталось
```

```bash
$ flang check countdown.flang --proof --explain
…
  «Сумма до»  доказано композицией: рекурсии нет, …
  «Сложение»  доказано объявленной мерой: убывает «осталось»; спуск ядром не выведен — на веру: мера объявлена автором, сторож считает её при работе на каждом витке — 1 место
…
```

The file has one function, the report has two. The loop `«Сложение»` became a
separate function that calls itself. The values of the `храним` ("keep") line
became its parameters. The second report line says that the decrease of the
expression in the `убывает` line is not proved; it is checked on every step of
the loop.

The termination of such a loop is not proved, so `flang run` starts it only
with `--trust`. On a fractional argument the check fires, with exit code 1:

```bash
$ flang run countdown.flang --function "Сумма до" --args '{"н": 2.5}' --trust
на веру: доказанность не считалась — запуск по ключу --trust
FLANG_MEASURE: тотальная функция «Сложение»: мера на вызове «Сложение» — «осталось» — перестала быть целой. …
```

Each kind of loop is rewritten in its own way:

| Loop | Rewritten into | What proves termination |
|---|---|---|
| `для каждого` (for each), the body ends with a single `дальше` | a `свёртка` (fold) over a record of the `храним` values | the list is finite |
| `для каждого` with an early exit | a function with `разбор` over the rest of the list | the rest is shorter than the list |
| `пока` (while) with a `шагов не больше` line | a function with a counter that goes down by one | the counter has the type `неотрицательное` |
| `пока` with an `убывает` line | a function with an `убывает` line | a run-time check |

A branch without `дальше` gives the result of the loop at once: this is the
early exit. A name declared with `пусть` before the loop enters it through
`храним`. A loop's name is unique in the module: two loops with the same name in
different functions give the error `FLANG_TYPE`.

The ways of proving are covered in
[How the compiler proves that a function terminates](totality.md).

## A class

The file `account.flang`:

```flang
модуль «Счета»

класс «Счёт»
  владелец: строка
  остаток: число
  всегда «остаток не отрицателен» остаток не меньше 0

  метод «Положить» принимает сумма: число
    требует «сумма не отрицательна» сумма не меньше 0
    пример «сто и ещё двадцать»
      дано этот равно запись «Счёт» с владелец равным "Аня" и остаток равным 100
      дано сумма равно 20
      ожидается запись «Счёт» с владелец равным "Аня" и остаток равным 120
    остаток станет остаток плюс сумма

  метод «Пусто ли» возвращает признак
    пример «на новом счёте пусто»
      дано этот равно запись «Счёт» с владелец равным "Аня" и остаток равным 0
      ожидается да
    остаток равен 0
```

```bash
$ flang run account.flang --function "Счёт: Положить" --args '{"этот": {"владелец": "Аня", "остаток": 10}, "сумма": 30}'
доказано: утверждений 1
{"владелец":"Аня","остаток":40}
```

The class is rewritten into the record `объект «Счёт»` and the functions
`«Счёт: Положить»` and `«Счёт: Пусто ли»`, whose first parameter is `этот`
("this"). There is no mutable state:

- a field name in a method is read from `этот`;
- a method that ends with `field станет value` lines returns a new `«Счёт»`
  record; the other fields are copied;
- the `всегда` ("always") line gives every method a precondition. A method that
  returns `«Счёт»` also gets a postcondition about the result.

«утверждений 1» in the output is the postcondition of `«Положить»`: the
compiler proved it.

A call from code: `«Счёт: Положить» от счёт и 30`. A negative amount breaks
`требует`, and `flang run` answers `FLANG_PRECONDITION` with exit code 1.

## An interface

The file `shapes.flang`:

```flang
модуль «Фигуры»

интерфейс «Фигура»
  метод «Площадь» возвращает число
  метод «Название» возвращает строка
    обеспечивает «название не пусто» (длина результат) больше 0
    "фигура"

класс «Квадрат» есть «Фигура»
  сторона: число
  метод «Площадь» возвращает число
    пример «квадрат со стороной 3»
      дано этот равно запись «Квадрат» с сторона равным 3
      ожидается 9
    сторона умножить на сторона
  метод «Название» возвращает строка
    "квадрат"

класс «Прямоугольник» есть «Фигура»
  ширина: число
  высота: число
  метод «Площадь» возвращает число
    пример «два на пять»
      дано этот равно запись «Прямоугольник» с ширина равным 2 и высота равным 5
      ожидается 10
    ширина умножить на высота
```

```bash
$ flang test shapes.flang
shapes.flang: примеров 2, прошло 2, не прошло 0
```

The interface is rewritten into `тип «Фигура»`. The type has a variant for
every class of the file that says `есть «Фигура»`. The methods became the
functions `«Фигура: Площадь»` and `«Фигура: Название»` with `разбор` over the
classes.

A method without a body is required of every class. A method with a body is
the default implementation. An `обеспечивает` line on an interface method is
carried over to the method of every class.

## Errors

The exit code of `flang check` is 1. The message names the line and the column.

| Code | When |
|---|---|
| `FLANG_SUGAR_LOOP` | no `в конце` line; neither `для каждого` nor `пока`; `пока` has no bound; `дальше` changes a name that is not in `храним` |
| `FLANG_SUGAR_HEADER` | `возвращает` before `принимает`; a word is repeated; nothing follows a word |
| `FLANG_SUGAR_CLASS` | a class line is not a field, `всегда` or `метод`; `станет` changes a field that does not exist; a field is declared twice |
| `FLANG_SUGAR_INTERFACE` | a class did not declare a required method; the header of a class method differs from the one in the interface; the interface has no classes |

For example, a loop without the `в конце` line:

```
FLANG_SUGAR_LOOP в файле no-end.flang, строка 11, столбец 7: цикл «Сделка»: нет строки «в конце …»: цикл не говорит, что он отдаёт, когда кончается
```

The message says: the loop has no «в конце …» line, so it does not say what it
gives back when it ends.
