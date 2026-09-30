# Which construct to use when

A cheat sheet: **what I want to do — what to write in flang**. Find the task in
the "Quick pick" table, open the example by its number, copy it and adjust.
Every example is a working file from `docs/examples/guide/`, shown with the real
compiler output.

The syntax of every construct is in the [Language reference](language.html);
every keyword of the language in one diagram is the
[Map of the language constructs](language-map.html).

The programs below use the Russian keywords and are the repository files as
they are. The compiler prints its output in Russian.

## Glossary: flang words and the usual terms

| In flang | Usual name | Closest analogue |
| --- | --- | --- |
| `тип` with `вариант`s | enum with data, tagged union | `enum` in Rust, union in TypeScript |
| `разбор … случай` | pattern matching | `match` in Rust and Python |
| `если … то … иначе` | if as an expression | the ternary operator |
| `пусть` | constant | `const` |
| `отобразить`, `отфильтровать`, `свёртка` | map, filter, reduce | the same in JavaScript and Python |
| `объект` and `запись` | a struct with fields and its value | dataclass, interface |
| `пример` | a unit test inside the function | doctest |
| `требует` | precondition: what must hold on input | an assert at the top of a function |
| `обеспечивает` | postcondition: what the function guarantees on output | an assert at the end, but checked for all inputs |
| `тотальная функция` | a function the compiler has proved to always terminate | — |
| `теорема` | a proof you write yourself | — |
| `план` | side effects: the function returns a command ("read the file"), the runtime executes it and calls the function again with the response | reducer, state machine |

The **prover** is the part of the compiler that proves `обеспечивает` for all
possible inputs, not only for your examples. In the compiler output it is called
«ядро» (kernel), and an `обеспечивает` line is called «постусловие»
(postcondition). Below, "guarantee" means an `обеспечивает` line.

## Quick pick

| What you need | What to write | Example |
| --- | --- | --- |
| choose by the kind of a value | a `тип` with variants and `разбор` | 1 |
| a value may be absent (Optional) | a type «Есть / Нет» and `разбор` | 2 |
| return an error (Result) | a type «Успех / Отказ» with a code and a reason | 3 |
| parse a number from a string | `к числу или беда` and `разбор` | 4 |
| several steps, each may fail | every step returns a Result, the next one matches on it | 5 |
| walk a list and exit early | recursion: `разбор` into `пусто` and `голова и хвост` | 6 |
| walk a tree | `разбор` and recursive calls on the parts | 7 |
| compute a total over a list (reduce) | `свёртка` | 8, 9 |
| convert every item (map) | `отобразить` | 10 |
| keep the items that fit (filter) | `отфильтровать` | 11 |
| find the first item that fits (find) | `отфильтровать` and `разбор` | 12 |
| look a value up by a key | a table of records, `отфильтровать`, `разбор` | 13 |
| check several rules (validation) | a list of rules and `отфильтровать` | 14 |
| one condition, two outcomes | `если … то … иначе` | 15 |
| repeat N times | recursion over a number with `если` as the exit | 16 |
| name an intermediate value | `пусть` | 17 |
| change a field of an object | build a new record | 18 |
| split a string into words | `разделить … по …` | 19 |
| count money without rounding errors | the type `сотых` | 20 |
| pass a function as an argument (callback) | `функция «Имя»` | 21 |
| guarantee a property of every item of the result | `обеспечивает … для всех … из результат` | 22 |
| forbid bad arguments | `требует` | 23 |
| prove what the prover could not | `теорема` and `индукция по` | 24 |
| state a property apart from a function | `утверждение` | 25 |
| read a file | `план` and the command «Прочитать файл» | 26 |
| run an external program | `план` and the command «Запустить процесс» | 27 |
| make an HTTP request | `план` and the command «Запросить» | 28 |

## The main rule: branch on the kind of a value with `разбор`

When the code chooses by what kind of value it has, write `разбор` (match), not
a chain of `если … иначе если` (if, else if). There are two reasons.

The compiler checks that every variant is handled: a forgotten variant is the
error `FLANG_MATCH_NOT_EXHAUSTIVE`. In an `если` chain a forgotten case silently
falls into the last `иначе`.

The prover proves guarantees over `разбор`: it goes through the variants of the
type and checks each one. Over a chain of `если … иначе если` it either cannot
prove the guarantee at all or proves only a weaker one.

## The chooser

If you prefer to go by questions: go from top to bottom and stop at the first "yes".

```mermaid What you need to do and what to write
flowchart TD
  Q1{Is a file, the screen,<br>an external program or the network needed?}
  Q1 -->|yes| R1[план: the function returns a command,<br>разбор matches on the response]
  Q1 -->|no| Q2{Is the input a list<br>that must be gone through?}
  Q2 -->|yes| R2([the «List» diagram below])
  Q2 -->|no| Q3{Does the value come<br>in several kinds?}
  Q3 -->|yes| R3[a type with variants and разбор]
  Q3 -->|no| Q4{May the value be absent,<br>or may the operation fail?}
  Q4 -->|yes| R4[your own type: «Есть» and «Нет»,<br>«Успех» and «Отказ» with a code]
  Q4 -->|no| Q5{Are there several conditions<br>checked in a row?}
  Q5 -->|yes| R5[a list of rules<br>and отфильтровать]
  Q5 -->|no| Q6{Is the answer chosen by a key:<br>a string or a number?}
  Q6 -->|yes| R6[a table of records,<br>отфильтровать, разбор]
  Q6 -->|no| Q7{One condition,<br>two outcomes?}
  Q7 -->|yes| R7[если … то … иначе]
  Q7 -->|no| Q8{Does an intermediate value<br>need a name?}
  Q8 -->|yes| R8[пусть]
  Q8 -->|no| R9[an expression or a function call]
  class R3 glavnoe
  class R1,R4,R5,R6,R7,R8,R9 vyvod
```

### A list

```mermaid A list: how to go through it
flowchart TD
  L1{Is a new list<br>of the same length needed?}
  L1 -->|yes| M1[отобразить]
  L1 -->|no| L2{Are only the items<br>that fit needed?}
  L2 -->|yes| M2[отфильтровать]
  L2 -->|no| L3{Is the first item<br>that fits needed?}
  L3 -->|yes| M3[отфильтровать, then разбор:<br>пусто or голова и хвост]
  L3 -->|no| L4{Is one total needed,<br>with the pass going to the end?}
  L4 -->|yes| M4[свёртка]
  L4 -->|no| M5[разбор over the list: пусто,<br>голова и хвост, a call on the tail]
  class M5 glavnoe
  class M1,M2,M3,M4 vyvod
```

## When `если` is in its place and when it is not

```mermaid When «если» is in its place
flowchart TD
  I1{More than two branches:<br>is there «иначе если»?}
  I1 -->|no| I2{Does the condition ask<br>what kind the value is<br>or whether a list is empty?}
  I2 -->|yes| N1[разбор]
  I2 -->|no| N2[если is in its place]
  I1 -->|yes| I3{Do all the branches compare<br>one and the same value?}
  I3 -->|no| N3[a list of rules]
  I3 -->|yes| I4{Is the list of values fixed<br>and known in advance?}
  I4 -->|yes| N4[a type with variants and разбор]
  I4 -->|no| N5[a table of records]
  class N1,N4 glavnoe
  class N2,N3,N5 vyvod
```

Write `если` when there is one condition, two outcomes, and the condition is an
ordinary comparison (`больше`, `равен`, `не меньше`). If the condition asks
"which variant is this?" or "is the list empty?", that is `разбор`. The other
proper place for `если` is the exit of a recursion over a number (example 16).

### Anti-example: a chain of `если … иначе если`

Do not write this. The code passes the check, and that is exactly the problem:
a typo in the name of the zone («горд» instead of «город») silently returns 0.

File: `docs/examples/guide/ladder-before.flang`

```flang
модуль «Ladder before»

тотальная функция «Цена доставки»
  принимает зона: строка
  возвращает число
  обеспечивает «цена доставки не отрицательна» результат не меньше 0
  пример «по городу»
    дано зона равно "город"
    ожидается 300
  пример «опечатка в зоне молча даёт ноль»
    дано зона равно "горд"
    ожидается 0
  если зона равен "город"
    то 300
    иначе если зона равен "область"
      то 500
      иначе если зона равен "страна"
        то 900
        иначе 0
```

```
$ flang check docs/examples/guide/ladder-before.flang
модуль «Ladder before»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/guide/ladder-before.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

### The same with `разбор`

There are three zones and they are known in advance, so this is an enum: a
`тип` with three variants. The typo cannot be written any more: there is no
variant «Горд», and the compiler will not let it through. Add a fourth zone and
the compiler makes you handle it. The guarantee can also be made stronger, from
"the price is not negative" to "the price is greater than zero": the prover
proves it for all zones at once.

File: `docs/examples/guide/ladder-as-match.flang`

```flang
модуль «Ladder as match»

