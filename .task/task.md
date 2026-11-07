AI review: on · reviewer commandcode · model deepseek/deepseek-v4.1-flash · effort high · rounds 3

# Operations: the disclosure control at the end of the list, links in a new tab

## Why

Stable Story is the owner's public showcase and the page is live. On 2026-11-07 the owner looked at `https://stable-story.vercel.app` and named this block: «гадкая кнопка переключается, остаётся после 5 транзакций». The accepted Home boards show one control at the end of the operations list; the built page puts it after the fifth row, so in the open state it sits in the middle of the list, and the chevron is the browser's native `<summary>` marker instead of the board's arrow. Every row is also an explorer link that opens in the same tab, while the owner's ↗ mark means a new tab. Both are deviations from the accepted board and from the owner's words, not new design decisions: the design request for a different control is with the designer, and this task restores the board as accepted on 2026-11-04.

## Launch criteria

None (inbox entry: «Критерий: нет — эпик владельца; LC-02, LC-04, LC-05, LC-06 задают ограничения»). LC-02, LC-04, LC-05 and LC-06 stay as they are: no chain, date, quality or period shown by the page changes, and no row of `docs/requirements/launch-criteria.md` changes in this PR.

## What to read

- `docs/design.md` §"Largest operations" (line 25) and the testing paragraph (line 65): the control is the disclosure for additional rows; the smoke checks controls with and without JavaScript. The period radios and the chain-status disclosure already work without hydration; the operations control must keep that property.
- `apps/web/src/components/Feed.tsx`, `apps/web/src/components/EventRow.tsx`, `apps/web/src/styles/lists.css` — the current markup: `<details class="operations-more">` with `<summary>` before the second `.oplist`, so when open the control stays after the fifth row; the row link has `rel` but no `target`.
- `apps/web/src/checks/page-html.ts` (the `operations-more` count) and `apps/web/scripts/browser-smoke-launch.ts` (`checkNoJavascript`, which covers the period radios and the status disclosure).

Board excerpt (`handoff/web/design/home-2026-11-04/Home-operations-1280.dc.html`, open state): the rows form the list, and the control is the last element of the block — `<button class="disclosure" aria-expanded="true">Show 5 <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 7.5l3-3 3 3" …/></svg></button>`. Closed state, from the same board's README: `Show all 20` with the arrow pointing down. The block has one list, not two, and no native marker.

## Task

1. **Control at the end.** In both states the control is the last element of the operations block: closed — five rows, then `Show all 20 ▼`; open — all twenty rows, then `Show 5 ▲`. The rows keep their server order and the page still renders only five rows before expansion.
2. **Board's chevron.** Replace the native `<summary>` marker with the board's 12 px SVG arrow; it points down when closed and up when open. No `⌄` text and no browser triangle.
3. **Works without JavaScript.** The control keeps working without hydration, like the period radios and the status disclosure (docs/design.md; `checkNoJavascript`). Extend the smoke's no-JS pass to it: with JavaScript disabled the block shows five rows and the control, and after activating the control it shows all rows.
4. **Links open in a new tab.** Every operation row keeps its explorer URL and adds `target="_blank"`; `rel="noopener noreferrer"` stays. This is the owner's reading of the ↗ mark.
5. **Tests state the meaning**, not the markup: the control follows the last row in both states; its label and arrow direction change with the state; every operation link carries the new-tab target; a response with five rows or fewer has no control (unchanged). Update the `operations-more` marker/count check and the smoke counts if your markup changes them, in the same PR.

## Out of scope

- The chain-status panel and its form (the designer decides: inline card, hover modal or none), the period defaults and order, the sticky bar, the hero waterfall — all wait for the new boards.
- Any token, `packages/contracts`, `packages/view`, mobile, README or public docs change. No new dependency, no `package.json` or lockfile change.
- Anything else in `apps/web` than the files listed below.

## Acceptance criteria

- Rendered page: closed — five rows then `Show all 20` with a down arrow, no native marker; open — twenty rows then `Show 5` with an up arrow, and the control is after the twentieth row, not after the fifth.
- With JavaScript disabled the same two states work (keyboard and pointer).
- Every operation link opens in a new tab (`target="_blank"`, `rel` keeps `noopener noreferrer`).
- Page tests and the smoke carry the checks above; `docs/design.md` gets at most one clarifying line if its wording does not already cover the control's place.
- The web gate is green (checks below); the report names every exit code and the checked commit sha.

## Branch, network, files

- Branch: `web/ops-disclosure` (if the harness assigns its own worktree branch, keep the assigned one and say so in the report).
- No network beyond the worker's own installs.
- **Files you may change**: `apps/web/src/components/Feed.tsx`, `apps/web/src/components/EventRow.tsx`, `apps/web/src/styles/lists.css`, `apps/web/src/texts.ts` (only if a label must change), `apps/web/src/checks/page-html.ts`, `apps/web/src/**/*.test.ts`, `apps/web/scripts/browser-smoke-launch.ts`, `apps/web/scripts/browser-smoke-checks.ts`, `docs/design.md` (one line at most).
- **Design**: /Users/dmitry/dev/block-and-tell-artifacts/handoff/web/design/home-2026-11-04/
- **Plan**: plan if you need one (a small UI change; any plan goes to the reviewer, not to the coordinator).

## When to ask (`QUESTION:`)

Only what the pair cannot decide: policy, scope, the owner's decisions — e.g. the native control cannot be made to work without JavaScript inside the allowed files, or a gate failure whose cause lies outside them.

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

No interactive browser and no screenshots (the headless `browser-smoke` is part of the gate); no full reads of big files (grep, sed ranges); no rereads; cut outputs. The board file is one long line — read it with `grep -o` or a small excerpt, not whole.

## Для ревьюера

Major threshold: the control still sits in the middle of the open list, or a native marker stays; the control stops working without JavaScript; an operation link loses `target="_blank"` or changes its URL; a test passes for the wrong reason (asserting markup order instead of the control's place in the block, or asserting no rows beyond the render); a change outside the allowed files; a failing check reported as green (missing `set -o pipefail` or missing exit codes). Everything else is minor.