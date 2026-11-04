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
## Coordinator clarification

AI review, plan round 1/3 (commandcode deepseek/deepseek-v4.1-flash · high, commit 8e1cdd8): plan approved.
The plan is coherent and implementable: it maps every launch criterion to a check, keeps all figures from contract fields, and respects the allowed paths and no-screenshot rules. The reconciliation stamp can be omitted as the task already permits; the remaining items are board details to confirm before coding rather than plan blockers.

Questions from the reviewer:
- The task already permits omitting the reconciliation stamp when the contract lacks the data; proceed with omission and note it in the report. Do not block the implementation waiting for a separate answer on the brand-row tally unless the coordinator says the board requires it.
- Docs/design.md currently says How we count is drawn in every state (without its coverage line when unavailable). The plan says "no method/footer on unavailable or empty boards". Confirm from the accepted Home state boards that both How we count and the disclaimer are actually removed there; if they are kept, restore them in the plan.
- The plan's chain-dot disclosure table lists state, last closed day, checks, last run and mismatched days, but the current status table also carries Last block. Confirm whether the board's disclosure keeps Last block (and the current table columns) or intentionally drops it.
- Confirm the board actually shows a peak annotation on the supply stack. If it does not, drop it; adding an annotation not on the boards would contradict the specification.
- The contract comment says largestEvents carries five items with no paging (nextCursor: null), and the task says "five largest operations". Confirm whether the board really has a "Show all N" disclosure for remaining rows; if items are exactly five, render the five rows and drop the empty disclosure.
- Confirm whether the hero deltas use header.change1d/change7d .value or .changePct, or both. The plan's data-provenance list names only .value while the board may show percentages.
- Confirm how the chain list is period-scoped. The plan says latest level/share from the 30D view; if the board's chain list follows the selected stack period, take the values from the selected view instead.
- Confirm the tokens/home-redesign dependency is merged before CSS work; if not, state how --sticky-bar-height, --opacity-dimmed, and chain slots 7–10 will be obtained without adding token values locally.

Minor (optional, non-blocking):
- The plan says "four scope-all records"; the contract does not guarantee exactly four or that every record is scope-all. Render the overview.records array as supplied (filtered as the board shows) rather than assuming a cardinality.
- Enumerate the texts.ts keys removed (cadence, KPI/equation/sparkline strings, incomplete-period wording) and the new board strings added, so no obsolete string survives or is tested by accident.
- Keep the main 30D/90D/ALL switch CSS-only and test it without JavaScript, as docs/design.md requires; the plan only says selection is hydrated. The sticky copy may use JavaScript.
- Spell out the exact docs/design.md sections to rewrite (glow, KPI cards, sparklines, status table, section numbers, incomplete shading and captions, period switch) and which old rules remain unchanged.
- State explicitly that `pnpm browser-smoke` will include the 320 px stress width in addition to the 390 and 1280 board widths, and how overflow/overlap is asserted at each.

Implement the plan now. Record decisions and any deviation from the plan, with the reason, in .task/decisions.md. Push when the implementation is ready for review: the same reviewer session reviews it, with a new limit of 3 rounds.

## Implementation review round 1

AI review, round 1/3 (commandcode deepseek/deepseek-v4.1-flash · high, commit 0966dc0): changes requested.
The rewrite is largely complete and the launch checks pass on the supplied mocks, but four state/quality defects still need fixing: stack layers take their colour slots from the server series array instead of overview.chains order, the brand reconciled tally disappears whenever a chain is delayed, the hero unreconciled note keys on the common asOf instead of the chain's lastClosedDay, and the header quality/note only reads the supply card so the short-history 7-day change is not marked.

Major findings:
F1 — Stack layers and colours follow the series array, not overview.chains order
  Location: apps/web/src/components/SupplyByChain.tsx:51 (stackGeometry) and apps/web/src/components/SupplyByChain.tsx:264 (data-chain-index={at + 1})
  Scenario: An Overview whose views.all.stackedLevel.lines are returned in a different order from overview.chains (the contract does not require line order; the old SupplyByChain sorted by chainInfo). The first layer is drawn with --color-chain-1 and data-chain-index=1 although it is another chain, while the chain list, status table and tooltips use overview.chains order. Hovering that chain's list row then dims the wrong stack layer.
  Expected: Stack layers, their data-chain-index and their colour slots are joined to overview.chains by chain key (chainInfo index), so the six chains use their API-order colours in every chart and the chain-row hover dims the matching layer.
  Evidence: stackGeometry returns boundaries.lines.map((line, layer) => ({ key: line.key, ... })) with no chainInfo sort; StackPlot renders data-chain-index={at + 1} from that array position. The old SupplyByChain sorted series.lines by chainInfo. home.test.ts only reverses share.lines and checks the chain list by key; browser-smoke-launch.ts checks chain order and colours on .crow .dot only, not .chart-layer, so the mocks' already-ordered lines let this pass.

F2 — Brand reconciled tally is hidden whenever a chain is delayed
  Location: apps/web/src/components/PageView.tsx:57-70
  Scenario: MOCK_STATE=delayed (fixture packages/contracts/fixtures/delayed/overview.json has reconciledChains:3 and three chains) renders Base · 30 h behind but no 3/3 reconciled, although the accepted delayed state board carries the reconciled tally (the plan records 5/6 in state boards).
  Expected: The brand tally reads reconciliation.reconciledChains over the enabled registry size in every data state, alongside any delayed-chain notes, as the board shows.
  Evidence: PageView renders texts.header.reconciled only when model.state === 'data' && delayed.length === 0; delayed.length > 0 replaces it with the delayed notes. home.test.ts only tests the tally on long-history with no delayed chain, and browser-smoke-launch.ts never asserts the brand tally on the delayed state.

