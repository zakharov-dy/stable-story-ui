// Series values as display strings: counters arrive as JSON numbers, amounts and percentages as
// decimal strings. Also the pure models behind the charts (stacks, driver columns, shares):
// exact bigint arithmetic, `number` only where a coordinate is needed.
import type { ViewLabels } from './labels.ts';
import { createFormat } from './format.ts';
import type { Flow, Overview, Quality, Series } from '@app/contracts';
import { commonDigits, scale, sharedExtent } from './chart/scale.ts';
import { type PeriodId } from './periods.ts';

export const lineValues = (line: { values: readonly (string | number | null)[] }): (string | null)[] =>
  line.values.map((value) => (value === null ? null : String(value)));

type Bucket = Series['buckets'][number];

/** Indices whose flag is set, as runs of consecutive indices [from, to]. */
export function flagRuns(flags: readonly boolean[]): [number, number][] {
  const runs: [number, number][] = [];
  flags.forEach((flag, index) => {
    const last = runs.at(-1);
    if (!flag) return;
    if (last !== undefined && last[1] === index - 1) last[1] = index;
    else runs.push([index, index]);
  });
  return runs;
}

// ---------------------------------------------------------------------------------------------
// Stacked areas (block 03)

export interface Stack {
  digits: number; // fractional digits of the common scale
  missing: boolean[]; // a column where any layer is null: a gap in the whole stack
  tops: (bigint | null)[][]; // cumulative top of each layer; null on a missing column
}

/**
 * Layers stacked from zero. A column where any layer has no data is a gap for all of them: an
 * unknown value is never stacked as 0.
 */
export function stackFromBoundaries(series: Series, levels: Series): Stack {
  const lists = series.lines.map(lineValues);
  const digits = commonDigits(...lists) + 1;
  return {
    digits,
    missing: levels.buckets.map((_bucket, at) => levels.lines.some((line) => line.values[at] === null)),
    tops: lists.map((list) => scale(list, digits).values),
  };
}

// ---------------------------------------------------------------------------------------------
// Drivers (block 04)

export const UP: readonly Flow[] = ['issuer_mint', 'bridge_in'];
export const DOWN: readonly Flow[] = ['issuer_burn', 'bridge_out'];
export const FLOW_KEYS = [...UP, ...DOWN] as const;
export type DriverKey = Flow | 'net';

export interface ChainDriver {
  scope: string;
  series: Series;
  events: (number | null)[];
}

/** The selected view already contains every scope in display order, with aligned events. */
export function driverScopes(overview: Overview, period: PeriodId = '30d'): ChainDriver[] {
  return overview.views[period]?.drivers ?? [];
}

export interface DriverColumns {
  values: Record<DriverKey, (bigint | null)[]>; // scaled to the shared number of digits
  known: boolean[]; // all four flows are known; otherwise the day is a gap (null is not 0)
  empty: boolean[]; // a closed bucket with an event count of 0 (the API's `events`): four real zeros, not a gap
  up: (bigint | null)[]; // inflows of a known day stacked from zero
  down: (bigint | null)[]; // outflows of a known day, as a magnitude
  unreconciled: number[]; // ascending, the union of the lines' API flags
}

const driverList = (series: Series, key: DriverKey): (string | null)[] => {
  const line = series.lines.find((candidate) => candidate.flow === key);
  return line ? lineValues(line) : series.buckets.map(() => null);
};

/** Fractional digits of one driver chart: the common digits of its own lists + 1, so that half of a round axis end stays exact. */
export function driverDigits(series: Series): number {
  const lists = [...FLOW_KEYS, 'net' as const].map((key) => driverList(series, key));
  return commonDigits(...lists) + 1;
}

/** Fractional digits shared by every driver chart: +1 so that half of a round axis end stays exact. */
export function driversDigits(drivers: readonly { series: Series }[]): number {
  const lists = drivers.flatMap(({ series }) => [...FLOW_KEYS, 'net' as const].map((key) => driverList(series, key)));
  return commonDigits(...lists) + 1;
}

