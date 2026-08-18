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

There are five carriers of that promise, and each leaves a trace in the ledger:

| Carrier | Functions |
|---|---:|
| By composition — no recursion at all | 5675 |
| By structure — walking part of a value | 356 |
| By an exact step over a natural number | 27 |
| By a constant step with a run-time check | 4 |
| By a declared measure with a run-time check | 64 |

The last two lines are separated honestly: termination there is not proved all
the way, and a run-time check picks up the difference. The ledger shows that as
its own number — **102 sites across 68 functions** — instead of folding it into
the total.

## Three answers, not two

The kernel answers in three different ways, and mixing them is not allowed:

**Proved by the kernel** — the claim holds for all inputs. There are **132 of
153**.

**On a grid** — a set of values was run, no violation found. The ledger line for
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
ledger said "for all inputs", a run must fail to find a counterexample. It is
checked on every claim in the corpus, not on the ones somebody remembered.

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

We measured this, because whether the language is worth building depends on the
answer.

Twenty ordinary library functions were taken — **every ninth of all 208**, so
that the convenient ones could not be picked — and each got both tests and a
proof.

| | tests | proof |
|---|---:|---:|
| Lines | 390 | 196 |
| Time | 7 min 49 s | 9 min 39 s |
| Real bugs found | **4** | 0 |
| Accepted by the kernel | — | **0 of 20** |

Zero. And that turned out to be the most useful result of the day: the
measurement showed the bottleneck was not where everyone assumed. In 13 cases out
of 15 the cause was the same — **no built-in type had an induction principle**:
not the list, not the string, not the number.

Once that was fixed it became **7 of 20**.

The measurement repeats, and it is a ruler: it shows whether we are moving toward
the goal or merely growing features. The condition everything is for:

> **A proof must cost less than the tests it replaces.**

Today, in the world at large, it costs 5–20× more — which is why only OS kernels,
cryptography and avionics get proved. If the price drops below the price of
tests, what changes is not the language but what programmers do: a proof is
written once and covers all inputs, tests are written forever.

## Further

- [Roadmap](roadmap.html) — where the proof work stands today
- [Kernel specification](../spec-proof.html) — in Russian; the rules in full
- [The price of a proof, measured](../benchmark-proof-cost.html) — in Russian; the report with numbers
