AI review: on · reviewer claude · model deepseek-v4.1-flash · effort high · rounds 3

# contract: reconciliation summary in `overview` (LC-05)

## Why

Stable Story is the daily book of USDC supply by chain, with every day attributed to issuer or CCTP bridge and reconciled against the contract. The new home page (accepted by the owner 2026-11-04) puts a quiet trust stamp under the wordmark: `6/6 chains · 0 mismatched days · ≈9,700 chain-days closed`, and the page must not count anything itself (ADR 0023: the server computes, the page renders). This task adds the document field that stamp reads. Directly serves the product claim "every day is reconciled" and launch criterion LC-05.

## Launch criteria

- **LC-05** (`docs/requirements/launch-criteria.md`): the new field in the published `overview` agrees with `chain_day` of the same version. Check: a test on real Postgres compares the field with an independent query over `chain_day` (hand-computed expected values on a small scenario, including a `mismatch` day, a day with continuity `none`, a gap-free and a gapped history), plus the existing publisher/API parity test (`apps/publisher/src/api-parity.int.test.ts`) shows the published field equals the API's. The final report names the command and result for each. Do not change the LC-05 row's state; if the row text needs a clause about the new field, add it in this PR.

## What

One `contract:` change adding a reconciliation summary to the `overview` response/document:

