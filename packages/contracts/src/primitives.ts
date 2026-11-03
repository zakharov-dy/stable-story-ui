// Value primitives of the API.

import { z } from 'zod';

// String canon: an optional ASCII `-`, an integer part without leading zeros, a fractional
// part without trailing zeros, no point in integers, zero is `0`, never `-0`, no exponent.
const CANON = /^(?!-0$)-?(?:0|[1-9]\d*)(?:\.\d*[1-9])?$/;
// The same canon with at most six fractional digits: Decimal is rounded on the server to six places.
const CANON_6 = /^(?!-0$)-?(?:0|[1-9]\d*)(?:\.\d{0,5}[1-9])?$/;

/** Exact amount in tokens; differences can be negative. */
export const Amount = z.string().regex(CANON, 'Expected a decimal string in canonical form');
export type Amount = z.infer<typeof Amount>;

/** Percentages and derived values, rounded on the server to six places. */
export const Decimal = z.string().regex(CANON_6, 'Expected a canonical decimal string with at most 6 decimals');
export type Decimal = z.infer<typeof Decimal>;

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isCalendarDate = (value: string): boolean => {
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  if (month < 1 || month > 12) return false;
  const days = month === 2 && isLeapYear(year) ? 29 : (DAYS_IN_MONTH[month - 1] ?? 0);
  return day >= 1 && day <= days;
};

/** 'YYYY-MM-DD', UTC; a real calendar date. */
export const Day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a day as YYYY-MM-DD')
  .refine(isCalendarDate, 'Expected a calendar date');
export type Day = z.infer<typeof Day>;

/** ISO 8601 time in UTC with `Z`. */
export const IsoDateTime = z.iso.datetime();
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** A block number as a decimal string: it can exceed 2^53. */
export const BlockNumber = z.string().regex(/^(?:0|[1-9]\d*)$/, 'Expected a block number as a decimal string');
export type BlockNumber = z.infer<typeof BlockNumber>;

export const FLOWS = ['issuer_mint', 'issuer_burn', 'bridge_in', 'bridge_out'] as const;
export const Flow = z.enum(FLOWS);
export type Flow = z.infer<typeof Flow>;

export const Period = z.enum(['day', 'week', 'month', 'quarter', 'year', 'all']);
export type Period = z.infer<typeof Period>;

/** A counter: a JSON number, never negative outside series values. */
export const Count = z.int().nonnegative();

/** Ascending 0-based indices into a sibling array. */
export const Indices = z
  .array(z.int().nonnegative())
  .refine((list) => list.every((index, i) => i === 0 || index > (list[i - 1] ?? -1)), 'Expected ascending indices');
