from datetime import datetime
import json
from typing import Literal

import asyncpg

from api.services.deduplication import store_memory_with_deduplication
from api.services.embedding import embed, format_embedding_for_pgvector
from api.services.retrieval import build_retrieval_texts, retrieve_memories


MemoryOrder = Literal["created_at", "last_accessed", "access_count"]
SortDirection = Literal["asc", "desc"]
MemoryStatus = Literal["pending", "approved", "rejected"]
MemoryConflictResolution = Literal["accept_new", "keep_old", "keep_both"]


MEMORY_COLUMNS = (
    "id, content, confidence, access_count, last_accessed, created_at, source_conversation_id, "
    "status, category, pinned, source, last_confirmed, namespace, expires_at"
)


async def list_memory_conflicts(
    user_id: object,
    org_id: object,
    db: asyncpg.Connection,
    limit: int,
    offset: int,
    status: Literal["open", "resolved", "all"] = "open",
    namespace: str | None = None,
) -> tuple[list[dict[str, object]], int]:
    status_clause = "" if status == "all" else "AND status = $3"
    query_args: tuple[object, ...] = (user_id, org_id) if status == "all" else (user_id, org_id, status)
    if namespace is not None:
        query_args += (namespace,)
        status_clause += f" AND EXISTS (SELECT 1 FROM memories current JOIN memories proposed ON proposed.id=memory_conflicts.proposed_memory_id WHERE current.id=memory_conflicts.existing_memory_id AND current.namespace=${len(query_args)} AND proposed.namespace=${len(query_args)})"

    rows = await db.fetch(
        f"""
        SELECT id, existing_memory_id, proposed_memory_id, status, resolution, created_at, resolved_at
        FROM memory_conflicts
        WHERE user_id = $1
          AND org_id = $2
          {status_clause}
        ORDER BY created_at DESC
        LIMIT ${len(query_args) + 1}
        OFFSET ${len(query_args) + 2}
        """,
        *query_args,
        limit,
        offset,
    )
    conflicts: list[dict[str, object]] = []
    for row in rows:
        conflict = dict(row)
        existing_memory = await get_memory(user_id, org_id, conflict["existing_memory_id"], db, namespace=namespace)
        proposed_memory = await get_memory(user_id, org_id, conflict["proposed_memory_id"], db, namespace=namespace)
        if existing_memory is None or proposed_memory is None:
            continue
        conflicts.append(
            {
                "id": conflict["id"],
                "status": conflict["status"],
                "resolution": conflict["resolution"],
                "created_at": conflict["created_at"],
                "resolved_at": conflict["resolved_at"],
                "existing_memory": existing_memory,
                "proposed_memory": proposed_memory,
            }
        )
    total = await db.fetchval(
        f"""
        SELECT COUNT(*)
        FROM memory_conflicts
        WHERE user_id = $1
          AND org_id = $2
          {status_clause}
        """,
        *query_args,
    )
    return conflicts, int(total)


