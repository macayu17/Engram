import asyncio
import json
import logging
import uuid
from pathlib import Path

import asyncpg

from api.config import settings


logger = logging.getLogger(__name__)
GOLDEN_SET_PATH = Path(__file__).parent / "golden_set.json"


async def seed_user(db: asyncpg.Connection) -> tuple[uuid.UUID, uuid.UUID]:
    external_id = f"eval_{uuid.uuid4().hex[:8]}"
    user_id = await db.fetchval(
        "INSERT INTO users (external_id, api_key_hash) VALUES ($1, $2) RETURNING id",
        external_id,
        f"eval_hash_{uuid.uuid4().hex}",
    )
    org_id = await db.fetchval("INSERT INTO orgs (name) VALUES ($1) RETURNING id", f"{external_id} workspace")
    await db.execute("INSERT INTO org_memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')", org_id, user_id)
    return user_id, org_id


PINNED_DISTRACTOR = "User's favourite colour is teal"


async def seed_memory(
    db: asyncpg.Connection, user_id: uuid.UUID, org_id: uuid.UUID, content: str, age_days: int, pinned: bool = False,
) -> None:
    from api.services.embedding import embed, format_embedding_for_pgvector

    await db.execute(
        """
        INSERT INTO memories (user_id, org_id, content, embedding, status, source, pinned, created_at)
        VALUES ($1, $2, $3, $4::vector, 'approved', 'eval', $5, now() - make_interval(days => $6))
        """,
        user_id,
        org_id,
        content,
        format_embedding_for_pgvector(embed(content)),
        pinned,
        age_days,
    )


def precision_recall(retrieved: list[str], expected_memory: str) -> tuple[float, float]:
    hits = sum(1 for memory in retrieved if memory.strip().casefold() == expected_memory.strip().casefold())
    precision = hits / len(retrieved) if retrieved else 0.0
    return precision, float(min(hits, 1))


def reciprocal_rank(retrieved: list[str], expected_memory: str) -> float:
    for position, memory in enumerate(retrieved, start=1):
        if memory.strip().casefold() == expected_memory.strip().casefold():
            return 1.0 / position
    return 0.0


async def evaluate() -> dict[str, float]:
    from api.services.embedding import is_model_loaded, load_model
    from api.services.retrieval import retrieve_memories

    if not is_model_loaded():
        load_model()
    golden = json.loads(GOLDEN_SET_PATH.read_text(encoding="utf-8"))
    db = await asyncpg.connect(settings.database_url)
    transaction = db.transaction()
    await transaction.start()
    totals = {"precision": 0.0, "recall": 0.0, "mrr": 0.0, "injected": 0.0}
    queries = 0
    negative_hits = 0
    negatives = 0
    try:
        user_id, org_id = await seed_user(db)
        for position, entry in enumerate(golden):
            await seed_memory(db, user_id, org_id, entry["memory"], age_days=position * 12)
        await seed_memory(db, user_id, org_id, PINNED_DISTRACTOR, age_days=0, pinned=True)
        for entry in golden:
            for query in entry["queries"]:
                rows = await retrieve_memories(user_id, org_id, query, db, focused=True)
                retrieved = [str(row["content"]) for row in rows if row["content"] != PINNED_DISTRACTOR]
                precision, recall = precision_recall(retrieved, entry["memory"])
                totals["precision"] += precision
                totals["recall"] += recall
                totals["mrr"] += reciprocal_rank(retrieved, entry["memory"])
                totals["injected"] += len(retrieved)
                queries += 1
                logger.info("%s %r -> %d memories", "HIT " if recall else "MISS", query, len(retrieved))
            for query in entry.get("non_queries", []):
                rows = await retrieve_memories(user_id, org_id, query, db, focused=True)
                negatives += 1
                negative_hits += any(str(row["content"]) == entry["memory"] for row in rows)
    finally:
        await transaction.rollback()
        await db.close()
    scores = {name: value / queries for name, value in totals.items()}
    scores["specificity"] = 1.0 - negative_hits / negatives if negatives else 1.0
    logger.info(
        "model=%s recall@%d=%.3f mrr=%.3f precision=%.3f specificity=%.3f injected=%.2f",
        settings.embedding_model, settings.max_memories_injected, scores["recall"], scores["mrr"],
        scores["precision"], scores["specificity"], scores["injected"],
    )
    return scores


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    asyncio.run(evaluate())
