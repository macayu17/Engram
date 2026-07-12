# Engram Product UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public empty-dashboard experience and AI-styled visual language with a credible SaaS landing page and a compact, accessible product interface.

**Architecture:** Next.js route groups separate public marketing pages from authenticated product pages while preserving existing URLs. Public pages render without Engram API calls. The product shell reuses the existing React Query API client, Clerk bridge, and current memory tools, adding only workspace usage and onboarding state.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Clerk, React Query, Lucide icons, local headless Edge verification

**Prerequisites:** Complete `docs/superpowers/plans/2026-07-12-engram-saas-foundation.md` and `docs/superpowers/plans/2026-07-12-engram-billing-limits.md` first.

---

## File Map

- Reduce `dashboard/src/app/layout.tsx` to document metadata and global providers.
- Create `dashboard/src/app/(marketing)/layout.tsx` and marketing pages for `/`, `/pricing`, `/docs`, `/privacy`, and `/terms`.
- Create `dashboard/src/app/(product)/layout.tsx` and move overview, memories, chat, logs, graph, and settings pages under it without changing URLs.
- Create `dashboard/src/components/MarketingHeader.tsx`, `LandingPage.tsx`, `RetrievalTrace.tsx`, `PricingTable.tsx`, `ProductShell.tsx`, and `OverviewDashboard.tsx`.
- Modify `dashboard/src/app/globals.css` and `dashboard/tailwind.config.ts` to use neutral graphite and muted evergreen tokens.
- Remove `HomeDashboard.tsx` and `MemoryConstellation.tsx` after their replacements are active.
- Simplify `EngramLogo.tsx`, `ThemeToggle.tsx`, and `AuthControls.tsx`.
- Extend `dashboard/src/lib/api.ts` with workspace and usage types already exposed by the API.
- Restructure `SettingsPanel.tsx` and restyle the existing workspace components.
- Add a source verifier and capture real desktop/mobile screenshots.

Preserve the current uncommitted light-mode filter improvement in `dashboard/src/components/MemoryGraph.tsx`. Do not reset or overwrite that work; verify it against the new color tokens.

### Task 1: Establish the New Visual Tokens

**Files:**
- Modify: `dashboard/src/app/globals.css`
- Modify: `dashboard/tailwind.config.ts`
- Modify: `dashboard/src/components/ThemeToggle.tsx`
- Create: `dashboard/scripts/verify-visual-system.mjs`
- Modify: `dashboard/package.json`

- [ ] **Step 1: Add a failing visual-system verifier**

The script reads `globals.css`, `HomeDashboard.tsx` when present, and `tailwind.config.ts`, then asserts:

```javascript
assert.match(css, /--color-signal:\s*30 111 82/);
assert.doesNotMatch(css, /theme-wave/);
assert.doesNotMatch(css, /200 145 74/);
assert.doesNotMatch(css, /122 85 40/);
```

It must exit non-zero with a useful assertion message when any obsolete visual remains.

- [ ] **Step 2: Run the verifier and confirm it fails**

Run from `dashboard/`: `node scripts/verify-visual-system.mjs`

Expected: failures identify amber tokens and decorative orbit/constellation CSS.

- [ ] **Step 3: Replace color tokens**

Use these exact tokens:

```css
:root {
  color-scheme: light;
  --color-paper: 250 250 249;
  --color-ink: 24 28 27;
  --color-panel: 255 255 255;
  --color-muted: 94 102 98;
  --color-line: 220 224 221;
  --color-tag: 239 242 240;
  --color-signal: 30 111 82;
  --color-caution: 161 98 7;
  --color-fault: 185 28 28;
}

[data-theme="dark"] {
  color-scheme: dark;
  --color-paper: 14 17 16;
  --color-ink: 238 242 240;
  --color-panel: 20 24 22;
  --color-muted: 157 166 161;
  --color-line: 50 57 53;
  --color-tag: 31 37 34;
  --color-signal: 74 192 143;
  --color-caution: 245 190 71;
  --color-fault: 248 113 113;
}
```

