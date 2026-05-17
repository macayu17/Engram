from collections.abc import Mapping, Sequence

import asyncpg

from api.config import settings
from api.services.embedding import embed, format_embedding_for_pgvector


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
                   1 - (embedding <=> $1::vector) AS score
            FROM memories
            WHERE user_id = $2
              AND 1 - (embedding <=> $1::vector) > $3
            ORDER BY score DESC
            LIMIT $4
            """,
            query_embedding,
            user_id,
            threshold_value,
            limit_value,
        )
        for row in rows:
            memory = dict(row)
            memory_id = memory["id"]
            current_memory = matched_memories.get(memory_id)
            if current_memory is None or float(memory["score"]) > float(current_memory["score"]):
                matched_memories[memory_id] = memory
    memories = sorted(matched_memories.values(), key=lambda memory: float(memory["score"]), reverse=True)[:limit_value]
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
