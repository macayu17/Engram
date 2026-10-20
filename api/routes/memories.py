from typing import Literal

import asyncpg
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from pydantic import UUID4

from api.dependencies import get_current_user, get_db
from api.models.conversation import ConversationCaptureRequest, ConversationCaptureResponse
from api.models.memory import (
    MemoryCreate,
    MemoryBulkReview,
    MemoryRestore,
    MemoryFeedback,
    Namespace,
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
from api.services.scopes import resolve_namespace, require_personal_permission
from api.services.revisions import list_revisions, decide_revision, memory_history, restore_memory, save_feedback
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
    list_merge_suggestions,
    merge_memories,
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
    namespace: Namespace | None = Query(default=None),
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    namespace = resolve_namespace(user, namespace)
    memories, total = await list_memories(user["id"], user["org_id"], db, limit, offset, search, order, direction, status, category, namespace=namespace)
    return {"memories": memories, "total": total, "limit": limit, "offset": offset}


@router.post("", response_model=MemoryResponse, status_code=status.HTTP_201_CREATED)
async def create_memory_route(
    payload: MemoryCreate,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
    namespace: Namespace | None = None,
) -> dict[str, object]:
    namespace = resolve_namespace(user, namespace)
    try:
        async with db.transaction():
            await enforce_workspace_limit(user["org_id"], "memories", db)
            return await create_memory(user["id"], user["org_id"], payload.content, db, float(user["dedup_threshold"]), payload.category, payload.pinned, namespace=resolve_namespace(user, payload.namespace if "namespace" in payload.model_fields_set else namespace) or "default", expires_at=payload.expires_at)
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
    namespace: Namespace | None = None,
) -> Response:
    namespace = resolve_namespace(user, namespace)
    await delete_all_memories(user["id"], user["org_id"], db, namespace)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/review", response_model=MemoryListResponse)
async def list_review_memories_route(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
    namespace: Namespace | None = None,
) -> dict[str, object]:
    namespace = resolve_namespace(user, namespace)
    memories, total = await list_memories(user["id"], user["org_id"], db, limit, offset, None, "created_at", "desc", "pending", None, namespace=namespace)
    return {"memories": memories, "total": total, "limit": limit, "offset": offset}


@router.get("/export", response_model=MemoryExportResponse)
async def export_memories_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
    namespace: Namespace | None = None,
) -> dict[str, object]:
    namespace = resolve_namespace(user, namespace)
    return {"memories": await export_memories(user["id"], user["org_id"], db, namespace)}


@router.post("/import", response_model=MemoryImportResponse, status_code=status.HTTP_201_CREATED)
async def import_memories_route(
    payload: MemoryImportRequest,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
    namespace: Namespace | None = None,
) -> dict[str, object]:
    namespace = resolve_namespace(user, namespace)
    try:
        async with db.transaction():
            await enforce_workspace_limit(user["org_id"], "memories", db, amount=len(payload.memories))
            imported = await import_memories(user["id"], user["org_id"], [item.model_dump() for item in payload.memories], db, float(user["dedup_threshold"]), namespace=resolve_namespace(user, payload.namespace if "namespace" in payload.model_fields_set else namespace) or "default")
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
    namespace: Namespace | None = None,
) -> dict[str, object]:
    namespace = resolve_namespace(user, namespace)
    return {"suggestions": await list_merge_suggestions(user["id"], user["org_id"], db, limit, namespace=namespace)}


@router.post("/merge", response_model=MemoryResponse)
async def merge_memories_route(
    payload: MemoryMergeRequest,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
    namespace: Namespace | None = None,
) -> dict[str, object]:
    namespace = resolve_namespace(user, namespace)
    if namespace is not None:
        for memory_id in (payload.primary_id, payload.duplicate_id):
            if await get_memory(user["id"], user["org_id"], memory_id, db, namespace) is None:
                raise HTTPException(status_code=404, detail="Memory not found")
    memory = await merge_memories(user["id"], user["org_id"], payload.primary_id, payload.duplicate_id, payload.content, db, namespace=namespace)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.post("/decay", response_model=MemoryDecayResponse)
async def decay_memories_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
    namespace: Namespace | None = None,
) -> dict[str, object]:
    namespace = resolve_namespace(user, namespace)
    return {"updated": await apply_confidence_decay(user["id"], user["org_id"], db, namespace)}


@router.get("/timeline", response_model=MemoryTimelineResponse)
async def memory_timeline_route(
    limit: int = Query(default=50, ge=1, le=200),
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
    namespace: Namespace | None = None,
) -> dict[str, object]:
    namespace = resolve_namespace(user, namespace)
    return {"items": await timeline(user["id"], user["org_id"], db, limit, namespace=namespace)}


