# Loop Motion Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair invisible loop cards and add fail-safe balanced landing transitions.

**Architecture:** Keep GSAP scoped inside `LandingMotion`, but never use animation-owned visibility for below-fold content. Add data hooks in the landing markup and use CSS for hover polish so the result remains usable without JavaScript.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, GSAP ScrollTrigger

---

### Task 1: Lock The Visibility Contract

**Files:**
- Modify: `dashboard/scripts/verify-visual-system.mjs`

- [ ] Add assertions requiring fail-safe loop motion and rejecting `autoAlpha` on loop cards.
- [ ] Run `npm run verify:visual` and confirm it fails on the current controller.

### Task 2: Repair And Refine Motion

**Files:**
- Modify: `dashboard/src/components/LandingMotion.tsx`
- Modify: `dashboard/src/components/LandingPage.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] Replace the hidden batch reveal with per-card transforms using `immediateRender: false`.
- [ ] Add section-heading hooks and small hover accents without new dependencies.
- [ ] Run `npm run verify:visual` and `npm run typecheck` until both pass.
- [ ] Verify desktop, mobile, and reduced-motion states in a real browser.
- [ ] Run the complete dashboard verification suite and production build.
