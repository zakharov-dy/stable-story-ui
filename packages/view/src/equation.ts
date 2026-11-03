// The day equation of a chain: Overview.day.rows on asOf as five terms, plus the bars'
// geometry on one scale shared by all chains. Nothing here adds chains together or reads another
// source: values stay exact decimal strings and bigint, `number` appears only as a fraction of the
// bar's half-width (a coordinate).
import type { ViewLabels } from './labels.ts';
import { createFormat, signOf } from './format.ts';
import type { Overview } from '@app/contracts';
import { scale, unscale } from './chart/scale.ts';
import type { Term } from './checks.ts';

export const TERMS: readonly Term[] = ['issuer_mint', 'issuer_burn', 'bridge_in', 'bridge_out', 'net'];
const IN: readonly Term[] = ['issuer_mint', 'bridge_in'];
const OUT: readonly Term[] = ['issuer_burn', 'bridge_out'];

export interface ChainDay {
  chain: string;
  day: string | null; // the day of the values: asOf, or null when the chain has no value for it
  values: Record<Term, string | null>; // flows ≥ 0 as the API sends them, net signed
  known: boolean; // all five values are known
  unreconciled: boolean; // a line is flagged at this day by the API
  events: number | null; // the day's event count from the day block (Overview.day.rows[].events); null when the day is not closed or not found
}

const EMPTY: Record<Term, string | null> = { issuer_mint: null, issuer_burn: null, bridge_in: null, bridge_out: null, net: null };

/** The terms of one chain on asOf, from the dedicated day block. Never a scope that is not a chain (such as `all`). */
export function chainDay(overview: Overview, chain: string): ChainDay {
  const unknown: ChainDay = { chain, day: null, values: { ...EMPTY }, known: false, unreconciled: false, events: null };
  if (!overview.chains.some((candidate) => candidate.slug === chain)) return unknown;
  const row = overview.day?.rows.find((row) => row.scope === chain);
  if (row === undefined || overview.day === null) return unknown;
  return { chain, day: overview.day.date, values: row.values, known: TERMS.every((term) => row.values[term] !== null), unreconciled: row.unreconciled, events: row.events };

}

/** A term as shown: outflows get a minus (zero keeps no sign), net keeps the sign it has. */
export function signedValue(term: Term, value: string | null): string | null {
  if (value === null) return null;
  if (!OUT.includes(term) || signOf(value) === 'zero' || value.startsWith('-')) return value;
  return `-${value}`;
}

export interface TermView {
  term: Term;
  compact: string; // "+612.40M"
  full: string; // "+612,400,000"
  missing: boolean;
}

/** Fractions of the bars' half-width, 0…1, on the scale shared by every chain. */
export interface Bars {
  issuerIn: number;
  bridgeIn: number;
  issuerOut: number;
  bridgeOut: number;
  net: number; // signed, −1…1
  inTotal: string; // exact sums, for the accessible description
  outTotal: string;
}

const PRECISION = 10_000n;
const ratio = (value: bigint, max: bigint): number => (max === 0n ? 0 : Number((value * PRECISION) / max) / Number(PRECISION));

/**
 * The bars of every chain with known values, on one scale: the largest inflow or outflow total of
 * any chain is the full half-width. Chains with an unknown term get no bars (null is not 0) and do
 * not take part in the scale. The input order is kept.
 */
export function barsFor(days: readonly ChainDay[]): (Bars | null)[] {
  const known = days.filter((day) => day.known);
  const digits = Math.max(0, ...known.flatMap((day) => TERMS.map((term) => scale([day.values[term]]).digits)));
  const exact = (day: ChainDay): Record<Term, bigint> =>
    Object.fromEntries(TERMS.map((term) => [term, scale([day.values[term]], digits).values[0] ?? 0n])) as Record<Term, bigint>;
  const sum = (values: Record<Term, bigint>, terms: readonly Term[]): bigint => terms.reduce((total, term) => total + values[term], 0n);
  const abs = (value: bigint): bigint => (value < 0n ? -value : value);
  const all = known.map(exact);
  const max = all.reduce((largest, values) => [sum(values, IN), sum(values, OUT), abs(values.net)].reduce((a, b) => (b > a ? b : a), largest), 0n);
  return days.map((day) => {
    if (!day.known) return null;
    const values = exact(day);
    return {
      issuerIn: ratio(values.issuer_mint, max),
      bridgeIn: ratio(values.bridge_in, max),
      issuerOut: ratio(values.issuer_burn, max),
      bridgeOut: ratio(values.bridge_out, max),
      net: ratio(values.net, max),
      inTotal: unscale(sum(values, IN), digits),
      outTotal: unscale(sum(values, OUT), digits),
    };
  });
}

/** "41.86B" → the number and its unit suffix, so that the suffix can be set smaller. */
export function splitCompact(text: string): { number: string; suffix: string } {
  const match = /^(.*?)([KMBT]?)$/.exec(text);
  return { number: match?.[1] ?? text, suffix: match?.[2] ?? '' };
}

/** "41,862,503,117.42" → the integer part and the fraction with its point, so that the fraction can be dimmed. */
export function splitFull(text: string): { whole: string; fraction: string } {
  const point = text.lastIndexOf('.');
  return point < 0 ? { whole: text, fraction: '' } : { whole: text.slice(0, point), fraction: text.slice(point) };
}

/** Bind client-owned labels without global configuration. */
export function createEquation(texts: ViewLabels) {
  const { formatAmount, formatCompact } = createFormat(texts);

  /** The asset's display name: `overview.asset` through the names table. */
  const assetName = (overview: Pick<Overview, 'asset'>): string =>
    texts.assetNames[overview.asset] ?? overview.asset.toUpperCase();

  function termView(term: Term, value: string | null): TermView {
    const signed = signedValue(term, value);
    return { term, compact: formatCompact(signed, { signed: true }), full: formatAmount(signed, { signed: true }), missing: value === null };
  }

  return { assetName, termView };
}
