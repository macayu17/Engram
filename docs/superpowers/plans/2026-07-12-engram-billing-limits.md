# Engram Billing and Usage Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace plans, Stripe billing, visible usage, and server-enforced Free and Pro limits without introducing new Azure infrastructure.

**Architecture:** The FastAPI service owns subscription state, usage counting, entitlement checks, and Stripe webhooks. The dashboard proves Clerk identity and calls service-key-protected API endpoints for Checkout and Customer Portal URLs. Existing indexed memory and retrieval tables provide usage counts, so no metering service or rollup table is added.

**Tech Stack:** Python 3.11, FastAPI, asyncpg, PostgreSQL, Stripe Python 15.3.0, pytest, Next.js 16, Clerk, TypeScript

**Prerequisite:** Complete `docs/superpowers/plans/2026-07-12-engram-saas-foundation.md` first.

---

## File Map

- Modify `api/db/schema.sql` for workspace billing fields and webhook idempotency.
- Create `api/services/entitlements.py` for plan constants, usage queries, and quota checks.
- Create `api/services/billing.py` for Stripe Checkout, Customer Portal, and webhook state transitions.
- Create `api/models/billing.py` and `api/routes/billing.py` for typed billing endpoints.
- Modify `api/config.py`, `api/main.py`, and `api/requirements.txt` for billing configuration and routing.
- Modify memory and proxy write paths to enforce limits before expensive work.
- Create dashboard server routes for authenticated Checkout and Portal requests.
- Extend `dashboard/src/lib/api.ts` with workspace usage and billing contracts.
- Add focused API tests and dashboard source verification.

### Task 1: Add Minimal Billing State to Workspaces

**Files:**
- Modify: `api/db/schema.sql`
- Create: `api/test_billing_schema.py`

- [ ] **Step 1: Write the failing schema test**