тип «Зона»
  вариант «Город»
  вариант «Область»
  вариант «Страна»

тотальная функция «Цена доставки»
  принимает зона: «Зона»
  возвращает число
  обеспечивает «цена доставки положительна» результат больше 0
  пример «по городу»
    дано зона равно вариант «Город»
    ожидается 300
  пример «по стране»
    дано зона равно вариант «Страна»
    ожидается 900
  разбор зона
    случай «Город»
      то 300
    случай «Область»
      то 500
    случай «Страна»
      то 900
```

```
$ flang check docs/examples/guide/ladder-as-match.flang
модуль «Ladder as match»: функций 1, из них с доказанным завершением 1; типов 1
docs/examples/guide/ladder-as-match.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/ladder-as-match.flang --proof
…
что высказано и чем это несётся:
  постусловие «цена доставки положительна» функции «Цена доставки» — доказано индукцией по «Зона»: база 3 случая, шаг при допущении на частях (0 случаев), правила сведения: вычисление замкнутой цели — утверждение обо ВСЕХ входах типа «Зона», а не о написанных
…
docs/examples/guide/ladder-as-match.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

On the version with the `если` chain the same guarantee is false: the example
with the typo breaks it, and `flang check` answers with the error
`FLANG_EXAMPLE` with `FLANG_PROPERTY` inside.

### The same with a table

If the zone arrives from outside as a string (from a request, from a file) and
the list of zones changes, keep it as data: a table. An unknown zone does not
turn into 0; it comes back as a separate variant «Зоны нет».

File: `docs/examples/guide/ladder-as-table.flang`

```flang
модуль «Ladder as table»

объект «Тариф»
  «зона»: строка
  «цена»: неотрицательное

тип «Цена доставки»
  вариант «Назначена» содержит цена: число
  вариант «Зоны нет» содержит зона: строка

тотальная функция «Тарифы»
  возвращает список «Тариф»
  обеспечивает «тарифов три» (длина результат) равен 3
  [(запись «Тариф» с «зона» равным "город" и «цена» равным 300), (запись «Тариф» с «зона» равным "область" и «цена» равным 500), (запись «Тариф» с «зона» равным "страна" и «цена» равным 900)]

тотальная функция «Назначить цену»
  принимает зона: строка
  возвращает «Цена доставки»
  пример «по городу»
    дано зона равно "город"
    ожидается вариант «Назначена» с цена равным 300
  пример «опечатка в зоне названа, а не спрятана в ноль»
    дано зона равно "горд"
    ожидается вариант «Зоны нет» с зона равным "горд"
  разбор (отфильтровать («Тарифы») где тариф → тариф.«зона» равен зона)
    случай пусто
      то вариант «Зоны нет» с зона равным зона
    случай голова и хвост
      то вариант «Назначена» с цена равным голова.«цена»
```

```
$ flang check docs/examples/guide/ladder-as-table.flang
модуль «Ladder as table»: функций 2, из них с доказанным завершением 2; типов 2
docs/examples/guide/ladder-as-table.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

### Do not replace `если` with `разбор` over yes and no

The opposite mistake is to write `разбор (condition)` with the cases `да` and
`нет` instead of `если`. The code works, but the prover stops proving the
guarantee. Below is one function written two ways.

File: `docs/examples/guide/two-outcomes.flang`

```flang
модуль «Two outcomes»

тотальная функция «Не ниже порога»
  принимает число: неотрицательное, порог: неотрицательное
  возвращает число
  обеспечивает «результат не ниже порога» результат не меньше порог
  пример «ниже порога — порог»
    дано число равно 2
    дано порог равно 5
    ожидается 5
  пример «выше порога — само число»
    дано число равно 9
    дано порог равно 5
    ожидается 9
  если число не меньше порог
    то число
    иначе порог
```

```
$ flang check docs/examples/guide/two-outcomes.flang --proof
…
что высказано и чем это несётся:
  постусловие «результат не ниже порога» функции «Не ниже порога» — доказано по объявленным типам аргументов: цель сведена правилом «разбор цели по условию» — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
…
docs/examples/guide/two-outcomes.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

File: `docs/examples/guide/flag-match-unproved.flang`

```flang
модуль «Flag match unproved»

тотальная функция «Не ниже порога»
  принимает число: неотрицательное, порог: неотрицательное
  возвращает число
  обеспечивает «результат не ниже порога» результат не меньше порог
  пример «ниже порога — порог»
    дано число равно 2
    дано порог равно 5
    ожидается 5
  пример «выше порога — само число»
    дано число равно 9
    дано порог равно 5
    ожидается 9
  разбор (число не меньше порог)
    случай да
      то число
    случай нет
      то порог
```

```
$ flang check docs/examples/guide/flag-match-unproved.flang --proof
…
что высказано и чем это несётся:
  постусловие «результат не ниже порога» функции «Не ниже порога» — сетка 2 значения (примеры функции): нарушений НЕ ИСКАЛИ — прогона примеров не было, посчитано только их число. Это не доказательство — теоремы при утверждении нет
…
docs/examples/guide/flag-match-unproved.flang: ПРОВЕРЕНО С ОПОРОЙ, И ОПОРА НЕ СУДИЛАСЬ (спросить: --строго) — утверждений 1: доказано 0, условно 0, сетка 1, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

With `если` the guarantee is proved. With `разбор` over yes and no the report
says «сетка 2 значения»: the guarantee is checked only on your two examples and
there is no proof. A recursion over a number whose exit is
`разбор (предел не больше 0)` does not pass the check at all: `FLANG_NOT_TOTAL`.

## The order of work on a function

Write in this order: the signature (`принимает`, `возвращает`), the contract
(`требует` — what must hold on input, `обеспечивает` — what the function
guarantees on output), at least one `пример`, and only then the body.

```mermaid Work on one function
sequenceDiagram
  participant П as Programmer
  participant К as Compiler
  participant Я as Prover
  participant Н as Independent<br>checker
  Note over П: writes in order:<br>signature, contract,<br>example, body
  П->>К: flang check
  К->>К: syntax, types,<br>termination, examples
  К->>Я: guarantees
  Я-->>К: a result for each
  alt no remarks
    К-->>П: checked, code 0
  else there is a remark
    К-->>П: FLANG_…, code 1
  end
  П->>К: flang check --proof
  К->>Я: every guarantee
  alt доказано
    Я-->>К: proved
    К-->>П: code 0
  else сетка N
    Я-->>К: grid of N values
    К-->>П: code 0 and the words<br>«Это не доказательство»
  else объявлено, не доказано
    Я-->>К: declared, not proved
    К-->>П: code 3
  end
  opt the proof is checked again
    П->>К: flang check --proof --record
    К-->>П: the proof record
    П->>Н: the source and the record
    Н-->>П: ПРОВЕРЕНО, code 0
  end
  П->>К: flang test
  К-->>П: examples N, passed N
  П->>К: flang run
  alt everything is proved
    К-->>П: the value, code 0
  else something is not proved
    К-->>П: nothing is computed,<br>code 3
  end
