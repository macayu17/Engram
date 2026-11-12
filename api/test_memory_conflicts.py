from pathlib import Path


DB_PATH = Path(__file__).parent / "db"


def test_changes_to_memories_use_one_proposal_table_and_one_history_table() -> None:
    schema = (DB_PATH / "schema.sql").read_text(encoding="utf-8")
    product = (DB_PATH / "product.sql").read_text(encoding="utf-8")

    assert "memory_revisions" not in schema
    assert "CREATE TABLE IF NOT EXISTS memory_conflicts" not in schema
    assert "CHECK (kind IN ('update', 'conflict'))" in product
    assert "CHECK (status IN ('pending', 'accepted', 'rejected', 'kept_both'))" in product
    assert "DROP TABLE" not in schema + product
    assert "CREATE TRIGGER engram_memory_version BEFORE UPDATE ON memories" in product
