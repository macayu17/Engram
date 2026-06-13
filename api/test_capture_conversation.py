from uuid import UUID, uuid4

import pytest

from api.services import extraction


@pytest.mark.asyncio
async def test_capture_conversation_extracts_stores_and_records(monkeypatch) -> None:
    captured: dict[str, object] = {}
    user_id = uuid4()

    async def fake_extract_memories(conversation: str) -> list[str]:
        captured["conversation"] = conversation
        return ["User prefers automatic Engram memory capture"]

    async def fake_store_extracted_memories(user_id_arg, conversation_id_arg, memories, db, dedup_threshold=None):
        captured["user_id"] = user_id_arg
        captured["conversation_id"] = conversation_id_arg
        captured["memories"] = memories
        captured["db"] = db
        captured["dedup_threshold"] = dedup_threshold
        return 1

    async def fake_record_conversation(user_id_arg, conversation_id_arg, request_body, response_body, status, memories_extracted, db):
        captured["recorded"] = {
            "user_id": user_id_arg,
            "conversation_id": conversation_id_arg,
            "request_body": request_body,
            "response_body": response_body,
            "status": status,
            "memories_extracted": memories_extracted,
            "db": db,
        }

    monkeypatch.setattr(extraction, "extract_memories", fake_extract_memories)
    monkeypatch.setattr(extraction, "store_extracted_memories", fake_store_extracted_memories)
    monkeypatch.setattr(extraction, "record_conversation", fake_record_conversation)

    class FakeDb:
        async def fetchrow(self, query, *args):
            return {
                "id": user_id,
                "external_id": "vscode-user",
                "extraction_provider": "openai",
                "openai_api_key_encrypted": None,
                "gemini_api_key_encrypted": None,
                "anthropic_api_key_encrypted": None,
            }

    from api.services.provider_keys import ResolvedProvider
    monkeypatch.setattr(
        extraction,
        "resolve_user_provider",
        lambda user, override_provider=None, override_key=None: ResolvedProvider(
            name="openai", api_key="", base_url="", model="", source="test"
        ),
    )

    result = await extraction.capture_conversation_memories(
        user_id,
        "I want Engram to remember useful facts automatically.",
        "I will capture durable facts after each meaningful exchange.",
        "vscode",
        "session-1",
        FakeDb(),
        0.77,
    )

    assert isinstance(result["conversation_id"], UUID)
    assert result["memories_extracted"] == 1
    assert result["extracted_memories"] == ["User prefers automatic Engram memory capture"]
    assert result["source"] == "vscode"
    assert result["session_id"] == "session-1"
    assert captured["conversation"] == (
        "user: I want Engram to remember useful facts automatically.\n"
        "assistant: I will capture durable facts after each meaningful exchange."
    )
    assert captured["user_id"] == user_id
    assert captured["conversation_id"] == result["conversation_id"]
    assert captured["memories"] == ["User prefers automatic Engram memory capture"]
    assert captured["dedup_threshold"] == 0.77
    recorded = captured["recorded"]
    assert recorded["status"] == "completed"
    assert recorded["memories_extracted"] == 1
    assert recorded["request_body"]["source"] == "vscode"
    assert recorded["request_body"]["session_id"] == "session-1"


@pytest.mark.asyncio
async def test_capture_conversation_records_zero_when_nothing_extracted(monkeypatch) -> None:
    captured: dict[str, object] = {}

    async def fake_extract_memories(conversation: str) -> list[str]:
        return []

    async def fake_store_extracted_memories(user_id_arg, conversation_id_arg, memories, db, dedup_threshold=None):
        raise AssertionError("store should not run when no memories are extracted")

    async def fake_record_conversation(user_id_arg, conversation_id_arg, request_body, response_body, status, memories_extracted, db):
        captured["status"] = status
        captured["memories_extracted"] = memories_extracted

    monkeypatch.setattr(extraction, "extract_memories", fake_extract_memories)
    monkeypatch.setattr(extraction, "store_extracted_memories", fake_store_extracted_memories)
    monkeypatch.setattr(extraction, "record_conversation", fake_record_conversation)

    class FakeDb:
        async def fetchrow(self, query, *args):
            return {
                "id": args[0] if args else None,
                "external_id": "claude-user",
                "extraction_provider": "openai",
                "openai_api_key_encrypted": None,
                "gemini_api_key_encrypted": None,
                "anthropic_api_key_encrypted": None,
            }

    from api.services.provider_keys import ResolvedProvider
    monkeypatch.setattr(
        extraction,
        "resolve_user_provider",
        lambda user, override_provider=None, override_key=None: ResolvedProvider(
            name="openai", api_key="", base_url="", model="", source="test"
        ),
    )

    result = await extraction.capture_conversation_memories(
        uuid4(),
        "Hello",
        "Hi",
        "claude_desktop",
        None,
        FakeDb(),
        None,
    )

    assert result["memories_extracted"] == 0
    assert result["extracted_memories"] == []
    assert captured["status"] == "completed"
    assert captured["memories_extracted"] == 0
