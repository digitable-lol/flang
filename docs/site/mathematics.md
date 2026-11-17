# Comparison on classic lemmas

This page answers the question: which lemmas from Coq and Lean textbooks does
the flang kernel prove by itself. We took 75 lemmas about natural numbers and
lists. Each is rewritten in flang as a function with a postcondition and
checked with `flang {{выпуск.версия}}`.

## The result

| | Lemmas | Proved | Tests only | Cannot be written |
| --- | ---: | ---: | ---: | ---: |
| Arithmetic | 54 | 22 | 31 | 1 |
| Lists | 21 | 8 | 13 | 0 |
| Total | 75 | 30 | 44 | 1 |

«Tests only» means: the postcondition passed on the function's tests; it is not
proved for all inputs. Each of the 75 is proved in Coq or Lean.

One lemma may be written as several postconditions, so there are more
postconditions than lemmas: 107, of which 57 are proved.

## Where the lemmas come from

| Source | Files read |
|---|---|
| `coq/coq`, tag `V8.19.2` | `theories/Init/Nat.v`, `theories/Init/Peano.v`, `theories/Arith/PeanoNat.v`, `theories/Arith/Compare_dec.v`, `theories/Lists/List.v`, `theories/Numbers/NatInt/{NZAdd,NZMul,NZOrder,NZBase,NZGcd,NZParity}.v`, `theories/Numbers/Natural/Abstract/{NAdd,NDiv,NOrder,NParity}.v` |
| `leanprover/lean4`, `master` | `src/Init/Prelude.lean`, `src/Init/Core.lean`, `src/Init/Data/Nat/{Basic,Lemmas,Gcd,MinMax,Mod,Dvd}.lean`, `src/Init/Data/List/{Basic,Lemmas}.lean` |
| `leanprover-community/mathlib4`, `master` | `Mathlib/Data/Nat/Basic.lean`, `Mathlib/Data/List/Basic.lean`, `Mathlib/Data/Nat/GCD/Basic.lean`, `Mathlib/Algebra/Group/Nat/Even.lean` |

The Coq standard library was taken at tag `V8.19.2`. Three names —
`Nat.le_add_r`, `Nat.le_0_l`, `Nat.sub_add` — were found only where they are
applied; the line of their declaration was not checked.

## How `nat` was translated

In Coq and Lean the lemmas are stated over `nat`: an exact type with no NaN, no
infinities and no fractions. `число` in flang is binary64, and half of these
lemmas are false over it:

```
5 не больше (5 плюс (0 минус 1))                    →  false
(9007199254740994 минус 1) плюс 1                   →  9007199254740992
(0 делить на 0) не больше (0 делить на 0)           →  false
```

So everywhere in place of `nat` stands `неотрицательное`: an integer from 0 to
2⁵³−1.

## Arithmetic

The number in parentheses is the line in the Coq or Lean source file.

