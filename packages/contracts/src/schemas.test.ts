import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ChainStatus,
  EventRow,
  EventsPage,
  EventsStats,
  Kpi,
  Overview,
  Series,
  type SeriesLine,
} from './schemas.ts';

const issuePaths = (result: { error?: { issues: { path: PropertyKey[] }[] } }) =>
  (result.error?.issues ?? []).map((issue) => issue.path.join('.')).sort();

const quality = { complete: true, unreconciledDays: [], operationsComplete: true, unpairedEvents: 0 };
const missing = { complete: false, unreconciledDays: [], operationsComplete: false, unpairedEvents: 0 };
// Daily buckets ending on 2026-10-06, one per value.
const buckets = (count: number) =>
  Array.from({ length: count }, (_, i) => {
    const day = `2026-10-${String(7 - count + i).padStart(2, '0')}`;
    return { start: day, end: day, complete: true };
  });
const series = (unit: string, values: unknown[], line: Record<string, unknown> = {}) => ({
  period: 'day',
  buckets: buckets(values.length),
  unit,
  lines: [{ key: 'all', values, unreconciled: [], ...line }],
});

describe('Series: base ∩ union by unit', () => {
  it.each([
    ['count', [12, -3, null]],
    ['tokens', ['1000.5', '-3', null]],
    ['tokens', ['1000.123456', '1000']],
    ['percent', ['33.333333', null]],
    ['percentage_points', ['-1.5', '0']],
  ])('accepts unit=%s with %j', (unit, values) => {
    const input = series(unit, values);
    expect(Series.parse(input)).toStrictEqual(input);
  });

  it.each([
    ['count', ['12']],
    ['count', [1.5]],
    ['tokens', [12]],
    ['tokens', ['1.50']],
    ['percent', ['33.3333333']],
    ['percentage_points', [1]],
  ])('rejects unit=%s with %j', (unit, values) => {
    expect(Series.safeParse(series(unit, values)).success).toBe(false);
  });

  it.each(['usd', undefined])('rejects unit=%j', (unit) => {
    expect(Series.safeParse(series(unit as string, [])).success).toBe(false);
  });

  it('requires the base fields', () => {
    const noPeriod: Record<string, unknown> = series('count', [1]);
    delete noPeriod.period;
    expect(Series.safeParse(noPeriod).success).toBe(false);
    expect(Series.safeParse({ ...series('count', [1]), buckets: [{ start: '2026-02-30', end: '2026-03-01', complete: true }] }).success).toBe(false);
    expect(Series.safeParse(series('count', [1])).success).toBe(true);
  });

  it('keeps chain and flow optional and checks the flow', () => {
    expect(Series.safeParse(series('tokens', ['1'], { chain: 'base', flow: 'net' })).success).toBe(true);
    expect(Series.safeParse(series('tokens', ['1'], { flow: 'turnover' })).success).toBe(true);
    expect(Series.safeParse(series('tokens', ['1'], { flow: 'level' })).success).toBe(false);
  });

  it('has one value per bucket in every line', () => {
    const two = series('count', [1, 2]);
    expect(Series.safeParse({ ...two, lines: [...two.lines, { key: 'base', values: [1, 2], unreconciled: [] }] }).success).toBe(true);
    expect(
      issuePaths(Series.safeParse({ ...two, lines: [...two.lines, { key: 'base', values: [1], unreconciled: [] }] })),
    ).toEqual(['lines.1.values']);
    expect(issuePaths(Series.safeParse({ ...two, buckets: buckets(3) }))).toEqual(['lines.0.values']);
    expect(issuePaths(Series.safeParse({ ...two, buckets: [] }))).toEqual(['lines', 'lines.0.values']);
    expect(Series.safeParse({ period: 'day', buckets: [], unit: 'tokens', lines: [] }).success).toBe(true);
  });

  it.each([[[2]], [[1, 0]], [[0, 0]]])('rejects unreconciled=%j over two values', (unreconciled) => {
    expect(Series.safeParse(series('count', [1, 2], { unreconciled })).success).toBe(false);
  });

  it('types the lines by unit', () => {
    expectTypeOf<Extract<Series, { unit: 'count' }>['lines'][number]['values']>().toEqualTypeOf<(number | null)[]>();
    expectTypeOf<Extract<Series, { unit: 'percent' | 'percentage_points' }>['unit']>().toEqualTypeOf<
      'percent' | 'percentage_points'
    >();
    expectTypeOf<SeriesLine<string>['values']>().toEqualTypeOf<(string | null)[]>();
  });
});

