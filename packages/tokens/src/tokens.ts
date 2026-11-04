/**
 * Violet Observatory design tokens (docs/design.md). This is the source of truth.
 * Keep existing CSS property names and exact values; token changes are token PRs.
 * Values retain CSS units, font stacks and aliases. Native consumers adapt those
 * to native style values (for example, '12px' to 12) without importing browser code.
 */
export const tokens = {
  'color-bg': '#0a0916',
  'color-surface': '#13112a',
  'color-surface-2': '#1a1736', // raised chip, nested surface
  'color-text': '#f4f1ff',
  'color-text-muted': '#b3acc5',
  'color-text-dim': '#8e87a6', // fractional digits, axis dates
  'color-border': '#6e6686', // interactive and emphasis borders
  'color-hairline': '#2a2644', // quiet dividers, decorative
  'color-accent': '#b69aff',
  'color-glow': 'rgba(110, 66, 202, 0.22)', // atmosphere, only in empty space

  'color-issuer-mint': '#67e8b5',
  'color-issuer-burn': '#ff9b8f',
  'color-bridge-in': '#85b7ff',
  'color-bridge-out': '#d4a0ff',
  'color-net': '#f5e5ae',

  // In overview.chains order.
  'color-chain-1': '#7780d0',
  'color-chain-2': '#62d5f0',
  'color-chain-3': '#e8a16a',
  'color-chain-4': '#cde793',
  'color-chain-5': '#d281b8',
  'color-chain-6': '#e06c77',
  // Reserved for future chains; re-check when the seventh chain is enabled.
  'color-chain-7': '#229165',
  'color-chain-8': '#a6814a',
  'color-chain-9': '#827b8a',
  'color-chain-10': '#9e83fa',

  // Supply direction: lighter than issuer mint/burn so it never reads as issuer flow.
  'color-positive': '#c4f5dd',
  'color-negative': '#ffcec6',
  'color-delayed': '#f4c86a',
  'color-unreconciled': '#ff97b0',
  'color-unpaired': '#d7a3ff',
  'color-incomplete': '#b4b7c5',
  'color-shade-incomplete': 'rgba(180, 183, 197, 0.14)', // incomplete bucket column
  'color-zero-line': '#6e6686', // zero line in every chart
  'color-focus-ring': '#b69aff', // 2px focus outline
  'color-tooltip-bg': 'rgba(19, 17, 42, 0.94)', // hover card over the plot
  'color-crosshair': 'var(--color-text-dim)', // 1px dashed hover crosshair

  'font-sans': "'Space Grotesk', system-ui, sans-serif",
  'font-mono': "'IBM Plex Mono', ui-monospace, monospace",

  'font-size-xs': '12px', // mono labels, axes
  'font-size-sm': '14px',
  'font-size-md': '16px',
  'font-size-lg': '20px',
  'font-size-xl': '32px',
  'font-size-kpi': '72px', // 40px at phone
  'font-size-hero': '128px', // monument figure; 64px at phone
  'font-size-full': '20px', // exact amount under the monument figure; 18px at phone
  'tracking-label': '0.08em', // uppercase labels and column heads

  'space-1': '4px',
  'space-2': '8px',
  'space-3': '12px',
  'space-4': '20px',
  'space-5': '32px',
  'space-6': '64px',
  'section-gap': '96px', // between Home blocks
  radius: '10px',
  'radius-chip': '8px',
  'radius-pill': '999px',
  'radius-tooltip': '12px', // hover card
  'radius-swatch': '2px', // legend and sample swatches
  'shadow-tooltip': '0 12px 32px rgba(0, 0, 0, 0.45)',
  'content-max-width': '1280px',
  gutter: '80px', // page side gutter; 16px at phone
  'sticky-bar-height': '48px', // Home sticky bar
  'opacity-dimmed': '0.25', // other stack layers while a chain row is hovered

  'stroke-hairline': '1px',
  'stroke-line': '1.5px', // sparklines, area edges
  'stroke-net': '2.5px', // net line, net tick
  'stroke-dot': '6px', // round-capped sparkline point; a stretched plot does not squash it
  'spark-height-tall': '64px', // monument and day card at phone width
  'spark-height-compact': '36px', // 7-day cards at phone width
  'spark-width-band': '96px', // sparkline column of a 7-day card at phone width
  'swatch-size': '10px', // legend and sample square
  'swatch-line': '3px', // sample of a line series (net, zero)
  'hatch-size': '4px', // bridge hatch period (1.6px ink)
  'chart-chain-label-step': '30px', // direct labels in chart 03
  'chart-hover-marker-size': '5px', // hover marker diameter

  'motion-fast': '180ms', // hover and focus feedback
  'motion-tooltip': '120ms', // hover card fade; none between columns
  'motion-base': '240ms', // row and card background, border
  'motion-max': '400ms', // hard ceiling
  'motion-ease': 'cubic-bezier(0.2, 0, 0, 1)',
} as const satisfies Readonly<Record<string, string>>;

export type TokenName = keyof typeof tokens;

/** Phone overrides of the same tokens, at the existing inclusive CSS breakpoint. */
export const phoneTokens = {
  'font-size-kpi': '40px',
  'font-size-hero': '64px',
  'font-size-full': '18px',
  gutter: '16px',
} as const satisfies Readonly<Partial<Record<TokenName, string>>>;

export const phoneMaxWidth = '720px';
