# Balanced Landing Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add balanced, reference-inspired motion to the public Engram landing page while preserving its current layout, native scrolling, accessibility, and authenticated product routes.

**Architecture:** A single `LandingMotion` client component owns a scoped GSAP context, responsive ScrollTrigger setup, magnetic actions, and cleanup. `LandingPage.tsx` keeps all content and adds semantic motion hooks; existing CSS continues to own the repeating memory-flow animation.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, GSAP, ScrollTrigger, native `prefers-reduced-motion`

---

## File Map

- Create `dashboard/src/components/LandingMotion.tsx`: scoped GSAP setup, responsive pinning, score count-up, magnetic actions, and cleanup.
- Modify `dashboard/src/components/LandingPage.tsx`: wrap the landing content and add stable data attributes and hero masks.
- Modify `dashboard/src/app/globals.css`: remove the conflicting CSS hero entrance and retain reduced-motion behavior for repeating CSS effects.
- Modify `dashboard/scripts/verify-visual-system.mjs`: enforce the motion contract and exclusions.
- Modify `dashboard/package.json` and `dashboard/package-lock.json`: add only `gsap`.

### Task 1: Add The Motion Contract And Dependency

**Files:**
- Modify: `dashboard/scripts/verify-visual-system.mjs`
- Modify: `dashboard/package.json`
- Modify: `dashboard/package-lock.json`

- [ ] **Step 1: Extend the visual contract before implementation**

Add these reads and assertions to `dashboard/scripts/verify-visual-system.mjs`:

```javascript
const landingMotionPath = path.join(root, "src/components/LandingMotion.tsx");

assert.ok(fs.existsSync(landingMotionPath), "Landing motion controller must exist");
const landingMotion = read("src/components/LandingMotion.tsx");
assert.match(landingMotion, /gsap\.context/, "Landing motion must be scoped to its root");
assert.match(landingMotion, /gsap\.matchMedia/, "Landing pinning must be responsive");
assert.match(landingMotion, /prefers-reduced-motion/, "Landing motion must honor reduced motion");
assert.match(landingMotion, /context\.revert\(\)/, "Landing motion must clean up on unmount");
assert.match(landing, /LandingMotion/, "Landing page must use the motion controller");
assert.match(landing, /data-motion="interfaces-track"/, "Interfaces must expose a horizontal motion track");
assert.doesNotMatch(landingMotion, /Lenis|cursor-ring|preloader/, "Balanced motion must exclude cinematic behavior");
```

- [ ] **Step 2: Run the contract and verify it fails**

Run:

```powershell
npm run verify:visual
```

Expected: FAIL because `src/components/LandingMotion.tsx` does not exist.

- [ ] **Step 3: Add GSAP as the only motion dependency**

Run:

```powershell
npm install gsap
```

Expected: `gsap` appears in `dependencies`; no Lenis, Framer Motion, or cursor package is added.

- [ ] **Step 4: Verify the dependency diff**

Run:

```powershell
git diff -- dashboard/package.json dashboard/package-lock.json
```

Expected: only GSAP dependency and lockfile resolution changes.

### Task 2: Implement The Scoped Motion Controller

**Files:**
- Create: `dashboard/src/components/LandingMotion.tsx`

- [ ] **Step 1: Create the client component and reduced-motion boundary**

Create `dashboard/src/components/LandingMotion.tsx` with this structure:

```tsx
"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, useRef } from "react";

export function LandingMotion({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const listenerCleanups: Array<() => void> = [];
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      const heroTimeline = gsap.timeline({ defaults: { ease: "power4.out" } });
      heroTimeline
        .from("[data-motion='hero-line']", { yPercent: 110, duration: 0.85, stagger: 0.09 })
        .from("[data-motion='hero-support']", { autoAlpha: 0, y: 18, duration: 0.55, stagger: 0.07 }, "-=0.45")
        .from("[data-motion='hero-demo']", { autoAlpha: 0, x: 28, duration: 0.7 }, "-=0.5");

      gsap.fromTo(
        "[data-motion='problem-word']",
        { opacity: 0.14 },
        {
          opacity: 1,
          stagger: 0.025,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-motion='problem-copy']",
            start: "top 78%",
            end: "bottom 55%",
            scrub: true,
          },
        },
      );

      gsap.from("[data-motion='loop-card']", {
        autoAlpha: 0,
        y: 34,
        duration: 0.65,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: { trigger: "[data-motion='loop-grid']", start: "top 78%", once: true },
      });

      gsap.utils.toArray<HTMLElement>("[data-motion='reveal']").forEach((element) => {
        gsap.from(element, {
          autoAlpha: 0,
          y: 28,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: element, start: "top 84%", once: true },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-score]").forEach((element, index) => {
        const finalScore = Number(element.dataset.score);
        const scoreGroup = element.closest<HTMLElement>("[data-motion='score-group']");
        if (!scoreGroup) return;
        const counter = { value: 0 };
        gsap.to(counter, {
          value: finalScore,
          duration: 0.8,
          delay: index * 0.12,
          ease: "power2.out",
          onStart: () => { element.textContent = "0.00"; },
          onUpdate: () => { element.textContent = counter.value.toFixed(2); },
          onComplete: () => { element.textContent = finalScore.toFixed(2); },
          scrollTrigger: { trigger: scoreGroup, start: "top 82%", once: true },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-magnetic]").forEach((element) => {
        const moveX = gsap.quickTo(element, "x", { duration: 0.35, ease: "power3.out" });
        const moveY = gsap.quickTo(element, "y", { duration: 0.35, ease: "power3.out" });
        const handleMove = (event: PointerEvent) => {
          const bounds = element.getBoundingClientRect();
          moveX((event.clientX - bounds.left - bounds.width / 2) * 0.12);
          moveY((event.clientY - bounds.top - bounds.height / 2) * 0.12);
        };
        const handleLeave = () => { moveX(0); moveY(0); };
        element.addEventListener("pointermove", handleMove);
        element.addEventListener("pointerleave", handleLeave);
        listenerCleanups.push(() => {
          element.removeEventListener("pointermove", handleMove);
          element.removeEventListener("pointerleave", handleLeave);
        });
      });

      media.add("(min-width: 1024px)", () => {
        const section = root.querySelector<HTMLElement>("[data-motion='interfaces-section']");
        const track = root.querySelector<HTMLElement>("[data-motion='interfaces-track']");
        if (!section || !track) return;
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 80);
        gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
      });
    }, root);

    return () => {
      listenerCleanups.forEach((cleanup) => cleanup());
      media.revert();
      context.revert();
    };
  }, []);

  return <div ref={rootRef}>{children}</div>;
}
```

- [ ] **Step 2: Run TypeScript and observe the expected remaining contract failure**

Run:

```powershell
npm run typecheck
npm run verify:visual
```

Expected: TypeScript passes. Visual verification still fails because `LandingPage.tsx` does not yet use `LandingMotion` or expose the interface track.

### Task 3: Add Stable Motion Hooks To The Existing Landing Page

**Files:**
- Modify: `dashboard/src/components/LandingPage.tsx`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Import the motion controller and define problem copy once**

Add:

```tsx
import { LandingMotion } from "@/components/LandingMotion";

const problemCopy = "Ship anything on top of a raw LLM API and it forgets the user the moment the request ends. Every team then rebuilds the same three bad options:";
```

- [ ] **Step 2: Wrap the existing landing root without changing route behavior**

Replace the opening landing root:

```tsx
<div className="min-h-screen w-full max-w-full overflow-x-hidden bg-paper text-ink">
```

with:

```tsx
<LandingMotion>
  <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-paper text-ink">
```

Then replace the closing root immediately after `<LandingFooter />`:

```tsx
</div>
```

with:

```tsx
  </div>
</LandingMotion>
```

- [ ] **Step 3: Convert the hero lines into overflow masks**

Use this exact heading structure:

```tsx
<h1 className="mt-6 max-w-[42rem] font-serif text-[clamp(3rem,6.4vw,5.4rem)] font-semibold leading-[0.98] tracking-[-0.025em]">
  <span className="block overflow-hidden"><span data-motion="hero-line" className="block">Every model</span></span>
  <span className="block overflow-hidden"><span data-motion="hero-line" className="block">forgets. Engram</span></span>
  <span className="block overflow-hidden"><span data-motion="hero-line" className="block italic text-signal">remembers.</span></span>
</h1>
```

Add `data-motion="hero-support"` to the kicker, supporting paragraph, actions row, and feature strip. Add `data-motion="hero-demo"` to the root element returned by `MemoryFlowDemo`.

- [ ] **Step 4: Add word reveal hooks without changing accessible text**

Replace the problem paragraph content with:

```tsx
<p data-motion="problem-copy" className="mt-6 text-pretty font-serif text-xl leading-[1.65] text-muted">
  {problemCopy.split(" ").map((word, index) => (
    <span key={`${word}-${index}`} data-motion="problem-word">{word}{" "}</span>
  ))}
</p>
```

- [ ] **Step 5: Add loop and generic reveal hooks**

