# What is proved in flang itself

This page answers the question: how many functions and postconditions are
proved in the code of the language itself. The compiler, the standard library
and the examples are written in flang and checked by the same kernel as your
programs.

The repository has {{корпус.файлов}} flang files with {{корпус.функций}}
functions. The numbers on this page are substituted when the site is built,
from a full check of the repository. It takes several hours, so the numbers may
lag behind the code by a few days.

## Termination: {{корпус.тотальных}} functions of {{корпус.функций}}

| What proves termination | Functions | Run-time check |
| --- | ---: | --- |
| No recursion | {{носители.композиция}} | no |
| Recursion on a part of the argument: a list tail, a field | {{носители.структура}} | no |
| `неотрицательное` goes down by 1 | {{носители.точныйШаг}} | no |
| `число` goes down by a constant | {{носители.постоянныйШаг}} | yes |
| A declared measure (`убывает`) | {{носители.мера}} | yes |

In the last two rows a `число` goes down, that is, binary64: for a large `х`
the expression `х минус 1` equals `х`. So the compiler leaves a check in the
code.

The remaining {{корпус.обычных}} functions are declared without the word
`тотальная`. Three of them are not supposed to terminate: they are the main
loop of the interpreter, which runs someone else's program.

The row about the declared measure is related to a known error of the check.
About it: [What you are trusting](trust.html#a-known-error-a-function-with-убывает).

## Postconditions: {{утверждения.доказано}} of {{утверждения.высказано}}

{{утверждения.доказано}} postconditions of {{утверждения.высказано}} are proved
for all inputs. {{утверждения.отвергнуто}} are refuted. The rest passed on tests
only or have neither a proof nor tests. They are checked at run time.

What each answer means:
[How to read the report](how-proofs-work.html#обеспечивает-the-postcondition-and-the-three-answers).

## What is checked about the check itself

| What | How many |
| --- | --- |
| Kernel rules that have a lemma in Lean 4 | 93 of 93 |
| Paths by which the second checking program accepts a record, with a theorem | 45 of 52 |
| Corrupted proof records accepted by the `checker` program | 0 of 833 |

What stands behind each row and what these numbers do not cover:
[What you are trusting](trust.html). The commands that produce the numbers are
there too.

## The compiler's own code is not checked in full

`flang check` stops a check that went over the step limit, with the code
`FLANG_RECURSION_LIMIT`. On the largest files of the compiler this happens
before all tests and proofs are checked. The key `--step-limit N` raises the
limit.

Files with declared categories and processes are checked in part. The compiler
says so in its output and exits with code 2.

## How to check it yourself

| What | Command |
| --- | --- |
| The proof report of one file | `flang check <file> --proof` |
| The same as JSON | `flang check <file> --proof --json` |
| Code 0 only if everything is proved | `flang check <file> --proof --strict` |

## Next

- [What you are trusting](trust.html) — what stands behind the word «доказано».
- [Known limitations](limits.html) — what the language cannot do.
- [Comparison on classic lemmas](mathematics.html) — what the kernel takes from
  75 lemmas of Coq and Lean textbooks.
