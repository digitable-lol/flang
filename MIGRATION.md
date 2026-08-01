# Migrating from embedded CH/TS

FTS supersedes the CH/TS implementation embedded in `sppr-pow`.

## Naming

- New source files use `.fts`.
- `.ch.ts` remains accepted for compatibility.
- New APIs, package names, commands, and documentation use `FTS`.
- Canonical JSON keeps the existing keys: `category`, `structures`, `functors`, `proposition`, and `ts_compat`.

## Compatibility map

| Embedded CH | Standalone FTS |
| --- | --- |
| `SpprPow.CH.Compiler.compile/1` | `compile(source)` or `fts compile` |
| `SpprPow.CH.Document.validate/1` | `validate(document)` / `assertValid(document)` |
| `SpprPow.CH.Interpreter.prove/2` | `prove(document, context)` |
| `SpprPow.CH.Viz.build/3` | `visualize(document, proof, mode)` |
| `SpprPow.CH.Pipeline.run/1` | `pipeline(input)` |
| browser `window.SpprCH` | package imports or an application-owned browser adapter |
| Phoenix `/api/v1/ch/*` | application route wrapping FTS, preferably `/api/v1/fts/*` |

## Intentional changes

The old Elixir and browser parsers disagreed on `compose` syntax and nested propositions. FTS accepts both existing forms and emits one canonical representation.

The old witness evaluator knew about SPPR `tasks_blob`. FTS resolves generic JSON paths. An SPPR integration should pass the intended root object explicitly, for example `{ "tasks": [...] }`, or retain `tasks_blob` in the path and pass a context with that property.

The embedded standard library injected SPPR snapshot structures during proof evaluation. Standalone FTS keeps only domain-neutral functors. Snapshot structures and templates belong in an SPPR adapter package.

## Recommended application migration

1. Add `@digitable/fts` to the application/tooling workspace.
2. Move SPPR templates and snapshot-to-context mapping into an application adapter.
3. Add `/api/v1/fts/compile` and `/api/v1/fts/eval` wrappers if an HTTP API is still required.
4. Keep `/api/v1/ch/*` as deprecated aliases for one compatibility window.
5. Replace browser parser/viz copies with imports from this package.
6. Remove embedded CH modules after parity tests pass.
