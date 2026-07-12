import asyncpg

from api.services.entitlements import enforce_workspace_limit


async def create_org(user_id: object, name: str, db: asyncpg.Connection) -> dict[str, object]:
    async with db.transaction():
        org = await db.fetchrow(
            "INSERT INTO orgs (name) VALUES ($1) RETURNING id, name, plan, created_at",
            name,
        )
        if org is None:
            raise RuntimeError("Workspace creation failed")
        await db.execute(
            "INSERT INTO org_memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')",
            org["id"],
            user_id,
        )
    return {**dict(org), "role": "owner"}


async def list_orgs(
    user_id: object,
    org_id: object,
    db: asyncpg.Connection,
) -> list[dict[str, object]]:
    rows = await db.fetch(
        """
        SELECT o.id, o.name, o.plan, o.created_at, m.role
        FROM orgs o
        JOIN org_memberships m ON m.org_id = o.id
        WHERE m.user_id = $1 AND o.id = $2
        ORDER BY o.created_at DESC
        """,
        user_id,
        org_id,
    )
    return [dict(row) for row in rows]


async def get_org(
    org_id: object,
    user_id: object,
    authenticated_org_id: object,
    db: asyncpg.Connection,
) -> dict[str, object] | None:
    if str(org_id) != str(authenticated_org_id):
        return None
    row = await db.fetchrow(
        """
        SELECT o.id, o.name, o.plan, o.created_at, m.role
        FROM orgs o
        JOIN org_memberships m ON m.org_id = o.id
        WHERE o.id = $1 AND m.user_id = $2
        """,
        org_id,
        user_id,
    )
    return dict(row) if row is not None else None


async def add_org_member(
    org_id: object,
    actor_user_id: object,
    authenticated_org_id: object,
    external_id: str,
    role: str,
    db: asyncpg.Connection,
) -> dict[str, object] | None:
    if str(org_id) != str(authenticated_org_id):
        return None
    actor = await db.fetchrow(
        "SELECT role FROM org_memberships WHERE org_id = $1 AND user_id = $2",
        org_id,
        actor_user_id,
    )
    if actor is None or actor["role"] not in ("owner", "admin"):
        raise PermissionError("Only workspace owners and admins can add members")
    target = await db.fetchrow(
        "SELECT id, external_id FROM users WHERE external_id = $1",
        external_id,
    )
    if target is None:
        return None
    existing_member = await db.fetchval(
        "SELECT 1 FROM org_memberships WHERE org_id = $1 AND user_id = $2",
        org_id,
        target["id"],
    )
    await enforce_workspace_limit(
        org_id,
        "members",
        db,
        amount=0 if existing_member is not None else 1,
    )
    row = await db.fetchrow(
        """
        INSERT INTO org_memberships (org_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role
        RETURNING user_id, role, created_at
        """,
        org_id,
        target["id"],
        role,
    )
    if row is None:
        raise RuntimeError("Failed to add member")
    return {**dict(row), "external_id": target["external_id"]}


async def remove_org_member(
    org_id: object,
    actor_user_id: object,
    authenticated_org_id: object,
    external_id: str,
    db: asyncpg.Connection,
) -> bool:
    if str(org_id) != str(authenticated_org_id):
        return False
    actor = await db.fetchrow(
        "SELECT role FROM org_memberships WHERE org_id = $1 AND user_id = $2",
        org_id,
        actor_user_id,
    )
    if actor is None or actor["role"] not in ("owner", "admin"):
        raise PermissionError("Only workspace owners and admins can remove members")
    target = await db.fetchrow("SELECT id FROM users WHERE external_id = $1", external_id)
    if target is None:
        return False
    result = await db.execute(
        "DELETE FROM org_memberships WHERE org_id = $1 AND user_id = $2",
        org_id,
        target["id"],
    )
    return result != "DELETE 0"
