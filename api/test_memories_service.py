import pytest

from api.services import memories


@pytest.mark.asyncio
async def test_delete_all_memories_returns_count() -> None:
    class FakeDb:
        def __init__(self, command_tag: str) -> None:
            self.command_tag = command_tag
            self.calls = []

        async def execute(self, query, *args):
            self.calls.append((query, args))
            return self.command_tag

    db = FakeDb('DELETE 7')
    user_id = 'user-1'

    result = await memories.delete_all_memories(user_id, db)

    assert result == 7
    assert len(db.calls) == 1
    query, params = db.calls[0]
    assert 'DELETE FROM memories' in query
    assert 'user_id = $1' in query
    assert params == ('user-1',)


@pytest.mark.asyncio
async def test_delete_all_memories_handles_zero_rows() -> None:
    class FakeDb:
        async def execute(self, query, *args):
            return 'DELETE 0'

    result = await memories.delete_all_memories('user-2', FakeDb())

    assert result == 0
