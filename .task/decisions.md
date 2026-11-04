# Decisions and findings

## Plan round

- Task committed verbatim first as 7498b83, including supplied review header.
- Read CLAUDE.md, accepted handoff README/boards/styles/overview, owner background sections 2–3 and decisions section 10, current components, contract and view chart helpers/checks.
- Fresh fetch: origin/main remains 13d57a4 (assigned base). Keep assigned worker branch worktree-go-homepage per harness instruction; requested web/home-redesign name is recorded for coordinator/driver.
- pnpm install exit 0. Worker status confirms job homepage, Codex model gpt-6.1-sol, this worktree.
- No code or stylesheet changes before plan approval.
- Tokens home-redesign not currently on origin/main or in fetched remote branch list. Rebase on merged token main before consuming new tokens; local token edits rejected as out of scope.
- Overview provides ready totals, stacked boundaries, shares, day scope-all flows and noDataChains. Reject client aggregation, deriving percentages, rebuilding server buckets, or treating every partial-coverage column as a whole-stack gap. Existing stackFromBoundaries marks any null as a gap and must not control the new partial-coverage rendering; consume ready boundaries directly in web.
- Omit illustrative reconciliation stamp: Overview has no summary field. Brand 6/6 reconciled is also absent as a ready field; coordinator question in plan requests permission to omit that numeric tally until supported. Do not invent its numerator/denominator from arrays.
- Preserve direct per-chain statuses/quality and date. New headless smoke expectations replace old blocks/counts, with 320px stress and all mock states.
- No screenshot/pixel tests, interactive browser, backend dependency or changes outside allowed product paths (apart from mandatory .task protocol files).
- Rejected retaining hidden obsolete KPI/day-equation/table components to satisfy old tests: replace the tests with new-page semantic assertions instead.

## Implementation findings and resolutions

- Plan approved in round 1/3 at original plan commit 8e1cdd8. The clarification was appended verbatim in its own commit before code. After rebasing onto merged token main d4652c5, the task, plan and clarification commits are b51228d, 7cdf1b0 and 3e5580d.
- Confirmed Home-state-empty and Home-state-unavailable at both widths contain neither method nor disclaimer. Accepted state boards replace the former every-state method rule in docs/design.md.
- Home-status-1280 has six columns and intentionally drops Last block. Mismatched dates are rendered from the array, with `none` for an empty array instead of deriving a numeric total.
- Home-stack-ALL-1280 explicitly annotates the supplied max_supply record. Home-1280/Home-390 hero deltas are signed amounts without percentages. The chain list remains on the common latest day in all three stack detail boards. It reads the latest 30D level/share and supplied per-chain day net.
- Home-operations-1280 explicitly opens Show all 20. Render first five and disclose remaining supplied items only when present. Short responses have no empty disclosure. Records filter scope all and render the supplied entries without a fixed cardinality assertion.
- Omit both illustrative reconciliation stamp and numeric brand tally because the ready fields are absent. Plan review explicitly authorized proceeding without another question. Direct date, chain statuses, lag and unreconciled notes remain visible.
- Tokens merged in d4652c5. Rebased this worktree on that main before final verification. No token values were added locally. While the token branch was in review, CSS references were drafted against its names and partial checks ran. This is a sequencing deviation from the original plan, confined to references. Final verification uses the merged source and generated CSS.
- The tokens PR owns reserved slot colours 7–10, including their documented distinguishability tradeoff. The page binds slots 1–10 and slot 11 falls back to the border swatch. A synthetic DOM stress extension checks all ten colours and eleven-chain wrapping in headless smoke.
- Main period, Level/Share and chain radios work through CSS without JavaScript. The sticky copy synchronizes native period radios after hydration. Operations/records keep independent windows. Using CSS for chain selection also removes the former six-position selector limit.
- Every numeric data label reads a ready document field. Geometry consumes ready stack tops and nearest preceding known boundaries, with noDataChains masking absent layers. Flow band addition and waterfall accumulation are coordinates only. Rejected using chain sums for waterfall/net, rebuilding buckets, deriving percentages, or emitting aggregate reconciliation figures.
- Flat issuer fills and hatched bridge bands keep flow tokens separate from chain tokens. Flow axis domains round only rendering geometry to 1/2/4/8 decade steps, matching the boards' 4B All and 400M Base examples. The supplied flow labels remain unchanged. Shared view changes only add optional formatting precision and allow an empty partial-bucket label to suppress that wording in web while retaining other clients' existing labels.
- Removed obsolete text groups cadence, section, equation, header.spark/header.changePct/issuerNote, drivers echo/scale/captions, issuer-vs-bridge presentation, record-card captions and the old method list. Added board state/reload, hero delta/waterfall, stack list/peak, concise flows/shares/week, operation disclosure/version, records-since and short method/disclaimer texts. Minimal ViewLabels bindings remain for shared formatters, including an empty resolution.partial.
- Replaced old component-layout tests with home semantic tests while preserving portable view, API, format, window/leak and ChartHover interaction tests. Tests cover all mock states, field provenance, null versus zero, identity-based shares, partial coverage, ready totals/peaks, routes, disclosure cardinality and non-fixed record counts. All test files touched here stay below 400 lines.
- Rewrote docs/design.md theme, composition, periods, charts, quality and interaction rules. Retained token ownership, self-hosted fonts, API order, ready values, own scales, quality, keyboard/touch and reduced-motion requirements. No historical narrative or PR numbers in that document.
- Headless smoke checks 320/390/1280, text range rectangles, no ellipsis, native control behavior without JavaScript, sticky threshold and synchronization, disclosure, known/missing markers and one tooltip with zero native SVG titles. Year-crossing phone axes show endpoints without intermediate dates when those would collide. Other phone charts use the boards' two intermediate dates. The mock monument required line-height 1.1 with the shipped font metrics to keep its text rectangle clear of the delta line.
- Preliminary checks found and resolved obsolete test assertions, the figure/delta rectangle collision, year-crossing date collisions and a smoke assertion that incorrectly demanded markers on an unknown short-history bucket. The full post-token smoke matrix passed 30/30 runs before final refinements. Required final checks and exact code SHA are recorded below before the review push.

