# FTS — Formal Type Surface

FTS is an indentation-based executable specification language. A human-readable `.fts` model can define domain objects, deterministic utilities, executable examples, checked properties, morphisms, and machine-checkable evidence.

The repository is intentionally usable at three levels:

- as a TypeScript library (`compile`, `validate`, `executeUtility`, `testUtilities`, `generateTypeScript`, `certify`, `verify`);
- as a JSON-first CLI (`fts check`, `fts test`, `fts generate`, `fts certify`, `fts verify`);
- as a read-only MCP server exposing the same operations to AI agents.

```fts
категория «Продажи»

  объект Покупка
    сумма является деньгами
    «постоянный клиент» является признаком

  утилита «Рассчитать скидку»
    принимает Покупка
    возвращает деньги
    начинает с 0

    правило «Большая покупка»
      если сумма не меньше 10000
      то добавить 10 процентов от поля сумма

    свойство «Скидка ограничена»
      результат не больше 20 процентов от поля сумма

    пример «Покупка на двадцать тысяч»
      дано сумма равна 20000
      дано «постоянный клиент» равен нет
      ожидается результат равен 2000
```

The primary surface is indentation-based and syllogistic: no structural braces, colons, dots, or arrows. Human-readable names may use regular quotes or Russian guillemets. The legacy braced syntax remains readable for compatibility but is not the recommended authoring form.

## Quick start

Node.js 20 or newer is required.

```bash
npm install
npm test
npm run build

node dist/src/cli.js pipeline examples/real-world/order-shipment.fts --pretty
node dist/src/cli.js certify examples/real-world/order-shipment.fts \
  --context examples/real-world/order-shipment.context.json --pretty
node dist/src/cli.js test examples/utilities/discount.fts --pretty
node dist/src/cli.js generate examples/utilities/discount.fts --out generated
```

The package is marked private while the repository is private. After the public release and package installation the commands are shorter:

```bash
fts check model.fts
fts test model.fts
fts generate model.fts --out generated
fts-mcp
```

Every CLI command writes JSON to stdout. Diagnostics go to stderr and failures return a non-zero exit code, which makes the CLI composable in shell tools, CI, editors, and agent runtimes.

## Library API

```ts
import { compile, executeUtility, generateTypeScript, testUtilities, validate } from "@digitable/fts"

const document = compile(source)
const checked = validate(document)
const tests = testUtilities(document)
const discount = executeUtility(document, "Рассчитать скидку", {
  сумма: 20_000,
  "постоянный клиент": true,
})
const generated = generateTypeScript(document)
```

The canonical interchange format is documented by [`schema/document.schema.json`](schema/document.schema.json). The package has no runtime dependencies and does no I/O from the library API.

Browser applications should import `@digitable/fts/browser`. This entrypoint provides parsing, validation, and visualization without Node.js cryptography; strict certificate decisions stay on the server.

## AI agents

Run `fts-mcp` (or `fts mcp`) as a stdio MCP server. It exposes nine read-only tools, including executable-spec operations:

- `fts_compile`
- `fts_check`
- `fts_test`
- `fts_generate`
- `fts_prove`
- `fts_visualize`
- `fts_certify`
- `fts_verify`
- `fts_pipeline`

Tool results include both `structuredContent` and a JSON text block. See [Agent integration](docs/agents.md) for configuration and conventions.

## One language, one extension

All authored source uses `.fts`. JSON is the canonical interchange form for APIs, storage, generated utilities, and agents. Russian and compatible English keywords normalize into one canonical document rather than separate runtime implementations.

See [Executable utilities](docs/executable-utilities.ru.md), [Language reference](docs/language.md), [Architecture](docs/architecture.md), and [How it works](docs/how-it-works.md).

For runnable Russian examples of form generators, table configuration, and DDD command guards, see [FTS на прикладных примерах](docs/examples.ru.md). For React, Node.js, Python, HTTP, and the practical value proposition, see [Зачем нужен FTS и как его интегрировать](docs/why-and-integration.ru.md).

## Status

`0.x` is the language-design phase. The canonical JSON shape and diagnostic codes are treated as compatibility surfaces; syntax may grow through documented proposals.

## License

Apache-2.0. See [LICENSE](LICENSE).
