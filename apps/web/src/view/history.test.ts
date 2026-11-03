import { createMockClient } from '@app/contracts';
import { describe, expect, it } from 'vitest';
import { shiftOverview } from '../test-support/shift-dates.ts';
import { texts } from '../texts.ts';
import { isShortHistory } from '@app/view';
import { beforeHistoryReason } from '../view.ts';

describe('beforeHistoryReason', () => {
  it('names the day a change needs and the day the history starts', () => {
    const range = { asOf: '2026-10-09', historyStart: '2026-10-03' };
    expect(beforeHistoryReason('change7d', range)).toBe(texts.na.history.needs('Oct 2', 'Oct 3'));
    expect(beforeHistoryReason('change1d', { asOf: '2026-10-03', historyStart: '2026-10-03' })).toBe(texts.na.history.needs('Oct 2', 'Oct 3'));
  });

  it('names the part of the previous 7 days that lies before the history', () => {
    expect(beforeHistoryReason('issuerMinted7d', { asOf: '2026-10-09', historyStart: '2026-10-03' })).toBe(texts.na.history.before('Sep 26 – Oct 2'));
    // The history starts in the middle of the previous week: only the days before it are named.
    expect(beforeHistoryReason('issuerBurned7d', { asOf: '2026-10-09', historyStart: '2026-09-29' })).toBe(texts.na.history.before('Sep 26 – Sep 28'));
  });

  it('has no reason when the history is long enough or unknown', () => {
    expect(beforeHistoryReason('change7d', { asOf: '2026-10-09', historyStart: '2026-10-02' })).toBeNull();
    expect(beforeHistoryReason('issuerMinted7d', { asOf: '2026-10-09', historyStart: '2026-09-26' })).toBeNull();
    expect(beforeHistoryReason('change7d', { asOf: null, historyStart: null })).toBeNull();
  });

  it('puts a year on the days when they are in different years', () => {
    expect(beforeHistoryReason('change7d', { asOf: '2027-01-06', historyStart: '2027-01-02' })).toBe(texts.na.history.needs('Dec 30, 2026', 'Jan 2, 2027'));
    expect(beforeHistoryReason('issuerMinted7d', { asOf: '2027-01-09', historyStart: '2027-01-04' })).toBe(texts.na.history.before('Dec 27, 2026 – Jan 2, 2027'));
  });
});

describe('isShortHistory', () => {
  it('is true when the common history starts after the 30-day windows, as in the gap and short-history states', async () => {
    for (const [state, expected] of [['ok', false], ['delayed', false], ['unreconciled', false], ['gap', true], ['short-history', true]] as const) {
      expect(isShortHistory(await createMockClient(state).overview()), state).toBe(expected);
    }
  });

  it('keeps its answer when the dates move across a year', async () => {
    const gap = shiftOverview(await createMockClient('gap').overview(), 85);
    expect(gap.asOf).toBe('2027-01-02');
    expect(isShortHistory(gap)).toBe(true);
  });
});
