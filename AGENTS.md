# Agent guidance

This repository holds one language: **flang** (`.flang`, implementation in
`flang/src/`). Read the "Where the language came from" section of `README.md`
before changing it.

Until 16 August 2026 a second project lived here — **FTS**, the
executable-specification surface (`.fts`) with a TypeScript reference core under
`src/`. It was taken out (tag `fts-pered-udaleniem`, home
`github.com/digitable-lol/fts`). The FTS *surface* is still part of flang: the
parser reads `категория`/`объект`/`утилита` into legacy nodes, and a corpus of
fifty-three models lives as fixtures under `flang/test/fixtures/fts/`. The FTS
*core* is gone, and the language refuses `.fts` files with `FLANG_FTS_REMOVED`.

- Treat canonical JSON and diagnostic codes as compatibility surfaces.
- Keep flang semantics in `flang/src/`; `flang/bin/flang.mjs` is an adapter. Interpreter, emitters and `compat.mjs` must agree — the tests compare them, so a divergence is a failure, not a note.
- `flang/core/*.flang` is checked against a frozen table of answers (`flang/test/fts-oracle.mjs`) taken from the old TypeScript core before it left. That check is a golden comparison now, not a differential one; a missing entry is a failure, never a skip.
- Keep the language deterministic and free of runtime dependencies, filesystem access, and network access.
- Add parser, validation, and pipeline tests for language changes.
- Author only `.flang` source; JSON is the sole interchange form.
- Never hand-edit `CHANGELOG.md` or `changelog.json`: both are printed from tags and commit subjects by `npm run changelog`, and `flang/test/changelog.test.mjs` compares the files with the history. Write the commit subject as a statement of what is now true — that subject *is* the changelog entry. Reprint the journal in the same commit that tags a release.
- Run `npm test` before completing changes — zero failures. A test skipped for a missing native toolchain is not a passing test.
