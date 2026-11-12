import json
import re
from collections.abc import Mapping, Sequence

import asyncpg

from api.config import settings
from api.services.embedding import embed, format_embedding_for_pgvector


def get_retrieval_query(body: Mapping[str, object], max_user_messages: int = 6) -> str:
    messages = body.get("messages")
    if not isinstance(messages, list):
        return ""
    user_messages: list[str] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        if message.get("role") != "user":
            continue
        content = message.get("content")
        if isinstance(content, str):
            user_messages.append(content)
        elif isinstance(content, list):
            extracted = extract_text_from_content_parts(content)
            if extracted:
                user_messages.append(extracted)
    return "\n".join(user_messages[-max_user_messages:])


def extract_text_from_content_parts(parts: Sequence[object]) -> str:
    text_parts: list[str] = []
    for part in parts:
        if not isinstance(part, dict):
            continue
        content_type = part.get("type")
        if content_type in {"text", "input_text"} and isinstance(part.get("text"), str):
            text_parts.append(part["text"])
    return "\n".join(text_parts)


MAX_KEYWORD_TERMS = 64


def build_keyword_query(query: str) -> str:
    terms = dict.fromkeys(term.lower() for term in re.findall(r"[A-Za-z0-9]+", query))
    return " | ".join(list(terms)[:MAX_KEYWORD_TERMS])


async def retrieve_memories(
    user_id: object,
    org_id: object,
    query: str,
    db: asyncpg.Connection,
    limit: int | None = None,
    threshold: float | None = None,
    namespace: str = "default",
    include_personal: bool = False,
    focused: bool = False,
) -> list[dict[str, object]]:
    if not query.strip():
        return []
    threshold_value = settings.retrieval_threshold if threshold is None else threshold
    limit_value = settings.max_memories_injected if limit is None else limit
    rows = await db.fetch(
        """
        WITH candidates AS (
            SELECT id, content, confidence, access_count, last_accessed, created_at, source_conversation_id,
                   status, category, pinned, source, last_confirmed, namespace, expires_at,
                   1 - (embedding <=> $1::vector) AS semantic,
                   CASE WHEN $7 = '' THEN 0 ELSE ts_rank_cd(content_tsv, to_tsquery('english', $7), 32) END AS keyword
            FROM memories
            WHERE user_id = $2
              AND org_id = $3
              AND status = 'approved'
              AND namespace = ANY($6::text[])
              AND (expires_at IS NULL OR expires_at > now())
        )
        SELECT *,
               semantic + $8 * keyword AS relevance,
               semantic
                 + $8 * keyword
                 + CASE WHEN pinned THEN 0.08 ELSE 0 END
                 + $9 * exp(-0.6931471805599453 * GREATEST(extract(epoch FROM now() - COALESCE(last_confirmed, created_at)), 0) / 86400.0 / $10)
                 AS score
        FROM candidates
        WHERE semantic > $4 OR pinned
        ORDER BY relevance DESC
        LIMIT $5
        """,
        format_embedding_for_pgvector(embed(query)),
        user_id,
        org_id,
        threshold_value,
        limit_value,
        list(dict.fromkeys([namespace, "personal"])) if include_personal else [namespace],
        build_keyword_query(query),
        settings.retrieval_keyword_weight,
        settings.retrieval_recency_weight,
        settings.retrieval_recency_half_life_days,
    )
    if not rows:
        return []
    memories = sorted((dict(row) for row in rows), key=lambda memory: float(memory["score"]), reverse=True)
    if focused:
        cutoff = max(float(row["relevance"]) for row in rows) - settings.retrieval_relative_cutoff
        memories = [memory for memory in memories if memory["pinned"] or float(memory["relevance"]) >= cutoff]
    await db.execute(
        """
        UPDATE memories
        SET access_count = access_count + 1,
            last_accessed = now()
        WHERE user_id = $1
          AND org_id = $2
          AND id = ANY($3::uuid[])
        """,
        user_id,
        org_id,
        [memory["id"] for memory in memories],
    )
    return memories


async def log_retrieval(
    user_id: object, org_id: object, conversation_id: str | None, query: str,
    memories: list[dict[str, object]], db: asyncpg.Connection,
    namespace: str = "default", injected_count: int | None = None, retrieval_mode: str = "vector",
) -> None:
    query_embedding = format_embedding_for_pgvector(embed(query)) if query.strip() else None
    snapshots = [{"memory_id": str(memory["id"]), "content": memory["content"], "score": float(memory["score"]), "namespace": memory.get("namespace", namespace)} for memory in memories]
    await db.execute(
        """
        INSERT INTO retrieval_logs
          (user_id,org_id,query,query_embedding,retrieved_memory_ids,retrieved_scores,conversation_id,namespace,injected_count,retrieval_mode,memory_snapshots)
        VALUES ($1,$2,$3,$4::vector,$5,$6,$7,$8,$9,$10,$11::jsonb)
        """, user_id, org_id, query, query_embedding, [memory["id"] for memory in memories],
        [float(memory["score"]) for memory in memories], conversation_id, namespace,
        len(memories) if injected_count is None else injected_count, retrieval_mode, json.dumps(snapshots),
    )
