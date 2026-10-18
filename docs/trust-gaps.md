# What flang trusts and how the four gaps close

Two independent programs check every proof in flang, yet between the source and the running
program some links are still taken on faith. This page names them: what is trusted now, which
gap that leaves, and which stage closes it. Each gap has its decision in an ADR.

## What is trusted now

| link | held by | gap |
|---|---|---|
| proof kernel | nothing on its own: its verdict counts only when the checker replays the record (ADR-0073) | — |
| C checker `flang/proof/checker/checker.c` | verdict comparison with the second checker in Lean over the whole record set | 4 |
| second checker in Lean `flang/proof/checker/second/` | the theorem "an accepted derivation block is true in the model"; the other blocks are judged by code without a theorem | 4 |
| value model `flang/proof/lean/Model.lean` | human reading: integers instead of binary64, rounding given by two properties | 4 |
| record reading `flang/proof/lean/RecordReader.lean` | verdict comparison | 4 |
| C print `flang/self/emit-c.flang` | translation protocol and the matcher `flang/translation/matcher.c`, by structure; by meaning, a comparison with the reference for every function (ADR-0163): over the whole domain where it is finite, on witnesses otherwise | 1 |
| runtime `flang/src/emit/c/flang_runtime.c` | examples and probes | 1 |
| C compiler | nothing; CompCert builds the printed code but the build does not select it | 1 |
| processes, mailboxes, scheduler, host | `прогон` blocks over seeds; the kernel knows nothing about processes; fairness is neither an assumption nor a theorem | 2 |
| laws of the category surface | value grids and the examples of `закон` blocks; the kernel proves only the monoid and the ring over the exact integer | 3 |

## Gap 1. The C print — [ADR-0124](adr/0124-the-c-print-is-checked-per-program-by-structure-and-by-contract.md)

Every printed program is checked twice. The matcher checks structure: the C text is built
from print rules node by node. The contract checks meaning: for each function the print emits
a CBMC contract from its `принимает`, `требует` and `обеспечивает`, and CBMC proves it on the
C text for all inputs, assuming the contracts of the callees and of the runtime. The runtime is
held by a contract table that is proved against the runtime itself once per runtime change.
Print rule templates get lemmas against the reference semantics (gap 4).

Until the contracts exist, meaning is held by translation validation against the reference
([ADR-0163](adr/0163-the-printed-c-is-validated-function-by-function-against-the-reference.md),
[how it works](translation-validation.md)): every function of the printed C runs on witnesses
drawn from its types, and its answer is compared with the answer of the reference semantics.
Where the domain of a function is finite, the witnesses are the whole domain, and agreement
holds for every input.

| stage | closes |
|---|---|
| 1 | contracts of functions over numbers and flags, without changing the print |
| 2 | the print emits the contracts itself |
| 3 | the runtime leaves the trusted base for the functions the print calls |
| 4 | contracts over lists, strings, records |
| 5 | print rule templates are proved |
| 6 | the C compiler is CompCert |

Still trusted: the host `flang_repl.c`, the concurrency runtime, CBMC and its solver, the
nine other print targets.

## Gap 2. Properties over time — [ADR-0125](adr/0125-properties-over-time-are-invariants-and-measures-and-finite-models-are-explored.md)

A supervisor gets a `свойство` block with four forms: `всегда` (always), `когда-нибудь`
(eventually), `до тех пор, пока` (until), `в ответ на … когда-нибудь` (whenever … eventually).
The kernel gets no new logic: `всегда` reduces to a one-step invariant of every handler,
`когда-нибудь` to a decreasing measure under a named fairness assumption. Finite models are
explored over every scheduler choice; a counterexample is a schedule replayed as a log.
Fairness of the reference scheduler becomes a theorem.

| stage | closes |
|---|---|
| 1 | invariant rule theorem in Lean; invariants of five processes given to the kernel as plain functions |
| 2 | `прогон` blocks run |
| 3 | `всегда` in the language, in the record, in both checkers |
| 4 | finite model exploration: deadlock, lost letter, mailbox overflow are caught |
| 5 | `когда-нибудь`, `в ответ на`, `до тех пор`; fairness is a theorem |
| 6 | effects: host response as branching or assumption, `разрешает` |

Still trusted: fairness of the C concurrency runtime and the outside world answering an
order, both named as assumptions in the record.

## Gap 3. Category laws — [ADR-0126](adr/0126-category-laws-close-in-two-works-and-the-remainder-is-named.md)

Laws of declarations become kernel theorems, abstract category theory is proved in Lean, path
equalities are decided by a decision procedure. What remains after these two works is named
and split between them: functor laws, naturality, all monad and coherence laws; a record of
the path decision that the checkers replay; the bridge "a generated statement is an instance
of the abstract law"; extensionality. Laws over `число` are never declared proved.

| stage | closes |
|---|---|
| 1 | one table "declaration × law × verdict" |
| 2 | functor, naturality and monad laws are kernel theorems |
| 3 | the path decision is replayed |
| 4 | law generation leaves the trusted base |
| 5 | laws over functions |

## Gap 4. The checker and the semantics — [ADR-0136](adr/0136-a-reference-semantics-in-lean-is-the-yardstick-for-the-checker-and-the-print.md)

The reference is a semantics of flang in Lean: an executable definition of the language with
IEEE 754 binary64 numbers, strings as UTF-8 bytes, lists, records and sums. The theorem of the
second checker is carried up to it: an accepted record means the statement is true of the
program in the reference semantics. The C checker stays as the fast path and the build gate,
tied to the second checker by verdict comparison.

| stage | closes |
|---|---|
| 1 | binary64 rounding on integers is a lawful model instance |
| 2 | the reference runs the core language; corpus examples are compared with the binary |
| 3 | the model world is built from the reference; the derivation block is proved against it |
| 4 | the other record blocks |
| 5 | strings and fractions |
| 6 | record reading leaves the trusted base |

The reference of stage 2 is the common ground for gaps 1, 2 and 3. What the reference is today
and what is proved about it: [reference-semantics.md](reference-semantics.md).

## What stays trusted when every stage is done

The Lean kernel and its compiler; the reference semantics as the definition of what a flang
program means; CBMC and its solver; CompCert; the host and the concurrency runtime in C; the
outside world's answer and the fairness of the C runtime scheduler as named assumptions.
