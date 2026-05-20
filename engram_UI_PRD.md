# Engram — UI/UX Product Requirements Document

**Version:** 1.0  
**Project:** Engram Dashboard — Developer-Facing UI  
**Stack:** Next.js 14, Tailwind CSS, TypeScript  
**Design Framework:** Taste Skill (minimalist-skill variant)  
**Author:** Ayush Kumar  
**Status:** Ready for implementation

---

## 0. Before Writing Any UI Code

Run this first. Every single time. No exceptions.

```bash
npx skills add Leonxlnx/taste-skill
```

This installs the Taste Skill SKILL.md files into your project. Your coding agent (Claude Code, Codex) reads these files automatically before generating any frontend code. They contain the design rules that prevent generic, boring output.

After installing, the agent must read:

1. `SKILL.md` (the minimalist-skill variant) — primary design rules
2. `output-skill/SKILL.md` — prevents placeholder code and half-finished components
3. `gpt-tasteskill/SKILL.md` — stricter rules for Codex specifically (you are using Codex)

Do not proceed to any component until these files are read and their rules are applied. Any UI generated without reading the skill files will be rejected and rebuilt.

**Taste Skill settings for this project** (set at the top of SKILL.md):

```
DESIGN_VARIANCE = 3       # Clean, structured. Not experimental. Developer tool, not portfolio.
MOTION_INTENSITY = 2      # Minimal animation. Hover states only. No scroll-triggered effects.
VISUAL_DENSITY = 7        # Dense dashboard. Many data points per screen. Compact components.
```

---

## 1. Design Philosophy

Engram is infrastructure. Its dashboard is for developers who are already technical and impatient. They want to inspect, debug, and manage memory — not be impressed by the UI.

The aesthetic target is **Linear meets Vercel**. Dark, monochromatic, high information density, every pixel earns its place. No landing page energy, no gradients, no hero sections. This is a tool.

Four principles that govern every decision:

**Density over decoration.** A developer should be able to scan 20 memories on one screen without scrolling. Compact rows, tight spacing, no wasted whitespace between items.

**Inspectability over simplicity.** The reason Engram exists is to make LLM memory transparent. The UI must expose everything the system knows — why a memory was retrieved, what score it had, when it was last used. Nothing hidden behind "view details" unless the detail is long-form text.

**Monochrome with purpose.** The color palette is near-monochrome. Color is used only to encode meaning: green for high similarity scores, amber for medium, red for low, blue for interactive elements. Not for decoration.

**Zero surprise interactions.** Editing a memory, deleting a memory, searching — all happen in-place. No full page navigations for simple actions. No modals for destructive actions (a confirmation inline prompt is enough). The page should feel like a very fast spreadsheet.

---

## 2. Taste Skill Application

### 2.1 Which Skill Variant

Primary: `minimalist-skill` — clean editorial structure, monochrome, sharp hierarchy, Notion/Linear aesthetic. Perfect for a developer tool dashboard.

Supplementary: `output-skill` — prevents the agent from leaving placeholder components, skipping rows, or outputting half-finished table implementations.

For Codex specifically: `gpt-tasteskill` — stricter variant with stronger layout discipline.

### 2.2 Font Stack

```css
/* Applied via Taste Skill rules */
--font-primary: 'Geist', 'Inter', system-ui, sans-serif;
--font-mono: 'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace;
```

Memory content, API keys, UUIDs, code snippets — all monospace. Labels, navigation, headings — sans. No serif anywhere.

### 2.3 Color Tokens

