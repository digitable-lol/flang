# Releases

A release is a `vX.Y.Z` tag, and behind it an archive and a package publication. This page is printed from the tags: as many entries as there are tags, and a release cannot be skipped.

There are three boxes: **what appeared**, **what changed**, **what broke**. An empty box is not printed — "broke: nothing" nine releases in a row tells the reader nothing.

The entries below are about the language, not about the work on it. What has landed on the trunk since the last release is shown by the [merge journal](../changelog.html) (in Russian); every commit subject is in the [commit journal](../journal.html).

## 0.7.14 — 7 September 2026

**The checker replays termination proofs itself**

### What appeared

- A totality certificate for COMPOSITION. The binary prints into the proof record the evidence «this function terminates because it has no recursion — only calls to already-terminating functions», and the independent checker replays that evidence (`сверить_тотальность`) instead of trusting the name of the rule. The replay does not depend on the order of blocks in the record: two passes plus cycle detection. The seed was reprinted and 82 corpus records were printed anew. Commits `ff1dc5b7`, `cbac34ce`, `7cd56073`, `fba02c9a`.
- A totality certificate for RECURSION, kinds `structure` and `step`: termination by descent along a variant of an inductive type, and by a decreasing measure bounded below by zero. The binary prints the node with the full witness — decreasing argument, floor, turns, self-call — and the checker replays it. Honestly: on the current corpus the share gains about nothing, because the corpus proves termination of recursion over the built-in list by a type law rather than by these certificates; the ability landed as groundwork. Commits `4bfbd217`, `5d73d391`, `d1bbbf94`.
- A share-by-replay instrument: `sh flang/proof/доля-корпуса.sh --проигрыванием`. The numerator counts obligations the checker really replayed; the denominator counts ALL obligations of the corpus, including those taken on the kernel’s word and those of rejected records. No record drops out of the denominator. Commits `00a56ba5`, `682006f5`.
- Cross-module linking of the totality certificate (`--набор`, `--зависимость`): trust in a set of records is granted only through a replayed carrier. On the current corpus there are zero such sites — this landed as groundwork, not out of need. Commit `4743a313`.

### What changed

- The share ruler now counts differently, and the number is not comparable with earlier releases: steps «by example» and «by property», which the checker already verifies by computation, now go into the numerator and not only into the denominator. After the composition totality certificate the share is 47.33%, after crediting what is verified on the merits — 60.78%; the trusted base does not grow and no reprint is needed. The share printout breaks the number down: by moves, and on the merits. Commit `f5ca9e8f`.
- Category theory moved: the `flang/cat` directory became `flang/ct`, its prose `docs/ct`. Commits `acca80a3`, `8142524b`.
- `//` comments and duplicates were removed from 192 example files, and `http.flang` was rewritten as a data table instead of 55 near-identical entries. Commits `bfd86834`, `853d2f01`, `d2779328`.

### What broke

- The language is still NOT formally provable. A fallback calculator, `перепиской`, remains in the checker: it recomputes some goals rather than replaying the recorded moves. While it is there the `доказуемость` shortcut answers NOT PROVABLE, and the calculator cannot be removed partially — the share would collapse outright.
- The 95% threshold is not guaranteed on this corpus even in the limit: deliberate corpus forgeries are kept in the denominator (otherwise the share could be inflated) and can never enter the numerator, so the structural ceiling lies roughly between 91% and 96% — the threshold sits inside that bracket.

## 0.7.13 — 6 September 2026

**The proof object: the checker verifies the kernel’s finished derivation instead of recomputing it**

### What appeared

