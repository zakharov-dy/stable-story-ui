# Reconciliation summary decisions

## Plan round

- Supplied task committed verbatim before planning in 78e9d5a, including the review header.
- Fresh remote main matches the assigned root base 7d00d0a. Initialized ui at its current main 13d57a4 and created its contract/recon-summary branch. Root local and remote review branch are worktree-go-reconsummary under the harness assignment and coordinator clarification of 2026-11-04. All later root pushes use that same-name remote branch so the review hook detects them.
- Root and UI pnpm install --frozen-lockfile both exited 0. No lockfile changes.
- Read root and UI CLAUDE.md, ancestor AGENTS.md, architecture 3.4/3.6 and relevant section 5, ADRs 0023/0028, publisher snapshot/parity tests and current overview loading/computation.
- The handoff source is absent from this backend checkout. Read only requested sections 7 and 10–11 and the stamp line of section 2 from the artifacts checkout at /Users/dmitry/dev/block-and-tell-artifacts/handoff/web/fable-answer-2026-11-04.md. No artifact edits.
- Reuse in-memory DayTable and day_flow.events. Rejected counting raw event rows because it would scan large history unnecessarily. No database schema or index is needed.
- Whole retained-history totals are separate from the common-date streak. Rejected min(per-chain latest suffix) because chains can close through different endpoints. Gaps terminate both suffix definitions.
- Proposed strict reconciledChains counts latest supply/bridge/continuity all ok, independently of freshness state. Continuity none is mismatch-free but does not meet that separate all-checks-ok definition.
- UI/root drafts contain only temporary task files during plan review. Implementation, performance measurements and full checks await plan approval as required by the worker protocol.
- The installed CLI has no top-level status command. Its supported go-worker status reconsummary confirmed this worker's assigned checkout/model. No review command was run.
- UI draft PR https://github.com/zakharov-dy/stable-story-ui/pull/2 targets main from contract/recon-summary. Root PR https://github.com/zakharov-dy/block-and-tell/pull/209 targets main from worktree-go-reconsummary. The coordinator confirmed that root PR #208 is closed and the obsolete remote root contract/recon-summary branch is deleted. The original root push to contract/recon-summary started no review round. The same-name root push starts the plan round after this turn ends. Review the UI branch directly with git -C ui diff origin/main...contract/recon-summary during this task-files-only round. Root's unstaged ui change reflects the UI branch commits, and its gitlink intentionally stays at main until implementation review.
- Following the usage-limit interruption, checked both branches and synchronized this decisions record in both repositories. Only task records were updated. Both branches are pushed before yielding for plan review, with the UI branch and PR retained.
- Plan-round validation ran git diff --check in both repositories with exit 0. Full code gates and live cold timing are pending implementation. There is no reviewer verdict yet, and no code has been changed.

## Implementation review preparation

- Plan round 1 approved at root d45f79a by claude / deepseek-v4.1-flash / high. Saved the complete plan verdict in .task/plan-verdict.md. The reviewer reset the implementation review allowance to three rounds.
- Retained the approved field name reconciliation and documented its distinction from latest-day status.chains[].reconciliation. Architecture and schema comments specify summed chain-day units for closedDays/mismatchedDays and calendar-day units for the common streak. Fixed the root remote branch sentence in both plan copies and named generate:api/check:api explicitly.
- Retained approved latest-day all-three-ok semantics for reconciledChains. Requested coordinator/web-track confirmation through the asynchronous question tool. An older mismatch still contributes to mismatchedDays and does not disqualify a clean latest day. Continuity none extends clean streaks but is excluded from the strict latest-all-ok count.
- Added the pure DayTable builder to getOverview's shared base, including the asOf-null branch. It reads only already-loaded rows. No production SQL, event query, schema, index, endpoint parameter or rendering change was added. Calendar adjacency is checked with UTC timestamps in the chain pass, avoiding repeated ISO formatting.
- Added independent fixture arithmetic using raw scenario event block ranges, regenerated 462 response cases, and verified the generated index. The mock index contents are unchanged because its keys/import paths are unchanged. Added a hand anchor and a mutation check proving day_flow event-counter changes cannot change the fixture oracle.
- Added the real-Postgres LC-05 scenario through the normal API with literal expected counts and independent SQL calendar logic. It covers a gap-free chain, a gapped chain, first-day none, double-failed checks counted once, different last closed days, closed zero-event days, zero-amount logs, disabled-chain exclusion, empty scope and no-common coverage. Added explicit publisher/API summary parity and concurrent-close old/new count assertions.
- Necessary plan extension discovered during implementation. The publisher validates the stored current overview before checking the state digest, so bumping computationRevision alone cannot upgrade a real publication that lacks the now-required field. Added PreviousOverview as a schema for the previous stored shape, sharing all existing Overview invariants. Only publish's read of an authenticated current version can use it, and only when reconciliation is absent. New uploads, verifyVersion, client responses and rollback require the current Overview. No counters are synthesized for old documents. Added positive upgrade and corrupt-old-document regression tests, including preservation of the pointer on failure. Bumped computationRevision from 1 to 2. This preserves ADR 0028 byte/hash/metadata verification and the new response contract.
- UI temporary task files remain until independent final approval, then are removed in their own cleanup commit before UI merges. Root review will temporarily pin the reviewed UI branch code for reproducibility. The coordinator merges UI PR #2 first, then the root pin must be updated to the actual UI main commit before root PR #209 merges. Repeat check:api at that final pin.

