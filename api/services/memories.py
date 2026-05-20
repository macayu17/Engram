from typing import Literal

import asyncpg

from api.services.deduplication import store_memory_with_deduplication
from api.services.embedding import embed, format_embedding_for_pgvector
from api.services.retrieval import retrieve_memories


MemoryOrder = Literal["created_at", "last_accessed", "access_count"]
SortDirection = Literal["asc", "desc"]


async def create_memory(user_id: object, content: str, db: asyncpg.Connection, dedup_threshold: float | None = None) -> dict[str, object]:
    embedding = embed(content)
    result = await store_memory_with_deduplication(user_id, content, embedding, None, 1.0, db, dedup_threshold)
    if result["memory"] is None:
        raise RuntimeError("Memory creation failed")
    return result["memory"]


async def list_memories(
    user_id: object,
    db: asyncpg.Connection,
    limit: int,
    offset: int,
    search: str | None,
    order: MemoryOrder,
    direction: SortDirection,
) -> tuple[list[dict[str, object]], int]:
    if search:
        results = await retrieve_memories(user_id, search, db, limit=limit + offset, threshold=0)
        return [strip_score(result) for result in results[offset : offset + limit]], len(results)
    order_column = validate_order_column(order)
    sort_direction = validate_sort_direction(direction)
    rows = await db.fetch(
        f"""
        SELECT id, content, confidence, access_count, last_accessed, created_at, source_conversation_id
        FROM memories
        WHERE user_id = $1
        ORDER BY {order_column} {sort_direction}
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
        FROM memories
        WHERE user_id = $1
        """,
        user_id,
    )
    return [dict(row) for row in rows], int(total)


async def get_memory(user_id: object, memory_id: object, db: asyncpg.Connection) -> dict[str, object] | None:
    row = await db.fetchrow(
        """
        SELECT id, content, confidence, access_count, last_accessed, created_at, source_conversation_id
        FROM memories
        WHERE user_id = $1
          AND id = $2
        """,
        user_id,
        memory_id,
    )
    return dict(row) if row is not None else None


async def update_memory(
    user_id: object,
    memory_id: object,
    content: str,
    db: asyncpg.Connection,
) -> dict[str, object] | None:
    embedding = format_embedding_for_pgvector(embed(content))
    row = await db.fetchrow(
        """
        UPDATE memories
        SET content = $1,
            embedding = $2::vector
        WHERE user_id = $3
          AND id = $4
        RETURNING id, content, confidence, access_count, last_accessed, created_at, source_conversation_id
        """,
        content,
        embedding,
        user_id,
        memory_id,
    )
    return dict(row) if row is not None else None


async def delete_memory(user_id: object, memory_id: object, db: asyncpg.Connection) -> bool:
    result = await db.execute(
        """
        DELETE FROM memories
        WHERE user_id = $1
          AND id = $2
        """,
        user_id,
        memory_id,
    )
    return result.endswith("1")


async def search_memories(
    user_id: object,
    query: str,
    limit: int,
    threshold: float,
    db: asyncpg.Connection,
) -> list[dict[str, object]]:
    results = await retrieve_memories(user_id, query, db, limit=limit, threshold=threshold)
    return [{"memory": strip_score(result), "score": result["score"]} for result in results]


def strip_score(memory: dict[str, object]) -> dict[str, object]:
    return {key: value for key, value in memory.items() if key != "score"}


def validate_order_column(order: MemoryOrder) -> str:
    if order not in {"created_at", "last_accessed", "access_count"}:
        return "created_at"
    return order


def validate_sort_direction(direction: SortDirection) -> str:
    if direction == "asc":
        return "ASC"
    return "DESC"
