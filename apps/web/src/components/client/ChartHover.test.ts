// The hover view and its pure helpers: the no-JS titles, exactly one tooltip after hydration, the
// marks, the flip at the right edge, the keyboard steps and the focus ring. The content strings are
// hand-written; no number is produced by the code under test.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TooltipColumn } from '@app/view';
import {
  ChartHoverView,
  claimPage,
  clampChip,
  columnAt,
  createHoverGroup,
  HOVER_IDLE,
  isStepKey,
  placeCard,
  plotFocused,
  plotBlurred,
  pinColumn,
  plotKeyed,
  pointerLeft,
  pointerMoved,
  stepColumn,
  type ChartHoverViewProps,
  type HoverState,
} from './ChartHover.tsx';

const count = (html: string, fragment: string): number => html.split(fragment).length - 1;

const tips = ['tip one', 'tip two', 'tip three'];

function column(index: number): TooltipColumn {
  return {
    header: { label: 'Tracked supply', value: '55.00B', share: '100%' },
    rows: [
      { label: 'Ethereum', value: '44.00B', share: '80.0%', chain: 1 },
      { label: 'Base', value: '8.25B', share: '15.0%', chain: 2 },
      { label: 'Arbitrum', value: '2.75B', share: '5.0%', chain: 3 },
    ],
    note: index === 2 ? { text: 'Base · 30 h behind', tone: 'delayed' } : undefined,
    footer: { label: ['Oct 7', 'Oct 8', 'Oct 9'][index] ?? 'Oct 9', value: 'end of day' },
  };
}

const base: ChartHoverViewProps = {
  tips,
  tooltips: tips.map((_tip, index) => column(index)),
  markers: [[{ at: 0.5, chain: 1 }], [{ at: 0.25, chain: 1 }], []],
  label: 'Supply by chain',
  stretch: true,
  viewBox: '0 0 1000 240',
  hits: tips.map((_tip, index) => ({ x: String(index * 333), width: '333' })),
  hit: { top: 6, height: 232 },
  plot: { left: 0, right: 1, top: 0, bottom: 1 },
  children: createElement('path', { className: 'area', d: 'M0 0' }),
  hydrated: true,
  active: null,
  width: 1000,
  chipWidth: 60,
};

const render = (props: Partial<ChartHoverViewProps>): string =>
  renderToStaticMarkup(createElement(ChartHoverView, { ...base, ...props }));

const styleOf = (html: string, className: string): string =>
  new RegExp(`class="${className}"[^>]*style="([^"]*)"`).exec(html)?.[1] ?? '';

const px = (style: string, property: string): number =>
  Number(new RegExp(`${property}:(-?[\\d.]+)px`).exec(style)?.[1] ?? NaN);

describe('hover: the no-JS path and the hydrated path', () => {
  it('keeps the chart-label title and one title per column without hydration', () => {
    const html = render({ hydrated: false });
    expect(count(html, '<title>')).toBe(1 + tips.length);
    expect(html).toContain('role="img"');
    expect(count(html, 'class="chart-tooltip"')).toBe(0);
    expect(count(html, 'class="chart-crosshair"')).toBe(0);
  });

  it('drops every native title once hydrated, root included, and shows exactly one tooltip', () => {
    const html = render({ active: 1 });
    expect(count(html, '<title>')).toBe(0);
    // Exactly one tooltip: the structured card. It also carries `chart-tip` for the browser smoke.
    expect(count(html, 'data-tooltip="')).toBe(1);
    expect(count(html, 'data-tooltip="structured"')).toBe(1);
    expect(count(html, 'class="chart-tip chart-tooltip"')).toBe(1);
    // The live region repeats the plain tip for assistive technology; the card is aria-hidden.
    expect(html).toContain('role="status"');
    expect(html).toContain('tip two');
  });

  it('renders the server-formatted rows, date and footer of the active column', () => {
    const html = render({ active: 1 });
    for (const text of ['Tracked supply', '55.00B', '100%', 'Ethereum', '44.00B', '80.0%', 'Base', '8.25B', '15.0%', 'Arbitrum', '2.75B', '5.0%', 'Oct 8', 'end of day']) {
      expect(html).toContain(text);
    }
    // The delayed note belongs to the newest bucket, not to this one.
    expect(html).not.toContain('Base · 30 h behind');
  });

  it('shows the quality line of the newest column and omits the ring where the stack top is null', () => {
    const html = render({ active: 2 });
    expect(count(html, 'data-tooltip="structured"')).toBe(1);
    expect(html).toContain('Base · 30 h behind');
    expect(html).toContain('data-tone="delayed"');
    expect(count(html, 'class="chart-ring"')).toBe(0);
    expect(count(html, 'class="chart-crosshair"')).toBe(1);
    expect(count(html, 'class="chart-chip"')).toBe(1);
  });

  it('announces the whole card, the quality line included, in the live region', () => {
    const html = render({
      active: 2,
      announcements: ['one', 'two', 'Oct 9: Tracked supply 55.00B · Base · 30 h behind · end of day'],
    });
    const live = /<div class="chart-live"[^>]*>([^<]*)<\/div>/.exec(html)?.[1];
    expect(live).toBe('Oct 9: Tracked supply 55.00B · Base · 30 h behind · end of day');
    // The card itself is hidden from assistive technology, so the region is the only spoken copy.
    expect(count(html, 'role="status"')).toBe(1);
  });

  it('shows no card and no marks without an active column', () => {
    const html = render({ active: null });
    expect(count(html, '<title>')).toBe(0);
    expect(count(html, 'data-tooltip="')).toBe(0);
    expect(count(html, 'class="chart-crosshair"')).toBe(0);
    expect(count(html, 'class="chart-chip"')).toBe(0);
  });

  it('leaves the plain path with its titles and its plain card, and without the new marks', () => {
    const html = render({ tooltips: undefined, active: 0 });
    expect(count(html, '<title>')).toBe(1 + tips.length);
    expect(count(html, 'class="chart-tip"')).toBe(1);
    expect(count(html, 'data-tooltip="plain"')).toBe(1);
    expect(count(html, 'data-tooltip="structured"')).toBe(0);
    expect(count(html, 'class="chart-crosshair"')).toBe(0);
    expect(html).toContain('tip one');
    expect(html).not.toContain('tabindex');
  });
});

