# Which postconditions the prover proves

You wrote an `обеспечивает` (postcondition), ran `flang check file --proof`, and
the line for it does not say «доказано». This page tells you which ways of
writing a postcondition the prover proves and how to rewrite one it does not.

When the check fails with an error code instead, read
[The kernel refused: whose mistake is it](proof-refused.html).

Words used below:

| Word | Meaning |
| --- | --- |
| prover | the part of the compiler that proves postconditions; the compiler output calls it «ядро» |
| guard | the condition `У` in a postcondition of the form `если У то Ц иначе да`: the claim `Ц` only has to hold when `У` holds |
| enum | a `тип` with `вариант`s |

Every statement on this page was checked by running `flang check --proof` on
small probe files with the current compiler. Each section shows the code and the
line the proof report printed for it.

## Read the result first

The last line of the report counts the results:

```
утверждений 18: доказано 13, условно 0, сетка 4, объявлено, не доказано 1, отвергнуто 0, нарушено 0
```

| The report says | What it means | What to do |
| --- | --- | --- |
| `доказано` | proved for all possible inputs | nothing |
| `условно` (in the line of the postcondition: «НО ПРИ УСЛОВИИ») | proved, but the proof uses a postcondition of another function that is itself not proved | prove that other postcondition |
| `сетка N` | checked only on your N examples, like unit tests; there is no proof | rewrite it in one of the forms below |
| `объявлено, не доказано` | neither a proof nor an example; the runtime checks it after every call | rewrite it, or accept the runtime check |

Count only `доказано`. `сетка` and `объявлено` both mean "not proved"; the
difference is only whether the function has examples.

## Quick table

