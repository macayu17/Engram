# Contributing

Engram is built around a narrow v1 scope. Keep changes aligned with the memory loop: retrieve, inject, forward, extract, deduplicate, store, and inspect.

## Local Setup

```bash
cp .env.example .env
docker compose up -d --build
```

Create a user through `POST /users`, save the returned API key, and use that key for REST, dashboard, and MCP checks.

## Rules

- Keep API database operations in service files or database helpers.
- Use asyncpg directly. Do not add SQLAlchemy, Alembic, or another ORM.
- Keep provider calls on `httpx.AsyncClient`.
- Keep API keys and provider secrets in environment variables.
- Store API key hashes, never plaintext API keys.
- Keep dashboard API calls inside `dashboard/src/lib/api.ts`.
- Keep the dashboard on Tailwind utilities.
- Do not add external vector databases, Redis, Celery, LangChain, or LlamaIndex for v1.

## Verification

Run the smallest relevant check for your change and include the output in your handoff.

```bash
python -m compileall api
cd mcp && npm run build
cd dashboard && npm run build
docker compose up -d --build
```

For full behavior, verify:

1. User creation returns an API key.
2. First proxy call returns the provider response.
3. Extraction creates memories after the response.
4. Second proxy call injects prior memories.
5. Logs show retrieved memory IDs and scores.
6. Dashboard lists memories and logs.
7. MCP tools can list and search memories.