F3 — Hero unreconciled note keys on asOf, not the chain's last closed day
  Location: apps/web/src/components/Header.tsx:72-95
  Scenario: A delayed chain has lastClosedDay 2026-10-08 and unreconciledDays ['2026-10-08'] while overview.asOf is 2026-10-09. The filter status.unreconciledDays.includes(overview.asOf) is false, so the hero shows no unreconciled note for a chain whose last closed day failed; if asOf did match, the date rendered would be the common asOf rather than the chain's day.
  Expected: For each chain whose own lastClosedDay is among its mismatched days, the hero shows the note with that lastClosedDay, as the old Header and the plan/docs specify.
  Evidence: Header.tsx filters status.unreconciledDays.includes(overview.asOf ?? '') and formats formatShortDay(overview.asOf!); the old Header used status.lastClosedDay. page-html.ts no longer checks the header mismatch tag, and browser-smoke's unreconciled count only proves some data-unreconciled element exists, so the separate unreconciled mock (all chains closed on asOf) hides the bug.

F4 — Header quality and incomplete note ignore the displayed change1d/change7d cards
  Location: apps/web/src/components/Header.tsx:103-126 and apps/web/src/checks/page-html.ts:278-286
  Scenario: MOCK_STATE=short-history has header.change7d.quality.complete=false while header.supply.quality.complete=true (fixture lines 92-97 and 178-183). The hero renders 'no data over 7 days', sets data-quality="ok" from the supply card and shows no incomplete note; the old page merged the header card qualities and showed the missing-data note.
  Expected: The hero's data-quality and quality note reflect the figures it displays (supply, change1d, change7d), so an incomplete 7-day change is marked and explained, and page-html asserts that union rather than the supply card alone.
  Evidence: Header.tsx uses qualityAttribute(fromQuality(overview.header.supply.quality)) and the incomplete note condition overview.header.supply.quality.complete; page-html.ts asserts the same supply-only attribute. The old Header used merge(CARDS.map(fromQuality)) and checkMarks checked any header card. The all-state home.test/page-html run passes because it never asserts the change7d quality.

Questions from the reviewer:
- Confirm the exact accepted stamp wording. The code renders 'x/y reconciled' in the brand row and 'm mismatched days · n chain-days closed' in the stamp; the task quote is '6/6 chains · 0 mismatched days · ≈9,700 chain-days closed'. Should the stamp carry the '6/6 chains' fragment and the '≈' literally, or is the split wording what the board shows?
- Confirm the Header short-history intent: does the accepted Home-state-short-history board mark the missing 7-day change (and the incomplete issuer 7-day figures) in the hero, or does it intentionally show 'no data over 7 days' with the supply quality only? If intentional, F4 can be withdrawn.
- Confirm the Records null value wording: the new line renders formatCompact(null) ('no data') plus a reason, while the old line and texts.na use 'n/a'. Which does the board show?
- Confirm the ChainList data-quality for a no_data chain should be the quality token ('incomplete') as ChainDots and the status table use, rather than data-quality="no_data".

Minor (optional, non-blocking):
- Records renders 'no data' for a null record value instead of texts.na.label ('n/a'); the reason is present, but the label differs from the board vocabulary.
- tone(null) returns 'pos', so a missing hero delta or chain net is coloured positive even though it shows 'no data'.
- The ChainList reconciliation mark uses day?.unreconciled (the common asOf row) rather than status.state, so a chain whose lastClosedDay mismatch is not asOf shows a check mark; the status table still shows the correct state.
- checkLayout deliberately skips .peak and .sticky, so the visible peak annotation and sticky-bar text are not covered by the DOM overlap check; add a targeted peak/sticky geometry assertion if the boards require no overlap there.
- page-html should assert the header quality and incomplete note against the union of the displayed header cards, not only the supply card, so the short-history regression cannot pass again.
- Unused text groups remain after the rewrite (tags.chainUnreconciled, parts of quality/na.history); remove or use them to keep texts.ts honest.

What to do: fix the code for the major findings and record how each was settled (fixed, or dropped and why) in .task/decisions.md before the push, since a push may be the last one; then commit and push, and the push starts the next review round. If you disagree with a major finding, or answer a question, do not push: end your turn with a message whose first line starts with `TO REVIEWER:`, followed by your reasoning and evidence. The hook passes it to the same reviewer session, and its answer comes back to you. Do not repeat an argument the reviewer has already answered: a finding it keeps after your second objection goes to the coordinator as an escalation. A decision only the coordinator can take: ask it in a message that starts with `QUESTION:` and stop.

Clarification (2026-11-04): The ChatGPT usage limit has reset. Continue the task from where it stopped: your fixes for code round 1 (F1–F4) are pushed at `d4f0f2b`; let the round-2 review run and finish as the protocol says. Before that, rebase on current `origin/main` (it now has the Home tokens, PR #3, and the `Overview.reconciliation` field, PR #2): if the stamp under the brand row can now be built from `overview.reconciliation`, use it ("6/6" is `reconciledChains`, mismatched days is `all.mismatchedDays`; definitions in the contract), without computing on the page.
