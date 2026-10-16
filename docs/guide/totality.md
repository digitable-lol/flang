[Back to README](../../README.md) · [Documentation index](../README.md)

# What `тотальная` buys you

`тотальная` in front of `функция` is a promise to the compiler: this function
terminates on every input. Two of the three ways below the compiler proves at
build time, and without a proof it will not build the file; for the third the
check moves to run time, and that has a section of its own below. A function
without the marker may be written any way you like, but it cannot be called from
the fact checker (`flang facts`) or from a process handler.

The sample files below have short names — `nt1.flang`, `nt2.flang` and so on; the
refusals are quoted verbatim, file name included, exactly as the compiler prints
them.

|                       | `тотальная`                                    | plain `функция`            |
| --------------------- | ---------------------------------------------- | -------------------------- |
| recursion             | must decrease one of the three ways below       | any                        |
| on failure            | `FLANG_NOT_TOTAL`, the file does not build      | —                          |
| `flang facts`         | accepts it                                      | refuses it                 |
| process handler       | fine                                            | needs a fuel bound         |

## The first refusal you will see

```flang refused
модуль «Проба»

тотальная функция «Обратный отсчёт»
  принимает н: число
  возвращает число
  если н равен 0
    то 0
    иначе «Обратный отсчёт» от (н минус 1)
```

```bash
flang check nt1.flang
```

```
модуль «Проба»: функций 1, из них с доказанным завершением 0; типов 0
без доказанного завершения: «Обратный отсчёт»
FLANG_NOT_TOTAL в файле nt1.flang, строка 8, столбец 11: тотальная функция «Обратный отсчёт»: рекурсивный вызов «Обратный отсчёт» не убывает — аргумент 1 («н» sub 1) уменьшает параметр «н», но снизу «н» ничем не ограничен: добавьте проверку вида «если н не больше 0». Передавайте часть аргумента: хвост списка из образца «голова и хвост», поле варианта из образца, поле записи или элемент коллекции
nt1.flang: не проверено — замечаний 1
```

The refusal names both the place and the cure. The difference between `равен 0`
and `не больше 0` is not a matter of taste: at `н` equal to `-1` the first check
does not fire and the chain runs to minus infinity. One word, and the file builds:

```flang
тотальная функция «Обратный отсчёт»
  принимает н: число
  возвращает число
  пример «Считает до нуля»
    дано н равно 5
    ожидается 0
  если н не больше 0
    то 0
    иначе «Обратный отсчёт» от (н минус 1)
```

```bash
flang test nt2.flang
```

```
nt2.flang: примеров 1, прошло 1, не прошло 0
```

## Three ways to decrease

### 1. By a part of the value

The tail of a list, a field of a variant, a field of a record. Nothing to
declare — the compiler sees it. Half the library is written this way; here is
`«Длина»` from [`flang/stdlib/lists.flang`](../../flang/stdlib/lists.flang):

```flang
тотальная функция «Длина» от «А»
  принимает элементы: список «А»
  возвращает число
  обеспечивает «счёт звеньев сходится со встроенной длиной» результат равен (длина элементы)
  пример «Три элемента»
    дано элементы равно [7, 8, 9]
    ожидается 3
  разбор элементов
    случай пусто
      то 0
    случай голова и хвост
      то 1 плюс «Длина» от хвоста
```

`хвоста` is a part of `элементов`, not a new value. That is enough.

### 2. A constant step with a floor

A number that shrinks by a constant, plus a branch that stops the descent. Both
are required: without the step the chain may not decrease at all, without the
floor it runs to minus infinity. `«Факториал»` from
[`flang/stdlib/numbers.flang`](../../flang/stdlib/numbers.flang):

```flang
тотальная функция «Факториал»
  принимает число: неотрицательное
  возвращает число
  обеспечивает «факториал не меньше единицы» 1 не больше результат
  пример «Пять факториал»
    дано число равно 5
    ожидается 120
  если число не больше 1
    то 1
    иначе число умножить на («Факториал» от (число минус 1))
```

