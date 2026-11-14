[Back to README](../../README.md) · [Documentation index](../README.md)

# Known limits

What does not work in flang 0.7.34, and what to do instead.

## How to read the proof report

`flang check --proof` gives every postcondition (`обеспечивает`) one of three
results. They are not the same thing:

| The report says | What it means |
| --- | --- |
| `доказано` (proved) | true for **all** inputs. The prover proved it, and a separate checker program can re-check the proof step by step |
| `сетка N` (grid of N) | checked only on N values you wrote, like unit tests. Nothing is known about other inputs. **This is not a proof** |
| `объявлено, не доказано` (declared, not proved) | written down, but there is neither a proof nor an example |

Termination of `тотальная` functions, types and exhaustive pattern matching
(`разбор`) are always proved, not tested.

Plain `flang check` exits with code 0 even when a postcondition is only computed on a grid or
is declared without a proof. The verdict is shown by `flang check --proof` (exit code 3) and by
`flang run` (refusal, exit code 3).

The independent checker does not re-check every place of a proof: the rest it names in its
report as taken on the kernel's word.

## What you cannot prove

| Does not work | What to do instead |
| --- | --- |
| "there exists x such that …" without naming x: the prover does not search for a value | name the value: `есть такой м, а именно н, что …` |
| an order from the `иначе` branch over `число`: `не (х меньше 0)` does not give `х не меньше 0`, because on not-a-number both sides of a comparison are false | declare the argument `целое` if it is whole; for `число`, a theorem with steps or the run-time check |
| a property of state over time, of side effects or of concurrency: there is no way to write it in the language | test it with `пример` and, for processes, with `прогон` scenarios |
| a property of the generated C, Go, Rust and other code: the proof covers the flang program, the code generator is not proved | test the generated program on its own; for the `c` target, check each printing run with the `--protocol` file and `flang/translation/matcher.c`, which replays the nodes, the measure guard included, and names what it did not replay |
| a postcondition the prover does not accept | see [What the prover accepts](../site/what-the-kernel-accepts.md); write a `теорема`, or rephrase the postcondition |

No external SMT solver is used. Do not write software for medicine, aviation or
space in flang: certification is a process, not a property of a language.

## The language

**There is no writing into a list by index.** You can read an element,
`элемент N в список`, and this works in every target language. Values are immutable,
so "the list with element N replaced" means building a new list. Algorithms
built on an updatable table — dynamic programming like Coin Change or Edit
Distance, a bucketed hash table — do not carry over directly. For a dictionary,
use one of the library ones: a list of pairs with linear lookup
(`flang/stdlib/dictionary.flang`), a search tree with O(log n) lookup
(`flang/stdlib/tree.flang`), or a hash trie (HAMT) whose depth is bounded by
the hash length (`flang/stdlib/hashmap.flang`).

**There are no bitwise operators.** Use the library functions that implement
them with arithmetic, for example `«Исключающее или байтов»` (XOR of bytes) in
`flang/stdlib/aes.flang`.

**Counting up does not prove termination.** A recursive call on `н плюс 1`
is rejected with `FLANG_NOT_TOTAL`: "the recursive call does not decrease". Turn
it into counting down over a `неотрицательное` (non-negative integer)
parameter; then the type proves termination
(`docs/examples/measure/natural.flang`).

**When the step changes from call to call, the compiler cannot find the
decreasing measure itself.** It finds structural recursion (on the tail of a
list, on a part of a tree) and a numeric argument that decreases by a constant
step. For anything else, write the measure yourself with a `убывает
<expression>` line: binary search uses `убывает верх минус низ плюс 1`, Euclid's
algorithm uses `убывает б` (`docs/examples/measure/`). The generated code then
checks at run time that the measure is a whole number, non-negative and
strictly decreasing, and stops with `FLANG_MEASURE` instead of hanging. The
same run-time check guards a constant step on a plain `число`, because numbers
are IEEE-754 doubles and `x минус 1` equals `x` for large `x`. On a
`неотрицательное` parameter the check is not needed and not generated: the type
already bounds the value.

**A variant named like a keyword is not matched.** With variants `Да`, `Нет`,
`Плюс` or `Больше`, `случай Да` is read as the keyword, and the error blames
the pattern (`FLANG_TYPE: образец-литерал имеет тип признак …`) instead of the
name. Write `случай вариант «Да»`, or rename the variant.

