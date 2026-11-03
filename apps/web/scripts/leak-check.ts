import { createMockClient, type Overview } from '@app/contracts';
import { formatAmount, formatCompact, formatRange } from '../src/view.ts';
import { texts } from '../src/texts.ts';
import { flightModels, object, resolveFlight, walkFlight, type Model } from './leak-check-flight.ts';

const DAY_MS = 86_400_000;
const MARKER_DAY = '2026-12-22';
const RAW = 1_000_000n;
const MINT = 123456789n; // long-history recipe, not a metrics result
const age = (from: string, to: string): number => (Date.parse(to) - Date.parse(from)) / DAY_MS;
const shift = (day: string, offset: number): string => new Date(Date.parse(day) + offset * DAY_MS).toISOString().slice(0, 10);
const decimal = (raw: bigint): string => `${raw / RAW}.${String(raw % RAW).padStart(6, '0')}`;
// Independent arithmetic: 38 inclusive days, ordinary net 67, replacing an ordinary mint of 10.
export const MARKERS = {
  level: decimal((1000n + BigInt(age('2026-11-15', MARKER_DAY) + 1) * 67n) * RAW + MINT - 10n * RAW),
  net: decimal(MINT + 57n * RAW),
  mint: decimal(MINT),
};

function spellings(amount: string): string[] {
  const grouped = amount.replace(/\B(?=(\d{3})+\.)/g, ',');
  return [...new Set([amount, grouped, formatAmount(amount), formatCompact(amount), formatCompact(amount, { signed: true })])];
}

