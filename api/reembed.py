import asyncio

from api.config import settings
from api.db.connection import close_pool, get_pool, init_pool
from api.services.embedding import embed_batch, format_embedding_for_pgvector, load_model


BATCH_SIZE = 64


async def reembed_all() -> int:
    print(f"Loading embedding model: {settings.embedding_model}")
    load_model()
    await init_pool()
    try:
        async with get_pool().acquire() as db:
            rows = await db.fetch("SELECT id, content FROM memories ORDER BY created_at")
            total = len(rows)
            print(f"Re-embedding {total} memories with {settings.embedding_model}")
            for start in range(0, total, BATCH_SIZE):
                batch = rows[start : start + BATCH_SIZE]
                contents = [str(row["content"]) for row in batch]
                embeddings = embed_batch(contents)
                for row, emb in zip(batch, embeddings):
                    await db.execute(
                        "UPDATE memories SET embedding = $1::vector WHERE id = $2",
                        format_embedding_for_pgvector(emb),
                        row["id"],
                    )
                print(f"  {min(start + BATCH_SIZE, total)}/{total}")
        return total
    finally:
        await close_pool()


async def main() -> None:
    count = await reembed_all()
    print(f"Re-embedded {count} memories")


if __name__ == "__main__":
    asyncio.run(main())