describe('hover: placement', () => {
  it('marks every supplied boundary in its own chain colour and omits missing ones', () => {
    const html = render({ active: 0, markers: [[{ at: 0.8, chain: 1 }, { at: 0.4, chain: 6 }], [], []] });
    expect(count(html, 'class="chart-ring"')).toBe(2);
    const marks = html.match(/<span[^>]*class="chart-ring"[^>]*>/g) ?? [];
    expect(marks.find((mark) => mark.includes('data-chain-index="1"'))).toContain('top:80%');
    expect(marks.find((mark) => mark.includes('data-chain-index="6"'))).toContain('top:40%');
    expect(count(render({ active: 1, markers: [[], [], []] }), 'class="chart-ring"')).toBe(0);
  });

  it('places a pinned card outside the plot with an accessible close button', () => {
    const html = render({ active: 2, pinned: true, closeLabel: 'Close tooltip',
      xAxis: createElement('div', { className: 'chart-x' }, 'Oct 9'),
      yAxis: createElement('div', { className: 'chart-y' }, '60B') });
    expect(count(html, 'data-tooltip="structured"')).toBe(1);
    expect(html.indexOf('data-tooltip="structured"')).toBeLessThan(html.indexOf('class="chart-hover"'));
    expect(html.indexOf('class="chart-y"')).toBeLessThan(html.indexOf('class="chart-hover"'));
    expect(html.indexOf('class="chart-x"')).toBeGreaterThan(html.indexOf('class="chart-hover"'));
    expect(html).toContain('aria-label="Close tooltip"');
    expect(html).toContain('Base · 30 h behind');
    expect(html).toContain('>Oct 9</span>');
    expect(styleOf(html, 'chart-tip chart-tooltip')).toBe('');
  });

  it('keeps a pin across pointer leave, motion and blur, and dismisses it on Escape', () => {
    let state = pinColumn(HOVER_IDLE, 2);
    state = pointerLeft(state);
    state = pointerMoved(state, 0);
    state = plotBlurred(state);
    expect(state).toEqual({ active: 2, focused: false, pinned: true });
    expect(plotKeyed(state, 'Escape', 3)).toEqual({ active: null, focused: false });
  });

  it('sits 18 px right of the column while it fits', () => {
    const html = render({ active: 0 });
    const style = styleOf(html, 'chart-tip chart-tooltip');
    expect(Math.abs(px(style, 'left') - 184.667)).toBeLessThan(0.01);
    expect(html).toContain('data-side="right"');
  });

  it('flips left at the right edge of the plot', () => {
    const html = render({ active: 2 });
    const style = styleOf(html, 'chart-tip chart-tooltip');
    expect(Math.abs(px(style, 'left') - 567.333)).toBeLessThan(0.01);
    expect(html).toContain('data-side="left"');
  });

  it('places the date chip at the hovered column and clamps it inside the plot', () => {
    const middle = render({ active: 1 });
    expect(Math.abs(px(styleOf(middle, 'chart-chip'), 'left') - 500)).toBeLessThan(0.01);
    expect(middle).toContain('>Oct 8</span>');
    const wide = render({
      tips: Array.from({ length: 45 }, (_value, index) => `tip ${String(index)}`),
      tooltips: Array.from({ length: 45 }, (_value, index) => column(index)),
      markers: Array.from({ length: 45 }, () => [{ at: 0.5, chain: 1 }]),
      hits: Array.from({ length: 45 }, (_value, index) => ({ x: String(index), width: '1' })),
      active: 0,
    });
    expect(px(styleOf(wide, 'chart-chip'), 'left')).toBe(30);
  });
});

