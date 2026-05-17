# Engram — Product Requirements Document

**Version:** 1.0
**Project:** Engram — Self-Hostable AI Memory Layer
**Author:** Ayush Kumar
**Status:** Ready for implementation

---

## 1. Project Overview

### 1.1 What is Engram

Engram is a self-hostable, open-source memory layer for LLM applications. It sits between any client application and any LLM API, intercepts conversations, extracts durable facts about users, stores them as vector embeddings, and automatically injects relevant memories into future prompts — making any stateless LLM app stateful.

Engram is model-agnostic and provider-agnostic. It works with OpenAI, Anthropic, Google Gemini, or any OpenAI-compatible endpoint. It ships as a single `docker compose up` command.

### 1.2 The Problem

Every LLM API is stateless by design. When developers build applications on top of LLM APIs, they get no memory between sessions. The options available today are:

- Stuff the entire conversation history into every prompt (expensive, hits context limits fast)
- Build custom memory logic per application (time-consuming, inconsistent)
- Use closed SaaS tools like Mem0 (vendor lock-in, no inspection, no control, not self-hostable cleanly)

No open-source tool provides a clean, self-hostable memory primitive that:
- Works with any LLM provider
- Is fully inspectable (you can see why a memory was retrieved)
- Exposes memory as MCP tools for LLM agents
- Deploys with a single command

### 1.3 The Solution

Engram provides three interfaces to the same memory backend:

1. **A proxy endpoint** — drop-in replacement for any LLM API call. Intercepts the call, enriches the prompt with relevant memories, forwards to the LLM, extracts new memories from the response, returns the response transparently.

2. **A REST API** — CRUD operations on memories. Used by the dashboard and by developers who want direct control.

3. **An MCP server** — exposes memory as native MCP tools so LLM agents can call `search_memories`, `add_memory`, etc. as tool calls. This is the key differentiator from Mem0 and Zep.

### 1.4 Target Users

- Developers building LLM-powered applications who want persistent user memory without building it themselves
- Teams self-hosting AI tools who need data privacy (no third-party SaaS)
- Researchers and hobbyists running local LLM setups with Ollama

### 1.5 Key Differentiators vs Existing Tools

| Feature | Engram | Mem0 | Zep |
|---|---|---|---|
| Self-hostable (single command) | Yes | Partial | Yes |
| MCP server interface | Yes | No | No |
| Retrieval inspection / logs | Yes | No | Partial |
| Model-agnostic extraction | Yes | Yes | Yes |
| Open source | Yes | Partial | Yes |
| Local embeddings (no API cost) | Yes | No | No |

---

## 2. Technical Architecture

### 2.1 High-Level Architecture

```
Client App
    |
    | POST /v1/chat (proxy endpoint)
    v
+---------------------------+
|      Engram Service       |
|                           |
|  [Memory Proxy]           |
|       |                   |
|       |--- retrieve ---->[Retrieval Engine]
|       |                        |
|       |                   [pgvector cosine search]
|       |                        |
|       |<-- top-k memories -----+
|       |
|       |--- enrich system prompt
|       |
|       |--- forward to LLM API ----------> OpenAI / Anthropic / Gemini
|       |
|       |<-- LLM response ----------------+
|       |
|       |--- return response to client
|       |
|       |--- async: run extraction -----> [Extraction Engine]
|                                               |
|                                        [LLM call → JSON facts]
|                                               |
|                                        [Embedding Service]
|                                               |
|                                        [pgvector INSERT]
|
+---------------------------+
         |
    [REST API]     [MCP Server]
         |               |
    [Dashboard]    [LLM Agents]
```

### 2.2 Service Breakdown

The project has four services managed by Docker Compose:

**1. api** — FastAPI Python service. Handles the proxy endpoint, REST CRUD endpoints, extraction pipeline, embedding generation, and retrieval logic. This is the core service.

**2. postgres** — PostgreSQL 16 with pgvector extension. Stores all memories, users, metadata, and retrieval logs. Uses the official `pgvector/pgvector:pg16` Docker image which comes with the extension pre-installed.

