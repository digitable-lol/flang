[Back to README](../../README.md) · [Documentation index](../README.md)

# How the compiler proves that a function terminates

What does the compiler use to prove that a function marked `тотальная` ends on
any arguments, and what do you do when it could not? This property is called
totality. A short introduction with an exercise is
[Functions that always terminate](../site/tour-termination.md).

| | `тотальная функция` (total) | plain `функция` |
| --- | --- | --- |
| recursion | must decrease in one of the three ways below | any |
| termination not proved | the error `FLANG_NOT_TOTAL`, the file does not pass the check | no check |
| a call from a `тотальная` function | allowed | not allowed |
| `flang facts` | evaluates it | does not evaluate it |
| a process handler | fits | needs the line `с запасом N витков` (a turn budget) |

## The error you will see first

The file `countdown.flang`:

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
$ flang check countdown.flang
модуль «Проба»: функций 1, из них с доказанным завершением 0; типов 0
без доказанного завершения: «Обратный отсчёт»
FLANG_NOT_TOTAL в файле countdown.flang, строка 8, столбец 11: тотальная функция «Обратный отсчёт»: рекурсивный вызов «Обратный отсчёт» не убывает — аргумент 1 («н» sub 1) уменьшает параметр «н», но снизу «н» ничем не ограничен: добавьте проверку вида «если н не больше 0». …
countdown.flang: не проверено — замечаний 1
```

The message names the call, the reason and the fix: "nothing bounds «н» from
below: add a check like «если н не больше 0»". `«н» sub 1` in it stands for
`н минус 1`. For the argument −1 the condition `равен 0` (equals 0) never
holds, and the calls never end. The exit code is 1.

Replace `равен 0` with `не больше 0` (not greater than 0), and the file passes
the check.

## Three ways to decrease

### 1. By a part of the value

The call receives the tail of a list, a field of a variant or a field of a
record. Nothing has to be declared. The file `length.flang`:

```flang
модуль «Проба»

тотальная функция «Число элементов»
  принимает элементы: список числа
  возвращает число
  пример «три элемента»
    дано элементы равно [7, 8, 9]
    ожидается 3
  разбор элементы
    случай пусто
      то 0
    случай голова и хвост
      то 1 плюс («Число элементов» от хвост)
```

```bash
$ flang check length.flang --proof --explain
…
  «Число элементов»  доказано структурой: аргумент 1 («элементы») на каждом витке становится частью себя; цепочка частей конечного дерева обрывается сама, сторожа нет
…
```

The `--explain` flag adds a line about every function to the report.
«доказано структурой» ("proved by structure") means that `хвост` (the tail) is
shorter than the list, and the list is finite. The last words of the line say
that there is no run-time check.

Two functions that call each other are checked the same way. It is enough that
on every round of calls some parameter becomes a part of itself. The file
`read.flang`:

```flang
модуль «Проба»

тип «Номер»
  вариант «Первый»
  вариант «Следующий» содержит пред: «Номер»

тотальная функция «Прочитать»
  принимает таблица: список неотрицательное, номер: «Номер»
  возвращает неотрицательное
  разбор таблица
    случай пусто
      то 0
    случай голова и хвост
      то «Прочитать в» от хвост и номер и голова

тотальная функция «Прочитать в»
  принимает ост: список неотрицательное, номер: «Номер», г: неотрицательное
  возвращает неотрицательное
  разбор номер
    случай «Первый»
      то г
    случай вариант «Следующий» с пред как п
      то «Прочитать» от ост и п
```

The list goes to `«Прочитать в»` as a tail and comes back unchanged. Every
round makes it one element shorter.

### 2. A number that decreases by a constant step

Two things are needed: the argument of the call is smaller than the parameter
by a constant, and there is a branch that stops the count. The file
`factorial.flang`:

```flang
модуль «Проба»

тотальная функция «Произведение до»
  принимает н: неотрицательное
  возвращает число
  пример «до пяти»
    дано н равно 5
    ожидается 120
  если н не больше 1
    то 1
    иначе н умножить на («Произведение до» от (н минус 1))
