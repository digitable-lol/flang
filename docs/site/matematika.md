# Coq and Lean classics: what our kernel actually proves

This page is not a survey of Coq and not a retelling of Mathlib. It is a
**measurement**: seventy-five classical lemmas, copied verbatim from the Coq and
Lean sources, rewritten in flang as real functions with postconditions, and run
through our kernel. Every lemma carries a verdict taken from a run, and every
unproved one carries a named reason.

A negative result is worth more here than a positive one. A page saying "75 out
of 75 proved" would be refuted by the reader's first run, and after that nothing
else on this site would be believed.

## The bottom line

```
flang/stdlib/math-classics.flang
  утверждений 67: доказано 29 (из них без теоремы 29, объявленным типом 12), сетка 38, объявлено, не доказано 0

flang/stdlib/math-classics-lists.flang
  утверждений 37: доказано 16 (из них без теоремы 16), сетка 21, объявлено, не доказано 0
```

That is **104 claims, 45 proved**. Of the seventy-five classical lemmas the
kernel takes **twenty-five outright**; **forty-nine stay a grid**, each with a
named reason below; and one more — the termination of Euclid's algorithm — cannot
be written in flang at all.

There are no axioms in these files: the "taken on faith" column of both reports
is empty (`принято на веру: ничего`).

**What changed since the previous measurement.** It was 73 claims and 29 proved,
forty-seven lemmas of which thirteen were taken outright. The gain came not from
rewriting old postconditions but from new lemmas and from two measured boundaries
of the kernel's rules: monotonicity of addition is taken when the addend is a
**literal** and refused when it is a **term** (exactly like the bound on a
remainder), and the bounds of min and max are taken when the guard is copied from
the body word for word.

## Where the names come from

Every lemma name in the tables was found in a downloaded file, not recalled from
memory. Where nothing was found, the table has a dash.

| source | files read |
|---|---|
| `coq/coq`, tag `V8.19.2` | `theories/Init/Nat.v`, `theories/Init/Peano.v`, `theories/Arith/PeanoNat.v`, `theories/Arith/Compare_dec.v`, `theories/Lists/List.v`, `theories/Numbers/NatInt/{NZAdd,NZMul,NZOrder,NZBase,NZGcd,NZParity}.v`, `theories/Numbers/Natural/Abstract/{NAdd,NDiv,NOrder,NParity}.v` |
| `leanprover/lean4`, `master` | `src/Init/Prelude.lean`, `src/Init/Core.lean`, `src/Init/Data/Nat/{Basic,Lemmas,Gcd,MinMax,Mod,Dvd}.lean`, `src/Init/Data/List/{Basic,Lemmas}.lean` |
| `leanprover-community/mathlib4`, `master` | `Mathlib/Data/Nat/Basic.lean`, `Mathlib/Data/List/Basic.lean`, `Mathlib/Data/Nat/GCD/Basic.lean`, `Mathlib/Algebra/Group/Nat/Even.lean` |

Two details that will save the reader time. First: on Coq's `master` the standard
library has moved to a separate repository (`rocq-prover/stdlib`), so
`coq/coq/master/theories/…` returns 404 today — the files above were taken at tag
`V8.19.2`. Second: `Mathlib/Data/Nat/Defs.lean` no longer exists; nearly all of
the `Nat` classics moved into the Lean 4 core (`src/Init/Data/Nat/…`), and only
the superstructure stayed in Mathlib.

**Three names are confirmed by use, not by declaration, and that must be said
plainly.** `Nat.le_add_r`, `Nat.le_0_l` and `Nat.sub_add` are **called** in the
downloaded files (`theories/Arith/PeanoNat.v:411`, `theories/Lists/List.v:506`
and `:1701`, `theories/Numbers/Natural/Abstract/NOrder.v:25`,
`theories/Numbers/Natural/Abstract/NParity.v:41`), but they are declared in files
this measurement did not download (`NBase.v`, `NSub.v`). The name exists; the
declaration line was not checked.

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

File — `flang/stdlib/math-classics.flang`, 45 functions, 67 claims. The number in
parentheses is the line in the downloaded file.

