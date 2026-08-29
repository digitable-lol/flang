# Diagnostics reference

The compiler refuses by code. The code is always the first word of the line:

```
FLANG_TYPE в файле type.flang, строка 6, столбец 3: функция «Удвоить» объявлена как число, а тело даёт строка
```

Find your code on this page: one line for what it means, one for what to do.
Codes are grouped by the layer that produces them: parsing comes before types,
types come before proofs.

Exit codes: `0` — checked, `1` — findings, `2` — bad invocation.

## Three traps that cost a day

Read these before you look up your code. Each one refuses somewhere other than
where the mistake is.

### A postcondition calling a function of its own module breaks everyone who imports the module by list

The file is green on its own. The importer fails.

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
FLANG_UNKNOWN_NAME, строка 12, столбец 4: неизвестная функция «Двойка»
FLANG_UNKNOWN_NAME, строка 11, столбец 50: неизвестная функция «Двойка»
FLANG_NOT_TOTAL, строка 12, столбец 4: тотальная функция «Учтено» вызывает неизвестную функцию «Двойка»: завершение доказать нельзя
ввоз.flang: не проверено — замечаний 3
```

The import `только «Учтено»` brings in one name. Both the body and the
postcondition of «Учтено» call «Двойка», which the importer does not have.
Column 50 points inside the postcondition — the line number belongs to the
imported file, and no file is named because two files were checked together.

What to do — one of three:

| fix | how |
|---|---|
| bring the companion | `использует «Ядро» только «Учтено», «Двойка»` |
| import the whole module | `использует «Ядро»` |
| take the call out of the postcondition | say the same in arithmetic: `результат не меньше (н умножить на 2)` |

### A green run does not mean the assertions are proved

`flang check` without flags checks parsing, types, termination and examples. A
postcondition it can neither prove nor refute is passed over in silence. The
postcondition «меньше двойки» above is false — and the file is green.

Ask directly:

```bash
flang check ядро.flang --proof
```

```
  постусловие «меньше двойки» функции «Учтено» — объявлено, не доказано: ни теоремы, ни примеров. Его считает рантайм после каждого возврата — на тех входах, которые придут
```

Read the words literally: «доказано» — about all inputs; «сетка N» — computed
on N values, which is not a proof; «объявлено, не доказано» — the claim is
stated and nothing stands behind it.

And second: while a `FLANG_UNKNOWN_NAME` stands, the function loses its
`тотальная` promise and nobody proves its assertions. Names first, everything
else after.

### FLANG_BOUND_ON_NAN: «not a number» lives in the type `число` and stands outside the order

The most common false alarm. The claim looks obviously true and the kernel
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
FLANG_BOUND_ON_NAN в файле nan.flang, строка 6, столбец 3: постусловие «результат больше довода» функции «Прибавить один» ЛОЖНО, и контрпример назван: «н» объявлен типом «число», а «не число» живёт в этом типе и стоит ВНЕ ПОРЯДКА — оно не больше и не меньше ничего, включая самоё себя.
```

The reason: the type `число` contains «not a number», every arithmetic
operation carries it through, and any comparison with it is false both ways. A
claim about order over raw arithmetic is therefore not true.

| fix | what to write | who pays |
|---|---|---|
| narrow the input type | `принимает н: неотрицательное` or `целое` | nobody, «not a number» cannot get in |
| add a precondition | `требует «вход есть число» (н минус н) равен 0` | the caller |
| state the bound in the claim itself | `обеспечивает «…» не ((н минус н) равен 0) или (результат больше н)` | nobody |

## Parsing

| code | what it means | what to do |
|---|---|---|
| `FLANG_LEX` | a token did not form: unclosed quote, foreign character | close the quote, remove the character |
| `FLANG_PARSE` | tokens are fine, the construct is not | look at line and column: usually a missing `иначе` branch or a second function body |

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

## Names and imports

| code | what it means | what to do |
|---|---|---|
| `FLANG_UNKNOWN_NAME` | the name is not bound: no such function or variable | declare it, import the module, or fix the spelling |
| `FLANG_AMBIGUOUS_NAME` | two imports bring the same name | drop one import or narrow it with `только` |
| `FLANG_BAD_NAME` | the name is not spelled the way names are spelled | rename: function names go in guillemets, parameters are plain words |
| `FLANG_NAME_TAKEN` | the name belongs to another declaration | pick another name |
| `FLANG_DUPLICATE_NAME` | the same name is declared twice in one place | remove the second declaration |
| `FLANG_IMPORT_NOT_FOUND` | the module was not found | check the module name and that the file sits next to yours or above |
| `FLANG_IMPORT_CYCLE` | modules import each other in a circle | move the shared part into a third module |
| `FLANG_IMPORT_AMBIGUOUS` | one name arrives from two modules | narrow the import with `только` |
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

An unknown name always drags a second refusal about termination behind it. Fix
the first and the second goes away.

