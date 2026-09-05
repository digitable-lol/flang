# Releases

A release is a `vX.Y.Z` tag, and behind it an archive and a package publication. This page is printed from the tags: as many entries as there are tags, and a release cannot be skipped.

There are three boxes: **what appeared**, **what changed**, **what broke**. An empty box is not printed — "broke: nothing" nine releases in a row tells the reader nothing.

The entries below are about the language, not about the work on it. What has landed on the trunk since the last release is shown by the [merge journal](../changelog.html) (in Russian); every commit subject is in the [commit journal](../journal.html).

## 0.7.10 — 4 September 2026

**Hotfix: the live shell crashed on every line of input**

### What changed

- The REPL (`flang` with no arguments) answered `FLANG_UNKNOWN_NAME: record has no field «scheduler header»` on ANY input, including `1 плюс 1` — not just elaborate examples. Cause: a hand-rolled field list for the «Settings» record in `flang_repl.c` (used by the «c» target's emitter for every line of a live session) fell behind the shared field table by two names when the «c» target learned to emit processes. The fix landed on dev on September 3rd, but after the v0.7.3 tag was already cut — so the bug was live in that release.
- The seed's version string (`FLANG_VERSION`) had drifted three releases behind (`0.7.0` instead of `0.7.3`) — the same bug class already fixed once by the 0.7.1 hotfix, recurred, and is fixed again; a task now tracks preventing a fourth recurrence.

### What broke

- The language is still NOT formally provable: 2 of the criterion's 7 gates are taken. In the meantime a real hole in the independent checker was found and fixed (hiding text behind a trailing comment went unchecked at one more site), checker-verified corpus share rose from 5.00% to 7.50%, and for the first time two independent prints of the same commit matched byte-for-byte — but no gate was closed outright by any of this.

## 0.7.9 — 4 September 2026

**Tagged, publication stopped by the pipeline**

### What changed

- Same content that shipped as 0.7.10 — the sixth publication failure in a row in this chain (after v0.7.4-v0.7.8), before finding the real fix: release.yml's workflow_dispatch was never removed (only the old publish-npm.yml lost it), and a dry run on the branch gives the real hash without burning a tag. The pipeline stopped BEFORE publishing each time, nothing broken went out; the tag was not deleted, simply skipped.

## 0.7.8 — 4 September 2026

**Tagged, publication stopped by the pipeline — deliberately**

### What changed

- Tagged on purpose with a known-wrong hash (the 0.7.7 archive's) to harvest the real 0.7.8 archive hash from the pipeline's own error text. Also found along the way: the pipeline requires the tag's version to exactly match package.json BEFORE building the archive — the version could not be left unchanged to keep a hash valid. The same content actually shipped as 0.7.9.

## 0.7.7 — 4 September 2026

**Tagged, publication stopped by the pipeline — deliberately**

### What changed

- Tagged on purpose with a known-wrong hash (the 0.7.6 archive's) specifically to harvest the real 0.7.7 archive hash from the pipeline's own error text — the same technique already used twice tonight. The same content actually shipped as 0.7.8.

## 0.7.6 — 4 September 2026

**Tagged, publication stopped by the pipeline**

### What changed

- The number in the Homebrew formula was the 0.7.5 archive's hash (the coordinator copied the pipeline-reported hash for the wrong content version) — its own build on the tag naturally diverged. The pipeline stopped BEFORE publishing, nothing broken went out. The tag was not deleted, simply skipped.

## 0.7.5 — 4 September 2026

**Tagged, publication stopped by the pipeline**

### What changed

- Same content that shipped as 0.7.6: the Homebrew formula's sha256 was computed locally with the documented command, but the local archive build didn't byte-match what the pipeline produces (cause undiagnosed) — the pipeline stopped BEFORE publishing, nothing broken went out. The tag was not deleted, simply skipped.

## 0.7.4 — 4 September 2026

**Tagged, publication stopped by the pipeline**

### What changed

- Same content that shipped as 0.7.5: the Homebrew formula's sha256 was still 0.7.3's, the release pipeline checked it against the archive it built on the tag itself, and stopped BEFORE publishing — the safeguard worked as intended, nothing broken went out. The tag was not deleted, simply skipped.

## 0.7.3 — 3 September 2026

**The version hotfix finally reached publication**

### What changed

- The same version hotfix tagged as 0.7.1 and 0.7.2 is finally published: for both of those tags the hand-built archive didn't match what the release pipeline itself built (0.7.1 — a full mismatch; 0.7.2 — 4 bytes out of 4,447,763, cause never diagnosed), and the Homebrew formula failed verification. For 0.7.3 the sha256 was taken directly from the pipeline's own sha256sum rather than recomputed by hand — installation was verified end to end: download, hash check, build, `flang --version`.

## 0.7.2 — 3 September 2026

**Tagged, but publication failed again**

### What changed

- A second attempt to publish the 0.7.1 version hotfix: the archive's real sha256 was taken from the pipeline rather than recomputed by hand. The build still diverged from the pipeline's own by 4 bytes out of 4,447,763 (cause never diagnosed) — the Homebrew formula failed verification. The tag was not deleted (deleting tags is forbidden here), simply skipped: it delivered nothing to anyone installing via Homebrew.

## 0.7.1 — 3 September 2026

**Version hotfix — tagged, but publication didn't land**

### What changed

- `flang --version` answered “0.6.2” under the 0.7.0 release — two releases behind: the seed's version string was left un-bumped alongside `package.json`. Task 9959 fixes it. Also fixed along the way: the Homebrew formula's version (`0.6.2 -> 0.7.0`, missed in the first pass), the version shown on the site, and part of a CI job that was burning push-triggered hours running under no name.

### What broke

- Publication under this tag did NOT land: the hand-built release archive didn't match what the release pipeline itself built, and the Homebrew formula failed its hash check. The tag was not deleted, simply skipped — this same fix was only successfully published as 0.7.3.

## 0.7.0 — 3 September 2026

**The compiler was reprinted from scratch, and the release’s main work was finding our own self-deceptions**

### What appeared

- C++ became the ninth print target; regular expressions, sqlite and Redis drivers, TLS 1.3 and a package registry arrived.
- Files take three equal extensions; step and depth limits have their own flags; `--no-check` prints without checking, and `check --быстро` says plainly what it did not look at.

### What changed

- The compiler was reprinted from scratch off the frozen trunk: the print took 12 hours 4 minutes, of which 10 hours 25 minutes (86 %) was the kernel-judgment stage.
- The release path completed end to end for the first time. Before, it never had: the archive step called a binary nobody built, and the 0.6.2 release was assembled by hand.

### What broke

- The language is NOT formally provable: two of the criterion’s seven gates are taken — the kernel emits a proof object, and the size of the trusted base is named as a number.
- The kernel can prove a FALSEHOOD: unfolding a call substitutes an argument under a binder of the same name and prints “proved for ALL inputs” about a claim false on every input. Today’s corpus contains no such proof — measured, 0 of 240.
- The share of the corpus verified by the independent checker is 0.00 % as of the freeze. The previously quoted 0.83 % was overstated and has been withdrawn.
- Reprinting the compiler with the 0.7.0 seed needs `--предел-глубины 200000`: the built-in limit of 20 000 hits one machine-written postcondition line of 90 286 code points.

## 0.6.2 — 22 August 2026

**The Homebrew install is fixed: the archive shipped a directory nobody could enter**

### What appeared

- The secure connection works for real: twelve runs with genuine response codes.
- The fold principle is strengthened with the already-traversed part of the list: +2 proved obligations, with a forgery and its honest half added alongside the rule.

### What changed

- The two measures of string length are reduced to one. A memory corruption was found and closed along the way.
- Import discovery parses the file header rather than the whole file: 24% less memory, 5% less time.
- Two hand-written copies of list comparison were removed and three stale references to a long-lifted ban were fixed.

### What broke

- Nothing. This release fixes the install broken in 0.6.0 and 0.6.1: the archive was packed with `--mode=u=rw,go=r`, which strips the traverse bit from DIRECTORIES too, so `runtime-c` arrived as `drw-r--r--` and `brew install` failed with `Errno::ENOENT: runtime-c/flang_cli.c`. The cure is the letter `X` — `--mode=u=rw,go=r,a+X`. The command is corrected both in the formula and in the publish workflow.

## 0.6.1 — 22 August 2026

**A compiler change that never reached the built compiler now goes red in half a second**

### What appeared

- A cheap check that the compiler sources match their C translation: `sh scripts/raskrutka.sh --bystro`. Previously a mismatch was caught only by the hour-long reprint, and over two days work reached the trunk four times carrying a rule the built compiler did not have. It is now visible immediately, on every push.
- Two new rules in the proof checker: case analysis over a goal's inner condition, and a rule for incompatible conditions. The gain is measured and written as a number in the kernel itself: +2 and +2 proved obligations across six library files.
- An octet pair of file orders: read and write a file as bytes rather than text. The text pair now refuses honestly on non-text instead of corrupting it silently, and a zero octet is legal text again — the refusal is only for malformed UTF-8.

### What changed

- The name-collision check sees the whole closure: an import by name without a path is resolved through the registry, and instead of one file out of thirty-six it now looks at all of them. On this tree: 736 files, 56,345 declarations.
- The forgery check reads the whole directory rather than a list: 15 named forgeries became 24, and stopping at the first failure no longer hides the rest.
- `«Ответить в соединение»` no longer truncates content at the first zero byte: the length is taken from the value itself. Measured on the compiler's own source — the trunk was losing 47,184 bytes on `flang/self/link.flang`.

### What broke

- The text file-read and file-write orders now refuse on binary content instead of returning a truncated result. Use the octet pair for binary.

## 0.6.0 — 22 August 2026

**Long computations no longer hit a memory wall: 15.98 GiB became 0.0135**

### What appeared

- PostgreSQL login over `scram-sha-256`: SHA-1, HMAC, PBKDF2 and the SCRAM client are written in the language itself, and the login is verified by a run against a real PostgreSQL 17.10, not a stub.
- Three new inference rules in the proof checker. A finiteness caveat: NaN sits outside the order, every bound over it is false, and the caveat "while this is a number" is now read as a fact. Case analysis over a disjunction in an assumption: "A or B" is not split, it is taken apart into two cases, and the goal is accepted only when both close. And the goal "A and also B".
- Supervision of failed processes across the network: a node survives the death of its neighbour, and the lost work is taken over by the survivor. The loss is reported to the supervisor by the link layer, not by socket cleanup.
- A "Wire" module — the shared half of binary protocols over TCP, lifted out of the PostgreSQL driver. Of the driver's 83 functions only 39 were about PostgreSQL; the rest fit any binary protocol.
- Browser pages are written in the language itself: eight emit targets out of eight, and not a single line of JavaScript in the pages.
- A check for vacuous proofs. The library's 93 proved claims are sorted into four piles, and "proved" about something that holds for any function with the same signature is named for what it is instead of being counted alongside substantive claims.

### What changed

- Memory no longer grows during a long computation. The interpreter is a loop, and its arena was released only at the very end: tail recursion cost 84 kilobytes per iteration. It is now released on every iteration. Over 200,000 iterations the peak went from 15.98 GiB to 0.0135 GiB, time from 25.3 to 13.5 seconds, and the peak no longer depends on the iteration count at all.
- Equality in a function body is allowed: the old ban turned out to be a stale restriction rather than a boundary of the language. Permission to compute is still not permission to infer — there is a forgery fixture for exactly that.
- The step ceiling for printing the compiler was raised from 40 million to a billion. After the new inference rules the compiler's check of itself no longer fit under the old one, and printing was cancelled outright.
- The JavaScript implementations of the checks are gone: the proof layer (4,958 lines), the emit and occupied-name checks (682 lines) and four files nobody called (836 lines). Printing the compiler to C needs Node at no step.
- Searching the documentation by refusal code finds 13 codes out of 13 — it used to find 0 of 13.

### What broke

- The `emit:check` shortcut is gone: the emit check is done by `pechat:check` in the language itself, and `occupied:check` now calls `scripts/occupied-names-guard.flang` instead of the removed JavaScript script.
- The shared half of the PostgreSQL driver moved into the "Wire" module. Programs that called `«Знак байта»`, `«Четыре октета»`, `«Два октета»` and their neighbours directly from the database module must now import "Wire".

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

- Each of the eight emission targets is now also written in flang itself; `js` was the last one closed. No target is left without its own flang version.
- The proof report is computed by code written in flang itself: `flang check --proof` no longer calls the JavaScript implementation.
- The type `вес` — the segment from zero to infinity. Three operations over it are allowed, four refuse and show the pair they refused on.
- Exact decimals: money is computed without a binary fraction, and the binary handles it itself.
- The permission "safe to repeat" is now granted explicitly instead of being assumed.
- A dependency lock file: a program builds from it without the sources.
- Input and output grew directory listing and process spawning, and `flang io` distinguishes "found a problem" from "broke itself" by different exit codes.
- The documentation site builds from `docs/` by one command, with no dependency at all.

### What changed

- Emitted C got faster: link-time optimisation is on by default — that is 1.14× — and the type check is not emitted where the type is already proved: 4.9× on arithmetic, 1.6× together.
- The memory region in the C target learned to roll back: merge sort over four thousand numbers takes 3.5 MiB instead of 1655.
- The declared depth limit in WebAssembly became a limit: 7474 nested calls and the same refusal text as an ordinary run, instead of a dead tab at depth 60.
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
- The compiler emitted into C now installs the run-time check that the measure decreases, and no longer loops where the JavaScript implementation refused.

### What broke

- The word `убывает` became a keyword.

## 0.4.7 — 7 August 2026

**Monad, failure as a value, polymorphism**

### What appeared

- The monad got a form: `в монаде` unfolds into a case analysis all the way down.
- The failure of "to number" became a value: a column of strings adds up without falling over.
- A number descends by a constant step — down to a checked floor.

### What changed

- `тотальная` stopped promising more than is proved: where termination rests on a number, a run-time check that the measure decreases is emitted.
- The library collapsed along its types once polymorphism was closed; the second parameter found a defect in self-application.

## 0.4.6 — 7 August 2026

**The binary talks to a human: check, shell, help, man**

### What appeared

- The installed binary became a tool for a human: `flang check`, help, version, a `man` page.
- A function became a value: the compiler replaces it with a tag and dispatches on tags, so the call graph stays finite and a function-value reached every emission target.
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

- The compiler written in flang itself emitted itself with no differences at all.
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
