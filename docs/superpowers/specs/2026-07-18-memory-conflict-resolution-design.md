# Memory Conflict Resolution Design

## Problem

Engram currently asks the extraction model to classify a related fact as `ADD`, `UPDATE`, or `DISCARD`. `UPDATE` replaces the selected memory in place. This works for obvious corrections, but a genuine contradiction can erase a still-valid durable claim without preserving the disagreement or asking the user.

## Decision

Use a hybrid reconciliation workflow:

- Keep `UPDATE` for clear corrections and superseded facts.
- Add `CONFLICT <memory_id>` for claims that cannot safely be resolved automatically.
- Store the proposed claim as a normal pending memory and link it to the approved memory in a conflict record.
- Keep unresolved proposals out of retrieval through the existing approved-only retrieval rule.
- Let the user resolve a conflict by accepting the new claim, keeping the old claim, or keeping both.
- Snapshot a memory before automatic in-place updates so previous content remains recoverable.

## Data Model

`memory_revisions` stores the prior state of a memory before an automatic in-place update. It contains the owning user and organization, the memory ID, prior content and metadata, and the revision timestamp.

`memory_conflicts` links an existing memory to a proposed pending memory. Its status is `open` or `resolved`; its resolution is null while open and then `accept_new`, `keep_old`, or `keep_both`.

Both tables are scoped by user and organization, use the repository's server-only row-level security policy, and cascade when their parent memories are deleted.

## Reconciliation Behavior

The model receives four possible actions:

- `ADD`: new durable information.
- `UPDATE <memory_id>`: an unambiguous correction or newer value that supersedes an old value.
- `CONFLICT <memory_id>`: both claims may matter, or the newer claim cannot safely replace the old one without clarification.
- `DISCARD`: duplicate information.

Invalid or unknown targets continue to fall back to `ADD`, preserving the current failure behavior.

When `CONFLICT` is selected, Engram inserts the new fact directly as `pending` and creates an open conflict in the same transaction. It does not run the proposal through similarity refinement because that could overwrite the existing memory before review.

## Resolution Semantics

- `accept_new`: reject the existing memory and approve the proposed memory.
- `keep_old`: keep the existing memory approved and reject the proposed memory.
- `keep_both`: approve both memories.

The conflict and both memory rows are locked and validated against the authenticated user and organization before resolution. A resolved conflict cannot be resolved again.

## Dashboard

The Memories page keeps its existing review area. Open conflicts appear before ordinary pending memories and show the old and proposed claims side by side with three compact actions. Resolving a conflict invalidates both conflict and memory queries.

## Cost And Scope

This adds PostgreSQL rows and existing dashboard/API requests only. It adds no Azure resource, queue, scheduled job, model call, or service. The reconciliation model already runs today; only its allowed response vocabulary changes.

Deferred work includes a full temporal knowledge graph, confidence-based auto-resolution, chat-driven clarification, conflict notifications, and bulk conflict resolution.
