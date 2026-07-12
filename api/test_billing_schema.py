from pathlib import Path


def test_workspace_billing_columns_and_event_table_exist() -> None:
    schema = (Path(__file__).resolve().parent / "db" / "schema.sql").read_text(encoding="utf-8")

    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS plan TEXT" in schema
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT" in schema
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT" in schema
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS subscription_status TEXT" in schema
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ" in schema
    assert "CREATE TABLE IF NOT EXISTS stripe_events" in schema
    assert "event_id TEXT PRIMARY KEY" in schema