**3. mcp** — TypeScript Node.js service. Exposes memory operations as MCP tools over SSE transport. Talks to the `api` service via internal HTTP.

**4. dashboard** — Next.js application. Developer-facing UI for inspecting memories, viewing retrieval logs, managing users, and testing the proxy. Talks to the `api` service.

### 2.3 Data Flow — Write Path (Memory Extraction)

1. Client sends a conversation to `POST /v1/chat`
2. Proxy retrieves relevant memories (read path, described below)
3. Proxy enriches the system prompt with retrieved memories
4. Proxy forwards the enriched request to the configured LLM provider
5. LLM response is returned to client immediately
6. Async background task begins extraction:
   a. Full conversation (user message + assistant response) is sent to extraction LLM with the extraction prompt
   b. Extraction LLM returns a JSON array of memory strings
   c. Each memory string is embedded using `sentence-transformers`
   d. Memories are deduplicated against existing memories for this user (cosine similarity > 0.95 = duplicate)
   e. Non-duplicate memories are inserted into the `memories` table with embedding, user_id, timestamp, confidence score, and source conversation id

### 2.4 Data Flow — Read Path (Memory Retrieval)

1. Incoming user message is embedded using `sentence-transformers`
2. pgvector cosine similarity search against all memories for this `user_id`
3. Top 5 memories by similarity score are returned (threshold: score > 0.5)
4. Retrieval is logged to `retrieval_logs` table (query, memory ids, scores, timestamp)
5. Retrieved memories are formatted and injected into the system prompt as a block before the user's message

### 2.5 Memory Injection Format

Retrieved memories are injected into the system prompt as follows:

```
[MEMORY CONTEXT]
The following facts are known about this user from previous conversations:
- User prefers TypeScript over JavaScript for all new projects
- User is building a project called SENTINEL — a market microstructure simulator
- User wants responses without em dashes or AI-typical phrasing
[END MEMORY CONTEXT]

{original system prompt}
```

If there is no existing system prompt, the memory block becomes the system prompt.

---

## 3. Database Schema

All tables live in the `engram` database. pgvector extension must be enabled.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
-- external_id is whatever the client app uses to identify a user (their own user ID)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id TEXT UNIQUE NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Memories table
-- embedding is 384-dimensional (all-MiniLM-L6-v2 output)
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(384) NOT NULL,
    source_conversation_id UUID,
    confidence FLOAT NOT NULL DEFAULT 1.0,
    access_count INT NOT NULL DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- IVFFlat index for fast approximate nearest neighbor search
-- lists=100 is appropriate for up to ~1M memories
CREATE INDEX memories_embedding_idx ON memories
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX memories_user_id_idx ON memories(user_id);

-- Retrieval logs table
-- Records every retrieval event for inspection and debugging
CREATE TABLE retrieval_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    query_embedding vector(384),
    retrieved_memory_ids UUID[] NOT NULL DEFAULT '{}',
    retrieved_scores FLOAT[] NOT NULL DEFAULT '{}',
    conversation_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations table
-- Tracks which conversations have been processed for extraction
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    extraction_status TEXT NOT NULL DEFAULT 'pending',
    memories_extracted INT DEFAULT 0,
    raw_exchange JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. API Specification

### 4.1 Authentication

All endpoints require an API key passed as a header:

```
X-Engram-Key: ek_<api_key>
```

API keys are generated server-side on user creation. They are stored hashed in the database.

### 4.2 Proxy Endpoint

**`POST /v1/chat`**

Drop-in proxy for any OpenAI-compatible chat completion call. Intercepts, enriches with memories, forwards to LLM, triggers async extraction.

Request body — identical to OpenAI chat completions format:
```json
{
  "model": "gpt-4o-mini",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What should I use for my backend?"}
  ],
  "temperature": 0.7
}
```

Additional Engram-specific headers:
```
X-Engram-Key: ek_abc123
X-Engram-User-ID: user_456        (your app's user identifier)
X-Engram-Provider: openai         (openai | anthropic | gemini | ollama)
X-Engram-Disable-Injection: false (optional, skip memory injection)
X-Engram-Disable-Extraction: false (optional, skip memory extraction)
```

