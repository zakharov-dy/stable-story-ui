// Display formatting of API values: amounts and percentages are exact
// decimal strings, so they are formatted with string operations and bigint, never through `number`.
// Days and times are UTC strings and are sliced, not parsed into Date.

import type { FormatLabels } from './labels.ts';

interface Parts {
  negative: boolean;
  int: string; // digits, no leading zeros except a lone 0
  frac: string; // digits, may be empty
}

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

export function parseDecimal(value: string): Parts {
  const match = DECIMAL.exec(value);
  if (!match) throw new TypeError(`Not a decimal string: ${value}`);
  const int = (match[2] ?? '0').replace(/^0+(?=\d)/, '');
  return { negative: match[1] === '-', int, frac: match[3] ?? '' };
}

const isZero = (parts: Parts): boolean => /^0*$/.test(parts.int + parts.frac);

/** Rounds the magnitude half-up (so half away from zero for the signed value) to `places` digits. */
export function roundParts(parts: Parts, places: number): Parts {
  if (parts.frac.length <= places) return { ...parts, frac: parts.frac.padEnd(places, '0') };
  const kept = `${parts.int}${parts.frac.slice(0, places)}`;
  const roundUp = (parts.frac[places] ?? '0') >= '5';
  const digits = (BigInt(kept) + (roundUp ? 1n : 0n)).toString().padStart(places + 1, '0');
  return {
    negative: parts.negative,
    int: digits.slice(0, digits.length - places) || '0',
    frac: digits.slice(digits.length - places),
  };
}

