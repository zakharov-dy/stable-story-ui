import { readFileSync } from 'node:fs';
import { createMockClient, Overview } from '@app/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { visibleText } from '../checks/page-html.ts';
import { PageView } from './PageView.tsx';
import { SupplyByChain } from './SupplyByChain.tsx';
import { Status } from './Status.tsx';

const render = (overview: Overview, period: '30d' | '90d' | 'all' = '30d'): string =>
  renderToStaticMarkup(createElement(SupplyByChain, { overview, period }));

const labels = (html: string): string[] => html.match(/<span class="dlab"[^>]*>[\s\S]*?<\/span>/g) ?? [];
const labelFor = (html: string, slot: number): string => labels(html).find((label) => label.includes(`data-chain-index="${slot}"`)) ?? '';

describe('launch: six direct labels and their supplied numbers', () => {
  it('names all six chains with levels and shares at every public resolution', async () => {
    const overview = await createMockClient('long-history').overview();
    for (const period of ['30d', '90d', 'all'] as const) {
      const html = render(overview, period);
      expect(labels(html)).toHaveLength(6);
      expect(visibleText(labelFor(html, 1))).toBe('Ethereum 9.09K 4.8%');
      expect(visibleText(labelFor(html, 5))).toBe('Polygon PoS 44.87K 23.8%');
      expect(visibleText(labelFor(html, 6))).toBe('Avalanche C-Chain 53.84K 28.6%');
      for (const [index, chain] of overview.chains.entries()) expect(labelFor(html, index + 1)).toContain(chain.name);
      expect(labelFor(html, 6)).toContain('+ 0 * var(--chart-chain-label-step)');
      expect(labelFor(html, 1)).toContain('+ 5 * var(--chart-chain-label-step)');
      expect(html).toContain('Mar 15');
      if (period !== '30d') expect(html).toContain('incomplete period');
    }
  });

  it('passes through a supplied share by chain identity and keeps null distinct from zero', async () => {
    const overview = await createMockClient('long-history').overview();
    const supply = overview.views['30d']!.supplyByChain;
    const last = supply.share.buckets.length - 1;
    supply.share.lines.reverse();
    supply.share.lines.find((line) => line.key === 'polygon')!.values[last] = '33.333333';
    supply.share.lines.find((line) => line.key === 'avalanche')!.values[last] = null;
    supply.share.lines.find((line) => line.key === 'base')!.values[last] = '0';
    // Deliberate presentation mutant: parsing would reject inconsistent totals/shares.
    // This guards the absence of page-side arithmetic; real inputs above use the contract mock.
    const html = render(overview);
    expect(visibleText(labelFor(html, 5))).toBe('Polygon PoS 44.87K 33.3%');
    expect(visibleText(labelFor(html, 6))).toBe('Avalanche C-Chain 53.84K n/a');
    expect(visibleText(labelFor(html, 2))).toBe('Base 17.95K 0.0%');
  });

  it('keeps thin adjacent layers, anchored at the top layer midpoint', async () => {
    const overview = await createMockClient('long-history').overview();
    const supply = overview.views['30d']!.supplyByChain;
    const levels = ['50', '10', '10', '8', '1', '1'];
    const boundaries = ['50', '60', '70', '78', '79', '80'];
    supply.level.lines.forEach((line, index) => { line.values = line.values.map(() => levels[index]); });
    supply.stackedLevel.lines.forEach((line, index) => { line.values = line.values.map(() => boundaries[index]); });
    supply.total.lines[0].values = supply.total.lines[0].values.map(() => '80');
    const shares = ['62.5', '12.5', '12.5', '10', '1.25', '1.25'];
    const stackedShares = ['62.5', '75', '87.5', '97.5', '98.75', '100'];
    supply.share.lines.forEach((line, index) => { line.values = line.values.map(() => shares[index]); });
    supply.stackedShare.lines.forEach((line, index) => { line.values = line.values.map(() => stackedShares[index]); });
    const html = render(Overview.parse(overview));
    expect(labels(html)).toHaveLength(6);
    // Total 80 gives axis 100. Midpoint 79.5 => y = 6 + 232 * .205 = 53.56
    // in a 240-unit frame, 22.32% rounded. The two 1-unit layers used to collide.
    expect(labelFor(html, 6)).toContain('calc(22.32% + 0 * var(--chart-chain-label-step))');
    expect(labelFor(html, 5)).toContain('calc(22.32% + 1 * var(--chart-chain-label-step))');
    expect(html).not.toContain('data-dropped');
  });

  it('keeps slot six on the actual sixth overview chain across the page', async () => {
    const overview = await createMockClient('long-history').overview();
    expect(overview.chains[5].slug).toBe('avalanche');
    const html = renderToStaticMarkup(createElement(PageView, { model: { state: 'data', overview }, demoState: null }));
    expect(html).toMatch(/class="chain" data-chain-index="6">Avalanche C-Chain/);
    expect(labelFor(html, 6)).toContain('Avalanche C-Chain');
    const css = readFileSync(new URL('../styles/charts.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\[data-chain-index='6'\]\s*\{\s*--chain-color: var\(--color-chain-6\)/);
  });

  it('keeps the mobile legend levels and hides only the shares', () => {
    const css = readFileSync(new URL('../styles/charts.css', import.meta.url), 'utf8');
    const phone = css.slice(css.indexOf('@media (max-width: 720px)'));
    expect(phone).toMatch(/\.dlab-share\s*\{\s*display: none/);
    expect(phone).toMatch(/\.dlab\s*\{\s*position: static/);
    expect(phone).not.toMatch(/\.dlab-value\s*\{\s*display: none/);
  });
});

it('renders exactly one resolution sentence with all three periods', async () => {
  const overview = await createMockClient('long-history').overview();
  const html = renderToStaticMarkup(createElement(PageView, { model: { state: 'data', overview }, demoState: null }));
  const sentence = 'The last 30 days are shown by day, 90 days by week, and the full span by calendar month.';
  expect(html.split(sentence)).toHaveLength(2);
  for (const period of ['30d', '90d', 'all']) expect(html).toContain(`value="${period}"`);
  expect(html).toContain('daily');
  expect(html).toContain('weekly');
  expect(html).toContain('monthly');
});

it('Last run keeps its UTC timestamp and result, with the block only in Last block', async () => {
  const overview = await createMockClient('ok').overview();
  const status = overview.status.chains[0];
  status.lastBlock = '23812407';
  status.lastRun = { finishedAt: '2026-10-10T05:57:00.000Z', status: 'ok', toBlock: '999999999' };
  const html = renderToStaticMarkup(createElement(Status, { overview: Overview.parse(overview) }));
  expect(visibleText(html)).toContain('Oct 10 05:57 · ok');
  expect(html).toContain('23,812,407');
  expect(html).not.toContain('999,999,999');
});