describe('Kpi', () => {
  const kpi = { value: '100', changePct: null, spark: ['99', null, '100'], sparkUnreconciled: [0, 2], quality };

  it('accepts indices into spark', () => {
    expect(Kpi.safeParse(kpi).success).toBe(true);
  });

  it('rejects an index out of spark', () => {
    expect(Kpi.safeParse({ ...kpi, sparkUnreconciled: [3] }).success).toBe(false);
  });

  it('rejects a changePct with more than six decimals', () => {
    expect(Kpi.safeParse({ ...kpi, changePct: '0.1234567' }).success).toBe(false);
  });
});

const row = {
  id: 'ethereum:0xabc:12',
  chain: 'ethereum',
  flow: 'bridge_in',
  amount: '100',
  time: '2026-10-06T12:00:00Z',
  txHash: '0xabc',
  explorerUrl: 'https://etherscan.io/tx/0xabc',
  unreconciled: false,
  unpaired: false,
  bridge: { version: 2, peer: { domain: 6, chain: 'base', name: 'Base' } },
};

describe('EventRow', () => {
  it.each([
    {},
    { bridge: null, flow: 'issuer_mint' },
    { bridge: { version: 1, peer: null }, unpaired: true },
    { bridge: { version: 2, peer: { domain: 7, chain: null, name: 'Polygon PoS' } } },
  ])('accepts %j', (patch) => {
    expect(EventRow.safeParse({ ...row, ...patch }).success).toBe(true);
  });

  it.each([
    { explorerUrl: 'javascript:alert(1)' },
    { explorerUrl: 'etherscan.io/tx/0xabc' },
    { time: '2026-10-06T15:00:00+03:00' },
    { amount: '1e2' },
    { flow: 'net' },
    { bridge: { version: 3, peer: null } },
  ])('rejects %j', (patch) => {
    expect(EventRow.safeParse({ ...row, ...patch }).success).toBe(false);
  });
});

