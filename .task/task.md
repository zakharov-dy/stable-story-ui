AI review: on · reviewer commandcode · model deepseek/deepseek-v4.1-flash · effort high · rounds 3

# fix(mobile test): the empty-overview test must carry the new `reconciliation` field

## Why

`Overview` gained a required `reconciliation` field (UI PR #2, main `caf458e`): `{ all, chains[], reconciledChains }`, where `chains` has exactly one entry per `Overview.chains` and the counters of an empty scope are zero. UI main is red because a mobile test builds an `Overview` with `chains: []` from the mock `empty` state and does not update that field. A red main blocks every UI PR that touches mobile (the web track holds PR #5 for it). The goal is a green gate; no product behaviour changes.

## Launch criteria

None (a repository gate). The report names the command and result.

## What

On a clean `origin/main` run `pnpm test:rn`: `apps/mobile/src/data/PlaceholderScreen.test.tsx:62` fails because `Overview.parse({ ...empty, chains: [], status: { ...empty.status, chains: [] } })` rejects the unchanged `reconciliation` (its `chains` still lists the mock chains).

Fix the consumer in the same spirit as the contract change: the zero-chains overview carries a consistent summary, i.e. `reconciliation: { ...empty.reconciliation, chains: [], reconciledChains: 0 }` (the `all` counters of the mock `empty` state are already zero; confirm that against `packages/contracts/src/reconciliation-invariants.ts` and `docs`-free reasoning from the schema, do not change the schema). Keep the test's meaning: "zero chains remains zero, while coverage remains null".

Then search for any other place that builds an `Overview` by hand with a changed `chains` list in `apps/mobile`, `apps/web`, `packages/view` (`grep -rn "chains: \[\]" apps packages --include=*.ts --include=*.tsx`) and fix the same way; do not touch `packages/contracts` (the contract is not edited in this task: if the invariant itself looks wrong, STOP with a `QUESTION:`).

## Design

- **Design**: none — a test fixture only.

## Plan

No plan needed.

## Files you may change

- **Files you may change**: `apps/mobile/src/**/*.test.tsx`, `apps/mobile/src/**/*.test.ts`, `apps/web/src/**/*.test.ts`, `apps/web/src/**/*.test.tsx`, `packages/view/src/**/*.test.ts`, `.task/**` while working. Nothing else.

## Setup and checks

- This is the `stable-story-ui` repository. Fresh `origin/main`; `pnpm install`. Do not name a branch: use the harness-assigned one and `git push -u origin HEAD`. No network except installs.
- Author is the owner's configured git identity (`git log -1 --format='%an <%ae>'` before each push); `Co-Authored-By` of the model that wrote the change.
- With `set -o pipefail`: `pnpm typecheck | tail -40`, `pnpm lint | tail -40`, `pnpm test --reporter=dot | tail -40`, `pnpm test:rn | tail -40`. All must be 0 (test:rn must go from 1 failed to all passed). The web build and smoke are not needed (test-only change). Report exit codes and the commit sha.
- Do not leave a turn while a background install or command is running: wait for it in the foreground.

## Для ревьюера

Major: the fixture is made valid by weakening what the test asserts (the test must still show zero chains vs null coverage); a change outside the allowed files; the contract schema edited. Everything else is minor.