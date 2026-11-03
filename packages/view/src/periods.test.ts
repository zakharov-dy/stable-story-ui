import { createMockClient } from '@app/contracts';
import { describe, expect, it } from 'vitest';
import { disabledPeriods, historyDays } from './periods.ts';

describe('common coverage and period availability', () => {
  it('counts inclusive UTC calendar days, independently of public bucket counts', async () => {
    const overview = await createMockClient('long-history').overview();
    expect(historyDays(overview)).toBe(121);
    expect(overview.views.all?.supplyByChain.level.buckets).toHaveLength(5);
    expect(historyDays({ historyStart: '2024-02-28', asOf: '2024-03-01' })).toBe(3);
    expect(historyDays({ historyStart: '2026-12-31', asOf: '2027-01-01' })).toBe(2);
    expect(historyDays({ historyStart: null, asOf: null })).toBe(0);
  });

  it.each([
    [0, ['90d', 'all']], [89, ['90d', 'all']], [90, ['all']], [91, []],
  ])('retains the thresholds at %i days', (days, expected) => {
    expect(disabledPeriods(days)).toEqual(expected);
  });
});
