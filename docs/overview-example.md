# `overview.json`: how to read it

An excerpt of the `overview` document the page is rendered from: one versioned, schema-verified JSON
produced after the day closes. The full document lives in the mock catalog at
`packages/contracts/fixtures/long-history/overview.json`; the excerpt is
[`overview-example.json`](overview-example.json). Every value below is copied verbatim from that fixture —
arrays were cut short, nothing was invented or recomputed.

## What was trimmed

The source fixture covers six chains (Ethereum, Base, Arbitrum, OP Mainnet, Polygon PoS, Avalanche C-Chain)
at `asOf` 2027-03-15. The excerpt keeps every block and every scope (`all` plus the six chains) and cuts only
the length of repeated arrays, cutting each group of parallel arrays to the same length so values stay aligned
with their buckets and days:

| Array | Full | Excerpt |
|---|---|---|
| `header.days` and each header KPI `spark` | 30 | first 3 |
| `views["30d"]` buckets, `noDataChains` rows, every line `values`, every driver series buckets / line values / `events` | 30 | first 3 |
| `views["90d"]` buckets and the same parallel arrays | 14 | first 2 |
| `views["all"]` buckets and the same parallel arrays | 5 | first 2 |
| `largestEvents.items` | 20 | first 2 |
| `records` | 28 | first 2 |

Kept whole: `chains` (6), `day` (7 rows: `all` plus one per chain), all 7 driver and `issuerVsBridge` scopes,
`status` (6 chains), `reconciliation` (summary plus 6 chains). Note that the `issuerVsBridge` aggregates
(volume, counts, shares) describe the full fixture window — they are copied as-is, not recomputed over the
trimmed buckets.

## The blocks

- **Top level** (`asset`, `generatedAt`, `asOf`, `historyStart`, `chains`): what the document is (`usdc`),
  when it was built, the last closed day it covers, the earliest day with data of any chain, and the enabled
  chains with the explorer URL template used for operation links.
- **`header`**: the five headline figures — tracked supply, 1-day and 7-day change, 7-day issuer mint and burn —
  each with its value, change against the previous window, a 30-point sparkline, and a quality note.
- **`views["30d" | "90d" | "all"]`**: the three chart periods. Each carries its day range and step
  (`day`, `week`, `month`), the supply-by-chain series (level, share, total, and the stacked renderings),
  the per-scope driver series with per-bucket operation counts, and the issuer-vs-bridge split.
  `noDataChains` lists, per bucket, which chains had no data there — the page renders those as "no data",
  never as zero. The server chooses the step and the buckets; the page renders what it is given.
- **`day`**: the closed day's equation, one row for `all` and one per chain: issuer mint, issuer burn,
  bridge in, bridge out, and net — plus the operation count and whether the row's chain-day reconciled.
- **`largestEvents`**: the 20 largest operations of the trailing 7 days (`from`/`to`), each with chain, flow,
  amount, timestamp, transaction link, and the bridge metadata (CCTP version and peer) or the `unpaired` mark
  when a bridge log has no counterpart.
- **`records`**: all-time records with their value, day, and the `since` date of the search range. A record can
  be `null` with a reason in its quality note — the second record here is exactly that (`complete: false`,
  value and day `null`): missing data is never rendered as 0.
- **`status`**: per-chain standing — state (`ok`, `delayed`, `unreconciled`, `no_data`), coverage
  (`historyStart`, `lastClosedDay`), chain position (`lastBlock`), schedule (`nextDueAt`, `lagHours`), the last
  run, the last closed day's three reconciliation checks, and the list of mismatched days.
- **`reconciliation`**: the counters — closed days, attributed events, mismatched days, and the clean streak
  with its end day — overall and per chain. The overall summary here counts one mismatched day: it stays in the
  totals, flagged, not hidden.
