# AGENTS.md — Engram Project

This file is the authoritative guide for any AI coding agent (Claude Code, Codex, Cursor, etc.) working on this codebase. Read this entire file before writing any code. Follow every instruction here exactly.

---

## Project Summary

Engram is a self-hostable AI memory layer. It intercepts LLM API calls, enriches prompts with relevant memories retrieved from a vector database, and extracts new memories from conversations asynchronously. It exposes a REST API, a proxy endpoint, and an MCP server.

Four services: `api` (FastAPI/Python), `postgres` (PostgreSQL + pgvector), `mcp` (TypeScript/Node), `dashboard` (Next.js).

---

## Repository Layout

```
engram/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── README.md
├── AGENTS.md                    ← you are here
│
├── api/                         ← FastAPI Python service
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── config.py
│   ├── dependencies.py
│   ├── routes/
│   │   ├── proxy.py
│   │   ├── memories.py
│   │   ├── users.py
│   │   └── logs.py
│   ├── services/
│   │   ├── proxy.py
│   │   ├── extraction.py
│   │   ├── embedding.py
│   │   ├── retrieval.py
│   │   ├── deduplication.py
│   │   └── providers/
│   │       ├── base.py
│   │       ├── openai.py
│   │       ├── gemini.py
│   │       └── ollama.py
│   ├── models/
│   │   ├── memory.py
│   │   ├── user.py
│   │   ├── conversation.py
│   │   └── log.py
│   └── db/
│       ├── connection.py
│       └── schema.sql
│
├── mcp/                         ← TypeScript MCP server
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── config.ts
│       ├── client.ts
│       └── tools/
│           ├── search.ts
│           ├── add.ts
│           ├── delete.ts
│           ├── list.ts
│           ├── update.ts
│           └── logs.ts
│
└── dashboard/                   ← Next.js dashboard
    ├── Dockerfile
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   ├── logs/page.tsx
        │   └── settings/page.tsx
        ├── components/
        │   ├── MemoryCard.tsx
        │   ├── MemoryTable.tsx
        │   ├── LogEntry.tsx
        │   ├── SearchBar.tsx
        │   └── ScoreBadge.tsx
        └── lib/
            └── api.ts
```

---

## Coding Rules — Read These First

These rules apply to every file in every service. No exceptions.

### General

- No comments anywhere in the code. Code must be self-explanatory through naming.
- Single-letter variable names only in tight loops or list comprehensions. Everywhere else use full descriptive names.
- No `TODO`, `FIXME`, `HACK`, or `NOTE` comments.
- Never leave debug `print()` or `console.log()` statements in committed code. Use the logger.
- All secrets come from environment variables. Never hardcode API keys, passwords, or tokens.
- All environment variables are read through the config module, not directly via `os.environ` in route/service files.

### Python (api/)

- Python 3.11+
- Use `asyncpg` for all database operations — never `psycopg2`, never SQLAlchemy ORM
- All route handlers and service functions must be `async`
- Use `pydantic` v2 for all request/response models
- Use `pydantic-settings` for config (`api/config.py`)
- Import order: stdlib → third-party → local. One blank line between groups.
- Type hints on every function parameter and return value. No bare `Any` unless truly unavoidable.
- Use `httpx.AsyncClient` for all outbound HTTP calls (to LLM providers). Never `requests`.
- Raise `HTTPException` from FastAPI for all API errors. Never return error dicts manually.
- Use FastAPI's dependency injection for database connections and auth. See `dependencies.py`.
- All database queries go in service files or db helpers — never inline SQL in route handlers.

### TypeScript (mcp/)

- TypeScript 5+, strict mode enabled (`"strict": true` in tsconfig)
- Use `@modelcontextprotocol/sdk` for MCP primitives
- Use `zod` for all input schema validation
- Use `node-fetch` or native `fetch` for HTTP calls to the api service
- All async functions must handle errors explicitly — no unhandled promise rejections
- No `any` types. Use `unknown` and narrow with type guards if needed.
- ESM modules only (`"type": "module"` in package.json)

### Next.js (dashboard/)

- Next.js 14+ with App Router
- TypeScript throughout, no `.js` files
- Tailwind CSS only — no inline styles, no CSS modules, no styled-components
- All API calls go through `src/lib/api.ts` — no direct `fetch` calls in components
- Client components (`"use client"`) only when necessary (event handlers, state). Default to server components.
- No `useEffect` for data fetching — use server components or React Query
- The `X-Engram-Key` API key is stored in `localStorage` under the key `engram_api_key`

