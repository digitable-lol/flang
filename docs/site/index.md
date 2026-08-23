# flang — a language whose compiler proves your program cannot hang

flang is a language for ordinary programs that asks more of its compiler than
type checking. The word `total` in front of a function is a promise that it
terminates on every input; the compiler **proves** it, and refuses the file when
it cannot. The language is written in words rather than punctuation, and the
keywords come in two surfaces — English and Russian.

@@пример:factorial@@

What is unusual here. The function is recursive and still marked `total`: the
compiler saw that the step is constant (`minus 1`) and that the guard
`n is at most 1` pins `n` from below, and concluded that there can be no more
than `n` calls. The examples live inside the function rather than in a separate
test file, and they run on every check of the file.


## The language in one paragraph

flang is a **pure functional language with strong static typing**, where checking is
mandatory and happens before anything runs. Values are **immutable**; there is no
assignment. Functions are values, but there are **no closures**: a function value is a
tag naming a declared function, which is why it can be printed even into target
languages that have none. A program has **no side effects whatsoever** — it does not
reach the network, read files or know the time; it has arguments and a result. Effects
are described as **orders**, and a host carries them out.

What sets it apart from other pure languages is that **the compiler proves rather than
trusts**: `total` is a promise of termination that it proves itself, and some promises
about the result are proved by the proof kernel for ALL inputs rather than checked on a
few.

The rest of the shape: sum types, pattern matching, lists, strings as data, a module
system, indentation instead of brackets, and two keyword surfaces — Russian and English.
One source is printed into eight target languages, and the compiler is written in flang
itself.

## Try it in five minutes

**1. Install.** One command, no building from source:

```bash
brew install digitable-lol/tap/flang
```

The other paths — asdf, from source, via npm — are on the
[Install](install.html) page.

**2. Write.** Put this in `hello.flang`:

```flang
module «Hello»

total function «Double»
  accepts n: number
  returns number
  example «twice two»
    given n equals 2
    expected 4
  n plus n
```

**3. Check it and run it:**

```bash
flang check hello.flang
flang run hello.flang --function Double --args '{"n": 21}'
```

`check` parses the file, checks types, proves termination and runs the examples;
`run` answers `42`.

**4. Then follow the path**, one page per step:

- [Install](install.html) — four paths and what each needs on the machine;
- [Your first program](getting-started.html) — the same five minutes in full,
  down to emitting the program into C;
- [Tutorial](tutorial.html) — six chapters, from a first function to a claim the
  kernel proved;
- [Operations](operations.html) and [Language reference](language.html) — what
  does what, for when the path ends and the work begins;
- [How to keep learning the language](learning.html) — a reading order in eight
  steps: what comes after what, and what counts as a step taken.

## How this differs from languages you know

**Termination is checked before the program runs.** In C, Python and JavaScript
a function may loop forever and you find out in production. Here `total` is a
promise the compiler answers for: **{{корпус.тотальных}} functions out of
{{корпус.функций}}** in the language tree carry it.

**A promise about the result is checked on all inputs, not on examples.** Tests
cover the inputs you thought of. A postcondition accepted by the proof kernel
covers all of them at once.

**One program is emitted into {{цели.поАнглийски}} languages, and the behaviour
is compared byte for byte.** Not "should match" — checked to match: values, error
codes, step counters. The targets are {{цели.список}}.

**No loops, no mutable variables, no exceptions.** A list is walked with a fold,
branching is `if … then … else`, a failure comes back as a value. This is not
purity for its own sake: the termination proof rests on exactly these limits.

## What the language can do today

Not "planned" — what lies in the tree and runs on a command. The border of every
line is named by its own page; all three are written so that the border stands
in the text rather than in a footnote.

