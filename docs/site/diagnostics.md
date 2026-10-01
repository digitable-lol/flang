# Diagnostics reference

When the compiler rejects a program, every error line starts with a code:

```
FLANG_TYPE в файле type.flang, строка 6, столбец 3: функция «Удвоить» объявлена как число, а тело даёт строка
```

The line gives the code, the file, the line and the column, and says what is
wrong. The compiler prints its messages in Russian; this page translates each
code into what it means and what to do about it. Codes are grouped by the stage
that reports them: parsing first, then names, types, termination and proofs.

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

```flang
// ядро.flang
модуль «Ядро»

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

```flang
// ввоз.flang
модуль «Ввоз»
использует «Ядро» только «Учтено»

тотальная функция «Проба»
  принимает н: число
  возвращает число
  «Учтено» от н
```

```bash
flang check ядро.flang
```

```
модуль «Ядро»: функций 2, из них с доказанным завершением 2; типов 0
ядро.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

```bash
flang check ввоз.flang
```

```
модуль «Ввоз»: функций 2, из них с доказанным завершением 0; типов 0; файлов вместе с импортами 2
без доказанного завершения: «Учтено» «Проба»
место указано строкой и столбцом, но без файла: вместе с импортами проверено файлов 2, а диагностика компилятора имени файла не несёт
FLANG_UNKNOWN_NAME, строка 12, столбец 4: неизвестная функция «Двойка»
FLANG_UNKNOWN_NAME, строка 11, столбец 56: неизвестная функция «Двойка»
FLANG_NOT_TOTAL, строка 12, столбец 4: тотальная функция «Учтено» вызывает неизвестную функцию «Двойка»: завершение доказать нельзя
ввоз.flang: не проверено — замечаний 3
```

The import `только «Учтено»` brings in one name. Both the body and the
guarantee of «Учтено» call «Двойка», which the importing module does not have.
Column 56 points inside the guarantee. The line numbers are those of the
imported file, and no file is named because two files were checked together.

Fix it in one of three ways:

| Fix | How |
|---|---|
| import the helper too | `использует «Ядро» только «Учтено», «Двойка»` |
| import the whole module | `использует «Ядро»` |
| remove the call from the guarantee | say the same with arithmetic: `результат не меньше (н умножить на 2)` |

### `flang check` passing does not mean the guarantees are proved

`flang check` without flags checks parsing, types, termination and unit tests.
A guarantee it can neither prove nor refute does not make it fail. The
guarantee «не меньше двойки» above is not proved: without `--proof` the file
passes with exit code 0; with `--proof` the same file exits with 3.

To see what is proved, ask for the proof report:

```bash
flang check ядро.flang --proof
```

```
  постусловие «не меньше двойки» функции «Учтено» — объявлено, не доказано: ни теоремы, ни примеров. Его считает рантайм после каждого возврата — на тех входах, которые придут
…
ядро.flang: НЕ ПРОВЕРЕНО — утверждений 1: доказано 0, условно 0, сетка 0, объявлено, не доказано 1, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 3
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

```flang
модуль «Проба»

тотальная функция «Прибавить один»
  принимает н: число
  возвращает число
  обеспечивает «результат больше довода» результат больше н
  н плюс 1
```

```
FLANG_BOUND_ON_NAN в файле nan.flang, строка 6, столбец 3: постусловие «результат больше довода» функции «Прибавить один» ЛОЖНО, и контрпример назван: «н» объявлен типом «число», а «не число» живёт в этом типе и стоит ВНЕ ПОРЯДКА — оно не больше и не меньше ничего, включая самоё себя. Тело собрано только из арифметики над «н», а всякая арифметическая операция «не число» переносит, значит результат есть «не число», и сравнение с ним ложно. Позовите «Прибавить один» от (0 делить на 0) — рантайм ответит FLANG_PROPERTY. Чинится тремя способами: объявить вход отрезком («неотрицательное», «целое») — тогда «не число» не втащить вовсе; поставить предусловие — за него платит вызывающий; либо оговорить границу, и ядро оговорку читает: обеспечьте «не ((н минус н) равен 0) или (…)»
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

```flang
модуль «Проба»

тотальная функция «Удвоить»
  принимает н: число
  возвращает число
  если н больше 0 то н умножить на 2
```

