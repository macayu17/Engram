import inspect

import pytest

from api.services import deduplication, extraction, graph, logs, memories, proxy, retrieval


SCOPED_FUNCTIONS = [
    memories.create_memory,
    memories.list_memories,
    memories.get_memory,
    memories.update_memory,
    memories.delete_memory,
    memories.delete_all_memories,
    memories.search_memories,
    memories.export_memories,
    memories.import_memories,
    memories.get_memory_source,
    memories.list_merge_suggestions,
    memories.merge_memories,
    memories.apply_confidence_decay,
    memories.timeline,
    retrieval.retrieve_memories,
    retrieval.retrieve_memories_fulltext,
    retrieval.retrieve_memories_hybrid,
    retrieval.retrieve_memories_graph,
    retrieval.log_retrieval,
    logs.list_retrieval_logs,
    logs.get_retrieval_log,
    logs.list_clients,
    deduplication.store_memory_with_deduplication,
    extraction.run_extraction_task,
    extraction.store_extracted_memories,
    extraction.reconcile_memories,
    extraction.load_reconciliation_candidates,
    extraction.apply_memory_update,
    extraction.capture_conversation_memories,
    extraction.record_conversation,
    extraction.mark_conversation_failed,
    graph.extract_entities_for_memory,
    graph.list_entity_edges,
    graph.list_user_entities,
    graph.list_memories_for_entity,
    graph.get_memory_neighbors,
    graph.get_memory_entities,
    graph.backfill_entities_for_user,
    proxy.prepare_proxy_request,
]


@pytest.mark.parametrize("service_function", SCOPED_FUNCTIONS, ids=lambda function: function.__name__)
def test_workspace_scoped_service_accepts_org_after_user(service_function) -> None:
    parameters = list(inspect.signature(service_function).parameters)

    assert parameters[:2] == ["user_id", "org_id"]


@pytest.mark.parametrize("module", [deduplication, extraction, graph, logs, memories, retrieval])
def test_workspace_scoped_sql_mentions_org_id(module) -> None:
    source = inspect.getsource(module)

    assert "org_id" in source
