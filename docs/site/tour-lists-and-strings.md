# Lists and strings

How do you walk a list in a language without mutable variables, and how do you
build a string from parts? The second page of the tour, 5–10 minutes long. It
follows [Functions and tests](tour-functions.html).

## Three ways to walk a list

Save this as `cart.flang`:

```flang insert docs/examples/tour/lists/cart.flang
модуль «Cart»

тотальная функция «Сумма корзины»
  принимает цены: список числа
  возвращает число
  пример «три товара»
    дано цены равно [100, 250, 50]
    ожидается 400
  пример «пустая корзина»
    дано цены равно []
    ожидается 0
  свёртка цены начиная с 0 как сумма и цена → сумма плюс цена

тотальная функция «Цены со скидкой»
  принимает цены: список числа, скидка: число
  возвращает список числа
  пример «минус десять процентов»
    дано цены равно [100, 250]
    дано скидка равно 10
    ожидается [90, 225]
  отобразить цены как цена → цена минус (цена умножить на скидка делить на 100)

тотальная функция «Дорогие»
  принимает цены: список числа, порог: число
  возвращает список числа
  пример «дороже ста»
    дано цены равно [100, 250, 50, 300]
    дано порог равно 100
    ожидается [250, 300]
  отфильтровать цены где цена → цена больше порог

тотальная функция «Сколько дорогих»
  принимает цены: список числа, порог: число
  возвращает число
  пример «два из четырёх»
    дано цены равно [100, 250, 50, 300]
    дано порог равно 100
    ожидается 2
  длина («Дорогие» от цены и порог)
```

The type `список числа` is a list of numbers (`Vec<f64>` in Rust, `number[]` in
TypeScript). A value is written in square brackets: `[100, 250, 50]`; the empty
list is `[]`.

Three forms walk a list, and each one is familiar from other languages:

| Form | What it does | In other languages |
| --- | --- | --- |
| `свёртка цены начиная с 0 как сумма и цена → …` | folds the list into one value | `reduce`, `fold` |
| `отобразить цены как цена → …` | builds a list of the same length | `map` |
| `отфильтровать цены где цена → …` | keeps the elements that fit | `filter` |

`свёртка` is `reduce`. It starts from `0` (`начиная с 0`) and on every step
receives the accumulated value (`сумма`) and the next element (`цена`). The
expression after the arrow gives the new accumulated value. The arrow may be
typed as `→`, `->` or `=>`.

`длина` ("length") returns the number of elements. It accepts the result of
another function, as in `«Сколько дорогих»` ("how many expensive ones").

```text insert output: test docs/examples/tour/lists/cart.flang
$ flang test docs/examples/tour/lists/cart.flang
docs/examples/tour/lists/cart.flang: примеров 5, прошло 5, не прошло 0
```

```text insert output: run docs/examples/tour/lists/cart.flang --function Дорогие --args '{"цены": [100, 250, 50, 300], "порог": 200}'
$ flang run docs/examples/tour/lists/cart.flang --function Дорогие --args '{"цены": [100, 250, 50, 300], "порог": 200}'
доказано: утверждений 0
[250,300]
```

A list argument is a JSON array, and the result is shown as an array too.

## Strings

Save this as `receipt.flang`:

```flang insert docs/examples/tour/lists/receipt.flang
модуль «Receipt»

тотальная функция «Строка чека»
  принимает название: строка, цена: число
  возвращает строка
  пример «чай за сто двадцать»
    дано название равно "чай"
    дано цена равно 120
    ожидается "чай: 120 ₽"
  соединить [название, ": ", (к строке цена), " ₽"] по ""

тотальная функция «Число слов»
  принимает текст: строка
  возвращает число
  пример «три слова»
    дано текст равно "зелёный чай листовой"
    ожидается 3
  длина (разделить текст по " ")

тотальная функция «Первое слово»
  принимает текст: строка
  возвращает строка
  пример «первое из трёх»
    дано текст равно "зелёный чай листовой"
    ожидается "зелёный"
  элемент 1 в (разделить текст по " ")

тотальная функция «Чек»
  принимает названия: список строки
  возвращает строка
  пример «два товара через запятую»
    дано названия равно ["зелёный чай", "мёд"]
    ожидается "зелёный, мёд"
  соединить (отобразить названия как название → «Первое слово» от название) по ", "
```

