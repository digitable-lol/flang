[Back to README](../../README.md) · [Documentation index](../README.md)

# Loops, classes, interfaces and the one-line header

flang has no mutable variables, yet you can write a loop and a class. The
compiler expands these four forms into plain flang — a fold, a total function,
an `объект` (record), a `тип` (type) with variants — and checks the expanded
text: types, termination and proofs. An error names the line of your source.

The words `цикл` (loop), `класс` (class), `интерфейс` (interface) and `метод`
(method) have no English spelling, so the examples are in Russian.

## The one-line header

```
тотальная функция «Меньшее из двух» принимает первый: число, второй: число возвращает число
```

The same as three lines: `тотальная функция «Меньшее из двух»`, `принимает …`,
`возвращает …`. Without parameters: `функция «Ноль» возвращает число`.

## A loop over a list

Put this in `stock.flang`:

```flang
модуль «Сделка»

тотальная функция «Лучшая прибыль» принимает цены: список числа возвращает число
  пример «купить за 1, продать за 6»
    дано цены равно [7, 1, 5, 3, 6, 4]
    ожидается 5
  разбор цены
    случай пусто
      то 0
    случай голова и хвост
      цикл «Сделка»
        для каждого цена из хвост
        храним минимум: число равным голова, прибыль: число равным 0
        в конце прибыль
        пусть сегодня равно цена минус минимум
        пусть ниже равно если цена меньше минимум то цена иначе минимум
        пусть лучше равно если сегодня больше прибыль то сегодня иначе прибыль
        дальше: минимум станет ниже, прибыль станет лучше
```

```bash
$ flang check stock.flang
модуль «Сделка»: функций 1, из них с доказанным завершением 1; типов 1
stock.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет

$ flang run stock.flang --function "Лучшая прибыль" --args '{"цены": [7, 1, 5, 3, 6, 4]}'
доказано: утверждений 0
5
```

| Loop line | Meaning |
|---|---|
| `для каждого х из список` | walk the list; `х: тип` is needed when a branch returns early |
| `храним имя: тип равным начало, …` | the values kept between steps |
| `в конце значение` | the answer when the list ends |
| `дальше: имя станет значение, …` | the next step; kept values not named stay as they were |

A branch without `дальше` is the answer of the loop: an early return. A name
bound by `пусть` before the loop enters it through `храним`.

## The `пока` (while) loop

A `пока` loop needs a bound: without one termination cannot be proved, and the
compiler refuses with `FLANG_SUGAR_LOOP`. There are two bounds.

**`убывает мера`** (decreases) — a non-negative integer expression that gets
smaller on every step:

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
$ flang run countdown.flang --function "Сумма до" --args '{"н": 4}'
доказано: утверждений 0
10
```

The measure is checked at run time. On the fractional input `{"н": 2.5}` it
stops being an integer, and instead of looping forever the run answers
`FLANG_MEASURE`, exit code 1.

**`шагов не больше n, иначе v`** (at most n steps, otherwise v) — a step budget
and the answer when it runs out. There is no run-time check: the budget goes
down by one, and termination is proved.

```flang
модуль «Binary search»

тотальная функция «Двоичный поиск» принимает элементы: список числа, цель: число возвращает число
  пример «Один элемент»
    дано элементы равно [5]
    дано цель равно 5
    ожидается 0
  цикл «Поиск»
    пока низ не больше верх
    шагов не больше длина элементы, иначе -1
    храним низ: число равным 1, верх: число равным длина элементы
    в конце -1
    пусть сумма равно низ плюс верх
    пусть середина равно (сумма минус (сумма остаток от 2)) делить на 2
    пусть значение равно элемент середина в элементы
    если значение равен цель
      то середина минус 1
      иначе если значение меньше цель
        то дальше: низ станет середина плюс 1
        иначе дальше: верх станет середина минус 1
```

```bash
$ flang run search.flang --function "Двоичный поиск" --args '{"элементы": [1, 3, 5, 7], "цель": 5}'
доказано: утверждений 0
2
```

What a loop expands into and how termination is proved:

| Loop | Expansion | Termination |
|---|---|---|
| `для каждого`, the body ends with one `дальше` | a `свёртка` (fold) over a record of the kept values | by construction |
| `для каждого` with an early return | a function with `разбор` (match) on the rest of the list | by the structure of the list |
| `пока` with `шагов не больше` | a function with a budget that goes down by one | by the exact step |
| `пока` with `убывает` | a function with a declared measure | by the measure, checked at run time |

## Class

Put this in `account.flang`:

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

A class is an `объект «Счёт»` plus the functions `«Счёт: Положить»` and
`«Счёт: Пусто ли»` whose first parameter is `этот` (this). There is no mutable
state:

- a field inside a method is written as a bare name and is read from `этот`;
- a method that ends with `поле станет значение` lines returns a new `«Счёт»`;
  fields not named carry over;
- `всегда` (always) gives every method a `требует`, and a method that returns
  `«Счёт»` also gets an `обеспечивает` about the result. Here it is proved:
  that is the "утверждений 1" in the output.

A call from code: `«Счёт: Положить» от счёт и 30`. A negative amount breaks
the `требует`, and `run` answers `FLANG_PRECONDITION`, exit code 1.

## Interface

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

An interface is a `тип «Фигура»` with one variant per class in the file that
says `есть «Фигура»`, plus the functions `«Фигура: Площадь»` and
`«Фигура: Название»` that match on the classes. A method without a body is
required from a class; a method with a body is the default. An `обеспечивает`
on an interface method lands on that method of every class.

## Refusals

`check` exits with code 1; the message names the line and column.

| Code | When |
|---|---|
| `FLANG_SUGAR_LOOP` | no `в конце`; neither `для каждого` nor `пока`; `пока` has no bound; `дальше` changes a name that is not in `храним` |
| `FLANG_SUGAR_HEADER` | `возвращает` before `принимает`; a word said twice; nothing after a word |
| `FLANG_SUGAR_CLASS` | a class line is not a field, `всегда` or `метод`; `станет` changes a field that does not exist; a field named twice |
| `FLANG_SUGAR_INTERFACE` | a class lacks a required method; the header of a class method differs from the interface; the interface has no classes |

For example, a loop without the `в конце` line:

```
FLANG_SUGAR_LOOP в файле no-end.flang, строка 11, столбец 7: цикл «Сделка»: нет строки «в конце …»: цикл не говорит, что он отдаёт, когда кончается
```