A parameter works as the step too (`н минус ш`) — provided it arrives in the call
unchanged in its own position and is known to be strictly `ш больше 0`. Without
the strict bound the step may be zero, and a changing step never reaches the
floor at all: `ш`, `ш делить на 2`, … add up to less than `2ш`.

### 3. A declared measure, `убывает`

For when what decreases is not an argument but an expression over them. The
`убывает …` line goes right after `возвращает`. The full example is
[`docs/examples/measure/binary-search.flang`](../examples/measure/binary-search.flang):

```flang
тотальная функция «Поиск в диапазоне»
  принимает элементы: список числа, цель: число, низ: число, верх: число
  возвращает число
  убывает верх минус низ плюс 1
  если низ больше верх
    то -1
    иначе
      пусть сумма равно низ плюс верх
      пусть середина равно (сумма минус (сумма остаток от 2)) делить на 2
      пусть значение равно элемент середина в элементы
      если значение равен цель
        то середина минус 1
        иначе
          если значение меньше цель
            то «Поиск в диапазоне» от элементы и цель и (середина плюс 1) и верх
            иначе «Поиск в диапазоне» от элементы и цель и низ и (середина минус 1)
```

```bash
flang test docs/examples/measure/binary-search.flang
```

```
docs/examples/measure/binary-search.flang: примеров 5, прошло 5, не прошло 0
```

## `убывает`: proved, refused, or checked at run time

The first two ways the compiler proves. For the third it reads every recursive
call by the shape of its argument and gives one of three answers.

**Proved.** A measure declared on a `неотрицательное` parameter, and a call that
passes that parameter minus a constant: the type gives the floor and the ceiling,
and the step is exact. No check is left in the generated code:

```flang
модуль «Проба»

тотальная функция «Через два»
  принимает н: неотрицательное
  возвращает число
  убывает н
  если н не больше 1
    то н
    иначе «Через два» от (н минус 2)
```

```
  «Через два»  доказано точным шагом: аргумент 1 («н») объявлен натуральным и убывает на 2; дно и потолок даёт тип, внутри потолка шаг точен — сторожа нет
```

**Refused.** A call that cannot lower the measure — the name itself, `н плюс 1`,
`(3 умножить на н) плюс 1` — is refused at `check` time, naming the call and the
argument:

```flang refused
модуль «Проба»

тотальная функция «Вечность»
  принимает н: число
  возвращает число
  убывает н
  «Вечность» от (н плюс 1)
```

```
FLANG_NOT_TOTAL в файле nt7.flang, строка 7, столбец 3: тотальная функция «Вечность»: мера «н» на вызове «Вечность» не убывает — аргумент «н» плюс 1 не меньше меры при любом её неотрицательном значении (Мер✗: само имя, сумма с неотрицательным литералом, произведение на литерал не меньше единицы). Спуск этим вызовом не доказуем, и сторож при работе отказал бы на первом же таком витке; перепишите вызов или меру
```

**Checked at run time.** Everything else is taken on the author's word and
turned into a check inside the generated code. The build passes:

```flang
модуль «Проба»

тотальная функция «Сближение»
  принимает низ: число, верх: число
  возвращает число
  убывает верх минус низ
  если верх не больше низ
    то низ
    иначе «Сближение» от (низ плюс 2) и верх
```

```bash
flang check nt6.flang
```

```
модуль «Проба»: функций 1, из них с доказанным завершением 1; типов 0
nt6.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

The run does not. From `0` to `5` in steps of two the measure goes 5, 3, 1, −1,
and the check stops it:

```bash
flang run nt6.flang --function "Сближение" --args '{"низ": 0, "верх": 5}'
```

```
FLANG_MEASURE: тотальная функция «Сближение»: мера на вызове «Сближение» — «верх» минус «низ» — ушла ниже нуля. Мера обязана оставаться неотрицательной: иначе цепочка уходит в минус бесконечность и убывание ничего не доказывает. Чаще всего это выбор меры, а не ошибка вызова — мере, которая на последнем витке становится −1, обычно не хватает «плюс 1»
```

The proof report says which answer each function got:

```bash
flang check nt6.flang --proof
```

```
чем несётся обещание «тотальная»:
  «Сближение»  доказано объявленной мерой: убывает «верх» минус «низ»; спуск ядром не выведен — на веру: мера объявлена автором, сторож считает её при работе на каждом витке — 1 место

