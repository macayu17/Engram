# AGENTS.md — Engram

Guide for any coding agent (Claude Code, Codex, Cursor, …) working in this repository. Read it before changing code. `docs/intent-and-goals.md` is the product intent; this file is how to work in the code.

## What Engram is

A self-hostable memory layer for LLM apps. It retrieves approved memories for a user, injects them into the prompt, forwards the request to a provider, and extracts new facts in the background for human review.

One memory backend, three interfaces:

1. **Proxy** — `POST /v1/chat` and OpenAI-compatible `POST /v1/chat/completions` (streaming supported).
2. **REST API** — memories, review, revisions, logs, users, orgs, OAuth.
3. **MCP server** — seven tools over stdio or authenticated HTTP.

Services: `postgres` (PostgreSQL 16 + pgvector), `api` (FastAPI), `mcp` (TypeScript), `dashboard` (Next.js).

## Repository layout

```
api/                 FastAPI service
  main.py            app, routers, lifespan (pool, embedding model, job worker)
  config.py          pydantic-settings; the only place env vars are read
  dependencies.py    DB connection + auth dependencies
  db/                connection pool, schema.sql (+ product.sql, oauth.sql), schema apply
  routes/            HTTP layer only — no SQL here
  services/          all logic and SQL: proxy, retrieval, extraction, jobs, revisions,
                     memories, revisions, entitlements, oauth, scopes, security, providers/
  models/            pydantic v2 request/response models
  eval/              retrieval evaluation harness + golden set
  test_*.py          pytest suite (DB tests need ENGRAM_TEST_DATABASE_URL)
mcp/src/             MCP server: index.ts, auth.ts, client.ts, tools/*
dashboard/src/       Next.js App Router console + public landing page
  app/               routes: / (landing), about, docs, overview, review, memories, chat, connections,
                     logs, settings, api/* (server bridges)
  components/        UI components
  lib/api.ts         the only place the dashboard calls the Engram API
plugins/             Claude and Codex plugin packages (MCP config + skills)
scripts/             end-to-end and contract verifiers
docs/                intent, plans, specs
```

## Coding rules

### Everywhere

- No comments in code; names carry the meaning. No `TODO` / `FIXME` / `HACK` / `NOTE`.
- Full descriptive names; single letters only in tight loops and comprehensions.
- No debug `print()` / `console.log()`; use the logger.
- Secrets only from environment variables, read through `api/config.py` (API) or `mcp/src/config.ts` (MCP).
- Delete dead code instead of leaving it; prefer the smallest change that fixes the root cause.

### Python (`api/`)

- Python 3.11+. Every route handler and service function is `async`.
- `asyncpg` only — no ORM, no SQLAlchemy, no Alembic. SQL lives in `services/` or `db/`, never in routes.
- Cast embeddings explicitly: `$1::vector`.
- `httpx.AsyncClient` for outbound HTTP. Raise `HTTPException` for client-facing errors.
- Type hints on every parameter and return value. Imports: stdlib → third-party → local.
- API keys are stored hashed; provider keys are Fernet-encrypted with `ENGRAM_PROVIDER_KEY_ENCRYPTION_KEY`.

### TypeScript (`mcp/`)

- Strict mode, ESM, `zod` for every tool input, no `any`.
- Tool handlers return MCP error results (`isError: true`); they never throw.

### Dashboard (`dashboard/`)

- Next.js App Router, TypeScript only, Tailwind utilities only (no CSS modules or CSS-in-JS). Inline `style` is allowed only for geometry computed at runtime (positions, widths, fitted font sizes) that no utility class can express.
- All API calls go through `src/lib/api.ts`. The browser API key lives in `localStorage` under `engram_api_key`.
- Design tokens follow the Engram design system's `tokens.json`: OKLCH triplets in `src/app/globals.css` (`--color-paper`, `card`, `ink`, `ink-muted`, `line`, `hot`, `hot-ink`, `hot-fill`, `on-hot`, `button`, `tint`, `scene-*`, …) exposed as Tailwind colors. Riso is the default; `data-theme="cobalt"` on `<html>` switches, saved as `engram_theme`. The older names (`panel`, `muted`, `tag`, `signal`, `high`, `fault`) alias the new tokens for screens not yet rebuilt. Use tokens, never raw hex; canvas code reads the CSS variables.
- Visual language: a two-ink risograph print. Blue `ink` on warm `paper`, solid `scene` blocks for code and ASCII scenes, and `hot` pink only for recall. Never set text in `hot` on Riso; use `hot-ink` for accent text and `hot-fill` for the main button. Newsreader for display headings, Hanken Grotesk for text, Geist Mono for data, links and code. Shared pieces live in `src/components/site/` (NeuralBrain, AsciiScene, RequestTrace, RankingTuner, ReconcileFlow, ArchitectureMap, CodeBlock, SiteChrome, RouteLoader) and `src/lib/site-styles.ts`. Every animation has a reduced-motion still state, and every loop, observer and timer is cleaned up on unmount. Marketing pages show the mechanism: no feature grids, three-column step strips, label/value spec tables or stat tiles.

## Behaviour that must hold

- Retrieval returns only **approved** memories, scoped to the authenticated user, workspace and namespace.
- Extracted facts start **pending**; manual adds are approved. Changes to approved facts arrive as proposals (`update` or `conflict`) in `memory_revision_proposals` that need approval; `memory_versions` history supports restore. Do not add another change-tracking table.
- Retrieval is one ranked SQL query (meaning + keywords + pin + recency, relative cutoff). Gate ranking changes on `python -m api.eval.retrieval_eval`; do not add retrieval modes.
- Retrieval or logging failures never fail a proxy request. Auth, quota, provider-config and upstream errors are real request errors.
- Extraction runs as PostgreSQL-backed jobs with leases and retries; connections are released before provider calls.
- OAuth MCP connections are project-scoped, revocable and cannot read personal memories.
- No external vector DB, Redis, Celery, LangChain or LlamaIndex. No rate limiting.

## Verification

Run what your change touches, and report results honestly.

```bash
# API (CI applies the schema first; DB-backed tests skip without the URL)
python -m compileall api
DATABASE_URL=... ENGRAM_TEST_DATABASE_URL=... python -m api.apply_schema
python -m pytest api

# MCP
cd mcp && npm run build && node ../scripts/verify_mcp_tool_defaults.mjs

# Dashboard
cd dashboard && npm run verify:logic && npx tsc --noEmit && npm run build

# Full stack: proxy, extraction, injection, DB-outage fallback, all MCP tools
python scripts/verify_full_flow.py
```

## Deployment constraint

The hosted instance runs on Azure Container Apps (Consumption, 0–1 replicas). Keep it on the free tier: do not add services, raise resources or change tiers without explicit approval.
