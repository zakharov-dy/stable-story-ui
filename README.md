# Stable Story[^working-name]

![The first screen: tracked supply, day waterfall, and chain list](docs/media/hero.png)

*Screenshot rendered from the six-chain mock state the project's own checks use for screenshot evidence.*

[**The supply of USDC, accounted for.**](https://stable-story.vercel.app)

USDC supply by chain. Every day attributed to issuer or bridge, and reconciled against the contract.

`live · updated daily · six chains`

What's unusual about this page:

- Every day is reconciled against the on-chain contract, and every bridge operation is paired across chains —
  unpaired logs are flagged, never silently counted.
- Production has no database server: the backend stays local and publishes prepared read-only documents;
  hosting the data costs $0/month.
- The data contract is about 600 lines of zod invariants in `packages/contracts/src/schemas.ts`, with negative
  tests asserting the exact error path.

[^working-name]: Stable Story is a working name; it may change.

## Start here

- The live site: [stable-story.vercel.app](https://stable-story.vercel.app).
- The data contract: [`packages/contracts/src/schemas.ts`](packages/contracts/src/schemas.ts) — every invariant
  the page relies on, including the publication envelope.
- The shared view logic: [`packages/view`](packages/view) — pure formatting, quality, periods, and chart scales
  over API responses; it never aggregates.
- [Data quality](docs/data-quality.md) — the three daily reconciliations, CCTP pairing, and the gap and
  unreconciled-day policies.
- [Architecture](docs/architecture.md) — the whole system with the backend as a black box with interfaces.

## What the page shows

Header figures, the day equation (issuer mint, issuer burn, bridge in, bridge out, net), the 20 largest
operations of 7 days, records, and per-chain status. Charts run at three periods — 30D by days, 90D by weeks
(covering exactly 90 days), ALL by months from the earliest day with data of any chain — with the period control
mirrored in the sticky bar once the hero scrolls away:

![Charts at 30D/90D/ALL with the sticky period control](docs/media/charts.png)

*Same mock render as above: the 30D stack and the flows section under the sticky bar.*

The server decides the window step and the selection; the page renders the step it is given and never aggregates.
A chain without data for a period is "no data" — not zero, not drawn. How it all fits together is in
[architecture](docs/architecture.md); what "reconciled" means is in [data quality](docs/data-quality.md); the
document shape, with a trimmed real example, is in [the overview example](docs/overview-example.md)
([raw JSON](docs/overview-example.json)).

## Checks

| Check | What it proves |
|---|---|
| `pnpm typecheck` | The workspace root and every package compile under strict TypeScript. |
| `pnpm lint` | ESLint passes, including the enforced module boundaries between contracts, view, and apps. |
| `pnpm test` | Unit suite: the shared view logic, the zod contract with negative tests on the error path, page tests. |
| `pnpm check:build` | The production build uses self-hosted fonts only, leaks no API/R2 access or contract internals into client assets, and passes the daily-window HTML/RSC check. |
| `pnpm browser-smoke` | Headless Chrome over every mock state (ok, delayed, unreconciled, empty-day, short-history, gap, empty, unavailable, long-history): console, layout, charts, and tooltips. |
| `pnpm test:rn` | The Expo app's native component tests. |

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test
env -u AI_AGENT -u CLAUDECODE pnpm check:build
CI=true env -u AI_AGENT -u CLAUDECODE pnpm browser-smoke
pnpm test:rn
```

## Mobile

An Expo (React Native) app reads the same `overview` document through a Cloudflare Worker that checks Firebase
App Check: Today (day waterfall + chains), History (30D/90D/ALL with pinned tooltip), Operations (largest +
records), and a Chain push screen. It reaches users after the web launch.

## Known limitations

- Stable Story is a working name and may change.
- ALL starts at the earliest covered day; older periods are resolved by weeks (90D) and months (ALL) on the
  server — the page never re-buckets.
- Chain histories start at each chain's coverage start (Base from its deployment day) and deepen over time.
- There is no public API and no data export by design; the page itself is the interface.
- The mobile app reaches users after the web launch.
- CI runs on manual dispatch.
