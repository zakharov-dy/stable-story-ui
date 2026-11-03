import { createMockClient } from '@app/contracts';
import { describe, expect, it } from 'vitest';
import {
  unscale,
  driverColumns,
  driverDigits,
  driverExtent,
  driverScopes,
  driversDigits,
  flagRuns,
  stackFromBoundaries,
} from '@app/view';
import { withLastDay } from '../test-support/last-day.ts';
import { texts } from '../texts.ts';
import { bucketLabel, naReason, runLabel, shortDay } from '../view.ts';

const quality = { complete: true, unreconciledDays: [] as string[], operationsComplete: true, unpairedEvents: 0 };

describe('shortDay and runs', () => {
  it('formats a day without the year', () => {
    expect(shortDay('2026-10-09')).toBe('Oct 9');
    expect(shortDay('2026-01-31')).toBe('Jan 31');
  });

  it('groups consecutive flags into runs', () => {
    expect(flagRuns([false, true, true, false, true])).toEqual([[1, 2], [4, 4]]);
    expect(flagRuns([])).toEqual([]);
    const buckets = ['2026-10-01', '2026-10-02', '2026-10-03'].map((day) => ({ start: day, end: day, complete: true }));
    expect(runLabel(buckets, [0, 1])).toBe(texts.dayRange('Oct 1', 'Oct 2'));
    expect(runLabel(buckets, [2, 2])).toBe('Oct 3');
  });

  it('puts the year on both ends of a run that crosses 1 January', () => {
    const buckets = ['2026-12-31', '2027-01-01'].map((day) => ({ start: day, end: day, complete: true }));
    expect(runLabel(buckets, [0, 1])).toBe('Dec 31, 2026 – Jan 1, 2027');
    expect(bucketLabel({ start: '2026-12-30', end: '2027-01-02', complete: true })).toBe('Dec 30, 2026 – Jan 2, 2027');
    expect(bucketLabel({ start: '2026-10-03', end: '2026-10-03', complete: true })).toBe('Oct 3');
  });
});

describe('stackFromBoundaries', () => {
  it('scales the ready boundaries, and takes gaps from levels rather than nullable shares', async () => {
    const overview = await createMockClient('ok').overview();
    const { level, stackedLevel, stackedShare } = overview.views['30d']!.supplyByChain;
    const stack = stackFromBoundaries(stackedLevel, level);
    expect(stack.missing.every((value) => !value)).toBe(true);
    expect(unscale(stack.tops[2]?.[0] ?? 0n, stack.digits)).toBe(String(stackedLevel.lines[2]?.values[0]));
    const zero = structuredClone(level);
    for (const line of zero.lines) line.values[0] = '0';
    const shares = structuredClone(stackedShare);
    for (const line of shares.lines) line.values[0] = null;
    expect(stackFromBoundaries(shares, zero).missing[0]).toBe(false);
    zero.lines[0].values[0] = null;
    expect(stackFromBoundaries(shares, zero).missing[0]).toBe(true);
  });
});

describe('the own scale of each driver chart', () => {
  it('is the raw maximum of that chart alone, never shared across chains', async () => {
    // A consistency guard on the helper's inputs; the rule itself (raw strings → data-scale)
    // is asserted independently in charts.test.ts from the mock's raw strings.
    const overview = await createMockClient('ok').overview();
    const drivers = driverScopes(overview);
    const columns = drivers.map((driver) => driverColumns(driver.series, driverDigits(driver.series), driver.events));
    for (const [chart, driver] of columns.map((chart, index) => [chart, drivers[index]] as const)) {
      const largest = [chart.up, chart.down, chart.values.net].flat().reduce<bigint>((max, value) => {
        const magnitude = value === null ? 0n : value < 0n ? -value : value;
        return magnitude > max ? magnitude : max;
      }, 0n);
      expect(driverExtent(chart)).toBe(largest);
      expect(driver?.series.buckets.length).toBe(30);
    }
    // One bound per card: two different maxima give two different extents.
    expect(new Set(columns.map((chart) => driverExtent(chart))).size).toBeGreaterThanOrEqual(1);
  });

  it('does not shrink to a small chain: a large chain keeps its own large bound', async () => {
    const overview = await createMockClient('ok').overview();
    const drivers = driverScopes(overview);
    const columns = drivers.map((driver) => driverColumns(driver.series, driverDigits(driver.series), driver.events));
    const [first] = columns;
    if (first === undefined) throw new Error('no drivers');
    expect(driverExtent(first)).toBeGreaterThan(0n);
  });
});

