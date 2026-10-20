import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.config import settings
from api.db.connection import check_database, close_pool, init_pool
from api.db.schema import apply_schema
from api.models.oauth import OAuthHTTPException
from api.routes import billing, connections, graph, logs, memories, oauth, orgs, proxy, users
from api.services.embedding import is_model_loaded, is_reranker_loaded, load_model, load_reranker
from api.services.jobs import extraction_worker, shutdown_extraction_tasks


logging.basicConfig(level=settings.log_level.upper())


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    await apply_schema()
    await init_pool()
    load_model()
    if settings.enable_reranker:
        load_reranker()
    worker = asyncio.create_task(extraction_worker())
    try:
        yield
    finally:
        worker.cancel()
        await asyncio.gather(worker, return_exceptions=True)
        await shutdown_extraction_tasks()
        await close_pool()


app = FastAPI(title="Engram", version="1.0.0", lifespan=lifespan)


@app.exception_handler(OAuthHTTPException)
async def oauth_error(request: Request, error: OAuthHTTPException) -> JSONResponse:
    return JSONResponse(content=error.detail, status_code=error.status_code, headers=error.headers)

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
app.include_router(orgs.router, prefix="/orgs", tags=["orgs"])
app.include_router(graph.router, prefix="/graph", tags=["graph"])
app.include_router(billing.router, prefix="/billing", tags=["billing"])
app.include_router(connections.router, prefix="/connections", tags=["connections"])
app.include_router(oauth.router, tags=["oauth"])


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
        "reranker": "loaded" if is_reranker_loaded() else "disabled",
        "version": "1.0.0",
    }
