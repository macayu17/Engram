# Loop Motion Repair Design

## Goal

Keep every memory-loop card readable at all times while adding restrained motion that improves section rhythm without changing Engram's approved visual direction.

## Design

- Cards remain visible before JavaScript and if ScrollTrigger misses an update.
- Each card lifts and sharpens as it enters the viewport; no animation owns its visibility.
- Section headings receive a short upward reveal.
- Loop cards gain a signal-colored top line and slight depth on hover.
- Mobile uses the normal grid with no pinning or horizontal overflow.
- Reduced-motion mode disables all new movement.

## Scope

Modify only the landing motion controller, landing hooks, global landing styles, and visual contract. No API, database, deployment, billing, authentication, or Azure changes.

## Verification

The visual contract must reject hidden loop-card initial states. Browser checks must confirm six visible cards at the reported desktop viewport, zero horizontal overflow, a working sticky header, and no motion transforms under reduced motion.
