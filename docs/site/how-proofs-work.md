# How to read the proof report

This page answers the question: what does each part of the output of
`flang check <file> --proof` mean. The output below comes from
`flang {{выпуск.версия}}`; long lines are wrapped, `…` marks an omission.

## What the report consists of

File `docs/examples/proofs/three-answers.flang`:

```flang insert docs/examples/proofs/three-answers.flang
модуль «Три ответа»

тотальная функция «Сдача»
  принимает внесено: неотрицательное, цена: неотрицательное
  требует «денег хватает» цена не больше внесено
  возвращает число
  обеспечивает «сдача не отрицательна» результат не меньше 0
  пример «сто за девяносто»
    дано внесено равно 100
    дано цена равно 90
    ожидается 10
  внесено минус цена

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

```bash
flang check three-answers.flang --proof; echo "код $?"
```

```
── ведомость доказательства модуля «Три ответа» ──
слова ведомости, и они не взаимозаменяемы:
…
чем несётся обещание «тотальная»:
…
что высказано и чем это несётся:
…
итог:
…
чем получен каждый шаг (правило и основания — строками записи доказательства):
…
three-answers.flang: независимо, сверщиком, проиграно 1 из 1 доказанных; на слове ядра 0 …
three-answers.flang: НЕ ПРОВЕРЕНО — утверждений 3: доказано 1, … — код возврата 3
код 3
```

The headings are written in the compiler's internal words. A translation:

| Heading in the output | What is under it |
| --- | --- |
| `ведомость доказательства` | the proof report, the name of the whole output |
| `слова ведомости` | a glossary of answers, the same for every file |
| `чем несётся обещание «тотальная»` | what proves the termination of each function |
| `законы` | laws of declared structures: `моноид`, `монада` |
| `что высказано и чем это несётся` | the answer for each postcondition |
| `принято на веру` | what is accepted without proof |
| `итог` | counters for the file |
| `чем получен каждый шаг` | the steps of each proof |

The last two lines are the result of the independent check and the overall
answer with the exit code. The sections are explained in order below.

## Termination of functions

The word `тотальная` (total) before a function demands a proof that it
terminates on every input. The file `docs/examples/proofs/termination.flang`
has five functions, one for each way of proving it:

```flang insert docs/examples/proofs/termination.flang
модуль «Завершение»

тотальная функция «Вдвое»
  принимает х: число
  возвращает число
  х умножить на 2

тотальная функция «Сумма списка»
  принимает ряд: список числа
  возвращает число
  разбор ряд
    случай пусто
      то 0
    случай голова первый и хвост остальные
      первый плюс («Сумма списка» от остальные)

тотальная функция «Отсчёт»
  принимает н: неотрицательное
  возвращает число
  если н не больше 0
    то 0
    иначе 1 плюс («Отсчёт» от (н минус 1))

тотальная функция «Отсчёт дробного»
  принимает н: число
  возвращает число
  если н не больше 0
    то 0
    иначе 1 плюс («Отсчёт дробного» от (н минус 1))

тотальная функция «Шагов до края»
  принимает место: число, край: число
  возвращает число
  убывает край минус место
  если место не меньше край
    то 0
    иначе 1 плюс («Шагов до края» от (место плюс 1) и край)
```

```bash
flang check termination.flang --proof
```

```
чем несётся обещание «тотальная»:
  «Вдвое»            доказано композицией: рекурсии нет …
  «Сумма списка»     доказано структурой: аргумент 1 («ряд») на каждом витке
                     становится частью себя … сторожа нет
  «Отсчёт»           доказано точным шагом: аргумент 1 («н») объявлен натуральным
                     и убывает на 1 … сторожа нет
  «Отсчёт дробного»  доказано постоянным шагом: … на IEEE-754 шаг не всегда меняет
                     число, поэтому сторож, 1 место
  «Шагов до края»    доказано объявленной мерой: убывает «край» минус «место»;
                     спуск ядром не выведен — на веру: … 1 место
```

The word `сторож` in the output is a run-time check; «виток» is one recursive call.

| In the output | What it means | Run-time check |
| --- | --- | --- |
| `композицией` | no recursion | no |
| `структурой` | the recursive call gets a part of the argument: a list tail, a field | no |
| `точным шагом` | an argument of type `неотрицательное` goes down by 1 | no |
| `постоянным шагом` | an argument of type `число` goes down by a constant | yes |
| `объявленной мерой` | the expression from the `убывает` line goes down | yes |

`число` is binary64. Above 2⁵³ subtracting one does not change it, so in the
last two cases the compiler leaves a check in the code.

The words «спуск ядром не выведен — на веру» at the last function mean:
termination is accepted without proof. What follows from that for the rest of
the report: [What you are trusting](trust.html#a-known-error-a-function-with-убывает).

A function whose termination is not proved is the error `FLANG_NOT_TOTAL`, and
there is no report with it. If the function really may run forever, remove the
word `тотальная`.

## `обеспечивает`: the postcondition and the three answers

The section «что высказано и чем это несётся» answers for every postcondition.
`three-answers.flang` has all three answers:

```
что высказано и чем это несётся:
  постусловие «сдача не отрицательна» функции «Сдача» — доказано по объявленным
  типам аргументов: цель сведена правилом «неотрицательность по построению» …
  постусловие «результат чётный» функции «Удвоить» — сетка 1 значение (примеры
  функции): нарушений на них нет … Это не доказательство …
  постусловие «результат кратен трём» функции «Утроить» — объявлено, не
  доказано: ни теоремы, ни примеров. Его считает рантайм после каждого возврата …