| lemma | Coq | Lean / Mathlib | ours | verdict |
|---|---|---|---|---|
| addition commutes | `Nat.add_comm` (NZAdd.v:44) | `Nat.add_comm` | «Сумма» | **proved** |
| addition associates | `Nat.add_assoc` (NZAdd.v:63) | `Nat.add_assoc` | «Сумма трёх» | grid |
| zero on the right | `Nat.add_0_r` (NZAdd.v:23) | `Nat.add_zero` | «Прибавить ноль» | grid |
| zero on the left | `Nat.add_0_l` (PeanoNat.v:107) | `Nat.zero_add` | «Ноль слева» | grid |
| cancel a summand | `Nat.add_cancel_l` (NZAdd.v:70) | `Nat.add_left_cancel` (Basic.lean:177) | «Сократить общее слагаемое» | grid |
| summand ≤ sum, addend a **term** | `Nat.le_add_r` | `Nat.le_add_right` (Basic.lean:374) | «Сумма» — two claims | grid (both) |
| same, addend a **literal** | `Nat.le_add_r` | `Nat.le_add_right` | «Прибавить десять» | **proved** |
| n ≤ n+1 | `Nat.le_succ_diag_r` (NZOrder.v:41) | `Nat.le_succ` (Prelude.lean:2078) | «Следующее» | **proved** |
| a common addend keeps the order | — | `Nat.add_le_add_left` (Basic.lean:484) | «Прибавить общее к большему» | grid |
| multiplication commutes | `Nat.mul_comm` (NZMul.v:33) | `Nat.mul_comm` | «Произведение» | **proved** |
| multiplication associates | `Nat.mul_assoc` (NZMul.v:55) | `Nat.mul_assoc` | «Произведение трёх» | grid |
| one on the right | `Nat.mul_1_r` (NZMul.v:67) | `Nat.mul_one` | «Умножить на единицу» | grid |
| one on the left | `Nat.mul_1_l` (NZMul.v:62) | `Nat.one_mul` | «Единица слева» | grid |
| zero absorbs | `Nat.mul_0_r` (NZMul.v:18) | `Nat.mul_zero` | «Умножить на ноль» | grid |
| distributivity, left | `Nat.mul_add_distr_l` (NZMul.v:48) | `Nat.left_distrib` | «Распределить слева» | grid |
| distributivity, right | `Nat.mul_add_distr_r` (NZMul.v:40) | `Nat.right_distrib` | «Распределить справа» | grid |
| subtract then add back | `Nat.sub_add` | `Nat.sub_add_cancel` (Basic.lean:991) | «Вычесть и прибавить обратно» | grid |
| subtract zero | `Nat.sub_0_r` (PeanoNat.v:113) | `Nat.sub_zero` (Basic.lean:268) | «Вычесть ноль» | grid |
| n − n = 0 | — | `Nat.sub_self` (Basic.lean:290) | «Вычесть само себя» | grid |
| order is reflexive | `Nat.le_refl` (NZOrder.v:31) | `Nat.le_refl` (Prelude.lean:2081) | «Само себя» | **proved** (by declared type) |
| zero is least | `Nat.le_0_l` | `Nat.zero_le` (Prelude.lean:2054) | «Само себя» — second claim | **proved** (by declared type) |
| transitivity | `Nat.le_trans` (NZOrder.v:126) | `Nat.le_trans` (Prelude.lean:2068) | «Через середину» | grid |
| antisymmetry | `Nat.le_antisymm` (NZOrder.v:203) | `Nat.le_antisymm` (Prelude.lean:2144) | «Зажатое между» | grid |
| trichotomy | `Nat.lt_trichotomy` (NZOrder.v:88) | `Nat.lt_trichotomy` (Basic.lean:452) | «Сравнить» | **proved** |
| order is total | `Nat.le_ge_cases` (NZOrder.v:282) | `Nat.le_total` (Basic.lean:341) | «Два сравнимы» | grid |
| min by the left and by the right | `Nat.min_l` (PeanoNat.v:243), `Nat.min_r` (:246) | `Nat.min_eq_left` (MinMax.lean:61) | «Меньшее из двух» — two claims | **proved** (both) |
| min ≤ each argument | — | `Nat.min_le_left` (MinMax.lean:58), `Nat.min_le_right` | «Меньшее из двух» — two more | **proved** (both) |
| max by the left and by the right | `Nat.max_l` (PeanoNat.v:255), `Nat.max_r` (:262) | `Nat.max_eq_left` (MinMax.lean:122) | «Большее из двух» — two claims | **proved** (both) |
| each argument ≤ max | — | `Nat.le_max_left` (MinMax.lean:115), `Nat.le_max_right` | «Большее из двух» — two more | **proved** (both) |
| min commutes | — | `Nat.min_comm` (MinMax.lean:49) | «Меньшее переставленное» | grid |
| max commutes | — | `Nat.max_comm` (MinMax.lean:108) | «Большее переставленное» | grid |
| equality as a boolean | `Nat.eqb_eq` (PeanoNat.v:143) | `Nat.beq_eq` (Basic.lean:122) | «Равны признаком» | **proved** |
| order as a boolean | `Nat.leb_le` (PeanoNat.v:156) | `Nat.ble_eq` (Basic.lean:123) | «Не больше признаком» | **proved** |
| division with remainder | `Nat.div_mod_eq` (PeanoNat.v:373) | `Nat.div_add_mod` | «Частное» | grid |
| remainder below divisor, divisor a **term** | `Nat.mod_bound_pos` (PeanoNat.v:390) | `Nat.mod_lt` (Prelude.lean:2412) | «Остаток» | grid (both bounds) |
| same, divisor a **literal** | `Nat.mod_bound_pos` | `Nat.mod_lt` | «Остаток по десяти» | **proved** (both bounds) |
| remainder mod one is zero | `Nat.mod_1_r` (NDiv.v:84) | `Nat.mod_one` (Mod.lean:232) | «Остаток по единице» | grid for the equality, **proved** for both bounds |
| division by one | `Nat.div_1_r` (NDiv.v:81) | `Nat.div_one` (Basic.lean:269) | «Делить на единицу» | grid |
| remainder of a number by itself | `Nat.mod_same` (NDiv.v:60) | `Nat.mod_self` (Mod.lean:229) | «Остаток от самого себя» | grid |
| definition of divisibility | `Nat.divide` (NZGcd.v) | `Nat.dvd_iff_mod_eq_zero` | «Делит» | **proved** |
| every number divides itself | `Nat.divide_refl` (NZGcd.v:100) | `Nat.dvd_refl` (Dvd.lean:19) | «Делит само себя» | grid |
| gcd with zero | — | `Nat.gcd_zero_right` (Gcd.lean:59) | «НОД по Евклиду» | **proved** |
| the gcd recurrence | — | `Nat.gcd_rec` (Gcd.lean:74), `Nat.gcd_def` (:52) | «НОД по Евклиду» | **proved** |
| gcd commutes | `Nat.gcd_comm` (NZGcd.v:239) | `Nat.gcd_comm` (Gcd.lean:109) | «НОД по Евклиду» | grid |
| gcd divides the first | `Nat.gcd_divide_l` (NZGcd.v:599) | `Nat.gcd_dvd_left` (Gcd.lean:92) | «НОД по Евклиду» | grid |
| gcd divides the second | `Nat.gcd_divide_r` (NZGcd.v:602) | `Nat.gcd_dvd_right` (Gcd.lean:94) | «НОД по Евклиду» | grid |
| gcd of a number with itself | — | `Nat.gcd_self` (Gcd.lean:70) | «НОД с самим собой» | grid |
| gcd with one | `Nat.gcd_1_r` (NZGcd.v:268) | `Nat.gcd_one_right` (Gcd.lean:137) | «НОД с единицей» | grid |
| Euclid terminates | `Fixpoint gcd` (Init/Nat.v:306) | `termination_by` / `decreasing_by` (Gcd.lean:39) | **cannot be written** | — |
| even means remainder zero | `Nat.even_spec` (PeanoNat.v:327) | `Nat.even_iff` | «Чётно» | **proved** |
| odd means remainder one | `Nat.odd_spec` (PeanoNat.v:337) | — | «Нечётно» | **proved** |
| even or odd | `Nat.Even_or_Odd` (NZParity.v:52) | `Nat.mod_two_eq_zero_or_one` (Basic.lean:780) | «Остаток по два» | grid |
| even plus even | `Nat.even_add` (PeanoNat.v:193) | `Nat.even_add` | «Сумма чётных» | grid |
| even times anything | `Nat.even_mul` (PeanoNat.v:213) | `Nat.even_mul` | «Произведение с чётным» | grid |