---

## Service: API (FastAPI)

### Entrypoint — `api/main.py`

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from api.db.connection import init_pool, close_pool
from api.services.embedding import load_model
from api.routes import proxy, memories, users, logs

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    load_model()
    yield
    await close_pool()

app = FastAPI(title="Engram", version="1.0.0", lifespan=lifespan)

app.include_router(proxy.router, tags=["proxy"])
app.include_router(memories.router, prefix="/memories", tags=["memories"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(logs.router, prefix="/logs", tags=["logs"])

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
```

### Config — `api/config.py`

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    extraction_provider: str = "openai"
    openai_api_key: str = ""
    extraction_model: str = "gpt-4o-mini"
    gemini_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:3b"
    embedding_model: str = "all-MiniLM-L6-v2"
    max_memories_injected: int = 5
    retrieval_threshold: float = 0.5
    dedup_threshold: float = 0.95
    log_level: str = "info"

    class Config:
        env_file = ".env"

settings = Settings()
```

### Database Connection — `api/db/connection.py`

Use a module-level pool variable. Initialize in lifespan.

```python
import asyncpg

_pool: asyncpg.Pool | None = None

async def init_pool():
    global _pool
    _pool = await asyncpg.create_pool(settings.database_url, min_size=2, max_size=10)

async def close_pool():
    if _pool:
        await _pool.close()

def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Pool not initialized")
    return _pool
```

### Dependencies — `api/dependencies.py`

```python
from fastapi import Header, HTTPException
import asyncpg

async def get_db() -> asyncpg.Connection:
    async with get_pool().acquire() as conn:
        yield conn

async def get_current_user(x_engram_key: str = Header(...), db = Depends(get_db)):
    row = await db.fetchrow(
        "SELECT * FROM users WHERE api_key = $1", x_engram_key
    )
    if not row:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return row
```

### Embedding Service — `api/services/embedding.py`

```python
from sentence_transformers import SentenceTransformer
import numpy as np

_model: SentenceTransformer | None = None

def load_model():
    global _model
    _model = SentenceTransformer(settings.embedding_model)

def embed(text: str) -> list[float]:
    return _model.encode(text, normalize_embeddings=True).tolist()

def embed_batch(texts: list[str]) -> list[list[float]]:
    return _model.encode(texts, normalize_embeddings=True).tolist()
```

### Retrieval Service — `api/services/retrieval.py`

```python
async def retrieve_memories(
    user_id: str,
    query: str,
    db: asyncpg.Connection,
    limit: int = 5,
    threshold: float = 0.5
) -> list[dict]:
    q_embedding = embed(query)
    rows = await db.fetch(
        """
        SELECT id, content, 1 - (embedding <=> $1::vector) AS score
        FROM memories
        WHERE user_id = $2
          AND 1 - (embedding <=> $1::vector) > $3
        ORDER BY score DESC
        LIMIT $4
        """,
        q_embedding, user_id, threshold, limit
    )
    return [dict(r) for r in rows]
```

### Extraction Service — `api/services/extraction.py`

The extraction prompt is defined as a module-level constant. Do not move it inline.

```python
EXTRACTION_PROMPT = """You are a precise memory extraction system for an AI assistant. Your job is to extract durable, useful facts about the USER from a conversation.

RULES:
1. Extract facts ONLY about the user — not about the assistant, not about general topics
2. Only extract things likely to remain true over time (preferences, projects, skills, context, corrections)
3. Do NOT extract: greetings, pleasantries, one-off questions, things the assistant said
4. Do NOT extract obvious or trivially true things
5. Be specific and concrete — bad: "user likes coding", good: "user prefers FastAPI over Flask for Python backends"
6. If the user corrected the assistant, extract the correction as a fact
7. Maximum 5 memories per conversation — quality over quantity
8. If nothing worth remembering was said, return an empty array

OUTPUT FORMAT:
Return ONLY a valid JSON array of strings. No preamble, no explanation, no markdown.
Example: ["User is a 3rd year CS student", "User prefers FastAPI for backends"]
Empty: []

CONVERSATION:
{conversation}

MEMORIES (JSON array only):"""

async def extract_memories(conversation: str) -> list[str]:
    provider = get_extraction_provider()
    return await provider.extract(EXTRACTION_PROMPT.format(conversation=conversation))
```

### Proxy Route — `api/routes/proxy.py`

Critical implementation notes:
- Return the LLM response to the client BEFORE running extraction
- Use `asyncio.create_task` to fire extraction in the background
- If retrieval fails, log the error but do NOT fail the request — forward without memories
- If extraction fails, log the error but do NOT affect anything — memories just won't be saved
- Always pass through the original request headers to the LLM provider (except auth — replace with your key)

```python
@router.post("/v1/chat")
async def proxy_chat(
    request: Request,
    x_engram_user_id: str = Header(...),
    x_engram_provider: str = Header(default="openai"),
    x_engram_disable_injection: bool = Header(default=False),
    x_engram_disable_extraction: bool = Header(default=False),
    db = Depends(get_db),
    user = Depends(get_current_user)
):
    body = await request.json()
    conversation_id = str(uuid4())

    if not x_engram_disable_injection:
        try:
            memories = await retrieve_memories(user["id"], get_last_user_message(body), db)
            body = inject_memories(body, memories)
            await log_retrieval(user["id"], conversation_id, get_last_user_message(body), memories, db)
        except Exception as e:
            logger.warning(f"Retrieval failed, proceeding without memories: {e}")

    response = await forward_to_provider(body, x_engram_provider)

    if not x_engram_disable_extraction:
        asyncio.create_task(
            run_extraction(user["id"], conversation_id, body, response, db)
        )

    return Response(
        content=response,
        media_type="application/json",
        headers={
            "X-Engram-Conversation-ID": conversation_id,
        }
    )
```

### Memory Injection Format

```python
def inject_memories(body: dict, memories: list[dict]) -> dict:
    if not memories:
        return body

    memory_block = "[MEMORY CONTEXT]\nThe following facts are known about this user from previous conversations:\n"
    memory_block += "\n".join(f"- {m['content']}" for m in memories)
    memory_block += "\n[END MEMORY CONTEXT]"

    messages = body.get("messages", [])
    existing_system = next((m for m in messages if m["role"] == "system"), None)

    if existing_system:
        existing_system["content"] = memory_block + "\n\n" + existing_system["content"]
    else:
        messages.insert(0, {"role": "system", "content": memory_block})

    body["messages"] = messages
    return body
```

### Pydantic Models — `api/models/memory.py`

```python
from pydantic import BaseModel, UUID4
from datetime import datetime

class MemoryCreate(BaseModel):
    content: str

class MemoryUpdate(BaseModel):
    content: str

class MemoryResponse(BaseModel):
    id: UUID4
    content: str
    confidence: float
    access_count: int
    last_accessed: datetime | None
    created_at: datetime
    source_conversation_id: UUID4 | None

class MemorySearchRequest(BaseModel):
    query: str
    limit: int = 5
    threshold: float = 0.5

class MemorySearchResult(BaseModel):
    memory: MemoryResponse
    score: float
```

### `requirements.txt`

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
asyncpg==0.29.0
pydantic==2.7.0
pydantic-settings==2.3.0
sentence-transformers==3.0.0
httpx==0.27.0
python-multipart==0.0.9
openai==1.35.0
google-generativeai==0.7.0
```

---

## Service: MCP Server (TypeScript)

### Entrypoint — `mcp/src/index.ts`

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { searchMemoriesTool } from "./tools/search.js";
import { addMemoryTool } from "./tools/add.js";
import { deleteMemoryTool } from "./tools/delete.js";
import { listMemoriesTool } from "./tools/list.js";
import { updateMemoryTool } from "./tools/update.js";
import { getRetrievalLogTool } from "./tools/logs.js";
import { config } from "./config.js";

const server = new Server(
  { name: "engram", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    searchMemoriesTool.definition,
    addMemoryTool.definition,
    deleteMemoryTool.definition,
    listMemoriesTool.definition,
    updateMemoryTool.definition,
    getRetrievalLogTool.definition,
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "search_memories": return searchMemoriesTool.handler(request.params.arguments);
    case "add_memory": return addMemoryTool.handler(request.params.arguments);
    case "delete_memory": return deleteMemoryTool.handler(request.params.arguments);
    case "list_memories": return listMemoriesTool.handler(request.params.arguments);
    case "update_memory": return updateMemoryTool.handler(request.params.arguments);
    case "get_retrieval_log": return getRetrievalLogTool.handler(request.params.arguments);
    default: throw new Error(`Unknown tool: ${request.params.name}`);
  }
});
```

### Tool Structure Pattern

Every tool file exports an object with `definition` and `handler`. Follow this pattern exactly for all 6 tools:

```typescript
import { z } from "zod";
import { engramClient } from "../client.js";

const InputSchema = z.object({
  query: z.string().describe("Natural language query to search memories"),
  limit: z.number().int().min(1).max(20).default(5),
  threshold: z.number().min(0).max(1).default(0.5),
});

export const searchMemoriesTool = {
  definition: {
    name: "search_memories",
    description: "Search for relevant memories given a natural language query",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language query" },
        limit: { type: "number", default: 5 },
        threshold: { type: "number", default: 0.5 },
      },
      required: ["query"],
    },
  },

  handler: async (args: unknown) => {
    const input = InputSchema.parse(args);
    const results = await engramClient.searchMemories(input);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
    };
  }
};
```

### HTTP Client — `mcp/src/client.ts`

```typescript
import { config } from "./config.js";

class EngramClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.engramApiUrl;
    this.apiKey = config.engramApiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Engram-Key": this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      throw new Error(`Engram API error: ${res.status} ${await res.text()}`);
    }

    return res.json() as T;
  }

  async searchMemories(params: { query: string; limit: number; threshold: number }) {
    return this.request("POST", "/memories/search", params);
  }

  async addMemory(content: string) {
    return this.request("POST", "/memories", { content });
  }

  async deleteMemory(memoryId: string) {
    return this.request("DELETE", `/memories/${memoryId}`);
  }

  async listMemories(params: { limit: number; offset: number }) {
    return this.request("GET", `/memories?limit=${params.limit}&offset=${params.offset}`);
  }

  async updateMemory(memoryId: string, content: string) {
    return this.request("PATCH", `/memories/${memoryId}`, { content });
  }

  async getRetrievalLog(params: { conversation_id?: string; limit: number }) {
    const q = new URLSearchParams({ limit: String(params.limit) });
    if (params.conversation_id) q.set("conversation_id", params.conversation_id);
    return this.request("GET", `/logs?${q.toString()}`);
  }
}

export const engramClient = new EngramClient();
```

### `mcp/package.json`

```json
{
  "name": "engram-mcp",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.11.0",
    "@types/node": "^20.0.0"
  }
}
```

### `mcp/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Service: Dashboard (Next.js)

### API Client — `dashboard/src/lib/api.ts`

All API calls go through this file. Never call fetch directly from components.

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("engram_api_key") ?? "";
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Engram-Key": getApiKey(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  memories: {
    list: (params?: { limit?: number; offset?: number; search?: string }) =>
      request<MemoryListResponse>("GET", `/memories?${new URLSearchParams(params as Record<string, string>)}`),
    create: (content: string) =>
      request<Memory>("POST", "/memories", { content }),
    update: (id: string, content: string) =>
      request<Memory>("PATCH", `/memories/${id}`, { content }),
    delete: (id: string) =>
      request<void>("DELETE", `/memories/${id}`),
    search: (query: string, limit = 5) =>
      request<SearchResponse>("POST", "/memories/search", { query, limit }),
  },
  logs: {
    list: (params?: { limit?: number; conversation_id?: string }) =>
      request<LogListResponse>("GET", `/logs?${new URLSearchParams(params as Record<string, string>)}`),
  },
  users: {
    me: () => request<User>("GET", "/users/me"),
  },
};
```

### Component Conventions

- `MemoryTable` — renders the memories list with edit/delete actions per row
- `MemoryCard` — single memory in card format (used in search results)
- `ScoreBadge` — renders a similarity score. Green if > 0.8, yellow if 0.6-0.8, red if < 0.6
- `LogEntry` — single retrieval log row, expandable to show retrieved memories with scores
- `SearchBar` — controlled input that calls `api.memories.search` on submit

All components are in `src/components/`. Pages import from components, never inline complex JSX in page files.

### Tailwind Only

No inline styles. No CSS modules. Only Tailwind utility classes. Use `cn()` from `clsx` for conditional classes.

---

## Database Operations Reference

### Insert a Memory

```python
await db.execute(
    """
    INSERT INTO memories (user_id, content, embedding, source_conversation_id, confidence)
    VALUES ($1, $2, $3::vector, $4, $5)
    """,
    user_id, content, embedding, conversation_id, confidence
)
```

### Retrieve Top-K Memories by Similarity

```python
rows = await db.fetch(
    """
    SELECT id, content, 1 - (embedding <=> $1::vector) AS score
    FROM memories
    WHERE user_id = $2
      AND 1 - (embedding <=> $1::vector) > $3
    ORDER BY score DESC
    LIMIT $4
    """,
    query_embedding, user_id, threshold, limit
)
```

### Check for Near-Duplicates Before Insert

```python
row = await db.fetchrow(
    """
    SELECT id, content, 1 - (embedding <=> $1::vector) AS score
    FROM memories
    WHERE user_id = $2
    ORDER BY score DESC
    LIMIT 1
    """,
    new_embedding, user_id
)
if row and row["score"] > settings.dedup_threshold:
    return  # skip — duplicate
