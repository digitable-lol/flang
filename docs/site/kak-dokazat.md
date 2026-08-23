# Which postconditions the kernel accepts

The neighbouring page, [The kernel refused](proof-refused.html), covers the case
where the check shouts a code at you. This one covers the quieter and more
annoying case: no diagnostics, exit code zero, and the proof report says `сетка` — a
grid. The postcondition is written, it was checked on a finite set of values,
and it is **not proved**.

Below are seven ways of writing a claim. For each one a run tells us whether the
kernel takes it. The numbers were measured on 23 August 2026 against the
standard library; they are not estimates.

## Read the verdict first

```
утверждений 89: доказано 30 (из них индукцией 1) (из них без теоремы 28), сетка 59
```

| word | what it means |
|---|---|
| `доказано` | the claim holds for **all** inputs — this is the goal |
| `доказано ПРИ УСЛОВИИ` | the derivation is sound but leans on a premise the kernel did not prove |
| `сетка` | checked on a finite set of values; nothing is known about the rest |
| `объявлено, не доказано` | written down and taken on faith |

The third column is a trap for reporting. `сетка 59` reads like "work done",
while none of those 59 are proved. Count the first number only.

`доказано ПРИ УСЛОВИИ` is a separate verdict and it is more honest than the old
behaviour: before it existed, a claim resting on an unproved premise landed in
the general proved count. Measured on `numtree.flang`: the claim "sorting by
tree loses no numbers and adds none" stood as proved, while it actually rested
on "the tree holds exactly as many numbers as the list", which was not proved.

## 1. The claim's guard repeats the body's condition word for word

The most productive form of all. If the body starts with a branch, write the
claim under the same guard:

```flang
// body
если (код меньше 1) или (код больше 3)
  то "неизвестный"
  иначе если код равен 1 то "первый" иначе "второй"

// claim — the same guard, character for character
обеспечивает «чужой код назван чужим»
  если (код меньше 1) или (код больше 3) то (результат равен "неизвестный") иначе да
```

The kernel splits the goal along the guard, closes the false half immediately,
and in the true half takes the guard as an assumption — under which the body
reduces to a literal. No theorem needed.

In one pass this lifted `tls.flang` from 15 to 21 and `crl.flang` from 56 to 59.

**The kernel takes four levels; the fifth it does not.** Measured separately and
identically on four functions in `sqlite.flang`: «Ширина по типу» (the seventh
type), «Значение по типу» (the ninth), «Целое октетами» (width six), «Серийный
тип целого» (the fourth level, with a conjunction in the guard). All five edits
stayed grids and were reverted. When planning, count the first four branches of
an `иначе` chain as provable and the rest as not.

**Within those four, what blocks it is not the depth but a numeric guard.** The measurements
disagreed and reconciled only this way: in `образцы.flang` all three nesting
levels of «Совпало с места» landed, because its guards are not numeric; in the
same file the third level of «Точка вниз» (`точка равен 1025`) stayed a grid. In
`http.flang` the same: the second level was proved, the ninth and twenty-first
were not — and all of those are about numeric codes. The level itself is not the
obstacle; a chain of numeric comparisons is, and there the kernel loses the goal
split.

**Mirroring nested `если` is worth trying but does not always work — measure.**
Two runs on the same day disagreed, and both are honest. In `provod.flang` the
entire +8 came from the nested levels: the previous author had mirrored only the
top `если` and left the nested ones alone. In `utf8.flang` it went the other way:
the top branch of «Значения знака 64» was proved, while four claims about the
`иначе (если …)` of the same body stayed grids under both a short guard and a
full one. There is no rule "do not go below the first level" — there is a rule to
take the proof report after every edit.

**Repeat an `иначе` chain in full, branch by branch.** The guard only takes the
first branch of the body. For the second, write `если не (first condition) то
(если (second) то … иначе да) иначе да`; for the third, two negations in a row.
That is how all five remaining names in `x509.flang` landed. Caveat: on numeric
guards where the chain mixes `меньше` and `равен`, the third level no longer
lands.

