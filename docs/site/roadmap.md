# Roadmap

No dates here — no quarters, no months. Order and dependencies are named because
they are known; dates are not named because they are not, and an uncovered
promise is worse than silence.

Every number below comes from a run, and the command that prints it stands next
to it. Re-measure if you doubt it. Measure the binary **in a clean directory**:
the built one sits next to the sources, `make` sees it as newer and answers
"nothing to be done", and the measurement then shows yesterday.

## Done

**The proof kernel is written in flang itself, with zero axioms.** The list of
axioms is held empty by a test, not by a promise: one cannot be added quietly.

**The corpus is measured, not estimated** — `node docs/site/site-numbers.mjs`:

| | |
|---|---:|
| Functions in the corpus | 8016 |
| Of them total | 6142 |
| Claims stated | 153 |
| Proved by the kernel | 132 |
| Refuted by the kernel | 0 |
| Axioms | 0 |

**Emission into eight targets**: `c`, `csharp`, `elixir`, `go`, `java`, `js`,
`python`, `rust`. **All eight have a twin in flang** — the last one, `js`, is
closed; none is left without.

**The binary builds with a single `cc`, without Node.** Checked on a clean
export (`git archive` into an empty directory): one compiler invocation over four
`.c` files, not one warning under `-Werror -pedantic`, not one external
dependency.

**The evaluator is pulled into the binary.** `flang run` computes with it — no
Node, no `cc`. The `repl` does **not** call it yet: it emits the session to C and
builds it with the system `cc`; with no `cc` it does not switch off but checks
parsing, types and termination. The difference is named because "there is a
shell" and "there is an evaluator" are different promises.

**An OTP alternative of our own**: processes, supervision, hot swap, scheduler.

**Four writing surfaces** — Russian, English, Esperanto, Chinese. Of the 149
concepts in the glossary, 132 are open on all four; 17 have holes, and those are
named one by one (`npm run surfaces:check`, `npm run glossary:check`).

**Code in flang** — 116 303 lines across 753 files:
`find . -name '*.flang' | xargs cat | wc -l`.

## In progress

**Checking arguments against declared types in the binary.** This is not
"cannot do something" but **answers differently**, which is worse. `Факториал`
is declared over `нат`; given −3 the binary prints `1` while the reference
refuses: "аргумент «н»: -3 вне нат". Both were run. Until this is closed, check
inputs you do not vouch for with the reference.

**The English version of the site.** The site's own pages are translated; the
guide, the measurement reports and the specifications are still Russian only.

## Not started

This is the important part of the page. Below is what does not exist, in the
order in which each item blocks the next.

**The binary has no `test` and no `emit`, and it silently ignores `--proof`.**
Checked by running a freshly built binary: `test` and `emit` answer "unknown
command" with exit code 2. `--proof` is worse — the output of `check --proof`
equals the output of `check`, there is no ledger, and nothing says so. A refusal
is visible; silence is not.

**There are no packages at all.** A library is included by relative path
(`использует «Модуль» из "path"`). No versions, no lock file, no reproducible
build. This blocks everything under it: a library without packages can neither be
distributed nor updated.

**The standard library is small**: 13 files, 5110 lines
(`ls flang/stdlib/*.flang`). No network, no time, no database. The list of what
is there is shorter than the list of what is not.

**There is almost no application code.** The backend is one example of 7 files
and 563 lines (`examples/library-api`). The frontend is a browser demo, not an
application.

## Decided against

A refusal is a decision, and each one has an argument. If the argument falls, the
refusal falls with it.

**No closures.** Capturing an environment breaks the termination analysis and
direct emission into C, Go and Rust. First-class functions do exist — through
defunctionalisation (Reynolds, 1972): the compiler replaces a function-value with
a tag and dispatches on tags. `flang/stdlib/higher-order.flang` is written that
way. A closure and a first-class function are different things, and only the
first is refused.

**No two versions of one library in one program.** A diamond dependency is
resolved by raising a version, not by coexistence. The argument is worked out in
[Modularity and packages](../modules.html) (in Russian).

**Not the full Unison model.** Storing code in a database instead of files means
owning an editor, owning a host, and losing git. We take half of Unison —
content addressing; we do not take the other half, and the reason is spelled out
in the same place.

## What is not promised here

Not one date. Order of work yes, dependencies yes, dates no.

The page moves with the tree: `npm run numbers:check` guards its numbers, and
`npm run site:check` will not let it drift without its Russian pair.
