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

**How many levels will land is not a constant, and only a run tells you.** Four
independent measurements in one evening gave four different numbers:
`sqlite.flang` — four levels, the fifth no; `http.flang` with guards `код равен
N` — four, and with conjunction guards `код не меньше A и притом код не больше
B` — two; `образцы.flang` — three where the guards are not numeric and two where
they are; `datetime.flang` — two. What they share: **the more arithmetic the
guard, the sooner the kernel loses the goal split.** Do not plan by a number —
break off a probe.

**Within those four, what blocks it is not the depth but a numeric guard.** The measurements
disagreed and reconciled only this way: in `образцы.flang` all three nesting
levels of «Совпало с места» landed, because its guards are not numeric; in the
same file the third level of «Точка вниз» (`точка равен 1025`) stayed a grid. In
`http.flang` the same: the second level was proved, the ninth and twenty-first
were not — and all of those are about numeric codes. The level itself is not the
obstacle; a chain of numeric comparisons is, and there the kernel loses the goal
split.

**Mirroring nested `если` is worth trying but does not always work — measure.**
Two runs on the same day disagreed, and both are honest. In `wire.flang` the
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

**A call-as-guard: four measurements, and they disagree — read them, not a rule.**
This line of the page had to be corrected three times in one evening, because
each time it was generalised from a single file. Here are all the measurements as
they came:

| where | how it was written | outcome |
|---|---|---|
| `emit-python.flang`, `emit-csharp.flang` | `если («Это строка Python» от узел) то …` — a bare call copied from the body | **proved**, and so were a dozen more edits |
| the same files | the same call wrapped: `если («Это строка») равен да то …` | not taken |
| `datetime.flang` | `если («Високосный год» от год) то …` at the **second level**, under `если месяц равен 2` | **proved** |
| `crl.flang` | `если («Серийный номер отозван» от номер и список) то …` at the top level | grid, and in the mirrored form too |
| `rsa.flang` | `если («Бит разрядов» от у и номер) равен 0 то …` — a comparison with a call inside | **proved** |

What follows reliably: **the `равен да` wrapper breaks what works without it**,
and **the guard must be copied from the body verbatim**. Why `crl` diverged from
`emit-python` on an outwardly identical wording is not established. Measure; do
not go by the rule.

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
splitting can take a proof away rather than add one: in `wire.flang` the claim
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

**This used to read "the fold side is closed". That is wrong, and it was refuted
by a run on 26 August 2026.** Lifting a postcondition through a fold **is** in
the kernel and works in the compiler as printed today — the rule is called
«Принцип свёртки» (`flang/self/proof-initial.flang`):

```
P(И, пусто) ∧ (for all а, п, э: P(а, п) ⟹ P(Т, п ++ [э]))  ⟹  P(свёртка Л …, Л)
```

The evidence sat inside the memory allocator itself: the folding function
«Пройти вставку» had its postcondition standing **proven by induction** before
any edit.

**The principle is read under two conditions, and what obstructs is not the
conditions but two ways of writing the body:**

1. the fold must stand at the TOP level of the body — `(свёртка …).«поле»` does
   not qualify; a fold under a projection computes something other than what the
   goal talks about;
2. the fold must run over the ARGUMENT'S NAME exactly — `свёртка куча.«свободные»`
   does not qualify; the scrutinee must be a parameter name.

Both shapes are removed by editing the **program**, not the kernel, and both were
removed. Measured on another binary, without reprinting the seed:

| file | before | after |
|---|---|---|
| `examples/driver/msi/msi.flang` | proven 86, declared 5 | proven 90 (2 by induction), declared 4 |
| `examples/allocator/allocator.flang` | proven 79 (1 by induction), declared 3 | proven 82 (3 by induction), declared 1 |

Across both programs `declared, not proven` went from 8 to 5, and all three that
moved are about folds. The iteration needs its **own** step claim, without a
guard: that the accumulator grows by exactly one whichever branch the step takes.
Guarded halves that suit the step do not suit the iteration — the iteration knows
nothing of the step's branches.

