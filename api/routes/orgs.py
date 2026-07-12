import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_current_user, get_db
from api.models.org import OrgCreate, OrgMemberAdd, OrgMemberResponse, OrgResponse
from api.services import orgs as org_service
from api.services.entitlements import QuotaExceeded, quota_headers


router = APIRouter()


@router.post("", response_model=OrgResponse, status_code=201)
async def create_org(
    body: OrgCreate,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    return await org_service.create_org(user["id"], body.name, db)


@router.get("", response_model=list[OrgResponse])
async def list_orgs(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> list[dict[str, object]]:
    return await org_service.list_orgs(user["id"], user["org_id"], db)


@router.get("/{org_id}", response_model=OrgResponse)
async def get_org(
    org_id: str,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    row = await org_service.get_org(org_id, user["id"], user["org_id"], db)
    if row is None:
        raise HTTPException(status_code=404, detail="Org not found")
    return dict(row)


@router.post("/{org_id}/members", response_model=OrgMemberResponse, status_code=201)
async def add_member(
    org_id: str,
    body: OrgMemberAdd,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    if body.role not in ("owner", "admin", "member"):
        raise HTTPException(status_code=422, detail="Role must be owner, admin, or member")
    try:
        async with db.transaction():
            row = await org_service.add_org_member(
                org_id,
                user["id"],
                user["org_id"],
                body.external_id,
                body.role,
                db,
            )
    except QuotaExceeded as error:
        raise HTTPException(
            status_code=429,
            detail="members limit reached",
            headers=quota_headers(error),
        ) from error
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    if row is None:
        raise HTTPException(status_code=404, detail="Workspace or user not found")
    return row


@router.delete("/{org_id}/members/{external_id}", status_code=204)
async def remove_member(
    org_id: str,
    external_id: str,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> None:
    try:
        removed = await org_service.remove_org_member(
            org_id,
            user["id"],
            user["org_id"],
            external_id,
            db,
        )
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    if not removed:
        raise HTTPException(status_code=404, detail="Workspace, user, or membership not found")
