from contextlib import asynccontextmanager
from uuid import uuid4

import pytest
from fastapi import HTTPException

from api.models.memory import MemoryCreate, MemoryImportRequest
from api.models.org import OrgMemberAdd
from api.routes import memories, orgs, proxy
from api.services import orgs as org_service
from api.services.entitlements import QuotaExceeded, quota_headers
from api.services.extraction import limit_add_decisions


class FakeDb:
    @asynccontextmanager
    async def transaction(self):
        yield


def assert_quota_response(error: HTTPException, resource: str) -> None:
    assert error.status_code == 429
    assert error.detail == f"{resource} limit reached"
    assert error.headers == {
        "X-Engram-Quota-Resource": resource,
        "X-Engram-Quota-Current": "10",
        "X-Engram-Quota-Limit": "10",
    }


def test_quota_headers_describe_limit() -> None:
    error = QuotaExceeded("retrievals", current=10, limit=10)

    assert quota_headers(error) == {
        "X-Engram-Quota-Resource": "retrievals",
        "X-Engram-Quota-Current": "10",
        "X-Engram-Quota-Limit": "10",
    }


def test_extraction_keeps_updates_and_discards_excess_additions() -> None:
    decisions = [("add", None), ("update", uuid4()), ("add", None)]

    limited = limit_add_decisions(decisions, available=1)

    assert limited[0] == ("add", None)
    assert limited[1] == decisions[1]
    assert limited[2] == ("discard", None)


@pytest.mark.asyncio
async def test_create_memory_rejects_before_embedding_work(monkeypatch) -> None:
    work_started = False

    async def reject(*args: object, **kwargs: object) -> dict[str, object]:
        raise QuotaExceeded("memories", current=10, limit=10)

    async def fake_create(*args: object, **kwargs: object) -> dict[str, object]:
        nonlocal work_started
        work_started = True
        return {}

    monkeypatch.setattr(memories, "enforce_workspace_limit", reject)
    monkeypatch.setattr(memories, "create_memory", fake_create)

    with pytest.raises(HTTPException) as raised:
        await memories.create_memory_route(
            MemoryCreate(content="User prefers FastAPI"),
            {"id": uuid4(), "org_id": uuid4(), "dedup_threshold": 0.95},
            FakeDb(),
        )

    assert not work_started
    assert_quota_response(raised.value, "memories")


@pytest.mark.asyncio
async def test_import_reserves_entire_batch_before_work(monkeypatch) -> None:
    reserved_amount = 0
    work_started = False

    async def reject(*args: object, **kwargs: object) -> dict[str, object]:
        nonlocal reserved_amount
        reserved_amount = int(kwargs["amount"])
        raise QuotaExceeded("memories", current=10, limit=10)

    async def fake_import(*args: object, **kwargs: object) -> int:
        nonlocal work_started
        work_started = True
        return 0

    monkeypatch.setattr(memories, "enforce_workspace_limit", reject)
    monkeypatch.setattr(memories, "import_memories", fake_import)
    payload = MemoryImportRequest(memories=[{"content": "One"}, {"content": "Two"}])

    with pytest.raises(HTTPException):
        await memories.import_memories_route(
            payload,
            {"id": uuid4(), "org_id": uuid4(), "dedup_threshold": 0.95},
            FakeDb(),
        )

    assert reserved_amount == 2
    assert not work_started


@pytest.mark.asyncio
async def test_proxy_rejects_before_retrieval_or_provider(monkeypatch) -> None:
    work_started = False
    user = {
        "id": uuid4(),
        "org_id": uuid4(),
        "external_id": "user-1",
        "max_memories_injected": 5,
        "retrieval_threshold": 0.5,
        "dedup_threshold": 0.95,
        "retrieval_mode": "vector",
    }

    class FakeAcquire:
        async def __aenter__(self) -> FakeDb:
            return FakeDb()

        async def __aexit__(self, exc_type, exc, traceback) -> None:
            return None

    class FakePool:
        def acquire(self) -> FakeAcquire:
            return FakeAcquire()

    async def fake_user(*args: object, **kwargs: object) -> dict[str, object]:
        return user

    async def reject(*args: object, **kwargs: object) -> dict[str, object]:
        raise QuotaExceeded("retrievals", current=10, limit=10)

    async def fake_prepare(*args: object, **kwargs: object) -> object:
        nonlocal work_started
        work_started = True
        return object()

    monkeypatch.setattr(proxy, "get_pool", lambda: FakePool())
    monkeypatch.setattr(proxy, "get_user_by_api_key", fake_user)
    monkeypatch.setattr(proxy, "enforce_workspace_limit", reject)
    monkeypatch.setattr(proxy, "prepare_proxy_request", fake_prepare)

    with pytest.raises(HTTPException) as raised:
        await proxy.build_proxy_response_with_available_auth(
            "api-key", None, "openai", False, True, None, {"messages": []}, {}
        )

    assert not work_started
    assert_quota_response(raised.value, "retrievals")


@pytest.mark.asyncio
async def test_member_limit_rejects_before_insert(monkeypatch) -> None:
    work_started = False

    async def reject(*args: object, **kwargs: object) -> dict[str, object]:
        raise QuotaExceeded("members", current=10, limit=10)

    async def fake_add(*args: object, **kwargs: object) -> dict[str, object]:
        nonlocal work_started
        await reject()
        work_started = True
        return {}

    monkeypatch.setattr(orgs.org_service, "add_org_member", fake_add)
    org_id = uuid4()

    with pytest.raises(HTTPException) as raised:
        await orgs.add_member(
            str(org_id),
            OrgMemberAdd(external_id="new-user", role="member"),
            {"id": uuid4(), "org_id": org_id},
            FakeDb(),
        )

    assert not work_started
    assert_quota_response(raised.value, "members")


@pytest.mark.asyncio
@pytest.mark.parametrize(("existing_member", "expected_amount"), [(1, 0), (None, 1)])
async def test_member_upsert_counts_only_new_seats(
    monkeypatch: pytest.MonkeyPatch,
    existing_member: object,
    expected_amount: int,
) -> None:
    amounts: list[int] = []
    rows = iter(
        [
            {"role": "owner"},
            {"id": "target-id", "external_id": "target"},
            {"user_id": "target-id", "role": "member", "created_at": None},
        ]
    )

    class MembershipDb:
        async def fetchrow(self, query: str, *args: object) -> dict[str, object]:
            return next(rows)

        async def fetchval(self, query: str, *args: object) -> object:
            return existing_member

    async def capture_limit(*args: object, **kwargs: object) -> dict[str, object]:
        amounts.append(int(kwargs["amount"]))
        return {}

    monkeypatch.setattr(org_service, "enforce_workspace_limit", capture_limit)

    await org_service.add_org_member(
        "org-1", "actor-1", "org-1", "target", "member", MembershipDb()
    )

    assert amounts == [expected_amount]
