# Agent guidance

This repository implements the Formal Type Surface language.

- Treat canonical JSON and diagnostic codes as compatibility surfaces.
- Keep language semantics in `src/parser.ts`, `src/validate.ts`, and `src/interpreter.ts`; CLI and MCP are adapters.
- Keep the core deterministic and free of runtime dependencies, filesystem access, and network access.
- Add parser, validation, and pipeline tests for language changes.
- Author and emit only `.fts` source; JSON is the sole interchange form.
- Keep the tools in `tools/` (`ftsc`, `ftsvm`, `ftspec`) outside the core: they are ES modules that consume `dist/src` and are allowed the filesystem access the library is not.
- Run `npm test` before completing changes.
