# Proofs: why and how

## A proof against a test

A test covers the inputs you **thought of**. A proof answers about **all** of
them at once, including the ones nobody thought of.

```
example «Two doubled»            ← one input
  given n equals 2
  expected 4

ensures «twice the input» result equals (2 times n)    ← all inputs
```

Both lines stay in the language. The difference is that examples are written
forever, and a proof is written once.

## What happens to termination

`total` is a promise that the function finishes on every input. The compiler
**checks** it and refuses the file if it cannot prove it.

There are five carriers of that promise, and each leaves a trace in the report printed by `flang check --proof`:

| Carrier | Functions |
|---|---:|
| By composition — no recursion at all | {{носители.композиция}} |
| By structure — walking part of a value | {{носители.структура}} |
| By an exact step over a natural number | {{носители.точныйШаг}} |
| By a constant step with a run-time check | {{носители.постоянныйШаг}} |
| By a declared measure with a run-time check | {{носители.мера}} |

The last two lines are separated honestly: termination there is not proved all
the way, and a run-time check picks up the difference. The report shows that as
its own number — **{{сторож.мест}} sites across {{сторож.функций}} functions** — instead of folding it into
the total.

## Three answers, not two

The kernel answers in three different ways, and mixing them is not allowed:

**Proved by the kernel** — the claim holds for all inputs. There are **{{утверждения.доказано}} of {{утверждения.высказано}}**.

**On a grid** — a set of values was run, no violation found. The report line for
this ends with the words **"this is not a proof"**, and it ends that way on
purpose: exhausting a finite set proves nothing.

**Stated, not proved** — the kernel ran out of rules. The claim is then checked
at run time, on the inputs that arrive.

There is a fourth answer, and it is the most valuable: **VIOLATED** — a
counterexample was found, and it is shown. Not "could not prove it" but "here is
an input on which your claim is false".

## Zero axioms — what that means

An axiom is what you accept without proof. Coq and Lean have axioms and use
them: excluded middle, the axiom of choice. Each one is something the machine
**does not check**.

**flang has zero**, and the list is provably empty: a separate test holds it
there, so one cannot be added quietly.

The price is honest: without excluded middle some classical statements cannot be
proved. For a programming language that turned out to be a lucky coincidence — we
talk about programs, and programs compute.

### What zero axioms does not buy

You still trust something, just less of it: that the three decision rules are
written correctly, that the kernel implementation is correct, that the compiler
underneath it is correct, that the hardware computes correctly.

This is not theory. **In one day six holes were found in those very rules**,
where the kernel printed "proved for ALL inputs" on claims a run refutes with a
counterexample.

All six are closed, and a check now stands **over the whole class**: if the
report said "for all inputs", a run must fail to find a counterexample. It is
checked on every claim in the repository, not on the ones somebody remembered.

## How the kernel is built

Three decision rules, each readable in one sitting. Plus a fourth move in
reduction: **a closed expression is a value, so compute it** rather than derive
it.

Proof **search** stands apart, and how it is built matters: it **believes
nothing**. It only proposes, and the kernel re-checks everything. That is why
search can be as brazen as you like — a model, even — without costing rigour.

The same reasoning explains why we **do not wire in an external solver as the
judge**. Trusting one means handing correctness to two hundred thousand lines of
somebody else's code. As a hint-giver it is useful. As a source of truth it is
not.

## What a proof does not say

The most important thing on this page, and usually the unsaid one.

> **A proof says the code matches the specification. It says nothing about
> whether the specification expresses what you meant.**

If the postcondition is wrong, the code will correctly do the wrong thing. That
is the single reason formal methods did not take over the industry in fifty
years, and no kernel repeals it.

## What it costs

Whether the language is worth building depends on this answer, so the price is
measured, not estimated.

Twenty ordinary library functions — **every ninth of all
{{библиотека.функций}}**, so that the convenient ones could not be picked — and
each got both tests and a proof.

| | tests | proof |
|---|---:|---:|
| Lines | 390 | 196 |
| Time | 7 min 49 s | 9 min 39 s |
| Real bugs found | **4** | 0 |

Read that table as: **a proof costs more than tests and finds less.**

How many of those same twenty functions the kernel closes is counted by a
separate run, and counted mechanically — by replacing the body with a stub, not
by keeping a list of names:

```
./ярлык proof:20
```

On today's tree it answers: something is proved for **14 functions of 20**,
something substantive for **10**. By claim: 11 substantive, 6 weakened (proved
against a stub body too, so true of any function with that signature), 1 free
(the body was copied into the postcondition), 2 not checked.

That number moves up and down with the kernel, so it is not typed into prose by
hand — it is taken from a run.

The measurement is a ruler: it shows whether the language is moving toward the
goal or merely growing features. The goal is one line:

> **A proof must cost less than the tests it replaces.**

Today, in the world at large, it costs 5–20× more — which is why only OS kernels,
cryptography and avionics get proved. If the price drops below the price of
tests, what changes is not the language but what programmers do: a proof is
written once and covers all inputs, tests are written forever.

## Further

- [What comes next](roadmap.html) — where the proof work stands today
- [Kernel specification](../spec-proof.html) — in Russian; the rules in full
- [The price of a proof, measured](../benchmark-proof-cost.html) — in Russian; the report with numbers
