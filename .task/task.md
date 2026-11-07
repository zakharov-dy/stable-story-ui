AI review: on · reviewer commandcode · model deepseek/deepseek-v4.1-flash · effort high · rounds 3

# Home page: the accepted 2026-11-07 boards (Status section, periods, hero, sticky bar, operations)

## Why

Stable Story is the owner's public showcase and the page is live. On 2026-11-07 the owner reviewed it and named five changes; the designer drew them on the Home-1107 boards and the owner accepted them the same day (status form A). The code still renders the 2026-11-04 page: a chain chip and a `<details>` status panel, 30D by default and 30D first, a stretched hero waterfall whose labels collide on wide screens, a sticky bar with a round status button, and an operations control that stays after expansion. This PR makes the page match the accepted boards.

## Launch criteria

None of the `docs/requirements/launch-criteria.md` rows changes; LC-02, LC-04, LC-05 and LC-06 are constraints that must keep passing (six chain colours and order, the full data date in the brand row and the sticky bar, state and quality attributes, server-side period steps and selection). Do not edit that file.

## What to read

- The spec: `/Users/dmitry/dev/block-and-tell-artifacts/handoff/web/design/home-2026-11-07/README.md` ("What changed" rows 1–5) and the boards named there: `Home-1107-1280`, `-390`, `-status-1280/390`, `-hero-1280/2560`, `-sticky-bar-1280/2560/390`, `-operations-closed/open-1280`, `-state-delayed/unreconciled/short-history-1280`; `unchanged-2026-11-04/` holds the screens this request does not touch. `home-1107.css` is the board stylesheet.
- **Reading the export**: it lives outside your worktree. The sandbox allows reads; the `read` tool may refuse a path outside the workspace, so use the shell (`sed -n '1,200p' file`, `python3 -c` with a regex, `grep -o`) — the boards are single long lines, never `cat` a whole one. Do not copy the folder into the repository.
- The page: `apps/web/src/components/{PageView,Status,SupplyByChain,PeriodSwitch,Header,Feed,EventRow}.tsx`, `apps/web/src/styles/{first-screen,lists,charts}.css`, `apps/web/src/components/client/HomeInteractions.tsx`, `apps/web/src/texts.ts`, `apps/web/scripts/browser-smoke-launch.ts` and `-checks.ts`, `apps/web/src/checks/page-html.ts`.
- `docs/design.md` (the page description) and `docs/web-testing.md` (what the smoke checks); both must describe what is built after this PR.
- The current state after stable-story-ui#11: the operations control is already the last row of the list, with the board's chevron, working without JavaScript, and rows open the explorer in a new tab. Only its open state changes here.

## Task

1. **Status section** (board `status-1280/390`, README row 1). Remove the six-chain chip and its `<details>` panel from the stamp row. The brand row's `6/6 reconciled ✓` becomes a link to a Status section placed after Records and before How we count; the section is always open and needs no JavaScript: the same table (chain, state, last closed day, checks, last run, mismatched days), with the stamp line (`6/6 chains · 0 mismatched days · ≈9,700 chain-days closed`) as its aside. On phones the table becomes one two-line row per chain. Delayed and unreconciled states keep their brand-row note (now the link) and their chain-list marks.
2. **Periods** (row 2). ALL is the default and the order is ALL · 90D · 30D in the chart head and in the sticky bar. With history no longer than 90 days ALL is disabled with its reason and the default falls back to 90D (`Home-1107-state-short-history-1280`). Flows follow the main period, so they open on ALL too.
3. **Hero waterfall** (row 3). The fixed composition: the figure, a 64 px gap, then a 560 px waterfall (five 112 px columns, 48 px bars) that never stretches; below about 1060 px it wraps under the figure. Labels are short (MINT, BURN, IN, OUT, NET) with group labels ISSUER and CCTP BRIDGE under a rule; the swatches are gone. At 2560 the page keeps its 1280 px column, so the hero is the same as at 1280.
4. **Sticky bar** (row 4). No round status button and no scroll-to-status behaviour. Wordmark on the left; `Through Nov 2, 2026` and the period segment together on the right of the content column; the bar's background and hairline run the full width.
5. **Operations, open state** (row 5). When expanded, all 20 rows show and the control disappears (no `Show 5`); the extra rows stay after the summary. The board's hint is `details[open] > summary { display: none }`. `texts.feed.showFive` becomes unused — remove it if nothing else reads it.
6. **Tests and docs.** Page tests and the browser smoke carry the new behaviour: the checks that click `#chain-status summary` or assume the 30D default follow the new page; the smoke still proves the meaning (six chains, order, colours, date, quality, server steps), not markup order. If the new layout changes what `browser-smoke` counts, update it in the same PR. `docs/design.md` and `docs/web-testing.md` describe what is built.

The designer's own summary of the change (README "What changed", verbatim):

