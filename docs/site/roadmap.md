# What is left before 1.0

This page answers one question: what flang still lacks for release 1.0. The
current release is {{выпуск.версия}}. What has already shipped is on the
[Releases](releases.html) page.

Release 1.0 ships when seven conditions hold. Each condition has a command and
a number that show whether it holds. There are no dates.

## Seven conditions

### 1. The compiler builds from its own sources, and the builds match

The flang compiler is written in flang. You build it from the sources and get
exactly the same file, down to the last byte. Then the published compiler can
be trusted as much as its sources.

- **Done.** An automatic check builds the compiler twice and compares the
  results. The latest runs in a row matched.
- **Missing.** One such check takes four to six hours. The match must hold on
  every change to the compiler.

### 2. A compiler fix reaches you quickly

After any change the compiler rebuilds itself. While that is slow, fixes ship
less often.

- **Done.** A full rebuild takes from 76 minutes to almost three hours on
  different machines.
- **Missing.** The goal is under an hour.

### 3. The word "proved" can be trusted

When `flang check` says "proved", you rely on the proof checking inside the
compiler. The condition requires a proof that it accepts no false statement.

- **Done.** Every inference rule has a theorem in Lean 4. A separate program,
  `checker`, re-checks proof records without the compiler.
- **Missing.** The formal model covers 510 of the 603 proofs in the compiler's
  own records. There is no theorem about the code of `checker` yet.

### 4. No known type-checking bugs

A program that passed `flang check` must not break its declared types. Every
type-checking bug found is written into a list. Each has a test that notices
its return.

- **Done.** 46 such bugs were found and 45 are fixed. A program generator looks
  for new ones every day.
- **Missing.** One bug is open: two functions whose postconditions call each
  other pass the termination check. There is no proof that the list is
  complete.

### 5. Error codes and the proof record format do not change unnoticed

Your scripts and CI may parse the `FLANG_*` codes and proof records. The
condition requires that they do not change without notice.

- **Done.** Every code is in a table with a status, and a stable code cannot
  disappear. The record format has a version number.
- **Missing.** The text of an error message is not stable. The format version
  has never changed, so changing it is untested in practice.

### 6. Someone else's module is imported with one line

A module is named by its address in the import line:
`использует «Логика» из "https://…/logic.flang"`. The first `flang check`
downloads the module and writes its text into `flang.lock`. Later builds need
no network and give the same result.

- **Done.** This works today: see [Modules and packages](packages.html).
- **Missing.** Author signatures. The `flang.lock` file confirms that the
  module did not change, but does not say who wrote it.

### 8. The generated C code does what is proved about the source

A proof is about the flang source. The command `flang emit --target c` creates
C code from it. The condition requires checking every function of that code
against the formal description of the language in Lean.

- **Done.** On the base set of 55 example files the printed C of 165 functions
  is checked against the reference, 164 of them for every input.
- **Missing.** Across all examples in the repository 1332 of 9375 functions
  are proved. `flang emit` does not run this check itself. A fully proved code
  generator is outside 1.0.

There is no condition number 7: it was removed, and the other numbers stay as
they were.

## Release plan

This is a plan, and it may change.

| Release | Meaning | What goes in |
|---|---|---|
| 0.8.0 | gives no wrong answer | the known wrong answers of the checks are fixed; `flang check` names every unproved statement; automatic proofs are checked in CI |
| 0.9.0 | ready to hand to people | documentation, playground, formatter, compatibility rules; the release passes every check |
| 1.0.0-rc | candidate | conditions 3 and 8 meet their written thresholds; release archives are signed; the syntax is frozen |
| 1.0.0 | release | only fixes from feedback on the candidate |

## What we decided not to do

- **No closures.** Capturing the environment breaks the termination proof and
  the direct generation of C, Go and Rust code. Function values exist.
- **No two versions of one library in one program.**
- **No package registry and no install command.** A module is named by its
  address.
- **Code is kept in files.** From storing code in a database only content
  addressing is taken.

## Details

The commands, thresholds and state of each condition are collected on the page
[For language developers](contributing.html).
