[Back to README](../../README.md) · [Documentation index](../README.md)

# Two implementations, and the fixed point

Two implementations exist, and both are kept deliberately. The **witness** one is written in
TypeScript and JavaScript and defines the behaviour of the language. The **self-hosted** one is
written in flang.

### Domain-model parsing, written in flang

[`flang/core/`](../../flang/core) is the lexer, parser, evaluator and JSON printer for the
indentation-based notation of domain objects and rules (`категория`, `объект`, `утилита`),
written in flang itself: 300 functions, every one of them `тотальная` and proven so. These are
the largest programs in the tree, and they are no more allowed to hang than anything else.

The correctness criterion is not "its own tests pass". It is stated in
[`flang/core/SPEC.md`](../../flang/core/SPEC.md): run the whole chain — *text → lexer in flang →
parser in flang → JSON printer in flang* — and require the output to match the reference answer
**byte for byte**. It runs over the whole model set — 53 files, 50 indentation and 3 braced
(`flang/test/fixtures/fts/` and `benchmarks/model-authoring/reference/`) — with zero divergences.
Diagnostics are compared separately, on deliberately broken models of both notations — code *and*
message text.

**That check is no longer a differential one, and you should know it.** The second
implementation it used to be compared against is not in the tree; its answers are frozen in
`flang/test/fixtures/fts-oracle.json`. So a regression in `flang/core/*.flang` is still caught
byte for byte, but a divergence between two independent implementations is not — there is
nothing to diverge from. The reason and the price are written down in the header of
`flang/test/fts-oracle.mjs`.

### The compiler, written in flang, and the fixed point

[`flang/self/`](../../flang/self) is the flang compiler written in flang. Five layers, each with its
own JavaScript witness to be compared against — not "roughly the same", but to the last
component of the result:

| Layer                 | Functions | Witness            | What must match                                                     |
|-----------------------|----------:|--------------------|---------------------------------------------------------------------|
| `self/lexer.flang`    |        88 | `flang/src/lexer.mjs`    | token stream: kind, value, quotedness, line and column               |
| `self/parser.flang`   |       372 | `flang/src/parser.mjs`   | the AST — **byte for byte** after serialization                      |
| `self/types.flang`    |       276 | `flang/src/types.mjs`    | diagnostics (code, text, line, column) and the signature table       |
| `self/totality.flang` |       124 | `flang/src/totality.mjs` | the verdict: proven functions in the same order, diagnostics, `ok`   |
| `self/emit-c.flang`   |       328 | `flang/src/emit/c.mjs`   | the printed C — **byte for byte**, and it compiles without warnings  |

Readiness is not "it built". It is the classical fixed point:

```
1. the JS compiler prints self/*.flang      → C → build → flang₁
2. flang₁ prints the same self/*.flang      → C → build → flang₂
3. the C printed by flang₁ and the C printed by flang₂ are identical byte for byte
```

**The fixed point has converged.** The witness, `flang₁` and `flang₂` print the compiler
identically — all seven printed C files — which means the compiler understands the language the way the
witness does, and no test suite substitutes for that. The check is
`flang/test/self-bootstrap.test.mjs`, and it prints the result:

```
✔ шаги 2 и 3: flang₁ печатает сам себя, flang₂ печатает то же самое
ℹ неподвижная точка сошлась: 7 файлов совпали побайтово у свидетеля, flang₁ и flang₂
```

This is where the release comes from: the C in the release archive is printed from these sources. The witness implementation is not deleted, and will not be — convergence is
measured against it, and deleting it would delete the check.
