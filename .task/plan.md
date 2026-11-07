# Plan: Home page, accepted 2026-11-07 boards

Boards read (shell extracts, never whole files): hero-1280, status-1280/390, sticky-bar-1280/2560/390,
operations-closed/open-1280, state-delayed/unreconciled/short-history-1280, home-1107.css.

## 1. Status section — Status.tsx, PageView.tsx, first-screen.css, lists.css, texts.ts

- Delete the top `.stamp-row` (stamp text + `<details class="chain-status">` chip). ChainDots stays for
  the empty state only.
- Brand row, one link slot per the three state boards, `href="#chain-status"`: delayed chains → one
  `rec-link` per delayed note (`Chain · N h behind`, data-quality="delayed"); else the tally
  `N/M reconciled` with ✓ (`.ok`) or ◇ (`.unrec`) in a coloured span. Board CSS: `.rec-link` hairline
  underline, hover accent.
- New section after `<Records/>`, before `<HowWeCount/>`:
  `<section class="block status" id="chain-status" data-block="status" aria-labelledby>` with a
  `sec-head` (h2 `Status · as of <full data date>`, the stamp line as `sec-aside`), a desktop
  `.status-table > table.status` (same six columns; `data-chain`/`data-chain-state`/quality on `tr`;
  `nowrap` + `overflow-x:auto` per board) and a phone-only `<ul class="status-list">` (name + state,
  then the board's two meta lines). Both server-rendered, always in the HTML, no `details`, no JS.
- texts: `status.title` → "Status"; new `status.asOf`, `status.closedLine`, `status.runLine`,
  `status.mismatchedShort`. The checks cell becomes one joined string (`supply ✓ · bridge ✓ ·
  continuity ✓`, `data-check` spans kept) reused by the phone meta line.
- Drop the old `.status-pop`/`.stamp-row` CSS and the table-as-blocks phone CSS.

## 2. Periods — PeriodSwitch.tsx, PageView.tsx

- `PERIODS` lives in packages/view (out of scope, shared with mobile): the web gets a local display
  order `PERIOD_ORDER = ['all', '90d', '30d']` exported from PeriodSwitch.tsx and used by the sticky
  bar. Default = first enabled in that order (ALL → 90D → 30D); sticky `aria-pressed` follows it.
  Flows already follow the same radios. Disabled logic and reason texts unchanged.

## 3. Hero waterfall — Header.tsx, first-screen.css, texts.ts

- `.hero` → `display:flex;flex-wrap:wrap;align-items:flex-end;gap:var(--space-5) var(--space-6)`
  (64 px column gap); figure wrapper `flex:none`; `.waterfall{flex:none;width:560px}` — never
  stretches; wraps under the figure below ~1060 px; ≤720 px waterfall `width:100%`, gap space-5.
  Remove the ≤1000 px hero grid overrides and the kpi monument shrink (tokens already give 64 px
  hero font ≤720).
- Figure content per the hero board: values row, SVG `viewBox="0 0 560 120"` (bars at
  `x = i*112+32`, width 48; connectors `i*112+80 → (i+1)*112+32`; zero line to 560;
  `preserveAspectRatio="none"`), labels row MINT BURN IN OUT NET (lowercase in texts, CSS uppercase,
  swatches deleted), group row ISSUER / CCTP BRIDGE under a `--color-border` rule (spans 2+2),
  caption.
- texts: `flowsShort` (mint/burn/in/out/net), `flowGroups` (issuer, cctp bridge).

## 4. Sticky bar — PageView.tsx, first-screen.css

- `.sticky` keeps the fixed full-width background + hairline; content moves into a `.sticky-in`
  (max-width 1280, gutter padding, flex). Wordmark left; `.through` (margin-left auto) then the
  period seg on the right. `.sdot`, its CSS and the scroll-to-status JS handler deleted.

## 5. Operations open state — Feed.tsx, lists.css

- Keep the `<details>`; summary restyled to the board's full-width more-row (centered, accent,
  min-height 52, border-bottom, chevron); add the board hint `details[open] > summary{display:none}`;
  drop `order:1`/`when-open`. `texts.feed.showFive` deleted.

## 6. Checks and docs

- page-html.ts: brand link per state (tally only when not delayed); stamp asserted inside the status
  section; status section present once, without details/summary/hidden; showFive checks removed;
  chain-state carriers stay `3 × chains` (list rows, desktop table, phone list).
- home.test.ts: block order unchanged (ALL_BLOCKS already has status after records); operations
  control test follows the new CSS rule and labels; the "tally beside delayed note" regression is
  updated to the board behaviour (delayed note replaces the tally in the single link slot).
- browser-smoke-launch.ts: no `#chain-status summary` clicks (table read directly; assert no
  summary/`details` in the section); brand-link content asserted per overview; default period and
  ALL·90D·30D order asserted in both switches; operations open: control hidden, no close click;
  sticky checks scoped to `.sticky-in`, plus no `.sdot` and right-edge alignment of date+period.
- docs/design.md and docs/web-testing.md rewritten for the built page.

## Checks

`pnpm typecheck`, `pnpm lint`, `pnpm test --reporter=dot`, `check:build`, `CI=true browser-smoke`
with real exit codes in the report.

## Rejected alternatives

- Reordering `PERIODS` in packages/view: out of scope (mobile shares it); web-local order instead.
- CSS-only phone status from table cells: cannot merge cells into the board's two meta lines; the
  board's `ul` is rendered instead.
- Keeping the reconciled tally next to delayed notes in the brand row: contradicts the accepted
  delayed/unreconciled boards, which show a single link slot.
