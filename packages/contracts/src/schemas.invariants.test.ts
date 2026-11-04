import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { ChainStatus, EventRow, EventsPage, EventsStats, Kpi, Overview, Quality, RecordItem, Series, Split } from './schemas.ts';
import {
  quality,
  missing,
  unpaired,
  event,
  series,
  page,
  bounds,
  buckets,
  flow,
  stats,
  record,
  status,
  noData,
  kpi,
  emptySeries,
  emptyOverview,
  shiftDay,
  headerDays,
  unknownSplit,
  covered,
  coveredOverview,
  withHeaderDays,
  rejects,
  fixtureReconciliation,
} from './schemas.invariants.fixtures.ts';

describe('response invariants', () => {
  it.each([
    { ...quality, complete: false }, { ...quality, unpairedEvents: 1 },
    { ...quality, operationsComplete: false },
  ])('rejects inconsistent operation completeness: %j', (input) => rejects(Quality, input, ['operationsComplete']));

  it('keeps reconciled coverage separate from mismatches and grouping', () => {
    expect(Quality.safeParse({ ...quality, unreconciledDays: ['2026-10-06'] }).success).toBe(true);
    expect(Quality.safeParse(unpaired).success).toBe(true);
    expect(Quality.safeParse({ ...missing, unpairedEvents: 1 }).success).toBe(true);
  });

  it('checks bucket intervals and empty series', () => {
    rejects(Series, { ...series, buckets: [{ start: '2026-10-07', end: '2026-10-06', complete: true }] }, ['buckets.0.end']);
    rejects(Series, { ...emptySeries, lines: [{ key: 'all', values: [], unreconciled: [] }] }, ['lines']);
    expect(Series.safeParse({ ...series, lines: [{ ...series.lines[0], values: ['-100'] }] }).success).toBe(true);
    expect(Kpi.safeParse({ ...kpi, value: '-100', changePct: '-1' }).success).toBe(true);
  });

  it.each([
    [{ amount: '-10' }, ['amount']],
    [{ flow: 'issuer_mint' }, ['bridge']],
    [{ bridge: null }, ['bridge']],
    [{ flow: 'issuer_mint', bridge: null, unpaired: true }, ['unpaired']],
    [{ unpaired: true, bridge: { version: 2, peer: { domain: 6, chain: 'base', name: 'Base' } } }, ['bridge.peer']],
  ])('checks event identity/classification relationships: %j', (patch, paths) => rejects(EventRow, { ...event, ...patch }, paths));

  it('keeps paired operations with missing peer and zero-volume events valid', () => {
    expect(EventRow.safeParse(event).success).toBe(true);
    expect(EventRow.safeParse({ ...event, unpaired: true, amount: '0' }).success).toBe(true);
  });

  it('checks page coverage, quality, cursor and event dates', () => {
    const empty = { from: null, to: null, quality: missing, items: [], nextCursor: null };
    rejects(EventsPage, { ...empty, quality }, ['quality']);
    rejects(EventsPage, { ...empty, nextCursor: 'opaque' }, ['nextCursor']);
    rejects(EventsPage, { ...page, from: '2026-10-07', to: '2026-10-08' }, ['items.0.time']);
    expect(EventsPage.safeParse({ ...page, quality: missing }).success).toBe(true);
  });

  it('rejects non-missing quality without a stats range', () => {
    rejects(EventsStats, { from: null, to: null, quality, byFlow: [], buckets: [] }, ['quality']);
  });

  it.each(['events', 'ops', 'amount', 'mean'] as const)('makes %s unknown across a gap', (field) => {
    const input = {
      ...stats, quality: missing,
      byFlow: [{ ...flow, events: null, ops: null, amount: null, mean: null, [field]: field === 'events' || field === 'ops' ? 0 : '0' }],
      buckets: buckets.map((bucket) => ({ ...bucket, ops: null, amount: null })),
    };
    const paths = [`byFlow.0.${field}`];
    rejects(EventsStats, input, paths);
  });

  it.each(['events', 'amount'] as const)('keeps %s known on closed days', (field) => {
    rejects(EventsStats, { ...stats, byFlow: [{ ...flow, [field]: null, ...(field === 'amount' ? { mean: null } : {}) }] }, [`byFlow.0.${field}`]);
  });

  it('requires an operation count when operations are complete', () => {
    rejects(EventsStats, { ...stats, byFlow: [{ ...flow, flow: 'bridge_in', ops: null, mean: null }] }, ['byFlow.0.ops']);
  });

  it.each([
    { events: 3, ops: null, amount: '30' }, // unknown grouping, known volume
    { events: 0, ops: 0, amount: '0' }, // a flow without events
  ])('has no mean for %j', (counts) => {
    const input = {
      ...stats, quality: unpaired,
      byFlow: [{ flow: 'bridge_in', ...counts, mean: null }],
      buckets: buckets.map((bucket) => ({ ...bucket, ops: null, amount: null })),
    };
    expect(EventsStats.safeParse(input).success).toBe(true);
    rejects(EventsStats, { ...input, byFlow: [{ ...input.byFlow[0], mean: '10' }] }, ['byFlow.0.mean']);
  });

  it('checks operation/event cardinality', () => {
    rejects(EventsStats, { ...stats, byFlow: [{ ...flow, flow: 'bridge_in', ops: 4 }] }, ['byFlow.0.ops']);
    rejects(EventsStats, { ...stats, byFlow: [{ ...flow, ops: 2 }] }, ['byFlow.0.ops']);
    rejects(EventsStats, { ...stats, byFlow: [{ ...flow, flow: 'bridge_in', ops: 0, mean: null }] }, ['byFlow.0.ops']);
    rejects(EventsStats, { ...stats, byFlow: [{ flow: 'bridge_in', events: 0, ops: 0, amount: '30', mean: null }] }, ['byFlow.0.amount']);
    expect(EventsStats.safeParse({ ...stats, byFlow: [{ flow: 'bridge_in', events: 2, ops: 1, amount: '0', mean: '0' }] }).success).toBe(true);
  });

  it.each(bounds.map((_, index) => index))('checks the fixed bounds of bucket %i', (index) => {
    for (const field of ['min', 'max'] as const) {
      const changed = structuredClone(buckets);
      changed[index] = { ...changed[index], [field]: '1' };
      rejects(EventsStats, { ...stats, buckets: changed }, [`buckets.${index}.${field}`]);
    }
  });

  it.each(['ops', 'amount'] as const)('ties bucket %s to grouping completeness', (field) => {
    const changed = structuredClone(buckets);
    const unknown = buckets.map((bucket) => ({ ...bucket, ops: null, amount: null }));
    rejects(EventsStats, { ...stats, buckets: changed.map((bucket, index) => index === 0 ? { ...bucket, [field]: null } : bucket) }, [`buckets.0.${field}`]);
    rejects(EventsStats, { ...stats, quality: unpaired, buckets: unknown.map((bucket, index) => index === 0 ? { ...bucket, [field]: field === 'ops' ? 0 : '0' } : bucket) }, [`buckets.0.${field}`]);
  });

  it('rejects negative means without narrowing signed derived changes', () => {
    rejects(EventsStats, { ...stats, byFlow: [{ ...flow, mean: '-10' }] }, ['byFlow.0.mean']);
  });

  it('requires a mean for a known positive operation count', () => {
    rejects(EventsStats, { ...stats, byFlow: [{ ...flow, mean: null }] }, ['byFlow.0.mean']);
  });

  it('keeps issuer counts defined when bridge grouping is unknown', () => {
    rejects(EventsStats, { ...stats, quality: unpaired, byFlow: [{ ...flow, ops: null, mean: null }],
      buckets: buckets.map((bucket) => ({ ...bucket, ops: null, amount: null })) }, ['byFlow.0.ops']);
  });

  it('retains known issuer counts and bridge volume when another grouping is unknown', () => {
    expect(EventsStats.safeParse({
      ...stats, quality: unpaired,
      byFlow: [flow, { flow: 'bridge_in', events: 2, ops: null, amount: '100', mean: null }],
      buckets: buckets.map((bucket) => ({ ...bucket, ops: null, amount: null })),
    }).success).toBe(true);
  });

  it.each(['volume', 'count'] as const)('has no %s share for a zero or unknown denominator', (basis) => {
    rejects(Split, { ...unknownSplit, [basis]: { ...unknownSplit[basis], issuerShare: '1' } }, [`${basis}.issuerShare`]);
    const zero = { quality, volume: { issuer: '0', bridge: '0', issuerShare: null }, count: { issuer: 0, bridge: 0, issuerShare: null } };
    expect(Split.safeParse(zero).success).toBe(true);
    rejects(Split, { ...zero, [basis]: { ...zero[basis], issuerShare: '1' } }, [`${basis}.issuerShare`]);
  });

  it('requires a share for a known nonzero denominator', () => {
    const split = { quality, volume: { issuer: '1', bridge: '1', issuerShare: '50' },
      count: { issuer: 1, bridge: 1, issuerShare: '50' } };
    rejects(Split, { ...split, volume: { ...split.volume, issuerShare: null } }, ['volume.issuerShare']);
    rejects(Split, { ...split, count: { ...split.count, issuerShare: null } }, ['count.issuerShare']);
    rejects(Split, { ...split, volume: { ...split.volume, issuerShare: '100.000001' } }, ['volume.issuerShare']);
    rejects(Split, { ...split, count: { ...split.count, issuerShare: '150' } }, ['count.issuerShare']);
    expect(Split.safeParse({ ...split, volume: { issuer: '1', bridge: '0', issuerShare: '100' } }).success).toBe(true);
  });

  it.each([['volume', 'issuer'], ['volume', 'bridge'], ['count', 'issuer'], ['count', 'bridge']] as const)(
    'ties split %s.%s to coverage', (basis, side) => {
      const known = { quality, volume: { issuer: '1', bridge: '1', issuerShare: '50' }, count: { issuer: 1, bridge: 1, issuerShare: '50' } };
      const gap = { ...unknownSplit, [basis]: { ...unknownSplit[basis], [side]: basis === 'volume' ? '1' : 1 } };
      rejects(Split, gap, [`${basis}.${side}`]);
      const unknown = { ...known, [basis]: { ...known[basis], [side]: null, issuerShare: null } };
      if (basis === 'count' && side === 'bridge') {
        // Unknown bridge grouping keeps volumes and issuer counts.
        expect(Split.safeParse({ ...unknown, quality: unpaired }).success).toBe(true);
        // ... and leaves no bridge count, hence no count share.
        rejects(Split, { ...known, quality: unpaired }, ['count.bridge']);
        rejects(Split, { ...unknown, quality: unpaired, count: { ...unknown.count, issuerShare: '50' } }, ['count.issuerShare']);
      }
      rejects(Split, unknown, [`${basis}.${side}`]);
    },
  );

  it('ties record values to dates and their search range', () => {
    rejects(RecordItem, { ...record, day: null }, ['day']);
    rejects(RecordItem, { ...record, value: null }, ['day']);
    rejects(RecordItem, { ...record, day: '2026-09-30' }, ['day']);
    rejects(RecordItem, { ...record, kind: 'largest_event', quality: unpaired }, ['value']);
    rejects(RecordItem, { ...record, kind: 'largest_event', event: { ...event, amount: '99' } }, ['event.amount']);
    rejects(RecordItem, { ...record, kind: 'largest_event', event: { ...event, time: '2026-10-05T12:00:00Z' } }, ['event.time']);
    const baseEvent = { ...event, id: 'base:0xabc:12', chain: 'base' };
    rejects(RecordItem, { ...record, kind: 'largest_event', event: baseEvent }, ['event.chain']);
    expect(RecordItem.safeParse({ ...record, kind: 'largest_event', scope: 'all', event: baseEvent }).success).toBe(true);
    expect(RecordItem.safeParse({ ...record, value: null, day: null }).success).toBe(true);
  });

  it.each(['historyStart', 'lastClosedDay', 'lastBlock', 'nextDueAt', 'lagHours', 'reconciliation'] as const)(
    'ties %s to closed-chain coverage', (field) => {
      const extra = { ...noData, [field]: status[field] };
      const extraPaths = [field];
      if (field === 'reconciliation') extraPaths.push('reconciliation.day' as typeof field);
      rejects(ChainStatus, extra, extraPaths);
      const absent = { ...status, [field]: null };
      rejects(ChainStatus, absent, field === 'lastClosedDay' ? [field, 'reconciliation.day'] : [field]);
    },
  );

  it('checks status date and reconciliation relationships', () => {
    rejects(ChainStatus, { ...noData, unreconciledDays: ['2026-10-06'] }, ['unreconciledDays']);
    rejects(ChainStatus, { ...status, historyStart: '2026-10-07' }, ['historyStart']);
    rejects(ChainStatus, { ...status, reconciliation: { ...status.reconciliation, day: '2026-10-05' } }, ['reconciliation.day']);
    rejects(ChainStatus, { ...status, reconciliation: { ...status.reconciliation, supplyDiff: '-1' } }, ['reconciliation.supplyDiff']);
    rejects(ChainStatus, { ...status, reconciliation: { ...status.reconciliation, bridge: 'mismatch' } }, ['state']);
    rejects(ChainStatus, { ...status, state: 'unreconciled' }, ['state']);
    expect(ChainStatus.safeParse({ ...noData, lastRun: { finishedAt: '2026-10-07T01:00:00Z', status: 'failed', toBlock: null } }).success).toBe(true);
    expect(ChainStatus.safeParse({ ...status, state: 'delayed', lagHours: 30, reconciliation: { ...status.reconciliation, bridge: 'mismatch' } }).success).toBe(true);
  });

  it('derives the deadline and the delayed state from the last closed day and the lag', () => {
    rejects(ChainStatus, { ...status, nextDueAt: '2026-10-08T00:00:00Z' }, ['nextDueAt']);
    rejects(ChainStatus, { ...status, nextDueAt: '2026-10-07T06:00:00Z' }, ['nextDueAt']);
    expect(ChainStatus.safeParse({ ...status, nextDueAt: '2026-10-08T06:00:00.000Z' }).success).toBe(true);
    rejects(ChainStatus, { ...status, lagHours: -1 }, ['lagHours']);
    rejects(ChainStatus, { ...status, lagHours: 30 }, ['state']);
    rejects(ChainStatus, { ...status, state: 'unreconciled', lagHours: 31, reconciliation: { ...status.reconciliation, continuity: 'mismatch' } }, ['state']);
    rejects(ChainStatus, { ...status, state: 'delayed', lagHours: 29 }, ['state']);
    expect(ChainStatus.safeParse({ ...status, lagHours: 29 }).success).toBe(true);
    expect(ChainStatus.safeParse({ ...status, state: 'delayed', lagHours: 30 }).success).toBe(true);
  });

  it('ties common coverage dates together', () => {
    rejects(Overview, { ...emptyOverview, historyStart: '2026-10-01' }, ['historyStart']);
    rejects(Overview, { ...coveredOverview, historyStart: null }, ['historyStart']);
    rejects(Overview, { ...coveredOverview, historyStart: '2026-10-07' }, ['historyStart']);
  });

  it('has no header days or sparks without common coverage', () => {
    const days = ['2026-10-06'];
    const header = { ...emptyOverview.header, days };
    for (const card of ['supply', 'change1d', 'change7d', 'issuerMinted7d', 'issuerBurned7d'] as const) {
      header[card] = { ...kpi, spark: ['0'] } as typeof kpi;
    }
    rejects(Overview, { ...emptyOverview, header }, ['header.days', ...['supply', 'change1d', 'change7d', 'issuerMinted7d', 'issuerBurned7d'].map((card) => `header.${card}.spark`)]);
  });

  it.each(['value', 'changePct'] as const)('has no card %s without common coverage', (field) => {
    rejects(Overview, { ...emptyOverview, header: { ...emptyOverview.header, change1d: { ...kpi, [field]: '1' } } }, [`header.change1d.${field}`]);
  });

  it('uses missing-range card quality', () => {
    rejects(Overview, { ...emptyOverview, header: { ...emptyOverview.header, change1d: { ...kpi, quality } } }, ['header.change1d.quality']);
  });

  it('has no chart arrays without common coverage', () => {
    rejects(Overview, { ...emptyOverview, records: [record] }, ['records']);    rejects(Overview, { ...emptyOverview, largestEvents: page }, ['largestEvents.from']);
  });

  it('uses thirty consecutive UTC header days through asOf', () => {
    expect(Overview.safeParse(coveredOverview).success).toBe(true);
    rejects(Overview, withHeaderDays(headerDays.slice(1)), ['header.days']);
    rejects(Overview, withHeaderDays(headerDays.map((day, index) => index === 0 ? headerDays[1] : day)), ['header.days']);
    rejects(Overview, withHeaderDays(headerDays.map((day) => shiftDay(day, 1))), ['header.days']);
  });

  // Refinements run after format issues; days that Date.parse accepts but cannot shift (extended
  // years) or rejects must come back as validation issues, not exceptions.
  it.each(['garbage', '+275760-09-13', '-000001-01-01', '+002026-10-06', '275760-09-13', '2026-10-06T00:00:00Z', '0000-01-01'])(
    'reports the malformed day %s instead of throwing', (day) => {
      for (const [schema, input, path] of [
        [Overview, { ...coveredOverview, asOf: day }, 'asOf'],
        [Overview, { ...coveredOverview, historyStart: day }, 'historyStart'],
        [Overview, { ...emptyOverview, asOf: day, historyStart: day }, 'asOf'],
        [ChainStatus, { ...status, lastClosedDay: day }, 'lastClosedDay'],
        [ChainStatus, { ...status, historyStart: day, lastClosedDay: day, reconciliation: { ...status.reconciliation, day } }, 'lastClosedDay'],
      ] as const) {
        const result = (schema as z.ZodType).safeParse(input);
        expect(result.success).toBe(false);
        if (day !== '0000-01-01') expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(path);
      }
    },
  );

  it('keeps the id of a row on its chain and transaction', () => {
    rejects(EventRow, { ...event, id: 'base:0xabc:12' }, ['id']);
    rejects(EventRow, { ...event, id: 'ethereum:0xabd:12' }, ['id']);
    rejects(EventRow, { ...event, id: 'ethereum:0xabc' }, ['id']);
    rejects(EventRow, { ...event, id: 'Ethereum:0xabc:12' }, ['id']);
    // The suffix (logIndex or opLogIndex) is not carried by the DTO.
    expect(EventRow.safeParse({ ...event, id: 'ethereum:0xabc:7' }).success).toBe(true);
    // The hash may differ in case between the id and the field.
    expect(EventRow.safeParse({ ...event, txHash: '0xABC', id: 'ethereum:0xabc:3' }).success).toBe(true);
    expect(EventRow.safeParse({ ...event, id: 'ethereum:0xAbC:3' }).success).toBe(true);
    rejects(EventRow, { ...event, txHash: '0xABC', id: 'ethereum:0xabd:3' }, ['id']);
  });

  const unpairedRow = { ...event, id: 'ethereum:0xabc:5', unpaired: true };
  it('counts unpaired rows and mismatched days within the page quality', () => {
    const onePaired = { ...page, quality: unpaired, items: [unpairedRow, event] };
    expect(EventsPage.safeParse(onePaired).success).toBe(true);
    rejects(EventsPage, { ...onePaired, items: [unpairedRow, { ...unpairedRow, id: 'ethereum:0xabc:6' }] }, ['quality.unpairedEvents']);
    rejects(EventsPage, { ...page, items: [unpairedRow] }, ['quality.unpairedEvents']);
    rejects(EventsPage, { ...page, quality: { ...quality, unreconciledDays: ['2026-09-30'] } }, ['quality.unreconciledDays.0']);
    rejects(EventsPage, { ...page, items: [{ ...event, unreconciled: true }] }, ['items.0.unreconciled']);
    expect(EventsPage.safeParse({ ...page, quality: { ...quality, unreconciledDays: ['2026-10-06'] }, items: [{ ...event, unreconciled: true }] }).success).toBe(true);
    // A mismatch on another day or chain needs no flagged row.
    expect(EventsPage.safeParse({ ...page, quality: { ...quality, unreconciledDays: ['2026-10-01'] } }).success).toBe(true);
  });

  it.each([
    [0, 3, '29999.999999', true], [0, 3, '30000', false], [0, 1, '0', true],
    [1, 2, '20000', true], [1, 2, '19999.999999', false], [1, 2, '199999.999999', true], [1, 2, '200000', false],
    [4, 1, '10000000', true], [4, 1, '9999999.999999', false], [4, 2, '900000000000000000000', true],
    [2, 0, '0', true], [2, 0, '5', false],
  ] as const)('bounds bucket %i with %i operations and volume %s', (index, ops, amount, valid) => {
    const changed = buckets.map((bucket, i) => (i === index ? { ...bucket, ops, amount } : bucket));
    if (valid) expect(EventsStats.safeParse({ ...stats, buckets: changed }).success).toBe(true);
    else rejects(EventsStats, { ...stats, buckets: changed }, [`buckets.${index}.amount`]);
  });

  it.each(['1e5', '-', '.5', '0x10', '१२'])('reports a malformed bucket volume %s without throwing', (amount) => {
    const changed = buckets.map((bucket, i) => (i === 0 ? { ...bucket, amount } : bucket));
    const result = EventsStats.safeParse({ ...stats, buckets: changed });
    expect(result.success).toBe(false);
    expect([...new Set(result.error?.issues.map((issue) => issue.path.join('.')))]).toEqual(['buckets.0.amount']);
  });

  it('ties header cards to their last spark point and the supply on asOf', () => {
    const { supply } = coveredOverview.header;
    rejects(Overview, { ...coveredOverview, header: { ...coveredOverview.header, supply: { ...supply, value: null, spark: supply.spark.map(() => null) } } }, ['header.supply.value']);
    rejects(Overview, { ...coveredOverview, header: { ...coveredOverview.header, supply: { ...supply, value: '101' } } }, ['header.supply.spark.29']);
    const change1d = { ...coveredOverview.header.change1d, value: '5', quality };
    rejects(Overview, { ...coveredOverview, header: { ...coveredOverview.header, change1d } }, ['header.change1d.spark.29']);
    const spark = change1d.spark.map((_, index) => (index === 29 ? '5' : null));
    expect(Overview.safeParse({ ...coveredOverview, header: { ...coveredOverview.header, change1d: { ...change1d, spark } } }).success).toBe(true);
  });

  it('marks a feed window before historyStart incomplete', () => {
    rejects(Overview, { ...coveredOverview, largestEvents: { ...coveredOverview.largestEvents, quality } }, ['largestEvents.quality.complete']);
    const feedQuality = { ...missing, unpairedEvents: 1 };
    expect(Overview.safeParse({ ...coveredOverview, largestEvents: { ...coveredOverview.largestEvents, quality: feedQuality, items: [unpairedRow] } }).success).toBe(true);

  });

  it('lists each enabled chain once and has no coverage without one', () => {
    rejects(Overview, covered([], []), ['asOf']);
    expect(Overview.safeParse({ ...emptyOverview, chains: [], status: { chains: [] }, reconciliation: fixtureReconciliation([], []) }).success).toBe(true);
    rejects(Overview, covered(['ethereum', 'ethereum'], [status]), ['chains.1.slug']);
  });

  it('never puts changePct on the supply card', () => {
    rejects(Overview, { ...coveredOverview, header: { ...coveredOverview.header, supply: { ...coveredOverview.header.supply, changePct: '1' } } }, ['header.supply.changePct']);
  });

  it('keeps per-chain data when there is no common coverage', () => {
    const chains = [...emptyOverview.chains, { slug: 'base', name: 'Base', explorerTx: 'https://basescan.org/tx/{hash}' }];
    const statuses = [status, { ...noData, chain: 'base' }];
    expect(Overview.safeParse({ ...emptyOverview, chains, status: { chains: statuses }, reconciliation: fixtureReconciliation(['ethereum', 'base'], statuses) }).success).toBe(true);
    const disjoint = [status, { ...status, chain: 'base', historyStart: '2026-10-07', lastClosedDay: '2026-10-08',
      nextDueAt: '2026-10-10T06:00:00Z', reconciliation: { ...status.reconciliation, day: '2026-10-08' } }];
    expect(Overview.safeParse({ ...emptyOverview, chains, status: { chains: disjoint }, reconciliation: fixtureReconciliation(['ethereum', 'base'], disjoint) }).success).toBe(true);
  });

  it('derives common coverage from the statuses of the enabled chains', () => {
    rejects(Overview, { ...emptyOverview, status: { chains: [status] } }, ['asOf', 'historyStart']);
    rejects(Overview, covered(['ethereum'], [noData]), ['asOf', 'historyStart']);
    const later = { ...status, lastClosedDay: '2026-10-09', nextDueAt: '2026-10-11T06:00:00Z', reconciliation: { ...status.reconciliation, day: '2026-10-09' } };
    rejects(Overview, covered(['ethereum'], [later]), ['asOf']);
    rejects(Overview, covered(['ethereum'], [{ ...status, historyStart: '2026-09-01' }]), ['historyStart']);
    // The minimum and maximum across chains.
    expect(Overview.safeParse(covered(['ethereum', 'base'], [later, { ...status, chain: 'base' }])).success).toBe(true);
  });

  it('has exactly one status per enabled chain', () => {
    const two = ['ethereum', 'base'];
    expect(Overview.safeParse(covered(two, [{ ...status, chain: 'base' }, status])).success).toBe(true);
    // Coverage is not derived from an inconsistent status list, so each case reports only the list.
    rejects(Overview, covered(two, [status]), ['status.chains']);
    rejects(Overview, covered(['ethereum'], [status, status]), ['status.chains.1.chain']);
    rejects(Overview, covered(['ethereum'], [status, { ...noData, chain: 'solana' }]), ['status.chains.1.chain']);
    rejects(Overview, covered(['ethereum'], [{ ...status, chain: 'solana' }]), ['status.chains', 'status.chains.0.chain']);
    rejects(Overview, { ...emptyOverview, status: { chains: [] } }, ['status.chains']);
  });

  it('places every default view relative to the common coverage', () => {
    expect(Overview.safeParse(covered(['ethereum', 'base'])).success).toBe(true);
    const base = coveredOverview;
    rejects(Overview, { ...base, largestEvents: { ...base.largestEvents, from: '2026-10-01' } }, ['largestEvents.from']);
    rejects(Overview, { ...base, largestEvents: { ...base.largestEvents, to: '2026-10-05' } }, ['largestEvents.to']);
    rejects(Overview, { ...base, records: [{ ...record, since: '2026-09-30' }] }, ['records.0.since']);
    rejects(Overview, { ...base, records: [{ ...record, day: '2026-10-07' }] }, ['records.0.day']);
    rejects(Overview, { ...base, records: [{ ...record, scope: 'solana' }] }, ['records.0.scope']);
  });

  it('accepts the empty state and rejects views without common coverage', () => {
    expect(Overview.safeParse(emptyOverview).success).toBe(true);
    rejects(Overview, { ...emptyOverview, views: { ...emptyOverview.views, all: coveredOverview.views.all } }, ['views.all']);
  });
});