Replace the theme-wave implementation with base body/selection styles, a focus-visible rule, and reduced-motion behavior. Keep the existing orbit and constellation rules until Task 2 removes their components, so the intermediate commit remains runnable. Do not add gradients.

- [ ] **Step 4: Simplify theme switching**

Keep the existing local theme preference but remove view-transition wave state and fallback elements. Render one icon button with `Sun` or `Moon`, an accessible label, and a visible focus ring.

- [ ] **Step 5: Register and run the verifier**

Add `"verify:visual": "node scripts/verify-visual-system.mjs"` to dashboard scripts.

Run: `npm run verify:visual && npm run typecheck` from `dashboard/`.

Expected: both commands pass.

- [ ] **Step 6: Commit the visual foundation**

```bash
git add dashboard/src/app/globals.css dashboard/tailwind.config.ts dashboard/src/components/ThemeToggle.tsx dashboard/scripts/verify-visual-system.mjs dashboard/package.json
git commit -m "style: replace the decorative AI visual system"
```

### Task 2: Separate Marketing and Product Layouts

**Files:**
- Modify: `dashboard/src/app/layout.tsx`
- Create: `dashboard/src/app/(marketing)/layout.tsx`
- Create: `dashboard/src/app/(marketing)/sign-in/[[...sign-in]]/page.tsx`
- Create: `dashboard/src/app/(marketing)/sign-up/[[...sign-up]]/page.tsx`
- Create: `dashboard/src/app/(product)/layout.tsx`
- Create: `dashboard/src/app/(marketing)/page.tsx`
- Delete: `dashboard/src/app/page.tsx`
- Create: `dashboard/src/app/(product)/overview/page.tsx`
- Move: `dashboard/src/app/memories/page.tsx` to `dashboard/src/app/(product)/memories/page.tsx`
- Move: `dashboard/src/app/chat/page.tsx` to `dashboard/src/app/(product)/chat/page.tsx`
- Move: `dashboard/src/app/logs/page.tsx` to `dashboard/src/app/(product)/logs/page.tsx`
- Move: `dashboard/src/app/graph/page.tsx` to `dashboard/src/app/(product)/graph/page.tsx`
- Move: `dashboard/src/app/settings/page.tsx` to `dashboard/src/app/(product)/settings/page.tsx`
- Create: `dashboard/src/components/MarketingHeader.tsx`
- Create: `dashboard/src/components/ProductShell.tsx`
- Create: `dashboard/src/components/OverviewDashboard.tsx`
- Delete: `dashboard/src/components/HomeDashboard.tsx`
- Delete: `dashboard/src/components/MemoryConstellation.tsx`
- Modify: `dashboard/src/components/EngramLogo.tsx`
- Modify: `dashboard/src/components/AuthControls.tsx`
- Create: `dashboard/scripts/verify-route-layouts.mjs`

- [ ] **Step 1: Add a failing route-layout verifier**

Assert that the root layout does not import `CommandPalette`, `ClerkEngramBridge`, or `DashboardShell`; the marketing layout does not import `@/lib/api`; and the product layout renders `ClerkEngramBridge` and `ProductShell`. Also assert that `globals.css` contains no `memory-hero-orbit` or `memory-constellation` rules after the old components are removed.

- [ ] **Step 2: Run the verifier and confirm it fails**

Run from `dashboard/`: `node scripts/verify-route-layouts.mjs`

Expected: failure because the dashboard shell is still global.

- [ ] **Step 3: Reduce the root layout**

Set metadata to:

```typescript
export const metadata: Metadata = {
  title: {
    default: "Engram | Memory infrastructure for AI products",
    template: "%s | Engram",
  },
  description: "Store, retrieve, and inspect durable memory for AI applications.",
};
```

The root layout renders `ClerkProvider` only when configured, then `Providers` and `{children}`. It must not render navigation, a footer, the Clerk bridge, or API-dependent components.

- [ ] **Step 4: Build the marketing layout**

The marketing layout renders `MarketingHeader`, a full-width `<main>`, and a compact footer with Docs, Pricing, GitHub, Privacy, and Terms links. Header actions are Sign in and Start free when Clerk is configured; local mode shows Docs and GitHub without a dead sign-in control.

