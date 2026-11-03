// Generic series slicing utility. Public overview windows are selected on the server;
// the page never cuts a series. Metadata and reconciliation indices follow the retained buckets.

import type { Day } from './primitives.ts';
import type { Series } from './schemas.ts';

/** The series cut to the buckets that intersect the date range `from`…`to`. */
export function sliceSeries<S extends Series>(series: S, from: Day, to: Day): S;
/** The series cut to the index range `[start, end)`, with `Array.prototype.slice` semantics. */
export function sliceSeries<S extends Series>(series: S, start: number, end?: number): S;
export function sliceSeries<S extends Series>(series: S, from: Day | number, to?: Day | number): S {
  const length = series.buckets.length;
  let start = 0;
  let end = length;
  if (typeof from === 'string') {
    const until = typeof to === 'string' ? to : '';
    // Both ends are days: the overlapping buckets, inclusive. A reversed range is empty.
    if (from > until || until === '') return { ...series, buckets: [], lines: [] };
    start = series.buckets.findIndex((bucket) => bucket.end >= from);
    if (start < 0) return { ...series, buckets: [], lines: [] };
    end = start;
    while (end < length && (series.buckets[end]?.start ?? '') <= until) end++;
  } else {
    // Both ends are indices: `slice` semantics, so a fractional index is truncated toward zero
    // (NaN counts as 0) and a negative one counts from the end.
    const normalize = (index: number): number => {
      const integer = Number.isNaN(index) ? 0 : Math.trunc(index);
      return integer < 0 ? Math.max(length + integer, 0) : Math.min(integer, length);
    };
    start = normalize(from);
    end = typeof to === 'number' ? normalize(to) : length;
  }
  if (end <= start) return { ...series, buckets: [], lines: [] };
  const buckets = series.buckets.slice(start, end);
  const sliceLine = (line: S['lines'][number]): S['lines'][number] => ({
    ...line,
    values: line.values.slice(start, end),
    unreconciled: line.unreconciled.filter((index) => index >= start && index < end).map((index) => index - start),
  });
  return { ...series, buckets, lines: series.lines.map(sliceLine) };
}
