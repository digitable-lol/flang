# Typing holes search

`scripts/fuzz/generator.flang` prints, from a seed, a flang program at the edges of its types —
refined numbers, narrowing by a condition, `требует`, folds, records, variants, parametric
types, functions as values, fixed-width words, exact integers, lists of records, strings —
together with a list of calls: arguments inside the declared types and, for every function, one
argument outside. Two of three numeric expressions are built for the declared kind (a literal
or a name of that kind, a choice between two such, «Удвоить», a length), so programs reach the
oracles more often; the third is built without regard to the kind and probes the edges.
Since 10 November 2026 it also writes the forms listed under «Forms» below.
`scripts/fuzz/search.fscript` runs every program through the oracles below.
`scripts/fuzz/values.fscript`, over the small reader `scripts/fuzz/json-reader.fscript` that
keeps number literals as written, reads the JSON the evaluator and the printed programs answer
with, checks a value against a declared type, builds the requests to the printed programs and
compares their answers with the evaluator's.

## Oracles

| oracle | finding |
|---|---|
| `a-value` | the check said «замечаний нет», and a run returned a value outside the declared type |
| `a-runtime` | a run with arguments inside the types failed with `FLANG_TYPE` |
| `a-boundary` | a call outside `требует` (its twin «Фk вход» decides it) answered with a value |
| `a-entry` | an argument outside the declared type was answered with a value, not refused |
| `a-argument` | arguments inside the declared types were refused at entry with `FLANG_TYPE` |
| `b-<target>` | the printed program on C, Go, Java or Rust answers differently from the evaluator |
| `b-build` | the printed program does not build |
| `c-property` | the kernel said «доказано», and a run broke the postcondition |
| `d-record` | the C checker accepted a proof record where one fact is stronger than the kernel wrote |

A call outside `требует` (ledger row 15), a run the evaluator refused as unproven, a
fixed-width word the evaluator prints as `null` (row 13) and a call inside the types that the
evaluator refused at entry (it is a finding of `a-argument` already) are not compared by
`b-<target>`. A word inside a record or a list is compared as the number both sides write.

## Forms

| form | what the generator writes |
|---|---|
| words in records and lists | a record `«Кадр»` with fields `u8`, `i8`, `u64`, a `список u8`, words as parameters, a field or an element read back as a word, a field given a word of another width |
| nested variants | `«Дерево»`: a leaf with a natural, a node with a `«Возможно» от целое` and a record, a bush with a list of naturals; built, taken as a parameter and matched with three cases |
| records with refined fields | `«Груз»`: a weight, hundredths, a `«Возможно» от целое`, a list of naturals and a record; every field is read back |
| lists of parametric variants | `список «Возможно» от целое` as a literal, by `добавить`, by a map with a generic call or a constructor, by a choice |
| exact fractions | `точное дробное` literals in and off canon, sum, difference, product, quotient, a choice |
| generic calls in branches | the generic identity `«Тоже»` around a number, a match branch and a `пусть` value; `«Обернуть»` and `«Первое из»` as before |
| higher-order functions | four appliers with different refined signatures, one generic in both types; the function picked by a condition or passed through the generic identity; a list mapped by a function value |
| `требует` on a function value | `«Больше пяти»`, whose result is a natural only under its requirement, is among the functions passed by value |
| one-line header | every third function has `принимает` and `возвращает` on the line of its name |
| `цикл` with `храним` | a loop over a list with one kept value of the result type, with and without an early exit; the loop body sees the parameters and the kept names |
| `пока` with `убывает` | a while loop over a kept counter, bounded by a measure or by `шагов не больше` |
| classes | `класс «Счёт»` with two refined fields, a method that changes a field and a method that returns a natural; the bodies come from the seed |
| interfaces | `интерфейс «Фигура»` with a required and a default method over two classes; the variant is built, passed and asked through `«Фигура: Размер»` |

## Schedule

`.github/workflows/typing-holes-fuzz.yml` runs once a day: the self test, the fixed seeds
1..600 and 600 seeds from the clock; on Sundays and by hand also the proof records of the tree.
A finding is repeated by the same command with its seed and the count 1.

## Known findings

`scripts/fuzz/known.tsv` names, for a ledger row of `flang/proof/tables/typing-holes.tsv`, the
oracle and a substring of the finding. A finding that matches is known and does not make the
campaign red. When the ledger calls the row `закрыта`, the same finding is new again, so a
closed hole cannot come back silently. A call to a function whose body passes one of the program's
functions to «Применить» carries the mark `~fv` after its type; the known line of row 16 names
that mark, so a negative value from any other source stays a finding.

## Plans

```
bootstrap/flang run-script typing-holes:campaign -- <directory> <first seed> <count> <threads> \
  [<targets> <targets every N-th> <records every M-th>]
```

prints the generator in C, builds it, cuts the seeds into batches of 25 and runs the batches
in parallel with the plan `Batch`. The result is `<directory>/summary.txt`; the exit code is 1
when there is a new finding. `corpus` in place of the first seed runs oracle `d` over the
tree: every program with `обеспечивает`, outside the compiler and the seed, writes its proof
record and the checker gets its mutants. The directory is absolute: the host starts processes
from the plan's directory.

`--plan Batch` runs one batch and writes a line per program to `<directory>/batch-<first>.tsv`.
`bootstrap/flang run-script typing-holes:selftest -- <directory>` plants for every oracle what
it must catch; the exit code is 1 when one of them stays silent or the finding comes from another
oracle. The planted faults do not depend on holes the compiler still has: an honest program is run
by a forged evaluator, `sh -c "echo -7"`, which answers -7 to every call (outside the declared
type, past a false requirement, unlike the printed C program), and the known list and the ledger
are the case's own files with one planted hole, open or closed. The case `forms-forged` plants a
function of every form above for the forged evaluator and expects a finding per call; `forms-agree`
runs the same functions honestly against the printed C program and expects silence; `a-argument`
forges a refusal of an argument inside its type. The plan `Batch` takes the forged
evaluator as its tenth argument, a shell command; without it calls go to `bootstrap/flang run`.

Processes run under a limit of 4 GiB, each with its own time limit; a process cut by its time
answers `timeout`. Printed programs build and answer without a memory limit: the JVM and Go
reserve more than 4 GiB of address space at start.
