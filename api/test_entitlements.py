import pytest

from api.services.entitlements import PLAN_LIMITS, QuotaExceeded, enforce_limit


def test_plan_limits_match_launch_contract() -> None:
    assert PLAN_LIMITS["free"].members == 1
    assert PLAN_LIMITS["free"].memories == 2_000
    assert PLAN_LIMITS["free"].retrievals == 10_000
    assert PLAN_LIMITS["pro"].members == 5
    assert PLAN_LIMITS["pro"].memories == 50_000
    assert PLAN_LIMITS["pro"].retrievals == 250_000


def test_limit_allows_last_available_unit() -> None:
    enforce_limit("memories", current=1_999, limit=2_000)


def test_limit_rejects_next_unit() -> None:
    with pytest.raises(QuotaExceeded) as raised:
        enforce_limit("memories", current=2_000, limit=2_000)

    assert raised.value.resource == "memories"
    assert raised.value.current == 2_000
    assert raised.value.limit == 2_000
