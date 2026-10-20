# Landing Cinematic Redesign Implementation Plan

> **For agentic workers:** Spec: `docs/superpowers/specs/2026-07-17-landing-cinematic-redesign-design.md`. Steps use checkbox (`- [ ]`) syntax. Git commits are NOT part of this plan — the repo owner commits manually on request.

**Goal:** Replace the section-based landing with a ~1200vh scroll-controlled typographic film ("MODELS FORGET. ENGRAM REMEMBERS.") inside the existing dashboard Next.js app.

**Architecture:** Server-rendered semantic scene sections + per-scene GSAP timelines (scrubbed pins) orchestrated by a client `LandingMotion` wrapper that owns Lenis smooth scrolling. All copy lives in `landing/copy.ts`. Landing uses its own scene-scoped palette variables (`--lp/--li/--ll/--lm/--lsignal`) so dashboard theming cannot leak in. Reduced-motion and mobile get a static/vertical fallback via `motion-safe:` Tailwind variants + `gsap.matchMedia`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 3.4, GSAP 3.15 + ScrollTrigger, `lenis` (new), Archivo variable font (next/font).

---

## Conventions used by every scene

- Scene root: `<section data-scene="slug" data-theme-scene="dark|paper|signal" className="landing-scene ...">`.
- Scene palette classes come from Task 1: `bg-lp text-li border-ll text-lm bg-lsignal text-lsignal border-lsignal`.
- All scrubbed animations use `.from()` / `.fromTo()` so the no-animation state (reduced motion, no-JS) is the final readable state.
- Display words that need per-letter control render as `aria-hidden` letter spans plus an `sr-only` heading with the real text.
- Overlapping absolute layers use `motion-safe:absolute motion-safe:inset-0`; in reduced motion they stack statically.
- Timeline hook from Task 3: `useSceneTimeline(ref, ({ isDesktop }) => { ... })` — creates a `gsap.context` scoped to the section, skipped under `prefers-reduced-motion`.

---

### Task 1: Deps, font, Tailwind palette, globals.css

**Files:**
- Modify: `dashboard/package.json` (add `"lenis": "^1.3.4"` to dependencies)
- Modify: `dashboard/src/app/layout.tsx`
- Modify: `dashboard/tailwind.config.ts`
- Modify: `dashboard/src/app/globals.css`

- [ ] **Step 1: Install lenis**

Run: `npm install lenis@^1.3.4` in `dashboard/`.

- [ ] **Step 2: Add Archivo to layout.tsx**

```ts
import { Archivo, Geist, Geist_Mono, Newsreader } from "next/font/google";
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap", axes: ["wdth"] });
```
Add `${archivo.variable}` to the `<html>` className list.

- [ ] **Step 3: tailwind.config.ts — landing palette + display font**

```ts
fontFamily: {
  display: ["var(--font-archivo)", "system-ui", "sans-serif"],
  // keep serif/sans/mono
},
colors: {
  // keep existing tokens
  lp: "rgb(var(--lp) / <alpha-value>)",
  li: "rgb(var(--li) / <alpha-value>)",
  ll: "rgb(var(--ll) / <alpha-value>)",
  lm: "rgb(var(--lm) / <alpha-value>)",
  lsignal: "rgb(var(--lsignal) / <alpha-value>)",
},
```

- [ ] **Step 4: globals.css — landing scene palettes; delete obsolete landing CSS**

Add (tokens pinned so dashboard theme cannot leak into the film):

```css
.landing-scope {
  --lp: 11 10 9;
  --li: 244 239 229;
  --ll: 55 51 44;
  --lm: 166 160 148;
  --lsignal: 90 168 158;
}

.landing-scene[data-theme-scene="dark"] {
  --lp: 11 10 9; --li: 244 239 229; --ll: 55 51 44; --lm: 166 160 148;
}

.landing-scene[data-theme-scene="paper"] {
  --lp: 224 222 215; --li: 25 27 25; --ll: 194 197 190; --lm: 91 96 90;
}

.landing-scene[data-theme-scene="signal"] {
  --lp: 90 168 158; --li: 11 10 9; --ll: 11 10 9; --lm: 30 58 54;
}

.landing-nav[data-nav-theme="dark"] {
  --lp: 11 10 9; --li: 244 239 229; --ll: 55 51 44; --lm: 166 160 148;
}

.landing-nav[data-nav-theme="paper"] {
  --lp: 224 222 215; --li: 25 27 25; --ll: 194 197 190; --lm: 91 96 90;
}

.landing-nav[data-nav-theme="signal"] {
  --lp: 90 168 158; --li: 11 10 9; --ll: 11 10 9; --lm: 30 58 54;
}
```

