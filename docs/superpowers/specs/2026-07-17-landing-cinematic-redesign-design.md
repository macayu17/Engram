# Engram Landing — Cinematic Redesign Spec

Date: 2026-07-17
Status: Approved by user (2026-07-17)
Scope: `dashboard/src/components/LandingPage.tsx`, `LandingMotion.tsx`, new `dashboard/src/components/landing/*`, `globals.css` landing CSS, `layout.tsx` fonts, `tailwind.config.ts`, `dashboard/scripts/verify-visual-system.mjs`, `dashboard/package.json` (add `lenis`).

## Concept

"MODELS FORGET. ENGRAM REMEMBERS." A ~1200vh scroll-controlled typographic film.
The recurring visual unit is the word as memory: letters fall away (statelessness),
reassemble (memory), and become masks, rails, columns, and grids. Every scene
transforms from geometry already on screen. No crossfades, no cards, no gradients,
no glass, no pills, no fade-up reveals.

Approved decisions:
- Central concept: FORGET → REMEMBER typographic film
- Signal color: existing teal `90 168 158` (tokens unchanged; dashboard unaffected)
- Theme: fixed cinematic sequence (dark → paper → dark → signal → dark); landing
  ignores the dashboard theme toggle; dashboard product pages keep their theming
- Nav: minimal fixed nav + dashboard link; no Clerk buttons on landing

## Storyboard (all copy factual)

- 00 LOADER (dark, <=1.5s): `ENGRAM`, 1px calibration line, `INITIALIZING 000%` → 100%
  in tabular mono. The line extends and becomes the hero baseline rule.
- 01 FORGET (dark, pinned ~160vh): `FORGET.` at ~30vw. Metadata: "EVERY LLM API CALL
  FORGETS THE USER THE MOMENT THE REQUEST ENDS." + `SCROLL TO REMEMBER`. On scroll the
  letters scatter and fall out of frame (transforms only), settling as debris.
- 02 ENGRAM (dark→paper, pinned ~140vh): debris assembles into `ENGRAM` on a full-width
  grid; support line "A MEMORY LAYER BETWEEN YOUR APP AND ANY MODEL." The word scales up;
  its negative space reveals warm paper. Typography executes the theme shift.
- 03 THE LOOP (paper, pinned ~220vh): `RETRIEVE. FORWARD. LEARN.` Six stages on a
  horizontal rail under a fixed marker: 01 EMBED / 02 SEARCH / 03 RANK / 04 INJECT /
  05 FORWARD / 06 LEARN. Stage under the marker turns signal; one-liner swaps. Rail line
  drops to become scene 04's score axis.
- 04 CONTEXT (paper, pinned horizontal ~240vh): giant pinned query "what backend should
  I use?"; memory fragments travel horizontally with tabular scores: 0.91 / 0.84 / 0.71.
  Fragments below the 0.70 threshold are rejected (real retrieval_threshold behavior).
  Labels: LOCAL EMBEDDINGS · BGE-SMALL / PGVECTOR COSINE SEARCH / EVERY RETRIEVAL LOGGED.
  Final `0.91` enlarges into a mask revealing dark.
- 05 INTERFACES (dark, pinned ~300vh): three full-screen typographic transformations:
  01/PROXY "ONE URL. THE WHOLE LOOP." (POST /v1/chat · OpenAI-compatible) → letters
  expand in font width, strokes align into columns → 02/API "EVERY MEMORY, ADDRESSABLE."
  (search · add · update · delete · logs) → columns collapse into planes → 03/MCP
  "SEVEN TOOLS. NATIVE TO AGENTS." (search_memories · capture_conversation ·
  get_retrieval_log …).
- 06 INDEX (dark, pinned ~160vh): giant `EN` fixed left; spec rows align with the E's
  middle arm and turn signal: RUNTIME — DOCKER COMPOSE / STORAGE — POSTGRESQL + PGVECTOR /
  EMBEDDINGS — LOCAL · BGE-SMALL / RERANK — MS-MARCO CROSS-ENCODER / ENDPOINT —
  OPENAI-COMPATIBLE / PROTOCOL — MCP · 7 TOOLS / LICENSE — MIT. Rows compress into
  "EVERYTHING INSPECTABLE. NOTHING HIDDEN."
- 07 CLIMAX (signal, pinned ~180vh): full-bleed teal, black type. "MODELS FORGET. ENGRAM
  REMEMBERS." Begin inside a giant letterform, zoom out until the statement locks to a
  grid, then compress into `ENGRAM`.
