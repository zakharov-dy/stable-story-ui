import { createMockClient, Overview, type MockState, type Series } from '@app/contracts';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { checkPageHtml } from '../checks/page-html.ts';
import { texts } from '../texts.ts';
import { driverDigits } from '@app/view';
import { driverTooltips } from '../view.ts';
import { ChartHoverView } from './client/ChartHover.tsx';
import { Drivers } from './Drivers.tsx';
import { PageView } from './PageView.tsx';

const load = (state: MockState): Promise<Overview> => createMockClient(state).overview();
const clone = (overview: Overview): Overview => structuredClone(overview);
const parse = (value: Overview): Overview => value; // Rendering fixtures; validation is owned by contracts.
const driversHtml = (overview: Overview): string => renderToStaticMarkup(createElement(Drivers, { overview }));
const pageHtml = (overview: Overview): string =>
  renderToStaticMarkup(createElement(PageView, { model: { state: 'data', overview }, demoState: null }));
const count = (html: string, fragment: string): number => html.split(fragment).length - 1;
const chunks = (html: string, open: string): string[] => html.split(open).slice(1).map((chunk) => open + chunk);
const figures = (html: string): string[] =>
  chunks(html, '<figure class="card mult"').map((chunk) => chunk.slice(0, chunk.indexOf('</figure>')));
const figureOf = (html: string, index: number, period = '30d'): string =>
  figures(html).find((figure) => figure.includes(`data-chain-index="${index}"`) && figure.includes(`data-period="${period}"`)) ?? '';
/** The 30D figures of a page render: the default view slice of the period × view matrix. */
const thirty = (html: string): string[] =>
  figures(html).filter((figure) => figure.includes('data-period="30d"'));
/** The value labels of one card, top to bottom. */
const yLabels = (figure: string): string[] =>
  [...figure.matchAll(/class="yl"[^>]*>([^<]*)</g)].map((match) => match[1] ?? '');

const DAYS = ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
const ETH_MINT = ['2000000000', '2500000000', '1000000000', '500000000', '1500000000', '0', '800000000'];
const times1000 = (values: readonly string[]): string[] => values.map((value) => (value === '0' ? '0' : `${value}000`));
const ARB_MINT = ['100000000', '150000000', '120000000', '90000000', '110000000', '130000000', '140000000'];
/** The All scope is deliberately not the chains' sum (a flat 800M a day), so the All view
 * provably shows the API's `all` scope: +80M bound, +40M half. */
const ALL_MINT = ['800000000', '800000000', '800000000', '800000000', '800000000', '800000000', '800000000'];

/**
 * The `short-history` fixture (Oct 3 – Oct 9) with hand-written driver values: ethereum peaks at
 * 2.5B, base is the same shape a thousand times larger, arbitrum stays small. `mutate` edits the
 * clone before it is parsed.
 */
async function sevenDay(mutate?: (copy: Overview) => void): Promise<Overview> {
  const copy = clone(await load('short-history'));
  const buckets = DAYS.map((day) => ({ start: day, end: day, complete: true }));
  const linesFor = (mint: readonly string[]): Series['lines'] => [
    { key: 'issuer_mint', flow: 'issuer_mint', values: [...mint], unreconciled: [] as number[] },
    { key: 'issuer_burn', flow: 'issuer_burn', values: mint.map(() => '0'), unreconciled: [] as number[] },
    { key: 'bridge_in', flow: 'bridge_in', values: mint.map(() => '0'), unreconciled: [] as number[] },
    { key: 'bridge_out', flow: 'bridge_out', values: mint.map(() => '0'), unreconciled: [] as number[] },
    { key: 'net', flow: 'net', values: [...mint], unreconciled: [] as number[] },
  ];
  const mint: Record<string, readonly string[]> = { ethereum: ETH_MINT, base: times1000(ETH_MINT), arbitrum: ARB_MINT };
  for (const driver of copy.views['30d']!.drivers) {
    if (driver.scope === 'all') {
      driver.series.buckets = buckets.map((bucket) => ({ ...bucket }));
      driver.series.lines = linesFor(ALL_MINT);
      driver.events = ALL_MINT.map(() => 1);
      continue;
    }
    const values = mint[driver.scope];
    if (values === undefined) throw new Error(`no values for ${driver.scope}`);
    driver.series.buckets = buckets.map((bucket) => ({ ...bucket }));
    driver.series.lines = linesFor(values);
    driver.events = values.map(() => 1);
  }
  mutate?.(copy);
  return parse(copy);
}

