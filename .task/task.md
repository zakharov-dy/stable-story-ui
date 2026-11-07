AI review: on · reviewer commandcode · model deepseek/deepseek-v4.1-flash · effort high · rounds 3

# Public-repo showcase: README, architecture, data quality, overview example

## Why

Stable Story is the owner's public showcase (goal of the web track, `projectbrief.md`): a pet project whose main purpose is to show what the owner can do, linked from a CV. The site is live at https://stable-story.vercel.app and the repository is about to be opened publicly. The repository front page must present the system the way the accepted product answer prescribes: engineering facts, data quality and hosting shape — not a placeholder README.

## Launch criteria

None (inbox entry: «Критерий: нет — запуск состоялся 2026-11-05; цель — витрина»). No row of `docs/requirements/launch-criteria.md` changes in this PR. Constraint from the entry: LC-07/LC-08/LC-09 must not be weakened — no data export or download language anywhere, no PRO/paywall/teaser wording, `robots.txt` untouched, no credentials or signed URLs in the docs (environment variable names are fine).

## What to read (in your worktree)

- `packages/contracts/src/schemas.ts` — the data contract (this is the "zod invariants" selling point; count its schema/invariant lines honestly).
- `packages/contracts/fixtures/` — the mock `overview` documents (the example below is trimmed from one of these).
- `apps/web/` structure and `docs/design.md` — what the page shows (hero, day waterfall, chain stack, flows, operations, records, "How we count").
- `.github/workflows/ci.yml` — the comment you may reword (below).

Facts about the system you must use (the analytical backend is a separate private repository; describe it as a black box, and never name it):

- The product: USDC supply on six chains — Ethereum, Base, Arbitrum, OP Mainnet, Avalanche C-Chain, Polygon PoS. Working name "Stable Story" (footnote it as a working name).
- Tagline: "The supply of USDC, accounted for." Long form for README and meta description: "USDC supply by chain. Every day attributed to issuer or bridge, and reconciled against the contract."
- What the page shows: header figures, the day equation (five terms), the 20 largest operations of 7 days, records, per-chain status; charts at three periods — 30D by days, 90D by weeks (exactly 90 days), ALL by months from the earliest day with data of any chain. The server decides the window step and the selection; the page renders the step it is given and never aggregates. A chain without data for a period is "no data" — not zero, not drawn.
- Four flows: issuer_mint, issuer_burn (Circle as issuer, outside the CCTP bridge), bridge_in, bridge_out (CCTP V1/V2 transfers). Every bridge operation is paired across chains (mint on one side, burn on the other); unpaired supply logs are flagged, never silently counted as operations.
- Three daily reconciliations per chain-day: supply (the day's computed supply level against the on-chain `totalSupply`), bridge (CCTP pairing), continuity (the day's level against the previous day plus flows). A mismatched day stays closed and is flagged (`unreconciled`), never hidden or zeroed; the reconciliation summary counts closed days, events, mismatched days and a clean streak.
- Data shape: exact integer token amounts as decimal strings (no floats), `null` means no data and is never rendered as 0; six-place rounded percentages; the `overview` document is one versioned, schema-verified JSON produced after the day closes.
- Production shape (no code, interfaces only): on the owner's machine, logs → per-day reconciliations → Postgres → a publisher that writes prepared immutable read-only documents (version + pointer) to a private Cloudflare R2 bucket. The site runs on Vercel as server-side rendering and reads that document on the server; the browser makes no API or R2 requests and receives no credentials. The same prepared document reaches the Expo app through a Cloudflare Worker that checks Firebase App Check. No database server in production; hosting $0/month.
- Tests: `pnpm test` (unit: the shared view logic, the zod contract with negative tests asserting the specific error path, page tests), `pnpm browser-smoke` (headless Chrome over every mock state: ok, delayed, unreconciled, empty-day, short-history, gap, empty, unavailable, long-history), `pnpm check:build` (build with no external fonts and the daily-window HTML/RSC leak check), `pnpm test:rn` (mobile native component tests).
- Mobile: an Expo (React Native) app is built — Today (day waterfall + chains), History (30D/90D/ALL with pinned tooltip), Operations (largest + records), Chain (push screen) — same `overview` document; it goes to users after the web launch.

## Task

Write the public showcase in the repository (all in English):