Delete the obsolete block: `.memory-hero-frame`, `.landing-grid` (+`::before`), `.landing-beam`, `.landing-pulse`, `.landing-memory-row`, `.landing-delay-1/2`, `.landing-cursor`, `.landing-cta::before`, and their `@keyframes` + reduced-motion references. Keep everything theme-wave/view-transition related and the token assertions (`--color-signal: 90 168 158;` etc.) untouched.

- [ ] **Step 5: Verify**

Run: `npm run build` in `dashboard/` — compiles (landing still old at this point; only font/config added).

---

### Task 2: `landing/copy.ts` — single copy source

**Files:**
- Create: `dashboard/src/components/landing/copy.ts`

- [ ] **Step 1: Write the module**

```ts
export const copy = {
  loader: { brand: "ENGRAM", status: "INITIALIZING" },
  nav: {
    items: [
      { index: "01", label: "LOOP", href: "#loop" },
      { index: "02", label: "CONTEXT", href: "#context" },
      { index: "03", label: "INTERFACES", href: "#interfaces" },
      { index: "04", label: "START", href: "#start" },
    ],
    github: "https://github.com/macayu17/Engram",
    dashboard: "/overview",
    cta: "OPEN DASHBOARD",
  },
  forget: {
    word: "FORGET.",
    meta: [
      "EVERY LLM API CALL FORGETS THE USER",
      "THE MOMENT THE REQUEST ENDS.",
    ],
    side: "SELF-HOSTABLE MEMORY LAYER · OPEN SOURCE · MIT",
    hint: "SCROLL TO REMEMBER",
  },
  engram: {
    word: "ENGRAM",
    support: "A MEMORY LAYER BETWEEN YOUR APP AND ANY MODEL.",
  },
  loop: {
    heading: "RETRIEVE. FORWARD. LEARN.",
    stages: [
      { n: "01", name: "EMBED", line: "The message is embedded locally. BGE-small, 384 dimensions, no API cost." },
      { n: "02", name: "SEARCH", line: "pgvector cosine search over everything the user has ever told you." },
      { n: "03", name: "RANK", line: "A cross-encoder reranks. The 0.70 threshold rejects weak matches." },
      { n: "04", name: "INJECT", line: "Surviving facts fold into the system prompt as a memory block." },
      { n: "05", name: "FORWARD", line: "The enriched request goes to your provider. The reply streams back." },
      { n: "06", name: "LEARN", line: "After the reply, durable facts are extracted, deduplicated, stored." },
    ],
    axis: ["0.0", "0.5", "0.7", "1.0"],
  },
  context: {
    query: "what backend should I use?",
    axisLabel: "SIMILARITY",
    threshold: "THRESHOLD 0.70",
    memories: [
      { score: "0.91", text: "Prefers FastAPI over Flask for backends", rejected: false },
      { score: "0.84", text: "Building SENTINEL, a market simulator", rejected: false },
      { score: "0.71", text: "Wants concise answers, no filler", rejected: false },
      { score: "0.52", text: "Asked about the weather once", rejected: true },
      { score: "0.43", text: "Said thanks at the end", rejected: true },
    ],
    labels: ["LOCAL EMBEDDINGS · BGE-SMALL", "PGVECTOR COSINE SEARCH", "EVERY RETRIEVAL LOGGED"],
  },
  interfaces: {
    slides: [
      { index: "01", word: "PROXY", line: "ONE URL. THE WHOLE LOOP.", tech: "POST /v1/chat · OPENAI-COMPATIBLE" },
      { index: "02", word: "API", line: "EVERY MEMORY, ADDRESSABLE.", tech: "SEARCH · ADD · UPDATE · DELETE · LOGS" },
      { index: "03", word: "MCP", line: "SEVEN TOOLS. NATIVE TO AGENTS.", tech: "SEARCH_MEMORIES · CAPTURE_CONVERSATION · GET_RETRIEVAL_LOG" },
    ],
  },
  index: {
    mark: "EN",
    rows: [
      ["RUNTIME", "DOCKER COMPOSE"],
      ["STORAGE", "POSTGRESQL + PGVECTOR"],
      ["EMBEDDINGS", "LOCAL · BGE-SMALL"],
      ["RERANK", "MS-MARCO CROSS-ENCODER"],
      ["ENDPOINT", "OPENAI-COMPATIBLE"],
      ["PROTOCOL", "MCP · 7 TOOLS"],
      ["LICENSE", "MIT"],
    ],
    final: "EVERYTHING INSPECTABLE. NOTHING HIDDEN.",
  },
  climax: { lines: ["MODELS FORGET.", "ENGRAM REMEMBERS."], mark: "ENGRAM" },
  cta: {
    heading: "SELF-HOST MEMORY IN ONE COMMAND.",
    command: "docker compose up -d",
    source: "READ THE SOURCE",
    technical: "github.com/macayu17/Engram · npm i engramd",
    footer: "MIT LICENSE · © 2026 AYUSH",
    site: "engram.ayushh.in",
    giant: "ENGRAM",
  },
} as const;
```

