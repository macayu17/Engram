import argparse
import asyncio
import json
import logging
import sys
import uuid
from pathlib import Path

import asyncpg

from api.config import settings

logger = logging.getLogger(__name__)

GOLDEN_SET_PATH = Path(__file__).parent / "golden_set.json"


async def seed_user(db: asyncpg.Connection) -> tuple[str, uuid.UUID, uuid.UUID]:
    external_id = f"eval_{uuid.uuid4().hex[:8]}"
    row = await db.fetchrow(
        "INSERT INTO users (external_id, api_key_hash) VALUES ($1, $2) RETURNING id",
        external_id,
        f"eval_hash_{uuid.uuid4().hex}",
    )
    org = await db.fetchrow("INSERT INTO orgs (name) VALUES ($1) RETURNING id", f"{external_id} workspace")
    await db.execute(
        "INSERT INTO org_memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')",
        org["id"],
        row["id"],
    )
    return external_id, row["id"], org["id"]


async def seed_memory(db: asyncpg.Connection, user_id: uuid.UUID, org_id: uuid.UUID, content: str) -> None:
    from api.services.embedding import embed, format_embedding_for_pgvector

    embedding = format_embedding_for_pgvector(embed(content))
    await db.execute(
        """
        INSERT INTO memories (user_id, org_id, content, embedding, status, source)
        VALUES ($1, $2, $3, $4::vector, 'approved', 'eval')
        """,
        user_id,
        org_id,
        content,
        embedding,
    )


async def run_query(
    db: asyncpg.Connection,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
    query: str,
    mode: str,
    limit: int = 5,
) -> list[str]:
    from api.services.retrieval import retrieve_memories, retrieve_memories_hybrid

    if mode == "hybrid":
        results = await retrieve_memories_hybrid(user_id, org_id, query, db, limit, settings.retrieval_threshold)
    else:
        results = await retrieve_memories(user_id, org_id, query, db, limit, settings.retrieval_threshold)
    return [str(r["content"]) for r in results]


def precision_recall(retrieved: list[str], expected_memory: str) -> tuple[float, float]:
    hits = sum(1 for memory in retrieved if memory.strip().casefold() == expected_memory.strip().casefold())
    precision = hits / len(retrieved) if retrieved else 0.0
    recall = min(hits, 1)
    return precision, float(recall)


async def evaluate(mode: str) -> dict[str, float]:
    from api.services.embedding import load_model

    from api.services.embedding import is_model_loaded

    if not is_model_loaded():
        load_model()

    golden = json.loads(GOLDEN_SET_PATH.read_text())

    db = await asyncpg.connect(settings.database_url)
    transaction = db.transaction()
    await transaction.start()
    try:
        _, user_id, org_id = await seed_user(db)
        for entry in golden:
            await seed_memory(db, user_id, org_id, entry["memory"])

        total_precision = 0.0
        total_recall = 0.0
        total_queries = 0
        total_non_query_hits = 0
        total_non_queries = 0

        logger.info(f"\n{'-' * 60}")
        logger.info(f"  Mode: {mode.upper()}")
        logger.info(f"{'-' * 60}")

        for entry in golden:
            logger.info(f"\n[{entry['id']}] Target: {entry['memory'][:60]}...")
            for query in entry["queries"]:
                retrieved = await run_query(db, user_id, org_id, query, mode)
                p, r = precision_recall(retrieved, entry["memory"])
                total_precision += p
                total_recall += r
                total_queries += 1
                hit = "HIT" if r else "MISS"
                logger.info(f"  {hit} Q: {query[:50]!r:<52}  P={p:.2f} R={r:.0f}")
            for non_query in entry.get("non_queries", []):
                retrieved = await run_query(db, user_id, org_id, non_query, mode)
                hit = any(entry["memory"].strip().casefold() == memory.strip().casefold() for memory in retrieved)
                if hit:
                    total_non_query_hits += 1
                total_non_queries += 1

    finally:
        await transaction.rollback()
        await db.close()

    avg_precision = total_precision / total_queries if total_queries else 0.0
    avg_recall = total_recall / total_queries if total_queries else 0.0
    specificity = 1.0 - (total_non_query_hits / total_non_queries) if total_non_queries else 1.0

    logger.info(f"\n{'-' * 60}")
    logger.info(f"  Precision@5 : {avg_precision:.3f}")
    logger.info(f"  Recall@5    : {avg_recall:.3f}")
    logger.info(f"  Specificity : {specificity:.3f}  (expected-fact exclusion on negative queries)")
    logger.info(f"{'-' * 60}\n")

    return {"precision": avg_precision, "recall": avg_recall, "specificity": specificity}


async def compare() -> None:
    logger.info("Running vector-only...")
    vector_scores = await evaluate("vector")
    logger.info("Running hybrid...")
    hybrid_scores = await evaluate("hybrid")

    logger.info(f"\n{'-' * 60}")
    logger.info("  COMPARISON")
    logger.info(f"{'-' * 60}")
    for metric in ("precision", "recall", "specificity"):
        v = vector_scores[metric]
        h = hybrid_scores[metric]
        delta = h - v
        arrow = "+" if delta > 0 else ("-" if delta < 0 else "-")
        logger.info(f"  {metric:<12} vector={v:.3f}  hybrid={h:.3f}  {arrow}{abs(delta):.3f}")
    logger.info(f"{'-' * 60}\n")


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="Engram retrieval eval harness")
    parser.add_argument("--mode", choices=["vector", "hybrid", "compare"], default="vector")
    args = parser.parse_args()

    if args.mode == "compare":
        asyncio.run(compare())
    else:
        asyncio.run(evaluate(args.mode))


if __name__ == "__main__":
    sys.exit(main())