> 1. Chain chip and status panel — **Owner chose this (2026-11-07):** the six-chain chip and its disclosure are gone. "6/6 reconciled ✓" in the brand row is a link to a **Status** section placed after Records, before How we count: the same table (chain, state, last closed day, checks, last run, mismatched days), always open, no JavaScript; the stamp line (`6/6 chains · 0 mismatched days · ≈9,700 chain-days closed`) is the section's aside. On phones the table becomes one two-line row per chain. Delayed and unreconciled states keep their brand-row note (now the link) and their chain-list marks.
> 2. Periods — ALL is the default; order ALL · 90D · 30D in the chart head and the sticky bar. With history no longer than 90 days ALL is disabled with its reason and the default falls back to 90D. Flows follow the main period, so they open on ALL too.
> 3. Day waterfall in the hero — The waterfall follows the figure with a 64 px gap at a fixed 560 px (five 112 px columns, 48 px bars), never stretched; it wraps under the figure below ~1060 px. Labels are short (MINT, BURN, IN, OUT, NET) with group labels ISSUER and CCTP BRIDGE under a rule; the swatches are gone (the bars are the legend). At 2560 the page keeps its 1280 px column, so the hero is the same as at 1280.
> 4. Sticky bar — No round status button. Wordmark on the left; "Through Nov 2, 2026" and the period segment together on the right of the content column (the bar's content keeps the 1280 px column; background and hairline run full width).
> 5. Operations control — Closed: five rows, then "Show all 20" as a full-width last row of the list. Open: all 20 rows, and the control disappears (no "Show 5"). With `<details>`: `details[open] > summary { display: none }`, the extra rows after the summary. Rows open the explorer in a new tab.

## Out of scope

- `packages/contracts`, `packages/tokens`, `packages/view`, `apps/mobile`; the backend; any new token (the boards use existing ones).
- The showcase PNGs and the README captions on them (a separate task after this PR); the `browser-smoke --shots` catalog.
- Any other visible change, and any change to what the page shows from the document: no page-side aggregation, no new fields.

## Acceptance criteria

- At 1280, 390 and 2560 the page matches the boards: no chip; the Status section in its place, always open, with the stamp as its aside; ALL active by default with 90D and 30D after it in both switches; the hero composition with no overlapping labels between 1280 and 2560; the sticky bar without the circle, date and period on the right of the content column; expanded operations with no control.
- Short history: ALL disabled with its reason, 90D active; delayed and unreconciled states keep their notes and marks.
- Without JavaScript the period radios and the operations disclosure still work, and the status table is always present in the HTML.
- LC-02, LC-04, LC-05 and LC-06 keep their checks green; the server-side period behaviour is unchanged.
- The web gate is green (checks below); the report names every exit code and the checked commit sha.

## Branch, network, files

- Branch: `web/home-polish-1107` (if the harness assigns its own worktree branch, keep the assigned one and say so in the report).
- No network beyond the worker's own installs.
- **Files you may change**: `apps/web/src/**`, `apps/web/scripts/**`, `docs/design.md`, `docs/web-testing.md`.
- **Design**: /Users/dmitry/dev/block-and-tell-artifacts/handoff/web/design/home-2026-11-07/
- **Plan**: plan first — five screens, layout geometry and smoke behaviour; keep the plan short, it goes to the reviewer, not to the coordinator.

## When to ask (`QUESTION:`)

Only what the pair cannot decide: policy, scope, the owner's decisions — e.g. a board detail contradicts this text, or a required change falls outside the allowed files.

## Setup and checks

- Fresh `origin/main` of `zakharov-dy/stable-story-ui` in your worktree; `pnpm install` in the worktree (this repository is its own workspace; do not touch any backend checkout).
- With `set -o pipefail`, real exit codes, output cut:
  - `pnpm typecheck | tail -40`
  - `pnpm lint | tail -40`
  - `pnpm test --reporter=dot | tail -40`
  - `env -u AI_AGENT -u CLAUDECODE pnpm check:build | tail -40`
  - `CI=true env -u AI_AGENT -u CLAUDECODE pnpm browser-smoke | tail -30`
- PR at the first push (CI is manual only; no run is expected). The final report has the full local run on the last code commit: every exit code and that commit's sha. Commit author is the configured owner identity — check `git log -1 --format='%an <%ae>'` before each push; keep the `Co-Authored-By` trailer of the model that wrote the code.
- The PR lists every deviation from the letter of `docs/architecture.md` (there should be none in this PR).

## Economy

No interactive browser and no screenshots (the headless `browser-smoke` is part of the gate); read the boards with `grep`/`sed` ranges, never whole; no rereads; cut outputs.

## Для ревьюера

Major threshold: a screen does not match the accepted board (the chip or a disclosure still present; the status table not in its place, hidden, or needing JavaScript; ALL not the default; the order not ALL · 90D · 30D; the hero stretched or its labels overlapping between 1280 and 2560; the round sticky button still there; the operations control still visible when expanded); a regression of LC-02, LC-04, LC-05 or LC-06; a smoke or page check weakened or deleted instead of updated; a test that passes for the wrong reason (asserting markup order where the meaning is layout or content); a change outside the allowed files; a failing check reported as green. Everything else is minor.