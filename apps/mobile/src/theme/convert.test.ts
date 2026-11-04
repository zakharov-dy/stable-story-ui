import { describe, expect, it } from 'vitest';
import { color, fontFamily, px } from './convert.ts';
import { theme } from './index.ts';

describe('native token conversion', () => {
  it('converts px including fractional strokes and rejects other units', () => {
    expect(px('16px')).toBe(16);
    expect(px('1.5px')).toBe(1.5);
    expect(() => px('0.08em')).toThrow('Expected px');
  });
  it('preserves native color channels and resolves aliases', () => {
    expect(color('rgba(110, 66, 202, 0.22)', {})).toBe('rgba(110, 66, 202, 0.22)');
    expect(color('rgba(19,17,42,0.94)', {})).toBe('rgba(19, 17, 42, 0.94)');
    expect(theme.colors['color-crosshair']).toBe('#8e87a6');
    expect(() => color('var(--missing)', {})).toThrow('Invalid color alias');
    expect(() => color('var(--loop)', { loop: 'var(--loop)' })).toThrow('Invalid color alias');
    expect(() => color('rgba(256, 0, 0, 1)', {})).toThrow('Unsupported color');
  });
  it('uses named font families for native asset registration', () => {
    expect(fontFamily("'Space Grotesk', system-ui, sans-serif")).toBe('Space Grotesk');
    expect(fontFamily('"IBM Plex Mono", ui-monospace, monospace')).toBe('IBM Plex Mono');
    expect(theme.fonts).toEqual({ sans: 'Space Grotesk', mono: 'IBM Plex Mono' });
  });
  it('applies phone sizes and converts spacing and radii', () => {
    expect(theme.typeScale.hero).toBe(64);
    expect(theme.typeScale.kpi).toBe(40);
    expect(theme.typeScale.full).toBe(18);
    expect(theme.spacing.gutter).toBe(16);
    expect(theme.spacing[4]).toBe(20);
    expect(theme.radii.radius).toBe(10);
    expect(theme.radii.chip).toBe(8);
  });
  it('converts Home dimensions and the unitless dimming opacity', () => {
    expect(theme.dimensions['sticky-bar-height']).toBe(48);
    expect(theme.dimensions['section-gap']).toBe(96);
    expect(theme.opacity.dimmed).toBe(0.25);
  });
  it('keeps all ten palette slots in chain order', () => {
    expect(theme.chains).toEqual([
      '#7780d0', '#62d5f0', '#e8a16a', '#cde793', '#d281b8', '#e06c77',
      '#229165', '#a6814a', '#827b8a', '#9e83fa',
    ]);
  });
});
