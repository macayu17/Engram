# Engram Intent And Goals

Engram is a self-hostable AI memory layer for developers building LLM applications. The project goal is to make stateless LLM APIs feel stateful without requiring every application to build its own memory pipeline.

The system has one shared memory backend and three interfaces:

1. Proxy endpoint: accepts chat requests, retrieves relevant memories, injects them into the prompt, forwards the request to an LLM provider, returns the provider response, then extracts new memories asynchronously.
2. REST API: lets developers create, inspect, search, update, and delete memories directly.
3. MCP server: exposes the same memory operations as tool calls for agents.

The core product promise is an inspectable memory loop: a developer can run `docker compose up`, create a user, send a conversation through `/v1/chat`, review newly extracted facts, and see a later call use approved memories. New extracted memories are pending by default; manually added memories are approved by default. Extraction proposes revisions to existing memories. Approval is required to replace an existing fact; history supports restoring earlier versions.

The technical constraints are part of the product:

- PostgreSQL plus pgvector is the only vector store.
- FastAPI and asyncpg own all backend data access.
- API keys are hashed before storage.
- Retrieval and extraction failures must not break proxy responses.
- Extraction is scheduled in the background without waiting for it to finish; streaming extraction is scheduled when the stream ends.
- Proxy and MCP conversation capture share extraction, reconciliation, deduplication, and storage logic.
- Database connections are released before extraction and reconciliation provider calls.
- Memory retrieval is scoped to the authenticated user, workspace, and namespace and only returns approved memories.
- The dashboard is a developer console for inspection and control, not a consumer UI.
- MCP support is a first-class differentiator, not an add-on.

The codebase has expanded beyond the original v1 boundary. It includes streaming proxy support, Clerk dashboard sign-in, workspace memberships, optional Stripe subscriptions and quotas, memory review and import/export, duplicate merging, manual confidence decay, and optional hybrid search, reranking, and entity graphs. Workspaces scope credentials and billing; memory access is still scoped by user as well as workspace.

Engram does not use external vector databases, LangChain, LlamaIndex, Redis, or Celery, and it does not implement rate limiting. PostgreSQL jobs and leases recover interrupted extraction; temporary provider override keys are never persisted and those captures require resubmission after interruption. OAuth connections are revocable, scoped to one project, and cannot retrieve personal memories. Optional retrieval or logging failures should not break provider forwarding; authentication, quota, provider configuration, and upstream failures remain request errors. Database-outage forwarding relies on cached authentication and self-hosted server provider keys; streaming requires a working database.
