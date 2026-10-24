# Hosted verification - October 24, 2026

## Observed deployment

- Dashboard: Vercel project engram, custom domain https://engram.ayushh.in, production commit a014a58, ready. Public root returns HTTP 200.
- API: Azure Container App engram-api in resource group Projects, Azure for Students subscription, Central India. Image e684588 is older than the current main branch.
- API revision engram-api--0000028 is unhealthy. Console reports application startup failure: the configured Supabase tenant was not found.
- Supabase project Engram, lunncspvxjmsregyiyly, was INACTIVE. Resume request succeeded; recovery must be confirmed before an API rollout.
- No hosted MCP service was present in the Azure Container Apps listing. Local MCP/plugin validation does not establish hosted OAuth support.

## Execution

1. Resume the existing Supabase project and verify it becomes active. Verify live API health without changing stored credentials or database data.
2. Build and publish a commit-tagged MCP container with the same GitHub Actions pattern as the API image. Exclude local environment files from its build context. Run MCP checks and verify the image build.
3. Prepare the API rollout with its current embedding model and secrets preserved. Required public settings are API_PUBLIC_URL, DASHBOARD_URL and MCP_PUBLIC_URL. Use the actual deployed MCP endpoint, not a localhost default or guessed hostname.
4. Verify API health, OAuth authorization metadata, protected-resource metadata, HTTP authentication, project consent, deliberate capture and revocation against the hosted endpoints.
5. Run real-client checks only against a dedicated synthetic account/project. Do not publish a marketplace listing or invent reviewer credentials, privacy policies or support commitments.

## Boundaries

The browser connector's local profile is disconnected and remote-host lookup returned 403. Signed-in browser verification is unavailable through that connection. Azure, Vercel and Supabase read-only management access works. Unrelated local files stay excluded from commits.
