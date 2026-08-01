# Architecture

FTS has one implementation and several thin interfaces.

```text
source / canonical JSON
          |
        compile
          |
     FtsDocument ---- validate
          |               |
        certify       diagnostics
          |
 FtsProofCertificate ---- verify
          |
      visualize
          |
  Mermaid / pipeline result

Library API ─┬─ browser entry (React/Vue, no Node crypto)
             ├─ Node.js API (certify/verify)
             ├─ CLI / HTTP sidecar (cross-language JSON)
             └─ MCP stdio (structuredContent)
```

## Modules

- `parser.ts` owns `.fts` tokenization, parsing, and canonical JSON normalization.
- `validate.ts` owns semantic constraints and stable JSON-path diagnostics.
- `certificate.ts` constructs deterministic typed certificates and independently verifies them.
- `interpreter.ts` provides human-readable derivations and resolves generic JSON paths.
- `visualize.ts` renders category, functor, and proof diagrams as Mermaid.
- `pipeline.ts` composes the public operations without hidden I/O.
- `cli.ts` and `mcp.ts` adapt the same API; neither contains language semantics.
- `browser.ts` exports parsing, validation, proof explanation, and visualization without the Node.js certificate implementation.

## Design constraints

- Canonical JSON is the interoperability boundary.
- The core package has no runtime dependencies, filesystem access, or network access.
- Compilation never injects application-specific structures.
- Context verification is generic. Products may build adapters that construct context JSON, but product schemas do not belong in core.
- CLI and MCP outputs are structured and deterministic so utilities and agents can safely compose them.
- New syntax must first define its canonical JSON representation and validation rules.
- Certificate production and action authorization belong on a trusted server boundary, not in the browser.

## Extension path

Utilities should consume `FtsDocument` rather than parser internals. A formatter, LSP, code generator, optimizer, graph analyzer, or IDE can therefore share the same model and diagnostic codes.

Application integrations should live in separate packages. For example, an application adapter may map a domain snapshot to context JSON and provide templates while importing the FTS compiler and verifier from this package.
