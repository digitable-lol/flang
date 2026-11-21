# Functions that always terminate

What does the word `тотальная` before a function mean, and what do you do when
the compiler answers `FLANG_NOT_TOTAL`? The fourth page of the tour, 5–10
minutes long. It follows
[Branching, matching and recursion](tour-branching-and-recursion.html).

`тотальная функция` ("total function") is a function for which the compiler
has proved that it terminates on any arguments. Rust and TypeScript have no
such check; there, endless recursion is found at run time.

## Recursion that may not end

Save this as `countdown.flang`:

```flang refused insert docs/examples/tour/termination/refused/countdown.flang
модуль «Countdown»

тотальная функция «Сумма до»
  принимает н: число
  возвращает число
  пример «до трёх»
    дано н равно 3
    ожидается 6
  если н равен 0
    то 0
    иначе н плюс («Сумма до» от (н минус 1))
```

The test passes: 3 + 2 + 1 = 6. The check does not:

```text insert output: check docs/examples/tour/termination/refused/countdown.flang
$ flang check docs/examples/tour/termination/refused/countdown.flang
модуль «Countdown»: функций 1, из них с доказанным завершением 0; типов 0
без доказанного завершения: «Сумма до»
FLANG_NOT_TOTAL в файле docs/examples/tour/termination/refused/countdown.flang, строка 11, столбец 19: тотальная функция «Сумма до»: рекурсивный вызов «Сумма до» не убывает — аргумент 1 («н» sub 1) уменьшает параметр «н», но снизу «н» ничем не ограничен: добавьте проверку вида «если н не больше 0». Передавайте часть аргумента: хвост списка из образца «голова и хвост», поле варианта из образца, поле записи или элемент коллекции
docs/examples/tour/termination/refused/countdown.flang: не проверено — замечаний 1
$ echo $?
1
```

