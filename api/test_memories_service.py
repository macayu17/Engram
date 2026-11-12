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

    result = await memories.delete_all_memories(user_id, 'org-1', db)

    assert result == 7
    assert len(db.calls) == 1
    query, params = db.calls[0]
    assert 'DELETE FROM memories' in query
    assert 'user_id = $1' in query
    assert params == ('user-1', 'org-1')


@pytest.mark.asyncio
async def test_delete_all_memories_handles_zero_rows() -> None:
    class FakeDb:
        async def execute(self, query, *args):
            return 'DELETE 0'

    result = await memories.delete_all_memories('user-2', 'org-2', FakeDb())

    assert result == 0


def test_category_helpers_keep_values_small_and_predictable() -> None:
    assert memories.normalize_category(None) == 'general'
    assert memories.normalize_category('Current Projects') == 'current_projects'
    assert memories.infer_category('I prefer FastAPI for APIs') == 'preferences'
    assert memories.infer_category('I am working on an Engram repo') == 'projects'


@pytest.mark.asyncio
async def test_search_listing_total_counts_all_filtered_matches(monkeypatch) -> None:
    class FakeDb:
        def __init__(self) -> None:
            self.updated_ids = []

        async def fetch(self, query, *args):
            assert 'LIMIT' not in query
            assert args[0] == 'user-5'
            assert args[1] == 'org-5'
            return [
                memory_row('1', 'First memory', 0.91),
                memory_row('2', 'Second memory', 0.84),
                memory_row('3', 'Third memory', 0.76),
            ]

        async def execute(self, query, *args):
            self.updated_ids = args[2]
            return 'UPDATE 1'

    monkeypatch.setattr(memories, 'embed', lambda text: [0.0] * 384)

    db = FakeDb()
    page, total = await memories.list_memories('user-5', 'org-5', db, 1, 1, 'memory', 'created_at', 'desc', 'approved', None)

    assert total == 3
    assert [row['id'] for row in page] == ['2']
    assert db.updated_ids == ['2']


def memory_row(memory_id, content, score_or_confidence, access_count=0, pinned=False):
    return {
        'id': memory_id,
        'content': content,
        'confidence': score_or_confidence,
        'access_count': access_count,
        'last_accessed': None,
        'created_at': 1,
        'source_conversation_id': None,
        'status': 'approved',
        'category': 'general',
        'pinned': pinned,
        'source': 'manual',
        'last_confirmed': None,
        'score': score_or_confidence,
    }