---

### Task 3: Motion core — `LandingMotion.tsx` + `useSceneTimeline.ts`

**Files:**
- Modify: `dashboard/src/components/LandingMotion.tsx` (full rewrite)
- Create: `dashboard/src/components/landing/useSceneTimeline.ts`

- [ ] **Step 1: `useSceneTimeline.ts`**

```ts
"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, type RefObject } from "react";

gsap.registerPlugin(ScrollTrigger);

export function useSceneTimeline(
  ref: RefObject<HTMLElement | null>,
  build: (tools: { root: HTMLElement; isDesktop: boolean }) => void,
) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      const media = gsap.matchMedia();
      media.add("(min-width: 1024px)", () => build({ root, isDesktop: true }));
      media.add("(max-width: 1023px)", () => build({ root, isDesktop: false }));
    }, root);

    return () => context.revert();
  }, [ref, build]);
}
```

(Scene components wrap `build` in `useCallback` with no deps.)

- [ ] **Step 2: `LandingMotion.tsx` rewrite — Lenis + shared setup**

```tsx
"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useLayoutEffect, useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

export function LandingMotion({ children, className }: { children: React.ReactNode; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ lerp: 0.1, anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const refresh = () => ScrollTrigger.refresh();
    document.fonts.ready.then(refresh).catch(() => undefined);
    window.addEventListener("load", refresh);

    return () => {
      window.removeEventListener("load", refresh);
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return <div ref={rootRef} className={className}>{children}</div>;
}
```

---

### Task 4: `Loader.tsx` + `LandingNav.tsx`

**Files:**
- Create: `dashboard/src/components/landing/Loader.tsx`
- Create: `dashboard/src/components/landing/LandingNav.tsx`

- [ ] **Step 1: Loader** — client component; renders nothing until mounted (SSR/no-JS safe); nothing at all under reduced motion. Fixed `z-[60] bg-lp text-li` overlay: brand `ENGRAM` top-left (mono, xs, tracking widest); a 1px line at `top-[78vh]` scaleX 0→1; bottom-left mono `INITIALIZING 000%`. Timeline (≤1.4s total): counter object 0→100 over 0.85s (`ease: "power2.inOut"`, tabular text update), line scaleX 0→1 over 0.5s, then overlay `clipPath: inset(0 0 100% 0)` exit over 0.45s `power3.inOut`, then `setDone` → unmount. The 78vh line position matches SceneForget's baseline rule position.