If the name is written as an operation, the compiler says so:

```
FLANG_UNKNOWN_NAME в файле pr4.flang, строка 10, столбец 14: имя «м» не связано: имя вводят 'принимает', 'пусть' или образец 'случай'; а действия языка ('плюс', 'минус', 'умножить на', 'делить на', 'остаток от') пишутся МЕЖДУ значениями — «3.14 умножить на р», а не «умножить 3.14 на р»
```

## Types

| code | what it means | what to do |
|---|---|---|
| `FLANG_TYPE` | the declared type differs from what the body or the argument gives | bring one in line with the other |
| `FLANG_TYPE_ARGS` | a type was given arguments it does not take | drop them: types in this language are not parametric |
| `FLANG_TYPE_PARAM` | a type parameter is not bound | name the type in full |
| `FLANG_APPLY` | the call does not fit: wrong number of arguments, or the callee is not a function | compare the call with the signature |
| `FLANG_BUILTIN_ARGS` | a built-in operation got the wrong number of arguments | check the operation's description |
| `FLANG_MATCH_NOT_EXHAUSTIVE` | the match does not cover every case | add the missing `случай` |
| `FLANG_MATCH_UNREACHABLE` | a case is shadowed by an earlier one and never fires | remove it or move it up |
| `FLANG_EXAMPLE` | an example did not match its expectation | fix the body or fix the expectation |

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

| code | what it means | what to do |
|---|---|---|
| `FLANG_NOT_TOTAL` | the function is declared `тотальная` and termination is not proved | pass a PART of the argument into the recursion, not a recomputed number |
| `FLANG_MEASURE` | the declared measure does not decrease | fix `убывает` or fix the call |
| `FLANG_RECURSION_LIMIT` | evaluation ran out of steps or depth | raise `--max-steps` / `--max-depth`, or fix the recursion |
| `FLANG_STEP_LIMIT` | the step limit ran out inside an example | same `--max-steps` flag |
| `FLANG_BUDGET_EXHAUSTED` | the budget given to the run ran out | raise the budget or narrow the task |
| `FLANG_MEMORY` | out of memory | shrink the data |
| `FLANG_STOPPED` | the run was stopped from outside | start it again |

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

```bash
flang run rec.flang --function "Вниз" --args '{"н":100}' --max-steps 5
```

```
FLANG_RECURSION_LIMIT: функция «Вниз» исчерпала лимит шагов (5) на глубине вызовов 1
```

## Assertions and proof

Requirements, promises and theorems.

| code | what it means | what to do |
|---|---|---|
| `FLANG_PROPERTY` | a postcondition was violated during evaluation | either the claim or the body is wrong — look at the input it broke on |
| `FLANG_PRECONDITION` | the precondition is written wrong | check the form `требует «имя» <утверждение>` |
| `FLANG_PRECONDITION_CALL` | the caller did not discharge the callee's precondition | prove the condition at the call site or narrow the argument type |
| `FLANG_BOUND_ON_NAN` | an order claim is false because of «not a number» | see the third trap above |
| `FLANG_PROOF` | the kernel did not accept the proof | the `FLANG_PROOF_*` codes below say why |
| `FLANG_PROOF_NO_GOAL` | the theorem closes nothing: no postcondition carries that name | name the theorem exactly like the postcondition |
| `FLANG_PROOF_AMBIGUOUS` | the theorem would close two postconditions at once | give the postconditions different names |
| `FLANG_PROOF_CLAIM_MISMATCH` | `утверждаем` differs from the postcondition word for word | copy the postcondition text verbatim |
| `FLANG_PROOF_DUPLICATE` | two theorems prove one postcondition | keep one |
| `FLANG_PROOF_STEP` | a step is unjustified, or there are no steps at all | add `по свойству «…»`, `по примеру «…»` or `по предположению` |
| `FLANG_PROOF_UNFINISHED` | the proof is not closed | add `следовательно доказано` |
| `FLANG_PROOF_UNKNOWN_VAR` | the claim mentions an unbound name | introduce it with `дано` |
| `FLANG_PROOF_VAR_TYPE` | the theorem's variable type differs from the parameter's | match `дано` to the function signature |
| `FLANG_PROOF_INDUCTION_TYPE` | there is no induction over that type | induction runs over a declared sum or over the range `неотрицательное` |
| `FLANG_PROOF_INDUCTION_CASES` | not every case of the principle is covered | add the missing `случай` |
| `FLANG_PROOF_INDUCTION_BRANCH` | a case branch is not reduced to the goal | justify the branch |
| `FLANG_PROOF_INDUCTION_STEP` | the step is not reduced to the hypothesis | add `по предположению` and make the sides match sign for sign |
| `FLANG_PROOF_INDUCTION_DESCENT` | the descent is not strict: the step is not by one | make the step exactly one down |
| `FLANG_INITIAL_FAILURE` | no induction principle was generated for the type | check that the type is declared as a sum of variants |
| `FLANG_UNCOVERED_FAILURE` | a failure path is not covered by the match | add a case for the failure |

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

