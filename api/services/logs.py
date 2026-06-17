from collections.abc import Sequence

import asyncpg


async def list_retrieval_logs(
    user_id: object,
    db: asyncpg.Connection,
    limit: int,
    offset: int,
    conversation_id: object | None,
) -> tuple[list[dict[str, object]], int]:
    if conversation_id is None:
        rows = await db.fetch(
            """
            SELECT id, query, retrieved_memory_ids, retrieved_scores, conversation_id, created_at
            FROM retrieval_logs
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            OFFSET $3
            """,
            user_id,
            limit,
            offset,
        )
        total = await db.fetchval(
            """
            SELECT COUNT(*)
            FROM retrieval_logs
            WHERE user_id = $1
            """,
            user_id,
        )
    else:
        rows = await db.fetch(
            """
            SELECT id, query, retrieved_memory_ids, retrieved_scores, conversation_id, created_at
            FROM retrieval_logs
            WHERE user_id = $1
              AND conversation_id = $2
            ORDER BY created_at DESC
            LIMIT $3
            OFFSET $4
            """,
            user_id,
            conversation_id,
            limit,
            offset,
        )
        total = await db.fetchval(
            """
            SELECT COUNT(*)
            FROM retrieval_logs
            WHERE user_id = $1
              AND conversation_id = $2
            """,
            user_id,
            conversation_id,
        )
    return [await hydrate_log_row(user_id, row, db) for row in rows], int(total)


async def get_retrieval_log(
    user_id: object,
    log_id: object,
    db: asyncpg.Connection,
) -> dict[str, object] | None:
    row = await db.fetchrow(
        """
        SELECT id, query, query_embedding, retrieved_memory_ids, retrieved_scores, conversation_id, created_at
        FROM retrieval_logs
        WHERE user_id = $1
          AND id = $2
        """,
        user_id,
        log_id,
    )
    if row is None:
        return None
    hydrated = await hydrate_log_row(user_id, row, db)
    hydrated["query_embedding_dimensions"] = get_vector_dimensions(row["query_embedding"])
    return hydrated


async def list_clients(user_id: object, db: asyncpg.Connection) -> list[dict[str, object]]:
    rows = await db.fetch(
        """
        SELECT COALESCE(raw_exchange->'request'->>'source', 'proxy') AS source,
               COUNT(*)::int AS conversations,
               COALESCE(SUM(memories_extracted), 0)::int AS memories_extracted,
               MAX(created_at) AS last_seen
        FROM conversations
        WHERE user_id = $1
        GROUP BY source
        ORDER BY last_seen DESC
        """,
        user_id,
    )
    return [dict(row) for row in rows]


async def hydrate_log_row(user_id: object, row: asyncpg.Record, db: asyncpg.Connection) -> dict[str, object]:
    memory_ids = list(row["retrieved_memory_ids"])
    content_by_id = await get_memory_content_map(user_id, memory_ids, db)
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
    }


async def get_memory_content_map(
    user_id: object,
    memory_ids: Sequence[object],
    db: asyncpg.Connection,
) -> dict[str, str]:
    if not memory_ids:
        return {}
    rows = await db.fetch(
        """
        SELECT id, content
        FROM memories
        WHERE user_id = $1
          AND id = ANY($2::uuid[])
        """,
        user_id,
        list(memory_ids),
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