```

| Command | When to run it | What it answers |
| --- | --- | --- |
| `flang check file` | after every change | code 0 — syntax, types, termination and examples are fine; code 1 — an error: its `FLANG_…` code, line and column |
| `flang check file --proof` | when you have written `обеспечивает` | for every guarantee, whether it is proved; code 3 — a guarantee has neither a proof nor examples |
| `flang check file --proof --strict` | in CI | code 0 only when everything is proved; a guarantee checked on examples only gives code 3 |
| `flang check file --proof --record record` | when the proof must be re-checked independently | writes the proof to a file; a separate program, `flang/proof/checker/checker.c`, re-checks it without trusting the prover |
| `flang test file` | when you only need to run the examples | how many examples there are and how many passed |
| `flang run file --function «Имя» --args '{…}'` | when you need a value | checks the proofs first; if something is not proved it computes nothing, code 3 |

### Three results of checking a guarantee

| The output says | What it means | Code of `check --proof` | Code of `run` |
| --- | --- | --- | --- |
| «доказано» (proved) | true for all possible inputs | 0 | 0 |
| «сетка N» (grid of N) | checked only on your N examples, like unit tests; there is no proof | 0, with `--strict` 3 | 3 |
| «объявлено, не доказано» (declared, not proved) | there is neither a proof nor an example | 3 | 3 |

How to read the other words of the `--proof` report:

| The report says | What it means |
| --- | --- |
| «что высказано и чем это несётся» | the list of guarantees and what backs each one |
| «постусловие» | your `обеспечивает` line |
| «доказано индукцией по «Тип»» | the prover went through every variant of the type |
| «доказано по объявленным типам аргументов» | the prover went through the branches of `если` using the types of the arguments |
| «ПРОВЕРЕНО САМОСТОЯТЕЛЬНО» | every guarantee in the file is proved |
| «ПРОВЕРЕНО С ОПОРОЙ, И ОПОРА НЕ СУДИЛАСЬ» | some guarantees rest on examples only, and this command did not run the examples |
| «НЕ УДАЛОСЬ ДОКАЗАТЬ» | the same under `--strict`: code 3 |
| «НЕ ПРОВЕРЕНО» | a guarantee has neither a proof nor examples |

«Доказано» — the file `two-outcomes.flang` above:

```
$ flang test docs/examples/guide/two-outcomes.flang
docs/examples/guide/two-outcomes.flang: примеров 2, прошло 2, не прошло 0
$ echo $?
0
```

```
$ flang run docs/examples/guide/two-outcomes.flang --function '«Не ниже порога»' --args '{"число":2,"порог":5}'
доказано: утверждений 1
5
$ echo $?
0
```

«Сетка» — the file `flag-match-unproved.flang` above. In the last line the
compiler prints the full path of the file; here it is shown from the root of the
repository.

```
$ flang check docs/examples/guide/flag-match-unproved.flang --proof --strict
…
docs/examples/guide/flag-match-unproved.flang: НЕ УДАЛОСЬ ДОКАЗАТЬ — ОПОРА НЕ СУДИЛАСЬ — утверждений 1: доказано 0, условно 0, сетка 1, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 3
$ echo $?
3
```

```
$ flang run docs/examples/guide/flag-match-unproved.flang --function '«Не ниже порога»' --args '{"число":2,"порог":5}'
не доказано: утверждений 1: доказано 0, сетка 1, на веру 0 — запуск только по явному согласию: --на-веру
недоказанное — поимённо, словами отчёта о доказательствах:
  1. постусловие «результат не ниже порога» функции «Не ниже порога» — сетка 2 значения (примеры функции): нарушений НЕ ИСКАЛИ — прогона примеров не было, посчитано только их число. Это не доказательство — теоремы при утверждении нет
«сетка» закрывается так: написать при утверждении «теорема … утверждаем … следовательно доказано» либо переписать его условие так, чтобы оно совпало с ветвью тела, — тогда цель сводит правило «разбор цели по условию»
отчёт о доказательствах целиком, с правилами и у доказанных тоже: flang check docs/examples/guide/flag-match-unproved.flang --proof
$ echo $?
3
```

«Объявлено, не доказано» — the same guarantee without a single example.

File: `docs/examples/guide/promise-without-examples.flang`

```flang
модуль «Promise without examples»

тотальная функция «Не ниже порога»
  принимает число: неотрицательное, порог: неотрицательное
  возвращает число
  обеспечивает «результат не ниже порога» результат не меньше порог
  разбор (число не меньше порог)
    случай да
      то число
    случай нет
      то порог
```

```
$ flang check docs/examples/guide/promise-without-examples.flang
модуль «Promise without examples»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/guide/promise-without-examples.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/promise-without-examples.flang --proof
…
что высказано и чем это несётся:
  постусловие «результат не ниже порога» функции «Не ниже порога» — объявлено, не доказано: ни теоремы, ни примеров. Его считает рантайм после каждого возврата — на тех входах, которые придут
…
docs/examples/guide/promise-without-examples.flang: НЕ ПРОВЕРЕНО — утверждений 1: доказано 0, условно 0, сетка 0, объявлено, не доказано 1, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 3
$ echo $?
3
```

## Examples

There are 28 examples. Each is a file in `docs/examples/guide/`. The commands
run from the root of the repository and the compiler output is verbatim; an
ellipsis marks the lines of the `--proof` report that are left out.

### 1. I want to choose by the kind of value

What to write: a `тип` with variants (an enum with data) and `разбор` over it — this is pattern matching. Forget a variant and the compiler stops with `FLANG_MATCH_NOT_EXHAUSTIVE`. The guarantee «углов не больше четырёх» is proved by the prover on its own: it goes through every variant of the type.

File: `docs/examples/guide/choose-by-variant.flang`

```flang
модуль «Choose by variant»

тип «Фигура»
  вариант «Круг» содержит радиус: число
  вариант «Прямоугольник» содержит ширина: число, высота: число
  вариант «Треугольник» содержит основание: число, высота: число

тотальная функция «Площадь»
  принимает фигура: «Фигура»
  возвращает число
  пример «прямоугольник два на три»
    дано фигура равно вариант «Прямоугольник» с ширина равным 2 и высота равным 3
    ожидается 6
  пример «треугольник с основанием четыре и высотой три»
    дано фигура равно вариант «Треугольник» с основание равным 4 и высота равным 3
    ожидается 6
  разбор фигура
    случай вариант «Круг» с радиус как радиус
      то 3.14 умножить на радиус умножить на радиус
    случай вариант «Прямоугольник» с ширина как ширина и высота как высота
      то ширина умножить на высота
    случай вариант «Треугольник» с основание как основание и высота как высота
      то основание умножить на высота делить на 2

тотальная функция «Углов»
  принимает фигура: «Фигура»
  возвращает число
  для всех фигура обеспечивает «углов не больше четырёх» результат не больше 4
  пример «у круга углов нет»
    дано фигура равно вариант «Круг» с радиус равным 1
    ожидается 0
  разбор фигура
    случай вариант «Круг» с радиус как радиус
      то 0
    случай вариант «Прямоугольник» с ширина как ширина и высота как высота
      то 4
    случай вариант «Треугольник» с основание как основание и высота как высота
      то 3
```

```
$ flang check docs/examples/guide/choose-by-variant.flang
модуль «Choose by variant»: функций 2, из них с доказанным завершением 2; типов 1
docs/examples/guide/choose-by-variant.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/choose-by-variant.flang --proof
…
что высказано и чем это несётся:
  постусловие «углов не больше четырёх» функции «Углов» — доказано индукцией по «Фигура»: база 3 случая, шаг при допущении на частях (0 случаев), правила сведения: ограниченность точным потолком по построению — утверждение обо ВСЕХ входах типа «Фигура», а не о написанных
…
docs/examples/guide/choose-by-variant.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 2. I want to handle a value that may be absent

What to write: a type with two variants — «Есть» with the data and «Нет» — and `разбор`. This is Optional. `ничто` (null) is not used for this: the compiler will not let you forget the «Нет» branch, while it would let you forget a null check.

File: `docs/examples/guide/absent-value.flang`

```flang
модуль «Absent value»

тип «Скидка»
  вариант «Есть» содержит доля: число
  вариант «Нет»

тотальная функция «Цена со скидкой»
  принимает цена: число, скидка: «Скидка»
  возвращает число
  пример «скидка десять процентов»
    дано цена равно 200
    дано скидка равно вариант «Есть» с доля равным 10
    ожидается 180
  пример «скидки нет — цена прежняя»
    дано цена равно 200
    дано скидка равно вариант «Нет»
    ожидается 200
  разбор скидка
    случай вариант «Есть» с доля как доля
      то цена минус (доля процентов от цена)
    случай «Нет»
      то цена
```

```
$ flang check docs/examples/guide/absent-value.flang
модуль «Absent value»: функций 1, из них с доказанным завершением 1; типов 1
docs/examples/guide/absent-value.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

### 3. I want to return an error

What to write: a result type with the variants «Успех» and «Отказ» (a code and a reason) — this is Result. flang has no exceptions: an error is an ordinary return value and the caller must match on it. The check "the divisor equals 0" is one condition with two outcomes, so `если` (if) is used here.

File: `docs/examples/guide/refusal.flang`

```flang
модуль «Refusal»

тип «Итог»
  вариант «Успех» содержит частное: число
  вариант «Отказ» содержит код: строка, причина: строка

тотальная функция «Поделить»
  принимает делимое: число, делитель: число
  возвращает «Итог»
  пример «шесть на три»
    дано делимое равно 6
    дано делитель равно 3
    ожидается вариант «Успех» с частное равным 2
  пример «на ноль не делят»
    дано делимое равно 6
    дано делитель равно 0
    ожидается вариант «Отказ» с код равным "ДЕЛИТЕЛЬ_НОЛЬ" и причина равным "делитель равен нулю"
  если делитель равен 0
    то вариант «Отказ» с код равным "ДЕЛИТЕЛЬ_НОЛЬ" и причина равным "делитель равен нулю"
    иначе вариант «Успех» с частное равным (делимое делить на делитель)

