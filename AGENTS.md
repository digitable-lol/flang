# Agent guidance

This repository holds one language: **flang** (`.flang`, implementation in
`flang/src/`). Read the "What kind of language this is" section of `README.md`
before changing it.

The parser also reads an older surface — `категория`/`объект`/`утилита` — into
legacy nodes, and a corpus of fifty-three `.fts` models lives as fixtures under
`flang/test/fixtures/fts/`. Those fixtures are the only workload that exercises
`flang/core/*.flang`, the largest programs in the tree. The language does not
accept `.fts` as input: it refuses with `FLANG_FTS_REMOVED`.

**Do not write the older project's name into prose meant for a reader.** README,
the man page, the guide, the site and the course are about the language, not
about where it came from. Keeping a path or a file name that really exists is
fine; telling the history is not.

- Treat canonical JSON and diagnostic codes as compatibility surfaces.
- Keep flang semantics in `flang/src/`; `flang/bin/flang.mjs` is an adapter. Interpreter, emitters and `compat.mjs` must agree — the tests compare them, so a divergence is a failure, not a note.
- `flang/core/*.flang` is checked against a frozen table of answers (`flang/test/fts-oracle.mjs`). That check is a golden comparison, not a differential one; a missing entry is a failure, never a skip. How to re-record the table is written in that file's header.
- Keep the language deterministic and free of runtime dependencies, filesystem access, and network access.
- Add parser, validation, and pipeline tests for language changes.
- Author only `.flang` source; JSON is the sole interchange form.
- Never hand-edit `CHANGELOG.md` or `changelog.json`: both are printed from tags and commit subjects by `npm run changelog`, and `flang/test/changelog.test.mjs` compares the files with the history. Write the commit subject as a statement of what is now true — that subject *is* the changelog entry. Reprint the journal in the same commit that tags a release.
- Run `npm test` before completing changes — zero failures. A test skipped for a missing native toolchain is not a passing test.