- Per chain and for the whole scope (all enabled chains of the asset): closed days, events, mismatched days, and the number of consecutive days without a mismatch ending at the chain's last closed day (and for the scope, ending at its latest common day or a defined equivalent — the plan states the exact definition).
- The stamp needs: number of chains with all checks `ok` (the page already has `status.chains[].reconciliation`), total mismatched days, total closed days. Event totals come with it.
- "Mismatched day" = a closed day whose `recon_supply`, `recon_bridge` or `recon_continuity` is `mismatch` (continuity `none` on a chain's first day is not a mismatch). It must agree with the existing `quality.unreconciledDays` meaning: a closed day with `mismatch` is not missing.
- The scope of the counts is the chain's whole closed history (not clipped to the 30D/90D/ALL views and not to the common `asOf`) — the plan confirms or argues otherwise before coding.
- The exact shape, names, nullability and the empty-scope/`asOf: null` behaviour are the pair's decision (plan first, below); keep them consistent with the existing style of `Overview` (strings for large integers, counts as numbers per the existing rule in `docs/architecture.md` §3.6).
- Out of scope: the weekly issuer/bridge net pair (owner decision 2026-11-04, not now), CCTP routes, any other metric of `handoff/web/fable-answer-2026-11-04.md` §7, any page rendering. No DB schema change and no new index (decision 6): if the daily event count cannot be had cheaply without one, STOP with a `QUESTION:`.

Performance is part of the acceptance: the overview is cached in the API process and computed cold on the first request after idle, and the web already hit a 10 s timeout on a cold calculation. The summary must not add a full scan of `event` (15.96M rows) or other measurable cost to the cold overview; count from `chain_day` and per-day aggregates that already exist, or justify an alternative in the plan with a measurement. The final report states the measured cold `overview` time on `step1_live` (read-only: `api_readonly` via the local API on port 3000 or a SELECT in a `read only` transaction; never write to or stop `step1_live`) before and after.

## Two repositories

`ui/` is a git submodule of the private repository `zakharov-dy/stable-story-ui` (clone `~/dev/stable-story-ui`). The contract schemas, `ApiClient`, mock and generated API fixtures live there (`packages/contracts`); the fixture generator (`tests/fixtures`), the metrics computation (`packages/supply`), the API (`apps/api`) and the publisher (`apps/publisher`) live in the root repository. So this is two PRs, merged in order:

1. UI repository PR: `packages/contracts` schema, invariants, mock, regenerated `packages/contracts/fixtures` and `mock-index.generated.ts`, negative cases that assert the specific zod issue path, and the minimum compile-level fixes in `packages/view` / `apps/web` / `apps/mobile` (no visible change; no new rendering).
2. Root repository PR: generator, supply/metrics computation, API route and publisher passing the field, tests, `docs/architecture.md` (the field in the Overview type of §3.6 and the rules text), and the new `ui/` pin pointing at the commit that is on the UI repository's main after PR 1 merges.

Work as a root worktree with the `ui/` submodule initialised (`git submodule update --init`) and branch inside `ui/` for PR 1. Open both PRs at the first push and say so in the first report; the AI review covers both diffs (the reviewer reads `.task/task.md` and both branches). The coordinator merges PR 1, then you re-pin and PR 2 merges. CI is manual only in both repositories; no run is expected.

## Read

`docs/architecture.md` §3.4 (chain_day, reconciliations), §3.6 (Overview), §5 where it touches overview; ADR 0023 (public view policy), ADR 0028 (published documents); `apps/publisher/src/api-parity.int.test.ts`; `ui/CLAUDE.md`; `handoff/web/fable-answer-2026-11-04.md` §7 and §10–11 (read only the quoted lines, the stamp is described in §2 first screen item 1).

## Design

- **Design**: none — this PR adds a document field and changes no page or app rendering; the stamp itself is drawn and built under the web track's separate boards and code task.

## Plan

**Plan first.** The plan covers: the field's shape and names; the exact definitions (mismatch day, streak, scope of counts, empty scope); where each number is computed and how it stays consistent with the published `chain_day` snapshot (REPEATABLE READ); how the events count avoids scanning `event`; the cross-repository sequence; the list of tests. Plan goes to the reviewer; I (the coordinator) need only the final field shape in the first report so I can tell the web track.

## Files you may change

- **Files you may change**: root repository `packages/supply/src/**`, `apps/api/src/**`, `apps/publisher/src/**`, `tests/fixtures/**`, `docs/architecture.md`, `docs/requirements/launch-criteria.md` (LC-05 clause only), the `ui` submodule pin; UI repository `packages/contracts/**`, and `packages/view/**`, `apps/web/**`, `apps/mobile/**` only for compile-level or fixture-driven test fixes; `.task/**` while working. Detail:

Root repository:
- `packages/supply/src/**` (metrics/overview computation and its tests)
- `apps/api/src/**`, `apps/publisher/src/**`
- `tests/fixtures/**` (generator, seeds; no new golden files)
- `docs/architecture.md`, `docs/requirements/launch-criteria.md` (LC-05 clause only)
- `ui` (the submodule pin only)
- `.task/**` while working (removed by the cleanup commit)

UI repository (`ui/`):
- `packages/contracts/**` (including generated fixtures)
- `packages/view/**`, `apps/web/**`, `apps/mobile/**` only for compile-level or fixture-driven test fixes caused by the new field.

Not allowed: `packages/db/**` (schema, migrations), `packages/domain/**`, `packages/ingest/**`, `apps/worker/**`, `spikes/**`, root config, `package.json`, lockfiles.

## Setup, network, branches

- Fresh `origin/main` of both repositories; `git submodule update --init`; `pnpm install` at the root and then `pnpm -C ui install`.
- Branch names: root `contract/recon-summary`, UI `contract/recon-summary`.
- Postgres: the container already on :5432 or `docker compose up -d`; integration tests use `postgres://postgres:postgres@localhost:5432/app`, never `step1_live`. No network except the read-only local API call for the timing above; no RPC.
- Author is the owner's git identity as configured; check `git log -1 --format='%an <%ae>'` before each push; `Co-Authored-By` of the model that wrote the code.

## Checks (final report: full run on the last code commit, real exit codes, commit sha)

```
set -o pipefail
pnpm typecheck | tail -40
pnpm lint | tail -40
pnpm test --reporter=dot | tail -40
DATABASE_URL=postgres://postgres:postgres@localhost:5432/app pnpm test:int | tail -40
env -u AI_AGENT -u CLAUDECODE pnpm -C ui --filter @app/web check:build | tail -40
env -u AI_AGENT -u CLAUDECODE pnpm -C ui --filter @app/web browser-smoke | tail -30
pnpm -C ui --filter @app/mobile test:rn | tail -30   # only if apps/mobile is touched
```

Also run the UI repository's own gate (`typecheck`, `lint`, `test` in `ui/`) if it differs. The PR descriptions list every deviation from the letter of `docs/architecture.md` (§3.6 changes go in its normal text, without PR numbers or attributions).

## Для ревьюера

Major: a wrong result on real data or on an input the contract allows (the count or streak disagrees with `chain_day`; mismatch definition differs from `quality.unreconciledDays`; a gapped history counted as a streak); a scan of `event` added to the cold overview; the summary computed outside the single snapshot so the published field can disagree with `chain_day` of the same version; a breach of the module boundaries, ADR 0023/0028 or the approved plan; a schema/index change; a test that passes for the wrong reason (expected values computed by calling `supply`); live network in tests. Everything else is minor.

## When to ask (`QUESTION:`)

Only for what the pair cannot decide: policy, scope, the owner's decisions, or a needed schema/index change.