Response — identical to the LLM provider's response format. Engram adds one header:
```
X-Engram-Memories-Injected: 3
X-Engram-Conversation-ID: conv_uuid_here
```

### 4.3 Memory Endpoints

**`GET /memories`**

List all memories for the authenticated user.

Query params:
- `limit` (int, default 20, max 100)
- `offset` (int, default 0)
- `search` (string, optional — semantic search filter)
- `order` (created_at | last_accessed | access_count, default created_at)
- `direction` (asc | desc, default desc)

Response:
```json
{
  "memories": [
    {
      "id": "uuid",
      "content": "User prefers TypeScript over JavaScript",
      "confidence": 1.0,
      "access_count": 7,
      "last_accessed": "2026-05-10T14:23:00Z",
      "created_at": "2026-04-01T09:00:00Z",
      "source_conversation_id": "uuid"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

**`POST /memories`**

Manually add a memory for the authenticated user.

Request:
```json
{
  "content": "User is allergic to peanuts"
}
```

Response:
```json
{
  "id": "uuid",
  "content": "User is allergic to peanuts",
  "confidence": 1.0,
  "created_at": "2026-05-17T10:00:00Z"
}
```

**`GET /memories/{memory_id}`**

Get a single memory by ID.

**`PATCH /memories/{memory_id}`**

Update a memory's content.

Request:
```json
{
  "content": "User prefers Python for ML work, TypeScript for backend"
}
```

**`DELETE /memories/{memory_id}`**

Delete a memory permanently.

Response: `204 No Content`

**`POST /memories/search`**

Semantic search over memories.

Request:
```json
{
  "query": "what programming languages does the user prefer",
  "limit": 5,
  "threshold": 0.5
}
```

Response:
```json
{
  "results": [
    {
      "memory": { "id": "uuid", "content": "..." },
      "score": 0.87
    }
  ]
}
```

### 4.4 User Endpoints

**`POST /users`**

Create a new user. Returns the API key — only shown once.

Request:
```json
{
  "external_id": "user_123_from_your_app"
}
```

Response:
```json
{
  "id": "uuid",
  "external_id": "user_123_from_your_app",
  "api_key": "ek_abc123xyz",
  "created_at": "2026-05-17T10:00:00Z"
}
```

**`GET /users/me`**

Get current user info (from API key).

**`DELETE /users/me`**

Delete user and all their memories (GDPR compliance).

### 4.5 Retrieval Log Endpoints

**`GET /logs`**

List retrieval log entries for the authenticated user.

Query params: `limit`, `offset`, `conversation_id`

Response:
```json
{
  "logs": [
    {
      "id": "uuid",
      "query": "what backend should I use",
      "retrieved_memories": [
        {
          "memory_id": "uuid",
          "content": "User prefers FastAPI for backend work",
          "score": 0.91
        }
      ],
      "conversation_id": "uuid",
      "created_at": "2026-05-17T10:00:00Z"
    }
  ]
}
```

**`GET /logs/{log_id}`**

Get a single retrieval log entry with full detail including the original query embedding dimensions.

### 4.6 Health Endpoint

**`GET /health`**

Returns service health, database connectivity, and embedding model status.

```json
{
  "status": "ok",
  "database": "connected",
  "embedding_model": "loaded",
  "version": "1.0.0"
}
```

---

## 5. MCP Server Specification

The MCP server runs as a separate TypeScript service on port 3000. It uses SSE transport and exposes the following tools:

### 5.1 Tools

**`search_memories`**

Search for relevant memories given a query string.

Input schema:
```typescript
{
  query: z.string().describe("Natural language query to search memories"),
  limit: z.number().int().min(1).max(20).default(5),
  threshold: z.number().min(0).max(1).default(0.5)
}
```

Output: Array of memory objects with content and similarity score.

---

**`add_memory`**

Manually add a memory for the current user.

Input schema:
```typescript
{
  content: z.string().describe("The fact or preference to remember")
}
```

Output: Created memory object.

---

**`delete_memory`**

Delete a specific memory by ID.

Input schema:
```typescript
{
  memory_id: z.string().uuid()
}
```

Output: Success confirmation.

---

**`list_memories`**

List all memories for the current user.

Input schema:
```typescript
{
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0)
}
```

Output: Paginated list of memories.

---

**`update_memory`**

Update the content of an existing memory.

Input schema:
```typescript
{
  memory_id: z.string().uuid(),
  content: z.string().describe("New content for the memory")
}
```

Output: Updated memory object.

---

**`get_retrieval_log`**

Get retrieval history — what memories were surfaced and why.

Input schema:
```typescript
{
  conversation_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(10)
}
```

Output: Array of retrieval log entries with scores.

### 5.2 MCP Server Configuration

The MCP server reads the following environment variables:

```
ENGRAM_API_URL=http://api:8000
ENGRAM_API_KEY=ek_abc123          (service-level key for internal use)
MCP_PORT=3000
MCP_TRANSPORT=sse                  (sse | stdio)
```

For `stdio` transport (local Claude Desktop use), the server can also be run directly:
```bash
node dist/index.js --transport stdio
```

---

## 6. Extraction Engine

### 6.1 Extraction Prompt

This is the core prompt sent to the extraction LLM after every conversation. The quality of this prompt determines the quality of everything downstream.

```
You are a precise memory extraction system for an AI assistant. Your job is to extract durable, useful facts about the USER from a conversation.

