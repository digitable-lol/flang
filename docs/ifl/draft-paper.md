# Printing Itself Byte for Byte: Self-Application and Declared Measures in flang

**Marat Zimnurov**, Digitable, Russia — <zimtir@mail.ru>

*Draft paper for IFL 2026, the 38th Symposium on Implementation and Application
of Functional Languages, Gothenburg, Sweden, 28–30 October 2026.*

> **Status of this file.** This is the content of the draft paper in Markdown.
> IFL requires the ACM two-column conference format
> (<http://www.acm.org/publications/proceedings-template>); the final PDF is to
> be typeset from this text in `acmart` with `\documentclass[sigconf]{acmart}`.
> Every number below is printed by `docs/ifl/reproduce.sh`; the mapping from
> number to command is `docs/ifl/numbers.md`. No number appears here that the
> script does not print.

---

## Abstract

*(see `docs/ifl/abstract.txt` — that file is the plain-text version required by
the submission form, and the two must not drift apart)*

---

## 1. Introduction

There are two kinds of claim an implementation paper can make. One kind is
argued: the design is explained, and the reader is invited to agree. The other
kind is exhibited: a command is given, a machine runs it, and the reader looks
at what comes out. This report is about two claims of the second kind, made by
flang — a small functional language whose keywords are Russian words, whose
witness implementation is an interpreter in JavaScript, and which prints to
eight target languages: C, Go, Rust, Python, Java, C#, Elixir and JavaScript.

The first claim is that self-application has reached a **byte-level fixed
point**. Six layers of the compiler are written in flang itself; the JavaScript
witness prints them to C, that C builds into a compiler `flang₁`, `flang₁`
prints the same sources, `flang₂` built from that output prints them again, and
all three printings are identical byte for byte.

The second claim is about **totality with a declared measure**. flang lets an
author mark a function `тотальная` ("total"), and then owes a termination
argument. Structural descent and a constant numeric step are inferred. Where
neither applies — Euclid's algorithm, binary search on an interval — the author
writes the measure down, and the compiler splits the obligation in two: the
static analysis checks the *shape* of the promise, and a guard emitted into
every proven call checks the *promise itself* on every turn. The consequence is
stated in the language specification rather than hidden: `тотальная` means
"terminates or fails honestly", not "terminates".

These two are not independent. The totality analysis is one of the six layers
that reproduces itself, and the measure guard is the thing that the byte
comparison caught when tests did not (Section 5).

Section 6 is the part we consider load-bearing: a list of what the
implementation does *not* do, each item checked by a command rather than
recalled from memory.

## 2. The language in one page

A flang function declares its parameters and result type, may carry examples
that are executable tests, and is either `тотальная` (total) or ordinary:

```flang
тотальная функция «Длина»
  принимает элементы: список числа
  возвращает число
  разбор элементы
    случай пусто
      то 0
    случай голова и хвост
      то 1 плюс «Длина» от хвоста
```

`тотальная` obliges the compiler to find a descent. Recursion on the tail of a
list is structural: the argument is a part of the parameter, so it is strictly
smaller. A parameter reduced by a constant step and bounded below (`н минус 1`,
or `н минус ш` where `ш` arrives unchanged and is known positive) is accepted
too. Anything else is `FLANG_NOT_TOTAL`.

There is one support for the numeric case that lies outside the shape of the
program, and the specification names it: numbers are IEEE-754 doubles, and for
large |x| the step `x − 1` does not change x. So the compiler does not rely on
the proof alone. On every call proven by a numeric measure it emits a check that
the measure actually decreased. If it did not, the program fails with
`FLANG_MEASURE`, the same code in the interpreter and in all eight targets.

The repository is 98 `.flang` files, holding 1,708 declarations of
`тотальная функция` and 577 of ordinary `функция`.

## 3. Declared measures

Structural descent and constant steps do not cover everything. In Euclid's
algorithm the step `а остаток от б` depends on the values; in binary search it
is `(низ плюс верх) делить на 2`. The descent is real, but it lives in the
arithmetic, not in the shape of the call. flang lets the author say it:

```flang
тотальная функция «НОД»
  принимает а: число, б: число
  возвращает число
  убывает б
  если б равен 0
    то а
    иначе «НОД» от б и (а остаток от б)
```

`убывает` ("decreases") sits between the result type and the body, is scoped to
the parameters alone — a measure cannot mention a local binding of the body —
and must be a number. In a cycle of mutually recursive functions the measure is
required of *every* member: it proves the cycle whole or not at all. It is tried
last, after structural descent and after the constant step, so declaring it
where the structure already proves the case does not buy a guard.

### 3.1 What is checked statically and what is checked at run time

The analysis checks the form of the promise: that a measure is declared for
every function of the cycle, that it is a number, that it mentions only
parameters, that it does not call an ordinary function, and that it does not
call a function of its own cycle. It does not attempt to prove that the measure
decreases — that is undecidable in general, and a checker that pretended
otherwise would be lying.

The promise itself is kept by a guard on every turn, with three conditions:

| Condition | Why |
|---|---|
| the measure strictly decreased | equality does not break the chain |
| the measure is not below zero | without a floor the chain runs to −∞ |
| the measure is an integer | strict descent with a floor does **not** break the chain: 1, ½, ¼ … stays above zero forever |

Integrality is the condition that is easy to omit and impossible to do without.
Euclid over the reals is the counterexample the language ships as an example:
the remainders of (φ, 1) — 0.618, 0.382, 0.236 … — decrease strictly, are
bounded below, and never end. `«НОД»` of two integers works always; `«НОД»` of
(φ, 1) fails with `FLANG_MEASURE` on the first turn, and that is the right
answer, because on that input the algorithm genuinely does not terminate.

### 3.2 One measure, nine executors

The guard is not a property of the interpreter. We asked the same question of
the interpreter and of all eight code generators: `«НОД»` of (1071, 462), which
must be 21, and `«НОД»` of (φ, 1), which must fail. All nine answered 21, and
all nine produced the *same* 573-byte diagnostic — one distinct answer among
nine, compared by SHA-256 of the message text:

```
$ bash docs/ifl/measure-across-targets.sh
исполнитель      байт  sha256
c                 573  47bcd0d36c762441
csharp            573  47bcd0d36c762441
elixir            573  47bcd0d36c762441
go                573  47bcd0d36c762441
interpretator     573  47bcd0d36c762441
java              573  47bcd0d36c762441
js                573  47bcd0d36c762441
python            573  47bcd0d36c762441
rust              573  47bcd0d36c762441

исполнителей сверено: 9
различных ответов среди них: 1
```

The diagnostic is not a code and a shrug: it says which call, which measure, and
why integrality matters. Since the text is part of the observable behaviour, it
is part of what is compared.

### 3.3 What a measure does not buy: bounds

Termination is not a time bound. A separate analysis (`flang/src/bounded.mjs`)
computes a polynomial upper bound on turns as a function of input size, with
numeric coefficients rather than an O(·) — `turns ≤ 12·n + 7` can be compared
against a scheduler quantum, "linear" cannot. It covers non-recursive functions,
self-recursion with structural descent, folds, maps and filters, and calls to
other bounded functions.

It does **not** cover recursion on numbers — which is exactly the case that the
declared measure exists for. The reason is stated in the source: the structural
size of a number is one and does not shrink under subtraction, and a bound
through the *value* of the number would need a bound on that value, which the
type `число` does not carry. So a function proved total by a declared measure
has no step bound at all. Branching recursion, mutual recursion, recursion
inside a fold, and application of a function value are likewise out of scope,
each for a stated reason.

## 4. Self-application to a byte-level fixed point

### 4.1 The criterion

The criterion is the classical bootstrap, and it is a byte comparison rather
than an acceptance test:

1. the JavaScript witness prints `self/*.flang` → C → builds → `flang₁`;
2. `flang₁` prints the same sources → C → builds → `flang₂`;
3. the C printed by `flang₁` and the C printed by `flang₂` are identical byte
   for byte.

The check in the repository is stronger than the criterion in one respect: it
also compares `flang₁`'s C against the *witness's* C. Agreement with the
witness says `flang₁` prints correctly; agreement of `flang₂` with `flang₁`
says the program built from that printing prints correctly too. They can
diverge separately.

### 4.2 What self-applies

Six layers are written in flang: the lexer, the parser, the type checker, the
totality analysis, defunctionalisation, and the C backend, plus a wrapper that
links them into one program. In numbers, printed by `node docs/ifl/facts.mjs`:

| | |
|---|---:|
| lines of flang in the compiler's own sources | 17,370 |
| bytes | 1,654,076 |
| functions after linking | 1,586 |
| of them total | 1,037 |
| of them ordinary | 549 |
| of them with a declared measure | **0** |
| types | 170 |
| diagnostics from linking / types / totality | 0 / 0 / 0 |

The interpreter is not among the layers and does not need to be: to obtain a
native compiler, printing to C suffices. The seven other backends are not among
them either.

### 4.3 The run

The witness prints the linked compiler into **seven files of C, 5,814,671
bytes** (5.55 MiB), which build under
`cc -std=c99 -Wall -Wextra -Werror -pedantic`. The resulting `flang₁` is put to
work as a real compiler on a corpus of **43 programs** — 10 modules of the
standard library, 1 example, 26 LeetCode solutions, 4 modules of the FTS core
and 2 of the compiler's own layers — and is required to

* print the same C as the witness, byte for byte;
* build the same linked AST, byte for byte after serialisation;
* give the same diagnostics and the same verdict, on the 43 well-formed
  programs and on 7 deliberately broken ones that between them raise 6 distinct
  diagnostic codes (`FLANG_TYPE`, `FLANG_UNKNOWN_NAME`,
  `FLANG_MATCH_NOT_EXHAUSTIVE`, `FLANG_MATCH_UNREACHABLE`,
  `FLANG_BUILTIN_ARGS`, `FLANG_NOT_TOTAL`).

Then steps 2 and 3: `flang₁` prints its own 1.65 MB of sources, `flang₂` is
built from that C, and prints them again.

```
$ FTS_REQUIRE_TOOLCHAINS=c node --test flang/test/self-bootstrap.test.mjs
✔ шаг 1: свидетель печатает компилятор в C, и этот C собирается (12119 ms)
✔ flang₁ печатает тот же C, что свидетель, побайтово (17436 ms)
✔ flang₁ строит тот же связанный AST, что свидетель, побайтово (14737 ms)
✔ flang₁ выносит те же вердикты и диагностики, что свидетель (12545 ms)
✔ шаги 2 и 3: flang₁ печатает сам себя, flang₂ печатает то же самое (125103 ms)
ℹ неподвижная точка сошлась: 7 файлов совпали побайтово у свидетеля, flang₁ и flang₂
ℹ tests 22   ℹ pass 22   ℹ fail 0   ℹ skipped 0   ℹ duration_ms 215795
```

216 seconds on eight cores. `FTS_REQUIRE_TOOLCHAINS=c` is not decoration:
without it, a missing C compiler turns the whole check into a skip, and a skip
in this particular test would look exactly like success.

### 4.4 The wall that was not about the language

Step 2 did not converge for a long time, and the cause is worth reporting
because the first diagnosis was wrong. The failure was not a difference in
understanding the language; it was memory. `добавить` ("append") copied the
whole list, and the arena returned nothing until the end of a request, so a
token stream cost quadratic space — on the compiler's own sources, tens of
gigabytes, which is to say out of reach.

The first proposed fix was to extend the arena's last allocation in place: since
the arena can replay its last block, an append in a loop would not copy. A
measurement recorded in the repository refuted it — 1.3 % saved on 20,000
appends, and exactly 0 % in the realistic case, where the value being appended
is itself built between two appends. An array is almost never the last thing
allocated, because a list is made of something, and that something is built
before it enters the list. That is precisely how a lexer behaves.

What worked was capacity reserved in advance with single occupancy of a cell:
immutability rests on a counter of occupied cells that only grows, a cell may be
claimed once, and a second `добавить` to the same value goes to a copy. Growth
became linear; the repository's table records a 10.1× increase in tokens costing
10.8× the memory where it had cost 94.5×.

That this stayed fixed is now a test rather than a note. The check asserts that
the largest single source links within 1 GiB and that the whole compiler links
within 4 GiB; it sets those limits itself, so no property of the machine can
move them, and it passes in the run quoted above. The boundary was deliberately
put where the old implementation missed by orders of magnitude rather than by
percent.

## 5. What the byte comparison caught that the tests did not

For a while the corpus comparison was silent about the only genuine divergence
between the two compilers. The witness emits not the linked program but the
*marked* one: the front end inserts measure guards before any backend runs, and
`flang emit --target c` prints that. Comparing `flang₁` against the printing of
the *unmarked* program compared it against something the witness hands to
nobody — and hid the fact that the measure guard `FLANG_MEASURE` was present in
the witness's C and absent from `flang₁`'s. The comparison found it as soon as
it was made against the artefact that is actually shipped.

We draw two lessons, and neither is about compilers in particular. First, a
byte comparison is only as good as the choice of what is compared: comparing the
wrong artefact is a way of passing. Second, this is a class of defect that a
test suite is poorly placed to find — the guard is invisible in every result,
and shows up only on inputs where the measure misbehaves, which is exactly the
set of inputs a test author does not think of.

## 6. What this does not give

This section exists because a reviewer will find these anyway, and it is better
if they are found named. Every item was re-checked by a command while this paper
was written; the commands are in `docs/ifl/numbers.md`.

**The self-hosted binary is a checker and a C printer, not a language
implementation.** It has no evaluator: five layers plus the C backend. Its REPL
evaluates in the only honest way it can — by printing the session to C, building
it with the system `cc`, and running that. Running a program non-interactively
still needs the JavaScript toolchain, and the JavaScript witness must stay:
it is what the fixed point is measured against.

**Declared measures are exercised by two programs.** `убывает` appears in
exactly two files in the repository, both of them examples (Euclid and binary
search), and in **none** of the 1,586 functions of the compiler that reproduces
itself. Termination in the compiler is proven structurally or not at all: 549 of
its functions are ordinary rather than total, and the language does not ask a
compiler to be total — a compiler is entitled to hit a step limit and say so.
The measure is covered by 99 tests together with the totality and boundedness
analyses, and that is the whole of its evidence.

**The JavaScript backend emits no limits.** Seven of the eight targets emit both
a step counter and a depth counter and report `FLANG_RECURSION_LIMIT`; the
JavaScript backend emits neither, which its own header states. A
non-terminating *ordinary* function printed to JavaScript hangs or raises
`RangeError` instead of reporting a failure. Total functions are unaffected —
their termination is proven — but the uniformity claimed for the measure guard
does not extend to limits.

**The depth guard in C counts frames, on the main thread's stack.** C is the
only one of the eight where the work runs on the stack it was given: Rust, Java
and C# hand it to a thread with a 512 MiB stack, Python to a thread with 256
MiB, Go grows goroutine stacks, Elixir runs on the BEAM, and JavaScript has no
depth counter at all (above). The C runtime contains no `pthread`, no
`setrlimit`, no `RLIMIT_STACK`. At the repository's own measured cost of ≈290
bytes per level of depth, the default limit of 10,000 frames is about 2.9 MiB
and survives a default `ulimit -s 8192` — but `--max-depth` accepts any positive
integer with no check against the stack, and no test asserts that the default
survives the default stack. The guard is a frame counter, not a stack probe:
below some `ulimit -s` the process dies before the diagnostic is printed.

**The closed failure set is a property of the interpreter.** The concurrency
model claims that the failures of a process form a computable, enumerable set of
five kinds. That guard runs against the interpreter only. Six of the eight
backends never read the process table and drop `процесс`, `надзор` and `прогон`
silently, exiting 0 — which the repository itself calls the worst outcome,
because silence looks like success. The C runtime can report `FLANG_MEMORY`,
which is a real failure of a process and is deliberately *not* in the set. The
Elixir backend refuses to print a bounded mailbox at all.

**Concurrency reaches two targets of eight**, and there is no thread-parallel
runtime. The scheduler is cooperative and single-threaded by design, and the
repository's own measurement is the argument for that design: on three machines,
handing a run to another thread cost 3.8×, 5.3× and 13.8× the run itself. A
thread pool is not written; preemption by quantum exists in the witness and
not in the printed C. Elixir gets real parallelism, but from the BEAM rather
than from anything we implemented.

**The whole test run is 2,763 tests, of which 2,760 pass** on a machine with all
eight toolchains installed (Node 24.18, gcc 13.3, go 1.22.2, rustc 1.75, Python
3.12, javac 25, .NET 8, Elixir 1.18 on OTP 25). Three fail: one is a genuine
defect in a changelog script, two are a negative-zero difference in the Elixir
backend on OTP 25. Continuous integration does not reproduce this: it runs
Ubuntu with Node 20/22/24 and installs no target toolchain, so a missing
toolchain there becomes a silent skip rather than a failure. The eight-toolchain
run is reproducible by a reader who installs the eight, not by pushing a commit.

**Boundedness does not cover measures**, as Section 3.3 states: the case the
measure enables is exactly the case the bound analysis declines.

**Everything above was measured on one machine.** Linux 6.8, x86-64, 8 cores,
31 GiB, one C compiler. A fixed point is a claim about a compiler, not about a
machine, and we would like to hear that it reproduces elsewhere; nothing in the
check depends on our hardware except the timings.

## 7. Related work

*(to be written for the final version; the draft should already position the
work against: bootstrapping folklore and its measurement — the reproducible
builds literature and the diverse double-compiling argument; termination
checking in Agda, Idris, Coq and Dafny, and specifically Dafny's `decreases`
clause, whose surface flang's `убывает` deliberately resembles; sized types;
Isabelle's function package with a user-supplied measure; run-time termination
guards; and multi-backend compilers where a diagnostic is a compatibility
surface. The honest position to defend: none of the individual ingredients is
new — a `decreases` clause is thirty years old — and what is offered here is the
combination plus the evidence that it holds across nine executors byte for
byte.)*

## 8. Conclusion

Two claims, both exhibited by a machine. Self-application converges to a
byte-level fixed point: three printings of a 17,370-line compiler agree byte for
byte, in 216 seconds, from one test file. Totality with a declared measure
splits an obligation that cannot be discharged statically into a static check of
form and a run-time check of substance, and the resulting diagnostic is
identical, byte for byte, across the interpreter and eight code generators.

What we do not have is listed at the same length as what we do, because in an
implementation report the second list is what makes the first one worth reading.

---

## Reproduction

```bash
git clone https://github.com/digitable-lol/flang && cd flang
# nothing to install and nothing to build: the package declares zero dependencies
bash docs/ifl/reproduce.sh          # every number in this paper, ~6 min
bash docs/ifl/reproduce.sh --fast   # without the fixed point and the eight targets
```

`docs/ifl/numbers.md` maps every number to the command that prints it.