## Ready reconciliation fields after the dependency merge

- Reconciliation contract main caf458e merged during implementation. Rebased again so the final code uses the actual current contract without modifying it. The protocol commits are now 7adec25, c8b6d42 and 310fe51.
- This supersedes the earlier planned omission. Brand uses ready reconciliation.reconciledChains and the enabled registry size, just as Show all N uses the supplied list size. The stamp renders only ready reconciliation.all.mismatchedDays and closedDays, without summing chain summaries or approximating a count. The contract has no current-chain tally for the illustrative delayed stamp, so that fragment is omitted. The status disclosure uses each ready chain summary's mismatchedDays and keeps supplied mismatch dates accessible.
- The numeric tally and stamp are tested with deliberately distinct supplied values to prove the page does not derive them from status or per-chain counters. The existing Overview boundary requires the new field and handles invalid responses through the existing unavailable path.
- ALL axes use supplied bucket dates formatted as month/year. Daily and weekly axes retain short dates, with years at crossing endpoints. A visible supplied peak also contributes to the axis domain so its annotation stays inside the plot. This is geometry, not a derived metric.
- Final monthly-axis smoke caught crowding between two month/year labels at 320px with JavaScript disabled. At that stress width only supplied endpoints are shown, while 390px keeps its intermediate labels. This preserves the full labels and avoids truncation.
- Final stylesheet inspection separated waterfall hatch ink from the bridge bar's patterned fill to avoid a recursive pattern reference. Tooltip dots and chain markers share the same default swatch as the list for slot 11.
- Added an explicit DOM geometry assertion that the desktop stack plot and chain list fit the first 800px, excluding the mock-only demo banner. This supplements the text overlap checks without image comparisons.

## Implementation review submission

Checked last code commit ac2dfa01cd67abcc3511ca5d7e7e600c9cbe2106, on origin/main caf458e with merged token and reconciliation dependencies. The subsequent verification-record commit changes only this task file.