RULES:
1. Extract facts ONLY about the user — not about the assistant, not about general topics
2. Only extract things likely to remain true over time (preferences, projects, skills, context, corrections)
3. Do NOT extract: greetings, pleasantries, one-off questions, things the assistant said
4. Do NOT extract obvious or trivially true things ("user asked a question")
5. Be specific and concrete — bad: "user likes coding", good: "user prefers FastAPI over Flask for Python backends"
6. If the user corrected the assistant, extract the correction as a fact
7. Maximum 5 memories per conversation — quality over quantity
8. If nothing worth remembering was said, return an empty array

OUTPUT FORMAT:
Return ONLY a valid JSON array of strings. No preamble, no explanation, no markdown.
Example: ["User is a 3rd year CS student at RVITM Bengaluru", "User prefers TypeScript for frontend work"]
Empty example: []

CONVERSATION:
{conversation}

MEMORIES (JSON array only):
```

### 6.2 Extraction Provider Abstraction

The extraction engine supports multiple providers via an abstract base class:

```python
class ExtractionProvider(ABC):
    async def extract(self, conversation: str) -> list[str]:
        raise NotImplementedError

class OpenAIExtractionProvider(ExtractionProvider): ...
class GeminiExtractionProvider(ExtractionProvider): ...
class OllamaExtractionProvider(ExtractionProvider): ...
```

Provider is selected via `EXTRACTION_PROVIDER` env variable. Default is `openai`.

### 6.3 Deduplication Logic

Before inserting any extracted memory, check for near-duplicates among existing memories for the same user:

```python
# Pseudocode
new_embedding = embed(new_memory_content)
existing = get_top_1_similar(user_id, new_embedding)
if existing and existing.score > 0.95:
    skip insertion  # duplicate
elif existing and existing.score > 0.80:
    update existing memory content  # refinement of same fact
else:
    insert new memory
```

This prevents the memory store from filling with redundant facts across multiple conversations.

---

## 7. Embedding Service

### 7.1 Model

Model: `sentence-transformers/all-MiniLM-L6-v2`

- Output dimensions: 384
- Max input tokens: 256
- Runs on CPU (no GPU required)
- License: Apache 2.0
- Size: ~80MB

### 7.2 Implementation

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

def embed(text: str) -> list[float]:
    return model.encode(text, normalize_embeddings=True).tolist()
```

The model is loaded once at FastAPI startup and kept in memory. Embeddings are L2-normalized so cosine similarity equals dot product, which pgvector optimizes well.

