import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, Request

from api.dependencies import get_current_user, get_db, require_service_key
from api.models.billing import BillingUrlResponse, BillingWorkspaceRequest, WorkspaceUsageResponse
from api.services.billing import (
    BillingConflict,
    create_checkout_url,
    create_portal_url,
    process_stripe_event,
    resolve_billing_user,
)
from api.services.entitlements import get_workspace_usage


router = APIRouter()


@router.get("/usage", response_model=WorkspaceUsageResponse)
async def usage_route(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return await get_workspace_usage(user["org_id"], db)


async def billing_actor(payload: BillingWorkspaceRequest, db: asyncpg.Connection) -> object:
    user_id = await resolve_billing_user(payload.external_id, payload.org_id, db)
    if user_id is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return user_id


@router.post("/checkout", response_model=BillingUrlResponse)
async def checkout_route(
    payload: BillingWorkspaceRequest,
    _: None = Depends(require_service_key),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, str]:
    user_id = await billing_actor(payload, db)
    try:
        return {"url": await create_checkout_url(payload.org_id, user_id, db)}
    except BillingConflict as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/portal", response_model=BillingUrlResponse)
async def portal_route(
    payload: BillingWorkspaceRequest,
    _: None = Depends(require_service_key),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, str]:
    user_id = await billing_actor(payload, db)
    try:
        return {"url": await create_portal_url(payload.org_id, user_id, db)}
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/webhook", status_code=204)
async def webhook_route(
    request: Request,
    stripe_signature: str = Header(..., alias="Stripe-Signature"),
    db: asyncpg.Connection = Depends(get_db),
) -> None:
    try:
        await process_stripe_event(await request.body(), stripe_signature, db)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