- [ ] **Step 2: LandingNav** — fixed top, `landing-nav` class, `data-nav-theme` state (default `"dark"`). Left: `<a href="#top">ENGRAM</a>` (display font, sm, bold). Center (hidden lg:flex): `copy.nav.items` as mono xs links with index prefixes; active item gets `text-lsignal`. Right: `GITHUB ↗` (external, mono xs) + `OPEN DASHBOARD` (`/overview`, sharp rectangle border `border-ll px-3 py-2`, hover invert via `hover:bg-li hover:text-lp transition-colors`). Bottom: 1px `bg-ll/40` hairline with a `bg-lsignal origin-left scaleX-0` progress bar.

Scroll wiring (inside a `gsap.context` in the nav, skipped under reduced motion):
- Progress: `ScrollTrigger.create({ start: 0, end: "max", onUpdate: self => gsap.set(bar, { scaleX: self.progress }) })`.
- Theme + active item: one `ScrollTrigger.create` per `[data-scene]` section with `start: "top center", end: "bottom center"`, `onToggle: self => { if (self.isActive) { setTheme(section.dataset.themeScene); setActive(section.dataset.scene); } }`.
- Scene ids ↔ nav hrefs: `forget→""`, `loop→#loop`, `context→#context`, `interfaces→#interfaces`, `cta→#start`.

---

### Task 5: Scene 01 `SceneForget.tsx` + Scene 02 `SceneEngram.tsx`

**Files:**
- Create: `dashboard/src/components/landing/SceneForget.tsx`
- Create: `dashboard/src/components/landing/SceneEngram.tsx`

- [ ] **Step 1: FORGET** — `data-theme-scene="dark"`, `id="top"`, `relative flex h-screen flex-col justify-end overflow-hidden bg-lp text-li`. `sr-only` `<h1>Every model forgets. Engram remembers.</h1>`. Word `FORGET.` as 7 `aria-hidden` inline-block letter spans, `font-display font-black uppercase leading-[0.8] tracking-[-0.03em] text-[clamp(5rem,23vw,24rem)]`. Meta lines (mono xs uppercase, two clipped reveals) + side line + hairline baseline at `top-[78vh]` + `SCROLL TO REMEMBER` bottom-right with a short vertical hairline.

Timeline (`end: "+=160%"`, `pin: true`, `scrub: 0.8`, `anticipatePin: 1`):
- Letters fall: `to(letters, { yPercent: 150, rotation: i => (i % 2 ? 9 : -7), autoAlpha: 0.12, stagger: 0.055, ease: "power2.in", duration: 1 })`
- Meta/side/hint fade upward slightly and out during first 30%.
- Load-in (non-scrubbed, plays after loader): letters `from({ yPercent: 112, stagger: 0.06, duration: 0.9, ease: "power4.out" })`, meta `from({ clipPath: "inset(100% 0 0 0)", y: 12 })`. Gate behind custom window event `landing:enter` dispatched by Loader completion; if no loader (reduced motion), play immediately on mount.
- Mobile: same, word `text-[26vw]`.

- [ ] **Step 2: ENGRAM** — `data-theme-scene="dark"`, `relative h-screen overflow-hidden bg-lp text-li`. Layers: (a) `paper-reveal` absolute inset `bg-[rgb(224_222_215)]` with `clipPath: circle(0% at 42% 50%)` (motion-safe only); (b) word `ENGRAM` as 6 letter spans full-width, `text-[clamp(4rem,17vw,18rem)]`, origin at the G (~42% 50%); (c) support line bottom (mono xs). `sr-only` `<h2>Engram — a memory layer between your app and any model.</h2>`.

Timeline (`end: "+=140%"`, pin, scrub 0.8):
- 0–40%: letters assemble: `from({ yPercent: () => gsap.utils.random(60, 140), rotation: () => gsap.utils.random(-24, 24), autoAlpha: 0, stagger: 0.06, ease: "power2.out" })` + support `from({ clipPath: "inset(100% 0 0 0)" })`.
- 45–100%: `to(wordWrap, { scale: 9, ease: "power2.in" })` + `to(wordWrap, { autoAlpha: 0 }, "<55%")` + `to(reveal, { clipPath: "circle(150% at 42% 50%)", ease: "power1.inOut" }, "<")`.
- End state fully paper — seamless handoff to SceneLoop (paper).
- Mobile: same idea, scale 6.