**Side effects work through `план` only.** A function never reads a file
itself: it returns a command as data (`вариант «Прочитать файл» с путь равным
…`), and `flang io` executes it and calls the function again with the
response. There are 27 commands, and the list is closed: <!-- СНЯТО 2026-10-12 список flang/self/parser.flang:6543 = 27 -->
read and write a file as text and as bytes, delete a file, make a temporary
directory, list a directory, make an HTTP request, open and accept a
connection, read and write a connection as text and as bytes, send and
receive a datagram, start a process with or without input, show on the screen, wait for an event, get the screen
size, read the clock, get a random number, get random octets, read an
environment variable, read the command-line arguments. The list is the function
`«Варианты поручения»` in `flang/self/parser.flang`, and a postcondition there
fixes its length at 27.
Reading invalid UTF-8 as text fails with `FLANG_IO_NOT_TEXT`; read binary
files as bytes.

**`https` uses a built-in TLS 1.3 client.** «Запросить» over `https` is executed by a client
written in flang and built into the binary; `curl` is not needed. The client supports only
`TLS_AES_128_GCM_SHA256`, x25519, `rsa_pss_rsae_sha256` and an `sha256WithRSAEncryption` chain; a
server without them is refused with `FLANG_IO_TLS`. Certificate revocation is not checked, and
certificate checking cannot be switched off. Roots come from `--trust-roots <PEM file>` or the
system bundle. A response is at most 1,048,576 bytes. A plan has no raw TLS socket: «Открыть
соединение» is plain TCP. Datagrams are IPv4 only.

**A program with `план` is generated into `c`, `go`, `js`, `python`, `rust`
and `ts`**. `cpp`, `csharp`, `elixir` and `java` refuse with
`FLANG_PLAN_UNSUPPORTED`, name the plan and write no files. In `c`, `go`,
`python` and `rust` the runner runs the plan: `flang_cli --plan <name>
[arg…]`; its host performs 9 kinds of orders out of 27 (files as text and as
bytes, directories, environment, arguments) and answers network, processes,
clock, dice and screen with «Сбой» and `FLANG_IO_NOT_WIRED` or
`FLANG_IO_NO_SCREEN`. Run such a plan with `flang io`.

**The compiler answers in English only in part.** With `language = en` in `.flangrc` (or
`FLANG_LANG=en`), `flang check` prints the summary and refusals in English, but some texts stay
Russian — for example `FLANG_TYPE` about a literal pattern. The `FLANG_*` code is the same in
every language. Help, `test`, `run`, `io` and `lint` answer in Russian.

**There is no I/O monad.** Steps are chained by returning a command together
with the next step as a declared value, not as a hidden closure.

**`flang emit` does not run the examples.** `flang check` and `flang test` run them; `emit`
prints even a program with a false example. Run `flang test <file>` before printing.

## Category declarations

The laws of `категория` and `изоморфизм` are computed on a finite grid of values from the
examples, not proved. The laws of a `моноид` over `число` and `строка` are not proved by the
kernel: they stay on the grid too, and `flang check --proof` exits with code 3. The laws of a
`монада` and the laws of `отобразить` over a list are proved by the kernel. Details:
[Categories and functors](../site/categories.md).

## Processes

| Does not work | What to do instead |
| --- | --- |
| processes in `cpp`, `csharp`, `go`, `java`, `python`, `rust`: `flang emit` refuses with code 1, "у цели «…» нет планировщика конкурентности" | generate into `c`, `elixir`, `js` or `ts` |
| `породить` (spawn) in Elixir and JavaScript: the scheduler answers with an error | use the `c` target, which supports it |
| a bounded mailbox in Elixir: `flang emit --target elixir` refuses | use `c`, `js` or `ts`, or an unbounded mailbox |
| sending to a spawned process by a name computed at run time: the compiler checks only literal names | give the spawned process its work in the first message, and let it reply to a process with a declared name |
| running on several machines: the binary compiler does not read the node placement file (`--размещение` is an unknown key) | run on one node |
| proving freedom from deadlock: `прогон` scenarios try a finite set of message orders under fixed seeds; that is testing, not a proof | design the protocol so that no process waits on another in a cycle |

The scheduler in the generated C has two modes: a single thread that orders
messages by a seed, so the same seed gives the same delivery log, and a pool of
worker threads (the `workers` field in the request). The pool is faster only
when the program has parallel work; on a program without it, the pool is
several times slower.
