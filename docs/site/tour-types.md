# Your own types

How do you declare a structure with fields, an enumeration with data and a
"may be missing" value without `null`? The fifth page of the tour, 5–10 minutes
long. It follows [Functions that always terminate](tour-termination.html).

## An order: a record and two types with variants

Save this as `order.flang`:

```flang insert docs/examples/tour/types/order.flang
модуль «Orders»

объект «Позиция»
  название: строка
  цена: неотрицательное
  штук: неотрицательное

тип «Оплата»
  вариант «Наличными»
  вариант «Картой» содержит банк: строка
  вариант «В рассрочку» содержит месяцев: неотрицательное

тип «Поиск»
  вариант «Найдена» содержит позиция: «Позиция»
  вариант «Не найдена»

тотальная функция «Стоимость позиции»
  принимает позиция: «Позиция»
  возвращает число
  пример «три чая по сто двадцать»
    дано позиция равно запись «Позиция» с название равным "чай" и цена равным 120 и штук равным 3
    ожидается 360
  позиция.цена умножить на позиция.штук

тотальная функция «Комиссия»
  принимает оплата: «Оплата», сумма: число
  возвращает число
  пример «наличные без комиссии»
    дано оплата равно вариант «Наличными»
    дано сумма равно 1000
    ожидается 0
  пример «рассрочка на шесть месяцев»
    дано оплата равно вариант «В рассрочку» с месяцев равным 6
    дано сумма равно 1000
    ожидается 60
  разбор оплата
    случай вариант «Наличными»
      то 0
    случай вариант «Картой» с банк как банк
      то если банк равен "Свой" то 0 иначе сумма делить на 100
    случай вариант «В рассрочку» с месяцев как месяцев
      то сумма умножить на месяцев делить на 100

тотальная функция «Найти»
  принимает позиции: список «Позиция», название: строка
  возвращает «Поиск»
  пример «в пустом заказе ничего нет»
    дано позиции равно []
    дано название равно "чай"
    ожидается вариант «Не найдена»
  разбор позиции
    случай пусто
      то вариант «Не найдена»
    случай голова и хвост
      то если голова.название равен название
        то вариант «Найдена» с позиция равным голова
        иначе «Найти» от хвост и название

тотальная функция «Цена товара»
  принимает позиции: список «Позиция», название: строка
  возвращает число
  пример «чай есть в заказе»
    дано позиции равно [запись «Позиция» с название равным "чай" и цена равным 120 и штук равным 3]
    дано название равно "чай"
    ожидается 120
  пример «мёда в заказе нет»
    дано позиции равно [запись «Позиция» с название равным "чай" и цена равным 120 и штук равным 3]
    дано название равно "мёд"
    ожидается 0
  разбор («Найти» от позиции и название)
    случай вариант «Найдена» с позиция как позиция
      то позиция.цена
    случай вариант «Не найдена»
      то 0
```

```text insert output: check docs/examples/tour/types/order.flang
$ flang check docs/examples/tour/types/order.flang
модуль «Orders»: функций 4, из них с доказанным завершением 4; типов 3
docs/examples/tour/types/order.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

## A record

`объект` is a record with named fields (`struct` in Rust, `interface` or `type`
in TypeScript). Here `«Позиция»` is an order line with a name, a price and a
number of pieces.

| Action | In flang |
| --- | --- |
| declare | `объект «Позиция»` and typed fields under it |
| create | `запись «Позиция» с название равным "чай" и цена равным 120 и штук равным 3` |
| read a field | `позиция.цена` |

A field cannot be changed: values are immutable. To "change" a record you
create a new one.

## A type with variants

`тип` with several `вариант` lines is an enumeration whose variants may carry
data (`enum` in Rust, a discriminated union in TypeScript). `«Оплата»` is a
payment: cash, by card with a bank name, or in instalments with a number of
months.

A value is created with the word `вариант`: `вариант «Наличными»` or
`вариант «В рассрочку» с месяцев равным 6`. It is read through `разбор` only.
The line `случай вариант «Картой» с банк как банк` picks a variant and gives
its field a name.

A missing variant is a check error. The file `payment.flang` has no case for
instalments:

```flang refused insert docs/examples/tour/types/refused/payment.flang
модуль «Payments»

тип «Оплата»
  вариант «Наличными»
  вариант «Картой» содержит банк: строка
  вариант «В рассрочку» содержит месяцев: неотрицательное

тотальная функция «Комиссия»
  принимает оплата: «Оплата», сумма: число
  возвращает число
  разбор оплата
    случай вариант «Наличными»
      то 0
    случай вариант «Картой» с банк как банк
      то сумма делить на 100