async def resolve_memory_conflict(
    user_id: object,
    org_id: object,
    conflict_id: object,
    resolution: MemoryConflictResolution,
    db: asyncpg.Connection,
    namespace: str | None = None,
) -> dict[str, object] | None:
    conflict_row = await db.fetchrow(
        """
        SELECT id, existing_memory_id, proposed_memory_id, status, resolution, created_at, resolved_at
        FROM memory_conflicts
        WHERE user_id = $1
          AND org_id = $2
          AND id = $3
          AND status = 'open'
        FOR UPDATE
        """,
        user_id,
        org_id,
        conflict_id,
    )
    if conflict_row is None:
        return None
    conflict = dict(conflict_row)
    if namespace is not None:
        for memory_id in (conflict["existing_memory_id"], conflict["proposed_memory_id"]):
            memory = await lock_memory(user_id, org_id, memory_id, db)
            if memory is None or memory["namespace"] != namespace:
                return None

    status_by_resolution: dict[MemoryConflictResolution, tuple[MemoryStatus, MemoryStatus]] = {
        "accept_new": ("rejected", "approved"),
        "keep_old": ("approved", "rejected"),
        "keep_both": ("approved", "approved"),
    }
    existing_status, proposed_status = status_by_resolution[resolution]
    existing_memory_id = conflict["existing_memory_id"]
    proposed_memory_id = conflict["proposed_memory_id"]
    updated = await db.execute(
        """
        UPDATE memories
        SET status = CASE WHEN id = $1 THEN $2 ELSE $3 END,
            last_confirmed = CASE WHEN (CASE WHEN id = $1 THEN $2 ELSE $3 END) = 'approved' THEN now() ELSE last_confirmed END
        WHERE user_id = $4
          AND org_id = $5
          AND id = ANY($6::uuid[])
        """,
        existing_memory_id,
        existing_status,
        proposed_status,
        user_id,
        org_id,
        [existing_memory_id, proposed_memory_id],
    )
    if updated != "UPDATE 2":
        raise RuntimeError("Conflict memories are unavailable")
    resolved_row = await db.fetchrow(
        """
        UPDATE memory_conflicts
        SET status = 'resolved',
            resolution = $4,
            resolved_at = now()
        WHERE user_id = $1
          AND org_id = $2
          AND id = $3
          AND status = 'open'
        RETURNING id, existing_memory_id, proposed_memory_id, status, resolution, created_at, resolved_at
        """,
        user_id,
        org_id,
        conflict_id,
        resolution,
    )
    if resolved_row is None:
        return None
    existing_memory = await get_memory(user_id, org_id, existing_memory_id, db)
    proposed_memory = await get_memory(user_id, org_id, proposed_memory_id, db)
    if existing_memory is None or proposed_memory is None:
        raise RuntimeError("Conflict memories are unavailable")
    resolved = dict(resolved_row)
    return {
        "id": resolved["id"],
        "status": resolved["status"],
        "resolution": resolved["resolution"],
        "created_at": resolved["created_at"],
        "resolved_at": resolved["resolved_at"],
        "existing_memory": existing_memory,
        "proposed_memory": proposed_memory,
    }


async def create_memory(
    user_id: object,
    org_id: object,
    content: str,
    db: asyncpg.Connection,
    dedup_threshold: float | None = None,
    category: str | None = None,
    pinned: bool = False,
    status: MemoryStatus = "approved",
    source: str = "manual",
    namespace: str = "default",
    expires_at: datetime | None = None,
) -> dict[str, object]:
    embedding = embed(content)
    result = await store_memory_with_deduplication(
        user_id,
        org_id,
        content,
        embedding,
        None,
        1.0,
        db,
        dedup_threshold,
        status,
        normalize_category(category or infer_category(content)),
        source,
        namespace=namespace,
    )
    if result["memory"] is None:
        raise RuntimeError("Memory creation failed")
    memory = result["memory"]
    if pinned or expires_at is not None:
        updated = await update_memory(user_id, org_id, memory["id"], None, db, pinned=pinned, expires_at=expires_at, update_expiration=expires_at is not None)
        if updated is not None:
            return updated
    return memory


async def list_memories(
    user_id: object,
    org_id: object,
    db: asyncpg.Connection,
    limit: int,
    offset: int,
    search: str | None,
    order: MemoryOrder,
    direction: SortDirection,
    status: MemoryStatus | None = "approved",
    category: str | None = None,
    namespace: str | None = None,
) -> tuple[list[dict[str, object]], int]:
    if search:
        filtered = await search_memory_rows_for_listing(user_id, org_id, search, db, status, category, namespace)
        page = filtered[offset : offset + limit]
        await mark_memories_accessed(user_id, org_id, [row["id"] for row in page], db)
        return [strip_score(row) for row in page], len(filtered)
    order_column = validate_order_column(order)
    sort_direction = validate_sort_direction(direction)
    status_clause, category_clause, params = build_memory_filters(user_id, org_id, status, category, namespace=namespace)
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


async def get_memory(
    user_id: object, org_id: object, memory_id: object, db: asyncpg.Connection,
    namespace: str | None = None,
) -> dict[str, object] | None:
    row = await db.fetchrow(
        f"SELECT {MEMORY_COLUMNS} FROM memories WHERE user_id=$1 AND org_id=$2 AND id=$3 AND ($4::text IS NULL OR namespace=$4)",
        user_id, org_id, memory_id, namespace,
    )
    return dict(row) if row is not None else None


