from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import asyncpg
import httpx
import pytest
import pytest_asyncio
from fastapi import HTTPException

from api.config import settings
from api.services import embedding, logs, memories, oauth, retrieval, revisions


pytestmark = pytest.mark.skipif(not settings.engram_test_database_url, reason="ENGRAM_TEST_DATABASE_URL is not configured")


class TestEmbeddingModel:
    def encode(self, sentences: str | list[str], normalize_embeddings: bool) -> list[float] | list[list[float]]:
        vector = [1.0] + [0.0] * 383
        return vector if isinstance(sentences, str) else [vector for sentence in sentences]


@pytest_asyncio.fixture
async def product_database(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[tuple[asyncpg.Connection, object, object]]:
    monkeypatch.setattr(embedding, "_model", TestEmbeddingModel())
    db = await asyncpg.connect(settings.engram_test_database_url)
    transaction = db.transaction()
    await transaction.start()
    try:
        user_id = await db.fetchval("INSERT INTO users(external_id,api_key_hash) VALUES($1,$2) RETURNING id", f"product-{uuid4()}", str(uuid4()))
        org_id = await db.fetchval("INSERT INTO orgs(name) VALUES($1) RETURNING id", f"product-{uuid4()}")
        await db.execute("INSERT INTO org_memberships(org_id,user_id,role) VALUES($1,$2,'owner')", org_id, user_id)
        yield db, user_id, org_id
    finally:
        await transaction.rollback()
        await db.close()


async def seed_memory(db: asyncpg.Connection, user_id: object, org_id: object, namespace: str, content: str, expired: bool = False) -> object:
    return await db.fetchval(
        "INSERT INTO memories(user_id,org_id,namespace,content,embedding,expires_at) VALUES($1,$2,$3,$4,$5::vector,$6) RETURNING id",
        user_id, org_id, namespace, content, embedding.format_embedding_for_pgvector([1.0] + [0.0] * 383),
        datetime.now(UTC) - timedelta(days=1) if expired else None,
    )


@pytest.mark.asyncio
async def test_postgres_project_retrieval_expiry_and_personal_opt_in(product_database) -> None:
    db, user_id, org_id = product_database
    project = await seed_memory(db, user_id, org_id, "project", "Project preference")
    personal = await seed_memory(db, user_id, org_id, "personal", "Personal preference")
    await seed_memory(db, user_id, org_id, "other", "Other project")
    await seed_memory(db, user_id, org_id, "project", "Expired preference", expired=True)
    found = await retrieval.retrieve_memories(user_id, org_id, "preference", db, threshold=0, namespace="project")
    assert {memory["id"] for memory in found} == {project}
    found = await retrieval.retrieve_memories(user_id, org_id, "preference", db, threshold=0, namespace="project", include_personal=True)
    assert {memory["id"] for memory in found} == {project, personal}
    assert await memories.get_memory(user_id, org_id, project, db, namespace="other") is None


@pytest.mark.asyncio
async def test_postgres_revision_history_restore_and_conflicts(product_database) -> None:
    db, user_id, org_id = product_database
    memory_id = await seed_memory(db, user_id, org_id, "project", "User prefers Flask")
    proposed = await revisions.propose_revision(user_id, org_id, memory_id, "User prefers FastAPI", uuid4(), db, "project")
    assert (await memories.get_memory(user_id, org_id, memory_id, db))["content"] == "User prefers Flask"
    accepted = await revisions.decide_revision(user_id, org_id, proposed["id"], True, db, "project")
    assert accepted["status"] == "accepted"
    versions = await revisions.memory_history(user_id, org_id, memory_id, db, "project")
    assert versions[0]["content"] == "User prefers Flask"
    restored = await revisions.restore_memory(user_id, org_id, memory_id, versions[0]["id"], db, "project")
    assert restored["content"] == "User prefers Flask"
    stale = await revisions.propose_revision(user_id, org_id, memory_id, "User prefers Django", uuid4(), db, "project")
    await memories.update_memory(user_id, org_id, memory_id, "User prefers Litestar", db, namespace="project")
    with pytest.raises(HTTPException) as conflict:
        await revisions.decide_revision(user_id, org_id, stale["id"], True, db, "project")
    assert conflict.value.status_code == 409
    with pytest.raises(HTTPException) as wrong_project:
        await revisions.decide_revision(user_id, org_id, stale["id"], False, db, "other")
    assert wrong_project.value.status_code == 404
    await memories.update_memory(user_id, org_id, memory_id, None, db, namespace="project", target_namespace="other")
    assert await revisions.list_revisions(user_id, org_id, db, "project") == []


@pytest.mark.asyncio
async def test_postgres_trace_snapshots_survive_edits_and_redact_forget(product_database) -> None:
    db, user_id, org_id = product_database
    memory_id = await seed_memory(db, user_id, org_id, "project", "Original fact")
    conversation_id = str(uuid4())
    await retrieval.log_retrieval(user_id, org_id, conversation_id, "fact", [{"id": memory_id, "content": "Original fact", "score": 0.9}], db, namespace="project", injected_count=1)
    await memories.update_memory(user_id, org_id, memory_id, "Edited fact", db, namespace="project")
    entries, count = await logs.list_retrieval_logs(user_id, org_id, db, 20, 0, conversation_id, "project")
    assert count == 1
    assert entries[0]["retrieved_memories"][0]["content"] == "Original fact"
    assert entries[0]["injected_count"] == 1
    await memories.update_memory(user_id, org_id, memory_id, None, db, namespace="project", target_namespace="other")
    entries, _ = await logs.list_retrieval_logs(user_id, org_id, db, 20, 0, conversation_id, "project")
    assert entries[0]["retrieved_memories"][0]["content"] is None
    assert await memories.delete_memory(user_id, org_id, memory_id, db, "other")
    entries, _ = await logs.list_retrieval_logs(user_id, org_id, db, 20, 0, conversation_id, "project")
    assert entries[0]["retrieved_memories"][0]["content"] is None


@pytest.mark.asyncio
async def test_postgres_oauth_cannot_read_or_write_other_projects(product_database, monkeypatch: pytest.MonkeyPatch) -> None:
    from contextlib import asynccontextmanager

    from api import dependencies
    from api.main import app
    from api.test_oauth_postgres import create_authorization

    db, unused_user, unused_org = product_database
    user, form = await create_authorization(db)
    tokens = await oauth.exchange_token(form, db)
    authenticated = await oauth.get_user_by_access_token(tokens["access_token"], db)
    namespace = authenticated["oauth_namespace"]
    own_memory = await seed_memory(db, user["id"], user["org_id"], namespace, "Own project")
    other_memory = await seed_memory(db, user["id"], user["org_id"], "other-project", "Other project")
    personal_memory = await seed_memory(db, user["id"], user["org_id"], "personal", "Private personal fact")
    await retrieval.log_retrieval(user["id"], user["org_id"], str(uuid4()), "fact", [
        {"id": own_memory, "content": "Own project", "score": 0.9, "namespace": namespace},
        {"id": personal_memory, "content": "Private personal fact", "score": 0.8, "namespace": "personal"},
    ], db, namespace=namespace, injected_count=2)

    class SharedPool:
        @asynccontextmanager
        async def acquire(self):
            yield db

    monkeypatch.setattr(dependencies, "get_pool", SharedPool)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", headers=headers) as client:
        assert (await client.get(f"/memories/{own_memory}")).status_code == 200
        assert (await client.get(f"/memories/{other_memory}")).status_code == 404
        assert (await client.get("/memories?namespace=other-project")).status_code == 403
        assert (await client.patch(f"/memories/{own_memory}", json={"namespace": "other-project"})).status_code == 403
        assert (await client.get("/users/me/api-keys")).status_code == 403
        assert (await client.post("/memories/search", json={"query": "fact", "include_personal": True})).status_code == 403
        response = await client.get("/logs")
        assert response.status_code == 200
        assert "Private personal fact" not in response.text
        assert "Own project" in response.text
        log_id = response.json()["logs"][0]["id"]
        assert "Private personal fact" not in (await client.get(f"/logs/{log_id}")).text
        await db.execute("UPDATE retrieval_logs SET memory_snapshots=NULL WHERE id=$1", UUID(log_id))
        assert "Private personal fact" not in (await client.get("/logs")).text
        conversation_id = uuid4()
        await db.execute(
            "INSERT INTO conversations(id,user_id,org_id,namespace,raw_exchange) VALUES($1,$2,$3,$4,$5::jsonb)",
            conversation_id, user["id"], user["org_id"], namespace,
            '{"request":{"engram_include_personal":true},"response":"Private personal fact"}',
        )
        await db.execute("UPDATE memories SET source_conversation_id=$1 WHERE id=$2", conversation_id, own_memory)
        source = await client.get(f"/memories/{own_memory}/source")
        assert source.status_code == 200
        assert source.json()["conversation"]["raw_exchange"] is None
        assert "Private personal fact" not in source.text
