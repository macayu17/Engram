import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import json
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import asyncpg
from fastapi import HTTPException
import pytest

from api.config import settings
from api.services import jobs


class JobPool:
    def __init__(self, db: object) -> None:
        self.db = db

    @asynccontextmanager
    async def acquire(self) -> AsyncIterator[object]:
        yield self.db


@pytest.mark.asyncio
async def test_queue_persists_before_scheduling_and_never_saves_override_key(monkeypatch: pytest.MonkeyPatch) -> None:
    db = AsyncMock()
    db.fetchval.return_value = uuid4()
    monkeypatch.setattr(jobs, "get_pool", lambda: JobPool(db))
    events: list[str] = []

    async def run_job(conversation_id: UUID, override_provider_key: str | None = None) -> None:
        assert db.fetchval.await_count == 1
        assert override_provider_key == 'secret"provider-key'
        events.append("started")

    monkeypatch.setattr(jobs, "run_queued_job", run_job)
    await jobs.queue_extraction(uuid4(), uuid4(), uuid4(), {"messages": [{"content": 'secret"provider-key'}], 'secret"provider-key': "value"}, b'{}', override_provider="openai", override_provider_key='secret"provider-key', namespace="project.one")
    await asyncio.gather(*list(jobs._extraction_tasks))
    arguments = db.fetchval.await_args.args
    persisted = json.loads(arguments[5])
    assert persisted["request"]["namespace"] == "project.one"
    assert persisted["request"]["messages"][0]["content"] == "[redacted]"
    assert persisted["request"]["[redacted]"] == "value"
    assert arguments[6] is False
    assert "secret" not in arguments[7]
    assert events == ["started"]
    assert "DO NOTHING" in arguments[0]


@pytest.mark.asyncio
async def test_duplicate_queue_does_not_schedule_and_payload_is_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    db = AsyncMock()
    db.fetchval.return_value = None
    monkeypatch.setattr(jobs, "get_pool", lambda: JobPool(db))
    run_job = AsyncMock()
    monkeypatch.setattr(jobs, "run_queued_job", run_job)
    await jobs.queue_extraction(uuid4(), uuid4(), uuid4(), {}, b'{}')
    run_job.assert_not_awaited()
    with pytest.raises(HTTPException) as error:
        await jobs.persist_job(uuid4(), uuid4(), uuid4(), {"messages": ["a" * (2 * 1024 * 1024)]}, b'{}')
    assert error.value.status_code == 413
    assert db.fetchval.await_count == 1


@pytest.mark.asyncio
async def test_claim_is_atomic_leased_and_bounded() -> None:
    db = AsyncMock()
    await jobs.claim_job(db)
    query, identifier, maximum, allow_ephemeral, lease_token, lease_seconds = db.fetchrow.await_args.args
    assert "FOR UPDATE SKIP LOCKED" in query
    assert "attempts < $2" in query
    assert "attempts = attempts + 1" in query
    assert "lease_until <= now()" in query
    assert "JOIN" not in query
    assert "org_memberships.user_id = conversations.user_id" in query
    assert identifier is None
    assert maximum == settings.extraction_job_max_attempts
    assert allow_ephemeral is False
    assert isinstance(lease_token, UUID)
    assert lease_seconds == settings.extraction_job_lease_seconds


@pytest.mark.asyncio
async def test_failure_and_cancellation_update_only_owned_active_lease(monkeypatch: pytest.MonkeyPatch) -> None:
    db = AsyncMock()
    monkeypatch.setattr(jobs, "get_pool", lambda: JobPool(db))
    job = {"id": uuid4(), "lease_token": uuid4(), "recoverable": True, "attempts": 3}
    await jobs.finish_failed_job(job)
    query, identifier, token, status, message, backoff = db.execute.await_args.args
    assert "lease_token = $2 AND extraction_status = 'running'" in query
    assert identifier == job["id"]
    assert token == job["lease_token"]
    assert status == "failed"
    assert backoff == 20
    await jobs.finish_failed_job(job, cancelled=True)
    assert db.execute.await_args.args[3] == "pending"
    assert db.execute.await_args.args[-1] == 0
    await jobs.finish_failed_job({**job, "recoverable": False}, cancelled=True)
    assert db.execute.await_args.args[3] == "failed"
    assert "temporary provider key" in db.execute.await_args.args[4]


