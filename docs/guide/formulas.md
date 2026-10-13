[Back to README](../../README.md) · [Documentation index](../README.md)

# A formula with quantifiers or in LaTeX: write it, translate it, have the kernel judge it

A flang statement can be written in the usual mathematical notation — with
quantifiers or in LaTeX — and turned into a flang statement that the kernel judges.
And back: every flang statement that fits the notation prints in both notations.
The translator stands outside the trusted base: what you trust is the kernel's word,
not the translator. The decision and its limits are in
[ADR-0106](../adr/0106-a-formula-enters-and-leaves-through-an-untrusted-notation-translator.md).

## How to call it

```
bootstrap/flang run-script formula:read '∀ x ∈ ℤ, ∀ y ∈ ℤ, x + y = y + x'
bootstrap/flang run-script formula:read --latex '\forall x \in \mathbb{Z},\ \forall y \in \mathbb{Z},\ x + y = y + x'
bootstrap/flang run-script formula:print flang/stdlib/fmath.flang
bootstrap/flang run-script formula:probes
bootstrap/flang run-script formula:round-trip
```

`formula:read` also takes `--name <name>` (the statement's name) and
`--out <file.flang>` (keep the translation; without it the translation goes to a
temporary directory and is removed). The report is printed in Russian, like the
rest of the toolchain.

## What the translation prints

```
запись с кванторами: ∀ x ∈ ℤ, ∀ y ∈ ℤ, x + y = y + x
LaTeX: \forall x \in \mathbb{Z},\ \forall y \in \mathbb{Z},\ x + y = y + x
перевод на flang (вне доверенной основы; судит ядро, ADR-0106):
модуль «Formula»

примечание "ℤ читается как «целое»: отрезок [−(2⁵³−1), 2⁵³−1], а не всё ℤ; переполнение уводит в «число»"

утверждение «формула»
  для всех «x»: целое
  для всех «y»: целое
  утверждаем («x» плюс «y») равен («y» плюс «x»)

слово ядра (flang check --proof), код 0:
  утверждение «формула» — доказано сведением цели с телом функции: …
```

Exit code: 0 — the kernel accepted the translation (whether it is proved or
"declared, not proved" is in the kernel's word); 1 — the formula did not read (a
`FLANG_FORMULA_*` code) or the kernel refused the translation (`FLANG_FORMULA_KERNEL`).

## The notation

| meaning | quantifiers | ASCII | LaTeX | flang |
|---|---|---|---|---|
| for all | `∀ x ∈ ℤ,` | `forall x in ZZ,` | `\forall x \in \mathbb{Z},` | `для всех «x»: целое` |
| a flang type | `∀ т : строка,` | same | `\forall \text{т} : \text{строка},` | `для всех «т»: строка` |
| such that | `∀ y ∈ ℤ \| y > x,` | same | `\mid` | `таких что (…)` |
| there is | `∃ m, P` | `exists m, P` | `\exists m,\ P` | `есть такой «m», что (P)` |
| with a witness | `∃ m := a, P` | same | `\exists m := a,\ P` | `есть такой «m», а именно «a», что (P)` |
| and, or, not | `∧ ∨ ¬` | `/\ \/ ~`, `and or not` | `\land \lor \lnot` | `и притом`, `или`, `не` |
| implies | `→` | `->`, `=>` | `\to`, `\implies` | `если A то B иначе да` |
| iff | `↔` | `<->` | `\leftrightarrow`, `\iff` | `A равен B` |
| comparisons | `= ≠ < ≤ > ≥` | `= != < <= > >=` | `= \neq < \leq > \geq` | `равен`, `не равен`, `меньше`, … |
| arithmetic | `+ − · /` | `+ - * /` | `+ - \cdot /`, `\frac{a}{b}` | `плюс`, `минус`, `умножить на`, `делить на` |
| power | `x^2` | same | `x^{2}` | `«x» умножить на «x»` |
| length | `длина(л)` | same | `\text{длина}(\text{л})` | `длина «л»` |
| a call | `Счёт(л, 1)` | same | `\text{Счёт}(\text{л}, 1)` | `«Счёт» от «л» и 1` |
| a field | `п.смертен` | same | `п.\text{смертен}` | `«п».«смертен»` |
| true, false | `⊤ ⊥` | `true false` | `\top \bot` | `да`, `нет` |

Carriers after `∈`: `ℕ` is `точное целое` (no ceiling), `ℤ` is `целое` (a
**segment** [−(2⁵³−1), 2⁵³−1], not all of ℤ), `ℚ≥0` (`\mathbb{Q}_{\geq 0}`) is
`точное дробное`. There is no bare `ℚ`: fractions in the language are non-negative.
`ℝ` and `ℂ` are refused. Any other type is written after a colon exactly as in flang:
`∀ л : список «Письмо», …`.

A name of several letters, with a blank, or equal to a word of the notation goes in
guillemets: `«предмет посылки 2»`. In LaTeX a name of several letters is written only
as `\text{…}`: there `xy` reads as a product, and the translator refuses it.

## What the notation does not read, and why that is a refusal

An ambiguous formula is not read by guessing; it is refused with a code and a hint:

| formula | code | message (Russian, abridged) |
|---|---|---|
| `x > 0 ∧ x < 5 ∨ x = 7` | `FLANG_FORMULA_AMBIGUOUS` | «∧» and «∨» without parentheses are ambiguous |
| `x = x = x` | `FLANG_FORMULA_AMBIGUOUS` | a chain of comparisons is ambiguous |
| `A → B → C` | `FLANG_FORMULA_AMBIGUOUS` | a chain of «→» is ambiguous |
| `x / y · x` | `FLANG_FORMULA_AMBIGUOUS` | «·» or «/» after «/» is ambiguous |
| `2x` | `FLANG_FORMULA_AMBIGUOUS` | multiplication without a sign does not read |
| `∀ x ∈ ℝ, …` | `FLANG_FORMULA_CARRIER` | there is no ℝ: «число» is an IEEE-754 double |
| `∃ y ∈ ℤ, …` | `FLANG_FORMULA_QUANTIFIER` | «∃» has no carrier in flang: the kernel infers the type |
| `n^n` | `FLANG_FORMULA_POWER` | flang has no exponentiation |
| `-x` | `FLANG_FORMULA_MINUS` | an expression has no unary minus in flang |
| `\sqrt{x}` | `FLANG_FORMULA_LATEX` | the command \sqrt is outside the LaTeX subset |

The full list of probes with exact messages is `flang/foreign/formula/probes.tsv`.

## The kernel judges the translation, not the formula

The translation is ordinary flang source. The kernel may prove it, leave it
unproved, or refuse it:

```
bootstrap/flang run-script formula:read '∀ x ∈ ℕ, ∀ y ∈ ℕ, (x + y)^2 = x^2 + x · y + y · x + y^2'
  → proved
bootstrap/flang run-script formula:read '∀ x ∈ ℤ, ¬(x < x)'
  → declared, not proved
bootstrap/flang run-script formula:read '∀ x ∈ ℕ, ∀ y ∈ ℕ, (x + y)^2 = x^2 + 2 · x · y + y^2'
  → FLANG_TYPE: «mul»: точное целое и число не смешиваются
```

The last refusal is not a translator bug: the literal `2` in flang is a `число`, not
a `точное целое`, and the kernel says so. A literal over ℕ is written as a nullary
function (ADR-0095).

## Back: a flang statement in both notations

```
bootstrap/flang run-script formula:print flang/stdlib/fmath.flang
утверждений 4, напечатано 4
утверждение «сумма неотрицательных неотрицательна»
  ∀ а : неотрицательное, ∀ б : неотрицательное, а + б ≥ 0
  \forall \text{а} : \text{неотрицательное},\ \forall \text{б} : \text{неотрицательное},\ \text{а} + \text{б} \geq 0
```

`formula:round-trip` walks every `утверждение` in the tree: prints each in both
notations, reads the printout back, translates it into flang and compares the
compiler's own parse tree (`flang ast`) with the original — without file positions
and the name. Converged — the printing is honest; did not fit the notation — the
reason is named; diverged — the plan is red. The run of 13 October 2026: 129 of 137
converged, 8 outside the notation (a variant constructor and `соединить … по …`),
0 diverged; 19 minutes. Files named after the command limit the walk to them.
