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
            assert args == ('user-3', 'org-3')
            return 'UPDATE 4'

    assert await memories.apply_confidence_decay('user-3', 'org-3', FakeDb()) == 4


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

    suggestions = await memories.list_merge_suggestions('user-4', 'org-4', FakeDb(), 5)

    assert len(suggestions) == 1
    assert suggestions[0]['primary']['id'] == '1'
    assert suggestions[0]['duplicate']['id'] == '2'


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

    monkeypatch.setattr(memories, 'build_retrieval_texts', lambda query: [query])
    monkeypatch.setattr(memories, 'embed', lambda text: [0.0] * 384)

    db = FakeDb()
    page, total = await memories.list_memories('user-5', 'org-5', db, 1, 1, 'memory', 'created_at', 'desc', 'approved', None)

    assert total == 3
    assert [row['id'] for row in page] == ['2']
    assert db.updated_ids == ['2']


@pytest.mark.asyncio
async def test_merge_memories_is_transactional_and_preserves_duplicate_stats(monkeypatch) -> None:
    class FakeTransaction:
        def __init__(self, db) -> None:
            self.db = db

        async def __aenter__(self):
            self.db.in_transaction = True
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            self.db.in_transaction = False
            return None

    class FakeDb:
        def __init__(self) -> None:
            self.in_transaction = False
            self.deleted = False
            self.update_args = ()

        def transaction(self):
            return FakeTransaction(self)

        async def fetchrow(self, query, *args):
            assert self.in_transaction
            if 'FOR UPDATE' in query and args[2] == 'primary':
                return memory_row('primary', 'Primary', 0.6, access_count=4, pinned=False)
            if 'FOR UPDATE' in query and args[2] == 'duplicate':
                return memory_row('duplicate', 'Duplicate', 0.9, access_count=7, pinned=True)
            if 'UPDATE memories' in query:
                self.update_args = args
                return memory_row('primary', args[0], max(0.6, args[2]), access_count=11, pinned=args[6])
            raise AssertionError('unexpected fetchrow')

        async def execute(self, query, *args):
            assert self.in_transaction
            assert 'DELETE FROM memories' in query
            assert args == ('user-6', 'org-6', 'duplicate')
            self.deleted = True
            return 'DELETE 1'

    monkeypatch.setattr(memories, 'embed', lambda text: [0.0] * 384)

    db = FakeDb()
    merged = await memories.merge_memories('user-6', 'org-6', 'primary', 'duplicate', None, db)

    assert merged is not None
    assert merged['content'] == 'Primary\nDuplicate'
    assert db.update_args[2] == 0.9
    assert db.update_args[3] == 7
    assert db.update_args[6] is True
    assert db.deleted is True


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