@pytest.mark.asyncio
async def test_processing_passes_namespace_and_lease_and_hides_provider_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.services import extraction

    db = AsyncMock()
    monkeypatch.setattr(jobs, "get_pool", lambda: JobPool(db))
    process = AsyncMock(side_effect=RuntimeError("secret-provider-key"))
    monkeypatch.setattr(extraction, "process_conversation_memories", process)
    job = {"id": uuid4(), "user_id": uuid4(), "org_id": uuid4(), "namespace": "project", "lease_token": uuid4(), "attempts": 1, "recoverable": True, "raw_exchange": json.dumps({"request": {"messages": []}, "response": "{}"}), "extraction_options": json.dumps({"dedup_threshold": 0.9})}
    assert await jobs.process_claimed_job(job) is None
    assert process.await_args.kwargs == {"namespace": "project", "job_token": job["lease_token"]}
    assert process.await_args.args[3]["namespace"] == "project"
    assert "secret-provider-key" not in str(db.execute.await_args.args)
    with pytest.raises(RuntimeError):
        await jobs.process_claimed_job(job, propagate_errors=True)
    process.side_effect = asyncio.CancelledError()
    with pytest.raises(asyncio.CancelledError):
        await jobs.process_claimed_job(job)
    assert db.execute.await_args.args[3] == "pending"


@pytest.mark.asyncio
async def test_retry_retention_and_status_are_user_workspace_project_scoped() -> None:
    db = AsyncMock()
    db.fetchval.return_value = None
    identifier = uuid4()
    with pytest.raises(HTTPException):
        await jobs.retry_job("user", "org", identifier, "project", db)
    query, job_id, user_id, org_id, namespace = db.fetchval.await_args.args
    assert (job_id, user_id, org_id, namespace) == (identifier, "user", "org", "project")
    assert "extraction_status = 'failed' AND recoverable" in query
    assert "raw_exchange IS NOT NULL" in query
    db.fetchval.return_value = 2
    assert await jobs.clear_captures("user", "org", 30, "project", db) == 2
    query = db.fetchval.await_args.args[0]
    assert "SET raw_exchange = NULL, recoverable = false" in query
    assert "extraction_status IN ('completed', 'failed')" in query
    assert "lease_until <= now()" in query
    assert db.fetchval.await_args.args[1:] == ("user", "org", "project", 30)
    db.fetch.return_value = []
    assert await jobs.list_jobs("user", "org", "project", db) == []
    assert "raw_exchange" not in db.fetch.await_args.args[0]
    assert db.fetch.await_args.args[1:] == ("user", "org", "project")


@pytest.mark.asyncio
async def test_postgres_claim_is_exclusive_and_retention_preserves_running_jobs(monkeypatch: pytest.MonkeyPatch) -> None:
    database_url = getattr(settings, "engram_test_database_url", "")
    if not database_url:
        pytest.skip("ENGRAM_TEST_DATABASE_URL is not configured")
    db = await asyncpg.connect(database_url, timeout=10)
    transaction = db.transaction()
    await transaction.start()
    try:
        user_id, org_id, conversation_id = uuid4(), uuid4(), uuid4()
        await db.execute("INSERT INTO users(id,external_id,api_key_hash) VALUES ($1,$2,$3)", user_id, f"jobs-test-{user_id}", str(user_id))
        await db.execute("INSERT INTO orgs(id,name) VALUES ($1,'Jobs test')", org_id)
        await db.execute("INSERT INTO org_memberships(user_id,org_id) VALUES($1,$2)", user_id, org_id)
        monkeypatch.setattr(jobs, "get_pool", lambda: JobPool(db))
        assert await jobs.persist_job(user_id, org_id, conversation_id, {"messages": []}, b'{}', namespace="project")
        assert not await jobs.persist_job(user_id, org_id, conversation_id, {"messages": []}, b'{}', namespace="other")
        claimed = await jobs.claim_job(db, conversation_id)
        assert claimed is not None
        assert claimed["namespace"] == "project"
        assert claimed["attempts"] == 1
        assert await jobs.claim_job(db, conversation_id) is None
        await db.execute("UPDATE conversations SET created_at=now()-interval '60 days' WHERE id=$1", conversation_id)
        assert await jobs.clear_captures(user_id, org_id, 30, "project", db) == 0
        await jobs.finish_failed_job(claimed)
        await jobs.retry_job(user_id, org_id, conversation_id, "project", db)
        claimed_again = await jobs.claim_job(db, conversation_id)
        assert claimed_again is not None
        assert claimed_again["lease_token"] != claimed["lease_token"]
        await jobs.finish_failed_job(claimed)
        assert await db.fetchval("SELECT extraction_status FROM conversations WHERE id=$1", conversation_id) == "running"
        await jobs.finish_failed_job(claimed_again)
        assert await jobs.clear_captures(user_id, org_id, 30, "other", db) == 0
        assert await jobs.clear_captures(user_id, org_id, 30, "project", db) == 1
        assert await db.fetchval("SELECT raw_exchange FROM conversations WHERE id=$1", conversation_id) is None
        with pytest.raises(HTTPException):
            await jobs.retry_job(user_id, org_id, conversation_id, "project", db)
    finally:
        await transaction.rollback()
        await db.close()