```

### Log a Retrieval Event

```python
await db.execute(
    """
    INSERT INTO retrieval_logs
      (user_id, query, query_embedding, retrieved_memory_ids, retrieved_scores, conversation_id)
    VALUES ($1, $2, $3::vector, $4, $5, $6)
    """,
    user_id, query, query_embedding,
    [m["id"] for m in memories],
    [m["score"] for m in memories],
    conversation_id
)
```

### Generate API Key

```python
import secrets

def generate_api_key() -> str:
    return "ek_" + secrets.token_urlsafe(32)
```

---

## Error Handling Rules

### API Layer

All errors returned to clients must use FastAPI's `HTTPException`:

```python
raise HTTPException(status_code=404, detail="Memory not found")
raise HTTPException(status_code=401, detail="Invalid API key")
raise HTTPException(status_code=422, detail="Invalid request body")
```

Never return `{"error": "..."}` manually.

### Proxy Layer

The proxy must NEVER fail the client request due to Engram internals. Follow this pattern:

```python
try:
    memories = await retrieve_memories(...)
    body = inject_memories(body, memories)
except Exception as e:
    logger.warning(f"Memory retrieval failed: {e}")
    # continue without memories — do not re-raise

response = await forward_to_provider(body, provider)

try:
    asyncio.create_task(run_extraction(...))
