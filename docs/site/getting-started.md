# Your first program

Two roads: build the compiler from C and never hear about Node — or wire the
interpreter into your own Node project. Both are below, the compiler first.

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap
```

`cc` and `make`, nothing else: no Node, no npm, no network. Measured build:
**30,7 с** with `make -j4` under `-O2 -flto`; 9,68 МБ of emitted C going in,
`bootstrap/flang_cli` coming out — 5,1 МиБ, linked against `libc` and `libm`
only.

## Write a program

Put this in `hello.flang`:

```
module «Hello»

total function «Twice»
  accepts n: number
  returns number
  ensures «the result is twice the input» result equals (2 times n)
  example «Two doubled»
    given n equals 2
    expected 4
  n plus n
```

Five things, each doing its own job:

- **`total`** — a promise that the function terminates on every input. The
  compiler **checks** it and refuses the file if it cannot prove it.
- **`accepts` / `returns`** — types, checked statically.
- **`ensures`** — a postcondition: what holds of the result. Not for the inputs
  you thought of but **for all of them**, if the kernel can prove it. The claim
  is **named** — the name in guillemets is required, and the ledger reports it
  by that name.
- **`example`** — an executable example. It is part of the program rather than a
  test on the side, and it runs on every check.
- the last line is the body.

Keywords come in two surfaces. `module` / `total function` / `accepts` is the
English one, `модуль` / `тотальная функция` / `принимает` the Russian one, and
both parse to the same tree.

## Check it

```bash
./bootstrap/flang_cli check hello.flang
```

```
модуль «Hello»: функций 1, из них с доказанным завершением 1; типов 0
hello.flang: проверено — разбор, типы, завершаемость; замечаний нет
```

The binary speaks Russian. Its diagnostics are not translated yet, and pretending
otherwise on this page would not make them so.

## Run it

```bash
./bootstrap/flang_cli run hello.flang --function Twice --args '{"n": 21}'
```

```
42
```

The binary computes this itself: the evaluator is pulled into it, Node is not
needed.

The function name goes **without guillemets**: in a declaration they are part of
the notation, on a command line they are not.

## Try it live

```bash
./bootstrap/flang_cli repl
```

The shell does not call the evaluator yet: it emits the session to C and builds
it with the same `cc` you just built the compiler with. With no `cc` it does not
switch off — it checks parsing, types and termination and says so.

## Run the examples

```bash
./bootstrap/flang_cli test hello.flang
```

```
hello.flang: примеров 1, прошло 1, не прошло 0
```

Examples are part of the program rather than a test on the side, and `check`
counts them even without `test`.

## The proof ledger

```bash
./bootstrap/flang_cli check hello.flang --proof
```

The kernel tries to **prove** the postcondition — to show it holds on every
input, not just on the 2 from the example. The ledger names what carries each
promise, and its words are not interchangeable:

- **доказано** (proved) — a claim about all inputs, derived from declarations
  and structure;
- **сетка N** (grid of N) — computed on N author-chosen values. **This is not a
  proof**, and the ledger says so outright;
- **объявлено, не доказано** (declared, not proved) — the kernel ran out of
  rules. The claim is then computed at run time, on the inputs that arrive.

## Emit into C

`emit` does not create the output directory — make it yourself:

```bash
mkdir -p ./out-c
./bootstrap/flang_cli emit hello.flang --target c --out ./out-c \
    --runtime flang/src/emit/c
make -C ./out-c
```

Six files, and they build with the same `cc` without a single warning. The
binary reads the C runtime from disk: `--runtime` or `$FLANG_RUNTIME_DIR` says
where.

## The limits of the binary

`check`, `test`, `run`, `repl`, `emit --target c` and the ledger are all in the
binary. Its limits lie elsewhere, and it names them itself rather than staying
quiet.

**The ledger does not search for violations by example.** The binary counts
examples but does not run them for the search: its ledger reads «нарушений НЕ
ИСКАЛИ — прогона примеров не было, посчитано только их число» (did not search —
the examples were not run, only counted), where the reference on the same file
writes «нарушений не найдено (искали прогоном на всех 1)» (none found, searched
by running all 1). A difference in wording is a difference in the strength of
the claim.

**The binary does not compute laws on a grid.** Monoid, monad, isomorphism,
category, sets, connection and the five declared properties are computed by
evaluation on a grid, and that layer is not in the binary. A program declaring
one gets a refusal naming the obstacle, not a green ledger with an empty
section.

**The binary has one emit target.** `c`, and that is all; the other seven
(`csharp`, `elixir`, `go`, `java`, `js`, `python`, `rust`) stayed with the
reference. Two things are missing from the C emit itself: unreachable code is
not dropped and proved code is not marked (`markProven`). On the compiler that
is 6 files out of 7 byte for byte.

**The `repl` shell does not call the evaluator.** It emits the session to C and
builds it with the same `cc` you built the compiler with. With no `cc` it does
not switch off — it checks parsing, types and termination and says so with the
line «вычислять нечем».

## Where the binary diverges from the reference

Not "cannot do something" but **answers differently**, which is the more
dangerous kind: an inability is visible, a divergence is not. Today there is one
such place, and the binary warns about it as it emits.

**An emitted program has an empty input boundary.** The table of declared types
is built by the reference's type layer, which the binary does not have, so the
runner's arguments are **not checked** against declared types. The emitted code
builds and runs, but the caller answers for the input. The binary itself does
check arguments: `Факториал` is declared over the type `нат`, and on −3 it
answers `FLANG_TYPE: вызов функции «Факториал»: аргумент «н»: -3 вне нат` with
exit code 1 — the same code the reference gives.

On permitted inputs the two agree — three corpus programs run without Node:
`Факториал(12) = 479001600`, `Фибоначчи(20) = 6765`,
`Палиндром("шалаш") = true`. They print differently: the binary a bare value,
the interpreter JSON with the function name and arguments.

## The second road: the interpreter on Node

The binary is for people who **install the language**. The interpreter is for
people who **wire it into an existing project**: the rules sit next to the code
that applies them and are called from it. Nothing to install — zero external
dependencies, `npm install` is not needed.

It is also what you need for what the binary lacks: the other seven emit
targets, laws on a grid, judgements, and the search for violations by example.

Today it also carries the tooling around the language: the tree checks, the
build of this site, the number guards (`npm run counts:check`) and the language
server.

### Emit into the other seven targets

```bash
node flang/bin/flang.mjs emit hello.flang --target rust --out ./out-rust
```

There are eight targets: `c`, `csharp`, `elixir`, `go`, `java`, `js`, `python`,
`rust`. The emitted code must produce **the same values and the same error
codes** as the interpreter — checked byte for byte across the whole corpus
rather than declared.

### A ledger that searches

```bash
node flang/bin/flang.mjs check hello.flang --proof --pretty
```

The same ledger the binary prints, except the grid is not merely counted but
**run**: instead of "did not search" it reads «нарушений не найдено (искали
прогоном на всех 1)».

## Next

- [Why proofs, and how they work](proofs.html)
- [Roadmap](roadmap.html) — what exists today and what does not
- [Language specification](../spec.html) — in Russian
