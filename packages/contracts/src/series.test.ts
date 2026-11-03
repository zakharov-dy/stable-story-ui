import { describe, expect, it } from 'vitest';
import { Series } from './schemas.ts';
import { sliceSeries } from './series.ts';

const DAY_MS = 86_400_000;
const day = (index: number) => new Date(Date.parse('2026-01-01T00:00:00Z') + index * DAY_MS).toISOString().slice(0, 10);

/** A 100-day daily token series ending at `day(99)` = 2026-04-10. */
function series(length = 100) {
  const days = Array.from({ length }, (_, index) => day(index));
  const flagged = [0, 29, 70, length - 1].filter((index) => index < length);
  return Series.parse({
    period: 'day',
    unit: 'tokens',
    buckets: days.map((start) => ({ start, end: start, complete: true })),
    lines: [
      { key: 'all', values: days.map((_, index) => String(index + 1)), unreconciled: flagged },
      { key: 'net', flow: 'net', values: days.map(() => '0'), unreconciled: flagged },
    ],
  });
}

describe('sliceSeries by date range', () => {
  it('keeps every bucket of a range that covers the series', () => {
    const full = series();
    const sliced = sliceSeries(full, '2026-01-01', '2026-04-10');
    expect(sliced).toEqual(full);
  });

  it('cuts the thirty and ninety days through asOf', () => {
    const full = series();
    const thirty = sliceSeries(full, '2026-03-12', '2026-04-10');
    expect(thirty.buckets).toHaveLength(30);
    expect([thirty.buckets[0]?.start, thirty.buckets.at(-1)?.end]).toEqual(['2026-03-12', '2026-04-10']);
    expect(thirty.lines[0]?.values[0]).toBe('71');
    expect(thirty.lines[0]?.unreconciled).toEqual([0, 29]);
    const ninety = sliceSeries(full, '2026-01-11', '2026-04-10');
    expect(ninety.buckets).toHaveLength(90);
    expect([ninety.buckets[0]?.start, ninety.buckets.at(-1)?.end]).toEqual(['2026-01-11', '2026-04-10']);
    // Indices 0, 29, 70 and 99 fall outside or at the edges of the cut.
    expect(ninety.lines[0]?.unreconciled).toEqual([19, 60, 89]);
  });

  it('does not pad a window longer than the available history', () => {
    const short = series(7);
    const sliced = sliceSeries(short, '2026-01-01', '2026-04-10');
    expect(sliced.buckets).toHaveLength(7);
    // Rebased onto the shorter series.
    expect(sliced.lines[0]?.unreconciled).toEqual([0, 6]);
  });

  it('is empty outside the series and for a reversed range', () => {
    const full = series();
    expect(sliceSeries(full, '2025-12-01', '2025-12-31')).toEqual({ ...full, buckets: [], lines: [] });
    expect(sliceSeries(full, '2026-04-11', '2026-05-01')).toEqual({ ...full, buckets: [], lines: [] });
    expect(sliceSeries(full, '2026-03-01', '2026-02-01')).toEqual({ ...full, buckets: [], lines: [] });
  });

  it('rebases unreconciled and drops the indices outside the cut', () => {
    const full = series();
    const sliced = sliceSeries(full, '2026-01-01', '2026-01-10');
    expect(sliced.lines[0]?.unreconciled).toEqual([0]);
    expect(sliced.lines[1]?.values).toEqual(Array<string>(10).fill('0'));
  });

  it('passes the Series schema and keeps metadata', () => {
    const full = series();
    const sliced = sliceSeries(full, '2026-02-01', '2026-02-10');
    expect(Series.parse(sliced)).toEqual(sliced);
    expect([sliced.period, sliced.unit]).toEqual(['day', 'tokens']);
    expect(sliced.lines.map((line) => [line.key, line.flow])).toEqual([['all', undefined], ['net', 'net']]);
  });
});

describe('sliceSeries by index range', () => {
  it('cuts [start, end) and the last n buckets', () => {
    const full = series();
    const middle = sliceSeries(full, 2, 5);
    expect(middle.buckets.map((bucket) => bucket.start)).toEqual(['2026-01-03', '2026-01-04', '2026-01-05']);
    expect(middle.lines[0]?.values).toEqual(['3', '4', '5']);
    const tail = sliceSeries(full, -30);
    expect(tail.buckets).toHaveLength(30);
    expect(tail.lines[0]?.values.at(-1)).toBe('100');
    expect(tail.lines[0]?.unreconciled).toEqual([0, 29]);
  });

  it('is empty for equal, reversed or out-of-range indices', () => {
    const full = series();
    expect(sliceSeries(full, 5, 5).buckets).toEqual([]);
    expect(sliceSeries(full, 6, 5).buckets).toEqual([]);
    expect(sliceSeries(full, 200, 300).buckets).toEqual([]);
    expect(sliceSeries(full, -500, 2).buckets).toHaveLength(2);
    expect(sliceSeries(full, -5).buckets).toHaveLength(5);
  });

  it('truncates fractional indices and treats NaN as zero, like Array.prototype.slice', () => {
    const full = series();
    const fractional = sliceSeries(full, 1.5);
    expect(fractional.buckets).toHaveLength(99);
    expect(fractional.buckets[0]?.start).toBe('2026-01-02');
    expect(fractional.lines[0]?.values[0]).toBe('2');
    expect(fractional.lines[0]?.unreconciled).toEqual([28, 69, 98]);
    const negative = sliceSeries(full, -1.5);
    expect(negative.buckets.map((bucket) => bucket.start)).toEqual(['2026-04-10']);
    expect(negative.lines[0]?.unreconciled).toEqual([0]);
    const nan = sliceSeries(full, Number.NaN);
    expect(nan.buckets).toHaveLength(100);
    expect(nan.lines[0]?.unreconciled).toEqual([0, 29, 70, 99]);
    expect(sliceSeries(full, 98, Number.NaN).buckets).toEqual([]);
    expect(Series.parse(fractional)).toEqual(fractional);
    expect(Series.parse(negative)).toEqual(negative);
    expect(Series.parse(nan)).toEqual(nan);
  });

  it('returns the Series shape for an empty slice', () => {
    const full = series();
    const empty = sliceSeries(full, 10, 10);
    expect(Series.parse(empty)).toEqual(empty);
    expect(empty.lines).toEqual([]);
  });
});
