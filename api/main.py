from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.config import settings
from api.db.connection import check_database, close_pool, init_pool
from api.routes import logs, memories, proxy, users
from api.services.embedding import is_model_loaded, load_model


logging.basicConfig(level=settings.log_level.upper())


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await init_pool()
    load_model()
    yield
    await close_pool()


app = FastAPI(title="Engram", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Engram-Conversation-ID", "X-Engram-Memories-Injected"],
)

app.include_router(proxy.router, tags=["proxy"])
app.include_router(memories.router, prefix="/memories", tags=["memories"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(logs.router, prefix="/logs", tags=["logs"])


@app.get("/health")
async def health() -> dict[str, str]:
    try:
        database_connected = await check_database()
    except Exception as error:
        raise HTTPException(status_code=503, detail="Database unavailable") from error
    if not database_connected:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {
        "status": "ok",
        "database": "connected",
        "embedding_model": "loaded" if is_model_loaded() else "not_loaded",
        "version": "1.0.0",
    }
