from pathlib import Path
from uuid import uuid4

import pytest

from api.services import memories


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


@pytest.mark.asyncio
async def test_list_memory_conflicts_filters_open_rows_by_owner() -> None:
    class FakeDb:
        def __init__(self) -> None:
            self.query = ""
            self.args: tuple[object, ...] = ()

        async def fetch(self, query: str, *args: object) -> list[dict[str, object]]:
            self.query = query
            self.args = args
            return []

        async def fetchval(self, query: str, *args: object) -> int:
            assert "COUNT(*)" in query
            assert args == ("user-1", "org-1")
            return 0

    db = FakeDb()

    conflicts, total = await memories.list_memory_conflicts("user-1", "org-1", db, 8, 0)

    assert conflicts == []
    assert total == 0
    assert "memory_conflicts" in db.query
    assert "status = 'open'" in db.query
    assert "user_id = $1" in db.query
    assert "org_id = $2" in db.query
    assert db.args == ("user-1", "org-1", 8, 0)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("resolution", "existing_status", "proposed_status"),
    [
        ("accept_new", "rejected", "approved"),
        ("keep_old", "approved", "rejected"),
        ("keep_both", "approved", "approved"),
    ],
)
async def test_resolve_memory_conflict_applies_exact_statuses(
    resolution: str,
    existing_status: str,
    proposed_status: str,
) -> None:
    conflict_id = uuid4()
    existing_memory_id = uuid4()
    proposed_memory_id = uuid4()

    class FakeDb:
        def __init__(self) -> None:
            self.statuses = {
                existing_memory_id: "approved",
                proposed_memory_id: "pending",
            }
            self.memory_update_args: tuple[object, ...] = ()

        async def fetchrow(self, query: str, *args: object) -> dict[str, object] | None:
            if "FROM memory_conflicts" in query and "FOR UPDATE" in query:
                assert args == ("user-2", "org-2", conflict_id)
                assert "status = 'open'" in query
                return {
                    "id": conflict_id,
                    "existing_memory_id": existing_memory_id,
                    "proposed_memory_id": proposed_memory_id,
                    "status": "open",
                    "resolution": None,
                    "created_at": None,
                    "resolved_at": None,
                }
            if "UPDATE memory_conflicts" in query:
                assert args == ("user-2", "org-2", conflict_id, resolution)
                return {
                    "id": conflict_id,
                    "existing_memory_id": existing_memory_id,
                    "proposed_memory_id": proposed_memory_id,
                    "status": "resolved",
                    "resolution": resolution,
                    "created_at": None,
                    "resolved_at": None,
                }
            if "FROM memories" in query:
                memory_id = args[2]
                return memory_row(memory_id, self.statuses[memory_id])
            raise AssertionError("unexpected query")

        async def execute(self, query: str, *args: object) -> str:
            assert "UPDATE memories" in query
            assert "user_id = $4" in query
            assert "org_id = $5" in query
            self.memory_update_args = args
            self.statuses[existing_memory_id] = str(args[1])
            self.statuses[proposed_memory_id] = str(args[2])
            return "UPDATE 2"

    db = FakeDb()

    conflict = await memories.resolve_memory_conflict(
        "user-2",
        "org-2",
        conflict_id,
        resolution,
        db,
    )

    assert conflict is not None
    assert conflict["resolution"] == resolution
    assert conflict["existing_memory"]["status"] == existing_status
    assert conflict["proposed_memory"]["status"] == proposed_status
    assert db.memory_update_args == (
        existing_memory_id,
        existing_status,
        proposed_status,
        "user-2",
        "org-2",
        [existing_memory_id, proposed_memory_id],
    )


@pytest.mark.asyncio
async def test_resolve_memory_conflict_rejects_missing_or_resolved_rows() -> None:
    class FakeDb:
        async def fetchrow(self, query: str, *args: object) -> None:
            assert "status = 'open'" in query
            return None

        async def execute(self, query: str, *args: object) -> str:
            raise AssertionError("missing conflicts must not update memories")

    result = await memories.resolve_memory_conflict("user-3", "org-3", uuid4(), "keep_old", FakeDb())

    assert result is None


def memory_row(memory_id: object, status: str) -> dict[str, object]:
    return {
        "id": memory_id,
        "content": f"memory {memory_id}",
        "confidence": 1.0,
        "access_count": 0,
        "last_accessed": None,
        "created_at": None,
        "source_conversation_id": None,
        "status": status,
        "category": "general",
        "pinned": False,
        "source": "extraction",
        "last_confirmed": None,
    }