тотальная функция «Слово итога»
  принимает итог: «Итог»
  возвращает строка
  пример «отказ называет код и причину»
    дано итог равно вариант «Отказ» с код равным "ДЕЛИТЕЛЬ_НОЛЬ" и причина равным "делитель равен нулю"
    ожидается "ДЕЛИТЕЛЬ_НОЛЬ: делитель равен нулю"
  пример «успех называет частное»
    дано итог равно вариант «Успех» с частное равным 2
    ожидается "2"
  разбор итог
    случай вариант «Успех» с частное как частное
      то к строке частное
    случай вариант «Отказ» с код как код и причина как причина
      то соединить [код, ": ", причина] по ""
```

```
$ flang check docs/examples/guide/refusal.flang
модуль «Refusal»: функций 2, из них с доказанным завершением 2; типов 1
docs/examples/guide/refusal.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

### 4. I want to parse a number from a string without crashing

What to write: `к числу или беда` and `разбор` over its result. The built-in function does not crash on a bad string; it returns one of two variants: «Разобрано» with the number or «Не разобрано» with the reason as text.

File: `docs/examples/guide/parse-number.flang`

```flang
модуль «Parse number»

тип «Прочитанное»
  вариант «Число» содержит значение: число
  вариант «Не число» содержит причина: строка

тотальная функция «Прочитать число»
  принимает текст: строка
  возвращает «Прочитанное»
  пример «цифры становятся числом»
    дано текст равно "42"
    ожидается вариант «Число» с значение равным 42
  пример «слово числом не становится, и причина названа»
    дано текст равно "сорок два"
    ожидается вариант «Не число» с причина равным "«к числу»: строка \"сорок два\" не является числом"
  разбор (к числу или беда текст)
    случай вариант «Разобрано» с значение как значение
      то вариант «Число» с значение равным значение
    случай вариант «Не разобрано» с код как код и сообщение как сообщение
      то вариант «Не число» с причина равным сообщение
```

```
$ flang check docs/examples/guide/parse-number.flang
модуль «Parse number»: функций 1, из них с доказанным завершением 1; типов 2
docs/examples/guide/parse-number.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

### 5. I want to do several steps, each of which may fail

What to write: every step returns a Result (a type with a success and a failure variant) and the next step does `разбор` over it. The error of the first failed step reaches the end of the chain by itself — without `если` and without exceptions. The `?` operator in Rust does the same; here it is written out.

File: `docs/examples/guide/chain-of-steps.flang`

```flang
модуль «Chain of steps»

тип «Шаг»
  вариант «Есть» содержит значение: число
  вариант «Нет» содержит причина: строка

объект «Позиция»
  «номер»: число
  «цена»: число

тотальная функция «Каталог»
  возвращает список «Позиция»
  обеспечивает «позиций две» (длина результат) равен 2
  [(запись «Позиция» с «номер» равным 1 и «цена» равным 500), (запись «Позиция» с «номер» равным 2 и «цена» равным 100)]

тотальная функция «Цена позиции»
  принимает номер: число
  возвращает «Шаг»
  пример «первая позиция стоит пятьсот»
    дано номер равно 1
    ожидается вариант «Есть» с значение равным 500
  пример «третьей позиции нет»
    дано номер равно 3
    ожидается вариант «Нет» с причина равным "позиции нет в каталоге"
  разбор (отфильтровать («Каталог») где позиция → позиция.«номер» равен номер)
    случай пусто
      то вариант «Нет» с причина равным "позиции нет в каталоге"
    случай голова и хвост
      то вариант «Есть» с значение равным голова.«цена»

тотальная функция «Скидка по цене»
  принимает цена: число
  возвращает «Шаг»
  пример «дешёвому товару скидки нет»
    дано цена равно 100
    ожидается вариант «Нет» с причина равным "цена ниже порога скидки"
  если цена не меньше 400
    то вариант «Есть» с значение равным (цена делить на 10)
    иначе вариант «Нет» с причина равным "цена ниже порога скидки"

тотальная функция «Цена за вычетом»
  принимает цена: число, скидка: «Шаг»
  возвращает «Шаг»
  пример «скидка вычтена»
    дано цена равно 500
    дано скидка равно вариант «Есть» с значение равным 50
    ожидается вариант «Есть» с значение равным 450
  разбор скидка
    случай вариант «Есть» с значение как вычет
      то вариант «Есть» с значение равным (цена минус вычет)
    случай вариант «Нет» с причина как причина
      то вариант «Нет» с причина равным причина

тотальная функция «Итог со скидкой»
  принимает номер: число
  возвращает «Шаг»
  пример «по первой позиции скидка есть»
    дано номер равно 1
    ожидается вариант «Есть» с значение равным 450
  пример «у дешёвой позиции причина отказа доехала до итога»
    дано номер равно 2
    ожидается вариант «Нет» с причина равным "цена ниже порога скидки"
  пример «позиции нет, и дальше первого шага дело не пошло»
    дано номер равно 3
    ожидается вариант «Нет» с причина равным "позиции нет в каталоге"
  разбор («Цена позиции» от номер)
    случай вариант «Есть» с значение как цена
      то «Цена за вычетом» от цена и («Скидка по цене» от цена)
    случай вариант «Нет» с причина как причина
      то вариант «Нет» с причина равным причина
```

```
$ flang check docs/examples/guide/chain-of-steps.flang
модуль «Chain of steps»: функций 5, из них с доказанным завершением 5; типов 2
docs/examples/guide/chain-of-steps.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

### 6. I want to walk a list and stop before its end

What to write: recursion with `разбор` over the list. The case `пусто` is the exit; the case `голова и хвост` handles the head and calls itself on the tail. This replaces a loop with `break`. The compiler sees termination by itself: the tail is shorter than the list. The guarantee about the length is proved by induction on the list.

File: `docs/examples/guide/walk-list.flang`

```flang
модуль «Walk list»

тотальная функция «После черты»
  принимает строки: список строки
  возвращает список строки
  для всех строки обеспечивает «остаток не длиннее целого» (длина результат) не больше (длина строки)
  пример «шапка и черта отброшены»
    дано строки равно ["шапка", "---", "тело", "ещё"]
    ожидается ["тело", "ещё"]
  пример «черты нет — не осталось ничего»
    дано строки равно ["шапка", "тело"]
    ожидается пустой список
  разбор строки
    случай пусто
      то пустой список
    случай голова и хвост
      то если голова равен "---"
        то хвост
        иначе «После черты» от хвост
```

```
$ flang check docs/examples/guide/walk-list.flang
модуль «Walk list»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/guide/walk-list.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/walk-list.flang --proof
…
что высказано и чем это несётся:
  постусловие «остаток не длиннее целого» функции «После черты» — доказано индукцией по «список»: база 1 случай, шаг при допущении на частях (1 случай), правила сведения: ограниченность точным потолком по построению; порядок по построению — утверждение обо ВСЕХ входах типа «список», а не о написанных
…
docs/examples/guide/walk-list.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 7. I want to walk a tree

What to write: `разбор` over the variants of a node and recursive calls on its parts. A part of a tree is always smaller than the tree, so termination needs no separate proof: `убывает` is not written.

File: `docs/examples/guide/walk-tree.flang`

```flang
модуль «Walk tree»

тип «Дерево»
  вариант «Лист»
  вариант «Узел» содержит значение: число, левое: «Дерево», правое: «Дерево»

тотальная функция «Узлов»
  принимает дерево: «Дерево»
  возвращает число
  для всех дерево обеспечивает «узлов не меньше нуля» результат не меньше 0
  пример «в листе узлов нет»
    дано дерево равно вариант «Лист»
    ожидается 0
  пример «корень с одним потомком»
    дано дерево равно вариант «Узел» с значение равным 1 и левое равным (вариант «Узел» с значение равным 2 и левое равным (вариант «Лист») и правое равным (вариант «Лист»)) и правое равным (вариант «Лист»)
    ожидается 2
  разбор дерево
    случай «Лист»
      то 0
    случай вариант «Узел» с левое как левое и правое как правое
      то 1 плюс («Узлов» от левое) плюс («Узлов» от правое)
```

```
$ flang check docs/examples/guide/walk-tree.flang
модуль «Walk tree»: функций 1, из них с доказанным завершением 1; типов 1
docs/examples/guide/walk-tree.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/walk-tree.flang --proof
…
что высказано и чем это несётся:
  постусловие «узлов не меньше нуля» функции «Узлов» — доказано индукцией по «Дерево»: база 1 случай, шаг при допущении на частях (1 случай), правила сведения: неотрицательность по построению — утверждение обо ВСЕХ входах типа «Дерево», а не о написанных
…
docs/examples/guide/walk-tree.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 8. I want to compute a total over a list