```css
/* Base palette — near-monochrome */
--color-bg: #0a0a0a;              /* page background */
--color-surface: #111111;         /* card/panel background */
--color-surface-hover: #161616;   /* hover state */
--color-border: #1f1f1f;          /* default border */
--color-border-subtle: #161616;   /* very subtle dividers */
--color-text-primary: #e8e8e8;    /* primary text */
--color-text-secondary: #666666;  /* labels, metadata */
--color-text-tertiary: #3d3d3d;   /* very muted, placeholders */

/* Semantic — score encoding */
--color-score-high: #22c55e;      /* similarity > 0.8 */
--color-score-med: #f59e0b;       /* similarity 0.6–0.8 */
--color-score-low: #ef4444;       /* similarity < 0.6 */

/* Interactive */
--color-accent: #3b82f6;          /* links, focused inputs, primary actions */
--color-accent-subtle: #1e3a5f;   /* accent backgrounds */
```

### 2.4 Typography Scale

```css
--text-xs: 11px;      /* timestamps, tags, metadata badges */
--text-sm: 12px;      /* table secondary content, labels */
--text-base: 13px;    /* table primary content, body */
--text-md: 14px;      /* section headers */
--text-lg: 16px;      /* page titles */
```

Everything smaller than in a typical consumer app. Developer tools are read at desk distance, not arm's length. Dense typography reads well.

### 2.5 Spacing

```
4px  — gap between label and value within a row
8px  — gap between metadata items in a row
12px — padding inside compact cells
16px — gap between table rows (or 0 with border dividers)
20px — section padding
24px — card padding
32px — between major sections
```

No `gap: 24px` or `padding: 2rem` inside tables or data rows. Those are for marketing pages.

---

## 3. Application Shell

### 3.1 Layout

Full-viewport dark shell. Two-panel layout.

```
┌─────────────────────────────────────────────────────────────────┐
│  TOPBAR (48px)                                                   │
│  [engram]    Memories  Logs  Settings        [ek_••••••••] Copy  │
├──────────┬──────────────────────────────────────────────────────┤
│  SIDEBAR │  MAIN CONTENT                                         │
│  (220px) │                                                       │
│          │                                                       │
│  Stats   │                                                       │
│          │                                                       │
│  Nav     │                                                       │
│          │                                                       │
│          │                                                       │
└──────────┴──────────────────────────────────────────────────────┘
```

On mobile (< 768px): sidebar collapses to a bottom navigation bar. Topbar shows only the logo and a menu icon.

### 3.2 Topbar

Height: 48px. Background: `--color-surface`. Border bottom: 1px `--color-border`. Sticky — stays fixed on scroll.

Left: wordmark `engram` in monospace, 14px, `--color-text-primary`. Clicking navigates to `/`.

Center: navigation links — `Memories`, `Logs`, `Settings`. 13px. Active state: `--color-text-primary` with a 1px bottom border in `--color-accent`. Inactive: `--color-text-secondary`.

Right: API key pill showing `ek_••••••••` (masked). Click reveals full key for 3 seconds, then re-masks. Copy icon copies to clipboard. 12px monospace.

### 3.3 Sidebar

Width: 220px. Background: `--color-bg`. Border right: 1px `--color-border`. No shadow.

Content:

```
OVERVIEW
─────────────────
Total memories      47
Last updated     2h ago
API calls today     312

QUICK FILTERS
─────────────────
All memories
High confidence
Recently accessed
Never accessed
```

Stats are live — fetched on page load, no auto-refresh unless user action. Numbers in `--color-text-primary`, labels in `--color-text-secondary`. Each filter is a clickable row that applies to the memories table. Active filter has a 1px left border in `--color-accent`.

---

## 4. Memories Page (`/`)

The primary page. This is where developers spend most of their time.

### 4.1 Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Memories                              [+ Add]  [Search...]     │
├─────────────────────────────────────────────────────────────────┤
│  FILTER BAR                                                      │
│  All  ·  High confidence  ·  Sort: Recent ▾  ·  47 memories     │
├─────────────────────────────────────────────────────────────────┤
│  MEMORY TABLE                                                    │
│  ─────────────────────────────────────────────────────────────  │
│  Content                        Conf  Accessed  Created    ⋮    │
│  ─────────────────────────────────────────────────────────────  │
│  User prefers FastAPI over ...  0.97  2h ago    May 1      ⋮    │
│  User is building SENTINEL ...  0.91  4h ago    Apr 28     ⋮    │
│  User wants no em dashes in ... 0.85  1d ago    Apr 20     ⋮    │
│  ─────────────────────────────────────────────────────────────  │
│                                              [1–20 of 47]  > >> │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Page Header