итог:
  функций 1: тотальных 1, обычных 0
  обещание несёт: композиция 0, структура 0, точный шаг 0, постоянный шаг 0, объявленная мера 1
  сторожей в рантайме: 1 место
```

The practical rule: if termination has to be proven rather than watched, use the
first or the second way, or a measure on a `неотрицательное` parameter with a
constant step. The `сторожей в рантайме` line of the report counts the places in
your program that are not proven all the way.

## Counting up is not a measure

```flang
тотальная функция «Счёт вверх»
  принимает н: число, предел: число
  возвращает число
  если н не меньше предел
    то н
    иначе «Счёт вверх» от (н плюс 1) и предел
```

```
FLANG_NOT_TOTAL в файле nt3.flang, строка 8, столбец 11: тотальная функция «Счёт вверх»: рекурсивный вызов «Счёт вверх» не убывает — аргумент 1 («н» add 1) увеличивает параметр «н»; аргумент 2 («предел») — это сам параметр «предел», а не его часть. Передавайте часть аргумента: хвост списка из образца «голова и хвост», поле варианта из образца, поле записи или элемент коллекции
```

`предел` cannot serve as the floor: it is a parameter rather than a number, and it
arrives unchanged on every turn. Turn the count around and go down.

String code crossed the same border differently: the built-in form
`разложить … на символы` turns a string into a list of one-character strings by
code points, and the walk becomes recursion over a tail. That is why
[`docs/examples/rosetta/reverse-string.flang`](../examples/rosetta/reverse-string.flang)
is total throughout, emoji and Cyrillic included.

## Why it is worth it: the fact checker refuses non-total functions

`flang facts` answers "does this claim hold about this data", and it is not
allowed to hang. A non-total function it does not evaluate at all — here recursion
goes through the function's OWN result rather than a part of the value, so there
is nothing to prove termination with:

```flang
функция «Цифр в числе»
  принимает число: число
  возвращает число
  если число меньше 10
    то 1
    иначе 1 плюс («Цифр в числе» от («Цифр в числе» от число))
```

```bash
flang facts fc1.flang --claims '["«Цифр в числе» от 5 равно 1"]'
```

```json
{"ok":false,"results":[{"claim":"«Цифр в числе» от 5 равно 1","holds":false,"why":"функция «Цифр в числе» не помечена как «тотальная»; факт-чекинг допускает только тотальные функции — иначе ответ может не наступить","steps":[…],"status":"refused"}]}
```

Exit code 1. The mode has no file, network or clock access, and a hard step
budget: the answer depends only on `(program, facts, claims, limits)`, which is
what makes it reproducible.

## Processes: the rule is written down, the check exists, the code differs

By the specification a server in flang is an infinite sequence of terminating
turns: the scheduler is infinite, the handler it calls must terminate. A handler
that is neither `тотальная` nor carries `с запасом N витков` should not get
through — code `FLANG_HANDLER_NOT_TOTAL`.

The binary judges it, but answers with a different code. Here is what
it answers on
[`docs/examples/web/shortener/handler-without-budget.flang`](../examples/web/shortener/handler-without-budget.flang),
a file written precisely to test this rule:

```
FLANG_UNCOVERED_FAILURE в файле docs/examples/web/shortener/handler-without-budget.flang, строка 13, столбец 1: у процесса «Разборщик» обработчик «шаг разбора» без доказанного завершения — значит отказ «запас витков исчерпан» достижим, — а под надзором этот процесс не стоит: такой отказ уронит программу целиком
…
docs/examples/web/shortener/handler-without-budget.flang: не проверено — замечаний 2
```

Exit code 1. `FLANG_HANDLER_NOT_TOTAL` is still not issued: a non-total handler
without a budget is caught as an uncovered failure (`FLANG_UNCOVERED_FAILURE`),
not under the name from the specification.
