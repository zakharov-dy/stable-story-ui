import { createMockClient, type MockState, type Overview } from '@app/contracts';
import { describe, expect, it } from 'vitest';
import { withLastDay } from '../test-support/last-day.ts';
import { type Term, barsFor, chainDay, signedValue, splitCompact, splitFull, TERMS } from '@app/view';
import { assetName, termView } from '../view.ts';

const overviewOf = (state: MockState): Promise<Overview> => createMockClient(state).overview();

/** The last value of a driver line, read straight from the series (the expectation does not use chainDay). */
function lastValue(overview: Overview, chain: string, term: Term): string | null {
  return overview.day?.rows.find((row) => row.scope === chain)?.values[term] ?? null;
}

/** A copy whose chains have different, recognisable last-day values. */
async function distinct(): Promise<Overview> {
  const overview = structuredClone(await overviewOf('ok'));
  const set = (chain: string, values: Record<Term, string>) => {
    const row = overview.day?.rows.find((row) => row.scope === chain);
    if (row) row.values = values;
  };
  set('ethereum', { issuer_mint: '600', issuer_burn: '500', bridge_in: '80', bridge_out: '130', net: '50' });
  set('base', { issuer_mint: '90', issuer_burn: '40', bridge_in: '120', bridge_out: '50', net: '120' });
  set('arbitrum', { issuer_mint: '30', issuer_burn: '20', bridge_in: '40', bridge_out: '30', net: '20' });
  return overview;
}

describe('chainDay', () => {
  it.each(['ok', 'delayed', 'unreconciled', 'empty-day'] as const)('takes the last day of each chain, asOf, in %s', async (state) => {
    const overview = await overviewOf(state);
    expect(overview.asOf).not.toBeNull();
    for (const chain of overview.chains) {
      const day = chainDay(overview, chain.slug);
      expect(day.day).toBe(overview.asOf);
      expect(day.known).toBe(true);
      for (const term of TERMS) expect(day.values[term]).toBe(lastValue(overview, chain.slug, term));
    }
  });

  it('keeps every chain on its own values and never adds the chains together', async () => {
    const overview = await distinct();
    const days = overview.chains.map((chain) => chainDay(overview, chain.slug));
    expect(days.map((day) => day.values.issuer_mint)).toEqual(['600', '90', '30']);
    expect(days.map((day) => day.values.net)).toEqual(['50', '120', '20']);
    const everything = new Set(days.flatMap((day) => TERMS.map((term) => day.values[term])));
    for (const total of ['720', '560', '240', '210', '190']) expect(everything.has(total)).toBe(false); // sums over the chains
    // The rendered terms of a chain are its own, too.
    expect(termView('issuer_mint', days[1]?.values.issuer_mint ?? null).full).toBe('+90');
  });

  it('flags the day from the API list of the last point, not from the values', async () => {
    const overview = await overviewOf('unreconciled');
    const flagged = overview.chains.filter((chain) => chainDay(overview, chain.slug).unreconciled).map((chain) => chain.slug);
    const expected = overview.views['30d']!.drivers
      .filter((driver) => overview.chains.some((chain) => chain.slug === driver.scope))
      .filter((driver) => driver.series.lines.some((line) => line.unreconciled.includes(driver.series.buckets.length - 1)))
      .map((driver) => driver.scope);
    expect(flagged).toEqual(expected);
    expect(flagged).toEqual(['ethereum']);
    const ok = await overviewOf('ok');
    expect(ok.chains.some((chain) => chainDay(ok, chain.slug).unreconciled)).toBe(false);
  });

  it('has no value when a term is null: null is not 0', async () => {
    const overview = structuredClone(await overviewOf('ok'));
    const chain = overview.chains[0]?.slug ?? '';
    overview.day!.rows.find((row) => row.scope === chain)!.values.bridge_in = null;
    const day = chainDay(overview, chain);
    expect(day.known).toBe(false);
    expect(day.values.bridge_in).toBeNull();
    expect(day.values.issuer_mint).not.toBeNull();
    expect(termView('bridge_in', day.values.bridge_in)).toMatchObject({ compact: 'no data', full: 'no data', missing: true });
  });

  it('uses the day block independently of historical series and ignores absent chains', async () => {
    const overview = structuredClone(await overviewOf('ok'));
    overview.views = { '30d': null, '90d': null, all: null };
    expect(chainDay(overview, 'ethereum')).toMatchObject({ day: '2026-10-09', known: true, events: overview.day?.rows.find((row) => row.scope === 'ethereum')?.events });
    expect(chainDay(overview, 'nowhere')).toMatchObject({ day: null, known: false, events: null });
  });

  it('ignores the all-scope driver entry', async () => {
    const overview = await overviewOf('ok');
    expect(overview.views['30d']!.drivers[0]?.scope).toBe('all');
    expect(chainDay(overview, 'all')).toMatchObject({ day: null, known: false, events: null, values: { issuer_mint: null } });
  });

  it('carries the event count of the card day, read from the same bucket as the values', async () => {
    const ok = await overviewOf('ok');
    const chains = ok.views['30d']!.drivers.filter((driver) => ok.chains.some((chain) => chain.slug === driver.scope));
    for (const driver of chains) expect(chainDay(ok, driver.scope).events).toBe(driver.events.at(-1));
    const empty = withLastDay(ok, 'arbitrum', { events: 0, flows: 'zero' });
    expect(chainDay(empty, 'arbitrum')).toMatchObject({ known: true, events: 0 });
    const zeroAmount = withLastDay(ok, 'arbitrum', { events: 2, flows: 'zero' });
    expect(chainDay(zeroAmount, 'arbitrum')).toMatchObject({ known: true, events: 2 });
    const open = withLastDay(ok, 'arbitrum', { events: null, flows: 'unknown' });
    expect(chainDay(open, 'arbitrum')).toMatchObject({ known: false, events: null });
    expect(chainDay(ok, 'ethereum').events).not.toBe(0);
  });

  it('does not take the count of another chain or day', async () => {
    const ok = await overviewOf('ok');
    const overview = withLastDay(ok, 'base', { events: 0, flows: 'zero' });
    expect(chainDay(overview, 'base').events).toBe(0);
    expect(chainDay(overview, 'ethereum').events).toBe(ok.views['30d']!.drivers.find((driver) => driver.scope === 'ethereum')?.events.at(-1));
    // The empty day of `empty-day` is an earlier bucket, not the card's day.
    const earlier = await overviewOf('empty-day');
    const chains = earlier.views['30d']!.drivers.filter((driver) => earlier.chains.some((chain) => chain.slug === driver.scope));
    for (const driver of chains) expect(chainDay(earlier, driver.scope).events).toBe(5);
  });
});

