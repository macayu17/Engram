# engramd

MCP server for [Engram](https://engram.ayushh.in), a self-hostable AI memory layer. Exposes memory search, add, update, delete, list, retrieval logs, and conversation capture as MCP tools.

Source: [github.com/macayu17/Engram](https://github.com/macayu17/Engram)

## Install

```bash
npm install -g engramd
# or
bun add -g engramd
# or run directly
npx engramd
bunx engramd
```

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `ENGRAM_API_KEY` | Yes | — | Your Engram API key (`ek_...`) |
| `ENGRAM_API_URL` | No | hosted Engram API | Base URL of your Engram API |
| `MCP_TRANSPORT` | No | `stdio` | `stdio`, `http`, or `sse` |
| `MCP_PORT` | No | `3000` | Port for http/sse transports |

Transport can also be set with `--transport stdio|http|sse`. In http/sse mode one server serves Streamable HTTP at `POST /mcp`, legacy SSE at `GET /sse`, and a health check at `GET /health`.

`engramd --version` and `engramd --help` do what you expect.

## Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "engramd"],
      "env": {
        "ENGRAM_API_KEY": "ek_your_key_here"
      }
    }
  }
}
```

Or with Claude Code:

```bash
claude mcp add engram -e ENGRAM_API_KEY=ek_your_key_here -- npx -y engramd
```

## Tools

- `search_memories` — semantic search over stored memories
- `add_memory` — store a fact or preference
- `capture_conversation` — submit an exchange for automatic memory extraction
- `list_memories` — paginated listing
- `update_memory` — edit a memory by ID
- `delete_memory` — remove a memory by ID
- `get_retrieval_log` — inspect what was retrieved and why

## License

MIT
