# Repository Cleanup Implementation Plan

**Goal:** Remove the duplication identified in the repository review and improve memory-path reliability without changing public interfaces or removing working features.

**Architecture:** Keep FastAPI, asyncpg, PostgreSQL/pgvector, the TypeScript MCP server, and Next.js. Share provider requests, conversation processing, and proxy preparation at their existing service boundaries.

**Scope:** The four cleanup suggestions accepted in the conversation: provider duplication, extraction orchestration, parsing/proxy preparation, and documentation drift. Additional changes require a concrete defect and regression test.

**Constraints:** Preserve the existing uncommitted landing-page changes. No new dependencies, database reset, deployment, commit, or push. Follow AGENTS.md, including no code comments. Keep workspace isolation, quota checks, provider errors, streaming cleanup, and review status behavior.

## Tasks

- [x] Establish backend, MCP, and dashboard verification baselines.
- [x] Consolidate OpenAI-compatible extraction requests; test auth, payloads, malformed output, provider errors, and Ollama differences.
- [x] Reuse message-content parsing and proxy authentication/preparation; test connection release, streaming, quotas, and retrieval/logging failures.
- [x] Share extraction/capture processing; retain background failure isolation, transactions, review status, and namespace propagation.
- [x] Fix reliability defects exposed by this work with failing regression tests first.
- [x] Align README and intent documentation with implemented features, review workflow, and failure limits.
- [x] Run the backend suite, MCP build/tool checks, dashboard checks/build, and available local integration checks. Review the final diff and record exact results here.

## Review Focus

- Never forward Engram credentials to an LLM provider.
- Release database connections before provider calls.
- Keep proxy requests usable when optional memory processing fails.
- Keep extraction and reconciliation scoped to the user, workspace, and namespace.
- Preserve caller-visible status codes and approved/pending/rejected behavior.

## Evidence

- Initial default-Python test attempt failed during collection: Python 3.13 has no asyncpg installed. Locate the project's existing Python environment before installing anything.

- Used the existing Python 3.11 `.venv`; no dependencies installed. Initial valid baseline: 151 passed, 3 skipped, 1 failed because the self-hosted provider test inherited hosted mode from `.env`. The test now explicitly selects self-hosted mode.
- Consolidated OpenAI/Gemini/Ollama chat-completion extraction, preserving provider timeout/auth/payload differences and compatibility imports. Anthropic remains separate.
- Shared proxy endpoint dispatch and authenticated preparation, content parsing, and extraction/capture processing. Removed unused provider symbols, a forwarding wrapper, repeated imports, and plain-data constructor boilerplate.
- Watched three regression cases fail before fixing Engram header leakage and SQL failure recovery. Added isolated provider request/error tests and extraction quota/namespace/transaction tests, plus streaming connection and quota coverage.
- Watched the standalone extraction test fail on its missing provider argument before repairing it. Fixed quick-start hosted-mode instructions and the deterministic verifier's matching mode setting.
- Backend final verification: 170 passed, 3 skipped. The three skips require an explicit test database URL. Python compilation and scoped `git diff --check` passed.
- MCP: `npm run verify:defaults` passed, including its TypeScript build.
- Dashboard: `verify:logic`, `verify:clerk`, `verify:billing`, `typecheck`, and production `build` passed. Existing dashboard changes were not edited.
- Independent read-only review and follow-up review: no actionable findings.
- Unverified: Docker/pgvector integration, live provider calls, and browser interaction. Docker Compose reports that the Docker Desktop engine pipe does not exist. No database reset, deployment, commit, or push performed.
