// The supply tooltip content: values, order, one-decimal shares taken from the share series, the
// total, the date and the quality line. The numbers are hand-written from the fixture, never
// produced by the code under test.
import type { ChainStatus, Series } from '@app/contracts';
import { describe, expect, it } from 'vitest';
import { texts } from '../texts.ts';
import { type Chains, tooltipText, tooltipTitle, driverDigits } from '@app/view';
import { formatShare, driverTooltips, supplyTooltips as suppliedTooltips } from '../view.ts';

const chains: Chains = [
  { slug: 'ethereum', name: 'Ethereum', explorerTx: 'https://example.test/tx' },
  { slug: 'base', name: 'Base', explorerTx: 'https://example.test/tx' },
  { slug: 'arbitrum', name: 'Arbitrum', explorerTx: 'https://example.test/tx' },
];

function seriesOf(
  unit: 'tokens' | 'percent',
  days: readonly string[],
  lines: Record<string, readonly (string | null)[]>,
  { flagged = {}, complete = true }: { flagged?: Record<string, readonly number[]>; complete?: boolean } = {},
): Series {
  return {
    period: 'day',
    unit,
    buckets: days.map((day) => ({ start: day, end: day, complete })),
    lines: Object.entries(lines).map(([key, values]) => ({ key, values: [...values], unreconciled: [...(flagged[key] ?? [])] })),
  };
}

function statusOf(chain: string, state: ChainStatus['state'], lagHours: number): ChainStatus {
  return {
    chain,
    state,
    historyStart: '2026-08-26',
    lastClosedDay: '2026-10-09',
    lastBlock: '1',
    nextDueAt: '2026-10-11T06:00:00.000Z',
    lagHours,
    lastRun: { finishedAt: '2026-10-10T05:57:00.000Z', status: 'ok', toBlock: '1' },
    reconciliation: { day: '2026-10-09', supply: 'ok', supplyDiff: '0', bridge: 'ok', continuity: 'ok' },
    unreconciledDays: [],
  };
}

const okStatus = (): ChainStatus[] => [
  statusOf('ethereum', 'ok', 6),
  statusOf('base', 'ok', 6),
  statusOf('arbitrum', 'ok', 6),
];

// Day 0: 40.00B + 10.00B + 0 = 50.00B, shares 80.0 / 20.0 / 0.0.
// Day 1: 44.00B + 8.25B + 2.75B = 55.00B, shares 80.0 / 15.0 / 5.0 (they total 100.0).
const days = ['2026-10-08', '2026-10-09'];
const levels = (): Series => seriesOf('tokens', days, {
  base: ['10000000000', '8250000000'],
  ethereum: ['40000000000', '44000000000'],
  arbitrum: ['0', '2750000000'],
});
const shares = (ethereum = ['80.0', '80.0'], base = ['20.0', '15.0'], arbitrum = ['0.0', '5.0']): Series =>
  seriesOf('percent', days, { arbitrum, ethereum, base });

const supplyTooltips = (level: Series, share: Series, names: Chains, status: ChainStatus[]) => {
  const hasGap = level.lines.some((line) => line.values[0] === null);
  const isZero = level.lines.every((line) => line.values[0] === '0');
  const total = seriesOf('tokens', days, { all: [hasGap ? null : isZero ? '0' : '50000000000', '55000000000'] });
  return suppliedTooltips(level, share, total, names, status);
};

