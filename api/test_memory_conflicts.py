from pathlib import Path
from uuid import uuid4

import pytest


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


@pytest.mark.asyncio
async def test_record_memory_revision_is_scoped_to_owner() -> None:
    from api.services.deduplication import record_memory_revision

    class FakeDb:
        def __init__(self) -> None:
            self.query = ""
            self.args: tuple[object, ...] = ()

        async def execute(self, query: str, *args: object) -> str:
            self.query = query
            self.args = args
            return "INSERT 0 1"

    user_id = uuid4()
    org_id = uuid4()
    memory_id = uuid4()
    db = FakeDb()

    await record_memory_revision(user_id, org_id, memory_id, db)

    assert "INSERT INTO memory_revisions" in db.query
    assert "FROM memories" in db.query
    assert "user_id = $1" in db.query
    assert "org_id = $2" in db.query
    assert "id = $3" in db.query
    assert db.args == (user_id, org_id, memory_id)
