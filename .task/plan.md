# Home redesign implementation plan

## Inputs and boundaries

Read the handoff README first, Home-1280/Home-390, detail and state boards, home.css, the supplied overview document, and owner decisions in sections 2–3 and 10. The accepted boards win over earlier prompts. Use only this assigned worktree and preserve its assigned branch/base (`worktree-go-homepage`, origin/main at 13d57a4). The requested public branch name is `web/home-redesign`; the worker protocol requires preserving the assigned branch, so publishing/PR naming remains with the driver/coordinator.

Task recorded first in commit 7498b83. `git fetch origin` succeeded; origin/main is still 13d57a4. `pnpm install` completed with exit 0. No implementation changes in the plan round. No interactive browser, screenshots, pixel comparison, backend access, or network beyond git/pnpm.

Implementation is limited to apps/web, formatting-only changes in packages/view if needed, and docs/design.md. Contracts, fixtures, tokens, mobile and other repository docs stay outside the change. The token dependency is not currently present on origin/main; fetch and rebase onto its merged main revision before implementing CSS that consumes the new tokens. Do not add token values locally or edit the generated token stylesheet independently.

## Data provenance and pending decision

All displayed figures are selected from Overview and formatted. No sums, differences, shares, new time buckets or reconciliation totals are calculated. Axis domains, positions, paths and stacking of flow coordinates are rendering geometry, never new displayed metrics. Do not use existing view helpers that aggregate data to produce displayed values.

- Hero: header.supply.value, header.change1d.value, header.change7d.value.
- Waterfall: day.rows entry with scope `all`, four flow values and ready net; no chain summation.
- Chain list: latest ready level/share values from the 30D view; each chain's day.rows net; matching status.
- Stack: view.supplyByChain.level/share/total/stackedLevel/stackedShare. For each known layer, select its ready top and the nearest preceding known ready boundary, or the baseline. noDataChains distinguishes absent coverage from an unknown bucket; a missing layer does not erase known layers. Null values remain missing. Never recompute a total or share.
- Peak annotation: scope-all max_supply record, when its day lies within the selected view; map that date to a supplied bucket for positioning.
- Flows: selected view.drivers and issuerVsBridge scope-all volume.issuerShare fields; seven-day issuer line from header. Each chain uses its own scale.
- Operations: largestEvents.items in server order, first five and remaining rows through disclosure; supplied range, bridge metadata and explorer URLs.
- Records: four scope-all records with their supplied since/day/value.
- Status: matching status.chains fields in enabled-chain API order; no aggregate counts.

The current Overview has no reconciliation summary. Omit the illustrative stamp as explicitly permitted. The brand row also contains `6/6 reconciled` (and `5/6` in state boards), which is another numeric total absent from the contract. **Decision requested:** may that numeric brand tally be omitted along with the stamp until a ready contract field exists? Keep the date, per-chain disclosure and direct delayed/unreconciled notes. Do not synthesize the tally or change the contract. Code waits for this answer as well as plan approval.

## Components

Keep:

- Dynamic SSR page loading, one ApiClient overview call, metadata/noindex behavior and build window/leak checks.
- Mark, shared date/amount formatting, quality primitives and chain registry order.
- Chart/ChartHover interaction architecture: server-built tooltip content, crosshair, markers, keyboard navigation, mobile pin/close and accessible chart names. Adapt markup/CSS without adding a second tooltip.

Rewrite:

- PageView: board layout and state branches; status disclosure under the brand row; no method/footer on unavailable or empty boards.
- Header: tracked supply monument, two deltas, a five-column day waterfall and direct quality note. Remove KPI/sparkline rendering.
- SupplyByChain: one Level/Share selection, one selected chart lane, chain list beside it on desktop and before it on phones; ready partial-coverage layers and peak annotation.
- PeriodSwitch: stack toolbar plus synchronized sticky copy, disabled reasons based on current availability policy; switch affects only stack and flows. Retain pre-rendered server period data at server resolution and hydrate selection without refetching or rebucketing.
- Drivers: flat 18% issuer fills, hatched bridge bands/dashed edges and gold net; wrapping chain chips; selected period range and ready issuer shares; no scale captions, per-card headers or period echo pill. Support any chain count instead of six hardcoded selectors.
- Feed/EventRow: five complete explorer-link rows and Show all N disclosure, board flow swatches, bridge peer/V1/V2 and unpaired variants, no visible magnitude column.
- Records: four plain values/dates in a line, two columns on phones, no nested event table.
- Status: disclosure table with state, last closed day, checks, last run and mismatched days; responsive labels/wrapping to avoid overflow; chain-state and quality attributes remain on their carriers.
- Notes/texts/styles: board wording from texts.ts, concise method/disclaimer, flat background, token-based typography and spacing, ten chain slots and fallback swatch for chain 11. Sticky bar uses --sticky-bar-height; chain-row hover/focus dims other layers to --opacity-dimmed. Reserve the asset lane header without another asset switch.

