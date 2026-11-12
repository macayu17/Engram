from datetime import UTC, datetime
from typing import Literal

import asyncpg

from api.config import settings


QuotaResource = Literal["members", "memories", "retrievals"]


class QuotaExceeded(RuntimeError):
    def __init__(self, resource: QuotaResource, current: int, limit: int) -> None:
        self.resource = resource
        self.current = current
        self.limit = limit
        super().__init__(f"{resource} limit reached ({current}/{limit})")


def workspace_limits() -> dict[str, int]:
    return {
        "members": settings.workspace_member_limit,
        "memories": settings.workspace_memory_limit,
        "retrievals": settings.workspace_monthly_retrieval_limit,
    }


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
        SELECT (SELECT count(*) FROM org_memberships WHERE org_id = orgs.id) AS members,
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
    return {
        "period_start": period_start,
        "members": int(row["members"]),
        "memories": int(row["memories"]),
        "retrievals": int(row["retrievals"]),
        "limits": workspace_limits(),
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
    enforce_limit(resource, int(usage[resource]), workspace_limits()[resource], amount)
    return usage
