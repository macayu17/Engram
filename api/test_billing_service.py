from contextlib import asynccontextmanager
from datetime import UTC, datetime

import pytest

from api.services import billing


class BillingDb:
    def __init__(self, rows: list[dict[str, object] | None] | None = None) -> None:
        self.rows = iter(rows or [])
        self.executions: list[tuple[str, tuple[object, ...]]] = []
        self.insert_result = "INSERT 0 1"

    async def fetchrow(self, query: str, *args: object) -> dict[str, object] | None:
        return next(self.rows, None)

    async def execute(self, query: str, *args: object) -> str:
        self.executions.append((query, args))
        return self.insert_result

    @asynccontextmanager
    async def transaction(self):
        yield


@pytest.mark.asyncio
async def test_checkout_requires_owner(monkeypatch: pytest.MonkeyPatch) -> None:
    db = BillingDb([{"role": "member", "stripe_customer_id": None}])

    with pytest.raises(PermissionError):
        await billing.create_checkout_url("org-1", "user-1", db)


@pytest.mark.asyncio
async def test_checkout_sets_workspace_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    db = BillingDb(
        [
            {
                "role": "owner",
                "plan": "free",
                "stripe_customer_id": "cus_1",
                "stripe_subscription_id": None,
            }
        ]
    )

    def fake_checkout(**kwargs: object) -> dict[str, object]:
        captured.update(kwargs)
        return {"url": "https://checkout.stripe.test/session"}

    monkeypatch.setattr(billing.settings, "stripe_secret_key", "sk_test")
    monkeypatch.setattr(billing.settings, "stripe_pro_price_id", "price_pro")
    monkeypatch.setattr(billing.stripe.checkout.Session, "create", fake_checkout)

    url = await billing.create_checkout_url("org-1", "user-1", db)

    assert url == "https://checkout.stripe.test/session"
    assert captured["customer"] == "cus_1"
    assert captured["subscription_data"] == {"metadata": {"org_id": "org-1"}}


@pytest.mark.asyncio
async def test_checkout_rejects_existing_pro_subscription(monkeypatch: pytest.MonkeyPatch) -> None:
    db = BillingDb(
        [
            {
                "role": "owner",
                "plan": "pro",
                "stripe_customer_id": "cus_1",
                "stripe_subscription_id": "sub_1",
            }
        ]
    )

    with pytest.raises(billing.BillingConflict, match="already has a Pro subscription"):
        await billing.create_checkout_url("org-1", "user-1", db)


@pytest.mark.asyncio
async def test_webhook_rejects_invalid_signature(monkeypatch: pytest.MonkeyPatch) -> None:
    def reject(*args: object, **kwargs: object) -> object:
        raise ValueError("invalid signature")

    monkeypatch.setattr(billing.settings, "stripe_webhook_secret", "whsec_test")
    monkeypatch.setattr(billing.stripe.Webhook, "construct_event", reject)

    with pytest.raises(ValueError, match="Invalid Stripe signature"):
        await billing.process_stripe_event(b"{}", "bad", BillingDb())


@pytest.mark.asyncio
async def test_duplicate_webhook_event_is_ignored(monkeypatch: pytest.MonkeyPatch) -> None:
    db = BillingDb()
    db.insert_result = "INSERT 0 0"
    event = {"id": "evt_1", "type": "customer.subscription.deleted", "data": {"object": {}}}
    monkeypatch.setattr(billing.settings, "stripe_webhook_secret", "whsec_test")
    monkeypatch.setattr(billing.stripe.Webhook, "construct_event", lambda *args: event)

    await billing.process_stripe_event(b"{}", "sig", db)

    assert len(db.executions) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("cancel_at_period_end", [False, True])
async def test_active_subscription_keeps_pro_plan(
    monkeypatch: pytest.MonkeyPatch,
    cancel_at_period_end: bool,
) -> None:
    period_end = int(datetime(2026, 8, 1, tzinfo=UTC).timestamp())
    event = {
        "id": "evt_active",
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_1",
                "customer": "cus_1",
                "status": "active",
                "cancel_at_period_end": cancel_at_period_end,
                "current_period_end": period_end,
                "metadata": {"org_id": "org-1"},
            }
        },
    }
    db = BillingDb()
    monkeypatch.setattr(billing.settings, "stripe_webhook_secret", "whsec_test")
    monkeypatch.setattr(billing.stripe.Webhook, "construct_event", lambda *args: event)

    await billing.process_stripe_event(b"{}", "sig", db)

    update_query, update_args = db.executions[-1]
    assert "plan = $1" in update_query
    assert update_args[0] == "pro"
    assert update_args[1] == "active"


@pytest.mark.asyncio
async def test_deleted_subscription_downgrades_workspace(monkeypatch: pytest.MonkeyPatch) -> None:
    event = {
        "id": "evt_deleted",
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "id": "sub_1",
                "customer": "cus_1",
                "status": "canceled",
                "current_period_end": 1785542400,
                "metadata": {"org_id": "org-1"},
            }
        },
    }
    db = BillingDb()
    monkeypatch.setattr(billing.settings, "stripe_webhook_secret", "whsec_test")
    monkeypatch.setattr(billing.stripe.Webhook, "construct_event", lambda *args: event)

    await billing.process_stripe_event(b"{}", "sig", db)

    update_query, update_args = db.executions[-1]
    assert "stripe_subscription_id = NULL" in update_query
    assert update_args[0] == "free"
    assert update_args[1] == "canceled"
