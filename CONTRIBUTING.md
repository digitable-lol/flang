# Contributing

Run the complete verification loop before proposing a change:

```bash
npm install
npm test
```

`npm test` is three suites — `test:core` (the FTS core in TypeScript),
`test:tools` (the tools in `tools/`), `test:flang` (the language). All three must
pass. A test skipped for a missing native toolchain is not a passing test; set
`FTS_REQUIRE_TOOLCHAINS` where the toolchain is supposed to exist.

Changes to the FTS surface must include:

- a canonical JSON representation;
- parser and semantic-validation tests;
- a schema update when the model changes;
- an example for user-visible syntax.

Changes to flang must include:

- the corresponding section of `flang/SPEC.md`, updated in the same change;
- a type-checker or totality test, whichever the change touches;
- matching behaviour in the interpreter and in every emitter — the emitter tests
  compare a compiled binary against the interpreter, so a divergence is a failure,
  not a note;
- a debt entry in `flang/core/SPEC.md` when a divergence from the TypeScript core
  is left in deliberately.

Do not add product-specific structures, filesystem access, or network access to the core library. Build integrations as separate packages over the public `FtsDocument` API.