**Mirror it literally, not by meaning.** For «Цифра провода» the claim
`"0123456789" содержит знак` stayed a grid, while the same meaning as the code
range `48..57`, copied from the body, was proved: the kernel has no bridge
between «содержит» and a character's code.

**It works only when the guard is itself a comparison.** A guard that is a call —
`если («Серийный номер отозван» от номер и список) то …` — stays a grid: the
kernel knows nothing about someone else's predicate. A **comparison with a call
inside it**, however, does work: `если («Бит разрядов» от у и номер) равен 0 то …
иначе да` is proved, and so is a conjunction of two such comparisons.

**An exception for sum types.** In `result.flang` and `optional.flang` this form
works: the guard is a predicate call on the argument, and under it the claim
states equality of the argument to a constructor together with the result. The
kernel takes it by induction over the sum type. So the ban on a call-as-guard is
not absolute — it is about someone else's predicate over numbers, not about a
variant predicate over your own type.

**A guard must not be invented — it is copied from the body.** Measured on
`rsa.flang`: out of five claims exactly one was proved, the one whose guard
`если бит равен 0` was copied from the body verbatim. Four with invented guards
("past the end of the list", "nothing was dropped", "only the empty list equals
the empty list") stayed grids.

**A descending counter is a ready-made form.** For a recursion with a counter,
write

```flang
обеспечивает «…» если осталось не больше 0 то (результат равен акк) иначе да
```

It landed on all four such recursions in `rsa.flang` and `ecdsa.flang`.

## 2. Under a guard write equality to a literal, not an inequality

The dividing line is exact, and it cost one wasted run to find, so learn it now:

```flang
обеспечивает «…» если <guard> то ((длина результат) больше 0) иначе да   // grid
обеспечивает «…» если <guard> то (результат равен "неизвестный") иначе да // proved
```

The kernel matches the result against the literal by the «равно» rule. Deriving
the literal's length from the literal is beyond it — there is no rule saying
"the length of this particular literal is such-and-such".

The same goes for emptiness predicates. Measured on `sqlite.flang`, one thought
written two ways:

```flang
обеспечивает «…» если корень не больше 0 то (пусто результат) иначе да       // declared, not proved
обеспечивает «…» если корень не больше 0 то (результат равен пустой список) иначе да // proved
```

The rule: under a guard, state **equality to a concrete value**, not a predicate
about it.

**But equality to a literal does not work on its own — only together with a
guard taken from the body.** Measured on `redis.flang`: three claims rewritten
from `(не результат)` to `(результат равен нет)` without a guard gave zero.
Forms 1 and 2 are one form, not two.

The conclusion need not be a literal: **equality to a concrete term from the same
branch of the body** works as well. In `postgres.flang` all twelve landed that
way — `если (запас не больше 0) то (результат равен запрос) иначе да`,
`если ((длина знаки) меньше 5) то (результат равен (вариант «Вести мало»)) иначе да`.

**The quotation must be literal.** `(длина знаки) меньше 6` and `(длина знаки) не
равен 6` are different guards, and only the one standing in the body is taken.

## 3. Split a conjunction in the conclusion into parts

`обеспечивает «имя» (А и притом Б и притом В)` is something the kernel either
takes whole or does not take at all. Three separate claims it works through one
by one, and some of them usually land.

Measured: in `sha256.flang` the sixteen-member claim on «Сдвинуть расписание»
became sixteen claims, and **all sixteen were proved by induction**; the file
went 26 → 40. `json.flang` 19 → 31 and `http.flang` 15 → 26 by the same move.

**A DISJUNCTION in the guard, however, may be split, and equivalently.** `если
(А или Б) то В` divides into two claims with nothing lost and nothing
strengthened — unlike a conjunction. The kernel takes the half whose guard
matches the body's condition; the other half stays a grid. Measured on
`numbers.flang`: that is how "the absolute value is at least the number itself
when the number is non-negative" and both companion claims on minimum and
maximum landed.

**A conjunction in the GUARD must not be split.** `если А и притом Б то В` and
`если А то В` are different claims, and the second is stronger: you did not
rewrite the claim, you strengthened it. In `lists.flang` all nine compound
claims are guards — there is nothing to split there at all.

## 4. One probe predicts the outcome of a split

Before cutting a claim into ten parts, break off **one** and run it.

- The broken-off half was proved → the rest will pay off too.
- It stayed a grid → what blocks the kernel is not the conjunction; stop
  spending time here.

**First check whether the compound is already proved as a whole.** If it is,
splitting can take a proof away rather than add one: in `provod.flang` the claim
«Байтов в знаке» was proved whole, and after the split one half was proved and
the other stayed a grid. A net loss — and one probe does not catch it, because
the probe shows the proved half and looks like success.

The sign is visible without a probe if someone has already worked in the file:
«Сдвинуть расписание» had two halves standing separately and proved — splitting
the rest gave +14. «Раунд» had halves standing separately and still grids —
splitting the rest gave zero. Measured across eleven splits in `hashmap.flang`
and `sha256.flang`: the denominator grew, not one verdict changed, all reverted.

## 5. If a form does not land, try the mirrored wording — it is cheap

```flang
если (А) то (Б) иначе да
не (А) или (Б)
```

The same thing in meaning; the kernel sometimes takes the second where it will
not take the first. A run costs a minute, so trying both is a rule, not a trick.

And it is not a replacement but a **second claim**: where both wordings land, the
numerator and the denominator both grow. Measured on `aes.flang`: for «Байт по
номеру» and «Привести сдвиг» both forms were proved in one run.

But changing the form on its own solves nothing, and that was measured twice:
across thirteen grid claims in `der.flang` and `x509.flang` — zero; across
fifteen in `base64.flang` — the proof report came back digit for digit the same. In
`utf8.flang` four of fifteen moved, and all four had guards made of **numeric
comparisons on the direct argument** (`если (байт не меньше 0) и притом (байт не
больше 127) то …`). What works is not the form but the form together with such a
guard.

**Splitting an equality into two implications gives nothing.** Thirteen parts in
`utf8.flang` — all stayed grids, all reverted.

## 6. A broken chain of claims is the main cause of grids

If neither splitting nor changing the form helped, the problem is not the
wording. The kernel **does not look inside a called function** — it takes only
that function's claims. No claim on the lower link, and nothing above it can be
proved:

```
«Кусок» claims "the result is no longer than the octets"   — grid,
  because its body calls «Ход по куску»,
    and «Ход по куску» claims NOTHING about the length of what it gathered.
```

The cure is not to rewrite the upper claim but to **add a claim to the lower
link**. One such edit fixes a column of three or four grid claims at once. How
to find them: take a grid claim, look at what its body calls, and check whether
the called function claims what the goal needs.

**A workaround that removes half the dead ends: a theorem takes even a GRID
postcondition of the callee.** These are two different mechanisms and they are
easy to confuse. The automatic passing of a fact (described just below) requires
the lower claim to be proved. A hand-written "по свойству" theorem instantiates
the callee's postcondition regardless of its verdict.

Measured on `aes.flang`: both bounds of «Байт по номеру» are grids, so
«Подстановка» could not land automatically — and landed anyway, through a theorem
copied from a neighbouring one already in the file. Two more proved, two fewer
grids. **If a chain is broken and the lower link cannot be fixed, or lives in
someone else's file — write a theorem.**

**But for the AUTOMATIC passing of a fact, adding is not enough — the lower claim
must itself be proved.** This is
not a guess, it is visible in the kernel's source: in
`flang/self/proofterm.flang`, «Дописать факт вызванного» takes a fact only when
the claim's key is among the proved ones. A grid claim on the lower link gives
the caller **nothing**.

**`не больше` gets proved where `меньше` does not** — and that is a trap. The
same claim about a fold's accumulator: the strict one stayed a grid, the
non-strict one landed by induction. But the non-strict one is weaker by exactly
enough that the upper link no longer stands on it. The kernel will not add two
postconditions of one call together, so the way out is to give the lower link a
**third** claim, stated directly in the quantities the upper one needs.

Measured on `der.flang`, link by link: 15 → 16 → 17 → 19 (at the third link
«Кусок» landed by itself) → 20 → 22 → 27 → 28 → **31**. The file where changing
the form gave zero doubled through chain repair.

**But not every column rests on its lower link — check before repairing the
base.** This page used to say that proving «Целая часть» in `numbers.flang`
would clear eight grid claims in `hashmap.flang`. That turned out to be wrong
and was refuted by a run: «Целая часть» is proved, and `hashmap.flang` did not
move by a single claim — `сетка 25` before and `сетка 25` after; the only gain
in its report was the imported claim itself.

The reason is that the upper claim was blocked not by the lower link but by a
missing rule: "the ring value is non-negative" rests on "the remainder of a
negative number is greater than minus the modulus", and there is no such rule at
all. Before repairing a base, read the upper claim's refusal and make sure it
names the lower link rather than the shape of the goal.

## 7. Lift the fold's step out of the lambda and form 1 works on it

The cheapest technique of the evening, and it carries a number: **18 claims
added, 18 proved, not one new grid.** `strings.flang` 30 → 41, `lists.flang`
16 → 23.

A fold is usually written with a lambda in place:

```flang
свёртка знаки начиная с начало как ход и знак → если ход равен нет то … иначе …
```

**There is nothing to attach a claim to on a lambda** — which is why the wall
"the kernel does not unroll a fold" read as impassable, and why an earlier pass
with theorems over these files returned zero. The cure is a move: lift the
lambda's body into an ordinary function character for character, make the
accumulator a parameter — and the claim's guard can be copied from the body
again.

```flang
тотальная функция «Шаг обрезки слева»
  принимает ход: «Ход обрезки», знак: строка
  возвращает «Ход обрезки»
  обеспечивает «не начатое ведущий пробел отбрасывает»
    если не ход.«началось» то … иначе да
```

The kernel takes this by «разбор цели по условию» and «разбор случаев по
внутреннему условию цели», **without a single theorem**.

The accumulator need not be a record with fields: it landed on `ход.«началось»`
and equally on a plain value — `если ход равен нет`, `если эл меньше ход`, `если
ход содержит эл`. What works is not the field but the accumulator becoming an
**ordinary parameter of a real function**, about which something can be said.

The pattern was copied from something already in the tree: `crl.flang`, its
object «Ход обрезки» and the lifted function «Шаг обрезки».

**The limit of the technique is named by a third independent measurement.** The
folding function's own postcondition is not lifted: «Шаг обрезки слева» is now
proved four times over, and «Обрезать слева» did not move by a single claim. The
wall runs exactly along the fold boundary — the step side is open, the fold side
is closed.

**Careful with anything already proved by induction.** Lifting the step can knock
down a proof that stood. Measure, and if the file holds induction proofs on that
fold, probe once first.

## 8. A "по свойству" theorem lands only on a bare call

If the body is a single call and the callee's postcondition matches the goal
character for character, a one-step theorem goes through. If a `пусть х равно …`
stands before the call, the kernel does not look past the binding:

```
FLANG_PROOF_STEP: к этому месту не известно ничего, кроме гипотез «дано»
```

**Careful: the ban on `пусть` applies ONLY to the "по свойству" theorem.** A
binding does not block splitting the goal by condition. Measured on
`reestr.flang`: the body of «Разобрать диапазон» starts with `пусть чистый равно
(«Обрезать» от текст)`, and the claim's guard was written with the expression
substituted in — `если («Обрезать» от текст) равен "любая"` — and it **landed**.
So when the body binds a name, write the guard through the argument itself rather
than the bound name, and form 1 works.

**Which gives a move in the opposite direction: remove the `пусть` from the
body.** In `der.flang` the claim on «Содержимое» was proved not by adding
anything but by removing the binding: a bare call to «Кусок» handed over its
postcondition at once. The cost is that the call is computed twice; if it is not
a fold step, that does not multiply across iterations.

And remember: **a failed theorem takes the whole file's check down with it** —
the proof report is not printed and you are left with no numbers at all. Edit one at a
time.

## What the kernel takes in no wording at all

Measured, not assumed — do not spend time on these forms until new rules appear:

- **Folds — but only at their own boundary.** The postcondition of the folding
  function itself stays a grid: the kernel does not lift the step's claim up to
  it. The **step level, however, is fully open** — see the separate technique
  below.
- **Recursion over your own type — but not all of it.** This used to say that a
  `разбор` body is hopeless. That holds when the branching is BY VARIANT; but if
  an ordinary `если` sits inside a case, form 1 works there too. Measured on
  `aes.flang`: nine claims on `разбор` bodies were proved **by induction over the
  step type**, and all nine used a guard over a FIELD of the step rather than a
  variable bound by the pattern: `если (ход.набрано не меньше 15) то
  (результат.буфер равен пустой список) иначе да`. That is how «Шаг счёта», «Шаг
  GHASH», «Шаг CBC вперёд» and «Шаг CBC назад» landed. Hopeless are only
  «Положить в дерево», «Найти в дереве», «Уравновесить» — there the branching is
  by variant.
- **The reverse direction of an equivalence.** Where `результат → А` landed,
  `А → результат` almost never does: to derive a positive answer the kernel has
  to unroll the whole body, not pick a conjunct off it.
- **Not higher-order functions as such.** The common claim that "the kernel
  knows nothing about a function passed in, so nothing can be proved" is wrong,
  and that was checked: in `higher-order.flang` 19 of 43 claims are proved,
  among them "mapping preserves length", "insertion lengthens the list by
  exactly one" and "sorting loses no elements and adds none" — the last three by
  induction. Structural claims about higher-order functions land well.
- **Two different folds over one opaque predicate.** "The count of matches is
  the length of the filtered list" relates a counting fold to the length of
  another fold's result; that needs joint induction over two folds, while the
  kernel's rewriting is single-goal.
- **A fold over an empty list.** The kernel has no rule "a fold over the empty
  list is the base" — checked directly: the claim stayed a grid in both forms.
- **`разбор` inside the claim itself.** `обеспечивает «…» разбор довод случай …
  то …` is not taken at all. Measured twice and separately: three probes in
  `hashmap.flang` — three grids; seven probes in `postgres.flang` and
  `redis.flang`, with equality to a literal in one branch — zero gain. The
  kernel reads a `разбор` in the **body**; a `разбор` in the **claim** it does
  not, unlike an `если` guard.
- **The empty case of a `разбор` body.** Splitting the goal by condition takes
  the `если` from the body; the base of a fold and the `пусто` branch of a
  `разбор` are not substituted into the goal. Measured on `sets.flang`,
  `dictionary.flang` and `strlists.flang`: eighteen added claims about empty
  input, each in both forms — **all grids**. In those three files the gain came
  from exactly one place where the body starts with `если`.
- **Strict inequalities, full stop.** The kernel has exactly seven kinds of
  goal, and all seven are named in its own refusal
  (`flang/self/proof-kernel.flang`, «Отказ без правила»): «не меньше 0», «не
  больше конечного литерала», «не больше терма», «равно», «содержит», «не
  убывает», «начинается с». **A strict inequality is not among them.** Anything
  written with `меньше` or `больше` is unprovable by construction, not by
  oversight: both claims of «Целая часть» rested on "the difference is less than
  one" and stayed grids in every wording. If you can weaken it to a non-strict
  form, do; if you cannot, the claim waits for a new kernel rule.
- **Inequality bounds in the general case.** Measured on `numtree.flang` and
  `kdf.flang`: "the height of a fork is at least 1", "a fork's traversal holds
  at least one number", "there is at least one chunk", "the output is at least
  … long" — grids in every wording. What lands is **equality in the edge case**
  ("an empty tree has height zero"), not an inequality in general. When planning
  work, count the edges as provable, not the bounds.
- **Idempotence.** «А и А равно А», «А или А равно А» — grids in both forms: a
  guard equating two variables corresponds to nothing in the body.
- **A bound that is an expression rather than a term.** Composition through the
  callee's claim works as long as the bound is a simple term over an argument
  (`длина словарь`). A bound of the shape `длина (отфильтровать …)` is taken
  neither through «равен» nor through «не больше».
- **Remainder bounds on an argument of type `число`.** `результат меньше 65536`
  with a body of `… остаток от 65536` is not taken: the kernel's rule bounds a
  remainder only of something known to be a non-negative integer, and `число`
  does not promise that. The fix is not in the claim but in the signature — type
  `нат` or a `требует` condition.

## An example will not close a "declared" claim

A claim with the status `объявлено, не доказано` is one that has neither a
theorem nor examples, and only the runtime checks it, on real inputs. You can add
an example to it, but **that moves it into `сетка` and does not move `доказано`
by a single unit**. Measured on `sqlite.flang`: of forty-two "declared" claims,
three were closed by proof across three runs — and not by examples, but by
restating the claim in the quantities for which the callee already has a proved
claim.

What is more, `объявлено` is more honest than `сетка`: the runtime checks it
against everything that passes through the function, while a grid checks a finite
set the author picked. Do not spend runs converting one into the other.

## An empty claim is not a proof

A claim that holds for any body of the function checks nothing. The test is
simple: mentally replace the body with a stub. If the claim still holds, it is
decoration — and its proved status inflates the proof report.

The same goes for gains: **a gain is growth in `доказано`, not growth in
`утверждений`.** Splitting always grows the denominator. If `доказано` did not
grow after an edit, the edit gets reverted.

## The working order that pays off

1. Take a baseline with `flang check <file> --proof` and write the proof report
   line down verbatim.
2. Go through forms 1 and 2 — they are the cheapest and give the most.
3. Split conjunctions in conclusions, with one probe before each split.
4. Whatever is left: look for the broken link (form 6).
5. Take the final measurement with the same run and compare against the baseline
   line by line.

Large files do not fit inside the default step limit: `aes.flang` with its
hundred and thirty claims eats a billion steps and dies with
`FLANG_RECURSION_LIMIT` without printing a proof report at all. That is not the file
being broken — it is the limit, and it is raised with `--предел-шагов`.

A caveat measured on 23 August: the flag is in the sources
(`flang/self/cli.flang`), but **it may be missing from the built program** — the
printed seed lags behind the sources until someone runs `sh scripts/raskrutka.sh`.
If `flang check` answers "непонятный ключ", your binary is older than this page,
and the limit is baked into it as a number (`FL_MAX_STEPS` in
`bootstrap/flang_runtime.h`). The recipe for building a binary with a raised
ceiling is in the header of `scripts/raskrutka.sh`.

And bear in mind that every claim you add makes the run more expensive: the cost
of checking grows faster than the number of claims. Our own compiler is the
measure of that. Reprinting the seed with 5854 claims in the compiler's sources
takes about two hours and up to 100 GiB; the same reprint with the claims
stripped out takes 19 minutes 45 seconds and 23 GiB. Six times the time and four
times the memory — that is the price of the compiler checking its own
postconditions while it prints itself.
