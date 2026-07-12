# Engram SaaS and Product Redesign

## Purpose

Engram will become an open-core developer product for small AI product teams. The hosted product provides managed accounts, workspaces, API keys, usage limits, billing, and a polished dashboard. The self-hosted API, MCP server, and local dashboard remain usable without a hosted subscription.

The first release must make the existing memory system safe to sell, easy to evaluate, and visually credible. It must not add Azure resources or raise the configured Azure compute, replica, or storage footprint.

## Product Position

The public offer is:

> Memory infrastructure for AI products.

Engram stores durable user context, retrieves relevant memories, and shows developers exactly what was injected into each model request. The primary buyer is a small team building an AI application that wants memory without operating a separate retrieval system.

The hosted service is the convenience product. The repository remains the self-hosted option. Engram does not sell bundled model usage in the first release; customers provide their own extraction-provider credentials.

## Release Scope

### Launch requirements

- A public landing page at `/` that explains the product without requiring an API key.
- Public pricing, documentation, privacy, and terms pages.
- Clerk-authenticated hosted accounts.
- A personal workspace created on first sign-in.
- Workspace-scoped API keys with rotation and revocation.
- Strict workspace isolation for memories, conversations, retrieval logs, and keys.
- Free and Pro workspace plans with enforced limits.
- Stripe Checkout and Customer Portal for Pro workspaces.
- An authenticated product shell with onboarding, usage, and clear operational states.
- Secure, idempotent account provisioning and Stripe webhook handling.
- Desktop and mobile accessibility verification.
- The existing API, MCP, dashboard, and self-hosted flow remain functional.

### Deliberate exclusions

- Enterprise SSO, SCIM, custom contracts, audit exports, and custom retention.
- Per-seat billing or metered overage billing.
- Managed OpenAI, Gemini, Anthropic, or Ollama credits.
- Redis, queues, additional databases, analytics vendors, or background-worker services.
- New Azure resources, larger containers, higher replica limits, or always-on replicas.
- Fake customer logos, testimonials, activity, or usage data.

## Information Architecture

Next.js route groups provide separate layouts without changing public URLs.

### Public routes

- `/` - landing page
- `/pricing` - Free and Pro comparison
- `/docs` - integration documentation
- `/privacy` - privacy policy
- `/terms` - terms of service
- `/sign-in` and `/sign-up` - Clerk flows when hosted authentication is configured

### Product routes

- `/overview` - onboarding or workspace health summary
- `/memories` - memory ledger and search
- `/chat` - retrieval playground
- `/logs` - retrieval traces
- `/graph` - memory relationships
- `/settings` - workspace, members, API keys, providers, billing, and account

The root layout contains only global providers and document metadata. A marketing layout owns the public header and footer. A product layout owns the authenticated app navigation. This prevents public pages from loading the internal dashboard shell or account APIs.

When Clerk is configured, product routes require a signed-in user. A local self-hosted installation without Clerk continues to use the existing API-key setup flow.

## Landing Page

### Visual direction

The interface should look like developer infrastructure, not AI concept art.

- Use a clean sans-serif type system. Use monospace only for identifiers, scores, request data, and code.
- Use soft white, graphite, muted gray, and restrained evergreen accents.
- Use thin borders, compact spacing, and a maximum 8px radius.
- Do not use gradients, orbit graphics, abstract neural networks, decorative telemetry, Roman numerals, oversized italic serif text, or excessive uppercase labels.
- Use real Engram product states and retrieval traces as the primary visual proof.
- Keep contrast at WCAG AA and preserve visible focus states and reduced-motion behavior.

### Page structure

1. **Header** - Engram name, Product, Docs, Pricing, GitHub, Sign in, and Start free.
2. **Hero** - literal product headline, short supporting sentence, Start free and View docs actions, followed by a full-width real retrieval trace showing request, matched memories and scores, injected context, and response.
3. **Product proof** - API proxy, SDK/API integration, and MCP support using real code and UI output.
4. **Workflow** - store, retrieve, inspect, and improve with one concrete example.
5. **Dashboard proof** - real memory ledger, retrieval log, and graph screenshots or rendered product surfaces.
6. **Integration** - concise OpenAI-compatible API and MCP examples.
7. **Pricing** - Free and Pro workspace plans.
8. **Open source** - self-hosting path and repository link without weakening the hosted offer.
9. **FAQ** - data ownership, provider keys, self-hosting, limits, and cancellation.
10. **Final action and legal footer** - Start free, Docs, GitHub, Privacy, and Terms.

