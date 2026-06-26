import re
from collections.abc import Mapping, Sequence

import asyncpg

from api.config import settings
from api.services.embedding import embed, format_embedding_for_pgvector, is_reranker_loaded, rerank


QUERY_EXPANSIONS = {
    "building": (
        "user current project name what building",
        "user is currently working on a project",
    ),
    "project": (
        "user current project name what building",
        "user is currently working on a project",
    ),
    "tech stack": (
        "backend development framework preferences FastAPI Flask Python",
        "frontend work programming language preferences TypeScript JavaScript",
    ),
    "working on": (
        "user current project name what building",
        "user is currently working on a project",
    ),
}


def get_last_user_message(body: Mapping[str, object]) -> str:
    messages = body.get("messages")
    if not isinstance(messages, list):
        return ""
    for message in reversed(messages):
        if not isinstance(message, dict):
            continue
        if message.get("role") != "user":
            continue
        content = message.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return extract_text_from_content_parts(content)
    return ""


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


def build_retrieval_texts(query: str) -> list[str]:
    normalized_query = query.lower()
    retrieval_texts = [query]
    for trigger, expansions in QUERY_EXPANSIONS.items():
        if trigger in normalized_query:
            retrieval_texts.extend(f"{query}\n{expansion}" for expansion in expansions)
    return list(dict.fromkeys(retrieval_texts))


def build_log_embedding_text(query: str) -> str:
    return "\n".join(build_retrieval_texts(query))


async def retrieve_memories(
    user_id: object,
    query: str,
    db: asyncpg.Connection,
    limit: int | None = None,
    threshold: float | None = None,
    namespace: str = "default",
) -> list[dict[str, object]]:
    if not query.strip():
        return []
    threshold_value = settings.retrieval_threshold if threshold is None else threshold
    limit_value = settings.max_memories_injected if limit is None else limit
    matched_memories: dict[object, dict[str, object]] = {}
    for retrieval_text in build_retrieval_texts(query):
        query_embedding = format_embedding_for_pgvector(embed(retrieval_text))
        rows = await db.fetch(
            """
            SELECT id, content, confidence, access_count, last_accessed, created_at, source_conversation_id,
                   status, category, pinned, source, last_confirmed,
                   1 - (embedding <=> $1::vector) + CASE WHEN pinned THEN 0.08 ELSE 0 END AS score
            FROM memories
            WHERE user_id = $2
              AND status = 'approved'
              AND namespace = $5
              AND (1 - (embedding <=> $1::vector) > $3 OR pinned = true)
            ORDER BY score DESC
            LIMIT $4
            """,
            query_embedding,
            user_id,
            threshold_value,
            limit_value,
            namespace,
        )
        for row in rows:
            memory = dict(row)
            memory_id = memory["id"]
            current_memory = matched_memories.get(memory_id)
            if current_memory is None or float(memory["score"]) > float(current_memory["score"]):
                matched_memories[memory_id] = memory
    candidates = sorted(matched_memories.values(), key=lambda memory: float(memory["score"]), reverse=True)
    if is_reranker_loaded() and candidates and query.strip():
        try:
            rerank_scores = rerank(query, [str(m["content"]) for m in candidates])
            for memory, score in zip(candidates, rerank_scores):
                memory["score"] = score
            candidates.sort(key=lambda m: float(m["score"]), reverse=True)
        except Exception:
            pass
    memories = candidates[:limit_value]
    memory_ids = [memory["id"] for memory in memories]
    if memory_ids:
        await db.execute(
            """
            UPDATE memories
            SET access_count = access_count + 1,
                last_accessed = now()
            WHERE user_id = $1
              AND id = ANY($2::uuid[])
            """,
            user_id,
            memory_ids,
        )
    return memories


def to_tsquery_safe(query: str) -> str:
    tokens = re.findall(r"[A-Za-z0-9]+", query)
    if not tokens:
        return ""
    return " & ".join(tokens)