// Commas belong to a number: 123.46 must not match 79,123.46. The same boundary is used
// for response searches and collision checks. Signs are intentionally outside the token.
function contains(text: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\d.,])${escaped}(?![\\d.,KMBT])`).test(text);
}

const decode = (html: string): string => html
  .replace(/\\u([0-9a-f]{4})/gi, (_all, hex: string) => String.fromCharCode(parseInt(hex, 16)))
  .replace(/&#(x[0-9a-f]+|\d+);/gi, (_all, code: string) => String.fromCodePoint(parseInt(code.startsWith('x') ? code.slice(1) : code, code.startsWith('x') ? 16 : 10)))
  .replaceAll('&quot;', '"').replaceAll('&amp;', '&');

/** Applies to HTML, inline/separate Flight and client assets; never print a matched credential. */
export function assertNoR2Leaks(text: string, sentinels: readonly string[], channel: string, signedUrls = true): void {
  const decoded = decode(text).replaceAll('\\/', '/');
  if (sentinels.some((needle) => decoded.includes(needle)) || (signedUrls && /X-Amz-(?:Signature|Credential|Security-Token)=/i.test(decoded))) {
    throw new Error(`private R2 configuration or signed URL leaked in ${channel}`);
  }
}

function rejectMarkers(text: string, markers: readonly string[], channel: string): void {
  for (const marker of markers) for (const spelling of spellings(marker)) {
    if (contains(text, spelling)) throw new Error(`old daily value ${marker} (${spelling}) leaked in ${channel}`);
  }
}

function numericLeaves(value: unknown): string[] {
  if ((typeof value === 'string' || typeof value === 'number') && /^-?\d+(\.\d+)?$/.test(String(value))) return [String(value)];
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(numericLeaves);
  return [];
}

export function assertNoCollisions(overview: Overview): void {
  const outsideRecords = { ...overview, records: [], largestEvents: null };
  for (const [values, markers] of [
    [numericLeaves(overview), [MARKERS.level, MARKERS.net]],
    [numericLeaves(outsideRecords), [MARKERS.mint]],
  ] as const) {
    for (const value of values) for (const marker of markers) for (const banned of spellings(marker)) {
      if ([value, ...spellings(value)].some((legal) => contains(legal, banned))) {
        throw new Error(`fixture collision: forbidden ${banned} also represents legal ${value}`);
      }
    }
  }
}

/** Negative half. Keep body and Flight separate: legal record values occur in both. */
export function checkLeakHtml(html: string): Map<string, Model> {
  rejectMarkers(decode(html), [MARKERS.level, MARKERS.net], 'source HTML/RSC');
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    if (!script[1]?.includes('self.__next_f')) rejectMarkers(decode(script[1] ?? ''), [MARKERS.mint], 'non-Flight script');
  }
  const body = html.replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(/<section\b(?=[^>]*data-block="(?:records|feed)")[\s\S]*?<\/section>/g, '');
  rejectMarkers(decode(body), [MARKERS.mint], 'HTML outside records/feed');
  const rows = flightModels(html);
  walkFlight(rows, (value, context) => {
    if (typeof value !== 'string' && typeof value !== 'number') return;
    rejectMarkers(decode(String(value)), context.exempt ? [MARKERS.level, MARKERS.net] : Object.values(MARKERS), 'decoded Flight props/text');
  });
  return rows;
}

function requireControl(condition: boolean, message: string): void {
  if (!condition) throw new Error(`missing positive control: ${message}`);
}

export async function checkLongHistory(html: string, overview: Overview): Promise<void> {
  const { asOf, historyStart } = overview;
  requireControl(asOf !== null && historyStart !== null, 'long-history dates');
  if (asOf === null || historyStart === null) return;
  requireControl(age(historyStart, asOf) > 90 && MARKER_DAY < shift(asOf, -29), 'marker outside asOf minus 29 in a history longer than 90 days');
  const dailySource = await createMockClient('long-history').series({ asset: 'usdc', metric: 'level', groupBy: 'chain', period: 'day', from: '2026-12-16', to: '2027-03-15' });
  const index = dailySource.buckets.findIndex((bucket) => bucket.start === MARKER_DAY && bucket.end === MARKER_DAY);
  requireControl(index >= 0 && dailySource.lines.find((line) => line.chain === 'ethereum')?.values[index] === MARKERS.level, 'independent old-level fixture anchor');
  assertNoCollisions(overview);
  const rows = checkLeakHtml(html);
  const body = decode(html.replace(/<script\b[\s\S]*?<\/script>/g, ''));
  const sections = [...body.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)];
  const section = (heading: string): string => sections.find((match) => match[1]?.includes(`aria-labelledby="${heading}"`))?.[0] ?? '';
  const driverBody = section('h-drivers');
  const figures = [...driverBody.matchAll(/<figure\b([^>]*)>([\s\S]*?)<\/figure>/g)];
  const figure = (period: string, scope: string): string => figures.find((match) => match[1]?.includes(`data-period="${period}"`) && match[1].includes(`data-scope="${scope}"`))?.[0] ?? '';
  const controls = new Set<string>();
  const daily = overview.views['30d'];
  requireControl(daily?.period === 'day' && daily.from === shift(asOf, -29) && daily.to === asOf, '30D independent bounds/day step');
  requireControl(overview.views['90d']?.period === 'week' && overview.views.all?.period === 'month', 'historical week/month fixture steps');
  const dates = Array.from({ length: 30 }, (_, i) => shift(asOf, i - 29));
  const supplySvgs = [...section('h-supply-by-chain').matchAll(/<svg\b[\s\S]*?<\/svg>/g)];
  for (const [name, chart] of [['daily level', supplySvgs[0]?.[0] ?? ''], ['daily ethereum drivers', figure('30d', 'ethereum')]]) {
    requireControl((chart.match(/class="chart-hit"/g) ?? []).length === 30, `${name}: 30 HTML hit columns`);
    for (const date of dates) requireControl(chart.includes(formatRange(date, date)), `${name}: HTML daily label ${date}`);
  }
  walkFlight(rows, (value, context) => {
    const props = object(value);
    if (!props) return;
    const { heading, period, scope } = context;
    if (heading.startsWith('h-supply-by-chain') && props['data-period'] === period) controls.add(`supply-${period}`);
    if (heading.startsWith('h-issuer-vs-bridge') && props['data-period'] === period) controls.add(`split-${period}`);
    if (heading === 'h-drivers' && props['data-scope'] === 'ethereum') controls.add(`driver-${period}`);
    const tips = resolveFlight(rows, props.tips ?? null);
    const tooltips = resolveFlight(rows, props.tooltips ?? null);
    if (!Array.isArray(tips)) return;
    const dailySupply = heading === 'h-supply-by-chain' && period === '30d' && typeof props.label === 'string' && props.label.startsWith(texts.supplyByChain.level);
    const dailyDriver = heading === 'h-drivers' && period === '30d' && scope === 'ethereum';
    if (dailySupply || dailyDriver) {
      requireControl(tips.length === 30 && Array.isArray(tooltips) && tooltips.length === 30, '30 daily level/ethereum-driver columns and RSC tooltips');
      dates.forEach((date, at) => {
        const label = formatRange(date, date);
        requireControl(typeof tips[at] === 'string' && tips[at].includes(label) && body.includes(label), `daily column ${date}`);
      });
      const anchors = dailySupply ? daily?.supplyByChain.level.lines.find((line) => line.chain === 'ethereum')?.values : daily?.drivers.find((driver) => driver.scope === 'ethereum')?.series.lines.find((line) => line.flow === 'net')?.values;
      for (const at of [0, 29]) {
        const amount = anchors?.[at];
        requireControl(typeof amount === 'string' && Array.isArray(tooltips) && JSON.stringify(tooltips[at]).includes(formatCompact(amount)), `daily first/last ${dailySupply ? 'level' : 'net'} amount`);
      }
      controls.add(dailySupply ? 'daily-level' : 'daily-driver');
    }
    if (heading === 'h-drivers' && period === '90d' && (scope === 'base' || scope === 'ethereum')) {
      const gap = scope === 'base';
      const label = formatRange(gap ? '2027-01-04' : '2026-12-28', gap ? '2027-01-10' : '2027-01-03');
      const buckets = overview.views['90d']?.drivers.find((driver) => driver.scope === scope)?.series.buckets;
      const at = buckets?.findIndex((bucket) => bucket.start === (gap ? '2027-01-04' : '2026-12-28')) ?? -1;
      const column = Array.isArray(tooltips) ? object(resolveFlight(rows, tooltips[at] ?? null)) : undefined;
      const note = object(column?.note);
      if (JSON.stringify(column?.footer).includes(label) && note?.tone === (gap ? 'incomplete' : 'unreconciled')) controls.add(gap ? 'gap' : 'mismatch');
    }
  });
  for (const period of ['30d', '90d', 'all']) for (const kind of ['supply', 'split', 'driver']) {
    requireControl(controls.has(`${kind}-${period}`), `${kind} ${period} in Flight`);
    const suffix = period === '30d' ? '' : `-${period}`;
    const markup = kind === 'driver' ? figure(period, 'ethereum') : section(`h-${kind === 'supply' ? 'supply-by-chain' : 'issuer-vs-bridge'}${suffix}`);
    requireControl(markup.includes(`data-period="${period}"`) && markup.includes(kind === 'split' ? 'data-scope="all"' : '<svg'), `${kind} ${period} in HTML`);
  }
  for (const control of ['daily-level', 'daily-driver', 'gap', 'mismatch']) requireControl(controls.has(control), control);
  for (const heading of ['supply-by-chain', 'drivers']) requireControl(new RegExp(`<section\\b[^>]*aria-labelledby="h-${heading}"[\\s\\S]*?<svg`).test(body), `${heading} SVG`);
  const equation = sections.find((match) => match[1]?.includes('data-block="day-equation"'))?.[0] ?? '';
  requireControl(equation.includes('<svg'), 'day equation');
  for (const term of ['issuer_mint', 'issuer_burn', 'bridge_in', 'bridge_out', 'net']) requireControl(equation.includes(`data-flow="${term}"`), `day equation ${term}`);
  requireControl(figure('90d', 'base').includes('data-missing="true"') && figure('90d', 'ethereum').includes('data-unreconciled="true"'), 'historical HTML gap/mismatch marks');
}
