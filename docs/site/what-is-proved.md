# What is proved and what is not

Which results of `flang check --proof` you can rely on, what is proved about
the compiler itself, and where you still need tests. Every number has the
command that prints it next to it.

## What is proved in the repository

The compiler, the standard library and the examples: {{корпус.файлов}} files,
{{корпус.функций}} functions, {{корпус.строк|разрядами}} lines. The numbers
below come from a full compiler run over the repository (`bootstrap/flang
run-script numbers:build`, several hours), so they may lag behind the code. For
one file `flang check <file> --proof --json` prints the same numbers in
seconds.

### Termination: {{корпус.тотальных}} functions of {{корпус.функций}}

| What proves termination | Functions | Run-time check |
|---|---:|---|
| No recursion at all | {{носители.композиция}} | none |
| Recursion on a part of the input (a tail, a field) | {{носители.структура}} | none |
| Counting down a number of type `неотрицательное` | {{носители.точныйШаг}} | none |
| Counting down a plain `число` with a lower bound | {{носители.постоянныйШаг}} | yes |
| A declared measure (`убывает`) | {{носители.мера}} | yes |

In the last two rows what decreases is a `число`, and that is a float: for a
large `х` the expression `х минус 1` equals `х`. So the compiler leaves a check
in the generated code — {{сторож.мест}} places in {{сторож.функций}} functions.
The other {{корпус.обычных}} functions are declared without `тотальная`. Three
of them are not meant to terminate: the main loop of the interpreter
(`flang/self/interpret.flang`), which runs someone else's program; the step
limit, `FLANG_RECURSION_LIMIT`, stops it.

### Postconditions: {{утверждения.доказано}} of {{утверждения.высказано}}

| The prover's answer | How many |
|---|---:|
| Proved for all inputs | {{утверждения.доказано}} |
| Passed only on examples («сетка») | {{утверждения.сеткой}} |
| Rejected as false | {{утверждения.отвергнуто}} |

