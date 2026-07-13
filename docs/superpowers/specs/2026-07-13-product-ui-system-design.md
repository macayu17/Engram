# Product UI System Design

## Goal

Carry the landing page's visual language through Overview, Memories, Chat, Logs, Graph, Docs, and Settings without changing product behavior.

## Shared Properties

- Newsreader display headings, Geist interface text, and Geist Mono for metrics, code, and IDs.
- Paper, panel, tag, line, muted, signal, caution, fault, and high tokens in both themes.
- One teal accent, restrained 1px borders, maximum 8px surface radius, and no generic gradients or glows.
- Compact uppercase labels, balanced headings, readable descriptions, tabular numeric values, and visible focus states.
- Controls use 200-300ms color, border, and transform transitions with pressed feedback.
- Product pages retain dense operational layouts; landing scroll choreography does not enter authenticated tools.

## Shared Shell

- Add Overview to desktop and mobile navigation.
- Mark the active route visually and with `aria-current="page"`.
- Match the landing header height, transparency, borders, and control treatment.
- Add a product skip link and stable content target.
- Show the Dashboard shortcut in landing auth controls only, avoiding duplication inside product navigation.

## Route Treatment

- Standardize primary page headings and descriptions through one `ProductPageHeader` component.
- Keep Overview's retrieval hero and Docs' long-form manual structure because they already match the design language.
- Normalize action buttons, inputs, selects, search fields, loading, empty, and error surfaces.
- Replace the graph's stale hardcoded paper and sidebar colors with the current product palette while retaining entity colors needed for graph semantics.

## Boundaries

No API, authentication semantics, database, deployment, billing, extraction, provider, or Azure configuration changes. No new dependencies.

## Verification

Static contracts cover shared headers, active navigation, route access, graph palette, and theme tokens. Real-browser checks cover desktop and mobile shell layout, dark and light modes, route overflow, active states, and the graph canvas frame.
