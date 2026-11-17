# Loops, classes, interfaces

How do you write a familiar loop and a class in a language without mutable
variables? The sixth and last page of the tour, 5–10 minutes long. It follows
[Your own types](tour-types.html).

`цикл` (loop), `класс` (class) and `интерфейс` (interface) are shorthand. The
compiler rewrites them into what you already know: functions, records, types
with variants and `разбор`. Then it checks the result as usual.

## Loops

Save this as `savings.flang`:

```flang insert docs/examples/tour/loops/savings.flang
модуль «Накопления»

тотальная функция «Средняя цена» принимает цены: список числа возвращает число
  пример «три цены»
    дано цены равно [100, 250, 100]
    ожидается 150
  пример «пустой список»
    дано цены равно []
    ожидается 0
  цикл «Подсчёт»
    для каждого цена из цены
    храним сумма: число равным 0, штук: число равным 0
    в конце если штук равен 0 то 0 иначе сумма делить на штук
    дальше: сумма станет сумма плюс цена, штук станет штук плюс 1

тотальная функция «Месяцев копить» принимает цель: число, взнос: число возвращает число
  пример «тысяча по триста — четыре месяца»
    дано цель равно 1000
    дано взнос равно 300
    ожидается 4
  пример «цель уже достигнута»
    дано цель равно 0
    дано взнос равно 300
    ожидается 0
  цикл «Копилка»
    пока осталось больше 0
    убывает осталось
    храним осталось: число равным цель, месяцев: число равным 0
    в конце месяцев
    пусть остаток равно если осталось больше взнос то осталось минус взнос иначе 0
    дальше: осталось станет остаток, месяцев станет месяцев плюс 1
```

The function header is written on one line here: `принимает` and `возвращает`
follow the name directly. Any function may be written this way.

The lines of a loop:

| Line | Meaning | In other languages |
| --- | --- | --- |
| `для каждого цена из цены` | walk the list | `for price in prices` |
| `пока condition` | repeat while the condition holds | `while` |
| `храним сумма: число равным 0, …` | values that change from step to step | `let mut sum = 0` |
| `дальше: сумма станет …, штук станет …` | new values for the next step | assignments in the loop body |
| `в конце expression` | the result of the loop when it has ended | the value after the loop |

A `пока` loop needs a bound, otherwise its termination cannot be proved. The
line `убывает осталось` names an expression that must decrease on every step,
as on [the fourth page of the tour](tour-termination.html). The other bound is
a line such as `шагов не больше 100, иначе -1`: a limit on the number of steps
and the answer for when it runs out. `«Месяцев копить»` is "months to save".

```text insert output: test docs/examples/tour/loops/savings.flang
$ flang test docs/examples/tour/loops/savings.flang
docs/examples/tour/loops/savings.flang: примеров 4, прошло 4, не прошло 0
```

```text insert output: run docs/examples/tour/loops/savings.flang --function "Месяцев копить" --args '{"цель": 100000, "взнос": 7500}'
$ flang run docs/examples/tour/loops/savings.flang --function "Месяцев копить" --args '{"цель": 100000, "взнос": 7500}'
доказано: утверждений 0
14
```

With a zero contribution the remainder does not decrease. The run-time check
notices that and stops the program; there is no endless loop:

```text insert output: run docs/examples/tour/loops/savings.flang --function "Месяцев копить" --args '{"цель": 1000, "взнос": 0}'
$ flang run docs/examples/tour/loops/savings.flang --function "Месяцев копить" --args '{"цель": 1000, "взнос": 0}'
доказано: утверждений 0
FLANG_MEASURE: тотальная функция «Копилка»: мера на вызове «Копилка» — «осталось» — не убыла. Завершение доказано тем, что она строго убывает; равенство цепочку не обрывает, а значит этот вызов может не кончиться никогда
$ echo $?
1
```

## A class and an interface

Save this as `shop.flang`:

```flang insert docs/examples/tour/loops/shop.flang
модуль «Магазин»

класс «Корзина»
  покупатель: строка
  сумма: число
  всегда «сумма не отрицательна» сумма не меньше 0

  метод «Добавить» принимает цена: число
    требует «цена не отрицательна» цена не меньше 0
    пример «к ста добавили двадцать»
      дано этот равно запись «Корзина» с покупатель равным "Аня" и сумма равным 100
      дано цена равно 20
      ожидается запись «Корзина» с покупатель равным "Аня" и сумма равным 120
    сумма станет сумма плюс цена

  метод «Пуста ли» возвращает признак
    пример «в новой корзине пусто»
      дано этот равно запись «Корзина» с покупатель равным "Аня" и сумма равным 0
      ожидается да
    сумма равен 0

интерфейс «Скидка»
  метод «Вычет» принимает сумма: число возвращает число
  метод «Название» возвращает строка
    "скидка"

класс «Процентная» есть «Скидка»
  процентов: число
  метод «Вычет» принимает сумма: число возвращает число
    пример «десять процентов от тысячи»
      дано этот равно запись «Процентная» с процентов равным 10
      дано сумма равно 1000
      ожидается 100
    сумма умножить на процентов делить на 100
  метод «Название» возвращает строка
    "процентная"

класс «Купон» есть «Скидка»
  рублей: число
  метод «Вычет» принимает сумма: число возвращает число
    пример «купон на двести»
      дано этот равно запись «Купон» с рублей равным 200
      дано сумма равно 1000
      ожидается 200
    если рублей больше сумма то сумма иначе рублей

тотальная функция «К оплате» принимает сумма: число, скидка: «Скидка» возвращает число
  пример «купон на двести с тысячи»
    дано сумма равно 1000
    дано скидка равно вариант «Купон» с значение равным (запись «Купон» с рублей равным 200)
    ожидается 800
  сумма минус («Скидка: Вычет» от скидка и сумма)
```