| Check | Actual exit | Evidence |
| --- | --- | --- |
| pnpm install | 0 | Installed the locked workspace dependencies |
| set -o pipefail; pnpm typecheck / tail -40 | 0 | All workspace typechecks |
| set -o pipefail; pnpm lint / tail -40 | 0 | ESLint |
| set -o pipefail; pnpm test --reporter=dot / tail -40 | 0 | 49 files, 1,337 tests passed |
| AI_AGENT and CLAUDECODE unset, pipefail, pnpm check:build / tail -40 | 0 | Nine mock states, published fake R2, live recovery, client isolation and old-daily HTML/RSC window gate |
| AI_AGENT and CLAUDECODE unset, pipefail, pnpm browser-smoke / tail -30 | 0 | 30 runs, nine mock states plus published, each at 1280/390/320, eight checks per run |
| Required LC-06 grep | 1 | No startOfWeek, isoWeek, monthOf or bucketBy in apps/web/src |
| Required LC-08 grep | 1 | No prohibited copy in apps/web/src |
| git diff --check | 0 | No whitespace errors |

The `/ tail` notation above records the required shell pipe to tail, with pipefail enabled. Expected negative-case logging from the existing configuration/recovery tests accompanies successful build/unit exits.

Launch evidence

- LC-02. browser-smoke checks API chain order, distinct colours and every chain's disclosed state across the mock matrix. The six-chain long-history case exercises all six registry slots, plus synthetic ten/eleven-chain layout and fallback. The current ordinary mocks have their existing three-chain registry and remain in API order.
- LC-04. home.test.ts verifies the complete Through date in brand and sticky markup. Sticky visibility, dimensions and synchronized controls are checked in the headless smoke.
- LC-05. page-html.ts checks list/disclosure state attributes, header/feed quality and operation flags. The hydrated smoke reuses that check, opens the disclosure, verifies lag and retains delayed/unreconciled carriers over their mock states.
- LC-06. tests check known ALL boundaries around absent layers, null shares versus zero, and server day/week/month resolutions. Native period controls are also exercised without JavaScript. Required grep exits 1.
- LC-07. check:build's positive and negative window controls pass over source HTML and decoded Flight, including daily column anchors, historical gaps/mismatches and the new waterfall control. Removed split-table controls were replaced rather than silently bypassing all historical controls.
- LC-08. the visible older-period sentence is asserted once by page-html and checked during period interaction in browser-smoke. Required prohibited-copy grep exits 1.

The final page uses the new ready reconciliation fields. Only the illustrative current-chain fragment of the stamp remains omitted because the contract has no corresponding field. No metric totals are computed on the page. No test file touched by this task exceeds 400 lines. No screenshots, pixel comparison or interactive browser were used.

Review state at submission. Plan round 1 approved. Implementation is now ready for round 1 of its new three-round limit. The outer driver owns PR creation and review execution. Retain .task until final approval, then remove it in its own cleanup commit and push. The final approved report must include the complete verbatim worktree verdict.

## Implementation review round 1 fixes

- F1 fixed. Stack boundaries are copied and sorted by chainInfo against overview.chains before selecting ready lower boundaries. Each layer carries its chain key and registry index. Areas and hover markers use that index instead of the series array position. A regression reverses every supplied series array and requires identical rendered HTML and geometry. Smoke now compares every layer's registry identity/colour with the list and checks hovering each row dims exactly the other chains.
- F2 fixed. The ready brand tally is rendered in every data state, alongside delayed notes. The delayed regression supplies a distinct reconciled count and asserts the brand, while page-html requires that ready tally for every state with figures.
- F3 fixed. Hero mismatch notes select each status.lastClosedDay from that chain's unreconciledDays and format that day. A combined delayed/mismatched presentation case checks the differing common date, note day, failed check and chain-list lag plus mismatch mark. page-html now checks the specific latest-chain note instead of merely requiring some mismatch attribute somewhere.
- F4 fixed. Hero quality is the union of exactly supply, change1d and change7d, which it displays. Any incomplete displayed figure produces the explanation. Tests independently flag each of the three qualities, cover the short-history mock, and deliberately remove the quality/note to prove page-html detects the regression. The accepted 90-day short-history board's ready figures remain governed by their supplied quality.
- Minor fixes. Missing deltas/net use neutral text. Null records use n/a with their reason. A no_data chain uses incomplete for data-quality while retaining data-chain-state=no_data. Latest chain mismatch marks also survive a differing common day. Removed unused quality text functions. na.history remains required by the existing shared ViewLabels formatting bindings and their tests; tags.chainUnreconciled is now used by the page-html latest-day assertion.
- Peak annotations are included in text overlap checks. This exposed a real phone collision with the short-history period reason in the gap mock. The annotation's top coordinate now reserves two text lines inside the plot, keeping its full label away from the toolbar. The existing targeted sticky-bar child geometry check remains in the smoke. Layout assertions were moved into a focused browser-smoke-layout.ts so smoke check files stay below 400 lines.
- No major finding was dropped or disputed. The task's contract-only partial-stamp treatment from the first submission is retained. No token or contract change is part of these fixes.

