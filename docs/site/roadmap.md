# The road to 1.0

The current release is {{выпуск.версия}}. Release 1.0 is a language that can be
handed to people. Seven conditions must hold for it. What has already shipped
is on the [Releases](releases.html) page.

## Seven conditions

| No. | Condition | What it means |
|---|---|---|
| 1 | Reproducible self-build | the compiler builds itself, and two builds of one tree are byte-identical |
| 2 | Fast compiler rebuild | a change to the compiler reaches the binary in a time that does not slow the work |
| 3 | A kernel proved sound | there is a proof that the checker accepts nothing false, not only probes that reject falsehoods |
| 4 | No known typing holes | every known hole is written down and closed by a probe |
| 5 | Stable formats | the `FLANG_*` refusal codes and the proof record format do not change silently |
| 6 | Packages and modules | an outsider imports a module with one line, and the build is reproducible |
| 8 | The printed C does what is proved about the source | every function of a printed program is checked against the semantics of the language written in Lean |

Number 7, "Services in production", was withdrawn by the owner on 11 November
2026: how long a service has lived is a condition of the calendar, not a
property of the language. The other numbers stay as they were.

For each condition — what exists, what is missing and which command checks
it — see the document
["The road to 1.0: seven conditions"](https://github.com/digitable-lol/flang/blob/main/docs/road-to-1-0.md)
(in Russian).

## What has already shipped

- **Condition 4.** 0.7.34 closed 13 of the 14 known typing holes. Two remain
  open; both are named in the release notes.
- **Condition 6.** Since 0.7.34 a module is imported by a link in the import
  line: `использует «Логика» из "https://…/logic.flang"`. The first
  `flang check` downloads it and writes the fingerprint and the source into
  `flang.lock`; later builds need no network. There is no install command and
  no package registry — see [Modules and packages](packages.html).
- **The kernel proves the monad laws.** Since 0.7.34, all three, associativity
  included.
- **Prebuilt builds** for Linux and macOS ship with every release since
  0.7.29 — see [Installation](install.html).

## What we decided not to do

- **No closures.** Capturing the environment breaks the termination proof and
  the direct printing into C, Go and Rust. Function values exist, closures do
  not.
- **No two versions of one library in one program.**
- **No package registry and no install command.** A module is named by its
  address.
- **No storing code in a database instead of files.** Only content addressing
  is taken.