describe('supply tooltips: rows, total and footer', () => {
  it('keeps the stack order and takes the values and one-decimal shares of the bucket', () => {
    const columns = supplyTooltips(levels(), shares(), chains, okStatus());
    expect(columns).toHaveLength(2);
    const last = columns[1];
    expect(last?.header).toEqual({ label: 'Tracked supply', value: '55.00B', share: '100%' });
    expect(last?.rows).toEqual([
      { label: 'Ethereum', value: '44.00B', share: '80.0%', chain: 1 },
      { label: 'Base', value: '8.25B', share: '15.0%', chain: 2 },
      { label: 'Arbitrum', value: '2.75B', share: '5.0%', chain: 3 },
    ]);
    expect(last?.footer).toEqual({ label: 'Oct 9', value: 'end of day' });
    expect(last?.note).toBeUndefined();
    // The first bucket has its own shares, matched by chain key and by the bucket's start/end.
    expect(columns[0]?.header.value).toBe('50.00B');
    expect(columns[0]?.rows.map((row) => row.share)).toEqual(['80.0%', '20.0%', '0.0%']);
  });

  it('shows the share series, never a share recomputed from the levels', () => {
    const columns = supplyTooltips(levels(), shares(['79.9', '79.9'], ['15.1', '15.1'], ['5.0', '5.0']), chains, okStatus());
    expect(columns[1]?.rows.map((row) => row.share)).toEqual(['79.9%', '15.1%', '5.0%']);
    expect(columns[1]?.header.share).toBe('100%');
  });

  it('writes the native title as one sentence with the same information', () => {
    const column = supplyTooltips(levels(), shares(), chains, okStatus())[1];
    expect(column === undefined ? '' : tooltipTitle(column)).toBe(
      'Oct 9: Tracked supply 55.00B (100%) · Ethereum 44.00B (80.0%) · Base 8.25B (15.0%) · Arbitrum 2.75B (5.0%) · end of day',
    );
  });

  it('names the delayed chain in the card and the live region, and drops it from the title that names the rows', () => {
    const status = [statusOf('ethereum', 'ok', 6), statusOf('base', 'delayed', 30), statusOf('arbitrum', 'ok', 6)];
    const column = supplyTooltips(levels(), shares(), chains, status)[1];
    const card = 'Oct 9: Tracked supply 55.00B (100%) · Ethereum 44.00B (80.0%) · Base 8.25B (15.0%) · Arbitrum 2.75B (5.0%) · Base · 30 h behind · end of day';
    expect(column === undefined ? '' : tooltipText(column)).toBe(card);
    expect(column === undefined ? '' : tooltipTitle(column)).toBe(card.replace('Base · 30 h behind', '30 h behind'));
  });

  it('formats a share with one fixed decimal, half up', () => {
    expect(formatShare(null)).toBeUndefined();
    expect(formatShare('100')).toBe('100.0%');
    expect(formatShare('0')).toBe('0.0%');
    expect(formatShare('33.35')).toBe('33.4%');
    expect(formatShare('-0.04')).toBe('0.0%');
  });
});

