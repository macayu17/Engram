from collections.abc import AsyncIterator
import hmac

import asyncpg
from fastapi import Depends, Header, HTTPException

from api.config import settings
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


async def require_service_key(x_engram_service_key: str = Header(default="")) -> None:
    if not settings.engram_service_key:
        raise HTTPException(status_code=503, detail="Service key auth is not configured")
    if not x_engram_service_key or not hmac.compare_digest(x_engram_service_key, settings.engram_service_key):
        raise HTTPException(status_code=401, detail="Invalid service key")
