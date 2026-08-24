[Back to README](../../README.md) · [Documentation index](../README.md)

# Known limits

Stated plainly, because a project with undrawn borders is not one you can rely on. The same line
is drawn in [`docs/overview.ru.md`](../../docs/overview.ru.md); the full lists are in
[`flang/SPEC.md`](../../flang/SPEC.md) §10 and the "Долги" sections of the contracts.

**Three words that are not confused here.** The distinctions matter and the words sound alike, so:

- *proven* (`доказано`) — statements about **all** inputs, established by the compiler: termination
  (`тотальная`), types and exhaustiveness of `разбор`, composition and chain wiring, and the
  three functor laws;
- *grid N* (`сетка N`) — computed on a **finite** set of the author's own values: utility
  properties, declared examples, concurrency runs, and the agreement between the interpreter and
  the eight backends. Nothing is known about the other inputs. **This is not a proof**;
- *stated, not proven* (`объявлено, не доказано`) — the claim is written down and nothing backs it.

The three words are not prose decoration: they are exactly what the proof report
(`flang check --proof`) and the assistant service answer with, and this page does not use one for
another.

Extending what is proven is possible — conditions that fit linear arithmetic are decidable — but
attaching a solver to the verification conditions is an open task, not a feature.

**The language.**

- Functions are first-class values in the language, and they print to all eight targets. The
  restriction was lifted by defunctionalization (Reynolds, 1972): a function value is a tag,
  `функция «Удвоить»`, and an application `ф от 5` is a dispatcher over a finite list of tags — so
  targets without closures and the termination proof both survive (`flang/cat/HOF.md`). The
  lowering is ONE pass before printing (`flang/self/defunc.flang`): each backend receives a
  first-order program, so none of the eight sees higher order at all. The printed code is built
  with real toolchains and checked against the interpreter over a grid of inputs. What is still
  missing is self-application: `self/` does not know the new form, so the repository's own
  programs (`stdlib`, `examples`) do not use it.
- Effects are described, not performed — and this works: `вариант «Прочитать файл» с путь
  равным …` builds a value, and whoever ran the plan executes it (`flang io`).
  There are twenty orders and the set is closed: read and write a file as characters and
  separately as octets, delete a file, make a temporary directory, list a directory,
  make a network request, open and accept a connection, read and write a connection as characters
  and separately as octets, spawn a process and spawn a process with input, draw on the screen,
  wait for an event, read the clock, draw a random number. The set is closed in the code, not just
  in prose: it is one line in the function `«Варианты поручения»` (`flang/self/parser.flang`), and
  its length — 20 — is held by an `обеспечивает`, so the compiler checks it. The file octet pair landed on
  22 August 2026: before it a binary file went through the text pair SILENTLY — 4096 octets in,
  7 bytes out. The text pair now refuses invalid UTF-8 (`FLANG_IO_NOT_TEXT`), and the octet pair
  carries a binary byte for byte. There is no I/O monad, though, and the reason is
  no longer polymorphism: parametric types are in the language, in self-application and in the
  standard library (`«Возможно» от «А»` in `flang/stdlib/optional.flang`). What is missing is the
  category layer: the functor check knows a type's name, not its application — phase 3 in
  `flang/cat/POLY.md`. Until then, sequencing is expressed by a continuation machine where the
  continuation is a declared value rather than a hidden closure; how that differs from a monad is
  in `flang/cat/SPEC.md`. Emitting a program with a `план` declaration works for
  ONE target out of eight: `js` emits the declaration in full and exits 0, and the other seven
  refuse with `FLANG_PLAN_UNSUPPORTED`, name the plan and write no file (the refusal text is in
  `flang/self/bootstrap/compiler.flang`). Until 22 August 2026 those same seven emitted the
  program with exit code 0 and silently dropped the declaration — the worst of the outcomes,
  because the module built and did not work. The breakdown is in
  `docs/zettel/pechat-plana-obeshchana-naiznanku-i-sverit-eyo-nechem.md`.
- An array is read by index in constant time (`элемент N в СПИСОК`, seven targets out of eight), and
  a dictionary comes in three kinds: a list of pairs with linear lookup (`dictionary.flang`), a
  search tree whose priority is the hash of the key, O(log n) (`tree.flang`), and a trie over the
  digits of the hash with CONSTANT-time access (`hashmap.flang`, a HAMT: depth is bounded by the
  fourteen digits of the hash for any number of keys). What is missing is WRITING by index: values
  are immutable, and "the list with its Nth replaced" would have to be rebuilt whole. Until that
  exists, table-driven dynamic programming (Coin Change, Edit Distance) does not transfer and a
  BUCKETED hash table — the kind that needs an array with replacement by index — cannot be built;
  a constant-time dictionary can, because a trie rewrites only the path to the key, not the whole
  array. No bitwise operations either.
