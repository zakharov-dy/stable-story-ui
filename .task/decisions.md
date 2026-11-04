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
