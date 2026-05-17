# Engram

Engram is a self-hostable AI memory layer. It sits between an application and an LLM provider, retrieves relevant user memories from pgvector, injects them into chat prompts, forwards the request, and extracts new durable memories after the response returns.

It ships four services:

- `api`: FastAPI proxy and REST API
- `postgres`: PostgreSQL 16 with pgvector
- `mcp`: TypeScript MCP server
- `dashboard`: Next.js developer console

## Quick Start

1. Copy the environment file.

```bash
cp .env.example .env
```

2. Edit `.env`.

```bash
POSTGRES_PASSWORD=replace_with_a_strong_password
EXTRACTION_PROVIDER=openai
OPENAI_API_KEY=your_key_here
MCP_SERVICE_KEY=
```

3. Start the stack.

```bash
docker compose up -d
```

4. Create a user.

```bash
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"external_id": "test_user_1"}'
```

Save the returned `api_key`. It is shown once. Engram stores only a hash.

5. Send the first conversation through the proxy.

```bash
curl -X POST http://localhost:8000/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-Engram-Key: <api_key>" \
  -H "X-Engram-User-ID: test_user_1" \
  -H "X-Engram-Provider: openai" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "I prefer FastAPI for backend development and TypeScript for frontend work."}
    ]
  }'
```

6. Wait a few seconds, then inspect memories.

```bash
curl http://localhost:8000/memories \
  -H "X-Engram-Key: <api_key>"
```

7. Open the dashboard at `http://localhost:3001` and save the same API key in Settings.

## Supabase Postgres

Engram can use Supabase as its PostgreSQL and pgvector database. Local Docker Postgres remains the default for development.

1. Create a Supabase project.

2. In the Supabase dashboard, enable the `vector` extension from Database -> Extensions. Engram stores embeddings in a `vector(384)` column.

3. Copy a Postgres connection string from the Supabase Connect panel. For this Docker API, prefer the Session pooler if your network needs IPv4. The Direct connection is also fine where IPv6 works. Avoid the Transaction pooler unless you set `DATABASE_STATEMENT_CACHE_SIZE=0`.

4. Put the connection string in `.env`.

```bash
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
DATABASE_MIN_POOL_SIZE=1
DATABASE_MAX_POOL_SIZE=5
DATABASE_STATEMENT_CACHE_SIZE=100
```

If you use Supabase Transaction pooler on port `6543`, use:

```bash
DATABASE_STATEMENT_CACHE_SIZE=0
```

5. Apply the Engram schema to Supabase.

```bash
docker compose -f docker-compose.supabase.yml run --rm api python -m api.apply_schema
```

You can also paste `api/db/schema.sql` into the Supabase SQL editor.

6. Start the API, MCP server, and dashboard without local Postgres.

```bash
docker compose -f docker-compose.supabase.yml up -d --build
```

7. Create an Engram user as usual.

```bash
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"external_id": "test_user_1"}'
```

Save the returned `ek_...` API key and use it in the dashboard or API calls.

## Architecture

The hot path is designed to stay simple:

1. Embed the latest user message with `sentence-transformers/all-MiniLM-L6-v2`.
2. Search `memories` with pgvector cosine similarity.
3. Inject the top matches into the system prompt.
4. Forward the request to OpenAI, Gemini, Ollama, or Anthropic.
5. Return the provider response immediately.
6. Start an `asyncio.create_task` extraction job.
7. Extract durable user facts, deduplicate them, and store embeddings.

Retrieval logs record the query, returned memory IDs, scores, and conversation ID so developers can inspect why a memory appeared.

## REST API

All authenticated endpoints use:

```text
X-Engram-Key: ek_...
```

User endpoints:

- `POST /users`
- `GET /users/me`
- `DELETE /users/me`

Memory endpoints:

- `GET /memories`
- `POST /memories`
- `GET /memories/{memory_id}`
- `PATCH /memories/{memory_id}`
- `DELETE /memories/{memory_id}`
- `POST /memories/search`

Retrieval log endpoints:

- `GET /logs`
- `GET /logs/{log_id}`

Proxy endpoint:

- `POST /v1/chat`

The proxy accepts OpenAI-style chat bodies. Engram-specific headers are:

```text
X-Engram-Key: ek_...
X-Engram-User-ID: your_external_user_id
X-Engram-Provider: openai | anthropic | gemini | ollama
X-Engram-Disable-Injection: false
X-Engram-Disable-Extraction: false
```

## MCP

The MCP server exposes:

- `search_memories`
- `add_memory`
- `delete_memory`
- `list_memories`
- `update_memory`
- `get_retrieval_log`

SSE transport runs on `http://localhost:3000/sse`.

For stdio:

```bash
cd mcp
npm run build
node dist/index.js --transport stdio
```

## Development Checks

Backend syntax:

```bash
python -m compileall api
```

MCP build:

```bash
cd mcp
npm ci
npm run build
```

Dashboard build:

```bash
cd dashboard
npm ci
npm run build
```

Docker smoke:

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:8000/health
```

## Local Test Scripts

Embedding retrieval:

```bash
python -m api.test_embedding
```

Extraction:

```bash
python -m api.test_extraction
```

Proxy flow:

```bash
python -m api.test_proxy_flow
```

## Scope

Engram v1 intentionally avoids OAuth, JWT, rate limiting, streaming proxy support, external vector stores, Redis, Celery, LangChain, and LlamaIndex. The focus is the inspectable memory loop: retrieve, inject, forward, extract, deduplicate, store, and expose through REST, MCP, and dashboard surfaces.
