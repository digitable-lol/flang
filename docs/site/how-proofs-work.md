# How a proof works
<!-- замер: версия 0.7.34 · дерево 001d8df7c · сверено 2026-11-10 -->

The compiler checks three kinds of statements about a function:

| You write | Usual term | What it means | Where it is checked |
| --- | --- | --- | --- |
| `тотальная` (total) | termination | the function stops on every input | in the function itself |
| `требует` (requires) | precondition | what must hold on input | at every call site and at the program's entry |
| `обеспечивает` (ensures) | postcondition | what the function guarantees on output | for all inputs, not only for the examples |

Each is shown below on a small file with the output of
`flang {{выпуск.версия}}`. Long output lines are wrapped, and `…` marks a cut.
In compiler output «ядро» (kernel) is the prover, the part of the compiler that
proves postconditions, and `сторож` (guard) is a check the compiler adds to the
generated code.

## Termination

The recursive call gets a part of the input: the tail of the list. A part is
smaller than the whole and lists are finite, so the recursion ends:

```flang
модуль «Спуск»

тотальная функция «Сумма списка»
  принимает ряд: список числа
  возвращает число
  разбор ряд
    случай пусто
      то 0
    случай голова первый и хвост остальные
      первый плюс («Сумма списка» от остальные)
```

```
$ flang check --proof spusk.flang
  «Сумма списка»  доказано структурой: аргумент 1 («ряд») на каждом витке
  становится частью себя; цепочка частей конечного дерева обрывается сама,
  сторожа нет
```

"Proved by structure: argument 1 becomes a part of itself on every turn; no
guard."

When the recursion counts a number down, the outcome depends on the type:

```flang
модуль «Отсчёт»

тотальная функция «Обратный отсчёт»
  принимает н: число
  возвращает число
  если н не больше 0
    то 0
    иначе 1 плюс («Обратный отсчёт» от (н минус 1))
```

```
$ flang check --proof otschyot.flang
  «Обратный отсчёт»  доказано постоянным шагом: аргумент 1 («н») убывает на
  постоянный шаг и ограничен снизу; на IEEE-754 шаг не всегда меняет число,
  поэтому сторож, 1 место
```

`число` (number) is a binary64 float, and above 2⁵³ subtracting one does not
change it. So one check stays in the generated code ("guard, 1 place"). Change
the type to `неотрицательное` (non-negative: the range [0, 2⁵³−1], where
subtracting one is exact) and the check is gone:

```
  «Обратный отсчёт»  доказано точным шагом: аргумент 1 («н») объявлен
  натуральным и убывает на 1; дно и потолок даёт тип, внутри потолка шаг точен
  — сторожа нет
```

If what decreases is not an argument but an expression over the arguments, name
it in a `убывает` (decreases) line:

```flang
модуль «Мера»

тотальная функция «Шагов до края»
  принимает место: число, край: число
  возвращает число
  убывает край минус место
  если место не меньше край
    то 0
    иначе 1 плюс («Шагов до края» от (место плюс 1) и край)
```

```
  «Шагов до края»  доказано объявленной мерой: убывает «край» минус «место»;
  спуск ядром не выведен — на веру: мера объявлена автором, сторож считает её
  при работе на каждом витке — 1 место
```

"By the declared measure; the descent is not derived by the kernel, so a guard
computes the measure on every turn — 1 place."

A function whose termination is not proved is an error, not a warning:

```flang refused
модуль «Растёт»

тотальная функция «До нуля»
  принимает н: число
  возвращает число
  если н равен 0
    то 0
    иначе «До нуля» от (н плюс 1)
```

```
$ flang check rastyot.flang; echo "exit $?"
модуль «Растёт»: функций 1, из них с доказанным завершением 0; типов 0
без доказанного завершения: «До нуля»
FLANG_NOT_TOTAL в файле rastyot.flang, строка 8, столбец 11: тотальная функция
«До нуля»: рекурсивный вызов «До нуля» не убывает — аргумент 1 («н» add 1)
увеличивает параметр «н». Передавайте часть аргумента: хвост списка из образца
«голова и хвост», поле варианта из образца, поле записи или элемент коллекции
rastyot.flang: не проверено — замечаний 1
exit 1
```

The message says the recursive call does not decrease: argument 1 grows. If the
function really may run forever, drop `тотальная`. A `цикл` (loop) block does
not bypass termination: the compiler expands it into a fold or a total function
and checks the expansion.