Add `data-motion="loop-grid"` to the six-step grid and `data-motion="loop-card"` to each loop article. Add `data-motion="reveal"` only to the quickstart terminal, comparison table wrapper, retrieval log demo root, provider row, and final CTA content.

- [ ] **Step 6: Convert the interface cards into the responsive motion track**

Apply these exact tag and class replacements while leaving each interface article's existing children unchanged:

```tsx
<section id="interfaces" className="border-b border-line">
<section id="interfaces" data-motion="interfaces-section" className="border-b border-line">

<PageContainer className="py-20 md:py-24">
<PageContainer className="overflow-visible py-20 md:py-24">

<div className="mt-11 grid grid-flow-dense gap-5 lg:grid-cols-3">
<div data-motion="interfaces-track" className="mt-11 grid gap-5 lg:flex lg:w-max">

<article key={item.title} className="group flex min-h-[22rem] flex-col overflow-hidden rounded-lg border border-line bg-panel transition hover:-translate-y-1 hover:border-signal/60">
<article key={item.title} className="group flex min-h-[22rem] flex-col overflow-hidden rounded-lg border border-line bg-panel transition hover:-translate-y-1 hover:border-signal/60 lg:w-[min(72vw,48rem)] lg:shrink-0">
```

- [ ] **Step 7: Add score and magnetic hooks**

For each visible score span in `MemoryFlowDemo` and `RetrievalLogDemo`, preserve the final text and add `data-score={score}`. Add `data-motion="score-group"` to each containing memory list. Add `data-magnetic` to the hero Docker action and final GitHub action.

- [ ] **Step 8: Remove the conflicting CSS entrance**

Delete these rules from `dashboard/src/app/globals.css`:

```css
.landing-hero-copy,
.landing-flow {
  animation: landing-enter 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.landing-flow {
  animation-delay: 120ms;
}

@keyframes landing-enter {
  from {
    opacity: 0;
    transform: translateY(18px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Remove `.landing-hero-copy` and `.landing-flow` from the reduced-motion selector because GSAP now owns their entrance. Keep the repeating beam, pulse, memory-row, and cursor reduced-motion rules.

- [ ] **Step 9: Run the focused checks**

Run:

```powershell
npm run verify:visual
npm run typecheck
```

Expected: both pass.

### Task 4: Verify Behavior And Preserve Product Routes

**Files:**
- Test: `dashboard/scripts/verify-visual-system.mjs`
- Test: existing dashboard verification scripts

- [ ] **Step 1: Run all repository checks with stop-on-failure behavior**

Run from `dashboard`:

```powershell
$checks = @('verify:visual','verify:clerk','verify:billing','verify:logic','typecheck','build')
foreach ($check in $checks) {
  npm run $check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Expected: every script passes and the production build includes `/` and `/overview`.

- [ ] **Step 2: Verify the real browser at desktop and mobile widths**

Open `http://localhost:3001` in Chromium and verify:

```text
1440 x 1000, dark theme
1440 x 1000, light theme
390 x 844, dark theme with mobile device emulation
```

At each viewport, evaluate:

```javascript
({
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  overlay: Boolean(document.querySelector("[data-nextjs-dialog], .vite-error-overlay")),
  sections: document.querySelectorAll("main section").length,
})
```

Expected: `overflow` is `0`, `overlay` is `false`, and `sections` is `9`.

- [ ] **Step 3: Exercise the pinned interface sequence**

At 1440 pixels wide, scroll through `#interfaces` and confirm the section pins once, all three cards become fully visible in order, and normal vertical scrolling resumes afterward. At 390 pixels wide, confirm the same cards remain a vertical list with no pinning.

- [ ] **Step 4: Exercise reduced motion**

Enable `prefers-reduced-motion: reduce`, reload `/`, and confirm the hero and all sections are visible immediately while the repeating memory beam, pulse, rows, and cursor remain static.

- [ ] **Step 5: Confirm the diff is frontend-only and clean**

Run:

```powershell
git diff --check
git diff --name-only
```

Expected: only dashboard frontend files, package metadata, and the approved design/plan documents are listed. No Azure, API, database, or deployment file changes appear.

- [ ] **Step 6: Commit the implementation**

Run:

```powershell
git add dashboard/package.json dashboard/package-lock.json dashboard/scripts/verify-visual-system.mjs dashboard/src/components/LandingMotion.tsx dashboard/src/components/LandingPage.tsx dashboard/src/app/globals.css
git commit -m "feat: add balanced landing motion"
```

Expected: one implementation commit containing the scoped motion system and its verification contract.