- [ ] **Step 5: Build the product shell**

Use Lucide icons with text labels for Overview, Memories, Chat, Logs, Graph, and Settings. Desktop uses a restrained sidebar or top rail; mobile uses a menu button and drawer rather than a six-column fixed footer. Include `CommandPalette`, current plan usage, `ThemeToggle`, and account controls. Add `aria-current="page"` to the active destination.

The product layout renders:

```tsx
<ClerkEngramBridge />
<ProductShell>{children}</ProductShell>
```

- [ ] **Step 6: Move the existing tools and replace the old home**

Move memories, chat, logs, graph, and settings under the product route group so their URLs do not change. Move the old root page responsibility to `/overview`, but render a compact `OverviewDashboard` with real memory, pending-review, log, and provider queries rather than `HomeDashboard`.

Create a small working marketing root with the final headline, supporting sentence, Start free, and View docs actions. Task 3 expands this page without changing its route. Delete `HomeDashboard.tsx`, `MemoryConstellation.tsx`, and their orbit/constellation CSS after no imports remain.

Delete the old `dashboard/src/app/page.tsx` in the same change so Next.js has only one route for `/`.

- [ ] **Step 7: Simplify the Engram mark and auth actions**

Use the word `Engram` with one small square or database icon. Remove decorative letter spacing and serif styling. Sign-in and account actions remain visible at mobile widths.

- [ ] **Step 8: Add hosted sign-in and sign-up pages**

Render Clerk's `SignIn` and `SignUp` components at their catch-all routes when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is configured. In local mode, render a short self-hosted message linking to `/docs` instead of mounting a Clerk component without a provider.

- [ ] **Step 9: Run layout checks**

Run: `node scripts/verify-route-layouts.mjs && npm run typecheck` from `dashboard/`.

Expected: both checks pass.

- [ ] **Step 10: Commit layout separation**

```bash
git add dashboard/src/app dashboard/src/components/MarketingHeader.tsx dashboard/src/components/ProductShell.tsx dashboard/src/components/OverviewDashboard.tsx dashboard/src/components/HomeDashboard.tsx dashboard/src/components/MemoryConstellation.tsx dashboard/src/components/EngramLogo.tsx dashboard/src/components/AuthControls.tsx dashboard/src/app/globals.css dashboard/scripts/verify-route-layouts.mjs
git commit -m "feat: separate marketing and product layouts"
```

### Task 3: Build the Public Landing Page

**Files:**
- Modify: `dashboard/src/app/(marketing)/page.tsx`
- Create: `dashboard/src/components/LandingPage.tsx`
- Create: `dashboard/src/components/RetrievalTrace.tsx`
- Create: `dashboard/src/components/PricingTable.tsx`
- Modify: `dashboard/scripts/verify-route-layouts.mjs`

- [ ] **Step 1: Add failing public-page assertions**

Assert the public page imports `LandingPage`, does not import `HomeDashboard`, and contains no `@/lib/api`, `useQuery`, or `engram_api_key` reference. Assert the rendered copy includes `Memory infrastructure for AI products`.

- [ ] **Step 2: Run the verifier and confirm it fails**

Run from `dashboard/`: `node scripts/verify-route-layouts.mjs`

Expected: failure because `/` still renders `HomeDashboard`.

- [ ] **Step 3: Implement the real retrieval trace**

`RetrievalTrace` is a semantic, static product example with four columns or stacked mobile sections:

```typescript
const TRACE = {
  request: "What stack should I use for the new API?",
  memories: [
    { content: "Prefers FastAPI for Python backends", score: 0.91 },
    { content: "Uses TypeScript for frontend work", score: 0.84 },
  ],
  context: "[MEMORY CONTEXT]\n- Prefers FastAPI for Python backends\n- Uses TypeScript for frontend work",
  response: "Use FastAPI for the API and TypeScript for the client.",
};
```

Label Request, Retrieved memories, Injected context, and Model response. Use monospace only for score values and context. Do not animate scores or claim live activity.

- [ ] **Step 4: Implement landing copy and sections**

Use this hero copy:

```text
Memory infrastructure for AI products.
Store durable user context, retrieve the right memories, and inspect exactly what reaches the model.
```

