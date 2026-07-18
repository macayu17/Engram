from pathlib import Path


SCHEMA_PATH = Path(__file__).parent / "db" / "schema.sql"


def test_schema_defines_memory_history_and_conflicts() -> None:
    schema = SCHEMA_PATH.read_text(encoding="utf-8")

    assert "CREATE TABLE IF NOT EXISTS memory_revisions" in schema
    assert "memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE" in schema
    assert "CREATE TABLE IF NOT EXISTS memory_conflicts" in schema
    assert "existing_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE" in schema
    assert "proposed_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE" in schema
    assert "resolution IN ('accept_new', 'keep_old', 'keep_both')" in schema
    assert "ALTER TABLE public.memory_revisions ENABLE ROW LEVEL SECURITY" in schema
    assert "ALTER TABLE public.memory_conflicts ENABLE ROW LEVEL SECURITY" in schema
    assert "'memory_revisions'" in schema
    assert "'memory_conflicts'" in schema