The hero must show the product clearly in the first viewport. Animations are limited to small state transitions and must not be needed to understand the content.

## Product Experience

### App shell

The desktop shell has a workspace switcher, current-section navigation, command search, usage indicator, and account menu. Mobile uses a compact menu with labeled destinations and a visible account action. The current section is always identifiable.

### Overview

New workspaces see an onboarding checklist:

1. Create or copy an API key.
2. Configure an extraction provider.
3. Send the first memory or proxy request.
4. Inspect a retrieval trace.

Active workspaces see current-period retrieval usage, memory count and limit, pending memory reviews when available, recent retrievals, and integration status. Empty states provide the single next useful action instead of fabricated metrics.

### Existing tools

Memories, chat, logs, and graph keep their existing responsibilities. Their visual treatment becomes denser and more operational: normal sentence casing, clear table hierarchy, consistent status colors, explicit loading and error states, keyboard-accessible actions, and mobile layouts that do not clip controls.

Settings is divided into workspace, members, API keys, providers, billing, and account sections. Features unavailable on the current plan explain the limit and link to billing without blocking unrelated settings.

## Identity and Provisioning

Clerk is the hosted identity provider. On first authenticated product access, the dashboard server performs one idempotent provisioning operation:

1. Resolve the Clerk user from the server session. Client-provided external IDs are not trusted.
2. Reconcile the Engram user by Clerk user ID.
3. Create a personal workspace if the user has no membership.
4. Add the user as owner.
5. Create one workspace-scoped API key if none exists.
6. Return the workspace and one-time plaintext API key.

User, workspace, membership, and key creation occur in a database transaction. Retrying the request returns the existing workspace and does not duplicate memberships or keys. Plaintext API keys are shown only when created; only hashes are stored.

The hosted dashboard provisioning route requires Clerk authentication before it can use `ENGRAM_SERVICE_KEY`. When the service key is configured, unauthenticated `POST /users` is disabled. Self-hosted installations without the service key retain the documented bootstrap route.

## Workspace Isolation

The existing `orgs` table becomes the workspace record and `org_memberships` remains the membership join table. The term `workspace` is used in the product UI; API internals may retain the existing table names.

`org_id` is required for hosted `user_api_keys`, `memories`, `retrieval_logs`, and `conversations`. Existing memory rows already support `org_id`; keys, logs, and conversations require the same scope. Namespace remains a subdivision inside a workspace, not a tenant boundary.

Every hosted API request resolves both user and workspace from the API key. Service queries filter by workspace before applying user, namespace, search, or pagination filters. Membership checks are required for dashboard operations. Cross-workspace identifiers return not found rather than revealing that another workspace owns the record.

Legacy self-hosted data is assigned to a generated personal workspace during migration. The current user-level key remains a compatibility path for self-hosted installations while hosted key creation uses `user_api_keys` as the source of truth.

## Plans, Billing, and Limits

### Initial plans

| Capability | Free | Pro |
| --- | ---: | ---: |
| Price | $0 | $29 per workspace per month |
| Members | 1 | 5 |
| Stored memories | 2,000 | 50,000 |
| Retrievals per month | 10,000 | 250,000 |
| Provider credentials | Bring your own | Bring your own |
| Self-hosting | Included | Included |

Plan limits live as constants in one server-side entitlements module. The Stripe price identifier remains an environment variable because it differs by environment.

One subscription belongs to one workspace. Minimal billing fields are added directly to `orgs`: plan, Stripe customer ID, Stripe subscription ID, subscription status, and current period end. A small `stripe_events` table stores processed event IDs so webhook retries are safe. No billing abstraction or metering service is introduced.

Free workspaces do not enter Checkout. Pro upgrades create a Stripe Checkout session. Existing Pro workspaces open Stripe Customer Portal for payment and cancellation management. Signed webhooks are authoritative for subscription state; redirects are never treated as proof of payment.

Memory count and retrieval-log count remain the initial usage source of truth. Indexed count queries enforce limits before writes and proxy calls. A separate rollup table is added only if production measurements show these queries are too expensive.

At a limit, existing data remains readable and exportable. New memory writes and proxy requests return a clear limit response with the current usage and limit. Data is not deleted. A failed or canceled subscription retains data and moves to Free limits at the end of the paid period; excess existing data remains read-only until usage is reduced or the workspace upgrades.

