from uuid import uuid4

import pytest
from fastapi import HTTPException

from api.models.billing import BillingWorkspaceRequest
from api.routes import billing


@pytest.mark.asyncio
async def test_checkout_route_resolves_server_supplied_identity(monkeypatch: pytest.MonkeyPatch) -> None:
    org_id = uuid4()
    captured: dict[str, object] = {}

    async def resolve(external_id: str, requested_org_id: object, db: object) -> object:
        captured["external_id"] = external_id
        captured["org_id"] = requested_org_id
        return "user-1"

    async def checkout(org_id_arg: object, user_id: object, db: object) -> str:
        return "https://checkout.stripe.test/session"

    monkeypatch.setattr(billing, "resolve_billing_user", resolve)
    monkeypatch.setattr(billing, "create_checkout_url", checkout)

    result = await billing.checkout_route(
        BillingWorkspaceRequest(external_id="clerk:user-1", org_id=org_id),
        None,
        object(),
    )

    assert str(result["url"]) == "https://checkout.stripe.test/session"
    assert captured == {"external_id": "clerk:user-1", "org_id": org_id}


@pytest.mark.asyncio
async def test_checkout_route_rejects_unknown_workspace(monkeypatch: pytest.MonkeyPatch) -> None:
    async def resolve(*args: object, **kwargs: object) -> None:
        return None

    monkeypatch.setattr(billing, "resolve_billing_user", resolve)

    with pytest.raises(HTTPException) as raised:
        await billing.checkout_route(
            BillingWorkspaceRequest(external_id="clerk:user-1", org_id=uuid4()),
            None,
            object(),
        )

    assert raised.value.status_code == 404