A postcondition the checker passed over is counted by the runtime:

```bash
flang run prop.flang --function "Половина" --args '{"н":0}'
```

```
FLANG_PROPERTY: нарушено свойство «результат меньше довода» функции «Половина»
```

### Laws of declared structures

These laws are COMPUTED on a finite grid of the author's values, not proved. A
refusal means a violation was found — there is always a counterexample.

| code | which law is broken |
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
| `FLANG_EMBED_NOT_INJECTIVE` | the embedding glues distinct values together |
| `FLANG_MONOID` | the monoid declaration is incomplete |
| `FLANG_MONOID_ASSOC` | the monoid operation is not associative |
| `FLANG_MONOID_IDENTITY` | the identity is not an identity |
| `FLANG_GROUP_INVERSE` | the inverse is not an inverse |
| `FLANG_MONAD` | the monad declaration is incomplete |
| `FLANG_MONAD_ASSOC` | bind is not associative |
| `FLANG_MONAD_LEFT_UNIT` | the left unit law fails |
| `FLANG_MONAD_RIGHT_UNIT` | the right unit law fails |
| `FLANG_NOT_COMMUTATIVE` | declared commutativity is broken |
| `FLANG_NOT_DISTRIBUTIVE` | distributivity is broken |
| `FLANG_NOT_IDEMPOTENT` | idempotence is broken |
| `FLANG_NOT_MONOTONE` | monotonicity is broken |
| `FLANG_MEET_NAME_TAKEN` | the set name is already taken |
| `FLANG_MEET_NO_UNIVERSE` | the declared sets share no carrier |
| `FLANG_MEET_SAME_SIDE` | an intersection of a set with itself |
| `FLANG_MEET_TWICE` | the same pair is declared twice |

## Orders and input/output

Refusals from `flang io`. A plan returns a DESCRIPTION of an action and the host
performs it; the `FLANG_IO_*` family says the host refused.

| code | what it means | what to do |
|---|---|---|
| `FLANG_PLAN` | the plan is declared wrong | check the plan form |
| `FLANG_UNKNOWN_PLAN` | no plan by that name in the file | name one that exists: `--plan 'Имя'` |
| `FLANG_PLAN_UNSUPPORTED` | this kind of order is not carried out by this runner | replace the order, or run where it exists |
| `FLANG_IO_NO_HOST` | there is no host: nobody to hand the order to | run through `flang io`, not by evaluating a function |
| `FLANG_IO_NOT_TEXT` | a text read hit something that is not text | read octets instead |
| `FLANG_IO_UNSUPPORTED` | a capability was withdrawn by a flag, or the action is not supported | give the capability back: drop `--no-read`, `--no-write`, `--no-net` and friends |
| `FLANG_LOCK` | the lock file is damaged or its seal does not match | rebuild the lock |
| `FLANG_PACKAGE` | the package is damaged: its list does not match its contents | rebuild the package |

Capabilities are narrowed one at a time; the default is "everything allowed":

```bash
flang io план.flang --plan 'Разбор' --no-net --in-dir
```

## Processes

| code | what it means | what to do |
|---|---|---|
| `FLANG_PROCESS` | the process is declared wrong | check the declaration |
| `FLANG_PROCESS_ACCEPTS` | a process received a message it does not accept | add the message kind to `принимает` |
| `FLANG_PROCESS_LIMIT` | the process count limit was hit | raise the limit or spawn fewer |
| `FLANG_MAILBOX_FULL` | the mailbox is full: the reader is behind | read more often or throttle the sender |
| `FLANG_LINK_DOWN` | a link to a node or process is broken | handle the break in supervision |
| `FLANG_CONC_UNSUPPORTED` | this process feature is not supported | see the processes page |
| `FLANG_HOTSWAP_REFUSED` | a hot code swap was refused | make the new code fit the previous declarations |

## Command line and internals

| code | what it means | what to do |
|---|---|---|
| `FLANG_CLI` | bad invocation: unknown flag or missing argument | `flang <команда> --help` |
| `FLANG_INTERNAL` | the compiler itself broke | report it: this is a tool failure, not your program's |
| `FLANG_SELF_EVAL_UNSUPPORTED` | the form is outside what this evaluation path handles | evaluate with the ordinary `flang run` |
| `FLANG_SELF_REPL_UNSUPPORTED` | the shell does not take this form — `использует`, for example | put the code in a file and run `flang check` |
| `FLANG_FACTCHECK_НЕТ_ОТВЕТА` | the fact check got no evaluator answer for a call | supply the answer in the fact set |

```bash
flang check --неткого
```

```
flang check: непонятный ключ «--неткого»
```

The exit code is `2`.

Next: [The kernel refused: whose mistake is it](proof-refused.html) — how to
read a proof refusal and when the author is not to blame.
