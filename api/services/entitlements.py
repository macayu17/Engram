from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

import asyncpg


QuotaResource = Literal["members", "memories", "retrievals"]


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
    def __init__(self, resource: QuotaResource, current: int, limit: int) -> None:
        self.resource = resource
        self.current = current
        self.limit = limit
        super().__init__(f"{resource} limit reached ({current}/{limit})")


def quota_headers(error: QuotaExceeded) -> dict[str, str]:
    return {
        "X-Engram-Quota-Resource": error.resource,
        "X-Engram-Quota-Current": str(error.current),
        "X-Engram-Quota-Limit": str(error.limit),
    }


def enforce_limit(resource: QuotaResource, current: int, limit: int, amount: int = 1) -> None:
    if current + amount > limit:
        raise QuotaExceeded(resource, current, limit)


def remaining_capacity(usage: dict[str, object], resource: QuotaResource) -> int:
    limits = usage["limits"]
    if not isinstance(limits, dict):
        raise RuntimeError("Workspace limits are invalid")
    return max(0, int(limits[resource]) - int(usage[resource]))


async def get_workspace_usage(org_id: object, db: asyncpg.Connection) -> dict[str, object]:
    period_start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    row = await db.fetchrow(
        """
        SELECT orgs.plan,
               orgs.subscription_status,
               orgs.current_period_end,
               (SELECT count(*) FROM org_memberships WHERE org_id = orgs.id) AS members,
               (SELECT count(*) FROM memories WHERE org_id = orgs.id) AS memories,
               (SELECT count(*) FROM retrieval_logs
                WHERE org_id = orgs.id AND created_at >= $2) AS retrievals
        FROM orgs
        WHERE orgs.id = $1
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


async def enforce_workspace_limit(
    org_id: object,
    resource: QuotaResource,
    db: asyncpg.Connection,
    amount: int = 1,
) -> dict[str, object]:
    workspace_exists = await db.fetchval(
        "SELECT id FROM orgs WHERE id = $1 FOR UPDATE",
        org_id,
    )
    if workspace_exists is None:
        raise RuntimeError("Workspace not found")
    usage = await get_workspace_usage(org_id, db)
    limits = usage["limits"]
    if not isinstance(limits, dict):
        raise RuntimeError("Workspace limits are invalid")
    enforce_limit(resource, int(usage[resource]), int(limits[resource]), amount)
    return usage
