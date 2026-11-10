# Proofs: why and how

## A proof versus a test

A test checks the inputs you thought of. A proof answers for all inputs at
once. In flang you write both right in the function: `пример` (example) is a
unit test, `обеспечивает` (ensures) is a postcondition.

```flang
модуль «Скидка»

тотальная функция «Цена со скидкой»
  принимает цена: неотрицательное, скидка: неотрицательное
  требует «скидка не больше цены» скидка не больше цена
  возвращает число
  обеспечивает «в минус не уходим» результат не меньше 0
  пример «сто минус десять»
    дано цена равно 100
    дано скидка равно 10
    ожидается 90
  цена минус скидка
```

```
$ flang check --proof skidka.flang
  постусловие «в минус не уходим» функции «Цена со скидкой» — доказано по
  объявленным типам аргументов: цель сведена правилом «неотрицательность по
  построению» — утверждение обо ВСЕХ входах, а не о написанных; теоремы при
  нём нет и не нужно
```

The example speaks about one input: 100 and 10. The line «доказано» (proved)
speaks about any price and any discount not greater than the price ("a
statement about ALL inputs, not the written ones; there is no theorem and none
is needed"). It was proved by the prover, the part of the compiler its output
calls «ядро» (kernel); all you supplied were the types and `требует`
(requires).

## What "proved" means

**True for all inputs, not "no bug found".** The prover answers every
postcondition with one of three words: «доказано» (proved), «сетка N» (passed
only on N examples) or «объявлено, не доказано» (declared, not proved). Only
the first counts; the other two stay as a run-time check. All three on live
output: [How a proof works](how-proofs-work.html).

**What is proved costs nothing at run time.** The compiler removes the check of
a proved postcondition from the generated code.

**Two programs agreed.** `flang check <file> --proof --record <record>` writes
the proof to a file, and a separate C program re-checks every step without the
compiler — [The proof record](record-format.html).

**There are no axioms.** An axiom is a statement accepted without proof; Coq
and Lean let you declare them, and people do. The flang prover has no way to
declare one. A command that reads its source checks this:

```
$ flang io flang/scripts/kernel-forgeries.fscript --plan 'Аксиом ноль' --trust
… аксиом ноль, нарушений 0
```

("zero axioms, 0 violations"). The price: without the law of excluded middle
some classical statements cannot be proved. For programs this rarely matters:
they compute.

**There is no external solver.** The prover has twenty rules, each one can be
read in full ([The kernel specification](../spec-proof.html), in Russian); refusals call them
by name. No SMT solver is taken as a judge: that would mean trusting
correctness to hundreds of thousands of lines of someone else's code.

## What "proved" does not mean

> A proof says the code matches the postcondition. It does not say the
> postcondition expresses what you meant.

If the postcondition is written wrong, the code will correctly do the wrong
thing. A human reads the postcondition. You also have to trust the prover's
rules, the compiler under it, and the hardware. Real cases and the full list of
limits: [What is proved and what is not](what-is-proved.html).

## When the prover did not manage

Most postconditions need no theorem: the prover derives them from the types and
the shape of the code. The rest you can:

- rewrite so that the prover takes it by itself —
  [What the kernel proves by itself](what-the-kernel-accepts.html);
- prove by hand, with a step-by-step theorem as in Coq or Isabelle —
  [Proofs by hand](manual-proofs.html);
- leave as a run-time check.

A refusal of a theorem you wrote is explained on
[The kernel refused: whose mistake is it](proof-refused.html).

## How much is proved in the language itself

The compiler, the standard library and the examples are written in flang and
checked by the same prover. Termination: {{носители.композиция}} functions have
no recursion at all, and in {{носители.структура}} it runs over a part of the
input. Postconditions proved: **{{утверждения.доказано}} of
{{утверждения.высказано}}**. The full breakdown and what stands behind the rest:
[What is proved and what is not](what-is-proved.html).

## What it costs

Twenty library functions, picked by a fixed stride over the list of
declarations so that convenient ones could not be chosen
(`docs/benchmarks/proof-cost/functions/`). Each got both tests and a proof:

| | tests | proof |
|---|---:|---:|
| Lines | 390 | 196 |
| Time | 7 min 49 s | 9 min 39 s |
| Real bugs found | **4** | 0 |

Today a proof costs more than tests and finds fewer bugs. But it is written
once and covers all inputs, while tests have to be extended with every change
to the code. The goal of the language:

> A proof must cost less than the tests it replaces.

## Next

1. [How a proof works](how-proofs-work.html) — termination, `требует`,
   `обеспечивает` and the three answers on live output.
2. [The kernel refused: whose mistake is it](proof-refused.html) — how to read
   a refusal.
3. [What the kernel proves by itself](what-the-kernel-accepts.html) — which
   postconditions pass without a theorem.
4. [Proofs by hand](manual-proofs.html) — theorems, induction, laws.
5. [The proof record](record-format.html) — what the independent program
   checks.
6. [What is proved and what is not](what-is-proved.html) — the limits.
7. [The Coq and Lean classics](mathematics.html) — a comparison on seventy-five
   lemmas.
