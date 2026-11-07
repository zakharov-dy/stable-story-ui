# Decisions log

## Plan round (2026-11-07)

- Period display order is a web-local `PERIOD_ORDER = ['all','90d','30d']`; `PERIODS` in
  packages/view stays untouched (packages/view is out of scope and shared with mobile).
- The brand row gets a single link slot: delayed notes replace the reconciled tally when chains are
  delayed, per `Home-1107-state-delayed-1280`; unreconciled keeps the tally with ◇.
- The phone Status section renders the board's `ul.status-list` alongside the desktop table (CSS
  chooses); both are server HTML, no JavaScript. Chain-state carriers stay 3 per chain
  (chain list, desktop table, phone list).
- Waterfall keeps the existing symmetric y-scale (zero at mid-height); only x-geometry moves to the
  board's 560/112/48 grid. Zero-line and connector stroke colours stay as built (tokens unchanged;
  board styling of these hairlines is not part of the five changes).
- The date and the reconciliation link are separate elements in the brand row (visually
  `date · link` as on the boards) so `data-date="brand"` keeps carrying exactly the full data date.

## Implementation round (2026-11-07) — reviewer questions answered

- Boards consulted: Home-1107-1280 (section order flows → ops → records → status → method),
  Home-1107-390 (brand row = wordmark · tagline · date · rec-link; status list rows), and
  Home-1107-hero-2560 (bnote: "the page keeps its 1280 px column, so the hero is the same as at
  1280" — our `.wrap` max-width already does this). All three extracted by shell regex, never read
  whole.
- Status heading: both accepted status boards (status-1280, status-390) render
  `<h2>Status <span class="dim">· as of Nov 2, 2026</span></h2>`, so "Status · as of <full data
  date>" is board copy, implemented as `texts.status.title` + new `texts.status.asOf`.
- Delayed board re-checked: the brand row is `Through Nov 2, 2026 · <a class="rec-link m-delayed">Base
  · 30 h behind</a>` — a single link, no reconciled tally. The task's "keep their brand-row note (now
  the link)" reads as: the note stays, and it becomes the link. docs/design.md and the regression
  test are updated to this board behaviour; the supplied tally still appears in the Status section's
  aside stamp.
- State-cell details on the state boards (● marker, "delayed · 30 h" wording) are declared
  illustrative in the README ("Illustrative, as before: … the state boards …"); the table keeps our
  existing cell contents ("the same table"). The phone list follows the binding status-390 board
  (sl-name / sl-state with marker / two sl-meta lines).
- Hero figure: kept the board's `flex:none` on figure and waterfall instead of the suggested
  `flex:1 1 0` — with grow, the figure shrinks to the leftover space below ~1200 px and the 128 px
  monument overflows onto the waterfall exactly in the range the board says wraps ("at 1000 px the
  waterfall wraps under the figure"). `flex:none` reproduces the board's wrap mechanism; realistic
  figure max-content (compact monument ≤ 7 chars) keeps 1280 side-by-side, verified by the smoke.
- The smoke leaves the operations disclosure open (the open state has no control to close, per the
  board), so the hydrated DOM serialises `<details class="operations-more" open="">`; the page-html
  checks now tolerate the runtime `open` attribute instead of matching the closed-form literal.
- Coordinator-cap note: the first implementation turn hit the turn cap mid-probe; work resumed from
  the worktree with no loss, and the fixes above are the only changes beyond the approved plan.
