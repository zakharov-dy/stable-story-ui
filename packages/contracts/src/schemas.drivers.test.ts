import { describe, expect, it } from 'vitest';
import { OverviewDriver } from './schemas.ts';

const driver = (values: (string | null)[], events: number | null) => ({
  scope: 'ethereum', events: [events], series: {
    period: 'week', unit: 'tokens', buckets: [{ start: '2026-12-16', end: '2026-12-20', complete: false }],
    lines: ['issuer_mint', 'issuer_burn', 'bridge_in', 'bridge_out', 'net'].map((flow, i) => ({ key: flow, flow, values: [values[i] ?? null], unreconciled: [] })),
  },
});
const rejects = (input: unknown, path: string) => {
  const result = OverviewDriver.safeParse(input);
  expect(result.success).toBe(false);
  expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(path);
};

describe('bucket events and flows', () => {
  it.each([
    { values: [null, null, null, null, null], events: null },
    { values: ['0', '0', '0', '0', '0'], events: 0 },
    { values: ['0', '0', '0', '0', '0'], events: 1 },
    { values: ['50', '15', '500', '200', '335'], events: 25 },
  ])('keeps missing, empty, zero-amount events and known partials distinct: %j', ({ values, events }) => {
    expect(OverviewDriver.safeParse(driver(values, events)).success).toBe(true);
  });
  it.each([
    { values: ['0', '0', '0', '0', '0'], events: null },
    { values: [null, null, null, null, null], events: 0 },
    { values: ['1', null, null, null, null], events: 1 },
    { values: ['0', '0', '0', '0', null], events: 0 },
    { values: ['1', '0', '0', '0', '1'], events: 0 },
    { values: ['0', '0', '0', '0', '0'], events: -1 },
    { values: ['0', '0', '0', '0', '0'], events: 1.5 },
  ])('rejects inconsistent counts with an issue path: %j', ({ values, events }) => rejects(driver(values, events), 'events.0'));
  it('owns event lengths and canonical flow order', () => {
    const input = driver(['0', '0', '0', '0', '0'], 0);
    rejects({ ...input, events: [] }, 'events');
    rejects({ ...input, series: { ...input.series, lines: [...input.series.lines].reverse() } }, 'series.lines');
    rejects({ ...input, series: { ...input.series, unit: 'percent' } }, 'series.unit');
  });
});