| You wrote | Proved? | Write instead | Section |
| --- | --- | --- | --- |
| a claim about one branch of an `если` body, without a guard | no | `если <the condition of that branch> то <claim> иначе да` | [1](#1-a-branching-body-put-the-branch-condition-in-the-guard) |
| `(длина результат) больше 0` or `пусто результат` under a guard | no | equality to a concrete value: `результат равен "…"`, `результат равен пустой список` | [2](#2-under-a-guard-state-equality-to-a-value) |
| `а не больше результат` with `а: число` | the file is rejected: `FLANG_BOUND_ON_NAN` | declare `а: неотрицательное`, or `требует а не меньше 0` | [3](#3-inequalities-depend-on-the-argument-types) |
| a guard written with the comparison turned round (`1 не больше место` where the body says `место не меньше 1`) | no | the guard exactly as in the body | [3](#3-inequalities-depend-on-the-argument-types) |
| a strict inequality (`меньше`, `больше`) over arguments | no | a non-strict one (`не больше`), or a closed goal | [3](#3-inequalities-depend-on-the-argument-types), [4](#4-a-goal-without-free-names-is-computed) |
| a claim about the result of a recursive function that has no postcondition | no | add the postcondition to the called function | [5](#5-calls-the-prover-uses-the-callee-s-proved-postconditions) |
| a claim about `(свёртка …) плюс 0` or about a fold bound with `пусть` | no | the fold as the whole body | [6](#6-folds-the-fold-must-be-the-whole-body) |
| a fold over a field: `свёртка куча.свободные` | no | pass the list as an argument | [6](#6-folds-the-fold-must-be-the-whole-body) |
| a claim about one variant of an enum argument | yes, with a guard | `если отклик равен (вариант «Пока ничего») то … иначе да` | [7](#7-enums-guard-by-equality-to-a-variant) |
| a `разбор` inside the postcondition | does not parse | a guard by equality to a variant | [7](#7-enums-guard-by-equality-to-a-variant) |
| a predicate call as the goal | sometimes | try the other form: with and without `равен да` | [8](#8-boolean-goals-try-both-forms) |
| one claim under a guard that the body does not test | no | a disjunction with the body's condition | [9](#9-a-guard-the-body-does-not-test) |

## 1. A branching body: put the branch condition in the guard

If the body starts with `если`, the prover splits the goal by the body's
condition. A claim about one branch needs a guard that names the branch.

```flang
тотальная функция «Имя кода»
  принимает код: число
  возвращает строка
  обеспечивает «g1 охрана слово в слово» если (код меньше 1) или (код больше 3) то (результат равен "неизвестный") иначе да
  обеспечивает «g2 без охраны» (результат равен "неизвестный") или (код не меньше 1)
  обеспечивает «g4 охрана своими словами» если код меньше 1 то (результат равен "неизвестный") иначе да
  обеспечивает «g5 двойник» не ((код меньше 1) или (код больше 3)) или (результат равен "неизвестный")
  обеспечивает «g6 вторая ветвь иначе» если не ((код меньше 1) или (код больше 3)) то (если код равен 1 то (результат равен "первый") иначе да) иначе да
  пример «чужой»
    дано код равно 7
    ожидается "неизвестный"
  пример «первый»
    дано код равно 1
    ожидается "первый"
  если (код меньше 1) или (код больше 3)
    то "неизвестный"
    иначе если код равен 1 то "первый" иначе "второй"
```

```
постусловие «g1 охрана слово в слово» … доказано сведением цели с телом функции: правило «разбор цели по условию»
постусловие «g2 без охраны» … сетка 2 значения (примеры функции)
постусловие «g4 охрана своими словами» … доказано сведением цели с телом функции: правило «разбор цели по условию»
постусловие «g5 двойник» … доказано сведением цели с телом функции: правило «разбор случаев по внутреннему условию цели»
постусловие «g6 вторая ветвь иначе» … доказано сведением цели с телом функции: правило «разбор цели по условию»
```

What follows from this run:

- the guard can be the body's condition copied as it is (`g1`) or a narrower
  condition that implies it (`g4`);
- `если У то Ц иначе да` and `не (У) или (Ц)` are both proved (`g1`, `g5`);
- a claim about the `иначе` branch is written with the negated condition, and
  the inner `если` is nested the same way (`g6`);
- without a guard (`g2`) the claim is not proved, even though it is true.

Deeper `иначе если` chains work the same way. On a body
`если код равен 200 … иначе если код равен 404 … иначе если код равен 500 …`,
claims about the second and third branches were proved both with the full path
(`если не (код равен 200) то (если не (код равен 404) то …`) and with only the
branch's own condition (`если код равен 500 то …`).

## 2. Under a guard, state equality to a value

The prover matches the result against the value the branch returns. It does not
derive properties of that value: the length of a string literal or whether a
list is empty.

```flang
обеспечивает «g3 длина под охраной» если (код меньше 1) или (код больше 3) то ((длина результат) больше 0) иначе да
```

```
постусловие «g3 длина под охраной» … сетка 2 значения (примеры функции)
```

The same for emptiness:

```flang
тотальная функция «Пустой при нуле»
  принимает корень: число, все: список числа
  возвращает список числа
  обеспечивает «e1 предикат пусто» если корень не больше 0 то (пусто результат) иначе да
  обеспечивает «e2 равенство пустому» если корень не больше 0 то (результат равен пустой список) иначе да
  обеспечивает «e3 равенство без охраны» (результат равен пустой список) или (корень больше 0)
  пример «ноль»
    дано корень равно 0
    дано все равно [1]
    ожидается пустой список
  если корень не больше 0
    то пустой список
    иначе все
```

```
постусловие «e1 предикат пусто» … сетка 1 значение (примеры функции)
постусловие «e2 равенство пустому» … доказано сведением цели с телом функции: правило «разбор цели по условию»
постусловие «e3 равенство без охраны» … сетка 1 значение (примеры функции)
```

The rule: a guard from the body (section 1) plus equality to what the branch
returns. Equality alone (`e3`) is not enough. The value may be any term of that
branch, not only a literal: `результат равен (весь минус сколько)` for a body
`весь минус сколько` is proved.

## 3. Inequalities depend on the argument types

### `число` contains NaN

`число` is an IEEE-754 double, and NaN is not ordered: `(0 делить на 0) не
больше (0 делить на 0)` is `false`. So `а не больше (а плюс б)` is false when
`а` is NaN, and the compiler rejects the whole file:

```
FLANG_BOUND_ON_NAN в файле nan.flang, строка 6, столбец 3: постусловие «n1 а число» функции «Сумма чисел» ЛОЖНО, и контрпример назван: «а» объявлен типом «число», а «не число» живёт в этом типе …
```

The message lists three fixes, and all three are proved:

```flang
тотальная функция «Сумма двух»
  принимает а: неотрицательное, б: неотрицательное
  возвращает число
  обеспечивает «m1 а не больше суммы» а не больше результат
  обеспечивает «m2 б не больше суммы» б не больше результат
  а плюс б

тотальная функция «Сумма с требованием»
  принимает а: число, б: неотрицательное
  возвращает число
  требует «а неотрицательно» а не меньше 0
  обеспечивает «h1 при требовании» а не больше результат
  а плюс б

тотальная функция «Сумма с оговоркой»
  принимает а: число, б: неотрицательное
  возвращает число
  обеспечивает «h2 с оговоркой» не ((а минус а) равен 0) или (а не больше результат)
  а плюс б
```

```
постусловие «m1 а не больше суммы» … доказано по объявленным типам аргументов: цель сведена правилом «порядок по построению»
постусловие «h1 при требовании» … доказано по объявленным типам аргументов: цель сведена правилом «порядок по построению»
постусловие «h2 с оговоркой» … доказано по объявленным типам аргументов: цель сведена правилом «порядок по построению»
```

The added value `б` needs a lower and an upper bound: `5 не больше (5 плюс
(0 минус 1))` is `false`, and `−∞ плюс +∞` is NaN. `неотрицательное` gives both
bounds. When the same value is added on both sides, the prover proves the
inequality under a guard:

```flang
обеспечивает «h3 общая прибавка» если (о не больше п) то ((общее плюс о) не больше результат) иначе да
```

for a body `общее плюс п` is proved.

`(а минус б) плюс б равен а` is not a law for doubles:
`((9007199254740994 минус 1) плюс 1) равен 9007199254740994` is `false`. To
say "nothing is lost", write equality to a term of the branch:
`результат равен (весь минус сколько)`.

### Which side of an inequality, in the claim and in the guard

In the **claim** the side does not matter: `(длина результат) не меньше (длина х)`
and `(длина х) не больше (длина результат)` are both proved, and so are
`результат не меньше а` and `а не больше результат`.

In the **guard** it matters. The guard must be written exactly as the condition
in the body:

```flang
тотальная функция «Порог»
  принимает место: число
  возвращает число
  обеспечивает «r1 охрана как в теле» если место не меньше 1 то (результат равен место) иначе да
  обеспечивает «r2 охрана зеркалом» если 1 не больше место то (результат равен место) иначе да
  если место не меньше 1
    то место
    иначе 1
```

```
постусловие «r1 охрана как в теле» … доказано сведением цели с телом функции: правило «разбор цели по условию»
постусловие «r2 охрана зеркалом» … объявлено, не доказано
```

### Strict inequalities

A strict inequality with arguments left in it is not proved:
`результат больше (а минус 1)` for `а плюс б` stays «объявлено, не доказано».
For a remainder, write the non-strict bound:

```flang
тотальная функция «Остаток бит целый»
  принимает ч: неотрицательное
  возвращает число
  обеспечивает «q2 остаток неотрицательного» результат меньше 65536
  обеспечивает «q3 остаток неотрицательного не больше» результат не больше 65535
  ч остаток от 65536
```

```
постусловие «q2 остаток неотрицательного» … объявлено, не доказано
постусловие «q3 остаток неотрицательного не больше» … доказано по объявленным типам аргументов: цель сведена правилом «ограниченность точным потолком по построению»
```

With `ч: число` the same function is rejected with `FLANG_BOUND_ON_NAN`.

## 4. A goal without free names is computed

If nothing in the goal depends on arguments, the prover computes it, and any
comparison works, strict ones too:

```flang
тотальная функция «Пять»
  возвращает число
  обеспечивает «z1 замкнутая строго» результат меньше 6
  обеспечивает «z2 замкнутая больше» результат больше 0
  5

тотальная функция «Метка»
  возвращает список числа
  обеспечивает «z3 длина литерала» (длина результат) равен 3
  [100, 101, 114]
```

```
постусловие «z1 замкнутая строго» … доказано вычислением замкнутой цели: свободных имён в ней не осталось, значит значение у неё одно, и вычисление отвечает про него целиком
постусловие «z3 длина литерала» … доказано сведением цели с телом функции: правило «тождество после переписки допущением»
```

Every function that returns a constant or a list of constants can get its value,
length and bounds as postconditions for free.

## 5. Calls: the prover uses the callee's proved postconditions

The body of a recursive function is not unfolded. If the body calls one, the
prover knows about the result only what that function's **proved**
postconditions say:

```flang
тотальная функция «Копия без»
  принимает х: список число
  возвращает список число
  разбор х
    случай пусто
      то пустой список
    случай голова и хвост
      то приписать голова к («Копия без» от хвост)

тотальная функция «Копия с»
  принимает х: список число
  возвращает список число
  обеспечивает «k1 длина копии» (длина результат) равен (длина х)
  разбор х
    случай пусто
      то пустой список
    случай голова и хвост
      то приписать голова к («Копия с» от хвост)

тотальная функция «Верх без»
  принимает х: список число
  возвращает список число
  обеспечивает «k2 верх над голым звеном» (длина результат) равен (длина х)
  «Копия без» от х

тотальная функция «Верх с»
  принимает х: список число
  возвращает список число
  обеспечивает «k3 верх над звеном с обещанием» (длина результат) равен (длина х)
  «Копия с» от х
```

```
постусловие «k1 длина копии» … доказано индукцией по «список»: база 1 случай, шаг при допущении на частях (1 случай)
постусловие «k2 верх над голым звеном» … объявлено, не доказано
постусловие «k3 верх над звеном с обещанием» … доказано сведением цели с телом функции: правило «цель есть допущение»
```

So when a claim is not proved, look at what the body calls and give the called
function the postcondition the claim needs. A postcondition of the callee that
is only checked on examples does not help: the compiler passes a callee's
postcondition to the caller only if it is proved («Дописать факт вызванного»
in `flang/self/proofterm.flang`).

A non-recursive callee without postconditions is not a problem: for
`«Без обещания»` with the body `приписать 0 к х`, the caller's claim
`(длина результат) равен ((длина х) плюс 1)` is proved.

### A theorem by a callee's property

If the body is a call and the callee has the postcondition you need, a one-step
theorem closes the claim. It works on a bare call and on a call bound with
`пусть`:

```flang
тотальная функция «Голый вызов»
  принимает х: список число
  возвращает список число
  обеспечивает «t1 голый вызов» (длина результат) не больше (длина х)
  «Копия» от х

теорема «t1 голый вызов»
  дано х: список число
  утверждаем (длина результат) не больше (длина х)
  по свойству «копия той же длины»
  следовательно доказано
```

```
постусловие «t1 голый вызов» … доказано: терм принят ядром, 1 шаг, правило «цель есть допущение», основания: постусловие «копия той же длины» функции «Копия»
```

A theorem that does not go through rejects the whole file: exit code 1 and no
proof report at all.

```
FLANG_PROOF_STEP в файле g3.flang, строка 22, столбец 3: шаг 1, теорема «t1 голый вызов»: не выведено заключение из постусловия «копия той же длины» функции «Копия» …
g3.flang: не проверено — ведомость не печатается у программы с замечаниями
```

Add theorems one at a time.

## 6. Folds: the fold must be the whole body

The prover proves a claim about `свёртка` by induction over the fold, with the
step written either inline or as a function:

```flang
тотальная функция «Счёт лямбдой»
  принимает х: список число
  возвращает число
  обеспечивает «f7 счёт лямбдой» результат равен (длина х)
  свёртка х начиная с 0 как акк и эл → акк плюс 1
```

```
постусловие «f7 счёт лямбдой» … доказано индукцией по СВЁРТКЕ тела: начало 1 случай, виток при допущении о накопителе «акк» (1 случай)
```

It does this only when the fold is the whole body and goes over an argument:

| Body | Result |
| --- | --- |
| `свёртка х начиная с 0 как акк и эл → «Счёт шагом» от акк и эл` | proved |
| `(свёртка х … ) плюс 0` | объявлено, не доказано |
| `пусть н равно (свёртка х …)` then `н` | объявлено, не доказано |
| `свёртка куча.свободные …` (a field of the argument) | объявлено, не доказано |

The fix is in the program: make the fold the body of its own function that takes
the list as an argument, and call that function.

When the step has branches and you want to say something about one of them,
move the step into a function with the accumulator as an argument. Then the
guard from section 1 works on the step.

Not proved even in this form: `результат не меньше 0` for a sum over
`список неотрицательное` (with an inline step or a step function).

## 7. Enums: guard by equality to a variant

A body that is a `разбор` over an enum argument is split by a guard that compares
the argument to a variant:

```flang
тип «Ответ»
  вариант «Пока ничего»
  вариант «Текст» содержит текст: строка

тотальная функция «Текст ответа»
  принимает отклик: «Ответ»
  возвращает строка
  обеспечивает «v2 равенство варианту» если отклик равен (вариант «Пока ничего») то (результат равен "") иначе да
  разбор отклик
    случай «Пока ничего»
      то ""
    случай вариант «Текст» с текст как т
      то т
```

```
постусловие «v2 равенство варианту» … доказано сведением цели с телом функции: правило «разбор цели по условию»
```

A `разбор` inside the postcondition itself does not parse; use this guard
instead.

A variant **with fields** works too: give each field a value through an
accessor function of the same argument. The probe
`docs/examples/proof-probes/variant-with-fields.flang` writes one claim many
ways:

```
$ flang check docs/examples/proof-probes/variant-with-fields.flang --proof
…
утверждений 23: доказано 18 (из них индукцией 2) (из них без теоремы 16), сетка 5, объявлено, не доказано 0
```

| Way of writing | Result |
| --- | --- |
| the argument compared to a variant without fields | proved |
| the argument compared to a variant with fields, the field filled by an accessor (`«Вес груза» от «груз»`) or by a literal | proved |
| the guard negated: `если не («груз» равен (вариант «Пусто»)) то …` | proved |
| the result of a call compared to a variant without fields | proved |
| the result of a call compared to a variant with fields, or negated | сетка |
| a second claim under `иначе` instead of `да` | сетка for a variant with fields |

For a list, `разбор` with `пусто` and `голова и хвост` is split by
`если х равен пустой список то …` and by `если (длина х) равен 0 то …`; both
are proved.

If an enum has exactly one variant, its field is read in the postcondition with a
dot: `результат равен ход.найдено` is proved.

## 8. Boolean goals: try both forms

A goal that is a call to a predicate can be written bare or with `равен да`.
In the probes both forms were proved in most cases, but in
`variant-with-fields.flang` the bare form «без полей цель голым признаком»
stayed `сетка` while the same claim with `равен да` was proved. When one form is
not proved, try the other.

A claim that reads the result backwards, from the condition to the answer, is
proved like any other: for the body `(ч больше 10) и притом (ч меньше 20)`, both
`если результат то (ч больше 10) иначе да` and
`если (ч больше 10) и притом (ч меньше 20) то (результат равен да) иначе да` are
proved.

A false claim gets the same «объявлено, не доказано» as a true one the prover
cannot handle. Before rewriting a claim, check that it is true: write an example
that would break it.

## 9. A guard the body does not test

A guard is used to split the goal only if the body tests the same condition.
For a body `если первое меньше второе то второе иначе первое` (arguments
`неотрицательное`):

| Claim | Result |
| --- | --- |
| `результат не меньше первое` | объявлено, не доказано |
| `если (первое больше 0) и притом (второе больше 0) то (результат не меньше первое) иначе да` | объявлено, не доказано |
| `(не (первое меньше второе)) или (результат не меньше первое)` | объявлено, не доказано |
| `(первое меньше второе) или (результат не меньше первое)` | proved |

Write the claim per outcome of the body's own condition.

## 10. Conjunctions

A conjunction in the claim (`Ц1 и притом Ц2`) can be proved as a whole: in
the probes `если ч равен 0 то ((результат равен 1) и притом (результат больше 0)) иначе да`
was. When it is not proved, split it into separate
`обеспечивает` lines: the prover handles each one separately, and the report
shows which part is the problem.

A conjunction in the **guard** cannot be split: `если А и притом Б то В` and
`если А то В` are different claims, and the second is stronger. A disjunction
in the guard can be split without changing the meaning: `если (А или Б) то В`
is the same as two claims `если А то В` and `если Б то В`.

## What the report does not tell you

For a claim without a theorem that is not proved, the report always prints the
same text, whatever the cause:

```
объявлено, не доказано: ни теоремы, ни примеров. Его считает рантайм после каждого возврата — на тех входах, которые придут
```

It does not say which rule was missing. A named refusal with the list of goal
kinds the prover handles comes only for a theorem you wrote
(see [The kernel refused](proof-refused.html)).

## Examples do not make a proof

Adding an example to a claim moves it from «объявлено, не доказано» to
«сетка», not to «доказано»:

```
постусловие «k4 с примером» … сетка 1 значение (примеры функции)
```

«Объявлено» is not worse than «сетка»: the runtime checks it on every real
call, while `сетка` only says that your examples passed.

## Check that a proved claim is not empty

A claim that holds for any body proves nothing. To check one, replace the body
with a stub of the same type and run the report again. If the claim is still
proved, it says nothing about the function.

Use two stubs: a zero one (`0`, `""`, `нет`, an empty list) and a non-zero one
(`1`, `"я"`, `да`, `["я"]`). A claim of the form
`… то результат равен да иначе да` survives the `да` stub and fails only on
`нет`. Stub one function at a time: if two functions are stubbed at once, a
claim that mentions the other one can look empty when it is not.

## Large files and the step limit

A file with many claims can run out of steps: the check stops with
`FLANG_RECURSION_LIMIT` and prints no report. Raise the limit for one run with
`--step-limit N` (Cyrillic `--предел-шагов`); the default is built into the
binary (`FL_MAX_STEPS` in `bootstrap/flang_runtime.h`).

## The order of work

1. Run `flang check <file> --proof` and save the last line of the report.
2. For a branching body, add guards from the body (sections 1 and 2).
3. Change the argument types to `неотрицательное` or add `требует` where an
   inequality is involved (section 3).
4. For what is left, look at the called functions and give them the
   postconditions the claim needs (section 5).
5. Run the report again and compare the `доказано` number with the saved line.
   If it did not grow, undo the edit.
