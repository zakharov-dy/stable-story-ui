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
- Stress-width fix: the figure keeps `flex:none` but gains `max-width:100%`, so long hero notes
  (unreconciled/incomplete copy) wrap inside the figure at 320 px instead of widening it past the
  viewport. The board's right-aligned `.reason` rule was reverted to the built left-aligned one —
  the reason styling is not one of the five changes, and the aligned variant collided with the peak
  annotation in the gap state. (An intermediate smoke failure was a stale build: the smoke reuses
  the check:build output, so the rebuild had to run before judging the CSS fixes.)

## Review round 1 (2026-11-07) — majors fixed

- F1 (short history opened on 30D): the page now owns its availability rule
  (`offPeriods` in apps/web/src/view.ts): ALL is off while `historyDays(overview) <= 90` (or its
  view is null); 90D and 30D are off only when the server supplies no view. The accepted board's
  demo history is 90 days, but the task's acceptance binds the fallback to the short-history state
  as built (7 days): ALL disabled with the ALL-specific reason, 90D active in the chart head and the
  sticky bar, flows on 90D. `texts.period.shortNote` is gone; the reason is always the ALL note.
  packages/view stays untouched (its `disabledPeriods` remains for mobile).
- F2 (phone status dots grey): each `status-list` li now carries `data-chain-index`, so the shared
  `[data-chain-index]` --chain-color slots apply; the smoke asserts six distinct colours and the
  registry order of the phone rows.
- F3 (smoke endorsed the bug): `browser-smoke-launch.ts` derives the expected default from the
  accepted rule itself (ALL when its view exists and history > 90 days, else 90D, else 30D) and
  asserts the ALL/90D radio and sticky disabled states plus the visible ALL reason against that
  rule, independent of the page's set. page-html.ts gained the same doc-rule checks for the radios,
  sticky disabled states and the reason on every state (unit + check:build), so the short-history
  default can no longer pass for the wrong reason. The sticky `aria-pressed` default is asserted
  pre-interaction by the smoke only — the interaction checks press other periods before the
  hydrated HTML is captured, so that attribute is not stable in the shared HTML check.
- Minor fixes: the phone state marker is `●` (texts.status.stateMark) coloured by state, ◇ only for
  unreconciled; the status table's first cell keeps table layout (dot and name wrapped in a
  `.chain-name` flex span); the delayed brand-note check slices every brand link instead of the
  first; the phone status meta lines are now asserted by page-html.ts from the overview.
- Reviewer question on the phone brand row: Home-1107-390 keeps date and link in one flowing
  `.through` span, so at 390 the date's row ends after the "·" and the link wraps as inline text,
  tagline last. Our separate `data-date` element plus `.brand-note { order: 1 }` produces the same
  composition (date row, then link, tagline full-width below; one row when the width allows), and
  keeps `data-date="brand"` carrying exactly the full data date for LC-04.
