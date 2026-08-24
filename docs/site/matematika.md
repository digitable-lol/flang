# Coq and Lean classics: what our kernel actually proves

This page is not a survey of Coq and not a retelling of Mathlib. It is a
**measurement**: forty-seven classical lemmas, copied verbatim from the Coq and
Lean sources, rewritten in flang as real functions with postconditions, and run
through our kernel. Every lemma carries a verdict taken from a run, and every
unproved one carries a named reason.

A negative result is worth more here than a positive one. A page saying "47 out
of 47 proved" would be refuted by the reader's first run, and after that nothing
else on this site would be believed.

## The bottom line

```
flang/stdlib/math-classics.flang
  утверждений 44: доказано 17 (из них без теоремы 17, объявленным типом 4), сетка 27

flang/stdlib/math-classics-lists.flang
  утверждений 29: доказано 12 (из них без теоремы 12), сетка 17
```

That is **73 claims, 29 proved**. Of the forty-seven classical lemmas the kernel
takes **thirteen outright** and one more (`Nat.mod_bound_pos`) only when the
divisor is a literal; **thirty-three stay a grid**, and each one has a named
reason below.

There are no axioms in these files: the "taken on faith" column of both reports
is empty (`принято на веру: ничего`).

## Where the names come from

Every lemma name in the tables was found in a downloaded file, not recalled from
memory. Where nothing was found, the table has a dash.

| source | files read |
|---|---|
| `coq/coq`, tag `V8.19.2` | `theories/Init/Nat.v`, `theories/Init/Peano.v`, `theories/Arith/PeanoNat.v`, `theories/Arith/Compare_dec.v`, `theories/Lists/List.v`, `theories/Numbers/NatInt/{NZAdd,NZMul,NZOrder,NZBase,NZGcd,NZParity}.v`, `theories/Numbers/Natural/Abstract/{NAdd,NOrder,NParity}.v` |
| `leanprover/lean4`, `master` | `src/Init/Data/Nat/{Basic,Lemmas,Gcd}.lean`, `src/Init/Data/List/{Basic,Lemmas}.lean`, `src/Init/{Prelude,Core}.lean` |
| `leanprover-community/mathlib4`, `master` | `Mathlib/Data/Nat/Basic.lean`, `Mathlib/Data/List/Basic.lean`, `Mathlib/Data/Nat/GCD/Basic.lean`, `Mathlib/Algebra/Group/Nat/Even.lean` |

Two details that will save the reader time. First: on Coq's `master` the standard
library has moved to a separate repository (`rocq-prover/stdlib`), so
`coq/coq/master/theories/…` returns 404 today — the files above were taken at tag
`V8.19.2`. Second: `Mathlib/Data/Nat/Defs.lean` no longer exists; nearly all of
the `Nat` classics moved into the Lean 4 core (`src/Init/Data/Nat/…`), and only
the superstructure stayed in Mathlib.

## Reading a verdict

There are exactly four outcomes, and telling them apart is mandatory:

| verdict | meaning |
|---|---|
| **доказано** (proved) | the claim holds for **all** inputs |
| **доказано ПРИ УСЛОВИИ** (proved conditionally) | the conclusion holds, but it leans on a premise the kernel did not prove |
| **сетка** (grid) | checked on a finite set of values; nothing is known about the rest |
| **объявлено, не доказано** (declared) | written down and taken on trust; only the runtime checks it |

In these two files only two outcomes occurred: **proved** and **grid**.

## How `nat` was translated

In Coq and Lean every lemma below is stated over `nat` — an exact type with no
NaN, no infinities and no fractions. flang's `число` is IEEE-754, and over it half
of the classics are simply **false**:

```
5 не больше (5 плюс (0 минус 1))                    →  false
(9007199254740994 минус 1) плюс 1                   →  9007199254740992
(0 делить на 0) не больше (0 делить на 0)           →  false
```

So wherever they write `nat` we write `нат` — the exact range `[0, 2⁵³−1]`. This
is not cosmetics but a condition of an honest translation; the same argument is
recorded in `flang/test/fixtures/poddelka-order-arithmetic.flang`.

