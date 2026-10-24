# Hosted verification - October 24, 2026

## Observed deployment

- Dashboard: Vercel project engram, custom domain https://engram.ayushh.in, production commit a014a58, ready. Public root returns HTTP 200.
- API: Azure Container App engram-api in resource group Projects, Azure for Students subscription, Central India. Image e684588 is older than the current main branch.
- API revision engram-api--0000028 initially failed startup because the configured Supabase tenant was not found. It recovered after the existing database was resumed and the revision restarted.
- Supabase project Engram, lunncspvxjmsregyiyly, resumed from INACTIVE to ACTIVE_HEALTHY. Live API health returned HTTP 200 with its database connected and embedding model loaded.
- No hosted MCP service was present in the Azure Container Apps listing. Local MCP/plugin validation does not establish hosted OAuth support.

## Execution

1. Resume the existing Supabase project and verify it becomes active. Verify live API health without changing stored credentials or database data.
2. Build and publish a commit-tagged MCP container with the same GitHub Actions pattern as the API image. Exclude local environment files from its build context. Run MCP checks and verify the image build.
3. Hosted rollout is on hold under the user's subsequent free-only constraint. Any future rollout must preserve the current embedding model and secrets. Required public settings are API_PUBLIC_URL, DASHBOARD_URL and MCP_PUBLIC_URL. Use an actual deployed MCP endpoint, not a localhost default or guessed hostname.
4. Verify API health, OAuth authorization metadata, protected-resource metadata, HTTP authentication, project consent, deliberate capture and revocation against the hosted endpoints.
5. Run real-client checks only against a dedicated synthetic account/project. Do not publish a marketplace listing or invent reviewer credentials, privacy policies or support commitments.

## Boundaries

The browser connector's local profile is disconnected and remote-host lookup returned 403. Signed-in browser verification is unavailable through that connection. Azure, Vercel and Supabase read-only management access works. Unrelated local files stay excluded from commits.

## Recovery and rollout readiness

- Supabase resumed successfully and reached ACTIVE_HEALTHY. Restarted the existing unhealthy Azure revision; live API health then returned HTTP 200 with database connected and embedding model loaded.
- Commit d95cdae built the MCP image successfully; all three CI jobs passed. Anonymous OCI manifest access confirms the commit-tagged image can be pulled without adding registry credentials.
- API rollout image: ghcr.io/macayu17/engram-api:a014a58bb6d9cb9882500698e79d9cc78b34110f. MCP rollout image: ghcr.io/macayu17/engram-mcp:d95cdae30fde6422a9bfd39bf324d82fba0207ec.
- The previously proposed separate MCP service was not created. The user's subsequent free-only constraint takes precedence over the earlier deployment approval.
- API public origin is the existing Azure API hostname; dashboard origin is https://engram.ayushh.in. Set MCP_PUBLIC_URL from the service's actual assigned hostname after creation. Preserve existing service/database/provider secrets and EMBEDDING_MODEL=all-MiniLM-L6-v2.
- Existing Azure configuration has no provider-key encryption setting. A future rollout needs a generated encryption secret for new workspace provider credentials rather than a key in source control. No secret was added or replaced during this recovery.
- Claude CLI still reports expired authentication after the user's login confirmation, including with credential environment overrides removed. Do not claim a successful Claude conversation from plugin validation or package installation.

## Free-only constraint and cost audit

- Do not add Azure services, dedicated compute, always-on replicas, paid database plans or registry resources. Do not remove the subscription spending limit. Local MCP remains available without adding an Azure MCP container.
- Live configuration on October 24, 2026: Consumption-only environment; API minimum zero and maximum one replica; 0.5 vCPU and 1Gi memory. This is the existing recovered configuration, not a claim that smaller allocations were tested. Reducing memory without measuring model startup and request peaks risks breaking the API.
- The Azure for Students subscription reports spendingLimit=On. This limits eligible spending to the available credit; it does not enforce a zero-usage-charge cap.
- Azure Cost Management ActualCost, MonthToDate, grouped by ResourceId, returned only zero-valued rows in INR and no next page. No Engram charge appeared. Cost data can lag and this result does not establish remaining free allowance or guarantee future zero cost.
- No Azure Container Registry exists in the subscription. Engram's environment has no Log Analytics destination configured. A separate PerGB2018 Log Analytics workspace exists in the shared resource group; it was not changed because it is not linked to Engram and may serve other applications.
- No new Azure resources, API image upgrade, compute allocation change or scale change was made. Avoid repeated public health polling so the existing API can scale to zero when unused.
- Azure Consumption includes monthly grants of 180,000 vCPU-seconds, 360,000 GiB-seconds and two million HTTP requests per subscription. Usage beyond the grants can consume credit. A public Azure deployment cannot be described as guaranteed free merely because it scales to zero. A strict zero-cost guarantee requires avoiding metered hosting, such as running the stack locally.

Sources: [Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing), [Azure spending limit](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/spending-limit).

## Local client verification

- The MCP roundtrip verifier failed with `No authenticated request context`: it imported handlers directly after authentication moved into the transport. Its capture check also expected the old unwrapped response. Replace direct handler calls with the SDK's stdio client, inspect `capture` and `review`, wait for the conversation's extracted fact in pending review, and require the created memory in search results. Require explicit test API and account settings to avoid falling back to the public API.
- The updated verifier passed all seven tool checks against fresh synthetic local accounts. The API and pgvector database were real; extraction used the repository's local mock provider. Local Transformers import stalled, so this client check used a deterministic embedding fixture in an ignored harness. It does not establish semantic retrieval quality or real-model startup. Synthetic accounts were deleted after verification.
- Codex CLI 0.164.0, using the existing ChatGPT login and temporary per-invocation stdio configuration, successfully called `search_memories` and `capture_conversation`. Its retrieved decision belonged to `client-check`; the capture retained source `codex_client_check` and session ID `local-codex-smoke`. API readback confirmed the capture job completed and the extracted fact remained pending in that project. No global MCP configuration or plugin installation was changed.
- MCP build, argument defaults, HTTP authentication/isolation, scope/resource/discovery checks and plugin package contracts passed. Claude CLI validated its plugin manifest. The user confirmed their login was in the desktop or website and that Claude Code access was unavailable on their plan; no paid plan or API credentials were requested for further testing.
- No Azure requests, resources or configuration changes were needed for this client verification. Hosted OAuth verification and public marketplace submission remain pending under the free-only constraint.
