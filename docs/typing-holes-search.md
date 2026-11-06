# Typing holes search

`scripts/fuzz/generator.flang` prints, from a seed, a flang program at the edges of its types —
refined numbers, narrowing by a condition, `требует`, folds, records, variants, parametric
types, functions as values, fixed-width words, exact integers — together with a list of calls:
arguments inside the declared types and, for every function, one argument outside.
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
| `b-<target>` | the printed program on C, Go, Java or Rust answers differently from the evaluator |
| `b-build` | the printed program does not build |
| `c-property` | the kernel said «доказано», and a run broke the postcondition |
| `d-record` | the C checker accepted a proof record where one fact is stronger than the kernel wrote |

A call outside `требует` (ledger row 15), a run the evaluator refused as unproven and a
fixed-width word the evaluator prints as `null` (row 13) are not compared by `b-<target>`.

## Known findings

`scripts/fuzz/known.tsv` names, for a ledger row of `flang/proof/tables/typing-holes.tsv`, the
oracle and a substring of the finding. A finding that matches is known and does not make the
campaign red. When the ledger calls the row `закрыта`, the same finding is new again, so a
closed hole cannot come back silently.

## Plans

```
bootstrap/flang io scripts/fuzz/search.fscript --plan Campaign --max-orders 100000000 \
  --max-steps 4000000000 --timeout 3600000 -- <directory> <first seed> <count> <threads> \
  [<targets> <targets every N-th> <records every M-th>]
```

prints the generator in C, builds it, cuts the seeds into batches of 25 and runs the batches
in parallel with the plan `Batch`. The result is `<directory>/summary.txt`; the exit code is 1
when there is a new finding. `corpus` in place of the first seed runs oracle `d` over the
tree: every program with `обеспечивает`, outside the compiler and the seed, writes its proof
record and the checker gets its mutants. The directory is absolute: the host starts processes
from the plan's directory.

`--plan Batch` runs one batch and writes a line per program to `<directory>/batch-<first>.tsv`.
`--plan Selftest -- <directory>` plants for every oracle what it must catch; the exit code is 1
when one of them stays silent.

Processes run under a limit of 4 GiB, each with its own time limit; a process cut by its time
answers `timeout`. Printed programs build and answer without a memory limit: the JVM and Go
reserve more than 4 GiB of address space at start.