The rest are declared with neither a proof nor examples. Assumptions taken on
trust («на веру»): {{законы.наВеру}}. What each answer means:
[How a proof works](how-proofs-work.html#обеспечивает-the-postcondition-and-the-three-answers).

### The compiler's proofs are re-checked independently

A separate C program re-checks [the proof record](record-format.html). One
command runs it over the compiler's own proofs:

```
$ bootstrap/flang io scripts/provability.fscript --plan Verdict --timeout 900000
ДОКАЗУЕМ
проверка 2 — доля проигрыванием не ниже 100 %? ДА (100.00 %: 661 из 661;
недостижимых мест вынесено 41)
проверка 3 — набор проб пройден? ДА (набор подделок 45 из 45; проб на подлог
825, принято кодом 0 — 0; честных 414, отвергнуто 0)
```

`ДОКАЗУЕМ` is "provable". The C program re-checked 661 proof places of 661. Of
825 deliberately corrupted records none was accepted, and of 414 correct ones
none was rejected. The hundred percent is about the compiler's own proof
records. It says nothing about your programs or about the built binary.

A second command measures the rest:

```
$ bootstrap/flang io scripts/four-coverages.fscript --plan Measure --timeout 900000
```

| What | How much |
|---|---|
| Inference rules with a Lean 4 lemma | 164 of 168 lines of the rule list |
| Inference rules in the Lean acceptance file | 93 of 144; 51 outside it |
| Known soundness violations, open | 5, each by name |
| flang → C translation rules compared with the source | 24 of 41 |

The command does not run Lean itself; `sh flang/proof/lean/run.sh` does. The
prover has no axioms, and a command checks that too —
[Why and how](proofs.html#what-proved-means).

## What is not proved

### The compiler's own sources are not checked in full

`flang check` stops a run that exceeds the step limit with
`FLANG_RECURSION_LIMIT`; `--step-limit N` raises the limit for one run. On the
largest compiler sources a plain `flang check` may stop before it has checked
every example and proof. Files that declare categories and processes are
checked in part: the compiler prints «проверено НЕ ДО КОНЦА» (not checked to
the end) and exits with 2.

You have to trust the prover's rules, the compiler that runs them, the C
checking program, the C compiler and the hardware.

### Two holes are open in the type check

`0 делить на 0` passes `flang check`, and the result is NaN. A generic function
called in a `разбор` branch is not compared with the declared result type. The
rest: [Known limits](limits.html).

### A bound on `число` is false on NaN

NaN is outside the order: both `NaN не меньше 0` and `NaN меньше 0` are false.
So "the absolute value is non-negative" is a false postcondition, and the
prover is right not to prove it:

```flang
модуль «Граница»

тотальная функция «Модуль»
  принимает х: число
  возвращает число
  обеспечивает «модуль неотрицателен» результат не меньше 0
  если х не меньше 0
    то х
    иначе 0 минус х

тотальная функция «Модуль не числа»
  возвращает число
  «Модуль» от (0 делить на 0)
```

```
$ flang check граница.flang --proof; echo "exit $?"
  постусловие «модуль неотрицателен» функции «Модуль» — объявлено, не доказано:
  ни теоремы, ни примеров. Его считает рантайм после каждого возврата — на тех
  входах, которые придут
exit 3
$ flang run граница.flang --function 'Модуль не числа' --trust; echo "exit $?"
на веру: доказанность не считалась — запуск по ключу --trust
FLANG_PROPERTY: нарушено свойство «модуль неотрицателен» функции «Модуль»
exit 1
```

"The prover could not" and "the statement is false" look the same in the
report. Before you work out why a postcondition is not proved, run it on `0`,
`−0`, `±∞`, NaN, `2⁵³` and the empty string. Write a bound on `число` with a
finiteness condition, or declare the argument with an exact type:
`неотрицательное`, `сотых`, `тысячных`.

### A proved postcondition may say nothing

The postcondition `результат равен (0 минус х)` with the body `0 минус х` is
proved in one step: it repeats the body. "The length of the result is
non-negative" holds for any function. You can check mechanically: replace the
body with a stub (`0`, `""`, `нет`, the empty list). If the postcondition is
still proved, it says nothing about this function. For bounds take a stub
outside the bound: `−1` or a number above the ceiling.

On twenty library functions (`docs/benchmarks/proof-cost/functions/`):

```
$ bootstrap/flang run-script proofs:count-20
  доказано хоть что-нибудь: 14 из 20
  из них СОДЕРЖАТЕЛЬНО:    10 из 20
  содержательных: 11  ослабленных: 6  даровых: 1  не проверено: 2
```

Of twenty proved postconditions 11 fall with a stub, that is, they speak about
the function. Six are proved with a stub too, one rewrites the body, and two
could not be checked by substitution.

### Proved does not mean correct

A proof says the code matches the postcondition. It does not say the
postcondition expresses what was meant:

```flang
модуль «Не то»

тотальная функция «Наибольшее»
  принимает а: неотрицательное, б: неотрицательное
  возвращает число
  обеспечивает «не меньше первого» результат не меньше а
  обеспечивает «не меньше второго» результат не меньше б
  пример «два и три»
    дано а равно 2
    дано б равно 3
    ожидается 5
  а плюс б
```

Both postconditions are proved for all inputs, and the function («Наибольшее»,
"the greatest") returns the sum, not the greatest. A human reads the
postcondition and the example.

### An unproved postcondition costs time

A proved postcondition is not in the generated program. An unproved one is
computed on every return from the function. It costs most on a small function
that a `свёртка` (fold) calls on every element of a list.
`flang check --proof --strict` exits with 3 if something is not proved — put it
in CI.

## Check it yourself

| What | Command |
|---|---|
| The proof report of one file | `flang check <file> --proof` |
| The same as JSON | `flang check <file> --proof --json` |
| The report over all programs of the repository | `bootstrap/flang run-script proofs:report` |
| Useful postconditions among the twenty | `bootstrap/flang run-script proofs:count-20` |
| The compiler's proofs re-checked by the C program | `bootstrap/flang io scripts/provability.fscript --plan Verdict --timeout 900000` |
| Lean, soundness, translation to C | `bootstrap/flang io scripts/four-coverages.fscript --plan Measure --timeout 900000` |

## Next

- [The Coq and Lean classics](mathematics.html) — what the prover takes of
  seventy-five classical lemmas.
- [Known limits](limits.html) — what the language cannot do.
- [Real cases](case-studies.html) — where a proof caught a bug.