```

| In the output | What it means | At run time |
| --- | --- | --- |
| `доказано` | true for all inputs of the declared types | no check, if the function has a `пример` |
| `сетка N` | passed on N tests of the function; nothing is known about other inputs | a check on every return |
| `объявлено, не доказано` | neither a proof nor tests | a check on every return |

With the word «сетка» (grid) the compiler names the answer «checked on tests
only».

The last two postconditions are true: a doubled integer is even, a tripled one
is a multiple of three. The kernel did not derive them. What to do about it:
[When it is not proved](proof-refused.html).

After the word «доказано» comes the method:

| In the output | What it means |
| --- | --- |
| `по объявленным типам аргументов` | types and preconditions were enough, no theorem needed |
| `сведением цели с телом функции` | the postcondition was obtained from the function body |
| `индукцией по «Т»` | induction over the values of type «Т» |
| `терм принят ядром, N шагов` | a theorem written in the file was checked |

## Counters

```
итог:
  функций 3: тотальных 3, обычных 0
  обещание несёт: композиция 3, структура 0, точный шаг 0, постоянный шаг 0, объявленная мера 0
  сторожей в рантайме: 0 мест
  законов на сетке: 0 (значений в сетках 0); на веру: 0
  утверждений 3: доказано 1 (из них без теоремы 1, объявленным типом 1), сетка 1,
  объявлено, не доказано 1
```

- line one: termination is proved for all three functions;
- line two: by which method, as the number of functions per method;
- line three: how many termination checks remain in the code;
- line four: laws of structures; this file has none;
- line five: of three postconditions one is proved, one passed on tests only,
  one has nothing.

## Proof steps

```
чем получен каждый шаг (правило и основания — строками записи доказательства):
  утверждение «сдача не отрицательна» функции «Сдача» строка 7
    правило «неотрицательность по построению»
    вывод цель ⟨результат не меньше 0⟩
    вывод 1 Н3 ⟨цена не меньше 0⟩ строка 4
    …
    вывод 5 Разв2 ⟨результат не меньше 0⟩ из 4 строка 12
```

Each `вывод` line is one step: a number, a short rule name, the fact obtained
and what it was obtained from. `строка 4` is a line of the source, `из 4` is
the step with that number. Step 1 takes from the type `неотрицательное` that
the price is at least zero. Step 5 puts the function body in place of the word
`результат`.

The compiler writes the same steps to a file with the key `--record`. The file
format: [The proof record](record-format.html).

## The last two lines

```
three-answers.flang: независимо, сверщиком, проиграно 1 из 1 доказанных; на слове ядра 0 …
three-answers.flang: НЕ ПРОВЕРЕНО — утверждений 3: доказано 1, … — код возврата 3
```

The first is the result of the independent check. A separate program, `checker`
(«сверщик» in the output), repeated one proof of one. If the first number is
less than the second, part of what was proved stands on the kernel alone. In
detail: [What you are trusting](trust.html#the-line-n-of-m-the-independent-check).

The second is the overall answer and the exit code:

| Command | Code 0 | Code 1 | Code 3 |
| --- | --- | --- | --- |
| `flang check file` | no errors; an unproved postcondition is allowed | an error | — |
| `flang check file --proof` | everything is proved | an error | something is not proved |
| `flang check file --proof --strict` | there are postconditions, and all are proved | a postcondition is refuted | something is not proved, or there are no postconditions |

In CI use `flang check file --proof --strict`.

## The report for programs

`flang check file --proof --json` prints the same report as one line of JSON.
Postconditions are in the array `claims`, the answer in the field `verdict`:
`proved` for a proved one. Termination of functions is in the array
`functions`, the counters in `totals`.

## Next

- [When it is not proved](proof-refused.html) — what to do with the answers
  «сетка» and «объявлено, не доказано».
- [What you are trusting](trust.html) — what stands behind the word «доказано».
- [What the kernel can do](what-the-kernel-accepts.html) — which postconditions
  are proved without a theorem.