| lemma | Coq | Lean / Mathlib | function in flang | answer |
|---|---|---|---|---|
| addition commutes | `Nat.add_comm` (NZAdd.v:44) | `Nat.add_comm` | «Сумма» | proved |
| addition associates | `Nat.add_assoc` (NZAdd.v:63) | `Nat.add_assoc` | «Сумма трёх» | tests only |
| zero on the right | `Nat.add_0_r` (NZAdd.v:23) | `Nat.add_zero` | «Прибавить ноль» | tests only |
| zero on the left | `Nat.add_0_l` (PeanoNat.v:107) | `Nat.zero_add` | «Ноль слева» | tests only |
| cancel a summand | `Nat.add_cancel_l` (NZAdd.v:70) | `Nat.add_left_cancel` (Basic.lean:177) | «Сократить общее слагаемое» | tests only |
| summand ≤ sum, addend a **term** | `Nat.le_add_r` | `Nat.le_add_right` (Basic.lean:374) | «Сумма» — two claims | proved (both, by declared type) |
| same, addend a **literal** | `Nat.le_add_r` | `Nat.le_add_right` | «Прибавить десять» | proved |
| n ≤ n+1 | `Nat.le_succ_diag_r` (NZOrder.v:41) | `Nat.le_succ` (Prelude.lean:2078) | «Следующее» | proved |
| a common addend keeps the order | — | `Nat.add_le_add_left` (Basic.lean:484) | «Прибавить общее к большему» | proved (by declared type) |
| multiplication commutes | `Nat.mul_comm` (NZMul.v:33) | `Nat.mul_comm` | «Произведение» | proved |
| multiplication associates | `Nat.mul_assoc` (NZMul.v:55) | `Nat.mul_assoc` | «Произведение трёх» | tests only |
| one on the right | `Nat.mul_1_r` (NZMul.v:67) | `Nat.mul_one` | «Умножить на единицу» | tests only |
| one on the left | `Nat.mul_1_l` (NZMul.v:62) | `Nat.one_mul` | «Единица слева» | tests only |
| zero absorbs | `Nat.mul_0_r` (NZMul.v:18) | `Nat.mul_zero` | «Умножить на ноль» | tests only |
| distributivity, left | `Nat.mul_add_distr_l` (NZMul.v:48) | `Nat.left_distrib` | «Распределить слева» | tests only |
| distributivity, right | `Nat.mul_add_distr_r` (NZMul.v:40) | `Nat.right_distrib` | «Распределить справа» | tests only |
| subtract then add back | `Nat.sub_add` | `Nat.sub_add_cancel` (Basic.lean:991) | «Вычесть и прибавить обратно» | tests only |
| subtract zero | `Nat.sub_0_r` (PeanoNat.v:113) | `Nat.sub_zero` (Basic.lean:268) | «Вычесть ноль» | tests only |
| n − n = 0 | — | `Nat.sub_self` (Basic.lean:290) | «Вычесть само себя» | tests only |
| order is reflexive | `Nat.le_refl` (NZOrder.v:31) | `Nat.le_refl` (Prelude.lean:2081) | «Само себя» | proved (by declared type) |
| zero is least | `Nat.le_0_l` | `Nat.zero_le` (Prelude.lean:2054) | «Само себя» — second claim | proved (by declared type) |
| transitivity | `Nat.le_trans` (NZOrder.v:126) | `Nat.le_trans` (Prelude.lean:2068) | «Через середину» | proved (by declared type) |
| antisymmetry | `Nat.le_antisymm` (NZOrder.v:203) | `Nat.le_antisymm` (Prelude.lean:2144) | «Зажатое между» | tests only |
| trichotomy | `Nat.lt_trichotomy` (NZOrder.v:88) | `Nat.lt_trichotomy` (Basic.lean:452) | «Сравнить» | proved |
| order is total | `Nat.le_ge_cases` (NZOrder.v:282) | `Nat.le_total` (Basic.lean:341) | «Два сравнимы» | tests only |
| min by the left and by the right | `Nat.min_l` (PeanoNat.v:243), `Nat.min_r` (:246) | `Nat.min_eq_left` (MinMax.lean:61) | «Меньшее из двух» — two claims | proved (both) |
| min ≤ each argument | — | `Nat.min_le_left` (MinMax.lean:58), `Nat.min_le_right` | «Меньшее из двух» — two more | proved (both) |
| max by the left and by the right | `Nat.max_l` (PeanoNat.v:255), `Nat.max_r` (:262) | `Nat.max_eq_left` (MinMax.lean:122) | «Большее из двух» — two claims | proved (both) |
| each argument ≤ max | — | `Nat.le_max_left` (MinMax.lean:115), `Nat.le_max_right` | «Большее из двух» — two more | proved (both) |
| min commutes | — | `Nat.min_comm` (MinMax.lean:49) | «Меньшее переставленное» | tests only |
| max commutes | — | `Nat.max_comm` (MinMax.lean:108) | «Большее переставленное» | tests only |
| equality as a boolean | `Nat.eqb_eq` (PeanoNat.v:143) | `Nat.beq_eq` (Basic.lean:122) | «Равны признаком» | proved |
| order as a boolean | `Nat.leb_le` (PeanoNat.v:156) | `Nat.ble_eq` (Basic.lean:123) | «Не больше признаком» | proved |
| division with remainder | `Nat.div_mod_eq` (PeanoNat.v:373) | `Nat.div_add_mod` | «Частное» | tests only |
| remainder below divisor, divisor a **term** | `Nat.mod_bound_pos` (PeanoNat.v:390) | `Nat.mod_lt` (Prelude.lean:2412) | «Остаток» | tests only (both bounds) |
| same, divisor a **literal** | `Nat.mod_bound_pos` | `Nat.mod_lt` | «Остаток по десяти» | proved (both bounds) |
| remainder mod one is zero | `Nat.mod_1_r` (NDiv.v:84) | `Nat.mod_one` (Mod.lean:232) | «Остаток по единице» | tests only for the equality, proved for both bounds |
| division by one | `Nat.div_1_r` (NDiv.v:81) | `Nat.div_one` (Basic.lean:269) | «Делить на единицу» | tests only |
| remainder of a number by itself | `Nat.mod_same` (NDiv.v:60) | `Nat.mod_self` (Mod.lean:229) | «Остаток от самого себя» | tests only |
| definition of divisibility | `Nat.divide` (NZGcd.v) | `Nat.dvd_iff_mod_eq_zero` | «Делит» | proved |
| every number divides itself | `Nat.divide_refl` (NZGcd.v:100) | `Nat.dvd_refl` (Dvd.lean:19) | «Делит само себя» | tests only |
| gcd with zero | — | `Nat.gcd_zero_right` (Gcd.lean:59) | «НОД по Евклиду» | proved |
| the gcd recurrence | — | `Nat.gcd_rec` (Gcd.lean:74), `Nat.gcd_def` (:52) | «НОД по Евклиду» | proved |
| gcd commutes | `Nat.gcd_comm` (NZGcd.v:239) | `Nat.gcd_comm` (Gcd.lean:109) | «НОД по Евклиду» | tests only |
| gcd divides the first | `Nat.gcd_divide_l` (NZGcd.v:599) | `Nat.gcd_dvd_left` (Gcd.lean:92) | «НОД по Евклиду» | tests only |
| gcd divides the second | `Nat.gcd_divide_r` (NZGcd.v:602) | `Nat.gcd_dvd_right` (Gcd.lean:94) | «НОД по Евклиду» | tests only |
| gcd of a number with itself | — | `Nat.gcd_self` (Gcd.lean:70) | «НОД с самим собой» | tests only |
| gcd with one | `Nat.gcd_1_r` (NZGcd.v:268) | `Nat.gcd_one_right` (Gcd.lean:137) | «НОД с единицей» | tests only |
| Euclid terminates | `Fixpoint gcd` (Init/Nat.v:306) | `termination_by` / `decreasing_by` (Gcd.lean:39) | **cannot be written** | — |
| even means remainder zero | `Nat.even_spec` (PeanoNat.v:327) | `Nat.even_iff` | «Чётно» | proved |
| odd means remainder one | `Nat.odd_spec` (PeanoNat.v:337) | — | «Нечётно» | proved |
| even or odd | `Nat.Even_or_Odd` (NZParity.v:52) | `Nat.mod_two_eq_zero_or_one` (Basic.lean:780) | «Остаток по два» | tests only |
| even plus even | `Nat.even_add` (PeanoNat.v:193) | `Nat.even_add` | «Сумма чётных» | tests only |
| even times anything | `Nat.even_mul` (PeanoNat.v:213) | `Nat.even_mul` | «Произведение с чётным» | tests only |

