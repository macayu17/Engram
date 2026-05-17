# Engram Intent And Goals

Engram is a self-hostable AI memory layer for developers building LLM applications. The project goal is to make stateless LLM APIs feel stateful without requiring every application to build its own memory pipeline.

The system has one shared memory backend and three interfaces:

1. Proxy endpoint: accepts chat requests, retrieves relevant memories, injects them into the prompt, forwards the request to an LLM provider, returns the provider response, then extracts new memories asynchronously.
2. REST API: lets developers create, inspect, search, update, and delete memories directly.
3. MCP server: exposes the same memory operations as tool calls for agents.

The core product promise is operational simplicity: a developer should be able to run `docker compose up`, create a user, send two conversations through `/v1/chat`, and see the second call use facts learned from the first.

The technical constraints are part of the product:

- PostgreSQL plus pgvector is the only vector store.
- FastAPI and asyncpg own all backend data access.
- API keys are hashed before storage.
- Retrieval and extraction failures must not break proxy responses.
- Extraction runs after the provider response is returned.
- The dashboard is a developer console for inspection and control, not a consumer UI.
- MCP support is a first-class differentiator, not an add-on.

The v1 boundary is intentionally narrow. Engram does not include OAuth, rate limiting, streaming proxy support, memory decay, team memory, external vector databases, LangChain, LlamaIndex, Redis, or Celery. Those are deferred so v1 can prove the main loop cleanly: retrieve, inject, forward, extract, store, inspect.
