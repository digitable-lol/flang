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
compiler answers for: **6142 functions out of 8016** carry it.

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

The numbers come from a run (`npm run proof:ledger`), not an estimate, and a
guard (`npm run counts:check`) compares every one of them against that run — the
same guard that checks the prose of the whole tree. They cannot go stale
quietly: the page reddens with the tree.

| | |
|---|---:|
| Functions in the corpus | 8016 |
| Of them total (termination proved) | 6142 |
| Behaviour claims stated | 153 |
| Of them **proved by the kernel** — for all inputs | 132 |
| Axioms in the kernel | **0** |
| Claims refuted | **0** |

And, honestly, what is not there:

- **of ordinary library functions the kernel accepts 7 out of 20** — the
  measurement took every ninth function out of all 208, so the convenient ones
  could not be picked;
- **the language is 1.4× slower than Python**, and that is **not the price of
  provability**: that price was measured separately and is 2.5 %, paid by 71
  functions out of 2799. The rest is ordinary lack of optimisation, and it is
  fixable;
- **the compiler is not written in flang all the way**: the proof chain is, and
  eight code generators out of eight are, but the processes and the shell are
  not yet.

## Where to start

- [What changed](../changelog.html) — in Russian; merge by merge, with the numbers each one moved.
- [Your first program](getting-started.html) — built and running in five minutes.
- [Why proofs, and how they work](proofs.html) — the point of the language.
- [Roadmap](roadmap.html) — done, in progress, not started, decided against.
- [Language specification](../spec.html) — in Russian.
- [What is proved and what is only checked](../overview.html) — in Russian; the line is drawn explicitly.
