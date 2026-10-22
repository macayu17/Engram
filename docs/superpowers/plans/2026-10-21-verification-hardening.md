# Verification hardening - October 21, 2026

Scope: close verification gaps after the GitHub merge, preserve existing user files, and fix reproduced regressions. No production deployment or marketplace submission.

## Changes

- CI provisions PostgreSQL 16 with pgvector, applies the schema, and sets the integration-test DSN. MCP authorization, plugin packaging, dashboard conflict and billing checks are included.
- Dashboard import now sends the selected namespace at request level rather than silently importing into default.
- Confidence decay and merge requests explicitly carry the selected project. Decay confirmation names the project.
- Resolved conflict history remains visible after resolving the last open conflict. History loading failures are visible.
- Added request-contract regressions, PostgreSQL tests for all three conflict decisions, and expired-lease recovery with rejection of stale worker writes.
- Claude CLI validated both manifests. Codex CLI registered the local marketplace, installed Engram 0.1.0, and listed it as enabled. Temporary installation and marketplace were removed afterward. No paid assistant conversation was launched.

## Verification

- Previously pushed d13aeab passed GitHub CI: https://github.com/macayu17/Engram/actions/runs/39469752649. That result does not cover this uncommitted follow-up.
- Backend: 229 passed against isolated pgvector. Python compilation and Compose configuration parsing passed.
- MCP auth/default/plugin checks passed.
- Dashboard logic/conflict/Clerk/billing checks and production build passed. The machine hit its paging-file limit during concurrent work; stopping temporary services freed memory and the build completed successfully.
- The merged Chrome workflow passed: bulk review, revision acceptance, restore, proxy injection, feedback, OAuth consent, scoped MCP, cross-project denial, revocation and mobile navigation. Fixtures used isolated data, real local embeddings and a deterministic local provider.
- Final rebuilt-browser regression check passed: resolving the last open conflict retained Recently resolved, an uploaded memory appeared in product-demo and not default, and Decay confirmed and sent only product-demo. Screenshot: `.codex/product-verification/screenshots/merged-conflict-history.png`, `/memories` at 1440x1000.

## Local browser evidence

Artifacts and synthetic credentials stay under ignored `.codex/product-verification/`. Screenshots use `http://127.0.0.1:3011`, desktop 1440x1000 and mobile 390x844. Dashboard command: `node node_modules/next/dist/bin/next start -p 3011` from dashboard/. API command: `python -m uvicorn api.main:app --host 127.0.0.1 --port 8011` with an isolated test DSN. The database container is `engram-product-check`; the hosted database was not used.

Production HTTPS callbacks, live providers, assistant chat behavior, Clerk login, Stripe payments and public directory acceptance remain external checks. Local plugin installation proves loading, not directory approval.
