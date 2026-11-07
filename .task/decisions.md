# Decisions (showcase task)

## Plan round 1 — reviewer findings (2026-11-07)

### F1 — screenshots must be six-chain and demo-free (accepted, plan fixed)

- Finding: the plan's hero (top crop of the `--states ok` capture) would show three chains
  (Ethereum/Base/Arbitrum) plus the mock `.demo` banner while the README status line says six chains.
- Evidence confirmed in the worktree: `fixtures/ok/overview.json` has 3 chains;
  `fixtures/long-history/overview.json` has 6 (Ethereum, Base, Arbitrum, OP Mainnet, Polygon PoS,
  Avalanche C-Chain); `PageView.tsx:40-44` renders the `.demo` banner first whenever `demoState`
  is set; `docs/web-testing.md` says screenshot evidence uses only the six-chain state;
  the sticky bar (`#sticky-bar`, `PageView.tsx:123`) unhides only after `#hero` leaves the viewport
  (`HomeInteractions.tsx`, IntersectionObserver).
- Resolution: both PNGs come from the six-chain `long-history` render. The `published` state was
  considered and rejected: it is demo-free but serves the 3-chain `ok` overview
  (`test-support/publication.ts` defaults to `state = 'ok'`), so it would still contradict the status line.
  Hero: viewport (1440x900, above the fold) capture of the built mock page
  (`next start`, `API_MODE=mock MOCK_STATE=long-history` — the same server the harness uses) with only
  the mock-harness `.demo` element hidden (absent in production; the reviewer explicitly endorsed hiding it).
  Charts: same page, scrolled past `#hero`, waiting for `#sticky-bar` to unhide, with the 30D/90D/ALL
  controls asserted present before capture. The `--states long-history --shots` catalog in `$TMPDIR`
  remains the base artifact; both PNGs verified with `ls -l` (≤ 300 KB, resize-to-1280/1200 fallback).
- Answers: Q1 → `long-history` for both images. No demo text in either image.

### F2 — architecture plan omitted the publication version + pointer model (accepted, plan fixed)

- Finding: the plan said "publisher → R2 → SSR" and "versioned document" without reading
  `packages/contracts/src/publication.ts`; `Overview` has no version field, so "versioned overview JSON"
  wording would contradict the contract.
- Evidence confirmed: `publication.ts` defines `PublicationCurrent` (`formatVersion: 1`, UUID `version`,
  `manifestSha256`, `publishedAt`, nullable `previous` with a must-differ invariant) and
  `PublicationManifest` (single-document tuple: `key` = `versions/<version>/supply/usdc/overview.json`,
  `byteLength`, `sha256`, `asOf`, `generatedAt`, with key/clock-match invariants). Consumers hash the exact
  UTF-8 bytes themselves. The `Overview` shape (`schemas.ts`) carries no version field.
- Resolution: `docs/architecture.md` will describe the publisher interface as pointer + manifest +
  immutable versioned document (`current.json` → manifest → `versions/<uuid>/supply/usdc/overview.json`,
  hash metadata for verification) and state explicitly that versioning lives in the publication envelope,
  not inside the overview JSON. No backend code is cited (the envelope schema is in this repository).

### Minor items (accepted, folded into the plan)

- Example uses the six-chain `long-history` excerpt (not `ok`); paired arrays stay aligned — cuts are
  by bucket count across every parallel array, all six scopes kept; the companion `.md` lists exact cut
  counts. (Drops the "fixtures are 3-chain mocks" line, which was false.)
- README carries the long-form sentence near the tagline: "USDC supply by chain. Every day attributed to
  issuer or bridge, and reconciled against the contract."
- Architecture/data-quality docs carry the data-shape facts from `primitives.ts`: exact integer token amounts
  as canonical decimal strings (no floats), percentages rounded to at most six places, `null` never rendered
  as 0.
- Screenshot size verification (`ls -l`) and resize fallback added; PR-at-first-push and the
  `git log -1 --format='%an <%ae>'` + `Co-Authored-By` check added to the process.

## Standing deviations

- Branch: assigned `worktree-go-showdoc` kept instead of `web/showcase`.
- Social-preview assignment (`hero.png` as the GitHub social preview) is a repo setting owned separately;
  this task only references the image from the README.

## Implementation round (plan approved, 2026-11-07)

### Reviewer questions from plan round 2 (answered by the implementation)

- Example scopes: yes — `docs/overview-example.json` keeps all 7 day scopes (`all` + six chains), all 7 driver
  and `issuerVsBridge` scopes, 6 status chains and 6 reconciliation chains. `docs/overview-example.md` lists
  every cut array with full→excerpt counts (header days/sparks, per-view buckets, `noDataChains` rows, line
  values, driver events) and notes that `issuerVsBridge` aggregates describe the full fixture window, copied
  as-is rather than recomputed over the trimmed buckets.
- Mock date in the hero (fixture `asOf` 2027-03-15 under "live · updated daily"): accepted with an honest
  caption. The README captions both screenshots as renders from the six-chain mock state the project's checks
  use for screenshot evidence; no values were altered or invented to hide the date.

### Deviations from the plan, with reasons

- None so far: screenshots from `long-history`, `.demo` hidden only for the hero capture, publication envelope
  in `docs/architecture.md`, data-shape facts in both `docs/architecture.md` and `docs/data-quality.md`,
  `charts.png` referenced from the README "What the page shows" section.
