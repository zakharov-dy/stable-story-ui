// Shared fixtures for the schema invariant tests. Not a test file: vitest does not run it.
import { publicFixture } from './overview.fixtures.ts';
import { expect } from 'vitest';
import type { z } from 'zod';


export const quality = { complete: true, operationsComplete: true, unpairedEvents: 0, unreconciledDays: [] };
export const missing = { complete: false, operationsComplete: false, unpairedEvents: 0, unreconciledDays: [] };
export const unpaired = { ...quality, operationsComplete: false, unpairedEvents: 1 };
export const event = {
  id: 'ethereum:0xabc:12', chain: 'ethereum', flow: 'bridge_in', amount: '100',
  time: '2026-10-06T12:00:00Z', txHash: '0xabc', explorerUrl: 'https://etherscan.io/tx/0xabc',
  unreconciled: false, unpaired: false, bridge: { version: 2, peer: null },
};
export const series = {
  period: 'day', unit: 'tokens', buckets: [{ start: '2026-10-06', end: '2026-10-06', complete: true }],
  lines: [{ key: 'all', values: ['100'], unreconciled: [] }],
};
export const page = { from: '2026-10-01', to: '2026-10-06', quality, items: [event], nextCursor: null };
export const bounds = ['0', '10000', '100000', '1000000', '10000000'];
export const buckets = bounds.map((min, index) => ({
  min, max: bounds[index + 1] ?? null, ops: index === 0 ? 3 : 0, amount: index === 0 ? '30' : '0',
}));
export const flow = { flow: 'issuer_mint', events: 3, ops: 3, amount: '30', mean: '10' };
export const stats = { from: page.from, to: page.to, quality, byFlow: [flow], buckets };
export const record = { kind: 'max_supply', scope: 'ethereum', value: '100', day: '2026-10-06', since: '2026-10-01', quality };
export const status = {
  chain: 'ethereum', state: 'ok', historyStart: '2026-10-01', lastClosedDay: '2026-10-06',
  lastBlock: '100', nextDueAt: '2026-10-08T06:00:00Z', lagHours: 0, lastRun: null,
  reconciliation: { day: '2026-10-06', supply: 'ok', supplyDiff: '0', bridge: 'ok', continuity: 'none' },
  unreconciledDays: [],
};
export const noData = {
  ...status, state: 'no_data', historyStart: null, lastClosedDay: null, lastBlock: null,
  nextDueAt: null, lagHours: null, reconciliation: null,
};
export const kpi = { value: null, changePct: null, spark: [], sparkUnreconciled: [], quality: missing };
export const emptySeries = { period: 'day', unit: 'tokens', buckets: [], lines: [] };
export const emptyOverview = {
  asset: 'usdc', generatedAt: '2026-10-07T01:00:00Z', asOf: null, historyStart: null,
  chains: [{ slug: 'ethereum', name: 'Ethereum', explorerTx: 'https://etherscan.io/tx/{hash}' }],
  header: { days: [], supply: kpi, change1d: kpi, change7d: kpi, issuerMinted7d: kpi, issuerBurned7d: kpi },
  views: { '30d': null, '90d': null, all: null }, day: null,
  largestEvents: { from: null, to: null, quality: missing, items: [], nextCursor: null },
  records: [], status: { chains: [noData] },
};

export const shiftDay = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
export const headerDays = Array.from({ length: 30 }, (_, index) => shiftDay('2026-10-06', index - 29));
export const unknownSplit = { quality: missing, volume: { issuer: null, bridge: null, issuerShare: null }, count: { issuer: null, bridge: null, issuerShare: null } };
// Header cards over `days` through asOf: S(asOf) = 100 is known; the windows of the other cards reach
// before the six-day history, so they are null with missing quality.
export function header(days: string[]) {
  const card = { ...kpi, spark: days.map(() => null) };
  const supply = { ...kpi, value: '100', quality, spark: days.map((_, index) => (index === days.length - 1 ? '100' : null)) };
  return { days, supply, change1d: card, change7d: card, issuerMinted7d: card, issuerBurned7d: card };
}
// Common coverage 2026-10-01…2026-10-06 of the enabled chains, all with history 2026-10-01…2026-10-06.
export function covered(slugs = ['ethereum'], statuses: unknown[] = slugs.map((chain) => ({ ...status, chain }))) {
  return {
    ...emptyOverview, asOf: '2026-10-06', historyStart: '2026-10-01',
    chains: slugs.map((slug) => ({ slug, name: slug, explorerTx: `https://${slug}.example/tx/{hash}` })),
    header: header(headerDays),
    ...publicFixture(slugs),
    // The seven-day feed starts before historyStart, so its range has a gap.
    largestEvents: { from: '2026-09-30', to: '2026-10-06', quality: missing, items: [], nextCursor: null },
    records: [{ ...record, scope: 'all' }],
    status: { chains: statuses },
  };
}
export const coveredOverview = covered();
export function withHeaderDays(days: string[]) {
  return { ...coveredOverview, header: header(days) };
}

export function rejects(schema: z.ZodType, input: unknown, paths: string[]): void {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  expect(result.error?.issues.map((issue) => issue.path.join('.')).sort()).toEqual([...paths].sort());
}
