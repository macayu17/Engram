# Engram SaaS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Engram safe for hosted workspaces by securing provisioning, enforcing tenant boundaries, and fixing the verified proxy and provider defects.

**Architecture:** PostgreSQL remains the source of truth. Every hosted API key resolves to a user and workspace, and that workspace identifier is carried through all memory, log, conversation, and graph operations. External model calls run outside database connection scopes so the existing pool and Azure Container App can serve more requests without scaling.

**Tech Stack:** Python 3.11, FastAPI, asyncpg, PostgreSQL/pgvector, pytest, Next.js 16, Clerk, TypeScript

---

## File Map

- Modify `api/db/schema.sql` for workspace columns, indexes, constraints, and legacy backfill.
- Modify `api/services/users.py` for workspace-aware API-key resolution and auth caching.
- Create `api/services/orgs.py` for workspace provisioning and membership queries currently embedded in routes.
- Modify `api/dependencies.py`, `api/models/user.py`, `api/models/org.py`, `api/routes/users.py`, and `api/routes/orgs.py` for hosted provisioning contracts.
- Modify `api/services/memories.py`, `api/services/retrieval.py`, `api/services/logs.py`, `api/services/deduplication.py`, `api/services/extraction.py`, and `api/services/graph.py` so every data query includes `org_id`.
- Modify `api/routes/memories.py`, `api/routes/logs.py`, `api/routes/graph.py`, and `api/routes/proxy.py` to pass the authenticated workspace scope.
- Modify `api/services/proxy.py` to separate database preparation from outbound provider I/O and preserve upstream stream status.
- Modify `api/services/providers/factory.py`, `api/models/user.py`, and `dashboard/src/lib/api.ts` to complete Anthropic extraction support.
- Modify `dashboard/src/app/api/engram/user-key/route.ts`, `dashboard/src/app/api/engram/users/route.ts`, `dashboard/src/components/ClerkEngramBridge.tsx`, and `dashboard/src/proxy.ts` to secure hosted provisioning.
- Modify `.env.example` and `README.md` so the documented embedding default matches the built image.
- Create focused tests under `api/` and extend dashboard verification scripts.

### Task 1: Add Workspace Ownership to the Schema

**Files:**
- Modify: `api/db/schema.sql`
- Create: `api/test_workspace_schema.py`

- [ ] **Step 1: Write the failing schema contract test**