@router.post("/capture", response_model=ConversationCaptureResponse, status_code=status.HTTP_201_CREATED)
async def capture_conversation_route(
    payload: ConversationCaptureRequest,
    x_engram_provider: str | None = Header(default=None),
    x_engram_provider_key: str | None = Header(default=None, alias="X-Engram-Provider-Key"),
    user: asyncpg.Record = Depends(get_current_user),
) -> dict[str, object]:
    namespace = resolve_namespace(user, payload.namespace if "namespace" in payload.model_fields_set else None) or "default"
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
            namespace=namespace,
        )
    except (RuntimeError, httpx.HTTPError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.post("/search", response_model=MemorySearchResponse)
async def search_memories_route(
    payload: MemorySearchRequest,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    namespace = resolve_namespace(user, payload.namespace if "namespace" in payload.model_fields_set else None) or "default"
    require_personal_permission(user, payload.include_personal)
    results = await search_memories(user["id"], user["org_id"], payload.query, payload.limit, payload.threshold, db, namespace, payload.include_personal)
    return {"results": results}


@router.get("/namespaces")
async def namespaces_route(
    user: asyncpg.Record = Depends(get_current_user), db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    from api.services.memories import list_namespaces

    return {"namespaces": await list_namespaces(user["id"], user["org_id"], db, resolve_namespace(user, None))}


@router.post("/review/bulk")
async def bulk_review_route(
    payload: MemoryBulkReview, user: asyncpg.Record = Depends(get_current_user), db: asyncpg.Connection = Depends(get_db),
) -> dict[str, int]:
    from api.services.memories import bulk_review

    namespace = resolve_namespace(user, payload.namespace if "namespace" in payload.model_fields_set else None)
    return {"updated": await bulk_review(user["id"], user["org_id"], payload.memory_ids, payload.status, db, namespace)}


@router.get("/revisions")
async def revisions_route(
    namespace: Namespace | None = None, status: Literal["pending", "accepted", "rejected"] = "pending",
    user: asyncpg.Record = Depends(get_current_user), db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return {"revisions": await list_revisions(user["id"], user["org_id"], db, resolve_namespace(user, namespace), status)}


@router.post("/revisions/{revision_id}/{decision}")
async def revision_decision_route(
    revision_id: UUID4, decision: Literal["accept", "reject"], namespace: Namespace | None = None,
    user: asyncpg.Record = Depends(get_current_user), db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return await decide_revision(user["id"], user["org_id"], revision_id, decision == "accept", db, resolve_namespace(user, namespace))


@router.get("/{memory_id}/history")
async def history_route(
    memory_id: UUID4, namespace: Namespace | None = None,
    user: asyncpg.Record = Depends(get_current_user), db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return {"versions": await memory_history(user["id"], user["org_id"], memory_id, db, resolve_namespace(user, namespace))}


@router.post("/{memory_id}/restore", response_model=MemoryResponse)
async def restore_route(
    memory_id: UUID4, payload: MemoryRestore, namespace: Namespace | None = None,
    user: asyncpg.Record = Depends(get_current_user), db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return await restore_memory(user["id"], user["org_id"], memory_id, payload.version_id, db, resolve_namespace(user, namespace))


@router.post("/{memory_id}/feedback")
async def feedback_route(
    memory_id: UUID4, payload: MemoryFeedback, namespace: Namespace | None = None,
    user: asyncpg.Record = Depends(get_current_user), db: asyncpg.Connection = Depends(get_db),
) -> dict[str, bool]:
    await save_feedback(user["id"], user["org_id"], memory_id, payload.relevant, payload.query, db, resolve_namespace(user, namespace))
    return {"saved": True}


@router.get("/{memory_id}/source", response_model=MemorySourceResponse)
async def get_memory_source_route(
    memory_id: UUID4,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
    namespace: Namespace | None = None,
) -> dict[str, object]:
    namespace = resolve_namespace(user, namespace)
    source = await get_memory_source(user["id"], user["org_id"], memory_id, db, namespace, restrict_personal=user.get("oauth_namespace") is not None)
    if source is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return source


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory_route(
    memory_id: UUID4,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
    namespace: Namespace | None = None,
) -> dict[str, object]:
    namespace = resolve_namespace(user, namespace)
    memory = await get_memory(user["id"], user["org_id"], memory_id, db, namespace)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.patch("/{memory_id}", response_model=MemoryResponse)
async def update_memory_route(
    memory_id: UUID4,
    payload: MemoryUpdate,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
    namespace: Namespace | None = None,
) -> dict[str, object]:
    namespace = resolve_namespace(user, namespace)
    if payload.namespace is not None:
        resolve_namespace(user, payload.namespace)
    memory = await update_memory(user["id"], user["org_id"], memory_id, payload.content, db, payload.category, payload.pinned, payload.status, namespace=namespace, target_namespace=payload.namespace, expires_at=payload.expires_at, update_expiration="expires_at" in payload.model_fields_set)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory_route(
    memory_id: UUID4,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
    namespace: Namespace | None = None,
) -> Response:
    namespace = resolve_namespace(user, namespace)
    deleted = await delete_memory(user["id"], user["org_id"], memory_id, db, namespace)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
