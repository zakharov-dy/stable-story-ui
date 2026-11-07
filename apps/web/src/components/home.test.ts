import { createMockClient, type Overview } from '@app/contracts';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { checkPageHtml, visibleText } from '../checks/page-html.ts';
import { mockStates } from '../server/config.ts';
import { texts } from '../texts.ts';
import { formatCompact, formatDay, roundedChange } from '../view.ts';
import { flowBound } from './Drivers.tsx';
import { PageView } from './PageView.tsx';
import { stackGeometry } from './SupplyByChain.tsx';

const render = (overview: Overview) =>
  renderToStaticMarkup(
    createElement(PageView, {
      model: { state: overview.asOf === null ? 'empty' : 'data', overview },
      demoState: null,
    }),
  );
const feedOf = (html: string) =>
  /data-block="feed"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
const listsCss = readFileSync(
  path.join(import.meta.dirname, '..', 'styles', 'lists.css'),
  'utf8',
);

describe('accepted home boards', () => {
  it.each(mockStates)(
    'checks every block, chain and quality carrier for %s',
    async (state) => {
      const overview = await createMockClient(state)
        .overview()
        .catch(() => null);
      const html = renderToStaticMarkup(
        createElement(PageView, {
          model:
            overview === null
              ? { state: 'unavailable', reason: 'transport' }
              : { state: overview.asOf === null ? 'empty' : 'data', overview },
          demoState: state,
        }),
      );
      expect(checkPageHtml(html, { overview, demoState: state })).toEqual([]);
    },
  );

  it('renders ready reconciliation counts without deriving a total from chain rows', async () => {
    const overview = await createMockClient('long-history').overview();
    overview.reconciliation.all.closedDays = 9700;
    overview.reconciliation.all.mismatchedDays = 7;
    overview.reconciliation.reconciledChains = 4;
    const text = visibleText(render(overview));
    expect(text).toContain('4/6 reconciled');
    expect(text).toContain(
      '4/6 chains · 7 mismatched days · 9,700 chain-days closed',
    );
    expect(
      checkPageHtml(render(overview).replace('4/6 chains · ', ''), {
        overview,
        demoState: null,
      }),
    ).toContain('ready reconciliation stamp');
  });

  it('places the full data date in the brand row and sticky bar', async () => {
    const overview = await createMockClient('long-history').overview();
    const html = render(overview);
    const date = texts.asOf(formatDay(overview.asOf));
    for (const place of ['brand', 'sticky'])
      expect(html).toContain(`data-date="${place}">${date}</`);
    expect(html).toContain('id="sticky-bar" hidden=""');
  });

  it('renders the approved block order and exactly one older-period sentence', async () => {
    const html = render(await createMockClient('long-history').overview());
    const blocks = [...html.matchAll(/data-block="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(blocks).toEqual([
      'status',
      'header',
      'waterfall',
      'supply-by-chain',
      'drivers',
      'feed',
      'records',
      'how-we-count',
      'disclaimer',
    ]);
    expect(html.split(texts.resolution.sentence)).toHaveLength(2);
    expect(html).not.toContain('data-kpi=');
    expect(html).not.toContain('data-incomplete=');
  });

  it('uses the scope-all day row even when chain rows disagree', async () => {
    const overview = await createMockClient('long-history').overview();
    overview.day!.rows.find((row) => row.scope === 'all')!.values.net =
      '-123456789';
    overview.day!.rows.find((row) => row.scope === 'all')!.values.issuer_mint =
      '987654321';
    overview.header.change1d.value = '234567890';
    const text = visibleText(render(overview));
    expect(text).toContain('−123M');
    expect(text).toContain('+988M');
    expect(text).toContain('+235M today');
  });

  it('rounds only the rendering domain to the board flow scales', () => {
    expect(flowBound(2545080941710068n)).toBe(4000000000000000n);
    expect(flowBound(298000000n)).toBe(400000000n);
    expect(flowBound(0n)).toBe(0n);
  });

  it('formats the board deltas as amounts without percentages', () => {
    expect(roundedChange('-541449604.378691')).toBe('−541M');
    expect(roundedChange('-1187228080.484454')).toBe('−1.19B');
    expect(roundedChange('3291521.199601')).toBe('+3M');
    expect(roundedChange(null)).toBe(texts.noData);
  });

  it('uses the latest ready share by chain identity and keeps null distinct from zero', async () => {
    const overview = await createMockClient('long-history').overview();
    const share = overview.views['30d']!.supplyByChain.share;
    share.lines.reverse();
    share.lines.find((line) => line.key === 'base')!.values[
      share.buckets.length - 1
    ] = '0';
    share.lines.find((line) => line.key === 'polygon')!.values[
      share.buckets.length - 1
    ] = null;
    const html = render(overview);
    const rows = [
      ...html.matchAll(/<a\b(?=[^>]*class="crow")[\s\S]*?<\/a>/g),
    ].map((match) => match[0]);
    expect(visibleText(rows[1])).toContain('0.0%');
    expect(visibleText(rows[4])).toContain(texts.noData);
  });

  it('draws known ALL layers across missing coverage using ready boundaries', async () => {
    const overview = await createMockClient('long-history').overview();
    const view = overview.views.all!;
    view.noDataChains = view.supplyByChain.level.buckets.map(() => [
      'base',
      'arbitrum',
      'optimism',
      'polygon',
    ]);
    for (const kind of [
      'level',
      'share',
      'stackedLevel',
      'stackedShare',
    ] as const) {
      for (const line of view.supplyByChain[kind].lines) {
        line.values = line.values.map(() =>
          view.noDataChains![0].includes(line.key) ? null : '1234567',
        );
      }
    }
    const stack = stackGeometry(view, 'level', overview.chains);
    expect(stack.missing.every((flag) => !flag)).toBe(true);
    expect(stack.layers[0].known.every(Boolean)).toBe(true);
    expect(stack.layers[1].known.some(Boolean)).toBe(false);
    expect(stack.layers[5].known.every(Boolean)).toBe(true);
    expect(stack.layers[5].bottom).toEqual(stack.layers[0].top);
    expect(render(overview)).toContain(
      'data-chain="avalanche"><path class="area"',
    );
    view.noDataChains[0] = [];
    expect(stackGeometry(view, 'level', overview.chains).missing[0]).toBe(true);
  });

  it('uses ready totals and record peaks without calculating them', async () => {
    const overview = await createMockClient('long-history').overview();
    const view = overview.views.all!;
    view.supplyByChain.total.lines[0].values =
      view.supplyByChain.total.lines[0].values.map(() => '7654321000');
    const record = overview.records.find(
      (row) => row.scope === 'all' && row.kind === 'max_supply',
    )!;
    record.day = view.supplyByChain.level.buckets[1].end;
    record.value = '8765432100';
    const html = render(overview);
    expect(html).toContain('Tracked supply 7.65B');
    expect(visibleText(html)).toContain(
      texts.supplyByChain.peak('8.77B', formatDay(record.day)),
    );
  });

  it('only offers additional operation rows when the response contains them', async () => {
    const overview = await createMockClient('long-history').overview();
    const original = overview.largestEvents.items[0];
    overview.largestEvents.items = Array.from({ length: 8 }, (_, index) => ({
      ...original,
      id: `${original.id}-${index}`,
    }));
    expect(render(overview)).toContain(texts.feed.showAll(8));
    overview.largestEvents.items = overview.largestEvents.items.slice(0, 5);
    const closed = render(overview);
    expect(closed).not.toContain('operations-more');
    expect(feedOf(closed)).not.toContain('<summary');
  });

  it('keeps the operations control visually after the last row with both labels and the board chevron', async () => {
    const overview = await createMockClient('long-history').overview();
    expect(overview.largestEvents.items.length).toBeGreaterThan(5);
    const feed = feedOf(render(overview));
    expect(feed).not.toBe('');
    expect(feed.split('class="oplist"')).toHaveLength(2);
    expect(feed).toContain(
      texts.feed.showAll(overview.largestEvents.items.length),
    );
    expect(feed).toContain(texts.feed.showFive);
    // The summary stays first in the disclosure (native toggle and hiding);
    // the stylesheet orders it after the wrapped rows.
    expect(feed).toMatch(/<details class="operations-more">\s*<summary/);
    const details = feed.indexOf('<details class="operations-more">');
    const close = feed.indexOf('</details>', details);
    expect(
      close > details &&
        feed.slice(details, close).split('data-operation=').length - 1,
    ).toBe(overview.largestEvents.items.length - 5);
    // The stylesheet orders the first-child summary after the wrapped rows.
    expect(listsCss).toMatch(
      /\.operations-more\s*>\s*summary\s*\{[^}]*order:\s*1/,
    );
    expect(feed).toContain('<path d="M3 7.5l3-3 3 3"');
    expect(feed).not.toContain('⌄');
  });

  it('opens every operation row in a new tab without changing its explorer URL', async () => {
    const overview = await createMockClient('long-history').overview();
    const tags = [
      ...render(overview).matchAll(
        /<a\b[^>]*data-operation="([^"]+)"[^>]*>/g,
      ),
    ];
    expect(tags.map((match) => match[1])).toEqual(
      overview.largestEvents.items.map((row) => row.id),
    );
    for (const [index, row] of overview.largestEvents.items.entries()) {
      expect(tags[index]?.[0]).toContain(`href="${row.explorerUrl}"`);
      expect(tags[index]?.[0]).toContain('target="_blank"');
      expect(tags[index]?.[0]).toContain('rel="noopener noreferrer"');
    }
  });

  it('marks bridge routes, versions, unknown peers and pairing on complete link rows', async () => {
    const overview = await createMockClient('unreconciled').overview();
    const row = overview.largestEvents.items.find(
      (row) => row.bridge !== null,
    )!;
    expect(row).toBeDefined();
    const html = render(overview);
    expect(html).toContain(`href="${row.explorerUrl}"`);
    expect(visibleText(html)).toContain(
      texts.feed.version(row.bridge!.version),
    );
  });

  it('renders scope-all records as supplied, without assuming four entries', async () => {
    const overview = await createMockClient('long-history').overview();
    overview.records = overview.records.filter(
      (record) => record.scope !== 'all' || record.kind === 'max_supply',
    );
    const html = render(overview);
    expect([...html.matchAll(/data-record=/g)]).toHaveLength(1);
    expect(visibleText(html)).toContain(
      formatCompact(overview.records[0].value),
    );
  });
});