What to write: `свёртка` — this is reduce. flang has no loops. The list is finite and is passed once, so termination needs no proof.

File: `docs/examples/guide/fold-total.flang`

```flang
модуль «Fold total»

тотальная функция «Сумма длин»
  принимает слова: список строки
  возвращает число
  для всех слова обеспечивает «сумма длин не отрицательна» результат не меньше 0
  пример «три слова»
    дано слова равно ["раз", "дважды", "трижды"]
    ожидается 15
  пример «пустой список даёт ноль»
    дано слова равно пустой список
    ожидается 0
  свёртка слова начиная с 0 как итог и слово → итог плюс (длина слово)
```

```
$ flang check docs/examples/guide/fold-total.flang
модуль «Fold total»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/guide/fold-total.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/fold-total.flang --proof
…
что высказано и чем это несётся:
  постусловие «сумма длин не отрицательна» функции «Сумма длин» — доказано сведением цели с телом функции: правило «неотрицательность по построению», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
…
docs/examples/guide/fold-total.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 9. I want to compute two totals in one pass

What to write: `свёртка` whose accumulator is a record with two fields. The step lives in its own function with its own example. There are no mutable variables: the step returns a new accumulator.

File: `docs/examples/guide/fold-record.flang`

```flang
модуль «Fold record»

объект «Сводка»
  «сумма»: число
  «штук»: число

тотальная функция «Шаг сводки»
  принимает сводка: «Сводка», цена: число
  возвращает «Сводка»
  пример «к пустой сводке прибавлена одна цена»
    дано сводка равно запись «Сводка» с «сумма» равным 0 и «штук» равным 0
    дано цена равно 30
    ожидается запись «Сводка» с «сумма» равным 30 и «штук» равным 1
  запись «Сводка» с «сумма» равным (сводка.«сумма» плюс цена) и «штук» равным (сводка.«штук» плюс 1)

тотальная функция «Сводка цен»
  принимает цены: список числа
  возвращает «Сводка»
  пример «три цены»
    дано цены равно [30, 50, 20]
    ожидается запись «Сводка» с «сумма» равным 100 и «штук» равным 3
  свёртка цены начиная с (запись «Сводка» с «сумма» равным 0 и «штук» равным 0) как сводка и цена → «Шаг сводки» от сводка и цена
```

```
$ flang check docs/examples/guide/fold-record.flang
модуль «Fold record»: функций 2, из них с доказанным завершением 2; типов 1
docs/examples/guide/fold-record.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

### 10. I want to convert every item

What to write: `отобразить` — this is map. The prover proves the guarantee about the length of the result on its own.

File: `docs/examples/guide/map-each.flang`

```flang
модуль «Map each»

тотальная функция «Длины слов»
  принимает слова: список строки
  возвращает список числа
  обеспечивает «длин столько же, сколько слов» (длина результат) равен (длина слова)
  пример «три слова»
    дано слова равно ["раз", "дважды", "трижды"]
    ожидается [3, 6, 6]
  отобразить слова как слово → длина слово
```

```
$ flang check docs/examples/guide/map-each.flang
модуль «Map each»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/guide/map-each.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/map-each.flang --proof
…
что высказано и чем это несётся:
  постусловие «длин столько же, сколько слов» функции «Длины слов» — доказано сведением цели с телом функции: правило «тождество после переписки допущением», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
…
docs/examples/guide/map-each.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 11. I want to keep the items that fit

What to write: `отфильтровать` — this is filter.

File: `docs/examples/guide/keep-matching.flang`

```flang
модуль «Keep matching»

тотальная функция «Положительные»
  принимает числа: список числа
  возвращает список числа
  обеспечивает «отбор список не удлиняет» (длина результат) не больше (длина числа)
  пример «минусы и ноль выброшены»
    дано числа равно [3, -1, 0, 7]
    ожидается [3, 7]
  отфильтровать числа где число → число больше 0
```

```
$ flang check docs/examples/guide/keep-matching.flang
модуль «Keep matching»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/guide/keep-matching.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/keep-matching.flang --proof
…
что высказано и чем это несётся:
  постусловие «отбор список не удлиняет» функции «Положительные» — доказано сведением цели с телом функции: правило «порядок по построению», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
…
docs/examples/guide/keep-matching.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 12. I want to find the first item that fits

What to write: `отфильтровать`, then `разбор` over the result: `пусто` means not found, `голова и хвост` means the head is the first item that fits. "Not found" is a separate variant of the result, not `-1` and not null.

File: `docs/examples/guide/find-first.flang`

```flang
модуль «Find first»

тип «Находка»
  вариант «Нашлось» содержит слово: строка
  вариант «Не нашлось»

тотальная функция «Первое длинное»
  принимает слова: список строки, порог: неотрицательное
  возвращает «Находка»
  пример «первое слово длиннее трёх букв»
    дано слова равно ["раз", "дважды", "трижды"]
    дано порог равно 3
    ожидается вариант «Нашлось» с слово равным "дважды"
  пример «длинных слов нет»
    дано слова равно ["раз", "два"]
    дано порог равно 3
    ожидается вариант «Не нашлось»
  разбор (отфильтровать слова где слово → (длина слово) больше порог)
    случай пусто
      то вариант «Не нашлось»
    случай голова и хвост
      то вариант «Нашлось» с слово равным голова
```

```
$ flang check docs/examples/guide/find-first.flang
модуль «Find first»: функций 1, из них с доказанным завершением 1; типов 1
docs/examples/guide/find-first.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

### 13. I want to look a value up by a key

What to write: a table of records (a list of key and value objects), `отфильтровать` by the key and `разбор` over the result. A new key is a new row of data, not one more `иначе если` in the code.

File: `docs/examples/guide/lookup-table.flang`

```flang
модуль «Lookup table»

объект «Строка таблицы»
  «код»: строка
  «слово»: строка

тип «Находка»
  вариант «Нашлось» содержит слово: строка
  вариант «Не нашлось» содержит код: строка

тотальная функция «Таблица кодов»
  возвращает список «Строка таблицы»
  обеспечивает «строк четыре» (длина результат) равен 4
  [(запись «Строка таблицы» с «код» равным "200" и «слово» равным "готово"), (запись «Строка таблицы» с «код» равным "404" и «слово» равным "не найдено"), (запись «Строка таблицы» с «код» равным "409" и «слово» равным "занято"), (запись «Строка таблицы» с «код» равным "500" и «слово» равным "сбой службы")]

тотальная функция «Слово кода»
  принимает код: строка
  возвращает «Находка»
  пример «код из таблицы»
    дано код равно "404"
    ожидается вариант «Нашлось» с слово равным "не найдено"
  пример «кода в таблице нет»
    дано код равно "418"
    ожидается вариант «Не нашлось» с код равным "418"
  разбор (отфильтровать («Таблица кодов») где строчка → строчка.«код» равен код)
    случай пусто
      то вариант «Не нашлось» с код равным код
    случай голова и хвост
      то вариант «Нашлось» с слово равным голова.«слово»
```

```
$ flang check docs/examples/guide/lookup-table.flang
модуль «Lookup table»: функций 2, из них с доказанным завершением 2; типов 2
docs/examples/guide/lookup-table.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

### 14. I want to check several conditions in a row

What to write: a list of rules. Every rule is a variant of a type, checking one rule is `разбор`, running all of them is `отфильтровать`. The output is every broken rule at once, not only the first. All three guarantees in the example are proved.

File: `docs/examples/guide/rule-list.flang`