describe('hover: one card across the page', () => {
  it('leaves exactly one card when focus stays in the level panel and the pointer enters the share panel', () => {
    const group = createHoverGroup();
    let level: HoverState = HOVER_IDLE;
    let share: HoverState = HOVER_IDLE;
    const levelClaim = { group, member: { hide: () => { level = { ...level, active: null }; } } };
    const shareClaim = { group, member: { hide: () => { share = { ...share, active: null }; } } };
    const leaveLevel = group.join(levelClaim.member);
    const leaveShare = group.join(shareClaim.member);

    // The level plot takes focus and shows its first column; the pointer leaves it while it keeps focus.
    claimPage(levelClaim);
    level = plotFocused(level, 3);
    level = pointerLeft(level);
    expect(level).toEqual({ active: 0, focused: true });

    // The pointer enters the share plot: it claims the card from the still focused level plot.
    const active = columnAt(0.5, 3, 0, 1);
    expect(active).toBe(1);
    if (active !== null) claimPage(shareClaim);
    share = pointerMoved(share, active);
    expect(share.active).toBe(1);
    expect(level.active).toBeNull();
    const html = render({ active: level.active }) + render({ active: share.active });
    expect(count(html, 'data-tooltip="structured"')).toBe(1);

    // A step key on the share plot keeps its card; Escape hides only that card and claims nothing.
    claimPage(shareClaim);
    share = plotKeyed(share, 'ArrowRight', 3);
    expect(share.active).toBe(2);
    share = plotKeyed(share, 'Escape', 3);
    expect(share.active).toBeNull();
    leaveLevel();
    leaveShare();
  });

  it('hides every other member on a claim and forgets a member that leaves the group', () => {
    const group = createHoverGroup();
    const hidden = vi.fn();
    const own = vi.fn();
    const self = { hide: own };
    const leaveSelf = group.join(self);
    const leaveOther = group.join({ hide: hidden });

    group.claim(self);
    expect(hidden).toHaveBeenCalledTimes(1);
    expect(own).not.toHaveBeenCalled();

    leaveOther();
    group.claim(self);
    expect(hidden).toHaveBeenCalledTimes(1);
    leaveSelf();
  });
});

describe('hover: pure helpers', () => {
  it('maps a pointer position to a column, and to nothing outside the plot', () => {
    expect(columnAt(0.1, 4, 0.1, 0.9)).toBe(0);
    expect(columnAt(0.5, 4, 0.1, 0.9)).toBe(2);
    expect(columnAt(0.05, 4, 0.1, 0.9)).toBeNull();
    expect(columnAt(0.95, 4, 0.1, 0.9)).toBeNull();
    expect(columnAt(0.5, 0, 0.1, 0.9)).toBeNull();
  });

  it('steps with ← → Home End and hides with Esc', () => {
    expect(isStepKey('End')).toBe(true);
    expect(isStepKey('a')).toBe(false);
    expect(stepColumn(null, 'ArrowRight', 5)).toBe(0);
    expect(stepColumn(null, 'ArrowLeft', 5)).toBe(0);
    expect(stepColumn(2, 'ArrowLeft', 5)).toBe(1);
    expect(stepColumn(2, 'ArrowRight', 5)).toBe(3);
    expect(stepColumn(0, 'ArrowLeft', 5)).toBe(0);
    expect(stepColumn(4, 'ArrowRight', 5)).toBe(4);
    expect(stepColumn(2, 'Home', 5)).toBe(0);
    expect(stepColumn(2, 'End', 5)).toBe(4);
    expect(stepColumn(2, 'Escape', 5)).toBeNull();
    expect(stepColumn(2, 'a', 5)).toBe(2);
    expect(stepColumn(2, 'End', 0)).toBeNull();
  });

  it('places the card right, flips left and keeps it inside the plot', () => {
    expect(placeCard(700, 248, 18, 0, 1000)).toEqual({ left: 718, flipped: false });
    expect(placeCard(900, 248, 18, 0, 1000)).toEqual({ left: 634, flipped: true });
    expect(placeCard(300, 248, 18, 200, 500)).toEqual({ left: 200, flipped: true });
  });

  it('clamps the chip to the plot edges', () => {
    expect(clampChip(5, 60, 0, 1000)).toBe(30);
    expect(clampChip(500, 60, 0, 1000)).toBe(500);
    expect(clampChip(995, 60, 0, 1000)).toBe(970);
    expect(clampChip(5, 60, 0, 50)).toBe(25);
  });
});

describe('hover: styles', () => {
  const css = readFileSync(path.join(import.meta.dirname, '../../styles/charts.css'), 'utf8');

  it('draws the structured focus ring as 2 px of the focus token', () => {
    expect(css).toMatch(/\.chart-hover\[data-mode='structured'\]:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-focus-ring\)/);
  });

  it('keeps the 248 px card and the plain card for the unmigrated charts', () => {
    expect(css).toMatch(/\.chart-tooltip\s*\{[^}]*width:\s*248px/);
    expect(css).toMatch(/\.chart-tip\s*\{/);
  });
});
