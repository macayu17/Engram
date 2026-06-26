from pathlib import Path


def test_schema_enables_rls_with_server_policy_and_revokes_public_api_roles() -> None:
    schema = (Path(__file__).resolve().parent / "db" / "schema.sql").read_text(encoding="utf-8")

    assert schema.count("ENABLE ROW LEVEL SECURITY") >= 5
    assert "CREATE POLICY engram_server_access" in schema
    assert "REVOKE ALL ON TABLE public.%I FROM %I" in schema