describe('EventsPage and EventsStats', () => {
  const page = { from: '2026-09-30', to: '2026-10-06', quality, items: [row], nextCursor: 'eyJrIjoxfQ' };
  const bucket = (min: string, max: string | null) => ({ min, max, ops: 1, amount: min });
  const fiveBuckets = [
    bucket('0', '10000'),
    bucket('10000', '100000'),
    bucket('100000', '1000000'),
    bucket('1000000', '10000000'),
    bucket('10000000', null),
  ];
  const stats = {
    from: '2026-09-30',
    to: '2026-10-06',
    quality,
    byFlow: [{ flow: 'issuer_mint', events: 3, ops: 3, amount: '30', mean: '10' }],
    buckets: fiveBuckets,
  };

  it('pages with a cursor', () => {
    expect(EventsPage.safeParse(page).success).toBe(true);
    expect(EventsPage.safeParse({ ...page, nextCursor: null }).success).toBe(true);
  });

  it('accepts a day range without events', () => {
    expect(EventsPage.safeParse({ ...page, items: [] }).success).toBe(true);
  });

  it.each([
    ['one bound', { ...page, to: null }, 'to'],
    ['from after to', { ...page, from: '2026-10-07' }, 'from'],
    ['items without a day range', { ...page, from: null, to: null, quality: missing, nextCursor: null }, 'items'],
  ])('rejects a page with %s', (_, value, path) => {
    expect(issuePaths(EventsPage.safeParse(value))).toEqual([path]);
  });

  it('accepts the empty answer without coverage', () => {
    const empty = { from: null, to: null, quality: missing, byFlow: [], buckets: [] };
    expect(EventsStats.safeParse(empty).success).toBe(true);
    expect(EventsPage.safeParse({ from: null, to: null, quality: missing, items: [], nextCursor: null }).success).toBe(true);
  });

  it('accepts five buckets with unknown aggregates', () => {
    const unknown = fiveBuckets.map((b) => ({ ...b, ops: null, amount: null }));
    expect(EventsStats.safeParse({ ...stats, quality: { ...quality, operationsComplete: false, unpairedEvents: 1 }, buckets: unknown }).success).toBe(true);
  });

  it.each([0, 1, 3, 4, 6])('rejects %i buckets with a day range', (count) => {
    const list = Array.from({ length: count }, (_, i) => fiveBuckets[i % 5]);
    expect(issuePaths(EventsStats.safeParse({ ...stats, buckets: list }))).toEqual(['buckets']);
  });

  it.each([
    ['five buckets', { buckets: fiveBuckets }, 'buckets'],
    ['flows', { byFlow: stats.byFlow }, 'byFlow'],
  ])('rejects %s without a day range', (_, patch, path) => {
    const empty = { from: null, to: null, quality: missing, byFlow: [], buckets: [] };
    expect(issuePaths(EventsStats.safeParse({ ...empty, ...patch }))).toEqual([path]);
  });

  it.each([
    ['one bound', { from: null }, 'to'],
    ['from after to', { from: '2026-10-07' }, 'from'],
  ])('rejects %s', (_, patch, path) => {
    expect(issuePaths(EventsStats.safeParse({ ...stats, ...patch }))).toEqual([path]);
  });

  it('rejects negative and fractional counters', () => {
    expect(EventsStats.safeParse({ ...stats, byFlow: [{ ...stats.byFlow[0], ops: -1 }] }).success).toBe(false);
    expect(EventsStats.safeParse({ ...stats, byFlow: [{ ...stats.byFlow[0], events: 1.5 }] }).success).toBe(false);
  });
});

describe('ChainStatus', () => {
  const status = {
    chain: 'ethereum',
    state: 'delayed',
    historyStart: '2025-10-06',
    lastClosedDay: '2026-10-05',
    lastBlock: '23500000',
    nextDueAt: '2026-10-07T06:00:00Z',
    lagHours: 30,
    lastRun: { finishedAt: '2026-10-06T01:00:00Z', status: 'failed', toBlock: '23500100' },
    reconciliation: { day: '2026-10-05', supply: 'ok', supplyDiff: '0', bridge: 'mismatch', continuity: 'none' },
    unreconciledDays: ['2026-10-05'],
  };

  it('accepts a chain with data and one without', () => {
    expect(ChainStatus.safeParse(status).success).toBe(true);
    const noData = {
      ...status,
      state: 'no_data',
      historyStart: null,
      lastClosedDay: null,
      lastBlock: null,
      nextDueAt: null,
      lagHours: null,
      lastRun: null,
      reconciliation: null,
      unreconciledDays: [],
    };
    expect(ChainStatus.safeParse(noData).success).toBe(true);
  });

  it.each([{ lastBlock: 23500000 }, { lastBlock: '0x166a6a0' }, { state: 'stale' }, { lastRun: { ...status.lastRun, status: 'running' } }])(
    'rejects %j',
    (patch) => {
      expect(ChainStatus.safeParse({ ...status, ...patch }).success).toBe(false);
    },
  );
});

describe('Overview empty state', () => {
  it('keeps status and returns no public views or day equation without coverage', async () => {
    const { emptyOverview } = await import('./schemas.invariants.fixtures.ts');
    expect(Overview.parse(emptyOverview)).toStrictEqual(emptyOverview);
  });
});
