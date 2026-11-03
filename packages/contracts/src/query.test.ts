import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Flow } from './primitives.ts';
import {
  EventsQuery,
  EventsStatsQuery,
  OverviewQuery,
  SERIES_METRICS,
  SeriesBasis,
  SeriesGroupBy,
  SeriesQuery,
  SeriesTransform,
} from './query.ts';

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  (result.error?.issues ?? []).map((issue) => issue.path.join('.')).sort();

describe('defaults', () => {
  it('overview', () => {
    expect(OverviewQuery.parse({})).toStrictEqual({ asset: 'usdc' });
  });

  it('series', () => {
    expect(SeriesQuery.parse({})).toStrictEqual({
      asset: 'usdc',
      metric: 'level',
      basis: 'volume',
      transform: 'none',
      chains: [],
      groupBy: 'none',
      period: 'day',
    });
  });

  it('events', () => {
    expect(EventsQuery.parse({})).toStrictEqual({ asset: 'usdc', chains: [], flows: [], sort: 'amount', limit: 20 });
  });

  it('events/stats', () => {
    expect(EventsStatsQuery.parse({})).toStrictEqual({ asset: 'usdc', chains: [], flows: [] });
  });

  it('outputs typed lists', () => {
    expectTypeOf(SeriesQuery.parse({}).chains).toEqualTypeOf<string[]>();
    expectTypeOf(EventsQuery.parse({}).flows).toEqualTypeOf<Flow[]>();
    expectTypeOf(EventsQuery.parse({}).limit).toEqualTypeOf<number>();
  });
});

describe('asset and chains are strings: the server answers 404 and 400 by the registry', () => {
  it('passes an unknown asset and chain through', () => {
    expect(EventsQuery.parse({ asset: 'usdt', chains: 'solana' })).toMatchObject({ asset: 'usdt', chains: ['solana'] });
  });

  it('rejects an empty asset', () => {
    expect(issuePaths(OverviewQuery.safeParse({ asset: '' }))).toEqual(['asset']);
  });
});

describe('lists', () => {
  it('splits by comma and keeps the order', () => {
    expect(SeriesQuery.parse({ chains: 'base,ethereum' }).chains).toEqual(['base', 'ethereum']);
  });

  it('removes duplicates', () => {
    expect(EventsQuery.parse({ chains: 'ethereum,base,ethereum', flows: 'bridge_in,issuer_mint,bridge_in' })).toMatchObject({
      chains: ['ethereum', 'base'],
      flows: ['bridge_in', 'issuer_mint'],
    });
  });

  it('treats an empty parameter as all', () => {
    expect(EventsStatsQuery.parse({ chains: '', flows: '' })).toMatchObject({ chains: [], flows: [] });
  });

  it.each(['ethereum,,base', ',ethereum', 'ethereum,', ','])('rejects empty items in %j', (chains) => {
    expect(issuePaths(EventsQuery.safeParse({ chains }))[0]).toMatch(/^chains/);
  });

  it.each(['transfer', 'Bridge_in', 'bridge_in,net'])('rejects the unknown flow in %j', (flows) => {
    expect(issuePaths(EventsQuery.safeParse({ flows }))[0]).toMatch(/^flows/);
  });

  it('rejects a repeated parameter (an array): lists are comma-separated', () => {
    expect(EventsQuery.safeParse({ chains: ['ethereum', 'base'] }).success).toBe(false);
  });
});

describe('events: sort, limit, cursor', () => {
  it('accepts sort=time', () => {
    expect(EventsQuery.parse({ sort: 'time' }).sort).toBe('time');
  });

  it('rejects an unknown sort', () => {
    expect(issuePaths(EventsQuery.safeParse({ sort: 'size' }))).toEqual(['sort']);
  });

  it.each([
    ['1', 1],
    ['20', 20],
    ['100', 100],
  ])('parses limit=%s', (limit, expected) => {
    expect(EventsQuery.parse({ limit }).limit).toBe(expected);
  });

  it.each(['0', '101', '-1', '1.5', '01', '1e1', ' 5', 'abc', ''])('rejects limit=%j', (limit) => {
    expect(issuePaths(EventsQuery.safeParse({ limit }))).toEqual(['limit']);
  });

  it('passes the cursor through as an opaque string', () => {
    expect(EventsQuery.parse({ cursor: 'eyJrIjpbIjEwMCJdfQ' }).cursor).toBe('eyJrIjpbIjEwMCJdfQ');
  });

  it('rejects an empty cursor', () => {
    expect(issuePaths(EventsQuery.safeParse({ cursor: '' }))).toEqual(['cursor']);
  });
});

