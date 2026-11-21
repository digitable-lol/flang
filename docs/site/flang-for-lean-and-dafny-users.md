# flang for Lean and Dafny users

This page answers the question: how does a proof in flang differ from Lean 4
and Dafny, and when to pick which tool.

In short: flang is closer to Dafny than to Lean. You write preconditions and
postconditions on functions, and the compiler looks for the proof itself. It
does not reach the level of Lean: it proves less, and less independent code
checks it.

| Task | What to take |
| --- | --- |
| Formalise mathematics, prove an arbitrary theorem | Lean 4 |
| Prove properties of an algorithm with loops and a heap, ready to hint the solver | Dafny |
| Write application code and check bounds, lengths, money without hand-written proofs | flang |

## One example in three languages

The function returns the larger of two non-negative integers. We prove three
facts: the result is at least the first argument, at least the second, and the
order of arguments does not matter.

flang, file `docs/examples/proofs/largest.flang`:

```flang insert docs/examples/proofs/largest.flang
модуль «Largest»

тотальная функция «Наибольшее»
  принимает а: точное целое, б: точное целое
  возвращает точное целое
  обеспечивает «не меньше первого» результат не меньше а
  обеспечивает «не меньше второго» результат не меньше б
  если а больше б
    то а
    иначе б

утверждение «наибольшее перестановочно»
  для всех а: точное целое и б: точное целое
  утверждаем («Наибольшее» от а и б) равен («Наибольшее» от б и а)
```

```bash
flang check largest.flang --proof --strict; echo "код $?"
```

```
постусловие «не меньше первого» функции «Наибольшее» — доказано по объявленным типам аргументов …
постусловие «не меньше второго» функции «Наибольшее» — доказано по объявленным типам аргументов …
утверждение «наибольшее перестановочно» — доказано по объявленным типам аргументов …
код 0
```

The file has no proofs: the kernel derived all three facts by itself. `точное
целое` (exact integer) is a non-negative integer with no upper bound, like `Nat`
in Lean and `nat` in Dafny.

Lean 4, file `docs/examples/proofs/largest.lean`:

```lean
def largest (a b : Nat) : Nat :=
  if a > b then a else b

theorem largest_ge_left (a b : Nat) : largest a b ≥ a := by
  unfold largest; split <;> omega

theorem largest_ge_right (a b : Nat) : largest a b ≥ b := by
  unfold largest; split <;> omega

theorem largest_comm (a b : Nat) : largest a b = largest b a := by
  unfold largest; split <;> split <;> omega
```

In Lean the programmer proves each theorem: unfold the definition, split the
branches of `if`, close the arithmetic with the `omega` tactic. The tactics
produce a proof object, and the Lean kernel checks it in full.

Dafny, file `docs/examples/proofs/largest.dfy`:

```dafny
function Largest(a: nat, b: nat): nat
  ensures Largest(a, b) >= a
  ensures Largest(a, b) >= b
{
  if a > b then a else b
}

lemma LargestCommutes(a: nat, b: nat)
  ensures Largest(a, b) == Largest(b, a)
{
}
```

In Dafny the text is almost the same as in flang: `ensures` corresponds to
`обеспечивает`, a `lemma` with an empty body to `утверждение`. The SMT solver Z3
looks for the proof.

## Lean 4 and flang by property

| Property | Lean 4 | flang |
| --- | --- | --- |
| The proof as an object | yes: a term that can be stored and checked again | a record of steps exists (`--record`), but not every proof can be repeated from it |
| A small kernel | yes: it only checks the types of terms | the kernel is about 11 thousand lines inside the compiler |
| Independent re-check | yes: third-party kernel implementations check the term too | two separate programs; on the comparison set 30 proofs of 55 are repeated |
| Is the checker itself checked | the kernel is small; people read it and reimplement it independently | each of the 93 kinds of proof steps has a Lean lemma; no theorems about the kernel code |
| Axioms | three standard ones; `#print axioms` shows what a theorem rests on | no way to declare an axiom; the assumptions are listed on [What you are trusting](trust.html) |
| Logic | dependent types, classical if you want | a closed list of rules over pre- and postconditions |
| Quantifiers | any, including over functions and types | «for all» over the arguments; inside, only over list elements |
| Induction | over any inductive type, mutual, over a decreasing measure | over a list, a string, your own type, and `неотрицательное` with step 1 |
| Statements for any type | yes | no: a statement is written for a concrete type |
| Floating-point numbers | `Float` is opaque to the kernel: you can compute, not prove properties | the rules account for rounding, NaN, −0 and the 2⁵³ bound |

The last row is where flang is strong. Its `число` (number) is binary64, and
the kernel will not prove over it what rounding breaks. The file
`docs/examples/proofs/float-sum.flang` declares number addition a monoid:

```flang insert docs/examples/proofs/float-sum.flang
модуль «Float sum»

тотальная функция «Сложить числа»
  принимает а: число, б: число
  возвращает число
  пример «два и три»
    дано а равно 2
    дано б равно 3
    ожидается 5
  а плюс б

моноид «Сумма чисел»
  носитель число
  операция «Сложить числа»
  единица 0
```

```bash
flang check float-sum.flang --proof
```

```
закон «Сумма чисел — ассоциативность» — ядром НЕ доказан и доказан не будет:
носитель — двоичное «число» …, где сложение и умножение округляют, сумма не
сочетательна выше 2⁵³, а ноль не нейтрален к минус нулю …
```

