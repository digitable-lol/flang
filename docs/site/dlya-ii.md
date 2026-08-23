# The flang service for an AI assistant

The `flang` binary speaks MCP to an assistant: JSON-RPC over the standard
streams, one message per line. The assistant starts the service, not a human:
started by hand it waits for messages in silence — that is not a hang.

## How to connect it

Add this to the assistant's configuration file:

```json
{"mcpServers": {"flang": {"command": "flang", "args": ["--mcp-mode"], "env": {}}}}
```

Check that the binary answers:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | flang --mcp-mode
```

```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"flang","version":"0.6.0"}}}
```

## Which tools are available

There are two, and `tools/list` names exactly them.

| Tool | Takes | What it answers |
|---|---|---|
| `flang_check` | `source` — the whole program text | parsing, types, proved termination and the proof report — all of it, uncut |
| `flang_prove` | `source` and `claim` — the name from `обеспечивает «name» …` | what carries the proof of that one promise — or the same refusal a human sees |

## What comes back

There is no "ok" field in the answer. There are five verdicts, and none reduces
to another:

| Word in the answer | What it means |
|---|---|
| `доказано` (proved) | the claim holds for all inputs |
| `доказано индукцией по «Т»` (proved by induction) | the same for all values of type «Т» |
| `сетка N` (grid of N) | computed on N of the author's values. This is not a proof |
| `объявлено, не доказано` (stated, not proved) | the claim is written, nothing proves it |
| `НАРУШЕНО` (violated) | already false, and the author's own example found it |

The service ships this glossary in every answer — the assistant does not have to
remember it between calls.

## An exchange

The request is `tools/call` with the tool, the program and the promise name:

```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"flang_prove",
 "arguments":{"source":"…","claim":"скидка не больше 30"}}}
```

The program in `source`:

```flang
модуль «Скидка»

тотальная функция «Скидка»
  принимает разряд: строка
  возвращает число
  обеспечивает «скидка не больше 30» результат не больше 30
  пример «постоянный покупатель»
    дано разряд равно "постоянный"
    ожидается 30
  если разряд равен "постоянный"
    то 30
    иначе 0
```

The answer (the `content` text, after the verdict glossary):

```
постусловие «скидка не больше 30» функции «Скидка» — доказано сведением цели с
телом функции: правило «ограниченность точным потолком по построению»,
объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не
о написанных; теоремы при нём нет и не нужно
```

## When the program does not parse

There is no proof report, and the service says why — "did not parse" is not "not
proved":

```
Программа НЕ ПРОШЛА проверку языка, и ведомость доказательства поэтому не
печатается. Это не «не доказано» — это «не разобрано или не сошлось по типам».

FLANG_PARSE, строка 7, столбец 3: пример «два» требует строку 'ожидается'
```

## When the tool name is wrong

The service neither stays silent nor pretends it understood:

```json
{"jsonrpc":"2.0","id":3,"error":{"code":-32602,"message":"служба flang не знает средства «flang_nonexistent». Их два: flang_check и flang_prove"}}
```

## What the service does not do

It does not stop an assistant from writing something wrong. It takes away the
option of calling the wrong thing right: "this function is correct" is a
sentence, while `доказано` in the answer is the result of a run.

Two questions it cannot answer: "what breaks if I change this" and "do these
requirements agree with each other". Both need a process started from the
service loop, and today's loop carries one effect.

## Next

- [Requirements that are proved](fspec.html) — a rule in the customer's language.
- [What is proved and what is not](what-is-proved.html) — where the line runs.
