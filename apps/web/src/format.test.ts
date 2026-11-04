import { describe, expect, it } from 'vitest';
import { signOf } from '@app/view';
import {
  addDays,
  formatAmount,
  formatCompact,
  formatCount,
  formatDay,
  formatDays,
  formatEnds,
  formatHistoryRange,
  formatPercent,
  formatRange,
  formatRunTime,
  formatShortDay,
  formatTime,
  formatMonth,
} from './view.ts';
import { texts } from './texts.ts';

const minus = texts.minus;

describe('formatAmount', () => {
  it.each([
    ['0', '0'],
    ['12045', '12,045'],
    ['1234567.5', '1,234,567.5'],
    ['66660209.999988', '66,660,210'],
    ['999.995', '1,000'],
    ['999.994', '999.99'],
    ['0.000001', '0.000001'],
    ['0.1234567', '0.123457'],
    ['9007199254740993', '9,007,199,254,740,993'],
    ['9007199254740993.123456', '9,007,199,254,740,993.12'],
    ['123456789012345678901234567890.5', '123,456,789,012,345,678,901,234,567,890.5'],
    [`-201`, `${minus}201`],
    ['-0.005', `${minus}0.005`],
  ])('%s → %s', (value, expected) => {
    expect(formatAmount(value)).toBe(expected);
  });

  it('signs changes', () => {
    expect(formatAmount('201', { signed: true })).toBe('+201');
    expect(formatAmount('-1407.25', { signed: true })).toBe(`${minus}1,407.25`);
    expect(formatAmount('0', { signed: true })).toBe('0');
  });

  it('shows null as no data, never 0', () => {
    expect(formatAmount(null)).toBe(texts.noData);
    expect(formatAmount(null, { signed: true })).toBe(texts.noData);
  });
});

describe('formatPercent', () => {
  it.each([
    ['1.697062', '1.70%'],
    ['33.333333', '33.33%'],
    ['0', '0.00%'],
    ['0.004999', '0.00%'],
    ['-0.005', `${minus}0.01%`],
    ['99.999999', '100.00%'],
    ['31742857.142851', '31,742,857.14%'],
    ['9007199254740993.999999', '9,007,199,254,740,994.00%'],
  ])('%s → %s', (value, expected) => {
    expect(formatPercent(value)).toBe(expected);
  });

  it('signs changes and keeps null as no data', () => {
    expect(formatPercent('13.22617', { signed: true })).toBe('+13.23%');
    expect(formatPercent('-2.5', { signed: true })).toBe(`${minus}2.50%`);
    expect(formatPercent(null, { signed: true })).toBe(texts.noData);
  });
});

describe('formatCount and signOf', () => {
  it('groups counters and block numbers above 2^53', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1234)).toBe('1,234');
    expect(formatCount('9007199254740993')).toBe('9,007,199,254,740,993');
    expect(formatCount(null)).toBe(texts.noData);
  });

  it('reads the sign from the string', () => {
    expect(signOf('-0.000001')).toBe('negative');
    expect(signOf('0')).toBe('zero');
    expect(signOf('9007199254740993')).toBe('positive');
    expect(signOf(null)).toBeNull();
  });
});

describe('dates in UTC', () => {
  it('formats days and times by slicing, without a time zone shift', () => {
    expect(formatDay('2026-10-09')).toBe('Oct 9, 2026');
    expect(formatDay('2026-01-31')).toBe('Jan 31, 2026');
    expect(formatTime('2026-12-31T23:59:59.999Z')).toBe('Dec 31 · 23:59 UTC');
    expect(formatTime('2026-10-10T00:05:00Z')).toBe('Oct 10 · 00:05 UTC');
    expect(formatDay(null)).toBe(texts.noData);
  });

  it('rejects a time that is not UTC', () => {
    expect(() => formatTime('2026-10-10T00:05:00+02:00')).toThrow(TypeError);
  });

  it('formats the status last run without UTC and without the middle separator', () => {
    expect(formatRunTime('2026-10-10T05:57:00.000Z')).toBe('Oct 10 05:57');
    expect(() => formatRunTime('2026-10-10T00:05:00+02:00')).toThrow(TypeError);
  });
});

