# Decisions — ops disclosure control (go-opsdisclosure)

## Approach
- Keep native `<details>/<summary>` (no-JS/keyboard requirement; task says to replace
  the marker, not the element). Single summary placed LAST inside `<details>`, after the
  extra rows: DOM order = visual order = control at end in both states, with no CSS
  `order` tricks. The one summary is the "first summary element child", so native
  toggle/keyboard behavior is unchanged; closed `<details>` hides the extra rows and
  shows the summary in place.
- One `.oplist` for all rows (board: one list, not two); `<details class="operations-more">`
  wraps only the additional rows + summary. Class name kept so the existing
  `operations-more` count check still applies.
- Board chevron: inline 12px SVG (up-chevron path `M3 7.5l3-3 3 3`), `aria-hidden="true"`
  so chart-SVG counts (page-html, smoke `dom.chartSvgs`) and the `svg title` check are
  unaffected. Closed state rotates it 180° (down); open state shows it as-is (up).
  Marker removed via `list-style: none` + `::-webkit-details-marker` + `::marker`.
- Links: `target="_blank"` on the operation anchor; `rel="noopener noreferrer"` kept,
  URLs and server row order untouched.
- No `texts.ts` change: `Show all N` / `Show 5` already match the board captions.
- Tests state meaning: unit tests assert the summary follows the last row in the feed
  block, single list, both labels, arrow present, no `⌄`, every link new-tab, ≤5 → no
  control; page-html carries the same meaning checks so all mock states (unit) and the
  hydrated page (smoke) are covered; smoke asserts visual place via bounding boxes in
  both states, both input modes without JS (Enter key one way, pointer the other).

## Rejected
- `order`-based visual move with summary first in DOM: placement would depend on flex
  `order` penetrating `<details>` rendering; DOM order would contradict visual order.
- Checkbox+label: no native keyboard activation without JS.
- `:target` anchors: URL-hash side effects, two links instead of one control.
- Reading the board `.dc.html` directly: worktree sandbox blocks paths outside the
  worktree; used the task's board excerpt instead.

## Findings
- Native `<details>` hiding keys off the summary in DOM order: a summary placed last
  renders first when open (verified in headless Chrome: summary box precedes the rows)
  and must stay first. The control therefore sits first in markup and is ordered last
  visually with flex `order` (verified: open state shows the summary after the rows).
- Closed `<details>` content hides via `::details-content { content-visibility: hidden }`
  but keeps layout boxes, so the smoke counts rendered rows with `checkVisibility()`,
  not bounding boxes (a box-based count saw 20/20 while closed).
- The board chevron is an up-chevron path; closed state rotates it 180° (down).
- `collectDom`/`checkPageState` count only non-`aria-hidden` SVGs → arrow must be hidden.
- `checkNoJavascript` runs only for `long-history`; extension written overview-driven.
- `texts.test.ts` forbids user-facing JSX literals → SVG carries no text/labels.