```flang
модуль «Rule list»

тип «Правило»
  вариант «Не короче» содержит знаков: неотрицательное
  вариант «Содержит» содержит кусок: строка
  вариант «Не начинается с» содержит начало: строка

тотальная функция «Правило выполнено»
  принимает требование: «Правило», пароль: строка
  возвращает признак
  пример «короткий пароль не проходит по длине»
    дано требование равно вариант «Не короче» с знаков равным 8
    дано пароль равно "кот"
    ожидается нет
  пример «цифра на месте»
    дано требование равно вариант «Содержит» с кусок равным "7"
    дано пароль равно "кот7"
    ожидается да
  разбор требование
    случай вариант «Не короче» с знаков как знаков
      то (длина пароль) не меньше знаков
    случай вариант «Содержит» с кусок как кусок
      то пароль содержит кусок
    случай вариант «Не начинается с» с начало как начало
      то не (пароль начинается с начало)

тотальная функция «Слово правила»
  принимает требование: «Правило»
  возвращает строка
  пример «правило о длине называет число»
    дано требование равно вариант «Не короче» с знаков равным 8
    ожидается "короче 8 знаков"
  разбор требование
    случай вариант «Не короче» с знаков как знаков
      то соединить ["короче ", (к строке знаков), " знаков"] по ""
    случай вариант «Содержит» с кусок как кусок
      то соединить ["нет «", кусок, "»"] по ""
    случай вариант «Не начинается с» с начало как начало
      то соединить ["начинается с «", начало, "»"] по ""

тотальная функция «Правила пароля»
  возвращает список «Правило»
  обеспечивает «правил три» (длина результат) равен 3
  [(вариант «Не короче» с знаков равным 8), (вариант «Содержит» с кусок равным "7"), (вариант «Не начинается с» с начало равным "пароль")]

тотальная функция «Нарушенные правила»
  принимает правила: список «Правило», пароль: строка
  возвращает список «Правило»
  обеспечивает «нарушенных не больше, чем правил» (длина результат) не больше (длина правила)
  пример «годный пароль не нарушает ничего»
    дано правила равно [(вариант «Не короче» с знаков равным 8), (вариант «Содержит» с кусок равным "7")]
    дано пароль равно "длинный кот 7"
    ожидается пустой список
  отфильтровать правила где требование → не («Правило выполнено» от требование и пароль)

тотальная функция «Замечания к паролю»
  принимает пароль: строка
  возвращает список строки
  обеспечивает «замечаний столько же, сколько нарушенных правил» (длина результат) равен (длина («Нарушенные правила» от («Правила пароля») и пароль))
  пример «годный пароль замечаний не получает»
    дано пароль равно "длинный кот 7"
    ожидается пустой список
  пример «у короткого пароля без цифры два замечания»
    дано пароль равно "кот"
    ожидается ["короче 8 знаков", "нет «7»"]
  отобразить («Нарушенные правила» от («Правила пароля») и пароль) как требование → «Слово правила» от требование
```

```
$ flang check docs/examples/guide/rule-list.flang
модуль «Rule list»: функций 5, из них с доказанным завершением 5; типов 1
docs/examples/guide/rule-list.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/rule-list.flang --proof
…
что высказано и чем это несётся:
  постусловие «правил три» функции «Правила пароля» — доказано сведением цели с телом функции: правило «тождество после переписки допущением», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
  постусловие «нарушенных не больше, чем правил» функции «Нарушенные правила» — доказано сведением цели с телом функции: правило «порядок по построению», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
  постусловие «замечаний столько же, сколько нарушенных правил» функции «Замечания к паролю» — доказано сведением цели с телом функции: правило «тождество после переписки допущением», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
…
docs/examples/guide/rule-list.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 3: доказано 3, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 15. I want to choose one of two by one condition

What to write: `если … то … иначе` (if, then, else). One condition and two outcomes is exactly the case for `если`. The prover proves the guarantee by going through both branches; the report calls this rule «разбор цели по условию».

File: `docs/examples/guide/two-outcomes.flang`

```flang
модуль «Two outcomes»

тотальная функция «Не ниже порога»
  принимает число: неотрицательное, порог: неотрицательное
  возвращает число
  обеспечивает «результат не ниже порога» результат не меньше порог
  пример «ниже порога — порог»
    дано число равно 2
    дано порог равно 5
    ожидается 5
  пример «выше порога — само число»
    дано число равно 9
    дано порог равно 5
    ожидается 9
  если число не меньше порог
    то число
    иначе порог
```

```
$ flang check docs/examples/guide/two-outcomes.flang
модуль «Two outcomes»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/guide/two-outcomes.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/two-outcomes.flang --proof
…
что высказано и чем это несётся:
  постусловие «результат не ниже порога» функции «Не ниже порога» — доказано по объявленным типам аргументов: цель сведена правилом «разбор цели по условию» — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
…
docs/examples/guide/two-outcomes.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 16. I want to repeat N times

What to write: recursion over a number of the type `неотрицательное` (non-negative): every call decreases the counter by 1 and the exit is an `если`. This replaces a `for` loop. The compiler derives termination from the "minus 1" step and the prover proves the guarantee by induction. Write the exit with `если` and nothing else: that is the only form in which the compiler recognises the decreasing counter.

File: `docs/examples/guide/count-down.flang`

```flang
модуль «Count down»

тотальная функция «Сумма до»
  принимает предел: неотрицательное
  возвращает число
  для всех предел обеспечивает «сумма до неотрицательна» результат не меньше 0
  пример «до нуля — ноль»
    дано предел равно 0
    ожидается 0
  пример «до трёх — шесть»
    дано предел равно 3
    ожидается 6
  если предел не больше 0
    то 0
    иначе предел плюс («Сумма до» от (предел минус 1))
```

```
$ flang check docs/examples/guide/count-down.flang
модуль «Count down»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/guide/count-down.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/count-down.flang --proof
…
чем несётся обещание «тотальная»:
  «Сумма до»  доказано точным шагом: аргумент 1 («предел») объявлен натуральным и убывает на 1; дно и потолок даёт тип, внутри потолка шаг точен — сторожа нет
…
```

```
$ flang check docs/examples/guide/count-down.flang --proof
…
что высказано и чем это несётся:
  постусловие «сумма до неотрицательна» функции «Сумма до» — доказано индукцией по «неотрицательное»: база 1 случай, шаг при допущении на убывшем «предел» (1 случай), правила сведения: неотрицательность по построению — утверждение обо ВСЕХ значениях отрезка «неотрицательное» [0, 9007199254740991], а не о написанных: отрезок конечен, спуск строг и дна не проскакивает
…
docs/examples/guide/count-down.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 17. I want to name an intermediate value

What to write: `пусть` — this is `const`. The name gets its value once and cannot be reassigned.

File: `docs/examples/guide/bind-name.flang`

```flang
модуль «Bind name»

объект «Позиция»
  «цена»: число
  «количество»: число

тотальная функция «Стоимость позиции»
  принимает позиция: «Позиция»
  возвращает число
  пример «две штуки по триста с налогом десять процентов»
    дано позиция равно запись «Позиция» с «цена» равным 300 и «количество» равным 2
    ожидается 660
  пусть чистое равно позиция.«цена» умножить на позиция.«количество»
  пусть налог равно 10 процентов от чистое
  чистое плюс налог
```

```
$ flang check docs/examples/guide/bind-name.flang
модуль «Bind name»: функций 1, из них с доказанным завершением 1; типов 1
docs/examples/guide/bind-name.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

### 18. I want to change a field of a record

What to write: build a new record with the changed field. A field cannot be changed in place: values are immutable. That the other fields stay the same is a guarantee in `обеспечивает`, and it is proved.

File: `docs/examples/guide/build-record.flang`

```flang
модуль «Build record»

объект «Позиция»
  «название»: строка
  «цена»: число

тотальная функция «С новой ценой»
  принимает позиция: «Позиция», цена: число
  возвращает «Позиция»
  обеспечивает «название не тронуто» результат.«название» равен позиция.«название»
  пример «болт подорожал»
    дано позиция равно запись «Позиция» с «название» равным "болт" и «цена» равным 30
    дано цена равно 35
    ожидается запись «Позиция» с «название» равным "болт" и «цена» равным 35
  запись «Позиция» с «название» равным позиция.«название» и «цена» равным цена
```

```
$ flang check docs/examples/guide/build-record.flang
модуль «Build record»: функций 1, из них с доказанным завершением 1; типов 1
docs/examples/guide/build-record.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/build-record.flang --proof
…
что высказано и чем это несётся:
  постусловие «название не тронуто» функции «С новой ценой» — доказано сведением цели с телом функции: правило «тождество после переписки допущением», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
…
docs/examples/guide/build-record.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 19. I want to split a string into words

What to write: `разделить … по …` — this is split. In the example `отфильтровать` then keeps the words longer than three letters.

File: `docs/examples/guide/split-text.flang`

```flang
модуль «Split text»

тотальная функция «Длинные слова»
  принимает текст: строка
  возвращает список строки
  обеспечивает «слов не больше, чем кусков» (длина результат) не больше (длина (разделить текст по " "))
  пример «короткое слово выброшено»
    дано текст равно "раз дважды трижды"
    ожидается ["дважды", "трижды"]
  отфильтровать (разделить текст по " ") где слово → (длина слово) больше 3
```

```
$ flang check docs/examples/guide/split-text.flang
модуль «Split text»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/guide/split-text.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/split-text.flang --proof
…
что высказано и чем это несётся:
  постусловие «слов не больше, чем кусков» функции «Длинные слова» — доказано сведением цели с телом функции: правило «порядок по построению», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
…
docs/examples/guide/split-text.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 20. I want to count money without a rounding error

What to write: the type `сотых` (hundredths) for the amount on input. The amount is kept as a whole number of hundredths, so there are no rounding errors of the float kind.

File: `docs/examples/guide/exact-money.flang`