Primary action: `Start free` to `/sign-up` when Clerk is configured, otherwise `/docs`. Secondary action: `View docs`.

Build these unframed full-width bands in order: hero and retrieval trace; OpenAI-compatible API/MCP/product proof; Store/Retrieve/Inspect workflow; memory ledger and retrieval-log product surfaces; concise integration code; pricing; open-source/self-hosting; FAQ; final action. Use real Engram interface rows and code, not abstract graphics, fake logos, or testimonials.

- [ ] **Step 5: Implement shared pricing table**

Show Free and Pro with the approved limits. Use two simple columns and one highlighted Pro border, not nested cards. Pro copy is `$29 per workspace / month`; both plans state `Bring your own model provider key`.

- [ ] **Step 6: Run public-page checks**

Run: `npm run verify:visual && node scripts/verify-route-layouts.mjs && npm run typecheck` from `dashboard/`.

Expected: all checks pass and `rg "MemoryConstellation|HomeDashboard|memory-hero-orbit|font-serif" dashboard/src` returns no matches.

- [ ] **Step 7: Commit the landing page**

```bash
git add "dashboard/src/app/(marketing)/page.tsx" dashboard/src/components/LandingPage.tsx dashboard/src/components/RetrievalTrace.tsx dashboard/src/components/PricingTable.tsx dashboard/scripts/verify-route-layouts.mjs
git commit -m "feat: build the Engram SaaS landing page"
```

### Task 4: Add Pricing, Documentation, and Legal Pages

**Files:**
- Create: `dashboard/src/app/(marketing)/pricing/page.tsx`
- Move: `dashboard/src/app/docs/page.tsx` to `dashboard/src/app/(marketing)/docs/page.tsx`
- Create: `dashboard/src/app/(marketing)/privacy/page.tsx`
- Create: `dashboard/src/app/(marketing)/terms/page.tsx`
- Modify: `dashboard/src/components/DocsCodeBlock.tsx`

- [ ] **Step 1: Create the pricing page**

Render `PricingTable`, a short usage-limits explanation, BYO-provider clarification, cancellation behavior, and links to self-hosting docs. Do not invent annual discounts or enterprise pricing.

- [ ] **Step 2: Make docs public and task-oriented**

Keep the existing API and MCP examples, but lead with a five-minute sequence: create a key, configure a provider, send a memory/proxy request, search memory, and connect MCP. Ensure code examples use `BAAI/bge-small-en-v1.5` where the embedding model is shown.

- [ ] **Step 3: Add privacy and terms pages**

Privacy must state what account, billing, memory, log, provider-key, and operational data is stored; that provider keys are encrypted; and how deletion works. Terms must cover account responsibility, acceptable use, self-hosted software licensing, subscription renewal/cancellation, service availability, and contact details. Add a visible note in the source review checklist that counsel must review both documents before accepting production payments.

- [ ] **Step 4: Run public-page type and build checks**

Run: `npm run typecheck && npm run build` from `dashboard/`.

Expected: routes `/`, `/pricing`, `/docs`, `/privacy`, and `/terms` build successfully.

- [ ] **Step 5: Commit public supporting pages**

```bash
git add "dashboard/src/app/(marketing)/pricing/page.tsx" "dashboard/src/app/(marketing)/docs/page.tsx" "dashboard/src/app/(marketing)/privacy/page.tsx" "dashboard/src/app/(marketing)/terms/page.tsx" dashboard/src/app/docs/page.tsx dashboard/src/components/DocsCodeBlock.tsx
git commit -m "feat: add public pricing docs and legal pages"
```

### Task 5: Complete the Product Overview

**Files:**
- Modify: `dashboard/src/components/OverviewDashboard.tsx`
- Modify: `dashboard/src/lib/api.ts`

- [ ] **Step 1: Add workspace and usage API contracts**

```typescript
export type Workspace = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  plan: "free" | "pro";
  created_at: string;
};
```

Add `api.orgs.list()` and use the `WorkspaceUsage` billing type created in the billing plan.

- [ ] **Step 2: Build onboarding state**

