# Engram plugins

These local packages provide recall, deliberate capture, review guidance and project handoffs. They do not intercept host conversations. Captured facts enter pending review. No package is published or listed in a public directory.

## Local setup

Build the server from the Engram repository with `npm ci --prefix mcp` and `npm run build --prefix mcp`. Node 20 or newer is recommended. Start the API separately and create your own API key through Engram.

Export these environment variables in the terminal that launches the host. Values below are examples for your local installation; replace the file path and set the key privately.

```powershell
$env:ENGRAM_MCP_ENTRY = "F:/Engram/mcp/dist/index.js"
$env:ENGRAM_API_URL = "http://localhost:8000"
$env:ENGRAM_NAMESPACE = "default"
$env:ENGRAM_API_KEY = Read-Host "Engram API key" -MaskInput
```

`ENGRAM_MCP_ENTRY` must be an absolute path that remains accessible after the host caches the plugin. The server is supplied by your checkout, not downloaded by the plugin. Environment placeholders contain no credentials. Keep exported secrets out of shell history, repository files and screenshots. Restart the host after changing environment values.

For Claude Code, validate and load without changing your account:

```text
claude plugin validate ./plugins/claude
claude --plugin-dir ./plugins/claude
```

For local marketplace installation, run these commands yourself:

```text
claude plugin marketplace add ./plugins
claude plugin install engram@engram-local
codex plugin marketplace add ./plugins
```

Codex's catalog is in `plugins/.agents/plugins/marketplace.json`; the portable package is `plugins/codex/plugin.json`, with `mcp.json` beside it. Select the Engram local source in the supported host's plugin directory, install, and test in a new conversation. Availability of local sources varies by host surface. The Claude catalog uses `.claude-plugin/marketplace.json` and a separate Claude manifest.

The same `plugins` directory can be distributed as a standalone Git repository or copied into a team marketplace. After a maintainer actually publishes it to a Git host, substitute that repository URL for the local marketplace path. No Git URL in these instructions claims that an unpushed package is already available.

## Using the workflows

Use the recall skill for prior project decisions, capture when you deliberately want an exchange remembered, review to inspect pending candidates, and project-handoff to resume or save a concise handoff. Review approval, revision comparison and history live in the Engram dashboard. The review skill does not pretend to have an approval tool.

Tools accept `namespace`; stdio/API-key connections default to `ENGRAM_NAMESPACE`. Personal retrieval requires explicit `include_personal: true` on search with an API-key connection. OAuth connections are bound to one project and cannot include personal scope or override it.

Capture accepts `source` (for example `claude_code` or `codex`) and optional `session_id`. Supply a real client session identifier only when available. These fields track deliberate captures; they do not enable transcript interception, hooks or background host access.

## Remote deployment templates

`templates/claude.remote.mcp.json` and `templates/codex.remote.mcp.json` are templates, not active deployments. Replace `${ENGRAM_MCP_URL}` with your deployed HTTPS URL ending in `/mcp` before validation or submission. Replace the local package's MCP config with the matching rendered template to connect remotely. Preserve the skills and manifest. The portable Codex template declares OAuth with dynamic registration. Claude discovers authentication from the MCP server's protected resource metadata.

Set the server's `MCP_PUBLIC_URL` to that same full public URL. Set `ENGRAM_AUTH_URL` to the publicly reachable authorization server origin (defaults to `ENGRAM_API_URL`). The public endpoints are `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp`; authorization server metadata is served by the API at `/.well-known/oauth-authorization-server`.

HTTP authenticates every request independently with OAuth Bearer or `X-Engram-Key`. It never uses the server process's stdio key. OAuth scopes are `memory:read` and `memory:write`. Consent binds a project. API-key requests can select their project explicitly. Legacy `/sse` connections expire after 15 minutes and cannot change credentials; reconnect after token rotation. Streamable HTTP requests expire after 60 seconds and bodies are limited to 256 KiB.

## Validation and public submission

Run `node scripts/verify_plugin_packages.mjs` from the Engram root to validate package structure, catalogs, skill frontmatter and rendered template contracts. Run `claude plugin validate ./plugins` and `claude plugin validate ./plugins/claude` if the Claude CLI is installed. A structural check does not verify host installation, OAuth consent or public directory acceptance.

`templates/submission.json` is a draft worksheet. Supply real deployed endpoints, privacy policy and support URLs before submitting through the official portal. Do not insert API keys or reviewer credentials into a distributable package. Test a dedicated account, recall, deliberate capture, pending review and revocation before requesting review. Remote public submission requires a reachable HTTPS service; copying a template does not deploy it.

Packaging follows the [OpenAI plugin packaging guide](https://developers.openai.com/plugins/build/plugins), [Claude plugin manifest reference](https://code.claude.com/docs/en/plugins-reference), and [Claude marketplace guide](https://code.claude.com/docs/en/plugin-marketplaces), consulted October 20, 2026. OpenAI's current preferred format is portable root `plugin.json` and typed `mcp.json`; the older `.codex-plugin` format remains a compatibility option.