Remove obsolete production components and their obsolete tests/references where no longer used: DayEquation chain cards, IssuerVsBridge table, Sparkline, numbered SectionHeading, KPI card helpers, standalone page-flow status and old captions/cadence. Remove incomplete-period labels/shading, glow and global card hover. Preserve meaningful API, formatting, quality and interaction coverage while replacing old layout assumptions.

## Page order and layout

1. 64px brand row: wordmark, tagline, Through <date with year>, direct state note as needed. Under it chain-dot disclosure; illustrative summary omitted pending contract support.
2. Hero: 128px supply figure at desktop / 64px on phone, today and seven-day deltas, waterfall to its right / below on phone, single /// date marker. Unreconciled note and dashed affected marks.
3. Supply: 32px after hero, Level/Share and 30D/90D/ALL toolbar, asset lane label, ~400px plot plus chain list. Phone list precedes chart. One visible sentence explaining weekly/monthly older periods. At 1280×800 the whole stack/list must fit the board's first-screen geometry.
4. What moved it: 96px separation, selected range and ready issuer shares, seven-day mint/burn line, All + wrapping chain chips, one visible chart on its own scale.
5. Largest operations: own seven-day window, first five link rows, remaining rows in disclosure.
6. Records: own since window, four figures/dates in one desktop line / two phone columns.
7. How we count: board method, untracked-domain sentence, disclaimer.

A fixed 48px sticky bar appears only after the hero leaves the viewport; desktop wordmark/mobile logo, Through date, synchronized period and status disclosure access. No sticky chain chips. Empty: brand, no-closed-day message and six chain dots, no axes. Unavailable: wordmark, Data unavailable, exact explanatory sentence, Reload, no figures/chains/charts. Demo label remains when serving mocks.

## Verification and launch criteria

Update tests with behavior assertions rather than preserving old block counts. Replace smoke/page-html expectations with new sections, link rows, chain list/disclosure, quality marks and all nine mock states. Headless smoke covers 320/390/1280, selection in both period controls, Level/Share, every chain chip, disclosure, sticky threshold, known/null ALL layers, single tooltip and zero native SVG titles after hydration, keyboard/touch behavior, link-only/interactive hover, chain order/colour and text overflow/overlap. Add synthetic 10/11-chain coverage without editing contract fixtures. No screenshot comparison. Keep new test files under 400 lines; record any unavoidable longer touched file with a reason.

- LC-02: smoke verifies each of six chains in API order with distinct slot colours, opens disclosure, checks each supplied state; growth test covers ten slots and fallback.
- LC-04: page test checks Through <asOf with year> in brand and sticky markup; smoke checks visibility at the appropriate scroll position.
- LC-05: page-html validates chain-state/quality carriers and expected mock quality; smoke checks delayed lag/ring and unreconciled note/dashes/disclosure after hydration.
- LC-06: use each view's ready period/buckets; test 30D/day, 90D/week, ALL/month, noDataChains and null ≠ zero. Required grep for startOfWeek/isoWeek/monthOf/bucketBy exits 1.
- LC-07: retain and pass check:build window validation over HTML and RSC; only the permitted server-prepared resolution is serialized.
- LC-08: one visible older-period sentence, tested after selection as well as in markup; required prohibited-copy grep exits 1.

Replace docs/design.md old-page rules with current rules in normal present-tense prose, retaining module/token/fonts/accessibility/quality rules that still apply; no history or PR numbers.

After implementation, run with pipefail and capture actual exit codes and checked SHA: pnpm typecheck | tail -40; pnpm lint | tail -40; pnpm test --reporter=dot | tail -40; with AI_AGENT and CLAUDECODE unset, pnpm check:build | tail -40 then pnpm browser-smoke | tail -30. Do not run review commands. Update decisions before each review push; verify configured git author and add the writing model's Co-Authored-By trailer. Push only when ready; driver handles PR and review. Resolve major findings within three configured rounds or explicitly object/escalate. On final approval only, remove .task in a separate cleanup commit and push; report last code SHA, all check exit codes, launch evidence, limitations, rejected options, rounds and verbatim verdict.
