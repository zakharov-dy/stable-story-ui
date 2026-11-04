// Overview-only public selections. The general /series contract keeps its existing semantics.
import type { z } from 'zod';
import type { Overview, OverviewView, Series } from './schemas.ts';

type Path = PropertyKey[];
const DAY = 86_400_000;
const shift = (date: string, n: number): string => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const check = (ctx: z.RefinementCtx, valid: boolean, path: Path, message: string): void => {
  if (!valid) ctx.addIssue({ code: 'custom', path, message });
};
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const FLOWS = ['issuer_mint', 'issuer_burn', 'bridge_in', 'bridge_out', 'net'] as const;

// Amount precision is arbitrary; derived ratios alone round to six places.
const precision = (values: (string | number | null | undefined)[]): number => Math.max(6, ...values.map((value) => typeof value === 'string' ? (value.split('.')[1]?.length ?? 0) : 0));
function units(value: string | number | null | undefined, scale = 6): bigint | null {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value)) return null;
  const negative = value.startsWith('-');
  const [whole = '', frac = ''] = (negative ? value.slice(1) : value).split('.');
  const result = BigInt(whole + frac.padEnd(scale, '0'));
  return negative ? -result : result;
}
function ratio(part: bigint | null, total: bigint | null): bigint | null {
  return part === null || total === null || total === 0n ? null : (part * 100_000_000n * 2n + total) / (2n * total);
}

