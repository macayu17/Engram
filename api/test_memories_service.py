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


def test_category_helpers_keep_values_small_and_predictable() -> None:
    assert memories.normalize_category(None) == 'general'
    assert memories.normalize_category('Current Projects') == 'current_projects'
    assert memories.infer_category('I prefer FastAPI for APIs') == 'preferences'
    assert memories.infer_category('I am working on an Engram repo') == 'projects'


def test_memory_similarity_hint_uses_word_overlap() -> None:
    score = memories.memory_similarity_hint(
        'User prefers FastAPI and TypeScript for Engram',
        'User prefers TypeScript for the Engram dashboard',
    )

    assert 0 < score < 1


@pytest.mark.asyncio
async def test_apply_confidence_decay_returns_updated_count() -> None:
    class FakeDb:
        async def execute(self, query, *args):
            assert 'confidence * 0.92' in query
            assert "status = 'approved'" in query
            assert 'pinned = false' in query
            assert args == ('user-3',)
            return 'UPDATE 4'

    assert await memories.apply_confidence_decay('user-3', FakeDb()) == 4


@pytest.mark.asyncio
async def test_list_merge_suggestions_filters_by_category_and_similarity() -> None:
    class FakeDb:
        async def fetch(self, query, *args):
            return [
                {
                    'id': '1',
                    'content': 'User prefers FastAPI and TypeScript for Engram',
                    'confidence': 1.0,
                    'access_count': 0,
                    'last_accessed': None,
                    'created_at': 3,
                    'source_conversation_id': None,
                    'status': 'approved',
                    'category': 'preferences',
                    'pinned': False,
                    'source': 'manual',
                    'last_confirmed': None,
                },
                {
                    'id': '2',
                    'content': 'User prefers TypeScript and FastAPI for Engram work',
                    'confidence': 1.0,
                    'access_count': 0,
                    'last_accessed': None,
                    'created_at': 2,
                    'source_conversation_id': None,
                    'status': 'approved',
                    'category': 'preferences',
                    'pinned': False,
                    'source': 'manual',
                    'last_confirmed': None,
                },
                {
                    'id': '3',
                    'content': 'User is building a project dashboard',
                    'confidence': 1.0,
                    'access_count': 0,
                    'last_accessed': None,
                    'created_at': 1,
                    'source_conversation_id': None,
                    'status': 'approved',
                    'category': 'projects',
                    'pinned': False,
                    'source': 'manual',
                    'last_confirmed': None,
                },
            ]

    suggestions = await memories.list_merge_suggestions('user-4', FakeDb(), 5)

    assert len(suggestions) == 1
    assert suggestions[0]['primary']['id'] == '1'
    assert suggestions[0]['duplicate']['id'] == '2'