async def update_memory(
    user_id: object, org_id: object, memory_id: object, content: str | None, db: asyncpg.Connection,
    category: str | None = None, pinned: bool | None = None, status: MemoryStatus | None = None,
    namespace: str | None = None, target_namespace: str | None = None,
    expires_at: datetime | None = None, update_expiration: bool = False,
) -> dict[str, object] | None:
    async with db.transaction():
        current = await db.fetchrow(
            f"SELECT {MEMORY_COLUMNS} FROM memories WHERE user_id=$1 AND org_id=$2 AND id=$3 AND ($4::text IS NULL OR namespace=$4) FOR UPDATE",
            user_id, org_id, memory_id, namespace,
        )
        if current is None:
            return None
        embedding = format_embedding_for_pgvector(embed(content)) if content is not None else None
        row = await db.fetchrow(
            f"""
            UPDATE memories SET content=COALESCE($1,content),embedding=COALESCE($2::vector,embedding),
                category=COALESCE($3,category),pinned=COALESCE($4,pinned),status=COALESCE($5,status),
                namespace=COALESCE($6,namespace),expires_at=CASE WHEN $7 THEN $8::timestamptz ELSE expires_at END,
                last_confirmed=CASE WHEN $5='approved' THEN now() ELSE last_confirmed END
            WHERE user_id=$9 AND org_id=$10 AND id=$11 RETURNING {MEMORY_COLUMNS}
            """, content, embedding, normalize_category(category) if category is not None else None,
            pinned, status, target_namespace, update_expiration, expires_at, user_id, org_id, memory_id,
        )
    return dict(row) if row is not None else None


async def delete_memory(
    user_id: object, org_id: object, memory_id: object, db: asyncpg.Connection, namespace: str | None = None,
) -> bool:
    result = await db.execute(
        "DELETE FROM memories WHERE user_id=$1 AND org_id=$2 AND id=$3 AND ($4::text IS NULL OR namespace=$4)",
        user_id, org_id, memory_id, namespace,
    )
    return result.endswith("1")


async def delete_all_memories(user_id: object, org_id: object, db: asyncpg.Connection, namespace: str | None = None) -> int:
    if namespace is None:
        result = await db.execute("DELETE FROM memories WHERE user_id = $1 AND org_id = $2", user_id, org_id)
    else:
        result = await db.execute("DELETE FROM memories WHERE user_id=$1 AND org_id=$2 AND namespace=$3", user_id, org_id, namespace)
    return int(result.split()[1])


async def search_memories(
    user_id: object, org_id: object, query: str, limit: int, threshold: float, db: asyncpg.Connection,
    namespace: str = "default", include_personal: bool = False,
) -> list[dict[str, object]]:
    from api.services.retrieval import log_retrieval

    results = await retrieve_memories(user_id, org_id, query, db, limit=limit, threshold=threshold, namespace=namespace, include_personal=include_personal)
    await log_retrieval(user_id, org_id, None, query, results, db, namespace=namespace, injected_count=0, retrieval_mode="search")
    return [{"memory": strip_score(result), "score": result["score"]} for result in results]


async def export_memories(user_id: object, org_id: object, db: asyncpg.Connection, namespace: str | None = None) -> list[dict[str, object]]:
    rows = await db.fetch(
        f"""
        SELECT {MEMORY_COLUMNS}
        FROM memories
        WHERE user_id = $1
          AND org_id = $2 AND ($3::text IS NULL OR namespace=$3)
        ORDER BY created_at DESC
        """,
        user_id,
        org_id,
        namespace,
    )
    return [dict(row) for row in rows]


async def import_memories(
    user_id: object,
    org_id: object,
    items: list[dict[str, object]],
    db: asyncpg.Connection,
    dedup_threshold: float | None = None,
    namespace: str = "default",
) -> int:
    imported = 0
    for item in items:
        content = str(item["content"]).strip()
        category = normalize_category(item.get("category") if isinstance(item.get("category"), str) else infer_category(content))
        pinned = bool(item.get("pinned", False))
        result = await create_memory(user_id, org_id, content, db, dedup_threshold, category, pinned, "approved", "import", namespace=namespace, expires_at=item.get("expires_at") if isinstance(item.get("expires_at"), datetime) else None)
        if result:
            imported += 1
    return imported


