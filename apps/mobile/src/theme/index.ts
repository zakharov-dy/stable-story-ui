import { phoneTokens, tokens } from '@app/tokens';
import { color, fontFamily, ms, px } from './convert.ts';

const source = { ...tokens, ...phoneTokens };
type Source = typeof source;
type ColorToken = Extract<keyof Source, `color-${string}`>;
type PxToken = { [K in keyof Source]: Source[K] extends `${number}px` ? K : never }[keyof Source];
type MsToken = { [K in keyof Source]: Source[K] extends `${number}ms` ? K : never }[keyof Source];

const colors = Object.fromEntries(
  Object.entries(source).filter(([name]) => name.startsWith('color-'))
    .map(([name, value]) => [name, color(value, source)]),
) as Record<ColorToken, string>;
const dimensions = Object.fromEntries(
  Object.entries(source).filter(([, value]) => value.endsWith('px'))
    .map(([name, value]) => [name, px(value)]),
) as Record<PxToken, number>;
const durations = Object.fromEntries(
  Object.entries(source).filter(([, value]) => value.endsWith('ms'))
    .map(([name, value]) => [name, ms(value)]),
) as Record<MsToken, number>;

export const theme = {
  colors,
  dimensions,
  durations,
  opacity: { dimmed: Number(source['opacity-dimmed']) },
  fonts: { sans: fontFamily(source['font-sans']), mono: fontFamily(source['font-mono']) },
  typeScale: {
    xs: dimensions['font-size-xs'], sm: dimensions['font-size-sm'], md: dimensions['font-size-md'],
    lg: dimensions['font-size-lg'], xl: dimensions['font-size-xl'], kpi: dimensions['font-size-kpi'],
    hero: dimensions['font-size-hero'], full: dimensions['font-size-full'],
  },
  spacing: {
    1: dimensions['space-1'], 2: dimensions['space-2'], 3: dimensions['space-3'],
    4: dimensions['space-4'], 5: dimensions['space-5'], 6: dimensions['space-6'],
    gutter: dimensions.gutter,
  },
  radii: {
    radius: dimensions.radius, chip: dimensions['radius-chip'], pill: dimensions['radius-pill'],
    tooltip: dimensions['radius-tooltip'], swatch: dimensions['radius-swatch'],
  },
  // Palette slots follow overview.chains order, without importing the server registry.
  chains: [colors['color-chain-1'], colors['color-chain-2'], colors['color-chain-3'],
    colors['color-chain-4'], colors['color-chain-5'], colors['color-chain-6'],
    colors['color-chain-7'], colors['color-chain-8'], colors['color-chain-9'], colors['color-chain-10']],
} as const;