The compiler is right. For the argument −1 the condition `н равен 0` ("n
equals 0") never holds, and the calls go on: −2, −3, … The message names the
call (line 11), the parameter and the reason: «снизу „н“ ничем не ограничен»,
"nothing bounds n from below". `«н» sub 1` in it stands for `н минус 1`. The
exit code is 1.

## The fix: a type with a lower bound

The type `неотрицательное` ("non-negative") is an integer from 0 to 2⁵³−1;
`u64` in Rust is the closest. With it, and with the condition `не больше 0`
("not greater than 0"), negative arguments do not exist:

```flang insert docs/examples/tour/termination/countdown.flang
модуль «Countdown»

тотальная функция «Сумма до»
  принимает н: неотрицательное
  возвращает число
  пример «до трёх»
    дано н равно 3
    ожидается 6
  если н не больше 0
    то 0
    иначе н плюс («Сумма до» от (н минус 1))
```

```text insert output: check docs/examples/tour/termination/countdown.flang
$ flang check docs/examples/tour/termination/countdown.flang
модуль «Countdown»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/tour/termination/countdown.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

The proof report says what proved termination:

```text insert output: check docs/examples/tour/termination/countdown.flang --proof 2>&1 | grep "Сумма до"
$ flang check docs/examples/tour/termination/countdown.flang --proof 2>&1 | grep "Сумма до"
  «Сумма до»  доказано точным шагом: аргумент 1 («н») объявлен натуральным и убывает на 1; дно и потолок даёт тип, внутри потолка шаг точен — сторожа нет
```

The argument decreases by one and is bounded by its type from below and from
above. The last two words of the line mean that no run-time check is needed.

A negative argument is rejected at the call, with exit code 1:

```text insert output: run docs/examples/tour/termination/countdown.flang --function "Сумма до" --args '{"н": -3}'
$ flang run docs/examples/tour/termination/countdown.flang --function "Сумма до" --args '{"н": -3}'
доказано: утверждений 0
FLANG_TYPE: вызов функции «Сумма до»: аргумент «н»: -3 вне неотрицательное
$ echo $?
1
```

## When the decrease is not visible in the code

Save this as `steps.flang`:

```flang insert docs/examples/tour/termination/steps.flang
модуль «Steps»

тотальная функция «НОД»
  принимает а: число, б: число
  возвращает число
  убывает б
  пример «двенадцать и восемнадцать»
    дано а равно 12
    дано б равно 18
    ожидается 6
  если б равен 0
    то а
    иначе «НОД» от б и (а остаток от б)

функция «Шагов до единицы»
  принимает н: число
  возвращает число
  пример «шесть приходит к единице за восемь шагов»
    дано н равно 6
    ожидается 8
  если н не больше 1
    то 0
    иначе если (н остаток от 2) равен 0
      то 1 плюс («Шагов до единицы» от (н делить на 2))
      иначе 1 плюс («Шагов до единицы» от (3 умножить на н плюс 1))
```

```text insert output: check docs/examples/tour/termination/steps.flang
$ flang check docs/examples/tour/termination/steps.flang
модуль «Steps»: функций 2, из них с доказанным завершением 1; типов 0
без доказанного завершения: «Шагов до единицы»
docs/examples/tour/termination/steps.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

The file shows two more ways.

**The line `убывает б`** ("b decreases"). In Euclid's algorithm the second
argument gets smaller, but the compiler cannot see that from `а остаток от б`.
The line `убывает` names an expression that must decrease on every call:

```text insert output: check docs/examples/tour/termination/steps.flang --proof 2>&1 | grep "НОД"
$ flang check docs/examples/tour/termination/steps.flang --proof 2>&1 | grep "НОД"
  «НОД»               доказано объявленной мерой: убывает «б»; спуск ядром не выведен — на веру: мера объявлена автором, сторож считает её при работе на каждом витке — 1 место
```

The second half of the line means that the decrease is not proved; it is
checked on every call at run time. On fractional numbers the
check fires, and an error comes instead of endless recursion:

```text insert output: run docs/examples/tour/termination/steps.flang --function НОД --args '{"а": 1.5, "б": 0.4}'
$ flang run docs/examples/tour/termination/steps.flang --function НОД --args '{"а": 1.5, "б": 0.4}'
доказано: утверждений 0
FLANG_MEASURE: тотальная функция «НОД»: мера на вызове «НОД» — «б» — перестала быть целой. Целость — это то, чем мера вообще что-то доказывает: строго убывающая цепочка целых неотрицательных чисел не длиннее своего первого члена, а дробная не обрывается вовсе (0.618, 0.382, 0.236 … больше нуля всегда). Отказ здесь честнее зацикливания
$ echo $?
1
```

**A function without the word `тотальная`.** Nobody knows whether
`«Шагов до единицы»` ("steps down to one") ends for every number: it is an open
problem of mathematics. Such a function is declared as plain `функция`. The
compiler checks its types and tests, and about termination it says «без
доказанного завершения», "termination not proved".

A plain function cannot be called from a `тотальная` one; that is a
`FLANG_NOT_TOTAL` error too.

## What to choose

| Way | When | Cost |
| --- | --- | --- |
| `разбор` over a list or your own type | the function walks data part by part | none |
| the type `неотрицательное` and a step of one | counting down to zero | none |
| the line `убывает expression` | there is a decrease, but the code does not show it | a check on every call |
| `функция` without `тотальная` | the algorithm may not end | it cannot be called from a `тотальная` function |

Try the ways from top to bottom.

## Check yourself

`«Цифр в числе»` ("digits in a number") drops the last digit until the number
is less than ten. The starting file `digits.flang` does not pass the check:

```flang refused insert docs/examples/tour/exercises/4-digits/stub/digits.flang
модуль «Exercise 4»

тотальная функция «Цифр в числе»
  принимает н: число
  возвращает число
  пример «в сорока двух две цифры»
    дано н равно 42
    ожидается 2
  пример «в семёрке одна»
    дано н равно 7
    ожидается 1
  если н меньше 10
    то 1
    иначе 1 плюс («Цифр в числе» от ((н минус (н остаток от 10)) делить на 10))
```

```text insert output: check docs/examples/tour/exercises/4-digits/stub/digits.flang
$ flang check docs/examples/tour/exercises/4-digits/stub/digits.flang
модуль «Exercise 4»: функций 1, из них с доказанным завершением 0; типов 0
без доказанного завершения: «Цифр в числе»
FLANG_NOT_TOTAL в файле docs/examples/tour/exercises/4-digits/stub/digits.flang, строка 14, столбец 19: тотальная функция «Цифр в числе»: рекурсивный вызов «Цифр в числе» не убывает — аргумент 1 («н» sub «н» mod 10 div 10) не выведен ни из одного параметра. Передавайте часть аргумента: хвост списка из образца «голова и хвост», поле варианта из образца, поле записи или элемент коллекции
docs/examples/tour/exercises/4-digits/stub/digits.flang: не проверено — замечаний 1
$ echo $?
1
```

The argument of the call looks neither like "the parameter minus one" nor like
a part of a list. Add one line to make the check pass.

<details>
<summary>Solution</summary>

```flang insert docs/examples/tour/exercises/4-digits/solution/digits.flang
модуль «Exercise 4»

тотальная функция «Цифр в числе»
  принимает н: число
  возвращает число
  убывает н
  пример «в сорока двух две цифры»
    дано н равно 42
    ожидается 2
  пример «в семёрке одна»
    дано н равно 7
    ожидается 1
  если н меньше 10
    то 1
    иначе 1 плюс («Цифр в числе» от ((н минус (н остаток от 10)) делить на 10))
```

```text insert output: check docs/examples/tour/exercises/4-digits/solution/digits.flang
$ flang check docs/examples/tour/exercises/4-digits/solution/digits.flang
модуль «Exercise 4»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/tour/exercises/4-digits/solution/digits.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

</details>

## Next

- [Your own types](tour-types.html) — the next page of the tour
- [Termination in detail](totality.html) — every way termination is proved and
  where each one stops
- [Your first proof](first-proof.html) — how to prove that a function returns
  the right result
