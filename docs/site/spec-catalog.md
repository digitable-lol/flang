# The spec catalogue: how it is built and what checks it

The page [Specs: a business rule that is proved](fspec.html) shows one spec.
This one is about a catalogue of many: how specs refer to one another, what
counts as an accepted spec, and which program checks that.

The catalogue lives in [`fspec/`](fspec). It is not the language specification
(that is [`docs/flang/SPEC.md`](../flang/SPEC.md)) but a sample: 43 rules of a
business domain written as programs, and a check on top of them.

## What lies where

| file | what it does | size |
|---|---|---|
| [`spec/*.flang`](fspec/spec) | the specs themselves | 43 files <!-- СНЯТО 2026-09-20 файлов fspec/spec/*.flang = 43 -->, 140 examples <!-- СНЯТО 2026-09-08 примеров-в fspec/spec/*.flang = 140 --> |
| [`policy.flang`](fspec/policy.flang) | the acceptance rule: what counts as proved, what "agrees with its predecessor" means | 534 lines <!-- СНЯТО 2026-10-04 строк fspec/policy.flang = 534 --> |
| [`guard.flang`](fspec/guard.flang) | the catalogue check: reads the snapshot and the specs, runs the compiler, names the troubles | 1378 lines <!-- СНЯТО 2026-10-04 строк fspec/guard.flang = 1378 -->, 145 examples <!-- СНЯТО 2026-10-04 примеров-в fspec/guard.flang = 145 --> |
| [`snapshot.txt`](fspec/snapshot.txt) | the snapshot: one line per claim — file, function, name, goal | 102 lines <!-- СНЯТО 2026-09-20 строк fspec/snapshot.txt = 102 --> |
| [`snapshot.flang`](fspec/snapshot.flang) | rewrites the snapshot from the current specs | 123 lines <!-- СНЯТО 2026-10-01 строк fspec/snapshot.flang = 123 --> |
| [`forgery.flang`](fspec/forgery.flang) | deliberately broken catalogues: on each one the check must find a trouble | 292 lines <!-- СНЯТО 2026-10-04 строк fspec/forgery.flang = 292 --> |
| [`clarifications.flang`](fspec/clarifications.flang) | turns a failed proof into a question for the author of the requirement | 407 lines <!-- СНЯТО 2026-10-01 строк fspec/clarifications.flang = 407 --> |
| [`experience/`](fspec/experience) | a coarse requirement and two answers to it — material for `clarifications.flang` | 3 files <!-- СНЯТО 2026-09-08 файлов fspec/experience/*.flang = 3 --> |
| [`experiments/`](fspec/experiments) | programs that show what `flang check` sees and what it does not | 22 files <!-- СНЯТО 2026-09-08 файлов fspec/experiments/*.flang = 22 --> |
| [`settings.txt`](fspec/settings.txt) | the path to the compiler and the spec directory | 2 lines |

The check is written in flang: it runs the compiler as a process and reads its
answer with the orders "list a directory", "read a file" and "run a process".

## What a spec looks like

The first spec of the catalogue,
[`fspec/spec/01-discount-cap.flang`](fspec/spec/01-discount-cap.flang),
comments stripped — "the discount is at most 30", stated three times, in
Russian, Chinese and English:

```flang
модуль «Спека 1: потолок скидки»

тотальная функция «Потолок скидки»
  принимает сумма: число
  возвращает число
  обеспечивает «скидка не больше 30» результат не больше 30
  обеспечивает «zh: 折扣不超过 30» результат не больше 30
  обеспечивает «en: discount is at most 30» результат не больше 30
  пример «потолок»
    дано сумма равно 1000
    ожидается 30
  30
```

```
$ flang check fspec/spec/01-discount-cap.flang --proof
  утверждений 3: доказано 3 (из них без теоремы 3), сетка 0, объявлено, не доказано 0
```

3 claims, 3 proved. Specs are matched by the pair "function and claim name".
Rename a claim and the link breaks; the check will name it.

A spec that rests on an earlier one brings it in:

```flang fragment
модуль «Спека 3: наценка за срочность»
  использует «Спека 2: промо» из "./02-promo.flang"
```

## The acceptance rule

The rule is written in `policy.flang`. A spec is accepted if **every** claim of
its own is proved and **every** claim of its predecessor is still proved in the
heir's report.

Rejected:

| what was found | why it will not do |
|---|---|
| "stated, not proved" | the claim may turn out false |
| "grid" | computed on the author's examples, not for all inputs |
| "VIOLATED" | a falsehood found by an example |
| a spec without a single `обеспечивает` | there is nothing to check |
| a predecessor's claim gone or weakened | the new rule cancelled the old one |
| a claim from the snapshot gone from the specs | a proved rule was withdrawn |
| a claim from the snapshot with its goal rewritten | same name, different promise |
| a claim present but absent from the snapshot | it can be rewritten unnoticed |
| an empty spec directory | the check has nothing to disagree about |
| one name carrying two different notions | the reader takes it for one thing while it is two |
| a `принимает` line not parsed in full | a substituted notion under that name stays invisible |

A claim that is true but that the kernel cannot derive is rejected too: the
kernel is incomplete. A sample is
[`flang/proof/examples/precondition.flang`](flang/proof/examples/precondition.flang).
Which spellings the kernel takes is laid out on the page
[Which postconditions the prover proves](what-the-kernel-accepts.html).

## A claim that says nothing

A claim can be proved and still say nothing about the function. That happens
when it also holds for a stub of the same signature — a body of `0`, `""`,
`нет`, the empty list. It is checked by a run: keep the signature and the
`обеспечивает`, replace the body with a stub.

```flang
модуль «Заглушка»

тотальная функция «Потолок скидки»
  принимает сумма: число
  возвращает число
  обеспечивает «скидка не больше 30» результат не больше 30
  0
```

```
$ flang check stub.flang --proof
stub.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 0
```

The stub passed (1 claim, 1 proved, exit code 0): the claim of the first spec
holds for any function that returns at most 30. The first two specs of the
catalogue show the link between two specs, not a strong claim.

Claims that do not survive a stub: about a length
(`(длина результат) равен ((длина х) плюс 1)`), about containment
(`результат содержит "…"`), about the fields of a record, and about a bound
where the result itself is the bound (`цена не больше результат`). Claims that
do survive: one-sided upper bounds (`результат не больше 30`) and
non-negativity (`результат не меньше 0`).

## The snapshot: what was proved before

The acceptance rule sees the specs as they are now. If the goal of a claim is
rewritten without touching its name, the rule does not notice. That is what
`snapshot.txt` is for — one line per claim, with the goal word for word:

```
01-discount-cap.flang :: Потолок скидки :: скидка не больше 30 :: результат не больше 30
```

The check compares the snapshot with the specs in both directions:

- every claim of the snapshot stands in a spec with the same goal. Gone — the
  rule was withdrawn. A different goal — both goals are shown side by side;
- every claim of a spec is recorded in the snapshot.

The snapshot is rewritten by a separate command:

```sh
flang io fspec/snapshot.flang
```

It is deliberately not updated together with the specs: changing a goal is two
actions, and the second shows as a line of its own in the diff.

The goal is taken from the source of the spec, from its `обеспечивает` line.
That is why a claim is written on one line: `обеспечивает «name» goal` or
`для всех н обеспечивает «name» goal`.

The snapshot does not judge whether a new goal is weaker than the old one. "At
most 1000" and "at most 30" are simply different to it.

## A claim in another language

A claim can be repeated in another language, with a language tag in its name —
as in the first spec above. Every translation is a separate claim: the kernel
proves it on its own, and it stands in the report and in the snapshot.

The name of the claim is translated. Names of functions and parameters are
not.

There are nine tags: `ar`, `de`, `en`, `es`, `fr`, `hi`, `ja`, `pt`, `zh`. The
list is closed so that a typo such as `zn:` does not become a separate claim
that is compared with nothing. Hence a limit: `": "` in a claim name means a
language tag.

The check compares the goals of translations, not their words. A wrongly named
translation with the right goal passes.

## Checking the check

`forgery.flang` is a set of deliberately broken catalogues. On each one the
check must find a trouble, and on an honest change it must stay silent.

```sh
flang run-script specs:forgery
```

Among the cases: a rule weakened under its old name; a spec without its
predecessor; a translation that promises something other than the main claim;
a typo in a language tag; a translated function name.

## What the check answers at present

The checking program is itself not proved in full, so `flang io` does not run
it without consent:

```
$ flang io fspec/guard.flang
не доказано: утверждений 133: доказано 80, сетка 53, на веру 0 — запуск только по явному согласию: --trust
```

(133 claims: 80 proved, 53 on the grid.) The `specs:check` command runs it
with consent and at present finds 78 troubles:

```
$ flang run-script specs:check
бед в системе спек: 78
03-urgency-markup.flang: утверждение «скидка с промо не больше 30» функции «Скидка с промо» доказано у 02-promo.flang, а здесь его нет или оно ослаблено
…
```

| troubles | which | cause |
|---:|---|---|
| 69 | "proved in the predecessor, absent or weakened here" | the `check --proof` report holds only the claims of the file itself, not of the modules it uses; a predecessor's claim cannot be found in it |
| 4 | "the GOAL is rewritten" | the specs `04-discount-tiers`, `14-tax-rates`, `31-loyalty-tiers`, `37-booking-slots`: a goal containing the word `иначе` is read from the source incompletely and does not match the snapshot |
| 4 | "not recorded in the snapshot" | the same four claims |
| 1 | "the spec does not pass the language check" | two claims of `26-order-invoice` are on the grid, and `check --proof` answers exit code 3 |

The first row means that the check goes red on every spec with a `использует`
line, not only on a real cancellation of a rule. The heir itself is proved:

```
$ flang check fspec/spec/03-urgency-markup.flang --proof
  утверждений 1: доказано 1 (из них без теоремы 1, объявленным типом 1), сетка 0, объявлено, не доказано 0
```

The set of broken catalogues does not pass at present either:

```
$ flang run-script specs:forgery
подлог спек ОТКАЗЫВАЕТ, расхождений 7 (подложенных случаев 21)
```

("the spec forgery refuses: 7 mismatches, 21 planted cases"; exit code 1.) Of
the seven mismatches one is the catalogue itself: the set expects the check to
stay silent on the real specs, and it finds 78 troubles. In the other six the
check does find a trouble but names it in words other than those the case
expects: two cases with a claim "stated, not proved", the case with a lost
predecessor claim (two troubles, not one), and three expectations in the case
of a false claim on a function with no inputs.

## What a lone `flang check` sees

The programs in `experiments/` show which contradictions the compiler finds by
itself. The code is the answer of `flang check <file> --proof`:

| program | what is written in it | code |
|---|---|---:|
| `contradiction-without-example.flang` | two incompatible `обеспечивает` on one function, no example | 1 |
| `contradiction-one-function.flang` | the same plus the author's example | 1 |
| `contradiction-in-requirements.flang` | two incompatible `требует` and a caller | 1 |
| `contradiction-delivery-window.flang` | "no longer than three days" and "no faster than seven" | 1 |
| `contradiction-money-rounding.flang` | "the total is a whole rouble" and "the total has fifty kopecks" | 1 |
| `contradiction-return-defect.flang` | two return rules in one function | 1 |
| `contradiction-tax-theorem.flang` | "the rate is at most 20" and "at least 27", a theorem under each | 1 |
| `contradiction-weight-requirements.flang` | `требует` "heavier than ten" and "lighter than five", and a caller | 1 |
| `theorem-on-false.flang` | a theorem that proves a falsehood | 1 |
| `false-claim-strict-discount.flang` | "a discount strictly lowers the price" — false on a zero order | 1 |
| `false-claim-not-a-number.flang` | the same, the price declared `число`: false on NaN | 1 |
| `false-claim-negative-zero.flang` | "reversing a zero payment is zero" — false on minus zero | 3 |
| `spec-legacy.flang` + `spec-new-feature.flang` | the heir promises the opposite of its predecessor | 0 and 1 |
| `conflict-cap-legacy.flang` + `conflict-cap-heir.flang` | the new spec demands "at least 50" and calls the earlier one | 0 and 1 |
| `conflict-rights-legacy.flang` + `conflict-rights-heir.flang` | the new one promises the guest has no read access left | 0 and 3 |
| `silent-drop-legacy.flang` + `silent-drop-heir.flang` | the heir brings in its predecessor with a selection (`только`) and loses one of its rules | 0 and 0 |
| `superseded-cap-30.flang` + `replacement-cap-45.flang` | a second edition of a rule, with no inheritance | 0 and 0 |

**Code 1** — a falsehood was found. A contradiction without an author's example
the compiler finds by itself: it computes the claim on a trial input.

```
$ flang check fspec/experiments/contradiction-without-example.flang --proof
FLANG_EXAMPLE: FLANG_PROPERTY: постусловие «скидка не меньше 50» функции «Скидка заказа» нарушено на входе сумма = 0 — посчитано вычислителем на этом входе
```

**Code 3** — the claim is neither proved nor refuted. That is the answer on
`false-claim-negative-zero.flang`: the claim is false on minus zero, but the
compiler does not find that and leaves it on a grid of one example. Proved does
not mean right, and not refuted means even less: zero, the empty value, the
edge of a range and minus zero are worth writing down as examples.

**Code 0 for the last two pairs** is what the catalogue is for. Bringing a
module in with a selection and writing a new edition of a rule are both lawful
programs. A cancelled rule can be told from a replaced one only by knowing what
stood before, that is, by the snapshot.

## How to add a spec

1. Put a file into `fspec/spec/` with a number at the start of its name. The
   file name is in English words.
2. The first line is `модуль «Спека N: …»`. If the spec rests on an earlier
   one, the second line is `использует «Спека M: …» из "./….flang"`.
3. Write a function with `обеспечивает «name» …`. The name will appear in the
   trouble report.
4. Check it: `flang check fspec/spec/<file> --proof`. The claim has to be
   proved; "grid" and "stated, not proved" are not accepted.
5. Replace the body with a stub. If the claim survived, rewrite it.
6. Record the claim in the snapshot: `flang io fspec/snapshot.flang`.
7. Run `flang run-script specs:check`.

## What the catalogue does not have

| what is missing | why it is needed |
|---|---|
| a search for a contradicting example between specs | "not proved" does not mean "false"; the two can be told apart only by showing a value |
| a spec before its implementation | `обеспечивает` is written at a function with a body, and the claim is derived from the body |
| a judgement on whether a new goal is weaker than the old one | the snapshot sees only that the goal is different |
| a run of the check's own examples | the 145 examples <!-- СНЯТО 2026-10-04 примеров-в fspec/guard.flang = 145 --> of `guard.flang` are run by no command: the run hits the step limit |

An external solver (Z3 and the like) is not connected: its answer
"unsatisfiable" cannot be checked by the kernel.

## Next

- [Specs: a business rule that is proved](fspec.html) — one spec on a running example.
- [What is proved and what is not](what-is-proved.html) — where the boundary runs.
- [Which postconditions the prover proves](what-the-kernel-accepts.html) — which spelling the kernel will prove.
- [The kernel refused: whose mistake is it](proof-refused.html) — the kernel's refusal codes.
- [The flang service for an AI assistant](ai-assistant.html) — the same check through MCP.