/**
 * `events` is the driver's bucket event count, one entry per bucket (`null` where the day is not
 * closed). "Closed, no events" comes from it alone: four zero flows do not prove it, because an
 * event may have a zero amount.
 */
export function driverColumns(series: Series, digits: number, events: readonly (number | null)[]): DriverColumns {
  const keys = [...FLOW_KEYS, 'net'] as const;
  const values = Object.fromEntries(keys.map((key) => [key, scale(driverList(series, key), digits).values])) as DriverColumns['values'];
  const known = series.buckets.map((_, index) => events[index] !== null && events[index] !== undefined && FLOW_KEYS.every((flow) => values[flow][index] !== null && values[flow][index] !== undefined));
  const sum = (flows: readonly Flow[], index: number): bigint | null =>
    known[index] ? flows.reduce((total, flow) => total + (values[flow][index] ?? 0n), 0n) : null;
  const flagged = new Set(series.lines.flatMap((line) => line.unreconciled));
  return {
    values,
    known,
    empty: series.buckets.map((_, index) => known[index] === true && events[index] === 0),
    up: series.buckets.map((_, index) => sum(UP, index)),
    down: series.buckets.map((_, index) => sum(DOWN, index)),
    unreconciled: [...flagged].filter((index) => index < series.buckets.length).sort((a, b) => a - b),
  };
}

/**
 * The raw maximum of one driver chart: the largest magnitude of its stacked inflows, stacked
 * outflows and net. Each card is on its own scale, so a bound is never shared across chains.
 */
export function driverExtent(columns: DriverColumns): bigint {
  return sharedExtent([columns.up, columns.down, columns.values.net]);
}

/** Bind client-owned labels without global configuration. */
export function createSeries(texts: ViewLabels) {
  const { formatAmount, formatCompact, formatCount, formatPercent, formatRange, formatShortDay } = createFormat(texts);
  const shortDay = formatShortDay;

  function formatSeriesValue(unit: Series['unit'], value: string | null, { signed = false } = {}): string {
    switch (unit) {
      case 'count':
        return formatCount(value);
      case 'percent':
      case 'percentage_points':
        return formatPercent(value, { signed });
      case 'tokens':
        return formatAmount(value, { signed });
    }
  }

  /** A bucket as a label: its day, or its range for a wider bucket. */
  const bucketLabel = (bucket: Bucket): string => formatRange(bucket.start, bucket.end);

  /** The range of consecutive buckets [from, to]. */
  const runLabel = (buckets: readonly Bucket[], [from, to]: readonly [number, number]): string => {
    const first = buckets[from];
    const last = buckets[to];
    if (first === undefined || last === undefined) return texts.noData;
    return first.start === last.end ? formatShortDay(last.end) : formatRange(first.start, last.end);
  };

  /**
   * A signed compact value for an axis label: `formatCompact`, then the trailing zeros of the
   * decimals are trimmed (`+1.20B` → `+1.2B`, never `100.00B`). Zero stays `0`, never `+0`.
   */
  function axisSigned(value: string | null): string {
    return formatCompact(value, { signed: true }).replace(/(\.\d*?)0+(?=\D|$)/, '$1').replace(/\.(?=\D|$)/, '');
  }

  // ---------------------------------------------------------------------------------------------
  // Issuer vs bridge (block 05)

  /**
   * Why a share is unknown, from the API's own quality (never recomputed from the figures):
   * a gap in the range, incomplete operation counts, or a zero base.
   */
  function naReason(basis: 'volume' | 'count', side: 'in' | 'out', quality: Quality): string {
    if (!quality.complete) return texts.na.reasons.noDataForRange;
    if (basis === 'count' && !quality.operationsComplete) return texts.na.reasons.operationsIncomplete;
    return texts.issuerVsBridge.noFlow[side];
  }

  return { formatSeriesValue, bucketLabel, runLabel, axisSigned, naReason, shortDay };
}
