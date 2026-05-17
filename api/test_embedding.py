import asyncio
import logging


logger = logging.getLogger(__name__)


async def main() -> None:
    from api.db.connection import close_pool, get_pool, init_pool
    from api.services.embedding import embed, embed_batch, format_embedding_for_pgvector, load_model

    logging.basicConfig(level=logging.INFO)
    await init_pool()
    load_model()
    try:
        sentences = [
            "User prefers FastAPI for Python backend services",
            "User writes TypeScript for frontend projects",
            "User enjoys mountain photography on weekends",
            "User is preparing for database systems interviews",
            "User runs local language models with Ollama",
        ]
        embeddings = embed_batch(sentences)
        query_embedding = embed("Which backend framework does the user prefer?")
        async with get_pool().acquire() as db:
            await db.execute("CREATE TEMP TABLE memory_probe (content TEXT NOT NULL, embedding vector(384) NOT NULL)")
            for index, sentence in enumerate(sentences):
                await db.execute(
                    """
                    INSERT INTO memory_probe (content, embedding)
                    VALUES ($1, $2::vector)
                    """,
                    sentence,
                    format_embedding_for_pgvector(embeddings[index]),
                )
            rows = await db.fetch(
                """
                SELECT content, 1 - (embedding <=> $1::vector) AS score
                FROM memory_probe
                ORDER BY score DESC
                LIMIT 5
                """,
                format_embedding_for_pgvector(query_embedding),
            )
        for row in rows:
            logger.info("%0.3f %s", row["score"], row["content"])
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
