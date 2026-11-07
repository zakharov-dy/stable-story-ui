// Every visible and accessible label belongs here.
import type { PeriodId } from '@app/view';

export const texts = {
  productName: 'Stable Story',
  tagline: 'The supply of USDC, accounted for.',
  meta: {
    title: 'Stable Story · USDC supply history',
    description:
      'Tracked USDC supply by chain, split into issuer and CCTP bridge flows, from closed UTC days.',
  },
  noData: 'no data',
  axis: { zero: '0', halfShare: '50%' },
  minus: '−',
  plus: '+',
  percent: '%',
  utc: 'UTC',
  months: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ],
  dayRange: (from: string, to: string) => `${from} – ${to}`,
  assetNames: { usdc: 'USDC' } as Record<string, string>,
  asOf: (day: string) => `Through ${day}`,
  demo: (state: string) =>
    `Demo data (mock state “${state}”): synthetic numbers and transactions, not real on-chain activity.`,
  states: {
    empty: 'No closed day yet',
    emptyBody:
      'Figures appear after the first UTC day closes on the tracked chains.',
    unavailable: 'Data unavailable',
    unavailableBody:
      'We could not load the published figures, so this page shows none rather than stale ones.',
    reload: 'Reload',
  },
  tags: {
    unreconciledDay: '◇ unreconciled day',
    unpaired: 'unpaired',
    peerUnknown: 'peer unknown',
    noData: 'no data',
    behind: (chain: string, hours: string) => `${chain} · ${hours} h behind`,
    behindShort: (hours: string) => `${hours} h behind`,
    behindLabel: (hours: string) => `${hours} h`,
    chainUnreconciled: (chain: string, day: string) =>
      `◇ ${chain} · ${day} unreconciled`,
  },
  na: {
    label: 'n/a',
    reasons: {
      noDataForRange: 'no data for the range',
      operationsIncomplete: 'operation counts incomplete',
    },
    history: {
      needs: (day: string, start: string) =>
        `needs ${day}, before history starts (${start})`,
      before: (range: string) => `${range} is before history starts`,
    },
  },
  header: {
    cards: { supply: 'Tracked supply' },
    today: (value: string) => `${value} today`,
    week: (value: string) => `${value} over 7 days`,
    waterfall: (day: string) => `${day} · all tracked chains`,
    marker: '///',
    reconciled: (count: string, total: string) =>
      `${count}/${total} reconciled`,
    stamp: (count: string, total: string, mismatched: string, closed: string) =>
      `${count}/${total} chains · ${mismatched} mismatched ${mismatched === '1' ? 'day' : 'days'} · ${closed} chain-days closed`,
    failed: (chain: string, day: string, checks: string) =>
      `◇ ${chain} · ${day} unreconciled: ${checks}`,
  },
  resolution: {
    units: { day: 'day', week: 'week', month: 'month' } as Record<
      string,
      string
    >,
    steps: { day: 'daily', week: 'weekly', month: 'monthly' } as Record<
      string,
      string
    >,
    partial: '',
    flagged: 'includes an unreconciled day',
    sentence: 'Older periods are shown by week (90D) and by month (ALL).',
    levelEnd: (step: string) => `level at ${step} end`,
    flowSum: (step: string, scope: string) => `sum per ${step}, ${scope}`,
    closeTooltip: 'Close tooltip',
    closeMark: '×',
  },
  supplyByChain: {
    title: 'Tracked supply by chain',
    level: 'Level',
    share: 'Share',
    shareTotal: '100%',
    endOfDay: 'end of day',
    gapNote: (range: string) => `no data · ${range}`,
    peak: (value: string, day: string) => `Peak ${value} · ${day}`,
    chain: 'Chain',
  },
  period: {
    legend: 'Period',
    options: { '30d': '30D', '90d': '90D', all: 'ALL' } as Record<
      PeriodId,
      string
    >,
    shortNote: '90D and ALL are off: the history is shorter than 90 days.',
    allNote: (day: string) =>
      `ALL is off: history starts ${day}, no longer than 90D.`,
  },
  drivers: {
    title: 'What moved it',
    allChains: 'All chains',
    all: 'All',
    gapNote: (range: string) => `no data · ${range}`,
    chart: (scope: string, step: string) => `${scope}, ${step} flows`,
    shares: (inflow: string, outflow: string) =>
      `issuer ${inflow} of inflow · ${outflow} of outflow`,
    week: (minted: string, burned: string) =>
      `Issuer minted ${minted} · burned ${burned}, 7 days`,
    shortNames: {
      optimism: 'OP',
      polygon: 'Polygon',
      avalanche: 'Avalanche',
    } as Record<string, string>,
  },
  flows: {
    issuer_mint: 'issuer mint',
    issuer_burn: 'issuer burn',
    bridge_in: 'bridge in',
    bridge_out: 'bridge out',
    net: 'net',
  },
  flowsShort: {
    issuer_mint: 'mint',
    issuer_burn: 'burn',
    bridge_in: 'in',
    bridge_out: 'out',
    net: 'net',
  },
  flowGroups: { issuer: 'issuer', bridge: 'cctp bridge' },
  issuerVsBridge: {
    noFlow: { in: 'no inflow in the period', out: 'no outflow in the period' },
  },
  feed: {
    title: 'Largest operations',
    window: (range: string) => `7 days · ${range}`,
    showAll: (count: number) => `Show all ${count}`,
    version: (version: number) => `V${version}`,
    none: 'No events in the last 7 days.',
    link: '↗',
    in: '←',
    out: '→',
  },
  records: {
    title: 'Records',
    since: (day: string) => `since ${day}`,
    kinds: {
      max_supply: 'Peak supply',
      max_issuer_mint_day: 'Largest mint day',
      max_issuer_burn_day: 'Largest burn day',
      largest_event: 'Largest operation',
    },
  },
  status: {
    title: 'Status',
    asOf: (day: string) => `as of ${day}`,
    closedLine: (day: string, checks: string) => `Last closed ${day} · ${checks}`,
    runLine: (run: string, mismatched: string) => `Last run ${run} · ${mismatched}`,
    mismatchedShort: (count: string) => `${count} mismatched`,
    columns: {
      chain: 'Chain',
      state: 'State',
      lastClosedDay: 'Last closed day',
      reconciliation: 'Checks',
      lastRun: 'Last run',
      unreconciledDays: 'Mismatched days',
    },
    states: {
      ok: 'ok',
      delayed: 'Delayed',
      unreconciled: 'Unreconciled',
      no_data: 'No data',
    },
    checks: { supply: 'supply', bridge: 'bridge', continuity: 'continuity' },
    failure: (check: string) => `${check} check failed`,
    checkMarks: { ok: '✓', mismatch: '✕', none: '—' },
    unreconciled: '◇',
    run: (time: string, state: string) => `${time} · ${state}`,
    none: 'none',
    label: (chain: string, state: string) => `${chain} · ${state}`,
  },
  howWeCount: {
    title: 'How we count',
    body: 'Tracked supply is USDC totalSupply on six chains at the end of each UTC day. Mints and burns outside CCTP are issuer activity; CCTP mints and burns are bridge flows. Every day is reconciled, and a day that fails is marked, never hidden.',
    bridge:
      'CCTP moves USDC between chains; transfers to and from chains we do not track change the tracked total.',
  },
  disclaimer: { body: 'Not financial advice. Data as is, without warranty.' },
  quality: {
    incomplete: 'Some days in this range are missing or not closed.',
  },
} as const;