## `требует`: the precondition

A precondition is proved not by the function but by whoever calls it:

```flang refused
модуль «Заказ»

тотальная функция «Цена со скидкой»
  принимает цена: неотрицательное, скидка: неотрицательное
  требует «скидка не больше цены» скидка не больше цена
  возвращает число
  цена минус скидка

тотальная функция «Счёт»
  возвращает число
  «Цена со скидкой» от 100 и 150
```

```
$ flang check zakaz.flang; echo "exit $?"
модуль «Заказ»: функций 2, из них с доказанным завершением 2; типов 0
FLANG_PRECONDITION_CALL в файле zakaz.flang, строка 11, столбец 3: вызов «Цена
со скидкой» в функции «Счёт» не снимает предусловие «скидка не больше цены»:
… вызывающему здесь известно: собственных «требует» — 0, объявленных типов у
параметров — 0, доказанных обещаний вызванных в доводе — 0; условие ветвления
фактом ядру не является (граница названа в шапке файла)
zakaz.flang: не проверено — замечаний 1
exit 1
```

The end of the message lists where the caller can take the missing fact from:
its own `требует`, the declared type of its parameter, or a proved postcondition
of the function that computed the argument. With its own `требует` the file
passes:

```flang
модуль «Заказ»

тотальная функция «Цена со скидкой»
  принимает цена: неотрицательное, скидка: неотрицательное
  требует «скидка не больше цены» скидка не больше цена
  возвращает число
  цена минус скидка

тотальная функция «Счёт»
  принимает цена: неотрицательное, скидка: неотрицательное
  требует «скидка по карману» скидка не больше цена
  возвращает число
  «Цена со скидкой» от цена и скидка
```

Calls inside the program are checked at compile time and carry no run-time
check. The check stands in one place: at the entry, where data comes from
outside:

```
$ flang run zakaz.flang --function 'Цена со скидкой' --args '{"цена": 100, "скидка": 150}'
FLANG_PRECONDITION: не выполнено требование «скидка не больше цены» функции «Цена со скидкой»
$ echo $?
1
```

An example whose input breaks `требует` is rejected by `flang check`:

```
FLANG_EXAMPLE: пример «скидка больше цены» функции «Цена со скидкой»:
FLANG_PRECONDITION: не выполнено требование «скидка не больше цены» функции
«Цена со скидкой»
```

## `обеспечивает`: the postcondition and the three answers

The prover answers every postcondition with one of three words. This file has
all three:

```flang
модуль «Три ответа»

тотальная функция «Цена со скидкой»
  принимает цена: неотрицательное, скидка: неотрицательное
  требует «скидка не больше цены» скидка не больше цена
  возвращает число
  обеспечивает «в минус не уходим» результат не меньше 0
  пример «сто минус десять»
    дано цена равно 100
    дано скидка равно 10
    ожидается 90
  цена минус скидка

тотальная функция «Удвоить»
  принимает х: целое
  возвращает число
  обеспечивает «результат чётный» (результат остаток от 2) равно 0
  пример «единица»
    дано х равно 1
    ожидается 2
  х умножить на 2

тотальная функция «Утроить»
  принимает х: целое
  возвращает число
  обеспечивает «результат кратен трём» (результат остаток от 3) равно 0
  х умножить на 3
```

```
$ flang check --proof tri.flang; echo "exit $?"
  постусловие «в минус не уходим» функции «Цена со скидкой» — доказано по
  объявленным типам аргументов: цель сведена правилом «неотрицательность по
  построению» — утверждение обо ВСЕХ входах, а не о написанных; теоремы при
  нём нет и не нужно
  постусловие «результат чётный» функции «Удвоить» — сетка 1 значение (примеры
  функции): нарушений на них нет: проверка прогнала каждый пример и посчитала
  постусловие на его ответе. Это не доказательство — теоремы при утверждении нет
  постусловие «результат кратен трём» функции «Утроить» — объявлено, не
  доказано: ни теоремы, ни примеров. Его считает рантайм после каждого
  возврата — на тех входах, которые придут
…
  утверждений 3: доказано 1 (из них без теоремы 1, объявленным типом 1),
  сетка 1, объявлено, не доказано 1
exit 3
```

| The report says | What it means | At run time |
| --- | --- | --- |
| «доказано» (proved) | true for all inputs | no check |
| «сетка N» (grid of N) | passed on the function's N examples, like a unit test; nothing about other inputs | checked on every return |
| «объявлено, не доказано» (declared, not proved) | neither a proof nor an example | checked on every return |