// Validation recognises the canonical interval; only metrics builds the production selection.
function calendarEnd(start: string, period: OverviewView['period']): string {
  if (period === 'day') return start;
  if (period === 'week') return shift(start, 6 - ((new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7));
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
}
function cut(bucket: Series['buckets'][number], period: OverviewView['period']): boolean {
  const start = new Date(`${bucket.start}T00:00:00Z`);
  return bucket.end !== calendarEnd(bucket.start, period) ||
    (period === 'week' && start.getUTCDay() !== 1) || (period === 'month' && start.getUTCDate() !== 1);
}
function datesValid(from: string, to: string): boolean {
  return /^\d{4}-\d\d-\d\d$/.test(from) && /^\d{4}-\d\d-\d\d$/.test(to) &&
    Number.isFinite(Date.parse(`${from}T00:00:00Z`)) && Number.isFinite(Date.parse(`${to}T00:00:00Z`)) && from <= to;
}

function seriesIssues(series: Series, view: OverviewView, keys: string[], unit: string, path: Path, ctx: z.RefinementCtx): void {
  check(ctx, series.period === view.period, [...path, 'period'], 'The series declares the view step');
  check(ctx, series.unit === unit, [...path, 'unit'], 'Unexpected public view unit');
  check(ctx, same(series.lines.map((line) => line.key), keys), [...path, 'lines'], 'Canonical line keys and order required');
  series.lines.forEach((line, i) => {
    const flow = keys[0] === 'issuer_mint';
    check(ctx, flow ? line.flow === line.key && line.chain === undefined : line.flow === undefined && line.chain === (line.key === 'all' ? undefined : line.key),
      [...path, 'lines', i], 'Canonical chain/flow identity required');
  });
  if (!datesValid(view.from, view.to)) return;
  let next = view.from;
  let valid = series.buckets.length > 0;
  for (const bucket of series.buckets) {
    if (!datesValid(bucket.start, bucket.end)) { valid = false; break; }
    const end = calendarEnd(next, view.period);
    const expectedEnd = end < view.to ? end : view.to;
    valid &&= bucket.start === next && bucket.end === expectedEnd && bucket.end <= view.to;
    if (cut(bucket, view.period)) check(ctx, !bucket.complete, [...path, 'buckets'], 'A cut calendar interval is partial');
    next = shift(bucket.end, 1);
  }
  valid &&= series.buckets.at(-1)?.end === view.to;
  check(ctx, valid, [...path, 'buckets'], 'Every calendar interval intersecting the window appears once, in order');
}

function flagIssues(overview: Omit<Overview, 'reconciliation'>, series: Series, scopes: string[], path: Path, ctx: z.RefinementCtx): void {
  const days = overview.status.chains.filter((status) => scopes.includes(status.chain)).flatMap((status) => status.unreconciledDays);
  series.lines.forEach((line, index) => {
    const chainDays = series.unit === 'percent' || line.chain === undefined ? days : path.at(-1) === 'stackedLevel' ?
      overview.status.chains.filter((status) => scopes.slice(0, index + 1).includes(status.chain)).flatMap((status) => status.unreconciledDays) :
      overview.status.chains.find((status) => status.chain === line.chain)?.unreconciledDays ?? [];
    const expected = series.buckets.flatMap((bucket, at) => chainDays.some((day) => day >= bucket.start && day <= bucket.end) ? [at] : []);
    check(ctx, same(line.unreconciled, expected), [...path, 'lines', index, 'unreconciled'], 'Flag every bucket including an unreconciled day');
  });
}

function valuesIssues(view: OverviewView, absent: string[][], path: Path, ctx: z.RefinementCtx): void {
  const { level, share, total, stackedLevel, stackedShare } = view.supplyByChain;
  const scale = precision([level, total, stackedLevel].flatMap((series) => series.lines.flatMap((line): (string | number | null)[] => line.values)));
  const values = (series: Series, line: number, at: number): bigint | null => units(series.lines[line]?.values[at], series.unit === 'percent' ? 6 : scale);
  level.buckets.forEach((_bucket, at) => {
    const parts = level.lines.map((_line, i) => values(level, i, at));
    const present = parts.filter((_part, i) => !absent[at]?.includes(level.lines[i].key));
    const known = present.length > 0 && present.every((part) => part !== null);
    const sum = known ? present.reduce<bigint>((sum, part) => sum + (part ?? 0n), 0n) : null;
    check(ctx, values(total, 0, at) === sum, [...path, 'total', 'lines', 0, 'values', at], 'Total is the exact known chain sum');
    let cumulative = 0n;
    level.lines.forEach((_line, i) => {
      const part = parts[i] ?? null;
      check(ctx, !absent[at]?.includes(_line.key) || part === null, [...path, 'level', 'lines', i, 'values', at], 'A chain before its coverage has no level');
      check(ctx, part === null || part >= 0n, [...path, 'level', 'lines', i, 'values', at], 'Levels are nonnegative');
      check(ctx, values(share, i, at) === ratio(part, sum), [...path, 'share', 'lines', i, 'values', at], 'Share uses the ready total, with a nullable denominator');
      cumulative += part ?? 0n;
      check(ctx, values(stackedLevel, i, at) === (known && part !== null ? cumulative : null), [...path, 'stackedLevel', 'lines', i, 'values', at], 'Ready cumulative level boundary required');
      check(ctx, values(stackedShare, i, at) === ratio(known && part !== null ? cumulative : null, sum), [...path, 'stackedShare', 'lines', i, 'values', at], 'Cumulative share is the ratio of cumulative levels, rounded once');
    });
  });
}

function driverValues(series: Series, path: Path, ctx: z.RefinementCtx): void {
  series.buckets.forEach((bucket, at) => {
    const scale = precision(series.lines.map((line) => line.values[at]));
    const values = series.lines.map((line) => units(line.values[at], scale));
    if (values.length !== 5) return;
    const known = values.every((value) => value !== null);
    if (known) {
      const [mint = 0n, burn = 0n, incoming = 0n, outgoing = 0n, net] = values;
      check(ctx, net === mint - burn + incoming - outgoing, [...path, 'series', 'lines', 4, 'values', at], 'Net equals the four signed flows');
      values.slice(0, 4).forEach((value, i) => check(ctx, value === null || value >= 0n, [...path, 'series', 'lines', i, 'values', at], 'Flows are nonnegative'));
    }
    check(ctx, !bucket.complete || known, [...path, 'series', 'buckets', at, 'complete'], 'A bucket with missing flows cannot be complete');
    // Null/zero/event presence and array lengths are owned by OverviewDriver.
  });
}

function aggregateIssues(view: OverviewView, absent: string[][], starts: Map<string, string>, path: Path, ctx: z.RefinementCtx): void {
  const { level } = view.supplyByChain;
  const all = view.drivers.find((driver) => driver.scope === 'all');
  level.buckets.forEach((bucket, at) => {
    if (!datesValid(bucket.start, bucket.end)) return;
    const complete = !cut(bucket, view.period) && level.lines.every((line) => line.values[at] !== null && (starts.get(line.key) ?? '9999-12-31') <= bucket.start);
    check(ctx, bucket.complete === complete, [...path, 'supplyByChain', 'level', 'buckets', at, 'complete'], 'Level completeness separates calendar cuts and missing days');
    level.lines.forEach((line, i) => {
      const driver = view.drivers.find((driver) => driver.scope === line.chain);
      if (driver) check(ctx, (line.values[at] === null) === (driver.events[at] === null), [...path, 'supplyByChain', 'level', 'lines', i, 'values', at], 'A chain gap affects both its level and flows');
    });
    view.drivers.forEach((driver, i) => {
      const current = driver.series.buckets[at];
      const selected = driver.scope === 'all' ? level.lines.map((line) => line.key) : [driver.scope];
      const covered = selected.every((chain) => (starts.get(chain) ?? '9999-12-31') <= bucket.start);
      if (absent[at]?.includes(driver.scope)) check(ctx, driver.events[at] === null, [...path, 'drivers', i, 'events', at], 'A chain before its coverage has no events or flows');
      if (current) check(ctx, current.complete === (!cut(bucket, view.period) && covered && driver.events[at] !== null), [...path, 'drivers', i, 'series', 'buckets', at, 'complete'], 'Scoped completeness separates cuts from missing days');
    });
    if (all === undefined || view.drivers.length !== level.lines.length + 1) return;
    const others = view.drivers.filter((driver) => driver.scope !== 'all' && !absent[at]?.includes(driver.scope));
    const counts = others.map((driver) => driver.events[at] ?? null);
    const count = counts.length === 0 || counts.some((value) => value === null) ? null : counts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    check(ctx, all.events[at] === count, [...path, 'drivers', 0, 'events', at], 'All event counts sum every chain or are unknown');
    FLOWS.forEach((_flow, i) => {
      const raw = others.map((driver) => driver.series.lines[i]?.values[at]);
      const scale = precision([...raw, all.series.lines[i]?.values[at]]);
      const parts = raw.map((value) => units(value, scale));
      const sum = parts.length === 0 || parts.some((part) => part === null) ? null : parts.reduce<bigint>((sum, part) => sum + (part ?? 0n), 0n);
      check(ctx, units(all.series.lines[i]?.values[at], scale) === sum, [...path, 'drivers', 0, 'series', 'lines', i, 'values', at], 'All flows sum every chain or are unknown');
    });
  });
  view.issuerVsBridge.forEach((row, i) => {
    const driver = view.drivers.find((driver) => driver.scope === row.scope);
    if (!driver) return;
    for (const side of ['in', 'out'] as const) {
      const split = row[side];
      const indices = level.buckets.flatMap((_bucket, at) => (row.scope === 'all' ? absent[at]?.length === level.lines.length : absent[at]?.includes(row.scope)) ? [] : [at]);
      const complete = indices.length > 0 && indices.every((at) => driver.events[at] !== null);
      check(ctx, split.quality.complete === complete, [...path, 'issuerVsBridge', i, side, 'quality', 'complete'], 'Window completeness requires every actual day in scope');
      const flows = side === 'in' ? ['issuer_mint', 'bridge_in'] : ['issuer_burn', 'bridge_out'];
      for (const [index, part] of ['issuer', 'bridge'].entries()) {
        const field = part as 'issuer' | 'bridge';
        const line = driver.series.lines.find((line) => line.key === flows[index]);
        if (!line) continue;
        const scale = precision([...line.values, split.volume[field]]);
        const values = indices.map((at) => units(line.values[at], scale));
        const sum = values.length === 0 || values.some((value) => value === null) ? null : values.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n);
        check(ctx, units(split.volume[field], scale) === sum, [...path, 'issuerVsBridge', i, side, 'volume', field], 'Window volumes sum actual buckets');
      }
    }
  });
}