```
FLANG_PARSE в файле parse.flang, строка 7, столбец 1: у 'если' нет ветки 'иначе'
```

```
FLANG_LEX в файле lex.flang, строка 5, столбец 3: не закрыта кавычка
```

`если … то …` is an expression, so it always needs `иначе`.

## Names and imports

| Code | What it means | What to do |
|---|---|---|
| `FLANG_UNKNOWN_NAME` | the name is not defined: no such function or variable | declare it, import the module, or fix the spelling |
| `FLANG_AMBIGUOUS_NAME` | two imports bring the same name | drop one import or narrow it with `только` |
| `FLANG_BAD_NAME` | the name is not written the way names are written | rename: function names go in guillemets, parameters are plain words |
| `FLANG_NAME_TAKEN` | the name is used by another declaration | pick another name |
| `FLANG_DUPLICATE_NAME` | the same name is declared twice in one place | remove the second declaration |
| `FLANG_IMPORT_NOT_FOUND` | the imported module was not found | check the module name and the path in `из "…"` |
| `FLANG_IMPORT_CYCLE` | modules import each other in a circle | move the shared part into a third module |
| `FLANG_IMPORT_AMBIGUOUS` | one name comes from two modules | narrow the import with `только` |
| `FLANG_IMPORT_NAME` | the `только` list names something the module does not declare | compare the list with the module's declarations |

```flang
модуль «Проба»

тотальная функция «Удвоить»
  принимает н: число
  возвращает число
  «Утроить» от н
```

```
FLANG_UNKNOWN_NAME в файле unknown.flang, строка 6, столбец 3: неизвестная функция «Утроить»
FLANG_NOT_TOTAL в файле unknown.flang, строка 6, столбец 3: тотальная функция «Удвоить» вызывает неизвестную функцию «Утроить»: завершение доказать нельзя
```

An unknown name always brings a second error about termination: the compiler
cannot prove that a call to an unknown function terminates. Fix the first and
the second goes away.

If an operation is written in the wrong order, the compiler says how to write
it:

```
FLANG_UNKNOWN_NAME в файле pr4.flang, строка 10, столбец 14: имя «м» не связано: имя вводят 'принимает', 'пусть' или образец 'случай'; а действия языка ('плюс', 'минус', 'умножить на', 'делить на', 'остаток от') пишутся МЕЖДУ значениями — «3.14 умножить на р», а не «умножить 3.14 на р»
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

```
FLANG_TYPE в файле type.flang, строка 6, столбец 3: функция «Удвоить» объявлена как число, а тело даёт строка
```

```
FLANG_TYPE в файле dup.flang, строка 8, столбец 1: функция «Удвоить» объявлена дважды
```

```
FLANG_MATCH_NOT_EXHAUSTIVE в файле match.flang, строка 6, столбец 3: разбор списка не покрывает «пусто»
```

```
FLANG_EXAMPLE: пример «Двойка» функции «Удвоить»: значение не совпало с ожидаемым: ожидалось 5, получено 4
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

```flang
модуль «Проба»

тотальная функция «Считать»
  принимает н: число
  возвращает число
  если н равно 0 то 0 иначе («Считать» от (н плюс 1))
```

```
FLANG_NOT_TOTAL в файле total.flang, строка 6, столбец 30: тотальная функция «Считать»: рекурсивный вызов «Считать» не убывает — аргумент 1 («н» add 1) увеличивает параметр «н». Передавайте часть аргумента: хвост списка из образца «голова и хвост», поле варианта из образца, поле записи или элемент коллекции
```

`н плюс 1` grows, so the compiler cannot show that the recursion ends.

To see the step limit, run with a small `--max-steps`. `flang run` computes
only proved programs; this `rec.flang` has unproved parts, so `--trust` is
added:

```bash
flang run rec.flang --function "Вниз" --args '{"н":100}' --max-steps 5 --trust
```

```
на веру: доказанность не считалась — запуск по ключу --trust
FLANG_RECURSION_LIMIT: функция «Вниз» исчерпала лимит шагов (5) на глубине вызовов 1
```

## Guarantees and proofs

Preconditions (`требует`), guarantees (`обеспечивает`) and theorems.

