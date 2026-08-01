# FTS — Formal Type Surface

FTS is a small TypeScript-adjacent language for describing structures, morphisms, propositions, and machine-checkable witnesses. It turns `.fts` or canonical JSON into one stable JSON model.

The repository is intentionally usable at three levels:

- as a TypeScript library (`compile`, `validate`, `certify`, `assertVerified`, `visualize`, `pipeline`);
- as a JSON-first CLI (`fts compile`, `fts check`, `fts certify`, `fts verify`);
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
node dist/src/cli.js certify examples/task-status.fts \
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
import { assertVerified, certify, compile, pipeline, validate, visualize } from "@digitable/fts"

const document = compile(source)
const checked = validate(document)
const certificate = certify(document, context)
const verification = assertVerified(document, certificate, context)
const diagrams = visualize(document)
const result = pipeline({ source, context, viz: "all" })
```

The canonical interchange format is documented by [`schema/document.schema.json`](schema/document.schema.json). The package has no runtime dependencies and does no I/O from the library API.

## AI agents

Run `fts-mcp` (or `fts mcp`) as a stdio MCP server. It exposes seven read-only tools:

- `fts_compile`
- `fts_check`
- `fts_prove`
- `fts_visualize`
- `fts_certify`
- `fts_verify`
- `fts_pipeline`

Tool results include both `structuredContent` and a JSON text block. See [Agent integration](docs/agents.md) for configuration and conventions.

## One language, one extension

All authored source uses `.fts`. JSON is the canonical interchange form for APIs, storage, generated utilities, and agents. There is no second source dialect or alternate language name.

See [Language reference](docs/language.md), [Architecture](docs/architecture.md), [How it works](docs/how-it-works.md), and [Application adoption](docs/adoption.md).

For runnable Russian examples of form generators, table configuration, and DDD command guards, see [FTS на прикладных примерах](docs/examples.ru.md).

## Status

`0.x` is the language-design phase. The canonical JSON shape and diagnostic codes are treated as compatibility surfaces; syntax may grow through documented proposals.

## License

Apache-2.0. See [LICENSE](LICENSE).