---

### Task 6: Scene 03 `SceneLoop.tsx` (paper rail)

**Files:**
- Create: `dashboard/src/components/landing/SceneLoop.tsx`

- [ ] **Step 1: Desktop rail** — `id="loop"`, `data-theme-scene="paper"`, `relative h-screen overflow-hidden bg-lp text-li`. Header top-left: mono label `§ 01 — THE LOOP` + display heading `RETRIEVE. FORWARD. LEARN.` (`text-[clamp(2.4rem,5.5vw,5.5rem)]`). Fixed marker: vertical 1px line at `left-[38%]` full height with a small signal tick. Rail: `motion-safe:flex motion-safe:w-max` track of 6 stage blocks, each `w-[34vw] shrink-0 border-l border-ll pl-8`: giant mono number `text-[11vw] leading-none tabular-nums`, name display `text-[2.6vw]`, one-liner `text-lm max-w-[26rem]`. Bottom: hairline score axis with tick labels from `copy.loop.axis` (`from({ autoAlpha: 0 })` at timeline end).

Timeline (`end: "+=220%"`, pin, scrub 1, `invalidateOnRefresh: true`):
- `to(track, { x: () => -(track.scrollWidth - innerWidth + markerX), ease: "none" })` where `markerX = innerWidth * 0.38`.
- Active stage: `onUpdate` — for each stage, distance from its center to marker; nearest gets `text-lsignal` on its number + full `text-li` name; others `text-lm`. Implement via `gsap.utils` in the timeline's `onUpdate`, toggling classes only when the active index changes.
- Mobile: no pin; stages stack vertically (`flex-col`), each `from({ y: 40, autoAlpha: 0 })` on enter (`once: true`), marker becomes a left-edge signal border on the active card.

---

### Task 7: Scene 04 `SceneContext.tsx` (paper horizontal retrieval)

**Files:**
- Create: `dashboard/src/components/landing/SceneContext.tsx`

- [ ] **Step 1: Desktop** — `id="context"`, `data-theme-scene="paper"`, `relative h-screen overflow-hidden bg-lp text-li`. Pinned top: mono label `§ 02 — RETRIEVAL` + giant query in display lowercase `text-[clamp(2.6rem,7vw,7.5rem)]`: `what backend should I use?`. Score axis hairline under the query with ticks `0.0 0.5 0.7 1.0`; signal threshold tick at 70% labeled `THRESHOLD 0.70`. Track (`motion-safe:flex motion-safe:w-max items-end gap-[8vw]`) of 5 memory fragments: big mono score `text-[9vw] tabular-nums` + text `max-w-[22rem]`. Accepted fragments `text-li`; rejected ones `text-lm line-through decoration-lsignal/70` with a mono `REJECTED` tag. Labels row (mono xs, from `copy.context.labels`). Final element in track: enlarged `0.91` (`text-[16vw] text-lsignal`).

Timeline (`end: "+=240%"`, pin, scrub 1):
- `to(track, { x: () => -(track.scrollWidth - innerWidth + 96), ease: "none" })`.
- Scores count: each accepted score `fromTo(textContent 0 → value)` driven by a `from({ })`… implement as: on first enter (`once: true`, non-scrubbed) run a counter tween per score; scrubbed track movement is separate.
- End (last 20%): dark circle clip from the `0.91` position: overlay layer `bg-[rgb(11_10_9)]` absolute inset `clipPath: circle(0% at 78% 60%)` → `circle(150% …)`, plus `to(score091, { scale: 1.6 })`. Handoff to dark SceneInterfaces.
- Mobile: vertical stack; query static; fragments `from({ y: 40, autoAlpha: 0 })` on enter; no clip-circle (simple bg change).

---

### Task 8: Scene 05 `SceneInterfaces.tsx` (PROXY→API→MCP)

**Files:**
- Create: `dashboard/src/components/landing/SceneInterfaces.tsx`

