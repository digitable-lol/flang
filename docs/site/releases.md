# Releases

A release is a `vX.Y.Z` tag, and behind it an archive and a package publication. This page is printed from the tags: as many entries as there are tags, and a release cannot be skipped.

There are three boxes: **what appeared**, **what changed**, **what broke**. An empty box is not printed — "broke: nothing" nine releases in a row tells the reader nothing.

The entries below are about the language, not about the work on it. What has landed on the trunk since the last release is shown by the [merge journal](../changelog.html) (in Russian); every commit subject is in the [commit journal](../journal.html).

## 0.5.1 — 19 August 2026

**The macOS install is fixed: 0.5.0 did not build there for anyone**

### What appeared

- `«Открыть соединение»` — an order with which a program itself reaches a foreign service over a socket. Before it, no client to a database or to any binary-protocol service could be written in flang: a service could answer but not ask.
- All four network orders now use one word for the concept.
- A second door for a printed C program — `МОДУЛЬ_enter` — checks arguments against declared types. Before it, foreign code linked against the library got `1` for `−3` on a `нат` argument and never knew.

### What changed

- The npm package is named `@digitable-lol/flang`, not `@digitable-lol/fts`.
- The C files are `compiler_flang.[ch]` instead of `kompilyator_flang.[ch]`; the printed output shrank by 124 431 bytes.
- The build output is named `flang`, not `flang_cli`; the Homebrew formula and the asdf plugin accept both.

### What broke

- Nothing previously promised. The binary still emits to C only and does not take composite values in `--args`; both limits are named on the install pages and in `man`.

## 0.5.0 — 18 August 2026

**The compiler measures itself, and the emitted code got faster and leaner**

### What appeared

- All eight emission targets now have a twin written in flang itself. `js` was the last one closed; no target is left without.
- The proof ledger is computed by a layer written in flang: `flang check --proof` no longer calls the JavaScript reference.
- The type `вес` — the segment from zero to infinity. Three operations over it are allowed, four refuse and show the pair they refused on.
- Exact decimals: money is computed without a binary fraction, and the binary handles it itself.
- The permission "safe to repeat" is now granted explicitly instead of being assumed.
- A dependency lock file: a program builds from it without the sources.
- Input and output grew directory listing and process spawning, and `flang io` distinguishes "found a problem" from "broke itself" by different exit codes.
- The documentation site builds from `docs/` by one command, with no dependency at all.

### What changed

- Emitted C got faster: link-time optimisation is on by default — that is 1.14× — and the type check is not emitted where the type is already proved: 4.9× on arithmetic, 1.6× together.
- The memory region in the C target learned to roll back: merge sort over four thousand numbers takes 3.5 MiB instead of 1655.
- The declared depth limit in WebAssembly became a limit: 7474 frames and the same refusal text as the reference, instead of a dead tab at depth 60.
- Diagnostics quote the word of the surface the file is written in: 0 mismatches out of 186.
- The language server stopped answering an argument it did not understand with zero bytes and exit code 0.

### What broke

- The word `требует` became a keyword. A program where that was a name of its own no longer parses.

## 0.4.8 — 9 August 2026

**Subset and intersection: sets got words**

### What appeared

- Sets got words: containment and common part — and they work by a reason, not by a list.
- A declared measure: `убывает <expression>`. A loop is proved by it where the two free orderings were not enough.
- Logic is written infix: `не`, `и притом`, `или`.
- A character's code point became a number — that is exactly what strings were missing.
- A process has its own heap: a message travels into it as a copy, and exhausting the heap became a failure of the process, not the death of the program.
- A mailbox is bounded by a declared size, and overflow became a failure of the sender.
- The dictionary became logarithmic: a search tree with priority by the key's hash.

### What changed

- Hot swap runs under a live scheduler, and state is carried over by a checked function.
- The emitted compiler now installs the measure guard and no longer loops where the reference refused.

### What broke

- The word `убывает` became a keyword.

## 0.4.7 — 7 August 2026

**Monad, failure as a value, polymorphism**

### What appeared

- The monad got a form: `в монаде` unfolds into a case analysis all the way down.
- The failure of "to number" became a value: a column of strings adds up without falling over.
- A number descends by a constant step — down to a checked floor.

### What changed

- `тотальная` stopped promising more than is proved: where termination rests on a number, a measure guard is emitted.
- The library collapsed along its types once polymorphism was closed; the second parameter found a defect in self-application.

## 0.4.6 — 7 August 2026

**The binary talks to a human: check, shell, help, man**

### What appeared

- The installed binary became a tool for a human: `flang check`, help, version, a `man` page.
- A function became a value: defunctionalisation kept the call graph finite, and a function-value reached every emission target.
- The language got a dictionary.
- Logical operations arrived as functions — the word "и" is already taken in this language.

### What changed

- Self-application understands polymorphism and higher order.
- Linking stopped losing the categorical layer at a file boundary: a proof used to survive it and should not have.

## 0.4.5 — 7 August 2026

**A shell in the installed binary, input/output, and processes on BEAM**

### What appeared

- The shell is in the binary that installs ready-made: the language can be touched right after installation.
- The language learned to read a file and reach the network without ceasing to be pure.
- Supervision stopped being a declaration: a fallen process is brought back to the same start.
- Processes ran on a real BEAM through Elixir emission, and the comparison goes by the set of outcomes.
- Types became parametric — without that the monad could not be stated.

### What changed

- The lexer became total throughout: the self-application layers stopped walking a string by position.
- Four tasks and the standard library became total.

## 0.4.4 — 6 August 2026

**A language server, a functor with laws, concurrency**

### What appeared

- A language server for `.flang`: the same check as `flang check`, right in the buffer.
- Concurrency: atomicity per process rather than global, plus BEAM emission.
- The functor stopped being a word without a guarantee: it got laws, and they are checked.

### What changed

- Bidirectional control characters are no longer emitted raw into java, csharp and elixir: substituting a source with an invisible mark is closed in every target.

## 0.4.3 — 6 August 2026

**Vim highlighting ships in the package**

### What appeared

- Highlighting ships in the package: 154 words of the language, with role distinguishability checked.
- The `flang repl` shell: the language can be touched, not only run from a file.
- The built-in form "split … into characters" — a per-character pass became provable.

## 0.4.2 — 6 August 2026

**Eight emission targets, and the compiler installs without Node**

### What appeared

- Emission into Java, C# and Elixir — eight targets in all.
- The compiler installs without Node: released C and an installer formula.

### What changed

- Self-application is complete: the fixed point converged.
- The package description was five emission targets behind — fixed.

## 0.4.1 — 5 August 2026

**The package's commands answer after installation**

### What changed

- After installation the commands printed zero bytes and exited 0: the entry-point guard compared paths as strings, while the installer places commands as symbolic links. Held down by a check that places the link the same way.

## 0.4.0 — 5 August 2026

**First publication**

### What appeared

- The package carries the language together with the FTS tools: 327 files, 1.1 MB archived and 8.3 MB unpacked.
- Emission into C, Go, Rust and Python.
- Module linking: `использует`, plus selective import with `только`.
- Self-application: the lexer, the parser, type checking, totality analysis and C emission — written in flang itself.
- The `emit` command: emission into a target language from the command line.
