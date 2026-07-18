# Memory Conflict Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Preserve memory history and route genuine contradictory claims to user review without allowing unresolved proposals into retrieval.

**Architecture:** Reuse pending memories as conflict proposals, add one link table for conflict state and one compact revision table for overwritten values, and extend the existing reconciliation parser and Memories review UI. Conflict resolution remains synchronous and transactional in the FastAPI service; approved-only retrieval remains unchanged.

**Tech Stack:** PostgreSQL 16 with pgvector, asyncpg, FastAPI, Pydantic v2, pytest, Next.js App Router, React Query, TypeScript, Tailwind CSS.

---

## File Map

- Modify `api/db/schema.sql`: add revision and conflict tables, indexes, constraints, and server-only RLS.
- Modify `api/models/memory.py`: define conflict resolution request and response contracts.
- Modify `api/services/deduplication.py`: snapshot a memory before similarity refinement replaces it.
- Modify `api/services/extraction.py`: parse `CONFLICT`, persist a pending proposal, link it to the approved memory, and snapshot automatic updates.
- Modify `api/services/memories.py`: list and transactionally resolve conflicts.
- Modify `api/routes/memories.py`: expose conflict list and resolution endpoints before the dynamic memory routes.
- Modify `api/test_reconciliation.py`: verify parser and storage behavior.
- Create `api/test_memory_conflicts.py`: verify scoped conflict listing and all resolution transitions with an asyncpg-compatible fake connection.
- Modify `dashboard/src/lib/api.ts`: add conflict types and API methods.
- Create `dashboard/src/components/MemoryConflictReview.tsx`: render old and proposed claims with resolution actions.
- Modify `dashboard/src/components/MemoryWorkspace.tsx`: query and resolve conflicts in the existing review area.
- Create `dashboard/scripts/verify-memory-conflicts.mjs`: statically verify the dashboard contract without adding a test dependency.
- Modify `dashboard/package.json`: expose `verify:conflicts`.

### Task 1: Persistence Schema

- [x] **Step 1: Write a failing schema contract test**

Create `api/test_memory_conflicts.py` with a test that reads `api/db/schema.sql` and asserts it contains both tables, the three resolution values, foreign keys to both memory rows, and both table names in the RLS policy list.

- [x] **Step 2: Run the schema test and verify failure**

Run: `F:\Engram\.venv\Scripts\python.exe -m pytest api/test_memory_conflicts.py -q`

Expected: failure because `memory_revisions` and `memory_conflicts` do not exist.

- [x] **Step 3: Add the minimal schema**

Add `memory_revisions` with `id`, `org_id`, `user_id`, `memory_id`, `content`, `source_conversation_id`, `status`, `category`, `source`, and `created_at`. Add `memory_conflicts` with `id`, ownership columns, `existing_memory_id`, `proposed_memory_id`, `status`, `resolution`, `created_at`, and `resolved_at`. Add checks, ownership/status indexes, RLS, and both names to the server-access policy loop.

- [x] **Step 4: Run the schema test and full API suite**

Run: `F:\Engram\.venv\Scripts\python.exe -m pytest api/test_memory_conflicts.py api/test_reconciliation.py -q`

Expected: all selected tests pass.

- [x] **Step 5: Commit**

```powershell
git add api/db/schema.sql api/test_memory_conflicts.py
git commit -m "feat: add memory conflict persistence"
```

### Task 2: Conflict-Aware Reconciliation

- [x] **Step 1: Add failing parser and storage tests**

Extend `api/test_reconciliation.py` so `parse_reconcile_decisions` maps `CONFLICT <known_uuid>` to `("conflict", target)` and falls back to `("add", None)` for invalid or unknown IDs. Add an async test using an asyncpg-compatible fake connection that proves conflict storage inserts a pending proposal and an open link without calling in-place update logic.

- [x] **Step 2: Run the focused tests and verify failure**

Run: `F:\Engram\.venv\Scripts\python.exe -m pytest api/test_reconciliation.py -q`

Expected: parser and storage tests fail because conflict is not an accepted action.

- [x] **Step 3: Extend the prompt, parser, and persistence path**

Update `RECONCILE_PROMPT` to distinguish safe `UPDATE` from ambiguous `CONFLICT`. Reuse the target parser for both actions. Add a direct pending-proposal insert followed by an open conflict insert inside the existing extraction transaction. Count the proposal as stored and return its ID for graph extraction only after successful insertion.

- [x] **Step 4: Snapshot automatic updates**

Add `record_memory_revision` in `api/services/deduplication.py`. Call it before the refinement update and before `apply_memory_update`. The snapshot query must scope by memory, user, and organization and insert from the current memory row in the same transaction.

- [x] **Step 5: Run focused and full API tests**