Trichotomy is written as five postconditions, and all five are proved.

## Lists

The number in parentheses is the line in `theories/Lists/List.v` or in the
named Lean file.

| lemma | Coq | Lean / Mathlib | function in flang | answer |
|---|---|---|---|---|
| length of an append | `List.app_length` (225) | `List.length_append` (Basic.lean:622) | «Склеить» | proved |
| one append step adds one | `List.last_length` (230) | `List.length_concat` (Basic.lean:110) | «Шаг склейки» | proved |
| length of the empty list | `List.length_zero_iff_nil` (103) | `List.length_nil` (Basic.lean:84) | «Пустой список чисел» | proved |
| length of a cons | — | `List.length_cons` (Basic.lean:89) | «Приписать в начало» | proved |
| append with empty on the right | `List.app_nil_r` (139) | `List.append_nil` (Basic.lean:612) | «Склеить с пустым справа» | proved (and the the same about length only — proved too) |
| append with empty on the left | `List.app_nil_l` (134) | `List.nil_append` (Basic.lean:609) | «Склеить с пустым слева» | tests only (the same about length only — proved) |
| append associates | `List.app_assoc` (151) | `List.append_assoc` (Basic.lean:627) | «Склеить три» | tests only (the same about length only — proved) |
| cons through an append | `List.app_comm_cons` (163) | `List.cons_append` (Basic.lean:610) | «Приписать к склейке» | tests only (the same about length only — proved) |
| length of a reverse | `List.rev_length` (1002) | `List.length_reverse` (Lemmas.lean:2431) | «Обратить» | proved |
| reverse of a reverse | `List.rev_involutive` (953) | `List.reverse_reverse` (Lemmas.lean:2484) | «Обратить дважды» | tests only (the same about length only — proved) |
| reverse of an append | `List.rev_app_distr` (941) | `List.reverse_append` (Lemmas.lean:2540) | «Обратить склейку» | tests only (the same about length only — proved) |
| length of a map | `List.map_length` (1139) | `List.length_map` (Lemmas.lean:1081) | «Отобразить» | proved |
| map over an append | `List.map_app` (1164) | `List.map_append` (Lemmas.lean:1853) | «Отобразить склейку» | tests only (the same about length only — proved) |
| map through composition | `List.map_map` (1295) | `List.map_map` (Lemmas.lean:1252) | «Отобразить дважды» | tests only (the same about length only — proved) |
| map by identity | `List.map_id` (1289) | `List.map_id` (Lemmas.lean:1108) | «Отобразить тождеством» | proved (and the the same about length only — proved) |
| fold left over an append | `List.fold_left_app` (1360) | `List.foldl_append` (Lemmas.lean:2723) | «Свернуть слева склейку» | tests only |
| fold right over an append | `List.fold_right_app` (1392) | `List.foldr_append` (Lemmas.lean:2726) | «Свернуть справа склейку» | tests only |
| membership in an append | `List.in_app_iff` (303) | `List.mem_append` (Lemmas.lean:1598) | «Есть в склейке» | tests only |
| the head belongs to the list | `List.in_eq` (272) | `List.mem_cons_self` (Lemmas.lean:367) | «Приписать в начало» — second claim | tests only |
| a cons keeps a member | `List.in_cons` (277) | `List.mem_cons_of_mem` (Lemmas.lean:389) | «Приписать к вошедшему» | tests only |
| element at index belongs | `List.nth_In` (447) | `List.getElem_mem` | «Элемент по номеру» | tests only |

