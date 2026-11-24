# Functions and tests

How do you write a function, call another one from it and check both with
tests? This is the first of six pages of the language tour, 5–10 minutes long.
You need `flang` installed and [Your first program](getting-started.html) done.

The examples use the Russian keywords, the way most flang code is written. Each
table below gives the meaning of the words it introduces.

## A file with two functions

Save this as `price.flang`:

```flang insert docs/examples/tour/functions/price.flang
модуль «Prices»

тотальная функция «Цена со скидкой»
  принимает цена: число, скидка: число
  возвращает число
  пример «десять процентов от двухсот»
    дано цена равно 200
    дано скидка равно 10
    ожидается 180
  пример «без скидки цена та же»
    дано цена равно 200
    дано скидка равно 0
    ожидается 200
  пусть вычет равно цена умножить на скидка делить на 100
  цена минус вычет

тотальная функция «К оплате»
  принимает цена: число, скидка: число, доставка: число
  возвращает число
  пример «товар со скидкой и доставка»
    дано цена равно 200
    дано скидка равно 10
    дано доставка равно 50
    ожидается 230
  («Цена со скидкой» от цена и скидка) плюс доставка
```

The module is called «Prices». `«Цена со скидкой»` is "price with discount",
`«К оплате»` is "amount due". What the lines mean:

| Line | What it is | In other languages |
| --- | --- | --- |
| `принимает цена: число, скидка: число` | "accepts": parameters with types, comma-separated | `fn f(price: f64, discount: f64)` in Rust |
| `возвращает число` | "returns": the result type | `-> f64` |
| `пример «name»` with `дано` and `ожидается` | a test: "given" arguments and the "expected" result | `#[test]`, `test(...)` in Jest |
| `пусть вычет равно …` | "let … equal": a name for a value; it cannot be changed later | `let` in Rust, `const` in TypeScript |
| `«Цена со скидкой» от цена и скидка` | a call: arguments follow `от` ("of"), separated by `и` ("and") | `price_with_discount(price, discount)` |
| the last line of the body | the result; there is no `return` word | the last expression of a block in Rust |

Arithmetic is written in words: `плюс` (plus), `минус` (minus), `умножить на`
(times), `делить на` (divided by), `остаток от` (remainder). Precedence is the
usual one, and parentheses work as in mathematics.

The type `число` is a floating-point number (`f64` in Rust, `number` in
TypeScript). There are also `строка` (string) and `признак` (boolean) with the
values `да` and `нет`.

## Check

```text insert output: check docs/examples/tour/functions/price.flang
$ flang check docs/examples/tour/functions/price.flang
модуль «Prices»: функций 2, из них с доказанным завершением 2; типов 0
docs/examples/tour/functions/price.flang: проверено — доказано 0, проверено только на тестах 0, не доказано 0 (постусловий и утверждений 0); замечаний нет
```

The first line counts declarations: two functions, and the compiler proved that
both terminate. The second line lists the five checks that passed, in order:
syntax, types, termination, proofs and tests («примеры»).
«замечаний нет» means "no errors". The exit code is 0.

`flang test` runs the tests alone:

```text insert output: test docs/examples/tour/functions/price.flang
$ flang test docs/examples/tour/functions/price.flang
docs/examples/tour/functions/price.flang: примеров 3, прошло 3, не прошло 0
```

The file has three tests («примеров 3»), and all of them passed.

## Run

```text insert output: run docs/examples/tour/functions/price.flang --function "К оплате" --args '{"цена": 1000, "скидка": 15, "доставка": 300}'
$ flang run docs/examples/tour/functions/price.flang --function "К оплате" --args '{"цена": 1000, "скидка": 15, "доставка": 300}'
доказано: утверждений 0
1150
```

On the command line a function name is written without guillemets. Arguments
are a JSON object keyed by parameter names. The first output line says how many
postconditions of the file are proved: there are none here. The second line is
the result.