Row with:

- Left: "Memories" in 16px, `--color-text-primary`
- Right: Search input (120px, expands to 280px on focus) + "Add memory" button

Search input: no border until focused, `--color-border` on focus. Placeholder: "Search memories..." in 12px. Searches semantic (calls `POST /memories/search`) after 400ms debounce.

Add button: outlined, 12px, `+ Add`. Opens an inline row at the top of the table (not a modal).

### 4.3 Filter Bar

Horizontal row of filter chips below the header. 11px text. Chips: no background, just text + cursor pointer. Active chip: `--color-text-primary`. Inactive: `--color-text-secondary`. A dot separator between chips.

Right side of filter bar: total count "47 memories" in `--color-text-secondary` + sort dropdown.

Sort options: Recent · Oldest · Most accessed · Least accessed · Highest confidence · Lowest confidence.

### 4.4 Memory Table

Compact, dense, no cell padding above 12px. Column widths:

| Column | Width | Notes |
|---|---|---|
| Content | flex (fills remaining) | Truncated at 80 chars with ellipsis. Full content on hover tooltip. |
| Confidence | 56px | Numeric score 0.00–1.00. Color-coded. |
| Accessed | 72px | Relative time "2h ago", "never" |
| Created | 72px | Date "May 1" |
| Actions | 32px | ⋮ menu |

Row height: 40px. Row border: 1px bottom `--color-border-subtle`. No row background except on hover: `--color-surface-hover`.

**Content column:** 13px monospace. The memory string is developer-written data — show it in mono so it scans like a log entry, not prose. Truncate after 80 characters. Full text appears in a tooltip on hover (not a popover, just a native `title` attribute styled with CSS).

**Confidence column:** Numeric value right-aligned. Color: green if > 0.8, amber if 0.6–0.8, red if < 0.6. No background pill, just the text color. 12px.

**Accessed column:** Relative time. If never accessed, show `—` in `--color-text-tertiary`.

**Actions column (⋮ menu):** Appears on row hover. Click opens a 3-item dropdown: Edit, Delete, View source conversation. Dropdown is 140px wide, positioned below the ⋮ icon. 12px text. Keyboard accessible.

### 4.5 Inline Edit

Clicking "Edit" in the ⋮ menu transforms the content cell into an inline input. The row expands to auto height. The input fills the content column width. Two buttons appear to the right: Save (blue) and Cancel (text).

Saving calls `PATCH /memories/{id}`. On success: row collapses back, content updates in place, no page navigation.

### 4.6 Inline Add

Clicking "+ Add" adds a new row at the top of the table, pre-focused in an inline input. Same UX as edit — Save / Cancel. On save: calls `POST /memories`, new memory appears at top of list.

### 4.7 Delete Confirmation

No modal. Clicking "Delete" changes the ⋮ menu to show "Confirm delete ?" with Yes and No text buttons inline. Clicking Yes calls `DELETE /memories/{id}`. Row fades out and removes.

### 4.8 Pagination

Bottom right: "1–20 of 47" label + Previous / Next buttons + Jump to last. 12px. No page number list — just prev/next with total count. 20 items per page.

---

## 5. Memory Detail Drawer

Clicking anywhere on a memory row (except the ⋮ menu) opens a right-side drawer. Not a new page, not a modal — a sliding drawer from the right.

Drawer width: 420px. Pushes main content left (not overlays it). Closes on Escape or clicking outside.

### 5.1 Drawer Content

