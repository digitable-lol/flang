[Back to README](../../README.md) · [Documentation index](../README.md)

# Known limits

What does not work in flang today, and what to do instead. The full lists are
in [`docs/flang/SPEC.md`](../flang/SPEC.md) §10 and in the "Долги" sections of
the specifications.

## How to read the proof report

`flang check --proof` gives every postcondition (`обеспечивает`) one of three
results. They are not the same thing:

| The report says | What it means |
| --- | --- |
| `доказано` (proved) | true for **all** inputs. The prover proved it, and the separate C program `flang/proof/checker/checker.c` can re-check the proof step by step |
| `сетка N` (grid of N) | checked only on N values you wrote, like unit tests. Nothing is known about other inputs. **This is not a proof** |
| `объявлено, не доказано` (declared, not proved) | written down, but there is neither a proof nor an example |

Termination of `тотальная` functions, types and exhaustive pattern matching
(`разбор`) are always proved, not tested.

## What you cannot prove

| Does not work | What to do instead |
| --- | --- |
| "there exists x such that …" without naming x: the prover does not search for a value | name the value: `есть такой м, а именно н, что …` |
| a property of state over time, of side effects or of concurrency: there is no way to write it in the language (ADR-0026, ADR-0032) | test it with `пример` and, for processes, with `прогон` scenarios |
| a property of the generated C, Go, Rust and other code: the proof covers the flang program, the code generator is not proved (ADR-0030) | test the generated program on its own |
| a postcondition the prover does not accept | see [What the prover accepts](../site/what-the-kernel-accepts.md); write a `теорема`, or rephrase the postcondition |

No external SMT solver is used. Do not write software for medicine, aviation or
space in flang: certification is a process, not a property of a language
(ADR-0031).

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
already bounds the value. The proof report counts these cases:
{{носители.постоянныйШаг}} functions terminate by a constant step with the
run-time check, {{носители.точныйШаг}} by an exact step without it, and the
check stands at {{сторож.мест}} places in {{сторож.функций}} functions.

**A variant named like a keyword is not matched.** With variants `Да`, `Нет`,
`Плюс` or `Больше`, `случай Да` is read as the keyword, and the error blames
the pattern (`FLANG_TYPE: образец-литерал имеет тип признак …`) instead of the
name. Write `случай вариант «Да»`, or rename the variant.

**Side effects work through `план` only.** A function never reads a file
itself: it returns a command as data (`вариант «Прочитать файл» с путь равным
…`), and `flang io` executes it and calls the function again with the
response. There are 24 commands, and the list is closed: <!-- СНЯТО 2026-10-04 список flang/self/parser.flang:5985 = 24 -->
read and write a file as text and as bytes, delete a file, make a temporary
directory, list a directory, make an HTTP request, open and accept a
connection, read and write a connection as text and as bytes, start a process
with or without input, show on the screen, wait for an event, get the screen
size, read the clock, get a random number, read an environment variable, read
the command-line arguments. The list is the function `«Варианты поручения»` in
`flang/self/parser.flang`, and a postcondition there fixes its length at 23.
Reading invalid UTF-8 as text fails with `FLANG_IO_NOT_TEXT`; read binary
files as bytes.

**A program with `план` is generated only into `js` and `ts`.** The other
eight targets refuse with `FLANG_PLAN_UNSUPPORTED`, name the plan and write no
files. To run such a program elsewhere, run it with `flang io`.

**There is no I/O monad.** Steps are chained by returning a command together
with the next step as a declared value, not as a hidden closure. How this
differs from a monad: [`docs/ct/spec.md`](../ct/spec.md).

## Category declarations

`категория`, `морфизм`, `функтор`, `моноид`, `монада`, `изоморфизм`,
`вложение`, `пересечение`, `свойство` and natural transformations are parsed,
but the binary compiler checks their rules only in part. For monoids, monads,
functors, isomorphisms, embeddings, intersections and declared properties it
checks no laws at all; for categories and morphisms it does not check closure
under composition, identities or matching ends of a composition. `flang check`
names what it did not check and exits 2:

```
$ flang check flang/ct/monoid-and-monad.flang
модуль «Monoid and monad»: функций 12, из них с доказанным завершением 12; типов 2
проверено НЕ ВСЁ: в программе объявлено то, чего бинарник не судит вовсе — monoids, monads. Ответ «замечаний нет» здесь читался бы как «проверено», а это неправда. Судья, вшитый в замыкание, до них не достаёт: `flang/self/setoid.flang` и `flang/self/setoid-oracle.flang` (264 функции) считают законы категорий, морфизмов и преобразований, и только их. Правил, которые сверяли бы названное выше, в замыкании этого двоичного нет ни строкой. Часть их в дереве написана слоями, которые сюда не ввезены, — а правило, которое никто не запускает, от ненаписанного неотличимо. Пока это так, названное выше не судит НИКТО
flang/ct/monoid-and-monad.flang: проверено НЕ ДО КОНЦА — разбор, типы, завершаемость, ядро и примеры прошли
$ echo $?
2
```

The functions inside such a file are checked as usual: types, termination,
proofs, unit tests. If you need a law to hold, write it as an `обеспечивает` or
a `пример` on the functions. Details: [`docs/ct/spec.md`](../ct/spec.md).

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
several times slower. Measurements: [`docs/scheduler-benchmark.md`](../scheduler-benchmark.md).
