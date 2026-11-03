// The cut-bucket rule of the contract (overview-invariants `cut`), for the page's classification.
import { describe, expect, it } from 'vitest';
import { isPartialBucket } from './resolution.ts';

const bucket = (start: string, end: string): { start: string; end: string; complete: boolean } => ({ start, end, complete: false });

describe('isPartialBucket', () => {
  it('calls a week partial when it does not cover its ISO week, not only when it is short', () => {
    expect(isPartialBucket(bucket('2026-12-21', '2026-12-27'), 'week')).toBe(false); // a full ISO week
    expect(isPartialBucket(bucket('2026-12-16', '2026-12-20'), 'week')).toBe(true); // cut at the window edge
    expect(isPartialBucket(bucket('2027-03-15', '2027-03-15'), 'week')).toBe(true); // the one-day cut of the 90D window
    expect(isPartialBucket(bucket('2026-12-23', '2026-12-29'), 'week')).toBe(true); // seven days, not ISO-aligned
    expect(isPartialBucket(bucket('2026-12-15', '2026-12-21'), 'week')).toBe(true); // starts on a Tuesday
  });

  it('keeps days out and judges months by their calendar edges', () => {
    expect(isPartialBucket(bucket('2027-03-15', '2027-03-15'), 'day')).toBe(false);
    expect(isPartialBucket(bucket('2026-11-15', '2026-11-30'), 'month')).toBe(true);
    expect(isPartialBucket(bucket('2026-12-01', '2026-12-31'), 'month')).toBe(false);
    expect(isPartialBucket(bucket('2027-03-01', '2027-03-15'), 'month')).toBe(true);
  });
});
