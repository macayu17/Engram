# Engram product workflows implementation plan

Goal: implement the accepted product recommendations while preserving the website and existing cleanup. Existing languages, dependencies and service boundaries stay. No commits, pushes, deployment, external account creation, or marketplace submission.

## Product decisions

- Default project is `default`; personal scope is `personal`. Retrieval may include personal memories only when explicitly requested with `include_personal=true`. OAuth grants bind one project; personal retrieval needs an explicit grant option or a separate personal connection, so the first OAuth release stays project-only.
- Newly inferred facts stay pending. Changes to approved memories become pending revisions rather than overwriting them. Manual edits and accepted revisions create history snapshots; undo creates another history entry. Revisions use optimistic comparison with the original content to avoid overwriting concurrent edits.
- Review is a real tabbed inbox with bulk approve/reject, source inspection, revision comparison and errors. All pages use API-key/project-specific query keys.
- Overview is operational, without the marketing hero. Chat becomes Playground and exposes retrieval details. Connections generates local install instructions without embedding secrets in copied public assets; connection tests and recent captures are visible.
- Store recoverable extraction requests in PostgreSQL with attempts and leases; execute with asyncio workers. Do not persist per-request provider override keys. Work requiring an ephemeral override is explicitly non-recoverable and reported as such. Retry only bounded, leased work; never concurrent duplicate processing.
- Hosted MCP authenticates every HTTP request independently. Never fall back to the process-wide API key for HTTP users. Stdio retains its per-process key.
- OAuth uses authorization codes, S256 PKCE, exact registered redirect URIs, opaque hashed short-lived access tokens, rotating refresh tokens, explicit scopes and project binding. Existing REST API keys remain supported.
- No automatic interception of host conversations is claimed. Plugins guide recall and deliberate capture. No secrets or real account data in plugin packages.

## Shared API contract

Memory JSON adds `namespace: string`, `expires_at: string|null`. Create/search/capture accept `namespace` (default `default`); search accepts `include_personal` (default false). Update accepts namespace (explicit move) and expires_at. Existing positional parameters stay compatible by appending optional parameters.

- GET `/memories/namespaces` -> `{namespaces: [{name: string, count: number}]}`.
- POST `/memories/review/bulk` body `{memory_ids: string[], status: 'approved'|'rejected', namespace?: string}` -> `{updated: number}`.
- GET `/memories/revisions?namespace=...&status=pending` -> `{revisions: [{id,memory_id,original_content,proposed_content,status,source_conversation_id,namespace,created_at}]}`.
- POST `/memories/revisions/{id}/accept` or `/reject` -> revision object. Accept returns 409 on concurrent edit.
- GET `/memories/{id}/history` -> `{versions:[{id,memory_id,content,category,status,pinned,namespace,created_at,reason}]}`.
- POST `/memories/{id}/restore` body `{version_id:string}` -> Memory.
- POST `/memories/{id}/feedback` body `{relevant:boolean,query?:string}` -> `{saved:true}`.
- GET `/connections/status?namespace=...` -> `{connected:true,user:{external_id:string},namespace:string,provider:{name:string,configured:boolean},clients:[{source,conversations,memories_extracted,last_seen}],jobs:[{id,extraction_status,memories_extracted,created_at,attempts,last_error,namespace,recoverable}],mcp_url:string}`. No plaintext credentials.
- POST `/connections/jobs/{id}/retry` -> `{queued:true}`. Only failed recoverable jobs; user+org scoped.
- DELETE `/connections/captures?older_than_days=30` -> `{deleted:number}`; clears raw conversation payloads, retaining status and memories. Explicit UI confirmation.

Retrieval logs add namespace, `injected_count`, `retrieval_mode`, and optional saved memory snapshots so later edits do not rewrite past diagnostics. POST `/memories/search` logs a search event with injected_count=0. Proxy logs actual count. Failure logging remains nonfatal.

OAuth API contract (owned by OAuth worker):

- Config (root integrates): `api_public_url`, `mcp_public_url`, `oauth_access_token_seconds=3600`, `oauth_refresh_token_days=30`; dashboard_url exists.
- GET `/.well-known/oauth-authorization-server` returns issuer/endpoints/S256/scopes.
- POST `/oauth/register` public client registration, token_endpoint_auth_method none, strict redirect validation.
- GET `/oauth/authorize` validates query and redirects to `${dashboard_url}/connections/authorize` preserving validated params.
- GET `/oauth/consent` with client_id + redirect_uri -> `{client_name,redirect_uri,scopes_supported:['memory:read','memory:write']}`.
- POST `/oauth/authorize` authenticated Engram API key, body `{client_id,redirect_uri,response_type:'code',code_challenge,code_challenge_method:'S256',scope,state?,resource?,namespace}` -> `{redirect_url}`.
- POST `/oauth/token` urlencoded authorization_code/refresh_token grants (urllib.parse parsing; no new multipart dependency).
- POST `/oauth/introspect` takes Authorization Bearer token -> `{active:true,scope:'memory:read memory:write',namespace,client_id,expires_at}` or 401.
- GET `/oauth/connections` with API key -> `{connections:[{id,client_name,namespace,scope,created_at,last_used_at,expires_at}]}`; DELETE `/oauth/connections/{id}` -> 204.
- POST `/oauth/revoke` urlencoded token revocation, no token echo.
- Service `get_user_by_access_token(token,db)` returns a scoped user record including id,org_id,external_id,role,retrieval config plus `oauth_scope` and `oauth_namespace`; None on invalid/expired/revoked or membership removed. Dependency integration is root-owned.
- DB schema OAuth worker writes `api/db/oauth.sql`; root will load it from schema helper and wire router.

