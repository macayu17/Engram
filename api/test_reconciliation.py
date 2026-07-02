from uuid import uuid4

from api.routes.proxy import resolve_bearer_api_key
from api.services.extraction import parse_reconcile_decisions, parse_update_target


def make_candidates(*memory_ids: object) -> list[dict[str, object]]:
    return [{"id": memory_id, "content": f"memory {index}"} for index, memory_id in enumerate(memory_ids)]


def test_parse_reconcile_decisions_maps_actions() -> None:
    target = uuid4()
    decisions = parse_reconcile_decisions(
        ["ADD", f"UPDATE {target}", "DISCARD"],
        [make_candidates(uuid4()), make_candidates(target), make_candidates(uuid4())],
    )

    assert decisions == [("add", None), ("update", target), ("discard", None)]


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


def test_parse_update_target_requires_valid_uuid() -> None:
    candidates = make_candidates(uuid4())

    assert parse_update_target("UPDATE not-a-uuid", candidates) is None
    assert parse_update_target("UPDATE", candidates) is None


def test_resolve_bearer_api_key_prefers_engram_header() -> None:
    assert resolve_bearer_api_key("ek_header", "Bearer ek_bearer") == "ek_header"
    assert resolve_bearer_api_key(None, "Bearer ek_bearer") == "ek_bearer"
    assert resolve_bearer_api_key(None, "bearer ek_lower") == "ek_lower"
    assert resolve_bearer_api_key(None, None) == ""
    assert resolve_bearer_api_key(None, "Basic abc") == ""
