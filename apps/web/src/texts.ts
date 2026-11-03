// Every user-facing string of the page, in English, without an i18n engine.
// Components take their text from here only; the product name appears here and in README.md.
import type { PeriodId } from '@app/view';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const list = (items: readonly string[]): string => items.join(', ');

export const texts = {
  productName: 'Stable Story',
  tagline: 'Every change has a story: USDC supply, chain by chain.',
  cadence: 'Updated daily · next closed day by 06:00 UTC',
  meta: {
    title: 'Stable Story · USDC supply history',
    description: 'Tracked USDC supply by chain, split into issuer and CCTP bridge flows, from closed UTC days.',
  },

  // Formatting.
  noData: 'no data',
  minus: '−',
  plus: '+',
  percent: '%',
  months: MONTHS,
  utc: 'UTC',
  dayRange: (from: string, to: string) => `${from} – ${to}`,

  assetNames: { usdc: 'USDC' } as Record<string, string>,
  coverage: (asset: string, names: readonly string[]) =>
    `Tracked supply: ${asset} on ${names.length} ${names.length === 1 ? 'chain' : 'chains'} (${list(names)})`,
  asOf: (day: string) => `Data through ${day}, the last UTC day closed on every tracked chain.`,
  demo: (state: string) =>
    `Demo data (mock state “${state}”): synthetic numbers and transactions, not real on-chain activity.`,

  states: {
    // asOf: null — some chain has no closed day, or the chains' closed days do not overlap.
    empty: 'No figures yet: the tracked chains do not have closed UTC days in common.',
    emptyBody:
      'Figures, the day equation and every chart appear by 06:00 UTC after the first day that is closed on every tracked chain. Each chain’s own status is below.',
    unavailable: 'The data is temporarily unavailable.',
    mark: '///',
    unavailableLabel: 'Data unavailable',
    unavailableBody:
      'We could not load the figures. Rather than show stale or partial numbers, this page shows none until the data is back. Please check again later.',
    // The note under the date while a chain lags: every figure stays on asOf.
    delayed: (names: readonly string[], day: string) =>
      `${list(names)} ${names.length === 1 ? 'has' : 'have'} not closed the next day yet. All figures stay on ${day}, the last day closed on every tracked chain, so the chains cover the same day. ${names.length === 1 ? 'It is' : 'They are'} still included.`,
  },

  quality: {
    title: 'Data quality',
    incomplete: 'Incomplete: some days in this range are missing or not closed.',
    unreconciled: (days: readonly string[]) => `Reconciliation mismatch on ${list(days)}.`,
    unreconciledPoints: 'Marked points include a day with a reconciliation mismatch.',
    operationsIncomplete: 'Operation counts are incomplete for this range.',
    unpaired: (count: number) => `${count} bridge ${count === 1 ? 'event is' : 'events are'} not paired with a CCTP operation.`,
    incompleteBuckets: (step: string) => `Shaded ${step}s are incomplete.`,
    // The key label at the start of a quality note.
    kinds: { unreconciled: 'Unreconciled', incomplete: 'Incomplete', unpaired: 'Unpaired', delayed: 'Delayed' },
  },

  // The /// 0N label of a page section.
  section: {
    label: (index: number) => `/// ${String(index).padStart(2, '0')}`,
  },

  // Short marks next to chains, events and days.
  tags: {
    unreconciledDay: '◇ unreconciled day',
    closedNoEvents: 'closed · no events', // a closed day whose event count is 0
    unpaired: 'unpaired',
    peerUnknown: 'peer unknown',
    // A chain that is behind, by place: the header and the status name the chain, a card of its own does not.
    behind: (chain: string, hours: string) => `${chain} · ${hours} h behind`,
    behindShort: (hours: string) => `${hours} h behind`,
    behindNotClosed: (hours: string, day: string) => `${hours} h behind · ${day} not closed`,
    behindLabel: (hours: string) => `${hours} h`, // beside the name of a layer
    chainUnreconciled: (chain: string, day: string) => `◇ ${chain} · ${day} unreconciled`,
    noData: 'no data',
  },

  // A value that cannot be shown, with the reason under it.
  na: {
    label: 'n/a',
    reasons: {
      operationsIncomplete: 'operation counts incomplete',
      previousWeekIncomplete: 'previous week incomplete',
      noDataForRange: 'no data for the range',
    },
    // A value that needs days from before the history starts (days are short, the start is the first closed day).
    history: {
      needs: (day: string, start: string) => `needs ${day}, before history starts (${start})`,
      before: (range: string) => `${range} is before history starts`,
    },
  },

  header: {
    label: 'Supply',
    cards: {
      supply: 'Tracked supply',
      change1d: 'Change, 1 day',
      change7d: 'Change, 7 days',
      issuerMinted7d: 'Issuer minted, 7 days',
      issuerBurned7d: 'Issuer burned, 7 days',
    },
    changePct: {
      supply: '',
      change1d: 'vs the previous day',
      // The 7-day card names the compared day: the last closed day minus 7 days, passed by the caller.
      change7d: (day: string) => `vs ${day}`,
      issuerMinted7d: 'vs the previous 7 days',
      issuerBurned7d: 'vs the previous 7 days',
    },
    // The reason under an n/a percentage when the previous value is exactly zero (quality is complete).
    zeroBase: 'previous value is zero',
    issuerNote: { term: 'Issuer', body: ' = mint or burn outside CCTP. A mint alone does not prove fiat inflow.' },
    spark: {
      label: (card: string, from: string, to: string) => `${card}, daily, ${from} to ${to}`,
      middle: { level: '30 days', change: 'daily values · 0 dashed' },
      noData: (ranges: readonly string[]) => `no data · ${list(ranges)}`,
      day: (day: string, value: string) => `${day}: ${value}`,
    },
    sign: { up: '▲', down: '▼' },
  },

  // The day equation: one card per chain, from the dedicated day block (`Overview.day`) and status.
  equation: {
    label: 'Day equation',
    caption: 'One card per chain, from that day’s events. Chains are never added together.',
    terms: {
      issuer_mint: 'issuer mint',
      issuer_burn: 'issuer burn',
      bridge_in: 'bridge in',
      bridge_out: 'bridge out',
      net: 'net',
    },
    equals: '=',
    scaleNote:
      'Bars share one scale across chains: in → right, out ← left, from the zero line. Solid = issuer, hatched = bridge, gold line = net. Dashed chip border = term affected by the failed check.',
    bars: (name: string, day: string, inTotal: string, outTotal: string, net: string) =>
      `${name} ${day}: in ${inTotal} to the right, out ${outTotal} to the left, net ${net}`,
    reconciliation: (day: string) => `Reconciliation · ${day}`,
    latestChecks: (day: string, latest: string) => `${day} · latest checks are for ${latest}`,
    notFlagged: (day: string) => `${day} is not flagged`,
    checks: {
      passed: 'checks passed',
      supply: (diff: string) => `Δ totalSupply ≠ Σ events by ${diff}`,
      bridge: 'bridge flows ≠ CCTP operations',
      continuity: 'does not join the previous day',
      continuityFirst: 'continuity · first day',
      unreconciledDay: 'unreconciled day',
    },
    marks: { passed: '✓', failed: '✕', flagged: '◇', muted: '—' },
  },

  resolution: {
    steps: { day: 'daily', week: 'weekly', month: 'monthly' } as Record<string, string>,
    units: { day: 'day', week: 'week', month: 'month' } as Record<string, string>,
    partial: 'incomplete period', // a cut first/last calendar bucket (W1 item 3); the code still classifies it as partial
    flagged: 'includes an unreconciled day',
    sentence: 'The last 30 days are shown by day, 90 days by week, and the full span by calendar month.',
    end: (step: string) => 'end of ' + step,
    levelEnd: (step: string) => `level at ${step} end`,
    flowSum: (step: string, scope: string) => `sum per ${step}, ${scope}`,
    closeTooltip: 'Close tooltip',
  },

  supplyByChain: {
    title: 'Supply by chain',
    headline: 'Where the tracked supply sits',
    caption: (range: string, names: readonly string[]) =>
      `Common history, ${range}. Layers in chain order: ${list(names)}. Levels in USDC tokens; shares of tracked supply below on the same time axis.`,
    // A cropped period names its own window instead of the common history.
    windowCaption: (range: string, names: readonly string[]) =>
      `${range}. Layers in chain order: ${list(names)}. Levels in USDC tokens; shares of tracked supply below on the same time axis.`,
    level: 'Level · USDC tokens',
    share: 'Share · % of tracked supply',
    shareRange: '0–100 %',
    shareTotal: '100%', // the header row of the tooltip: shares of a known column add up to the whole
    endOfDay: 'end of day', // the footer row of the tooltip: the value is the level at the day's end
    // The chart starts at the first day closed on every chain, which is later than the 30-day windows.
    shortHistory: (since: string) =>
      `History since ${since}, the first day closed on every chain. The chart starts there; nothing before is drawn.`,
    lastDay: (day: string) => `Last day ${day}`,
    describe: (label: string, range: string, last: string) => `${label}, ${range}. ${last}`,
    missing: 'A day without data for some chain leaves a gap in the stack.',
    gapNote: (range: string) => `▨ no data · ${range}`,
  },

  // The page-wide period switch: one radio group above section 03. `driven` names the sections the
  // switch sets, so later tasks add 04 and 05 by adding to that list. The disabled reason lives in the
  // caption as text (spec board); its wording follows the actual thresholds (90D needs 90 days, ALL
  // more than 90), which the board sentence does not.
  period: {
    label: 'Period for the charts',
    legend: 'Period',
    options: { '30d': '30D', '90d': '90D', all: 'ALL' } as Record<PeriodId, string>,
    driven: ['03', '04', '05'],
    caption: (driven: readonly string[]) =>
      `Sets ${list(driven)} below. The header, day equation, feed, records and status keep their own windows.`,
    shortNote: '90D and ALL are off: the history is shorter than 90 days.',
    allNote: 'ALL is off: common coverage is 90 days or fewer.',
  },

  drivers: {
    title: 'What moved the supply',
    headline: (period: PeriodId, step = 'day') =>
      period === 'all' ? `Flows per ${step}, common history` : `Flows per ${step}, last ${period === '90d' ? 90 : 30} days`,
    caption: (range: string, step = 'day') =>
      `${range}. Issuer mint and bridge in go up, issuer burn and bridge out go down; the gold line is each ${step}’s net.`,
    chain: 'Chain',
    allChains: 'All chains',
    allScale: 'all chains',
    // The second sentence is step-specific: a closed day for daily points, and for weekly and
    // monthly points the shaded incomplete bucket — but only when the period really has one.
    scaleView: (name: string, step = 'day', incomplete = false) => {
      const point = step === 'day' ? 'one closed day' : `one ${step}`;
      const shaded = incomplete && step !== 'day' ? `; the shaded ${step} is an incomplete period` : '';
      return `Scale: ${name}, USDC per ${step}. Every point is ${point}${shaded}.`;
    },
    echoBefore: 'Period',
    echoAfter: '· set above ↑',
    chart: (chain: string, bound: string, last: string, step = 'daily') =>
      `${chain}, ${step} flows on the view’s own ±${bound} scale. ${last}`,
    day: 'day',
    lastDay: (day: string, values: string) => `${day}: ${values}.`,
    fromTag: (day: string) => `from ${day}`,
    gapNote: (range: string) => `▨ no data · ${range} (incomplete buckets)`,
    unreconciledTag: (days: string) => `◇ ${days}`,
    unreconciledNote: (days: string) => `◇ ${days} · unreconciled day (dashed net segment)`,
    emptyNote: (days: string) => `0 · ${days} · closed, no events`,
    emptyDay: (step: string) => `0 · empty ${step}`, // the legend entry of a zero bucket: a day, week or month
    legend: 'Legend',
  },

  flows: {
    issuer_mint: 'issuer mint',
    issuer_burn: 'issuer burn',
    bridge_in: 'bridge in',
    bridge_out: 'bridge out',
    net: 'net',
  },

  issuerVsBridge: {
    title: 'Issuer vs bridge',
    headline: 'Who moved it: issuer or CCTP',
    caption: (range: string | null) =>
      `${range === null ? '' : `${range}. `}Share of issuer activity in each direction, by volume in USDC and by number of operations. Solid = issuer, hatched = bridge.`,
    scope: 'Scope',
    all: 'All chains',
    in: 'Inflow',
    out: 'Outflow',
    groupIn: 'Inflow · issuer mint + bridge in',
    groupOut: 'Outflow · issuer burn + bridge out',
    volume: 'By volume',
    count: 'By operations',
    cellKey: (side: string, basis: string) => `${side} · ${basis.toLowerCase()}`,
    issuer: 'issuer',
    bridge: 'bridge',
    separator: '·',
    operations: 'ops',
    shareOf: (percent: string) => `Issuer ${percent}`,
    shareUnknown: 'Issuer share unknown',
    flagDays: (days: string) => `◇ ${days}`,
    // A zero base: nothing moved in that direction in the period.
    noFlow: { in: 'no inflow in the period', out: 'no outflow in the period' },
  },

  feed: {
    label: 'Largest events, 7 days',
    title: (count: number) => (count === 0 ? 'The largest operations' : `The ${count} largest operations`),
    caption: (range: string | null) =>
      `${range === null ? '' : `${range}, `}all tracked chains, largest first. Times in UTC. Each row links to the transaction in the chain’s explorer.`,
    columns: { amount: 'Amount · USDC', chain: 'Chain', type: 'Type · route', time: 'Time (UTC)', link: 'Explorer' },
    types: {
      issuer_mint: 'issuer mint',
      issuer_burn: 'issuer burn',
      bridge_in: 'bridge in',
      bridge_out: 'bridge out',
      net: 'net change',
    },
    bridgeFrom: (peer: string) => `from ${peer}`,
    bridgeTo: (peer: string) => `to ${peer}`,
    outsideCctp: 'outside CCTP',
    cctp: (version: number) => `CCTP V${version}`,
    // The same words as texts.tags (the marks in the markup come from there).
    peerUnknown: 'peer unknown',
    unpaired: 'unpaired',
    explorer: 'View transaction ↗',
    // The order-of-magnitude marker: six steps, 10³ … 10⁸ and above.
    magnitude: ['10³', '10⁴', '10⁵', '10⁶', '10⁷', '10⁸'] as readonly string[],
    magnitudeAria: (label: string) => `Order of magnitude ${label}`,
    none: 'No events in the last 7 days.',
  },

  records: {
    label: 'Records',
    title: 'Highs since tracking began',
    caption: (since: string | null) => (since === null ? 'All chains.' : `All chains · since ${since}.`),
    kinds: {
      max_supply: 'Highest tracked supply',
      max_issuer_mint_day: 'Largest issuer mint day',
      max_issuer_burn_day: 'Largest issuer burn day',
      largest_event: 'Largest single operation',
    },
  },

  status: {
    label: 'Data status',
    title: 'Freshness and checks, per chain',
    caption: 'Each chain is collected and reconciled on its own. Checks refer to the chain’s last closed day.',
    columns: {
      chain: 'Chain',
      state: 'State',
      lastClosedDay: 'Last closed day',
      lastBlock: 'Last block',
      reconciliation: 'Checks',
      lastRun: 'Last run (UTC)',
      unreconciledDays: 'Mismatched days',
    },
    states: { ok: 'ok', delayed: 'Delayed', unreconciled: 'Unreconciled', no_data: 'No data' },
    noClosedDay: 'no closed day yet',
    checksOn: (day: string) => `Checks · ${day}`,
    checks: { supply: 'supply', bridge: 'bridge', continuity: 'continuity' },
    checkResults: { ok: 'ok', mismatch: 'mismatch' },
    checkMarks: { ok: '✓', mismatch: '✕', none: '—' },
    // The first day of a chain has no previous day to continue from: not a failure.
    firstDay: 'first day',
    supplyDiff: (diff: string) => `difference ${diff}`,
    runStatus: { ok: 'ok', partial: 'partial', failed: 'failed' },
    run: (time: string, status: string) => `${time} · ${status}`,
    toBlock: (block: string) => `to block ${block}`,
    none: 'none',
  },

  howWeCount: {
    marker: '///',
    label: 'How we count',
    title: 'What the numbers mean',
    // Step numbers are static copy: an outage page must carry no digits of its own.
    numbers: ['01', '02', '03', '04', '05'] as readonly string[],
    tracked:
      'Tracked supply is the sum of USDC totalSupply on the tracked chains at the last block of each closed UTC day. It is not all stablecoins and not every chain USDC lives on. Only native USDC is counted: bridged variants such as USDC.e are not included.',
    issuer:
      'Mints and burns made through the official CCTP contracts are bridge flows, each matched to its CCTP operation by amount and address; a CCTP event that cannot be matched stays a bridge flow, is marked unpaired and leaves operation counts incomplete. Mints and burns outside CCTP are issuer activity, labelled “issuer” rather than “new money”: a mint outside CCTP does not by itself prove fiat inflow.',
    reconciliation:
      'Each day is reconciled: the change in totalSupply must equal the sum of collected events, and bridge changes must match CCTP operations. Days that do not reconcile are marked, never hidden.',
    aggregators:
      'Figures can differ from aggregators such as DefiLlama or Circle’s own reports: they may cover other chains, use other cut-off times or define supply differently.',
    // since === null: the page is empty, the chains have no closed day in common yet.
    coverage: (chains: readonly string[], since: string | null) =>
      since === null
        ? `Chains: ${list(chains)}. Common history starts at the first day closed on every chain; the chains have no such day in common yet.`
        : `Chains: ${list(chains)}. History since ${since}, the first day closed on every chain.`,
  },

  disclaimer: {
    title: 'Disclaimer',
    body: 'Not financial advice. The data is provided as is, without warranty of completeness or accuracy.',
  },
} as const;
