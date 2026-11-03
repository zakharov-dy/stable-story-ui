// Targeted B2 rendering regression. The generic raw HTML/RSC build gate belongs to W3.
import { createMockClient } from '@app/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { texts } from '../texts.ts';
import { supplyTooltips, driverTooltips } from '../view.ts';
import { driverDigits } from '@app/view';
import { PageView } from './PageView.tsx';

it('renders the public selections without the concrete older daily chart sentinels', async () => {
  const overview = await createMockClient('long-history').overview();
  const html = renderToStaticMarkup(createElement(PageView, { model: { state: 'data', overview }, demoState: 'long-history' }));
  expect((html.match(/<svg\b/g) ?? []).length).toBe(41);
  const charts = (html.match(/<section\b[\s\S]*?<\/section>/g) ?? []).filter((section) => /aria-labelledby="h-(?:supply-by-chain|drivers|issuer-vs-bridge)/.test(section)).join('');
  expect(charts.length).toBeGreaterThan(10_000);
  for (const daily of ['123.456789', '3659.456789', '3,659.456789']) expect(charts).not.toContain(daily);
  for (const chain of overview.chains) expect(charts).toContain(chain.name);
  expect(charts).toContain('183.46'); // the Dec 21…27 issuer sum, not Dec 22's 123.456789
  expect(charts).toContain('weekly flows');
  expect(charts).toContain('monthly flows');
  expect(html).toContain(texts.resolution.sentence);
  // Explicit launch counts: Feb 14–Mar 15 = 30 days, Dec 16–Mar 15 = 14 ISO
  // week intersections, Nov 15–Mar 15 = five calendar-month intersections.
  const sections = html.match(/<section\b[\s\S]*?<\/section>/g) ?? [];
  const drivers = (html.match(/<figure\b[\s\S]*?<\/figure>/g) ?? []).filter((figure) => figure.includes('class="card mult"'));
  for (const [period, buckets] of [['30d', 30], ['90d', 14], ['all', 5]] as const) {
    const supplySection = sections.find((section) => section.includes('aria-labelledby="h-supply-by-chain') && section.includes(`data-period="${period}"`))!;
    const splitSection = sections.find((section) => section.includes('aria-labelledby="h-issuer-vs-bridge') && section.includes(`data-period="${period}"`))!;
    expect((supplySection.match(/class="chart-hit"/g) ?? []).length).toBe(2 * buckets);
    const scopes = drivers.filter((figure) => figure.includes(`data-period="${period}"`));
    expect(scopes).toHaveLength(7);
    for (const chain of overview.chains) {
      expect(supplySection).toContain(chain.name);
      expect(splitSection).toContain(chain.name);
      const figure = scopes.find((figure) => figure.includes(`data-scope="${chain.slug}"`))!;
      expect(figure).toContain(chain.name);
      expect((figure.match(/class="chart-hit"/g) ?? []).length).toBe(buckets);
    }
  }
  const week = overview.views['90d']!;
  const supply = week.supplyByChain;
  const tips = supplyTooltips(supply.level, supply.share, supply.total, overview.chains, overview.status.chains);
  const driver = week.drivers.find((driver) => driver.scope === 'ethereum')!;
  const flowTips = driverTooltips(driver.series, driverDigits(driver.series), 'Ethereum', driver.events);
  for (const at of [0, tips.length - 1]) {
    expect(tips[at]?.note?.text).toContain('incomplete period');
    expect(tips[at]?.note?.text).not.toContain('no data');
    expect(flowTips[at]?.note?.text).toContain('incomplete period');
    expect(flowTips[at]?.note?.text).not.toContain('no data');
  }
  expect(tips[2]?.note?.text).toBe('includes an unreconciled day');
  expect(flowTips[2]?.note?.text).toBe('includes an unreconciled day');
});
