# Product UI System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the landing page's approved visual system to every product route.

**Architecture:** Keep route behavior unchanged and concentrate consistency in the existing `AppFrame`, a small server-safe `ProductPageHeader`, and existing theme tokens. Route-specific edits are limited to replacing duplicated headers, normalizing controls, and updating the graph palette.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Clerk, react-force-graph

---

### Task 1: Add Product UI Contracts

**Files:**
- Modify: `dashboard/scripts/verify-visual-system.mjs`
- Modify: `dashboard/scripts/verify-clerk-setup.mjs`

- [ ] Require a shared product page header, active navigation state, Overview links, product skip target, landing-only Dashboard auth action, and current graph colors.
- [ ] Run the checks and confirm they fail on the missing behavior.

### Task 2: Align The Shared Product Shell

**Files:**
- Modify: `dashboard/src/components/AppFrame.tsx`
- Modify: `dashboard/src/components/AuthControls.tsx`
- Modify: `dashboard/src/components/LandingPage.tsx`

- [ ] Render desktop and mobile links from one route list.
- [ ] Add active route styles and `aria-current`.
- [ ] Add Overview navigation and a skip link.
- [ ] Restrict the signed-in Dashboard shortcut to the landing header.
- [ ] Run Clerk and type checks.

### Task 3: Standardize Product Headers And Controls

**Files:**
- Create: `dashboard/src/components/ProductPageHeader.tsx`
- Modify: `dashboard/src/components/MemoryWorkspace.tsx`
- Modify: `dashboard/src/components/ChatWorkspace.tsx`
- Modify: `dashboard/src/components/LogsWorkspace.tsx`
- Modify: `dashboard/src/components/SettingsPanel.tsx`

- [ ] Replace duplicated heading markup with the shared header.
- [ ] Normalize header actions and primary form controls to landing button geometry and interaction states.
- [ ] Run visual and type checks.

### Task 4: Update Graph And Verify Every Route

**Files:**
- Modify: `dashboard/src/components/MemoryGraph.tsx`

- [ ] Replace stale light canvas, sidebar, label, ring, and pin colors with the current neutral palette.
- [ ] Run all dashboard verification scripts and the production build.
- [ ] Capture desktop, mobile, light, and dark browser evidence with zero horizontal overflow and correct active navigation.
- [ ] Commit the verified implementation.