| | what exists | where the border is |
| --- | --- | --- |
| **Emitting** | one program is emitted into {{цели.поАнглийски}} languages: {{цели.список}} | sockets, clocks and the process table are not emitted |
| **[Databases](database.html)** | PostgreSQL: the protocol is built and parsed, {{база.функций}} total functions, {{база.примеров}} examples | `trust` and cleartext password only, no encryption, and the wire conversation does not run today |
| **[Processes and supervision](processes.html)** | processes, supervision, back pressure, a scheduler written in flang itself | the `процесс` and `надзор` declarations are not judged by the binary compiler |
| **[The categorical surface](categories.html)** | monoid, monad, functor, category, isomorphism | the shape is proved, the laws are checked on a grid, and the binary has no judge for them |
| **Library** | {{библиотека.файлов}} modules, {{библиотека.функций}} functions | not every claim about behaviour is proved, see below |

## How this differs from Coq, Agda and Lean

Those languages are stronger at proving — and **nobody writes services in them**.
Programs are *extracted* out of Coq into OCaml, because writing an application in
Coq is not practical.

flang tries to close that gap: one language you prove in, write ordinary code in,
and can still read aloud.

**The proof kernel takes nothing on faith.** Zero axioms, and the list is
provably empty — a separate test holds it at zero, so one cannot be added
quietly. There are three decision rules, and each one fits in a single reading:
[why proofs, and how they work](proofs.html).

## Where the language actually is

The numbers below are substituted from a measurement of the tree, not typed: one
number lives in one place, and two pages have nothing to drift apart on. Nor can
it go stale quietly — [how that works](about-docs.html).

| | |
|---|---:|
| Functions written in flang | {{корпус.функций}} |
| Of them total (termination proved) | {{корпус.тотальных}} |
| Behaviour claims stated | {{утверждения.высказано}} |
| Of them **proved by the kernel** — for all inputs | {{утверждения.доказано}} |
| Laws taken on faith | **{{законы.наВеру}}** |

And what is not there yet. These caveats stand here rather than in the sales
pitch, but not one of them has been dropped:

- **of ordinary library functions the kernel closes 2 out of 20**; four more it
  closed only after the claim had been weakened, which makes 6 out of 20 counting
  those. **Not one human-written theorem has been accepted by the kernel.** The
  measurement took every ninth function out of all {{библиотека.функций}} library
  functions, so the convenient ones could not be picked, and it was run twice on
  the same material — [what backs that](proofs.html);
- **speed: the emitted program is 1.28× faster than Python, 1.81× slower than
  Node and 4.52× slower than hand-written C** (geometric mean over five tasks,
  [the speed report](../benchmark-speed.html) — in Russian). The gap to C is
  **not the price of provability**: where a proof leaves no run-time check
  behind, the difference disappears into the spread between runs. A check is
  left behind rarely — **{{сторож.функций}} functions out of
  {{корпус.тотальных}} total ones** carry it ({{носители.постоянныйШаг}} by a
  constant step, {{носители.мера}} by a declared measure, {{сторож.мест}} sites)
  — and there it really is expensive: **the function costs three times as much**;
- **the compiler is not written in flang all the way**: the proof chain is, and
  {{цели.близнецовПоАнглийски}} code generators out of {{цели.поАнглийски}} are,
  but the processes and the shell are not yet;
- **memory is not returned until the call ends**. There are no leaks at all —
  valgrind reports zero bytes in zero blocks — but the arena holds everything it
  ever took. The scale of the trouble dropped by hundreds of times in three days:
  a merge sort of 4000 numbers used to peak at 1655 MiB and now peaks at
  **4.0 MiB** in 0.61 s, finishing the job. Where it still shows is insertion
  sort: **176 MiB** for 2000 elements, and for 4000 it hits the recursion limit
  before it finishes ([the memory report](../memory.html) — in Russian).

## Where to go next

- [Your first program](getting-started.html) — if you skipped the path above.
- [Releases](releases.html) — what arrived in the language since the previous
  version: what appeared, what changed, what broke.
- [What is proved and what is not](what-is-proved.html) — the line is drawn
  explicitly, and it matters more than any number on this page.
- [Roadmap](roadmap.html) — done, in progress, not started, decided against. No
  dates.
- [How to keep learning the language](learning.html) — a reading order, for when
  there are many pages and no obvious place to start.
- [For contributors](contributing.html) — measurements, the knowledge base, the
  journals and the full surface contracts: everything a project participant
  needs and a user of the language does not.
