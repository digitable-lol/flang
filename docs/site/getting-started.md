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

## What the binary cannot do

`check`, `run` and `repl` are all there is. It does not know `test` or `emit`,
and says so plainly:

```
$ ./bootstrap/flang_cli test hello.flang
flang: неизвестная команда «test». «flang --help» — что умеет бинарник.
```

The exit code is 2 — a refusal a script can see, not silence.

Worse than a refusal is `--proof`: the binary does not reject it, it **silently
ignores** it. The output of `check --proof` equals the output of `check`, there
is no ledger, and nothing says so. Only the interpreter prints a ledger.

## Where the binary diverges from the reference

Not "cannot do something" but **answers differently**, which is the more
dangerous kind: an inability is visible, a divergence is not.

**The binary does not check arguments against declared types.** `Факториал` is
declared over the type `нат`. Give it −3:

```
$ ./bootstrap/flang_cli run flang/examples/rosetta/factorial.flang \
    --function Факториал --args '{"н": -3}'
1

$ node flang/bin/flang.mjs run flang/examples/rosetta/factorial.flang \
    --function Факториал --args '{"н": -3}'
{"error":"вызов функции «Факториал»: аргумент «н»: -3 вне нат", …}
```

The binary accepted an input the type does not contain and printed an answer.
The reference refused. Until that is closed, check inputs you do not vouch for
with the reference.

On permitted inputs the two agree — three corpus programs run without Node:
`Факториал(12) = 479001600`, `Фибоначчи(20) = 6765`,
`Палиндром("шалаш") = true`, all three sign for sign with the reference. They
print differently: the binary a bare value, the interpreter JSON with the
function name and arguments.

## The second road: the interpreter on Node

It is for two cases: flang embedded in a project that already exists — rules
sitting next to the code that applies them — and anything the binary lacks: the
proof ledger, `test`, `emit`, and checking arguments against types. Nothing to
install — zero external dependencies, `npm install` is not needed.

### Check with proofs

```bash
node flang/bin/flang.mjs check hello.flang --proof --pretty
```

The kernel tries to **prove** the postcondition — to show it holds on all inputs
and not only on the 2 from the example. The answer is one of three, and the
difference matters:

- **proved by the kernel** — the claim holds for all inputs;
- **on a grid** — no violation found by running over values. **That is not a
  proof**, and the ledger says so in those words;
- **stated, not proved** — the kernel ran out of rules. The claim is then
  evaluated at run time, on the inputs that arrive.

### Run with type checking

```bash
node flang/bin/flang.mjs run hello.flang --function Twice --args '{"n": 21}'
```

```json
{"function":"Twice","args":{"n":21},"result":42}
```

### Run the examples

```bash
node flang/bin/flang.mjs test hello.flang
```

### Emit into another language

```bash
node flang/bin/flang.mjs emit hello.flang --target c --out ./out-c
```

There are eight targets: `c`, `csharp`, `elixir`, `go`, `java`, `js`, `python`,
`rust`. The emitted code must return **the same values and the same error codes**
as the interpreter — checked byte for byte across the whole corpus, not
declared.

## Next

- [Why proofs, and how they work](proofs.html)
- [Roadmap](roadmap.html) — what exists today and what does not
- [Language specification](../spec.html) — in Russian