What stays true from the old wording: **the step level is fully open**, and
lifting the step out of the lambda remains the cheapest technique. «Шаг обрезки
слева» is proved four times over and «Обрезать слева» did not move — but it is
now known that the cause is the shape of the body, not a wall.

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
`registry.flang`: the body of «Разобрать диапазон» starts with `пусть чистый равно
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

## 9. A variant's field is read in a claim with a dot — if there is one variant

If a sum type has exactly one variant with fields, the field is read in the
postcondition with a dot and no guillemets: `ход.найдено`. This opens up
functions about which there was otherwise nothing to say at all — their whole
meaning sits in the fields of the record they return.

Measured on `образцы.flang`: the trick opened **four functions** that had not a
single claim before it, and made up part of the 15 → 36 gain in proven claims.

⛔ **With more than one variant the field is not read this way** — the access
does not type-check. There something else works: equality to a variant, trick 10.

## 10. Equality to a variant splits a goal across `разбор` branches

The kernel does not split a `разбор` body across branches by itself. But a guard
comparing the scrutinee to a variant does split it:

```
обеспечивает «пока ничего не пришло, отклик пуст»
  если отклик равен (вариант «Пока ничего») то (результат равен "") иначе да
```

Found independently by **four** agents in one day — on `optional.flang`
(2 of 12 → 7 of 14), on `wire.flang` and `redis.flang` (+27 together), on
`образцы.flang`, and on `result.flang` (10 of 13 → **15 of 15**, no grid left).

**A variant WITH FIELDS lands too.** The tree used to record fields as
insurmountable: "there is nothing to bind the field names to in the claim".
There is no need to bind them — the field is recovered by an accessor on the
scrutinee itself:

```flang
обеспечивает «у узла-списка полей нет»
  если «узел» равен (вариант «Значение списка» с «элементы» равным («Элементы узла в монаде» от «узел»))
    то результат равен пустой список иначе да        → PROVEN