- [ ] **Step 1: Desktop** — `id="interfaces"`, `data-theme-scene="dark"`, `relative h-screen overflow-hidden bg-lp text-li`. One pinned viewport, three slide groups `motion-safe:absolute motion-safe:inset-0` (PROXY visible initially, API/MCP `autoAlpha: 0` via `from`-based choreography set initial states with `gsap.set` inside timeline build). Each slide: mono index label top-left (`01 / PROXY`…), giant word center `text-[clamp(6rem,20vw,22rem)] font-display font-black`, sub line bottom-left (display, `text-[2vw]`), tech line bottom-right (mono xs). Between slides: 5 shared "column" divs (`absolute top-0 bottom-0 w-px bg-li/70`, `autoAlpha: 0`).

Timeline (`end: "+=300%"`, pin, scrub 1):
- 0–22%: PROXY word expands: `to(proxyWord, { fontVariationSettings: '"wdth" 125', ease: "none" })` (Archivo wdth axis), letter-spacing tightens.
- 22–35%: word fades (`autoAlpha: 0, filter: none`); columns `fromTo({ autoAlpha: 0, scaleY: 0 } → { autoAlpha: 1, scaleY: 1 })` at x-positions matching PROXY's stroke positions (precomputed percentages: 18/32/46/62/80%), then `to(columns, { left: ["12%","30%","50%","70%","88%"] })` spreading into a grid.
- 35–50%: API slide `from({ autoAlpha: 0 })`; its word `from({ clipPath: "inset(0 100% 0 0)" })` revealing between the columns; columns dim to `bg-ll`.
- 50–65%: columns collapse to center three positions and thicken (`to(columns.slice(1,4), { scaleX: 90, transformOrigin: "center" })` → structural planes), API word exits up.
- 65–80%: MCP slide in: word letters `from({ yPercent: 40, autoAlpha: 0, stagger: 0.05 })` over the planes; planes settle `autoAlpha: 0.16`.
- 80–100%: whole composition `to(all, { yPercent: -18, autoAlpha: 0, ease: "power2.in" })` — handoff to INDEX.
- Mobile: slides stack statically, each word `from({ y: 60, autoAlpha: 0 })` on enter; no columns.

---

### Task 9: Scene 06 `SceneIndex.tsx`, Scene 07 `SceneClimax.tsx`, Scene 08 `SceneCta.tsx`

**Files:**
- Create: `dashboard/src/components/landing/SceneIndex.tsx`
- Create: `dashboard/src/components/landing/SceneClimax.tsx`
- Create: `dashboard/src/components/landing/SceneCta.tsx`

- [ ] **Step 1: INDEX** — `data-theme-scene="dark"`, `relative h-screen overflow-hidden bg-lp text-li`. Left: `EN` display `text-[24vw] leading-none` + a horizontal 1px arm line from the E's middle bar (`top-[52%]`) extending right. Right half: rows container (`absolute right-0 w-[52%]`) with 7 rows: mono xs key + display value `text-[clamp(1.4rem,2.6vw,2.6rem)]` + hairline `border-b border-ll`.

Timeline (`end: "+=160%"`, pin, scrub 0.8):
- `fromTo(rowsWrap, { y: () => armY - firstRowCenter }, { y: () => armY - lastRowCenter, ease: "none" })` so rows pass across the arm.
- `onUpdate`: row whose center is within ±24px of armY → key+value `text-lsignal`; else `text-li`/`text-lm`. Class toggling on index change only.
- Last 15%: rows compress (`to(rows, { gap: 0, autoAlpha: 0.25, scale: 0.98 })`) and final line `from({ clipPath: "inset(100% 0 0 0)" })`: `EVERYTHING INSPECTABLE. NOTHING HIDDEN.`
- Mobile: `EN` smaller (`text-[38vw]`), rows static stack, each row signal-highlighted via ScrollTrigger `toggleClass` on enter.

- [ ] **Step 2: CLIMAX** — `data-theme-scene="signal"`, `relative h-screen overflow-hidden bg-lp text-li`. Layers: giant letter `F` (`aria-hidden`, `text-[120vw]` black, center, initial scale covers viewport), statement two lines `MODELS FORGET.` / `ENGRAM REMEMBERS.` (`text-[clamp(3rem,8.5vw,9rem)] font-display font-black uppercase leading-[0.85]`), hairline rules, final mark `ENGRAM`.