### 7.3 Batch Embedding

When multiple memories are extracted from one conversation, batch them into a single `model.encode()` call rather than individual calls:

```python
embeddings = model.encode(memory_list, normalize_embeddings=True)
```

---

## 8. Repository Structure

```
engram/
├── README.md
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .gitignore
│
├── api/                              # FastAPI Python service
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                       # FastAPI app entrypoint
│   ├── config.py                     # Settings via pydantic-settings
│   ├── dependencies.py               # FastAPI dependency injection
│   │
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── proxy.py                  # POST /v1/chat
│   │   ├── memories.py               # Memory CRUD
│   │   ├── users.py                  # User management
│   │   └── logs.py                   # Retrieval logs
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── proxy.py                  # Proxy orchestration logic
│   │   ├── extraction.py             # Extraction pipeline + provider abstraction
│   │   ├── embedding.py              # sentence-transformers wrapper
│   │   ├── retrieval.py              # pgvector similarity search
│   │   ├── deduplication.py          # Near-duplicate detection
│   │   └── providers/
│   │       ├── __init__.py
│   │       ├── base.py               # Abstract ExtractionProvider
│   │       ├── openai.py
│   │       ├── gemini.py
│   │       └── ollama.py
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── memory.py                 # Pydantic models for Memory
│   │   ├── user.py
│   │   ├── conversation.py
│   │   └── log.py
│   │
│   └── db/
│       ├── __init__.py
│       ├── connection.py             # asyncpg connection pool
│       └── schema.sql                # Full DB schema
│
├── mcp/                              # TypeScript MCP server
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                  # MCP server entrypoint
│       ├── config.ts
│       ├── client.ts                 # HTTP client to api service
│       └── tools/
│           ├── search.ts
│           ├── add.ts
│           ├── delete.ts
│           ├── list.ts
│           ├── update.ts
│           └── logs.ts
│
└── dashboard/                        # Next.js dashboard
    ├── Dockerfile
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx              # Memories list
        │   ├── logs/
        │   │   └── page.tsx          # Retrieval logs
        │   └── settings/
        │       └── page.tsx          # API key, user settings
        ├── components/
        │   ├── MemoryCard.tsx
        │   ├── MemoryTable.tsx
        │   ├── LogEntry.tsx
        │   ├── SearchBar.tsx
        │   └── ScoreBadge.tsx
        └── lib/
            └── api.ts                # API client
```

---

## 9. Docker Compose Configuration

