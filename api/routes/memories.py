from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import UUID4

from api.dependencies import get_current_user, get_db
from api.models.conversation import ConversationCaptureRequest, ConversationCaptureResponse
from api.models.memory import (
    MemoryCreate,
    MemoryListResponse,
    MemoryResponse,
    MemorySearchRequest,
    MemorySearchResponse,
    MemoryUpdate,
)
from api.services.extraction import capture_conversation_memories
from api.services.memories import (
    create_memory,
    delete_memory,
    get_memory,
    list_memories,
    search_memories,
    update_memory,
)


router = APIRouter()


@router.get("", response_model=MemoryListResponse)
async def list_memories_route(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None),
    order: Literal["created_at", "last_accessed", "access_count"] = Query(default="created_at"),
    direction: Literal["asc", "desc"] = Query(default="desc"),
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    memories, total = await list_memories(user["id"], db, limit, offset, search, order, direction)
    return {"memories": memories, "total": total, "limit": limit, "offset": offset}


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory_route(
    payload: MemoryCreate,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return await create_memory(user["id"], payload.content, db, float(user["dedup_threshold"]))


@router.post("/capture", response_model=ConversationCaptureResponse, status_code=status.HTTP_201_CREATED)
async def capture_conversation_route(
    payload: ConversationCaptureRequest,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    try:
        return await capture_conversation_memories(
            user["id"],
            payload.user_message,
            payload.assistant_response,
            payload.source,
            payload.session_id,
            db,
            float(user["dedup_threshold"]),
        )
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory_route(
    memory_id: UUID4,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    memory = await get_memory(user["id"], memory_id, db)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.patch("/{memory_id}", response_model=MemoryResponse)
async def update_memory_route(
    memory_id: UUID4,
    payload: MemoryUpdate,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    memory = await update_memory(user["id"], memory_id, payload.content, db)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory_route(
    memory_id: UUID4,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> Response:
    deleted = await delete_memory(user["id"], memory_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/search", response_model=MemorySearchResponse)
async def search_memories_route(
    payload: MemorySearchRequest,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    results = await search_memories(user["id"], payload.query, payload.limit, payload.threshold, db)
    return {"results": results}
