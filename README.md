# FTS — Formal Type Surface

FTS is a small TypeScript-adjacent language for describing structures, morphisms, propositions, and machine-checkable witnesses. It turns `.fts`, legacy `.ch.ts`, or canonical JSON into one stable JSON model.

The repository is intentionally usable at three levels:

- as a TypeScript library (`compile`, `validate`, `prove`, `visualize`, `pipeline`);
- as a JSON-first CLI (`fts compile`, `fts check`, `fts prove`);
- as a read-only MCP server exposing the same operations to AI agents.

```fts
category ClassicalLogic {
  structure Individual {
    name: string
    isHuman: boolean
    isMortal: boolean
  }

  functor humanImpliesMortal: Human -> Mortal

  proposition compose {
    functors: ["humanImpliesMortal"]
    witness Individual.isHuman {
      selector { name: "Socrates" }
      value true
    }
  }
}
```

## Quick start

Node.js 20 or newer is required.

```bash
npm install
npm test
npm run build

node dist/src/cli.js pipeline examples/socrates.fts --pretty
node dist/src/cli.js prove examples/task-status.ch.ts \
  --context examples/task-status.context.json --pretty
```

The package is marked private while the repository is private. After the public release and package installation the commands are shorter:

```bash
fts check model.fts
fts pipeline model.fts --pretty
fts-mcp
```

Every CLI command writes JSON to stdout. Diagnostics go to stderr and failures return a non-zero exit code, which makes the CLI composable in shell tools, CI, editors, and agent runtimes.

## Library API

```ts
import { compile, pipeline, prove, validate, visualize } from "@digitable/fts"

const document = compile(source)
const checked = validate(document)
const proof = prove(document, context)
const diagrams = visualize(document, proof)
const result = pipeline({ source, context, viz: "all" })
```

The canonical interchange format is documented by [`schema/document.schema.json`](schema/document.schema.json). The package has no runtime dependencies and does no I/O from the library API.

## AI agents

Run `fts-mcp` (or `fts mcp`) as a stdio MCP server. It exposes five read-only tools:

- `fts_compile`
- `fts_check`
- `fts_prove`
- `fts_visualize`
- `fts_pipeline`

Tool results include both `structuredContent` and a JSON text block. See [Agent integration](docs/agents.md) for configuration and conventions.

## Compatibility

FTS is the standalone continuation of the CH/TS implementation originally embedded in `sppr-pow`. Both `.fts` and `.ch.ts` source files are accepted. The canonical name for new files and APIs is **FTS**; `CH` is retained only as a compatibility term.

See [Language reference](docs/language.md), [Architecture](docs/architecture.md), and [CH migration](MIGRATION.md).

## Status

`0.x` is the language-design phase. The canonical JSON shape and diagnostic codes are treated as compatibility surfaces; syntax may grow through documented proposals.

## License

Apache-2.0. See [LICENSE](LICENSE).