The last two postconditions are true, but the prover did not derive them. Only
«доказано» counts; how to get the rest there is on
[What the kernel proves by itself](what-the-kernel-accepts.html) and
[Proofs by hand](manual-proofs.html).

Exit codes: plain `flang check` gives 0 on this file — an unproved
postcondition is not an error. With `--proof`, 0 means "everything is proved"
and 3 means "something is not". `--proof --strict` also gives 3 where there are
no postconditions at all.

### A false postcondition

Remove the `требует` line from «Цена со скидкой». The postcondition becomes
false, and the compiler finds an input that breaks it by itself:

```
$ flang check skidka.flang; echo "exit $?"
модуль «Скидка»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_EXAMPLE: FLANG_PROPERTY: постусловие «в минус не уходим» функции «Цена
со скидкой» нарушено на входе цена = 0, скидка = 1 — посчитано вычислителем на
этом входе
skidka.flang: не проверено — замечаний 1
exit 1
```

### Unproved code runs only with consent

```
$ flang run tri.flang --function 'Удвоить' --args '{"х": 3}'; echo "exit $?"
не доказано: утверждений 3: доказано 1, сетка 1, на веру 1 — запуск только по
явному согласию: --на-веру
…
exit 3
$ flang run tri.flang --function 'Удвоить' --args '{"х": 3}' --trust
на веру: доказанность не считалась — запуск по ключу --trust
6
```

In Cyrillic the flag is `--на-веру`.

### What is proved leaves the generated code

```
$ flang emit tri.flang --target c --out out
проверок при работе снято 1: постусловие доказано ядром обо всех входах и
проверено примерами функции — в напечатанный код оно не едет.
…
$ grep -c 'fl_post(' out/program.c
2
```

Two checks for two unproved postconditions ("run-time checks removed: 1"). In C
«Цена со скидкой» is one subtraction:

```c
fl_status tri_otveta_cena_so_skidkoy(fl_ctx *ctx, fl_value cena, fl_value skidka,
                                     fl_value *result, fl_error *error) {
  if (cena.tag != FL_NUMBER || skidka.tag != FL_NUMBER)
    FL_TRY(fl_not_numbers(ctx, "sub", cena, skidka, error));
  *result = fl_number(cena.as.number - skidka.as.number);
  return FL_OK;
}
```

The check is removed when the postcondition is proved and the function has at
least one example: without an example `fl_post` stays even for a proved one.

## On a real module

The list module of the standard library, half a minute:

```
$ flang check --proof flang/stdlib/lists.flang
  функций 38: тотальных 38, обычных 0
  обещание несёт: композиция 28, структура 8, точный шаг 1, постоянный шаг 1,
                  объявленная мера 0
  сторожей в рантайме: 1 место
  утверждений 66: доказано 42 (из них индукцией 5) (из них без теоремы 37),
                  сетка 24, объявлено, не доказано 0
```

* Termination is proved for all 38 functions: 28 have no recursion
  («композиция»), 8 recurse on a part of the input, one counts down a
  `неотрицательное` and one a `число` — the only run-time termination check.
* Of 66 postconditions 42 are proved for all inputs, 37 of them without a
  written theorem. 24 passed only on examples.

```
$ flang emit flang/stdlib/lists.flang --target c --out out
$ grep -c 'fl_post(' out/lists.c
25
```

25 checks = 24 unproved postconditions + 1 termination check.

## Commands

| Command | What it does |
| --- | --- |
| `flang check <file>` | syntax, types, termination, preconditions at call sites, examples; exit 1 on an error |
| `flang check --proof <file>` | the report: what proves the termination of each function and each postcondition; exit 3 if something is not proved |
| `flang check --proof --strict <file>` | the same, but exit 0 only if there is at least one postcondition and all are proved; for CI |
| `flang check <file> --proof --record <record>` | also writes the [proof record](record-format.html) for the independent check |
| `flang emit <file> --target c --out <dir>` | generates C; shows which checks remain |
| `flang test <file>` | runs the examples |

## Next

- [The kernel refused: whose error is it](proof-refused.html) — how to read a
  refusal.
- [What the kernel proves by itself](what-the-kernel-accepts.html) — which
  postconditions pass without a theorem.
- [What is proved and what is not](what-is-proved.html) — what has to be
  trusted, and where "proved" does not mean "correct".