| Form | What it does | In other languages |
| --- | --- | --- |
| `соединить [а, б, в] по ""` | joins a list of strings with a separator | `join` |
| `разделить текст по " "` | splits a string into a list of strings | `split` |
| `к строке цена` | turns a number into a string | `to_string()`, `String(x)` |
| `элемент 1 в список` | takes an element by its number | `list[0]` |

A number does not become a string on its own: `соединить` accepts strings only,
so the price goes through `к строке`.

Numbering starts at one. A number outside the list stops the program with the
error `FLANG_BUILTIN_ARGS`; checking the file does not find this error in
advance.

```text insert output: run docs/examples/tour/lists/receipt.flang --function Чек --args '{"названия": ["чёрный чай", "мёд"]}'
$ flang run docs/examples/tour/lists/receipt.flang --function Чек --args '{"названия": ["чёрный чай", "мёд"]}'
доказано: утверждений 0
"чёрный, мёд"
```

A string is shown in quotes, as in JSON.

The other operations on lists and strings are collected on the page
[Operations](operations.html).

## Check yourself

Write the body of `«Сколько длинных слов»` ("how many long words"): the number
of words in the text that are longer than the threshold. You need `разделить`,
`отфильтровать` and `длина`. The starting file `long-words.flang`:

```flang refused insert docs/examples/tour/exercises/2-long-words/stub/long-words.flang
модуль «Exercise 2»

тотальная функция «Сколько длинных слов»
  принимает текст: строка, порог: число
  возвращает число
  пример «два слова длиннее трёх букв»
    дано текст равно "чай зелёный и мёд липовый"
    дано порог равно 3
    ожидается 2
  пример «коротких слов не считаем»
    дано текст равно "да и нет"
    дано порог равно 3
    ожидается 0
  0
```

```text insert output: check docs/examples/tour/exercises/2-long-words/stub/long-words.flang
$ flang check docs/examples/tour/exercises/2-long-words/stub/long-words.flang
модуль «Exercise 2»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_EXAMPLE: пример «два слова длиннее трёх букв» функции «Сколько длинных слов»: значение не совпало с ожидаемым: ожидалось 2, получено 0
docs/examples/tour/exercises/2-long-words/stub/long-words.flang: не проверено — замечаний 1
$ echo $?
1
```

The second test expects zero and passes with the starting file; the first one
does not.

<details>
<summary>Solution</summary>

```flang insert docs/examples/tour/exercises/2-long-words/solution/long-words.flang
модуль «Exercise 2»

тотальная функция «Сколько длинных слов»
  принимает текст: строка, порог: число
  возвращает число
  пример «два слова длиннее трёх букв»
    дано текст равно "чай зелёный и мёд липовый"
    дано порог равно 3
    ожидается 2
  пример «коротких слов не считаем»
    дано текст равно "да и нет"
    дано порог равно 3
    ожидается 0
  длина (отфильтровать (разделить текст по " ") где слово → (длина слово) больше порог)
```

```text insert output: check docs/examples/tour/exercises/2-long-words/solution/long-words.flang
$ flang check docs/examples/tour/exercises/2-long-words/solution/long-words.flang
модуль «Exercise 2»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/tour/exercises/2-long-words/solution/long-words.flang: проверено — доказано 0, проверено только на тестах 0, не доказано 0 (постусловий и утверждений 0); замечаний нет
```

</details>

## Next

- [Branching, matching and recursion](tour-branching-and-recursion.html) — the
  next page of the tour
- [Operations](operations.html) — a task and the form that solves it
- [Which construct to use when](which-construct.html) — `map`, `filter`,
  `reduce` and other familiar techniques in flang
