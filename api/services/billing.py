import asyncio
from collections.abc import Mapping
from datetime import UTC, datetime

import asyncpg
import stripe

from api.config import settings


class BillingConflict(RuntimeError):
    pass


def object_value(value: object, key: str) -> object | None:
    if isinstance(value, Mapping):
        return value.get(key)
    return getattr(value, key, None)


def require_billing_config(*values: tuple[str, str]) -> None:
    missing = [name for name, value in values if not value]
    if missing:
        raise RuntimeError(f"Missing billing configuration: {', '.join(missing)}")


async def resolve_billing_user(
    external_id: str,
    org_id: object,
    db: asyncpg.Connection,
) -> object | None:
    return await db.fetchval(
        """
        SELECT users.id
        FROM users
        JOIN org_memberships ON org_memberships.user_id = users.id
        WHERE users.external_id = $1
          AND org_memberships.org_id = $2
        """,
        external_id,
        org_id,
    )


async def get_owner_workspace(
    org_id: object,
    user_id: object,
    db: asyncpg.Connection,
) -> dict[str, object]:
    row = await db.fetchrow(
        """
        SELECT org_memberships.role,
               orgs.plan,
               orgs.stripe_customer_id,
               orgs.stripe_subscription_id
        FROM orgs
        JOIN org_memberships ON org_memberships.org_id = orgs.id
        WHERE orgs.id = $1
          AND org_memberships.user_id = $2
        """,
        org_id,
        user_id,
    )
    if row is None:
        raise PermissionError("Workspace not found")
    if row["role"] != "owner":
        raise PermissionError("Only workspace owners can manage billing")
    return dict(row)


async def create_customer(org_id: object, db: asyncpg.Connection) -> str:
    customer = await asyncio.to_thread(
        stripe.Customer.create,
        metadata={"org_id": str(org_id)},
        api_key=settings.stripe_secret_key,
        idempotency_key=f"engram-workspace-{org_id}",
    )
    customer_id = object_value(customer, "id")
    if not isinstance(customer_id, str) or not customer_id:
        raise RuntimeError("Stripe customer creation returned no customer ID")
    await db.execute(
        "UPDATE orgs SET stripe_customer_id = $1 WHERE id = $2",
        customer_id,
        org_id,
    )
    return customer_id


async def create_checkout_url(
    org_id: object,
    user_id: object,
    db: asyncpg.Connection,
) -> str:
    workspace = await get_owner_workspace(org_id, user_id, db)
    if workspace["plan"] == "pro" and workspace["stripe_subscription_id"]:
        raise BillingConflict("Workspace already has a Pro subscription; use the billing portal")
    require_billing_config(
        ("STRIPE_SECRET_KEY", settings.stripe_secret_key),
        ("STRIPE_PRO_PRICE_ID", settings.stripe_pro_price_id),
    )
    customer_id = workspace["stripe_customer_id"]
    if not isinstance(customer_id, str) or not customer_id:
        customer_id = await create_customer(org_id, db)
    session = await asyncio.to_thread(
        stripe.checkout.Session.create,
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": settings.stripe_pro_price_id, "quantity": 1}],
        metadata={"org_id": str(org_id)},
        subscription_data={"metadata": {"org_id": str(org_id)}},
        success_url=f"{settings.dashboard_url.rstrip('/')}?billing=success",
        cancel_url=f"{settings.dashboard_url.rstrip('/')}?billing=canceled",
        api_key=settings.stripe_secret_key,
    )
    url = object_value(session, "url")
    if not isinstance(url, str) or not url:
        raise RuntimeError("Stripe Checkout returned no URL")
    return url


async def create_portal_url(
    org_id: object,
    user_id: object,
    db: asyncpg.Connection,
) -> str:
    workspace = await get_owner_workspace(org_id, user_id, db)
    require_billing_config(("STRIPE_SECRET_KEY", settings.stripe_secret_key))
    customer_id = workspace["stripe_customer_id"]
    if not isinstance(customer_id, str) or not customer_id:
        raise RuntimeError("Workspace has no Stripe customer")
    session = await asyncio.to_thread(
        stripe.billing_portal.Session.create,
        customer=customer_id,
        return_url=settings.dashboard_url.rstrip("/"),
        api_key=settings.stripe_secret_key,
    )
    url = object_value(session, "url")
    if not isinstance(url, str) or not url:
        raise RuntimeError("Stripe Customer Portal returned no URL")
    return url


