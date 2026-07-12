from datetime import UTC, datetime
from uuid import uuid4

import asyncpg
from fastapi import HTTPException
import pytest

from api.models.user import ApiKeyCreate
from api.routes import users as user_routes
from api.services.users import create_user_api_key, list_user_api_keys, revoke_user_api_key


class FakeDb:
    def __init__(self) -> None:
        self.query = ""
        self.args: tuple[object, ...] = ()
        self.key_id = uuid4()

    async def fetchrow(self, query: str, *args: object) -> dict[str, object]:
        self.query = query
        self.args = args
        return {
            "id": self.key_id,
            "name": args[-1],
            "created_at": datetime.now(UTC),
            "last_used_at": None,
        }

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        self.query = query
        self.args = args
        return [{"id": self.key_id, "name": "production", "created_at": datetime.now(UTC), "last_used_at": None}]

    async def execute(self, query: str, *args: object) -> str:
        self.query = query
        self.args = args
        return "DELETE 1"


@pytest.mark.asyncio
async def test_create_list_and_revoke_workspace_key() -> None:
    db = FakeDb()

    created = await create_user_api_key("user-1", "org-1", "production", db)
    assert created["api_key"].startswith("ek_")
    assert created["name"] == "production"
    assert "api_key_hash" not in created
    assert db.args[0:2] == ("user-1", "org-1")
    assert created["api_key"] not in db.args

    keys = await list_user_api_keys("user-1", "org-1", db)
    assert [key["name"] for key in keys] == ["production"]
    assert "api_key_hash" not in keys[0]
    assert db.args == ("user-1", "org-1")

    assert await revoke_user_api_key("user-1", "org-1", db.key_id, db)
    assert db.args == (db.key_id, "user-1", "org-1")


def test_api_key_name_is_trimmed() -> None:
    assert ApiKeyCreate(name="  production  ").name == "production"


@pytest.mark.asyncio
async def test_duplicate_key_name_returns_conflict(monkeypatch) -> None:
    async def duplicate_key(*args: object) -> dict[str, object]:
        raise asyncpg.UniqueViolationError("duplicate")

    monkeypatch.setattr(user_routes, "create_user_api_key", duplicate_key)

    with pytest.raises(HTTPException) as raised:
        await user_routes.create_current_user_api_key_route(
            ApiKeyCreate(name="production"),
            {"id": "user-1", "org_id": "org-1"},
            object(),
        )

    assert raised.value.status_code == 409
