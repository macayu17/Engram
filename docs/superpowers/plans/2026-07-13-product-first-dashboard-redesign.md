# Product-First Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the overloaded Engram home hero with a compact product-first layout and one readable retrieval trace.

**Architecture:** Keep `HomeDashboard` responsible for live dashboard data and layout. Replace the decorative `MemoryConstellation` with a static `RetrievalTrace` presentational component made only from existing Tailwind utilities, then remove its obsolete global animation CSS.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 3

---

### Task 1: Lock the new visual contract

**Files:**
- Modify: `dashboard/scripts/verify-visual-system.mjs`

- [ ] **Step 1: Replace the old constellation assertions**

Read `src/components/RetrievalTrace.tsx` instead of `MemoryConstellation.tsx`. Assert that `HomeDashboard` renders `RetrievalTrace`, that the trace contains `Query`, `Ranked memories`, and `Injected context`, and that the home source no longer contains `memory-hero-orbit` or `MemoryConstellation`.

- [ ] **Step 2: Run the verifier and confirm it fails**

Run: `npm run verify:visual`

Expected: failure because `RetrievalTrace.tsx` does not exist yet.

### Task 2: Replace the hero and constellation

**Files:**
- Create: `dashboard/src/components/RetrievalTrace.tsx`
- Modify: `dashboard/src/components/HomeDashboard.tsx`
- Delete: `dashboard/src/components/MemoryConstellation.tsx`

- [ ] **Step 1: Build the static retrieval trace**

Create a named `RetrievalTrace` component with a compact bordered figure. Render three semantic stages labeled `Query`, `Ranked memories`, and `Injected context`. Use the existing amber signal color for scores and connector rules, theme tokens for all text and surfaces, and no JavaScript animation.

- [ ] **Step 2: Rebuild the hero layout**

Replace the current full-width layered hero with a responsive two-column grid. Use `min-h-[26rem]`, a desktop headline no larger than `text-6xl`, and a maximum copy width of `36rem`. Render `RetrievalTrace` in the second column.

- [ ] **Step 3: Move useful data into the first viewport**

Move the four existing `StatTile` instances directly below the hero grid inside the same section. Remove the duplicate standalone `§ I — The numbers` section and renumber the remaining section labels.

- [ ] **Step 4: Run the focused verifier and typecheck**

Run: `npm run verify:visual && npm run typecheck`

Expected: both commands pass.

- [ ] **Step 5: Commit the component change**

```bash
git add dashboard/scripts/verify-visual-system.mjs dashboard/src/components/HomeDashboard.tsx dashboard/src/components/RetrievalTrace.tsx dashboard/src/components/MemoryConstellation.tsx
git commit -m "style: simplify dashboard hero"
```

### Task 3: Remove obsolete visual layers and verify the result

**Files:**
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Delete unused hero animation CSS**

Remove every `.memory-hero-orbit*` and `.memory-constellation*` rule and the keyframes used only by those rules. Keep theme fallback styles and all unrelated dashboard styles unchanged.

- [ ] **Step 2: Run the frontend verification suite**

Run: `npm run verify:clerk && npm run verify:billing && npm run verify:logic && npm run verify:visual && npm run typecheck && npm run build`

Expected: every command exits successfully.

- [ ] **Step 3: Capture real browser evidence**

Capture `http://localhost:3001` with installed Chrome at `1440x1000` and `390x844`. Confirm the headline, trace, actions, and statistics are visible without overlap or clipping.

- [ ] **Step 4: Confirm repository hygiene**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors and only the intended CSS change remains.

- [ ] **Step 5: Commit the cleanup**

```bash
git add dashboard/src/app/globals.css
git commit -m "style: remove obsolete hero effects"
```
