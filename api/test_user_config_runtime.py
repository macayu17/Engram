from uuid import uuid4

import pytest

from api.services import extraction, proxy
from api.services.proxy import ProviderResponse
from api.services.users import regenerate_user_key


@pytest.mark.asyncio
async def test_proxy_uses_user_retrieval_config(monkeypatch) -> None:
    captured: dict[str, object] = {}

    async def fake_retrieve_memories(user_id, query, db, limit=None, threshold=None):
        captured["user_id"] = user_id
        captured["query"] = query
        captured["limit"] = limit
        captured["threshold"] = threshold
        return []

    async def fake_log_retrieval(user_id, conversation_id, query, memories, db):
        captured["logged"] = True

    async def fake_forward_to_provider(body, provider, incoming_headers):
        return ProviderResponse(b"{}", 200, "application/json")

    monkeypatch.setattr(proxy, "retrieve_memories", fake_retrieve_memories)
    monkeypatch.setattr(proxy, "log_retrieval", fake_log_retrieval)
    monkeypatch.setattr(proxy, "forward_to_provider", fake_forward_to_provider)

    user_id = uuid4()
    await proxy.build_proxy_result(
        user_id,
        "external-user",
        "external-user",
        {"messages": [{"role": "user", "content": "What stack should I use?"}]},
        "openai",
        False,
        {},
        object(),
        2,
        0.72,
    )

    assert captured["user_id"] == user_id
    assert captured["query"] == "What stack should I use?"
    assert captured["limit"] == 2
    assert captured["threshold"] == 0.72


@pytest.mark.asyncio
async def test_extracted_memory_storage_uses_user_dedup_threshold(monkeypatch) -> None:
    captured: dict[str, object] = {}

    async def fake_store_memory_with_deduplication(user_id, content, embedding, conversation_id, confidence, db, dedup_threshold=None):
        captured["dedup_threshold"] = dedup_threshold
        return {"action": "inserted", "memory": {"id": "memory-1"}}

    def fake_embed_batch(texts):
        captured["texts"] = texts
        return [[0.0] * 384 for _ in texts]

    monkeypatch.setattr(extraction, "store_memory_with_deduplication", fake_store_memory_with_deduplication)
    monkeypatch.setattr("api.services.embedding.embed_batch", fake_embed_batch)

    stored_count = await extraction.store_extracted_memories(
        uuid4(),
        uuid4(),
        ["User prefers FastAPI"],
        object(),
        0.61,
    )

    assert stored_count == 1
    assert captured["texts"] == ["User prefers FastAPI"]
    assert captured["dedup_threshold"] == 0.61


@pytest.mark.asyncio
async def test_regenerate_user_key_removes_all_old_issued_keys() -> None:
    class FakeTransaction:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

    class FakeDb:
        def __init__(self) -> None:
            self.deleted_user_id = None
            self.deleted_with_hash_filter = False
            self.inserted_key_name = ""

        def transaction(self) -> FakeTransaction:
            return FakeTransaction()

        async def fetchrow(self, query, *args):
            return {
                "id": args[0],
                "external_id": "external-user",
                "created_at": None,
                "max_memories_injected": 5,
                "retrieval_threshold": 0.5,
                "dedup_threshold": 0.95,
            }

        async def execute(self, query, *args):
            if "DELETE FROM user_api_keys" in query:
                self.deleted_user_id = args[0]
                self.deleted_with_hash_filter = "api_key_hash" in query
            if "INSERT INTO user_api_keys" in query:
                self.inserted_key_name = args[2]
            return "DELETE 2"

    user = {"id": uuid4(), "api_key_hash": "old-secondary-key-hash"}
    db = FakeDb()

    await regenerate_user_key(user, db)

    assert db.deleted_user_id == user["id"]
    assert db.deleted_with_hash_filter is False
    assert db.inserted_key_name == "default"