**A side measurement that cost one run.** In the compiler sources and in
`flang/SPEC.md` the same type is called `неотрицательное`, and
`flang/stdlib/strlists.flang` uses that name. The **printed binary** does not know
it: `flang check` on the stock `strlists.flang` answers `FLANG_UNKNOWN_NAME …
неизвестный тип «неотрицательное»`, while the kernel's own refusal texts call the
type `нат`. The binary lags the sources until the seed is reprinted; write `нат`.

## Table: arithmetic

File — `flang/stdlib/math-classics.flang`, 29 functions, 44 claims.

| lemma | Coq | Lean / Mathlib | ours | verdict |
|---|---|---|---|---|
| addition commutes | `Nat.add_comm` | `Nat.add_comm` | «Сумма» — «сложение переставимо» | **proved** |
| addition associates | `Nat.add_assoc` | `Nat.add_assoc` | «Сумма трёх» | grid |
| zero on the right | `Nat.add_0_r` | `Nat.add_zero` | «Прибавить ноль» | grid |
| zero on the left | `Nat.add_0_l` | `Nat.zero_add` | «Ноль слева» | grid |
| cancel a summand | `Nat.add_cancel_l` | `Nat.add_left_cancel` | «Сократить общее слагаемое» | grid |
| summand ≤ sum | `Nat.le_add_r` | `Nat.le_add_right` | «Сумма» — two claims | grid (both) |
| multiplication commutes | `Nat.mul_comm` | `Nat.mul_comm` | «Произведение» | **proved** |
| multiplication associates | `Nat.mul_assoc` | `Nat.mul_assoc` | «Произведение трёх» | grid |
| one on the right | `Nat.mul_1_r` | `Nat.mul_one` | «Умножить на единицу» | grid |
| one on the left | `Nat.mul_1_l` | `Nat.one_mul` | «Единица слева» | grid |
| zero absorbs | `Nat.mul_0_r` | `Nat.mul_zero` | «Умножить на ноль» | grid |
| distributivity, left | `Nat.mul_add_distr_l` | `Nat.left_distrib` | «Распределить слева» | grid |
| distributivity, right | `Nat.mul_add_distr_r` | `Nat.right_distrib` | «Распределить справа» | grid |
| subtract then add back | `Nat.sub_add` | `Nat.sub_add_cancel` | «Вычесть и прибавить обратно» | grid |
| order is reflexive | `Nat.le_refl` | `Nat.le_refl` | «Само себя» | **proved** (by declared type) |
| zero is least | `Nat.le_0_l` | `Nat.zero_le` | «Само себя» — second claim | **proved** (by declared type) |
| transitivity | `Nat.le_trans` | `Nat.le_trans` | «Через середину» | grid |
| antisymmetry | `Nat.le_antisymm` | `Nat.le_antisymm` | «Зажатое между» | grid |
| trichotomy | `Nat.lt_trichotomy` | `Nat.lt_trichotomy` | «Сравнить» | **proved** |
| order is total | `Nat.le_ge_cases` | `Nat.le_total` | «Два сравнимы» | grid |
| min by the left | `Nat.min_l` / `Nat.min_r` | — | «Меньшее из двух» — two claims | **proved** (both) |
| max by the left | `Nat.max_l` / `Nat.max_r` | — | «Большее из двух» — two claims | **proved** (both) |
| division with remainder | `Nat.div_mod_eq` | `Nat.div_add_mod` | «Частное» | grid |
| remainder below divisor | `Nat.mod_bound_pos` | `Nat.mod_lt` | «Остаток» (divisor is a term) | grid (both bounds) |
| same, divisor a literal | `Nat.mod_bound_pos` | `Nat.mod_lt` | «Остаток по десяти» | **proved** (both bounds, by declared type) |
| definition of divisibility | `Nat.divide` | `Nat.dvd_iff_mod_eq_zero` | «Делит» | **proved** |
| gcd with zero | — | `Nat.gcd_zero_right` | «НОД по Евклиду» | **proved** |
| gcd commutes | `Nat.gcd_comm` | `Nat.gcd_comm` | «НОД по Евклиду» | grid |
| gcd divides the first | `Nat.gcd_divide_l` | `Nat.gcd_dvd_left` | «НОД по Евклиду» | grid |
| gcd divides the second | `Nat.gcd_divide_r` | `Nat.gcd_dvd_right` | «НОД по Евклиду» | grid |
| evenness is a zero remainder | `Nat.even_spec` | `Nat.even_iff` | «Чётно» | **proved** |
| even or odd | `Nat.Even_or_Odd` | `Nat.mod_two_eq_zero_or_one` | «Остаток по два» | grid |
| even plus even | `Nat.even_add` | `Nat.even_add` | «Сумма чётных» | grid |
| even times anything | `Nat.even_mul` | `Nat.even_mul` | «Произведение с чётным» | grid |