`OverviewDashboard` queries current user, workspace, usage, one memory, and one retrieval log. Show this checklist only while incomplete:

1. API key available.
2. Provider credential configured.
3. At least one memory exists.
4. At least one retrieval log exists.

Each row links to the exact next destination. Do not fabricate completion or activity.

- [ ] **Step 3: Build active workspace overview**

Show memory and retrieval usage meters, pending-review count, recent retrievals, and provider status. Use two-column desktop and one-column mobile layouts. Use plain sections with borders; no nested cards or oversized hero typography.

- [ ] **Step 4: Run route and type checks**

Run: `node scripts/verify-route-layouts.mjs && npm run typecheck && npm run build` from `dashboard/`.

Expected: all product URLs build and `/overview` is present.

- [ ] **Step 5: Commit the product overview**

```bash
git add dashboard/src/components/OverviewDashboard.tsx dashboard/src/lib/api.ts
git commit -m "feat: add authenticated product overview"
```

### Task 6: Restructure Settings Around SaaS Workflows

**Files:**
- Modify: `dashboard/src/components/SettingsPanel.tsx`
- Modify: `dashboard/src/lib/api.ts`
- Modify: `dashboard/scripts/verify-dashboard-logic.mjs`

- [ ] **Step 1: Add missing API-key and billing client methods**

Reuse `api.keys.list()`, `api.keys.create(name)`, and `api.keys.revoke(id)` from the foundation plan. Expose workspace metadata, usage, Checkout, Portal, and provider configuration through `api.ts`. Keep every network request in this file.

- [ ] **Step 2: Replace the long settings stream with six sections**

Render a compact anchor navigation followed by Workspace, Members, API keys, Providers, Billing, and Account. Hosted mode hides manual arbitrary user creation. Self-hosted mode retains the local `engram_api_key` form and bootstrap action.

Billing shows current plan, exact usage, period end, and one action: Upgrade to Pro for Free owners or Manage billing for Pro owners. Members show the plan member limit before invite controls. Provider settings include OpenAI, Gemini, Anthropic, and Ollama and state that hosted Engram does not supply model credits.

API keys lists name, created date, and last-used date. Creating a key shows the plaintext value once with a copy action. Revocation requires confirmation and invalidates the matching row without rotating unrelated keys.

- [ ] **Step 3: Preserve destructive-action safeguards**

Memory deletion and account deletion remain explicit buttons with confirmation. Do not place destructive actions next to billing or key rotation.

- [ ] **Step 4: Extend dashboard logic verification**

Assert the settings component contains all six section headings, hides manual hosted provisioning, routes Checkout/Portal through `api.billing`, and includes Anthropic key save/clear handling.

- [ ] **Step 5: Run settings checks**

Run: `npm run verify:logic && npm run verify:billing && npm run typecheck` from `dashboard/`.

Expected: all checks pass.

- [ ] **Step 6: Commit SaaS settings**

```bash
git add dashboard/src/components/SettingsPanel.tsx dashboard/src/lib/api.ts dashboard/scripts/verify-dashboard-logic.mjs
git commit -m "feat: organize SaaS workspace settings"
```

### Task 7: Restyle Existing Operational Views

**Files:**
- Modify: `dashboard/src/components/MemoryWorkspace.tsx`
- Modify: `dashboard/src/components/MemoryTable.tsx`
- Modify: `dashboard/src/components/MemoryCard.tsx`
- Modify: `dashboard/src/components/SearchBar.tsx`
- Modify: `dashboard/src/components/ChatWorkspace.tsx`
- Modify: `dashboard/src/components/LogsWorkspace.tsx`
- Modify: `dashboard/src/components/LogEntry.tsx`
- Modify: `dashboard/src/components/ScoreBadge.tsx`
- Modify: `dashboard/src/components/CommandPalette.tsx`
- Verify without overwriting: `dashboard/src/components/MemoryGraph.tsx`

- [ ] **Step 1: Remove the obsolete typography pattern**

Replace serif display type, Roman-numeral section labels, excessive uppercase tracking, and pill-shaped form controls with sentence-case system sans typography, `rounded-md` controls, and compact labels. Reserve monospace for keys, identifiers, scores, and code.

