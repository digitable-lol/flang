[Back to the README](../../README.md) · [Documentation index](../README.md)

# The bootstrap circle: the compiler builds itself

This page shows where the `flang` command comes from when the compiler is
written in flang itself, and how it is checked that the built compiler
understands the language the same way its sources do. By the end you can rebuild
the compiler from scratch with nothing but `cc` and `make`, run that check
yourself and read its answer — today it refuses, and the reason is below.

## The problem

The flang compiler is written in flang. To build it you need a flang compiler.
The circle is closed — and it is broken in exactly one way: the tree carries a
**committed seed**, the same compiler emitted into C99 in advance.

```mermaid The bootstrap circle: three steps and one requirement
flowchart LR
  S[seed: C99 in bootstrap/] -->|make| F1([flang₁])
  F1 -->|emits the sources<br>in flang/self| C2[C99 again]
  C2 -->|make| F2([flang₂])
  F2 -.->|must match<br>to the byte| F1
  class F1 glavnoe
  class F2 glavnoe
```

One `make` turns the seed into a working compiler, and nothing else is needed for
that: no Node, no network, no other flang compiler. The compiler then emits
itself from the flang sources, a second binary is built from that emission, and
**the second must equal the first**.

If they match, the built compiler understands the language exactly as the
sources it was built from do. If they do not, they have diverged — and what
diverged is shown by file and by byte.

## Today the circle is open, and here is where

The check refuses, and it refuses loudly. On this tree
`sh scripts/raskrutka.sh --check` never reaches the file comparison: the compiler
built from the seed **refuses to emit today's sources** — 29 diagnostics, the
first `FLANG_PARSE`, then `FLANG_UNKNOWN_NAME` on the names `«Вызвать»`, `«Знач»`,
`«Итог прогона»`, `«Готовая программа»`, and one `FLANG_NOT_TOTAL`.

```
flang emit: печать отменена — программа не проходит проверку, замечаний 29.
```

It reads unambiguously: **the seed has fallen behind the sources.** Names and
forms have appeared in the sources that the compiler in the seed does not know —
and until the seed is re-emitted, the circle does not close: there is a first
binary but no second one.

This is not a broken build — `make -C bootstrap` works, and the `flang` it
produces checks and emits ordinary programs. What is open is the circle itself:
the step where the compiler proves it understands itself.

## How to run it

```bash
make -C bootstrap -j8             # build the compiler from the seed
sh scripts/raskrutka.sh --check   # compare the seed with what the sources emit
```

The second command re-emits seven files and compares them with the committed
ones. A divergence is reported by file, byte and line, not by the word
"mismatch".

The emission limits matter and are not decoration: `--max-steps 200000000
--max-depth 20000`. Those numbers are stamped into the emitted byte
(`#define FL_MAX_STEPS`), which means they take part in the equality. Rebuilt
from memory with different limits, it diverges silently — that is exactly how one
of the earlier releases drifted.

Why the limit is that large is stated as a number, not as "just in case".
Emission runs the same checks as `check`, and on today's tree linking the sources
consumes 23 726 585 steps, typechecking 3 919 602, the termination analysis
222 863, and the proof kernel 56 355 645. The previous limit of 40 000 000 would
have collapsed even without the kernel: linking alone takes more than half.

## What this circle does NOT mean

This is the main caveat on the page, and it must not be skipped.

Two binaries agreeing says: the compiler reads the language the same way the
compiler that emitted these sources read it. **It does not say the language is
read correctly.** A mistake written the same way into the sources and into the
seed survives the circle unnoticed: the circle compares an implementation with
itself.

What catches that kind of mistake in the tree are the frozen answer tables
(`flang/test/fixtures/`): today's compiler is run against them, and disagreeing
with a recorded answer is red. That catches a **regression** — "yesterday it
answered this, today it answers that" — and nothing beyond. There is one
implementation of the language, and no independent reading of the same rules to
compare its answers against.

## The seed falls behind the sources silently

The circle closing does not mean the committed seed matches today's sources. A
change to the compiler is merged, `bootstrap/` is not re-emitted, and the rule
sits in `flang/self/*.flang` while the built program DOES NOT RUN IT. Everything
is green meanwhile: the source parses, the seed builds, and the circle closes on
whatever the seed contains.

Three changes to the proof kernel were lost this way in a single day, 21–22
August 2026: the finiteness proviso, the induction principle over strings, and
the conjunction rule. The guard that used to catch it
(`flang/test/self-bootstrap.test.mjs`) was deleted along with the JavaScript
implementation, and from that day nobody checked the seed at all.

Two checks do it now, and they answer different questions.

| Command | Question | Cost (measured 22 August, 256 cores) |
|---|---|---|
| `sh scripts/raskrutka.sh --check` | does the seed match the emission exactly, down to the last byte | 19 min 58 s, 25.1 GiB |
| `sh scripts/raskrutka.sh --bystro` | are the emission's inputs the same ones | 0.52 s |

The expensive one re-emits — that is exactly why nobody called it. The cheap one
does not emit at all: it compares the contents of the 36 files in the compiler's
closure, the 4 runtime files that go into the output verbatim, and the emission
limits that end up in the emitted byte. The fingerprint lives in
`scripts/otpechatok-semeni` and is taken by the emission itself, not by a
separate command someone has to remember.

The cheap one runs on every push as job `semya` in
`.github/workflows/binary.yml`; a mismatch is a refusal, not a warning. The
the full comparison is called before a release and after merges.

**What the cheap one does not prove:** that the files are identical down to the
last byte. It answers the narrower question — "are these the same inputs" — and
that is precisely the question that had no answer.

## What the circle does not check

**The compiler does not check its own sources.** `flang check` on
`flang/self/bootstrap/compiler.flang` answers "не проверено — замечаний 29" with
exit code 1: the same names it does not know that made emission refuse. The
compiler built from the seed cannot today judge itself with the checks it applies
to other programs.

**Rebuilding needs the tree, not the seed directory.** Emission reads the C
runtime sources from disk (`flang/src/emit/c/`), and there are no copies of them
in `bootstrap/`. The `bootstrap/` directory alone is not enough for the circle.

## Where a release comes from

The C in a release archive is emitted from these same sources by this same
circle. That is why installing from the archive, installing through Homebrew and
building from a clone give one and the same binary — not "roughly the same one".
