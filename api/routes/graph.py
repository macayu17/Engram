import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import UUID4

from api.config import settings
from api.dependencies import get_current_user, get_db
from api.models.graph import (
    EntityListResponse,
    EntityMemoriesResponse,
    GraphExtractResponse,
    MemoryNeighborsResponse,
)
from api.services.graph import (
    backfill_entities_for_user,
    get_memory_entities,
    get_memory_neighbors,
    list_entity_edges,
    list_memories_for_entity,
    list_user_entities,
)
from api.services.provider_keys import ProviderConfigError, resolve_user_provider


router = APIRouter()


@router.get("/entities", response_model=EntityListResponse)
async def list_entities_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return {"entities": await list_user_entities(user["id"], user["org_id"], db)}


@router.get("/edges")
async def list_edges_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return {"edges": await list_entity_edges(user["id"], user["org_id"], db)}


@router.get("/entities/{entity_type}/{entity_name}/memories", response_model=EntityMemoriesResponse)
async def list_entity_memories_route(
    entity_type: str,
    entity_name: str,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    memories = await list_memories_for_entity(user["id"], user["org_id"], entity_type, entity_name, db)
    return {"entity_name": entity_name, "entity_type": entity_type, "memories": memories}


@router.get("/memories/{memory_id}/neighbors", response_model=MemoryNeighborsResponse)
async def memory_neighbors_route(
    memory_id: UUID4,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    neighbors = await get_memory_neighbors(user["id"], user["org_id"], memory_id, db)
    entities = await get_memory_entities(user["id"], user["org_id"], memory_id, db)
    return {"memory_id": memory_id, "neighbors": neighbors, "entities": entities}


@router.post("/extract", response_model=GraphExtractResponse)
async def extract_graph_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    if not settings.enable_graph:
        raise HTTPException(status_code=400, detail="Graph extraction is disabled (set ENABLE_GRAPH=true)")
    try:
        resolved = resolve_user_provider(user)
    except ProviderConfigError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return await backfill_entities_for_user(user["id"], user["org_id"], db, resolved)