except Exception as e:
    logger.warning(f"Failed to schedule extraction: {e}")
    # continue — extraction failure is non-fatal

return response
```

### MCP Layer

Tool handlers must catch errors and return them as MCP error responses, not throw:

```typescript
handler: async (args: unknown) => {
  try {
    const input = InputSchema.parse(args);
    const result = await engramClient.searchMemories(input);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    };
  }
}
```

---

## Docker Setup

### Build Order

Services must start in this order: `postgres` → `api` → `mcp` + `dashboard` (parallel).

The `depends_on` with `condition: service_healthy` handles this. The postgres healthcheck uses `pg_isready`.

### api Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the embedding model at build time
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

The `RUN python -c "..."` line downloads the model during Docker build so it doesn't re-download on every container start.

### mcp Dockerfile

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
```

### dashboard Dockerfile

```dockerfile
FROM node:20-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

CMD ["node", "server.js"]
```

---

## Build Sequence for the Agent

When implementing this project, build in this exact order. Do not skip steps or reorder.

### Step 1 — Postgres + Schema

1. Create `docker-compose.yml` with postgres service only
2. Create `api/db/schema.sql` with the full schema (users, memories, retrieval_logs, conversations tables + indexes)
3. Run `docker compose up postgres`
4. Verify schema applied: `docker exec -it engram-postgres-1 psql -U engram -c "\dt"`
5. Verify pgvector: `docker exec -it engram-postgres-1 psql -U engram -c "SELECT typname FROM pg_type WHERE typname = 'vector';"`