- 08 CTA (dark, ~120vh + footer): mark shrinks to header size. "SELF-HOST MEMORY IN ONE
  COMMAND." Sharp rectangular command block `$ docker compose up -d` with copy button
  (hover: horizontal background wipe + arrow moves 7px). Secondary: READ THE SOURCE ↗
  (github.com/macayu17/Engram) · OPEN DASHBOARD. Technical line: npm i engramd. Huge
  cropped `ENGRAM` below viewport edge. Footer: MIT · © 2026 Ayush · engram.ayushh.in.

Nav: fixed. Left `ENGRAM`; center `01 LOOP / 02 CONTEXT / 03 INTERFACES / 04 START`;
right `GITHUB ↗` / `OPEN DASHBOARD`. Thin signal progress rail. Active state follows
the current scene; color adapts to dark/paper/signal scenes. Anchor jumps via Lenis.

## Visual system

- Palette: existing CSS tokens unchanged. Dark `#0B0A09`, ink `#F4EFE5`, paper `#E0DED7`,
  signal `#5AA89E`. >=80% monochrome. Hard theme bands only.
- Type: Archivo variable (wght + wdth axes) via next/font/google as `--font-archivo`,
  Tailwind `font-display`. Geist Sans for UI, Geist Mono for technical labels. Landing
  is grotesk-only (serif remains on product pages). Display up to ~30vw, uppercase,
  leading 0.82–0.9, tabular numerals, small uppercase technical labels.
- Hairline 1px rules, sharp rectangles, asymmetric editorial grid.

## Motion & engineering

- `lenis` (lerp ~0.1), driven by `gsap.ticker`; `lenis.on('scroll', ScrollTrigger.update)`.
  No scroll-jacking; pins always release.
- One GSAP timeline per scene; scrub 0.6–1.2; power easings only;
  transforms/clip-path/masks only.
- `document.fonts.ready` before building timelines; `ScrollTrigger.refresh()` after.
- `gsap.context` per scene component + `gsap.matchMedia`:
  - `(min-width: 1024px)`: full choreography
  - `(max-width: 1023px)`: vertical simplified (same story, no horizontal pins)
  - `(prefers-reduced-motion: reduce)`: no Lenis, no pins; scenes render as stacked
    static sections with all content accessible
- `context.revert()` on unmount. Breakpoints art-directed at 1440/1280/1024/768/430/390/360.
- Semantic HTML; skip link; focus-visible states; `aria-hidden` only on duplicated
  decorative display type; keyboard-navigable anchors.

## File plan

- Rewrite in place: `src/components/LandingPage.tsx` (composition), `LandingMotion.tsx`
  (orchestrator: Lenis + shared GSAP setup).
- New `src/components/landing/`: `copy.ts`, `useSceneTimeline.ts`, `Loader.tsx`,
  `LandingNav.tsx`, `SceneForget.tsx`, `SceneEngram.tsx`, `SceneLoop.tsx`,
  `SceneContext.tsx`, `SceneInterfaces.tsx`, `SceneIndex.tsx`, `SceneClimax.tsx`,
  `SceneCta.tsx`.
- `globals.css`: remove obsolete `.landing-*` keyframes; tokens untouched.
- `layout.tsx`: add Archivo; `tailwind.config.ts`: `font-display`.
- `verify-visual-system.mjs`: rewrite landing assertions for the new system (keep
  gsap.context / matchMedia / prefers-reduced-motion / context.revert guards; drop the
  Lenis/preloader ban and old copy/section locks; product-shell assertions untouched).
- `package.json`: add `lenis`.
- Removed (the slop): serif hero, MemoryFlowDemo card, loop-card grid, interface cards,
  compare table, provider chips, pill buttons, magnetic buttons, beam/pulse/cursor CSS,
  theme toggle on landing.

## Verification

`npm run typecheck`, `npm run build`, `npm run verify:visual`, `npm run verify:logic`
all green; dev-server smoke test on port 3001; user eyeball pass.

## Product facts used in copy (verified in repo)

- 7 MCP tools: search_memories, add_memory, update_memory, delete_memory,
  list_memories, capture_conversation, get_retrieval_log
- Local embeddings: BAAI/bge-small-en-v1.5; reranker: cross-encoder/ms-marco-MiniLM-L-6-v2
- PostgreSQL + pgvector; FastAPI; Docker Compose; MIT license
- Proxy: POST /v1/chat, OpenAI-compatible; providers incl. OpenAI / Gemini / Ollama
- Links: github.com/macayu17/Engram · npm package engramd · engram.ayushh.in
