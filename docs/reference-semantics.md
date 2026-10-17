# Reference semantics in Lean

The reference semantics is an executable definition of flang in Lean 4. It lives in
`flang/proof/lean/Binary64.lean` and `flang/proof/lean/Semantics/`, and it is the yardstick of
[ADR-0136](adr/0136-a-reference-semantics-in-lean-is-the-yardstick-for-the-checker-and-the-print.md):
the interpreter, the C print and the model of the checker must agree with it.

## Numbers: `Binary64.lean`

A number is a binary64 value: not-a-number, a signed infinity, or a signed finite value counted
in units of 2⁻¹⁰⁷⁴ (so the subnormals and both zeros are ordinary values). One function,
`«округлить»`, rounds an exact non-negative rational to the nearest value with ties to even and
turns everything at or above 2¹⁰²⁴ into infinity. Addition, subtraction, multiplication, division
and remainder compute the exact result and round it once; comparison and `Object.is` equality
follow IEEE 754 and the language. `«вБиты»` and `«изБит»` convert to and from the 64-bit pattern.

Proved about the rounding, without `sorry` and on the three standard axioms:

| theorem | statement |
|---|---|
| `«окрЕд-моно»` | rounding is monotone on non-negative rationals |
| `«окрЕд-точно»`, `«окрЕд-сетка»` | a value on the binary64 grid rounds to itself |
| `«окрЕд-дважды»` | rounding twice is rounding once |
| `«окрЕд-отношение»` | equal rationals round alike, whatever the fraction |

Lean's own `Float` is opaque, so it is used only as an oracle: `Semantics/Run.lean hardware N`
draws operands from random bit patterns, the subnormal range, the overflow edge and integers
near 2⁵³ and compares every operation and `Float.ofInt` with the hardware bit for bit.

## The model rounds in binary64

`Model.lean` keeps rounding abstract: every rule theorem holds for any rounding that is exact on
small integers and monotone. Its instance is now `«Двойная»`, built from `«окр64»`, the binary64
rounding of an integer with overflow to infinity; both properties are proved. The coarse instance
is gone, and the counterexamples of `Rules.lean`, `Term.lean` and `Consistency.lean` are computed
in binary64 by the kernel.

`Semantics/Numbers.lean` ties the model to the reference through `«вД64»`, the embedding of a model
number into binary64:

| theorem | statement |
|---|---|
| `«окр64-это-д64»` | the model rounding of an integer is the binary64 rounding |
| `«вД64-неБольше»`, `«вД64-меньше»`, `«вД64-равен»` | order and equality are those of binary64 |
| `«вД64-отр»` | negation is binary64 negation |
| `«вД64-плюс»` | addition is binary64 addition unless both summands are minus zero |
| `«умножить-кон-кон»` | a non-zero product of finite numbers is the binary64 product |
| `«остаток-кон-кон»` | the remainder of finite numbers is the binary64 remainder unless it is a zero with the sign of a negative dividend |

What the model still does not distinguish is the sign of a zero result: `«знак-нуля-суммы»`
shows `−0 + −0`, and the same holds for `0 × −5` and `−5 остаток от 5`. Equality is `Object.is`,
so such a zero is not equal to `0` in the language while the model says it is.

## The language core: `Semantics/Eval.lean`

Values are numbers, strings, flags, nothing, lists, records and variants; a function value is the
variant tagged with the function name, as in the interpreter. An exact integer is a list of
numbers, its digits in base 2²², exactly as at run time. The expression tree is the one `flang ast`
prints: literal, name, binary operation, `если`, `пусть`, call, `разбор` with the patterns `пусто`,
head and tail, variant, literal and `любое`, `свёртка`, `отобразить`, `отфильтровать`, list,
record, constructor, field, the built-in forms and function references with application.

`«выч» P n ρ e` evaluates `e` in the environment `ρ` with `n` units of fuel; fuel bounds the depth
of evaluation, so the definition is total. A call evaluates the arguments, binds them to the
parameters in a fresh environment, evaluates the body and checks every postcondition, as the
interpreter does. A run ends with a value, an error with its code, out of fuel, or outside the
reference (exact fractions, `к числу`, `хеш256`).

## Theorems about evaluation

| theorem | statement |
|---|---|
| `«топливо-моно»` | an answer other than out of fuel stays the same with more fuel |
| `«подст-верна»` | substituting values for names equals evaluating in an environment with those values |
| `«окружение-неважно»` | only the free names of an expression matter |
| `«подстВыр-верна»` | substituting argument expressions is sound when no binder captures their names |
| `«развёртка-доводами»` | a call that evaluates to `v` can be replaced by its body with the argument expressions put in place of the parameters: the result is `v` again |
| `«развёртка-без-подстановки-ложна»` | unfolding without putting the arguments in place changes the value |
| `«развёртка-с-захватом-ложна»` | unfolding where a binder of the body captures an argument name changes the value |

`«развёртка-доводами»` is the reference form of the unfolding move of the checker: it needs the
count of arguments to match, the free names of the body to be its parameters, and no argument
name to be bound inside the body. The last two theorems show that each condition is needed.

## Agreement with the binary

`bootstrap/flang run-script lean:reference` runs `flang/proof/lean/reference.fscript`:

1. builds `Binary64.lean`, `Semantics/Eval.lean` and `Semantics/Json.lean`;
2. prints every file of `flang/proof/examples` with `flang ast` and evaluates every `пример`
   with the reference; an example of a file the binary takes must give the expected value;
3. generates a program of four hundred number expressions over literals at the corners of
   binary64, runs it with the binary and with the reference, and compares the printed values
   text for text, which needs the reference to print numbers as the binary does;
4. compares the binary64 operations with the hardware.

The plan fails on any disagreement. The same step runs in the Lean crosscheck workflow.

## Outside the theorems

- The model world is not yet built from the reference: the checker's acceptance is proved in
  every world of the model, and the facts that tie a world to a program are still assumed.
- The unfolding of the model (`«развёртка?»`, `«развернутьВызов?»`) is proved on model terms;
  the translation of model terms into the reference tree, which would carry it over, is not written.
- The moves of the record (`ход …`) have no theorem in either semantics.
- Exact fractions, parsing numbers from strings and hashing are outside the reference.
- The sign of a zero result is not modelled.
- Reading the text of a record and of the `flang ast` output is trusted.
