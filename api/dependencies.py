from collections.abc import AsyncIterator

import asyncpg
from fastapi import Depends, Header, HTTPException

from api.db.connection import get_pool
from api.services.users import get_user_by_api_key


async def get_db() -> AsyncIterator[asyncpg.Connection]:
    async with get_pool().acquire() as connection:
        yield connection


async def get_current_user(
    x_engram_key: str = Header(...),
    db: asyncpg.Connection = Depends(get_db),
) -> asyncpg.Record:
    user = await get_user_by_api_key(x_engram_key, db)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return user