export function overviewViewsIssues(overview: Omit<Overview, 'reconciliation'>, ctx: z.RefinementCtx): void {
  if (overview.chains.length === 0 && overview.asOf !== null) return; // Report the forbidden common coverage once, in the outer invariant.
  const scopes = ['all', ...overview.chains.map((chain) => chain.slug)];
  const chains = scopes.slice(1);
  const periods = { '30d': 'day', '90d': 'week', all: 'month' } as const;
  const starts = new Map(overview.status.chains.flatMap((status) => status.historyStart === null ? [] : [[status.chain, status.historyStart] as const]));
  for (const key of ['30d', '90d', 'all'] as const) {
    const view = overview.views[key];
    const path: Path = ['views', key];
    check(ctx, (view === null) === (overview.asOf === null), path, 'Views exist exactly with common coverage');
    if (view === null || overview.asOf === null || overview.historyStart === null || !datesValid(overview.historyStart, overview.asOf)) continue;
    const from = key === 'all' ? [...starts.values()].sort()[0] ?? overview.historyStart : shift(overview.asOf, key === '30d' ? -29 : -89);
    check(ctx, view.from === from, [...path, 'from'], 'The window has its fixed inclusive start');
    check(ctx, view.to === overview.asOf, [...path, 'to'], 'The window ends at asOf');
    check(ctx, view.period === periods[key], [...path, 'period'], 'The public window has a fixed step');
    for (const name of ['level', 'share', 'total', 'stackedLevel', 'stackedShare'] as const) {
      const series = view.supplyByChain[name];
      const subpath = [...path, 'supplyByChain', name];
      seriesIssues(series, view, name === 'total' ? ['all'] : chains, name === 'share' || name === 'stackedShare' ? 'percent' : 'tokens', subpath, ctx);
      flagIssues(overview, series, chains, subpath, ctx);
      check(ctx, same(series.buckets, view.supplyByChain.level.buckets), [...subpath, 'buckets'], 'Supply arrays share bucket dates and completeness');
    }
    const absent = view.supplyByChain.level.buckets.map((bucket) => chains.filter((chain) => (starts.get(chain) ?? '9999-12-31') > bucket.end));
    if (view.noDataChains === undefined) check(ctx, absent.every((list) => list.length === 0), [...path, 'noDataChains'], 'Absent chains require bucket metadata');
    else {
      check(ctx, view.noDataChains.length === absent.length, [...path, 'noDataChains'], 'One absence list per bucket');
      absent.forEach((list, at) => check(ctx, same(view.noDataChains?.[at], list), [...path, 'noDataChains', at], 'Absent chains match coverage in enabled order'));
    }
    valuesIssues(view, absent, [...path, 'supplyByChain'], ctx);
    const level = view.supplyByChain.level;
    level.buckets.forEach((bucket, at) => check(ctx, !bucket.complete || level.lines.every((line) => line.values[at] !== null), [...path, 'supplyByChain', 'level', 'buckets', at, 'complete'], 'A missing level is not complete'));
    check(ctx, same(view.drivers.map((driver) => driver.scope), scopes), [...path, 'drivers'], 'Drivers cover all and every enabled chain in order');
    view.drivers.forEach((driver, i) => {
      const subpath = [...path, 'drivers', i];
      seriesIssues(driver.series, view, [...FLOWS], 'tokens', [...subpath, 'series'], ctx);
      flagIssues(overview, driver.series, driver.scope === 'all' ? chains : [driver.scope], [...subpath, 'series'], ctx);
      check(ctx, same(driver.series.buckets.map(({ start, end }) => ({ start, end })), level.buckets.map(({ start, end }) => ({ start, end }))), [...subpath, 'series', 'buckets'], 'View arrays share dates');
      driverValues(driver.series, subpath, ctx);
    });
    aggregateIssues(view, absent, starts, path, ctx);
    check(ctx, same(view.issuerVsBridge.map((row) => row.scope), scopes), [...path, 'issuerVsBridge'], 'Window totals cover all and every enabled chain in order');
    view.issuerVsBridge.forEach((row, i) => {
      const selected = row.scope === 'all' ? chains : [row.scope];
      const days = [...new Set(overview.status.chains.filter((status) => selected.includes(status.chain)).flatMap((status) => status.unreconciledDays).filter((day) => day >= view.from && day <= view.to))].sort();
      for (const side of ['in', 'out'] as const) check(ctx, same(row[side].quality.unreconciledDays, days), [...path, 'issuerVsBridge', i, side, 'quality', 'unreconciledDays'], 'Window totals flag mismatched days in their scope');
    });
  }
  check(ctx, (overview.day === null) === (overview.asOf === null), ['day'], 'The day block exists exactly with common coverage');
  if (overview.day !== null) {
    check(ctx, overview.day.date === overview.asOf, ['day', 'date'], 'Day equation is for asOf');
    check(ctx, same(overview.day.rows.map((row) => row.scope), scopes), ['day', 'rows'], 'Day rows cover all and every chain in order');
    overview.day.rows.forEach((row, i) => {
      const driver = overview.views['30d']?.drivers.find((driver) => driver.scope === row.scope);
      const at = (driver?.series.buckets.length ?? 0) - 1;
      if (driver === undefined || at < 0) return;
      for (const flow of FLOWS) check(ctx, row.values[flow] === driver.series.lines.find((line) => line.key === flow)?.values[at], ['day', 'rows', i, 'values', flow], 'The day terms equal the asOf daily terms');
      check(ctx, row.events === driver.events[at], ['day', 'rows', i, 'events'], 'The day event count equals asOf');
      check(ctx, row.unreconciled === driver.series.lines.some((line) => line.unreconciled.includes(at)), ['day', 'rows', i, 'unreconciled'], 'Day flag equals asOf');
    });
  }
}
