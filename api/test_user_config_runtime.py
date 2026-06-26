from uuid import uuid4

import pytest

from api.services import extraction, proxy
from api.services.proxy import ProviderResponse
from api.services.users import regenerate_user_key, update_user_provider_config


@pytest.mark.asyncio
async def test_proxy_uses_user_retrieval_config(monkeypatch) -> None:
    captured: dict[str, object] = {}

    async def fake_retrieve_memories(user_id, query, db, limit=None, threshold=None, namespace="default"):
        captured["user_id"] = user_id
        captured["query"] = query
        captured["limit"] = limit
        captured["threshold"] = threshold
        captured["namespace"] = namespace
        return []

    async def fake_log_retrieval(user_id, conversation_id, query, memories, db):
        captured["logged"] = True

    async def fake_forward_to_provider(body, resolved, incoming_headers):
        return ProviderResponse(b"{}", 200, "application/json")

    def fake_resolve_user_provider(user, override_provider=None, override_key=None):
        from api.services.provider_keys import ResolvedProvider
        return ResolvedProvider(
            name="openai",
            api_key="server-test-key",
            base_url="https://api.openai.com/v1",
            model="gpt-4o-mini",
            source="server",
        )

    class FakeDb:
        async def fetchrow(self, query, *args):
            return {
                "id": args[0],
                "external_id": "external-user",
                "extraction_provider": "openai",
                "openai_api_key_encrypted": None,
                "gemini_api_key_encrypted": None,
                "anthropic_api_key_encrypted": None,
            }

    monkeypatch.setattr(proxy, "retrieve_memories", fake_retrieve_memories)
    monkeypatch.setattr(proxy, "log_retrieval", fake_log_retrieval)
    monkeypatch.setattr(proxy, "forward_to_provider", fake_forward_to_provider)
    monkeypatch.setattr(proxy, "resolve_user_provider", fake_resolve_user_provider)

    user_id = uuid4()
    await proxy.build_proxy_result(
        user_id,
        "external-user",
        "external-user",
        {"messages": [{"role": "user", "content": "What stack should I use?"}]},
        "openai",
        False,
        {},
        FakeDb(),
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

    async def fake_store_memory_with_deduplication(
        user_id,
        content,
        embedding,
        conversation_id,
        confidence,
        db,
        dedup_threshold=None,
        status="approved",
        category="general",
        source="manual",
        namespace="default",
    ):
        captured["dedup_threshold"] = dedup_threshold
        captured["status"] = status
        captured["category"] = category
        captured["source"] = source
        captured["namespace"] = namespace
        from uuid import uuid4 as _uuid4
        return {"action": "inserted", "memory": {"id": _uuid4()}}

    def fake_embed_batch(texts):
        captured["texts"] = texts
        return [[0.0] * 384 for _ in texts]

    monkeypatch.setattr(extraction, "store_memory_with_deduplication", fake_store_memory_with_deduplication)
    monkeypatch.setattr("api.services.embedding.embed_batch", fake_embed_batch)

    stored_count, _stored_refs = await extraction.store_extracted_memories(
        uuid4(),
        uuid4(),
        ["User prefers FastAPI"],
        object(),
        0.61,
    )

    assert stored_count == 1
    assert captured["texts"] == ["User prefers FastAPI"]
    assert captured["dedup_threshold"] == 0.61
    assert captured["status"] == "pending"
    assert captured["category"] == "preferences"
    assert captured["source"] == "extraction"


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
                "extraction_provider": "openai",
                "openai_api_key_encrypted": None,
                "gemini_api_key_encrypted": None,
                "anthropic_api_key_encrypted": None,
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


@pytest.mark.asyncio
async def test_update_user_provider_config_persists_extraction_model() -> None:
    class FakeDb:
        def __init__(self) -> None:
            self.query = ""
            self.args: tuple[object, ...] = ()

        async def fetchrow(self, query, *args):
            self.query = query
            self.args = args
            return {
                "id": args[0],
                "external_id": "external-user",
                "created_at": None,
                "max_memories_injected": 5,
                "retrieval_threshold": 0.5,
                "dedup_threshold": 0.95,
                "extraction_provider": args[1],
                "extraction_model": args[2],
                "openai_api_key_encrypted": None,
                "gemini_api_key_encrypted": None,
                "anthropic_api_key_encrypted": None,
            }

    db = FakeDb()
    user_id = uuid4()

    response = await update_user_provider_config(
        user_id,
        "gemini",
        "gemini-1.5-flash",
        None,
        None,
        None,
        False,
        False,
        False,
        db,
    )

    assert "extraction_model" in db.query
    assert db.args == (user_id, "gemini", "gemini-1.5-flash")
    assert response["extraction_provider"] == "gemini"
    assert response["extraction_model"] == "gemini-1.5-flash"


@pytest.mark.asyncio
async def test_update_user_provider_config_rejects_blank_extraction_model() -> None:
    class FakeDb:
        async def fetchrow(self, query, *args):
            raise AssertionError("database should not be called for invalid model")

    with pytest.raises(ValueError, match="Extraction model is required"):
        await update_user_provider_config(
            uuid4(),
            "openai",
            "   ",
            None,
            None,
            None,
            False,
            False,
            False,
            FakeDb(),
        )
