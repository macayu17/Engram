import inspect

import pytest

from api.routes import orgs as org_routes
from api.services.orgs import get_org, list_orgs, remove_org_member


class FakeDb:
    def __init__(self) -> None:
        self.query = ""
        self.args: tuple[object, ...] = ()

    async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
        self.query = query
        self.args = args
        return []

    async def fetchrow(self, query: str, *args: object) -> dict[str, object] | None:
        raise AssertionError("Cross-workspace requests must not query the database")

    async def execute(self, query: str, *args: object) -> str:
        raise AssertionError("Cross-workspace requests must not query the database")


@pytest.mark.asyncio
async def test_list_orgs_returns_only_authenticated_workspace() -> None:
    db = FakeDb()

    assert await list_orgs("user-1", "org-1", db) == []
    assert "o.id = $2" in db.query
    assert db.args == ("user-1", "org-1")


@pytest.mark.asyncio
async def test_get_org_rejects_other_authenticated_workspace_without_query() -> None:
    db = FakeDb()

    assert await get_org("org-2", "user-1", "org-1", db) is None


@pytest.mark.asyncio
async def test_remove_member_rejects_other_authenticated_workspace_without_query() -> None:
    db = FakeDb()

    assert not await remove_org_member("org-2", "user-1", "org-1", "user-2", db)


def test_org_routes_do_not_contain_database_queries() -> None:
    source = inspect.getsource(org_routes)

    assert "SELECT " not in source
    assert "INSERT INTO " not in source
    assert "DELETE FROM " not in source
