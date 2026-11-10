# The kernel refused: whose mistake is it

The kernel — the prover, the part of the compiler that proves postconditions —
rejects a theorem you wrote with one of {{отказы.всего}} codes. The first
{{отказы.обязательств}} say the theorem does not line up with the function and
are fixed inside the theorem: `FLANG_PROOF_NO_GOAL`, `FLANG_PROOF_AMBIGUOUS`,
`FLANG_PROOF_DUPLICATE`, `FLANG_PROOF_CLAIM_MISMATCH`, `FLANG_PROOF_UNFINISHED`,
`FLANG_PROOF_UNKNOWN_VAR`, `FLANG_PROOF_VAR_TYPE`. The other {{отказы.вывода}}
say the derivation was not built, and that is either your mistake or a limit of
the language: `FLANG_PROOF_STEP`, `FLANG_PROOF_INDUCTION_STEP`,
`FLANG_PROOF_INDUCTION_TYPE`, `FLANG_PROOF_INDUCTION_BRANCH`,
`FLANG_PROOF_INDUCTION_CASES`, `FLANG_PROOF_INDUCTION_DESCENT`. The message
texts below are the output of `flang {{выпуск.версия}}`.

A refusal is exit code 1 and the line `не проверено — замечаний N` ("not
checked — N diagnostics"). A postcondition without a theorem that the kernel
did not derive is not a refusal: `flang check` exits with 0, and what really
happened to it is told by `flang check --proof` — see
[the three answers](how-proofs-work.html#обеспечивает-the-postcondition-and-the-three-answers).

## How to read the message

```
FLANG_PROOF_NO_GOAL в файле проба.flang, строка 23, столбец 1: теорема
«штраф положителен» ничего не закрывает: постусловия «штраф положителен» нет
ни у одной функции модуля. Теорема доказывает названное утверждение, а не
утверждение вообще — назовите её так же, как постусловие, которое она
закрывает
```

Code, file, line, column, text. Read the text to the end: for
`FLANG_PROOF_STEP` and `FLANG_PROOF_INDUCTION_STEP` it ends with what the kernel
knew at that point (`известно: предусловие функции «Сумма»`, "known: the
precondition of «Сумма»", or `не известно ничего`, "nothing is known"). Nothing
known means a fact was missing, and that is your mistake. Rules are listed and
the goal fits none of them — a limit of the kernel.

## The theorem does not line up with the function

These refusals are fixed in the theorem itself.

| Code | What happened | What to fix |
| --- | --- | --- |
| `FLANG_PROOF_NO_GOAL` | no function of the module has a postcondition with that name | the theorem's name: it has to match the postcondition's name |
| `FLANG_PROOF_AMBIGUOUS` | two postconditions fit the theorem's name | give the postconditions different names |
| `FLANG_PROOF_DUPLICATE` | one postcondition has more than one theorem | keep one |
| `FLANG_PROOF_CLAIM_MISMATCH` | `утверждаем` (we claim) is not written the way the postcondition is | rewrite it word for word: the kernel does not decide that two spellings mean the same |
| `FLANG_PROOF_UNFINISHED` | the line `следовательно доказано` (hence proved) is missing | add it |
| `FLANG_PROOF_UNKNOWN_VAR` | `дано` (given) introduces a name the function does not have | name the parameter as the function names it |
| `FLANG_PROOF_VAR_TYPE` | the theorem's variable and the parameter have different types | use the declared type of the parameter |

An example: the theorem and the postcondition have different names.

```flang refused
модуль «Проба»

тип «Светофор»
  вариант «Красный»
  вариант «Зелёный»

тотальная функция «Штраф»
  принимает свет: «Светофор»
  возвращает число
  для всех свет обеспечивает «штраф неотрицателен» результат не меньше 0
  пример «красный»
    дано свет равно вариант «Красный»
    ожидается 500
  пример «зелёный»
    дано свет равно вариант «Зелёный»
    ожидается 0
  разбор свет
    случай вариант «Красный»
      то 500
    случай вариант «Зелёный»
      то 0

теорема «штраф положителен»
  дано свет: «Светофор»
  утверждаем результат не меньше 0
  индукция по свет
    случай вариант «Красный»
      то по примеру «красный»
    случай вариант «Зелёный»
      то по примеру «зелёный»
  следовательно доказано
```

```
$ flang check проба.flang; echo "exit $?"
модуль «Проба»: функций 1, из них с доказанным завершением 1; типов 1
FLANG_PROOF_NO_GOAL в файле проба.flang, строка 23, столбец 1: теорема
«штраф положителен» ничего не закрывает: …
проба.flang: не проверено — замечаний 1
exit 1
```

Name the theorem `«штраф неотрицателен»` and the file passes with exit code 0.

## The derivation was not built

| Code | What happened | Whose mistake |
| --- | --- | --- |
| `FLANG_PROOF_INDUCTION_CASES` | the theorem's cases do not match the variants of the type | yours: an extra case speaks of something the type does not have |
| `FLANG_PROOF_INDUCTION_STEP` | `по предположению` (by the hypothesis) stands where there is nothing to assume | yours: this case has neither an induction hypothesis nor a `требует` |
| `FLANG_PROOF_STEP` | a step or the goal is not reduced by any rule | by the end of the message: a missing fact is yours; the wrong goal shape is a limit |
| `FLANG_PROOF_INDUCTION_TYPE` | the induction runs over a type that has no induction principle | a limit: there is no induction over `число` |
| `FLANG_PROOF_INDUCTION_BRANCH` | the function body is not of a form the result of a case is read from | a limit: the body is a `разбор` (match) or a `свёртка` (fold) over the same variable; for `неотрицательное`, an `если` |
| `FLANG_PROOF_INDUCTION_DESCENT` | the descent over `неотрицательное` is not named or is not by one | not named is yours; not by one is a limit |

### `FLANG_PROOF_INDUCTION_TYPE`

Induction is carried by a type with variants, a record, a list, a string and
`неотрицательное`. There is none over `число`:

```
FLANG_PROOF_INDUCTION_TYPE … индукция теоремы «двойная норма неотрицательна»
идёт по «норма», а у этого типа (число) принципа индукции нет: у «число» нет
дна: в носителе живёт «+∞», у которого «х минус 1» равно самому «х». …
```

"`число` has no bottom: +∞ lives in it, and for it `х минус 1` equals `х`."
The way round is to declare the parameter `неотрицательное`.

### `FLANG_PROOF_INDUCTION_BRANCH`

The kernel reads what `результат` is in each case from the function body:

```
FLANG_PROOF_INDUCTION_BRANCH … тело функции «Штраф» не разбирает «свет» на
верхнем уровне и не сворачивает «свет» свёрткой, поэтому заключение посылки
индукции построить не из чего. Ядро читает «результат» случая из ДВУХ форм
тела и ниоткуда больше: с ветви `разбор` по той же переменной … и с начала и
шага `свёртка` по той же переменной … Тело-вызов, тело-арифметика и
тело-условие заключения посылки не дают
```

The way round is to rewrite the body as a match on the variable the induction
runs over.

### `FLANG_PROOF_INDUCTION_DESCENT`

Induction over `неотрицательное` is written `индукция по н убывает н`. Without
the words `убывает н` the kernel asks you to add them. With them it checks the
descent in the body, and reads only `н минус 1`:

```
FLANG_PROOF_INDUCTION_DESCENT … спуск в шаге «Сумма до» не строгий: вычитают
на 2, а не на 1. Ядро читает ровно «н минус 1» и ничего кроме: убывание на
единицу внутри [0, 2⁵³−1] точно (соседние целые там представимы), и цепочка
спуска дна не проскакивает. …
```

The kernel does not prove a step that subtracts two.

### `FLANG_PROOF_STEP`

The refusal lists the goal shapes the kernel has a rule for:

```
FLANG_PROOF_STEP … цель не сведена к 1 предусловию функции: у цели этого
случая нет вида, к которому у ядра есть правило: правил десять — «не меньше 0»,
«не больше конечного литерала», «не больше терма», «не меньше терма», «меньше
терма», «больше терма», «равно», «содержит», «не убывает» и «начинается с» …
Вида цели не спрашивает только одиннадцатое, «цель есть допущение», и оно тоже
не прошло: ни одно допущение не совпало с целью знак в знак. … известно:
предусловие функции «Сумма»
```

Ten shapes: not less than 0, not greater than a finite literal, not greater
than a term, not less than a term, less than a term, greater than a term,
equals, contains, non-decreasing, starts with; the eleventh way, "the goal is an
assumption", does not look at the shape. Here the goal was
`не (результат равен 0)`. If the goal is none of these shapes, rewrite the
postcondition, not the theorem. If the shape fits and the fact is missing from
`известно:`, add a `требует` to the function or `индукция по` to the theorem.

## Refusals that are not about theorems

These codes come with no theorem in the file:

| Code | What happened | Where it is explained |
| --- | --- | --- |
| `FLANG_NOT_TOTAL` | the termination of a `тотальная` function is not proved | [Termination](how-proofs-work.html#termination) |
| `FLANG_PRECONDITION_CALL` | the caller did not prove the callee's `требует` | [`требует`](how-proofs-work.html#требует-the-precondition) |
| `FLANG_PRECONDITION` | `требует` is broken at the program's entry or in an example | same place |
| `FLANG_EXAMPLE: FLANG_PROPERTY` | an input was found on which the postcondition is false | [A false postcondition](how-proofs-work.html#a-false-postcondition) |
| `FLANG_BOUND_ON_NAN` | a bound on `число` is false on NaN | [What the kernel proves by itself](what-the-kernel-accepts.html) |

All compiler codes are in the [Diagnostics reference](diagnostics.html).

## Next

- [Proofs by hand](manual-proofs.html) — how to write a theorem.
- [What the kernel proves by itself](what-the-kernel-accepts.html) — how to
  rewrite a postcondition so that no theorem is needed.
- [The kernel specification](../spec-proof.html) — in Russian; the inference
  rules in full.
