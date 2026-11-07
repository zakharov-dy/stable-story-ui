# Architecture

Stable Story tracks the supply of USDC on six chains — Ethereum, Base, Arbitrum, OP Mainnet, Avalanche C-Chain,
Polygon PoS — and attributes every day's change to the issuer or the bridge. The analytical backend is a private
codebase: this document describes it as a black box with interfaces. Everything it hands over the boundary is
defined by the schemas in this repository's contracts package.

## Pipeline

On the owner's machine, chain logs flow through per-day reconciliations into Postgres. A publisher then prepares
immutable, read-only documents and writes them to a private Cloudflare R2 bucket: each publication is a versioned
envelope — a `current.json` pointer carrying the publication UUID, the manifest hash, and the previous version —
beside a manifest and a single document keyed under that version. There is no database server in production;
hosting the data costs $0/month.

## The publication envelope

Versioning lives in the envelope, not in the data: the `overview` JSON itself has no version field. The pointer
(`current.json`) names the current publication UUID; the manifest binds that UUID to exactly one document key
(`versions/<uuid>/supply/usdc/overview.json`) with its byte length, SHA-256, and day range, so any consumer can
verify the bytes it received. A new day is a new UUID and a new immutable key; the old documents stay untouched.

## The day and flow model

A chain-day is one computed supply level plus four flows: `issuer_mint` and `issuer_burn` (Circle as issuer,
outside the bridge) and `bridge_in` / `bridge_out` (CCTP V1/V2 transfers). Every bridge operation is paired
across chains — a mint on one side, a burn on the other — and carries its CCTP version and peer; a bridge log
with no counterpart is flagged as unpaired, never silently counted as an operation.

## Reconciliation

Each chain-day closes against three checks (see [data quality](data-quality.md)): the computed supply level
against the on-chain `totalSupply`, the CCTP pairing, and the level against the previous day plus flows. A day
that mismatches still stays closed — flagged as unreconciled, counted in the summary, never hidden or zeroed.

## The `overview` document

After the day closes, one `overview` JSON is produced and schema-verified: header figures, the three chart
periods, the day equation, the 20 largest operations of 7 days, records, per-chain status, and the reconciliation
summary. The 30D view uses daily buckets, 90D uses weekly buckets covering exactly 90 days, and ALL uses monthly
buckets from the earliest day with data of any chain. The server decides the window step and the selection; the
page renders the step it is given and never aggregates. A chain without data for a period is "no data" — not
zero, not drawn.

An annotated excerpt sits beside this document: [`overview-example.md`](overview-example.md) explains the blocks,
and [`overview-example.json`](overview-example.json) shows the shape on real (mock) values.

## Data shape

Exact integer token amounts travel as canonical decimal strings — no floats anywhere. Percentages are rounded to
at most six places. `null` means no data and is never rendered as 0. These are schema-level invariants with
negative tests asserting the exact error path, not conventions.

## Delivery and credential boundary

The site runs on Vercel as server-side rendering: it follows the `current.json` pointer, verifies the document,
and renders the page on the server. The browser makes no API or R2 requests and receives no credentials — page,
charts, and tooltips are server-rendered from the prepared document. The same prepared document reaches the Expo
mobile app through a Cloudflare Worker that checks Firebase App Check. Nothing the client receives can write back:
the documents are read-only, and the only mutation point is the publisher on the owner's machine.
