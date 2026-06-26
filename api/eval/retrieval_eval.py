"""
Retrieval quality eval harness.

Usage:
    python -m api.eval.retrieval_eval --mode vector
    python -m api.eval.retrieval_eval --mode hybrid
    python -m api.eval.retrieval_eval --mode compare

Requires a running Postgres with the Engram schema and the embedding model loaded.
Seeds a temporary user with the golden-set memories, runs each query, measures
precision@5 and recall@5, then deletes the test user.
"""

import argparse
import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

import asyncpg

GOLDEN_SET_PATH = Path(__file__).parent / "golden_set.json"


async def seed_user(db: asyncpg.Connection) -> tuple[str, uuid.UUID]:
    external_id = f"eval_{uuid.uuid4().hex[:8]}"
    row = await db.fetchrow(
        "INSERT INTO users (external_id, api_key_hash) VALUES ($1, $2) RETURNING id",
        external_id,
        f"eval_hash_{uuid.uuid4().hex}",
    )
    return external_id, row["id"]


async def seed_memory(db: asyncpg.Connection, user_id: uuid.UUID, content: str) -> None:
    from api.services.embedding import embed, format_embedding_for_pgvector

    embedding = format_embedding_for_pgvector(embed(content))
    await db.execute(
        """
        INSERT INTO memories (user_id, content, embedding, status, source)
        VALUES ($1, $2, $3::vector, 'approved', 'eval')
        """,
        user_id,
        content,
        embedding,
    )


async def delete_user(db: asyncpg.Connection, user_id: uuid.UUID) -> None:
    await db.execute("DELETE FROM users WHERE id = $1", user_id)


async def run_query(
    db: asyncpg.Connection,
    user_id: uuid.UUID,
    query: str,
    mode: str,
    limit: int = 5,
) -> list[str]:
    from api.services.retrieval import retrieve_memories, retrieve_memories_hybrid

    if mode == "hybrid":
        results = await retrieve_memories_hybrid(user_id, query, db, limit, 0.0)
    else:
        results = await retrieve_memories(user_id, query, db, limit, 0.0)
    return [str(r["content"]) for r in results]


def precision_recall(retrieved: list[str], expected_memory: str) -> tuple[float, float]:
    hits = sum(1 for r in retrieved if expected_memory.lower() in r.lower() or r.lower() in expected_memory.lower())
    precision = hits / len(retrieved) if retrieved else 0.0
    recall = min(hits, 1)
    return precision, float(recall)


async def evaluate(mode: str) -> dict[str, float]:
    from api.services.embedding import load_model

    load_model()

    database_url = os.environ.get("DATABASE_URL", "postgresql://engram:engram@localhost:5432/engram")
    golden = json.loads(GOLDEN_SET_PATH.read_text())

    db = await asyncpg.connect(database_url)
    try:
        _, user_id = await seed_user(db)
        for entry in golden:
            await seed_memory(db, user_id, entry["memory"])

        total_precision = 0.0
        total_recall = 0.0
        total_queries = 0
        total_non_query_hits = 0
        total_non_queries = 0

        print(f"\n{'─' * 60}")
        print(f"  Mode: {mode.upper()}")
        print(f"{'─' * 60}")

        for entry in golden:
            print(f"\n[{entry['id']}] Target: {entry['memory'][:60]}...")
            for query in entry["queries"]:
                retrieved = await run_query(db, user_id, query, mode)
                p, r = precision_recall(retrieved, entry["memory"])
                total_precision += p
                total_recall += r
                total_queries += 1
                hit = "✓" if r else "✗"
                print(f"  {hit} Q: {query[:50]!r:<52}  P={p:.2f} R={r:.0f}")
            for non_query in entry.get("non_queries", []):
                retrieved = await run_query(db, user_id, non_query, mode)
                hit = any(entry["memory"].lower() in r.lower() for r in retrieved)
                if hit:
                    total_non_query_hits += 1
                total_non_queries += 1

        await delete_user(db, user_id)
    finally:
        await db.close()

    avg_precision = total_precision / total_queries if total_queries else 0.0
    avg_recall = total_recall / total_queries if total_queries else 0.0
    specificity = 1.0 - (total_non_query_hits / total_non_queries) if total_non_queries else 1.0

    print(f"\n{'─' * 60}")
    print(f"  Precision@5 : {avg_precision:.3f}")
    print(f"  Recall@5    : {avg_recall:.3f}")
    print(f"  Specificity : {specificity:.3f}  (non-query non-retrieval rate)")
    print(f"{'─' * 60}\n")

    return {"precision": avg_precision, "recall": avg_recall, "specificity": specificity}


async def compare() -> None:
    print("Running vector-only...")
    vector_scores = await evaluate("vector")
    print("Running hybrid...")
    hybrid_scores = await evaluate("hybrid")

    print(f"\n{'─' * 60}")
    print("  COMPARISON")
    print(f"{'─' * 60}")
    for metric in ("precision", "recall", "specificity"):
        v = vector_scores[metric]
        h = hybrid_scores[metric]
        delta = h - v
        arrow = "▲" if delta > 0 else ("▼" if delta < 0 else "─")
        print(f"  {metric:<12} vector={v:.3f}  hybrid={h:.3f}  {arrow}{abs(delta):.3f}")
    print(f"{'─' * 60}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Engram retrieval eval harness")
    parser.add_argument("--mode", choices=["vector", "hybrid", "compare"], default="vector")
    args = parser.parse_args()

    if args.mode == "compare":
        asyncio.run(compare())
    else:
        asyncio.run(evaluate(args.mode))


if __name__ == "__main__":
    sys.exit(main())
