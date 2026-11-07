# Plan: public-repo showcase (README, architecture, data quality, overview example)

Branch: keep the assigned `worktree-go-showdoc` (task names `web/showcase`; reporting the deviation).

## Verified facts (from the worktree, not just the brief)

- Tagline in `apps/web/src/texts.ts:6`: "The supply of USDC, accounted for." Six-chain copy exists in texts (`optimism: 'OP'`, polygon, avalanche); fixtures are 3-chain mocks.
- `packages/contracts/src/schemas.ts` is 641 lines; schema roots: `Quality`, `Series(Line)`, `Kpi`, `Split`,
  `EventRow`, `EventsPage`, `EventsStats`, `RecordItem`, `ChainStatus`, `OverviewDriver`, `OverviewView`,
  `OverviewDay` (five terms: issuer_mint, issuer_burn, bridge_in, bridge_out, net), `ReconciliationSummary`
  (`closedDays`, `events`, `mismatchedDays`, `streakDays`, `streakEnd`), `Overview`, `Health`.
  Supporting invariant modules: `overview-invariants.ts` (232), `reconciliation-invariants.ts` (68).
  README will say "about 600 lines of zod" for `schemas.ts` (641, honest rounding; exact non-blank count
  rechecked at write time).
- `fixtures/ok/overview.json` top keys: `asset, generatedAt, asOf, historyStart, chains, header, views, day,
  largestEvents, records, status, reconciliation`. `largestEvents`: 20 items over a 7-day window.
  Views: `30d → day`, `90d → week`, `all → month`. `design.md` confirms: page never aggregates, server owns
  steps/buckets, `null` never becomes zero, no-data chains are not drawn.
- Mobile tabs: `(today)`, `history`, `operations` (+ chain push screen — rechecked at write time).
- `browser-smoke.ts`: `--shots <dir>` catalog (full page per state+viewport; per-period stack/flows sections on
  `long-history`); viewports 1440x900, 375x812; `next start` with `API_MODE=mock MOCK_STATE=<state>`.
- `check-build.ts`: self-hosted fonts only, no API/R2/contract-runtime leaks in client assets, daily-window
  HTML/RSC leak check. `ci.yml` head comment is the only thing to reword there.

## Deliverables (files I may change: `README.md`, `docs/**`, `ci.yml` comment only)

1. `README.md` (rewrite), order: screenshot → tagline linked to the live site → `live · updated daily ·
   six chains` → exactly three "what's unusual" bullets → working-name footnote; then Start here (five links:
   live site, overview schema in `packages/contracts`, shared view logic, `docs/data-quality.md`,
   `docs/architecture.md`), checks table (six rows: typecheck/lint/test/check:build/browser-smoke/test:rn —
   what each proves), mobile paragraph, links to architecture + data-quality + overview example,
   Known limitations (working name; ALL starts at earliest covered day, weeks/months for older periods;
   Base coverage starts at its deployment day and deepens; no public API or data export by design;
   mobile after web launch; CI manual dispatch).
2. `docs/architecture.md` — backend as black box with interfaces only
   (logs → reconciliations → Postgres → publisher → R2 → SSR; same document → Worker + App Check → Expo).
   Contracts, day/flow model, three reconciliations, overview document (periods, server steps, `null` ≠ 0),
   credential boundary (browser gets no backend/R2 access, no credentials). No backend code, no other
   repository, no internal doc paths or decision-record numbers.
3. `docs/data-quality.md` — three reconciliations, CCTP pairing, gap policy (missing = "no data", never zero),
   unreconciled-day policy (stays closed, flagged, counted).
4. `docs/overview-example.json` (trimmed from `fixtures/ok/overview.json`: arrays cut to first 2–3 elements,
   pure JSON, no added fields) + `docs/overview-example.md` ("how to read it": what each block is and exactly
   what was trimmed). README links both.
5. `docs/media/hero.png` (first screen, 1440x900 viewport) + `docs/media/charts.png` (chart section with period
   + sticky controls), each ≤ 300 KB, only images in the diff. Produced by `browser-smoke --shots` into
   `$TMPDIR` (hero: crop of the full-page ok capture at the same viewport — identical pixels; charts: small
   headless render of the built mock page scrolled so the sticky bar shows, allowed as "another local headless
   render"). Compress locally (sips) to fit the limit; verify sizes before commit.
6. `.github/workflows/ci.yml` — reword the head comment to manual-only; drop billing reason and backend mention.

## Language guardrails (reviewer-major if violated)

- No `block-and-tell`, `happy-harness`, `LC-`, decision-record numbers, PR numbers, `/Users/` paths, or any
  mention of the private backend repository anywhere in the diff — grep before every push, report result.
- No data export/download affordance language, no PRO/paywall/teaser wording, `robots.txt` untouched, no
  credentials (env var names fine). The mandated Known-limitations negation ("no public API or data export by
  design") stays; the word "download" is avoided entirely.
- No code/test/token/package/lockfile/page/mobile changes. No screenshots beyond the two PNGs.

## Verification

- Full gate on the last code commit with `set -o pipefail`, cut outputs: typecheck, lint, test, check:build
  (with `env -u AI_AGENT -u CLAUDECODE`), browser-smoke (`CI=true`, same unsets). Report every exit code + sha.
- `check:build` before any screenshots (smoke reuses its build). Screenshots do not need network
  (headless render of the local mock build; if a download became unavoidable I would `QUESTION:` first).
- Follow-up outside this task (owner/coordinator side): assigning `hero.png` as the GitHub social preview image
  is a repo setting, owned separately.

## Rounds

- This push: task files only (plan round). Code push after plan approval; `.task/decisions.md` kept current
  before every review push; `.task/` removed in its own cleanup commit after final approval.
