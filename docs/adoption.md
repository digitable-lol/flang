# Application adoption

Applications integrate FTS through the canonical JSON model; they do not embed a second parser or a product-specific dialect.

## Boundary

The FTS repository owns:

- `.fts` parsing and canonical JSON generation;
- semantic validation and diagnostic codes;
- deterministic utility execution, example tests, and TypeScript generation;
- proof construction and independent verification;
- Mermaid visualization;
- CLI and MCP interfaces.

An application owns:

- mapping domain data to JSON context;
- domain templates that emit `.fts`;
- authentication, persistence, and HTTP routes;
- decisions about which declared morphisms are trusted assumptions.

## Recommended integration

For Node.js applications, import the package directly:

```ts
import { pipeline } from "@digitable/fts"

const result = pipeline({ source, context, viz: "all" })
```

For an executable specification, run examples before emitting implementation files:

```bash
fts check calculation.fts
fts test calculation.fts
fts generate calculation.fts --out generated
```

For React, Vue, and other browser applications, import `@digitable/fts/browser`. Use it to compile models and generate UI descriptors. Keep `certify`, `verify`, and consequential command authorization on the Node.js server boundary.

For applications in another runtime, invoke the JSON CLI as a subprocess or run a small internal Node service. The request and response boundary remains canonical JSON, so no language semantics are duplicated.

```bash
fts pipeline rule.fts --context snapshot.json
```

For AI systems, configure `fts-mcp`. Agents receive the same compiler, checker, proof engine, and verifier as human-authored utilities.

## Transition rule

During adoption, old HTTP paths may temporarily proxy to the FTS service, but all stored and newly authored source uses `.fts`. Remove embedded parsers after parity tests pass. Do not maintain two grammar implementations.