Trichotomy is split in the file into three branches — all three are **proved**,
and that split added three to the proved count.

## Table: lists

File — `flang/stdlib/math-classics-lists.flang`, 20 functions, 29 claims. The
number in brackets is the line in `theories/Lists/List.v` at tag `V8.19.2`.

| lemma | Coq | Lean / Mathlib | ours | verdict |
|---|---|---|---|---|
| length of append | `List.app_length` (225) | `List.length_append` | «Склеить» | **proved** |
| append nil on the right | `List.app_nil_r` (139) | `List.append_nil` | «Склеить с пустым справа» | grid |
| append nil on the left | `List.app_nil_l` (134) | `List.nil_append` | «Склеить с пустым слева» | grid (weakened to length — **proved**) |
| append associates | `List.app_assoc` (151) | `List.append_assoc` | «Склеить три» | grid |
| length of reverse | `List.rev_length` (1002) | `List.length_reverse` | «Обратить» | **proved** |
| reverse of reverse | `List.rev_involutive` (953) | `List.reverse_reverse`, Mathlib `List.reverse_involutive` | «Обратить дважды» | grid |
| reverse of append | `List.rev_app_distr` (941) | `List.reverse_append` | «Обратить склейку» | grid |
| length of map | `List.map_length` (1139) | `List.length_map` | «Отобразить» | **proved** |
| map over append | `List.map_app` (1164) | `List.map_append` | «Отобразить склейку» | grid |
| map after map | `List.map_map` (1295) | `List.map_map` | «Отобразить дважды» | grid |
| foldl over append | `List.fold_left_app` (1360) | `List.foldl_append` | «Свернуть слева склейку» | grid |
| foldr over append | `List.fold_right_app` (1392) | `List.foldr_append` | «Свернуть справа склейку» | grid |
| membership in append | `List.in_app_iff` (303) | `List.mem_append` | «Есть в склейке» | grid |
| nth element belongs | `List.nth_In` (447) | `List.getElem_mem` | «Элемент по номеру» | grid |

**Weakenings, said out loud.** For five claims where full list equality did not
go through, the same statement **about length only** stands next to it and is
proved. That is not a replacement for the lemma — it is strictly weaker, and the
verdict in the table above belongs to the full form, not to the weakened one.

**An asymmetry worth knowing, and not explained.** The weakening to length went
through for `List.app_nil_l` ("append nil on the LEFT does not change the length"
— proved) and did **not** go through for `List.app_nil_r` (grid). The two bodies
differ only in which side the empty list is on. Why one side passed and its
mirror did not is invisible from the refusal: for an unproved claim with no
theorem the kernel prints the same text regardless of cause.

## Why they do not go through: reasons by name

The thirty-three unproved lemmas fall into **seven** named reasons, and none of
them is "the kernel is weak in general".

### 1. Associativity and distributivity: the kernel matches SYNTACTICALLY

The kernel says so itself, verbatim:

> identity after rewriting by assumptions does not go through: after rewriting,
> the two sides of the equality remained different terms. The kernel matches
> syntactically and does not decide equalities of computations. The match does
> read `плюс` and `умножить` **up to the order of siblings** (swapping two
> operands of ONE node is an IEEE-754 theorem; swapping across parentheses is
> not allowed, associativity is false in IEEE-754, and the kernel does not do
> it).

Which is exactly what we measured: **commutativity goes through, associativity
does not**, for both addition and multiplication. That is not a gap but honesty:
over floats associativity really is false, and a rule that accepted it would be
proving a falsehood.

The same single rule explains `Nat.add_assoc`, `Nat.mul_assoc`,
`Nat.mul_add_distr_l`, `Nat.mul_add_distr_r` — four lemmas.

### 2. Neutral element and absorption: `а плюс 0` and `а` are different terms

`Nat.add_0_r`, `Nat.add_0_l`, `Nat.mul_1_r`, `Nat.mul_1_l`, `Nat.mul_0_r` — five
lemmas, all hitting the same syntactic match: substituting the body gives
`(а плюс 0) равен а`, and those are two different trees. The kernel has no rule
for folding a neutral element.

A measurement worth knowing: in the same file, "doubling is the sum with itself"
with body `х умножить на 2` is a **grid**, while "adding one is the sum with one"
with body `х плюс 1` is **proved**. The difference is only whether the goal tree
matched the body tree.

### 3. Inequalities over a term: the rule exists only against zero and by type

`Nat.le_add_r`, `Nat.le_trans`, `Nat.le_antisymm`, `Nat.le_ge_cases`,
`Nat.add_cancel_l`, `Nat.div_mod_eq`, `Nat.sub_add` — seven lemmas.

What **does** go through, and for free: `Nat.le_refl` and `Nat.le_0_l` — both
verdicts came back as "proved **by the declared types of the arguments**: the goal
was reduced by the rule 'order by construction'". The floor and ceiling that the
type `нат` supplies are read by the kernel; but chaining `а не больше б` and
`б не больше в` into a third fact it cannot do — its rewriting is single-goal.

**The boundary of the remainder rule was measured exactly, and this is the only
lemma with two verdicts in the table.** The kernel names its own rule verbatim:
the bound applies to "the remainder of a finite non-negative integer divided by a
non-zero integer **LITERAL**". The run confirms it letter for letter:

```
«Остаток», body `а остаток от б`, divisor a term:
  результат не больше (б минус 1)   — grid
  0 не больше результат             — grid

«Остаток по десяти», body `н остаток от 10`, divisor a literal:
  результат не больше 9   — PROVED, rule "boundedness by an exact ceiling by construction"
  0 не больше результат   — PROVED, rule "order by construction"
```

The dividing line is not the difficulty of the lemma but the shape of the divisor.

**The twin form does not help here either, and that too was measured.** For
`Nat.le_trans` and `Nat.le_antisymm` the file carries a twin written as
`не (А) или (Б)` (technique 6 of [Which postconditions the kernel
accepts](kak-dokazat.html)). Both forms stayed grids: the denominator grew by
two, the numerator by zero. So what blocks them is not the notation but a missing
rule.

`Nat.sub_add` is special, and the full story is in
`docs/site/kak-dokazat.ru.md`: over IEEE-754 the law is **false**, counterexample
`(9007199254740994 минус 1) плюс 1 = 9007199254740992`. Over `нат` it holds, but
the kernel has no rule separating the exact integer grid from the rest inside
subtraction, and per the note in `flang/self/proof-kernel.flang` it never will
("subtraction is not on this list and will not be").

### 4. Arithmetic of remainders: parity

`Nat.Even_or_Odd`, `Nat.even_add`, `Nat.even_mul` — three lemmas. All three ask
for reasoning about remainders mod two: "the remainder mod two is zero or one",
"the sum of two numbers with zero remainder has zero remainder". The kernel has
no rules of that kind — only bounds on the remainder (see reason 3), and only for
a literal divisor.

