# Diagnostics reference

When the compiler rejects a program, every error line starts with a code:

```text insert output: check docs/examples/diagnostics/type.flang
$ flang check docs/examples/diagnostics/type.flang
модуль «Probe»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_TYPE в файле docs/examples/diagnostics/type.flang, строка 6, столбец 3: функция «Удвоить» объявлена как число, а тело даёт строка
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле ambiguous.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 8: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле example.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле mismatch.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-goal.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-steps.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле parse.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле unknown.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
docs/examples/diagnostics/type.flang: не проверено — замечаний 1
$ echo $?
1
```

The line gives the code, the file, the line and the column, and says what is
wrong. The compiler prints its messages in Russian unless `.flangrc` says
`language = en` (or `FLANG_LANG=en` is set): then `flang check` prints the code
unchanged and the text in English for the codes that have an English template
(ADR-0102). This page explains each code: what it means and what to do about
it. Codes are grouped by the stage that reports them: parsing first, then names,
types, termination and proofs.

Exit codes of `flang check`: `0` — no errors; `1` — errors found; `2` — bad
call (unknown flag, no such file); `3` — with `--proof`, a guarantee is not
proved (with `--proof --strict`, anything short of "everything is proved");
`4` — part of the checks did not run (`--fast`). The full table for all commands
is on the [Command reference](cli.html#exit-codes).

Words in this page: a **guarantee** is an `обеспечивает` line
(postcondition); the **prover** is the part of the compiler that proves
guarantees for all inputs, called «ядро» in the output; a **unit test** is a
`пример`.

## Three traps that cost a day

Read these before you look up your code. In each one the error shows up
somewhere other than where the mistake is.

### A guarantee that calls a function of its own module breaks every module that imports it by list

The module checks fine on its own. The module that imports it fails.

```flang insert docs/examples/diagnostics/core.flang
модуль «Core»

тотальная функция «Двойка»
  принимает н: число
  возвращает число
  н умножить на 2

тотальная функция «Учтено»
  принимает н: число
  возвращает число
  обеспечивает «не меньше двойки» результат не меньше («Двойка» от н)
  («Двойка» от н) плюс 1
```

```flang refused insert docs/examples/diagnostics/import.flang
модуль «Import»
использует «Core» только «Учтено»

тотальная функция «Проба»
  принимает н: число
  возвращает число
  «Учтено» от н
```

```text insert output: check docs/examples/diagnostics/core.flang
$ flang check docs/examples/diagnostics/core.flang
модуль «Core»: функций 2, из них с доказанным завершением 2; типов 0
docs/examples/diagnostics/core.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

```text insert output: check docs/examples/diagnostics/import.flang
$ flang check docs/examples/diagnostics/import.flang
модуль «Import»: функций 3, из них с доказанным завершением 3; типов 0; файлов вместе с импортами 2
docs/examples/diagnostics/import.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

The import `только «Учтено»` brings in one name. Both the body and the
guarantee of «Учтено» call «Двойка», which the importing module does not have.
Column 56 points inside the guarantee. The line numbers are those of the
imported file, and no file is named because two files were checked together.

Fix it in one of three ways:

| Fix | How |
|---|---|
| import the helper too | `использует «Core» только «Учтено», «Двойка»` |
| import the whole module | `использует «Core»` |
| remove the call from the guarantee | say the same with arithmetic: `результат не меньше (н умножить на 2)` |

### `flang check` passing does not mean the guarantees are proved

`flang check` without flags checks parsing, types, termination and unit tests.
A guarantee it can neither prove nor refute does not make it fail. The
guarantee «не меньше двойки» above is not proved: without `--proof` the file
passes with exit code 0; with `--proof` the same file exits with 3.

To see what is proved, ask for the proof report:

```bash
flang check docs/examples/diagnostics/core.flang --proof
```

```
  постусловие «не меньше двойки» функции «Учтено» — объявлено, не доказано: ни теоремы, ни примеров. Его считает рантайм после каждого возврата — на тех входах, которые придут
…
docs/examples/diagnostics/core.flang: НЕ ПРОВЕРЕНО — утверждений 1: доказано 0, условно 0, сетка 0, объявлено, не доказано 1, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 3
```

How to read the result of each guarantee: «доказано» — proved for all inputs;
«сетка N» — checked only on your N examples, which is not a proof;
«объявлено, не доказано» — declared, with neither a proof nor examples. In CI
use `flang check --proof --strict`: it exits `0` only when everything is
proved.

Second trap in the same output: while a `FLANG_UNKNOWN_NAME` error stands, the
function also loses its proved termination, and nothing proves its guarantees.
Fix unknown names first.

### FLANG_BOUND_ON_NAN: the type `число` contains NaN, and NaN is not ordered

The most common surprise. The guarantee looks obviously true, and the prover
answers with a counterexample.

```flang refused insert docs/examples/diagnostics/nan.flang
модуль «Probe»

тотальная функция «Прибавить один»
  принимает н: число
  возвращает число
  обеспечивает «результат больше довода» результат больше н
  н плюс 1
```

```text insert output: check docs/examples/diagnostics/nan.flang
$ flang check docs/examples/diagnostics/nan.flang
модуль «Probe»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_BOUND_ON_NAN в файле docs/examples/diagnostics/nan.flang, строка 6, столбец 3: постусловие «результат больше довода» функции «Прибавить один» ЛОЖНО, и контрпример назван: «н» объявлен типом «число», а «не число» живёт в этом типе и стоит ВНЕ ПОРЯДКА — оно не больше и не меньше ничего, включая самоё себя. Тело собрано только из арифметики над «н», а всякая арифметическая операция «не число» переносит, значит результат есть «не число», и сравнение с ним ложно. Позовите «Прибавить один» от (0 делить на 0) — рантайм ответит FLANG_PROPERTY. Чинится тремя способами: объявить вход отрезком («неотрицательное», «целое») — тогда «не число» не втащить вовсе; поставить предусловие — за него платит вызывающий; либо оговорить границу, и ядро оговорку читает: обеспечьте «не ((н минус н) равен 0) или (…)»
docs/examples/diagnostics/nan.flang: не проверено — замечаний 1
$ echo $?
1
```

The reason: the type `число` is a floating-point number and contains NaN
(«не число»). Every arithmetic operation on NaN gives NaN, and every comparison
with NaN is false. So "the result is greater than the argument" is false for
NaN.

| Fix | What to write | Who pays |
|---|---|---|
| narrow the argument type | `принимает н: неотрицательное` or `целое` | nobody: NaN cannot get in |
| add a precondition | `требует «вход есть число» (н минус н) равен 0` | the caller |
| exclude NaN in the guarantee itself | `обеспечивает «…» не ((н минус н) равен 0) или (результат больше н)` | nobody |

`(н минус н) равен 0` is false exactly when `н` is NaN.

## Parsing

| Code | What it means | What to do |
|---|---|---|
| `FLANG_LEX` | the lexer could not read a token: an unclosed quote, an unexpected character | close the quote, remove the character |
| `FLANG_PARSE` | the tokens are fine, the construct is not | look at the line and column: usually a missing `иначе` branch, or a keyword used as a name |

```flang refused insert docs/examples/diagnostics/parse.flang
модуль «Probe»

тотальная функция «Удвоить»
  принимает н: число
  возвращает число
  если н больше 0 то н умножить на 2
```

```text insert output: check docs/examples/diagnostics/parse.flang
$ flang check docs/examples/diagnostics/parse.flang
FLANG_PARSE в файле docs/examples/diagnostics/parse.flang, строка 7, столбец 1: у 'если' нет ветки 'иначе'
docs/examples/diagnostics/parse.flang: не проверено — замечаний 1
$ echo $?
1
```

```text insert output: check docs/examples/diagnostics/lex.flang
$ flang check docs/examples/diagnostics/lex.flang
FLANG_LEX в файле docs/examples/diagnostics/lex.flang, строка 5, столбец 3: не закрыта кавычка
docs/examples/diagnostics/lex.flang: не проверено — замечаний 1
$ echo $?
1
```

`если … то …` is an expression, so it always needs `иначе`.

## Names and imports

| Code | What it means | What to do |
|---|---|---|
| `FLANG_UNKNOWN_NAME` | the name is not defined: no such function or variable | declare it, import the module, or fix the spelling |
| `FLANG_AMBIGUOUS_NAME` | two imports bring the same name | drop one import or narrow it with `только` |
| `FLANG_BAD_NAME` | the name is not written the way names are written | rename: function names go in guillemets, parameters are plain words |
| `FLANG_NAME_TAKEN` | the name is used by another declaration | pick another name |
| `FLANG_DUPLICATE_NAME` | the same name is declared twice: in one place or in two modules of one program, including a namesake helper of an imported function hidden by an `only` list | remove the second declaration, list the helper in `only` or rename |
| `FLANG_IMPORT_NOT_FOUND` | the imported module was not found | check the module name and the path in `из "…"` |
| `FLANG_IMPORT_CYCLE` | modules import each other in a circle | move the shared part into a third module |
| `FLANG_IMPORT_AMBIGUOUS` | one name comes from two modules | narrow the import with `только` |
| `FLANG_IMPORT_NAME` | the `только` list names something the module does not declare | compare the list with the module's declarations |

```flang refused insert docs/examples/diagnostics/unknown.flang
модуль «Probe»

тотальная функция «Удвоить»
  принимает н: число
  возвращает число
  «Утроить» от н
```

```text insert output: check docs/examples/diagnostics/unknown.flang
$ flang check docs/examples/diagnostics/unknown.flang
модуль «Probe»: функций 1, из них с доказанным завершением 0; типов 0
без доказанного завершения: «Удвоить»
FLANG_UNKNOWN_NAME в файле docs/examples/diagnostics/unknown.flang, строка 6, столбец 3: неизвестная функция «Утроить»
FLANG_NOT_TOTAL в файле docs/examples/diagnostics/unknown.flang, строка 6, столбец 3: тотальная функция «Удвоить» вызывает неизвестную функцию «Утроить»: завершение доказать нельзя
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле ambiguous.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 8: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле example.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле mismatch.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-goal.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-steps.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле parse.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле type.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
docs/examples/diagnostics/unknown.flang: не проверено — замечаний 2
$ echo $?
1
```

An unknown name always brings a second error about termination: the compiler
cannot prove that a call to an unknown function terminates. Fix the first and
the second goes away.

If an operation is written in the wrong order, the compiler says how to write
it:

```text insert output: check docs/examples/diagnostics/operator-order.flang
$ flang check docs/examples/diagnostics/operator-order.flang
FLANG_UNKNOWN_NAME в файле docs/examples/diagnostics/operator-order.flang, строка 10, столбец 3: имя «умножить» не связано: имя вводят 'принимает', 'пусть' или образец 'случай'; а действия языка ('плюс', 'минус', 'умножить на', 'делить на', 'остаток от') пишутся МЕЖДУ значениями — «3.14 умножить на р», а не «умножить 3.14 на р»
docs/examples/diagnostics/operator-order.flang: не проверено — замечаний 1
$ echo $?
1
```

## Types

| Code | What it means | What to do |
|---|---|---|
| `FLANG_TYPE` | the declared type differs from what the body or the argument gives; also a function declared twice | make them agree |
| `FLANG_TYPE_ARGS` | a built-in type was given type arguments; built-in types such as `число` take none | remove the arguments |
| `FLANG_TYPE_PARAM` | a type parameter is declared twice, has no name, or is named like a built-in or declared type | rename the parameter |
| `FLANG_APPLY` | the call does not fit: wrong number of arguments, or the callee is not a function | compare the call with the signature |
| `FLANG_BUILTIN_ARGS` | a built-in operation got the wrong number of arguments | check the operation's description |
| `FLANG_MATCH_NOT_EXHAUSTIVE` | the pattern match does not cover every case | add the missing `случай` |
| `FLANG_MATCH_UNREACHABLE` | a case is covered by an earlier one and never runs | remove it or move it up |
| `FLANG_EXAMPLE` | a unit test failed: the value differs from the expected one | fix the body or the expected value |

```text insert output: check docs/examples/diagnostics/type.flang
$ flang check docs/examples/diagnostics/type.flang
модуль «Probe»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_TYPE в файле docs/examples/diagnostics/type.flang, строка 6, столбец 3: функция «Удвоить» объявлена как число, а тело даёт строка
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле ambiguous.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 8: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле example.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле mismatch.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-goal.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-steps.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле parse.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле unknown.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
docs/examples/diagnostics/type.flang: не проверено — замечаний 1
$ echo $?
1
```

```text insert output: check docs/examples/diagnostics/duplicate.flang
$ flang check docs/examples/diagnostics/duplicate.flang
модуль «Probe»: функций 2, из них с доказанным завершением 2; типов 0
FLANG_TYPE в файле docs/examples/diagnostics/duplicate.flang, строка 8, столбец 1: функция «Удвоить» объявлена дважды
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле ambiguous.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 8, и в соседнем модуле ambiguous.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле example.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 8, и в соседнем модуле example.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле mismatch.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 8, и в соседнем модуле mismatch.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-goal.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 8, и в соседнем модуле no-goal.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-steps.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 8, и в соседнем модуле no-steps.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле parse.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 8, и в соседнем модуле parse.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле type.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 8, и в соседнем модуле type.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле unknown.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 8, и в соседнем модуле unknown.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
docs/examples/diagnostics/duplicate.flang: не проверено — замечаний 1
$ echo $?
1
```

```text insert output: check docs/examples/diagnostics/match.flang
$ flang check docs/examples/diagnostics/match.flang
модуль «Probe»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_MATCH_NOT_EXHAUSTIVE в файле docs/examples/diagnostics/match.flang, строка 6, столбец 3: разбор списка не покрывает «пусто»
docs/examples/diagnostics/match.flang: не проверено — замечаний 1
$ echo $?
1
```

```text insert output: check docs/examples/diagnostics/example.flang
$ flang check docs/examples/diagnostics/example.flang
модуль «Probe»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_EXAMPLE: пример «Двойка» функции «Удвоить»: значение не совпало с ожидаемым: ожидалось 5, получено 4
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле ambiguous.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 8: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле mismatch.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-goal.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-steps.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле parse.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле type.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле unknown.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
docs/examples/diagnostics/example.flang: не проверено — замечаний 1
$ echo $?
1
```

## Termination and limits

| Code | What it means | What to do |
|---|---|---|
| `FLANG_NOT_TOTAL` | the function is declared `тотальная`, and its termination is not proved | pass a PART of the argument to the recursive call (the tail of a list, a field of a variant), not a recomputed number |
| `FLANG_MEASURE` | the declared measure does not decrease | fix `убывает` or the call |
| `FLANG_RECURSION_LIMIT` | evaluation ran out of steps or call depth | raise `--max-steps` / `--max-depth`, or fix the recursion |
| `FLANG_STEP_LIMIT` | the step limit ran out inside a unit test | the same `--max-steps` flag |
| `FLANG_BUDGET_EXHAUSTED` | the step budget of the run ran out | raise the budget or make the task smaller |
| `FLANG_MEMORY` | out of memory | make the data smaller |
| `FLANG_STOPPED` | the run was stopped from outside | run it again |

```flang refused insert docs/examples/diagnostics/total.flang
модуль «Probe»

тотальная функция «Считать»
  принимает н: число
  возвращает число
  если н равно 0 то 0 иначе («Считать» от (н плюс 1))
```

```text insert output: check docs/examples/diagnostics/total.flang
$ flang check docs/examples/diagnostics/total.flang
модуль «Probe»: функций 1, из них с доказанным завершением 0; типов 0
без доказанного завершения: «Считать»
FLANG_NOT_TOTAL в файле docs/examples/diagnostics/total.flang, строка 6, столбец 30: тотальная функция «Считать»: рекурсивный вызов «Считать» не убывает — аргумент 1 («н» add 1) увеличивает параметр «н». Передавайте часть аргумента: хвост списка из образца «голова и хвост», поле варианта из образца, поле записи или элемент коллекции
docs/examples/diagnostics/total.flang: не проверено — замечаний 1
$ echo $?
1
```

`н плюс 1` grows, so the compiler cannot show that the recursion ends.

To see the step limit, run with a small `--max-steps`. `flang run` computes
only proved programs; this `rec.flang` has unproved parts, so `--trust` is
added:

```text insert output: run docs/examples/diagnostics/recursion.flang --function "Вниз" --args '{"н":100}' --max-steps 5 --trust
$ flang run docs/examples/diagnostics/recursion.flang --function "Вниз" --args '{"н":100}' --max-steps 5 --trust
на веру: доказанность не считалась — запуск по ключу --trust
FLANG_RECURSION_LIMIT: функция «Вниз» исчерпала лимит шагов (5) на глубине вызовов 1
$ echo $?
1
```

## Guarantees and proofs

Preconditions (`требует`), guarantees (`обеспечивает`) and theorems.

| Code | What it means | What to do |
|---|---|---|
| `FLANG_PROPERTY` | a guarantee was violated at run time | either the guarantee or the body is wrong — look at the input it failed on |
| `FLANG_PRECONDITION` | the precondition is written wrong | check the form `требует «имя» <условие>` |
| `FLANG_PRECONDITION_CALL` | the caller does not ensure the callee's precondition | prove the condition at the call site, or narrow the argument type |
| `FLANG_BOUND_ON_NAN` | an order guarantee is false because of NaN | see the third trap above |
| `FLANG_PROOF_NO_GOAL` | the theorem proves nothing: no guarantee has that name | name the theorem exactly like the guarantee |
| `FLANG_PROOF_AMBIGUOUS` | the theorem would prove two guarantees at once | give the guarantees different names |
| `FLANG_PROOF_CLAIM_MISMATCH` | `утверждаем` differs from the guarantee | copy the guarantee text word for word |
| `FLANG_PROOF_DUPLICATE` | two theorems prove the same guarantee | keep one |
| `FLANG_PROOF_STEP` | a step has no justification, or there are no steps at all | add `по свойству «…»`, `по примеру «…»` or `по предположению` |
| `FLANG_PROOF_UNFINISHED` | the proof does not end | add `следовательно доказано` |
| `FLANG_PROOF_UNKNOWN_VAR` | the claim uses an undeclared name | declare it with `дано` |
| `FLANG_PROOF_VAR_TYPE` | a theorem variable has a different type than the parameter | make `дано` match the function signature |
| `FLANG_PROOF_INDUCTION_TYPE` | induction over this type is not possible | induction goes over a type with variants or over `неотрицательное` |
| `FLANG_PROOF_INDUCTION_CASES` | not every case of the induction is covered | add the missing `случай` |
| `FLANG_PROOF_INDUCTION_BRANCH` | a case does not reach the goal | justify that case |
| `FLANG_PROOF_INDUCTION_STEP` | the induction step does not reach the hypothesis | add `по предположению` and make both sides match exactly |
| `FLANG_PROOF_INDUCTION_DESCENT` | the induction step is not exactly one down | make the step exactly one down |
| `FLANG_INITIAL_FAILURE` | no induction rule could be built for the type | check that the type is declared with variants |
| `FLANG_UNCOVERED_FAILURE` | an error case is not handled by the pattern match | add a case for the error |

```flang refused insert docs/examples/diagnostics/no-steps.flang
модуль «Probe»

тотальная функция «Удвоить»
  принимает н: число
  возвращает число
  обеспечивает «удвоенное неотрицательно» если н не меньше 0 то (результат не меньше 0) иначе да
  н умножить на 2

теорема «удвоенное неотрицательно»
  дано н: число
  утверждаем если н не меньше 0 то (результат не меньше 0) иначе да
  следовательно доказано
```

```text insert output: check docs/examples/diagnostics/no-steps.flang
$ flang check docs/examples/diagnostics/no-steps.flang
модуль «Probe»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_PROOF_STEP: теорема «удвоенное неотрицательно»: ни одного шага
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле ambiguous.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 8: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле example.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле mismatch.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-goal.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле parse.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле type.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле unknown.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
docs/examples/diagnostics/no-steps.flang: не проверено — замечаний 1
$ echo $?
1
```

```text insert output: check docs/examples/diagnostics/no-goal.flang
$ flang check docs/examples/diagnostics/no-goal.flang
модуль «Probe»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_PROOF_NO_GOAL в файле docs/examples/diagnostics/no-goal.flang, строка 8, столбец 1: теорема «удвоенное неотрицательно» ничего не закрывает: постусловия «удвоенное неотрицательно» нет ни у одной функции модуля. Теорема доказывает названное утверждение, а не утверждение вообще — назовите её так же, как постусловие, которое она закрывает
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле ambiguous.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 8: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле example.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле mismatch.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-steps.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле parse.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле type.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле unknown.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
docs/examples/diagnostics/no-goal.flang: не проверено — замечаний 1
$ echo $?
1
```

```text insert output: check docs/examples/diagnostics/ambiguous.flang
$ flang check docs/examples/diagnostics/ambiguous.flang
модуль «Probe»: функций 2, из них с доказанным завершением 2; типов 0
FLANG_PROOF_AMBIGUOUS в файле docs/examples/diagnostics/ambiguous.flang, строка 15, столбец 1: теорема «неотрицательно» закрывала бы сразу 2 постусловия («Удвоить», «Утроить»), и выбрать нельзя. Дайте постусловиям разные имена
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 8: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле example.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле mismatch.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-goal.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-steps.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле parse.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле type.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле unknown.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
docs/examples/diagnostics/ambiguous.flang: не проверено — замечаний 1
$ echo $?
1
```

```text insert output: check docs/examples/diagnostics/mismatch.flang
$ flang check docs/examples/diagnostics/mismatch.flang
модуль «Probe»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_PROOF_CLAIM_MISMATCH в файле docs/examples/diagnostics/mismatch.flang, строка 11, столбец 3: теорема «неотрицательно» утверждает не то, что обещает функция «Удвоить»: утверждение теоремы и постусловие обязаны совпадать слово в слово. Ядро не решает, что два разных утверждения означают одно и то же
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле ambiguous.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле duplicate.flang, строка 8: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле example.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-goal.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле no-steps.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле parse.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле type.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
замечание: «Удвоить» объявлено здесь, строка 3, и в соседнем модуле unknown.flang, строка 3: программа, которая ввезёт оба модуля, получит FLANG_DUPLICATE_NAME
docs/examples/diagnostics/mismatch.flang: не проверено — замечаний 1
$ echo $?
1
```

A guarantee the prover could not prove is checked at run time. `flang run`
refuses unproved programs, so `--trust` is needed to see it:

```text insert output: run docs/examples/diagnostics/property.flang --function "Половина" --args '{"н":0}' --trust
$ flang run docs/examples/diagnostics/property.flang --function "Половина" --args '{"н":0}' --trust
на веру: доказанность не считалась — запуск по ключу --trust
FLANG_PROPERTY: нарушено свойство «результат меньше довода» функции «Половина»
$ echo $?
1
```

### Laws of declared structures

These laws are CHECKED on a finite set of values you provide, not proved. An
error means a violation was found, so there is always a counterexample.

| Code | Which law is broken |
|---|---|
| `FLANG_EQUALITY_NOT_REFLEXIVE` | the declared equality is not reflexive |
| `FLANG_EQUALITY_NOT_SYMMETRIC` | not symmetric |
| `FLANG_EQUALITY_NOT_TRANSITIVE` | not transitive |
| `FLANG_EQUALITY_NOT_CONGRUENT` | composition does not respect the equality |
| `FLANG_ORDER_NOT_REFLEXIVE` | the order is not reflexive |
| `FLANG_ORDER_NOT_ANTISYMMETRIC` | not antisymmetric |
| `FLANG_ORDER_NOT_TRANSITIVE` | not transitive |
| `FLANG_CATEGORY_NOT_CLOSED` | the category is not closed under composition |
| `FLANG_CATEGORY_NO_IDENTITY` | an object has no identity |
| `FLANG_CATEGORY_NOT_ASSOC` | composition is not associative |
| `FLANG_COMPOSE_MISMATCH` | the ends of a composition do not meet |
| `FLANG_MORPHISM_SHAPE` | the morphism is declared wrong |
| `FLANG_FUNCTOR_SQUARE` | the functor square does not commute |
| `FLANG_TRANSFORM_NOT_NATURAL` | the naturality square does not commute |
| `FLANG_BIFUNCTOR_OBJECT_TWICE` | the bifunctor maps one pair of objects twice |
| `FLANG_BIFUNCTOR_OBJECT_MISSING` | a pair of arrows is mapped, but the pair of their ends has no image |
| `FLANG_BIFUNCTOR_ARROW_MISMATCH` | the image of a pair of arrows is undeclared or goes between the wrong objects |
| `FLANG_BIFUNCTOR_IDENTITY` | a pair of identities is mapped to an arrow that is not an identity |
| `FLANG_BIFUNCTOR_COMPOSITION` | a pair of composites is mapped to an arrow that is not the composite of the images |
| `FLANG_ISO_NOT_INVERSE` | the two arrows are not inverse to each other |
| `FLANG_EMBED_SHAPE` | the embedding is declared wrong |
| `FLANG_EMBED_NOT_INJECTIVE` | the embedding maps different values to the same one |
| `FLANG_MONOID` | the monoid declaration is incomplete |
| `FLANG_MONOID_ASSOC` | the monoid operation is not associative |
| `FLANG_MONOID_IDENTITY` | the identity element is not an identity |
| `FLANG_GROUP_INVERSE` | the inverse is not an inverse |
| `FLANG_MONAD` | the monad declaration is incomplete |
| `FLANG_MONAD_ASSOC` | bind is not associative |
| `FLANG_MONAD_LEFT_UNIT` | the left unit law fails |
| `FLANG_MONAD_RIGHT_UNIT` | the right unit law fails |
| `FLANG_NOT_COMMUTATIVE` | the declared commutativity does not hold |
| `FLANG_NOT_DISTRIBUTIVE` | distributivity does not hold |
| `FLANG_NOT_IDEMPOTENT` | idempotence does not hold |
| `FLANG_NOT_MONOTONE` | monotonicity does not hold |
| `FLANG_MEET_NAME_TAKEN` | the set name is already taken |
| `FLANG_MEET_NO_UNIVERSE` | the declared sets have no common carrier |
| `FLANG_MEET_SAME_SIDE` | a set is intersected with itself |
| `FLANG_MEET_TWICE` | the same pair is declared twice |

## Plans and input/output

Errors from `flang io`. A plan returns a command as data, and the runtime
executes it; `FLANG_IO_*` codes are the runtime's refusals, which the plan
receives as a response.

| Code | What it means | What to do |
|---|---|---|
| `FLANG_PLAN` | the plan is declared wrong | check the `план` declaration |
| `FLANG_UNKNOWN_PLAN` | the file has no plan with that name | name an existing one: `--plan 'Имя'`, without guillemets |
| `FLANG_PLAN_UNSUPPORTED` | the target language cannot generate plans | generate for another target, or run with `flang io` |
| `FLANG_IO_DENIED` | the permission was taken away by a flag (`--no-read`, `--no-write`, `--no-net` and the others) | remove the flag |
| `FLANG_IO_NO_HOST` | there is no runtime to execute the command | run with `flang io`, not by computing a function |
| `FLANG_IO_NOT_TEXT` | a text read found bytes that are not text | read bytes instead |
| `FLANG_IO_TIMEOUT` | a started process was silent longer than `--timeout` | raise `--timeout` |
| `FLANG_LOCK` | the lock file is damaged or its checksum does not match | rebuild it with `flang lock` |
| `FLANG_PACKAGE` | the package is damaged or has no `flang.package` | rebuild it with `flang package` |

Permissions are taken away one at a time; by default everything is allowed:

```bash
flang io план.flang --plan 'Разбор' --no-net --in-dir
```

## Installing packages

Refusals of the package installer (`flang run-script package:install`) are
printed by the installer itself, a plan written in flang, not by the compiler;
their codes and what to do about them are listed on the
[packages page](packages.html#refusal-codes-of-the-installer).

## Processes

| Code | What it means | What to do |
|---|---|---|
| `FLANG_PROCESS` | the process is declared wrong | check the declaration |
| `FLANG_PROCESS_ACCEPTS` | a process received a message it does not accept | add the message kind to `принимает` |
| `FLANG_PROCESS_LIMIT` | the limit on the number of processes was hit | raise the limit or start fewer |
| `FLANG_MAILBOX_FULL` | the mailbox is full: the reader is behind | read more often or slow the sender down |
| `FLANG_LINK_DOWN` | the link to a node or a process is broken | handle the break in the supervisor |
| `FLANG_HOTSWAP_REFUSED` | a hot code reload was refused | make the new code compatible with the old declarations |

## Command line and internal errors

| Code | What it means | What to do |
|---|---|---|
| `FLANG_CLI` | bad call: unknown flag or missing argument | `flang <command> --help` |
| `FLANG_INTERNAL` | the compiler itself failed | report it: this is a bug in the tool, not in your program |
| `FLANG_SELF_REPL_UNSUPPORTED` | the shell does not accept this construct, `использует` for example | put the code in a file and run `flang check` |
| `FLANG_FACTCHECK_НЕТ_ОТВЕТА` | `flang facts` got no value for a call | add the value to the facts |

```text insert output: check --неткого
$ flang check --неткого
flang check: непонятный ключ «--неткого»
$ echo $?
2
```

The exit code is `2`.

## Every code of the compiler

The table is collected from the compiler's sources: a code is listed while at
least one line of the compiler's sources in `flang/self/` or of its runtime
`bootstrap/flang_*.c` raises it outside examples and postconditions. The message is the English template of
the message catalog `flang/messages/catalog.tsv`; a dash means the catalog has no
template for the code and the text is put together where it is raised. A code
named on this page and not found in the sources fails `docs:check`.

<!-- insert codes -->
| Code | Where in the compiler | Message |
| --- | --- | --- |
| `FLANG_AMBIGUOUS_NAME` | `parser.flang` | — |
| `FLANG_APPLY` | `interpret.flang`, `types.flang` | — |
| `FLANG_BAD_NAME` | `conc.flang`, `failures.flang` | — |
| `FLANG_BIFUNCTOR_ARROW_MISMATCH` | `compiler.flang` | — |
| `FLANG_BIFUNCTOR_COMPOSITION` | `compiler.flang` | — |
| `FLANG_BIFUNCTOR_IDENTITY` | `compiler.flang` | — |
| `FLANG_BIFUNCTOR_OBJECT_MISSING` | `compiler.flang` | — |
| `FLANG_BIFUNCTOR_OBJECT_TWICE` | `compiler.flang` | — |
| `FLANG_BIN` | `flang_repl.c` | — |
| `FLANG_BOUND_ON_NAN` | `obligations.flang` | postcondition «{claim}» of function «{function}» is FALSE, and a counterexample is named: {reason} |
| `FLANG_BUDGET_EXHAUSTED` | `conc.flang`, `failures.flang` | — |
| `FLANG_BUILTIN_ARGS` | `builtins.flang`, `failures.flang`, `interpret.flang`, `types.flang` | — |
| `FLANG_CATEGORY_ARROW_TWICE` | `compiler.flang` | — |
| `FLANG_CATEGORY_EQUALITY_OUTSIDE` | `compiler.flang` | — |
| `FLANG_CATEGORY_EQUALITY_SHAPE` | `compiler.flang` | — |
| `FLANG_CATEGORY_EQUALITY_TWICE` | `compiler.flang` | — |
| `FLANG_CATEGORY_FORM` | `category-paths.flang` | — |
| `FLANG_CATEGORY_GOAL` | `category-paths.flang` | — |
| `FLANG_CATEGORY_NAME` | `category-paths.flang` | — |
| `FLANG_CATEGORY_NOT_ASSOC` | `setoid.flang` | — |
| `FLANG_CATEGORY_NOT_CLOSED` | `compiler.flang` | — |
| `FLANG_CATEGORY_NO_IDENTITY` | `compiler.flang` | — |
| `FLANG_CATEGORY_STEP` | `category-paths.flang` | — |
| `FLANG_CATEGORY_TYPE` | `category-paths.flang` | — |
| `FLANG_CATEGORY_UNKNOWN_ARROW` | `compiler.flang` | — |
| `FLANG_CC` | `flang_repl.c` | — |
| `FLANG_CHECKER` | `flang_repl.c` | — |
| `FLANG_CLI` | `flang_repl.c`, `cli.flang`, `repl.flang` | — |
| `FLANG_COMPOSE_MISMATCH` | `compiler.flang` | — |
| `FLANG_DUPLICATE_NAME` | `flang_repl.c`, `link.flang`, `sets.flang` | in file {file}: function «{name}» is declared in two modules: {first} and {second} · function «{name}» is declared in two modules: {first} and {second} · in file {file}: type «{name}» is declared in two modules: {first} and {second} · type «{name}» is declared in two modules: {first} and {second} |
| `FLANG_EMBED_NOT_INJECTIVE` | `sets.flang` | — |
| `FLANG_EMBED_SHAPE` | `sets.flang` | — |
| `FLANG_EQUALITY_NOT_CONGRUENT` | `setoid.flang` | — |
| `FLANG_EQUALITY_NOT_REFLEXIVE` | `setoid.flang` | — |
| `FLANG_EQUALITY_NOT_SYMMETRIC` | `setoid.flang` | — |
| `FLANG_EQUALITY_NOT_TRANSITIVE` | `setoid.flang` | — |
| `FLANG_EXAMPLE` | `compiler.flang` | example «{example}» of function «{function}»: the value does not match the expected one: expected {wanted}, got {got} |
| `FLANG_FACTCHECK_НЕТ_ОТВЕТА` | `factcheck.flang` | — |
| `FLANG_FSPEC_TEMPLATE_DIR` | `flang_repl.c` | — |
| `FLANG_FUNCTOR_SQUARE` | `functor.flang` | — |
| `FLANG_GROUP_INVERSE` | `monoid.flang` | — |
| `FLANG_HANDLER_NOT_TOTAL` | `processes.flang` | — |
| `FLANG_HISTORY` | `flang_repl.c` | — |
| `FLANG_HOTSWAP_REFUSED` | `hotswap.flang` | — |
| `FLANG_IMPORT_AMBIGUOUS` | `flang_repl.c`, `link.flang` | — |
| `FLANG_IMPORT_CYCLE` | `flang_repl.c`, `link.flang` | — |
| `FLANG_IMPORT_NAME` | `flang_repl.c`, `link.flang` | — |
| `FLANG_IMPORT_NOT_FOUND` | `flang_repl.c`, `link.flang` | — |
| `FLANG_INCLUDE_DIR` | `flang_repl.c` | — |
| `FLANG_INITIAL_FAILURE` | `failures.flang`, `processes.flang` | — |
| `FLANG_INTERNAL` | `flang_repl.c`, `conc.flang`, `lsp.flang` | — |
| `FLANG_IO` | `flang_cli.c`, `flang_repl.c`, `compiler.flang` | — |
| `FLANG_IO_DENIED` | `flang_repl.c` | — |
| `FLANG_IO_ENTROPY` | `flang_repl.c` | — |
| `FLANG_IO_ENV` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_IO_FAILED` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_IO_LIMIT` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_IO_LIST` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_IO_NET` | `flang_repl.c` | — |
| `FLANG_IO_NOT_CHECKED` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_IO_NOT_TEXT` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_IO_NOT_WIRED` | `flang_cli.c` | — |
| `FLANG_IO_NO_HOST` | `conc.flang` | — |
| `FLANG_IO_NO_SCREEN` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_IO_NO_TLS` | `flang_repl.c` | — |
| `FLANG_IO_OCTETS` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_IO_ORDER` | `emit-from-source.flang` | — |
| `FLANG_IO_PATH` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_IO_PLACE` | `flang_repl.c` | — |
| `FLANG_IO_READ` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_IO_REMOVE` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_IO_SPAWN` | `flang_repl.c` | — |
| `FLANG_IO_TEMPDIR` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_IO_TIMEOUT` | `flang_repl.c` | — |
| `FLANG_IO_TLS` | `flang_repl.c` | — |
| `FLANG_IO_TLS_CERT` | `flang_repl.c` | — |
| `FLANG_IO_UNKNOWN` | `flang_repl.c` | — |
| `FLANG_IO_WRITE` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_ISO_NOT_INVERSE` | `iso.flang` | — |
| `FLANG_KERNEL_STAGES` | `flang_repl.c` | — |
| `FLANG_LANG` | `flang_repl.c` | — |
| `FLANG_LEX` | `lexer.flang` | — |
| `FLANG_LIB_DIR` | `flang_repl.c` | — |
| `FLANG_LINK_DOWN` | `failures.flang` | — |
| `FLANG_LOCK` | `flang_repl.c` | — |
| `FLANG_MAILBOX_FULL` | `conc.flang`, `failures.flang` | — |
| `FLANG_MATCH_NOT_EXHAUSTIVE` | `interpret.flang`, `types.flang` | the match on {subject} does not cover {cases} · a match without cases covers nothing |
| `FLANG_MATCH_UNREACHABLE` | `types.flang` | — |
| `FLANG_MEASURE` | `defunc.flang`, `failures.flang` | — |
| `FLANG_MEET_NAME_TAKEN` | `sets.flang` | — |
| `FLANG_MEET_NO_UNIVERSE` | `sets.flang` | — |
| `FLANG_MEET_SAME_SIDE` | `sets.flang` | — |
| `FLANG_MEET_TWICE` | `sets.flang` | — |
| `FLANG_MEMO` | `flang_runtime.c` | — |
| `FLANG_MEMORY` | `flang_cli.c`, `flang_repl.c` | — |
| `FLANG_MEMO_AUDIT` | `flang_runtime.c` | — |
| `FLANG_MEMO_BYTES` | `flang_runtime.c` | — |
| `FLANG_MEMO_STATS` | `flang_runtime.c` | — |
| `FLANG_MESSAGE_DIR` | `flang_repl.c` | — |
| `FLANG_MODULE_DIR` | `flang_repl.c` | — |
| `FLANG_MODULE_ROOT` | `flang_repl.c` | — |
| `FLANG_MONAD` | `monad-expand.flang`, `monad.flang` | — |
| `FLANG_MONAD_ASSOC` | `monad.flang` | — |
| `FLANG_MONAD_LEFT_UNIT` | `monad.flang` | — |
| `FLANG_MONAD_RIGHT_UNIT` | `monad.flang` | — |
| `FLANG_MONOID` | `monoid.flang` | — |
| `FLANG_MONOID_ASSOC` | `monoid.flang` | — |
| `FLANG_MONOID_IDENTITY` | `monoid.flang` | — |
| `FLANG_MORPHISM_SHAPE` | `compiler.flang` | — |
| `FLANG_NAME_TAKEN` | `conc.flang`, `failures.flang` | — |
| `FLANG_NEW` | `flang_repl.c` | — |
| `FLANG_NOT_COMMUTATIVE` | `commutative.flang` | — |
| `FLANG_NOT_DISTRIBUTIVE` | `distributive.flang` | — |
| `FLANG_NOT_IDEMPOTENT` | `idempotent.flang` | — |
| `FLANG_NOT_MONOTONE` | `monotone.flang` | — |
| `FLANG_NOT_TOTAL` | `totality.flang` | total function «{function}» calls an unknown function «{callee}»: termination cannot be proved · total function «{function}»: the recursive call «{callee}» does not decrease — argument {position} ({argument}) increases parameter «{parameter}». Pass a part of the argument: the tail of a list from the pattern «голова и хвост», a variant field from a pattern, a record field or an element of a collection |
| `FLANG_ORDER_NOT_ANTISYMMETRIC` | `partialorder.flang` | — |
| `FLANG_ORDER_NOT_REFLEXIVE` | `partialorder.flang` | — |
| `FLANG_ORDER_NOT_TRANSITIVE` | `partialorder.flang` | — |
| `FLANG_PACKAGE` | `flang_repl.c` | — |
| `FLANG_PARSE` | `interpret.flang`, `parser.flang` | 'если' has no 'иначе' branch · construct not parsed: unexpected '{word}' — this word is taken by the language and cannot be a name: write the name in guillemets («{word.quoted}») or rename it; and if the word got into the form by mistake, remove it |
| `FLANG_PECHAT_BEDY` | `emit-from-source.flang` | — |
| `FLANG_PECHAT_OTKAZ` | `emit-from-source.flang` | — |
| `FLANG_PLAN` | `io.flang` | — |
| `FLANG_PLAN_UNSUPPORTED` | `compiler.flang` | — |
| `FLANG_PRECONDITION` | `emit-c.flang`, `emit-csharp.flang`, `emit-elixir.flang`, `emit-java.flang`, `emit-js.flang`, `emit-python.flang`, `parser.flang` | — |
| `FLANG_PRECONDITION_CALL` | `proofterm.flang` | the call of «{callee}» in function «{function}» does not discharge precondition «{precondition}»: {reason} |
| `FLANG_PROCESS` | `conc.flang`, `processes.flang` | — |
| `FLANG_PROCESS_ACCEPTS` | `conc.flang`, `failures.flang`, `processes.flang` | — |
| `FLANG_PROCESS_LIMIT` | `conc.flang`, `failures.flang` | — |
| `FLANG_PROOF` | `compiler.flang`, `link.flang` | — |
| `FLANG_PROOF_AMBIGUOUS` | `obligations.flang` | — |
| `FLANG_PROOF_CACHE` | `flang_repl.c` | — |
| `FLANG_PROOF_CACHE_AUDIT` | `flang_repl.c` | — |
| `FLANG_PROOF_CACHE_KEY` | `flang_repl.c` | — |
| `FLANG_PROOF_CACHE_RECHECK` | `flang_repl.c` | — |
| `FLANG_PROOF_CACHE_STATS` | `flang_repl.c` | — |
| `FLANG_PROOF_CHECKER` | `flang_repl.c` | — |
| `FLANG_PROOF_CLAIM_MISMATCH` | `obligations.flang`, `proofterm.flang` | — |
| `FLANG_PROOF_DUPLICATE` | `obligations.flang` | — |
| `FLANG_PROOF_INDUCTION_BRANCH` | `proofterm.flang` | step {step}, inductive case «{case}» of theorem «{theorem}»: {reason} · step {step}, base case «{case}» of theorem «{theorem}»: {reason} |
| `FLANG_PROOF_INDUCTION_CASES` | `proofterm.flang` | — |
| `FLANG_PROOF_INDUCTION_DESCENT` | `proofterm.flang` | — |
| `FLANG_PROOF_INDUCTION_STEP` | `proofterm.flang` | step {step}, inductive case «{case}» of theorem «{theorem}»: {reason} · step {step}, base case «{case}» of theorem «{theorem}»: {reason} |
| `FLANG_PROOF_INDUCTION_TYPE` | `proofterm.flang` | — |
| `FLANG_PROOF_NO_GOAL` | `obligations.flang` | — |
| `FLANG_PROOF_STEP` | `proofterm.flang` | step {step}, theorem «{theorem}»: {reason} |
| `FLANG_PROOF_UNFINISHED` | `obligations.flang` | — |
| `FLANG_PROOF_UNKNOWN_VAR` | `obligations.flang`, `parser.flang`, `types.flang` | — |
| `FLANG_PROOF_VAR_TYPE` | `obligations.flang` | — |
| `FLANG_PROPERTY` | `compiler.flang`, `emit-c.flang`, `emit-csharp.flang`, `emit-elixir.flang`, `emit-java.flang`, `emit-js.flang`, `emit-python.flang`, `grid.flang`, `interpret.flang`, `parser.flang` | property «{claim}» of function «{function}» is violated |
| `FLANG_PULSE` | `flang_runtime.c` | — |
| `FLANG_PULSE_TICK` | `flang_runtime.c` | — |
| `FLANG_RECURSION_LIMIT` | `conc.flang`, `factcheck.flang`, `failures.flang`, `interpret.flang` | — |
| `FLANG_RUNTIME_DIR` | `flang_repl.c` | — |
| `FLANG_SELF_REPL_UNSUPPORTED` | `repl.flang` | — |
| `FLANG_STEPS` | `compiler.flang` | — |
| `FLANG_STEP_LIMIT` | `factcheck.flang` | — |
| `FLANG_STOPPED` | `conc.flang`, `failures.flang` | — |
| `FLANG_THREADS` | `flang_runtime.c` | — |
| `FLANG_TICKS_OUT` | `flang_runtime.c` | — |
| `FLANG_TIME_OUT` | `flang_runtime.c` | — |
| `FLANG_TLS_CHAIN` | `flang_repl.c` | — |
| `FLANG_TLS_ENGINE` | `flang_repl.c` | — |
| `FLANG_TLS_EXPIRED` | `flang_repl.c` | — |
| `FLANG_TLS_NAME` | `flang_repl.c` | — |
| `FLANG_TLS_SIGNATURE` | `flang_repl.c` | — |
| `FLANG_TMP` | `flang_repl.c` | — |
| `FLANG_TRANSFORM_COMPONENT` | `compiler.flang` | — |
| `FLANG_TRANSFORM_NOT_NATURAL` | `setoid.flang` | — |
| `FLANG_TRANSFORM_NOT_TOTAL` | `compiler.flang` | — |
| `FLANG_TRANSFORM_SHAPE` | `compiler.flang` | — |
| `FLANG_TYPE` | `flang_cli.c`, `interpret.flang`, `types.flang` | {where} is declared to return {type.declared}, but its body gives {type.body} · {where} is declared twice · {where} has no body · argument «{parameter}» of function «{function}»: expected {type.wanted}, got {type.got} · {side} operand of «{operation}»: expected {type.wanted}, got {type.got} · the condition of «если» must be a flag, not {type} · the branches of «если» have different types: {type.then} and {type.else} · record «{record}» has no field «{field}» · record «{record}» requires field «{field}» ({type}) · field «{field}» is declared twice · function «{function}» takes {count} argument(s) ({parameters}), but is called with {given} · call of function «{function}»: argument «{parameter}»: {value} is outside {type} · {label} of function «{function}» does not give argument «{parameter}» · {label}: {value} is outside {type} · {label} does not match type {type} |
| `FLANG_TYPE_ARGS` | `types.flang` | — |
| `FLANG_TYPE_PARAM` | `types.flang` | — |
| `FLANG_UNCOVERED_FAILURE` | `failures.flang`, `processes.flang` | — |
| `FLANG_UNKNOWN` | `flang_cli.c` | — |
| `FLANG_UNKNOWN_NAME` | `flang_repl.c`, `builtins.flang`, `conc.flang`, `interpret.flang`, `link.flang`, `parser.flang`, `sets.flang`, `types.flang` | unknown function «{name}» · unknown type «{name}» · unknown record «{name}» · unknown variant «{name}» · unknown variant constructor «{name}» · function «{name}» is not found · the record has no field «{field}» · name «{name}» is not bound · name «{name}» is not bound: a name is introduced by 'принимает', 'пусть' or a 'случай' pattern; and the operations of the language ('плюс', 'минус', 'умножить на', 'делить на', 'остаток от') go BETWEEN values — «3.14 умножить на р», not «умножить 3.14 на р» |
| `FLANG_UNKNOWN_PLAN` | `flang_cli.c`, `compiler.flang` | — |
| `FLANG_UNKNOWN_PROCESS` | `processes.flang` | — |
| `FLANG_UNKNOWN_PROPERTY` | `compiler.flang` | — |
| `FLANG_UNPROVED` | `compiler.flang` | — |
| `FLANG_UNPROVEN` | `flang_repl.c` | — |
| `FLANG_VITKI` | `flang_repl.c` | — |
| `FLANG_WATCH` | `flang_runtime.c` | — |
| `FLANG_WATCH_TICK` | `flang_runtime.c` | — |
| `FLANG_ZAKAZ` | `emit-from-source.flang` | — |
<!-- end insert -->

Next: [The prover refused: whose mistake is it](proof-refused.html) — how to
read a refused proof, and when the mistake is not yours.