describe('supply tooltips: the quality line', () => {
  it('marks a column whose lines are flagged as an unreconciled day', () => {
    const flagged = seriesOf('tokens', days, {
      ethereum: ['40000000000', '44000000000'],
      base: ['10000000000', '8250000000'],
      arbitrum: ['0', '2750000000'],
    }, { flagged: { ethereum: [1] } });
    const column = supplyTooltips(flagged, shares(), chains, okStatus())[1];
    expect(column?.note).toEqual({ text: texts.tags.unreconciledDay, tone: 'unreconciled' });
  });

  it('names a delayed chain on the newest bucket only', () => {
    const status = [statusOf('ethereum', 'ok', 6), statusOf('base', 'delayed', 30), statusOf('arbitrum', 'ok', 6)];
    const columns = supplyTooltips(levels(), shares(), chains, status);
    expect(columns[0]?.note).toBeUndefined();
    expect(columns[1]?.note).toEqual({ text: 'Base · 30 h behind', title: '30 h behind', tone: 'delayed' });
  });

  it('says no data for a column with an unknown level and totals nothing', () => {
    const missing = seriesOf('tokens', ['2026-10-09'], {
      ethereum: ['44000000000'],
      base: [null],
      arbitrum: ['2750000000'],
    });
    const missingShares = seriesOf('percent', ['2026-10-09'], {
      ethereum: ['80.0'],
      base: [null],
      arbitrum: ['5.0'],
    });
    const column = supplyTooltips(missing, missingShares, chains, okStatus())[0];
    expect(column?.header).toEqual({ label: 'Tracked supply', value: texts.noData, share: undefined });
    expect(column?.rows.find((row) => row.label === 'Base')).toEqual({ label: 'Base', value: texts.noData, share: undefined, chain: 2 });
    // The known rows keep their own values and shares: an unknown value is not a zero.
    expect(column?.rows.find((row) => row.label === 'Ethereum')).toEqual({ label: 'Ethereum', value: '44.00B', share: '80.0%', chain: 1 });
    expect(column?.note).toEqual({ text: texts.supplyByChain.gapNote('Oct 9'), tone: 'incomplete' });
  });

  it('explains a cut period through the supplied range without a quality caption', () => {
    const partial = levels();
    partial.period = 'week';
    partial.buckets = [{ start: '2026-10-08', end: '2026-10-09', complete: false }];
    for (const line of partial.lines) line.values = [line.values[1] === undefined || line.values[1] === null ? null : String(line.values[1])];
    const total = seriesOf('tokens', ['2026-10-08'], { all: ['55000000000'] });
    const column = suppliedTooltips(partial, shares(), total, chains, okStatus())[0];
    expect(column?.header.value).toBe('55.00B');
    expect(column?.note).toBeUndefined();
    expect(column?.footer.value).toBe('level at week end');
  });

  it('shows an exact zero total as 0 without a share, and not as a gap', () => {
    const zero = seriesOf('tokens', ['2026-10-09'], {
      ethereum: ['0'],
      base: ['0'],
      arbitrum: ['0'],
    });
    const zeroShares = seriesOf('percent', ['2026-10-09'], {
      ethereum: [null],
      base: [null],
      arbitrum: [null],
    });
    const column = supplyTooltips(zero, zeroShares, chains, okStatus())[0];
    expect(column?.header).toEqual({ label: 'Tracked supply', value: '0', share: undefined });
    expect(column?.rows.map((row) => [row.value, row.share])).toEqual([['0', undefined], ['0', undefined], ['0', undefined]]);
    // A null share at a zero denominator is no gap: no missing-data note, no end-date wording.
    expect(column?.note).toBeUndefined();
    expect(column?.footer).toEqual({ label: 'Oct 9', value: 'end of day' });
  });

  it('takes the total from the response, never a sum of the chain levels', () => {
    // The levels of the bucket sum to 50.00B; the response total is something else and is what shows.
    const columns = suppliedTooltips(levels(), shares(), seriesOf('tokens', days, { all: ['1', '55000000000'] }), chains, okStatus());
    expect(columns[0]?.header.value).toBe('1');
    expect(columns[0]?.header.value).not.toBe('50.00B');
    expect(columns[1]?.header.value).toBe('55.00B');
  });

  it('joins a gap and a delayed chain, the unreconciled tone wins', () => {
    const flagged = seriesOf('tokens', days, {
      ethereum: ['40000000000', null],
      base: ['10000000000', '8250000000'],
      arbitrum: ['0', '2750000000'],
    }, { flagged: { base: [1] } });
    const status = [statusOf('ethereum', 'ok', 6), statusOf('base', 'delayed', 30), statusOf('arbitrum', 'ok', 6)];
    const column = supplyTooltips(flagged, shares(), chains, status)[1];
    expect(column?.note?.text).toBe(`${texts.tags.unreconciledDay} · ${texts.supplyByChain.gapNote('Oct 9')} · Base · 30 h behind`);
    expect(column?.note?.title).toBe(`${texts.tags.unreconciledDay} · ${texts.supplyByChain.gapNote('Oct 9')} · 30 h behind`);
    expect(column?.note?.tone).toBe('unreconciled');
  });
});

// The driver tooltip content: the chain header, the flow rows in order with signs, the net after a
// hairline, `day` as the footer and the quality line. Hand-written from literal input, never from
// the code under test.
const driverDays = ['2026-10-08', '2026-10-09'];
const driverSeries = (): Series => ({
  period: 'day',
  unit: 'tokens',
  buckets: driverDays.map((day) => ({ start: day, end: day, complete: true })),
  lines: [
    { key: 'issuer_mint', flow: 'issuer_mint', values: ['2000000000', '305000000'], unreconciled: [] },
    { key: 'issuer_burn', flow: 'issuer_burn', values: ['0', '377000000'], unreconciled: [] },
    { key: 'bridge_in', flow: 'bridge_in', values: ['0', '85300000'], unreconciled: [] },
    { key: 'bridge_out', flow: 'bridge_out', values: ['0', '88600000'], unreconciled: [] },
    { key: 'net', flow: 'net', values: ['2000000000', '-75000000'], unreconciled: [] },
  ],
});

