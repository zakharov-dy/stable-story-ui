import { describe, expect, it } from 'vitest';
import { Amount, BlockNumber, Day, Decimal, Indices, IsoDateTime } from './primitives.ts';

const NOT_CANON = ['01', '1.50', '1e3', '-0', '.5', '5.', '+1', '0.0', '−3', '-0.0', '00', '1,5', ' 1', '1 ', '', '-', '0x10'];

describe('Amount (string canon)', () => {
  it.each(['1.5', '1200', '0', '-3', '-0.5', '0.000001', '115792089237316195423570985008687907853269984665640564039457584007913129639935'])(
    'accepts %j',
    (value) => {
      expect(Amount.safeParse(value).success).toBe(true);
    },
  );

  it('accepts any number of decimals', () => {
    expect(Amount.safeParse('0.1234567').success).toBe(true);
  });

  it.each(NOT_CANON)('rejects %j', (value) => {
    expect(Amount.safeParse(value).success).toBe(false);
  });

  it.each([1.5, 0, null, undefined])('rejects the non-string %j', (value) => {
    expect(Amount.safeParse(value).success).toBe(false);
  });
});

describe('Decimal (canon, at most six decimals)', () => {
  it.each(['1.5', '1200', '0', '-3', '-0.5', '33.333333', '-0.000001'])('accepts %j', (value) => {
    expect(Decimal.safeParse(value).success).toBe(true);
  });

  it.each([...NOT_CANON, '0.1234567', '-0.0000001', '1.1234560'])('rejects %j', (value) => {
    expect(Decimal.safeParse(value).success).toBe(false);
  });
});

describe('Day', () => {
  it.each(['2024-02-29', '2000-02-29', '2026-10-06', '2026-01-31', '2026-12-31', '0001-01-01'])('accepts %j', (value) => {
    expect(Day.safeParse(value).success).toBe(true);
  });

  it.each([
    '2025-02-29',
    '2026-02-30',
    '1900-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-01-00',
    '2026-1-01',
    '26-01-01',
    '2026-10-06T00:00:00Z',
    '2026/10/06',
    '',
  ])('rejects %j', (value) => {
    expect(Day.safeParse(value).success).toBe(false);
  });
});

describe('IsoDateTime', () => {
  it.each(['2026-10-10T06:00:00Z', '2026-10-10T06:00:00.123Z'])('accepts UTC %j', (value) => {
    expect(IsoDateTime.safeParse(value).success).toBe(true);
  });

  it.each(['2026-10-10T06:00:00+00:00', '2026-10-10T09:00:00+03:00', '2026-10-10T06:00:00', '2026-10-10'])(
    'rejects %j',
    (value) => {
      expect(IsoDateTime.safeParse(value).success).toBe(false);
    },
  );
});

describe('BlockNumber', () => {
  it.each(['0', '23500000', '9007199254740993'])('accepts %j', (value) => {
    expect(BlockNumber.safeParse(value).success).toBe(true);
  });

  it.each(['-1', '01', '1.0', '1e6', '0x10', ''])('rejects %j', (value) => {
    expect(BlockNumber.safeParse(value).success).toBe(false);
  });

  it('rejects a number', () => {
    expect(BlockNumber.safeParse(23500000).success).toBe(false);
  });
});

describe('Indices', () => {
  it.each([[[]], [[0]], [[0, 2, 5]]])('accepts %j', (value) => {
    expect(Indices.safeParse(value).success).toBe(true);
  });

  it.each([[[1, 1]], [[2, 1]], [[-1]], [[0.5]]])('rejects %j', (value) => {
    expect(Indices.safeParse(value).success).toBe(false);
  });
});