async def get_memory_source(
    user_id: object,
    org_id: object,
    memory_id: object,
    db: asyncpg.Connection,
    namespace: str | None = None,
    restrict_personal: bool = False,
) -> dict[str, object] | None:
    memory = await get_memory(user_id, org_id, memory_id, db, namespace)
    if memory is None:
        return None
    conversation = None
    if memory["source_conversation_id"] is not None:
        row = await db.fetchrow(
            """
            SELECT id, extraction_status, memories_extracted, raw_exchange, created_at
            FROM conversations
            WHERE user_id = $1
              AND org_id = $2
              AND id = $3 AND ($4::text IS NULL OR namespace=$4)
            """,
            user_id,
            org_id,
            memory["source_conversation_id"],
            namespace,
        )
        conversation = dict(row) if row is not None else None
        if restrict_personal and conversation is not None and conversation["raw_exchange"] is not None:
            exchange = conversation["raw_exchange"]
            if isinstance(exchange, str):
                exchange = json.loads(exchange)
            if exchange.get("request", {}).get("engram_include_personal"):
                conversation["raw_exchange"] = None
    return {"memory": memory, "conversation": conversation}


async def list_merge_suggestions(
    user_id: object,
    org_id: object,
    db: asyncpg.Connection,
    limit: int = 10,
    namespace: str | None = None,
) -> list[dict[str, object]]:
    rows = await db.fetch(
        f"""
        SELECT {MEMORY_COLUMNS}
        FROM memories
        WHERE user_id = $1
          AND org_id = $2
          AND status = 'approved' AND ($3::text IS NULL OR namespace=$3)
        ORDER BY category, created_at DESC
        LIMIT 200
        """,
        user_id,
        org_id,
        namespace,
    )
    memories = [dict(row) for row in rows]
    suggestions: list[dict[str, object]] = []
    for index, primary in enumerate(memories):
        for duplicate in memories[index + 1:]:
            if primary["category"] != duplicate["category"] or primary.get("namespace", "default") != duplicate.get("namespace", "default"):
                continue
            if memory_similarity_hint(str(primary["content"]), str(duplicate["content"])) < 0.42:
                continue
            suggestions.append({"primary": primary, "duplicate": duplicate, "reason": "Similar wording and category"})
            if len(suggestions) >= limit:
                return suggestions
    return suggestions


async def merge_memories(
    user_id: object,
    org_id: object,
    primary_id: object,
    duplicate_id: object,
    content: str | None,
    db: asyncpg.Connection,
    namespace: str | None = None,
) -> dict[str, object] | None:
    if primary_id == duplicate_id:
        return None
    async with db.transaction():
        primary = await lock_memory(user_id, org_id, primary_id, db)
        duplicate = await lock_memory(user_id, org_id, duplicate_id, db)
        if primary is None or duplicate is None:
            return None
        if primary.get("namespace", "default") != duplicate.get("namespace", "default"):
            return None
        if namespace is not None and primary.get("namespace") != namespace:
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
              AND org_id = $9
              AND id = $10
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
            org_id,
            primary_id,
        )
        await db.execute(
            """
            DELETE FROM memories
            WHERE user_id = $1
              AND org_id = $2
              AND id = $3
            """,
            user_id,
            org_id,
            duplicate_id,
        )
    return dict(row) if row is not None else None


async def apply_confidence_decay(user_id: object, org_id: object, db: asyncpg.Connection, namespace: str | None = None) -> int:
    result = await db.execute(
        """
        UPDATE memories
        SET confidence = GREATEST(0.1, confidence * 0.92)
        WHERE user_id = $1
          AND org_id = $2
          AND status = 'approved' AND ($3::text IS NULL OR namespace=$3)
          AND pinned = false
          AND (
            last_accessed IS NULL AND created_at < now() - interval '30 days'
            OR last_accessed < now() - interval '30 days'
          )
        """,
        user_id,
        org_id,
        namespace,
    )
    return int(result.split()[1])


