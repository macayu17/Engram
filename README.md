# Engram

[![CI](https://github.com/macayu17/Engram/actions/workflows/ci.yml/badge.svg)](https://github.com/macayu17/Engram/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/engramd)](https://www.npmjs.com/package/engramd)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Engram is a self-hostable AI memory layer. It sits between an application and an LLM provider, retrieves relevant user memories from pgvector, injects them into chat prompts, forwards the request, and extracts new durable memories after the response returns.

Website: [engram.ayushh.in](https://engram.ayushh.in) · MCP server on npm: [`engramd`](https://www.npmjs.com/package/engramd)

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
ENGRAM_SERVICE_KEY=
ENGRAM_PROVIDER_KEY_ENCRYPTION_KEY=your_fernet_key_for_per_user_provider_keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

For this self-hosted quick start, leave `ENGRAM_SERVICE_KEY` and the Clerk keys empty. A service key enables hosted provisioning and disables public user creation. Configure Clerk and the matching service key using Dashboard Login below when you want hosted accounts. Stripe is optional; leave its variables empty unless you want workspace subscriptions.

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

6. Wait a few seconds, then inspect newly extracted memories in the review queue.

```bash
curl 'http://localhost:8000/memories?status=pending' \
  -H "X-Engram-Key: <api_key>"
```

7. Approve a memory before expecting the proxy to retrieve it. Replace `<memory_id>` with an ID from the pending list.

```bash
curl -X PATCH http://localhost:8000/memories/<memory_id> \
  -H "Content-Type: application/json" \
  -H "X-Engram-Key: <api_key>" \
  -d '{"status": "approved"}'
```

8. Open the dashboard at `http://localhost:3001` and save the same API key in Settings. A later chat can now retrieve the approved memory. Manually created memories are approved by default. Extraction proposes changes to existing memories as revisions. Accept a revision to replace the fact; earlier versions remain available to restore.

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

## Hosted SaaS Billing

Hosted mode uses Clerk identities, workspace-scoped API keys, Stripe subscriptions, and per-workspace quotas. Provider calls remain bring-your-own-key: each workspace saves its own OpenAI, Anthropic, or Gemini key in Settings. Engram encrypts that key before storing it and does not fall back to a server-funded provider key in hosted mode.

The launch limits are:

| Plan | Members | Stored memories | Monthly retrievals |
| --- | ---: | ---: | ---: |
| Free | 1 | 2,000 | 10,000 |
| Pro | 5 | 50,000 | 250,000 |

To enable paid upgrades, create one recurring Pro price in Stripe and set:

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
DASHBOARD_URL=https://your-dashboard.example.com
```

Register the API endpoint `https://your-api.example.com/billing/webhook` in Stripe for these events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

The dashboard opens Stripe Checkout for Free workspaces and the Stripe Customer Portal for existing Pro workspaces. Leaving the Stripe variables empty disables upgrade actions at the API without creating charges or external infrastructure.

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

The schema command applies `api/db/schema.sql`, `api/db/product.sql`, and `api/db/oauth.sql` in order. If using the SQL editor, apply all three in that order. API startup also applies these idempotent updates.

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

1. Build a query from up to six recent user messages and embed it with `BAAI/bge-small-en-v1.5`. Retrieval uses the actual request text, without fixture-specific keyword expansion.
2. Search approved memories within the authenticated user, workspace, and namespace using pgvector cosine similarity.
3. Inject the top matches into the system prompt.
4. Forward the request to OpenAI, Gemini, Ollama, or Anthropic.
5. Return the provider response immediately.
6. Persist the extraction payload in PostgreSQL and schedule an `asyncio.create_task` job.
7. Extract durable user facts, reconcile and deduplicate them, and store new memories as pending review.

Retrieval logs record the query, memory snapshots, ranking scores, project, actual injected count, and conversation ID. Editing a memory preserves the earlier trace; deleting or moving it redacts its saved text. Project-only OAuth readers cannot read personal memory snapshots.

Retrieval ranking blends cosine similarity with pinning, a recency boost (exponential decay, `RETRIEVAL_RECENCY_HALF_LIFE_DAYS`, default 30), and a usage boost from `access_count`. The similarity threshold applies before those boosts, except that pinned memories bypass it. Weights are tunable via `RETRIEVAL_RECENCY_WEIGHT` and `RETRIEVAL_ACCESS_WEIGHT`. Optional hybrid retrieval combines vector and full-text search; graph retrieval can add memories linked by entities. The graph and reranker models are disabled by default.

Extraction reconciles new facts against existing memories before storing them. When a new fact lands near an existing memory (cosine between `RECONCILE_THRESHOLD`, default 0.6, and the refinement threshold), one extra LLM call decides per fact: add it, propose a revision to the memory it supersedes or contradicts, or discard it as redundant. Proposed revisions require approval and reject stale acceptance if the original fact changed. Any failure falls back to storing all facts. Disable with `ENABLE_RECONCILIATION=false`.

Both proxy extraction and explicit conversation capture use the same processing pipeline. Database connections are released before extraction and reconciliation provider calls. Retrieval and retrieval logging use separate transactions, so a failed SQL statement does not prevent the proxy from resolving its provider. A logging failure keeps successfully retrieved memories and their injected count.

Background extraction uses PostgreSQL jobs with bounded retries, leases and an asyncio recovery worker. Interrupted recoverable jobs resume after restart; Connections shows status and lets you retry failures. Per-request provider override keys are never persisted, so captures requiring those temporary keys cannot recover after interruption and must be sent again. Clearing raw captures removes retry and source inspection data while keeping memories and status. During a database outage, regular proxy requests can attempt forwarding with recently cached authentication; this fallback cannot load workspace provider keys and is limited to self-hosted server-key configurations. Streaming requests require the database. Authentication, quota, configuration, and upstream-provider errors can still reject requests.

## Memory review and projects

The product dashboard separates pending, approved and rejected memories, supports bulk review, and compares proposed revisions against the approved fact. History records manual edits and accepted changes; restoring a version creates another history entry. The Overview shows operational status, and Playground shows the actual retrieval event with per-fact relevance feedback.

Use the project selector to isolate work. API memory creation, capture and search accept `namespace`; proxy calls accept `X-Engram-Namespace` or `namespace` in the JSON body. Names start with a letter or digit and contain up to 80 letters, digits, periods, underscores or hyphens. Existing data stays in `default`. `personal` is a separate scope: retrieval includes it only with explicit `include_personal: true` on an API-key request. Expired memories stay inspectable but are excluded from retrieval and deduplication.

Review endpoints include `POST /memories/review/bulk`, `GET /memories/revisions`, `POST /memories/revisions/{id}/accept` or `/reject`, `GET /memories/{id}/history`, `POST /memories/{id}/restore`, and `POST /memories/{id}/feedback`. Connections provides `GET /connections/status`, `POST /connections/jobs/{id}/retry`, and `DELETE /connections/captures?older_than_days=30&namespace=default`.

## Claude and Codex connections

[Local plugin setup, marketplace catalogs and remote templates](plugins/README.md) live in `plugins/`. These are unpublished checkout-based packages with recall, deliberate capture, review and project-handoff skills. They do not intercept host conversations automatically. Connections generates local MCP configuration with a key placeholder unless you explicitly reveal it.

Remote MCP supports OAuth authorization codes with S256 PKCE, dynamic client registration, hashed opaque tokens, refresh rotation and revocation. Every HTTP request authenticates independently; HTTP never inherits the process's stdio API key. Consent grants `memory:read` and/or `memory:write` for one project. OAuth cannot include personal memories, change project, or manage API keys. Revoke assistants from Connections.

Set `API_PUBLIC_URL` to your externally reachable API origin, `MCP_PUBLIC_URL` to the full public MCP URL ending in `/mcp`, and `DASHBOARD_URL` to your dashboard origin. In the MCP process, `ENGRAM_API_URL` is the internal API address and `ENGRAM_AUTH_URL` is the public authorization-server origin. Use HTTPS for public deployment. Configure `CORS_ORIGINS` for your exact dashboard origin. Local loopback HTTP is supported for development.

Public listing still requires your deployed service, support and privacy URLs, host testing, and submission through the official directory. The included submission worksheet does not deploy or publish Engram.

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
- `DELETE /memories` (bulk delete all memories for the authenticated user)
- `DELETE /memories/{memory_id}`
- `POST /memories/search`

Retrieval log endpoints:

- `GET /logs`
- `GET /logs/{log_id}`

Proxy endpoints:

- `POST /v1/chat`
- `POST /v1/chat/completions` (OpenAI-compatible)

The OpenAI-compatible route lets existing OpenAI SDKs use Engram by changing only the base URL — the Engram key goes in the standard `Authorization` header:

```python
from openai import OpenAI

client = OpenAI(base_url="https://your-engram-host", api_key="ek_...")
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What stack should I use?"}],
)
```

Streaming (`stream: true`) works on both routes. Memory extraction runs after the stream completes.

The proxy accepts OpenAI-style chat bodies. Engram-specific headers are:

```text
X-Engram-Key: ek_...
X-Engram-User-ID: your_external_user_id
X-Engram-Provider: openai | anthropic | gemini | ollama
X-Engram-Disable-Injection: false
X-Engram-Disable-Extraction: false
X-Engram-Provider-Key: sk-... (optional, ephemeral override for openai/anthropic/gemini; never persisted)
X-Engram-Namespace: default (optional, scopes proxy retrieval and extraction)
```

The API service also accepts a service key on internal routes such as `POST /users/service-key`:

```text
X-Engram-Service-Key: esk_...
```

Engram headers and incoming provider credentials are removed before forwarding. Provider authentication is rebuilt from the resolved provider key.

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

The MCP server is published on npm as [`engramd`](https://www.npmjs.com/package/engramd). To connect an MCP client to a running Engram API:

```bash
claude mcp add engram -e ENGRAM_API_KEY=ek_your_key -- npx -y engramd
```

Or in a Claude Desktop / MCP client config:

```json
{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["-y", "engramd"],
      "env": { "ENGRAM_API_KEY": "ek_your_key" }
    }
  }
}
```

Transports: stdio is the default. `--transport http` (or `MCP_TRANSPORT=http`) starts an HTTP server on `MCP_PORT` (default 3000) serving Streamable HTTP at `/mcp`, legacy SSE at `/sse`, and a health check at `/health`. The Docker service runs in this mode. Set `ENGRAM_API_URL` to point the server at your own API instead of the hosted one.

To run from source:

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

For an existing Supabase database, apply all current schema updates after pulling changes:

```bash
docker compose -f docker-compose.supabase.yml run --rm api python -m api.apply_schema
```

Supabase replaces only the Postgres service. It does not replace the FastAPI service, because Engram still needs `/users`, `/memories`, `/logs`, and `/v1/chat`. Host `api/` on a container-capable platform such as Azure Container Apps, Render, Railway, Fly.io, or another Docker host. Point its `DATABASE_URL` at Supabase. In hosted mode, paid-provider calls require a workspace key saved in Settings or `X-Engram-Provider-Key`; server provider keys are used only for self-hosted mode.

## Development Checks

Backend tests and syntax (Python 3.11 with `api/requirements-dev.txt` installed):

```bash
python -m pytest api
python -m compileall api
```

Database integration tests run when `ENGRAM_TEST_DATABASE_URL` points to a disposable PostgreSQL database with pgvector. Set `DATABASE_URL` to the same database and run `python -m api.apply_schema` first. Tests create temporary fixtures; use a test database rather than production. GitHub CI starts pgvector and applies the schema before running the suite, so these tests do not silently skip there.

MCP build:

```bash
cd mcp
npm ci
npm run build
npm run verify:auth
npm run verify:defaults
npm run verify:plugins
```

Dashboard build:

```bash
cd dashboard
npm ci
npm run verify:clerk
npm run verify:logic
npm run verify:conflicts
npm run verify:billing
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

Workspace isolation with local Compose services and a configured service key:

```bash
ENGRAM_SERVICE_KEY=local_test_service_key python scripts/verify_workspace_isolation.py
```

This verifier creates and deletes temporary local users. Do not point `ENGRAM_API_URL` at a hosted environment.

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

The core remains the inspectable memory loop: retrieve, inject, forward, extract, deduplicate, store, and review through REST, MCP, and dashboard surfaces. The repository also implements streaming, workspace membership, optional Stripe billing, graph retrieval, and manual confidence decay. Workspace membership does not make every member's memories available to other members: memory queries remain scoped by both user and workspace.

Engram avoids API JWT auth, rate limiting, external vector stores, Redis, Celery, LangChain, and LlamaIndex. Dashboard sign-in is handled separately through Clerk. The original v1 guide in `AGENTS.md` describes the initial implementation scope; the current runtime includes the extensions above.
