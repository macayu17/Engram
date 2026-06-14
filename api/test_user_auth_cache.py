from uuid import uuid4

import pytest

from api.services import users
from api.services.security import hash_api_key


def setup_function() -> None:
    users._user_auth_cache.clear()


def teardown_function() -> None:
    users._user_auth_cache.clear()


def row(user_id: object, external_id: str) -> dict[str, object]:
    return {
        "id": user_id,
        "external_id": external_id,
        "created_at": None,
    }


def test_cached_user_is_returned_for_fresh_key(monkeypatch) -> None:
    monkeypatch.setattr(users, "monotonic", lambda: 100.0)
    monkeypatch.setattr(users.settings, "proxy_auth_cache_ttl_seconds", 300)
    api_key = "ek_fresh"

    users.cache_user_auth(hash_api_key(api_key), row("user-1", "external-1"))

    cached_user = users.get_cached_user_by_api_key(api_key)

    assert cached_user is not None
    assert cached_user["id"] == "user-1"
    assert cached_user["external_id"] == "external-1"


def test_cached_user_expires_after_ttl(monkeypatch) -> None:
    current_time = 100.0
    monkeypatch.setattr(users, "monotonic", lambda: current_time)
    monkeypatch.setattr(users.settings, "proxy_auth_cache_ttl_seconds", 5)
    api_key = "ek_expiring"
    api_key_hash = hash_api_key(api_key)

    users.cache_user_auth(api_key_hash, row("user-1", "external-1"))
    current_time = 106.0

    assert users.get_cached_user_by_api_key(api_key) is None
    assert api_key_hash not in users._user_auth_cache


def test_clear_cached_user_removes_all_keys_for_user(monkeypatch) -> None:
    monkeypatch.setattr(users, "monotonic", lambda: 100.0)
    monkeypatch.setattr(users.settings, "proxy_auth_cache_ttl_seconds", 300)
    first_key = "ek_first"
    second_key = "ek_second"
    other_key = "ek_other"

    users.cache_user_auth(hash_api_key(first_key), row("user-1", "external-1"))
    users.cache_user_auth(hash_api_key(second_key), row("user-1", "external-1"))
    users.cache_user_auth(hash_api_key(other_key), row("user-2", "external-2"))
    users.clear_cached_user("user-1")

    assert users.get_cached_user_by_api_key(first_key) is None
    assert users.get_cached_user_by_api_key(second_key) is None
    assert users.get_cached_user_by_api_key(other_key) is not None


def test_cache_trims_oldest_entry_when_full(monkeypatch) -> None:
    current_time = 0.0

    def fake_monotonic() -> float:
        return current_time

    monkeypatch.setattr(users, "monotonic", fake_monotonic)
    monkeypatch.setattr(users.settings, "proxy_auth_cache_ttl_seconds", 300)
    monkeypatch.setattr(users.settings, "proxy_auth_cache_max_entries", 2)

    current_time = 1.0
    users.cache_user_auth(hash_api_key("ek_oldest"), row("user-1", "external-1"))
    current_time = 2.0
    users.cache_user_auth(hash_api_key("ek_middle"), row("user-2", "external-2"))
    current_time = 3.0
    users.cache_user_auth(hash_api_key("ek_newest"), row("user-3", "external-3"))

    assert users.get_cached_user_by_api_key("ek_oldest") is None
    assert users.get_cached_user_by_api_key("ek_middle") is not None
    assert users.get_cached_user_by_api_key("ek_newest") is not None


@pytest.mark.asyncio
async def test_update_user_external_id_clears_cached_user(monkeypatch) -> None:
    class FakeDb:
        async def fetchrow(self, query, *args):
            return {
                "id": args[0],
                "external_id": args[1],
                "created_at": None,
            }

    monkeypatch.setattr(users, "monotonic", lambda: 100.0)
    monkeypatch.setattr(users.settings, "proxy_auth_cache_ttl_seconds", 300)
    api_key = "ek_user_name"
    user_id = uuid4()

    users.cache_user_auth(hash_api_key(api_key), row(user_id, "old-name"))

    updated_user = await users.update_user_external_id(user_id, "new-name", FakeDb())

    assert updated_user["external_id"] == "new-name"
    assert users.get_cached_user_by_api_key(api_key) is None


@pytest.mark.asyncio
async def test_get_user_by_api_key_returns_none_when_no_user_or_key_row() -> None:
    class FakeDb:
        async def fetchrow(self, query, *args):
            return None

    api_key = "ek_missing"

    result = await users.get_user_by_api_key(api_key, FakeDb())

    assert result is None
