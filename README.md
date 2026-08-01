# FTS — Formal Type Surface

FTS is a small TypeScript-adjacent language for describing structures, morphisms, propositions, and machine-checkable witnesses. It turns `.fts` or canonical JSON into one stable JSON model.

The repository is intentionally usable at three levels:

- as a TypeScript library (`compile`, `validate`, `certify`, `assertVerified`, `visualize`, `pipeline`);
- as a JSON-first CLI (`fts compile`, `fts check`, `fts certify`, `fts verify`);
- as a read-only MCP server exposing the same operations to AI agents.

```fts
категория «Исполнение заказа» {
  структура Заказ {
    номер: Строка
    «готов к отгрузке»: «Готов к отгрузке»
  }

  функтор «готовность разрешает команду»:
    «Готов к отгрузке» -> «Отгрузить заказ разрешено»

  утверждение применить «готовность разрешает команду» {
    свидетельство Заказ.«готов к отгрузке» {
      значение true
      путь ["заказы", { номер: "ЗК-7781" }, "готов к отгрузке"]
    }
  }
}
```

Human-readable names may use regular quotes or Russian guillemets. Russian keywords are the primary documented surface; compatible English aliases compile into the same canonical model.

## Quick start

Node.js 20 or newer is required.

```bash
npm install
npm test
npm run build

node dist/src/cli.js pipeline examples/real-world/order-shipment.fts --pretty
node dist/src/cli.js certify examples/real-world/order-shipment.fts \
  --context examples/real-world/order-shipment.context.json --pretty
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

Browser applications should import `@digitable/fts/browser`. This entrypoint provides parsing, validation, and visualization without Node.js cryptography; strict certificate decisions stay on the server.

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

All authored source uses `.fts`. JSON is the canonical interchange form for APIs, storage, generated utilities, and agents. Russian and compatible English keywords normalize into one canonical document rather than separate runtime implementations.

See [Language reference](docs/language.md), [Architecture](docs/architecture.md), [How it works](docs/how-it-works.md), and [Application adoption](docs/adoption.md).

For runnable Russian examples of form generators, table configuration, and DDD command guards, see [FTS на прикладных примерах](docs/examples.ru.md). For React, Node.js, Python, HTTP, and the practical value proposition, see [Зачем нужен FTS и как его интегрировать](docs/why-and-integration.ru.md).

## Status

`0.x` is the language-design phase. The canonical JSON shape and diagnostic codes are treated as compatibility surfaces; syntax may grow through documented proposals.

## License

Apache-2.0. See [LICENSE](LICENSE).
