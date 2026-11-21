# Branching, matching and recursion

How do you choose one of two values, and how do you walk a list with your own
function, without the ready-made `свёртка` and `отобразить`? The third page of
the tour, 5–10 minutes long. It follows
[Lists and strings](tour-lists-and-strings.html).

## One file, three functions

Save this as `delivery.flang`:

```flang insert docs/examples/tour/branching/delivery.flang
модуль «Delivery»

тотальная функция «Цена доставки»
  принимает сумма: число, срочно: признак
  возвращает число
  пример «дешёвый заказ»
    дано сумма равно 500
    дано срочно равно нет
    ожидается 300
  пример «дорогой заказ везём бесплатно»
    дано сумма равно 3000
    дано срочно равно нет
    ожидается 0
  пример «срочный всегда платный»
    дано сумма равно 3000
    дано срочно равно да
    ожидается 600
  если срочно
    то 600
    иначе если сумма не меньше 3000
      то 0
      иначе 300

тотальная функция «Самая дорогая»
  принимает цены: список числа
  возвращает число
  пример «из трёх»
    дано цены равно [100, 250, 50]
    ожидается 250
  пример «в пустом списке — ноль»
    дано цены равно []
    ожидается 0
  разбор цены
    случай пусто
      то 0
    случай голова и хвост
      пусть остальные равно «Самая дорогая» от хвост
      если голова больше остальные то голова иначе остальные

тотальная функция «Есть бесплатные»
  принимает цены: список числа
  возвращает признак
  пример «ноль в середине»
    дано цены равно [100, 0, 50]
    ожидается да
  пример «все платные»
    дано цены равно [100, 50]
    ожидается нет
  разбор цены
    случай пусто
      то нет
    случай голова и хвост
      то (голова равен 0) или («Есть бесплатные» от хвост)
```

```text insert output: check docs/examples/tour/branching/delivery.flang
$ flang check docs/examples/tour/branching/delivery.flang
модуль «Delivery»: функций 3, из них с доказанным завершением 3; типов 0
docs/examples/tour/branching/delivery.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

## `если` returns a value

`если … то … иначе …` ("if … then … else …") is an expression, like `if` in
Rust or `? :` in TypeScript. The `иначе` branch is required: a value is needed
in both cases. The one-line and the multi-line spellings are equal, and the
file has both.

Conditions are written in words:

| Word | Sign |
| --- | --- |
| `больше`, `меньше` | `>`, `<` |
| `не меньше`, `не больше` | `>=`, `<=` |
| `равен`, `не равен` | `==`, `!=` |
| `и притом`, `или`, `не` | `&&`, `\|\|`, `!` |

Logical "and" takes two words, `и притом`: a single `и` separates the arguments
of a call. A parameter of type `признак` is a condition by itself:
`если срочно` ("if urgent").

## `разбор` over a list

`разбор` is pattern matching, like `match` in Rust. A list has two patterns:

- `случай пусто` — the list is empty;
- `случай голова и хвост` — the list has a first element (`голова`, the head)
  and the rest (`хвост`, the tail).

The compiler requires both cases. You cannot forget the empty list.

## Recursion

`«Самая дорогая»` ("the most expensive") calls itself on the tail of the list.
The tail is shorter than the list, so the calls reach the `пусто` case sooner
or later. The compiler sees this on its own and counts termination as proved:
the first output line says «с доказанным завершением 3», three functions with
proved termination.

After the line `случай голова и хвост` you may first name values with `пусть`
and write the result on the last line.

```text insert output: run docs/examples/tour/branching/delivery.flang --function "Самая дорогая" --args '{"цены": [3, 9, 4]}'
$ flang run docs/examples/tour/branching/delivery.flang --function "Самая дорогая" --args '{"цены": [3, 9, 4]}'
доказано: утверждений 0
9
```

```text insert output: run docs/examples/tour/branching/delivery.flang --function "Цена доставки" --args '{"сумма": 3500, "срочно": false}'
$ flang run docs/examples/tour/branching/delivery.flang --function "Цена доставки" --args '{"сумма": 3500, "срочно": false}'
доказано: утверждений 0
0
```

The values `да` and `нет` are `true` and `false` in JSON.

## What to choose for walking a list

| Task | Form |
| --- | --- |
| one value over the whole list | `свёртка` |
| a new list of the same length | `отобразить` |
| some of the elements | `отфильтровать` |
| stop before the end, or look at neighbouring elements | `разбор` and recursion |

## Check yourself

`«Сколько дороже»` ("how many cost more") counts the prices above a threshold.
In the starting file `count-above.flang` the second case always answers zero.
Replace it with recursion:

```flang refused insert docs/examples/tour/exercises/3-count-above/stub/count-above.flang
модуль «Exercise 3»

тотальная функция «Сколько дороже»
  принимает цены: список числа, порог: число
  возвращает число
  пример «две цены выше ста»
    дано цены равно [100, 250, 50, 300]
    дано порог равно 100
    ожидается 2
  пример «в пустом списке — ноль»
    дано цены равно []
    дано порог равно 100
    ожидается 0
  разбор цены
    случай пусто
      то 0
    случай голова и хвост
      то 0
```

```text insert output: check docs/examples/tour/exercises/3-count-above/stub/count-above.flang
$ flang check docs/examples/tour/exercises/3-count-above/stub/count-above.flang
модуль «Exercise 3»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_EXAMPLE: пример «две цены выше ста» функции «Сколько дороже»: значение не совпало с ожидаемым: ожидалось 2, получено 0
docs/examples/tour/exercises/3-count-above/stub/count-above.flang: не проверено — замечаний 1
$ echo $?
1
```

<details>
<summary>Solution</summary>

```flang insert docs/examples/tour/exercises/3-count-above/solution/count-above.flang
модуль «Exercise 3»

тотальная функция «Сколько дороже»
  принимает цены: список числа, порог: число
  возвращает число
  пример «две цены выше ста»
    дано цены равно [100, 250, 50, 300]
    дано порог равно 100
    ожидается 2
  пример «в пустом списке — ноль»
    дано цены равно []
    дано порог равно 100
    ожидается 0
  разбор цены
    случай пусто
      то 0
    случай голова и хвост
      пусть остальных равно «Сколько дороже» от хвост и порог
      если голова больше порог то 1 плюс остальных иначе остальных
```

```text insert output: check docs/examples/tour/exercises/3-count-above/solution/count-above.flang
$ flang check docs/examples/tour/exercises/3-count-above/solution/count-above.flang
модуль «Exercise 3»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/tour/exercises/3-count-above/solution/count-above.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

</details>

## Next

- [Functions that always terminate](tour-termination.html) — the next page of
  the tour: what to do when the compiler cannot see that recursion ends
- [Which construct to use when](which-construct.html) — choosing a form for a
  task, with examples