```python
from pathlib import Path


def test_workspace_columns_and_indexes_exist() -> None:
    schema = (Path(__file__).resolve().parent / "db" / "schema.sql").read_text(encoding="utf-8")

    assert "ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS org_id UUID" in schema
    assert "ALTER TABLE retrieval_logs ADD COLUMN IF NOT EXISTS org_id UUID" in schema
    assert "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS org_id UUID" in schema
    assert "ALTER TABLE memory_entities ADD COLUMN IF NOT EXISTS org_id UUID" in schema
    assert "ALTER TABLE memory_relationships ADD COLUMN IF NOT EXISTS org_id UUID" in schema
    assert "user_api_keys_org_id_idx" in schema
    assert "retrieval_logs_org_created_at_idx" in schema
    assert "conversations_org_created_at_idx" in schema
    assert "memory_entities_org_idx" in schema
    assert "memory_relationships_org_idx" in schema
    assert "memory_entities_org_user_name_type_idx" in schema
    assert schema.count("ALTER COLUMN org_id SET NOT NULL") >= 6
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS extraction_provider TEXT" in schema
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS openai_api_key_encrypted BYTEA" in schema


def test_legacy_users_receive_personal_workspaces() -> None:
    schema = (Path(__file__).resolve().parent / "db" / "schema.sql").read_text(encoding="utf-8")

    assert "legacy:" in schema
    assert "INSERT INTO org_memberships" in schema
    assert "UPDATE memories" in schema
    assert "UPDATE user_api_keys" in schema
    assert "UPDATE retrieval_logs" in schema
    assert "UPDATE conversations" in schema
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `python -m pytest api/test_workspace_schema.py -v`

Expected: both tests fail because the workspace columns and legacy backfill are absent.

- [ ] **Step 3: Add idempotent workspace columns, indexes, and backfill SQL**

Add the following after the existing organization and graph table definitions, keeping `org_id` nullable only long enough to backfill existing rows:

```sql
ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE retrieval_logs ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE memory_entities ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE memory_relationships ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_api_keys_org_id_idx ON user_api_keys(org_id);
CREATE INDEX IF NOT EXISTS retrieval_logs_org_created_at_idx ON retrieval_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversations_org_created_at_idx ON conversations(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS memory_entities_org_idx ON memory_entities(org_id);
CREATE INDEX IF NOT EXISTS memory_relationships_org_idx ON memory_relationships(org_id);

DO $$
DECLARE
    user_row RECORD;
    personal_org_id UUID;
BEGIN
    FOR user_row IN SELECT id, external_id FROM users LOOP
        SELECT org_id INTO personal_org_id
        FROM org_memberships
        WHERE user_id = user_row.id
        ORDER BY created_at
        LIMIT 1;

        IF personal_org_id IS NULL THEN
            INSERT INTO orgs (name)
            VALUES ('legacy:' || user_row.external_id)
            RETURNING id INTO personal_org_id;

            INSERT INTO org_memberships (org_id, user_id, role)
            VALUES (personal_org_id, user_row.id, 'owner');
        END IF;

        UPDATE memories SET org_id = personal_org_id WHERE user_id = user_row.id AND org_id IS NULL;
        UPDATE user_api_keys SET org_id = personal_org_id WHERE user_id = user_row.id AND org_id IS NULL;
        UPDATE retrieval_logs SET org_id = personal_org_id WHERE user_id = user_row.id AND org_id IS NULL;
        UPDATE conversations SET org_id = personal_org_id WHERE user_id = user_row.id AND org_id IS NULL;
        UPDATE memory_entities SET org_id = personal_org_id WHERE user_id = user_row.id AND org_id IS NULL;
        UPDATE memory_relationships SET org_id = personal_org_id WHERE user_id = user_row.id AND org_id IS NULL;
    END LOOP;
END;
$$;
```

Keep the existing `memories.org_id` declaration. Add uniqueness for one session key name per workspace and user:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS user_api_keys_user_org_name_idx
ON user_api_keys(user_id, org_id, name);
```

Add active provider configuration to the workspace:

```sql
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS extraction_provider TEXT NOT NULL DEFAULT 'openai';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS extraction_model TEXT NOT NULL DEFAULT 'gpt-4o-mini';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS openai_api_key_encrypted BYTEA;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS gemini_api_key_encrypted BYTEA;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS anthropic_api_key_encrypted BYTEA;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orgs_extraction_provider_check') THEN
        ALTER TABLE orgs ADD CONSTRAINT orgs_extraction_provider_check
            CHECK (extraction_provider IN ('openai', 'gemini', 'ollama', 'anthropic'));
    END IF;
END;
$$;
```

During the legacy-user loop, copy provider settings and encrypted keys from the owner user into a newly created personal workspace. Existing workspaces keep their current workspace values so repeated schema application is idempotent.

Replace the old cross-workspace entity uniqueness and nullable foreign keys after backfill:

```sql
ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_org_id_fkey;
ALTER TABLE memories ADD CONSTRAINT memories_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;

ALTER TABLE memory_entities DROP CONSTRAINT IF EXISTS memory_entities_user_id_name_entity_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS memory_entities_org_user_name_type_idx
ON memory_entities(org_id, user_id, name, entity_type);

ALTER TABLE memories ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE user_api_keys ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE retrieval_logs ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE conversations ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE memory_entities ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE memory_relationships ALTER COLUMN org_id SET NOT NULL;
```

- [ ] **Step 4: Run schema and existing security tests**

Run: `python -m pytest api/test_workspace_schema.py api/test_schema_security.py -v`

Expected: all tests pass.

- [ ] **Step 5: Apply the schema to local PostgreSQL and inspect null scopes**

Run: `docker compose up -d postgres && python -m api.apply_schema`

Run: `docker compose exec -T postgres psql -U engram -d engram -c "SELECT count(*) AS unscoped_memories FROM memories WHERE org_id IS NULL;"`

Expected: `unscoped_memories` is `0`.

- [ ] **Step 6: Commit the schema change**

```bash
git add api/db/schema.sql api/test_workspace_schema.py
git commit -m "feat: add workspace ownership to stored data"
```

### Task 2: Resolve API Keys to an Authenticated Workspace

**Files:**
- Modify: `api/services/users.py`
- Modify: `api/dependencies.py`
- Modify: `api/test_user_auth_cache.py`
- Create: `api/test_workspace_auth.py`

- [ ] **Step 1: Add failing tests for secondary-key settings and workspace scope**

```python
from api.services.users import cache_user_auth, get_cached_user_by_api_key


def test_cached_user_includes_workspace_and_retrieval_mode(monkeypatch) -> None:
    monkeypatch.setattr("api.services.users.hash_api_key", lambda value: "hashed")
    row = {
        "id": "user-1",
        "org_id": "org-1",
        "role": "owner",
        "external_id": "clerk:user-1",
        "api_key_hash": "hashed",
        "created_at": "now",
        "max_memories_injected": 7,
        "retrieval_threshold": 0.61,
        "dedup_threshold": 0.91,
        "retrieval_mode": "hybrid",
        "extraction_provider": "openai",
        "extraction_model": "gpt-4o-mini",
    }

    cache_user_auth("hashed", row)
    cached = get_cached_user_by_api_key("ek_test")

    assert cached is not None
    assert cached["org_id"] == "org-1"
    assert cached["role"] == "owner"
    assert cached["retrieval_mode"] == "hybrid"
```

Add an async fake-connection test asserting that the secondary-key query selects `user_api_keys.org_id` and `users.retrieval_mode`.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `python -m pytest api/test_workspace_auth.py api/test_user_auth_cache.py -v`

Expected: failures identify missing `org_id` and `retrieval_mode` fields.

- [ ] **Step 3: Extend the authenticated user contract**

Extend `CachedUser` with these exact fields:

```python
class CachedUser(TypedDict):
    id: object
    org_id: object
    role: str
    external_id: str
    api_key_hash: str
    created_at: object
    max_memories_injected: int
    retrieval_threshold: float
    dedup_threshold: float
    retrieval_mode: str
    extraction_provider: str
    extraction_model: str
    cached_at: float
```

Change the secondary-key lookup to return the complete user settings and workspace:

```sql
SELECT users.id, user_api_keys.org_id, org_memberships.role,
       users.external_id, user_api_keys.api_key_hash,
       users.created_at, users.max_memories_injected, users.retrieval_threshold,
       users.dedup_threshold, users.retrieval_mode, orgs.extraction_provider,
       orgs.extraction_model, orgs.openai_api_key_encrypted,
       orgs.gemini_api_key_encrypted, orgs.anthropic_api_key_encrypted
FROM user_api_keys
JOIN users ON users.id = user_api_keys.user_id
JOIN orgs ON orgs.id = user_api_keys.org_id
JOIN org_memberships ON org_memberships.org_id = user_api_keys.org_id
                    AND org_memberships.user_id = user_api_keys.user_id
WHERE user_api_keys.api_key_hash = $1
```

When a secondary key succeeds on a database lookup, update that key row's `last_used_at` before caching it. Cache hits do not write, limiting this update to at most once per auth-cache TTL per process.

For the legacy `users.api_key_hash` lookup, join the user's oldest membership and its workspace, expose `org_id` and membership `role`, and select provider settings from `orgs`. Populate `org_id`, `role`, and `retrieval_mode` in `cache_user_auth` using `get_row_value`.

- [ ] **Step 4: Run the auth tests**

Run: `python -m pytest api/test_workspace_auth.py api/test_user_auth_cache.py api/test_user_config_runtime.py -v`

Expected: all tests pass.

- [ ] **Step 5: Commit workspace-aware authentication**

```bash
git add api/services/users.py api/dependencies.py api/test_workspace_auth.py api/test_user_auth_cache.py
git commit -m "fix: resolve API keys to workspace context"
```

### Task 3: Make Hosted Provisioning Authenticated and Idempotent

**Files:**
- Create: `api/services/orgs.py`
- Modify: `api/services/users.py`
- Modify: `api/models/user.py`
- Modify: `api/models/org.py`
- Modify: `api/routes/users.py`
- Modify: `api/routes/orgs.py`
- Modify: `dashboard/src/app/api/engram/user-key/route.ts`
- Modify: `dashboard/src/app/api/engram/users/route.ts`
- Modify: `dashboard/src/components/ClerkEngramBridge.tsx`
- Modify: `dashboard/src/proxy.ts`
- Create: `api/test_hosted_provisioning.py`
- Modify: `dashboard/scripts/verify-clerk-setup.mjs`

- [ ] **Step 1: Write failing provisioning tests**

Cover these exact behaviors with a fake asyncpg connection:

```python
async def test_provisioning_reuses_personal_workspace_and_session_key() -> None:
    result = await provision_hosted_user(
        external_id="clerk:user_1",
        workspace_name="Ayush's workspace",
        key_name="clerk:session_1",
        db=fake_db,
    )

    assert result["workspace"]["role"] == "owner"
    assert result["api_key"].startswith("ek_")
    assert fake_db.count("INSERT INTO orgs") == 1
    assert fake_db.count("INSERT INTO user_api_keys") == 1
```

Run the same call twice and assert the database still contains one user, one membership, and one key named `clerk:session_1`. The second call rotates that row instead of adding another row.

- [ ] **Step 2: Run the provisioning test and verify it fails**

Run: `python -m pytest api/test_hosted_provisioning.py -v`

Expected: failure because `provision_hosted_user` does not exist.

- [ ] **Step 3: Move organization SQL into `api/services/orgs.py`**

Create focused async functions with these signatures:

```python
async def provision_hosted_user(
    external_id: str,
    workspace_name: str,
    key_name: str,
    db: asyncpg.Connection,
) -> dict[str, object]:
```

```python
async def list_orgs(user_id: object, org_id: object, db: asyncpg.Connection) -> list[dict[str, object]]:
```

```python
async def get_org(org_id: object, user_id: object, authenticated_org_id: object, db: asyncpg.Connection) -> dict[str, object] | None:
```

```python
async def add_org_member(
    org_id: object,
    actor_user_id: object,
    authenticated_org_id: object,
    external_id: str,
    role: str,
    db: asyncpg.Connection,
) -> dict[str, object] | None:
```

```python
async def remove_org_member(
    org_id: object,
    actor_user_id: object,
    authenticated_org_id: object,
    external_id: str,
    db: asyncpg.Connection,
) -> bool:
```

`provision_hosted_user` must run in one transaction, upsert the user by `external_id`, reuse the oldest owned workspace or create one, then upsert `(user_id, org_id, key_name)` with a new key hash. Return the plaintext key once with workspace metadata.

Organization routes must pass `user["org_id"]` as `authenticated_org_id`. List returns only that workspace. Get, add-member, and remove-member return not found when the path `org_id` differs from the API key's workspace, even if the same user belongs to another workspace.

- [ ] **Step 4: Define the hosted provisioning payload and response**

Use these models in `api/models/user.py`:

```python
class ServiceUserKeyCreate(ExternalIdModel):
    workspace_name: str = Field(min_length=1, max_length=120)
    key_name: str = Field(min_length=1, max_length=120)


class HostedProvisionResponse(UserCreateResponse):
    workspace_id: UUID4
    workspace_name: str
    role: str
```

Keep the existing public `UserCreate` contract for local self-hosting.

- [ ] **Step 5: Disable public user creation in hosted mode**

At the start of `create_user_route`, add:

```python
if settings.engram_service_key:
    raise HTTPException(status_code=404, detail="Not found")
```

Change `/users/service-key` to call `provision_hosted_user` and return `HostedProvisionResponse`.

- [ ] **Step 6: Secure the dashboard provisioning route with Clerk session data**

In `dashboard/src/app/api/engram/user-key/route.ts`, use the server session only:

```typescript
const { sessionId, userId } = await auth();
if (!userId || !sessionId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

Send this payload to the API:

```typescript
body: JSON.stringify({
  external_id: `clerk:${userId}`,
  workspace_name: "Personal workspace",
  key_name: `clerk:${sessionId}`,
}),
```

Return `workspaceId`, `workspaceName`, and `role` with the one-time API key. Remove the unauthenticated hosted fallback from `dashboard/src/app/api/engram/users/route.ts`; when Clerk is configured it must return `404`, while local mode can retain manual user creation.

- [ ] **Step 7: Protect product routes when Clerk is configured**

Use `createRouteMatcher` in `dashboard/src/proxy.ts`:

```typescript
const isProductRoute = createRouteMatcher([
  "/overview(.*)",
  "/memories(.*)",
  "/chat(.*)",
  "/logs(.*)",
  "/graph(.*)",
  "/settings(.*)",
]);

export default clerkPublishableKey
  ? clerkMiddleware(async (auth, request) => {
      if (isProductRoute(request)) {
        await auth.protect();
      }
    })
  : passThroughMiddleware;
```

- [ ] **Step 8: Extend Clerk and API verification scripts**

Assert that `user-key/route.ts` calls `auth()`, requires both `userId` and `sessionId`, and derives `external_id` and `key_name` from them. Assert that `users/route.ts` does not accept arbitrary hosted provisioning when Clerk is enabled.

- [ ] **Step 9: Run provisioning and dashboard checks**

Run: `python -m pytest api/test_hosted_provisioning.py api/test_workspace_auth.py -v`

Run: `npm run verify:clerk && npm run typecheck` from `dashboard/`.

Expected: all checks pass.

- [ ] **Step 10: Commit secure provisioning**

```bash
git add api/services/orgs.py api/services/users.py api/models/user.py api/models/org.py api/routes/users.py api/routes/orgs.py api/test_hosted_provisioning.py dashboard/src/app/api/engram/user-key/route.ts dashboard/src/app/api/engram/users/route.ts dashboard/src/components/ClerkEngramBridge.tsx dashboard/src/proxy.ts dashboard/scripts/verify-clerk-setup.mjs
git commit -m "feat: secure hosted workspace provisioning"
```

### Task 4: Add Workspace API-Key Lifecycle

**Files:**
- Modify: `api/models/user.py`
- Modify: `api/services/users.py`
- Modify: `api/routes/users.py`
- Create: `api/test_api_key_lifecycle.py`
- Modify: `dashboard/src/lib/api.ts`

- [ ] **Step 1: Write failing key lifecycle tests**

```python
async def test_create_list_and_revoke_workspace_key() -> None:
    created = await create_user_api_key("user-1", "org-1", "production", fake_db)

    assert created["api_key"].startswith("ek_")
    assert created["key"]["name"] == "production"

    keys = await list_user_api_keys("user-1", "org-1", fake_db)
    assert [key["name"] for key in keys] == ["production"]
    assert "api_key_hash" not in keys[0]

    assert await revoke_user_api_key("user-1", "org-1", created["key"]["id"], fake_db)
```

Add a second test that creates a key in `org-2` and proves a user authenticated to `org-1` cannot list or revoke it.

Add a duplicate-name test proving a second key named `production` in the same workspace returns HTTP `409` rather than exposing a database exception.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `python -m pytest api/test_api_key_lifecycle.py -v`

Expected: import failures because the lifecycle functions do not exist.

- [ ] **Step 3: Add key request and response models**

```python
class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ApiKeyResponse(BaseModel):
    id: UUID4
    name: str
    created_at: datetime
    last_used_at: datetime | None


class ApiKeyCreateResponse(ApiKeyResponse):
    api_key: str
```

- [ ] **Step 4: Implement scoped key functions**

Create these service interfaces:

```python
async def create_user_api_key(
    user_id: object,
    org_id: object,
    name: str,
    db: asyncpg.Connection,
) -> dict[str, object]:
```

```python
async def list_user_api_keys(
    user_id: object,
    org_id: object,
    db: asyncpg.Connection,
) -> list[dict[str, object]]:
```

```python
async def revoke_user_api_key(
    user_id: object,
    org_id: object,
    key_id: object,
    db: asyncpg.Connection,
) -> bool:
```

Create stores only `hash_api_key(api_key)` and returns plaintext once. List returns `id`, `name`, `created_at`, and `last_used_at`. Revoke filters by `id`, `user_id`, and `org_id`, then clears the auth cache for that user.

Convert `asyncpg.UniqueViolationError` for a duplicate `(user_id, org_id, name)` into `HTTPException(status_code=409, detail="An API key with this name already exists")` at the route boundary.

- [ ] **Step 5: Add authenticated routes**

Expose:

```text
GET    /users/me/api-keys
POST   /users/me/api-keys
DELETE /users/me/api-keys/{key_id}
```

Infer `user_id` and `org_id` only from `get_current_user`. Keep `/users/me/api-key` as a documented compatibility route for self-hosted clients, but do not use it in the hosted dashboard.

- [ ] **Step 6: Add dashboard API client contracts**

```typescript
export type ApiKeyRecord = {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
};

export type ApiKeyCreateResponse = ApiKeyRecord & {
  api_key: string;
};
```

Add `api.keys.list()`, `api.keys.create(name)`, and `api.keys.revoke(id)` through the existing request helper.

- [ ] **Step 7: Run API and dashboard checks**

Run: `python -m pytest api/test_api_key_lifecycle.py api/test_workspace_auth.py -v`

Run from `dashboard/`: `npm run typecheck`.

Expected: all checks pass.

- [ ] **Step 8: Commit key lifecycle support**

```bash
git add api/models/user.py api/services/users.py api/routes/users.py api/test_api_key_lifecycle.py dashboard/src/lib/api.ts
git commit -m "feat: manage workspace API keys"
```

### Task 5: Enforce Workspace Scope Across Stored Data

**Files:**
- Modify: `api/services/memories.py`
- Modify: `api/services/retrieval.py`
- Modify: `api/services/logs.py`
- Modify: `api/services/deduplication.py`
- Modify: `api/services/extraction.py`
- Modify: `api/services/graph.py`
- Modify: `api/routes/memories.py`
- Modify: `api/routes/logs.py`
- Modify: `api/routes/graph.py`
- Modify: `api/routes/proxy.py`
- Modify: `api/test_memories_service.py`
- Modify: `api/test_proxy_flow.py`
- Create: `api/test_workspace_scope.py`
- Create: `scripts/verify_workspace_isolation.py`

- [ ] **Step 1: Add failing service-scope tests**

For each service family, call one read and one write with `user_id="user-1"` and `org_id="org-1"`, then assert the captured SQL contains `org_id` and the argument list contains `org-1`:

```python
assert "org_id" in fake_db.last_query
assert "org-1" in fake_db.last_args
```

Cover memory create/list/get/update/delete/search/import/merge/decay/timeline, retrieval and log insertion, log reads, conversation writes, deduplication, entity extraction, and graph reads.

- [ ] **Step 2: Run the scope tests and verify they fail**

Run: `python -m pytest api/test_workspace_scope.py api/test_memories_service.py api/test_proxy_flow.py -v`

Expected: failures show service functions only filter by `user_id`.

- [ ] **Step 3: Add `org_id` immediately after `user_id` in service signatures**

Use this consistent ordering:

```python
async def create_memory(
    user_id: object,
    org_id: object,
    content: str,
    db: asyncpg.Connection,
) -> dict[str, object]:
```

Apply the same ordering to all public async functions in the six scoped service files. Route calls pass `user["id"]`, then `user["org_id"]`.

- [ ] **Step 4: Apply exact SQL scoping rules**

Every insert into `memories`, `retrieval_logs`, `conversations`, `memory_entities`, and `memory_relationships` includes both `user_id` and `org_id`. Every select, update, and delete over those tables includes:

```sql
WHERE user_id = $1
  AND org_id = $2
```

Parameter numbers after these fields shift consistently. Joins to `memories` also require the joined memory's `org_id`. Namespace predicates remain after workspace scope. For a resource identifier owned by another workspace, return `None` so routes respond with `404`.

Fix namespace listing by selecting `namespace` in `search_memory_rows_for_listing` before `filter_memory_rows` uses it.

- [ ] **Step 5: Carry workspace scope through proxy and extraction tasks**

Add `org_id: UUID` to `run_extraction_task`, `store_extracted_memories`, `reconcile_memories`, `record_conversation`, `mark_conversation_failed`, and graph extraction helpers. Include `org_id` in every scheduled task argument so a background task never re-resolves tenant scope from untrusted request data.

- [ ] **Step 6: Add an HTTP isolation verifier**

`scripts/verify_workspace_isolation.py` must create two hosted users through the service-key endpoint, write one memory per key, and assert each list/search/get endpoint sees only its own workspace. It must exit non-zero on a cross-workspace read and print `workspace isolation verified` on success.

- [ ] **Step 7: Run service and isolation tests**

Run: `python -m pytest api/test_workspace_scope.py api/test_memories_service.py api/test_proxy_flow.py -v`

Run with local services: `python scripts/verify_workspace_isolation.py`

Expected: tests pass and the verifier prints `workspace isolation verified`.

- [ ] **Step 8: Commit tenant enforcement**

```bash
git add api/services/memories.py api/services/retrieval.py api/services/logs.py api/services/deduplication.py api/services/extraction.py api/services/graph.py api/routes/memories.py api/routes/logs.py api/routes/graph.py api/routes/proxy.py api/test_workspace_scope.py api/test_memories_service.py api/test_proxy_flow.py scripts/verify_workspace_isolation.py
git commit -m "fix: enforce workspace isolation"
```

### Task 6: Release Database Connections Before Provider I/O

**Files:**
- Modify: `api/services/proxy.py`
- Modify: `api/routes/proxy.py`
- Modify: `api/services/extraction.py`
- Modify: `api/test_proxy_flow.py`
- Modify: `api/test_provider_and_extraction_parsing.py`
- Create: `api/test_proxy_connection_lifetime.py`

- [ ] **Step 1: Write failing connection-lifetime and streaming tests**

Use an event-recording fake pool and provider. Assert this exact order for non-streaming proxy calls:

```python
assert events == [
    "connection_acquired",
    "auth_and_retrieval_finished",
    "connection_released",
    "provider_started",
    "provider_finished",
]
```

Add tests that an upstream `401` is returned as `401` before a stream starts and that these SSE chunks produce assistant text `Hello world`:

```python
chunks = b'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\ndata: {"choices":[{"delta":{"content":"world"}}]}\n\ndata: [DONE]\n\n'
assert extract_assistant_response_text(chunks) == "Hello world"
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `python -m pytest api/test_proxy_connection_lifetime.py api/test_proxy_flow.py api/test_provider_and_extraction_parsing.py -v`

Expected: connection ordering and SSE parsing tests fail.

- [ ] **Step 3: Split proxy preparation from forwarding**

Replace `build_proxy_result` with a database-only preparation function returning this object:

```python
class PreparedProxyRequest:
    def __init__(
        self,
        body: dict[str, object],
        resolved: ResolvedProvider,
        conversation_id: UUID,
        injected_count: int,
    ) -> None:
        self.body = body
        self.resolved = resolved
        self.conversation_id = conversation_id
        self.injected_count = injected_count
```

The route acquires a connection, authenticates and prepares the request, exits the connection context, then calls `forward_to_provider`. Preserve the cached-auth passthrough path and all existing non-fatal retrieval behavior.

- [ ] **Step 4: Stream without buffering the provider response**

Open the upstream stream before constructing `StreamingResponse`. If `response.status_code >= 400`, read its body, close the upstream response/client, and return that status immediately. For successful responses, yield each chunk as received. Accumulate only extracted assistant text, not all raw bytes, for background extraction.

- [ ] **Step 5: Parse OpenAI-compatible and Anthropic SSE**

Extend `extract_assistant_response_text` to parse `data:` lines when the body is not a single JSON document. Collect OpenAI `choices[0].delta.content` strings and Anthropic `content_block_delta.delta.text` strings. Ignore `[DONE]`, blank lines, malformed events, and non-text deltas.

- [ ] **Step 6: Split extraction database phases**

`run_extraction_task` must:

1. Acquire a connection to record `running` and load the user/provider configuration.
2. Release the connection.
3. Call the extraction provider.
4. Reacquire a connection to reconcile, store memories, and mark `completed`.
5. On failure, acquire a short-lived connection only to mark `failed`.

Apply the same phase split to manual conversation capture so outbound extraction and reconciliation calls never hold a pool connection.

- [ ] **Step 7: Run proxy and extraction tests**

Run: `python -m pytest api/test_proxy_connection_lifetime.py api/test_proxy_flow.py api/test_provider_and_extraction_parsing.py api/test_capture_conversation.py -v`

Expected: all tests pass.

- [ ] **Step 8: Commit connection and streaming fixes**

```bash
git add api/services/proxy.py api/routes/proxy.py api/services/extraction.py api/test_proxy_connection_lifetime.py api/test_proxy_flow.py api/test_provider_and_extraction_parsing.py api/test_capture_conversation.py
git commit -m "fix: release database connections before model calls"
```

### Task 7: Complete Provider Support and Align Defaults

**Files:**
- Modify: `api/services/providers/factory.py`
- Modify: `api/services/users.py`
- Modify: `api/routes/users.py`
- Modify: `api/models/user.py`
- Modify: `api/test_provider_and_extraction_parsing.py`
- Modify: `dashboard/src/lib/api.ts`
- Modify: `dashboard/src/components/SettingsPanel.tsx`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add failing Anthropic extraction and default-alignment tests**

Assert `build_extraction_provider` accepts a resolved Anthropic provider, `UserProviderConfigUpdate` accepts `anthropic`, and `.env.example` plus README contain `BAAI/bge-small-en-v1.5` rather than `all-MiniLM-L6-v2`.

Add a provider-resolution test with `engram_service_key` configured, a server OpenAI key present, and no user or request key. It must raise `ProviderConfigError`. Add the inverse self-hosted test proving the existing server-key fallback still works when `engram_service_key` is empty.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `python -m pytest api/test_provider_and_extraction_parsing.py api/test_user_models.py -v`

Expected: Anthropic validation or provider construction fails.

- [ ] **Step 3: Add Anthropic to existing provider paths**

Use the existing OpenAI-compatible provider implementation only if it matches Anthropic's extraction endpoint. Otherwise add one focused `api/services/providers/anthropic.py` implementation of the existing `ExtractionProvider` contract. Extend the Pydantic pattern and dashboard union to:

```python
pattern="^(openai|gemini|ollama|anthropic)$"
```

```typescript
extraction_provider: "openai" | "gemini" | "ollama" | "anthropic";
```

Add `anthropic_api_key`, `clear_anthropic_key`, the Anthropic select option, and matching save/clear handling to the existing settings form.

In `resolve_user_provider`, allow a server-level paid provider key only when `settings.engram_service_key` is empty. Hosted OpenAI, Gemini, and Anthropic calls require an encrypted user key or `X-Engram-Provider-Key`. Ollama remains keyless. Return `ProviderConfigError("Configure a provider API key for this workspace")` instead of silently spending the server key.

Change provider-config reads and writes to accept `org_id` and select/update the provider columns on `orgs`, not `users`. Reads remain available to workspace members. Updates require `user["role"]` to be `owner` or `admin`; otherwise raise `HTTPException(status_code=403, detail="Only workspace owners and admins can change provider settings")`.

- [ ] **Step 4: Align the documented embedding model**

Set every example/default reference to `BAAI/bge-small-en-v1.5`, matching `api/config.py` and `api/Dockerfile`. Do not change the Azure image or deploy it.

- [ ] **Step 5: Run API and dashboard checks**

Run: `python -m pytest api/test_provider_and_extraction_parsing.py api/test_user_models.py -v`

Run: `npm run typecheck && npm run verify:logic` from `dashboard/`.

Expected: all checks pass.

- [ ] **Step 6: Commit provider and documentation fixes**

```bash
git add api/services/providers/factory.py api/services/providers/anthropic.py api/services/users.py api/routes/users.py api/models/user.py api/test_provider_and_extraction_parsing.py dashboard/src/lib/api.ts dashboard/src/components/SettingsPanel.tsx .env.example README.md
git commit -m "fix: align extraction providers and embedding defaults"
```

Omit `api/services/providers/anthropic.py` from the commit if the existing provider implementation is reused.

### Task 8: Run the Foundation Release Gate

**Files:**
- Modify: `api/config.py`
- Create: `api/test_hosted_config.py`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Reject wildcard CORS in hosted mode**

Add a Pydantic settings validation test proving `engram_service_key="service"` with `cors_origins="*"` is rejected, while local self-hosted settings can still use explicit localhost origins. Add a settings model validator that raises `ValueError("Hosted mode requires explicit CORS origins")` when a service key is configured and `*` appears in `cors_origin_list`.

- [ ] **Step 2: Add the workspace isolation verifier to CI-capable documentation**

Document that `scripts/verify_workspace_isolation.py` requires local Compose services and a service key. Keep CI on unit tests unless its PostgreSQL service is explicitly configured; do not add a paid hosted test resource.

- [ ] **Step 3: Run the complete local gate**

Run: `python -m compileall api`

Run: `python -m pytest api`

Run from `dashboard/`: `npm ci && npm run verify:clerk && npm run verify:logic && npm run typecheck && npm run build`

Run from `mcp/`: `npm ci && npm run build && npm run verify:defaults`

Run: `docker compose config`

Run with local services: `python scripts/verify_workspace_isolation.py`

Expected: every command exits `0`; API tests report no failures; dashboard and MCP builds succeed; Compose renders; isolation verifier prints `workspace isolation verified`.

- [ ] **Step 4: Audit for Azure changes**

Run: `git diff HEAD~6 -- docker-compose.yml docker-compose.supabase.yml docker-compose.dev.yml .github api/Dockerfile dashboard/Dockerfile mcp/Dockerfile`

Expected: no Azure resource, CPU, memory, replica, registry, or always-on configuration changes.

- [ ] **Step 5: Commit only release-gate documentation changes**

```bash
git add api/config.py api/test_hosted_config.py .github/workflows/ci.yml README.md
git commit -m "test: document SaaS foundation verification"
```

Skip this commit when neither file required a change.