```flang
модуль «Exact money»

тотальная функция «Копейки заказа»
  принимает цена: сотых, штук: неотрицательное
  возвращает число
  пример «три по 19.99»
    дано цена равно 1999
    дано штук равно 3
    ожидается 5997
  цена умножить на штук
```

```
$ flang check docs/examples/guide/exact-money.flang
модуль «Exact money»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/guide/exact-money.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

### 21. I want to pass a function to another function

What to write: `функция «Имя»` — a reference to a declared function. Some arguments can be fixed in advance by name: `функция «Прибавить» с слагаемое равным 10`. There are no anonymous functions (lambdas) as values: only a declared function can be passed.

File: `docs/examples/guide/function-value.flang`

```flang
модуль «Function value»

тотальная функция «Удвоить»
  принимает число: число
  возвращает число
  число умножить на 2

тотальная функция «Прибавить»
  принимает слагаемое: число, число: число
  возвращает число
  слагаемое плюс число

тотальная функция «Применить дважды»
  принимает действие: функция из числа в число, число: число
  возвращает число
  действие от (действие от число)

тотальная функция «Пятёрка удвоена дважды»
  возвращает число
  пример «пять, десять, двадцать»
    ожидается 20
  «Применить дважды» от функция «Удвоить» и 5

тотальная функция «Десятка прибавлена дважды»
  возвращает число
  пример «пять, пятнадцать, двадцать пять»
    ожидается 25
  «Применить дважды» от (функция «Прибавить» с слагаемое равным 10) и 5
```

```
$ flang check docs/examples/guide/function-value.flang
модуль «Function value»: функций 5, из них с доказанным завершением 5; типов 0
docs/examples/guide/function-value.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

### 22. I want to guarantee a property of every item of the result

What to write: `обеспечивает … для всех … из результат:` — a guarantee about every item of the resulting list. No `теорема` is needed: the prover proves both guarantees on its own.

File: `docs/examples/guide/promise.flang`

```flang
модуль «Promise»

тотальная функция «Только положительные»
  принимает числа: список числа
  возвращает список числа
  обеспечивает «все положительны» для всех число из результат: число больше 0
  обеспечивает «отбор список не удлиняет» (длина результат) не больше (длина числа)
  пример «ноль и минус выброшены»
    дано числа равно [3, 0, -2, 5]
    ожидается [3, 5]
  отфильтровать числа где число → число больше 0
```

```
$ flang check docs/examples/guide/promise.flang
модуль «Promise»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/guide/promise.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/promise.flang --proof
…
что высказано и чем это несётся:
  постусловие «все положительны» функции «Только положительные» — доказано сведением цели с телом функции: правило «все элементы по построению», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
  постусловие «отбор список не удлиняет» функции «Только положительные» — доказано сведением цели с телом функции: правило «порядок по построению», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
…
docs/examples/guide/promise.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 2: доказано 2, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 23. I want to forbid bad arguments

What to write: `требует` — a precondition. The caller must satisfy it: in the example the second function calls the first, and the prover has proved that the condition holds there.

File: `docs/examples/guide/precondition.flang`

```flang
модуль «Precondition»

тотальная функция «Цена со скидкой»
  принимает цена: неотрицательное, скидка: неотрицательное
  возвращает число
  требует «скидка не больше цены» скидка не больше цена
  обеспечивает «цена не ушла в минус» результат не меньше 0
  пример «сто минус тридцать»
    дано цена равно 100
    дано скидка равно 30
    ожидается 70
  цена минус скидка

тотальная функция «Цена без скидки»
  принимает цена: неотрицательное
  возвращает число
  обеспечивает «цена без скидки не ушла в минус» результат не меньше 0
  пример «скидка ноль цену не меняет»
    дано цена равно 100
    ожидается 100
  «Цена со скидкой» от цена и 0
```

```
$ flang check docs/examples/guide/precondition.flang
модуль «Precondition»: функций 2, из них с доказанным завершением 2; типов 0
docs/examples/guide/precondition.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/precondition.flang --proof
…
что высказано и чем это несётся:
  постусловие «цена не ушла в минус» функции «Цена со скидкой» — доказано по объявленным типам аргументов: цель сведена правилом «неотрицательность по построению» — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
  постусловие «цена без скидки не ушла в минус» функции «Цена без скидки» — доказано сведением цели с телом функции: правило «цель есть допущение», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
…
docs/examples/guide/precondition.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 2: доказано 2, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 24. I want to prove what the prover could not

What to write: `теорема` (theorem) with `индукция по` (induction on) — a proof you lead yourself. The induction goes over the variants of your type; `убывает` is not needed.

File: `docs/examples/guide/theorem.flang`

```flang
модуль «Theorem»

тип «Счёт»
  вариант «Ноль»
  вариант «Следующий» содержит прежний: «Счёт»

тотальная функция «К числу»
  принимает счёт: «Счёт»
  возвращает число
  пример «ноль есть ноль»
    дано счёт равно вариант «Ноль»
    ожидается 0
  пример «два шага от нуля»
    дано счёт равно вариант «Следующий» с прежний равным (вариант «Следующий» с прежний равным (вариант «Ноль»))
    ожидается 2
  разбор счёт
    случай вариант «Ноль»
      то 0
    случай вариант «Следующий» с прежний как прежний
      то («К числу» от прежний) плюс 1

утверждение «шаг растит счёт на один»
  для всех счёт: «Счёт»
  утверждаем («К числу» от (вариант «Следующий» с прежний равным счёт)) равно ((«К числу» от счёт) плюс 1)

теорема «шаг растит счёт на один»
  дано счёт: «Счёт»
  утверждаем («К числу» от (вариант «Следующий» с прежний равным счёт)) равно ((«К числу» от счёт) плюс 1)
  индукция по счёт
    случай вариант «Следующий» с прежний как прежний
      то по предположению
  следовательно доказано
```

```
$ flang check docs/examples/guide/theorem.flang
модуль «Theorem»: функций 1, из них с доказанным завершением 1; типов 1
docs/examples/guide/theorem.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/theorem.flang --proof
…
что высказано и чем это несётся:
  утверждение «шаг растит счёт на один» — доказано индукцией по «Счёт»: база 1 случай, шаг при допущении на частях (1 случай), правила сведения: тождество после переписки допущением — утверждение обо ВСЕХ входах типа «Счёт», а не о написанных
…
docs/examples/guide/theorem.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 25. I want to state a property apart from a function

What to write: `утверждение` — a property stated apart from a function. The prover proves it the same way as `обеспечивает`.

File: `docs/examples/guide/statement.flang`

```flang
модуль «Statement»

утверждение «длина пустого списка нулевая»
  утверждаем (длина пустой список) равен 0

утверждение «ноль нейтрален при сложении»
  для всех число: неотрицательное таких что число больше 0
  утверждаем (число плюс 0) равен число
```

```
$ flang check docs/examples/guide/statement.flang
docs/examples/guide/statement.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang check docs/examples/guide/statement.flang --proof
…
что высказано и чем это несётся:
  утверждение «длина пустого списка нулевая» — доказано сведением цели с телом функции: правило «тождество после переписки допущением», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
  утверждение «ноль нейтрален при сложении» — доказано сведением цели с телом функции: правило «тождество после переписки допущением», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
…
docs/examples/guide/statement.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 2: доказано 2, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
$ echo $?
0
```

### 26. I want to read a file

What to write: a `план` (plan). The function does not read the file itself: it returns the command «Прочитать файл», the runtime executes it and calls the function again with the response. So all the logic is ordinary functions checked by examples without a disk. Only the command `flang io` works with the real file. In the code the command is called «поручение» and the response of the runtime «отклик».

File: `docs/examples/guide/read-file.flang`

```flang
модуль «Read file»

тип «Ход»
  вариант «Читаем»
  вариант «Ждём содержимое»

план «Сосчитать строки»
  состояние «Ход»
  начинает с «Начало»
  обрабатывает «Дальше»

тотальная функция «Начало»
  возвращает «Ход»
  пример «план начинается с чтения»
    ожидается вариант «Читаем»
  вариант «Читаем»

тотальная функция «Число строк»
  принимает текст: строка
  возвращает число
  пример «две строки и хвостовой перевод»
    дано текст равно "раз\nдва\n"
    ожидается 2
  длина (отфильтровать (разделить текст по "\n") где строчка → не (строчка равен ""))

