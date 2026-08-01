# Architecture

FTS has one implementation and several thin interfaces.

```text
source / canonical JSON
          |
        compile
          |
     FtsDocument ---- validate
          |               |
        prove         diagnostics
          |
     FtsProof
          |
      visualize
          |
  Mermaid / pipeline result

Library API ─┬─ CLI (JSON stdout/stderr)
             └─ MCP stdio (structuredContent)
```

## Modules

- `parser.ts` owns tokenization, parsing, legacy syntax, and JSON normalization.
- `validate.ts` owns semantic constraints and stable JSON-path diagnostics.
- `interpreter.ts` evaluates propositions and verifies generic JSON paths.
- `visualize.ts` renders category, functor, and proof diagrams as Mermaid.
- `pipeline.ts` composes the public operations without hidden I/O.
- `cli.ts` and `mcp.ts` adapt the same API; neither contains language semantics.

## Design constraints

- Canonical JSON is the interoperability boundary.
- The core package has no runtime dependencies, filesystem access, or network access.
- Compilation never injects application-specific structures.
- Context verification is generic. Products may build adapters that construct context JSON, but product schemas do not belong in core.
- CLI and MCP outputs are structured and deterministic so utilities and agents can safely compose them.
- New syntax must first define its canonical JSON representation and validation rules.

## Extension path

Utilities should consume `FtsDocument` rather than parser internals. A formatter, LSP, code generator, optimizer, graph analyzer, or IDE can therefore share the same model and diagnostic codes.

Application integrations should live in separate packages. For example, an SPPR adapter may map an iteration snapshot to context JSON and provide domain templates while importing the FTS compiler and prover from this package.
