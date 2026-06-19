from typing import Literal

import asyncpg

from api.services.deduplication import store_memory_with_deduplication
from api.services.embedding import embed, format_embedding_for_pgvector
from api.services.retrieval import build_retrieval_texts, retrieve_memories


MemoryOrder = Literal["created_at", "last_accessed", "access_count"]
SortDirection = Literal["asc", "desc"]
MemoryStatus = Literal["pending", "approved", "rejected"]


MEMORY_COLUMNS = (
    "id, content, confidence, access_count, last_accessed, created_at, source_conversation_id, "
    "status, category, pinned, source, last_confirmed"
)


async def create_memory(
    user_id: object,
    content: str,
    db: asyncpg.Connection,
    dedup_threshold: float | None = None,
    category: str | None = None,
    pinned: bool = False,
    status: MemoryStatus = "approved",
    source: str = "manual",
) -> dict[str, object]:
    embedding = embed(content)
    result = await store_memory_with_deduplication(
        user_id,
        content,
        embedding,
        None,
        1.0,
        db,
        dedup_threshold,
        status,
        normalize_category(category or infer_category(content)),
        source,
    )
    if result["memory"] is None:
        raise RuntimeError("Memory creation failed")
    memory = result["memory"]
    if pinned:
        updated = await update_memory(user_id, memory["id"], None, db, pinned=True)
        if updated is not None:
            return updated
    return memory


async def list_memories(
    user_id: object,
    db: asyncpg.Connection,
    limit: int,
    offset: int,
    search: str | None,
    order: MemoryOrder,
    direction: SortDirection,
    status: MemoryStatus | None = "approved",
    category: str | None = None,
) -> tuple[list[dict[str, object]], int]:
    if search:
        filtered = await search_memory_rows_for_listing(user_id, search, db, status, category)
        page = filtered[offset : offset + limit]
        await mark_memories_accessed(user_id, [row["id"] for row in page], db)
        return [strip_score(row) for row in page], len(filtered)
    order_column = validate_order_column(order)
    sort_direction = validate_sort_direction(direction)
    status_clause, category_clause, params = build_memory_filters(user_id, status, category)
    rows = await db.fetch(
        f"""
        SELECT {MEMORY_COLUMNS}
        FROM memories
        WHERE {status_clause}
          {category_clause}
        ORDER BY {order_column} {sort_direction}
        LIMIT ${len(params) + 1}
        OFFSET ${len(params) + 2}
        """,
        *params,
        limit,
        offset,
    )
    total = await db.fetchval(
        f"""
        SELECT COUNT(*)
        FROM memories
        WHERE {status_clause}
          {category_clause}
        """,
        *params,
    )
    return [dict(row) for row in rows], int(total)


