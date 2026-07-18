from uuid import uuid4

import pytest

from api.routes.proxy import resolve_bearer_api_key
from api.services import extraction
from api.services.extraction import limit_add_decisions, parse_reconcile_decisions, parse_update_target


def make_candidates(*memory_ids: object) -> list[dict[str, object]]:
    return [{"id": memory_id, "content": f"memory {index}"} for index, memory_id in enumerate(memory_ids)]


def test_parse_reconcile_decisions_maps_actions() -> None:
    target = uuid4()
    decisions = parse_reconcile_decisions(
        ["ADD", f"UPDATE {target}", f"CONFLICT {target}", "DISCARD"],
        [make_candidates(uuid4()), make_candidates(target), make_candidates(target), make_candidates(uuid4())],
    )

    assert decisions == [("add", None), ("update", target), ("conflict", target), ("discard", None)]


def test_parse_reconcile_decisions_defaults_to_add_on_missing_or_invalid() -> None:
    decisions = parse_reconcile_decisions(
        ["NONSENSE"],
        [make_candidates(uuid4()), make_candidates(uuid4())],
    )

    assert decisions == [("add", None), ("add", None)]


def test_parse_reconcile_decisions_rejects_update_targeting_unknown_memory() -> None:
    decisions = parse_reconcile_decisions(
        [f"UPDATE {uuid4()}"],
        [make_candidates(uuid4())],
    )

    assert decisions == [("add", None)]


def test_parse_reconcile_decisions_rejects_invalid_conflict_target() -> None:
    decisions = parse_reconcile_decisions(
        [f"CONFLICT {uuid4()}", "CONFLICT not-a-uuid"],
        [make_candidates(uuid4()), make_candidates(uuid4())],
    )

    assert decisions == [("add", None), ("add", None)]


def test_limit_add_decisions_counts_conflict_proposals_against_capacity() -> None:
    target = uuid4()

    decisions = limit_add_decisions(
        [("conflict", target), ("add", None), ("update", target)],
        available=1,
    )

    assert decisions == [("conflict", target), ("discard", None), ("update", target)]


def test_parse_update_target_requires_valid_uuid() -> None:
    candidates = make_candidates(uuid4())

    assert parse_update_target("UPDATE not-a-uuid", candidates) is None
    assert parse_update_target("UPDATE", candidates) is None


@pytest.mark.asyncio
async def test_store_extracted_memory_preserves_conflict_as_pending_proposal(monkeypatch) -> None:
    user_id = uuid4()
    org_id = uuid4()
    conversation_id = uuid4()
    existing_memory_id = uuid4()
    proposed_memory_id = uuid4()

    class FakeDb:
        def __init__(self) -> None:
            self.calls: list[tuple[str, tuple[object, ...]]] = []

        async def fetchrow(self, query: str, *args: object) -> dict[str, object]:
            self.calls.append((query, args))
            return {"id": proposed_memory_id}

        async def execute(self, query: str, *args: object) -> str:
            self.calls.append((query, args))
            return "INSERT 0 1"

    async def fail_deduplication(*args: object, **kwargs: object) -> object:
        raise AssertionError("conflict proposals must bypass similarity refinement")

    monkeypatch.setattr(extraction, "store_memory_with_deduplication", fail_deduplication)
    db = FakeDb()

    stored_count, stored_refs = await extraction.store_extracted_memories(
        user_id,
        org_id,
        conversation_id,
        ["User now prefers Flask for this project"],
        db,
        embeddings=[[0.0] * 384],
        decisions=[("conflict", existing_memory_id)],
    )

    assert stored_count == 1
    assert stored_refs == [(proposed_memory_id, "User now prefers Flask for this project")]
    assert "INSERT INTO memories" in db.calls[0][0]
    assert db.calls[0][1][6] == "pending"
    assert "INSERT INTO memory_conflicts" in db.calls[1][0]
    assert db.calls[1][1] == (user_id, org_id, existing_memory_id, proposed_memory_id)


def test_resolve_bearer_api_key_prefers_engram_header() -> None:
    assert resolve_bearer_api_key("ek_header", "Bearer ek_bearer") == "ek_header"
    assert resolve_bearer_api_key(None, "Bearer ek_bearer") == "ek_bearer"
    assert resolve_bearer_api_key(None, "bearer ek_lower") == "ek_lower"
    assert resolve_bearer_api_key(None, None) == ""
    assert resolve_bearer_api_key(None, "Basic abc") == ""