What **did** go through: `Nat.even_spec` — "evenness is a zero remainder mod
two", proved by "identity after rewriting by assumptions", because it is
literally the definition: the body is `(н остаток от 2) равен 0` and the goal is
the same tree.

### 5. Recursion by remainder: gcd

`Nat.gcd_comm`, `Nat.gcd_divide_l`, `Nat.gcd_divide_r` — three lemmas with one
cause: «НОД по Евклиду» is the **only non-total function** in either file. The
pair `(a, b)` does strictly decrease in the second argument, but the step is a
remainder rather than a constant difference, and flang's termination analysis does
not read such a step.

What **did** go through: `Nat.gcd_zero_right` — because the postcondition's guard
is copied from the body verbatim (`если второе равен 0`).

And separately: the promise "Euclid terminates" **cannot be written** in flang at
all. A decreasing measure is a property of the definition, not a postcondition of
the result; Coq uses `Fix`/well-founded recursion, Lean uses `decreasing_by`, and
we have the `тотальная` marker, which here simply is not claimed.

### 6. Folds: the wall runs along their boundary

`List.app_nil_r`, `List.app_nil_l`, `List.app_assoc`, `List.rev_involutive`,
`List.rev_app_distr`, `List.map_app`, `List.map_map`, `List.fold_left_app`,
`List.fold_right_app` — **nine** lemmas, the largest group.

The bodies of «Склеить» and «Обратить» are folds. About folds
`docs/site/kak-dokazat.ru.md` says, by measurement: **the step level is open, the
fold level is closed**, and there is no rule "a fold over the empty list is the
base" at all. Confirmed here too: both claims "over the empty list the fold is the
base" (left and right) stayed grids.

What **did** go through, in every case: **length**. Length of append, length of
reverse, length of map, and "prepending lengthens by exactly one" are all proved,
because the kernel has a dedicated rule about the measure of a fold that grows by
exactly one. The kernel can count over lists; it cannot identify them.

### 7. Membership and indexed access

`List.in_app_iff` and `List.nth_In` — two lemmas, and this is the known hole named
third on our list: **"element N of a list"**. There is no bridge between
`содержит` and `элемент … в …` in either direction.

## What this measurement says about the kernel

Three conclusions that were not obvious before the run.

**One: the boundary runs by the shape of the goal, not by the difficulty of the
lemma.** Commutativity of multiplication is proved; "multiply by one" is not. To a
human the second is more trivial than the first; to the kernel the first is a swap
of siblings of one node (an IEEE-754 theorem) and the second needs a rule that
does not exist.

**Two: an exact type works, and works for free.** Four of the seventeen proved
arithmetic claims came in **by declared type** (`объявленным типом 4` in the
report) — `нат` supplied both floor and ceiling, and reflexivity, non-negativity
and both remainder bounds against a literal went through without a single
theorem. That is the cheapest technique in the whole file.

**Three: over lists the kernel counts but does not identify.** Twelve of the
twenty-nine claims in the list file are proved, and **every one of them is about
length**. Not a single equality of two lists went through. The wall is flat and
runs through exactly one place.

## Reproducing the measurement

```sh
PAMYAT=45G /srv/flang-rabota/vorota/flang-vorota -- \
  ./bootstrap/flang check flang/stdlib/math-classics.flang --proof
PAMYAT=45G /srv/flang-rabota/vorota/flang-vorota -- \
  ./bootstrap/flang check flang/stdlib/math-classics-lists.flang --proof
```

The line to read is the last one of the report:

```
утверждений N: доказано M (из них без теоремы L), сетка S
```

Count only `доказано`. `сетка` is a finite set of values and says nothing about
the rest of the inputs.

## Where to go next

- [Which postconditions the kernel accepts](kak-dokazat.html) — eleven ways of
  writing a claim, each with a run saying whether the kernel takes it.
- [The kernel refused: whose fault is it](proof-refused.html) — thirteen refusal
  codes and what each one means.
- [What is proved and what is not](what-is-proved.html) — the same honesty across
  the whole standard library.
