# flang — the specification is the program

A written specification drifts away from the code the day after it is signed off,
and it drifts **silently**: nothing breaks when the two stop being about the same
thing.

flang takes the other road. The specification **is** the program. Rules are
written once, they execute, they check themselves against their own examples —
and then they are emitted into C, Go, Rust, Python, Java, C# or Elixir, where the
emitted code must return the same values and the same error codes as the
interpreter, input for input.

```
total function «Product»
  accepts items: list of number
  returns number
  example «Product of four»
    given items equals [1, 2, 3, 4]
    expected 24
  example «Product of nothing is one»
    given items equals empty list
    expected 1
  fold items starting with 1 as acc and elem → acc times elem
```

`total` here is not a wish. The compiler **proved** that this function terminates
on every input, and would have refused to accept it otherwise.

Those keywords are flang's English surface. The Russian one — `тотальная
функция`, `свёртка … начиная с` — parses to the same syntax tree; the two are
compared tree against tree, not described as equal.

## Three things ordinary languages do not have

**Termination is proved at compile time.** In C, Python and JavaScript a function
may loop forever and you find out in production. Here `total` is a promise the
compiler answers for: **6650 functions out of 8595** carry it.

**A promise about the result is checked on all inputs, not on examples.** Tests
cover the inputs you thought of. A postcondition accepted by the proof kernel
covers the rest.

**One program is emitted into eight languages with byte-compared behaviour.** Not
"should match" — checked to match: values, error codes, step counters.

## How this differs from Coq, Agda and Lean

Those languages are stronger at proving — and **nobody writes services in them**.
Programs are *extracted* out of Coq into OCaml, because writing an application in
Coq is not practical.

flang tries to close that gap: one language you prove in, write ordinary code in,
and can still read.

**The proof kernel takes nothing on faith.** Zero axioms, and the list is
provably empty — a separate test holds it at zero, so one cannot be added
quietly. There are three decision rules, and each one fits in a single reading.

## Where we actually are

The numbers are printed by the proof ledger (`flang check --proof`) over the
whole corpus, not estimated, and a number guard compares every one of them
against that run — the same guard that checks the prose of the whole tree. They
cannot go stale quietly: the page reddens with the tree.

| | |
|---|---:|
| Functions in the corpus | 8595 |
| Of them total (termination proved) | 6650 |
| Behaviour claims stated | 297 |
| Of them **proved by the kernel** — for all inputs | 168 |
| Axioms in the kernel | **0** |
| Claims refuted | **0** |

And, honestly, what is not there:

- **of ordinary library functions the kernel accepts 7 out of 20** — the
  measurement took every ninth function out of all 318, so the convenient ones
  could not be picked;
- **the language is 1.4× slower than Python, 3.3× slower than Node, and
  hand-written C is 8.6× faster than we are** (geometric mean over five tasks,
  [the speed report](../benchmark-speed.html) — in Russian). That is **not the
  price of provability**: where a proof leaves no guard in the running program it
  costs **1–9 %, indistinguishable from zero** against the spread between runs.
  A guard is left behind rarely: **70 functions out of 6650 total ones carry
  it — 1.1 %** (6 by a constant step, 64 by a declared measure, 104 sites; the
  count is printed by `flang check --proof`). There it really is expensive —
  **three times the cost of the function itself**. The gap is unfinished work, not the
  price of proofs, and it is fixable;
- **the compiler is not written in flang all the way**: the proof chain is, and
  eight code generators out of eight are, but the processes and the shell are
  not yet;
- **memory is not returned until the call ends**. There are no leaks at all —
  valgrind reports zero bytes in zero blocks — but the arena holds everything it
  ever took. The scale of the trouble dropped by hundreds of times in three days:
  a merge sort of 4000 numbers used to peak at 1655 MiB and on 18 August peaks at
  **4.0 MiB** in 0.61 s, finishing the job. Where it still shows is insertion
  sort: **176 MiB** for 2000 elements, and for 4000 it hits the recursion limit
  before it finishes ([the memory report](../memory.html) — in Russian).

## Where to start

- [What changed](../changelog.html) — in Russian; merge by merge, with the numbers each one moved.
- [Your first program](getting-started.html) — built and running in five minutes.
- [Why proofs, and how they work](proofs.html) — the point of the language.
- [Roadmap](roadmap.html) — done, in progress, not started, decided against.
- [Language specification](../spec.html) — in Russian.
- [What is proved and what is only checked](../overview.html) — in Russian; the line is drawn explicitly.