```
┌─────────────────────────────────────────────────────┐
│  Memory                                         [×] │
│  ─────────────────────────────────────────────────  │
│  Content                                            │
│  ┌─────────────────────────────────────────────┐   │
│  │ User prefers FastAPI over Flask for all     │   │
│  │ backend work. Specifically mentioned when   │   │
│  │ discussing SENTINEL architecture.           │   │
│  └─────────────────────────────────────────────┘   │
│                                         [Edit]      │
│  ─────────────────────────────────────────────────  │
│  Metadata                                           │
│  Confidence     0.97                                │
│  Access count   14                                  │
│  Last accessed  2 hours ago                         │
│  Created        May 1, 2026, 14:23                  │
│  Memory ID      3fa85f64-5717-...    [Copy]         │
│  ─────────────────────────────────────────────────  │
│  Source conversation                                │
│  conv_abc123                          [View logs]   │
│  ─────────────────────────────────────────────────  │
│  Retrieval history (last 5)                         │
│  May 17 · "what backend should I use"  score 0.91  │
│  May 15 · "recommend a framework"      score 0.88  │
│  May 14 · "FastAPI or Django"          score 0.95  │
│  ─────────────────────────────────────────────────  │
│                              [Delete memory]        │
└─────────────────────────────────────────────────────┘
```

Full memory content: shown untruncated in a read-only textarea-style box. Monospace 13px. Light border. Edit button transforms it to an editable textarea.

Metadata section: label-value rows. Labels in `--color-text-secondary` 12px, values in `--color-text-primary` 13px. Memory ID is truncated with a copy button.

Retrieval history: last 5 times this memory was retrieved, with the query that triggered it and the similarity score. Query text in 12px monospace. Score color-coded.

Delete button: bottom, text-only, `--color-score-low`. Requires inline confirmation (same pattern as table delete).

---

## 6. Logs Page (`/logs`)

Shows every retrieval event — every time a memory was surfaced for any query. The developer uses this to understand why the model knows what it knows.

### 6.1 Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Retrieval Logs                    [Filter by conv ID...]       │
├─────────────────────────────────────────────────────────────────┤
│  LOG TABLE                                                       │
│  ─────────────────────────────────────────────────────────────  │
│  Time        Query                         Memories  Conv ID    │
│  ─────────────────────────────────────────────────────────────  │
│▶ 14:23:01    "what backend should I use"   3         conv_abc1  │
│  14:18:55    "explain my current project"  5         conv_abc1  │
│  13:45:22    "TypeScript or Python"        2         conv_xyz2  │
│  ─────────────────────────────────────────────────────────────  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Log Table Columns

| Column | Width | Notes |
|---|---|---|
| Time | 80px | HH:MM:SS, monospace 12px |
| Query | flex | The incoming user message that triggered retrieval. Truncated at 60 chars. Monospace 12px. |
| Memories | 80px | Count of memories retrieved. Right-aligned. |
| Conv ID | 100px | Truncated conversation UUID. Monospace 11px. |

Row height: 36px. Expandable — clicking a row expands it inline to show the retrieved memories.

### 6.3 Expanded Log Row

When a row is expanded (▶ indicator becomes ▼):

```
▼ 14:23:01    "what backend should I use"   3   conv_abc1
  ─────────────────────────────────────────────────────
  Retrieved memories:
  
  0.91  User prefers FastAPI over Flask for all backend work
  0.84  User is building SENTINEL — a market simulation platform
  0.71  User wants no em dashes or AI-typical phrasing

  Full query: "what backend framework should I use for this project?"
```

Each retrieved memory shows: score (color-coded, 11px) + content (monospace 12px). Clicking the memory content navigates to that memory in the main Memories view.

Full query text is shown untruncated below the list.

---

## 7. Settings Page (`/settings`)

Minimal. Three sections.

### 7.1 Account

```
User ID          user_abc123_from_your_app
API Key          ek_••••••••••••••••    [Reveal]  [Copy]  [Regenerate]
Created          April 1, 2026
```

