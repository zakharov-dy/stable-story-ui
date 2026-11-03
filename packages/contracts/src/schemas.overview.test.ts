import { describe, expect, it } from 'vitest';
import { Overview } from './schemas.ts';
import type { Overview as Document } from './schemas.ts';
import long from '../fixtures/long-history/overview.json' with { type: 'json' };
import { covered, coveredOverview, emptyOverview } from './schemas.invariants.fixtures.ts';

// Expected paths are independent of schema traversal; preserve duplicate issues as well.
// The long-history fixture has five supply panels, seven driver scopes and six chains.
const panels = ['level', 'share', 'total', 'stackedLevel', 'stackedShare'];
const scopes = [0, 1, 2, 3, 4, 5, 6];
const chains = [0, 1, 2, 3, 4, 5];
const days = Array.from({ length: 30 }, (_, i) => i);
const fullWeeks = [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const supplyPaths = (window: string, suffix: string, names = panels): string[] =>
  names.map((name) => `views.${window}.supplyByChain.${name}.${suffix}`);
const driverPaths = (window: string, suffix: string, indices = scopes): string[] =>
  indices.map((i) => `views.${window}.drivers.${i}.series.${suffix}`);
const bucketPaths = (window: string): string[] => [
  ...supplyPaths(window, 'buckets'), ...driverPaths(window, 'buckets'),
];
const valuePaths = (names: string[], lines: number[], buckets: number[]): string[] =>
  names.flatMap((name) => lines.flatMap((line) =>
    buckets.map((bucket) => `views.30d.supplyByChain.${name}.lines.${line}.values.${bucket}`)));

describe('Overview public view invariants', () => {
  it('accepts the views, both cut weeks, scoped gaps, and absent coverage', () => {
    for (const input of [long, coveredOverview, emptyOverview]) {
      const result = Overview.safeParse(input);
      expect(result.success, result.error?.message).toBe(true);
    }
  });
  it.each([
    { path: 'views.30d.from', paths: ['views.30d.from', ...bucketPaths('30d')], mutate: (d: Document) => { d.views['30d']!.from = '2027-02-15'; } },
    { path: 'views.90d.from', paths: ['views.90d.from', ...bucketPaths('90d')], mutate: (d: Document) => { d.views['90d']!.from = '2026-12-14'; } },
    { path: 'views.all.from', paths: ['views.all.from', ...bucketPaths('all')], mutate: (d: Document) => { d.views.all!.from = '2026-11-01'; } },
    { path: 'views.all.to', paths: ['views.all.to', ...bucketPaths('all')], mutate: (d: Document) => { d.views.all!.to = '2027-03-14'; } },
    { path: 'views.90d.period', paths: [
        'views.90d.period',
        ...supplyPaths('90d', 'period'), ...driverPaths('90d', 'period'),
        ...fullWeeks.flatMap(() => bucketPaths('90d')),
        ...driverPaths('90d', 'buckets', [1, 3, 4, 5, 6]),
        ...fullWeeks.flatMap((week) => [
          `views.90d.supplyByChain.level.buckets.${week}.complete`,
          ...driverPaths('90d', `buckets.${week}.complete`),
        ]),
        ...driverPaths('90d', 'buckets.3.complete', [1, 3, 4, 5, 6]),
      ], mutate: (d: Document) => { d.views['90d']!.period = 'day'; } },
    { path: 'views.all.supplyByChain.level.period', paths: ['views.all.supplyByChain.level.period'], mutate: (d: Document) => { d.views.all!.supplyByChain.level.period = 'week'; } },
    { path: 'views.30d.supplyByChain.level.unit', paths: ['views.30d.supplyByChain.level.unit'], mutate: (d: Document) => { d.views['30d']!.supplyByChain.level.unit = 'percent'; } },
    { path: 'views.30d', paths: ['views.30d'], mutate: (d: Document) => { d.views['30d'] = null; } },
    { path: 'views.90d.supplyByChain.level.buckets', paths: bucketPaths('90d'), mutate: (d: Document) => { d.views['90d']!.supplyByChain.level.buckets[0].end = '2026-12-21'; } },
    { path: 'views.all.supplyByChain.level.buckets', paths: [
        ...bucketPaths('all'), 'views.all.supplyByChain.level.buckets',
        'views.all.supplyByChain.level.buckets.1.complete',
        ...driverPaths('all', 'buckets.1.complete'),
      ], mutate: (d: Document) => { d.views.all!.supplyByChain.level.buckets[1].start = '2026-12-02'; } },
    { path: 'views.30d.supplyByChain.level.buckets', paths: bucketPaths('30d'), mutate: (d: Document) => { d.views['30d']!.supplyByChain.level.buckets.reverse(); } },
    { path: 'views.90d.supplyByChain.level.buckets', paths: [
        ...supplyPaths('90d', 'buckets'),
        'views.90d.supplyByChain.level.buckets.0.complete',
      ], mutate: (d: Document) => { d.views['90d']!.supplyByChain.level.buckets[0].complete = true; } },
    { path: 'views.30d.supplyByChain.level.lines', paths: [
        'views.30d.supplyByChain.level.lines',
        ...valuePaths(['total'], [0], days),
        ...valuePaths(['share', 'stackedShare'], [0, 1, 2, 3, 4], days),
      ], mutate: (d: Document) => { d.views['30d']!.supplyByChain.level.lines.pop(); } },
    { path: 'views.30d.supplyByChain.share.lines', paths: ['views.30d.supplyByChain.share.lines', ...valuePaths(['share'], chains, days)], mutate: (d: Document) => { d.views['30d']!.supplyByChain.share.lines.reverse(); } },
    { path: 'views.30d.supplyByChain.level.lines.0', paths: ['views.30d.supplyByChain.level.lines.0'], mutate: (d: Document) => { d.views['30d']!.supplyByChain.level.lines[0].chain = 'foreign'; } },
    { path: 'views.30d.supplyByChain.total.lines', paths: ['views.30d.supplyByChain.total.lines', 'views.30d.supplyByChain.total.lines.0'], mutate: (d: Document) => { d.views['30d']!.supplyByChain.total.lines[0].key = 'ethereum'; } },
    { path: 'views.30d.supplyByChain.total.lines.0.values.0', paths: ['views.30d.supplyByChain.total.lines.0.values.0'], mutate: (d: Document) => { d.views['30d']!.supplyByChain.total.lines[0].values[0] = '1'; } },
    { path: 'views.30d.supplyByChain.level.lines.0.values.0', paths: [
        ...valuePaths(['total', 'level'], [0], [0]),
        ...valuePaths(['share', 'stackedLevel'], chains, [0]),
        ...valuePaths(['stackedShare'], [0, 1, 2, 3, 4], [0]),
      ], mutate: (d: Document) => { d.views['30d']!.supplyByChain.level.lines[0].values[0] = '-1'; } },
    { path: 'views.30d.supplyByChain.share.lines.0.values.0', paths: ['views.30d.supplyByChain.share.lines.0.values.0'], mutate: (d: Document) => { d.views['30d']!.supplyByChain.share.lines[0].values[0] = null; } },
    { path: 'views.30d.supplyByChain.stackedLevel.lines.1.values.0', paths: ['views.30d.supplyByChain.stackedLevel.lines.1.values.0'], mutate: (d: Document) => { d.views['30d']!.supplyByChain.stackedLevel.lines[1].values[0] = '1'; } },
    { path: 'views.30d.supplyByChain.stackedShare.lines.1.values.0', paths: ['views.30d.supplyByChain.stackedShare.lines.1.values.0'], mutate: (d: Document) => { d.views['30d']!.supplyByChain.stackedShare.lines[1].values[0] = '1'; } },
    { path: 'views.30d.supplyByChain.level.lines.0.values', paths: [
        'views.30d.supplyByChain.level.lines.0.values',
        ...valuePaths(['total'], [0], [29]),
        ...valuePaths(['share', 'stackedLevel', 'stackedShare'], chains, [29]),
      ], mutate: (d: Document) => { d.views['30d']!.supplyByChain.level.lines[0].values.pop(); } },
    { path: 'views.30d.drivers', paths: ['views.30d.drivers'], mutate: (d: Document) => { d.views['30d']!.drivers.reverse(); } },
    { path: 'views.30d.drivers.0.series.buckets', paths: Array<string>(3).fill('views.30d.drivers.0.series.buckets'), mutate: (d: Document) => { d.views['30d']!.drivers[0].series.buckets[0].end = '2027-02-16'; } },
    { path: 'views.30d.drivers.0.series.lines.4.values.0', paths: Array<string>(2).fill('views.30d.drivers.0.series.lines.4.values.0'), mutate: (d: Document) => { d.views['30d']!.drivers[0].series.lines[4].values[0] = '0'; } },
    { path: 'views.30d.drivers.0.series.lines.0.values.0', paths: [
        'views.30d.drivers.0.series.lines.4.values.0',
        'views.30d.drivers.0.series.lines.0.values.0',
        'views.30d.drivers.0.series.lines.0.values.0',
        'views.30d.issuerVsBridge.0.in.volume.issuer',
      ], mutate: (d: Document) => { d.views['30d']!.drivers[0].series.lines[0].values[0] = '-1'; } },
    { path: 'views.all.issuerVsBridge', paths: ['views.all.issuerVsBridge'], mutate: (d: Document) => { d.views.all!.issuerVsBridge.pop(); } },
    { path: 'views.90d.drivers.1.series.lines.0.unreconciled', paths: ['views.90d.drivers.1.series.lines.0.unreconciled'], mutate: (d: Document) => { d.views['90d']!.drivers[1].series.lines[0].unreconciled = []; } },
    { path: 'views.90d.supplyByChain.level.lines.0.unreconciled', paths: ['views.90d.supplyByChain.level.lines.0.unreconciled'], mutate: (d: Document) => { d.views['90d']!.supplyByChain.level.lines[0].unreconciled = []; } },
    { path: 'views.90d.supplyByChain.share.lines.1.unreconciled', paths: ['views.90d.supplyByChain.share.lines.1.unreconciled'], mutate: (d: Document) => { d.views['90d']!.supplyByChain.share.lines[1].unreconciled = []; } },
    { path: 'views.90d.issuerVsBridge.1.in.quality.unreconciledDays', paths: ['views.90d.issuerVsBridge.1.in.quality.unreconciledDays'], mutate: (d: Document) => { d.views['90d']!.issuerVsBridge[1].in.quality.unreconciledDays = []; } },
    { path: 'day', paths: ['day'], mutate: (d: Document) => { d.day = null; } },
    { path: 'day.date', paths: ['day.date'], mutate: (d: Document) => { d.day!.date = '2027-03-14'; } },
    { path: 'day.rows', paths: ['day.rows'], mutate: (d: Document) => { d.day!.rows.reverse(); } },
    { path: 'day.rows.1.values.net', paths: ['day.rows.1.values.net'], mutate: (d: Document) => { d.day!.rows[1].values.net = '0'; } },
    { path: 'day.rows.1.events', paths: ['day.rows.1.events'], mutate: (d: Document) => { d.day!.rows[1].events = null; } },
    { path: 'day.rows.1.unreconciled', paths: ['day.rows.1.unreconciled'], mutate: (d: Document) => { d.day!.rows[1].unreconciled = true; } },
    { path: 'views.30d.drivers.0.series.lines.0', paths: ['views.30d.drivers.0.series.lines.0'], mutate: (d: Document) => { d.views['30d']!.drivers[0].series.lines[0].chain = 'ethereum'; } },
    { path: 'views.30d.drivers.0.series.buckets.0.complete', paths: ['views.30d.drivers.0.series.buckets.0.complete'], mutate: (d: Document) => { d.views['30d']!.drivers[0].series.buckets[0].complete = false; } },
    { path: 'views.all.supplyByChain.level.buckets.2.complete', paths: [
        ...supplyPaths('all', 'buckets', ['share', 'total', 'stackedLevel', 'stackedShare']),
        'views.all.supplyByChain.level.buckets.2.complete',
        'views.all.supplyByChain.level.buckets.2.complete',
      ], mutate: (d: Document) => { d.views.all!.supplyByChain.level.buckets[2].complete = true; } },
    { path: 'views.90d.supplyByChain.share.buckets', paths: [
        ...chains.map((i) => `views.90d.supplyByChain.share.lines.${i}.values`),
        'views.90d.supplyByChain.share.buckets', 'views.90d.supplyByChain.share.buckets',
      ], mutate: (d: Document) => { d.views['90d']!.supplyByChain.share.buckets.pop(); } },
    { path: 'views.30d.drivers.0.events.0', paths: ['views.30d.drivers.0.events.0'], mutate: (d: Document) => { d.views['30d']!.drivers[0].events[0] = 1; } },
    { path: 'views.30d.issuerVsBridge.1.in.volume.issuer', paths: ['views.30d.issuerVsBridge.1.in.volume.issuer'], mutate: (d: Document) => { d.views['30d']!.issuerVsBridge[1].in.volume.issuer = '0'; } },
  ])('reports $path', ({ mutate, path, paths }) => {
    const input = structuredClone(long) as Document;
    mutate(input);
    const result = Overview.safeParse(input);
    expect(result.success, path).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.')).sort(), path).toEqual([...paths].sort());
  });
  it('distinguishes a zero denominator from a gap', () => {
    const input = structuredClone(long) as Document;
    const supply = input.views['30d']!.supplyByChain;
    for (const name of ['level', 'total', 'stackedLevel'] as const) for (const line of supply[name].lines) line.values[0] = '0';
    for (const name of ['share', 'stackedShare'] as const) for (const line of supply[name].lines) line.values[0] = null;
    expect(Overview.safeParse(input).success).toBe(true);
    supply.share.lines[0].values[0] = '0';
    const result = Overview.safeParse(input);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('views.30d.supplyByChain.share.lines.0.values.0');
  });
  it('rounds cumulative ratios once, and preserves token precision beyond six decimals', () => {
    const thirds = covered(['ethereum', 'base', 'arbitrum']);
    expect(Overview.safeParse(thirds).success).toBe(true);
    expect(thirds.views['30d'].supplyByChain.stackedShare.lines[1]?.values.at(-1)).toBe('66.666667');
    const exact = structuredClone(coveredOverview);
    for (const name of ['level', 'total', 'stackedLevel'] as const) exact.views['30d'].supplyByChain[name].lines[0].values[29] = '100.000000000000000001';
    expect(Overview.safeParse(exact).success).toBe(true);
  });

  it('rejects extra window keys and data without common coverage', () => {
    const extra = Overview.safeParse({ ...long, views: { ...long.views, extra: long.views.all } });
    expect(extra.error?.issues.map((issue) => issue.path.join('.'))).toContain('views');
    const emptyScope = Overview.safeParse({ ...emptyOverview, chains: [], status: { chains: [] }, views: { ...emptyOverview.views, all: long.views.all } });
    expect(emptyScope.error?.issues.map((issue) => issue.path.join('.'))).toContain('views.all');
    const missing = Overview.safeParse({ ...emptyOverview, day: coveredOverview.day });
    expect(missing.error?.issues.map((issue) => issue.path.join('.'))).toContain('day');
  });

});