## Read-only live performance evidence

- Before changing getOverview, three fresh-process cold computations plus response-schema validation on step1_live took 3477.530125, 3241.251667 and 3915.124625 ms. Each ran in a read-only REPEATABLE READ transaction after SET LOCAL ROLE api_readonly. Each saw 9975 chain_day rows, latest day/asOf 2026-11-03. The authorized localhost HTTP call also returned 200 in 11.334006 s, with cache state unverified, so it is not used as the before/after comparison.
- Initial current-code runs overlapped lint/typecheck and took 6568.922958, 4604.898125 and 4406.931042 ms. Recorded these noisy samples rather than discarding their existence. Removed repeated ISO formatting from the summary chain pass and repeated measurements with no other task commands running.
- Alternated fresh-process baseline and current computations against identical 9975-day snapshots and fixed now 2026-11-04T06:00:00Z. Baseline code was git show d45f79a:packages/supply/src/metrics/service.ts, transpiled in memory with imports resolved to the unchanged metrics files and validated with the shared previous schema. Baseline times were 3340.728458, 4269.490959 and 3080.428875 ms, median 3340.728458. Current times were 4939.997, 2978.494209 and 3022.07725 ms, median 3022.07725. Variation exceeds the summary cost, and the median cold time did not regress.
- Thirty isolated builder repetitions per process measured median CPU times of 2.404708, 5.043230, 2.556209, 2.794104, 2.564250 and 3.048542 ms respectively. The added work is about 0.1% of cold overview time, with zero added SQL. Raw samples and the local measurement recipe are retained temporarily in .task/perf-*.jsonl and .task/measure-command.txt. The live result is 9975 closed chain-days, 19178190 supply logs, zero mismatched chain-days, a 1036-calendar-day common streak ending 2026-11-03, and 6 latest-day all-ok chains. No live row or service was changed.

## Implementation gate results

Full gates ran on root code commit 4d63eb5e6d47b96a4b83f3b02f89a63960da35c2 and UI code commit 285911eb0e5b3de8b1165085aaa94f31eb9500f1. Subsequent review-preparation commits change only task records, architecture wording and the pin to the same UI code plus its task records.

| Command | Actual exit | Result |
| --- | --- | --- |
| pnpm typecheck | 0 | Root and delegated UI application types pass |
| pnpm lint | 0 | Root gate passes |
| pnpm test --reporter=dot | 0 | 168 files, 3870 tests pass |
| DATABASE_URL=postgres://postgres:postgres@localhost:5432/app pnpm test:int | 0 | 30 files, 591 tests pass on disposable databases |
| pnpm -C ui typecheck | 0 | UI standalone gate passes |
| pnpm -C ui lint | 0 | UI standalone gate passes |
| pnpm -C ui test --reporter=dot | 0 | 58 files, 1458 tests pass |
| env -u AI_AGENT -u CLAUDECODE pnpm -C ui --filter @app/web check:build | 0 | Production build and HTTP mock-state checks pass |
| env -u AI_AGENT -u CLAUDECODE pnpm -C ui --filter @app/web browser-smoke | 0 | 20 viewport/state runs pass |
| pnpm --filter @app/fixtures generate:api | 0 | Regenerated 462 cases and the index with no further diff |
| pnpm --filter @app/fixtures check:api | 0 | Verified 462 cases and the index |
| DATABASE_URL=postgres://postgres:postgres@localhost:5432/app pnpm exec vitest run --project integration apps/api/src/reconciliation.int.test.ts apps/publisher/src/api-parity.int.test.ts | 0 | Both files pass, 6 tests total. LC-05 literal/SQL comparison and publisher/API parity plus concurrency are exercised |

All gate commands used pipefail, and each pipeline's actual status was captured before the next command. Native mobile tests are inapplicable because no mobile file changed. CI remains manual and was not dispatched. The LC-05 state and prior evidence are unchanged. Full implementation review is pending. No implementation-review round has run yet. Web-track confirmation of latest-day reconciledChains remains pending through the coordinator question.
