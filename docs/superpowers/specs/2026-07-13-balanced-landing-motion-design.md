# Engram Balanced Landing Motion Design

## Goal

Make the existing ZIP-based Engram landing page feel more responsive and satisfying by adapting the motion mechanics from the referenced Messi site without copying its visual identity or turning Engram into a cinematic showcase.

The selected direction is **Balanced**: motion should explain the memory workflow, create clear section rhythm, and reward interaction while preserving fast access to technical content.

## Scope

The change applies only to the public landing page at `/`. Product routes and their dashboard shell keep their current behavior.

The implementation will add GSAP and ScrollTrigger as one runtime dependency. Native browser scrolling remains unchanged.

## Motion System

### Initial Entrance

- Reveal the three hero heading lines through overflow masks with a short stagger.
- Fade and translate the kicker, supporting paragraph, actions, and feature strip into place.
- Bring the memory-flow demo in after the main copy with a small delay.
- Keep the total entrance under 1.2 seconds after hydration.

### Scroll Chapters

- Reveal the problem statement word by word as it enters the viewport.
- Stagger the six memory-loop steps in reading order with restrained vertical movement.
- On desktop widths, pin the interfaces section while the three interface panels move horizontally through the viewport.
- At tablet and mobile widths, render the interface panels as the existing vertical flow with simple entrance reveals.
- Reveal quickstart, comparison rows, retrieval logging, provider badges, and the final CTA once as they enter the viewport.

### Memory Demonstration

- Preserve the existing CSS beam, pulse, memory-row, and cursor animations.
- Animate retrieval scores from zero to their final values when the demo first becomes visible.
- Coordinate score completion with the existing Embed, Search, Rank, and Inject progression.
- Do not loop numeric count-ups after their first completion.

### Interaction Feedback

- Add subtle magnetic movement to the primary hero action and final GitHub action.
- Keep card hover feedback limited to a small lift, border-color shift, and internal content movement.
- Preserve keyboard focus styles and avoid pointer-only behavior.

## Architecture

- Add one client-side landing motion component that owns GSAP setup and cleanup.
- Scope selectors to a landing-page root ref and use `gsap.context` so navigation unmounts remove every animation and ScrollTrigger.
- Use `gsap.matchMedia` for desktop-only pinning and mobile fallbacks.
- Keep content and layout in `LandingPage.tsx`; the motion component adds behavior without duplicating markup.
- Continue using CSS for the existing repeating memory-flow animation. GSAP handles entrances and scroll-linked sequences only.

## Accessibility And Performance

- Disable nonessential motion when `prefers-reduced-motion: reduce` is active.
- Do not add smooth-scroll interception, a custom cursor, or a blocking preloader.
- Animate only transform, opacity, and numeric text where practical.
- Avoid pinned horizontal behavior below the desktop breakpoint.
- Keep semantic reading order and tab order unchanged.

## Verification

- Extend the visual contract to require the landing motion controller, reduced-motion handling, and scoped cleanup.
- Run visual verification, TypeScript checks, existing Clerk, billing, and dashboard logic checks, and a production build.
- Inspect real Chromium renders at 1440 by 1000 and 390 by 844.
- Confirm no horizontal overflow, framework error overlay, console exception, or blank pinned section.
- Confirm dark and light themes retain readable contrast before and after animation completion.

## Explicit Exclusions

- No Lenis or other scroll replacement.
- No custom cursor.
- No preloader or artificial loading counter.
- No audio, WebGL, Three.js, or large media assets.
- No motion changes to authenticated dashboard routes.
- No Azure, API, database, or deployment changes.