### Step 2 — Embedding Service

1. Create `api/` Python project structure
2. Write `api/config.py`
3. Write `api/services/embedding.py`
4. Write `api/db/connection.py`
5. Write a standalone test script `api/test_embedding.py` that embeds 5 sentences and does a raw pgvector query
6. Run it and verify similarity scores make semantic sense

### Step 3 — Extraction Provider

1. Write `api/services/providers/base.py` (abstract class)
2. Write `api/services/providers/openai.py`
3. Write `api/services/extraction.py` with the extraction prompt constant
4. Write a standalone test script `api/test_extraction.py` with a sample conversation
5. Run it and verify output is a clean JSON array

### Step 4 — FastAPI App + User/Memory Routes

1. Write `api/main.py`, `api/dependencies.py`
2. Write `api/models/` — all Pydantic models
3. Write `api/routes/users.py` — user creation + me endpoint
4. Write `api/routes/memories.py` — all CRUD + search
5. Write `api/routes/logs.py` — list + detail
6. Add api service to docker-compose.yml
7. Test all endpoints with curl

### Step 5 — Proxy Route

1. Write `api/services/retrieval.py`
2. Write `api/services/deduplication.py`
3. Write `api/services/proxy.py` — orchestration logic
4. Write `api/routes/proxy.py`
5. Write a test script that sends two conversations through the proxy and verifies memory injection on the second