Regenerating the API key shows an inline warning: "This will invalidate the current key. All apps using the old key will stop working. Continue?" with Yes/Cancel. No modal.

### 7.2 Retrieval Settings

Live-editable config. Changes call `PATCH /users/me/config` on save.

```
Max memories injected     [5    ▲▼]   per prompt
Retrieval threshold       [0.50 ▲▼]   minimum similarity score
Dedup threshold           [0.95 ▲▼]   above this = duplicate
```

Number inputs with up/down arrows. Inline save — change a value, a "Save" button appears to the right of that field. Changes apply immediately.

### 7.3 Danger Zone

```
─────────────────────────────────────────────────────────
Danger zone

Delete all memories      [Delete all]
Delete account           [Delete account]
─────────────────────────────────────────────────────────
```

Both require a typed confirmation: "Type DELETE to confirm" input inline. Buttons are red. No modal.

---

## 8. Empty States

Every table has a proper empty state — not just a blank area.

### Memories — no memories yet

```
    No memories yet

    Memories are extracted automatically when you
    send conversations through the proxy endpoint.

    [Read the quickstart →]
```

Centered, 13px, `--color-text-secondary`. Link to docs.

### Memories — search returned nothing

```
    No memories match "{query}"

    Try a different search, or add this memory manually.

    [Add memory]
```

### Logs — no logs yet

```
    No retrieval events yet

    Logs appear when memories are retrieved via the
    proxy endpoint.
```

### First-time visit (no API key in localStorage)

Instead of showing the dashboard, show an inline setup prompt:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Enter your Engram API key to get started           │
│                                                     │
│  [ek_________________________________] [Connect]    │
│                                                     │
│  Don't have a key? Create a user via the API first. │
│  curl -X POST http://localhost:8000/users \         │
│       -d '{"external_id": "me"}'                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

This replaces the entire content area. Not a modal, not a separate page — an inline prompt in the main content area. On submit: stores the key in localStorage, fetches `/users/me` to verify it, loads the dashboard.

---

## 9. Loading and Error States

### Loading

No spinners. Use a pulse shimmer effect on the table rows while data loads. Each row is replaced with a gray block that fades in and out (CSS animation, `opacity: 0.4 → 0.7 → 0.4`). Rows maintain their height so the layout doesn't jump.

```css
@keyframes shimmer {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
.skeleton {
  background: var(--color-border);
  border-radius: 4px;
  animation: shimmer 1.2s ease-in-out infinite;
}
```

Show 5 skeleton rows on initial load. Width varies slightly per row (60%, 75%, 55%, 80%, 65%) so it doesn't look like a grid.

### Errors

Inline, not toasts. If a save fails:

```
Failed to save memory. Check your API key or server connection.  [Retry]
```

This appears below the affected input, 11px, `--color-score-low`. Clears on next successful action.

If the API is unreachable (health check fails on load):

```
┌─────────────────────────────────────────────────────┐
│  Cannot connect to Engram API                        │
│  Make sure the API is running at localhost:8000      │
│  [Retry]                                             │
└─────────────────────────────────────────────────────┘
```

Shown in the main content area, replacing the table.

---

## 10. Component Inventory

Full list of components to build. Each must be built with the Taste Skill rules active.

### Core Layout

- `AppShell` — topbar + sidebar + main content wrapper
- `Topbar` — logo, nav links, API key pill
- `Sidebar` — stats + filter navigation
- `PageHeader` — page title + right-side actions slot

### Memories

- `MemoryTable` — the main table, handles pagination and row states
- `MemoryRow` — single row, handles hover/expand/edit/delete states
- `MemoryRowSkeleton` — shimmer placeholder
- `MemoryInlineEdit` — transforms a row cell into an editable input
- `MemoryAddRow` — new empty row at top of table for adding
- `MemoryDetailDrawer` — right-side drawer with full detail
- `MemorySearchBar` — expanding search input with debounce
- `FilterBar` — filter chips + sort dropdown + count

