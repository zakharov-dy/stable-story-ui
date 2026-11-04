import { chainInfo, createEquation, createFormat, createSeries, createTooltip, signOf } from '@app/view';
import type { Chains, Term } from '@app/view';
import type { Overview, Series } from '@app/contracts';
import { theme } from './theme/index.ts';
import { texts } from './texts.ts';

export const format = createFormat(texts);
export const equation = createEquation(texts);
export const seriesText = createSeries(texts);
export const tooltip = createTooltip(texts);
export const { colors } = theme;
export const flowColors: Record<Term, string> = {
  issuer_mint: colors['color-issuer-mint'],
  issuer_burn: colors['color-issuer-burn'],
  bridge_in: colors['color-bridge-in'],
  bridge_out: colors['color-bridge-out'],
  net: colors['color-net'],
};

export function chainColor(chains: Chains, slug: string) {
  return theme.chains[chainInfo(chains, slug).index - 1] ?? colors['color-text-muted'];
}

export function netColor(value: string | null) {
  if (value === null) return colors['color-text-muted'];
  const sign = signOf(value);
  return sign === 'zero' ? colors['color-text'] : colors[sign === 'negative' ? 'color-negative' : 'color-positive'];
}

export function chainFigures(overview: Overview, slug: string) {
  const supply = overview.views['30d']?.supplyByChain;
  const atDay = (series: Series | undefined) => {
    const index = series?.buckets.findIndex((bucket) => bucket.end === overview.asOf) ?? -1;
    const value = series?.lines.find((line) => line.key === slug)?.values[index];
    return value === undefined || value === null ? null : String(value);
  };
  return { level: atDay(supply?.level), share: atDay(supply?.share) };
}

export function compactChange(value: string | null) {
  const places = value !== null && value.replace(/^-/, '').split('.')[0].length >= 10 ? 2 : 0;
  return format.formatCompact(value, { signed: true, places });
}
