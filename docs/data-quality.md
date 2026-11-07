# Data quality

Every figure on the page is either reconciled or explicitly marked. There are three daily checks per chain-day,
one pairing rule for bridge operations, and two display policies for the cases that fail. The contract behind
them is the zod schema in this repository's contracts package, with negative tests asserting the exact error
path of each invariant.

## The three reconciliations

1. **Supply.** The day's computed supply level is checked against the on-chain `totalSupply` of the chain's
   USDC contract. A nonzero difference is a mismatch, with the signed diff kept on the status record.
2. **Bridge.** Every CCTP operation must pair across chains: a mint on one side, a burn on the other, with
   matching version and peer. Unpaired supply logs are flagged and counted — never silently counted as
   operations.
3. **Continuity.** The day's level must equal the previous day's level plus the day's flows (issuer mint minus
   issuer burn, bridge in minus bridge out). The first day of a chain's coverage has no predecessor, so this
   check is skipped there rather than failed.

## The gap policy

A missing day is "no data", never zero. Before a chain's coverage begins, its row says no data and its chart
layer is absent; an unexpected missing value inside coverage stays a visible gap. `null` in the document means
no data, and the page never renders it as 0. Period availability follows the server's coverage policy, with a
visible reason when a longer period is disabled.

## The unreconciled-day policy

A mismatched day stays closed. It is flagged on the day waterfall (affected nets are dashed), named in the
unreconciled notes with the chain's own last closed day, and counted: the reconciliation summary carries closed
days, attributed events, mismatched days, and a clean streak with its end day. Nothing is hidden, nothing is
zeroed, and the streak only counts clean closed days.

## Data shape

Exact integer token amounts travel as canonical decimal strings — no floats, so there is nothing to round and no
representation to drift. Percentages and derived values are rounded on the server to at most six places. These
are schema-level invariants: a malformed amount or an over-precise decimal fails validation at the boundary,
before it can reach a chart.
