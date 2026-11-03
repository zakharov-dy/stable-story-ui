// Compact hand-authored data for contract mutations, independent of supply and the generator.
import type { OverviewDay, OverviewView, Series, Split } from './schemas.ts';

const shift = (day: string, n: number): string => new Date(Date.parse(day) + n * 86_400_000).toISOString().slice(0, 10);
export function publicFixture(slugs: string[], historyStart = '2026-10-01'): { views: Record<'30d' | '90d' | 'all', OverviewView>; day: OverviewDay } {
  const asOf = '2026-10-06';
  const scopes = ['all', ...slugs];
  const zero = { issuer: '0', bridge: '0', issuerShare: null };
  const closed: Split = { quality: { complete: true, operationsComplete: true, unpairedEvents: 0, unreconciledDays: [] }, volume: zero, count: { issuer: 0, bridge: 0, issuerShare: null } };
  const view = (period: OverviewView['period'], from: string): OverviewView => {
    const intervals: Series['buckets'] = [];
    for (let day = from; day <= asOf;) {
      const date = new Date(day);
      let end = day;
      let fullStart = day;
      if (period === 'week') { fullStart = shift(day, -((date.getUTCDay() + 6) % 7)); end = shift(fullStart, 6); }
      if (period === 'month') { fullStart = day.slice(0, 7) + '-01'; date.setUTCMonth(date.getUTCMonth() + 1, 0); end = date.toISOString().slice(0, 10); }
      const actualEnd = end > asOf ? asOf : end;
      intervals.push({ start: day, end: actualEnd, complete: day === fullStart && actualEnd === end && day >= historyStart });
      day = shift(actualEnd, 1);
    }
    const series = (unit: 'tokens' | 'percent', keys: string[], value: (i: number) => string): Series => ({ period, unit, buckets: structuredClone(intervals), lines: keys.map((key, i) => ({ key, ...(key === 'all' ? {} : { chain: key }), values: intervals.map((bucket) => bucket.end < historyStart ? null : value(i)), unreconciled: [] })) });
    const share = (n: number): string => String(Math.round(n * 100 / Math.max(1, slugs.length) * 1_000_000) / 1_000_000);
    return { from, to: asOf, period, noDataChains: intervals.map((bucket) => bucket.end < historyStart ? [...slugs] : []),
      supplyByChain: { level: series('tokens', slugs, () => '100'), share: series('percent', slugs, () => share(1)), total: series('tokens', ['all'], () => String(slugs.length * 100)), stackedLevel: series('tokens', slugs, (i) => String((i + 1) * 100)), stackedShare: series('percent', slugs, (i) => share(i + 1)) },
      drivers: scopes.map((scope) => ({ scope, events: intervals.map((bucket) => bucket.end < historyStart ? null : 0), series: { period, unit: 'tokens', buckets: structuredClone(intervals), lines: ['issuer_mint', 'issuer_burn', 'bridge_in', 'bridge_out', 'net'].map((flow) => ({ key: flow, flow: flow as 'net', values: intervals.map((bucket) => bucket.end < historyStart ? null : '0'), unreconciled: [] })) } })),
      issuerVsBridge: scopes.map((scope) => ({ scope, in: structuredClone(closed), out: structuredClone(closed) })),
    };
  };
  return { views: { '30d': view('day', '2026-09-07'), '90d': view('week', '2026-07-09'), all: view('month', historyStart) }, day: { date: asOf, rows: scopes.map((scope) => ({ scope, events: 0, unreconciled: false, values: { issuer_mint: '0', issuer_burn: '0', bridge_in: '0', bridge_out: '0', net: '0' } })) } };
}