```

```bash
$ flang check factorial.flang --proof --explain
…
  «Произведение до»  доказано точным шагом: аргумент 1 («н») объявлен натуральным и убывает на 1; дно и потолок даёт тип, внутри потолка шаг точен — сторожа нет
…
```

The type `неотрицательное` is an integer from 0 to 2⁵³−1. It gives a lower and
an upper bound, so there is no run-time check.

With a parameter of type `число` the same function passes as well. The report
then says «доказано постоянным шагом … 1 место» ("proved by a constant step …
1 place"). One check stays in the program: on very large floating-point numbers
subtracting one does not change the value.

The step may be a parameter too. It needs a `требует` line with a strict bound
and a branch under which the difference stays non-negative. The file
`step.flang`:

```flang
модуль «Проба»

тотальная функция «Сколько шагов»
  принимает н: неотрицательное, ш: неотрицательное
  возвращает число
  требует «шаг положителен» ш не меньше 1
  пример «десять по три»
    дано н равно 10
    дано ш равно 3
    ожидается 3
  если н не меньше ш
    то 1 плюс («Сколько шагов» от (н минус ш) и ш)
    иначе 0
```

The call stands in the branch `если н не меньше ш` (if n is at least the
step). In the `иначе` branch of the condition `н меньше ш` the compiler does
not narrow the type of the difference, and the type check fails.

### 3. The line `убывает`

Sometimes what decreases is an expression over several parameters. It is named
in the line `убывает …` ("decreases") right after `возвращает`. The binary
search in
[`docs/examples/measure/binary-search.flang`](../examples/measure/binary-search.flang)
is written this way: `верх минус низ плюс 1` decreases there.

The compiler looks at every recursive call and gives one of three answers.

**Proved.** The expression is a parameter of type `неотрицательное`, and the
call passes it minus a constant. The file `two.flang`:

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

```bash
$ flang check two.flang --proof --explain
…
  «Через два»  доказано точным шагом: аргумент 1 («н») объявлен натуральным и убывает на 2; дно и потолок даёт тип, внутри потолка шаг точен — сторожа нет
…
```

**An error.** The call certainly does not decrease the expression: it passes
the name itself, `н плюс 1` or `3 умножить на н`. The file `forever.flang`:

```flang refused
модуль «Проба»

тотальная функция «Вечность»
  принимает н: число
  возвращает число
  убывает н
  «Вечность» от (н плюс 1)
```

```bash
$ flang check forever.flang
…
FLANG_NOT_TOTAL в файле forever.flang, строка 7, столбец 3: тотальная функция «Вечность»: мера «н» на вызове «Вечность» не убывает — аргумент «н» плюс 1 не меньше меры при любом её неотрицательном значении … перепишите вызов или меру
forever.flang: не проверено — замечаний 1
```

«мера» ("measure") in the message is the expression from the `убывает` line.
The exit code is 1.

**A run-time check.** In the other cases the compiler does not prove the
decrease. It inserts a check on every call into the program. The file
`closing.flang`:

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

`flang check closing.flang` answers «замечаний нет» (no errors). `flang run`
without a flag does not start such a function and returns code 3: its
termination is not proved. With `--trust` the run starts and stops at the
check:

```bash
$ flang run closing.flang --function "Сближение" --args '{"низ": 0, "верх": 5}' --trust
на веру: доказанность не считалась — запуск по ключу --trust
FLANG_MEASURE: тотальная функция «Сближение»: мера на вызове «Сближение» — «верх» минус «низ» — ушла ниже нуля. Мера обязана оставаться неотрицательной …
```

From 0 to 5 with a step of two the difference goes 5, 3, 1, −1. The expression
must stay a non-negative integer, so an error comes at −1. The exit code is 1.

The report shows how many such checks are left in the program:

```bash
$ flang check closing.flang --proof --explain
…
  «Сближение»  доказано объявленной мерой: убывает «верх» минус «низ»; спуск ядром не выведен — на веру: мера объявлена автором, сторож считает её при работе на каждом витке — 1 место
…
  сторожей в рантайме: 1 место