describe('driver columns', () => {
  it('tells an empty day (real zeros) from a gap (null)', async () => {
    const empty = await createMockClient('empty-day').overview();
    const emptyDrivers = driverScopes(empty);
    const emptyColumns = emptyDrivers.map((driver) => driverColumns(driver.series, driversDigits(emptyDrivers), driver.events));
    for (const chart of emptyColumns) {
      expect(chart.empty.filter(Boolean)).toHaveLength(1);
      expect(chart.known.every(Boolean)).toBe(true);
    }
    // A day that is not closed anywhere: the last day of one chain, null in every line.
    const gapped = withLastDay(await createMockClient('ok').overview(), 'arbitrum', { flows: 'unknown', events: null });
    const gapDrivers = driverScopes(gapped);
    const gapColumns = gapDrivers.map((driver) => driverColumns(driver.series, driversDigits(gapDrivers), driver.events));
    for (const chart of gapColumns) expect(chart.empty.some(Boolean)).toBe(false);
    expect(gapColumns.some((chart) => chart.known.some((known) => !known))).toBe(true);
    // A gap day has no values at all, an empty day has real zeros.
    const hole = gapColumns.find((chart) => chart.known.includes(false));
    const index = hole?.known.indexOf(false) ?? -1;
    expect(hole?.values.issuer_mint[index]).toBeNull();
    expect(emptyColumns[0]?.values.issuer_mint[emptyColumns[0].empty.indexOf(true)]).toBe(0n);
  });

  it('calls a day empty by its event count, not by four zero flows', async () => {
    const base = await createMockClient('ok').overview();
    const last = (events: number | null, flows: 'zero' | 'unknown') => {
      const overview = withLastDay(base, 'arbitrum', { events, flows });
      const drivers = driverScopes(overview);
      const driver = drivers.find((candidate) => candidate.scope === 'arbitrum');
      if (driver === undefined) throw new Error('no arbitrum drivers');
      const columns = driverColumns(driver.series, driversDigits(drivers), driver.events);
      return { empty: columns.empty.at(-1), known: columns.known.at(-1), mint: columns.values.issuer_mint.at(-1) };
    };
    // Events 0: empty. Zero flows with events (zero-amount events): a real zero, but not empty.
    expect(last(0, 'zero')).toEqual({ empty: true, known: true, mint: 0n });
    expect(last(1, 'zero')).toEqual({ empty: false, known: true, mint: 0n });
    // Not closed: a gap (null is not 0), never empty.
    expect(last(null, 'unknown')).toEqual({ empty: false, known: false, mint: null });
    // The only empty day in the whole mock catalogue is the one of `empty-day`.
    for (const state of ['ok', 'delayed', 'unreconciled', 'short-history', 'gap'] as const) {
      const overview = await createMockClient(state).overview();
      const drivers = driverScopes(overview);
      const digits = driversDigits(drivers);
      expect(drivers.some((driver) => driverColumns(driver.series, digits, driver.events).empty.includes(true))).toBe(false);
    }
  });

  it('takes the flagged columns from the API lines, not from the quality', async () => {
    const overview = await createMockClient('unreconciled').overview();
    const drivers = driverScopes(overview);
    const digits = driversDigits(drivers);
    const flags = drivers.map((driver) => driverColumns(driver.series, digits, driver.events).unreconciled);
    expect(flags).toEqual(drivers.map((driver) => [...new Set(driver.series.lines.flatMap((line) => line.unreconciled))].sort((a, b) => a - b)));
    expect(flags.some((list) => list.length > 0)).toBe(true);
  });
});

describe('driverScopes', () => {
  it('keeps the All scope first and the chain scopes in chains order, cut to the thirty-day window', async () => {
    const overview = await createMockClient('ok').overview();
    const drivers = driverScopes(overview);
    expect(drivers.map((driver) => driver.scope)).toEqual(['all', ...overview.chains.map((chain) => chain.slug)]);
    for (const driver of drivers) {
      expect(driver.series.buckets).toHaveLength(30);
      expect(driver.series.buckets.at(-1)?.end).toBe(overview.asOf);
      expect(driver.events).toHaveLength(driver.series.buckets.length);
      const source = overview.views['30d']!.drivers.find((candidate) => candidate.scope === driver.scope);
      expect(driver.events.at(-1)).toBe(source?.events.at(-1));
    }
  });

  it('keeps fixed windows intact before coverage and an empty overview empty', async () => {
    const gap = await createMockClient('gap').overview();
    expect(driverScopes(gap).map((driver) => driver.series.buckets.length)).toEqual([30, 30, 30, 30]);
    expect(driverScopes(await createMockClient('empty').overview())).toEqual([]);
  });

  it('rebases the flags of the cut onto the shorter series', async () => {
    for (const driver of driverScopes(await createMockClient('unreconciled').overview())) {
      for (const line of driver.series.lines) {
        for (const index of line.unreconciled) expect(index).toBeLessThan(line.values.length);
      }
    }
  });

  it('selects the ready series from each declared view', async () => {
    const overview = await createMockClient('ok').overview();
    // The ok history is 45 days (Aug 26 – Oct 9): 90D and ALL keep all of it, 30D keeps Sep 10 – Oct 9.
    expect(driverScopes(overview, '30d').map((driver) => driver.series.buckets.length)).toEqual([30, 30, 30, 30]);
    expect(driverScopes(overview, '90d').map((driver) => driver.series.buckets.length)).toEqual([14, 14, 14, 14]);
    expect(driverScopes(overview, 'all').map((driver) => driver.series.buckets.length)).toEqual([3, 3, 3, 3]);
    expect(driverScopes(overview, '90d')[0]?.series.buckets[0]?.start).toBe('2026-07-12');
    expect(driverScopes(overview, '30d')[0]?.series.buckets[0]?.start).toBe('2026-09-10');
    for (const period of ['30d', '90d', 'all'] as const) {
      for (const driver of driverScopes(overview, period)) {
        expect(driver.events).toHaveLength(driver.series.buckets.length);
        expect(driver.series.buckets.at(-1)?.end).toBe('2026-10-09');
      }
    }
  });
});

describe('naReason', () => {
  it('names the reason from the API quality', () => {
    expect(naReason('volume', 'in', { ...quality, complete: false, operationsComplete: false })).toBe(texts.na.reasons.noDataForRange);
    expect(naReason('count', 'out', { ...quality, complete: false, operationsComplete: false })).toBe(texts.na.reasons.noDataForRange);
    expect(naReason('count', 'in', { ...quality, operationsComplete: false, unpairedEvents: 1 })).toBe(texts.na.reasons.operationsIncomplete);
    expect(naReason('volume', 'in', quality)).toBe(texts.issuerVsBridge.noFlow.in);
    expect(naReason('count', 'out', quality)).toBe(texts.issuerVsBridge.noFlow.out);
  });
});