describe('drivers: each card on its own scale', () => {
  it('labels the raw own maximum and its half, with a sign and no trailing zeros', async () => {
    const html = driversHtml(await sevenDay());
    const ethereum = figureOf(html, 1);
    expect(ethereum).toContain('data-scale="2500000000"');
    expect(yLabels(ethereum)).toEqual(['+2.5B', '+1.25B', `${texts.minus}1.25B`, `${texts.minus}2.5B`]);
    const base = figureOf(html, 2);
    expect(base).toContain('data-scale="2500000000000"');
    expect(yLabels(base)).toEqual(['+2.5T', '+1.25T', `${texts.minus}1.25T`, `${texts.minus}2.5T`]);
    const all = figureOf(html, 0);
    expect(all).toContain('data-scale="800000000"');
    expect(yLabels(all)).toEqual(['+800M', '+400M', `${texts.minus}400M`, `${texts.minus}800M`]);
  });

  it('draws the net dot on the last day', async () => {
    const html = driversHtml(await sevenDay());
    expect(count(thirty(html).join(''), 'class="b-netdot"')).toBe(4);
    for (const index of [0, 1, 2, 3]) expect(figureOf(html, index)).toContain('cx="369.71"');
  });

  it('shows one 0 on the zero line of an all-zero card', async () => {
    const html = driversHtml(await sevenDay((copy) => {
      const driver = copy.views['30d']!.drivers.find((candidate) => candidate.scope === 'ethereum');
      if (driver === undefined) throw new Error('no ethereum drivers');
      for (const line of driver.series.lines) line.values = line.values.map(() => '0');
      driver.events = driver.events.map(() => 0);
    }));
    const ethereum = figureOf(html, 1);
    expect(ethereum).toContain('data-scale="0"');
    expect(yLabels(ethereum)).toEqual(['0']);
  });

  it('splits every band at a gap and draws no point on the gap day', async () => {
    const html = driversHtml(await sevenDay((copy) => {
      const driver = copy.views['30d']!.drivers.find((candidate) => candidate.scope === 'arbitrum');
      if (driver === undefined) throw new Error('no arbitrum drivers');
      for (const line of driver.series.lines) line.values[2] = null;
      driver.events[2] = null;
    }));
    const arbitrum = figureOf(html, 3);
    expect(count(arbitrum, 'class="issuer-area"')).toBe(4);
    expect(count(arbitrum, 'class="bridge-area"')).toBe(4);
    expect(count(arbitrum, 'class="net-line"')).toBe(2);
    expect(arbitrum).not.toContain('net-dash');
    expect(arbitrum).not.toContain('143.43');
    expect(arbitrum).toContain('Oct 5: issuer mint no data');
    expect(arbitrum).toContain('sum per day, Arbitrum');
  });

  it('draws an empty day as a zero tick with its note', async () => {
    const html = driversHtml(await sevenDay((copy) => {
      const driver = copy.views['30d']!.drivers.find((candidate) => candidate.scope === 'arbitrum');
      if (driver === undefined) throw new Error('no arbitrum drivers');
      for (const line of driver.series.lines) line.values[4] = '0';
      driver.events[4] = 0;
    }));
    expect(count(thirty(html).join(''), 'data-empty-day="true"')).toBe(1);
    expect(html).toContain(texts.drivers.emptyNote('Oct 7'));
  });

  it('renders the structured card rows with signs in the no-JS title', async () => {
    const html = driversHtml(await sevenDay());
    const ethereum = figureOf(html, 1);
    expect(ethereum).toContain(
      `<title>Oct 9: issuer mint +800M · issuer burn 0 · bridge in 0 · bridge out 0 · net +800M · sum per day, Ethereum</title>`,
    );
  });


});

