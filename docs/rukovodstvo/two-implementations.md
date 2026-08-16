[Back to README](../../README.md) · [Documentation index](../README.md)

# Two implementations, and the fixed point

Two implementations exist, and both are kept deliberately. The **reference** one is written in
TypeScript and JavaScript and defines the behaviour of the language. The **self-hosted** one is
written in flang.

### The FTS core, written in flang

[`flang/core/`](../../flang/core) is the FTS core — lexer, parser, evaluator, JSON printer — rewritten
in flang: 300 functions, every one of them `тотальная` and proven so. `fts check` is not allowed
to hang either.

The correctness criterion is not "its own tests pass". It is a differential one, stated in
[`flang/core/SPEC.md`](../../flang/core/SPEC.md): run the whole chain — *text → lexer in flang →
parser in flang → JSON printer in flang* — and require the output string to equal
`JSON.stringify(compile(text))` of the TypeScript core **byte for byte**. It runs over every
`.fts` model in this repository — 50 of them on a clean clone, on both surfaces (47 indentation,
3 braced) — with zero divergences. If an external model directory is present, its models join the
same run, so your local count may be higher; the promise is the corpus, not the number.
Diagnostics are compared separately, on 34 deliberately broken indentation models and 13 braced
ones — code *and* message text.

### The compiler, written in flang, and the fixed point

[`flang/self/`](../../flang/self) is the flang compiler written in flang. Five layers, each with its
own JavaScript reference to be compared against — not "roughly the same", but to the last
component of the result:

| Layer                 | Functions | Reference          | What must match                                                     |
|-----------------------|----------:|--------------------|---------------------------------------------------------------------|
| `self/lexer.flang`    |        88 | `src/lexer.mjs`    | token stream: kind, value, quotedness, line and column               |
| `self/parser.flang`   |       372 | `src/parser.mjs`   | the AST — **byte for byte** after serialization                      |
| `self/types.flang`    |       276 | `src/types.mjs`    | diagnostics (code, text, line, column) and the signature table       |
| `self/totality.flang` |       124 | `src/totality.mjs` | the verdict: proven functions in the same order, diagnostics, `ok`   |
| `self/emit-c.flang`   |       328 | `src/emit/c.mjs`   | the printed C — **byte for byte**, and it compiles without warnings  |

Readiness is not "it built". It is the classical fixed point:

```
1. the JS compiler prints self/*.flang      → C → build → flang₁
2. flang₁ prints the same self/*.flang      → C → build → flang₂
3. the C printed by flang₁ and the C printed by flang₂ are identical byte for byte
```

**The fixed point has converged.** The reference, `flang₁` and `flang₂` print the compiler
identically — all seven printed C files — which means the compiler understands the language the way the
reference does, and no test suite substitutes for that. The check is
`flang/test/self-bootstrap.test.mjs`, and it prints the result:

```
✔ шаги 2 и 3: flang₁ печатает сам себя, flang₂ печатает то же самое
ℹ неподвижная точка сошлась: 7 файлов совпали побайтово у эталона, flang₁ и flang₂
```

This is where the release comes from: the C in the release archive is printed from these sources. The reference implementation is not deleted, and will not be — convergence is
measured against it, and deleting it would delete the check.
