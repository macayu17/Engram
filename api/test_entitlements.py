import pytest

from api.services.entitlements import QuotaExceeded, enforce_limit, remaining_capacity, workspace_limits


def test_workspace_limits_default_to_free_tier_protection() -> None:
    assert workspace_limits() == {"members": 5, "memories": 2_000, "retrievals": 10_000}


def test_limit_allows_last_available_unit() -> None:
    enforce_limit("memories", current=1_999, limit=2_000)


def test_limit_rejects_next_unit() -> None:
    with pytest.raises(QuotaExceeded) as raised:
        enforce_limit("memories", current=2_000, limit=2_000)

    assert raised.value.resource == "memories"
    assert raised.value.current == 2_000
    assert raised.value.limit == 2_000


def test_remaining_capacity_never_goes_negative() -> None:
    usage = {"memories": 2_001, "limits": {"memories": 2_000}}

    assert remaining_capacity(usage, "memories") == 0
