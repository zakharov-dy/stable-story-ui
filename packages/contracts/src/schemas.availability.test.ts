import { describe, expect, it } from 'vitest';
import { Overview } from './schemas.ts';
import type { Overview as Document } from './schemas.ts';
import { rejects } from './schemas.invariants.fixtures.ts';
import gap from '../fixtures/gap/overview.json' with { type: 'json' };
import long from '../fixtures/long-history/overview.json' with { type: 'json' };

const copy = (): Document => structuredClone(gap) as Document;

describe('public overview availability invariants', () => {
  it('accepts absent-chain totals and keeps common historyStart separate from ALL', () => {
    const input = copy();
    expect(Overview.safeParse(input).success).toBe(true);
    expect(input.historyStart).toBe('2026-10-03');
    expect(input.views.all!.from).toBe('2026-08-26');
    expect(input.views.all!.supplyByChain.level.lines[1]?.values).toEqual([null, null, '1469']);
    expect(input.views.all!.supplyByChain.total.lines[0]?.values).toEqual(['2804', '6824', '9499']);
    expect(input.records.every((record) => record.since === '2026-10-03')).toBe(true);
  });

  it('allows omission only where coverage has no absent chains', () => {
    const input = structuredClone(long) as Document;
    for (const view of Object.values(input.views)) if (view) delete view.noDataChains;
    expect(Overview.safeParse(input).success).toBe(true);
    for (const window of ['30d', '90d', 'all'] as const) {
      const absent = copy();
      delete absent.views[window]!.noDataChains;
      rejects(Overview, absent, [`views.${window}.noDataChains`]);
    }
  });

  it.each([
    { name: 'unknown chain', value: ['solana'] },
    { name: 'duplicate chain', value: ['base', 'base'] },
    { name: 'present chain', value: ['arbitrum'] },
    { name: 'hidden absence', value: [] },
  ])('rejects $name in an absence list at the bucket path', ({ value }) => {
    const input = copy();
    input.views.all!.noDataChains![0] = value;
    rejects(Overview, input, ['views.all.noDataChains.0']);
  });

  it('rejects missing bucket lists and incorrect enabled order', () => {
    const short = copy();
    short.views.all!.noDataChains!.pop();
    rejects(Overview, short, ['views.all.noDataChains', 'views.all.noDataChains.2']);
    const order = copy();
    // The first 90D bucket precedes every chain's first day.
    order.views['90d']!.noDataChains![0] = ['base', 'ethereum', 'arbitrum'];
    rejects(Overview, order, ['views.90d.noDataChains.0']);
  });

  it('rejects an incorrect total and boundary independently', () => {
    const total = copy();
    total.views.all!.supplyByChain.total.lines[0].values[0] = '0';
    rejects(Overview, total, ['views.all.supplyByChain.total.lines.0.values.0']);
    const boundary = copy();
    boundary.views.all!.supplyByChain.stackedLevel.lines[1].values[0] = '0';
    rejects(Overview, boundary, ['views.all.supplyByChain.stackedLevel.lines.1.values.0']);
  });

  it('rejects fabricated zero for an absent chain', () => {
    const input = copy();
    input.views.all!.supplyByChain.level.lines[1].values[0] = '0';
    rejects(Overview, input, [
      'views.all.supplyByChain.level.lines.1.values.0',
      'views.all.supplyByChain.level.lines.1.values.0',
      'views.all.supplyByChain.share.lines.1.values.0',
      'views.all.supplyByChain.stackedLevel.lines.1.values.0',
      'views.all.supplyByChain.stackedShare.lines.1.values.0',
    ]);
  });

  it('rejects the old common start and false completeness on a late-start month', () => {
    const start = copy();
    start.views.all!.from = start.historyStart!;
    rejects(Overview, start, ['views.all.from',
      ...['level', 'share', 'total', 'stackedLevel', 'stackedShare'].map((name) => `views.all.supplyByChain.${name}.buckets`),
      ...[0, 1, 2, 3].map((i) => `views.all.drivers.${i}.series.buckets`),
    ]);
    const complete = copy();
    complete.views.all!.drivers[2].series.buckets[1].complete = true;
    rejects(Overview, complete, [
      'views.all.drivers.2.series.buckets.1.complete', // No known flows.
      'views.all.drivers.2.series.buckets.1.complete', // Before coverage.
    ]);
  });
});