- The binary itself now prints a replayable proof trace for five identity families — neighbours, reflexivity, length, element, compute. Until now only the checker could build the chain of moves. The first end-to-end run is green: the binary emits the trace, the independent checker replays it, «taken on the kernel’s word: 0». The seed was reprinted. Commits `2eb5633e`, `c3d17187`.
- The «postcondition of the callee» technique: the checker builds an instance of the callee’s postcondition from the call site itself — arity, parameters substituted by arguments and the result by the node — and closes the goal by modus ponens, instead of the old name-plus-line binding. It catches a real forgery: a theorem claiming «the result equals 3» over a body that yields 0 used to pass with code 0 and now gives code 1. Commits `e5a75366`, `d433f3b2`.
- The moves «compute» (closed arithmetic such as «2 plus 2 equals 4») and «rewrite by form» (the length and element laws) are replayed by explicit primitives over `оценить_терм` rather than accepted on the kernel’s word. Commits `a1f19f27`, `269d3ccf`, `b0ef3a31`.
- `хеш256` became a built-in word of the language: SHA-256 is computed by the runtime of each of the nine emit targets, not by a flang library. Commits `5c90d6f7`, `ee3b0121`.
- The `js` target got a Node host — `flang/src/emit/js/flang_host_node.js`. A program with an input/output plan, printed to JavaScript, now actually runs: nine kinds of orders out of twenty-two, with a clear refusal for the rest. Commit `7e7007a2`.
- A plan executor for the `python` target landed in the tree — `flang/src/emit/python/flang_io.py`. The `python` target still refuses to print a program WITH a plan (`FLANG_PLAN_UNSUPPORTED`): the executor is waiting for the emitter. Commit `e84e290b`.
- Three examples under real frameworks — `docs/examples/frameworks/`: `nestjs-orders`, `react-invoice`, `vue-roman`. A proven core in flang is printed to JavaScript and runs under Nest, React and Vue; each example’s README states where the boundary lies: the decision is in flang, the socket and the rendering belong to the host framework. Commit `374e9aaa`.
- `./ярлык доказуемость` prints a single word — PROVABLE or NOT PROVABLE — from three numbers taken by a run, not from a judgement written into prose. Commit `7b03ee3a`.
- `./ярлык версия X.Y.Z` raises the version number in one source and propagates it to the derived places — package.json, the `#define` in C, the man page, the Homebrew formula; a guard reddens if any of them falls behind. Commits `3071b76c`, `d676ec12`.

### What changed

- The replayer now gates equality postconditions on the chain of moves. Previously a false move under an equality postcondition passed with code 3, indistinguishable from an honest one, because the replayer was called on zero lines; now such a move gives code 1. Commit `3931ae1a`.
- Two checker complaints are closed: a premise under `принцип …` without an explicitly written `теорема` never reached the replayer (the moves beneath it were decoration), and `вставить_вместо` unconditionally wrapped the inserted body in one extra pair of parentheses, so on a compound condition no wording of the argument ever reached the goal. Commit `3cb04bcb`.
- The seed can be re-sown quickly, without a full reprint, when `flang/self` is untouched. Commit `d0060d56`.
- The list of `flang` commands is checked against five places at once: the man page and both READMEs did not know the `new` command. Commit `fb29de4d`.
- The ninth emit target, `elixir`, came under CI supervision, and divergence between the nine targets on one program is now watched by a separate instrument. Commits `5a5e9a74`, `532e6f2b`.

### What broke

- The language is NOT formally provable, and that is a machine verdict rather than an opinion: `git grep -c перепиской flang/proof/чекер/сверщик.c` gives 10, not 0, and `./ярлык доказуемость` answers NOT PROVABLE. Two of the criterion’s seven gates are taken.
- A narrow subclass of sites is not migrated: the «by declaration» route — 146 of 159 «proved» sites — prints only the name of the rule, with no chain of moves, so the replayer has nothing to replay.
- Paying for `требует` in the new technique is partial: a callee’s precondition counts as discharged only if it syntactically matched one of the caller’s own `требует`. Discharge by computation or by an `если` guard is not read by this wave — such sites are honestly rejected with code 1 rather than wrongly accepted.

## 0.7.12 — 6 September 2026

**An install now carries the runtimes of all nine emit targets, not one**

### What appeared

- A walker over the `flang/self` examples, and a CI job around it: 4350 examples of 4445 are supervised. Before this nobody ran them file by file — zero in CI. The full run was taken end to end: 55 minutes 19 seconds, exit code 0, 12,530 examples. Commits `a35a4b42`, `ec039e7f`, `3690acf4`.
- A second carrier for the «by case analysis» technique — `algebra`, with forgery probes. Commits `e11ed933`, `bb1e15a8`.
- Two checker rules: «start by construction» by value and not only by identity, and «unsatisfiable premise» — anything follows from incompatible assumptions. Counted by corpus records that is 28 of 86 against 30 of 86. Commits `2d58f99e`, `3e2ac46c`.
- The verdict cache printout names its hits and misses by number. Commit `c137e8d5`.

### What changed

