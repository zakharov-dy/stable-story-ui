import { describe, expect, it } from 'vitest';
import { diamondPath, fraction, levelAxis, linePath, maxOf, minOf, niceCeil, scale, segments, sharedExtent, symmetricFraction, unscale } from './scale.ts';

describe('scale', () => {
  it('keeps values exact above 2^53 and with six decimals', () => {
    const { digits, values } = scale(['9007199254740993', '9007199254740992.000001', null, '-0.5']);
    expect(digits).toBe(6);
    expect(values).toEqual([9007199254740993000000n, 9007199254740992000001n, null, -500000n]);
    expect(maxOf(values)).toBe(9007199254740993000000n);
    expect(minOf(values)).toBe(-500000n);
    expect(unscale(9007199254740992000001n, 6)).toBe('9007199254740992.000001');
    expect(unscale(-500000n, 6)).toBe('-0.5');
    expect(unscale(0n, 6)).toBe('0');
  });

  it('gives fractions for coordinates, a flat range in the middle', () => {
    expect(fraction(5n, 0n, 10n)).toBe(0.5);
    expect(fraction(9007199254740993n, 9007199254740992n, 9007199254740994n)).toBe(0.5);
    expect(fraction(3n, 3n, 3n)).toBe(0.5);
  });
});

describe('linePath', () => {
  it('breaks the line at null instead of drawing 0', () => {
    const path = linePath([{ x: 0, y: 1 }, { x: 1, y: 2 }, null, { x: 3, y: 4 }, { x: 4, y: 5 }]);
    expect(path).toBe('M0 1L1 2M3 4L4 5');
  });

  it('draws an isolated point as a short tick', () => {
    expect(linePath([null, { x: 10, y: 5 }, null], 2)).toBe('M8 5H12');
  });

  it('finds runs of present indices', () => {
    expect(segments(6, (index) => index !== 2 && index !== 3)).toEqual([[0, 1], [4, 5]]);
    expect(segments(0, () => true)).toEqual([]);
  });
});

describe('niceCeil', () => {
  it('rounds up to 1, 2 or 5 × 10^k', () => {
    expect(niceCeil(0n)).toBe(0n);
    expect(niceCeil(-5n)).toBe(0n);
    expect(niceCeil(1n)).toBe(1n);
    expect(niceCeil(3n)).toBe(5n);
    expect(niceCeil(11n)).toBe(20n);
    expect(niceCeil(20n)).toBe(20n);
    expect(niceCeil(21n)).toBe(50n);
    expect(niceCeil(51n)).toBe(100n);
    expect(niceCeil(800_000_000n)).toBe(1_000_000_000n);
  });

  it('is exact above 2^53', () => {
    expect(niceCeil(9007199254740993n)).toBe(10_000_000_000_000_000n);
    expect(niceCeil(5_000_000_000_000_000_001n)).toBe(10_000_000_000_000_000_000n);
    expect(niceCeil(2_000_000_000_000_000_000n)).toBe(2_000_000_000_000_000_000n);
  });
});

describe('sharedExtent', () => {
  it('is the largest magnitude over every list, skipping null', () => {
    expect(sharedExtent([[1n, null, -7n], [3n], []])).toBe(7n);
    expect(sharedExtent([[null], []])).toBe(0n);
    expect(sharedExtent([])).toBe(0n);
  });

  it('takes the extent over all lists together, not per list', () => {
    expect(sharedExtent([[2n], [900n]])).toBe(900n);
    expect(sharedExtent([[2n]])).toBe(2n);
  });
});

describe('symmetricFraction', () => {
  it('puts zero in the middle and ±max at the ends', () => {
    expect(symmetricFraction(0n, 10n)).toBe(0.5);
    expect(symmetricFraction(10n, 10n)).toBe(1);
    expect(symmetricFraction(-10n, 10n)).toBe(0);
    expect(symmetricFraction(5n, 10n)).toBe(0.75);
  });

  it('keeps an all-zero scale on the zero line and stays exact above 2^53', () => {
    expect(symmetricFraction(0n, 0n)).toBe(0.5);
    expect(symmetricFraction(9007199254740993n, 9007199254740993n)).toBe(1);
    expect(symmetricFraction(4503599627370497n, 9007199254740994n)).toBeCloseTo(0.75, 6);
  });
});

describe('diamondPath', () => {
  it('draws a closed diamond around the point', () => {
    expect(diamondPath(10, 20, 5)).toBe('M10 15L15 20L10 25L5 20Z');
  });
});

describe('levelAxis', () => {
  // Hand-computed: the maximum plus 5 % (rounded up), the smallest 1, 2, 2.5 or 5 × 10^k step of at
  // least a quarter of that, and the top rounded up to a whole step. Expectations are literal.
  it('is the design example: 55.9B + 5 % = 58.7B on 20B steps, the top at 60B', () => {
    expect(levelAxis(55_900_000_000n)).toEqual({
      top: 60_000_000_000n,
      step: 20_000_000_000n,
      grid: [20_000_000_000n, 40_000_000_000n, 60_000_000_000n],
    });
  });

  it('takes the wider quarter step when the next one would leave two gridlines', () => {
    // 30B + 5 % = 31.5B; 10B is the first whole step of at least a quarter (7.875B).
    expect(levelAxis(30_000_000_000n)).toEqual({
      top: 40_000_000_000n,
      step: 10_000_000_000n,
      grid: [10_000_000_000n, 20_000_000_000n, 30_000_000_000n, 40_000_000_000n],
    });
    // 80B + 5 % = 84B; 2.5 × 10^k keeps the gridlines at four (25B, 50B, 75B, 100B).
    expect(levelAxis(80_000_000_000n)).toEqual({
      top: 100_000_000_000n,
      step: 25_000_000_000n,
      grid: [25_000_000_000n, 50_000_000_000n, 75_000_000_000n, 100_000_000_000n],
    });
  });

  it('rounds the top up to the next step and keeps three or four gridlines', () => {
    // 100B + 5 % = 105B; 50B steps, the top at 150B, three gridlines.
    expect(levelAxis(100_000_000_000n)).toEqual({
      top: 150_000_000_000n,
      step: 50_000_000_000n,
      grid: [50_000_000_000n, 100_000_000_000n, 150_000_000_000n],
    });
    // The 5 % is what pushes this maximum over 60B: 57142857143 × 1.05 = 60000000000.15 → 60000000001.
    expect(levelAxis(57_142_857_143n)).toEqual({
      top: 80_000_000_000n,
      step: 20_000_000_000n,
      grid: [20_000_000_000n, 40_000_000_000n, 60_000_000_000n, 80_000_000_000n],
    });
  });

  it('works in scaled units and gives no axis without data', () => {
    // 225000.0 at one decimal: 236250.0 + 5 % padded, 100000.0 steps, the top at 300000.0.
    expect(levelAxis(2_250_000n)).toEqual({ top: 3_000_000n, step: 1_000_000n, grid: [1_000_000n, 2_000_000n, 3_000_000n] });
    expect(levelAxis(0n)).toEqual({ top: 0n, step: 0n, grid: [] });
    expect(levelAxis(-5n)).toEqual({ top: 0n, step: 0n, grid: [] });
  });

  it('keeps every axis at three or four gridlines', () => {
    for (let max = 1n; max <= 250n; max += 1n) {
      const { grid, top, step } = levelAxis(max * 1_000n);
      expect(grid.length).toBeGreaterThanOrEqual(3);
      expect(grid.length).toBeLessThanOrEqual(4);
      expect(top).toBe(grid.at(-1));
      expect(top % step).toBe(0n);
    }
  });
});
