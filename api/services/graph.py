import asyncio
import logging
import re
from itertools import combinations
from uuid import UUID

import asyncpg

from api.db.connection import get_pool

from api.services.providers.base import ExtractionProvider
from api.services.providers.factory import build_extraction_provider
from api.services.provider_keys import ResolvedProvider


logger = logging.getLogger(__name__)

VALID_ENTITY_TYPES = {"person", "project", "skill", "technology", "preference", "topic", "organization"}

ENTITY_EXTRACTION_PROMPT = """Extract named entities from this memory. For each entity, return a string formatted as "name|type" where type is one of: person, project, skill, technology, preference, topic, organization.

RULES:
1. Only extract concrete named entities (e.g. "FastAPI", "Engram", "Alice"). Skip generic terms.
2. Use the most specific type that fits.
3. Use one canonical short name per entity and reuse it consistently (e.g. "Cutscene", never "the cutscene project" or "cutscene system").
4. Maximum 5 entities per memory.
5. Return ONLY a valid JSON array of strings, no preamble.

Examples:
Memory: "User prefers FastAPI over Flask for Python backends"
Output: ["FastAPI|technology", "Flask|technology", "Python|technology"]

Memory: "User is building Engram, an open-source memory layer"
Output: ["Engram|project"]

Memory: "User dislikes early mornings"
Output: []

MEMORY:
{content}

ENTITIES (JSON array only):"""


def _parse_entity_strings(raw: list[str]) -> list[dict[str, str]]:
    parsed: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in raw:
        if "|" not in item:
            continue
        name_part, _, type_part = item.partition("|")
        name = name_part.strip()
        entity_type = type_part.strip().lower()
        if not name or entity_type not in VALID_ENTITY_TYPES:
            continue
        key = (name.lower(),)
        if key in seen:
            continue
        seen.add(key)
        parsed.append({"name": name, "type": entity_type})
    return parsed


async def extract_entities_for_memory(
    user_id: UUID,
    org_id: UUID,
    memory_id: UUID,
    content: str,
    resolved: ResolvedProvider,
    db: asyncpg.Connection,
) -> int:
    provider: ExtractionProvider = build_extraction_provider(resolved)
    try:
        raw = await provider.extract(ENTITY_EXTRACTION_PROMPT.format(content=content))
    except Exception as error:
        logger.warning("Entity extraction failed for memory %s: %s", memory_id, error)
        return 0
    entities = _parse_entity_strings(raw)
    inserted = 0
    for entity in entities:
        row = await db.fetchrow(
            """
            INSERT INTO memory_entities (user_id, org_id, name, entity_type)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (org_id, user_id, lower(name))
            DO UPDATE SET name = memory_entities.name
            RETURNING id
            """,
            user_id,
            org_id,
            entity["name"],
            entity["type"],
        )
        if row is None:
            continue
        await db.execute(
            """
            INSERT INTO memory_entity_links (memory_id, entity_id)
            SELECT $1, $2
            WHERE EXISTS (
                SELECT 1 FROM memories
                WHERE id = $1 AND user_id = $3 AND org_id = $4
            )
            ON CONFLICT DO NOTHING
            """,
            memory_id,
            row["id"],
            user_id,
            org_id,
        )
        inserted += 1
    return inserted


def _containment_edges(entities: list[dict[str, object]]) -> list[tuple[UUID, UUID]]:
    """Pairs whose name word-sets contain one another ("Cutscene" ⊆ "Cutscene System")."""
    words: dict[UUID, frozenset[str]] = {}
    for entity in entities:
        tokens = frozenset(re.findall(r"[a-z0-9]+", str(entity["name"]).lower()))
        if tokens:
            words[entity["id"]] = tokens  # type: ignore[index]
    # ponytail: O(n²) over per-user entities; index with pg_trgm if counts ever hurt
    return [
        (a, b)
        for a, b in combinations(words, 2)
        if words[a] <= words[b] or words[b] <= words[a]
    ]


async def list_entity_edges(user_id: UUID, org_id: UUID, db: asyncpg.Connection) -> list[dict[str, object]]:
    rows = await db.fetch(
        """
        SELECT a.entity_id AS source, b.entity_id AS target, COUNT(*) AS weight
        FROM memory_entity_links a
        JOIN memory_entity_links b ON a.memory_id = b.memory_id AND a.entity_id < b.entity_id
        JOIN memory_entities ea ON ea.id = a.entity_id
        JOIN memory_entities eb ON eb.id = b.entity_id
        JOIN memories m ON m.id = a.memory_id
        WHERE ea.user_id = $1 AND ea.org_id = $2
          AND eb.user_id = $1 AND eb.org_id = $2
          AND m.user_id = $1 AND m.org_id = $2
        GROUP BY a.entity_id, b.entity_id
        """,
        user_id,
        org_id,
    )
    edges: dict[tuple[str, str], dict[str, object]] = {}
    for row in rows:
        key = tuple(sorted((str(row["source"]), str(row["target"]))))
        edges[key] = dict(row)
    entities = await db.fetch(
        "SELECT id, name FROM memory_entities WHERE user_id = $1 AND org_id = $2",
        user_id,
        org_id,
    )
    for source, target in _containment_edges([dict(e) for e in entities]):
        key = tuple(sorted((str(source), str(target))))
        edges.setdefault(key, {"source": source, "target": target, "weight": 1})
    return list(edges.values())