### Logs

- `LogTable` — retrieval log table
- `LogRow` — single row, expandable
- `LogRowExpanded` — inline expansion showing retrieved memories with scores
- `ScoreBadge` — colored text score (no background pill, just colored text)

### Settings

- `ApiKeyDisplay` — masked key with reveal/copy/regenerate
- `NumberSetting` — label + number input + inline save
- `DangerAction` — red button with typed confirmation

### Shared

- `EmptyState` — icon + heading + description + optional CTA
- `InlineError` — error text with optional retry button
- `ConfirmInline` — "confirm?" Yes/No inline (not modal)
- `CopyButton` — copies text to clipboard, shows check icon for 1.5s
- `RelativeTime` — formats timestamps as relative ("2h ago")
- `TruncatedMono` — monospace text with ellipsis and tooltip

---

## 11. Interaction Patterns

### All destructive actions are inline

No modals for delete, clear, or regenerate. The confirmation is a small inline prompt in the same position as the button. This is faster and doesn't interrupt context.

### No full page navigations for row actions

Editing a memory, viewing its detail, deleting it — all happen without leaving the page. The drawer, inline edit, and inline confirm all keep the user in context.

### Keyboard navigation

- `Tab` — moves through interactive elements
- `Escape` — closes drawer, cancels inline edit, dismisses confirmation
- `Enter` — confirms inline edit save
- `Cmd+K` (or `Ctrl+K`) — focuses the search bar from anywhere on the page

### Copy interactions

Any ID, key, or code snippet that could reasonably be copied has a copy button. Copy buttons: invisible by default, visible on parent hover. After copying, show a check icon for 1.5 seconds, then return to copy icon.

---

## 12. Responsive Behavior

The dashboard is primarily a desktop tool (developers use it on large screens while building). Responsive behavior is a secondary concern, not the primary design target.

**1440px+** — full layout as described. No changes.

**1024px–1440px** — sidebar narrows to 180px. Content columns may truncate earlier. All functionality preserved.

**768px–1024px** — sidebar collapses. Hamburger menu in topbar expands an overlay nav. Table columns collapse: hide "Accessed" and "Conv ID" columns. All other functionality preserved.

**< 768px** — not a supported viewport. Show a message: "Engram dashboard is designed for desktop use. Please open on a larger screen." in the center of the page.

---

## 13. Animations and Transitions

Minimal. Every animation must be faster than you think.

| Interaction | Animation | Duration |
|---|---|---|
| Row hover | Background color transition | 80ms |
| Drawer open | Slide in from right | 180ms ease-out |
| Drawer close | Slide out to right | 140ms ease-in |
| Inline expand | Height from 0 to auto | 150ms ease-out |
| Inline collapse | Height from auto to 0 | 120ms ease-in |
| Delete fade-out | Opacity 1 → 0 | 200ms |
| Skeleton shimmer | Opacity pulse | 1200ms infinite |
| Copy confirmation | Icon swap | instant |
| Search expand | Width 120px → 280px | 150ms ease-out |

No bounce, no spring, no overshoot. Straight easing curves only. The UI should feel fast, not playful.

Respect `prefers-reduced-motion`. Wrap all transitions in:

