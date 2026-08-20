# For contributors

This half of the site is the project's working papers: measurements, the record
of paths that were rejected, the journals. Someone writing in flang does not need
them, which is why they no longer sit in the menu next to the tutorial. They
cannot be thrown away either: every number the language states about itself rests
on them.

Most of these documents are in Russian. If you came to look at the language
rather than to build it, go [home](index.html) and follow the path
[Install](install.html) → [Your first program](getting-started.html) →
[Tutorial](tutorial.html).

## Measurements

Every one of them is a run, not an estimate. A negative result stays published
next to a favourable one: a measurement retracted for giving an inconvenient
answer is worth nothing.

- [Speed against Python and Node](../benchmark-speed.html) — how much slower we
  are, and how much of the gap is the price of provability rather than
  unfinished work.
- [The price of a proof against tests](../benchmark-proof-cost.html) — twenty
  ordinary library functions, both jobs done on each. The first answer: 0 out
  of 20.
- [The price of a proof, second run](../benchmark-proof-cost-2.html) — the same
  twenty functions two days later, after kernel fixes: 2 out of 20, or 6 out of
  20 counting weakened claims.
- [How many processes the scheduler holds](../benchmark-processes.html) — a
  million live processes, the time to start them and the price of a switch.
- [Memory and regions](../memory.html) — what the arena holds, what the fix
  bought and where the cost still shows.
- [Modularity and packages](../modules.html) — the hypothesis "a function's name
  is the hash of its text", with Unison installed, run and measured rather than
  retold.
- [WebAssembly via C](../wasm.html) — whether a separate emit target is needed.
  The answer is no, and here is what that rests on.
- [What backs the install](install-evidence.html) — hashes, sizes, build times
  and what could not be checked.

## Knowledge base

[The index of notes](../knowledge.html). One note is one established fact: a
measured number, a bug found, a path rejected and the reason it was rejected.
It is worth reading before starting work: half the notes exist precisely so that
settled questions are not reopened.

## How the project is built

- [How these docs are made](about-docs.html) — where the numbers on the pages
  come from, why they cannot be typed by hand, and what the build checks.
- [Repository layout](../project-layout.html) — what lives where.
- [Developing the language](../developing.html) — how something new gets added.
- [Known limitations](../limits.html) — what the language cannot do and knows it.

## Journals

- [Releases](releases.html) — versions and what arrived in them. This is the one
  journal aimed at a reader of the language, and it stays in the main menu.
- [Merge journal](../changelog.html) — what was merged into the trunk.
- [Commit journal](../journal.html) — the same thing in more detail.
