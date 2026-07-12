import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import UUID4

from api.dependencies import get_current_user, get_db
from api.models.log import ClientRegistryResponse, RetrievalLogDetailResponse, RetrievalLogListResponse
from api.services.logs import get_retrieval_log, list_clients, list_retrieval_logs


router = APIRouter()


@router.get("/clients", response_model=ClientRegistryResponse)
async def list_clients_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return {"clients": await list_clients(user["id"], user["org_id"], db)}


@router.get("", response_model=RetrievalLogListResponse)
async def list_logs_route(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    conversation_id: UUID4 | None = Query(default=None),
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    logs, total = await list_retrieval_logs(user["id"], user["org_id"], db, limit, offset, conversation_id)
    return {"logs": logs, "total": total, "limit": limit, "offset": offset}


@router.get("/{log_id}", response_model=RetrievalLogDetailResponse)
async def get_log_route(
    log_id: UUID4,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    log = await get_retrieval_log(user["id"], user["org_id"], log_id, db)
    if log is None:
        raise HTTPException(status_code=404, detail="Retrieval log not found")
    return log