describe('driver tooltips: rows, signs and footer', () => {
  it('names the actual scope in a weekly footer with no scope header row', () => {
    const series = driverSeries();
    series.period = 'week';
    series.buckets = [{ start: '2026-10-05', end: '2026-10-11', complete: true }];
    for (const line of series.lines) line.values = line.values.slice(0, 1);
    const all = driverTooltips(series, driverDigits(series), 'All chains')[0];
    const chain = driverTooltips(series, driverDigits(series), 'Ethereum')[0];
    expect(all.hideHeader).toBe(true);
    expect(all.rows[0]).toEqual({ label: 'issuer mint', value: '+2B', marker: 'solid-square', flow: 'issuer_mint' });
    expect(all.footer).toEqual({ label: 'Oct 5 – Oct 11', value: 'sum per week, all chains' });
    expect(chain.footer.value).toBe('sum per week, Ethereum');
  });

  it('names the chain, orders mint, burn, bridge in, bridge out and net, and signs every row', () => {
    const series = driverSeries();
    const columns = driverTooltips(series, driverDigits(series), 'Ethereum');
    expect(columns).toHaveLength(2);
    const last = columns[1];
    expect(last?.header).toEqual({ label: 'Ethereum', marker: 'none' });
    expect(last?.splitBefore).toBe(4);
    expect(last?.rows).toEqual([
      { label: 'issuer mint', value: '+305M', marker: 'solid-square', flow: 'issuer_mint' },
      { label: 'issuer burn', value: `${texts.minus}377M`, marker: 'solid-square', flow: 'issuer_burn' },
      { label: 'bridge in', value: '+85.3M', marker: 'hatched-square', flow: 'bridge_in' },
      { label: 'bridge out', value: `${texts.minus}88.6M`, marker: 'hatched-square', flow: 'bridge_out' },
      { label: 'net', value: `${texts.minus}75M`, marker: 'bar', flow: 'net' },
    ]);
    expect(last?.footer).toEqual({ label: 'Oct 9', value: 'sum per day, Ethereum' });
    expect(last?.note).toBeUndefined();
  });

  it('reads one sentence with the date once and day at the end', () => {
    const series = driverSeries();
    const columns = driverTooltips(series, driverDigits(series), 'Ethereum');
    const sentence =
      `Oct 9: issuer mint +305M · issuer burn ${texts.minus}377M · bridge in +85.3M · bridge out ${texts.minus}88.6M · net ${texts.minus}75M · sum per day, Ethereum`;
    expect(tooltipTitle(columns[1])).toBe(sentence);
    expect(tooltipText(columns[1])).toBe(sentence);
  });

  it('shows no data rows with the gap line on a day without data, never 0', () => {
    const series = driverSeries();
    for (const line of series.lines) line.values[0] = null;
    const columns = driverTooltips(series, driverDigits(series), 'Ethereum');
    expect(columns[0]?.rows.map((row) => row.value)).toEqual(['no data', 'no data', 'no data', 'no data', 'no data']);
    expect(columns[0]?.note?.text).toBe('no data · Oct 8');
    expect(tooltipTitle(columns[0])).toBe(
      'Oct 8: issuer mint no data · issuer burn no data · bridge in no data · bridge out no data · net no data · no data · Oct 8 · sum per day, Ethereum',
    );
  });

  it('marks an unreconciled day with the diamond line', () => {
    const series = driverSeries();
    const net = series.lines.find((line) => line.flow === 'net');
    if (net === undefined) throw new Error('no net line');
    net.unreconciled = [1];
    const columns = driverTooltips(series, driverDigits(series), 'Ethereum');
    expect(columns[1]?.note?.text).toBe('◇ unreconciled day');
    expect(columns[0]?.note).toBeUndefined();
  });
});
