# Agent integration

FTS supports AI agents through a read-only MCP server and a JSON-first CLI.

## MCP

Build the repository, then configure an MCP client to launch:

```json
{
  "mcpServers": {
    "fts": {
      "command": "node",
      "args": ["/absolute/path/to/fts/dist/src/mcp.js"]
    }
  }
}
```

After npm publication, the command can be `fts-mcp`.

The server implements MCP revision `2025-06-18` over stdio and exposes only deterministic, read-only tools. It never reads paths supplied by a model; `.fts` source and context are passed explicitly as tool arguments.

## Tool selection

- Use `fts_compile` when canonical JSON is the only desired output.
- Use `fts_check` before generating utilities or modifying a document.
- Use `fts_prove` only for a human-readable symbolic derivation.
- Use `fts_certify` to bind a typed derivation to a concrete evidence context.
- Use `fts_verify` before allowing an action that requires a strict proof.
- Use `fts_visualize` when a Mermaid representation helps reasoning or presentation.
- Use `fts_pipeline` when the agent needs all outputs in one call.

## Agent authoring convention

When asking an agent to create FTS:

1. state the intended category and structures;
2. state whether a proposition is symbolic or must be checked against context;
3. require `fts_check` before accepting the result;
4. require `fts_certify` when a proposition exists;
5. require `fts_verify` and status `verified` before a consequential tool call;
6. preserve diagnostic codes when reporting failures.

Example instruction:

```text
Create an FTS document for Task.status, validate it with fts_check, run
fts_certify against the supplied snapshot context, then accept it only after
fts_verify returns verified. Return the source and certificate.
```

## CLI fallback

Agents without MCP support can call the CLI and parse stdout:

```bash
fts pipeline model.fts --context context.json
```

Failures are emitted as JSON on stderr with a non-zero exit code.