Round 1 remediation verification, checked code commit 23aade047be194ab3e1ac065b9274a67e2eab3b5

- pnpm typecheck with pipefail and tail -40 exited 0.
- pnpm lint with pipefail and tail -40 exited 0.
- pnpm test --reporter=dot with pipefail and tail -40 exited 0. All 50 test files and 1,346 tests passed.
- pnpm check:build with AI_AGENT/CLAUDECODE unset and pipefail exited 0, including the HTML/RSC window controls and every mock state.
- pnpm browser-smoke with AI_AGENT/CLAUDECODE unset, pipefail and tail -30 exited 0. All 30 runs at 1280/390/320 passed with layer identity, every-row hover and peak text geometry included.
- Both required LC-06 and LC-08 searches exited 1 with no matches. git diff --check exited 0. The launch-criterion evidence recorded above remains green, with stronger F1/F2/F3/F4 assertions in page-html and smoke.
- Nine new regression cases cover shuffled arrays, delayed ready tally, own last-day mismatch, each displayed quality independently, short-history quality, no-data tone/quality and missing records. All test files and the two smoke assertion modules remain below 400 lines.

All four major findings are fixed. The next push submits the fixes for implementation review round 2/3. The outer driver continues to own review and PR operations.

## Coordinator clarification before implementation round 2

Rebased the round-1 fixes onto origin/main bcabebc. The only conflict was docs/design.md. Resolved it with the rewritten Home rules while preserving the merged native-app token guidance. No contract, token or mobile files were edited by this task.

The coordinator identifies reconciliation.reconciledChains as the stamp numerator. This supersedes the partial-stamp decision above. The stamp now reads the ready reconciledChains over the enabled registry size, all.mismatchedDays and all.closedDays, with the accepted chains / mismatched days / chain-days closed wording. The chain-day count is exact, so the board's illustrative approximation sign is omitted. No counters are added, subtracted or inferred from statuses. The brand tally stays beside delayed notes as required by F2. The stamp regression uses deliberately different supplied values, and page-html requires the full text inside the stamp itself.

Post-clarification verification on last code commit 8e67458e1c73633942c7b6a254bab66211c43760, rebased onto origin/main bcabebc

- pnpm install exited 0. pnpm typecheck, pnpm lint and pnpm test --reporter=dot each exited 0 with pipefail and the required tail limits. All 50 test files and 1,347 tests passed.
- With AI_AGENT and CLAUDECODE unset, pnpm check:build exited 0, including the HTML/RSC old-daily window controls. pnpm browser-smoke exited 0, all 30 mock/published runs at 1280/390/320 with the full stamp and the round-1 state/quality/chain-identity checks. Both used pipefail and the required tail limits.
- Required LC-06 and LC-08 greps each exited 1 with no matches. git diff --check exited 0. All launch evidence above remains green. The stamp's extra tally passes DOM wrapping/overlap checks at all three widths.
- The coordinator clarification is committed verbatim separately. F1–F4 are fixed as already recorded. The full ready stamp supersedes the earlier limitation. Its exact chain-day count is displayed without an approximation sign. No contract or token changes were made. This push resumes implementation review round 2/3 after the usage-limit interruption.