## Provider and Azure Cost Controls

Extraction uses the workspace owner's encrypted provider credential. Engram does not silently fall back to a paid platform key. Retrieval uses the existing local embedding model and PostgreSQL vector search.

The release does not change Azure Container App CPU, memory, min replicas, max replicas, registry, database tier, or storage. It does not add Azure Functions, Service Bus, Redis, monitoring products, or another Container App. Stripe and Clerk integration runs in the existing dashboard and API processes.

Local development and CI are the default validation environments. Any production deployment, migration, or Azure configuration change requires separate explicit approval and a before-and-after cost review.

## Reliability and Security

- Provisioning and Stripe webhook processing are idempotent.
- Stripe webhook signatures are verified before parsing or applying events.
- API keys are hashed at rest and can be named, rotated, and revoked.
- Provider credentials use the existing encrypted storage path and are never returned after saving.
- Database transactions prevent partial workspace provisioning.
- Clerk, Stripe, API, and provider failures produce specific inline states without exposing secrets.
- Proxy memory retrieval and background extraction remain non-fatal to the provider response.
- Quota enforcement happens server-side and cannot be bypassed by dashboard calls.
- Hosted CORS and service-key behavior use explicit origins and deny insecure fallbacks.

## Verified Launch Blockers

The SaaS release includes these existing issues because they affect security, tenant correctness, reliability, or operating cost:

1. The dashboard user-provisioning route currently accepts an arbitrary external ID and can forward the service key without verifying a Clerk session.
2. The public user creation endpoint remains usable in configurations where hosted provisioning should be private.
3. Proxy and extraction paths hold database connections while waiting on external model calls, reducing effective pool capacity.
4. Streaming buffers the full provider response, can turn upstream errors into successful streams, and does not reliably recover assistant text from SSE for extraction.
5. Secondary API-key authentication does not load all user retrieval settings.
6. Namespace-filtered search omits the namespace field needed by result filtering.
7. Anthropic chat forwarding exists, but extraction provider selection does not support Anthropic consistently.
8. Example environment and README embedding defaults disagree with the API and image build defaults.

Each blocker receives a focused regression check. Unrelated refactors are excluded.

## Testing and Release Gates

### API

- Provisioning retry creates one user, workspace, membership, and key.
- API keys cannot read or mutate another workspace's records.
- Namespace filtering works inside a workspace.
- Free and Pro limits enforce exact boundary values.
- Subscription state changes are idempotent and require a valid Stripe signature.
- Provider, retrieval, and extraction failures preserve documented proxy behavior.
- Streaming preserves status errors and yields extractable assistant text.
- Existing API tests continue to pass.

### Dashboard

- Public pages make no authenticated Engram API requests.
- Product routes enforce authentication only when Clerk is configured.
- Onboarding, active, empty, loading, quota, payment-failure, and service-error states render correctly.
- Checkout and portal routes require a valid Clerk session and workspace membership.
- Type checking, dashboard logic checks, Clerk verification, and production build pass.
- Desktop and mobile screenshots verify the landing page and each product shell breakpoint.
- Keyboard navigation, focus visibility, labels, contrast, reduced motion, wrapping, and overflow are checked.

### MCP and deployment

- Existing MCP build and defaults checks pass with workspace-scoped keys.
- Docker Compose configuration remains valid.
- No Azure resource or scaling change appears in the implementation diff.
- Production migration and deployment remain outside this implementation until explicitly approved.

## Delivery Order

1. Fix authentication, provisioning, tenant scoping, and the verified API blockers.
2. Add plan limits, Stripe billing, and server-side usage enforcement.
3. Separate marketing and product layouts, then build the landing, pricing, legal, and onboarding surfaces.
4. Restyle the existing product pages using the new system without changing their core responsibilities.
5. Run API, dashboard, MCP, Compose, tenant-isolation, billing, browser, and accessibility verification.

This order prevents the public launch experience from preceding the security and tenancy work required to support it.

## Post-Launch Candidates

These features are useful but do not belong in the first implementation:

1. A memory-review inbox to approve, edit, merge, or reject extracted facts.
2. Environment-scoped API keys and namespaces for development, staging, and production.
3. A retrieval comparison view for testing queries, thresholds, and ranking changes.
4. JSON import and export for migration and backups.
5. Team invitations and more granular workspace roles once multi-user demand is demonstrated.

