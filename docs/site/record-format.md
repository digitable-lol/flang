# The proof record and the independent check

You do not have to take the compiler's word «доказано» (proved) on trust. The
compiler writes the proof to a file, the record, and a separate C program that
shares no code with the compiler reads the source and the record and re-checks
the steps.

## Getting a record

The program is from
[How a proof works](how-proofs-work.html#обеспечивает-the-postcondition-and-the-three-answers):
three postconditions, one of them proved.

```
$ flang check tri.flang --proof --record tri.proof
```

A record is text you can read:

```
запись доказательства 1
исходник tri.flang
строк 28
знаков 729
отпечаток 50696052 542895809
ядро 2
утверждений 3
отпечаток256 338dc9b3cf90abc44b5e3dbfa2ef7614066bf6843cedb816c45e0924a444034c
тотальностей 3
утверждение «в минус не уходим» функции «Цена со скидкой» строка 7
  вид postcondition
  вердикт доказано
  теоремы нет
  правило «неотрицательность по построению»
  по объявлению да
  обязательство вход «скидка» ⟨скидка не больше 9007199254740991⟩ строка 4 на зовущем
    вывод цель ⟨результат не меньше 0⟩
    вывод 1 Н3 ⟨скидка не меньше 0⟩ строка 4
    вывод 2 Пред1 ⟨скидка помещается⟩ строка 4
    вывод 3 П3 ⟨скидка не больше 9007199254740991⟩ из 2
    вывод 4 Н12 ⟨( цена минус скидка ) не меньше 0⟩ из 1 3
    вывод 5 Разв2 ⟨результат не меньше 0⟩ из 4 строка 12
    вывод конец
конец утверждения

утверждение «результат чётный» функции «Удвоить» строка 17
  вид postcondition
  вердикт нет вердикта
  теоремы нет
конец утверждения
…
конец записи
```

The header ties the record to the source with fingerprints (`отпечаток`). Then
comes one block per statement: the verdict (`вердикт`), the rule (`правило`)
and the derivation step by step (`вывод`); an unproved one has `нет вердикта`
(no verdict). After them come the termination blocks of the functions and the
line `конец записи` (end of record). What stands on every line is described in
[the record format](https://github.com/digitable-lol/flang/blob/dev/docs/flang/proof/record-format.md).

## Checking a record

The checking program is one C file, `flang/proof/checker/checker.c`. It is
built by a C compiler, without flang:

```
$ make -C flang/proof/checker
$ flang/proof/checker/сверщик tri.flang tri.proof; echo "exit $?"
ПРОВЕРЕНО — запись сошлась с исходником, и всё доказанное проиграно заново:
утверждений 3, … сведений проиграно заново 3 … Числятся доказанными 1. НА СЛОВО
ЯДРА: посылок и утверждений 0, шагов 0. … Привязка к программе: SHA-256 сошёлся. …
exit 0
```

`ПРОВЕРЕНО` is "checked: the record matches the source, and everything proved
was replayed". «НА СЛОВО ЯДРА: … 0» means no step was accepted on the kernel's
word.

Change one step in the record, `⟨скидка не меньше 0⟩` to
`⟨скидка не меньше 5⟩`:

```
$ flang/proof/checker/сверщик tri.flang forged.proof; echo "exit $?"
НЕ СОШЛОСЬ: утверждение «в минус не уходим», вывод: шаг 1: Н3 заключает
неотрицательность, а вида «Т не меньше 0» у «скидка не меньше 5» нет
exit 1
```

Change the source and keep the old record:

```
НЕ СОШЛОСЬ: первый отпечаток не сошёлся — запись не от этой программы; …
```

| Exit | Answer | What it means |
| --- | --- | --- |
| 0 | `ПРОВЕРЕНО` | the record belongs to this program, everything proved was re-checked |
| 1 | `НЕ СОШЛОСЬ` (mismatch) | the record is not from this program, or a step is wrong |
| 3 | `НЕ ПРОВЕРЕНО` (not checked) | not everything was re-checked: part of what is proved stands on the kernel's word, or the record proves nothing |

Once the program is built, `flang check --proof` calls it by itself and adds a
line to the report:

```
tri.flang: независимо, сверщиком, проиграно 1 из 1 доказанных; на слове ядра 0
— код сверщика 0
```

("independently, by the checker, replayed 1 of 1 proved; on the kernel's word
0"). When it is not built, the line is `НЕЗАВИСИМО НЕ ПРОВЕРЕНО — сверщика нет`.
The environment variable `FLANG_CHECKER` points to the program elsewhere.

A second program, written separately in Lean 4
(`flang/proof/checker/second/`), reads the record too.
`bootstrap/flang run-script checker:second` runs both over the same records
and prints every disagreement in exit codes. How many of the compiler's own
proofs are re-checked this way:
[What is proved and what is not](what-is-proved.html).

## The version number and what it promises

The first line of a record names the format version:
`запись доказательства 1`. The checking program refuses a record with any other
number. The kernel number (`ядро 2` in the header) is a different thing: it
speaks of the inference rules, not of the shape of the text, and is not
promised here.

Until the version number changes:

- The header lines stand in the same order and start with the same words:
  `исходник`, `строк`, `знаков`, `отпечаток`, `ядро`, `утверждений`,
  `отпечаток256`, `отпечаток раскрытия` (in a file with sugar), `тотальностей`, `законов`.
- Every kind of line and every block reads the way it read. A line is not
  renamed, removed or given another meaning.
- A version 1 record issued earlier is read by a program built later.

The number changes on a removed or renamed line, a different order of header
lines, a different meaning of a value, or a different way to compute the
fingerprints. A new kind of line or block does not change the number but changes
the fingerprints written below.

The promise is checked: `bootstrap/flang run-script record-format:check` takes
two fingerprints of the format and compares them with the ones written below.

- **The printer fingerprint** is the SHA-256 of the set of line kinds in fresh
  records of five reference programs of the tree. A new kind of line or block
  moves it; a different source does not.
- **The reader fingerprint** is the SHA-256 of the closed list of line
  templates by which the C program refuses an unknown line.

If a fingerprint disagrees with the written one, the check fails with the words
«смена формата записи без записи в журнал» (the record format changed without
a journal entry).

## Version 2

Since 0.9.0 `flang check --proof --record file --record-version 2` writes the same
record as version 2 (ADR-0255). The content is the same; the words change:

- the first line is `proof record 2`;
- the frame words («утверждение», «вердикт», «строка», «доказано» …), the names
  of kernel rules, the short names of rules (`Разв2` → `Unfold2`) and the names of
  primitives are written as keys that belong to no natural language; the table of
  keys is `flang/proof/tables/record-v2-words.tsv`;
- a formula in angle brackets `⟨…⟩` is written in signs (`=` `≠` `<` `≤` `>` `≥`
  `+` `−` `·` `/` `∧` `∨` `¬` `⊤` `⊥` `∀` `∃` `ℕ`) and concept keys (`result`,
  `if`, `length` …) — the same for a Russian, an English and a Chinese program.
  The author's names stay as written; a name that would look like a key is put in
  guillemets.

The `checker` program reads both versions: it translates version 2 back into
version 1 and checks it as usual. Russian forms are chosen by position (`равно`
after `дано`, `равным` when a record is built, the genitive of a type after
`список` and `от`); where the author wrote another
form of the same word, the version 2 record does not match the source while
version 1 does: of the 250 checker probe programs that print a record, two (the
author wrote `равно` where `равен` is expected); the other 248 get the same
verdict for both versions. The record is bound to
the program the same way as version 1: line and character counts and
fingerprints of the source text.

## Fingerprints of version 1

Format version 1 is recognised today by two fingerprints:

```
запись доказательства 1
printer fingerprint 50f33cdf7bb8346ed2a78955a88b346f1277f36ca53c9c8ae982638beacfc3ab
reader fingerprint 54a82e1f14c1be38c78cc2339089c61513001ce426060617e30f8e41a6cd7f38
```

A new kind of line or block changes the fingerprints, not the version number.

Next: [Diagnostics reference](diagnostics.html) — the second promise outward: the
`FLANG_*` codes do not appear or vanish silently.
