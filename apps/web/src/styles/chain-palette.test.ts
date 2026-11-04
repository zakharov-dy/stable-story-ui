import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const STYLES = import.meta.dirname;

// The design's six-colour chain palette (docs/design.md, "Data colors"): the exact hex values and
// their WCAG contrasts on the page background and the surface, rounded to one decimal. Kept as
// literals, read from the table rather than computed from the file, so the test fails when a value
// drifts. The names are the chains of `overview.chains` (the registry's enabled order).
const EXPECTED: ReadonlyArray<readonly [token: string, value: string, contrastBg: number, contrastSurface: number]> = [
  ['--color-chain-1', '#7780d0', 5.4, 5.1], // Ethereum
  ['--color-chain-2', '#62d5f0', 11.6, 10.8], // Base
  ['--color-chain-3', '#e8a16a', 9.2, 8.5], // Arbitrum
  ['--color-chain-4', '#cde793', 14.5, 13.5], // OP Mainnet
  ['--color-chain-5', '#d281b8', 7.1, 6.6], // Polygon PoS
  ['--color-chain-6', '#e06c77', 6.2, 5.8], // Avalanche C-Chain
];

const FIVE = EXPECTED.slice(0, 5);
const SIX = EXPECTED[5][1];

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

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** The value of a `--token: #rrggbb` declaration, or null when the token is missing. */
function tokenValue(css: string, token: string): string | null {
  const match = new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  return match?.[1] ? match[1].toLowerCase() : null;
}

/* --------------------------------------------------------------------------
 * Colour-vision distinguishability of the chain palette.
 *
 * Method (the numbers below come from this code): each colour is simulated for
 * protanopia, deuteranopia and tritanopia with the Machado et al. (2009)
 * severity-1.0 matrices, applied in linear-light sRGB (the IEC 61966-2-1
 * transfer), the simulated RGB clamped to [0, 1]; CIELAB is computed from XYZ
 * with the IEC matrix and the D65 white (0.95047, 1, 1.08883), with no 8-bit
 * step. The distance is CIE76 (Euclidean in Lab), rounded to 0.1 only here.
 *
 * The floors come from the five earlier slots alone: per vision, the closest
 * pair among chain-1..5. Every pair (chain-6, chain-i) under one of the three
 * colour-vision simulations must stay at or above its vision's floor, and every
 * pair in every vision at least at ΔE 20, the palette's separability bar.
 *
 * Min pair of chain-6 to chain-1..5 (normal / protanopia / deuteranopia /
 * tritanopia): chain-1 65.0/48.9/64.8/80.1, chain-2 83.3/38.2/49.3/109.7,
 * chain-3 36.8/33.0/23.3/23.3, chain-4 77.2/49.4/29.5/72.5,
 * chain-5 32.3/29.2/33.0/27.6. Closest pairs of the five alone: 35.5
 * (chain-1/chain-5), 20.7 (chain-3/chain-4), 14.4 (chain-3/chain-4), 14.2
 * (chain-3/chain-5).
 * -------------------------------------------------------------------------- */

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

/** The closest pair among chain-1..5 under one vision: the floor chain-6 is held to. */
function floorOfFive(vision: Vision): number {
  return Math.min(...FIVE.flatMap((first, i) => FIVE.slice(i + 1).map((second) => deltaE76(first[1], second[1], vision))));
}

/** The closest pair between chain-6 and chain-1..5 under one vision. */
const closestToSix = (vision: Vision): number =>
  Math.min(...FIVE.map(([, value]) => deltaE76(SIX, value, vision)));

describe('chain palette', () => {
  const tokens = readFileSync(path.join(STYLES, 'tokens.css'), 'utf8');
  const background = tokenValue(tokens, '--color-bg');
  const surface = tokenValue(tokens, '--color-surface');
  expect(background).not.toBeNull();
  expect(surface).not.toBeNull();

  it.each(EXPECTED)('%s holds its designed value', (token, value) => {
    expect(tokenValue(tokens, token)).toBe(value);
  });

  it.each(EXPECTED)('%s reads on the page background (at least 4.5 : 1)', (token, _value, contrastBg) => {
    const foreground = tokenValue(tokens, token);
    expect(foreground).not.toBeNull();
    const measured = contrastRatio(foreground as string, background as string);
    expect(round1(measured)).toBe(contrastBg);
    expect(measured).toBeGreaterThanOrEqual(4.5);
  });

  it.each(EXPECTED)('%s reads on the surface (at least 4.5 : 1)', (token, _value, _contrastBg, contrastSurface) => {
    const foreground = tokenValue(tokens, token);
    expect(foreground).not.toBeNull();
    const measured = contrastRatio(foreground as string, surface as string);
    expect(round1(measured)).toBe(contrastSurface);
    expect(measured).toBeGreaterThanOrEqual(4.5);
  });

  it('gives chain-6 at least the contrast of the weakest of the five earlier slots', () => {
    // The floor is the five earlier slots alone: chain-6 can never become its own floor.
    const floorBg = Math.min(...FIVE.map(([, , contrastBg]) => contrastBg));
    const floorSurface = Math.min(...FIVE.map(([, , , contrastSurface]) => contrastSurface));
    expect(contrastRatio(SIX, background as string)).toBeGreaterThanOrEqual(floorBg);
    expect(contrastRatio(SIX, surface as string)).toBeGreaterThanOrEqual(floorSurface);
  });

  it.each([
    ['normal', 32.3],
    ['protanopia', 29.2],
    ['deuteranopia', 23.3],
    ['tritanopia', 23.3],
  ] as ReadonlyArray<[Vision, number]>)('keeps chain-6 apart from the five under %s (closest pair %s)', (vision, expected) => {
    expect(round1(closestToSix(vision))).toBe(expected);
    for (const [, value] of FIVE) {
      const distance = round1(deltaE76(SIX, value, vision));
      expect(distance).toBeGreaterThanOrEqual(20);
      if (vision !== 'normal') expect(distance).toBeGreaterThanOrEqual(round1(floorOfFive(vision)));
    }
  });

  it('maps chain slots 1..6 to the chain tokens wherever slots exist', () => {
    const charts = readFileSync(path.join(STYLES, 'charts.css'), 'utf8');
    for (const [token] of EXPECTED) {
      const slot = token.slice('--color-chain-'.length);
      expect(charts).toMatch(
        new RegExp(`\\[data-chain-index='${slot}'\\]\\s*\\{\\s*--chain-color:\\s*var\\(${token}\\);`),
      );
    }
  });

  it('keeps the fallback for a chain index outside 1..10', () => {
    const charts = readFileSync(path.join(STYLES, 'charts.css'), 'utf8');
    expect(charts).toContain('var(--chain-color, var(--color-border))');
    expect(charts).not.toContain("[data-chain-index='0']");
    expect(charts).not.toContain("[data-chain-index='11']");
  });
});
