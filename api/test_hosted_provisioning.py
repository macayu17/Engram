import os
from uuid import uuid4

import asyncpg
from fastapi import HTTPException
import pytest

from api.config import settings
from api.models.user import ServiceUserKeyCreate, UserCreate
from api.routes.users import create_user_route
from api.services.users import create_user, get_user_by_api_key, provision_hosted_user


TEST_DATABASE_URL = os.getenv("ENGRAM_TEST_DATABASE_URL", "")


def test_service_provisioning_payload_strips_names() -> None:
    payload = ServiceUserKeyCreate(
        external_id="  clerk:user_1  ",
        workspace_name="  Personal workspace  ",
        key_name="  clerk:session_1  ",
        workspace_id=uuid4(),
    )

    assert payload.external_id == "clerk:user_1"
    assert payload.workspace_name == "Personal workspace"
    assert payload.key_name == "clerk:session_1"
    assert payload.workspace_id is not None


@pytest.mark.asyncio
async def test_public_user_creation_is_hidden_in_hosted_mode(monkeypatch) -> None:
    monkeypatch.setattr(settings, "engram_service_key", "service-key")

    with pytest.raises(HTTPException) as raised:
        await create_user_route(UserCreate(external_id="public-user"), object())

    assert raised.value.status_code == 404


@pytest.mark.asyncio
@pytest.mark.skipif(not TEST_DATABASE_URL, reason="ENGRAM_TEST_DATABASE_URL is not configured")
async def test_self_hosted_user_creation_adds_personal_workspace() -> None:
    connection = await asyncpg.connect(TEST_DATABASE_URL)
    external_id = "self-hosted-provisioning-test"
    try:
        await connection.execute("DELETE FROM users WHERE external_id = $1", external_id)

        user, api_key = await create_user(external_id, connection)

        membership = await connection.fetchrow(
            """
            SELECT org_memberships.org_id, org_memberships.role, orgs.name
            FROM org_memberships
            JOIN orgs ON orgs.id = org_memberships.org_id
            WHERE org_memberships.user_id = $1
            """,
            user["id"],
        )
        assert membership is not None
        assert membership["role"] == "owner"
        assert membership["name"] == f"{external_id}'s workspace"
        authenticated = await get_user_by_api_key(api_key, connection)
        assert authenticated is not None
        assert authenticated["org_id"] == membership["org_id"]
    finally:
        await connection.execute("DELETE FROM users WHERE external_id = $1", external_id)
        await connection.close()


@pytest.mark.asyncio
@pytest.mark.skipif(not TEST_DATABASE_URL, reason="ENGRAM_TEST_DATABASE_URL is not configured")
async def test_hosted_provisioning_is_idempotent_and_rotates_session_key() -> None:
    connection = await asyncpg.connect(TEST_DATABASE_URL)
    external_id = "clerk:provisioning-test"
    try:
        await connection.execute("DELETE FROM users WHERE external_id = $1", external_id)

        first = await provision_hosted_user(
            external_id,
            "Personal workspace",
            "clerk:session-test",
            connection,
        )
        second = await provision_hosted_user(
            external_id,
            "Personal workspace",
            "clerk:session-test",
            connection,
        )

        assert first["id"] == second["id"]
        assert first["workspace_id"] == second["workspace_id"]
        assert first["api_key"] != second["api_key"]
        counts = await connection.fetchrow(
            """
            SELECT
                (SELECT count(*) FROM users WHERE external_id = $1) AS users,
                (SELECT count(*) FROM org_memberships WHERE user_id = $2) AS memberships,
                (SELECT count(*) FROM user_api_keys WHERE user_id = $2 AND name = $3) AS keys
            """,
            external_id,
            first["id"],
            "clerk:session-test",
        )
        assert counts is not None
        assert dict(counts) == {"users": 1, "memberships": 1, "keys": 1}
        assert await get_user_by_api_key(first["api_key"], connection) is None
        current_user = await get_user_by_api_key(second["api_key"], connection)
        assert current_user is not None
        assert current_user["org_id"] == second["workspace_id"]
        assert current_user["role"] == "owner"
    finally:
        await connection.execute("DELETE FROM users WHERE external_id = $1", external_id)
        await connection.close()


@pytest.mark.asyncio
@pytest.mark.skipif(not TEST_DATABASE_URL, reason="ENGRAM_TEST_DATABASE_URL is not configured")
async def test_hosted_provisioning_uses_requested_workspace_membership() -> None:
    connection = await asyncpg.connect(TEST_DATABASE_URL)
    owner_external_id = "clerk:workspace-owner-test"
    member_external_id = "clerk:workspace-member-test"
    try:
        await connection.execute(
            "DELETE FROM users WHERE external_id = ANY($1::text[])",
            [owner_external_id, member_external_id],
        )
        owner = await provision_hosted_user(
            owner_external_id,
            "Owner workspace",
            "clerk:owner-session",
            connection,
        )
        member = await provision_hosted_user(
            member_external_id,
            "Member workspace",
            "clerk:member-session",
            connection,
        )
        await connection.execute(
            """
            INSERT INTO org_memberships (org_id, user_id, role)
            VALUES ($1, $2, 'member')
            """,
            owner["workspace_id"],
            member["id"],
        )

        selected = await provision_hosted_user(
            member_external_id,
            "Ignored workspace name",
            "clerk:selected-session",
            connection,
            workspace_id=owner["workspace_id"],
        )

        assert selected["workspace_id"] == owner["workspace_id"]
        assert selected["role"] == "member"
        authenticated = await get_user_by_api_key(selected["api_key"], connection)
        assert authenticated is not None
        assert authenticated["org_id"] == owner["workspace_id"]
        assert authenticated["role"] == "member"
    finally:
        await connection.execute(
            "DELETE FROM users WHERE external_id = ANY($1::text[])",
            [owner_external_id, member_external_id],
        )
        await connection.close()
