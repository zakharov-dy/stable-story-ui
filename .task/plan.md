# Reconciliation summary plan

## Contract proposed for approval

```typescript
interface ReconciliationSummary {
  closedDays: number;
  events: number;
  mismatchedDays: number;
  streakDays: number;
  streakEnd: Day | null;
}

// Required on every Overview, including asOf === null.
reconciliation: {
  all: ReconciliationSummary;
  chains: (ReconciliationSummary & { chain: string })[];
  reconciledChains: number;
};
```

All counters use the existing nonnegative safe-integer Count schema. Amounts and block numbers retain their existing string representation. `chains` has exactly one entry per Overview.chains slug in configuration order.

## Definitions

- Counts cover the whole retained closed history of every enabled chain where the requested asset is deployed. They include days before common historyStart and after common asOf, independently of the public windows. Disabled chains and other assets are excluded.
- A closed day is one chain_day row. An events count sums all four day_flow.events values attached to those rows, including zero-amount logs and unpaired bridge logs. It counts supply logs, using the same meaning as Overview.day.rows[].events. It does not count grouped operations or the reserved transfer kind.
- A mismatched day has at least one of recon_supply, recon_bridge or recon_continuity equal to mismatch. Count a row once even with several failed checks. Continuity none does not create a mismatch. Reuse supply's hasMismatch predicate, which also owns the existing quality flag meaning. A mismatch remains a closed day.
- all.closedDays, all.events and all.mismatchedDays are sums of chain counters. Thus two chains mismatching on the same date contribute two mismatched chain-days.
- Each chain's streakEnd is its lastClosedDay, even if that day mismatches. streakDays is the length of the consecutive UTC-calendar-day suffix ending there with closed rows and no mismatch. A mismatch or missing calendar day stops the suffix. An initial continuity none day qualifies when its other checks pass. The latest mismatched day yields streakDays zero and a non-null streakEnd.
- all.streakEnd is Overview.asOf. Its streakDays counts consecutive calendar days backwards from asOf, no earlier than common historyStart, on which every enabled chain has a closed row without a mismatch. Any chain's gap or mismatch stops it. This is a count of calendar days, independent of the summed chain-day counters. It must be computed at the common endpoint, because a chain can have newer closed days and mismatches beyond it.
- A chain without closed rows has zero counters, streakDays zero and streakEnd null. With asOf null, keep actual per-chain and summed history counts, set all.streakDays to zero and all.streakEnd to null. Empty scope has empty chains, all-zero counters, null streakEnd and reconciledChains zero.
- reconciledChains counts chains whose latest status reconciliation has supply, bridge and continuity all equal to ok. A missing reconciliation or continuity none is excluded from this strict all-checks-ok count. Clock-derived delayed state does not change it. Continuity none can still extend the mismatch-free streak.

## Implementation and snapshot

1. Implement a pure summary builder under packages/supply/src/metrics using the existing DayTable from getOverview. Iterate each already sorted chain history to accumulate counters and reset its suffix on gaps or mismatches. Compute the common suffix by walking backwards from asOf with DayTable.get, bounded by common historyStart. This adds linear in-memory work over about ten thousand closed days and no SQL.
2. Invoke it before getOverview's no-common-coverage return and put the required field in the shared base. Keep the supply DTO independent of contracts, preserving the module boundary. Count reconciledChains from the already built status entries with the definition above.
3. API database.read already supplies one read-only REPEATABLE READ transaction. Publisher buildSnapshot supplies the same isolation, api_readonly role and fixed clock, establishing its snapshot before getOverview. The summary uses exactly that call's loaded table, with no second connection or cache. Extend publisher concurrency coverage to assert that summary counters stay on the old snapshot when another connection closes a day.
4. The publisher marker already hashes all chain_day and day_flow rows. Bump its computationRevision so an unchanged database still republishes the newly required document field. API and publisher pass through the field and validate with the same schema.
5. Extend the independent fixture generator from scenario rows without importing supply. Count fixture events from raw scenario events in the closed block ranges, independently of production day_flow accumulation. Regenerate UI contract fixtures and mock-index.generated.ts using the existing generator. Add the required field to handwritten contract/consumer fixtures with only compile-level fixes.
6. Add the Overview type and definitions to architecture section 3.6 in ordinary text. Add only the new snapshot-summary check clause to LC-05, preserving its state and existing evidence.

