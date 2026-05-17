from pathlib import Path

import asyncpg

from api.config import settings


SCHEMA_PATH = Path(__file__).with_name("schema.sql")


async def apply_schema() -> None:
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    connection = await asyncpg.connect(
        settings.database_url,
        statement_cache_size=settings.database_statement_cache_size,
    )
    try:
        await connection.execute(schema_sql)
    finally:
        await connection.close()
