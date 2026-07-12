from contextlib import asynccontextmanager
from uuid import uuid4

import pytest

from api.routes import proxy as proxy_routes
from api.services import extraction
from api.services.provider_keys import ResolvedProvider
from api.services.proxy import PreparedProxyRequest, ProviderResponse


@pytest.fixture(autouse=True)
def bypass_quota_checks(monkeypatch):
    async def allow(*args: object, **kwargs: object) -> dict[str, object]:
        return {"memories": 0, "limits": {"memories": 2_000}}

    monkeypatch.setattr(proxy_routes, "enforce_workspace_limit", allow)
    monkeypatch.setattr(extraction, "enforce_workspace_limit", allow)
    monkeypatch.setattr(extraction, "get_workspace_usage", allow)


class FakeDb:
    @asynccontextmanager
    async def transaction(self):
        yield


class FakeAcquire:
    def __init__(self, events: list[str]) -> None:
        self.events = events

    async def __aenter__(self) -> object:
        self.events.append("connection_acquired")
        return FakeDb()

    async def __aexit__(self, exc_type, exc, traceback) -> None:
        self.events.append("connection_released")


class FakePool:
    def __init__(self, events: list[str]) -> None:
        self.events = events

    def acquire(self) -> FakeAcquire:
        return FakeAcquire(self.events)


def user_row() -> dict[str, object]:
    return {
        "id": uuid4(),
        "org_id": uuid4(),
        "external_id": "user-1",
        "max_memories_injected": 5,
        "retrieval_threshold": 0.5,
        "dedup_threshold": 0.95,
        "retrieval_mode": "vector",
    }


def prepared_request() -> PreparedProxyRequest:
    return PreparedProxyRequest(
        {"messages": [{"role": "user", "content": "Hello"}]},
        ResolvedProvider("openai", "provider-key", "https://api.openai.com/v1", "gpt-4o-mini", "request"),
        uuid4(),
        0,
    )


@pytest.mark.asyncio
async def test_provider_starts_after_database_connection_is_released(monkeypatch) -> None:
    events: list[str] = []
    user = user_row()

    async def fake_get_user(api_key: str, db: object) -> dict[str, object]:
        return user

    async def fake_prepare(*args: object, **kwargs: object) -> PreparedProxyRequest:
        events.append("auth_and_retrieval_finished")
        return prepared_request()

    async def fake_forward(*args: object, **kwargs: object) -> ProviderResponse:
        events.extend(["provider_started", "provider_finished"])
        return ProviderResponse(b"{}", 200, "application/json")

    monkeypatch.setattr(proxy_routes, "get_pool", lambda: FakePool(events))
    monkeypatch.setattr(proxy_routes, "get_user_by_api_key", fake_get_user)
    monkeypatch.setattr(proxy_routes, "prepare_proxy_request", fake_prepare)
    monkeypatch.setattr(proxy_routes, "forward_to_provider", fake_forward)

    await proxy_routes.build_proxy_response_with_available_auth(
        "api-key", "user-1", "openai", False, True, None, {"messages": []}, {}
    )

    assert events == [
        "connection_acquired",
        "auth_and_retrieval_finished",
        "connection_released",
        "provider_started",
        "provider_finished",
    ]


@pytest.mark.asyncio
async def test_streaming_upstream_error_returns_before_stream(monkeypatch) -> None:
    user = user_row()

    class FakeProviderStream:
        status_code = 401
        media_type = "application/json"
        closed = False

        async def aread(self) -> bytes:
            return b'{"error":"bad key"}'

        async def aclose(self) -> None:
            self.closed = True

    provider_stream = FakeProviderStream()

    async def fake_get_user(api_key: str, db: object) -> dict[str, object]:
        return user

    async def fake_prepare(*args: object, **kwargs: object) -> PreparedProxyRequest:
        return prepared_request()

    async def fake_open(*args: object, **kwargs: object) -> FakeProviderStream:
        return provider_stream

    monkeypatch.setattr(proxy_routes, "get_pool", lambda: FakePool([]))
    monkeypatch.setattr(proxy_routes, "get_user_by_api_key", fake_get_user)
    monkeypatch.setattr(proxy_routes, "prepare_proxy_request", fake_prepare)
    monkeypatch.setattr(proxy_routes, "open_provider_stream", fake_open)

    response = await proxy_routes.build_streaming_proxy_response(
        "api-key", "user-1", "openai", False, True, None, {"messages": [], "stream": True}, {}
    )

    assert response.status_code == 401
    assert provider_stream.closed


