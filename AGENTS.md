# Agent guidance

This repository holds two languages: **FTS**, the executable-specification
surface (`.fts`, reference implementation in TypeScript under `src/`), and
**flang**, the full language over it (`.flang`, implementation in `flang/src/`).
Read the "How FTS and flang relate" section of `README.md` before changing either.

- Treat canonical JSON and diagnostic codes as compatibility surfaces.
- Keep FTS semantics in `src/parser.ts`, `src/validate.ts`, and `src/interpreter.ts`; CLI and MCP are adapters.
- Keep flang semantics in `flang/src/`; `flang/bin/flang.mjs` is an adapter. Interpreter, emitters and `compat.mjs` must agree — the tests compare them, so a divergence is a failure, not a note.
- The TypeScript core is the reference for `flang/core/`, not the other way round. A deliberate divergence goes into the debt list of `flang/core/SPEC.md`, never in silence.
- Keep both cores deterministic and free of runtime dependencies, filesystem access, and network access.
- Add parser, validation, and pipeline tests for language changes.
- Author only `.fts` and `.flang` source; JSON is the sole interchange form.
- Keep the tools in `tools/` outside the core: they are ES modules that consume `dist/src` and are allowed the filesystem access the library is not.
- Run `npm test` before completing changes — all three suites, zero failures. A test skipped for a missing native toolchain is not a passing test.
