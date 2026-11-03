// Chart geometry. Values stay exact (bigint scaled to a common number of decimals); `number` appears
// only as an SVG coordinate.

import { parseDecimal } from '../format.ts';

export interface Scaled {
  digits: number; // fractional digits of the common scale
  values: (bigint | null)[];
}

/** Decimal strings → bigints with a common number of fractional digits; null stays null. */
export function scale(values: readonly (string | null)[], digits?: number): Scaled {
  const common = digits ?? Math.max(0, ...values.map((value) => (value === null ? 0 : parseDecimal(value).frac.length)));
  return {
    digits: common,
    values: values.map((value) => {
      if (value === null) return null;
      const parts = parseDecimal(value);
      const magnitude = BigInt(`${parts.int}${parts.frac.padEnd(common, '0')}`);
      return parts.negative ? -magnitude : magnitude;
    }),
  };
}

/** The common number of fractional digits of several value lists. */
export function commonDigits(...lists: readonly (readonly (string | null)[])[]): number {
  return Math.max(0, ...lists.map((list) => scale(list).digits));
}

/** A scaled bigint back to a canonical decimal string (exact). */
export function unscale(value: bigint, digits: number): string {
  const negative = value < 0n;
  const digitsText = (negative ? -value : value).toString().padStart(digits + 1, '0');
  const int = digitsText.slice(0, digitsText.length - digits);
  const frac = digitsText.slice(digitsText.length - digits).replace(/0+$/, '');
  const body = frac === '' ? int : `${int}.${frac}`;
  return negative && body !== '0' ? `-${body}` : body;
}

export const maxOf = (values: readonly (bigint | null)[]): bigint | null =>
  values.reduce<bigint | null>((max, value) => (value !== null && (max === null || value > max) ? value : max), null);

export const minOf = (values: readonly (bigint | null)[]): bigint | null =>
  values.reduce<bigint | null>((min, value) => (value !== null && (min === null || value < min) ? value : min), null);

const PRECISION = 1_000_000n;

/** (value − min) / (max − min) as a coordinate fraction in [0, 1]; a flat range sits in the middle. */
export function fraction(value: bigint, min: bigint, max: bigint): number {
  if (max === min) return 0.5;
  return Number(((value - min) * PRECISION) / (max - min)) / Number(PRECISION);
}

/**
 * A value on a symmetric scale [−max, max] → fraction of the plot height (0 bottom, 0.5 zero, 1 top).
 * max = 0 (nothing but zeros) puts everything on the zero line.
 */
export function symmetricFraction(value: bigint, max: bigint): number {
  if (max === 0n) return 0.5;
  return 0.5 + Number((value * PRECISION) / (2n * max)) / Number(PRECISION);
}

/** The largest magnitude of the values of several lists (null skipped); 0n without values. */
export function sharedExtent(lists: readonly (readonly (bigint | null)[])[]): bigint {
  let extent = 0n;
  for (const list of lists) {
    for (const value of list) {
      if (value === null) continue;
      const magnitude = value < 0n ? -value : value;
      if (magnitude > extent) extent = magnitude;
    }
  }
  return extent;
}

/** The smallest 1, 2 or 5 × 10^k that is at least `value`: a round axis end. 0n for value ≤ 0. */
export function niceCeil(value: bigint): bigint {
  if (value <= 0n) return 0n;
  const decade = 10n ** BigInt(value.toString().length - 1);
  for (const step of [1n, 2n, 5n]) {
    if (step * decade >= value) return step * decade;
  }
  return 10n * decade;
}

/**
 * The level axis of the stacked supply chart: the data maximum plus 5 %, rounded up to the next
 * whole axis step. The step is the smallest 1, 2, 2.5 or 5 × 10^k of at least a quarter of that
 * padded maximum (the widest nice step that keeps the axis at three or four gridlines), so the
 * gridlines sit at the steps (20B, 40B, 60B) and `grid` is three or four values ending at `top`.
 */
export function levelAxis(max: bigint): { top: bigint; step: bigint; grid: bigint[] } {
  if (max <= 0n) return { top: 0n, step: 0n, grid: [] };
  const padded = (max * 105n + 99n) / 100n; // the data maximum plus 5 %, rounded up
  const step = axisStep(padded);
  const top = ((padded + step - 1n) / step) * step;
  return { top, step, grid: Array.from({ length: Number(top / step) }, (_slot, index) => step * BigInt(index + 1)) };
}

/** The smallest 1, 2, 2.5 or 5 × 10^k with 4 × step ≥ padded: three or four gridlines at the steps. */
function axisStep(padded: bigint): bigint {
  for (let decade = 1n; ; decade *= 10n) {
    // 2.5 × 10^k = 25 × 10^(k−1) is whole from the tens up; below that it is never the answer.
    const steps = decade >= 10n ? [decade, 2n * decade, (25n * decade) / 10n, 5n * decade] : [decade, 2n * decade, 5n * decade];
    for (const step of steps) {
      if (4n * step >= padded) return step;
    }
  }
}

/** A closed diamond (a rotated square) around a point, as an SVG path. */
export function diamondPath(x: number, y: number, radius: number): string {
  return `M${round(x)} ${round(y - radius)}L${round(x + radius)} ${round(y)}L${round(x)} ${round(y + radius)}L${round(x - radius)} ${round(y)}Z`;
}

/** Plot geometry shared by the charts: a viewBox with padding and evenly spaced columns. */
export interface Frame {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  columns: number;
}

export const plotWidth = (frame: Frame): number => frame.width - frame.left - frame.right;
export const plotHeight = (frame: Frame): number => frame.height - frame.top - frame.bottom;
export const columnWidth = (frame: Frame): number => plotWidth(frame) / Math.max(1, frame.columns);
export const columnX = (frame: Frame, index: number): number => frame.left + columnWidth(frame) * (index + 0.5);
/** y for a fraction 0 (bottom) … 1 (top) of the plot. */
export const fractionY = (frame: Frame, value: number): number => frame.top + plotHeight(frame) * (1 - value);

const round = (value: number): string => String(Math.round(value * 100) / 100);

/**
 * An SVG path through the points; null breaks the line (null is no data, not 0). An isolated point
 * becomes a short horizontal tick so that it stays visible.
 */
export function linePath(points: readonly ({ x: number; y: number } | null)[], tick = 2): string {
  const parts: string[] = [];
  points.forEach((point, index) => {
    if (point === null) return;
    const previous = index > 0 ? points[index - 1] : null;
    const next = index + 1 < points.length ? points[index + 1] : null;
    if (!previous && !next) {
      parts.push(`M${round(point.x - tick)} ${round(point.y)}H${round(point.x + tick)}`);
    } else {
      parts.push(`${previous ? 'L' : 'M'}${round(point.x)} ${round(point.y)}`);
    }
  });
  return parts.join('');
}

/** Runs of consecutive indices where `present` holds. */
export function segments(length: number, present: (index: number) => boolean): [number, number][] {
  const runs: [number, number][] = [];
  let start: number | null = null;
  for (let index = 0; index <= length; index += 1) {
    const inside = index < length && present(index);
    if (inside && start === null) start = index;
    if (!inside && start !== null) {
      runs.push([start, index - 1]);
      start = null;
    }
  }
  return runs;
}

export { round as coordinate };
