from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

import pytest

from api.services import proxy
from api.services.provider_keys import ResolvedProvider


def test_provider_headers_strip_all_engram_headers() -> None:
    headers = proxy.sanitize_passthrough_headers({
        "Authorization": "Bearer engram-key",
        "X-Engram-Service-Key": "service-secret",
        "X-Engram-Namespace": "private-project",
        "X-Engram-Future-Secret": "secret",
        "X-Request-ID": "request-1",
    })

    assert headers == {"x-request-id": "request-1"}


@pytest.mark.asyncio
@pytest.mark.parametrize("failure_stage", ["retrieval", "logging"])
async def test_memory_failure_leaves_provider_context_usable(
    monkeypatch: pytest.MonkeyPatch, failure_stage: str,
) -> None:
    user_id = uuid4()
    org_id = uuid4()
    rolled_back: list[bool] = []
    memory = {"id": uuid4(), "content": "User prefers Python", "score": 0.9}

    class TransactionDb:
        failed = False

        @asynccontextmanager
        async def transaction(self) -> AsyncIterator[None]:
            try:
                yield
            except RuntimeError:
                self.failed = False
                rolled_back.append(True)
                raise

    db = TransactionDb()

    async def retrieve(*args: object, **kwargs: object) -> list[dict[str, object]]:
        if failure_stage == "retrieval":
            db.failed = True
            raise RuntimeError("retrieval SQL failed")
        return [memory]

    async def log(*args: object, **kwargs: object) -> None:
        db.failed = True
        raise RuntimeError("log SQL failed")

    async def context(*args: object, **kwargs: object) -> dict[str, object]:
        assert not db.failed
        return {"id": user_id}

    monkeypatch.setattr(proxy, "retrieve_memories", retrieve)
    monkeypatch.setattr(proxy, "log_retrieval", log)
    monkeypatch.setattr(proxy, "get_workspace_provider_context", context)
    monkeypatch.setattr(proxy, "resolve_user_provider", lambda *args, **kwargs: ResolvedProvider("openai", "key", "https://provider.test", "model", "test"))
    body = {"messages": [{"role": "user", "content": "What language?"}]}

    prepared = await proxy.prepare_proxy_request(
        user_id, org_id, "user-1", "user-1", body, "openai", False, db,
    )

    assert rolled_back == [True]
    assert body == {"messages": [{"role": "user", "content": "What language?"}]}
    assert prepared.injected_count == (1 if failure_stage == "logging" else 0)
    if failure_stage == "logging":
        assert "User prefers Python" in prepared.body["messages"][0]["content"]