```

```text insert output: check docs/examples/tour/types/refused/payment.flang
$ flang check docs/examples/tour/types/refused/payment.flang
модуль «Payments»: функций 1, из них с доказанным завершением 1; типов 1
FLANG_MATCH_NOT_EXHAUSTIVE в файле docs/examples/tour/types/refused/payment.flang, строка 11, столбец 3: разбор «Оплата» не покрывает «В рассрочку»
docs/examples/tour/types/refused/payment.flang: не проверено — замечаний 1
$ echo $?
1
```

The message names the type and the variant that `разбор` does not cover. The
exit code is 1.

## Instead of `null`

The language has no `null` value. `«Найти»` ("find") returns the type `«Поиск»`
with two variants: `«Найдена»` (found) with the order line inside and
`«Не найдена»` (not found). This is `Option` in Rust. The caller must handle
both cases, as `«Цена товара»` does.

An error is returned the same way: a variant with the result and a variant with
the reason (`Result` in Rust). The language has no exceptions.

```text insert output: run docs/examples/tour/types/order.flang --function Найти --args '{"позиции": [{"название": "чай", "цена": 120, "штук": 3}], "название": "чай"}'
$ flang run docs/examples/tour/types/order.flang --function Найти --args '{"позиции": [{"название": "чай", "цена": 120, "штук": 3}], "название": "чай"}'
доказано: утверждений 0
{"вариант":"Найдена","позиция":{"название":"чай","цена":120,"штук":3}}
```

A record argument is a JSON object. A variant is shown as an object with the
key `"вариант"` and its fields next to it.

## Narrower number types

The fields `цена` and `штук` are declared as `неотрицательное`: an integer from
0 to 2⁵³−1. A value outside the type is rejected at the call, before anything
is evaluated:

```text insert output: run docs/examples/tour/types/order.flang --function "Стоимость позиции" --args '{"позиция": {"название": "чай", "цена": 120, "штук": -1}}'
$ flang run docs/examples/tour/types/order.flang --function "Стоимость позиции" --args '{"позиция": {"название": "чай", "цена": 120, "штук": -1}}'
доказано: утверждений 0
FLANG_TYPE: вызов функции «Стоимость позиции»: аргумент «позиция».штук: -1 вне неотрицательное
$ echo $?
1
```

| Type | Values | Used for |
| --- | --- | --- |
| `число` | floating point, including fractions and NaN | measurements, the result of division |
| `целое` | integers from −(2⁵³−1) to 2⁵³−1 | differences, offsets |
| `неотрицательное` | integers from 0 to 2⁵³−1 | counts, positions, lengths |
| `сотых` | an integer number of hundredths | money: `1999` stands for 19.99 |

Put a narrow type on parameters and fields. The compiler treats the result of
arithmetic as `число`, so such functions declare `возвращает число`.

You cannot declare your own type with a condition, such as "a number from 1 to
150". A condition on a parameter is written as a `требует` line; see
[Your first proof](first-proof.html).

## Check yourself

In the starting file `order-status.flang` the function `«Надпись»` ("label")
handles two variants out of three. Add the third case:

```flang refused insert docs/examples/tour/exercises/5-order-status/stub/order-status.flang
модуль «Exercise 5»

тип «Статус»
  вариант «Новый»
  вариант «Оплачен» содержит сумма: число
  вариант «Отменён» содержит причина: строка

тотальная функция «Надпись»
  принимает статус: «Статус»
  возвращает строка
  пример «новый заказ»
    дано статус равно вариант «Новый»
    ожидается "ждёт оплаты"
  пример «оплаченный заказ»
    дано статус равно вариант «Оплачен» с сумма равным 500
    ожидается "оплачено 500 ₽"
  пример «отменённый заказ»
    дано статус равно вариант «Отменён» с причина равным "нет на складе"
    ожидается "отменён: нет на складе"
  разбор статус
    случай вариант «Новый»
      то "ждёт оплаты"
    случай вариант «Оплачен» с сумма как сумма
      то соединить ["оплачено ", (к строке сумма), " ₽"] по ""
```

```text insert output: check docs/examples/tour/exercises/5-order-status/stub/order-status.flang
$ flang check docs/examples/tour/exercises/5-order-status/stub/order-status.flang
модуль «Exercise 5»: функций 1, из них с доказанным завершением 1; типов 1
FLANG_MATCH_NOT_EXHAUSTIVE в файле docs/examples/tour/exercises/5-order-status/stub/order-status.flang, строка 20, столбец 3: разбор «Статус» не покрывает «Отменён»
docs/examples/tour/exercises/5-order-status/stub/order-status.flang: не проверено — замечаний 1
$ echo $?
1
```

<details>
<summary>Solution</summary>

```flang insert docs/examples/tour/exercises/5-order-status/solution/order-status.flang
модуль «Exercise 5»

тип «Статус»
  вариант «Новый»
  вариант «Оплачен» содержит сумма: число
  вариант «Отменён» содержит причина: строка

тотальная функция «Надпись»
  принимает статус: «Статус»
  возвращает строка
  пример «новый заказ»
    дано статус равно вариант «Новый»
    ожидается "ждёт оплаты"
  пример «оплаченный заказ»
    дано статус равно вариант «Оплачен» с сумма равным 500
    ожидается "оплачено 500 ₽"
  пример «отменённый заказ»
    дано статус равно вариант «Отменён» с причина равным "нет на складе"
    ожидается "отменён: нет на складе"
  разбор статус
    случай вариант «Новый»
      то "ждёт оплаты"
    случай вариант «Оплачен» с сумма как сумма
      то соединить ["оплачено ", (к строке сумма), " ₽"] по ""
    случай вариант «Отменён» с причина как причина
      то соединить "отменён: " с причина
```

```text insert output: check docs/examples/tour/exercises/5-order-status/solution/order-status.flang
$ flang check docs/examples/tour/exercises/5-order-status/solution/order-status.flang
модуль «Exercise 5»: функций 1, из них с доказанным завершением 1; типов 1
docs/examples/tour/exercises/5-order-status/solution/order-status.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

</details>

## Next

- [Loops, classes, interfaces](tour-loops-and-classes.html) — the last page of
  the tour
- [Language constructs](language.html) — every type, including generic types
  and exact numbers without a ceiling
- [Which construct to use when](which-construct.html) — Optional and Result
  step by step
