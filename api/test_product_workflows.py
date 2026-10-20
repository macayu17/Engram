from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from api.models.memory import MemoryCreate, MemorySearchRequest, MemoryUpdate
from api.services import deduplication, retrieval


def test_memory_scope_and_expiration_are_validated() -> None:
    memory = MemoryCreate(content="User prefers concise answers", namespace="project-a", expires_at="2030-01-01T00:00:00Z")
    assert memory.namespace == "project-a"
    assert memory.expires_at == datetime(2030, 1, 1, tzinfo=UTC)
    for namespace in ("../other", "", "space name", "x" * 81):
        with pytest.raises(ValidationError):
            MemorySearchRequest(query="preferences", namespace=namespace)
    assert MemoryUpdate(namespace="personal").namespace == "personal"


def test_retrieval_does_not_expand_with_sample_user_preferences() -> None:
    query = "What tech stack should I use for my project?"
    assert retrieval.build_retrieval_texts(query) == [query]


def test_retrieval_evaluation_requires_the_complete_expected_fact() -> None:
    from api.eval.retrieval_eval import precision_recall

    assert precision_recall(["User prefers Python"], "User prefers Python for backend work") == (0.0, 0.0)
    assert precision_recall(["User prefers Python", "Unrelated fact"], "User prefers Python") == (0.5, 1.0)


@pytest.mark.asyncio
async def test_capture_already_claimed_by_worker_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services import extraction, jobs

    class EmptyPool:
        @asynccontextmanager
        async def acquire(self):
            yield object()

    async def persist(*args: object) -> bool:
        return True

    async def claim(*args: object, **kwargs: object) -> None:
        return None

    monkeypatch.setattr(jobs, "persist_job", persist)
    monkeypatch.setattr(jobs, "claim_job", claim)
    monkeypatch.setattr(extraction, "get_pool", EmptyPool)
    result = await extraction.capture_conversation_memories(uuid4(), uuid4(), "Remember this", "Captured", "test", None)
    assert result["extraction_status"] == "queued"


@pytest.mark.asyncio
async def test_extraction_proposes_changes_to_approved_memory(monkeypatch: pytest.MonkeyPatch) -> None:
    user_id, org_id, memory_id = uuid4(), uuid4(), uuid4()
    queries: list[str] = []

    class RevisionDb:
        async def fetchrow(self, query: str, *args: object) -> dict[str, object]:
            queries.append(query)
            return {"id": memory_id, "content": "User prefers Flask", "score": 0.9, "status": "approved", "namespace": "project"}

    async def propose(*args: object, **kwargs: object) -> dict[str, object]:
        assert args[:3] == (user_id, org_id, memory_id)
        assert args[3] == "User now prefers FastAPI"
        return {"id": uuid4()}

    monkeypatch.setattr("api.services.revisions.propose_revision", propose)
    result = await deduplication.store_memory_with_deduplication(
        user_id, org_id, "User now prefers FastAPI", [1.0], uuid4(), 1.0,
        RevisionDb(), source="extraction", status="pending", namespace="project",
    )
    assert result["action"] == "proposed"
    assert not any("UPDATE memories" in query for query in queries)


@pytest.mark.asyncio
async def test_retrieval_filters_expiry_and_explicit_personal_scope(monkeypatch: pytest.MonkeyPatch) -> None:
    class ScopeDb:
        async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
            assert "expires_at" in query
            assert args[5] == ["project", "personal"]
            return []

    monkeypatch.setattr(retrieval, "embed", lambda text: [1.0])
    await retrieval.retrieve_memories(uuid4(), uuid4(), "preference", ScopeDb(), namespace="project", include_personal=True)