def rrf_merge(
    vector_hits: list[dict[str, object]],
    fulltext_hits: list[dict[str, object]],
    limit: int,
    k: int = 60,
) -> list[dict[str, object]]:
    scores: dict[object, float] = {}
    merged: dict[object, dict[str, object]] = {}
    for rank, memory in enumerate(vector_hits):
        memory_id = memory["id"]
        scores[memory_id] = scores.get(memory_id, 0.0) + 1.0 / (k + rank + 1)
        merged[memory_id] = memory
    for rank, memory in enumerate(fulltext_hits):
        memory_id = memory["id"]
        scores[memory_id] = scores.get(memory_id, 0.0) + 1.0 / (k + rank + 1)
        if memory_id not in merged:
            merged[memory_id] = memory
    sorted_ids = sorted(scores, key=lambda mid: scores[mid], reverse=True)
    result = []
    for memory_id in sorted_ids[:limit]:
        entry = dict(merged[memory_id])
        entry["score"] = scores[memory_id]
        result.append(entry)
    return result


async def retrieve_memories_fulltext(
    user_id: object,
    query: str,
    db: asyncpg.Connection,
    limit: int,
    namespace: str = "default",
) -> list[dict[str, object]]:
    ts_query = to_tsquery_safe(query)
    if not ts_query:
        return []
    rows = await db.fetch(
        """
        SELECT id, content, confidence, access_count, last_accessed, created_at, source_conversation_id,
               status, category, pinned, source, last_confirmed,
               ts_rank_cd(content_tsv, to_tsquery('english', $1)) AS score
        FROM memories
        WHERE user_id = $2
          AND status = 'approved'
          AND namespace = $4
          AND content_tsv @@ to_tsquery('english', $1)
        ORDER BY score DESC
        LIMIT $3
        """,
        ts_query,
        user_id,
        limit * 2,
        namespace,
    )
    return [dict(row) for row in rows]


async def retrieve_memories_hybrid(
    user_id: object,
    query: str,
    db: asyncpg.Connection,
    limit: int | None = None,
    threshold: float | None = None,
    namespace: str = "default",
) -> list[dict[str, object]]:
    limit_value = settings.max_memories_injected if limit is None else limit
    vector_hits = await retrieve_memories(user_id, query, db, limit_value * 2, threshold, namespace=namespace)
    fulltext_hits = await retrieve_memories_fulltext(user_id, query, db, limit_value, namespace=namespace)
    return rrf_merge(vector_hits, fulltext_hits, limit_value)


async def retrieve_memories_graph(
    user_id: object,
    query: str,
    db: asyncpg.Connection,
    limit: int | None = None,
    threshold: float | None = None,
    namespace: str = "default",
) -> list[dict[str, object]]:
    limit_value = settings.max_memories_injected if limit is None else limit
    seeds = await retrieve_memories(user_id, query, db, limit_value * 2, threshold, namespace=namespace)
    if not seeds:
        return []
    seed_ids = [memory["id"] for memory in seeds]
    expanded_rows = await db.fetch(
        """
        SELECT DISTINCT m.id, m.content, m.confidence, m.access_count, m.last_accessed,
                        m.created_at, m.source_conversation_id, m.status, m.category,
                        m.pinned, m.source, m.last_confirmed
        FROM memories m
        JOIN memory_entity_links mel ON mel.memory_id = m.id
        WHERE mel.entity_id IN (
            SELECT entity_id FROM memory_entity_links WHERE memory_id = ANY($1::uuid[])
        )
        AND m.id != ALL($1::uuid[])
        AND m.user_id = $2
        AND m.status = 'approved'
        AND m.namespace = $3
        LIMIT $4
        """,
        seed_ids,
        user_id,
        namespace,
        limit_value * 2,
    )
    merged: list[dict[str, object]] = list(seeds)
    seen_ids = set(seed_ids)
    for row in expanded_rows:
        memory = dict(row)
        if memory["id"] in seen_ids:
            continue
        seen_ids.add(memory["id"])
        memory["score"] = float(memory.get("confidence", 0.5)) * 0.5
        merged.append(memory)
    return merged[:limit_value]


async def log_retrieval(
    user_id: object,
    conversation_id: str,
    query: str,
    memories: list[dict[str, object]],
    db: asyncpg.Connection,
) -> None:
    query_embedding = format_embedding_for_pgvector(embed(build_log_embedding_text(query))) if query.strip() else None
    await db.execute(
        """
        INSERT INTO retrieval_logs
          (user_id, query, query_embedding, retrieved_memory_ids, retrieved_scores, conversation_id)
        VALUES ($1, $2, $3::vector, $4, $5, $6)
        """,
        user_id,
        query,
        query_embedding,
        [memory["id"] for memory in memories],
        [float(memory["score"]) for memory in memories],
        conversation_id,
    )