def timestamp_value(value: object | None) -> datetime | None:
    if isinstance(value, int | float):
        return datetime.fromtimestamp(value, tz=UTC)
    return None


def metadata_org_id(stripe_object: object) -> str | None:
    metadata = object_value(stripe_object, "metadata")
    org_id = object_value(metadata, "org_id")
    return org_id if isinstance(org_id, str) and org_id else None


async def update_subscription(
    stripe_object: object,
    deleted: bool,
    db: asyncpg.Connection,
) -> None:
    subscription_id = object_value(stripe_object, "id")
    customer_id = object_value(stripe_object, "customer")
    status = object_value(stripe_object, "status")
    period_end = timestamp_value(object_value(stripe_object, "current_period_end"))
    org_id = metadata_org_id(stripe_object)
    if deleted:
        await db.execute(
            """
            UPDATE orgs
            SET plan = $1,
                subscription_status = $2,
                current_period_end = $3,
                stripe_subscription_id = NULL
            WHERE ($4::uuid IS NOT NULL AND id = $4::uuid)
               OR ($5::text IS NOT NULL AND stripe_subscription_id = $5)
               OR ($6::text IS NOT NULL AND stripe_customer_id = $6)
            """,
            "free",
            "canceled",
            period_end,
            org_id,
            subscription_id,
            customer_id,
        )
        return
    status_text = status if isinstance(status, str) else "unknown"
    plan = "pro" if status_text in {"active", "trialing"} else "free"
    await db.execute(
        """
        UPDATE orgs
        SET plan = $1,
            subscription_status = $2,
            current_period_end = $3,
            stripe_customer_id = COALESCE($4, stripe_customer_id),
            stripe_subscription_id = COALESCE($5, stripe_subscription_id)
        WHERE ($6::uuid IS NOT NULL AND id = $6::uuid)
           OR ($4::text IS NOT NULL AND stripe_customer_id = $4)
           OR ($5::text IS NOT NULL AND stripe_subscription_id = $5)
        """,
        plan,
        status_text,
        period_end,
        customer_id,
        subscription_id,
        org_id,
    )


async def update_checkout_session(stripe_object: object, db: asyncpg.Connection) -> None:
    org_id = metadata_org_id(stripe_object)
    customer_id = object_value(stripe_object, "customer")
    subscription_id = object_value(stripe_object, "subscription")
    if org_id is None:
        return
    await db.execute(
        """
        UPDATE orgs
        SET stripe_customer_id = COALESCE($1, stripe_customer_id),
            stripe_subscription_id = COALESCE($2, stripe_subscription_id)
        WHERE id = $3::uuid
        """,
        customer_id,
        subscription_id,
        org_id,
    )


async def process_stripe_event(
    payload: bytes,
    signature: str,
    db: asyncpg.Connection,
) -> None:
    require_billing_config(("STRIPE_WEBHOOK_SECRET", settings.stripe_webhook_secret))
    try:
        event = stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError) as error:
        raise ValueError("Invalid Stripe signature") from error
    event_id = object_value(event, "id")
    event_type = object_value(event, "type")
    data = object_value(event, "data")
    stripe_object = object_value(data, "object")
    if not isinstance(event_id, str) or not isinstance(event_type, str) or stripe_object is None:
        raise ValueError("Invalid Stripe event")
    async with db.transaction():
        result = await db.execute(
            "INSERT INTO stripe_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING",
            event_id,
        )
        if result.endswith("0"):
            return
        if event_type == "checkout.session.completed":
            await update_checkout_session(stripe_object, db)
        elif event_type in {"customer.subscription.created", "customer.subscription.updated"}:
            await update_subscription(stripe_object, False, db)
        elif event_type == "customer.subscription.deleted":
            await update_subscription(stripe_object, True, db)