Fifty-four rows: fifty-three lemmas written in flang and one ("Euclid
terminates") that cannot be written at all. **Nineteen** are taken outright.
Trichotomy is split in the file into three branches, and **all three are proved**.

## Table: lists

File — `flang/stdlib/math-classics-lists.flang`, 25 functions, 37 claims. The
number in parentheses is the line in `theories/Lists/List.v` at tag `V8.19.2` or
in the named Lean file.

| lemma | Coq | Lean / Mathlib | ours | verdict |
|---|---|---|---|---|
| length of an append | `List.app_length` (225) | `List.length_append` (Basic.lean:622) | «Склеить» | **proved** |
| one append step adds one | `List.last_length` (230) | `List.length_concat` (Basic.lean:110) | «Шаг склейки» | **proved** |
| length of the empty list | `List.length_zero_iff_nil` (103) | `List.length_nil` (Basic.lean:84) | «Пустой список чисел» | **proved** |
| length of a cons | — | `List.length_cons` (Basic.lean:89) | «Приписать в начало» | **proved** |
| append with empty on the right | `List.app_nil_r` (139) | `List.append_nil` (Basic.lean:612) | «Склеить с пустым справа» | grid (and the weakening to length — grid too) |
| append with empty on the left | `List.app_nil_l` (134) | `List.nil_append` (Basic.lean:609) | «Склеить с пустым слева» | grid (weakening to length — **proved**) |
| append associates | `List.app_assoc` (151) | `List.append_assoc` (Basic.lean:627) | «Склеить три» | grid (weakening to length — **proved**) |
| cons through an append | `List.app_comm_cons` (163) | `List.cons_append` (Basic.lean:610) | «Приписать к склейке» | grid (weakening to length — **proved**) |
| length of a reverse | `List.rev_length` (1002) | `List.length_reverse` (Lemmas.lean:2431) | «Обратить» | **proved** |
| reverse of a reverse | `List.rev_involutive` (953) | `List.reverse_reverse` (Lemmas.lean:2484) | «Обратить дважды» | grid (weakening to length — **proved**) |
| reverse of an append | `List.rev_app_distr` (941) | `List.reverse_append` (Lemmas.lean:2540) | «Обратить склейку» | grid (weakening to length — **proved**) |
| length of a map | `List.map_length` (1139) | `List.length_map` (Lemmas.lean:1081) | «Отобразить» | **proved** |
| map over an append | `List.map_app` (1164) | `List.map_append` (Lemmas.lean:1853) | «Отобразить склейку» | grid (weakening to length — **proved**) |
| map through composition | `List.map_map` (1295) | `List.map_map` (Lemmas.lean:1252) | «Отобразить дважды» | grid (weakening to length — **proved**) |
| map by identity | `List.map_id` (1289) | `List.map_id` (Lemmas.lean:1108) | «Отобразить тождеством» | grid (weakening to length — **proved**) |
| fold left over an append | `List.fold_left_app` (1360) | `List.foldl_append` (Lemmas.lean:2723) | «Свернуть слева склейку» | grid |
| fold right over an append | `List.fold_right_app` (1392) | `List.foldr_append` (Lemmas.lean:2726) | «Свернуть справа склейку» | grid |
| membership in an append | `List.in_app_iff` (303) | `List.mem_append` (Lemmas.lean:1598) | «Есть в склейке» | grid |
| the head belongs to the list | `List.in_eq` (272) | `List.mem_cons_self` (Lemmas.lean:367) | «Приписать в начало» — second claim | grid |
| a cons keeps a member | `List.in_cons` (277) | `List.mem_cons_of_mem` (Lemmas.lean:389) | «Приписать к вошедшему» | grid |
| element at index belongs | `List.nth_In` (447) | `List.getElem_mem` | «Элемент по номеру» | grid |

Twenty-one lemmas, six taken outright.

**Weakenings, said out loud.** For nine lemmas where full list equality was not
taken, the same statement **about length only** stands next to it, and eight of
the nine are proved. This does not replace the lemma — it is strictly weaker, and
the verdict in the table belongs to the full form, not to the weakening.

## Why it is not taken: the reasons, one by one

The forty-nine unproved lemmas fall into **eight** named reasons, and none of them
is "the kernel is weak in general".

### 1. Associativity and distributivity: the kernel matches SYNTACTICALLY

The kernel's refusal states it verbatim: after rewriting with the premises the
two sides of the equality remain different terms; the kernel matches syntactically
and does not decide equalities of computations. It reads `плюс` and `умножить`
**up to the order of neighbours at one node** (swapping two operands of the *same*
node is an IEEE-754 theorem; swapping across parentheses is not, because
associativity is false in IEEE-754, and the kernel does not do it).

Hence exactly what we measured: **commutativity is taken, associativity is not**,
for both addition and multiplication. That is not a gap but honesty: over floats
associativity really is false, and a rule that took it would be proving a
falsehood.

The same single rule explains `Nat.add_assoc`, `Nat.mul_assoc`,
`Nat.mul_add_distr_l`, `Nat.mul_add_distr_r` — four lemmas.

### 2. Neutral element and absorption: `а плюс 0` and `а` are different terms

`Nat.add_0_r`, `Nat.add_0_l`, `Nat.mul_1_r`, `Nat.mul_1_l`, `Nat.mul_0_r`,
`Nat.sub_0_r`, `Nat.div_1_r` — seven lemmas, all running into the same syntactic
match: substituting the body gives `(а плюс 0) равен а`, and those are two
different trees. On a bare body the kernel has no "fold the neutral element" rule.

**On the path through a callee's postcondition it does have one — on one side
only.** This explains an asymmetry that the previous edition of this page left
unsolved: `List.app_nil_l` (append with empty on the LEFT, weakened to length) is
proved while its mirror `List.app_nil_r` is a grid. Probe, taken from a run:

```
«Склеить с пустым справа», body «Склеить» от элементы и пустой список:
  (длина результат) равен ((длина элементы) плюс (длина пустой список))  — PROVED
  (длина результат) равен ((длина элементы) плюс 0)                      — PROVED
  (длина результат) равен (длина элементы)                               — grid

«Склеить с пустым слева», body «Склеить» от пустой список и элементы:
  (длина результат) равен (0 плюс (длина элементы))                      — PROVED
  (длина результат) равен (длина элементы)                               — PROVED
```

The composed form is taken on both sides. The single difference: **a leading zero
is folded away, a trailing one is not.** Where exactly the kernel walks is not
visible from the refusal; only this is measurable.

A neighbouring measurement worth knowing: in the lists file the claim "doubling is
a sum with itself" over the body `х умножить на 2` is also a **grid**, while
"adding one is a sum with one" over the body `х плюс 1` is **proved**. The
difference is exactly whether the goal's tree matched the body's tree.

### 3. Inequalities over a term: the rule exists under zero, under the type, and under a LITERAL

`Nat.le_add_r` (term addend), `Nat.le_trans`, `Nat.le_antisymm`,
`Nat.le_ge_cases`, `Nat.add_cancel_l`, `Nat.div_mod_eq`, `Nat.sub_add`,
`Nat.add_le_add_left`, `Nat.mod_bound_pos` (term divisor) — nine lemmas.

**The boundary runs along the kind of the addend, and this is a new measurement.**
One and the same lemma `Nat.le_add_r` yields two different verdicts:

```
«Сумма», body а плюс б with б: нат — addend a TERM:
  а не больше результат   — grid
  б не больше результат   — grid

«Следующее»,        body а плюс 1  — addend a LITERAL:  а не больше результат — PROVED
«Прибавить десять», body а плюс 10 — addend a LITERAL:  а не больше результат — PROVED
```

Both literal cases came back as "proved **by the declared types of the
arguments**: the goal was reduced by the rule 'order by construction'". So the
kernel does read the range that the type `нат` gives — but only when the second
summand is a written number. This is **the same dividing line as for the
remainder** (`Nat.mod_bound_pos`): not the "difficulty" of the lemma but the kind
of the second argument.

What comes for free: `Nat.le_refl` and `Nat.le_0_l`, both with the same wording
about declared types. But adding two premises `а не больше б` and `б не больше в`
into a third is beyond it: its rewriting is single-goal.

**The bounds of min and max were taken, and taken by a guard.** Four claims —
`Nat.min_le_left`, `Nat.min_le_right`, `Nat.le_max_left`, `Nat.le_max_right` — are
written with a guard copied from the body word for word:

```
обеспечивает «меньшее из двух не больше первого»
  если (а не больше б) то (результат не больше а) иначе да     → PROVED
```

Under the guard the body reduces to `а` and the goal to reflexivity, which the
type `нат` supplies. Technique 1 of ["Which promises the kernel
takes"](kak-dokazat.html) works on a `не больше` goal too, not only on equalities.

**The mirrored spelling does not help here, measured three times.** For
`Nat.le_trans`, `Nat.le_antisymm` and `Nat.add_le_add_left` the alternative
spelling `не (А) или (Б)` was added (technique 6). All three stayed grids: the
denominator grew, the numerator did not. The one for `Nat.add_le_add_left` was
rolled back; the first two were kept so the reader can see both spellings. Splitting
`Nat.le_total` by the three outcomes of a comparison (technique 11) ended in the
same zero — three claims, no gain, rolled back.

`Nat.sub_add` is a special case: over IEEE-754 the law is **false**, with the
counterexample `(9007199254740994 минус 1) плюс 1 = 9007199254740992`. Over `нат`
it holds, but the kernel has no rule that would tell the exact integer grid apart
from the rest of the numbers in a subtraction, and by the note in
`flang/self/proof-kernel.flang` it will not get one.

### 4. Arithmetic of remainders: parity and divisibility

`Nat.mod_1_r` (the equality itself), `Nat.mod_same`, `Nat.divide_refl`,
`Nat.Even_or_Odd`, `Nat.even_add`, `Nat.even_mul`, `Nat.sub_self` — seven lemmas.
All of them ask for reasoning about remainders. The kernel has no such rules —
only bounds on a remainder, and only with a literal divisor.

**A separate measurement worth reading.** For `Nat.mod_1_r` both bounds are proved
and the equality is not:

```
«Остаток по единице», body н остаток от 1:
  результат не больше 0   — PROVED, rule "bounded by an exact ceiling by construction"
  0 не больше результат   — PROVED, rule "order by construction"
  результат равен 0       — grid
```

The kernel does **not glue** two of its own proved inequalities into an equality.
This is not a quirk of the remainder: it cannot add two postconditions of one call
together either, and here we see it cannot add two postconditions of one goal.

What was taken: `Nat.even_spec` and `Nat.odd_spec`, both by the rule "identity
after rewriting with a premise", because they are literally definitions — the
goal's tree coincided with the body's.

### 5. Recursion by remainder: gcd

`Nat.gcd_comm`, `Nat.gcd_divide_l`, `Nat.gcd_divide_r`, `Nat.gcd_self`,
`Nat.gcd_1_r` — five lemmas with one shared cause: «НОД по Евклиду» is the **only
non-total function** in both files. The pair `(a, b)` does decrease strictly in
the second argument, but the step is a remainder rather than a constant
difference, and flang's termination analysis does not read such a step.

What **was** taken — both branches of the recurrence, each by a guard copied from
the body word for word:

```
обеспечивает «НОД с нулём есть само число»
  если второе равен 0 то (результат равен первое) иначе да                  → PROVED
обеспечивает «НОД сводится к остатку»
  если не (второе равен 0)
    то (результат равен («НОД по Евклиду» от второе и (первое остаток от второе)))
    иначе да                                                                → PROVED
```

Those are `Nat.gcd_zero_right` and `Nat.gcd_rec`: **the definition of Euclid's
algorithm is proved as a pair of postconditions**, while not a single consequence
of it is. Both go through the rule "split the goal by the condition".

And separately: the claim "Euclid terminates" **cannot be written** in flang. A
decreasing measure is a property of the definition, not a postcondition of the
result; Coq uses `Fix`/well-founded recursion, Lean uses `decreasing_by`, and we
have the marker `тотальная`, which simply is not placed here.

### 6. Commutativity of min and max

`Nat.min_comm`, `Nat.max_comm` — two lemmas. Their goal is an equality between the
result and a call of the same function with swapped arguments, and the kernel does
not look inside a callee: it takes only its postconditions, and those of «Меньшее
из двух» are written under guards and say nothing about swapping. This is the same
broken chain that technique 7 describes in ["Which promises the kernel
takes"](kak-dokazat.html).

### 7. Folds: the wall runs along their boundary

`List.app_nil_r`, `List.app_nil_l`, `List.app_assoc`, `List.app_comm_cons`,
`List.rev_involutive`, `List.rev_app_distr`, `List.map_app`, `List.map_map`,
`List.map_id`, `List.fold_left_app`, `List.fold_right_app` — **eleven** lemmas,
the largest group.

The bodies of «Склеить» and «Обратить» are folds. **The kernel does have a fold
principle**, as re-measured by neighbouring work (task 0050, commit `b96826d7`):
it applies when the fold runs over the argument itself, named, at the top level of
the body, and when the step carries a guard-free claim that the accumulator grows
by exactly one. Both of our folds meet those conditions, the step has been lifted
and does carry such a claim — and **the principle still never fired**: both runs,
with the lifted step and with the lambda, report `доказано 16 (из них без теоремы
16)` and `доказано 15 (из них без теоремы 15)`, with no "of them by induction" at
all.

The length of a fold is computed by a different rule — "identity after rewriting
with a premise" — and that rule suffices for every claim about the measure and for
not a single claim about the contents. There is still no rule "a fold over the
empty list is the base": both claims "over the empty list the fold is the base
itself" (left and right) stayed grids.

**Technique 8 was tried and cost minus one — that has to be said plainly.** The
fold step of «Склеить» was lifted into an ordinary function «Шаг склейки», and on
it the claim `(длина результат) равен ((длина акк) плюс 1)` (`List.last_length`)
is **proved**. But once the fold itself started calling the lifted step instead of
the lambda, the file went **16 → 15 proved**: `List.app_nil_l` in its weakening to
length was lost. The change was rolled back and «Шаг склейки» left standing beside
the fold. The warning in the manual ("lifting the step may drop a proof that
stood") is now confirmed by a number.

What **was** taken, and taken everywhere: **length**. "length of an append is the
sum of lengths", "reversing preserves length", "mapping preserves length", "a cons
lengthens the list by exactly one", "the empty list has length zero" are all
proved. About lists the kernel can count, but it cannot identify.

### 8. Membership and access by index

`List.in_app_iff`, `List.in_eq`, `List.in_cons`, `List.nth_In` — four lemmas, and
this is the hole named third among the known ones: **"element N of a list"**. The
kernel has no bridge between `содержит` and `элемент … в …` in either direction.
The two lemmas added in this pass — `List.in_eq` and `List.in_cons` — confirmed it
twice more: both grids, both over real bodies `приписать первый к элементы`.

## The empty-promise check: four stubs, not two

A promise that holds for any body checks nothing. All 45 proved claims of both
files were run with their bodies replaced by stubs. The short answer: **none is
empty**. But finding that out took more than the canonical pair of stubs, and here
are the numbers.

| stub | arithmetic: proved | lists: proved |
|---|---:|---:|
| real bodies | 29 | 16 |
| zero (`0`, `нет`, empty list) | 19 | 8 |
| non-zero (`1`, `да`, one-element list) | 13 | 6 |
| third (`42`, `да`) | 10 | not needed |
| fourth (`0 минус 1`, `нет`) | 8 | not needed |

For lists the canonical pair sufficed: none of the sixteen proved claims survived
both. In arithmetic **five claims survived both** — and none of them is empty;
they are caught only by a stub placed **outside the bound**:

| claim | 0 | 1 | 42 | −1 |
|---|---|---|---|---|
| "zero is at most any natural" | alive | alive | alive | **fell** |
| "remainder mod ten is at most nine" | alive | alive | **fell** | alive |
| "remainder mod ten is non-negative" | alive | alive | alive | **fell** |
| "remainder mod one is non-negative" | alive | alive | alive | **fell** |
| "the comparison returns exactly one of three" | alive | alive | **fell** | alive |

The rule that follows: **for a bound-shaped claim, and for a "the result is one of
three" claim, the canonical pair `0` and `1` is powerless, because both stubs lie
inside the bound themselves.** Such a claim needs a stub from outside: above the
ceiling or below zero. This extends the canon rather than refuting it — two stubs
are still necessary, they are simply sometimes not enough.

A caveat about the honesty of the measurement: stubbing a whole file at once
yields false "empties" wherever a goal refers to a neighbouring stubbed function.
Those places are discarded in the tables above; in the real file they stand as
grids anyway.

## What this measurement says about the kernel

Four conclusions that were not obvious before the run.

**First: the boundary runs along the kind of the second argument, not the
"difficulty" of the lemma.** The same lemma yields different verdicts depending on
whether a term or a literal stands there — measured twice, independently: for the
remainder (`Nat.mod_bound_pos`) and for monotonicity of addition
(`Nat.le_add_r`). To a human `а ≤ а + б` and `а ≤ а + 10` are one statement; to
the kernel the first needs a range for `б` while the second reads the range
straight off the number.

**Second: an exact type works, and works for free.** Twelve of the twenty-nine
proved claims in arithmetic came **by declared type** (`объявленным типом 12` in
the report) — three times more than in the previous measurement. `нат` gives both
a floor and a ceiling; on it we got reflexivity, non-negativity, both bounds of a
remainder by a literal, both bounds of min and max, and monotonicity of addition
with a literal addend. It is the cheapest technique in the whole file.

**Third: the definition gets proved, its consequences do not.** Both branches of
Euclid (`Nat.gcd_zero_right` and `Nat.gcd_rec`) are proved while `Nat.gcd_comm`,
`Nat.gcd_dvd_left` and `Nat.gcd_dvd_right` are not. The same with parity:
`Nat.even_spec` and `Nat.odd_spec` are proved, `Nat.even_add` and `Nat.even_mul`
are not. The kernel takes what is written in the body and almost nothing that
follows from it.

**Fourth: about lists the kernel counts but does not identify.** Of the sixteen
proved claims in the lists file **fourteen are about length**, and the remaining
two are about the small numeric helpers that feed the examples. Not a single
equality of two lists was taken. The wall is flat and runs through one place.

## Reproducing the measurement

```sh
PAMYAT=45G /srv/flang-rabota/vorota/flang-vorota -- \
  ./bootstrap/flang check flang/stdlib/math-classics.flang --proof
PAMYAT=45G /srv/flang-rabota/vorota/flang-vorota -- \
  ./bootstrap/flang check flang/stdlib/math-classics-lists.flang --proof
```

The line to look at is the last one of the proof report:

```
утверждений N: доказано M (из них без теоремы L), сетка S
```

Count only `доказано`. `сетка` is a finite set of values and says nothing about
the rest of the inputs.

The measurement was taken with the binary
`/srv/flang-rabota/w-predely/bootstrap/flang` (built 23 August 2026, with a raised
step limit). A binary built from this tree's seed may answer differently: some
kernel rules were written into the sources after the seed and will only arrive
with the next reprint. If your numbers disagree with this page, first check which
binary you counted with.


## Where to go next

- ["Which promises the kernel takes"](kak-dokazat.html) — spelling forms, each
  with a run saying whether the kernel takes it.
- ["The kernel refused: whose fault is it"](proof-refused.html) — thirteen refusal
  codes and what each means.
- ["What is proved and what is not"](what-is-proved.html) — the same honesty
  across the whole standard library.
