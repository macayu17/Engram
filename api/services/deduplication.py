from typing import Literal, TypedDict

import asyncpg

from api.config import settings
from api.services.embedding import format_embedding_for_pgvector


class StoreMemoryResult(TypedDict):
    action: Literal["inserted", "updated", "skipped"]
    memory: dict[str, object] | None


async def store_memory_with_deduplication(
    user_id: object,
    content: str,
    embedding: list[float],
    conversation_id: object | None,
    confidence: float,
    db: asyncpg.Connection,
    dedup_threshold: float | None = None,
) -> StoreMemoryResult:
    dedup_threshold_value = settings.dedup_threshold if dedup_threshold is None else dedup_threshold
    vector_literal = format_embedding_for_pgvector(embedding)
    nearest = await db.fetchrow(
        """
        SELECT id, content, confidence, access_count, last_accessed, created_at, source_conversation_id,
               1 - (embedding <=> $1::vector) AS score
        FROM memories
        WHERE user_id = $2
        ORDER BY score DESC
        LIMIT 1
        """,
        vector_literal,
        user_id,
    )
    if nearest is not None and nearest["score"] > dedup_threshold_value:
        return {"action": "skipped", "memory": dict(nearest)}
    if nearest is not None and nearest["score"] > settings.memory_refinement_threshold:
        updated = await db.fetchrow(
            """
            UPDATE memories
            SET content = $1,
                embedding = $2::vector,
                source_conversation_id = COALESCE($3, source_conversation_id),
                confidence = GREATEST(confidence, $4)
            WHERE user_id = $5
              AND id = $6
            RETURNING id, content, confidence, access_count, last_accessed, created_at, source_conversation_id
            """,
            content,
            vector_literal,
            conversation_id,
            confidence,
            user_id,
            nearest["id"],
        )
        return {"action": "updated", "memory": dict(updated) if updated is not None else None}
    inserted = await db.fetchrow(
        """
        INSERT INTO memories (user_id, content, embedding, source_conversation_id, confidence)
        VALUES ($1, $2, $3::vector, $4, $5)
        RETURNING id, content, confidence, access_count, last_accessed, created_at, source_conversation_id
        """,
        user_id,
        content,
        vector_literal,
        conversation_id,
        confidence,
    )
    return {"action": "inserted", "memory": dict(inserted) if inserted is not None else None}