### 9.1 Production `docker-compose.yml`

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_DB: engram
      POSTGRES_USER: engram
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./api/db/schema.sql:/docker-entrypoint-initdb.d/01_schema.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U engram"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: ./api
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://engram:${POSTGRES_PASSWORD}@postgres:5432/engram
      EXTRACTION_PROVIDER: ${EXTRACTION_PROVIDER:-openai}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      GEMINI_API_KEY: ${GEMINI_API_KEY:-}
      OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
      OLLAMA_MODEL: ${OLLAMA_MODEL:-qwen2.5:3b}
      EXTRACTION_MODEL: ${EXTRACTION_MODEL:-gpt-4o-mini}
    depends_on:
      postgres:
        condition: service_healthy

  mcp:
    build: ./mcp
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      ENGRAM_API_URL: http://api:8000
      ENGRAM_API_KEY: ${MCP_SERVICE_KEY}
      MCP_PORT: 3000
    depends_on:
      - api

  dashboard:
    build: ./dashboard
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      NEXT_PUBLIC_API_URL: ${API_PUBLIC_URL:-http://localhost:8000}
    depends_on:
      - api

volumes:
  pgdata:
```

### 9.2 `.env.example`

```bash
# Required
POSTGRES_PASSWORD=changeme_use_a_strong_password

# Extraction provider — choose one
EXTRACTION_PROVIDER=openai

# OpenAI (default)
OPENAI_API_KEY=sk-...
EXTRACTION_MODEL=gpt-4o-mini

# Google Gemini (swap when OpenAI key expires)
# EXTRACTION_PROVIDER=gemini
# GEMINI_API_KEY=AIza...
# EXTRACTION_MODEL=gemini-2.0-flash

# Ollama (fully local, no API key)
# EXTRACTION_PROVIDER=ollama
# OLLAMA_BASE_URL=http://host.docker.internal:11434
# OLLAMA_MODEL=qwen2.5:3b

# MCP service key (generate with: openssl rand -hex 32)
MCP_SERVICE_KEY=

# Dashboard public API URL (change if deploying remotely)
API_PUBLIC_URL=http://localhost:8000
```

---

## 10. Environment Variables Reference

### 10.1 API Service

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | Full PostgreSQL connection string |
| `EXTRACTION_PROVIDER` | No | `openai` | `openai`, `gemini`, or `ollama` |
| `OPENAI_API_KEY` | If provider=openai | — | OpenAI API key |
| `EXTRACTION_MODEL` | No | `gpt-4o-mini` | Model to use for extraction |
| `GEMINI_API_KEY` | If provider=gemini | — | Google Gemini API key |
| `OLLAMA_BASE_URL` | If provider=ollama | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | If provider=ollama | `qwen2.5:3b` | Ollama model name |
| `EMBEDDING_MODEL` | No | `all-MiniLM-L6-v2` | sentence-transformers model |
| `MAX_MEMORIES_INJECTED` | No | `5` | Max memories to inject per prompt |
| `RETRIEVAL_THRESHOLD` | No | `0.5` | Min similarity score for retrieval |
| `DEDUP_THRESHOLD` | No | `0.95` | Similarity threshold for deduplication |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warning`, `error` |

### 10.2 MCP Service

| Variable | Required | Default | Description |
|---|---|---|---|
| `ENGRAM_API_URL` | Yes | — | Internal URL of the API service |
| `ENGRAM_API_KEY` | Yes | — | Service-level API key |
| `MCP_PORT` | No | `3000` | Port for SSE transport |
| `MCP_TRANSPORT` | No | `sse` | `sse` or `stdio` |

---

## 11. Dashboard Specification

The dashboard is a developer tool, not a consumer product. Design priority: functional clarity over aesthetics.

### 11.1 Pages

**Memories page (default `/`)**
- Table of all memories: content, confidence score, access count, last accessed, created at
- Search bar (semantic search via `POST /memories/search`)
- Edit button per row (inline edit)
- Delete button per row (with confirmation)
- Add memory button (opens modal with text input)
- Pagination

**Logs page (`/logs`)**
- Table of retrieval log entries: timestamp, query, number of memories retrieved
- Expandable row showing each retrieved memory with its similarity score as a colored badge (green >0.8, yellow 0.6-0.8, red <0.6)
- Filter by conversation ID

**Settings page (`/settings`)**
- Display current user's external ID
- API key display (masked, with copy button)
- Danger zone: delete all memories, delete account

### 11.2 API Client (`src/lib/api.ts`)

Typed fetch wrapper for all API endpoints. Reads `NEXT_PUBLIC_API_URL` from env. All requests include `X-Engram-Key` header from local storage.

---

## 12. Build Phases

### Phase 1 — Database and Embeddings (Week 1)

Goal: pgvector running in Docker, able to insert a memory with a real embedding and retrieve it by similarity.

Tasks:
- Set up Docker Compose with postgres service
- Apply schema.sql on container start
- Write `embedding.py` service — load model, expose `embed(text)` function
- Write `db/connection.py` — asyncpg connection pool
- Write a test script that embeds 5 sentences, inserts them, queries by similarity, prints results
- Verify the ivfflat index is used via `EXPLAIN ANALYZE`

Done when: `python test_retrieval.py` outputs semantically relevant results for a test query.

### Phase 2 — Extraction Pipeline (Week 1-2)

Goal: given a conversation string, extract a list of memory strings using an LLM.

Tasks:
- Write provider abstraction (`base.py`, `openai.py`)
- Write `extraction.py` service with the extraction prompt
- Write deduplication logic
- Test with 10 real conversation examples, evaluate extraction quality
- Tune the extraction prompt based on failures

Done when: extraction reliably returns clean JSON with relevant facts for varied conversations.

### Phase 3 — REST API (Week 2)

Goal: all REST endpoints working, tested with curl / Postman.

Tasks:
- Set up FastAPI app with lifespan (model loading on startup)
- User creation endpoint with API key generation
- Memory CRUD endpoints
- Search endpoint
- Retrieval log endpoints
- Health endpoint
- API key auth middleware
- Pydantic request/response models for all endpoints

Done when: all endpoints return correct responses, auth works, errors are handled gracefully.

### Phase 4 — Proxy Endpoint (Week 2-3)

Goal: `POST /v1/chat` works end-to-end — memory injection on the way in, extraction on the way out.

Tasks:
- Implement proxy route
- Write retrieval service (embed query → pgvector search → format memories)
- Write memory injection logic (build enriched system prompt)
- Forward request to LLM provider
- Return response with Engram headers
- Trigger async extraction task (`asyncio.create_task`)
- Test with a real multi-turn conversation across two separate API calls

Done when: second call to the proxy remembers facts stated in the first call.

### Phase 5 — MCP Server (Week 3-4)

Goal: MCP server running with all 6 tools, connectable from Claude Desktop.

Tasks:
- Set up TypeScript project with `@modelcontextprotocol/sdk`
- Write HTTP client to api service
- Implement all 6 tools with Zod schemas
- SSE transport setup
- stdio transport option for Claude Desktop
- Test each tool via MCP Inspector

Done when: Claude Desktop can call `search_memories` and get real results from the Postgres database.

### Phase 6 — Dashboard (Week 4-5)

Goal: working Next.js dashboard with memories table, logs, and settings.

Tasks:
- Set up Next.js app with Tailwind
- API client with typed fetch functions
- Memories page with table, search, edit, delete
- Logs page with expandable retrieval details
- Settings page
- Add to Docker Compose

Done when: developer can inspect and manage all memories through the UI.

### Phase 7 — Polish and README (Week 5)

Goal: project is presentable for GitHub, working demo recorded.

Tasks:
- Write README.md with quick start, architecture overview, API reference summary, comparison table vs Mem0
- Write `CONTRIBUTING.md`
- Add GitHub Actions CI (lint + type check)
- Record demo video (two terminal windows: chat script + live memory watch)
- Tag v1.0.0

---

## 13. Non-Functional Requirements

**Latency:** The proxy endpoint must not add more than 200ms of latency on the hot path (retrieval + injection). Extraction runs async and does not affect response latency.

**Reliability:** If the database is unavailable, the proxy must fall back gracefully — forward the LLM call without memory enrichment rather than failing the request. Log a warning.

**Correctness:** Extraction must never block or crash the proxy response. All extraction errors must be caught and logged without affecting the client.

**Privacy:** Memories are strictly isolated per `user_id`. No query should ever return memories belonging to a different user. All database queries must include `user_id` in the WHERE clause.

**Portability:** The project must work on any machine with Docker installed. No external dependencies beyond Docker. All models run locally.

---

## 14. Out of Scope for v1

The following are explicitly deferred to v2:

- Memory decay / time-weighted retrieval scoring
- Memory conflict resolution (user contradicts themselves across sessions)
- Multi-user shared memories (team memory)
- Streaming proxy support (SSE streaming from LLM through proxy)
- Web UI for end users (dashboard is developer-only in v1)
- Authentication beyond API keys (OAuth, JWT)
- Rate limiting
- Usage analytics
- Memory importance scoring beyond confidence

---

## 15. Success Criteria

The project is complete when:

1. `docker compose up` starts all four services cleanly on a fresh machine
2. A developer can create a user, get an API key, send a conversation through the proxy, and see memories appear in the database
3. A second conversation through the proxy correctly injects memories from the first
4. All 6 MCP tools work and are connectable from Claude Desktop
5. The dashboard shows memories and retrieval logs correctly
6. The README is clear enough that a developer unfamiliar with the project can get it running in under 5 minutes
