[Back to README](../../README.md) · [Documentation index](../README.md)

# Access for an AI assistant: `flang --mcp-mode`

Through this service an AI assistant checks flang programs, and a person reads the
answers and need not know the language.

This page explains why the service is built the way it is. What it answers to
each message — verbatim, with the command that produces each answer — is on
["The service for an AI assistant"](../site/ai-assistant.md); the two pages divide the
work rather than repeat each other.

## How to wire it up

```json
{
  "mcpServers": {
    "flang-validator": {
      "command": "flang",
      "args": ["--mcp-mode"],
      "env": {}
    }
  }
}
```

## The main rule of the answer: no yes/no is handed out

The whole value of the language is that it tells three different things apart:

| word | what it means |
|---|---|
| `доказано` — proven | about all inputs, derived from the declarations and the structure |
| `сетка N` — grid N | computed on N of the author's own values. **This is not a proof** |
| `объявлено, не доказано` — stated, not proven | the claim is written down and nothing backs it |

An assistant that gets a single "yes" will tell the human "checked" even for a
program tested only on examples. So the proof report goes out **whole, in the kernel's own words**, together
with a glossary of those words, and **no answer carries an "ok" field**.

The glossary comes in every answer, not once at the handshake: the assistant saw
the tool description once, and `сетка 9` without the glossary reads to it as
"checked".

## What the service can do today

| tool | what it does |
|---|---|
| `flang_check` | check a program: parsing, types, proven termination, and the proof report in full |
| `flang_prove` | what backs one named postcondition — or the same refusal a human would see |

**What is missing today.** Two of the four intended questions go unanswered: "what breaks if I change this" (running the
checks) and "do the requirements agree with each other" (`fspec/guard.flang`).
Both need a process spawned from the service loop, and today's loop can do exactly
one effect — assemble a proof report for the text it was sent.

## Where the boundary runs

Exactly the same one as for the language server:

| where | what |
|---|---|
| `flang/self/mcp.flang` (266 lines of flang) | what a message is, what to answer, and in which words |
| `flang/src/emit/c/flang_repl.c` | everything that is not a decision: reading lines, parsing JSON, reading imported files, and running the check itself |

Let that boundary slip and what the assistant learns about a program would depend
on the language the transport is written in, rather than on the language the
question is about.

**There is no `Content-Length` framing here.** MCP over standard streams is
JSON-RPC line by line, one message per line. With the framing from LSP the service
would speak a different protocol, and an MCP client would not understand it.

**The REPL runner already in the binary would not do.** It reads standard input
in full and only then answers line by line; an MCP client holds the pipe open and
waits for an answer to its very first request. On the runner the handshake would
therefore never complete. The difference is not in the shape of the messages but
in who waits for whom.

**The request id** comes back character for character as it arrived: over
JSON-RPC it is sometimes a number and sometimes a string, and parsing it into a
number would lose the string ones.

## What this will not do

The model will not stop writing wrong code. What changes is something else: **an
error becomes visible**, because the service has no "ok" answer, and the three
results come separately.
