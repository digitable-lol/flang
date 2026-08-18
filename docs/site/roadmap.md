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

**The corpus is measured, not estimated** — by a counter over the whole tree:

| | |
|---|---:|
| Functions in the corpus | 8595 |
| Of them total | 6650 |
| Claims stated | 297 |
| Proved by the kernel | 168 |
| Refuted by the kernel | 0 |
| Axioms | 0 |

**Emission into eight targets**: `c`, `csharp`, `elixir`, `go`, `java`, `js`,
`python`, `rust`. **All eight have a twin in flang** — the last one, `js`, is
closed; none is left without.

**The binary builds with a single `cc`, without Node.** Re-measured on 18 August
on a clean export (`git archive HEAD` into an empty directory): one compiler
invocation over four `.c` files, not one warning under `-std=c99 -Wall -Wextra
-Werror -pedantic -O2`, no external dependency beyond `libm` and `libpthread`.
It takes **83.7 s** and yields a binary of **7 134 408 bytes**; `make -C
bootstrap -j4` on the same export takes **40.6 s** and yields **7 127 856
bytes** (cc 15.2.0, Linux 7.0.0). The time floats with machine load, the bytes
do not: two `make` runs with different thread counts gave the same size to the
byte. All the runs are on [How the install was
verified](install-evidence.html). The
`-flto` flag that stands in the `Makefile` is not needed for a single
invocation: there is only one translation unit anyway.

**The compiler's emission of itself matches byte for byte.** The bootstrap
check links the flang sources (**3554 functions, 314 types**), emits them into C
and compares that with what sits in `bootstrap/`: **7 files, 13 060 621 bytes,
0 differences**. It compares bytes, not a build, so
the check always runs and needs no `cc`.

**The evaluator is pulled into the binary.** `flang run` and `flang test`
compute with it — no Node, no `cc`. Checked on a freshly built binary: `flang run
flang/stdlib/higher-order.flang --function 'Удвоить' --args '{"х":21}'` prints
`42` and exits 0. The binary also prints the `check --proof` ledger itself, and
`emit --target c` too. The `repl` does **not** call the evaluator yet: it emits
the session to C and builds it with the system `cc`; with no `cc` it does not
switch off but checks parsing, types and termination, and says so at start-up.
The difference is named because "there is a shell" and "there is an evaluator"
are different promises.

**What the binary can do, as a list.** Taken from a run of a binary built in a
clean directory, not from the help text: `check`, `test`, `run`, `emit`, `repl`,
`--help`, `--version`, and with no arguments — the JSON-in, JSON-out runner. Each
was run:

| command | run | answer |
|---|---|---|
| `check` | `check flang/stdlib/higher-order.flang` | 34 functions, 34 with proved termination; no findings |
| `check --proof` | the same with `--proof` | **the ledger is printed**: 65 lines against 2 without the flag |
| `test` | `test flang/stdlib/higher-order.flang` | 55 examples, 55 passed, 0 failed |
| `run` | `run … --function 'Удвоить' --args '{"х":21}'` | `42`, exit 0 |
| `emit` | `emit flang/examples/rosetta/merge-sort.flang --target c` | 6 files, 285 301 bytes printed; `make` built them |
| `repl` | `repl` with no `cc` | does not switch off, checks parsing, types and termination |

Emission from the binary has one named limit: the table of declared types is built by the
reference layer, so runner arguments are not checked against declared types, and
the binary says so itself rather than keeping quiet.

**An OTP alternative of our own**: processes, supervision, hot swap, scheduler.

**Four writing surfaces** — Russian, English, Esperanto, Chinese. Of the 149
concepts in the glossary, 132 are open on all four; 17 have holes, and those
are named one by one on [Four writing surfaces](../surfaces.html) (in Russian).

**Code in flang** — 128 954 lines across 785 files:
`find . -name '*.flang' | xargs cat | wc -l`.

## In progress

**The input boundary of an emitted program.** The binary itself already checks
arguments against declared types: `Факториал` is declared over `нат`, and given
−3 it answers `FLANG_TYPE: аргумент «н»: -3 вне нат` with exit code 1, as the
reference does. What stays empty is the boundary of a program emitted through
`emit`: the table of declared types is built by the reference's type layer,
which the binary does not have, and the binary warns about it as it emits.
Until this is closed, the caller answers for an emitted program's input.

**The English version of the site.** The site's own pages are translated; the
guide, the measurement reports and the specifications are still Russian only.

## Not started

This is the important part of the page. Below is what does not exist, in the
order in which each item blocks the next.

**There are no packages at all.** A library is included by relative path
(`использует «Модуль» из "path"`). No versions, no lock file, no reproducible
build. This blocks everything under it: a library without packages can neither be
distributed nor updated.

**The standard library is small**: 16 files, 7716 lines
(`cat flang/stdlib/*.flang | wc -l`). No database, no full networking. The list
of what is there is shorter than the list of what is not.

**There is almost no application code.** The backend is one example of 7 files
and 563 lines (`examples/library-api`). The frontend is a browser demo, not an
application.

## Decided against

A refusal is a decision, and each one has a stated reason.

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

The page moves with the tree: a number guard compares its numbers against the
run, and the site build will not let it drift without its Russian pair.
