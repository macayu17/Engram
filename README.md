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
ENGRAM_SERVICE_KEY=your_server_to_server_key_here
ENGRAM_PROVIDER_KEY_ENCRYPTION_KEY=your_fernet_key_for_per_user_provider_keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
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

## Dashboard Login

The dashboard uses Clerk for sign-in and account management.

1. Create a Clerk application from the Clerk dashboard.

2. Copy the keys into `.env`.

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
ENGRAM_SERVICE_KEY=generate_a_long_random_value
```

`ENGRAM_SERVICE_KEY` must be set to the same value on the `api` service and the `dashboard` service. The dashboard uses it server-side to issue or recover an Engram API key for the signed-in Clerk user without exposing that service key to the browser.

3. Rebuild the API and dashboard if you are running through Docker.

```bash
docker compose up -d --build api dashboard
```

4. Open `http://localhost:3001`, use Create Account in the top nav, and sign up as the first dashboard user.

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
- `POST /users/service-key`
- `GET /users/me`
- `PATCH /users/me`
- `DELETE /users/me`
- `GET /users/me/config`
- `PATCH /users/me/config`
- `GET /users/me/provider`
- `PATCH /users/me/provider`
- `POST /users/me/api-key`

Memory endpoints:

- `GET /memories`
- `POST /memories`
- `POST /memories/capture`
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
X-Engram-Provider-Key: sk-... (optional, ephemeral override for openai/gemini; never persisted)
```

The API service also accepts a service key on internal routes such as `POST /users/service-key`:

```text
X-Engram-Service-Key: esk_...
```

## MCP

The MCP server exposes:

- `search_memories`
- `add_memory`
- `capture_conversation`
- `delete_memory`
- `list_memories`
- `update_memory`
- `get_retrieval_log`

`capture_conversation` lets MCP clients save memory without the user saying "store this". The client sends the user message and assistant response, then Engram runs the same durable-fact extraction and deduplication path used by the proxy.

Suggested MCP client instruction:

```text
Always use Engram memory. Before answering when user context may matter, search Engram for relevant memories. After each meaningful exchange, call capture_conversation with the user message, assistant response, source client name, and session id. Store durable user facts, preferences, project context, and corrections. Do not store greetings, one-off questions, temporary details, or assistant-only claims.
```

SSE transport runs on `http://localhost:3000/sse`.

For stdio:

```bash
cd mcp
npm run build
node dist/index.js --transport stdio
```

## Production Deployment

For a production setup, deploy the services separately:

- `dashboard` on Vercel
- `api` on a container backend
- PostgreSQL on Supabase
- `mcp` on the same backend as the API, or run it locally where your AI client can reach it

When creating the Vercel project, set the project Root Directory to `dashboard`. The repository root is not a Next.js app, so Vercel will fail with `No Next.js version detected` if it builds from the root.

If the build logs mention `Installing required dependencies from api/requirements.txt`, the Vercel project is still pointed at the repository root. Change Settings -> Build and Deployment -> Root Directory to `dashboard`, save, and redeploy the latest `main` commit. The `api/` service contains local embedding dependencies and must not be deployed as Vercel Python functions.

Set these Vercel environment variables for the dashboard:

```bash
NEXT_PUBLIC_API_URL=https://your-api-host.example.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
ENGRAM_SERVICE_KEY=generate_a_long_random_value
```

The API must be reachable from the browser and must allow the dashboard origin through `CORS_ORIGINS`. Set the same `ENGRAM_SERVICE_KEY` on the hosted API so the dashboard can create or recover per-Clerk Engram keys.

For an existing Supabase database, re-apply `api/db/schema.sql` after pulling updates so the `user_api_keys` table exists:

```bash
docker compose -f docker-compose.supabase.yml run --rm api python -m api.apply_schema
```

Supabase replaces only the Postgres service. It does not replace the FastAPI service, because Engram still needs `/users`, `/memories`, `/logs`, and `/v1/chat`. Host `api/` on a container-capable platform such as Azure Container Apps, Render, Railway, Fly.io, or another Docker host. Point its `DATABASE_URL` at Supabase and set provider keys such as `OPENAI_API_KEY`.

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
npm run verify:clerk
npm run verify:logic
npm run build
```

Docker smoke:

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:8000/health
```

Full deterministic flow with the local mock provider:

```bash
python scripts/verify_full_flow.py
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

Engram v1 intentionally avoids API JWT auth, rate limiting, streaming proxy support, external vector stores, Redis, Celery, LangChain, and LlamaIndex. The focus is the inspectable memory loop: retrieve, inject, forward, extract, deduplicate, store, and expose through REST, MCP, and dashboard surfaces. Dashboard sign-in is handled separately through Clerk.