describe('signs', () => {
  it('shows outflows as negative, inflows and net as they are, and zero without a sign', () => {
    expect(signedValue('issuer_burn', '498.5')).toBe('-498.5');
    expect(signedValue('bridge_out', '0')).toBe('0');
    expect(signedValue('bridge_in', '84')).toBe('84');
    expect(signedValue('net', '-5')).toBe('-5');
    expect(signedValue('bridge_in', null)).toBeNull();
    expect(termView('issuer_burn', '498210500')).toMatchObject({ compact: '−498.21M', full: '−498,210,500' });
    expect(termView('issuer_mint', '612400000')).toMatchObject({ compact: '+612.40M', full: '+612,400,000' });
    expect(termView('bridge_out', '0')).toMatchObject({ compact: '0', full: '0' });
  });
});

describe('barsFor: one scale for all chains', () => {
  const day = (chain: string, values: Record<Term, string | null>) => ({ chain, day: '2026-10-09', values, known: TERMS.every((term) => values[term] !== null), unreconciled: false, events: null });
  const flows = (mint: string, burn: string, bin: string, bout: string, net: string): Record<Term, string> => ({
    issuer_mint: mint, issuer_burn: burn, bridge_in: bin, bridge_out: bout, net,
  });

  it('measures every chain against the largest in/out total of any chain', () => {
    const [big, small] = barsFor([day('a', flows('600', '500', '100', '200', '0')), day('b', flows('30', '10', '20', '10', '30'))]);
    // Largest total is chain a's inflow, 700.
    expect(big?.issuerIn).toBeCloseTo(600 / 700, 3);
    expect(big?.bridgeIn).toBeCloseTo(100 / 700, 3);
    expect(big?.issuerOut).toBeCloseTo(500 / 700, 3);
    expect(big?.bridgeOut).toBeCloseTo(200 / 700, 3);
    // The small chain is small on the same scale (a per-chain scale would make it fill the bar).
    expect(small?.issuerIn).toBeCloseTo(30 / 700, 3);
    expect((small?.issuerIn ?? 0) + (small?.bridgeIn ?? 0)).toBeLessThan(0.1);
    expect(small?.net).toBeCloseTo(30 / 700, 3);
  });

  it('is exact for amounts beyond 2^53 and with different numbers of decimals', () => {
    const [a, b] = barsFor([
      day('a', flows('100000000000000000000000000000.5', '0', '0', '0', '100000000000000000000000000000.5')),
      day('b', flows('50000000000000000000000000000.25', '0', '0', '0', '50000000000000000000000000000.25')),
    ]);
    expect(a?.issuerIn).toBe(1);
    expect(b?.issuerIn).toBeCloseTo(0.5, 3);
    expect(a?.inTotal).toBe('100000000000000000000000000000.5');
  });

  it('leaves out a chain with an unknown term: no bars for it, and it does not set the scale', () => {
    const unknown = day('x', { ...flows('900', '0', '0', '0', '900'), bridge_in: null });
    const [first, second] = barsFor([unknown, day('b', flows('100', '0', '0', '0', '100'))]);
    expect(first).toBeNull();
    expect(second?.issuerIn).toBe(1);
  });

  it('draws nothing but zeros when every flow is zero', () => {
    const [zero] = barsFor([day('a', flows('0', '0', '0', '0', '0'))]);
    expect(zero).toMatchObject({ issuerIn: 0, bridgeIn: 0, issuerOut: 0, bridgeOut: 0, net: 0, inTotal: '0', outTotal: '0' });
  });

  it('keeps the order of the input and returns nothing for no chains', () => {
    expect(barsFor([])).toEqual([]);
  });
});

describe('helpers', () => {
  it('splits a compact amount and an exact amount for styling', () => {
    expect(splitCompact('41.86B')).toEqual({ number: '41.86', suffix: 'B' });
    expect(splitCompact('+218.68M')).toEqual({ number: '+218.68', suffix: 'M' });
    expect(splitCompact('12,045')).toEqual({ number: '12,045', suffix: '' });
    expect(splitCompact('no data')).toEqual({ number: 'no data', suffix: '' });
    expect(splitFull('41,862,503,117.42')).toEqual({ whole: '41,862,503,117', fraction: '.42' });
    expect(splitFull('12,045')).toEqual({ whole: '12,045', fraction: '' });
  });

  it('names the asset', () => {
    expect(assetName({ asset: 'usdc' })).toBe('USDC');
    expect(assetName({ asset: 'eurc' })).toBe('EURC');
  });
});