Timeline (`end: "+=180%"`, pin, scrub 0.8):
- 0–35%: `to(giantF, { scale: 0.06, autoAlpha: 0, ease: "power1.in" })` — zoom out from inside the letterform.
- 20–55%: statement lines `from({ yPercent: 60, autoAlpha: 0, stagger: 0.1 })`; rules `from({ scaleX: 0 })`.
- 65–100%: statement compresses: `to(statement, { scale: 0.2, autoAlpha: 0, letterSpacing: "-0.08em", ease: "power2.in" })`, mark `from({ scale: 1.6, autoAlpha: 0 })` settles center.
- Mobile: same but F scale starts smaller; statement `text-[11vw]`.

- [ ] **Step 3: CTA + footer** — `id="start"`, `data-theme-scene="dark"`, `relative min-h-screen overflow-hidden bg-lp text-li`. Top: mark `ENGRAM` carried over (`from({ scale: 3, autoAlpha: 0 })` → header size, scrub `end: "+=100%"`, pin). Heading `SELF-HOST MEMORY IN ONE COMMAND.` (`text-[clamp(2.6rem,6vw,6.5rem)]`). Command block: sharp rectangle `border border-ll` flex row: mono `$ docker compose up -d` + copy button (client `CopyButton` with clipboard API, `COPIED` state 1.6s — pattern from old page). Links row: `READ THE SOURCE ↗` (GitHub, underline offset hover) + `OPEN DASHBOARD` (sharp button, group hover: `::before`-style wipe using an absolutely positioned `bg-lsignal scale-x-0 group-hover:scale-x-100 origin-left transition-transform` layer + arrow `group-hover:translate-x-[7px]`). Technical line mono xs. Giant cropped `ENGRAM` at bottom: `text-[26vw] leading-[0.7] translate-y-[38%] select-none` aria-hidden. Footer hairline + `MIT LICENSE · © 2026 AYUSH` / `engram.ayushh.in`.
- Mobile: static, giant crop `text-[32vw]`.

---

### Task 10: Composition — `LandingPage.tsx` + `page.tsx`

**Files:**
- Modify: `dashboard/src/components/LandingPage.tsx` (full rewrite)
- Modify: `dashboard/src/app/page.tsx`

- [ ] **Step 1: LandingPage**

```tsx
import { LandingMotion } from "@/components/LandingMotion";
import { Loader } from "@/components/landing/Loader";
import { LandingNav } from "@/components/landing/LandingNav";
import { SceneClimax } from "@/components/landing/SceneClimax";
import { SceneContext } from "@/components/landing/SceneContext";
import { SceneCta } from "@/components/landing/SceneCta";
import { SceneEngram } from "@/components/landing/SceneEngram";
import { SceneForget } from "@/components/landing/SceneForget";
import { SceneIndex } from "@/components/landing/SceneIndex";
import { SceneInterfaces } from "@/components/landing/SceneInterfaces";
import { SceneLoop } from "@/components/landing/SceneLoop";

export function LandingPage() {
  return (
    <LandingMotion className="landing-scope relative min-h-screen w-full max-w-full overflow-x-clip bg-lp text-li">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:bg-lsignal focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:text-lp">Skip to content</a>
      <Loader />
      <LandingNav />
      <main id="main-content" tabIndex={-1}>
        <SceneForget />
        <SceneEngram />
        <SceneLoop />
        <SceneContext />
        <SceneInterfaces />
        <SceneIndex />
        <SceneClimax />
        <SceneCta />
      </main>
    </LandingMotion>
  );
}
```

- [ ] **Step 2: page.tsx** — `export default function HomePage() { return <LandingPage />; }` (drop authEnabled; landing is auth-free per approved design).

---

### Task 11: Rewrite verify scripts

**Files:**
- Modify: `dashboard/scripts/verify-visual-system.mjs`
- Modify: `dashboard/scripts/verify-clerk-setup.mjs`