/** A two-day driver series with the board's 04 values, for the rendered card test. */
const cardSeries = (): Series => ({
  period: 'day',
  unit: 'tokens',
  buckets: [
    { start: '2026-10-08', end: '2026-10-08', complete: true },
    { start: '2026-10-09', end: '2026-10-09', complete: true },
  ],
  lines: [
    { key: 'issuer_mint', flow: 'issuer_mint', values: ['2000000000', '305000000'], unreconciled: [] },
    { key: 'issuer_burn', flow: 'issuer_burn', values: ['0', '377000000'], unreconciled: [] },
    { key: 'bridge_in', flow: 'bridge_in', values: ['0', '85300000'], unreconciled: [] },
    { key: 'bridge_out', flow: 'bridge_out', values: ['0', '88600000'], unreconciled: [] },
    { key: 'net', flow: 'net', values: ['2000000000', '-75000000'], unreconciled: [] },
  ],
});

describe('drivers: the rendered tooltip card', () => {
  it('shows one card with the scope in its footer, the flow rows and the split', () => {
    const series = cardSeries();
    const columns = driverTooltips(series, driverDigits(series), 'Ethereum');
    const sentence =
      `Oct 9: issuer mint +305M · issuer burn ${texts.minus}377M · bridge in +85.3M · bridge out ${texts.minus}88.6M · net ${texts.minus}75M · sum per day, Ethereum`;
    const html = renderToStaticMarkup(createElement(ChartHoverView, {
      tips: ['Oct 8', 'Oct 9'],
      tooltips: columns,
      announcements: ['Oct 8: Ethereum · day', sentence],
      label: 'Ethereum card',
      viewBox: '0 0 400 200',
      hits: [{ x: '2', width: '198' }, { x: '200', width: '198' }],
      hit: { top: 4, height: 192 },
      plot: { left: 0.005, right: 0.995, top: 0.02, bottom: 0.98 },
      hydrated: true,
      active: 1,
      width: 400,
      chipWidth: 60,
      children: null,
    }));
    expect(count(html, 'chart-tip chart-tooltip')).toBe(1);
    expect(html).not.toContain('class="chart-tooltip-head"');
    expect(html).toContain('sum per day, Ethereum');
    const order = ['>issuer mint<', '>issuer burn<', '>bridge in<', '>bridge out<', '>net<'];
    const positions = order.map((label) => html.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain('<span class="tt-sq" data-flow="issuer_mint"');
    expect(html).toContain('<span class="tt-sq-hatched" data-flow="bridge_in"');
    expect(html).toContain('<span class="tt-bar" data-flow="net"');
    expect(html).toContain('<div class="tt-split"');
    expect(html).toContain(
      `Oct 9: issuer mint +305M · issuer burn ${texts.minus}377M · bridge in +85.3M · bridge out ${texts.minus}88.6M · net ${texts.minus}75M · sum per day, Ethereum`,
    );
  });
});

describe('drivers: one section, three periods, all views', () => {
  it('renders one section with every period × every view and the canonical block once', async () => {
    const html = pageHtml(await load('ok'));
    expect(count(html, 'aria-labelledby="h-supply-by-chain')).toBe(3);
    expect(count(html, 'aria-labelledby="h-issuer-vs-bridge')).toBe(3);
    expect(count(html, 'data-period="')).toBe(18);
    for (const period of ['30d', '90d', 'all'] as const) {
      expect(count(html, `<figure class="card mult" data-period="${period}"`)).toBe(4);
    }
    expect(count(html, 'data-block="drivers"')).toBe(1);
    expect(count(html, 'aria-labelledby="h-drivers"')).toBe(1);
    expect(html).toContain('Flows per week, last 90 days');
    expect(html).toContain('Flows per month, common history');
    expect(html).toContain('Sep 10 – Oct 9. Issuer mint and bridge in go up');
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(html).not.toContain('mults');
    expect(checkPageHtml(html, { overview: await load('ok'), demoState: null })).toEqual([]);
  });

  it('adds no focusable element and no tooltip card in the hidden figures', async () => {
    const html = pageHtml(await load('ok'));
    expect(html).not.toContain('tabindex');
    expect(html).not.toContain('data-tooltip');
    const hidden = figures(html).filter((figure) => !figure.includes('data-period="30d"') || !figure.includes('data-pos="0"'));
    expect(hidden.length).toBe(11);
    for (const figure of hidden) {
      expect(figure).not.toContain('<a ');
      expect(figure).not.toContain('<button');
      expect(figure).not.toContain('<input');
      expect(figure).not.toContain('tabindex');
    }
    expect(count(html, '<pattern id="hatch-drivers-')).toBe(24);
  });

  it('renders the server weekly and monthly selections on six chains', async () => {
    const overview = await load('long-history');
    const html = driversHtml(overview);
    for (const period of ['30d', '90d', 'all'] as const) {
      expect(figures(html).filter((figure) => figure.includes('data-period="' + period + '"'))).toHaveLength(7);
    }
    expect(html).toContain('weekly flows');
    expect(html).toContain('monthly flows');
    expect(html).toContain(texts.resolution.partial);
    expect(html).toContain(texts.resolution.flagged);
    expect(html).not.toContain('Reconciliation mismatch on Jan 3');
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names the empty bucket and the shaded columns by the step it draws, never assumed daily', async () => {
    const overview = clone(await load('long-history'));
    const empty = (period: '90d' | 'all', at: number): void => {
      const driver = overview.views[period]!.drivers.find((candidate) => candidate.scope === 'ethereum');
      if (driver === undefined) throw new Error('no ethereum drivers');
      for (const line of driver.series.lines) line.values[at] = '0';
      driver.events[at] = 0;
    };
    empty('90d', 1);
    empty('all', 3);
    const html = driversHtml(overview);
    // One legend entry per period copy, each naming the step it draws (the 30D copy has the
    // fixture's real empty day of Feb 20; the weekly and monthly ones are set above).
    expect(html).toContain(`<li data-ph="30d" data-flow="zero">${texts.drivers.emptyDay('day')}</li>`);
    expect(html).toContain(`<li data-ph="90d" data-flow="zero">${texts.drivers.emptyDay('week')}</li>`);
    expect(html).toContain(`<li data-ph="all" data-flow="zero">${texts.drivers.emptyDay('month')}</li>`);
    expect(html).toContain(texts.quality.incompleteBuckets('week'));
    expect(html).toContain(texts.quality.incompleteBuckets('month'));
    expect(html).not.toContain(texts.quality.incompleteBuckets('day'));
  });
});

describe('drivers: chain switch', () => {
  const chainInput = (html: string, value: string): string =>
    html.match(new RegExp(`<input[^>]*name="chain"[^>]*value="${value}"[^>]*>`))?.[0] ?? '';
  const periodInput = (html: string, value: string): string =>
    html.match(new RegExp(`<input[^>]*name="period"[^>]*value="${value}"[^>]*>`))?.[0] ?? '';

  it('defaults to All chains and 30D, one radio group per dimension', async () => {
    const html = pageHtml(await sevenDay());
    expect(count(html, 'name="period"')).toBe(3);
    expect(count(html, 'name="chain"')).toBe(4);
    expect(periodInput(html, '30d')).toMatch(/checked/);
    expect(periodInput(html, '90d')).not.toMatch(/checked/);
    expect(periodInput(html, 'all')).not.toMatch(/checked/);
    expect(chainInput(html, 'all')).toMatch(/checked/);
    expect(chainInput(html, 'ethereum')).not.toMatch(/checked/);
    const positions = ['all', 'ethereum', 'base', 'arbitrum'].map((scope, index) => html.indexOf(`data-pos="${index}"`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('shows each view its own figures and names the scope in the scale note', async () => {
    const html = pageHtml(await sevenDay());
    expect(figureOf(html, 0)).toContain('data-scale="800000000"');
    expect(figureOf(html, 1)).toContain('data-scale="2500000000"');
    expect(figureOf(html, 2)).toContain('data-scale="2500000000000"');
    expect(figureOf(html, 0)).toContain('All chains, daily flows');
    expect(figureOf(html, 1)).toContain('Ethereum, daily flows');
    expect(html).toContain('Scale: all chains, USDC per day. Every point is one closed day.');
    expect(html).toContain('Scale: Ethereum, USDC per day. Every point is one closed day.');
  });

  it('names the point of each scale note, and the shaded bucket only when the period has one', async () => {
    const html = driversHtml(await load('long-history'));
    expect(html).toContain('Scale: all chains, USDC per day. Every point is one closed day.');
    expect(html).toContain('Scale: all chains, USDC per week. Every point is one week; the shaded week is an incomplete period.');
    expect(html).toContain('Scale: all chains, USDC per month. Every point is one month; the shaded month is an incomplete period.');
    expect(html).not.toContain('Each view has its own scale.');
    // Every bucket closed: the weekly and monthly notes end after the point sentence.
    const complete = clone(await load('long-history'));
    for (const period of ['30d', '90d', 'all'] as const) {
      const view = complete.views[period];
      if (view === null) continue;
      for (const driver of view.drivers) driver.series.buckets = driver.series.buckets.map((bucket) => ({ ...bucket, complete: true }));
    }
    const closed = driversHtml(complete);
    expect(closed).toContain('Scale: all chains, USDC per week. Every point is one week.');
    expect(closed).toContain('Scale: all chains, USDC per month. Every point is one month.');
    expect(closed).not.toContain('shaded week is an incomplete period');
    expect(closed).not.toContain('shaded month is an incomplete period');
  });

  it('matches every figure to its switch position', async () => {
    const html = driversHtml(await sevenDay());
    expect(html).toContain('<figure class="card mult" data-period="30d" data-scope="all" data-pos="0"');
    expect(html).toContain('<figure class="card mult" data-period="30d" data-scope="ethereum" data-pos="1"');
    expect(html).toContain('<figure class="card mult" data-period="30d" data-scope="base" data-pos="2"');
    expect(html).toContain('<figure class="card mult" data-period="30d" data-scope="arbitrum" data-pos="3"');
  });

  it('links the echo to the switch and shows the checked period by CSS alone', async () => {
    const html = pageHtml(await sevenDay());
    expect(html).toContain('<a class="pecho" href="#period">');
    expect(html).toContain('id="period"');
    const css = readFileSync(path.join(import.meta.dirname, '../styles/charts.css'), 'utf8');
    for (const value of ['30d', '90d', 'all'] as const) {
      expect(css).toContain(
        `.period-group:has(input[name='period'][value='${value}']:checked) [data-ph]:not([data-ph='${value}'])`,
      );
      expect(css).toContain(
        `.period-group:has(input[name='period'][value='${value}']:checked) .views figure[data-period]:not([data-period='${value}'])`,
      );
    }
    for (const pos of [0, 1, 2, 3, 4, 5, 6]) {
      expect(css).toContain(
        `.period-group:has(input[name='chain'][data-pos='${pos}']:checked) .views figure[data-pos]:not([data-pos='${pos}'])`,
      );
      expect(css).toContain(
        `.period-group:has(input[name='chain'][data-pos='${pos}']:checked) .vscale span[data-pos]:not([data-pos='${pos}'])`,
      );
    }
    const mainCss = css.split('@supports')[0] ?? '';
    const hideSelectors = [...mainCss.matchAll(/([^{}]+)\{\s*display:\s*none;?\s*\}/g)].map((match) => match[1] ?? '');
    const excluded = (checked: '30d' | '90d' | 'all'): string[] => {
      const found = new Set<string>();
      for (const block of hideSelectors) {
        for (const selector of block.split(',')) {
          if (!selector.includes(`:has(input[name='period'][value='${checked}']:checked)`)) continue;
          if (!selector.includes('[data-ph]')) continue;
          for (const value of ['30d', '90d', 'all'] as const) {
            if (selector.includes(`:not([data-ph='${value}'])`)) found.add(value);
          }
        }
      }
      return [...found].sort();
    };
    expect(excluded('30d')).toEqual(['30d']);
    expect(excluded('90d')).toEqual(['90d']);
    expect(excluded('all')).toEqual(['all']);
    for (const block of hideSelectors) {
      for (const selector of block.split(',')) {
        if (!selector.includes('[data-ph]')) continue;
        expect(selector).toMatch(/:has\(input\[name='period'\]/);
      }
    }
    const supports = /@supports not selector\(:has\(\*\)\) \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(supports).toContain(`.pecho b[data-ph]:not([data-ph='30d'])`);
    expect(supports).not.toContain(`[data-ph='90d']`);
    expect(supports).not.toContain(`[data-ph='all']`);
  });

  it('marks a delayed chain in the switch with the board dot and a hidden lag', async () => {
    const html = pageHtml(await load('delayed'));
    expect(html).toContain('<b class="dl" title="30 h behind"><span class="vh">30 h behind</span></b>');
    expect(html).toContain(texts.tags.behindShort('30'));
    expect(count(thirty(html).join(''), 'data-delayed="true"')).toBe(1);
    expect(html).toContain('<span class="tag delayed">30 h behind</span>');
  });

  it('shows the existing no-data note when a whole window is unknown', async () => {
    const html = driversHtml(await sevenDay((copy) => {
      const driver = copy.views['30d']!.drivers.find((candidate) => candidate.scope === 'arbitrum');
      if (driver === undefined) throw new Error('no arbitrum drivers');
      for (const line of driver.series.lines) line.values = line.values.map(() => null);
      driver.events = driver.events.map(() => null);
    }));
    for (const period of ['30d'] as const) {
      const arbitrum = figureOf(html, 3, period);
      expect(arbitrum).toContain(texts.drivers.gapNote('Oct 3 – Oct 9'));
      expect(arbitrum).not.toContain('class="issuer-area"');
      expect(arbitrum).toContain('data-scale="0"');
    }
  });

  it('renders no tooltip card and no live-region text with nothing hovered', () => {
    const series = cardSeries();
    const columns = driverTooltips(series, driverDigits(series), 'Ethereum');
    const html = renderToStaticMarkup(createElement(ChartHoverView, {
      tips: ['Oct 8', 'Oct 9'],
      tooltips: columns,
      announcements: ['Oct 8: Ethereum · day', 'Oct 9: Ethereum · day'],
      label: 'Ethereum card',
      viewBox: '0 0 400 200',
      hits: [{ x: '2', width: '198' }, { x: '200', width: '198' }],
      hit: { top: 4, height: 192 },
      plot: { left: 0.005, right: 0.995, top: 0.02, bottom: 0.98 },
      hydrated: true,
      active: null,
      width: 400,
      chipWidth: 60,
      children: null,
    }));
    expect(html).not.toContain('chart-tip');
    expect(html).not.toContain('chart-crosshair');
    expect(html).toContain('<div class="chart-live" role="status" aria-live="polite"></div>');
  });
});