1. `README.md` (rewrite): top — the first-screen screenshot, the tagline "The supply of USDC, accounted for." linked to https://stable-story.vercel.app, a status line `live · updated daily · six chains`, and exactly three "what's unusual" bullets: (a) every day is reconciled against the contract and every bridge operation is paired; (b) production has no database server — the backend stays local and publishes prepared read-only documents; hosting $0/month; (c) the data contract is ~600 lines of zod invariants with negative tests on the error path (verify the number against `packages/contracts` and keep it honest). "Working name" from the first line goes to a footnote. Also: a "Start here" list of five links (suggested: the live site, the overview schema in `packages/contracts`, the shared `@app/view` logic, `docs/data-quality.md`, `docs/architecture.md`), the checks table (what each check proves, from the facts above), a short mobile paragraph from the facts above, links to `docs/architecture.md`, `docs/data-quality.md` and the overview example, and a "Known limitations" section (honest: working name; ALL starts at the earliest covered day and older periods are resolved by weeks/months; Base history coverage starts at its deployment day and deepens over time; no public API or data export by design; the mobile app reaches users after the web launch; CI runs on manual dispatch).
2. `docs/architecture.md`: the whole system with the backend as a black box with interfaces — logs → reconciliations → Postgres → publisher → R2 → SSR; the same document → Cloudflare Worker (App Check) → Expo. Describe contracts, the day/flow model, the reconciliation checks, the overview document (30D/90D/ALL, server-side steps, `null` ≠ 0), and the delivery and credential boundary (browser receives no backend or R2 access). No code from the backend (it is not in this repository), and no references to any other repository, ADR numbers, internal documents or paths.
3. `docs/data-quality.md`: the three reconciliations, CCTP pairing, the gap policy (missing day = "no data", never zero) and the unreconciled-day policy (stays closed, flagged, counted).
4. An example `overview.json` trimmed from a `packages/contracts/fixtures/` document (keep the shape honest — trim arrays and mark the trimming, do not invent values) with a "how to read it" explanation. Put it under `docs/` and link it from the README.
5. Two PNG screenshots in `docs/media/`, each ≤ 300 KB: the first screen (used at the README top and as the GitHub social preview) and one of the chart section (30D/90D/ALL with the sticky controls). Produce them with the headless `browser-smoke --shots` (explore its options) or another local headless render of the built mock page; resize/compress locally to fit the limit. These are the only images.
6. `.github/workflows/ci.yml`: reword the comment at the top to say the workflow is manual-only, dropping the GitHub Actions billing reason and the backend-workflow mention (one comment, no functional change).

## Out of scope

- History, branch, PR-body or GitHub-settings cleanup (the coordinator owns that item separately).
- Any code, test, token, `package.json` or lockfile change; `robots.txt`; the page itself; mobile code.
- No ADR numbers, PR numbers, launch-criteria IDs (LC-xx), agent/harness names, `/Users/...` paths, or any mention of the private backend repository — grep your own diff for `block-and-tell`, `happy-harness`, `LC-`, `ADR`, `/Users/` before pushing and remove every hit.
- No screenshots beyond the two PNGs; no image of data tables the product does not show.

## Acceptance criteria

- The README carries, in this order near the top: screenshot, tagline with the site link, the `live · updated daily · six chains` status, the three bullets, the working-name footnote; then Start here (five links), the checks table, the mobile paragraph, links to the three documents/example, Known limitations.
- `docs/architecture.md`, `docs/data-quality.md` and the overview example exist, are linked from the README, and every factual claim in them matches the facts above and the repository's own contracts (a claim you cannot verify from these sources — soften or drop it).
- Exactly two PNGs in `docs/media/`, each ≤ 300 KB, referenced from the README.
- The diff contains none of the prohibited references (grep above, report its result).
- The local gate is green (checks below); the report names every exit code and the checked commit sha.

## Branch, network, files

- Branch: `web/showcase` (if the harness assigns its own worktree branch, keep the assigned one and say so in the report).
- Network: only after the coordinator allows it. Nothing in this task should need it: screenshots are local headless renders. If a download becomes unavoidable, stop and `QUESTION:`.
- **Files you may change**: `README.md`, `docs/**`, `.github/workflows/ci.yml` (comment only).
- **Design**: none
- **Plan**: plan first — this is a public architecture document and a multi-file deliverable; write `.task/plan.md` and wait for the plan round before the code push.

## When to ask (`QUESTION:`)

Only what the pair cannot decide: policy, scope, the owner's decisions — e.g. a fact you cannot verify from the given sources and the repository, or a deliverable that cannot be produced locally.

## Setup and checks

- Fresh `origin/main` of `zakharov-dy/stable-story-ui` in your worktree; `pnpm install` in the worktree (this repository is its own workspace; do not touch any backend checkout).
- With `set -o pipefail`, real exit codes, output cut:
  - `pnpm typecheck | tail -40`
  - `pnpm lint | tail -40`
  - `pnpm test --reporter=dot | tail -40`
  - `env -u AI_AGENT -u CLAUDECODE pnpm check:build | tail -40`
  - `CI=true env -u AI_AGENT -u CLAUDECODE pnpm browser-smoke | tail -30`
- PR at the first push (CI is manual only; no run is expected). The final report has the full local run on the last code commit: every exit code and that commit's sha. Commit author is the configured owner identity — check `git log -1 --format='%an <%ae>'` before each push; keep the `Co-Authored-By` trailer of the model that wrote the code.
- The PR lists every deviation from the letter of `docs/architecture.md` (the backend one is not in your tree; deviations from the facts above must be listed).

## Economy

No interactive browser and no screenshots other than the two headless PNGs; no full reads of big files (grep, sed ranges); no rereads; cut outputs.

## Для ревьюера

Major threshold: a factual claim that contradicts the facts given or the repository's contracts (wrong chain set, wrong flow names, wrong period rules, a claim about the backend stated as code-level fact); a prohibited reference in the diff (private repo name or links, ADR numbers, LC ids, harness/agent names, `/Users/` paths, PR numbers); a missing deliverable (README section, one of the two docs, the example, the two PNGs, the ci.yml comment); an image over 300 KB or a screenshot of something the product does not show; weakened LC-07/LC-08/LC-09 language (export/download/PRO wording anywhere); a code, test or lockfile change. Everything else is minor.