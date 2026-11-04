import { describe, expect, it } from 'vitest';
import { tokens } from '../src/tokens.ts';

const ORIGINAL = [
  ['color-chain-1', '#7780d0'],
  ['color-chain-2', '#62d5f0'],
  ['color-chain-3', '#e8a16a'],
  ['color-chain-4', '#cde793'],
  ['color-chain-5', '#d281b8'],
  ['color-chain-6', '#e06c77'],
] as const;

// Approved reserved slots (2026-11-04). Columns are token, hex, bg/surface
// contrast, and minimum CIE76 distance in normal/protanopia/deuteranopia/tritanopia.
// Expectations are literals; measurements below always read the current tokens.
const RESERVED = [
  ['color-chain-7', '#229165', 4.99, 4.65, [31.07, 14.22, 14.24, 23.22]],
  ['color-chain-8', '#a6814a', 5.51, 5.13, [20.70, 14.22, 16.07, 16.88]],
  ['color-chain-9', '#827b8a', 4.84, 4.51, [22.26, 14.23, 14.22, 17.60]],
  ['color-chain-10', '#9e83fa', 6.66, 6.20, [20.00, 16.69, 14.50, 14.28]],
] as const;

const REFERENCES = [
  ...ORIGINAL.map(([name]) => name),
  'color-issuer-mint', 'color-issuer-burn', 'color-bridge-in', 'color-bridge-out', 'color-net',
  'color-positive', 'color-negative',
  'color-delayed', 'color-unreconciled', 'color-unpaired', 'color-incomplete',
  ...RESERVED.map(([name]) => name),
] as const;
// color-shade-incomplete uses incomplete's RGB hue at 14% opacity for a background treatment.

// Same method as apps/web/src/styles/chain-palette.test.ts. Machado et al. (2009)
// severity-1 matrices operate in linear-light sRGB, clamped to [0, 1]. Convert to
// CIELAB with the IEC XYZ matrix and D65 white, without 8-bit rounding. CIE76 is
// Euclidean Lab distance. These token-package tests keep platform code independent.
const CVD = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
} as const;

type Vision = 'normal' | keyof typeof CVD;

const linear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

function labOf(hex: string, vision: Vision): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((at) => linear(Number.parseInt(hex.slice(at, at + 2), 16) / 255));
  let rr = r; let gg = g; let bb = b;
  if (vision !== 'normal') {
    const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = CVD[vision];
    rr = Math.min(1, Math.max(0, m0 * r + m1 * g + m2 * b));
    gg = Math.min(1, Math.max(0, m3 * r + m4 * g + m5 * b));
    bb = Math.min(1, Math.max(0, m6 * r + m7 * g + m8 * b));
  }
  const X = (0.4124564 * rr + 0.3575761 * gg + 0.1804375 * bb) / 0.95047;
  const Y = 0.2126729 * rr + 0.7151522 * gg + 0.072175 * bb;
  const Z = (0.0193339 * rr + 0.119192 * gg + 0.9503041 * bb) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 ΔE of two `#rrggbb` colours under one vision. */
function deltaE76(first: string, second: string, vision: Vision): number {
  const [l1, a1, b1] = labOf(first, vision);
  const [l2, a2, b2] = labOf(second, vision);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}


/** WCAG 2.x relative luminance of an sRGB `#rrggbb` colour. */
function luminance(hex: string): number {
  const channel = (at: number): number => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2.x contrast ratio of two sRGB `#rrggbb` colours. */
function contrastRatio(first: string, second: string): number {
  const [lighter, darker] =
    luminance(first) >= luminance(second) ? [first, second] : [second, first];
  return (luminance(lighter) + 0.05) / (luminance(darker) + 0.05);
}


const VISIONS: readonly Vision[] = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];
const round2 = (value: number): number => Math.round(value * 100) / 100;

describe('Home redesign tokens', () => {
  it.each(ORIGINAL)('preserves the existing %s value', (name, value) => {
    expect(tokens[name]).toBe(value);
  });

  it('provides the Home dimensions and dimming opacity', () => {
    expect(tokens).toMatchObject({
      'sticky-bar-height': '48px',
      'opacity-dimmed': '0.25',
      'section-gap': '96px',
    });
  });

  describe.each(RESERVED)('%s', (name, value, contrastBg, contrastSurface, expectedMinima) => {
    it('holds its approved reserved value', () => {
      expect(tokens[name]).toBe(value);
    });

    it('has contrast at least 4.5 on both backgrounds', () => {
      const measured = [
        contrastRatio(tokens[name], tokens['color-bg']),
        contrastRatio(tokens[name], tokens['color-surface']),
      ];
      expect(measured.map(round2)).toEqual([contrastBg, contrastSurface]);
      for (const ratio of measured) expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it.each(VISIONS)('stays separated from all other data colours under %s', (vision) => {
      // The owner approved 14.2 for simulated visions on 2026-11-04. Compare
      // unrounded values to both floors, rounding only the numeric expectations.
      const floor = vision === 'normal' ? 20 : 14.2;
      const comparisons = REFERENCES.filter((other) => other !== name);
      const distances = comparisons.map((other) => deltaE76(tokens[name], tokens[other], vision));
      for (const [index, distance] of distances.entries()) {
        expect(distance, `${name} / ${comparisons[index]} under ${vision}`).toBeGreaterThanOrEqual(floor);
      }
      expect(round2(Math.min(...distances))).toBe(expectedMinima[VISIONS.indexOf(vision)]);
    });
  });
});
