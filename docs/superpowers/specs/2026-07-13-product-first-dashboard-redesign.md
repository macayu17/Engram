# Product-First Dashboard Redesign

## Goal

Make the Engram home dashboard feel calmer, clearer, and more useful without replacing its original visual identity.

## Direction

Keep the serif typography, amber accent, top navigation, light and dark themes, and editorial dashboard structure. Remove the visual layers that currently compete for attention.

## Hero

- Reduce the hero height from roughly 600px to about 440px on desktop.
- Use a smaller two-line headline with a readable text width.
- Keep one primary action and one quiet secondary action.
- Remove the orbit, floating chips, scan ledger, decorative labels, and overlapping network layers.
- Replace them with one restrained retrieval trace showing a query, ranked memories, and injected context.
- Keep the trace decorative and non-interactive so it adds no runtime or accessibility burden.

## Dashboard Content

- Bring the four existing workspace statistics into the first viewport.
- Preserve the existing timeline, entity, retrieval, and navigation sections.
- Reduce excess card decoration and tighten vertical spacing without changing data fetching or routes.
- Keep disconnected, loading, empty, and connected states working as they do now.

## Responsive Behavior

- Desktop uses a two-column hero with copy on the left and the retrieval trace on the right.
- Mobile stacks the trace beneath the actions and keeps the headline within the viewport.
- No content may overlap the fixed mobile navigation.
- Both themes must keep readable contrast.

## Scope

Change only the existing dashboard frontend components, Tailwind classes, and global animation styles needed by the hero. Add no dependency, route, backend behavior, billing behavior, deployment setting, or Azure resource.

## Verification

- Run dashboard visual verification, typecheck, and production build.
- Capture real Chrome screenshots at 1440x1000 and 390x844.
- Inspect both screenshots for clipping, overlap, readability, and first-viewport density.
- Confirm `http://localhost:3001` responds successfully.