- [ ] **Step 2: Normalize operational states**

Each view must have one clear loading state, one empty state with a next action, and one error state that preserves retry. Tables must wrap long memory content, keep actions reachable, and avoid horizontal page overflow at 390px.

- [ ] **Step 3: Keep score semantics consistent**

`ScoreBadge` remains green above `0.8`, amber from `0.6` through `0.8`, and red below `0.6`. Add text or an accessible label so color is not the only signal.

- [ ] **Step 4: Verify the existing graph filter fix**

Inspect light and dark mode with non-zero and zero filter counts. Preserve the current uncommitted `MemoryGraph.tsx` contrast work and adjust only if the new tokens make a label fail contrast.

- [ ] **Step 5: Run source scans and checks**

Run: `rg -n "font-serif|§ [IVX]|tracking-\[0\.12em\]|memory-hero-orbit|MemoryConstellation" dashboard/src`

Expected: no matches.

Run: `npm run verify:visual && npm run verify:logic && npm run typecheck` from `dashboard/`.

Expected: all checks pass.

- [ ] **Step 6: Commit operational restyling**

```bash
git add dashboard/src/components dashboard/src/app/globals.css
git commit -m "style: make product views compact and operational"
```

Before committing, inspect `git diff -- dashboard/src/components/MemoryGraph.tsx` and confirm the pre-existing light-mode visibility fix remains present.

### Task 8: Verify the Full UI in a Real Browser

**Files:**
- Modify: `dashboard/scripts/verify-route-layouts.mjs`
- Modify: `README.md`

- [ ] **Step 1: Run static and production gates**

Run from `dashboard/`:

```bash
npm ci
npm run verify:clerk
npm run verify:billing
npm run verify:logic
npm run verify:visual
npm run typecheck
npm run build
```

Expected: every command exits `0`.

- [ ] **Step 2: Start the local production build**

Run from `dashboard/`: `npm run start`

Expected: `http://localhost:3001` responds with `200`.

- [ ] **Step 3: Capture desktop landing and product screenshots**

Use installed Edge headless mode:

```powershell
& "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --hide-scrollbars --window-size=1440,1200 --screenshot="$env:TEMP\engram-saas-desktop.png" http://localhost:3001/
```

Capture `/overview`, `/memories`, `/logs`, `/graph`, and `/settings` after local authentication is configured. Inspect each image with the image-viewing tool.

- [ ] **Step 4: Capture mobile screenshots**

```powershell
& "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" --headless --disable-gpu --hide-scrollbars --window-size=390,844 --screenshot="$env:TEMP\engram-saas-mobile.png" http://localhost:3001/
```

Capture the same product routes. Verify no overlap, clipping, horizontal scroll, hidden sign-in action, or inaccessible navigation.

- [ ] **Step 5: Perform keyboard and motion checks**

Tab through the marketing header, hero actions, pricing actions, product navigation, command palette, table actions, settings controls, and mobile menu. Verify visible focus, semantic labels, Escape behavior for overlays, and usable operation with reduced motion enabled.

- [ ] **Step 6: Verify public pages do not call account APIs**

Load `/`, `/pricing`, `/docs`, `/privacy`, and `/terms` with no API key. Confirm all render successfully and the API service receives no `/users`, `/memories`, `/logs`, `/graph`, or `/billing/usage` requests.

- [ ] **Step 7: Run the whole repository gate**

Run: `python -m pytest api`

Run from `mcp/`: `npm run build && npm run verify:defaults`

Run: `docker compose config`

Expected: all commands exit `0`.

- [ ] **Step 8: Confirm Azure cost neutrality**

Run: `git diff -- docker-compose.yml docker-compose.supabase.yml docker-compose.dev.yml api/Dockerfile dashboard/Dockerfile mcp/Dockerfile`

Expected: no Azure sizing, replica, registry, storage, queue, cache, or service additions.

- [ ] **Step 9: Commit verification documentation**

```bash
git add dashboard/scripts/verify-route-layouts.mjs README.md
git commit -m "test: verify SaaS product experience"
```

Skip this commit when neither file changed during verification.
