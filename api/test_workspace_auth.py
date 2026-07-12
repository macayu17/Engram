from datetime import UTC, datetime

import pytest

from api.services import users
from api.services.security import hash_api_key


class SecondaryKeyDb:
    def __init__(self, api_key: str, last_used_at: datetime | None = None) -> None:
        self.api_key_hash = hash_api_key(api_key)
        self.last_used_at = last_used_at
        self.fetch_queries: list[str] = []
        self.execute_queries: list[str] = []

    async def fetchrow(self, query: str, *args: object) -> dict[str, object] | None:
        self.fetch_queries.append(query)
        if len(self.fetch_queries) == 1:
            return None
        return {
            "id": "user-1",
            "org_id": "org-1",
            "role": "admin",
            "external_id": "clerk:user-1",
            "api_key_hash": self.api_key_hash,
            "created_at": datetime.now(UTC),
            "max_memories_injected": 7,
            "retrieval_threshold": 0.61,
            "dedup_threshold": 0.91,
            "retrieval_mode": "graph",
            "extraction_provider": "anthropic",
            "extraction_model": "claude-3-5-haiku-latest",
            "openai_api_key_encrypted": None,
            "gemini_api_key_encrypted": None,
            "anthropic_api_key_encrypted": b"encrypted",
            "last_used_at": self.last_used_at,
        }

    async def execute(self, query: str, *args: object) -> str:
        self.execute_queries.append(query)
        return "UPDATE 1"


def setup_function() -> None:
    users._user_auth_cache.clear()


def teardown_function() -> None:
    users._user_auth_cache.clear()


@pytest.mark.asyncio
async def test_secondary_key_loads_workspace_role_and_all_runtime_settings() -> None:
    api_key = "ek_secondary"
    db = SecondaryKeyDb(api_key)

    result = await users.get_user_by_api_key(api_key, db)

    assert result is not None
    assert result["org_id"] == "org-1"
    assert result["role"] == "admin"
    assert result["retrieval_mode"] == "graph"
    primary_query = db.fetch_queries[0]
    secondary_query = db.fetch_queries[1]
    assert "user_api_keys.last_used_at" not in primary_query
    assert "user_api_keys.last_used_at" in secondary_query
    assert "user_api_keys.org_id" in secondary_query
    assert "org_memberships.role" in secondary_query
    assert "users.retrieval_mode" in secondary_query
    assert "orgs.extraction_provider" in secondary_query
    assert any("last_used_at = now()" in query for query in db.execute_queries)


@pytest.mark.asyncio
async def test_recent_secondary_key_usage_does_not_write_again() -> None:
    api_key = "ek_recent"
    db = SecondaryKeyDb(api_key, last_used_at=datetime.now(UTC))

    result = await users.get_user_by_api_key(api_key, db)

    assert result is not None
    assert db.execute_queries == []


def test_cached_user_preserves_workspace_role_and_retrieval_mode() -> None:
    api_key = "ek_cached_workspace"
    users.cache_user_auth(
        hash_api_key(api_key),
        {
            "id": "user-1",
            "org_id": "org-1",
            "role": "owner",
            "external_id": "clerk:user-1",
            "api_key_hash": hash_api_key(api_key),
            "created_at": datetime.now(UTC),
            "max_memories_injected": 5,
            "retrieval_threshold": 0.5,
            "dedup_threshold": 0.95,
            "retrieval_mode": "hybrid",
            "extraction_provider": "openai",
            "extraction_model": "gpt-4o-mini",
        },
    )

    cached = users.get_cached_user_by_api_key(api_key)

    assert cached is not None
    assert cached["org_id"] == "org-1"
    assert cached["role"] == "owner"
    assert cached["retrieval_mode"] == "hybrid"