MCP worker: HTTP request authorization is validated against `/oauth/introspect` for Bearer OAuth, or `/users/me` for per-request X-Engram-Key. Use AsyncLocalStorage for downstream credentials, scopes and project; shared exported engramClient must never mix users. Bearer forwarding uses Authorization, API keys use X-Engram-Key. Namespace supplied in bodies/query; granted OAuth namespace cannot be overridden. HTTP protected resource metadata references ENGRAM_AUTH_URL (default API URL); mcpPublicUrl configured. Add zod validation/tool annotations; bound requests and session lifetimes. Package Claude/Codex local plugins and remote templates separately, instructions/README, validation script, no publication.

Dashboard worker owns dashboard product components/pages/lib and scripts only; avoid website files globals.css, layout.tsx, page.tsx, Landing* and components/landing. Root owns backend memory/scopes/jobs/logs and main/config/dependencies/schema loader. OAuth worker owns only new OAuth models/services/routes/schema/tests. MCP worker owns mcp/, plugins/, and new plugin verification scripts.

## Execution and verification

- [x] Backend scopes, revisions/history, feedback, retention, extraction recovery and status endpoints.
- [x] OAuth boundary and security tests.
- [x] MCP per-request auth, tool scopes, namespace propagation and plugin packaging.
- [x] Product UI workflows and Connections/consent pages.
- [x] Integration review and regression fixes.
- [x] Backend full suite and compilation, MCP build/tests/package validation, dashboard checks/typecheck/build.
- [x] Real local browser proof at desktop/mobile; isolated PostgreSQL integration where available. Record unavailable infrastructure precisely.

## Evidence and rulings

- Existing uncommitted cleanup and website changes are preserved. User explicitly authorized this product scope and OAuth extension; no extra design approval is needed.
- PostgreSQL skill read before schema changes. New tables require RLS and public-role revokes consistent with existing schema.


## Verified outcome

- Backend: 214 tests passed with ENGRAM_TEST_DATABASE_URL pointing to an isolated local pgvector/PostgreSQL 16 container. The full suite includes real database tests for OAuth code replay, refresh rotation, membership, project isolation, revisions/history/restore, trace deletion, capture leases/retry and retention. Python compilation passed.
- MCP: TypeScript build and verify:auth, verify:defaults, verify:plugins passed. HTTP checks cover concurrent user isolation, scopes/projects, discovery, body limits, SSE credential binding and stdio keys. Local Claude manifests and portable Codex schemas were validated; no package was installed or submitted.
- Dashboard: production build, typecheck, verify:logic, verify:clerk and verify:billing passed. Real Chrome exercised bulk approval, revision approval, restoring history, proxy injection, feedback, OAuth consent, MCP tool access, cross-project rejection, revocation and mobile overflow. No browser page errors. The final Chrome pass used the rebuilt production dashboard and current API/MCP code; mobile navigation has eight links with at least 44-pixel tap targets and no horizontal overflow. Screenshot proof and the token-free result are in .codex/product-verification/ (local artifacts).
- Browser fixture uses an isolated test user/database, real all-MiniLM-L6-v2 embeddings and a deterministic local OpenAI-compatible server. It makes no paid provider calls and says nothing about hosted provider reliability.
- Review found and fixed project-only OAuth leakage through personal-memory trace snapshots, legacy trace hydration and raw captures made with personal retrieval. Deleted or moved facts redact saved trace text. Revisions from a moved memory are hidden from the old project's inbox.
- Docker Compose configurations parse. The dashboard public API URL is now supplied at build time as required by Next.js. Existing schema startup applies the base, product and OAuth scripts in order; a missing script fails startup.
- Evaluation: expanded fixture has 8 facts and 21 positive queries. With local all-MiniLM-L6-v2, vector precision/recall were 0.476/0.476; hybrid was 0.619/0.619. Both had 1.0 target-exclusion on negative queries. This is a small local fixture, not a production-quality estimate or a measured before/after improvement. Removed sample-specific retrieval expansion and substring-based expected-fact matching.

## External checks still required

No production deployment, public HTTPS OAuth callback, real Claude/Codex host installation, marketplace acceptance, Clerk account flow or Stripe payment flow was exercised. No commit, push, package publication or directory submission was performed. The marketing website changes already present in the workspace remain outside this product pass.


## GitHub integration

Before the authorized push, origin/main had 13 newer commits for memory conflicts and overview refinement. The merge preserves conflict detection/resolution/history and the project-scoped product interface. Revision proposals now use memory_revision_proposals so the existing memory_revisions history table remains intact. Conflict API reads and resolutions enforce OAuth project scope. The merged head passed 226 backend tests against isolated pgvector, Python compilation, dashboard typecheck/production build/logic/conflict/Clerk/billing checks, and MCP auth/default/plugin checks. The browser workflow was verified before this merge; it was not repeated after integration.