## Performance evidence

loadDays currently selects all scoped chain_day and day_flow rows for overview. day_flow.events already holds the exact event totals needed here, and loadDays rejects closed days missing any of their four flow rows. No new event access, SQL aggregation, index or schema change is needed. Existing event queries for feed, record candidates and unpaired quality remain the only event queries.

Before implementation, measure uncached getOverview in fresh local Node processes against step1_live through SELECT-only read-only REPEATABLE READ transactions with SET LOCAL ROLE api_readonly. Obtain the existing local connection configuration without logging credentials. Use the same clock/configuration and process setup for several before/after runs, recording timing, snapshot row counts and endpoint so concurrent worker progress is visible. Include schema validation in the full computation measurement. Never restart the API or worker or change live rows. Measure the builder independently on the loaded table to distinguish its bounded CPU cost from the existing cold-overview variation. Preserve raw measurements in decisions.md. If baseline access fails, try the authorized localhost API after cache expiry and state precisely what was measured. If no authorized path is available, report the measurement blocker.

## Tests

- Pure supply unit cases with literal expected counters for zero data, first-day none, each mismatch field and combined failures, a zero-event closed day, adjacent clean days, a gap, latest-day mismatch, mismatches outside public windows, and different chain endpoints.
- Real Postgres LC-05 test through the normal overview/API or publisher entry point. Seed a compact hand-computed two-chain history with both gap-free and gapped runs, first-day none, a mismatch, different endpoints, and explicit event totals. Compare response counters and streaks both with literal expected values and an independent SQL query over chain_day joined to per-day day_flow aggregates. Derive the SQL streak using calendar adjacency independently of supply. Check every returned scope, empty/no-common coverage and disabled-chain exclusion. Keep database count within project guidance.
- Extend existing apps/publisher/src/api-parity.int.test.ts with explicit summary equality for ok and unreconciled cases and the concurrent-close snapshot test. Verify the marker revision forces publication of the new computation format through existing publisher behavior tests.
- UI contract positive and negative tests for the required field, safe-integer counters, scope membership/order, aggregate sums, mismatch count versus status.unreconciledDays, reconciledChains versus latest checks, null/zero rules, streak endpoints and bounds, and latest mismatch zero suffix. Assert the precise Zod issue path for every negative rule. Only enforce relations derivable from the document. In particular all.streakDays is not the minimum of the chain suffixes at their different endpoints.
- Generator drift and existing fixture/API tests ensure mocks, schemas and server agree while the generator stays independent.
- On the last code commits, run root typecheck, lint, test --reporter=dot and test:int with DATABASE_URL pointing only to app. Run UI typecheck, lint and test --reporter=dot, then web check:build with AI_AGENT and CLAUDECODE unset, followed by browser-smoke with the same unset markers. Run test:rn only if mobile files are touched. Capture each actual exit code with pipefail and the checked root/UI SHAs. No manual CI dispatch.

## Cross-repository and review sequence

The initialized ui submodule and root both start at freshly fetched origin/main. Root main is 7d00d0a and UI main is 13d57a4. The root's assigned local branch worktree-go-reconsummary is preserved per worker protocol. Push it to the requested remote contract/recon-summary branch. The UI local and remote branch is contract/recon-summary. Work only inside this root worktree and its ui directory.

This required plan round pushes only .task files. Mirror task/plan/decisions inside ui so both PRs can be opened on the first push with reviewable plan diffs. No submodule pin change or implementation goes into this round. Open draft PRs in both repositories, link their branches in decisions.md and wait for the driver's independent plan review. The root reviewer can inspect both PR branches even while the root pin still references UI main.

After plan approval, implement the UI contract and root computation together, push both code diffs for independent review, and update decisions before every review push. UI PR contains contracts/fixtures and only necessary compile/test fixes. Root PR contains generator, metrics/API/publisher/tests/docs and the eventual pin. There are no planned architecture deviations beyond the documented Overview contract extension. Temporary .task files are removed only after final approval in cleanup commits. The coordinator merges UI PR first. Fetch its actual main commit and re-pin root to that commit before root PR merges, without editing another checkout. Report both PR URLs, verdicts, check commands/exit codes/SHAs, performance measurements and any remaining merge dependency.