Run: `F:\Engram\.venv\Scripts\python.exe -m pytest api/test_reconciliation.py api/test_memory_conflicts.py -q`

Run: `F:\Engram\.venv\Scripts\python.exe -m pytest api -q`

Expected: all tests pass with the existing optional skips only.

- [x] **Step 6: Commit**

```powershell
git add api/services/deduplication.py api/services/extraction.py api/test_reconciliation.py api/test_memory_conflicts.py
git commit -m "feat: preserve contradictory memory proposals"
```

### Task 3: Conflict Resolution API

- [x] **Step 1: Add failing service tests**

In `api/test_memory_conflicts.py`, add tests for `accept_new`, `keep_old`, and `keep_both`. Each test must assert the exact status changes, conflict resolution value, ownership filters, and rejection of a missing or already-resolved conflict.

- [x] **Step 2: Run the service tests and verify failure**

Run: `F:\Engram\.venv\Scripts\python.exe -m pytest api/test_memory_conflicts.py -q`

Expected: import or assertion failures because list and resolution services do not exist.

- [x] **Step 3: Add Pydantic contracts and memory service functions**

Define `MemoryConflictResolution = Literal["accept_new", "keep_old", "keep_both"]`, a request model with `resolution`, a conflict response containing the existing and proposed `MemoryResponse`, and a list response. Implement `list_memory_conflicts` and `resolve_memory_conflict` in `api/services/memories.py` with user/org scoping, row locks, exact state transitions, and one transaction owned by the route.

- [x] **Step 4: Add routes**

Add `GET /memories/conflicts` and `POST /memories/conflicts/{conflict_id}/resolve` before `/{memory_id}`. Return 404 for missing or resolved conflicts and the resolved conflict response on success.

- [x] **Step 5: Run focused and full API tests**

Run: `F:\Engram\.venv\Scripts\python.exe -m pytest api/test_memory_conflicts.py api/test_reconciliation.py -q`

Run: `F:\Engram\.venv\Scripts\python.exe -m pytest api -q`

Expected: all tests pass with the existing optional skips only.

- [x] **Step 6: Commit**

```powershell
git add api/models/memory.py api/services/memories.py api/routes/memories.py api/test_memory_conflicts.py
git commit -m "feat: resolve memory conflicts"
```

### Task 4: Dashboard Review Controls

- [x] **Step 1: Add a failing dashboard contract check**

Create `dashboard/scripts/verify-memory-conflicts.mjs` using `node:assert/strict` and source reads. Assert that `api.ts` exposes conflict list and resolution calls, `MemoryConflictReview.tsx` renders all three actions, and `MemoryWorkspace.tsx` invalidates both memory and conflict queries after resolution.

- [x] **Step 2: Run the contract check and verify failure**

Run: `npm run verify:conflicts`

Expected: failure because the script or feature files are absent.

- [x] **Step 3: Add API types and methods**

Add `MemoryConflict`, `MemoryConflictListResponse`, and `MemoryConflictResolution` to `dashboard/src/lib/api.ts`. Add `api.memories.conflicts()` and `api.memories.resolveConflict(id, resolution)` through the shared request helper.

- [x] **Step 4: Add the review component and workspace integration**

Render the current and proposed content side by side with `Use new`, `Keep current`, and `Keep both` buttons. Query open conflicts in `MemoryWorkspace`, show them before ordinary pending items, disable actions while resolving, display request errors, and invalidate `['memories']` plus `['memories', 'conflicts']` on success.

- [x] **Step 5: Run dashboard verification**

Run: `npm run verify:conflicts`

Run: `npm run typecheck`

Run: `npm run verify:logic`

Expected: all commands pass.

- [x] **Step 6: Commit**

```powershell
git add dashboard/package.json dashboard/scripts/verify-memory-conflicts.mjs dashboard/src/lib/api.ts dashboard/src/components/MemoryConflictReview.tsx dashboard/src/components/MemoryWorkspace.tsx
git commit -m "feat: review memory conflicts in dashboard"
```

### Task 5: End-To-End Verification

- [x] **Step 1: Run all API tests**

Run: `F:\Engram\.venv\Scripts\python.exe -m pytest api -q`

Expected: all tests pass with only the repository's existing optional skips.

- [x] **Step 2: Run all dashboard checks**

Run: `npm run typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run verify:logic; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run verify:conflicts`

Expected: all checks pass.

- [x] **Step 3: Review scope and cost impact**

Run: `git diff origin/main...HEAD --stat` and `git diff origin/main...HEAD -- . ':!docs/superpowers'`.

Expected: changes are limited to schema, API conflict behavior, tests, dashboard review controls, and documentation; no Docker, Azure, deployment, model, or environment configuration changes.

- [x] **Step 4: Check worktree state**

Run: `git status --short`

Expected: no uncommitted files.