- The release archive now carries a `runtime/<target>/` directory — 32 files, 2,435,747 bytes — and the Homebrew formula and the asdf plugin move its whole root into `share/flang`. Previously exactly one target of nine was installed: the other eight were promised by the man page, both READMEs and the binary’s own help, and did not work for whoever installed it. Commit `11295873`.
- The verdict cache key is computed with SHA-256 instead of a polynomial: the old key, advertised at 59.79 bits, was forged in 3.6 seconds. Commit `deea0d61`.
- The corpus was reprinted with the current binary — 67 records. The checker-verified share went 13.75% → 17.77% (17.92% was expected; the difference is a shifted denominator): the share had been held down by stale records, not by the checker. Commits `e1e362da`, `ed5de60a`.
- The hole «moves without a theorem hide the debt» is closed on both halves: «closed by reduction» is checked against the source, and an empty «move end» no longer hides the debt. Commit `817be78a`.
- «This number» was added to the `proofterm` import list — 1289 examples had never run at all. Commit `a85c7bb4`.
- The ninth emit target was added to five guards that did not see it; along the way it turned out that the `cpp` target escapes names by the `c` target’s list. Commit `9fb0f293`.

### What broke

- The language is still NOT formally provable: the checker replayed 30 corpus records of 86, against a gate threshold of 95%.
- CI builds and runs eight emit targets of nine; as of this release the ninth is only named by a number — it came under supervision in 0.7.13. Commit `6c0deb07`.

## 0.7.11 — 5 September 2026

**Supervision is back on dev, and guards prove by a run that they can redden**

### What appeared

- The `.githooks/pre-push` hook runs the cheap guards before a push and says out loud what it did NOT check. The full set costs about 134 runner minutes — a hook that long would be bypassed with `--no-verify` and would be worse than none. Installed with one command: `git config core.hooksPath .githooks`. Commit `1de3cf23`.
- An instrument for «who has been shown by a run to redden»: a guard without a forgery probe is a guard that is trusted for nothing. Commits `ff354a73`, `69550a3e`, `dc24ffa3`, `83a838b2`.
- A census of «which guards CI never calls»: the number had been counted by hand, and it was wrong. Commits `b29e8fa6`, `3fa4c09f`.
- A guard over the derived version numbers: the version string in the seed had been systematically falling behind the release; now the divergence reddens, and the version is checked against the release ARTEFACT rather than against a file lying next to it. Commits `2532b671`, `cf337f76`.
- The proved-share ledger checks its own table against the tree and is wired into both the shortcut list and CI. Commits `1bfe1e7d`, `5dba51a1`, `2aa82f5c`.

### What changed

- The checker learned three rules: negation of a closed computation, the finiteness proviso taken as a premise, and «the goal follows from what was declared about the arguments». The checker-verified share of the corpus went 7.50% → 13.75%. Commits `25181b19`, `ee23dd75`, `f5d378a1`.
- The last named hole in gate G2 is closed: the induction argument is taken BEFORE the colon. Separately, a false acceptance is closed — a type declaration was being read through a trailing comment — and with it five false alarms. A wider measurement gives 62 false alarms out of 923 for the old checker and 0 for the new one. Commits `002b20f6`, `a54d4b55`, `56a8441c`.
- CI runs on the `dev` branch again: nineteen jobs had checked none of 74 pushes. The CI build became twice as fast and the binary is cached. Commits `8f90f49a`, `15e89235`.
- Syncing the Homebrew tap is written into the release procedure: six releases in a row, 0.7.4 through 0.7.10, went out without it, and all that time `brew install` was installing 0.7.3. Commit `db23eb3b`.
- The 0.7.x release notes were taken from `main` wholesale: they had been written there and never came back to `dev`, because a release is made on `main`. Eleven versions were added and none rewritten. Commit `532468f2`.

### What broke

- The 0.7.11 archive never shipped, and this tag has no GitHub release. The release pipeline stopped at the step «check the archive hash against the Homebrew formula»: the formula at that tag still carried the sha256 of the 0.7.10 archive (`825a2b5b…`, the very one from v0.7.10) — `./ярлык версия` deliberately does not touch sha256, it is written in by a separate commit after a dry run, and for 0.7.11 that commit was never made. The pipeline skipped the upload step; nothing broken went out, and the tag was not deleted.
- The language is still NOT formally provable: the checker-verified share of the corpus is 13.75% against a gate threshold of 95%. And at this point it is held down not by the checker’s rules but by stale corpus records — the measurement promises 17.92% from a reprint. Commit `7e369d98`.
- Only 8 guards of 58 have been shown by a run that they can redden, and CI was trusting twenty of the unproven ones for nothing. Commit `ff354a73`.
- The guard census as of 5 September 2026: 56 guards, CI calls 29, twenty-seven are called by nobody. Commit `3fa4c09f`.

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

- The `emit:check` shortcut is gone: the emit check is done by `pechat:check` in the language itself, and `occupied:check` now calls `scripts/guards/occupied-names-guard.flang` instead of the removed JavaScript script.
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
