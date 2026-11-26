# Compatibility: what will not change after 1.0

What in flang stays the same from release to release, and what may change?
This page answers point by point and describes how deprecation is announced.

**Draft.** The promise takes effect with release 1.0.0. Until then the section
[Before 1.0](#before-10) applies.

## What is frozen in 1.0

A program written for 1.0 works with every 1.x release unchanged. The promise
covers four things.

| What | What is promised |
| --- | --- |
| Syntax | A file that passes `flang check` in 1.0 passes it in every 1.x. Keywords keep their meaning. New constructs do not change how old programs are read. The promise is given to a file written in one complete writing language (Russian; English once it has every word of the table); Esperanto and Chinese are experimental. |
| `FLANG_*` error codes | A code does not disappear and does not change its meaning. New codes are added. |
| Proof record format | A record made by `flang check --proof` in 1.0 is accepted by the `checker` program of every 1.x. |
| Command line | Commands, flags and exit codes stay. In `--json` output fields do not disappear and do not change type; new fields are added. |

Only release 2.0 may break any of these four.

## What may change

| What | How it changes |
| --- | --- |
| Message texts | The wording of errors and warnings is edited in any release. Scripts should look at the `FLANG_*` code, not at the text. |
| Strength of the proof kernel | It only grows. A postcondition proved in 1.0 is proved in every 1.x. |
| Speed and memory | They change both ways. Noticeable changes are named in the release note. |
| Generated code | The text printed by `flang emit` changes. The behaviour of the program stays the same. |
| Experimental parts | Commands and modules marked experimental in the help are not covered by the promise. |

The growth of the kernel is checked on every release. An automatic check
compares the list of proved postconditions with the list of the previous
release. If the list got shorter, the release does not go out.

This growth has one consequence. A stronger kernel may find a counterexample
to a wrong postcondition that used to be checked only by tests. Such a program
stops passing `flang check`. That is a bug found in the program; it does not
break the compatibility promise.

## How deprecation is announced

A feature does not disappear without a warning. The order is always the same.

1. In a minor release the feature starts to warn. `flang check` prints a
   warning with a code and names the replacement. The exit code does not change.
2. In the next minor release the same place becomes an error.

The time between the steps is at least one minor release. Both steps are named
in the release notes.

After 1.0 the second step for the four frozen things waits until 2.0: in 1.x
they only warn. For everything else the order stays as above. Examples are
the functions of the standard library and the keys of the `.flangrc` file.

## What the version number means

The number is written `x.y.z`.

| Part | Before 1.0 (`0.y.z`) | After 1.0 |
| --- | --- | --- |
| `x` | always 0 | changes when a frozen thing breaks |
| `y` | a release may break compatibility, after a warning | new features; old programs work |
| `z` | fixes and new features | fixes only |

The suffix `-rc.N` marks a release candidate: `1.0.0-rc.1` comes before `1.0.0`.

## Before 1.0

Today the `FLANG_*` codes and the shapes of `--json` output are treated as
compatible. The syntax still changes; every change is named in the release note.

Four steps remain before 1.0.

| Release | What happens in it |
| --- | --- |
| 0.8.0 | The deprecation order starts to apply. Everything that will be gone by 1.0 starts to warn. |
| 0.9.0 | The warnings of 0.8 become errors. Syntax, codes, the record format and the command line take the form they will have in 1.0. |
| 1.0.0-rc.N | Candidates. Only fixes go into them. |
| 1.0.0 | The promise of this page takes effect. |

## Next

- [Releases](releases.html) — what changed in each release.
- [Error codes](diagnostics.html) — every `FLANG_*` code.
- [The proof record](record-format.html) — the record format.
