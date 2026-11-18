# Your own language in 30 minutes

A DSL is a small language for one job: discount rules, formulas, the transitions
of an order between its states. On this page you build three of them and see
what flang adds: a property of the language is proved once, for every program
written in it.

All files live in `docs/examples/dsl/`. Commands run from the repository root.
Every file passes `flang check --proof` with code 0, except the ones broken on
purpose, and those are called out. The examples use the Russian keywords, the
same ones the standard library is written in; each keyword has an English
spelling listed in the [glossary](../glossary.html).

## 1. Three kinds of DSL and how to choose

| Kind | Who writes programs in it | What you write | Section |
| --- | --- | --- | --- |
| embedded | a programmer, inside a `.flang` file | a type with variants and functions with telling names | [2](#2-an-embedded-language-discount-rules) |
| external | anyone, in their own text with its own syntax | parsing the text into a tree and evaluating the tree | [3](#3-an-external-language-a-calculator) |
| checked | a programmer, as data or as types | a description and functions that look for mistakes in it | [4](#4-a-checked-language-an-order-state-machine) |

Start with the embedded kind: there is no text to parse, and proofs work at full
strength. Take the external kind when the rules are written by someone who is
not a programmer, or when they arrive from outside: a file, a form, a database.
The third kind is a habit more than a technique: once a thing is described as
data, write a function that finds the holes in the description and let every
check of the file call it.

## 2. An embedded language: discount rules

A program in an embedded language is an ordinary flang expression. The language
has two parts: a type that lists which rules exist, and a function that carries
a rule out.

The type is the grammar. A discount rule («Правило») is one of five things: no
discount, a percentage, a fixed amount in roubles, a rule that applies from an
order total upwards, and the better of two rules.

```flang fragment insert docs/examples/dsl/discount-rules.flang «Правило»
тип «Правило»
  вариант «Без скидки»
  вариант «Процент» содержит доля: неотрицательное
  вариант «Рубли» содержит сумма: неотрицательное
  вариант «При сумме от» содержит порог: неотрицательное, вложенное: «Правило»
  вариант «Лучшее из» содержит первое: «Правило», второе: «Правило»
```

To make rules read like phrases, give each variant a function whose name is
several words long. A name in guillemets can be anything; this one is «при
заказе от», "for an order from":

```flang fragment insert docs/examples/dsl/discount-rules.flang «при заказе от»
тотальная функция «при заказе от»
  принимает порог: неотрицательное, вложенное: «Правило»
  возвращает «Правило»
  вариант «При сумме от» с порог равным порог и вложенное равным вложенное
```

Now a rule fits on one line and reads left to right: "the better of ten per cent
for an order from 5000, or 300 roubles".

```flang fragment insert docs/examples/dsl/discount-rules.flang «Осенняя акция»
тотальная функция «Осенняя акция»
  возвращает «Правило»
  «лучшее из» от («при заказе от» от 5000 и («процентов» от 10)) и («рублей» от 300)
```

An interpreter carries the rule out. It is a function with a `разбор` (match)
over the variants of the type:

```flang fragment insert docs/examples/dsl/discount-rules.flang «Скидка»
тотальная функция «Скидка»
  принимает скидка: «Правило», цена: неотрицательное
  возвращает число
  обеспечивает «скидка не больше цены» результат не больше цена
  обеспечивает «скидка не отрицательна» результат не меньше 0
  разбор скидка
    случай вариант «Без скидки»
      то 0
    случай вариант «Процент» с доля как доля
      то «В пределах цены» от ((цена умножить на доля) делить на 100) и цена
    случай вариант «Рубли» с сумма как сумма
      то если сумма больше цена то цена иначе сумма
    случай вариант «При сумме от» с порог как порог и вложенное как вложенное
      то если цена меньше порог то 0 иначе «Скидка» от вложенное и цена
    случай вариант «Лучшее из» с первое как первое и второе как второе
      то «Больше» от («Скидка» от первое и цена) и («Скидка» от второе и цена)
```

The two `обеспечивает` (ensures) lines are promises about any rule, not only
about the autumn sale: the discount is never more than the price and never
below zero. The compiler needs a hint on how to prove them: a theorem by
induction on the rule. For compound rules there is one step, "already proved
for the parts".

```flang fragment insert docs/examples/dsl/discount-rules.flang «скидка не больше цены»
теорема «скидка не больше цены»
  дано скидка: «Правило»
  дано цена: неотрицательное
  утверждаем результат не больше цена
  индукция по скидка
    случай вариант «При сумме от» с порог как порог и вложенное как вложенное
      то по предположению
    случай вариант «Лучшее из» с первое как первое и второе как второе
      то по предположению
  следовательно доказано
```

Check the whole file:

```bash
flang check docs/examples/dsl/discount-rules.flang --proof
```

```text
…
  постусловие «скидка не больше цены» функции «Скидка» — доказано индукцией по «Правило»: база 3 случая, шаг при допущении на частях (2 случая) …
  постусловие «скидка не отрицательна» функции «Скидка» — доказано индукцией по «Правило»: база 3 случая, шаг при допущении на частях (2 случая) …
…
docs/examples/dsl/discount-rules.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 4: доказано 4, условно 0, сетка 0, объявлено, не доказано 0 …
```

Both postconditions are reported as proved by induction over «Правило», and the
last line counts four statements, four proved.

This is the gain. Tomorrow marketing invents a winter sale from the same bricks,
and it is already proved that it cannot push a price below zero. Add a sixth
kind of rule and the compiler demands a case for it in the `разбор` and checks
both promises again.

The whole file: [`discount-rules.flang`](docs/examples/dsl/discount-rules.flang).

## 3. An external language: a calculator

An external language has its own syntax, and a program in it arrives as a
string: `"-(2 + 3) * 4"`. The string always takes the same road:

```text
text → tokens → tree → value
```

The library module `«Parsing»` does the first two steps. A token is a word of
the language: a number, a name, a quoted string or a sign; each one records its
line and column. What is left for you is to say which operators the language
has and to write the evaluation.

Operators are given as a table. `сила` is the precedence: multiplication binds
tighter than addition. `правая равным нет` means the operator groups left to
right, like subtraction: `100 - 10 - 1` is `(100 - 10) - 1`. Signs listed in
`приставки` may stand before an operand; this is how the minus in `-(2 + 3)`
works.

```flang fragment insert docs/examples/dsl/calculator.flang «Правила арифметики»
тотальная функция «Правила арифметики»
  возвращает «Правила выражений»
  вариант «Правила выражений» с приставки равным ["-"] и действия равным [
    (вариант «Действие выражения» с знак равным "+" и сила равным 1 и правая равным нет),
    (вариант «Действие выражения» с знак равным "-" и сила равным 1 и правая равным нет),
    (вариант «Действие выражения» с знак равным "*" и сила равным 2 и правая равным нет),
    (вариант «Действие выражения» с знак равным "/" и сила равным 2 и правая равным нет)]
```

From the table the function `«Выражение из текста»` builds a tree with three
kinds of node: a leaf holding a token, a prefix node and an operator node.
Evaluation is again an interpreter with a `разбор`:

```flang fragment insert docs/examples/dsl/calculator.flang «Вычислить дерево»
тотальная функция «Вычислить дерево»
  принимает дерево: «Дерево выражения»
  возвращает «Итог счёта»
  разбор дерево
    случай вариант «Лист выражения» с лексема как лексема
      то «Значение листа» от лексема
    случай вариант «Узел приставки» с знак как знак и место как место и довод как довод
      то «Свести два итога» от место и (вариант «Посчитано» с величина равным 0) и («Вычислить дерево» от довод)
    случай вариант «Узел действия» с знак как знак и место как место и левое как левое и правое как правое
      то «Свести два итога» от место и («Вычислить дерево» от левое) и («Вычислить дерево» от правое)
```

Errors are values, not crashes. Parsing returns either a tree or an error with a
place, and the calculator passes the error on untouched:

```flang fragment insert docs/examples/dsl/calculator.flang «Посчитать»
тотальная функция «Посчитать»
  принимает текст: строка
  возвращает «Итог счёта»
  пример «приоритеты»
    дано текст равно "2 + 3 * 4"
    ожидается вариант «Посчитано» с величина равным 14
  пример «скобки и унарный минус»
    дано текст равно "-(2 + 3) * 4 - 10 / 5"
    ожидается вариант «Посчитано» с величина равным -22
  пример «левая ассоциативность»
    дано текст равно "100 - 10 - 1"
    ожидается вариант «Посчитано» с величина равным 89
  пример «деление на ноль названо столбцом»
    дано текст равно "7 / (3 - 3)"
    ожидается (вариант «Не посчитано» с ошибка равным (вариант «Ошибка в тексте» с строка равным 1 и
      столбец равным 3 и ожидалось равным "делитель не ноль" и встречено равным "знак /"))
  пример «чужой символ»
    дано текст равно "2 + x"
    ожидается (вариант «Не посчитано» с ошибка равным (вариант «Ошибка в тексте» с строка равным 1 и
      столбец равным 5 и ожидалось равным "число" и встречено равным "имя x"))
  пример «лишняя скобка»
    дано текст равно "1 + 2)"
    ожидается (вариант «Не посчитано» с ошибка равным (вариант «Ошибка в тексте» с строка равным 1 и
      столбец равным 6 и ожидалось равным "конец текста" и встречено равным "знак )"))
  пример «оборвано»
    дано текст равно "1 +"
    ожидается (вариант «Не посчитано» с ошибка равным (вариант «Ошибка в тексте» с строка равным 1 и
      столбец равным 4 и ожидалось равным "число, имя или скобка" и встречено равным "конец текста"))
  разбор («Выражение из текста» от «Правила арифметики» и текст)
    случай вариант «Разобрано» с значение как дерево и остаток как остаток
      то «Вычислить дерево» от дерево
    случай вариант «Не разобрано» с ошибка как ошибка
      то вариант «Не посчитано» с ошибка равным ошибка
```

An operator node keeps the token of its sign, so division by zero names a
column as well: the one where the `/` stands. The function `«Напечатать ошибку
в тексте»` shows an error under its place:

```text insert output: run docs/examples/dsl/calculator.flang --function "Показать счёт" --args '{"текст":"2 + * 3"}'
$ flang run docs/examples/dsl/calculator.flang --function "Показать счёт" --args '{"текст":"2 + * 3"}'
доказано: утверждений 43
"строка 1, столбец 5: ожидалось: число, имя или скобка; встречено: знак *\n2 + * 3\n    ^"
```

The whole calculator is [`calculator.flang`](docs/examples/dsl/calculator.flang).
Every function in it is `тотальная` (total): on any string, a meaningless one
included, the calculator answers with a number or an error and never hangs.

```text insert output: test docs/examples/dsl/calculator.flang
$ flang test docs/examples/dsl/calculator.flang
docs/examples/dsl/calculator.flang: примеров 59, прошло 59, не прошло 0
```

The count includes the examples of `«Parsing»` itself: they run in every program
that imports the module.

### When the language is not expressions

For text of another shape (lists, `name = value` pairs, commands) the same
module has small parsers (`«Взять число»`, `«Взять имя»`, `«Взять знак»`: take a
number, a name, a sign) and functions that join them: `«Разобрать затем»`
(then), `«Разобрать или»` (or), `«Разобрать много»` (many), `«Разобрать через
разделитель»` (separated by), `«Разобрать необязательно»` (optional). Each rule
of the grammar is a named function of its own:

```flang fragment insert flang/stdlib/parsing.flang «Разобрать числа через запятую»
функция «Разобрать числа через запятую»
  принимает лексемы: «Лексемы»
  возвращает «Исход разбора» от список число
  «Разобрать через разделитель» от (функция «Взять число») и (функция «Взять знак» с знак равным ",") и лексемы
```

The full list with examples is in the [library reference](lib/parsing.html).

## 4. A checked language: an order state machine

An order is new, paid, shipped, delivered or cancelled. Describe the transitions
between the states in two ways and see which mistakes each one catches.

### As data

The machine is a record: the initial state, the lists of states and events, the
list of transitions. The function `«из»` (from) makes a transition line
readable:

```flang fragment insert docs/examples/dsl/order-automaton.flang «Заказ»
тотальная функция «Заказ»
  возвращает «Автомат»
  пусть состояния равно ["новый", "оплачен", "отгружен", "доставлен", "отменён"]
  пусть события равно ["оплата", "отгрузка", "вручение", "отмена"]
  запись «Автомат» с начало равным "новый" и состояния равным состояния и события равным события и переходы равным [
    («из» от "новый" и "оплата" и "оплачен"),
    («из» от "новый" и "отмена" и "отменён"),
    («из» от "оплачен" и "отгрузка" и "отгружен"),
    («из» от "оплачен" и "отмена" и "отменён"),
    («из» от "отгружен" и "вручение" и "доставлен")]
```

Since the machine is data, functions can look for mistakes in it. These are the
states that cannot be reached from the initial one:

```flang fragment insert docs/examples/dsl/order-automaton.flang «Недостижимые»
тотальная функция «Недостижимые»
  принимает автомат: «Автомат»
  возвращает список строки
  обеспечивает «недостижимых не больше, чем состояний» (длина результат) не больше (длина автомат.состояния)
  пусть достигнутые равно «Достижимые» от автомат
  отфильтровать автомат.состояния где текущее → не (достигнутые содержит текущее)
```

The requirement "there are no such states" is written as an example, so every
`flang check` verifies it:

```flang fragment insert docs/examples/dsl/order-automaton.flang «Недостижимые у заказа»
тотальная функция «Недостижимые у заказа»
  возвращает список строки
  пример «у заказа нет недостижимых состояний»
    ожидается []
  «Недостижимые» от «Заказ»
```

Break the machine: add the state «возвращён» (returned) and forget the
transition into it. The refusal names the forgotten state:

```text insert output: check docs/examples/dsl/refused/order-with-return.flang
$ flang check docs/examples/dsl/refused/order-with-return.flang
модуль «Заказ с возвратом»: функций 19, из них с доказанным завершением 19; типов 3; файлов вместе с импортами 2
FLANG_EXAMPLE: пример «у заказа с возвратом нет недостижимых состояний» функции «Недостижимые у заказа с возвратом»: значение не совпало с ожидаемым: ожидалось [], получено ["возвращён"]
docs/examples/dsl/refused/order-with-return.flang: не проверено — замечаний 1
$ echo $?
1
```

Two neighbouring checks in the file work the same way: `«Чужие имена»` finds
transitions with a misspelt state name, `«Двойные»` finds two transitions from
one state on one event.

The whole file: [`order-automaton.flang`](docs/examples/dsl/order-automaton.flang).

### As types

If the set of states is known in advance, make them variants of a type. Then a
misspelt state name is a compile error, and a transition is a `разбор`:

```flang insert docs/examples/dsl/order-automaton-typed.flang
модуль «Заказ типами»

тип «Этап»
  вариант «Новый»
  вариант «Оплачен»
  вариант «Отгружен»
  вариант «Доставлен»
  вариант «Отменён»

тип «Событие»
  вариант «Оплата»
  вариант «Отгрузка»
  вариант «Вручение»
  вариант «Отмена»

тотальная функция «Конечный»
  принимает этап: «Этап»
  возвращает признак
  разбор этап
    случай вариант «Доставлен»
      то да
    случай вариант «Отменён»
      то да
    случай любое
      то нет

тотальная функция «После»
  принимает этап: «Этап», событие: «Событие»
  возвращает «Этап»
  разбор этап
    случай вариант «Новый»
      то разбор событие
        случай вариант «Оплата»
          то вариант «Оплачен»
        случай вариант «Отмена»
          то вариант «Отменён»
        случай любое
          то этап
    случай вариант «Оплачен»
      то разбор событие
        случай вариант «Отгрузка»
          то вариант «Отгружен»
        случай вариант «Отмена»
          то вариант «Отменён»
        случай любое
          то этап
    случай вариант «Отгружен»
      то разбор событие
        случай вариант «Вручение»
          то вариант «Доставлен»
        случай любое
          то этап
    случай вариант «Доставлен»
      то этап
    случай вариант «Отменён»
      то этап

утверждение «доставленный заказ никуда не уходит»
  для всех событие: «Событие»
  утверждаем («После» от (вариант «Доставлен») и событие) равен (вариант «Доставлен»)

утверждение «отменённый заказ никуда не уходит»
  для всех событие: «Событие»
  утверждаем («После» от (вариант «Отменён») и событие) равен (вариант «Отменён»)
```

The two statements at the end are proved for any event: an order does not leave
a final state. Break a transition in two ways.

Delete the case `«Отменён»` (cancelled) from `«После»` and the compiler names
the state you forgot:

```text insert output: check docs/examples/dsl/refused/order-typed-missing-case.flang
$ flang check docs/examples/dsl/refused/order-typed-missing-case.flang
модуль «Заказ типами без отменённого»: функций 2, из них с доказанным завершением 2; типов 2
FLANG_MATCH_NOT_EXHAUSTIVE в файле docs/examples/dsl/refused/order-typed-missing-case.flang, строка 30, столбец 3: разбор «Этап» не покрывает «Отменён»
docs/examples/dsl/refused/order-typed-missing-case.flang: не проверено — замечаний 1
$ echo $?
1
```

Allow cancellation after delivery and the statement «доставленный заказ никуда
не уходит» (a delivered order goes nowhere) is no longer proved; `flang check
--proof` answers with code 3:

```bash
flang check docs/examples/dsl/unproved/order-typed-cancel-after-delivery.flang --proof
```

```text
…
  утверждение «доставленный заказ никуда не уходит» — объявлено, не доказано: ни теоремы, ни примеров. …
…
docs/examples/dsl/unproved/order-typed-cancel-after-delivery.flang: НЕ ПРОВЕРЕНО — утверждений 2: доказано 1, условно 0, сетка 0, объявлено, не доказано 1 …
```

Which one to choose: data when machines come from outside or there are many of
them; types when there is one machine and it lives in the code.

## 5. Traps

### The word is taken by the language

`правило` (rule), `состояние` (state), `закон` (law), `свойство` (property),
`поле` (field), `операция` (operation), `план` (plan), `процесс` (process),
`затем` (then), `после` (after) are keywords. The English spellings are taken
as well. A parameter or a field cannot be called that:

```text insert output: check docs/examples/dsl/refused/reserved-word.flang
$ flang check docs/examples/dsl/refused/reserved-word.flang
FLANG_PARSE в файле docs/examples/dsl/refused/reserved-word.flang, строка 10, столбец 66: не разобрана конструкция: неожиданное 'правило' — это слово занято языком, именем оно быть не может: напишите имя в ёлочках («правило») или переименуйте; а если слово попало в форму лишним — уберите его
docs/examples/dsl/refused/reserved-word.flang: не проверено — замечаний 1
$ echo $?
1
```

The refusal names the cure itself: another word, or guillemets. Types and
functions are always written in guillemets, which is why the type `«Правило»`
in section 2 is legal. All taken words are in the [glossary](../glossary.html).

### An example takes literals only

`дано` (given) and `ожидается` (expected) cannot call a function, not even your
own one without arguments:

```text insert output: check docs/examples/dsl/refused/example-needs-literal.flang
$ flang check docs/examples/dsl/refused/example-needs-literal.flang
FLANG_PARSE в файле docs/examples/dsl/refused/example-needs-literal.flang, строка 15, столбец 23: не разобрана конструкция: ожидалось литеральное значение — примеры не вычисляются: годятся число, строка, 'да', 'нет', 'ничто', список из них, слово 'u32 5', 'запись «Имя» с «поле» равным …' и 'вариант «Имя» с поле равным …'; одному имени в ёлочках нужно слово 'вариант' или 'запись' впереди
docs/examples/dsl/refused/example-needs-literal.flang: не проверено — замечаний 1
$ echo $?
1
```

Write a wrapper function without parameters and hang the example on it. Every
file on this page does so: `«Недостижимые у заказа»` wraps `«Недостижимые» от
«Заказ»`.

### Parsing nested text and the step budget

Parsing brackets calls itself: inside the brackets there is an expression
again. The compiler proves termination when a recursive call receives a part of
its argument, and here it receives "what was left after the nested parse", so
`тотальная` does not pass:

```text insert output: check docs/examples/dsl/refused/descent-without-fuel.flang
$ flang check docs/examples/dsl/refused/descent-without-fuel.flang
модуль «Спуск без запаса шагов»: функций 3, из них с доказанным завершением 1; типов 1
без доказанного завершения: «Скобки» «Закрыть»
FLANG_NOT_TOTAL в файле docs/examples/dsl/refused/descent-without-fuel.flang, строка 21, столбец 12: тотальная функция «Скобки»: вызов «Закрыть» в цикле «Скобки» → «Закрыть» не убывает — аргумент 1 («Скобки» от «хвост») не выведен ни из одного параметра. Передавайте часть аргумента: хвост списка из образца «голова и хвост», поле варианта из образца, поле записи или элемент коллекции
docs/examples/dsl/refused/descent-without-fuel.flang: не проверено — замечаний 1
$ echo $?
1
```

The way out is a step budget. Give every function of the cycle a first
parameter `запас: число` (budget), check `если запас не больше 0` at the start,
and pass `запас минус 1` to every call inside the cycle. The parameter has to
stand in the same position in all functions of the cycle: the compiler compares
arguments position by position.

```flang insert docs/examples/dsl/bracket-depth.flang
модуль «Глубина скобок»

тип «Счёт скобок»
  вариант «Счёт скобок» содержит глубина: число, остаток: список строки

тотальная функция «Глубже из двух»
  принимает глубина: число, дальше: «Счёт скобок»
  возвращает «Счёт скобок»
  если глубина больше дальше.глубина
    то вариант «Счёт скобок» с глубина равным глубина и остаток равным дальше.остаток
    иначе дальше

тотальная функция «Скобки»
  принимает запас: число, знаки: список строки
  возвращает «Счёт скобок»
  если запас не больше 0
    то вариант «Счёт скобок» с глубина равным 0 и остаток равным знаки
    иначе разбор знаки
      случай пусто
        то вариант «Счёт скобок» с глубина равным 0 и остаток равным знаки
      случай голова и хвост
        то «Скобки с головы» от (запас минус 1) и голова и знаки

тотальная функция «Скобки с головы»
  принимает запас: число, голова: строка, знаки: список строки
  возвращает «Счёт скобок»
  если запас не больше 0
    то вариант «Счёт скобок» с глубина равным 0 и остаток равным знаки
    иначе если голова равен "("
      то «Закрыть» от (запас минус 1) и («Скобки» от (запас минус 1) и (хвост знаки))
      иначе вариант «Счёт скобок» с глубина равным 0 и остаток равным знаки

тотальная функция «Закрыть»
  принимает запас: число, внутри: «Счёт скобок»
  возвращает «Счёт скобок»
  если запас не больше 0
    то внутри
    иначе разбор внутри.остаток
      случай пусто
        то внутри
      случай голова и хвост
        то «Глубже из двух» от (внутри.глубина плюс 1) и («Скобки» от (запас минус 1) и хвост)

тотальная функция «Глубина скобок»
  принимает текст: строка
  возвращает число
  пример «без скобок»
    дано текст равно ""
    ожидается 0
  пример «две пары рядом»
    дано текст равно "()()"
    ожидается 1
  пример «пара в паре, потом ещё пара»
    дано текст равно "(()())()"
    ожидается 2
  пусть знаки равно разложить текст на символы
  («Скобки» от (((длина знаки) умножить на 3) плюс 3) и знаки).глубина
```

The initial budget is computed from the length of the input, so on real data it
never runs out. The expression parser in `«Parsing»` is written the same way.
The functions that join parsers (`«Разобрать много»` and the others) are
declared without `тотальная`: they call a function you handed them and cannot
promise termination on its behalf.

### A false statement passes the ordinary check

A `пример` (example) is evaluated on every check. An `утверждение` (statement)
only with `--proof`. This file says something untrue about a machine with an
extra state:

```flang fragment insert docs/examples/dsl/unproved/false-statement.flang «у автомата с лишним состоянием нет недостижимых состояний»
утверждение «у автомата с лишним состоянием нет недостижимых состояний»
  утверждаем («Недостижимые» от «Автомат с лишним состоянием») равен пустой список
```

```text insert output: check docs/examples/dsl/unproved/false-statement.flang
$ flang check docs/examples/dsl/unproved/false-statement.flang
модуль «Ложное утверждение об автомате»: функций 18, из них с доказанным завершением 18; типов 3; файлов вместе с импортами 2
docs/examples/dsl/unproved/false-statement.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

With `--proof` the answer is different: "объявлено, не доказано" (declared, not
proved) and code 3. The rule is simple: write a requirement on particular data
as an example, a "for all" property as a statement, and run `flang check
--proof` in your build.

## 6. What the language does not have and what replaces it

| Not there | Instead |
| --- | --- |
| your own operators (`a <+> b`) | a function whose name is a phrase: `«лучшее из» от а и б` |
| macros and compile-time code generation | a type with variants and an interpreter function over it |
| your own notation inside a `.flang` file | an embedded language made of functions, or an external one parsed from a string |
| parsing built into the syntax (regular expressions, grammars) | the module `«Parsing»`; for regular expressions, `«Automaton»` |
| a function made on the spot (a lambda) | a declared function: `функция «Имя»`, with a capture `функция «Имя» с знак равным ","` |

A generic function (`от «А»`) cannot be passed as a value. That is why joining
parsers is written as a named function, like `«Разобрать числа через запятую»`
above, and not as an expression in place.

## 7. Where next

- [Library reference: Parsing](lib/parsing.html): every text-parsing function
  and its guarantees.
- [JSON](lib/json.html) and [TOML](lib/toml.html): two large parsers in
  the library, written as a pass over characters without recursion.
- [CLI](lib/cli.html): a language of command-line flags given by a
  declaration.
- [Which construct to use when](which-construct.html): recipes for the functions
  an interpreter is made of.
- [Proving by hand](manual-proofs.html): how to bring a property of your
  language to "proved".
- [Example catalogue](examples.html): the other sets, including two small
  languages of ready-made phrases in `docs/examples/dsl/`: shipping and access.
