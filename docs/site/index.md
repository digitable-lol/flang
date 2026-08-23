# flang — a language whose compiler proves your program cannot hang

flang is a language for services and ordinary programs: values are immutable, a
program has no side effects, and the word `total` in front of a function is a
promise that it terminates on every input — a promise **the compiler proves**.

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

The second command answers `flang {{выпуск.версия}}`. The other paths — asdf,
from source, via npm — are on the [Install](install.html) page.

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

## Next

- [Your first program](getting-started.html) — the same five minutes in full,
  down to emitting the program into C.
- [Language reference](language.html) — how every form of the language is
  written: the form, an example, what it gives and where its border is.
- [Operations](operations.html) — what to write when you need a library function
  that already exists: a sum without duplicates, parsing a string, time.

## How this differs from Coq and Lean

In Coq, Agda and Lean a human writes the proof, and writes it slowly; a program
is more often *extracted* out of them into another language than used to run a
service. Here it is the other way round: termination and most claims about the
result are proved by the compiler itself, and you write ordinary code — parsing
a protocol, talking to a database, processes under supervision. You pay for that
in strength: the kernel does not take every claim, and where Lean will prove
anything with your help, flang either proves it alone or refuses —
[why proofs, and how they work](proofs.html).
