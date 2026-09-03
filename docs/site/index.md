# flang — a language whose compiler proves your program cannot hang

**flang is a pure functional language with strict static typing, where proof is
mandatory and happens before the program runs.** Values are immutable; a program
has no side effects — input and output come back as data, and the host performs
them. The word `total` in front of a function is a promise that it terminates on
every input, and **the compiler** proves it, not a person. The word `ensures` is
a promise about the result, and the kernel closes it over **every input**, not
over the written examples. The kernel has zero axioms, and that is checked by a
run: `flang io flang/scripts/kernel-forgeries.flang --plan 'Аксиом ноль'`
answers with exit code 0.

The language is self-hosted: the flang compiler is written in flang, prints
itself, and prints to {{цели.словом}} more target languages. The standard
library, the scheduler, supervision, and the link between nodes are written in
flang too — its own process layer in place of OTP/BEAM. It is written in words
rather than symbols, and every keyword exists in both a Russian and an English
spelling.

Put this in `hello.flang`:

```flang
module «Hello»

total function «Double»
  accepts n: number
  returns number
  n plus n
```

Check it and run it — this is what the compiler prints (its report is in Russian
today):

```bash
$ flang check hello.flang
модуль «Hello»: функций 1, из них с доказанным завершением 1; типов 0
hello.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет

$ flang run hello.flang --function Double --args '{"n": 21}'
42
```

Exit code 0. When termination cannot be proved: exit code 1, a diagnostic with a
name, a line and a column, and no file is emitted.

## Install

```bash
brew install digitable-lol/tap/flang
flang --version
```

The first line installs from the
[`homebrew-tap`](https://github.com/digitable-lol/homebrew-tap) repository; the
second answers `flang {{выпуск.версия}}`. The other paths — asdf, from source —
are on the [Install](install.html) page.

## What the language can do today

| What exists | Where the border is |
| --- | --- |
| **A termination proof**: `total` in front of a function is checked by the compiler, not by a reviewer | the language has no loops and no mutable variables; if it cannot prove, it refuses the file |
| **Claims about behaviour**: `ensures` is a promise about the result that the kernel proves for all inputs, not for the examples | the kernel does not accept every claim; how many it did accept is one line below |
| **Emitting into {{цели.поАнглийски}} target languages**: {{цели.список}} | sockets, clocks and the process table are not emitted |
| **[Processes and supervision](processes.html)**: processes, supervision, back pressure, a scheduler written in flang itself | the `процесс` and `надзор` declarations are not judged by the binary compiler |
| **[PostgreSQL](database.html) and SQLite**: the PostgreSQL protocol is built and parsed, an SQLite database file is read | PostgreSQL takes `trust` and cleartext password only; SQLite is read, not written |
| **HTTP**: requests and responses parsed and printed, headers, codes, addresses, percent encoding | there is no socket: the host carries the bytes, the language only computes them |
| **Cryptography of our own**: SHA-256, HMAC, AES-128 in CTR and GCM, X25519, reading an X.509 certificate | TLS is not built: https is done by an external curl |

How much of that is proved: {{корпус.тотальных}} functions out of
{{корпус.функций}} in the language tree terminate provably, and of
{{утверждения.высказано}} behaviour claims the kernel has closed
{{утверждения.доказано}} — the line is drawn explicitly on
[What is proved and what is not](what-is-proved.html).

**The four numbers above were measured on 23 August 2026, and today they
describe a tree that does not exist.** They are measured by the compiler built
from the bootstrap seed, and the seed has fallen behind the sources:
`sh scripts/seed-freshness.sh` answers with a refusal — **44 files** have
diverged. Among them are `proof-kernel`, `proof`, `obligations`, `totality` and
`types` — exactly the ones that decide what counts as proved. So the compiler
judged by rules that are no longer in the tree, and these numbers can only be
recomputed after the seed is reprinted (`sh scripts/raskrutka.sh`, hours).

The cheap numbers on this page — how many files, lines, functions and examples
the tree holds — are recomputed without the compiler in nine seconds and are
checked on every push (`sh scripts/published-vs-tree.sh --числа`). The gap
between the two halves is measured as a number, not as a word: the same command
prints how many files have moved since that measurement.

## Next

- [Your first program](getting-started.html) — the same five minutes in full,
  down to emitting the program into C.
- [Language reference](language.html) — how every form of the language is
  written: the form, an example, what it gives and where its border is.
- [Operations](operations.html) — what to write when you need a library function
  that already exists: a sum without duplicates, parsing a string, time.

## How this differs from Coq and Lean

**Not in who writes the proof.** You can write one by hand here too: the word
`теорема` with the steps `дано`, `утверждаем`, `затем … по свойству «…»`,
`индукция по …` and `следовательно доказано` — a structured proof in the spirit
of Isabelle's Isar, not a script of tactics. There are **216** such theorems in
the language tree, **55** of them in the standard library
(`grep -rac '^\s*теорема ' flang --include=*.flang`, summed with `awk`; the `-a`
is not optional — without it `flang/conc/link.flang` is skipped silently).

The difference is **what is left for the hand to write**. The kernel closes a
claim on its own, by twelve rules, and a written theorem is needed only for the
remainder. The verdict line reports that as a separate number. Measured on
`flang/stdlib/sha1.flang` together with its imports (`flang check --proof`):
`утверждений 177: доказано 114 … из них без теоремы 54` — nearly half of what is
proved is closed without a single written line. Coq and Lean have no such number:
there every claim gets either a term or a tactic written for it. Which promises
the kernel takes on its own is worked through form by form on
[which promises the kernel takes](kak-dokazat.html).

The second difference is real and not in our favour: a program is more often
*extracted* out of Coq and Lean into another language than used to run a
service — but thirty years there have accumulated tens of thousands of ready
lemmas, while the library of proved statements here is only being built up. The
kernel does not take every claim, and what it does not take is named explicitly:
[why proofs, and how they work](proofs.html).