- [ ] **Step 1: verify-visual-system.mjs** — keep lines asserting: page renders `LandingPage`; `LandingPage.tsx`/`LandingMotion.tsx` exist; globals tokens (`--color-signal: 90 168 158;`, light overrides); no `engram_accent`; AppFrame/ProductPageHeader/Graph/Settings assertions (all product-shell). Replace landing assertions with:

```js
assert.match(landing, /SceneForget[\s\S]*SceneEngram[\s\S]*SceneLoop[\s\S]*SceneContext[\s\S]*SceneInterfaces[\s\S]*SceneIndex[\s\S]*SceneClimax[\s\S]*SceneCta/, "Landing must compose all eight scenes");
assert.match(landing, /landing-scope/, "Landing must use its own scoped palette");
const sceneFiles = ["SceneForget","SceneEngram","SceneLoop","SceneContext","SceneInterfaces","SceneIndex","SceneClimax","SceneCta","Loader","LandingNav","copy","useSceneTimeline"].map(n => path.join(root, `src/components/landing/${n}.ts${n==="copy"||n==="useSceneTimeline"?"":"x"}`));
sceneFiles.forEach(f => assert.ok(fs.existsSync(f), `Missing ${f}`));
const landingCopy = read("src/components/landing/copy.ts");
assert.match(landingCopy, /MODELS FORGET\./, "Climax copy must state the thesis");
assert.match(landingCopy, /ENGRAM REMEMBERS\./, "Climax copy must state the thesis");
assert.match(landingCopy, /1\/chat|\/v1\/chat/, "Interface copy must reference the real endpoint");
assert.doesNotMatch(landing, /MemoryFlowDemo|loop-card|landing-beam|landing-pulse/, "Old card-based design must be gone");
assert.match(landingMotion, /Lenis/, "Landing motion must use Lenis smooth scrolling");
assert.match(landingMotion, /gsap\.context|gsap\.registerPlugin/, "Motion must be scoped");
// keep: prefers-reduced-motion, context.revert() — but these now live in useSceneTimeline:
const hookSource = read("src/components/landing/useSceneTimeline.ts");
assert.match(hookSource, /prefers-reduced-motion/, "Scenes must honor reduced motion");
assert.match(hookSource, /context\.revert\(\)/, "Scenes must clean up on unmount");
assert.match(hookSource, /gsap\.matchMedia/, "Scene choreography must be responsive");
```

Remove: old hero copy/section-id asserts, interfaces-track, loop-card asserts, section-heading assert, Lenis/preloader ban.

- [ ] **Step 2: verify-clerk-setup.mjs** — replace the three landing asserts: page no longer passes `authEnabled`; assert landing does NOT import `AuthControls` (`assert.doesNotMatch(landingPageSource, /AuthControls/)`) and that AuthControls remains in the product shell (check `AppFrame.tsx` for `AuthControls` — confirm usage with grep first; if AppFrame doesn't use it, assert on the file that does).

- [ ] **Step 3: Run all verify scripts**

Run: `npm run verify:visual && npm run verify:logic && npm run verify:clerk && npm run verify:billing` in `dashboard/` — all pass.

---

### Task 12: Green build + smoke test

- [ ] **Step 1:** `npm run typecheck` — pass
- [ ] **Step 2:** `npm run build` — pass
- [ ] **Step 3:** `npm run dev` on port 3001; smoke test `/` renders, console clean; report URL to user.

---

## Self-review notes

- Spec coverage: scenes 00–08 ✓ (Tasks 4–9), nav ✓ (4), loader ✓ (4), Lenis ✓ (3), fonts ✓ (1), palette isolation ✓ (1), reduced-motion/mobile ✓ (3, conventions, each scene), verify scripts ✓ (11), composition ✓ (10), green run + server ✓ (12).
- Type consistency: `useSceneTimeline(ref, build)` signature used by all scenes; `copy.ts` keys match scene tasks; tailwind color names `lp/li/ll/lm/lsignal` match globals.css vars; nav hrefs match section ids (`loop`, `context`, `interfaces`, `start`, `top`).
