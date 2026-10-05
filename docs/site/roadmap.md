# The road to 1.0

The current release is {{выпуск.версия}}. Below: what goes into 0.8, 0.9 and 1.0, in which
order and by when. The dates are the lead's targets, not promises: every bar is closed by a
run anyone can repeat, and until that run is green the bar is not closed. What the language
already does is read elsewhere: [Language reference](language.html),
[Installing](install.html), [Releases](releases.html).

| bar | 10.26 | 11.26 | 12.26 | 01.27 | 02.27 | 03.27 | 04.27 | status |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| **0.7.25 — exact numbers** | | | | | | | | |
| exact integer and exact fraction without the 2^53 ceiling | ██ |   |   |   |   |   |   | done |
| a child's memory and time limit named by the program | ██ |   |   |   |   |   |   | done |
| the package registry page | ██ |   |   |   |   |   |   | done |
| **0.8 — tooling** | | | | | | | | |
| prebuilt binaries in the release: Linux and macOS, four triples | ██ | ██ |   |   |   |   |   | in progress |
| one install per channel (brew, asdf, binary, source) | ██ | ██ |   |   |   |   |   | queued |
| tooling in flang: shell and JavaScript leave | ██ | ██ | ██ |   |   |   |   | in progress |
| Latin names are English words, no transliteration | ██ |   |   |   |   |   |   | in progress |
| field laws over fractions; case analysis, arithmetic, rewriting in the kernel | ██ | ██ |   |   |   |   |   | in progress |
| every rule of the record checker proved in Lean | ██ | ██ |   |   |   |   |   | in progress |
| **0.9 — proofs** | | | | | | | | |
| induction inside a proof; termination by a declared measure as a theorem |   | ██ | ██ | ██ |   |   |   | queued |
| quantifiers inside formulas, existence without a named value |   |   | ██ | ██ |   |   |   | queued |
| a second, independent checker of the proof record | ██ | ██ | ██ |   |   |   |   | in progress |
| packages: install, version resolution, lock file |   |   | ██ | ██ | ██ |   |   | queued |
| category laws (monoid, monad) judged by the kernel |   |   |   | ██ | ██ |   |   | queued |
| **1.0** | | | | | | | | |
| two prints of the compiler agree, and CI checks it |   |   |   | ██ | ██ |   |   | queued |
| diagnostic and proof-record formats frozen |   |   |   |   | ██ | ██ |   | queued |
| three real services running for months |   |   | ██ | ██ | ██ | ██ | ██ | depends on users |

## What 1.0 means

Seven conditions, each checked by a command, not by a word:

1. **The compiler builds itself reproducibly.** Two prints from one tree give the same C,
   and CI compares them on every release.
2. **Reprinting is cheap.** A full print of the compiler takes under an hour on an ordinary
   machine (today about 80 minutes on the build server).
3. **The proof kernel is proved.** Every rule the kernel closes a claim with has a theorem
   in Lean checked by a foreign kernel, and there is a second, independent check of the record.
4. **No known typing holes.** Every hole found is either closed or named in the diagnostics
   reference with a number.
5. **Formats are stable.** Diagnostic codes, the proof record and the intermediate form do
   not change without a new major version.
6. **Packages are complete.** Search by name, install, version resolution, lock file.
7. **The language is in use.** Several real services that live for months and get fixed
   when they fall.

## 0.7.25 — exact numbers (October 2026, shipping)

- `exact integer` and `exact fraction`: addition, subtraction, multiplication, division of
  fractions and order without the 2^53 ceiling; `(1/10 + 1/5) + 3/10` and
  `1/10 + (1/5 + 3/10)` give the same fraction — which never happens over `number` (double).
- The memory and time limit of a child process is named by the program, not by the shell.
- The package registry page is printed from the list of names and published on the site.

## 0.8 — tooling (November 2026)

What a programmer gets:

- **Install without a C compiler.** The release carries prebuilt binaries for Linux (x86_64,
  aarch64) and macOS (arm64, x86_64) with checksums; `brew`, `asdf` and a direct download
  install the same file.
- **Tooling in the language itself.** Repository checks, benches and the site build run as
  flang plans, not sh and JavaScript; shell stays only where it judges the compiler itself,
  and those places are named one by one.
- **Clean names.** Command keys, diagnostic codes and script names are English words.
- **A more capable kernel.** Field laws over the exact fraction; case analysis over a finite
  type; linear arithmetic from assumptions; rewriting the goal by proved equalities.
- **The record check proved whole.** Every rule of the independent check has a Lean lemma,
  and a separate check turns red if a rule appears without one.

## 0.9 — proofs (February 2027)

- Induction over naturals and over your own types inside a proof; proved termination by a
  declared measure — as a theorem, not a declaration.
- Quantifiers inside formulas and existence without a named value.
- A second implementation of the record check, not written in C: a disagreement between the
  two is visible on every release.
- Packages: `flang package` installs, resolves versions and writes the lock.
- Monoid and monad laws are judged by the kernel, not by an example.

## 1.0 (spring 2027)

- Reproducible self-build in CI, a print under an hour.
- Frozen formats of diagnostics and of the proof record.
- Three services in production for months — this condition is closed by users, not by the
  lead, so it is the only one without a firm date.

## Ruled out

- **No closures.** Capturing an environment breaks the termination proof and direct emission
  into C, Go and Rust; first-class functions exist, closures do not.
- **No two versions of one library in one program** — the version is raised instead.
- **No code in a database instead of files (the Unison model)** — only content addressing
  is taken.

How to check any line above: every bar has a task in `docs/tasks/` and a decision in
`docs/adr/`; a bar is closed by a green run, named on the [Releases](releases.html) page.