async def timeline(user_id: object, org_id: object, db: asyncpg.Connection, limit: int = 50, namespace: str | None = None) -> list[dict[str, object]]:
    memory_rows = await db.fetch(
        """
        SELECT id::text AS id, 'memory' AS type, content AS title, category, created_at
        FROM memories
        WHERE user_id = $1
          AND org_id = $2 AND ($4::text IS NULL OR namespace=$4)
        ORDER BY created_at DESC
        LIMIT $3
        """,
        user_id,
        org_id,
        limit,
        namespace,
    )
    conversation_rows = await db.fetch(
        """
        SELECT id::text AS id, 'conversation' AS type, extraction_status AS title, NULL AS category, created_at
        FROM conversations
        WHERE user_id = $1
          AND org_id = $2 AND ($4::text IS NULL OR namespace=$4)
        ORDER BY created_at DESC
        LIMIT $3
        """,
        user_id,
        org_id,
        limit,
        namespace,
    )
    items = [dict(row) for row in memory_rows] + [dict(row) for row in conversation_rows]
    return sorted(items, key=lambda item: item["created_at"], reverse=True)[:limit]


def strip_score(memory: dict[str, object]) -> dict[str, object]:
    return {key: value for key, value in memory.items() if key != "score"}


async def search_memory_rows_for_listing(
    user_id: object,
    org_id: object,
    search: str,
    db: asyncpg.Connection,
    status: MemoryStatus | None,
    category: str | None,
    namespace: str | None = None,
) -> list[dict[str, object]]:
    if not search.strip():
        return []
    status_clause, category_clause, params = build_memory_filters(user_id, org_id, status, category, namespace)
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


async def mark_memories_accessed(
    user_id: object,
    org_id: object,
    memory_ids: list[object],
    db: asyncpg.Connection,
) -> None:
    if not memory_ids:
        return
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
        memory_ids,
    )


async def lock_memory(
    user_id: object,
    org_id: object,
    memory_id: object,
    db: asyncpg.Connection,
) -> dict[str, object] | None:
    row = await db.fetchrow(
        f"""
        SELECT {MEMORY_COLUMNS}
        FROM memories
        WHERE user_id = $1
          AND org_id = $2
          AND id = $3
        FOR UPDATE
        """,
        user_id,
        org_id,
        memory_id,
    )
    return dict(row) if row is not None else None


def build_memory_filters(
    user_id: object,
    org_id: object,
    status: MemoryStatus | None,
    category: str | None,
    namespace: str | None = None,
) -> tuple[str, str, list[object]]:
    params = [user_id, org_id]
    status_clause = "user_id = $1 AND org_id = $2"
    category_clause = ""
    if status is not None:
        params.append(status)
        status_clause += f" AND status = ${len(params)}"
    if category:
        params.append(normalize_category(category))
        category_clause = f"AND category = ${len(params)}"
    if namespace is not None:
        params.append(namespace)
        category_clause += f" AND namespace = ${len(params)}"
    return status_clause, category_clause, params


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


async def list_namespaces(user_id: object, org_id: object, db: asyncpg.Connection, namespace: str | None = None) -> list[dict[str, object]]:
    rows = await db.fetch(
        "SELECT namespace AS name,count(*)::int AS count FROM memories WHERE user_id=$1 AND org_id=$2 AND ($3::text IS NULL OR namespace=$3) GROUP BY namespace ORDER BY namespace",
        user_id, org_id, namespace,
    )
    result = [dict(row) for row in rows]
    if not result:
        return [{"name": namespace or "default", "count": 0}]
    return result


async def bulk_review(
    user_id: object, org_id: object, memory_ids: list[object], status: str,
    db: asyncpg.Connection, namespace: str | None = None,
) -> int:
    async with db.transaction():
        result = await db.execute(
            """
            UPDATE memories SET status=$1,last_confirmed=CASE WHEN $1='approved' THEN now() ELSE last_confirmed END
            WHERE user_id=$2 AND org_id=$3 AND id=ANY($4::uuid[]) AND ($5::text IS NULL OR namespace=$5)
            """, status, user_id, org_id, memory_ids, namespace,
        )
    return int(result.split()[1])