```

A nullary function returning a variant works as well — `если «узел» равен
(«Узел ничто в монаде»)`: the kernel unfolds the flat definition right inside the
guard.

**This used to read "26 out of 26", and an opposite measurement stood beside it —
six probes, all declared. Re-measured 26 August 2026 with a single binary**
(`/srv/flang-rabota/w-predely/bootstrap/flang`), claim by claim, across both
files:

| file | guard: equality to a variant | proven |
|---|---|---|
| `monad-expand.flang` | with fields | **17 of 17** |
| `monad-expand.flang` | without fields | 5 of 6 |
| `monad-expand.flang` | to a nullary call | 3 of 3 |
| `bounded.flang` | with fields | **6 of 6** |
| `bounded.flang` | without fields | 7 of 10 |
| `bounded.flang` | to a nullary call | 2 of 2 |

Form 10 across these two files: **40 of 44**. The old "17 of 17 in
`monad-expand`" matches exactly; the old "9 of 9 in `bounded`" cannot be checked
today — the file now holds six such claims and all six are proven, but the lines
the nine were counted from are no longer in the text.

**The point of this measurement is not the numbers but where the four failures
sit: all four are on a variant WITHOUT fields.** Fields obstruct nothing. What
obstructs them is described below and in form 13: three have a bare predicate
goal (`не (результат.«есть»)`, `не ((…«беда») равен "")`), and the fourth has a
second claim under `иначе` instead of `да`. A pair differing in exactly that
already sits in the tree — one function, one guard, in `monad-expand.flang`:

```
если «может» равен (вариант «Отказа нет») то результат равен нет иначе результат равен да  declared
если «может» равен (вариант «Отказа нет») то результат равен нет иначе да                  PROVEN
```

**What does not land is what cannot be written.** A guard naming a variant with
fields and giving the field no term is not "declared" — it is a parse-time
refusal: the file is not checked at all and has no proof report for any claim.

```
если «груз» равен (вариант «Есть») то …
FLANG_TYPE, column 78: constructor «Есть» requires field «вес» (число)
```

**The scrutinee may be an EXPRESSION, not only a variable** — the guide did not
say so; measured on `totality.flang` across six functions:

```
если («Число литерала» от («Взять поле» от «узел» и "right")) равен (вариант «Нет числа») то …
```

It works even where the branch is folded into `случай любое`. For `разбор` over
a LIST (`случай пусто` / `случай голова и хвост`) there is no rule — see the
section below.

**⚠ On the process scheduler only the NULLARY half landed — but that turned out
not to be a rule; see the run below.** Measured
24 August 2026 on the process scheduler (`flang/self/conc.flang`) and on a small
probe module next to it, for bodies shaped
`разбор («Найти процесс» от («прогон».«процессы») и «имя»)`:

| guard | verdict |
|---|---|
| `если (…«Найти процесс»…) равен (вариант «Нет процесса») то Ц иначе да` | **proven** |
| `если не ((…) равен (вариант «Нет процесса»)) то Ц иначе да` | not taken |
| `если (…) равен (вариант «Есть процесс» с «процесс» равным («Процесс найденного» от (…))) то Ц иначе да` | not taken |

An accessor for the payload was written, so the variant **can** be recovered by
a term — and it still is not taken. This used to continue: "the difference from
the measurements above is that there the scrutinee was the ARGUMENT ITSELF, here
it is the result of a call; which of the two differences decides is not known."
**The scrutinee has nothing to do with it, and that was settled by a run on
26 August 2026** with the same binary. The probe is
`examples/proof-probes/variant-with-fields.flang`: one module, one sum with
fields, one thought written twenty-three ways, exactly one thing changed per pair.

| what changes in the wording | verdict |
|---|---|
| scrutinee is the **argument**: `если «груз» равен (вариант «Есть» с «вес» равным («Вес груза» от «груз»)) то Ц иначе да` | **proven** |
| scrutinee is a **call result**: `если («Первый груз» от «грузы») равен (вариант «Есть» с «вес» равным («Вес груза» от («Первый груз» от «грузы»))) то Ц иначе да` | **proven** |
| guard **negated**, argument: `если не («груз» равен (вариант «Пусто»)) то Ц иначе да` | **proven** |
| guard **negated**, call: `если не ((«Первый груз» от «грузы») равен (вариант «Пусто»)) то Ц иначе да` | **proven** |
| field given a **literal** instead of an accessor: `… (вариант «Есть» с «вес» равным 7) то результат равен 7 иначе да` | **proven** |
| branch **calls a function with arguments**, goal written as that same call | **proven** |
| branch calls, goal **expanded** to `(длина результат) равен ((длина «числа») плюс 1)` | **proven** |
| a **second claim** under `иначе`: `… иначе результат равен 0` | **not taken** |
| goal is a **bare predicate** under negation: `… то не результат иначе да` | **not taken** |

The full report line: `утверждений 23: доказано 21 (из них индукцией 1) (из них
без теоремы 20), сетка 0, объявлено, не доказано 2`.

Only the last two rows move the verdict, and neither is about the scrutinee.
**Neither argument-versus-call, nor a negated guard, nor a literal field, nor a
calling branch takes a proof away by itself.** Why the same two guards still
failed on `conc.flang` could not be reproduced in a small probe: the same shape
in the small is proven whole. So the scheduler's cause is its own and remains
unnamed — but it is **not** that the scrutinee is a call, and not that the
variant has fields.

**The rule about calling branches stood here, and it is wider than the
measurement.** It read: "the branch lands only if its body is a TERM, not a call
with arguments… even when the callee's own postcondition is proven." On
`conc.flang` that is what happened — four branches calling `«Нет такого вида»`,
`«Переполнил»`, `«Поставить таймер»`, `«Запись как узел»` did not land. But it is
not a rule: in the probe above a calling branch was proven twice, including where
the goal reduces only through the callee's postcondition. Read it as a
measurement on `conc.flang`, not as a prohibition.

**And only for an equality goal.** The same guards over a `не больше` goal gave
zero in four places: reflexivity `(длина Т) не больше (длина Т)` is not taken by
this binary.

**What to do.** Write the pair: the nullary half is proven, the complementary
half stays a runtime check. Together they are equivalent to the unguarded claim,
so replacing one claim with the pair weakens nothing. On `conc.flang` this landed
18 claims of the "does not change the number of processes" and "does not change
the name of the step" families whose body is a `разбор` over a call: the file's
own share went 101 → 123 proven across 186 → 200 claims.

⛔ **Careful: this guard can drive the whole check into divergence.** If the
variant in the guard is filled by a PROJECTION OF ITS OWN argument — `если узел
равен (вариант «Значение скаляра» с «скаляр» равным («Скаляр значения» от
узел))` — and the branch calls a function reading the same argument through the
same projection, the run goes into

```
FLANG_RECURSION_LIMIT: функция «Шаг нормализации» превысила предел глубины
вызовов (20000) на глубине 20001
FLANG_CLI: ядро доказательства прекращено
```

**No proof report is printed then for ANY claim in the file, and the culprit is not
named in the refusal** — on `factcheck.flang` all 160 vanished silently. Catch
it with a cheap `check` without `--proof` (seconds against a minute) and by
halving the list of edits.

## 11. Split the goal by comparison outcomes instead of hiding them under a guard

A compound claim under the guard "both arguments are positive" does not land:
the kernel splits a goal by the condition of the BODY, and the guard's condition
is a different one. The same thought, written as three disjunctions over the
outcomes of the comparison, lands whole and **without a theorem**:

```
(не (первое меньше второе)) или <the point>
(не (первое больше второе)) или <the point>
(не (первое равен второе))  или <the point>
```

The three together are **stronger** than the single claim they replace: it now
holds for any comparable arguments, not only positive ones. Measured on
`higher-order.flang`: this landed what no wording of the guard could.

## 3-bis. Mirroring an inequality helps in the CONCLUSION and hurts in the GUARD

The rule "turn inequalities to the `не больше` side" holds for the conclusion.
**For a guard copied from the body it takes the proof away.** Measured on
`bounded.flang`, three consecutive runs: 61 → 60 → 62 proven.

```
если (длина «собрано») не меньше («Предел сетки») то … иначе да   PROVEN
если («Предел сетки») не больше (длина «собрано») то … иначе да   declared
```

The statement is the same on every input, `не число` included. What differs is
the trees: a guard must match the body's condition **sign for sign**, not by
meaning.

Hence the order: first copy the guard from the body verbatim, and only if that
fails try the mirror — on the conclusion, not on the guard.

## 12. The wording of a guard is not a rule — it is two different runs

There is advice going around: "write the guard as a disjunction `(не A) или B`
instead of `если A то B иначе да`". **It is not a rule**, and here are the
numbers from both sides:

| share | what the rewrite gave |
|---|---|
| `result.flang` | 10 → 15 proven, the entire jump |
| `higher-order.flang` + `hashmap.flang` | **zero** (22 of 45 and 15 of 40 unchanged), 8 places |
| `sha256` + `hmac` + `sha1` | **zero**, 9 places |
| `x25519` | **zero**, 4 places |
| `образцы.flang` | on some goals only the conditional lands, on others both |

Both wordings have the same `goal.kind` — `if` — so for the kernel they are one
tree. What decides is not the form but the **completeness of the path**: the
conditions of every enclosing `если` must appear in the guard. Measured on
`base64.flang`, four wordings of ONE claim:

```
если (код 97…122) то (результат равен (код минус 71)) иначе да        grid
не (код 97…122) или (результат равен (код минус 71))                  grid
если не (код 65…90) то (если (код 97…122) то … иначе да) иначе да  PROVEN
(код 65…90) или ((не (код 97…122)) или (… равен (код минус 71)))   PROVEN
```

Both upper wordings are path-incomplete, both lower ones are complete. Run both
forms — they are two different runs, not one and the same.

## 13. A bare predicate goal is not a goal kind — append `равен да`

A claim whose goal is just a call to a predicate function is never taken by the
kernel:

```
обеспечивает «результат — запись» («Это запись» от результат)          declared
обеспечивает «результат — запись» («Это запись» от результат) равен да  PROVEN
```

Measured on `hotswap.flang`: a single such rewrite closed three claims.

⛔ **The converse also happens**, measured on `wire.flang`: where the bare form
does land, appending `равен да` can break it. The forms are **not**
interchangeable — run both, same as with guard wording (trick 12).

## A closed goal is computed whole, with any comparison sign

Before hunting for a goal kind: **if no free name is left in the goal, the kernel
simply computes it** — and the comparison sign does not matter. The rule is named
`«Вычислить замкнутую»` in the kernel, with the reasoning: "a closed goal has ONE
value, and computing it is cheaper than splitting in two and reducing both
halves".

Hence an important correction, measured on `totality.flang`: the common claim
that "the kernel does not take strict inequalities (`меньше`, `больше`) at all"
is **wrong**.

```
обеспечивает «пульс по умолчанию положителен» результат больше 0     PROVEN
```

The kernel answers verbatim: "доказано вычислением замкнутой цели: свободных имён
в ней не осталось, значит значение у неё одно, и вычисление отвечает про него
целиком".

**The correct wording: a strict inequality is unprovable only where free names
remain in the goal.** For a function without arguments, for a constant, for a
default value — it lands.

## The kernel's refusal does NOT name what it lacked

Another correction from the same measurement. For an unproven claim **without a
theorem**, the proof report carries one and the same text regardless of the cause:

```
объявлено, не доказано: ни теоремы, ни примеров. Его считает рантайм после
каждого возврата — на тех входах, которые придут
```

All 44 unproven claims of `totality.flang` carry exactly this line. **A named
refusal listing the goal kinds arrives only for a theorem you WROTE.** So to find
out what is missing you have to write a theorem on purpose, as a probe, knowing
in advance it will most likely not close.

## What the kernel takes in no wording at all

Measured, not assumed — do not spend time on these forms until new rules appear:

- **Folds — but only in two ways of writing the body.** This used to say the
  folding function's postcondition is never lifted. That is refuted: the lifting
  is in the kernel («Принцип свёртки») and works in the compiler as printed
  today. What is closed is a **fold under a projection** (`(свёртка …).«поле»`)
  and a **fold over a field of the argument** (`свёртка куча.«свободные»`); both
  are removed by editing the program. Details and numbers are in form 7.
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
- **A fold over an empty list — not taken by today's binary, but the kernel
  already has the rule.** The kernel source carries a rewrite: the term
  `свёртка Л начиная с О как а и э → тело` under a known emptiness of `Л` is
  replaced by the term `О`. It reads emptiness from two sources and only those —
  an empty list written out in the text, and the assumption `(длина Л) равен 0`;
  neither `не больше 0` nor `пусто Л` triggers it. **The rule did not make it
  into the printed seed and will arrive with the next reprint**
  (`sh scripts/raskrutka.sh`); until then the verdict is the old one. A probe of
  two claims in exactly this shape, run 26 August 2026 on
  `/srv/flang-rabota/w-predely/bootstrap/flang`:
  `утверждений 2: доказано 0, сетка 0, объявлено, не доказано 2`.

  ⚠ **What that probe proves and what it does not.** The kernel's refusal does
  not name what it lacked (see the section below) — the text is the same for
  every cause. So "0 of 2" yields exactly one thing: **on this binary, in this
  wording**, it is not taken. What will be taken after the reprint is checked
  after the reprint, and not before.

- **`элемент N в списке` — taken by the way the list is built, but until recently
  not on a list written out.** The common "the kernel does not read `элемент N`
  at all" is wrong: the rewrite exists and reads three equalities —
  `элемент 1 в (приписать Г к Х)` is `Г`;
  `элемент К в (приписать Г к Х)` is `элемент (К минус 1) в Х` for a literal `К`
  of at least two;
  `элемент ((длина Х) плюс 1) в (добавить Э к Х)` is `Э`.
  None of the three reads a **written-out** list `[а, б]` — which is exactly what
  stands in the programs. A fourth equality, `элемент К в [Э₁, …, Эн]` is `Эк`
  for a literal `К` within bounds, was added on 26 August 2026; measured by
  calling the rule directly on eight inputs, before and after:

  | input | before | after |
  |---|---|---|
  | `элемент 1 в [а, б]` | untouched | **`а`** |
  | `элемент 2 в [а, б]` | untouched | **`б`** |
  | `элемент 3 в [а, б]` (past the end) | untouched | untouched |
  | `элемент 0 в [а, б]` (before the start) | untouched | untouched |
  | `элемент н в [а, б]` (index by name) | untouched | untouched |
  | `элемент 2 в (приписать г к [а, б])` | `элемент 1 в [а, б]` | **`а`** |
  | `элемент 1 в (отбор над [а, б])` | untouched | untouched |
  | `элемент (1 плюс 1) в [а, б]` | untouched | **`б`** |

  **None of this is in the printed seed** — it arrives with the reprint. And one
  caveat that saves a day: an index given by name over a written-out list is not
  taken and will not be — the rewrite does not see assumptions, and its bounds
  are computed from two known numbers. In `flang/stdlib` there are sixteen places
  of the form `элемент … в [ … ]`, and **in all sixteen the index is a name**;
  literal ones: zero.

  ⚠ **A wording trap.** List positions count **from one**: `элемент 0 в х` does
  not give the head, it stops evaluation with `FLANG_BUILTIN_ARGS`.
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
- **Strict inequalities — as of 25 August they are a goal kind.** Rule 11,
  "strict order by construction", was added to the kernel: there are now **nine**
  kinds of goal, and all nine are named in its own refusal
  (`flang/self/proof-kernel.flang`, «Отказ без правила»): «не меньше 0», «не
  больше конечного литерала», «не больше терма», **«меньше терма»**,
  **«больше терма»**, «равно», «содержит», «не убывает», «начинается с».

  **The printed seed does not carry the rule yet** — it arrives with the next
  reprint. Until then a strict inequality over a term is only provable as a
  closed goal.

  Two wordings that suggest themselves and are FALSE — measured by a run, not
  guessed:

  ```
  (минус ноль) не больше 0  → yes       9007199254740992 не больше (…плюс 1) → yes
  (минус ноль) равен 0      → no        9007199254740992 меньше   (…плюс 1) → no
  (минус ноль) меньше 0     → no
  ```

  The first kills the decomposition "`a меньше b` = `a не больше b` AND
  `не (a равен b)`": at minus zero the left side holds and "меньше" does not.
  The second kills "add one": rounding to nearest eats it.

  Both claims of «Целая часть» still stay grids, but for a different reason: the
  upper side there is a finite literal, which is a goal kind of its own.
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
  `неотрицательное` or a `требует` condition.

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
simple: replace the body with a stub of the same signature and take the proof report
again. If the claim is still proven, it is decoration — and its proved status
inflates the proof report.

**One stub is NOT ENOUGH, and this has been measured twice.** You need two — a
zero one (`0`, `""`, `нет`, empty list, the bottom of a sum) and one with
non-zero fields (`1`, `"я"`, `да`, `["я"]`) — and **they cut both ways**:

- on `factcheck.flang`, 13 of 39 newly proven claims **survived one stub and
  fell only on the other**. Eleven of them survived `да` and fell on `нет` —
  a whole family of claims shaped `… то результат равен да иначе да`; two the
  other way round. With a single stub of either flavour, a third of the gain
  would have been declared empty;
- on `base64.flang` and `utf8.flang`, 13 claims survived the canonical zero stub
  and fell only on the non-zero one — because the examples of those very
  functions start from zeros, so a `0` stub is indistinguishable from the real
  body there.

**In a pair of trick-10 claims EACH half is empty on its own — only the pair
pins the function down.** Measured on `«Это список в монаде»`, body `разбор «узел»`:

| stub | "a list node is called a list" | "a record node is not called a list" |
|---|---|---|
| `нет` | meaningful | **empty** |
| `да` | **empty** | meaningful |

Each half holds under a suitable stub; the function is held by both together.
Hence the gap in the counts: on one share 16 were empty by the canonical stub and
**another 15** are caught only by the mirrored one.

**Stub one function at a time, or one group of unrelated ones — never all at
once.** Having stubbed every body at once, an agent got a false "empty": the
goal contained a call to a neighbouring function, and the stubbed call matched
the stubbed result. Groups are computed as the transitive closure of mentions.

**The price, stated out loud.** If a proof rests on a theorem that refers `по
свойству` to a call, the stub removes that call, the theorem stops closing, and
the stubbed file is rejected ENTIRELY — there is nothing left to judge, the
verdict becomes "не судили". Then the substitution is done together with
removing that theorem, and the departure from the usual order goes into the
report rather than being hidden.

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
