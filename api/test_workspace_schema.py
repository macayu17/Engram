from pathlib import Path


SCHEMA_PATH = Path(__file__).resolve().parent / "db" / "schema.sql"


def test_workspace_columns_and_indexes_exist() -> None:
    schema = SCHEMA_PATH.read_text(encoding="utf-8")

    assert "ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS org_id UUID" in schema
    assert "ALTER TABLE retrieval_logs ADD COLUMN IF NOT EXISTS org_id UUID" in schema
    assert "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS org_id UUID" in schema
    assert "ALTER TABLE memory_entities ADD COLUMN IF NOT EXISTS org_id UUID" in schema
    assert "ALTER TABLE memory_relationships ADD COLUMN IF NOT EXISTS org_id UUID" in schema
    assert "user_api_keys_org_id_idx" in schema
    assert "retrieval_logs_org_created_at_idx" in schema
    assert "conversations_org_created_at_idx" in schema
    assert "memory_entities_org_idx" in schema
    assert "memory_relationships_org_idx" in schema
    assert "memory_entities_org_user_name_type_idx" in schema
    assert schema.count("ALTER COLUMN org_id SET NOT NULL") >= 6


def test_workspace_provider_configuration_exists() -> None:
    schema = SCHEMA_PATH.read_text(encoding="utf-8")

    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS extraction_provider TEXT" in schema
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS extraction_model TEXT" in schema
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS openai_api_key_encrypted BYTEA" in schema
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS gemini_api_key_encrypted BYTEA" in schema
    assert "ALTER TABLE orgs ADD COLUMN IF NOT EXISTS anthropic_api_key_encrypted BYTEA" in schema
    assert "orgs_extraction_provider_check" in schema


def test_legacy_users_receive_personal_workspaces() -> None:
    schema = SCHEMA_PATH.read_text(encoding="utf-8")

    assert "legacy:" in schema
    assert "INSERT INTO org_memberships" in schema
    assert "UPDATE memories" in schema
    assert "UPDATE user_api_keys" in schema
    assert "UPDATE retrieval_logs" in schema
    assert "UPDATE conversations" in schema
    assert "UPDATE memory_entities" in schema
    assert "UPDATE memory_relationships" in schema


def test_workspace_deletion_cascades_and_entity_uniqueness_is_scoped() -> None:
    schema = SCHEMA_PATH.read_text(encoding="utf-8")

    assert "FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE" in schema
    assert "ON memory_entities(org_id, user_id, name, entity_type)" in schema