binary64 addition is not associative, and the kernel names the reason.
«Носитель» in the output is the type of the monoid's values. The same monoid
over `точное целое` is in `docs/examples/proofs/exact-sum.flang`, and all three
of its laws are proved.

## Dafny and flang by property

| Property | Dafny | flang |
| --- | --- | --- |
| Who looks for the proof | the SMT solver Z3 | a closed list of rules in the compiler |
| What you trust | the translation to Boogie, Boogie and Z3 | the proof kernel and the compiler |
| Independent re-check | none built in | partial; the report gives the share |
| Checking time | depends on the solver, can be unstable | no solver with a time limit: the same text gives the same answer |
| Strength | more: quantifiers, loop invariants, the heap | less: what fits no rule stays unproved |
| Hints | `assert`, `lemma`, `calc`, invariants | `требует`, a step-by-step `теорема` |
| An unproved postcondition | a verification error | checked at run time; running needs the key `--trust` |

## What flang proves by itself

The measure is a set of 60 small statements that Lean 4 closes with standard
tactics. Lean proves all 60. flang:

| Outcome | Tasks |
| --- | ---: |
| proves by itself | 33 |
| proves after a rework: a theorem, another type, the property written as a postcondition | 18 |
| does not prove | 9 |

By itself flang takes integer arithmetic, bounds, list lengths, case analysis
over variants. It derives the associativity of list append by induction with no
hints. File `docs/examples/proofs/append-numbers.flang`:

```flang insert docs/examples/proofs/append-numbers.flang
модуль «Append numbers»

тотальная функция «Склеить»
  принимает первый: список числа, второй: список числа
  возвращает список числа
  разбор первый
    случай пусто
      то второй
    случай голова и хвост
      то приписать голова к («Склеить» от хвост и второй)

утверждение «склейка сочетательна»
  для всех а: список числа и б: список числа и ц: список числа
  утверждаем («Склеить» от («Склеить» от а и б) и ц) равен («Склеить» от а и («Склеить» от б и ц))
```

```
утверждение «склейка сочетательна» — доказано индукцией по «список»: база 1 случай,
шаг при допущении на частях (1 случай) …
```

## What flang does not prove

Reversing a list twice gives the original list. Lean proves it by induction
with a helper lemma. flang does not. File `docs/examples/proofs/reverse.flang`:

```flang insert docs/examples/proofs/reverse.flang
модуль «List reversal»

тотальная функция «В конец»
  принимает элементы: список числа, последний: число
  возвращает список числа
  разбор элементы
    случай пусто
      то [последний]
    случай голова и хвост
      то приписать голова к («В конец» от хвост и последний)

тотальная функция «Обратить»
  принимает элементы: список числа
  возвращает список числа
  разбор элементы
    случай пусто
      то пустой список
    случай голова и хвост
      то «В конец» от («Обратить» от хвост) и голова

утверждение «двойное обращение возвращает список»
  для всех а: список числа
  утверждаем («Обратить» от («Обратить» от а)) равен а
```

```
утверждение «двойное обращение возвращает список» — объявлено, не доказано: ни теоремы, ни примеров …
```

The statement is true. «Не доказано» means the kernel found no rule.

## What cannot be written in flang

A statement for any element type. A function with a type parameter can be
written; a statement about it cannot. File
`docs/examples/proofs/unsupported/append-any-type.flang`:

```flang refused insert docs/examples/proofs/unsupported/append-any-type.flang
модуль «Append of any type»

тотальная функция «Склеить» от «А»
  принимает первый: список «А», второй: список «А»
  возвращает список «А»
  разбор первый
    случай пусто
      то второй
    случай голова и хвост
      то приписать голова к («Склеить» от хвост и второй)

утверждение «склейка сочетательна»
  для всех а: список «А» и б: список «А» и ц: список «А»
  утверждаем («Склеить» от («Склеить» от а и б) и ц) равен («Склеить» от а и («Склеить» от б и ц))
```

```
FLANG_UNKNOWN_NAME в файле append-any-type.flang, строка 13, столбец 12: неизвестный тип «А»
…
```

The line `для всех` (for all) cannot introduce a type parameter. The same
statement for a list of numbers is proved above.

The Ackermann function. Its termination follows from an order on pairs of
arguments, while flang looks for one argument that gets smaller on every call.
File `docs/examples/proofs/unsupported/ackermann.flang`:

```flang refused insert docs/examples/proofs/unsupported/ackermann.flang
модуль «Ackermann»

тотальная функция «Аккерман»
  принимает м: число, н: число
  возвращает число
  если м не больше 0
    то н плюс 1
    иначе если н не больше 0
      то «Аккерман» от (м минус 1) и 1
      иначе «Аккерман» от (м минус 1) и («Аккерман» от м и (н минус 1))
```

```
FLANG_NOT_TOTAL в файле ackermann.flang, строка 9, столбец 10: в цикле «Аккерман» нет
аргумента, который убывает на каждом обходе …
```

Without the word `тотальная` (total) the function passes the check and runs.
Its termination stays unproved.

## Next

- [What you are trusting](trust.html) — what stands behind the word «доказано».
- [When it is not proved](proof-refused.html) — how to rework a postcondition so
  that the kernel takes it.
- [Comparison on classic lemmas](mathematics.html) — 75 lemmas from Coq and
  Lean textbooks.
