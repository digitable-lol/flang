# What comes next

This page is about what the language does not have yet: what is being worked on,
what is queued, and what has been ruled out. There are no dates here — no
quarters, no months. The order of the stages is taken from the tree's root
`ROADMAP.md`, which the lead is rewriting into five stages; the decision behind
each stage is recorded in `docs/adr/`, the tasks live in the tracker, and their
numbers are given below.

What the language already has is not read here:
[Language reference](language.html), [Standard library reference](stdlib.html),
[Command reference](cli.html), [Diagnostics reference](diagnostics.html),
[Language operations](operations.html), [Setting up your editor](editor.html),
[Troubleshooting](troubleshooting.html), [Releases](releases.html).

## Where the language is now

| | |
|---|---:|
| Functions written in flang | {{корпус.функций}} |
| Of them with termination proved | {{корпус.тотальных}} |
| Behaviour claims stated | {{утверждения.высказано}} |
| Of them proved by the kernel — for all inputs | {{утверждения.доказано}} |

The four numbers in the table were measured on 23 August 2026 (commit
`252606e8`) by a compiler run over the whole corpus and have not been
re-measured since; on the day of measurement the compiler was built from a seed
that had fallen behind the sources. What was checked on the tree of
11 September 2026 (0.7.17, commit `2c40752d0`):

- the bootstrap seed was reprinted on 10–11 September (commit `0ce948bfd`);
  `sh scripts/chto-otstalo-ot-semeni.sh` names 3 files, 77 functions, still
  behind;
- `sh scripts/доказуемость.sh` answers **PROVABLE**: the independent checker
  (`flang/proof/чекер/сверщик.c`) replayed 625 obligations of the compiler's own
  proof out of 651 — 96.01 %; 401 forgeries rejected, 197 honest records
  accepted;
- there are ten emit targets: {{цели.список}}.

The main limit of the language shows in the table, and it is also the first
stage of the plan: termination is proved in bulk, behaviour less often, and the
proof covers only what stands at a function under the words `требует` and
`обеспечивает`. Expressible today: inequalities over numbers, list lengths,
ordering, one quantifier — "for all inputs of the function". Not expressible:
"there exists", claims not attached to a function, state over time, effects,
concurrency. Emitted code (C and the other targets) is not covered by the proof.

## Five stages, and each holds the one after it

**1. The set of obligations — up to 100 %.** Today the independent checker
replays 625 obligations out of 651; the remaining 26 are taken on the kernel's
word (16 premises and claims, 4 steps) or set aside as unreachable. Every open
place is named in `docs/road-to-one-hundred-measured.md`, with the price of each.
Task 6191 (the set up to the 95 % threshold) is done; the rest follows that map.

**2. A proved translation into C.** The printer (`flang/self/emit-c.flang`) is
not proved today, and the emitted program is not covered by the proof: what is
checked is what was written in flang, not what came out of `flang emit`. The
decision — `docs/adr/0030-the-printer-proves-each-run-not-itself.md`: the
printer proves each of its runs, not itself as a whole (how CompCert closes the
gap below us is worked through there, §9). Tasks 1401 and 1402.

**3. Logic.** Of the owner's four requests one turned out to be a missing rule
(subtraction under a precondition) and three to be other logics, for which the
kernel has no mechanism: `docs/adr/0032-one-missing-rule-and-three-other-logics.md`.
The same document has the price table and an honest section on what this does
not give. Tasks 1403–1406.

**4. Quantifiers.** Today a claim has exactly one quantifier — "for all inputs of
the function"; quantifiers over arbitrary types are a change to the kernel and
the checking program, not an add-on:
`docs/adr/0026-quantifiers-over-any-type-are-a-kernel-change.md` (accepted
9 September 2026). Tasks 6202 and 6203.

**5. Traceability, response and refusals.** Certification is a process, not a
property of the language:
`docs/adr/0031-certification-is-a-process-not-a-property-of-the-language.md`.
Of what it needs beyond the proof, traceability requirement → code → example →
record exists as a guard since 11 September 2026
(`scripts/traceability-guard.flang`, task 1407): 409 postconditions, 322 with an
example, 361 in a record, 244 proved; gaps 62 and 68, under a ratchet. Response
bounds exist only as an analysis and are not printed into the proof record
(`docs/adr/0033-termination-is-not-a-bound-on-steps.md`, tasks 1408 and 1409);
behaviour on failure is described, not proved — an I/O failure arrives as data,
hardware failure the language does not see
(`docs/adr/0034-hardware-failure-is-described-not-proved.md`, task 1410). Space,
medicine and aviation are not promised (ADR-0031, §5.4).

## What used to stand here

Until September 2026 the first item was "there will be no release until the seed
is reprinted": `sh scripts/raskrutka.sh --bystro` named 45 divergences, and the
seed held not a line of the C emission of the process plan. That is gone: the
seed is reprinted (`0ce948bfd`), `grep -c 'flang_conc.c'
bootstrap/compiler_flang.c` answers `2`, and release 0.7.17 went out on
11 September 2026 (commit `144208489`). The items about a package manager,
application code and auxiliary JavaScript files remain work, but are not part of
the five-stage plan: the JavaScript implementation was removed on 20 August 2026
(`fe8e8a37`), and the tree holds 52 auxiliary `.mjs`/`.js` files
(`git ls-files '*.mjs' '*.js' | wc -l`, 11 September 2026).

## Ruled out

**No closures.** Capturing an environment breaks the termination proof and
direct emission into C, Go and Rust. First-class functions **do** exist: the
compiler replaces a function value with a label and dispatches on labels. A
closure and a first-class function are different things; only the first is
refused.

**No lookaheads or lookbehinds in regular expressions.** `(?=…)`, `(?<=…)` and
back-references `\1` require going back and re-reading what was read — exactly
the backtracking the engine (`flang/stdlib/automaton.flang`) was written to
avoid. A pattern with them does not fail silently: the reason is put into the
«беда» field.

**No two versions of one library in one program.** When two dependencies pull
one library at different versions, that is solved by raising the version, not by
having both side by side in the program. The reasoning is in
[Modules and packages](../modules.html).

**Not the full Unison model.** Storing code in a database instead of files means
owning the editor, owning the host and losing git. Half of it — content
addressing — is taken; the other half is not.
