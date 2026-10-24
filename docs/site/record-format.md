# The proof record format: number and promise

A proof record is the text that `flang check <file> --proof --record <record>`
puts next to a program: a header with fingerprints of the source, one block per
statement with its verdict and derivation, blocks for discharged preconditions
and for totality, and the line `конец записи`. An independent program in C that
knows nothing of the compiler reads it back, and so does a second one in Lean.
Since the record is read from outside, its format is a promise, and this page says
which one.

What stands on every line of a record is described by a separate document written
from the printer's source —
[the record format](https://github.com/digitable-lol/flang/blob/dev/docs/flang/proof/record-format.md).
Here: only the version number, what it promises and how it changed.

## The version number

The first line of every record names the format version:

```
запись доказательства 1
```

Today this is **version 1**. The number is printed by the function «Версия записи»
in `flang/self/proof-record.flang`; the C checker refuses a record with any other
number at the first line of the header. The kernel number (`ядро 2`, the sixth
header line) is a different thing: it speaks of the inference rules, not of the
shape of the text, and is not promised here.

## What is promised

While the version number stays the same:

- The header lines keep their order and their leading words: `исходник`, `строк`,
  `знаков`, `отпечаток`, `ядро`, `утверждений`, `отпечаток256`, `тотальностей`,
  `законов`.
- Every kind of line and every block that is already in the record reads as it did:
  the leading word, the indentation, the meaning of the values after it. A line is
  not renamed, not removed and does not change its meaning.
- A version 1 record issued earlier is read by a checker built later.

The number must change for: a removed or renamed header line or block, another
order of the header lines, another meaning of an existing value, another way to
compute the source fingerprints.

The number does **not** change, but the journal below gets a row, for: a new kind
of line or a new block that a checker of the previous version could skip without
harm to what it already reads. This is how the format grew all the time it carried
number 1, and the journal shows it honestly.

## What holds it

A number alone holds nothing: from August to October 2026 the format grew by four
blocks and no addition touched the number. So next to the number the guard
`bootstrap/flang run-script record-format:check` keeps two fingerprints of the
format and compares them on every run:

- **The printer fingerprint** — SHA-256 of the set of *line keys* of fresh records
  of five reference programs of the tree (`flang/proof/examples/corpus-natural.flang`,
  `subtraction-under-precondition.flang`, `traffic-light.flang`,
  `precondition-discharge-reads-proved-facts.flang`,
  `docs/examples/guide/statement.flang`). A line key is its indentation and the
  words before the first number, quoted name or term: `вид postcondition`,
  `вывод цель`, `конец утверждения`. Line numbers, names and terms are not part of
  the key, so the fingerprint moves with a new kind of line or block, not with
  another source. Together the five programs give the header, statements with a
  derivation and with a theorem, discharges, totality and free statements.
- **The reader fingerprint** — SHA-256 of the closed list of line templates kept by
  the C checker (`flang/proof/checker/checker.c`, the array `ОБРАЗЦЫ`): by it the
  checker refuses an unknown line aloud instead of skipping it. This list also
  knows lines the five reference programs do not print: category theorems,
  structural and step totality.

The number and both fingerprints are written in
`flang/proof/tables/record-format-version.tsv` and in the journal below. When they
diverge, the guard goes red with the words «смена формата записи без записи в
журнал» (a format change without a journal row), and the only way to clear it is a
journal row: with a new number if the change breaks reading, or with a new
fingerprint if a kind of line was added. That the guard itself can go red is shown
by `record-format:forgery`: a corrupted number, each of the fingerprints, a page
without the fingerprint and a record with a new kind of line — five forgeries, each
red.

## Version journal

| date | version | what changed |
| --- | --- | --- |
| 2026-08-22 | 1 | the record appears: a header of seven lines (`запись доказательства 1`, `исходник`, `строк`, `знаков`, `отпечаток`, `ядро`, `утверждений`), statement blocks with theorems and steps, `конец записи` |
| 2026-09-01 | 1 | the header line `отпечаток256` — SHA-256 of the source; the term next to a step's line number; the table of contents of list literals |
| 2026-09-07 | 1 | the header line `тотальностей N`; totality blocks |
| 2026-09-14 | 1 | blocks for a precondition discharged at a call (`снятие … конец снятия`) |
| 2026-10-15 | 1 | the line `законов N` and the unfolding of laws past the end of the file; proved statements carry moves read off the body (`ход цель … ход конец`) |
| 2026-10-17 | 1 | category theorem blocks (`категорная теорема … конец категорной теоремы`) |
| 2026-10-24 | 1 | the promise and the guard `record-format:check`; fingerprints taken on the 0.7.30 binary: printer `50f33cdf7bb8…`, reader `971a7a854e1c…` |

Dates follow the commits that changed the record printer
(`flang/self/proof-record.flang`, before 2 October 2026 `zapis.flang`); none of
them touched the version number.

## How to change the format

1. Change the printer (`flang/self/proof-record.flang`) and the readers
   (`checker.c`, `flang/proof/lean/RecordReader.lean`) in one go: one side writes
   the record, two read it.
2. If the change breaks reading of earlier records, raise «Версия записи» and the
   first line of the template list in `checker.c`.
3. Recompute the fingerprints: run `record-format:check`, take the new values from
   its output, write them into `record-format-version.tsv` and into a row of the
   journal above with the date and what changed. The journal row is part of the
   change, not separate work later.

Next: [Diagnostics reference](diagnostics.html) — the second promise outward: the
`FLANG_*` codes do not appear or vanish silently.
