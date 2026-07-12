import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Response, status

from api.config import settings
from api.dependencies import get_current_user, get_db, require_service_key
from api.models.user import (
    HostedProvisionResponse,
    ServiceUserKeyCreate,
    UserConfigResponse,
    UserConfigUpdate,
    UserProviderConfigResponse,
    UserProviderConfigUpdate,
    UserCreate,
    UserCreateResponse,
    UserResponse,
    UserUpdate,
)
from api.services.users import (
    create_user,
    delete_user,
    get_user_config,
    get_user_provider_config,
    provision_hosted_user,
    regenerate_user_key,
    update_user_config,
    update_user_external_id,
    update_user_provider_config,
)


router = APIRouter()


@router.post("", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_user_route(payload: UserCreate, db: asyncpg.Connection = Depends(get_db)) -> dict[str, object]:
    if settings.engram_service_key:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        row, api_key = await create_user(payload.external_id, db)
    except asyncpg.UniqueViolationError as error:
        raise HTTPException(status_code=409, detail="User external_id already exists") from error
    return {
        "id": row["id"],
        "external_id": row["external_id"],
        "api_key": api_key,
        "created_at": row["created_at"],
    }


@router.post("/service-key", response_model=HostedProvisionResponse, status_code=status.HTTP_201_CREATED)
async def create_service_user_key_route(
    payload: ServiceUserKeyCreate,
    _: None = Depends(require_service_key),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    try:
        return await provision_hosted_user(
            payload.external_id,
            payload.workspace_name,
            payload.key_name,
            db,
            payload.workspace_id,
        )
    except PermissionError as error:
        raise HTTPException(status_code=404, detail="Workspace not found") from error


@router.get("/me", response_model=UserResponse)
async def get_current_user_route(user: asyncpg.Record = Depends(get_current_user)) -> dict[str, object]:
    return {
        "id": user["id"],
        "external_id": user["external_id"],
        "created_at": user["created_at"],
    }


@router.patch("/me", response_model=UserResponse)
async def update_current_user_route(
    payload: UserUpdate,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    try:
        return await update_user_external_id(user["id"], payload.external_id, db)
    except asyncpg.UniqueViolationError as error:
        raise HTTPException(status_code=409, detail="User external_id already exists") from error


@router.get("/me/config", response_model=UserConfigResponse)
async def get_current_user_config_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return await get_user_config(user["id"], db)


@router.patch("/me/config", response_model=UserConfigResponse)
async def update_current_user_config_route(
    payload: UserConfigUpdate,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return await update_user_config(
        user["id"],
        payload.max_memories_injected,
        payload.retrieval_threshold,
        payload.dedup_threshold,
        db,
    )


@router.post("/me/api-key", response_model=UserCreateResponse)
async def regenerate_current_user_key_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    if settings.engram_service_key:
        raise HTTPException(status_code=404, detail="Not found")
    row, api_key = await regenerate_user_key(user, db)
    return {
        "id": row["id"],
        "external_id": row["external_id"],
        "api_key": api_key,
        "created_at": row["created_at"],
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> Response:
    deleted = await delete_user(user["id"], db)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/me/provider", response_model=UserProviderConfigResponse)
async def get_current_user_provider_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return await get_user_provider_config(user["id"], db)


@router.patch("/me/provider", response_model=UserProviderConfigResponse)
async def update_current_user_provider_route(
    payload: UserProviderConfigUpdate,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    try:
        return await update_user_provider_config(
            user["id"],
            payload.extraction_provider,
            payload.extraction_model,
            payload.openai_api_key,
            payload.gemini_api_key,
            payload.anthropic_api_key,
            payload.clear_openai_key,
            payload.clear_gemini_key,
            payload.clear_anthropic_key,
            db,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
