from typing import Literal

import asyncpg
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from pydantic import UUID4

from api.dependencies import get_current_user, get_db
from api.models.conversation import ConversationCaptureRequest, ConversationCaptureResponse
from api.models.memory import (
    MemoryCreate,
    MemoryConflictListResponse,
    MemoryConflictResolveRequest,
    MemoryConflictResponse,
    MemoryDecayResponse,
    MemoryExportResponse,
    MemoryImportRequest,
    MemoryImportResponse,
    MemoryListResponse,
    MemoryMergeRequest,
    MemoryMergeSuggestionsResponse,
    MemoryResponse,
    MemorySearchRequest,
    MemorySearchResponse,
    MemorySourceResponse,
    MemoryTimelineResponse,
    MemoryUpdate,
)
from api.services.extraction import capture_conversation_memories
from api.services.entitlements import QuotaExceeded, enforce_workspace_limit, quota_headers
from api.services.memories import (
    apply_confidence_decay,
    create_memory,
    delete_all_memories,
    delete_memory,
    export_memories,
    get_memory,
    get_memory_source,
    import_memories,
    list_memories,
    list_memory_conflicts,
    list_merge_suggestions,
    merge_memories,
    resolve_memory_conflict,
    search_memories,
    timeline,
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
    status: Literal["pending", "approved", "rejected"] | None = Query(default="approved"),
    category: str | None = Query(default=None),
    namespace: str | None = Query(default=None),
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    memories, total = await list_memories(user["id"], user["org_id"], db, limit, offset, search, order, direction, status, category, namespace=namespace)
    return {"memories": memories, "total": total, "limit": limit, "offset": offset}


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory_route(
    payload: MemoryCreate,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    try:
        async with db.transaction():
            await enforce_workspace_limit(user["org_id"], "memories", db)
            return await create_memory(user["id"], user["org_id"], payload.content, db, float(user["dedup_threshold"]), payload.category, payload.pinned)
    except QuotaExceeded as error:
        raise HTTPException(
            status_code=429,
            detail="memories limit reached",
            headers=quota_headers(error),
        ) from error


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_memories_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> Response:
    await delete_all_memories(user["id"], user["org_id"], db)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/review", response_model=MemoryListResponse)
async def list_review_memories_route(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    memories, total = await list_memories(user["id"], user["org_id"], db, limit, offset, None, "created_at", "desc", "pending", None)
    return {"memories": memories, "total": total, "limit": limit, "offset": offset}


@router.get("/conflicts", response_model=MemoryConflictListResponse)
async def list_memory_conflicts_route(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    conflicts, total = await list_memory_conflicts(user["id"], user["org_id"], db, limit, offset)
    return {"conflicts": conflicts, "total": total, "limit": limit, "offset": offset}


@router.post("/conflicts/{conflict_id}/resolve", response_model=MemoryConflictResponse)
async def resolve_memory_conflict_route(
    conflict_id: UUID4,
    payload: MemoryConflictResolveRequest,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    async with db.transaction():
        conflict = await resolve_memory_conflict(
            user["id"],
            user["org_id"],
            conflict_id,
            payload.resolution,
            db,
        )
    if conflict is None:
        raise HTTPException(status_code=404, detail="Open memory conflict not found")
    return conflict


@router.get("/export", response_model=MemoryExportResponse)
async def export_memories_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return {"memories": await export_memories(user["id"], user["org_id"], db)}


@router.post("/import", response_model=MemoryImportResponse, status_code=status.HTTP_201_CREATED)
async def import_memories_route(
    payload: MemoryImportRequest,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    try:
        async with db.transaction():
            await enforce_workspace_limit(user["org_id"], "memories", db, amount=len(payload.memories))
            imported = await import_memories(user["id"], user["org_id"], [item.model_dump() for item in payload.memories], db, float(user["dedup_threshold"]))
            return {"imported": imported}
    except QuotaExceeded as error:
        raise HTTPException(
            status_code=429,
            detail="memories limit reached",
            headers=quota_headers(error),
        ) from error


@router.get("/merge-suggestions", response_model=MemoryMergeSuggestionsResponse)
async def merge_suggestions_route(
    limit: int = Query(default=10, ge=1, le=50),
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return {"suggestions": await list_merge_suggestions(user["id"], user["org_id"], db, limit)}


@router.post("/merge", response_model=MemoryResponse)
async def merge_memories_route(
    payload: MemoryMergeRequest,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    memory = await merge_memories(user["id"], user["org_id"], payload.primary_id, payload.duplicate_id, payload.content, db)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.post("/decay", response_model=MemoryDecayResponse)
async def decay_memories_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return {"updated": await apply_confidence_decay(user["id"], user["org_id"], db)}


@router.get("/timeline", response_model=MemoryTimelineResponse)
async def memory_timeline_route(
    limit: int = Query(default=50, ge=1, le=200),
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return {"items": await timeline(user["id"], user["org_id"], db, limit)}


@router.post("/capture", response_model=ConversationCaptureResponse, status_code=status.HTTP_201_CREATED)
async def capture_conversation_route(
    payload: ConversationCaptureRequest,
    x_engram_provider: str | None = Header(default=None),
    x_engram_provider_key: str | None = Header(default=None, alias="X-Engram-Provider-Key"),
    user: asyncpg.Record = Depends(get_current_user),
) -> dict[str, object]:
    try:
        return await capture_conversation_memories(
            user["id"],
            user["org_id"],
            payload.user_message,
            payload.assistant_response,
            payload.source,
            payload.session_id,
            float(user["dedup_threshold"]),
            override_provider=x_engram_provider,
            override_provider_key=x_engram_provider_key,
        )
    except (RuntimeError, httpx.HTTPError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.post("/search", response_model=MemorySearchResponse)
async def search_memories_route(
    payload: MemorySearchRequest,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    results = await search_memories(user["id"], user["org_id"], payload.query, payload.limit, payload.threshold, db)
    return {"results": results}


@router.get("/{memory_id}/source", response_model=MemorySourceResponse)
async def get_memory_source_route(
    memory_id: UUID4,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    source = await get_memory_source(user["id"], user["org_id"], memory_id, db)
    if source is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return source


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory_route(
    memory_id: UUID4,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    memory = await get_memory(user["id"], user["org_id"], memory_id, db)
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
    memory = await update_memory(user["id"], user["org_id"], memory_id, payload.content, db, payload.category, payload.pinned, payload.status)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory_route(
    memory_id: UUID4,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> Response:
    deleted = await delete_memory(user["id"], user["org_id"], memory_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