describe('dates without a year inside a section', () => {
  it('writes a day short, and rejects what is not a day', () => {
    expect(formatShortDay('2026-10-09')).toBe('Oct 9');
    expect(formatShortDay('2027-01-02')).toBe('Jan 2');
    expect(() => formatShortDay('2026-13-01')).toThrow(TypeError);
    expect(() => formatShortDay('nonsense')).toThrow(TypeError);
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-09', -7)).toBe('2026-10-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('puts no year on a range inside one year, and a year on both ends when it crosses 1 January', () => {
    expect(formatRange('2026-09-10', '2026-10-09')).toBe('Sep 10 – Oct 9');
    expect(formatRange('2026-10-09', '2026-10-09')).toBe('Oct 9');
    expect(formatRange('2026-12-20', '2027-01-03')).toBe('Dec 20, 2026 – Jan 3, 2027');
    expect(formatEnds('2026-12-20', '2026-12-31')).toEqual(['Dec 20', 'Dec 31']);
    expect(formatEnds('2026-12-31', '2027-01-01')).toEqual(['Dec 31, 2026', 'Jan 1, 2027']);
  });

  it('puts the year once, at the end, on the range of the whole history', () => {
    expect(formatHistoryRange('2026-08-26', '2026-10-09')).toBe('Aug 26 – Oct 9, 2026');
    expect(formatHistoryRange('2026-08-26', '2027-01-09')).toBe('Aug 26, 2026 – Jan 9, 2027');
  });

  it('lists days short, with the year on each when the list spans two years', () => {
    expect(formatDays(['2026-10-03', '2026-10-09'])).toEqual(['Oct 3', 'Oct 9']);
    expect(formatDays(['2026-12-31', '2027-01-01'])).toEqual(['Dec 31, 2026', 'Jan 1, 2027']);
    expect(formatDays([])).toEqual([]);
  });
});

describe('formatCompact', () => {
  it.each([
    ['41860000000', '41.86B'],
    ['41864999999.99', '41.86B'],
    ['41865000000', '41.87B'],
    ['218680000', '218.68M'],
    ['12400', '12.40K'],
    ['1000', '1.00K'],
    ['999', '999'],
    ['999.99', '999.99'],
    ['0.000001', '0.000001'],
    ['0', '0'],
    ['999994', '999.99K'],
    ['999995', '1.00M'],
    ['999995000', '1.00B'],
    ['999999999999', '1.00T'],
    ['999.995', '1.00K'],
    ['1234567890123456', '1,234.57T'],
    ['9007199254740993', '9,007.20T'],
    ['123456789012345678901234567890', '123,456,789,012,345,678.90T'],
    ['9007199254740993.5', '9,007.20T'],
  ])('%s → %s', (value, expected) => {
    expect(formatCompact(value)).toBe(expected);
  });

  it('handles negative values and the sign option', () => {
    expect(formatCompact('-41860000000')).toBe(`${minus}41.86B`);
    expect(formatCompact('-999995')).toBe(`${minus}1.00M`);
    expect(formatCompact('-0.0000001')).toBe('0');
    expect(formatCompact('218680000', { signed: true })).toBe('+218.68M');
    expect(formatCompact('-218680000', { signed: true })).toBe(`${minus}218.68M`);
    expect(formatCompact('0', { signed: true })).toBe('0');
  });

  it('reads null as no data', () => {
    expect(formatCompact(null)).toBe(texts.noData);
  });

  it('keeps every digit above 2^53', () => {
    // As a number, 9007199254999999999 is 9007199255000000000 and would round up.
    expect(formatCompact('9007199254999999999')).toBe('9,007,199.25T');
    expect(formatCompact('9007199255000000000')).toBe('9,007,199.26T');
  });
});

it('formats the supplied monthly bucket dates for the ALL axis', () => {
  expect(formatMonth('2018-08-31')).toBe('Aug 2018');
  expect(formatMonth('2026-11-02')).toBe('Nov 2026');
});