@pytest.mark.asyncio
async def test_extraction_calls_provider_without_acquired_connection(monkeypatch) -> None:
    active_connections = 0
    provider_connection_counts: list[int] = []

    class FakeDb:
        async def fetchrow(self, query: str, *args: object) -> dict[str, object]:
            return {"id": args[0], "external_id": "user-1", "extraction_provider": "openai"}

    class CountingAcquire:
        async def __aenter__(self) -> FakeDb:
            nonlocal active_connections
            active_connections += 1
            return FakeDb()

        async def __aexit__(self, exc_type, exc, traceback) -> None:
            nonlocal active_connections
            active_connections -= 1

    class CountingPool:
        def acquire(self) -> CountingAcquire:
            return CountingAcquire()

    async def fake_record(*args: object, **kwargs: object) -> None:
        return None

    async def fake_extract(*args: object, **kwargs: object) -> list[str]:
        provider_connection_counts.append(active_connections)
        return []

    monkeypatch.setattr(extraction, "get_pool", lambda: CountingPool())
    monkeypatch.setattr(extraction, "record_conversation", fake_record)
    monkeypatch.setattr(extraction, "extract_memories", fake_extract)
    monkeypatch.setattr(
        extraction,
        "resolve_user_provider",
        lambda *args, **kwargs: ResolvedProvider(
            "openai", "provider-key", "https://api.openai.com/v1", "gpt-4o-mini", "request"
        ),
    )

    await extraction.run_extraction_task(
        uuid4(), uuid4(), uuid4(), {"messages": []}, b'{"choices":[]}'
    )

    assert provider_connection_counts == [0]


@pytest.mark.asyncio
async def test_reconciliation_calls_provider_without_acquired_connection(monkeypatch) -> None:
    active_connections = 0
    reconciliation_connection_counts: list[int] = []

    class FakeDb:
        async def fetchrow(self, query: str, *args: object) -> dict[str, object]:
            return {"id": args[0], "external_id": "user-1", "extraction_provider": "openai"}

    class CountingAcquire:
        async def __aenter__(self) -> FakeDb:
            nonlocal active_connections
            active_connections += 1
            return FakeDb()

        async def __aexit__(self, exc_type, exc, traceback) -> None:
            nonlocal active_connections
            active_connections -= 1

    class CountingPool:
        def acquire(self) -> CountingAcquire:
            return CountingAcquire()

    async def fake_record(*args: object, **kwargs: object) -> None:
        return None

    async def fake_extract(*args: object, **kwargs: object) -> list[str]:
        return ["User prefers FastAPI"]

    async def fake_reconcile(*args: object, **kwargs: object) -> list[tuple[str, None]]:
        reconciliation_connection_counts.append(active_connections)
        return [("discard", None)]

    async def fake_candidates(*args: object, **kwargs: object) -> list[list[dict[str, object]]]:
        return [[]]

    monkeypatch.setattr(extraction, "get_pool", lambda: CountingPool())
    monkeypatch.setattr(extraction, "record_conversation", fake_record)
    monkeypatch.setattr(extraction, "extract_memories", fake_extract)
    monkeypatch.setattr(extraction, "load_reconciliation_candidates", fake_candidates)
    monkeypatch.setattr(extraction, "reconcile_memories", fake_reconcile)
    monkeypatch.setattr("api.services.embedding.embed_batch", lambda memories: [[0.0] * 384])
    monkeypatch.setattr(
        extraction,
        "resolve_user_provider",
        lambda *args, **kwargs: ResolvedProvider(
            "openai", "provider-key", "https://api.openai.com/v1", "gpt-4o-mini", "request"
        ),
    )

    await extraction.run_extraction_task(
        uuid4(), uuid4(), uuid4(), {"messages": []}, b'{"choices":[]}'
    )

    assert reconciliation_connection_counts == [0]


@pytest.mark.asyncio
async def test_manual_capture_calls_provider_without_acquired_connection(monkeypatch) -> None:
    active_connections = 0
    provider_connection_counts: list[int] = []

    class FakeDb:
        async def fetchrow(self, query: str, *args: object) -> dict[str, object]:
            return {"id": args[0], "external_id": "user-1", "extraction_provider": "openai"}

    class CountingAcquire:
        async def __aenter__(self) -> FakeDb:
            nonlocal active_connections
            active_connections += 1
            return FakeDb()

        async def __aexit__(self, exc_type, exc, traceback) -> None:
            nonlocal active_connections
            active_connections -= 1

    class CountingPool:
        def acquire(self) -> CountingAcquire:
            return CountingAcquire()

    async def fake_extract(*args: object, **kwargs: object) -> list[str]:
        provider_connection_counts.append(active_connections)
        return []

    async def fake_record(*args: object, **kwargs: object) -> None:
        return None

    monkeypatch.setattr(extraction, "get_pool", lambda: CountingPool())
    monkeypatch.setattr(extraction, "extract_memories", fake_extract)
    monkeypatch.setattr(extraction, "record_conversation", fake_record)
    monkeypatch.setattr(
        extraction,
        "resolve_user_provider",
        lambda *args, **kwargs: ResolvedProvider(
            "openai", "provider-key", "https://api.openai.com/v1", "gpt-4o-mini", "request"
        ),
    )

    await extraction.capture_conversation_memories(
        uuid4(), uuid4(), "Hello", "Hi", "test", None
    )

    assert provider_connection_counts == [0]