/** 1234567 → 1,234,567. */
export function groupDigits(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Amounts of at least one token are shown with up to two decimals; smaller ones keep up to six, so
// a tiny non-zero amount never reads as 0.
function amountPlaces(parts: Parts): number {
  return parts.int === '0' ? 6 : 2;
}

const COMPACT_UNITS = ['', 'K', 'M', 'B', 'T'] as const;

/** Moves the decimal point `places` digits to the left (places ≥ 0). */
function shiftLeft(parts: Parts, places: number): Parts {
  const digits = `${parts.int}${parts.frac}`.padStart(parts.int.length + parts.frac.length + places, '0');
  const point = digits.length - parts.frac.length - places;
  return { negative: parts.negative, int: digits.slice(0, point).replace(/^0+(?=\d)/, '') || '0', frac: digits.slice(point) };
}

/** The sign of a decimal string, for styling: positive | negative | zero. */
export function signOf(value: string | null): 'positive' | 'negative' | 'zero' | null {
  if (value === null) return null;
  const parts = parseDecimal(value);
  if (isZero(parts)) return 'zero';
  return parts.negative ? 'negative' : 'positive';
}

const yearOf = (day: string): string => day.slice(0, 4);

/** Bind client-owned labels without global configuration. */
export function createFormat(texts: FormatLabels) {
  function render(parts: Parts, { signed, trimZeros }: { signed: boolean; trimZeros: boolean }): string {
    const frac = trimZeros ? parts.frac.replace(/0+$/, '') : parts.frac;
    const body = `${groupDigits(parts.int)}${frac === '' ? '' : `.${frac}`}`;
    const zero = isZero({ ...parts, frac });
    if (zero) return body;
    if (parts.negative) return `${texts.minus}${body}`;
    return signed ? `${texts.plus}${body}` : body;
  }

  /** An Amount in tokens: grouped, rounded for display; null → "no data". */
  function formatAmount(value: string | null, { signed = false } = {}): string {
    if (value === null) return texts.noData;
    const parts = parseDecimal(value);
    return render(roundParts(parts, amountPlaces(parts)), { signed, trimZeros: true });
  }

  /**
   * An Amount for tight spaces: 41.86B, 218.68M, 1.00K (K, M, B, T; above T the suffix stays T and the
   * integer part grows). Two fixed decimals, rounded half-up like formatAmount, and the unit steps up
   * when rounding carries (999.995K → 1.00M). Amounts below 1,000 are formatted as formatAmount does.
   * Digit-string arithmetic only, never through `number`; null → "no data".
   */
  function formatCompact(value: string | null, { signed = false, places = 2 } = {}): string {
    if (value === null) return texts.noData;
    const parts = parseDecimal(value);
    const top = COMPACT_UNITS.length - 1;
    let tier = Math.min(top, Math.floor((parts.int.length - 1) / 3));
    for (;;) {
      const rounded = tier === 0 ? roundParts(parts, amountPlaces(parts)) : roundParts(shiftLeft(parts, tier * 3), places);
      if (tier < top && rounded.int.length > 3) {
        tier += 1;
        continue;
      }
      return `${render(rounded, { signed, trimZeros: tier === 0 })}${COMPACT_UNITS[tier]}`;
    }
  }

  /** A Decimal percentage with two fixed decimals: 1.697062 → 1.70%; null → "no data". */
  function formatPercent(value: string | null, { signed = false, places = 2 } = {}): string {
    if (value === null) return texts.noData;
    return `${render(roundParts(parseDecimal(value), places), { signed, trimZeros: false })}${texts.percent}`;
  }

  /** A counter or a block number (string for blocks above 2^53); null → "no data". */
  function formatCount(value: number | string | null): string {
    if (value === null) return texts.noData;
    return groupDigits(String(value));
  }

  const splitDay = (day: string): { year: string; month: number; date: string } => {
    const [year, month, date] = day.split('-');
    if (year === undefined || month === undefined || date === undefined || texts.months[Number(month) - 1] === undefined) {
      throw new TypeError(`Not a day: ${day}`);
    }
    return { year, month: Number(month), date: date.replace(/^0/, '') };
  };

  const monthName = (month: number): string => texts.months[month - 1] ?? '';

  /** 'YYYY-MM-DD' (UTC) → 'Oct 9, 2026'. The header, the records and How we count carry the year. */
  function formatDay(day: string | null): string {
    if (day === null) return texts.noData;
    const { year, month, date } = splitDay(day);
    return `${monthName(month)} ${date}, ${year}`;
  }

  /** 'YYYY-MM-DD' → 'Oct 9': inside a section the year is in the header and in the range caption. */
  function formatShortDay(day: string): string {
    const { month, date } = splitDay(day);
    return `${monthName(month)} ${date}`;
  }

  /** 'YYYY-MM-DD' plus a number of days (UTC calendar arithmetic). */
  function addDays(day: string, days: number): string {
    const { year, month, date } = splitDay(day);
    return new Date(Date.UTC(Number(year), month - 1, Number(date) + days)).toISOString().slice(0, 10);
  }

  /** The two ends of a range as labels: no year, or both with a year when the range crosses 1 January. */
  function formatEnds(from: string, to: string): [string, string] {
    return yearOf(from) === yearOf(to) ? [formatShortDay(from), formatShortDay(to)] : [formatDay(from), formatDay(to)];
  }

  /** 'Sep 10 – Oct 9'; with years on both ends when the range crosses 1 January. */
  function formatRange(from: string, to: string): string {
    if (from === to) return formatShortDay(from);
    const [start, end] = formatEnds(from, to);
    return texts.dayRange(start, end);
  }

  /** The range of the whole history, 'Aug 26 – Oct 9, 2026': the year once, at the end; both ends when it crosses 1 January. */
  function formatHistoryRange(from: string, to: string): string {
    if (yearOf(from) !== yearOf(to)) return texts.dayRange(formatDay(from), formatDay(to));
    return texts.dayRange(formatShortDay(from), formatDay(to));
  }

  /** A list of days: no year, or every item with a year when the list spans several years. */
  function formatDays(days: readonly string[]): string[] {
    const crossing = new Set(days.map(yearOf)).size > 1;
    return days.map((day) => (crossing ? formatDay(day) : formatShortDay(day)));
  }

  /** ISO time in UTC ('…Z') → 'Oct 9 · 15:07 UTC'. */
  function formatTime(iso: string | null): string {
    if (iso === null) return texts.noData;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) || !iso.endsWith('Z')) throw new TypeError(`Not a UTC time: ${iso}`);
    return `${formatShortDay(iso.slice(0, 10))} · ${iso.slice(11, 16)} ${texts.utc}`;
  }

  /**
   * ISO time in UTC ('…Z') → 'Oct 9 15:07', without the separators of formatTime: the status
   * Last run cell, whose column header already says UTC and whose '·' joins the run result.
   */
  function formatRunTime(iso: string): string {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) || !iso.endsWith('Z')) throw new TypeError(`Not a UTC time: ${iso}`);
    return `${formatShortDay(iso.slice(0, 10))} ${iso.slice(11, 16)}`;
  }

  return { formatAmount, formatCompact, formatPercent, formatCount, formatDay, formatShortDay, addDays, formatEnds, formatRange, formatHistoryRange, formatDays, formatTime, formatRunTime };
}
