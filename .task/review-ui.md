Adds required `Overview.reconciliation` with whole-history counters, clean calendar-day streaks, per-chain summaries and a latest-day all-ok chain count for LC-05. The schema validates counter bounds, enabled-chain order, sums, status agreement, endpoints and derivable suffix bounds. Negative cases assert their specific Zod paths. Generated overview fixtures were rebuilt with the independent backend fixture generator. Regeneration verified 462 cases and the unchanged mock index.

The field uses chain-day units for summed closed/mismatched counts and calendar-day units for streaks. Its historical meaning is distinct from `status.chains[].reconciliation`. `ApiClient` and mocks receive the field through their existing inferred Overview schema. An older mismatch remains in the historical count even when the latest day passes.

The publisher upgrade path needs the exported `PreviousOverview` schema to validate already-stored documents that predate the field. That schema shares the existing cross-field invariants. Endpoint responses require the new field. This compatibility path is the implementation extension to the approved plan and is documented in the backend architecture. No other architecture deviations were introduced.

Standalone gates on UI code `285911eb0e5b3de8b1165085aaa94f31eb9500f1` all exited 0.

- `pnpm -C ui typecheck`
- `pnpm -C ui lint`
- `pnpm -C ui test --reporter=dot` — 1458 tests
- `env -u AI_AGENT -u CLAUDECODE pnpm -C ui --filter @app/web check:build`
- `env -u AI_AGENT -u CLAUDECODE pnpm -C ui --filter @app/web browser-smoke` — 20 runs

Root gates and the two real-Postgres LC-05 files also pass, including API/publisher parity and the independent SQL scenario. The root fixture `generate:api` and `check:api` commands both exit 0. No application rendering or mobile file changed. CI remains manual and was not dispatched.

Merge this PR before the root PR. Temporary `.task` records will be removed in their own cleanup commit after independent final approval and before merge. The root worker then pins the actual UI main commit and reruns fixture drift verification.

Paired computation PR [block-and-tell #209](https://github.com/zakharov-dy/block-and-tell/pull/209).
