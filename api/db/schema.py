from pathlib import Path

import asyncpg

from api.config import settings


SCHEMA_PATH = Path(__file__).with_name("schema.sql")


async def apply_schema() -> None:
    schema_paths = [SCHEMA_PATH, SCHEMA_PATH.with_name("product.sql"), SCHEMA_PATH.with_name("oauth.sql")]
    schema_sql = "\n".join(path.read_text(encoding="utf-8") for path in schema_paths)
    connection = await asyncpg.connect(
        settings.database_url,
        statement_cache_size=settings.database_statement_cache_size,
    )
    try:
        await connection.execute(schema_sql)
    finally:
        await connection.close()