- The totality analysis INFERS structural decrease and a numeric measure with a CONSTANT step —
  either a literal (`н минус 1`) or a parameter that arrives in the call unchanged and is strictly
  positive (`н минус ш` under `если ш не больше 0`). Where the step CHANGES from turn to turn there
  is nothing to infer it from, so the author NAMES the measure — a `убывает <expression>` line.
  That is how binary search (`убывает верх минус низ плюс 1`) and Euclid (`убывает б`) are
  written; they no longer need a "fuel" list — see `examples/measure/`. **Counting UP is not
  written with a measure**: it has no upper bound and nothing to prove with. It is turned into
  counting down over a `неотрицательное` parameter, and then the type itself proves it
  (`examples/measure/natural.flang`). Decrease with a floor is not enough: 1, ½, ¼ … stays above zero
  forever, so the guard on a declared measure checks three things at once — strict decrease,
  non-negativity and WHOLENESS. The constant-step measure is propped up by the same guard for a
  different reason: flang numbers are IEEE-754 doubles and `x минус 1` equals x for large |x|. No
  decrease means a `FLANG_MEASURE` refusal — identical in the interpreter and in all eight targets
  — not a hang.
- The constant-step guard is DROPPED when the parameter is declared an exact natural (`неотрицательное` — a
  whole number in [0, 2^53−1]). The type supplies both ends the argument was missing: a floor of
  0 and a ceiling below which `н минус c` for whole c ≥ 1 is EXACTLY smaller than н. The proof
  becomes complete, and the ledger names a fifth carrier of the promise — «точным шагом», the
  only one without a guard. The figures come from the ledger and are substituted by the
  build rather than typed: today {{носители.постоянныйШаг}} functions carry the promise by
  constant step with a guard, {{носители.точныйШаг}} carry it by exact step with none, and the
  guard stands at {{сторож.мест}} sites in {{сторож.функций}} functions. The move to `неотрицательное` added ZERO sites — overflow is caught by widening the type
  (`неотрицательное плюс неотрицательное` is `число`), not by a check in the emitted code. Worked
  example: `examples/measure/natural.flang`.
- A variant named like a keyword (`Да`, `Плюс`, `Больше`) is not matched in patterns, and the
  diagnostic blames the pattern instead of naming the real cause. Workaround: rename it, or use
  the explicit `случай вариант «Имя»` form the stdlib uses.

**The category surface.** Morphisms, composition, chains, identities, functors, bifunctors,
isomorphisms, monoids, groups and monads are implemented; a monad also comes with the binding form
`в монаде`. Set relations are said with two words: `вложение` is a subobject (an arrow that glues
nothing together), `пересечение` is a pullback over the ambient set. The shape of both is proved by
matching declarations; injectivity of an embedding is checked on the author's own values and, when
the arrow glues, the message presents the counterexample; non-emptiness of a common part is
confirmed by a witness. Universality of the common part stays the author's assumption, and the
compiler draws no consequences from it ([`flang/cat/SETS.md`](../../flang/cat/SETS.md)). Union did NOT
become a word: the coproduct is already in the language — it is `тип … вариант …` with exhaustive
`разбор`. An arrow may carry a law: `даёт` names the function, `закон` carries the examples, and
a broken law fails `flang test` naming both the arrow and the law. Isomorphism invertibility is
checked wherever both arrows are named through `даёт`, and stays the author's assumption wherever
at least one is not. The precondition (`требует`) is implemented, and the caller discharges it, as
in Dafny: inside the body it is a known fact the kernel reasons from, at every call site it is an
obligation refused by name when unmet, and at the program boundary (`--args`, examples) it is
computed because there is nothing to prove there. Its cost is named in bytes: a program with no
`требует` at all emits byte for byte as before, and a program with one grows by exactly the door —
334 bytes in Python, 349 in Java, 369 in Elixir, 387 in C#, 452 in Rust, 462 in Go, 477 in C and
1 654 in JavaScript ([`flang/SPEC.md`](../../flang/SPEC.md), "Предусловия функции"). Natural transformations are specified in
[`flang/cat/SPEC.md`](../../flang/cat/SPEC.md) and are not implemented. Category names in a functor declaration are a note for the reader, not a
checked claim. A list — and anything recursive, I/O included — cannot be declared a monad today:
the endofunctor map is printed in place, so the parameter must occupy a whole field
([`flang/cat/MONAD.md`](../../flang/cat/MONAD.md)).

**Concurrency.** The scheduler in the C runtime runs in two modes. The checking one is a single
thread interleaving by seed: it produces byte for byte the same delivery log as the witness, and
that is what it is for. The second is a worker pool, switched on by the `workers` field in the
request and measured directly: on a program with parallel work the pool is 1.85–4.80 times faster
already at one run per handoff, and on a program with NO parallelism it is 6.7 times slower while
burning fifteen cores (measurements in
[`docs/scheduler-benchmark.md`](../../docs/scheduler-benchmark.md)). THREE targets emit processes —
C, Elixir and JavaScript; the other five (Go, Rust, Python, Java, C#) REFUSE to emit a program with
`процесс` at all, with `FLANG_CONC_UNSUPPORTED`, rather than emitting half of it. `породить` spawns
instances of declared kinds at run time in the witness and in target C; the JavaScript and Elixir
schedulers answer that action with a named error. The parent names the child, because a described
action cannot return anything; a message addressee must still be a literal, so you can only speak
to a spawned process through the message it was born with; there is no distribution. The seed grid
checks a finite set of interleavings — a checked claim, not a proof — and it gives no freedom from
deadlock. The machine was never idle for any of the measurements (load 125–734 with 256 cores, and
60–1250 on the pool runs), so every time figure in them is an upper bound; the figures that do not
depend on load (interpreter steps, reductions, bytes) are given separately and repeat run to
run.
