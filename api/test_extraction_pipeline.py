from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID, uuid4

import pytest

from api.services import extraction
from api.services.provider_keys import ResolvedProvider

pytestmark = pytest.mark.usefixtures("inline_capture_jobs")


@pytest.mark.asyncio
@pytest.mark.parametrize("background", [False, True])
async def test_extraction_paths_preserve_quota_namespace_and_transaction(
    monkeypatch: pytest.MonkeyPatch, background: bool,
) -> None:
    user_id = uuid4()
    org_id = uuid4()
    conversation_id = uuid4()
    target_id = uuid4()
    namespace = "project" if background else "default"
    records: list[tuple[str, int]] = []
    active_connections = 0
    in_transaction = False

    class PipelineDb:
        @asynccontextmanager
        async def transaction(self) -> AsyncIterator[None]:
            nonlocal in_transaction
            in_transaction = True
            try:
                yield
            finally:
                in_transaction = False

    class PipelinePool:
        @asynccontextmanager
        async def acquire(self) -> AsyncIterator[PipelineDb]:
            nonlocal active_connections
            active_connections += 1
            try:
                yield PipelineDb()
            finally:
                active_connections -= 1

    async def context(*args: object) -> dict[str, object]:
        assert args[:2] == (user_id, org_id)
        return {"id": user_id}

    async def usage(*args: object) -> dict[str, object]:
        return {"memories": 0, "limits": {"memories": 2}}

    async def locked_usage(*args: object, **kwargs: object) -> dict[str, object]:
        assert in_transaction
        assert kwargs["amount"] == 0
        return {"memories": 2, "limits": {"memories": 2}}

    async def extract(*args: object) -> list[str]:
        assert active_connections == 0
        return ["User changed a preference", "User has a new project"]

    async def candidates(*args: object) -> list[list[dict[str, object]]]:
        assert args[:2] == (user_id, org_id)
        assert args[-1] == namespace
        return [[{"id": target_id}], []]

    async def reconcile(*args: object) -> list[tuple[str, UUID | None]]:
        assert active_connections == 0
        return [("update", target_id), ("add", None)]

    async def store(*args: object, **kwargs: object) -> tuple[int, list[tuple[UUID, str]]]:
        assert args[:2] == (user_id, org_id)
        assert in_transaction
        assert kwargs["namespace"] == namespace
        assert kwargs["decisions"] == [("update", target_id), ("discard", None)]
        return 1, []

    async def record(*args: object) -> None:
        records.append((str(args[5]), int(args[6])))
        if args[5] == "completed":
            assert in_transaction

    monkeypatch.setattr(extraction, "get_pool", PipelinePool)
    monkeypatch.setattr(extraction, "get_workspace_provider_context", context)
    monkeypatch.setattr(extraction, "get_workspace_usage", usage)
    monkeypatch.setattr(extraction, "enforce_workspace_limit", locked_usage)
    monkeypatch.setattr(extraction, "extract_memories", extract)
    monkeypatch.setattr(extraction, "load_reconciliation_candidates", candidates)
    monkeypatch.setattr(extraction, "reconcile_memories", reconcile)
    monkeypatch.setattr(extraction, "store_extracted_memories", store)
    monkeypatch.setattr(extraction, "record_conversation", record)
    monkeypatch.setattr(extraction.settings, "enable_reconciliation", True)
    monkeypatch.setattr(extraction, "resolve_user_provider", lambda *args, **kwargs: ResolvedProvider("openai", "key", "https://provider.test", "model", "test"))
    monkeypatch.setattr("api.services.embedding.embed_batch", lambda texts: [[1.0] for text in texts])

    if background:
        await extraction.run_extraction_task(
            user_id, org_id, conversation_id, {"messages": []}, b"{}", namespace=namespace,
        )
        assert records == [("running", 0), ("completed", 1)]
    else:
        result = await extraction.capture_conversation_memories(
            user_id, org_id, "Remember my changes", "Saved", "test", None,
        )
        assert result["memories_extracted"] == 1
        assert records == [("completed", 1)]
    assert active_connections == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("background", [False, True])
async def test_extraction_failure_is_isolated_only_for_background_tasks(
    monkeypatch: pytest.MonkeyPatch, background: bool,
) -> None:
    failed_records: list[bool] = []

    class PipelinePool:
        @asynccontextmanager
        async def acquire(self) -> AsyncIterator[object]:
            yield object()

    async def fail(*args: object, **kwargs: object) -> tuple[int, list[str]]:
        raise RuntimeError("Provider unavailable")

    async def record(*args: object) -> None:
        return None

    async def mark_failed(*args: object) -> None:
        failed_records.append(True)

    monkeypatch.setattr(extraction, "get_pool", PipelinePool)
    monkeypatch.setattr(extraction, "process_conversation_memories", fail)
    monkeypatch.setattr(extraction, "record_conversation", record)
    monkeypatch.setattr(extraction, "mark_conversation_failed", mark_failed)

    if background:
        await extraction.run_extraction_task(uuid4(), uuid4(), uuid4(), {}, b"{}")
        assert failed_records == [True]
    else:
        with pytest.raises(RuntimeError, match="Provider unavailable"):
            await extraction.capture_conversation_memories(uuid4(), uuid4(), "Hello", "Hi", "test", None)
        assert failed_records == []
