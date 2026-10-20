from collections.abc import AsyncIterator
import hmac

import asyncpg
from fastapi import Header, HTTPException, Request

from api.config import settings
from api.db.connection import get_pool
from api.services.users import get_user_by_api_key


async def get_db() -> AsyncIterator[asyncpg.Connection]:
    async with get_pool().acquire() as connection:
        yield connection


async def get_current_user(
    request: Request,
    x_engram_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> asyncpg.Record:
    async with get_pool().acquire() as db:
        if x_engram_key:
            user = await get_user_by_api_key(x_engram_key, db)
        elif authorization and authorization.lower().startswith("bearer "):
            from api.services.oauth import get_user_by_access_token

            user = await get_user_by_access_token(authorization[7:].strip(), db)
            if user is not None:
                path = request.url.path
                if not (path == "/memories" or path.startswith("/memories/") or path == "/logs" or path.startswith("/logs/")):
                    raise HTTPException(status_code=403, detail="OAuth connections may access memory tools only")
                required_scope = "memory:read" if request.method == "GET" or path == "/memories/search" else "memory:write"
                if required_scope not in str(user["oauth_scope"]).split():
                    raise HTTPException(status_code=403, detail=f"Missing scope: {required_scope}")
        else:
            user = None
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return user


async def require_service_key(x_engram_service_key: str = Header(default="")) -> None:
    if not settings.engram_service_key:
        raise HTTPException(status_code=503, detail="Service key auth is not configured")
    if not x_engram_service_key or not hmac.compare_digest(x_engram_service_key, settings.engram_service_key):
        raise HTTPException(status_code=401, detail="Invalid service key")