Nine lemmas have a weaker spelling next to the full one: the same statement
about the length of the lists only. All nine weak spellings are proved. The
answer in the table belongs to the full spelling.

## Why a lemma is not proved

The 44 unproved lemmas have eight causes.

**1. Associativity and distributivity — four lemmas.** The kernel compares the
two sides of an equality as expressions and swaps only the two operands of one
`плюс` or `умножить`. It does not move parentheses: associativity is false for
binary64. Over `точное целое` the same equalities are proved —
[an example](manual-proofs.html#4-a-statement-without-a-function).

**2. The identity element — seven lemmas.** For the kernel `а плюс 0` and `а`
are different expressions. There is no rule «drop the zero» or «drop the one»
for a function body.

**3. Inequalities — six lemmas.** The kernel takes order from the type
`неотрицательное`: reflexivity, transitivity and «a summand is at most the sum»
are proved. It does not derive an equality from two inequalities, so
antisymmetry is not proved. The bounds of a remainder are proved when the
divisor is written as a number and not proved when it is an argument.

**4. Remainders, parity, divisibility — seven lemmas.** The kernel has no rules
about a remainder other than its bounds. «Even means remainder zero by two» is
proved: it is a definition, the postcondition coincides with the body. «The sum
of evens is even» is not.

**5. The greatest common divisor — five lemmas.** Euclid's algorithm lowers the
argument by a remainder of a division. The termination check does not
understand such a step, and the function is declared without the word
`тотальная`. Both branches of the definition are proved as postconditions; the
consequences are not.

**6. Swapping the arguments of minimum and maximum — two lemmas.** Two calls of
one function must be compared, and the kernel knows about a call only its
proved postconditions —
[Calls](what-the-kernel-accepts.html#5-calls-a-proved-postcondition-of-the-called-function-is-needed).

**7. Equality of lists — nine lemmas.** About append, reverse and map the
kernel proves the length of the result. Equality of the lists themselves is
proved in two cases: append with the empty list on the right and map with the
identity function.

**8. Membership — four lemmas.** The kernel has no link between `содержит`
(contains) and access by index.

One more lemma, «Euclid's algorithm terminates», cannot be written as a
postcondition. Termination in flang is a property of a function's definition;
the word `тотальная` answers for it.

## What follows

- An exact type proves a lot at no effort. Of the 37 proved postconditions of
  arithmetic, 17 come from the single declaration of the type `неотрицательное`.
- A definition is proved; its consequences rarely are. The kernel takes what is
  written in the function body and little of what follows from the body.
- About lists the kernel computes lengths and almost never proves equality of
  lists.

Lean and Coq prove all these lemmas because there a person writes the proof and
any induction is possible. How flang differs from them in design:
[flang for Lean and Dafny users](flang-for-lean-and-dafny-users.html).

## For language developers: how to reproduce

The files with the lemmas are in a clone of the repository:

```sh
bootstrap/flang check flang/stdlib/math-classics.flang --proof
bootstrap/flang check flang/stdlib/math-classics-lists.flang --proof
```

```
утверждений 70: доказано 37 (из них без теоремы 37, объявленным типом 17), сетка 33, объявлено, не доказано 0
утверждений 37: доказано 20 (из них без теоремы 20), сетка 17, объявлено, не доказано 0
```

With the word «сетка» (grid) the compiler names the answer «checked on tests
only».

## Next

- [What the kernel can do](what-the-kernel-accepts.html) — spellings of
  postconditions that are proved by themselves.
- [Theorems step by step](manual-proofs.html) — how to prove by hand.
- [What you are trusting](trust.html) — what stands behind the word «доказано».