async def list_user_entities(user_id: UUID, org_id: UUID, db: asyncpg.Connection) -> list[dict[str, object]]:
    rows = await db.fetch(
        """
        SELECT e.id, e.name, e.entity_type, COUNT(mel.memory_id) AS memory_count
        FROM memory_entities e
        LEFT JOIN memory_entity_links mel ON mel.entity_id = e.id
        WHERE e.user_id = $1 AND e.org_id = $2
        GROUP BY e.id, e.name, e.entity_type
        ORDER BY memory_count DESC, e.name ASC
        """,
        user_id,
        org_id,
    )
    return [dict(row) for row in rows]


async def list_memories_for_entity(
    user_id: UUID,
    org_id: UUID,
    entity_type: str,
    entity_name: str,
    db: asyncpg.Connection,
) -> list[dict[str, object]]:
    rows = await db.fetch(
        """
        SELECT m.id, m.content, m.confidence, m.category, m.created_at, m.pinned
        FROM memories m
        JOIN memory_entity_links mel ON mel.memory_id = m.id
        JOIN memory_entities e ON e.id = mel.entity_id
        WHERE e.user_id = $1 AND e.org_id = $2
          AND e.name = $3 AND e.entity_type = $4
          AND m.user_id = $1 AND m.org_id = $2
          AND m.status = 'approved'
        ORDER BY m.confidence DESC, m.created_at DESC
        """,
        user_id,
        org_id,
        entity_name,
        entity_type,
    )
    return [dict(row) for row in rows]


async def get_memory_neighbors(
    user_id: UUID,
    org_id: UUID,
    memory_id: UUID,
    db: asyncpg.Connection,
    limit: int = 20,
) -> list[dict[str, object]]:
    rows = await db.fetch(
        """
        SELECT DISTINCT m.id, m.content, m.confidence, m.category, m.created_at, m.pinned
        FROM memories m
        JOIN memory_entity_links mel ON mel.memory_id = m.id
        WHERE mel.entity_id IN (
            SELECT source_link.entity_id
            FROM memory_entity_links source_link
            JOIN memories source_memory ON source_memory.id = source_link.memory_id
            WHERE source_link.memory_id = $3
              AND source_memory.user_id = $1
              AND source_memory.org_id = $2
        )
        AND m.id != $3
        AND m.user_id = $1
        AND m.org_id = $2
        AND m.status = 'approved'
        ORDER BY m.confidence DESC
        LIMIT $4
        """,
        user_id,
        org_id,
        memory_id,
        limit,
    )
    return [dict(row) for row in rows]


async def get_memory_entities(
    user_id: UUID,
    org_id: UUID,
    memory_id: UUID,
    db: asyncpg.Connection,
) -> list[dict[str, object]]:
    rows = await db.fetch(
        """
        SELECT e.id, e.name, e.entity_type
        FROM memory_entities e
        JOIN memory_entity_links mel ON mel.entity_id = e.id
        JOIN memories m ON m.id = mel.memory_id
        WHERE mel.memory_id = $3
          AND e.user_id = $1 AND e.org_id = $2
          AND m.user_id = $1 AND m.org_id = $2
        ORDER BY e.name ASC
        """,
        user_id,
        org_id,
        memory_id,
    )
    return [dict(row) for row in rows]


async def backfill_entities_for_user(
    user_id: UUID,
    org_id: UUID,
    db: asyncpg.Connection,
    resolved: ResolvedProvider,
    concurrency: int = 5,
) -> dict[str, int]:
    memories = await db.fetch(
        """
        SELECT m.id, m.content
        FROM memories m
        WHERE m.user_id = $1 AND m.org_id = $2 AND m.status = 'approved'
          AND NOT EXISTS (
            SELECT 1 FROM memory_entity_links mel WHERE mel.memory_id = m.id
          )
        """,
        user_id,
        org_id,
    )
    if not memories:
        return {"processed": 0, "entities_created": 0}

    semaphore = asyncio.Semaphore(concurrency)
    pool = get_pool()

    async def _process(memory_row: asyncpg.Record) -> int:
        async with semaphore:
            async with pool.acquire() as conn:
                try:
                    return await extract_entities_for_memory(
                        user_id, org_id, memory_row["id"], str(memory_row["content"]), resolved, conn
                    )
                except Exception as error:
                    logger.warning("Backfill failed for memory %s: %s", memory_row["id"], error)
                    return 0

    results = await asyncio.gather(*(_process(memory) for memory in memories))
    return {"processed": len(memories), "entities_created": sum(results)}