### Step 6 — MCP Server

1. Create `mcp/` TypeScript project with package.json and tsconfig.json
2. Write `mcp/src/config.ts`
3. Write `mcp/src/client.ts`
4. Write all 6 tool files in `mcp/src/tools/`
5. Write `mcp/src/index.ts`
6. Add mcp service to docker-compose.yml
7. Test with MCP Inspector: `npx @modelcontextprotocol/inspector`

### Step 7 — Dashboard

1. Create Next.js app in `dashboard/`
2. Write `dashboard/src/lib/api.ts`
3. Write all components
4. Write all pages
5. Add dashboard service to docker-compose.yml
6. Verify all pages load and interact with the api correctly

### Step 8 — Polish

1. Write `README.md` with quick start section
2. Write `.env.example`
3. Verify `docker compose up` works on a clean environment
4. Run a full end-to-end test: create user → send 2 conversations → check memories in dashboard → use MCP tool

---

## What NOT to Do

- Do not use SQLAlchemy, Alembic, or any ORM — raw asyncpg queries only
- Do not use LangChain or LlamaIndex — implement all logic directly
- Do not use Pinecone, Weaviate, Qdrant, or any external vector database — pgvector only
- Do not use Redis or Celery for the extraction background task — asyncio.create_task only
- Do not add authentication beyond API keys in v1
- Do not implement rate limiting in v1
- Do not add streaming support to the proxy in v1
- Do not use any CSS approach other than Tailwind in the dashboard
- Do not store API keys in plaintext — hash them before storing, compare hashes on auth
- Do not let extraction or retrieval errors propagate to the proxy response — always catch and log

---

## Testing the Full Flow

After implementation, run this sequence to verify everything works:

```bash
# 1. Start all services
docker compose up -d

# 2. Create a user
curl -X POST http://localhost:8000/users \
  -H "Content-Type: application/json" \
  -d '{"external_id": "test_user_1"}'
# Save the api_key from the response

# 3. Send first conversation through proxy
curl -X POST http://localhost:8000/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-Engram-Key: <your_api_key>" \
  -H "X-Engram-User-ID: test_user_1" \
  -H "X-Engram-Provider: openai" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "I am a CS student at RVITM Bengaluru. I prefer FastAPI for backend development and TypeScript for frontend work."}
    ]
  }'

# 4. Wait 3 seconds for extraction to complete
sleep 3

# 5. Check memories were created
curl http://localhost:8000/memories \
  -H "X-Engram-Key: <your_api_key>"

# 6. Send second conversation — memories should be injected
curl -X POST http://localhost:8000/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-Engram-Key: <your_api_key>" \
  -H "X-Engram-User-ID: test_user_1" \
  -H "X-Engram-Provider: openai" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "What tech stack should I use for my next project?"}
    ]
  }'
# The response should reference FastAPI and TypeScript from memory

# 7. Check retrieval logs
curl http://localhost:8000/logs \
  -H "X-Engram-Key: <your_api_key>"

# 8. Open dashboard
open http://localhost:3001
```

---

## Common Mistakes to Avoid

**pgvector casting:** Always cast embedding arrays to `vector` explicitly in SQL: `$1::vector`. asyncpg passes Python lists as arrays, not vectors — the cast is required.

**Async extraction leaking errors:** The `asyncio.create_task` callback must have its own try/except. An unhandled exception in a task crashes silently in production but shows in logs. Always wrap task bodies in try/except.

**Model loading timing:** The SentenceTransformer model must be loaded in the lifespan context manager, not at module import time. Module-level initialization runs before the event loop starts and breaks async startup.

**Memory injection order:** Inject memories BEFORE the original system prompt, not after. LLMs weight earlier context more heavily. The memory block should be the very first thing in the system prompt.

**UUID handling in asyncpg:** asyncpg returns UUIDs as Python `uuid.UUID` objects, not strings. Pydantic handles this fine, but if you're doing manual string concatenation in queries, call `str(row["id"])` first.

**Next.js API key in SSR:** `localStorage` is not available during server-side rendering. Always guard with `typeof window !== "undefined"` or use the api client only in client components.
