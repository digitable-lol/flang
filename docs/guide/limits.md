[Back to README](../../README.md) · [Documentation index](../README.md)

# Known limits

What flang does not do and does not guarantee, and what to write instead. This
page is a reference: find your case by the headings.

## What flang does not guarantee

### The compiler is not proved as a whole

CompCert is a C compiler with a proof that every program it outputs behaves
like its source. flang has no such proof. The proofs of flang are about the
flang program, and the code generator can be wrong.

In exchange, each generated C program is checked. The command
`translation:validate` compares it with a reference, a description of the
meaning of the language in Lean, and gives a verdict for every function:

| Verdict | What it means |
| --- | --- |
| equal on every input | proved: by trying all argument values, or by comparing two decision trees |
| equal on samples | the answers agree on chosen inputs; nothing is known about the rest |
| outside the check | the function uses something the reference does not describe yet |

The reference does not describe machine words yet. Every function of the
example `docs/examples/reference/ru/machine-words.flang` gets the third verdict:

```text
$ flang run-script translation:validate -- --path docs/examples/reference/ru/machine-words.flang
СООТВЕТСТВИЕ ПРОВЕРЕНО для 47 функций, вне валидации 7
…
  причины вне валидации: вид типа u8 — 1; вид типа u32 — 6
…
расхождений 0
```

The first line: 47 functions are equal on every input, 7 are outside the check
(«вне валидации»). The 47 are the functions of eight service files that the
command always checks together with yours. The seven are all the functions of
the example. The line about reasons names the argument type: `u8` for one
function and `u32` for six. The last line: no differences between the C and the
reference were found.

The command runs from a clone of the repository and needs Lean installed. How
many functions of the examples it proves, and how it works, is in the
description of [translation validation for C](../translation-validation.md).
The other nine target languages have no such check.

### What is taken without proof

The verdict "equal on every input" is about the text of a C function. Below it
are parts that nobody proved:

| Part | What is in it |
| --- | --- |
| the C runtime | memory, strings, lists, the process scheduler |
| the C compiler | the `cc` of your system |
| libc and threads | `malloc`, `pthread_create`, `fopen` and others |
| the Lean reference | it is written by hand and can differ from the documentation |

### `total` does not mean "no errors"

The keyword `тотальная` (`total`) promises one thing: the computation ends. A
stop with a run-time error counts as ending too. File
`docs/examples/reference/en/word-division.flang`:

```flang insert docs/examples/reference/en/word-division.flang
module «Word division»

total function «Packets in the buffer»
  accepts buffer: u64, packet: u64
  returns u64
  example «two packets of 1500 fit in 4096 bytes»
    given buffer equals u64 4096
    given packet equals u64 1500
    expected u64 2
  buffer divided by packet

total function «Packets in the buffer or zero»
  accepts buffer: u64, packet: u64
  returns u64
  example «a packet of zero length gives zero packets»
    given buffer equals u64 4096
    given packet equals u64 0
    expected u64 0
  if packet equals 0
    then u64 0
    else buffer divided by packet
```

