from collections.abc import Sequence
import json

import asyncpg


async def list_retrieval_logs(
    user_id: object, org_id: object, db: asyncpg.Connection, limit: int, offset: int,
    conversation_id: object | None, namespace: str | None = None, restrict_memories: bool = False,
) -> tuple[list[dict[str, object]], int]:
    rows = await db.fetch(
        """
        SELECT id, query, retrieved_memory_ids, retrieved_scores, conversation_id, created_at,
               namespace, injected_count, retrieval_mode, memory_snapshots
        FROM retrieval_logs WHERE user_id=$1 AND org_id=$2
          AND ($3::uuid IS NULL OR conversation_id=$3) AND ($4::text IS NULL OR namespace=$4)
        ORDER BY created_at DESC LIMIT $5 OFFSET $6
        """, user_id, org_id, conversation_id, namespace, limit, offset,
    )
    total = await db.fetchval(
        "SELECT count(*) FROM retrieval_logs WHERE user_id=$1 AND org_id=$2 AND ($3::uuid IS NULL OR conversation_id=$3) AND ($4::text IS NULL OR namespace=$4)",
        user_id, org_id, conversation_id, namespace,
    )
    return [await hydrate_log_row(user_id, org_id, row, db, namespace if restrict_memories else None) for row in rows], int(total)


async def get_retrieval_log(
    user_id: object, org_id: object, log_id: object, db: asyncpg.Connection, namespace: str | None = None, restrict_memories: bool = False,
) -> dict[str, object] | None:
    row = await db.fetchrow(
        "SELECT * FROM retrieval_logs WHERE user_id=$1 AND org_id=$2 AND id=$3 AND ($4::text IS NULL OR namespace=$4)",
        user_id, org_id, log_id, namespace,
    )
    if row is None:
        return None
    hydrated = await hydrate_log_row(user_id, org_id, row, db, namespace if restrict_memories else None)
    hydrated["query_embedding_dimensions"] = get_vector_dimensions(row["query_embedding"])
    return hydrated


async def list_clients(user_id: object, org_id: object, db: asyncpg.Connection, namespace: str | None = None) -> list[dict[str, object]]:
    rows = await db.fetch(
        """
        SELECT COALESCE(raw_exchange->'request'->>'source', 'proxy') AS source,
               COUNT(*)::int AS conversations,COALESCE(SUM(memories_extracted),0)::int AS memories_extracted,MAX(created_at) AS last_seen
        FROM conversations WHERE user_id=$1 AND org_id=$2 AND ($3::text IS NULL OR namespace=$3)
        GROUP BY source ORDER BY last_seen DESC
        """, user_id, org_id, namespace,
    )
    return [dict(row) for row in rows]


async def hydrate_log_row(
    user_id: object,
    org_id: object,
    row: asyncpg.Record,
    db: asyncpg.Connection,
    restricted_namespace: str | None = None,
) -> dict[str, object]:
    memory_ids = list(row["retrieved_memory_ids"])
    raw_snapshots = row.get("memory_snapshots")
    snapshots = json.loads(raw_snapshots) if isinstance(raw_snapshots, str) else raw_snapshots
    content_by_id = {
        str(item["memory_id"]): item.get("content")
        for item in snapshots
        if restricted_namespace is None or item.get("namespace") == restricted_namespace
    } if isinstance(snapshots, list) else await get_memory_content_map(user_id, org_id, memory_ids, db, restricted_namespace or row.get("namespace", "default"))
    scores = list(row["retrieved_scores"])
    retrieved_memories = [
        {
            "memory_id": memory_id,
            "content": content_by_id.get(str(memory_id)),
            "score": float(scores[index]) if index < len(scores) else 0.0,
        }
        for index, memory_id in enumerate(memory_ids)
    ]
    return {
        "id": row["id"],
        "query": row["query"],
        "retrieved_memories": retrieved_memories,
        "conversation_id": row["conversation_id"],
        "created_at": row["created_at"],
        "namespace": row.get("namespace", "default"),
        "injected_count": row.get("injected_count", 0),
        "retrieval_mode": row.get("retrieval_mode", "vector"),
    }


async def get_memory_content_map(
    user_id: object,
    org_id: object,
    memory_ids: Sequence[object],
    db: asyncpg.Connection,
    namespace: str,
) -> dict[str, str]:
    if not memory_ids:
        return {}
    rows = await db.fetch(
        """
        SELECT id, content
        FROM memories
        WHERE user_id = $1
          AND org_id = $2
          AND id = ANY($3::uuid[])
          AND namespace = $4
        """,
        user_id,
        org_id,
        list(memory_ids),
        namespace,
    )
    return {str(row["id"]): row["content"] for row in rows}


def get_vector_dimensions(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, list):
        return len(value)
    if isinstance(value, tuple):
        return len(value)
    if isinstance(value, str):
        cleaned = value.strip("[]")
        if not cleaned:
            return 0
        return len(cleaned.split(","))
    return None
