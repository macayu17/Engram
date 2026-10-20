from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Query

from api.config import settings
from api.dependencies import get_current_user, get_db
from api.models.memory import Namespace
from api.services import jobs
from api.services.logs import list_clients
from api.services.provider_keys import ProviderConfigError, resolve_user_provider
from api.services.users import get_workspace_provider_context


router = APIRouter()


@router.get("/status")
async def status(namespace: Namespace = "default", user: asyncpg.Record = Depends(get_current_user), db: asyncpg.Connection = Depends(get_db)) -> dict[str, object]:
    context = await get_workspace_provider_context(user["id"], user["org_id"], db)
    provider_name = str((context or {}).get("extraction_provider") or "openai")
    configured = False
    if context is not None:
        try:
            resolved = resolve_user_provider(context)
            provider_name = resolved.name
            configured = True
        except ProviderConfigError:
            configured = False
    return {
        "connected": True,
        "user": {"external_id": user["external_id"]},
        "namespace": namespace,
        "provider": {"name": provider_name, "configured": configured},
        "clients": await list_clients(user["id"], user["org_id"], db, namespace=namespace),
        "jobs": await jobs.list_jobs(user["id"], user["org_id"], namespace, db),
        "mcp_url": settings.mcp_public_url,
    }


@router.post("/jobs/{conversation_id}/retry")
async def retry(conversation_id: UUID, namespace: Namespace = "default", user: asyncpg.Record = Depends(get_current_user), db: asyncpg.Connection = Depends(get_db)) -> dict[str, bool]:
    await jobs.retry_job(user["id"], user["org_id"], conversation_id, namespace, db)
    return {"queued": True}


@router.delete("/captures")
async def clear(older_than_days: int = Query(default=30, ge=1, le=36500), namespace: Namespace = "default", user: asyncpg.Record = Depends(get_current_user), db: asyncpg.Connection = Depends(get_db)) -> dict[str, int]:
    return {"deleted": await jobs.clear_captures(user["id"], user["org_id"], older_than_days, namespace, db)}