```text insert output: check docs/examples/reference/en/word-division.flang
$ flang check docs/examples/reference/en/word-division.flang
модуль «Word division»: функций 2, из них с доказанным завершением 2; типов 0
docs/examples/reference/en/word-division.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

The check passed with no warnings. A run of the first function with a divisor
of 0:

```text insert output: run docs/examples/reference/en/word-division.flang --function "Packets in the buffer" --args '{"buffer":4096,"packet":0}'
$ flang run docs/examples/reference/en/word-division.flang --function "Packets in the buffer" --args '{"buffer":4096,"packet":0}'
доказано: утверждений 0
FLANG_OVERFLOW: 4096 «div» 0: деление на ноль
$ echo $?
1
```

The line with `FLANG_OVERFLOW` is the division-by-zero error (`div` is the
internal name of `divided by`), exit code 1. An addition of machine words that
does not fit the type and a `substring` past the end of a string behave the
same way. Close such places with an `if` branch, as the second function does,
or with a `requires` precondition.

### `flang check` does not tell whether postconditions are proved

`flang check` checks syntax, types, termination and examples. It does not
complain about a postcondition (`обеспечивает`, `ensures`) that is not proved,
and it returns exit code 0. `flang check --proof` tells: it writes the proof
report and returns exit code 3 if at least one postcondition is not proved.
`flang run` does not start such a program unless you pass `--trust`.

### A whole operating system cannot be written in flang

| The language has no | What follows |
| --- | --- |
| pointers and addresses | you cannot touch a device register or a page table |
| interrupts and waiting | the handler behind a vector and the waiting loop are written in C |
| inline assembly | the context switch is written in C or assembly |
| writes in place | a buffer cannot be changed, only a new one built |

The deciding part can be written in flang: parsing headers, permission checks,
scheduling policy, a driver's state machine. These are pure functions, and
their postconditions are proved. How such a function is joined with C code:
[The boundary between flang and the host](../site/host-boundary.md).

### The generated C needs libc and threads

A C program generated from a module with no effects at all refers to 62
external symbols: `malloc`, `pthread_create`, `fopen`, `fork` and others. The
number was measured on the example `machine-words.flang`: `flang emit --target c
--no-cli`, then `cc -O2 -c` (gcc 15) and `nm -u`. Such code does not link into
firmware without an operating system today. A version without libc is in
progress.

## How to read the proof report

`flang check --proof` gives every postcondition one of three results. They show
in the last line of the report:

```text
$ flang check docs/examples/reference/en/machine-words.flang --proof
…
docs/examples/reference/en/machine-words.flang: НЕ ДОКАЗАНО — ОПОРА НЕ СУДИЛАСЬ — утверждений 2: доказано 1, условно 0, сетка 1, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 3
```

| The report says | What it means |
| --- | --- |
| `доказано` (proved) | true for all inputs; a separate program, `checker`, can re-check the proof |
| `сетка N` (grid of N) | tested only on N examples, like unit tests; nothing is known about other inputs |
| `объявлено, не доказано` (declared, not proved) | written down, but there is neither a proof nor an example |

The example has two postconditions: one is proved, one is tested on one
example. So the line begins with «НЕ ДОКАЗАНО» (not proved), and the exit code
is 3.

Termination of functions with the keyword `тотальная`, types and exhaustive
`разбор` (pattern matching, `match`) are always proved.

The program `checker` does not re-check every proof. The report says in a
separate line how many proofs it repeated and how many are accepted without a
re-check.

## What you cannot prove

| Does not work | What to do instead |
| --- | --- |
| "there exists x such that …" when the value of x is not written in the postcondition itself | name the value: `есть такой м, а именно н, что …`; a wrong value gives the error `FLANG_PROOF_STEP` |
| a postcondition about the result of a mask, a shift or an addition of machine words | test it with examples; about a word only the range of its type is known |
| an order from the `иначе` (else) branch over `число`: `не (х меньше 0)` does not give `х не меньше 0`, because for NaN both comparisons are false | declare the argument `целое` if it is whole; for `число` write a `теорема` with steps |
| a property of state over time, of effects or of concurrency | test it: `пример` for functions, `прогон` scenarios for processes |
| a property of the generated code in Go, Rust and the other targets except C | test the generated program on its own |
| a postcondition the compiler did not prove by itself | write a `теорема` or rephrase it: [What is proved automatically](../site/what-the-kernel-accepts.md) |

No external SMT solver is connected. flang is not fit for medicine, aviation or
space: certification is a process, and the language does not have one.

## The language

**There is no writing into a list by index.** You can read an element:
`элемент N в список`. Values are immutable, so a list with one element replaced
is a new list. Algorithms built on an updatable table do not carry over
directly. For a dictionary use a library one: `flang/stdlib/dictionary.flang`
(a list of pairs), `flang/stdlib/tree.flang` (a search tree) or
`flang/stdlib/hashmap.flang`.

**Only machine words have bitwise operations.** `число` has none. Declare the
value as `u8` … `u64` and write `побитовое и`, `сдвиг вправо на`:
[Machine words](../site/language.md#machine-words-u8-u64-i8-i64).

**There are no hexadecimal literals.** `0xFF` gives the error `FLANG_PARSE`.
Write a decimal number: 255.

**There is no byte array type and no fixed-size array.** Use `список u8`
(`list u8`) and a postcondition about the length.

**There is no division on `точное целое` (exact integer).** It has `плюс`,
`минус`, `умножить на` and `остаток от`. For fields up to 64 bits use `u64`.

**Counting up does not pass the termination check.** A recursive call on
`н плюс 1` gives the error `FLANG_NOT_TOTAL`: "the recursive call does not
decrease". Count down over a parameter of type `неотрицательное`
(`docs/examples/measure/natural.flang`).

**The compiler does not find a measure with a changing step.** It finds
recursion on a part of a value (the tail of a list, a subtree) and a decrease
by a constant step. For the rest write a line `убывает <expression>`: binary
search uses `убывает верх минус низ плюс 1` (`docs/examples/measure/`). The
generated code then checks the measure at run time and stops with
`FLANG_MEASURE`.

**A variant named like a keyword is not matched.** `случай Да` is read as the
literal `да`, and the error `FLANG_TYPE` points at the pattern. Write
`случай вариант «Да»`, or rename the variant.

**There is no I/O monad.** A function returns an effect and the next step as an
ordinary value.

**`flang emit` does not run the examples.** `flang check` and `flang test` run
them. Run `flang test <file>` before generating code.

**Not every compiler message is translated into English.** With `language = en`
in `.flangrc` the summary of `flang check` is in English, and some errors stay
Russian. The `FLANG_*` code is the same in every language.

## Effects

**Effects are available through `план` only.** A function does not read a
file. It returns a description of the action, `flang io` performs it and calls
the function again with the reply. The list of effects is closed: files,
directories, network, processes, screen, time, random numbers, environment
variables, command-line arguments. The full table:
[The boundary between flang and the host](../site/host-boundary.md).

**Text is read as UTF-8 only.** Invalid UTF-8 gives the error
`FLANG_IO_NOT_TEXT`. Read binary files as bytes.

**`https` is TLS 1.3 with one cipher suite.** The client is built into `flang`;
`curl` is not needed. It knows `TLS_AES_128_GCM_SHA256`, x25519,
`rsa_pss_rsae_sha256` and an `sha256WithRSAEncryption` chain. A server without
them gives the error `FLANG_IO_TLS`. Certificate revocation is not checked. A
response is limited to 1,048,576 bytes. Datagrams are IPv4 only.

**A program with `план` is not generated into every language.** `c`, `go`,
`js`, `python`, `rust` and `ts` work. The targets `cpp`, `csharp`, `elixir` and
`java` give the error `FLANG_PLAN_UNSUPPORTED` and write no files.

**A generated program does not perform every effect.** In `c`, `go`, `python`
and `rust` a plan is started with `flang_cli --plan <name>`. It performs the
effects for files, directories, environment variables and arguments. For
network, processes, time, random numbers and the screen it answers with the
error `FLANG_IO_NOT_WIRED` or `FLANG_IO_NO_SCREEN`. Run such a plan with
`flang io`.

## Category declarations

The compiler tests the laws of `категория` and `изоморфизм` on values from the
examples and does not prove them. The laws of a `моноид` over `число` and
`строка` are only tested too, and `flang check --proof` returns exit code 3.
The laws of a `монада` and the laws of `отобразить` over a list are proved.
Details: [Categories and functors](../site/categories.md).

## Processes

| Does not work | What to do instead |
| --- | --- |
| processes in `cpp`, `csharp`, `go`, `java`, `python`, `rust`: `flang emit` returns exit code 1 | generate into `c`, `elixir`, `js` or `ts` |
| `породить` (spawn) in Elixir and JavaScript | use the `c` target |
| a bounded mailbox in Elixir | use `c`, `js`, `ts`, or an unbounded mailbox |
| sending to a spawned process by a name computed at run time | give it its work in the first message, and reply to a process with a declared name |
| running on several machines | run on one node |
| proving freedom from deadlock: `прогон` scenarios try a finite number of message orders | design the protocol so that no process waits on another in a cycle |

The scheduler in the generated C has two modes. A single thread orders messages
by the number `seed`: the same `seed` gives the same delivery log. A pool of
worker threads (the field `workers`) is faster only on a program with parallel
work.
