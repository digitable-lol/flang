# Agent guidance

This repository implements the Formal Type Surface language.

- Treat canonical JSON and diagnostic codes as compatibility surfaces.
- Keep language semantics in `src/parser.ts`, `src/validate.ts`, and `src/interpreter.ts`; CLI and MCP are adapters.
- Keep the core deterministic and free of runtime dependencies, filesystem access, and network access.
- Add parser, validation, and pipeline tests for language changes.
- Preserve `.ch.ts` compatibility unless a migration explicitly schedules its removal.
- Run `npm test` before completing changes.
