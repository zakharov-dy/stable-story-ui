import { createMockClient, type Overview } from '@app/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { checkPageHtml, visibleText } from '../checks/page-html.ts';
import { texts } from '../texts.ts';
import { formatShortDay, tone } from '../view.ts';
import { PageView } from './PageView.tsx';
import { stackGeometry } from './SupplyByChain.tsx';

const render = (overview: Overview) =>
  renderToStaticMarkup(
    createElement(PageView, {
      model: { state: 'data', overview },
      demoState: null,
    }),
  );
const hero = (html: string) =>
  /<section\b(?=[^>]*data-block="header")[\s\S]*?<\/section>/.exec(html)?.[0] ??
  '';
const rowFor = (html: string, slug: string) =>
  [...html.matchAll(/<a\b(?=[^>]*class="crow")[\s\S]*?<\/a>/g)].find((match) =>
    match[0].includes(`data-chain="${slug}"`),
  )?.[0] ?? '';

describe('home review regressions', () => {
  it('keeps registry order, colours and boundaries when all server line arrays are shuffled', async () => {
    const overview = await createMockClient('long-history').overview();
    const before = render(overview);
    const original = structuredClone(overview);
    for (const view of Object.values(overview.views)) {
      if (view === null) continue;
      for (const series of Object.values(view.supplyByChain))
        series.lines.reverse();
      for (const kind of ['level', 'share'] as const) {
        const stack = stackGeometry(view, kind, overview.chains);
        const period =
          view.period === 'day'
            ? '30d'
            : view.period === 'week'
              ? '90d'
              : 'all';
        expect(stack).toEqual(
          stackGeometry(original.views[period]!, kind, original.chains),
        );
        expect(stack.layers.map((layer) => [layer.key, layer.index])).toEqual(
          overview.chains.map((chain, index) => [chain.slug, index + 1]),
        );
      }
      expect(view.supplyByChain.stackedLevel.lines[0].key).toBe('avalanche');
    }
    expect(render(overview)).toBe(before);
  });

  it('shows the delayed note as the brand-row link and the supplied tally in the status aside', async () => {
    const overview = await createMockClient('delayed').overview();
    overview.reconciliation.reconciledChains = 2;
    const html = render(overview);
    const brand = /<header class="brand-row"[\s\S]*?<\/header>/.exec(
      html,
    )![0];
    expect(visibleText(brand)).toContain('Base · 30 h behind');
    expect(brand).toContain('href="#chain-status"');
    expect(visibleText(brand)).not.toContain('2/3 reconciled');
    const statusSection = html.slice(
      html.indexOf('data-block="status"'),
      html.indexOf('data-block="how-we-count"'),
    );
    expect(visibleText(statusSection)).toContain('2/3 chains · ');
    expect(checkPageHtml(html, { overview, demoState: null })).toEqual([]);
  });

  it('shows a chain’s own latest mismatch even when it differs from the common day', async () => {
    const overview = await createMockClient('delayed').overview();
    const status = overview.status.chains.find(
      (chain) => chain.state === 'delayed',
    )!;
    overview.asOf = '2026-10-09';
    status.lastClosedDay = '2026-10-08';
    status.unreconciledDays = ['2026-10-08'];
    status.reconciliation!.day = status.lastClosedDay;
    status.reconciliation!.bridge = 'mismatch';
    const html = render(overview);
    const note = texts.header.failed(
      'Base',
      formatShortDay(status.lastClosedDay),
      'bridge check failed',
    );
    expect(visibleText(hero(html))).toContain(note);
    expect(hero(html)).toContain('data-day="2026-10-08"');
    expect(visibleText(rowFor(html, 'base'))).toContain('30 h ◇');
    expect(rowFor(html, 'base')).toContain(
      'data-quality="delayed unreconciled"',
    );
    expect(
      checkPageHtml(html.replace(note, ''), { overview, demoState: null }),
    ).toContain('header latest mismatched day for base');
  });

  it.each(['supply', 'change1d', 'change7d'] as const)(
    'includes %s in the hero quality and incomplete explanation',
    async (key) => {
      const overview = await createMockClient('ok').overview();
      overview.header[key].quality.complete = false;
      const html = render(overview);
      expect(hero(html)).toContain('data-quality="incomplete"');
      expect(hero(html)).toContain(texts.quality.incomplete);
      expect(
        checkPageHtml(html.replace('data-header-note="incomplete"', ''), {
          overview,
          demoState: null,
        }),
      ).toContain('header incomplete note must explain every displayed figure');
      const wrongQuality = html.replace(
        /(<section\b[^>]*data-block="header"[^>]*data-quality=")[^"]+/,
        '$1ok',
      );
      expect(
        checkPageHtml(wrongQuality, { overview, demoState: null }),
      ).toContain('header quality must include every displayed figure');
    },
  );

  it('marks the short-history seven-day change while supply remains complete', async () => {
    const overview = await createMockClient('short-history').overview();
    expect(overview.header.supply.quality.complete).toBe(true);
    expect(overview.header.change7d.quality.complete).toBe(false);
    const html = hero(render(overview));
    expect(html).toContain('data-quality="incomplete"');
    expect(html).toContain('class="neutral">no data over 7 days');
    expect(html).toContain(texts.quality.incomplete);
  });

  it('normalizes no-data quality and renders no positive colour for missing values', async () => {
    const overview = await createMockClient('ok').overview();
    overview.status.chains[0].state = 'no_data';
    overview.day!.rows.find(
      (row) => row.scope === overview.chains[0].slug,
    )!.values.net = null;
    const row = rowFor(render(overview), overview.chains[0].slug);
    expect(row).toContain(
      'data-chain-state="no_data" data-quality="incomplete"',
    );
    expect(row).toContain('class="cd neutral">no data');
    expect(tone(null)).toBe('neutral');
  });

  it('uses n/a with a reason for missing records', async () => {
    const overview = await createMockClient('ok').overview();
    const record = overview.records.find((item) => item.scope === 'all')!;
    record.value = null;
    record.day = null;
    const html = render(overview);
    const item = html
      .slice(html.indexOf(`data-record="${record.kind}"`))
      .split('</li>')[0];
    expect(visibleText(item)).toContain('n/a');
    expect(visibleText(item)).toContain(texts.na.reasons.noDataForRange);
  });
});