An argument of the wrong type never reaches the function:

```text insert output: run docs/examples/tour/functions/price.flang --function "К оплате" --args '{"цена": "сто", "скидка": 15, "доставка": 300}'
$ flang run docs/examples/tour/functions/price.flang --function "К оплате" --args '{"цена": "сто", "скидка": 15, "доставка": 300}'
доказано: утверждений 0
FLANG_TYPE: вызов функции «К оплате»: аргумент «цена» не соответствует типу число
$ echo $?
1
```

The string `"сто"` does not fit a parameter of type `число`. The function was
not evaluated, and the exit code is 1.

## A name the language has taken

Some Russian words belong to the language: `к`, `по`, `процент`, `список`. The
compiler rejects a parameter with such a name at the place where the name is
used:

```text
FLANG_PARSE … неожиданное 'процент' — это слово занято языком, именем оно быть не может …
```

The message says "this word is taken by the language and cannot be a name".
Rename the parameter or put the name in guillemets: `«процент»`. Every reserved
word is listed in the [language dictionary](../glossary.html).

## Check yourself

Write the body of `«Стоимость заказа»` ("cost of an order"): the price times the
number of pieces, plus delivery. The starting file `total-price.flang`:

```flang refused insert docs/examples/tour/exercises/1-total-price/stub/total-price.flang
модуль «Exercise 1»

тотальная функция «Стоимость заказа»
  принимает цена: число, штук: число, доставка: число
  возвращает число
  пример «три по сто и доставка»
    дано цена равно 100
    дано штук равно 3
    дано доставка равно 50
    ожидается 350
  пример «ноль штук — только доставка»
    дано цена равно 100
    дано штук равно 0
    дано доставка равно 50
    ожидается 50
  0
```

While the body is `0`, both tests fail:

```text insert output: check docs/examples/tour/exercises/1-total-price/stub/total-price.flang
$ flang check docs/examples/tour/exercises/1-total-price/stub/total-price.flang
модуль «Exercise 1»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_EXAMPLE: пример «три по сто и доставка» функции «Стоимость заказа»: значение не совпало с ожидаемым: ожидалось 350, получено 0
FLANG_EXAMPLE: пример «ноль штук — только доставка» функции «Стоимость заказа»: значение не совпало с ожидаемым: ожидалось 50, получено 0
docs/examples/tour/exercises/1-total-price/stub/total-price.flang: не проверено — замечаний 2
$ echo $?
1
```

A `FLANG_EXAMPLE` line names the test, the expected value («ожидалось») and
the value received («получено»). You are done when `flang check` answers
«замечаний нет».

<details>
<summary>Solution</summary>

```flang insert docs/examples/tour/exercises/1-total-price/solution/total-price.flang
модуль «Exercise 1»

тотальная функция «Стоимость заказа»
  принимает цена: число, штук: число, доставка: число
  возвращает число
  пример «три по сто и доставка»
    дано цена равно 100
    дано штук равно 3
    дано доставка равно 50
    ожидается 350
  пример «ноль штук — только доставка»
    дано цена равно 100
    дано штук равно 0
    дано доставка равно 50
    ожидается 50
  пусть товары равно цена умножить на штук
  товары плюс доставка
```

```text insert output: check docs/examples/tour/exercises/1-total-price/solution/total-price.flang
$ flang check docs/examples/tour/exercises/1-total-price/solution/total-price.flang
модуль «Exercise 1»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/tour/exercises/1-total-price/solution/total-price.flang: проверено — доказано 0, проверено только на тестах 0, не доказано 0 (постусловий и утверждений 0); замечаний нет
```

</details>

## Next

- [Lists and strings](tour-lists-and-strings.html) — the next page of the tour
- [Your first proof](first-proof.html) — a postcondition, a precondition and a
  proof by induction
- [Command reference](cli.html) — every option of `check`, `test` and `run`
