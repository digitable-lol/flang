# Proofs: why and how

## A proof versus a test

A test covers the inputs you **thought of**. A proof covers **all** inputs at
once, including the ones nobody thought of.

```
example «Two doubled»            ← one input
  given n equals 2
  expected 4

ensures «twice the input» result equals (2 times n)    ← all inputs
```

In flang you write both. An `example` (`пример`) is a unit test inside the
function; an `ensures` (`обеспечивает`) is a postcondition, and the **prover** —
the part of the compiler that proves postconditions, «ядро» in its output —
proves it for every input. Tests have to be added as the code changes; a proof
is written once.

## Termination

`total` (`тотальная`) before a function says it stops on every input. The
compiler **proves** it and rejects the file if it cannot.

There are five ways the compiler proves termination; `flang check --proof`
names the way for each function. Across the repository:

| How termination is proved | Functions |
|---|---:|
| No recursion at all | {{носители.композиция}} |
| Recursion on a part of the input (tail, field) | {{носители.структура}} |
| Counting down a `неотрицательное` number | {{носители.точныйШаг}} |
| Counting down a plain number, with a run-time check | {{носители.постоянныйШаг}} |
| A declared measure (`убывает`), with a run-time check | {{носители.мера}} |

In the last two rows termination is not fully proved: a floating-point number
does not always change when you subtract one, so the compiler adds a run-time
check. The report counts these checks separately —
**{{сторож.мест}} places in {{сторож.функций}} functions**. The numbers come
from a full run over the repository (`bootstrap/flang run-script
numbers:build`, several hours) and can lag behind the code; how each one is
measured is on [What is proved and what is not](what-is-proved.html).

## Three answers, not two

For each postcondition the prover gives one of three answers:

**Proved** («доказано») — true for all inputs. In the repository:
**{{утверждения.доказано}} of {{утверждения.высказано}}**.

**Checked only on examples** («сетка N») — the examples pass, but there is no
proof. The report line ends with «Это не доказательство» (this is not a proof).

**Declared, not proved** («объявлено, не доказано») — the prover had no rule for
it and there are no examples. The condition is checked at run time, on the
inputs that arrive.

If an example breaks a postcondition, you do not get an answer at all:
`flang check` fails with `FLANG_EXAMPLE` and `FLANG_PROPERTY` and names the
example. That is a counterexample you wrote yourself.

When the prover does not prove a postcondition on its own, you can **write the
proof by hand**, as in Coq or Isabelle. A `теорема` (theorem) is written in
steps: `дано` (given), `утверждаем` (we claim), `затем … по свойству «…»` (then
… by property …), `индукция по …` (induction on …), `следовательно доказано`
(hence proved). It reads like Isar in Isabelle, and the prover checks each step;
it searches for nothing. There are 287 such theorems in the repository, 55 of
them in the standard library (`grep -rac '^\s*теорема ' flang
--include='*.flang'`). Most postconditions need no theorem: the proof report
shows, as a separate number, how many were proved **without a written proof**.

## No axioms

An axiom is a statement accepted without proof. Coq and Lean have axioms and
use them: the law of excluded middle, the axiom of choice. The machine does not
check them.

**The flang prover has none.** It has no way to declare an axiom, so a separate
script reads the whole source of the prover and fails if the word «аксиома»
appears there except in the named reasons that explain why a rule is a
theorem. The same script checks that the list of deliberately broken proofs
matches the files in `flang/test/fixtures`, and a second plan checks that the
prover rejects each of them:

```
flang io flang/scripts/kernel-forgeries.fscript --plan 'Аксиом ноль' --trust
flang io flang/scripts/kernel-forgeries.fscript --plan 'Подделки остаются недоказанными' --trust
```

Both exit with 0: «аксиом ноль, нарушений 0» and «подделки отвергнуты: 36 файлов
каталога». `--trust` is needed because the script itself has unproved
postconditions.

The proof is also re-checked by a separate program. `flang check <file> --proof
--record <record>` writes the proof to a file, and a C program,
`flang/proof/checker/checker.c`, re-checks every step without the compiler.
`bootstrap/flang io scripts/provability.fscript --plan Verdict --timeout 900000`
runs it over the compiler's own proofs and answers «ДОКАЗУЕМ» (provable): 650 of
650 steps re-checked (100.00 %), 575 deliberately broken proofs rejected, 274
correct ones accepted. The 100 % is about the compiler's own proof records, not
about the code it generates. More on
[What is proved and what is not](what-is-proved.html).

The price: without the excluded middle some classical statements cannot be
proved. For programs this rarely matters: programs compute.

### What you still trust

Fewer things, but not nothing: that the prover's rules are correct, that the
prover implements them correctly, that the compiler under it is correct, that
the hardware computes correctly. This is the trusted base (TCB).
`bootstrap/flang io scripts/four-coverages.fscript --plan Measure --timeout 900000`
lists the known soundness problems by name.

## How the prover is built

The prover has thirteen decision rules, each short enough to read in one
sitting; refusals name them. The count comes from the prover itself
(`grep -c 'тотальная функция «Правило' flang/self/proof-kernel.flang` → 13).
Each rule proves one shape of goal: non-negativity, an upper bound, equality
after substituting an assumption, order, strict order, membership, a prefix,
order of neighbouring elements, an equality decided by computing closed parts,
a property of all elements. Three rules do not look at the shape: "the goal is
an assumption" matches the goal against an assumption, "contradictory
assumptions" closes an unreachable case, and "unfold" expands a definition by
its constructor. Besides the rules, the prover computes a closed expression
instead of deriving it, and splits a goal on an `если` condition.

flang does **not use an external SMT solver as the judge**. Trusting one would
mean trusting hundreds of thousands of lines of someone else's code.

## What a proof does not say

> **A proof says the code matches the specification. It does not say the
> specification is what you meant.**

If the postcondition is wrong, the code will correctly do the wrong thing. No
prover fixes that; a person has to read the postcondition. A real case from the
standard library is on [What is proved and what is not](what-is-proved.html).

## What it costs

Twenty ordinary library functions, picked at a fixed step through the list of
declarations (out of {{библиотека.функций}}) so that convenient ones could not
be chosen; each got both tests and a proof. The numbers come from the
[proof-cost benchmark](../benchmark-proof-cost.html).

| | tests | proof |
|---|---:|---:|
| Lines | 390 | 196 |
| Time | 7 min 49 s | 9 min 39 s |
| Real bugs found | **4** | 0 |

So: **a proof costs more than tests and finds fewer bugs.**

How many of those twenty functions the prover covers is counted mechanically,
by replacing each body with a stub:

```
bootstrap/flang run-script proofs:count-20
```

It reports that something is proved for **14 functions of 20**, and something
useful for **10**. By postcondition: 11 useful, 6 weak (also proved for a stub
body, so true of any function with that signature), 1 free (the body copied into
the postcondition), 2 not checked.

The goal of the language is one line:

> **A proof must cost less than the tests it replaces.**

Elsewhere a proof costs 5–20 times more than tests, which is why only OS
kernels, cryptography and avionics are proved. If a proof becomes cheaper than
tests, programmers can afford it everywhere: it is written once and covers all
inputs.

## Further

- [The prover refused: whose mistake is it](proof-refused.html) — what to do with each refusal
- [What comes next](roadmap.html) — where the proof work stands
- [Prover specification](../spec-proof.html) — in Russian; the rules in full
- [The price of a proof, measured](../benchmark-proof-cost.html) — in Russian; the report with numbers
