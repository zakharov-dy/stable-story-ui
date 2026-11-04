AI review: on · reviewer commandcode · model deepseek/deepseek-v4.1-flash · effort high · rounds 3

# Home page by the accepted `Home-*` boards

**Why.** Stable Story is live (https://stable-story.vercel.app); its goal is to show in 30 seconds that the owner can build a whole data product. The owner says the current page is a pile of numbers spread over ten screens. On 2026-11-04 the owner accepted a new home page: five blocks instead of ten — the tracked supply figure with a waterfall of the last day, the supply stack with a chain list, flows, five largest operations, a records line, a short method — a sticky bar with the period, no glow, no KPI cards, no section numbers. The boards are the specification; this PR builds the page to match them.

- **Design**: /Users/dmitry/dev/block-and-tell-artifacts/handoff/web/design/home-2026-11-04

Read in that folder first `README.md` (which board is which, chart rules, tokens), then the boards (`*.dc.html`, HTML with `home.css`) and `overview-2026-11-02.json` (the document the boards were drawn from). Background and the owner's decisions: `/Users/dmitry/dev/block-and-tell-artifacts/handoff/web/fable-answer-2026-11-04.md`, sections 2–3 and 10 (ignore its old prompt numbers where the boards differ: the boards win).

**Launch criteria that must stay met** (each check keeps passing; the report names the evidence for each):

- LC-02 — six chains in API order, each its own colour; the status of every chain is on the page (in the chain-dot disclosure). Evidence: `browser-smoke` over the mock states.
- LC-04 — the data date is visible ("Through Nov 2, 2026" in the brand row and the sticky bar). Evidence: a page test.
- LC-05 — reconciliation and quality visible: keep the `data-chain-state` and `data-quality` attributes on the elements that carry chain state and quality, including the unreconciled and delayed mock states. Evidence: `browser-smoke`, `apps/web/src/checks/page-html.ts`.
- LC-06 — 30D by day, 90D by week, ALL by month, the step from the server; a chain before its coverage is "no data", never 0. Evidence: `grep -rn 'startOfWeek\|isoWeek\|monthOf\|bucketBy' apps/web/src` finds nothing (exit 1).
- LC-07 — `pnpm check:build` window check passes (no daily value of the charts older than 30 days in HTML or RSC).
- LC-08 — no teaser, PRO, export; one visible sentence that older periods are shown by week and month. Evidence: `grep -rin 'request full data\|PRO badge\|unlock\|teaser\|paywall\|download' apps/web/src` finds nothing; the sentence test passes.

## Task

Rebuild the page in `apps/web` to the boards, at 1280 and 390, in all mock states:

- Blocks, order, texts, sizes and chart rules exactly as on `Home-1280`, `Home-390` and the detail boards; every visible string in `apps/web/src/texts.ts`. Remove what the boards remove: the day-equation cards, KPI cards and sparklines, the issuer-vs-bridge table, record cards, the status table from the page flow (it moves into the chain-dot disclosure), section numbers, the "set above ↑" pill, the cadence line ("by 06:00 UTC"), the glow, the incomplete-bucket shading and its "incomplete period" texts, the explanatory captions the boards drop.
- The owner's issues on the old page must not come back: one tooltip per chart and no native SVG `<title>` after hydration; hover only on links, buttons, chips and link rows (drop the global `.card:hover`); chain chips wrap and never truncate or overlap; no text overlaps text and numbers are never truncated at 320, 390 and 1280.
- Stack in ALL: draw the known layers and mark a missing chain "no data" from `noDataChains` of the view (owner, 2026-11-04); a bucket with one null layer is no longer a hole for every chain.
- Sticky bar (48 px, `--sticky-bar-height`) appears when the hero has scrolled out; the period drives the stack and the flows only. Hovering a chain-list row dims the other layers to `--opacity-dimmed`.
- Chain colour slots: CSS for slots 1–10 (`--color-chain-1…10`); an 11th chain falls back to the default swatch and the page stays readable.
- The reconciliation stamp under the brand row ("6/6 chains · 0 mismatched days · ≈9,700 chain-days closed") depends on a contract field that the backend is adding now. If the data needed is not in the current `Overview` contract, render the stamp only from what the contract has (or leave it out) and say which in the report; do not compute totals on the page (subtracting or summing figures from the document is not allowed) and do not change the contract.
- The page derives nothing: every figure is a field of the document (the waterfall is `day.rows` for scope `all`). If a board shows a value the contract lacks, stop and ask (`QUESTION:`).
- `browser-smoke` and its counts change with the page: update the smoke in this PR so it checks the new page (states, chains, quality marks), not the old blocks. `docs/design.md`: replace the rules of the old page with the new ones in the same normal text (no history, no PR numbers); keep the rules that still hold.
- Do not add a pixel or screenshot comparison. Do not open an interactive browser or take screenshots (the headless `browser-smoke` is the exception).

Out of scope: the contract (`packages/contracts`), tokens (they land in the PR `tokens/home-redesign`; if it is not merged when you start, rebase on it when it is), `apps/mobile`, README and other repository docs besides `docs/design.md`.

- **Files you may change**: `apps/web/**`, `packages/view/**` (formatting only; no aggregation, ADR 0027), `docs/design.md`.

- **Plan**: plan first — the page is rewritten end to end; the plan names the components kept, rewritten and removed, the order of blocks and how each launch criterion's check stays green.

## Setup and checks

Fresh `origin/main` of this repository (`zakharov-dy/stable-story-ui`), `pnpm install`. Branch `web/home-redesign`. Checks with `set -o pipefail` and cut output: `pnpm typecheck | tail -40`, `pnpm lint | tail -40`, `pnpm test --reporter=dot | tail -40`, then with `AI_AGENT` and `CLAUDECODE` unset `pnpm check:build | tail -40` and `pnpm browser-smoke | tail -30`. Test files over 400 lines need a reason in the PR. PR at the first push; the final report has every exit code and the sha of the last code commit, and the evidence for each launch criterion above. Author: the configured git identity (`git log -1 --format='%an <%ae>'` before each push); `Co-Authored-By` of the model that wrote the code. Network only for git and pnpm. Ask (`QUESTION:`) only for scope, a missing contract field or the owner's decisions.

## Для ревьюера

Major: a launch criterion check above fails or passes for the wrong reason; a value derived on the page (sum, difference, bucket) or a contract change; a block, order, text or state that contradicts the accepted boards; null rendered as 0; a second tooltip or a native title after hydration; hover on non-interactive elements; overlapping or truncated text at 320/390/1280 that the boards do not have; a chain colour used for a flow. Everything else is minor.