| Code | What it means | What to do |
|---|---|---|
| `FLANG_PROPERTY` | a guarantee was violated at run time | either the guarantee or the body is wrong — look at the input it failed on |
| `FLANG_PRECONDITION` | the precondition is written wrong | check the form `требует «имя» <условие>` |
| `FLANG_PRECONDITION_CALL` | the caller does not ensure the callee's precondition | prove the condition at the call site, or narrow the argument type |
| `FLANG_BOUND_ON_NAN` | an order guarantee is false because of NaN | see the third trap above |
| `FLANG_PROOF` | the prover did not accept the proof | the `FLANG_PROOF_*` codes below say why |
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

```flang
модуль «Проба»

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

```
FLANG_PROOF_STEP: теорема «удвоенное неотрицательно»: ни одного шага
```

```
FLANG_PROOF_NO_GOAL в файле pr1.flang, строка 9, столбец 1: теорема «удвоенное неотрицательно» ничего не закрывает: постусловия «удвоенное неотрицательно» нет ни у одной функции модуля. Теорема доказывает названное утверждение, а не утверждение вообще — назовите её так же, как постусловие, которое она закрывает
```

```
FLANG_PROOF_AMBIGUOUS в файле pa.flang, строка 15, столбец 1: теорема «неотрицательно» закрывала бы сразу 2 постусловия («Удвоить», «Утроить»), и выбрать нельзя. Дайте постусловиям разные имена
```

```
FLANG_PROOF_CLAIM_MISMATCH в файле pm.flang, строка 11, столбец 3: теорема «неотрицательно» утверждает не то, что обещает функция «Удвоить»: утверждение теоремы и постусловие обязаны совпадать слово в слово. Ядро не решает, что два разных утверждения означают одно и то же
```

A guarantee the prover could not prove is checked at run time. `flang run`
refuses unproved programs, so `--trust` is needed to see it:

```bash
flang run prop.flang --function "Половина" --args '{"н":0}' --trust
```

```
на веру: доказанность не считалась — запуск по ключу --trust
FLANG_PROPERTY: нарушено свойство «результат меньше довода» функции «Половина»
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
| `FLANG_FUNCTOR_NOT_TOTAL` | the functor is not defined on every object |
| `FLANG_FUNCTOR_SQUARE` | the functor square does not commute |
| `FLANG_TRANSFORM_SHAPE` | the transformation is declared wrong |
| `FLANG_TRANSFORM_COMPONENT` | a component of the transformation is missing |
| `FLANG_TRANSFORM_NOT_TOTAL` | the transformation is not defined on every object |
| `FLANG_TRANSFORM_NOT_NATURAL` | the naturality square does not commute |
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
| `FLANG_IO_UNSUPPORTED` | the generated code for this target does not support this command | generate for another target |
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

## Processes

| Code | What it means | What to do |
|---|---|---|
| `FLANG_PROCESS` | the process is declared wrong | check the declaration |
| `FLANG_PROCESS_ACCEPTS` | a process received a message it does not accept | add the message kind to `принимает` |
| `FLANG_PROCESS_LIMIT` | the limit on the number of processes was hit | raise the limit or start fewer |
| `FLANG_MAILBOX_FULL` | the mailbox is full: the reader is behind | read more often or slow the sender down |
| `FLANG_LINK_DOWN` | the link to a node or a process is broken | handle the break in the supervisor |
| `FLANG_CONC_UNSUPPORTED` | this process feature is not supported by the target | see the [processes page](processes.html) |
| `FLANG_HOTSWAP_REFUSED` | a hot code reload was refused | make the new code compatible with the old declarations |

## Command line and internal errors

| Code | What it means | What to do |
|---|---|---|
| `FLANG_CLI` | bad call: unknown flag or missing argument | `flang <command> --help` |
| `FLANG_INTERNAL` | the compiler itself failed | report it: this is a bug in the tool, not in your program |
| `FLANG_SELF_EVAL_UNSUPPORTED` | this way of evaluating does not support the construct | compute it with the ordinary `flang run` |
| `FLANG_SELF_REPL_UNSUPPORTED` | the shell does not accept this construct, `использует` for example | put the code in a file and run `flang check` |
| `FLANG_FACTCHECK_НЕТ_ОТВЕТА` | `flang facts` got no value for a call | add the value to the facts |

```bash
flang check --неткого
```

```
flang check: непонятный ключ «--неткого»
```

The exit code is `2`.

Next: [The prover refused: whose mistake is it](proof-refused.html) — how to
read a refused proof, and when the mistake is not yours.