async def get_memory(user_id: object, memory_id: object, db: asyncpg.Connection) -> dict[str, object] | None:
    row = await db.fetchrow(
        f"""
        SELECT {MEMORY_COLUMNS}
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
    content: str | None,
    db: asyncpg.Connection,
    category: str | None = None,
    pinned: bool | None = None,
    status: MemoryStatus | None = None,
) -> dict[str, object] | None:
    current = await get_memory(user_id, memory_id, db)
    if current is None:
        return None
    next_content = content or str(current["content"])
    next_category = normalize_category(category) if category is not None else current["category"]
    next_pinned = pinned if pinned is not None else current["pinned"]
    next_status = status if status is not None else current["status"]
    if content is None:
        row = await db.fetchrow(
            """
            UPDATE memories
            SET category = $1,
                pinned = $2,
                status = $3,
                last_confirmed = CASE WHEN $3 = 'approved' THEN now() ELSE last_confirmed END
            WHERE user_id = $4
              AND id = $5
            RETURNING id, content, confidence, access_count, last_accessed, created_at, source_conversation_id,
                      status, category, pinned, source, last_confirmed
            """,
            next_category,
            next_pinned,
            next_status,
            user_id,
            memory_id,
        )
        return dict(row) if row is not None else None
    embedding = format_embedding_for_pgvector(embed(next_content))
    row = await db.fetchrow(
        """
        UPDATE memories
        SET content = $1,
            embedding = $2::vector,
            category = $3,
            pinned = $4,
            status = $5,
            last_confirmed = CASE WHEN $5 = 'approved' THEN now() ELSE last_confirmed END
        WHERE user_id = $6
          AND id = $7
        RETURNING id, content, confidence, access_count, last_accessed, created_at, source_conversation_id,
                  status, category, pinned, source, last_confirmed
        """,
        next_content,
        embedding,
        next_category,
        next_pinned,
        next_status,
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


async def delete_all_memories(user_id: object, db: asyncpg.Connection) -> int:
    result = await db.execute(
        """
        DELETE FROM memories
        WHERE user_id = $1
        """
,
        user_id,
    )
    return int(result.split()[1])


async def search_memories(
    user_id: object,
    query: str,
    limit: int,
    threshold: float,
    db: asyncpg.Connection,
) -> list[dict[str, object]]:
    results = await retrieve_memories(user_id, query, db, limit=limit, threshold=threshold)
    return [{"memory": strip_score(result), "score": result["score"]} for result in results]


async def export_memories(user_id: object, db: asyncpg.Connection) -> list[dict[str, object]]:
    rows = await db.fetch(
        f"""
        SELECT {MEMORY_COLUMNS}
        FROM memories
        WHERE user_id = $1
        ORDER BY created_at DESC
        """,
        user_id,
    )
    return [dict(row) for row in rows]


async def import_memories(user_id: object, items: list[dict[str, object]], db: asyncpg.Connection, dedup_threshold: float | None = None) -> int:
    imported = 0
    for item in items:
        content = str(item["content"]).strip()
        category = normalize_category(item.get("category") if isinstance(item.get("category"), str) else infer_category(content))
        pinned = bool(item.get("pinned", False))
        result = await create_memory(user_id, content, db, dedup_threshold, category, pinned, "approved", "import")
        if result:
            imported += 1
    return imported


async def get_memory_source(user_id: object, memory_id: object, db: asyncpg.Connection) -> dict[str, object] | None:
    memory = await get_memory(user_id, memory_id, db)
    if memory is None:
        return None
    conversation = None
    if memory["source_conversation_id"] is not None:
        row = await db.fetchrow(
            """
            SELECT id, extraction_status, memories_extracted, raw_exchange, created_at
            FROM conversations
            WHERE user_id = $1
              AND id = $2
            """,
            user_id,
            memory["source_conversation_id"],
        )
        conversation = dict(row) if row is not None else None
    return {"memory": memory, "conversation": conversation}


async def list_merge_suggestions(user_id: object, db: asyncpg.Connection, limit: int = 10) -> list[dict[str, object]]:
    rows = await db.fetch(
        f"""
        SELECT {MEMORY_COLUMNS}
        FROM memories
        WHERE user_id = $1
          AND status = 'approved'
        ORDER BY category, created_at DESC
        LIMIT 200
        """,
        user_id,
    )
    memories = [dict(row) for row in rows]
    suggestions: list[dict[str, object]] = []
    for index, primary in enumerate(memories):
        for duplicate in memories[index + 1:]:
            if primary["category"] != duplicate["category"]:
                continue
            if memory_similarity_hint(str(primary["content"]), str(duplicate["content"])) < 0.42:
                continue
            suggestions.append({"primary": primary, "duplicate": duplicate, "reason": "Similar wording and category"})
            if len(suggestions) >= limit:
                return suggestions
    return suggestions


async def merge_memories(user_id: object, primary_id: object, duplicate_id: object, content: str | None, db: asyncpg.Connection) -> dict[str, object] | None:
    if primary_id == duplicate_id:
        return None
    async with db.transaction():
        primary = await lock_memory(user_id, primary_id, db)
        duplicate = await lock_memory(user_id, duplicate_id, db)
        if primary is None or duplicate is None:
            return None
        merged_content = content or f"{primary['content']}\n{duplicate['content']}"
        embedding = format_embedding_for_pgvector(embed(merged_content))
        row = await db.fetchrow(
            f"""
            UPDATE memories
            SET content = $1,
                embedding = $2::vector,
                confidence = GREATEST(confidence, $3),
                access_count = access_count + $4,
                last_accessed = CASE
                    WHEN last_accessed IS NULL THEN $5::timestamptz
                    WHEN $5::timestamptz IS NULL THEN last_accessed
                    ELSE GREATEST(last_accessed, $5::timestamptz)
                END,
                category = $6,
                pinned = $7,
                status = 'approved',
                last_confirmed = now()
            WHERE user_id = $8
              AND id = $9
            RETURNING {MEMORY_COLUMNS}
            """,
            merged_content,
            embedding,
            float(duplicate["confidence"]),
            int(duplicate["access_count"]),
            duplicate["last_accessed"],
            str(primary["category"]),
            bool(primary["pinned"]) or bool(duplicate["pinned"]),
            user_id,
            primary_id,
        )
        await db.execute(
            """
            DELETE FROM memories
            WHERE user_id = $1
              AND id = $2
            """,
            user_id,
            duplicate_id,
        )
    return dict(row) if row is not None else None


async def apply_confidence_decay(user_id: object, db: asyncpg.Connection) -> int:
    result = await db.execute(
        """
        UPDATE memories
        SET confidence = GREATEST(0.1, confidence * 0.92)
        WHERE user_id = $1
          AND status = 'approved'
          AND pinned = false
          AND (
            last_accessed IS NULL AND created_at < now() - interval '30 days'
            OR last_accessed < now() - interval '30 days'
          )
        """,
        user_id,
    )
    return int(result.split()[1])


async def timeline(user_id: object, db: asyncpg.Connection, limit: int = 50) -> list[dict[str, object]]:
    memory_rows = await db.fetch(
        """
        SELECT id::text AS id, 'memory' AS type, content AS title, category, created_at
        FROM memories
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        user_id,
        limit,
    )
    conversation_rows = await db.fetch(
        """
        SELECT id::text AS id, 'conversation' AS type, extraction_status AS title, NULL AS category, created_at
        FROM conversations
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        user_id,
        limit,
    )
    items = [dict(row) for row in memory_rows] + [dict(row) for row in conversation_rows]
    return sorted(items, key=lambda item: item["created_at"], reverse=True)[:limit]


def strip_score(memory: dict[str, object]) -> dict[str, object]:
    return {key: value for key, value in memory.items() if key != "score"}


async def search_memory_rows_for_listing(
    user_id: object,
    search: str,
    db: asyncpg.Connection,
    status: MemoryStatus | None,
    category: str | None,
) -> list[dict[str, object]]:
    if not search.strip():
        return []
    status_clause, category_clause, params = build_memory_filters(user_id, status, category)
    matched_memories: dict[object, dict[str, object]] = {}
    for retrieval_text in build_retrieval_texts(search):
        query_embedding = format_embedding_for_pgvector(embed(retrieval_text))
        rows = await db.fetch(
            f"""
            SELECT {MEMORY_COLUMNS},
                   1 - (embedding <=> ${len(params) + 1}::vector) + CASE WHEN pinned THEN 0.08 ELSE 0 END AS score
            FROM memories
            WHERE {status_clause}
              {category_clause}
              AND (1 - (embedding <=> ${len(params) + 1}::vector) > 0 OR pinned = true)
            ORDER BY score DESC
            """,
            *params,
            query_embedding,
        )
        for row in rows:
            memory = dict(row)
            current = matched_memories.get(memory["id"])
            if current is None or float(memory["score"]) > float(current["score"]):
                matched_memories[memory["id"]] = memory
    return sorted(matched_memories.values(), key=lambda memory: float(memory["score"]), reverse=True)


async def mark_memories_accessed(user_id: object, memory_ids: list[object], db: asyncpg.Connection) -> None:
    if not memory_ids:
        return
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


async def lock_memory(user_id: object, memory_id: object, db: asyncpg.Connection) -> dict[str, object] | None:
    row = await db.fetchrow(
        f"""
        SELECT {MEMORY_COLUMNS}
        FROM memories
        WHERE user_id = $1
          AND id = $2
        FOR UPDATE
        """,
        user_id,
        memory_id,
    )
    return dict(row) if row is not None else None


def build_memory_filters(user_id: object, status: MemoryStatus | None, category: str | None) -> tuple[str, str, list[object]]:
    params = [user_id]
    status_clause = "user_id = $1"
    category_clause = ""
    if status is not None:
        params.append(status)
        status_clause += f" AND status = ${len(params)}"
    if category:
        params.append(normalize_category(category))
        category_clause = f"AND category = ${len(params)}"
    return status_clause, category_clause, params


def filter_memory_rows(rows: list[dict[str, object]], status: MemoryStatus | None, category: str | None) -> list[dict[str, object]]:
    normalized_category = normalize_category(category) if category else None
    return [
        row
        for row in rows
        if (status is None or row.get("status") == status)
        and (normalized_category is None or row.get("category") == normalized_category)
    ]


def normalize_category(category: str | None) -> str:
    if not category:
        return "general"
    normalized = category.strip().lower().replace(" ", "_")
    return normalized[:80] or "general"


def infer_category(content: str) -> str:
    text = content.lower()
    if any(token in text for token in ("prefer", "likes", "wants", "uses")):
        return "preferences"
    if any(token in text for token in ("project", "building", "working on", "repo")):
        return "projects"
    if any(token in text for token in ("python", "typescript", "fastapi", "react", "postgres", "skill")):
        return "skills"
    if any(token in text for token in ("correction", "actually", "not ", "instead")):
        return "corrections"
    return "profile"


def memory_similarity_hint(first: str, second: str) -> float:
    first_words = set(first.lower().split())
    second_words = set(second.lower().split())
    if not first_words or not second_words:
        return 0.0
    return len(first_words & second_words) / len(first_words | second_words)


def validate_order_column(order: MemoryOrder) -> str:
    if order not in {"created_at", "last_accessed", "access_count"}:
        return "created_at"
    return order


def validate_sort_direction(direction: SortDirection) -> str:
    if direction == "asc":
        return "ASC"
    return "DESC"