```python
from pathlib import Path


def test_workspace_billing_columns_and_event_table_exist() -> None:
    schema = (Path(__file__).resolve().parent / "db" / "schema.sql").read_text(encoding="utf-8")

    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS plan TEXT" in schema
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT" in schema
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT" in schema
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS subscription_status TEXT" in schema
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ" in schema
    assert "CREATE TABLE IF NOT EXISTS stripe_events" in schema
    assert "event_id TEXT PRIMARY KEY" in schema
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `python -m pytest api/test_billing_schema.py -v`

Expected: failure because billing fields do not exist.

- [ ] **Step 3: Add workspace billing fields and event idempotency**

```sql
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orgs_plan_check') THEN
        ALTER TABLE orgs ADD CONSTRAINT orgs_plan_check CHECK (plan IN ('free', 'pro'));
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS orgs_stripe_customer_id_idx
ON orgs(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orgs_stripe_subscription_id_idx
ON orgs(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_events (
    event_id TEXT PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 4: Run schema tests**

Run: `python -m pytest api/test_billing_schema.py api/test_workspace_schema.py api/test_schema_security.py -v`

Expected: all tests pass.

- [ ] **Step 5: Commit billing schema**

```bash
git add api/db/schema.sql api/test_billing_schema.py
git commit -m "feat: add workspace subscription state"
```

### Task 2: Implement Plans, Usage, and Quota Checks

**Files:**
- Create: `api/services/entitlements.py`
- Create: `api/models/billing.py`
- Create: `api/test_entitlements.py`

- [ ] **Step 1: Write failing plan and quota tests**

```python
import pytest

from api.services.entitlements import PLAN_LIMITS, QuotaExceeded, enforce_limit


def test_plan_limits_match_launch_contract() -> None:
    assert PLAN_LIMITS["free"].members == 1
    assert PLAN_LIMITS["free"].memories == 2_000
    assert PLAN_LIMITS["free"].retrievals == 10_000
    assert PLAN_LIMITS["pro"].members == 5
    assert PLAN_LIMITS["pro"].memories == 50_000
    assert PLAN_LIMITS["pro"].retrievals == 250_000


def test_limit_allows_last_available_unit() -> None:
    enforce_limit("memories", current=1_999, limit=2_000)


def test_limit_rejects_next_unit() -> None:
    with pytest.raises(QuotaExceeded) as raised:
        enforce_limit("memories", current=2_000, limit=2_000)

    assert raised.value.resource == "memories"
    assert raised.value.current == 2_000
    assert raised.value.limit == 2_000
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `python -m pytest api/test_entitlements.py -v`

Expected: import failure because the entitlements module does not exist.

- [ ] **Step 3: Implement the smallest entitlement module**

```python
from dataclasses import dataclass
from datetime import UTC, datetime

import asyncpg


@dataclass(frozen=True)
class PlanLimits:
    members: int
    memories: int
    retrievals: int


PLAN_LIMITS = {
    "free": PlanLimits(members=1, memories=2_000, retrievals=10_000),
    "pro": PlanLimits(members=5, memories=50_000, retrievals=250_000),
}


class QuotaExceeded(RuntimeError):
    def __init__(self, resource: str, current: int, limit: int) -> None:
        self.resource = resource
        self.current = current
        self.limit = limit
        super().__init__(f"{resource} limit reached ({current}/{limit})")


def enforce_limit(resource: str, current: int, limit: int) -> None:
    if current >= limit:
        raise QuotaExceeded(resource, current, limit)


async def get_workspace_usage(org_id: object, db: asyncpg.Connection) -> dict[str, object]:
    period_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    row = await db.fetchrow(
        """
        SELECT o.plan,
               o.subscription_status,
               o.current_period_end,
               (SELECT count(*) FROM org_memberships WHERE org_id = o.id) AS members,
               (SELECT count(*) FROM memories WHERE org_id = o.id) AS memories,
               (SELECT count(*) FROM retrieval_logs
                WHERE org_id = o.id
                  AND created_at >= $2) AS retrievals
        FROM orgs o
        WHERE o.id = $1
        """,
        org_id,
        period_start,
    )
    if row is None:
        raise RuntimeError("Workspace not found")
    plan = str(row["plan"])
    limits = PLAN_LIMITS[plan]
    return {
        "plan": plan,
        "subscription_status": str(row["subscription_status"]),
        "current_period_end": row["current_period_end"],
        "period_start": period_start,
        "members": int(row["members"]),
        "memories": int(row["memories"]),
        "retrievals": int(row["retrievals"]),
        "limits": {
            "members": limits.members,
            "memories": limits.memories,
            "retrievals": limits.retrievals,
        },
    }
```

Add `enforce_workspace_limit(org_id, resource, db)` that calls `get_workspace_usage`, selects the matching current value and limit, then calls `enforce_limit`.

- [ ] **Step 4: Add typed usage and billing models**

```python
from datetime import datetime

from pydantic import BaseModel, HttpUrl


class UsageValues(BaseModel):
    members: int
    memories: int
    retrievals: int


class WorkspaceUsageResponse(BaseModel):
    plan: str
    subscription_status: str
    period_start: datetime
    current_period_end: datetime | None
    members: int
    memories: int
    retrievals: int
    limits: UsageValues


class BillingUrlResponse(BaseModel):
    url: HttpUrl
```

- [ ] **Step 5: Run entitlement tests**

Run: `python -m pytest api/test_entitlements.py -v`

Expected: all tests pass.

- [ ] **Step 6: Commit entitlements**

```bash
git add api/services/entitlements.py api/models/billing.py api/test_entitlements.py
git commit -m "feat: add workspace usage entitlements"
```

### Task 3: Enforce Quotas Before Expensive Work

**Files:**
- Modify: `api/routes/memories.py`
- Modify: `api/routes/proxy.py`
- Modify: `api/routes/orgs.py`
- Modify: `api/services/entitlements.py`
- Create: `api/test_quota_enforcement.py`

- [ ] **Step 1: Write failing boundary tests**

Test that memory creation rejects at 2,000 Free memories before `embed` is called, proxy retrieval rejects at 10,000 monthly retrievals before provider forwarding, and adding a second Free member rejects before inserting a membership.

Add a concurrent boundary test that starts two writes at `limit - 1` and asserts exactly one succeeds. This proves quota checks cannot be bypassed by racing requests.

Use this assertion for each path:

```python
assert response.status_code == 429
assert response.json()["detail"] == "memories limit reached (2000/2000)"
assert expensive_operation.call_count == 0
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `python -m pytest api/test_quota_enforcement.py -v`

Expected: requests proceed because quota checks are not wired.

- [ ] **Step 3: Add one HTTP conversion helper**

```python
def quota_http_exception(error: QuotaExceeded) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail=str(error),
        headers={
            "X-Engram-Quota-Resource": error.resource,
            "X-Engram-Quota-Current": str(error.current),
            "X-Engram-Quota-Limit": str(error.limit),
        },
    )
```

- [ ] **Step 4: Enforce limits at write boundaries**

Call `enforce_workspace_limit` before:

- `create_memory_route`, `import_memories_route`, and extraction storage insert new memories.
- proxy retrieval begins when injection is enabled.
- `add_member` inserts or promotes a membership that would increase member count.

Do not block reads, exports, deletes, key revocation, billing, or account access. Import checks `current + len(payload.memories) > limit` in one query rather than checking each row.

For the final count-and-write boundary, start a database transaction and lock the workspace row:

```sql
SELECT id FROM orgs WHERE id = $1 FOR UPDATE
```

Recount after acquiring the lock, enforce the limit, then insert the memory, retrieval log, or membership before committing. Expensive embedding and provider calls remain outside this lock: memory paths perform an early check before embedding and a locked recheck before insert; proxy paths reserve usage by inserting the retrieval log in the locked transaction before forwarding to the provider.

- [ ] **Step 5: Run quota and existing flow tests**

Run: `python -m pytest api/test_quota_enforcement.py api/test_memories_service.py api/test_proxy_flow.py api/test_hosted_provisioning.py -v`

Expected: all tests pass.

- [ ] **Step 6: Commit quota enforcement**

```bash
git add api/routes/memories.py api/routes/proxy.py api/routes/orgs.py api/services/entitlements.py api/test_quota_enforcement.py
git commit -m "feat: enforce workspace plan limits"
```

### Task 4: Implement Stripe Checkout, Portal, and Webhooks

**Files:**
- Modify: `api/config.py`
- Modify: `api/requirements.txt`
- Create: `api/services/billing.py`
- Create: `api/routes/billing.py`
- Modify: `api/main.py`
- Create: `api/test_billing_service.py`
- Create: `api/test_billing_routes.py`

- [ ] **Step 1: Pin the Stripe SDK and add configuration**

Add `stripe==15.3.0` to `api/requirements.txt`.

Add these settings:

```python
stripe_secret_key: str = ""
stripe_webhook_secret: str = ""
stripe_pro_price_id: str = ""
dashboard_url: str = "http://localhost:3001"
```

- [ ] **Step 2: Write failing billing service tests**

Mock `stripe.checkout.Session.create`, `stripe.billing_portal.Session.create`, and `stripe.Webhook.construct_event`. Cover owner-only Checkout/Portal access, metadata containing the workspace ID, webhook signature rejection, duplicate event IDs, active Pro updates, canceled-at-period-end retention, and downgrade after subscription deletion.

- [ ] **Step 3: Run the billing tests and verify they fail**

Run: `python -m pytest api/test_billing_service.py api/test_billing_routes.py -v`

Expected: import failure because billing service and routes do not exist.

- [ ] **Step 4: Implement billing service functions**

Create these exact async interfaces:

```python
async def create_checkout_url(org_id: object, user_id: object, db: asyncpg.Connection) -> str:
```

```python
async def create_portal_url(org_id: object, user_id: object, db: asyncpg.Connection) -> str:
```

```python
async def process_stripe_event(payload: bytes, signature: str, db: asyncpg.Connection) -> None:
```

Checkout verifies an owner membership, reuses or creates a Stripe customer, and creates a subscription Checkout session using `settings.stripe_pro_price_id`. Put `org_id` in customer and subscription metadata. Portal verifies owner membership and requires an existing customer.

The Stripe SDK methods are synchronous. Call customer, Checkout, and Portal API operations through `await asyncio.to_thread(...)` so FastAPI's event loop is not blocked. Webhook signature construction can remain inline because it performs local verification only.

Webhook processing must call `stripe.Webhook.construct_event` before parsing fields. Inside one database transaction, insert the event ID with `ON CONFLICT DO NOTHING`; return immediately when it already exists. Handle `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Active/trialing subscriptions set `plan='pro'`; deletion sets `plan='free'`, `subscription_status='canceled'`, and clears the subscription ID after recording the final period end.

- [ ] **Step 5: Add typed routes**

Expose:

```text
GET  /billing/usage
POST /billing/checkout
POST /billing/portal
POST /billing/webhook
```

Usage uses normal API-key auth. Checkout and Portal require `X-Engram-Service-Key` plus an `external_id` and `org_id` payload supplied by the authenticated dashboard server. Webhook requires no Engram key and validates `Stripe-Signature` using the raw request body.

- [ ] **Step 6: Register the billing router**

```python
from api.routes import billing, graph, logs, memories, orgs, proxy, users

app.include_router(billing.router, prefix="/billing", tags=["billing"])
```

- [ ] **Step 7: Run billing and full API tests**

Run: `python -m pytest api/test_billing_service.py api/test_billing_routes.py api/test_entitlements.py api/test_quota_enforcement.py -v`

Expected: all tests pass.

- [ ] **Step 8: Commit Stripe billing**

```bash
git add api/config.py api/requirements.txt api/services/billing.py api/routes/billing.py api/models/billing.py api/main.py api/test_billing_service.py api/test_billing_routes.py
git commit -m "feat: add Stripe workspace billing"
```

### Task 5: Add Authenticated Dashboard Billing Bridges

**Files:**
- Create: `dashboard/src/app/api/billing/checkout/route.ts`
- Create: `dashboard/src/app/api/billing/portal/route.ts`
- Modify: `dashboard/src/lib/api.ts`
- Create: `dashboard/scripts/verify-billing-setup.mjs`
- Modify: `dashboard/package.json`

- [ ] **Step 1: Add failing source verification**

The script must assert both route files import `auth` from `@clerk/nextjs/server`, reject missing `userId`, send `X-Engram-Service-Key`, derive `external_id` from `userId`, and never accept an external ID from the request body.

- [ ] **Step 2: Run the verifier and confirm it fails**

Run from `dashboard/`: `node scripts/verify-billing-setup.mjs`

Expected: failure because the routes do not exist.

- [ ] **Step 3: Implement the Checkout bridge**

The route calls `auth()`, rejects an unsigned user, accepts only `orgId` from the body, and posts this server-derived payload to `/billing/checkout`:

```typescript
{
  external_id: `clerk:${userId}`,
  org_id: orgId,
}
```

Return `{ url }` from the API. Use the existing hosted API URL and service-key validation pattern from `api/engram/user-key/route.ts`.

- [ ] **Step 4: Implement the Portal bridge**

Use the same authenticated contract and post to `/billing/portal`. No Stripe secret or price ID belongs in the dashboard.

- [ ] **Step 5: Add API client contracts**

```typescript
export type WorkspaceUsage = {
  plan: "free" | "pro";
  subscription_status: string;
  period_start: string;
  current_period_end: string | null;
  members: number;
  memories: number;
  retrievals: number;
  limits: {
    members: number;
    memories: number;
    retrievals: number;
  };
};
```

Add `api.billing.usage()`, `api.billing.checkout(orgId)`, and `api.billing.portal(orgId)`. Checkout and Portal use `requestInternal`; usage uses the Engram API key.

- [ ] **Step 6: Register and run the billing verifier**

Add `"verify:billing": "node scripts/verify-billing-setup.mjs"` to dashboard scripts.

Run: `npm run verify:billing && npm run typecheck && npm run build` from `dashboard/`.

Expected: all checks pass.

- [ ] **Step 7: Commit dashboard billing bridges**

```bash
git add dashboard/src/app/api/billing/checkout/route.ts dashboard/src/app/api/billing/portal/route.ts dashboard/src/lib/api.ts dashboard/scripts/verify-billing-setup.mjs dashboard/package.json
git commit -m "feat: connect dashboard workspace billing"
```

### Task 6: Document Billing Configuration and Verify Cost Boundaries

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add environment documentation**

Document `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, and `DASHBOARD_URL`. State that customers provide extraction-provider keys and that no Engram-funded model fallback is enabled for hosted workspaces.

- [ ] **Step 2: Run the complete billing gate**

Run: `python -m pytest api`

Run from `dashboard/`: `npm run verify:clerk && npm run verify:billing && npm run verify:logic && npm run typecheck && npm run build`

Run: `docker compose config`

Expected: all commands exit `0`.

- [ ] **Step 3: Verify no Azure expansion**

Run: `git diff HEAD~5 -- docker-compose.yml docker-compose.supabase.yml docker-compose.dev.yml api/Dockerfile dashboard/Dockerfile mcp/Dockerfile`

Expected: no resource sizing, replica, registry, storage, queue, cache, or new service changes.

- [ ] **Step 4: Commit billing documentation**

```bash
git add .env.example README.md
git commit -m "docs: document SaaS billing configuration"
```
