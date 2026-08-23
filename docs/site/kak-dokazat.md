# Which postconditions the kernel accepts

The neighbouring page, [The kernel refused](proof-refused.html), covers the case
where the check shouts a code at you. This one covers the quieter and more
annoying case: no diagnostics, exit code zero, and the ledger says `сетка` — a
grid. The postcondition is written, it was checked on a finite set of values,
and it is **not proved**.

Below are seven ways of writing a claim. For each one a run tells us whether the
kernel takes it. The numbers in brackets were measured on 23 August 2026 against
the standard library; they are not estimates.

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

**It works only when the guard is itself a comparison.** A guard that is a call —
`если («Серийный номер отозван» от номер и список) то …` — stays a grid: the
kernel knows nothing about someone else's predicate. A **comparison with a call
inside it**, however, does work: `если («Бит разрядов» от у и номер) равен 0 то …
иначе да` is proved, and so is a conjunction of two such comparisons.

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

## 3. Split a conjunction in the conclusion into parts

`обеспечивает «имя» (А и притом Б и притом В)` is something the kernel either
takes whole or does not take at all. Three separate claims it works through one
by one, and some of them usually land.

Measured: in `sha256.flang` the sixteen-member claim on "Сдвинуть расписание"
became sixteen claims, and **all sixteen were proved by induction**; the file
went 26 → 40. `json.flang` 19 → 31 and `http.flang` 15 → 26 by the same move.

**A conjunction in the GUARD must not be split.** `если А и притом Б то В` and
`если А то В` are different claims, and the second is stronger: you did not
rewrite the claim, you strengthened it. In `lists.flang` all nine compound
claims are guards — there is nothing to split there at all.

## 4. One probe predicts the outcome of a split

Before cutting a claim into ten parts, break off **one** and run it.

- The broken-off half was proved → the rest will pay off too.
- It stayed a grid → what blocks the kernel is not the conjunction; stop
  spending time here.

The sign is visible without a probe if someone has already worked in the file:
"Сдвинуть расписание" had two halves standing separately and proved — splitting
the rest gave +14. "Раунд" had halves standing separately and still grids —
splitting the rest gave zero. Measured across eleven splits in `hashmap.flang`
and `sha256.flang`: the denominator grew, not one verdict changed, all reverted.

## 5. If a form does not land, try its twin — it is cheap

```flang
если (А) то (Б) иначе да
не (А) или (Б)
```

The same thing in meaning; the kernel sometimes takes the second where it will
not take the first. A run costs a minute, so trying both is a rule, not a trick.
Do not expect much, though: across thirteen grid claims in `der.flang` and
`x509.flang`, changing the form moved **not a single one**.

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

## 7. A "по свойству" theorem lands only on a bare call

If the body is a single call and the callee's postcondition matches the goal
character for character, a one-step theorem goes through. If a `пусть х равно …`
stands before the call, the kernel does not look past the binding:

```
FLANG_PROOF_STEP: к этому месту не известно ничего, кроме гипотез «дано»
```

And remember: **a failed theorem takes the whole file's check down with it** —
the ledger is not printed and you are left with no numbers at all. Edit one at a
time.

## What the kernel takes in no wording at all

Measured, not assumed — do not spend time on these forms until new rules appear:

- **Folds.** Anything standing on a list fold stays a grid: «Хеш строки», «В
  верхний регистр», «Обратить строку», «Ключи дерева». The kernel does not
  unroll a fold, and the wording of the claim has nothing to do with it.
- **Recursion over your own type.** «Положить в дерево», «Найти в дереве»,
  «Уравновесить». The branches of such a body are not boolean but a `разбор`
  over variants; you need a `разбор` inside the claim itself plus a theorem by
  induction.
- **The reverse direction of an equivalence.** Where `результат → А` landed,
  `А → результат` almost never does: to derive a positive answer the kernel has
  to unroll the whole body, not pick a conjunct off it.
- **Higher-order functions.** The kernel knows nothing about a function passed
  in, so a claim about its result is unprovable in principle. What is provable
  sits next to it: lengths, preservation of element counts, index bounds.
- **Remainder bounds on an argument of type `число`.** `результат меньше 65536`
  with a body of `… остаток от 65536` is not taken: the kernel's rule bounds a
  remainder only of something known to be a non-negative integer, and `число`
  does not promise that. The fix is not in the claim but in the signature — type
  `нат` or a `требует` condition.

## An empty claim is not a proof

A claim that holds for any body of the function checks nothing. The test is
simple: mentally replace the body with a stub. If the claim still holds, it is
decoration — and its proved status inflates the ledger.

The same goes for gains: **a gain is growth in `доказано`, not growth in
`утверждений`.** Splitting always grows the denominator. If `доказано` did not
grow after an edit, the edit gets reverted.

## The working order that pays off

1. Take a baseline with `flang check <file> --proof` and write the ledger line
   down verbatim.
2. Go through forms 1 and 2 — they are the cheapest and give the most.
3. Split conjunctions in conclusions, with one probe before each split.
4. Whatever is left: look for the broken link (form 6).
5. Take the final measurement with the same run and compare against the baseline
   line by line.

Large files do not fit inside the default step limit: `aes.flang` with its
hundred and thirty claims eats a billion steps and dies with
`FLANG_RECURSION_LIMIT` without printing a ledger. That is not the file being
broken — raise the limit with `--предел-шагов`. And bear in mind that every
claim you add makes the run more expensive: the cost of checking grows faster
than the number of claims.
