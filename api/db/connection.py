import asyncpg

from api.config import settings


_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(
        settings.database_url,
        min_size=settings.database_min_pool_size,
        max_size=settings.database_max_pool_size,
        statement_cache_size=settings.database_statement_cache_size,
    )


async def close_pool() -> None:
    if _pool is not None:
        await _pool.close()


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Pool not initialized")
    return _pool


async def check_database() -> bool:
    async with get_pool().acquire() as connection:
        value = await connection.fetchval("SELECT 1")
    return value == 1