…
```

Both lines say one thing: the decrease is accepted without a proof and is
checked on every call. The last line counts such places over the whole file. The
exit code is 3; without `--explain` the same command prints «без доказательства
завершения: 1» (without a termination proof: 1).

If termination has to be proved completely, write the first or the second way.

## Counting up toward a bound

The file `up.flang`:

```flang refused
модуль «Проба»

тотальная функция «Счёт вверх»
  принимает н: число, предел: число
  возвращает число
  если н не меньше предел
    то н
    иначе «Счёт вверх» от (н плюс 1) и предел
```

```bash
$ flang check up.flang
…
FLANG_NOT_TOTAL в файле up.flang, строка 8, столбец 11: тотальная функция «Счёт вверх»: рекурсивный вызов «Счёт вверх» не убывает — аргумент 1 («н» add 1) увеличивает параметр «н»; аргумент 2 («предел») — это сам параметр «предел», а не его часть. …
up.flang: не проверено — замечаний 1
```

`«н» add 1` stands for `н плюс 1`. The parameter `предел` (the limit) does not
count as a bound by itself: it comes into every call unchanged. Name the
distance to the limit with the line `убывает предел минус н`, and give both
parameters the type `неотрицательное`:

```flang
модуль «Проба»

тотальная функция «Счёт вверх»
  принимает н: неотрицательное, предел: неотрицательное
  возвращает неотрицательное
  убывает предел минус н
  если н не меньше предел
    то н
    иначе «Счёт вверх» от (н плюс 1) и предел
```

```bash
$ flang check up.flang --proof --explain
…
  «Счёт вверх»  доказано объявленной мерой: убывает «предел» минус «н»; спуск выведен ядром на каждом витке (1) — сторожа нет
```

The kernel proves the descent itself: the call stands in the branch where
`н` is less than `предел`, so `предел минус н` gets smaller by one and stays
non-negative. The function needs no check at run time.

With the type `число` the same line is accepted without a proof and checked
on every call at run time: above 2⁵³ adding one does not change a number, and the call
might never end. Counting down works with either type.

A string is walked by recursion over the list of its characters: the form
`разложить … на символы` gives such a list. An example is
[`docs/examples/rosetta/reverse-string.flang`](../examples/rosetta/reverse-string.flang).

## Where proved termination is required

**`flang facts`.** The command answers whether a statement about data holds,
and it must not hang. It does not evaluate a plain function. The file
`digits.flang`:

```flang
модуль «Проба»

функция «Цифр в числе»
  принимает число: число
  возвращает число
  если число меньше 10
    то 1
    иначе 1 плюс («Цифр в числе» от («Цифр в числе» от число))
```

```bash
$ flang facts digits.flang --claims '["«Цифр в числе» от 5 равно 1"]'
{"ok":false,"results":[{"claim":"«Цифр в числе» от 5 равно 1","holds":false,"why":"функция «Цифр в числе» не помечена как «тотальная»; факт-чекинг допускает только тотальные функции — иначе ответ может не наступить", …,"status":"refused"}]}
```

The `why` field names the reason: the function is not marked `тотальная`. The
exit code is 1.

**A process handler.** A flang server runs forever, but every call of a handler
must end. A handler without `тотальная` and without the line
`с запасом N витков` does not pass the check:

```bash
$ flang check docs/examples/web/shortener/handler-without-budget.flang
…
FLANG_HANDLER_NOT_TOTAL в файле docs/examples/web/shortener/handler-without-budget.flang, строка 13, столбец 1: обработчик «шаг разбора» процесса «Разборщик» не помечен тотальным, и запаса витков процесс не называет: строки «с запасом N витков» нет. …
…
docs/examples/web/shortener/handler-without-budget.flang: не проверено — замечаний 2
```

The second error in the same output, `FLANG_UNCOVERED_FAILURE`, is about the
consequence: the process may fail, and nothing restarts it. The exit code is 1.

## Next

- [Functions that always terminate](../site/tour-termination.md) — the same in
  short, with an exercise
- [What loops and classes are rewritten into](surface-sugar.md) — how
  termination is proved for loops
- [Processes and supervision](../site/processes.md) — handlers and the turn
  budget