```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

---

## 14. File Structure (Dashboard Service)

```
dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # AppShell wrapper, font loading
│   │   ├── page.tsx                # Memories page
│   │   ├── logs/
│   │   │   └── page.tsx            # Logs page
│   │   └── settings/
│   │       └── page.tsx            # Settings page
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── Sidebar.tsx
│   │   │
│   │   ├── memories/
│   │   │   ├── MemoryTable.tsx
│   │   │   ├── MemoryRow.tsx
│   │   │   ├── MemoryRowSkeleton.tsx
│   │   │   ├── MemoryInlineEdit.tsx
│   │   │   ├── MemoryAddRow.tsx
│   │   │   ├── MemoryDetailDrawer.tsx
│   │   │   ├── MemorySearchBar.tsx
│   │   │   └── FilterBar.tsx
│   │   │
│   │   ├── logs/
│   │   │   ├── LogTable.tsx
│   │   │   ├── LogRow.tsx
│   │   │   └── LogRowExpanded.tsx
│   │   │
│   │   ├── settings/
│   │   │   ├── ApiKeyDisplay.tsx
│   │   │   ├── NumberSetting.tsx
│   │   │   └── DangerAction.tsx
│   │   │
│   │   └── shared/
│   │       ├── EmptyState.tsx
│   │       ├── InlineError.tsx
│   │       ├── ConfirmInline.tsx
│   │       ├── CopyButton.tsx
│   │       ├── RelativeTime.tsx
│   │       ├── ScoreBadge.tsx
│   │       ├── PageHeader.tsx
│   │       └── TruncatedMono.tsx
│   │
│   ├── lib/
│   │   ├── api.ts                  # typed fetch wrapper
│   │   ├── auth.ts                 # localStorage API key helpers
│   │   └── format.ts               # date, score, truncation utils
│   │
│   └── styles/
│       └── globals.css             # CSS variables, base reset
│
├── public/
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 15. `globals.css` Baseline

```css
:root {
  --color-bg: #0a0a0a;
  --color-surface: #111111;
  --color-surface-hover: #161616;
  --color-border: #1f1f1f;
  --color-border-subtle: #161616;
  --color-text-primary: #e8e8e8;
  --color-text-secondary: #666666;
  --color-text-tertiary: #3d3d3d;
  --color-score-high: #22c55e;
  --color-score-med: #f59e0b;
  --color-score-low: #ef4444;
  --color-accent: #3b82f6;
  --color-accent-subtle: #1e3a5f;
  --font-mono: 'Geist Mono', 'JetBrains Mono', monospace;
  --font-sans: 'Geist', 'Inter', system-ui, sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

---

## 16. `tailwind.config.ts` Extensions

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: '#111111',
        'surface-hover': '#161616',
        border: '#1f1f1f',
        'border-subtle': '#161616',
        primary: '#e8e8e8',
        secondary: '#666666',
        tertiary: '#3d3d3d',
        accent: '#3b82f6',
        'accent-subtle': '#1e3a5f',
        'score-high': '#22c55e',
        'score-med': '#f59e0b',
        'score-low': '#ef4444',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        xs: '11px',
        sm: '12px',
        base: '13px',
        md: '14px',
        lg: '16px',
      },
    },
  },
}
export default config
```

---

## 17. Success Criteria for UI

The dashboard is complete when:

1. `docker compose up` starts the dashboard at `localhost:3001`
2. A developer can enter their API key and immediately see their memories table
3. They can search, add, edit, and delete memories without any page navigation
4. The logs page shows retrieval history with expandable rows and color-coded scores
5. The memory detail drawer shows full content, metadata, and retrieval history
6. All interactions feel instantaneous (skeleton loading, 80ms hover transitions)
7. The Taste Skill minimalist aesthetic is visibly applied — no generic Bootstrap/MUI energy
8. A senior engineer looking at the UI would describe it as "clean" and "fast", not "pretty"

---

## 18. What NOT to Build

- No charts or graphs in v1 — no memory growth over time, no retrieval frequency graphs. Those are v2.
- No dark/light mode toggle — dark only. Developer tools are dark.
- No onboarding tour or walkthrough overlays.
- No notification system or toast messages — errors are inline, success is implicit (the data updates).
- No drag-and-drop reordering of memories.
- No bulk selection or bulk operations in v1.
- No real-time updates (no WebSocket to push new memories as they're created) — manual refresh only.
- No user avatar, profile picture, or display name — this is an API tool, not a social product.