тотальная функция «После чтения»
  принимает отклик: «Отклик»
  возвращает «Продолжение»
  пример «содержимое сосчитано и стало итогом плана»
    дано отклик равно вариант «Прочитано» с содержимое равным "раз\nдва\n"
    ожидается вариант «Конец работы» с значение равным 2
  пример «файла нет — план сдаётся кодом хозяина»
    дано отклик равно вариант «Сбой» с код равным "FLANG_IO_READ" и сообщение равным "No such file or directory"
    ожидается вариант «Провал» с код равным "FLANG_IO_READ" и сообщение равным "No such file or directory"
  разбор отклик
    случай вариант «Прочитано» с содержимое как текст
      то вариант «Конец работы» с значение равным («Число строк» от текст)
    случай вариант «Сбой» с код как код и сообщение как сообщение
      то вариант «Провал» с код равным код и сообщение равным сообщение
    случай любое
      то вариант «Провал» с код равным "FLANG_IO_ORDER" и сообщение равным "ждали содержимое файла"

тотальная функция «Дальше»
  принимает ход: «Ход», отклик: «Отклик»
  возвращает «Продолжение»
  пример «первым делом читается файл»
    дано ход равно вариант «Читаем»
    дано отклик равно вариант «Пока ничего»
    ожидается вариант «Сделать» с поручение равным (вариант «Прочитать файл» с путь равным "words.txt") и потом равным (вариант «Ждём содержимое»)
  разбор ход
    случай вариант «Читаем»
      то вариант «Сделать» с поручение равным (вариант «Прочитать файл» с путь равным "words.txt") и потом равным (вариант «Ждём содержимое»)
    случай вариант «Ждём содержимое»
      то «После чтения» от отклик
```

```
$ flang check docs/examples/guide/read-file.flang
модуль «Read file»: функций 4, из них с доказанным завершением 4; типов 4
docs/examples/guide/read-file.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang io docs/examples/guide/read-file.flang --plan 'Сосчитать строки'
доказано: утверждений 0
{"plan":"Сосчитать строки","result":3,"orders":1,"log":[{"поручение":{"variant":"Прочитать файл","fields":{"путь":"words.txt"}},"отклик":{"variant":"Прочитано","fields":{"содержимое":"раз\nдва\nтри\n"}}}]}
$ echo $?
0
```

### 27. I want to run an external program

What to write: a `план` with the command «Запустить процесс». A non-zero exit code is an ordinary result, not a launch error; a process killed by a signal arrives as a separate response variant.

File: `docs/examples/guide/run-process.flang`

```flang
модуль «Run process»

тип «Ход»
  вариант «Запускаем»
  вариант «Ждём потомка»

план «Спросить у потомка»
  состояние «Ход»
  начинает с «Начало»
  обрабатывает «Дальше»

тотальная функция «Начало»
  возвращает «Ход»
  пример «план начинается с запуска»
    ожидается вариант «Запускаем»
  вариант «Запускаем»

тотальная функция «Итог потомка»
  принимает отклик: «Отклик»
  возвращает «Продолжение»
  пример «вывод потомка становится итогом плана»
    дано отклик равно вариант «Процесс завершён» с код равным 0 и вывод равным "привет\n" и ошибки равным ""
    ожидается вариант «Конец работы» с значение равным "привет\n"
  пример «убитый потомок отличим от завершившегося»
    дано отклик равно вариант «Процесс убит» с сигнал равным "SIGKILL" и вывод равным "" и ошибки равным ""
    ожидается вариант «Провал» с код равным "ПОТОМОК_УБИТ" и сообщение равным "SIGKILL"
  разбор отклик
    случай вариант «Процесс завершён» с код как код и вывод как вывод и ошибки как ошибки
      то если код равен 0
        то вариант «Конец работы» с значение равным вывод
        иначе вариант «Провал» с код равным "ПОТОМОК_ОТКАЗАЛ" и сообщение равным ошибки
    случай вариант «Процесс убит» с сигнал как сигнал и вывод как вывод и ошибки как ошибки
      то вариант «Провал» с код равным "ПОТОМОК_УБИТ" и сообщение равным сигнал
    случай вариант «Сбой» с код как код и сообщение как сообщение
      то вариант «Провал» с код равным код и сообщение равным сообщение
    случай любое
      то вариант «Провал» с код равным "FLANG_IO_ORDER" и сообщение равным "ждали конца процесса"

тотальная функция «Дальше»
  принимает ход: «Ход», отклик: «Отклик»
  возвращает «Продолжение»
  пример «первым делом запускается потомок»
    дано ход равно вариант «Запускаем»
    дано отклик равно вариант «Пока ничего»
    ожидается вариант «Сделать» с поручение равным (вариант «Запустить процесс» с программа равным "echo" и аргументы равным ["привет"]) и потом равным (вариант «Ждём потомка»)
  разбор ход
    случай вариант «Запускаем»
      то вариант «Сделать» с поручение равным (вариант «Запустить процесс» с программа равным "echo" и аргументы равным ["привет"]) и потом равным (вариант «Ждём потомка»)
    случай вариант «Ждём потомка»
      то «Итог потомка» от отклик
```

```
$ flang check docs/examples/guide/run-process.flang
модуль «Run process»: функций 3, из них с доказанным завершением 3; типов 4
docs/examples/guide/run-process.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang io docs/examples/guide/run-process.flang --plan 'Спросить у потомка'
доказано: утверждений 0
{"plan":"Спросить у потомка","result":"привет\n","orders":1,"log":[{"поручение":{"variant":"Запустить процесс","fields":{"программа":"echo","аргументы":["привет"]}},"отклик":{"variant":"Процесс завершён","fields":{"код":0,"вывод":"привет\n","ошибки":""}}}]}
$ echo $?
0
```

### 28. I want to make an HTTP request

What to write: a `план` with the command «Запросить». The output below was taken where nothing listens at this address: the network error reached the plan as the response «Сбой», and the plan ended by itself with code 1.

File: `docs/examples/guide/ask-network.flang`

```flang
модуль «Ask network»

тип «Ход»
  вариант «Спрашиваем»
  вариант «Ждём ответа»

план «Спросить службу»
  состояние «Ход»
  начинает с «Начало»
  обрабатывает «Дальше»

тотальная функция «Начало»
  возвращает «Ход»
  пример «план начинается с запроса»
    ожидается вариант «Спрашиваем»
  вариант «Спрашиваем»

тотальная функция «После ответа»
  принимает отклик: «Отклик»
  возвращает «Продолжение»
  пример «тело ответа становится итогом плана»
    дано отклик равно вариант «Ответ сети» с код равным 200 и тело равным "готово"
    ожидается вариант «Конец работы» с значение равным "готово"
  пример «сеть недоступна — план сдаётся кодом хозяина»
    дано отклик равно вариант «Сбой» с код равным "FLANG_IO_NET" и сообщение равным "нет соединения"
    ожидается вариант «Провал» с код равным "FLANG_IO_NET" и сообщение равным "нет соединения"
  разбор отклик
    случай вариант «Ответ сети» с код как код и тело как тело
      то вариант «Конец работы» с значение равным тело
    случай вариант «Сбой» с код как код и сообщение как сообщение
      то вариант «Провал» с код равным код и сообщение равным сообщение
    случай любое
      то вариант «Провал» с код равным "FLANG_IO_ORDER" и сообщение равным "ждали ответ сети"

тотальная функция «Дальше»
  принимает ход: «Ход», отклик: «Отклик»
  возвращает «Продолжение»
  пример «первым делом уходит запрос»
    дано ход равно вариант «Спрашиваем»
    дано отклик равно вариант «Пока ничего»
    ожидается вариант «Сделать» с поручение равным (вариант «Запросить» с способ равным "GET" и адрес равным "http://127.0.0.1:8080/" и тело равным "") и потом равным (вариант «Ждём ответа»)
  разбор ход
    случай вариант «Спрашиваем»
      то вариант «Сделать» с поручение равным (вариант «Запросить» с способ равным "GET" и адрес равным "http://127.0.0.1:8080/" и тело равным "") и потом равным (вариант «Ждём ответа»)
    случай вариант «Ждём ответа»
      то «После ответа» от отклик
```

```
$ flang check docs/examples/guide/ask-network.flang
модуль «Ask network»: функций 3, из них с доказанным завершением 3; типов 4
docs/examples/guide/ask-network.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ echo $?
0
```

```
$ flang io docs/examples/guide/ask-network.flang --plan 'Спросить службу'
доказано: утверждений 0
{"error":"связь не установлена: Connection refused","diagnostics":[{"code":"FLANG_IO_NET","message":"связь не установлена: Connection refused","severity":"error","span":{"line":7,"column":1}}]}
$ echo $?
1
```

## Next

- [Map of the language constructs](language-map.html) — every keyword of the language in one diagram
- [Language reference](language.html) — the syntax of every construct
- [Which promises the kernel takes](what-the-kernel-accepts.html) — how to write a guarantee so that the prover proves it
- [Command reference](cli.html) — keys and exit codes
