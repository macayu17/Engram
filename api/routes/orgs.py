import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_current_user, get_db
from api.models.org import OrgCreate, OrgMemberAdd, OrgMemberResponse, OrgResponse


router = APIRouter()


@router.post("", response_model=OrgResponse, status_code=201)
async def create_org(
    body: OrgCreate,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    async with db.transaction():
        org = await db.fetchrow(
            "INSERT INTO orgs (name) VALUES ($1) RETURNING id, name, created_at",
            body.name,
        )
        if org is None:
            raise HTTPException(status_code=500, detail="Org creation failed")
        await db.execute(
            "INSERT INTO org_memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')",
            org["id"],
            user["id"],
        )
    return {**dict(org), "role": "owner"}


@router.get("", response_model=list[OrgResponse])
async def list_orgs(
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> list[dict[str, object]]:
    rows = await db.fetch(
        """
        SELECT o.id, o.name, o.created_at, m.role
        FROM orgs o
        JOIN org_memberships m ON m.org_id = o.id
        WHERE m.user_id = $1
        ORDER BY o.created_at DESC
        """,
        user["id"],
    )
    return [dict(row) for row in rows]


@router.get("/{org_id}", response_model=OrgResponse)
async def get_org(
    org_id: str,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> dict[str, object]:
    row = await db.fetchrow(
        """
        SELECT o.id, o.name, o.created_at, m.role
        FROM orgs o
        JOIN org_memberships m ON m.org_id = o.id
        WHERE o.id = $1 AND m.user_id = $2
        """,
        org_id,
        user["id"],
    )
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
    membership = await db.fetchrow(
        "SELECT role FROM org_memberships WHERE org_id = $1 AND user_id = $2",
        org_id,
        user["id"],
    )
    if membership is None or membership["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only org owners and admins can add members")
    target = await db.fetchrow(
        "SELECT id, external_id FROM users WHERE external_id = $1",
        body.external_id,
    )
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if body.role not in ("owner", "admin", "member"):
        raise HTTPException(status_code=422, detail="Role must be owner, admin, or member")
    row = await db.fetchrow(
        """
        INSERT INTO org_memberships (org_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role
        RETURNING user_id, role, created_at
        """,
        org_id,
        target["id"],
        body.role,
    )
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to add member")
    return {**dict(row), "external_id": target["external_id"]}


@router.delete("/{org_id}/members/{external_id}", status_code=204)
async def remove_member(
    org_id: str,
    external_id: str,
    user: asyncpg.Record = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
) -> None:
    membership = await db.fetchrow(
        "SELECT role FROM org_memberships WHERE org_id = $1 AND user_id = $2",
        org_id,
        user["id"],
    )
    if membership is None or membership["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only org owners and admins can remove members")
    target = await db.fetchrow(
        "SELECT id FROM users WHERE external_id = $1",
        external_id,
    )
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    result = await db.execute(
        "DELETE FROM org_memberships WHERE org_id = $1 AND user_id = $2",
        org_id,
        target["id"],
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Membership not found")