describe('dates', () => {
  const schemas = { series: SeriesQuery, events: EventsQuery, 'events/stats': EventsStatsQuery };

  it.each(Object.entries(schemas))('%s: accepts from ≤ to and a single bound', (_, schema) => {
    expect(schema.safeParse({ from: '2026-10-01', to: '2026-10-06' }).success).toBe(true);
    expect(schema.safeParse({ from: '2026-10-06', to: '2026-10-06' }).success).toBe(true);
    expect(schema.safeParse({ from: '2026-10-06' }).success).toBe(true);
    expect(schema.safeParse({ to: '2026-10-06' }).success).toBe(true);
  });

  it.each(Object.entries(schemas))('%s: rejects from > to', (_, schema) => {
    expect(issuePaths(schema.safeParse({ from: '2026-10-07', to: '2026-10-06' }))).toEqual(['from']);
  });

  it.each(Object.entries(schemas))('%s: rejects a non-calendar date', (_, schema) => {
    expect(issuePaths(schema.safeParse({ to: '2025-02-29' }))).toEqual(['to']);
  });
});

describe('series combinations', () => {
  // The rules written out per metric: allowed transforms, basis=count, groupBy=flow.
  const ALL = SeriesTransform.options;
  const SHARE_TRANSFORMS = ['none', 'change', 'change_pct'];
  const FLOW = { transforms: ALL, count: true, groupByFlow: false };
  const SPEC: Record<(typeof SERIES_METRICS)[number], { transforms: readonly string[]; count: boolean; groupByFlow: boolean }> = {
    level: { transforms: ['none', 'change', 'change_pct', 'rolling_7d', 'rolling_30d'], count: false, groupByFlow: false },
    share: { transforms: SHARE_TRANSFORMS, count: false, groupByFlow: false },
    issuer_mint: FLOW,
    issuer_burn: FLOW,
    bridge_in: FLOW,
    bridge_out: FLOW,
    net_change: { transforms: ALL, count: true, groupByFlow: true },
    turnover: { transforms: ALL, count: true, groupByFlow: true },
    issuer_share_in: { transforms: SHARE_TRANSFORMS, count: true, groupByFlow: false },
    issuer_share_out: { transforms: SHARE_TRANSFORMS, count: true, groupByFlow: false },
  };

  it('accepts exactly the allowed combinations and names the broken rule', () => {
    const mismatches: string[] = [];
    let allowed = 0;
    for (const metric of SERIES_METRICS) {
      for (const basis of SeriesBasis.options) {
        for (const transform of SeriesTransform.options) {
          for (const groupBy of SeriesGroupBy.options) {
            const spec = SPEC[metric];
            const expected = [
              ...(basis === 'count' && !spec.count ? ['basis'] : []),
              ...(groupBy === 'flow' && !spec.groupByFlow ? ['groupBy'] : []),
              ...(spec.transforms.includes(transform) ? [] : ['transform']),
            ].sort();
            const actual = issuePaths(SeriesQuery.safeParse({ metric, basis, transform, groupBy }));
            if (expected.length === 0) allowed++;
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
              mismatches.push(`${metric}/${basis}/${transform}/${groupBy}: ${actual.join(',')} ≠ ${expected.join(',')}`);
            }
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(allowed).toBe(208); // guards the oracle against accepting everything
  });

  it.each([
    [{ metric: 'level', basis: 'count' }, 'basis'],
    [{ metric: 'share', basis: 'count' }, 'basis'],
    [{ metric: 'share', transform: 'rolling_7d' }, 'transform'],
    [{ metric: 'issuer_share_out', transform: 'cumulative' }, 'transform'],
    [{ metric: 'level', transform: 'cumulative' }, 'transform'],
    [{ metric: 'level', groupBy: 'flow' }, 'groupBy'],
    [{ metric: 'issuer_mint', groupBy: 'flow' }, 'groupBy'],
  ])('rejects %j', (query, path) => {
    expect(issuePaths(SeriesQuery.safeParse(query))).toEqual([path]);
  });

  it.each([
    { metric: 'issuer_share_in', basis: 'count' },
    { metric: 'bridge_in', basis: 'count' },
    { metric: 'issuer_mint', transform: 'cumulative' },
    { metric: 'level', transform: 'rolling_30d' },
    { metric: 'share', transform: 'change_pct' },
    { metric: 'net_change', groupBy: 'flow', transform: 'rolling_7d' },
    { metric: 'turnover', groupBy: 'flow', basis: 'count' },
    { metric: 'level', groupBy: 'chain', period: 'quarter' },
  ])('accepts %j', (query) => {
    expect(SeriesQuery.safeParse(query).success).toBe(true);
  });

  it.each([{ metric: 'supply' }, { basis: 'ops' }, { transform: 'rolling_14d' }, { groupBy: 'asset' }, { period: 'hour' }])(
    'rejects the unknown value %j',
    (query) => {
      expect(SeriesQuery.safeParse(query).success).toBe(false);
    },
  );
});

it('drops unknown parameters', () => {
  expect(SeriesQuery.parse({ cursor: 'x', chain: 'base' })).not.toHaveProperty('cursor');
  expect(SeriesQuery.parse({ cursor: 'x', chain: 'base' })).not.toHaveProperty('chain');
});