```text insert output: check docs/examples/tour/loops/shop.flang
$ flang check docs/examples/tour/loops/shop.flang
модуль «Магазин»: функций 8, из них с доказанным завершением 8; типов 4
docs/examples/tour/loops/shop.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

The first output line counts what the file was rewritten into: eight functions
and four types. Where each one comes from:

| You write | The compiler gets |
| --- | --- |
| `класс «Корзина»` with fields | the record `«Корзина»` |
| `метод «Добавить»` | the function `«Корзина: Добавить»` whose first parameter is `этот` ("this") |
| `сумма станет …` at the end of a method | a new `«Корзина»` record; the other fields are copied |
| `всегда «name» condition` | a condition on the input of every method and on the record a method returns |
| `интерфейс «Скидка»` | the type `«Скидка»` with a variant per class that says `есть «Скидка»` |
| a method of the interface | the function `«Скидка: Вычет»` with `разбор` over the classes |

An interface method without a body is required of every class. A method with a
body is the default implementation: `«Купон»` does not declare `«Название»` and
gets `"скидка"`.

A method is called as a function, with the object as the first argument:

```text insert output: run docs/examples/tour/loops/shop.flang --function "Корзина: Добавить" --args '{"этот": {"покупатель": "Аня", "сумма": 100}, "цена": 50}'
$ flang run docs/examples/tour/loops/shop.flang --function "Корзина: Добавить" --args '{"этот": {"покупатель": "Аня", "сумма": 100}, "цена": 50}'
доказано: утверждений 1
{"покупатель":"Аня","сумма":150}
```

The method returned a new cart; the old one did not change. «утверждений 1» in
the first line is the `всегда` condition for the result of the method: the
compiler proved it for all arguments.

A `требует` line in a method is a precondition. A negative price breaks it:

```text insert output: run docs/examples/tour/loops/shop.flang --function "Корзина: Добавить" --args '{"этот": {"покупатель": "Аня", "сумма": 100}, "цена": -5}'
$ flang run docs/examples/tour/loops/shop.flang --function "Корзина: Добавить" --args '{"этот": {"покупатель": "Аня", "сумма": 100}, "цена": -5}'
доказано: утверждений 1
FLANG_PRECONDITION: не выполнено требование «цена не отрицательна» функции «Корзина: Добавить»
$ echo $?
1
```

The method was not evaluated, and the exit code is 1.

A value of an interface is created as a variant with the field `значение`; see
the test of `«К оплате»`. The language has no class inheritance.

## Check yourself

`«Сколько раз подорожало»` ("how many times the price rose") counts how many
times a price is higher than the previous one. Write its body with a loop. The
starting file `price-rises.flang`:

```flang refused insert docs/examples/tour/exercises/6-price-rises/stub/price-rises.flang
модуль «Упражнение 6»

тотальная функция «Сколько раз подорожало» принимает цены: список числа возвращает число
  пример «два роста из четырёх изменений»
    дано цены равно [100, 120, 90, 90, 150]
    ожидается 2
  пример «одна цена — роста нет»
    дано цены равно [100]
    ожидается 0
  пример «пустой список»
    дано цены равно []
    ожидается 0
  0
```

```text insert output: check docs/examples/tour/exercises/6-price-rises/stub/price-rises.flang
$ flang check docs/examples/tour/exercises/6-price-rises/stub/price-rises.flang
модуль «Упражнение 6»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_EXAMPLE: пример «два роста из четырёх изменений» функции «Сколько раз подорожало»: значение не совпало с ожидаемым: ожидалось 2, получено 0
docs/examples/tour/exercises/6-price-rises/stub/price-rises.flang: не проверено — замечаний 1
$ echo $?
1
```

A hint: take the first price with `разбор`, walk the rest with a loop and keep
the previous price.

<details>
<summary>Solution</summary>

```flang insert docs/examples/tour/exercises/6-price-rises/solution/price-rises.flang
модуль «Упражнение 6»

тотальная функция «Сколько раз подорожало» принимает цены: список числа возвращает число
  пример «два роста из четырёх изменений»
    дано цены равно [100, 120, 90, 90, 150]
    ожидается 2
  пример «одна цена — роста нет»
    дано цены равно [100]
    ожидается 0
  пример «пустой список»
    дано цены равно []
    ожидается 0
  разбор цены
    случай пусто
      то 0
    случай голова и хвост
      цикл «Сравнение»
        для каждого цена из хвост
        храним прошлая: число равным голова, выросло: число равным 0
        в конце выросло
        пусть прибавка равно если цена больше прошлая то 1 иначе 0
        дальше: прошлая станет цена, выросло станет выросло плюс прибавка
```

```text insert output: check docs/examples/tour/exercises/6-price-rises/solution/price-rises.flang
$ flang check docs/examples/tour/exercises/6-price-rises/solution/price-rises.flang
модуль «Упражнение 6»: функций 1, из них с доказанным завершением 1; типов 1
docs/examples/tour/exercises/6-price-rises/solution/price-rises.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

</details>

## Next

The tour is done. Where to go now:

- [Your first proof](first-proof.html) — if you have not read it yet
- [flang for Rust and TypeScript users](flang-for-rust-and-typescript-users.html) —
  a table of equivalents and the differences
- [What loops and classes are rewritten into](surface-sugar.html) — the
  rewriting rules and the error messages
