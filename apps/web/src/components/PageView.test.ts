import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createMockClient, EventRow, Overview } from '@app/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { checkPageHtml } from '../checks/page-html.ts';
import { texts } from '../texts.ts';
import { PageView } from './PageView.tsx';

// No mock state serves an unpaired row (only negative fixtures have one), so the test builds it from
// a row of the `ok` state as the overview contract defines it: a bridge event with op: null, its own
// row, no peer.
async function withUnpairedRow(): Promise<{ overview: Overview; row: EventRow }> {
  const ok = await createMockClient('ok').overview();
  const [source, ...rest] = ok.largestEvents.items;
  if (source === undefined) throw new Error('the ok feed is empty');
  const row = EventRow.parse({ ...source, flow: 'bridge_in', unpaired: true, bridge: { version: 2, peer: null } });
  const overview = Overview.parse({
    ...ok,
    largestEvents: {
      ...ok.largestEvents,
      items: [row, ...rest],
      // The feed's quality accounts for the unpaired event.
      quality: { ...ok.largestEvents.quality, operationsComplete: false, unpairedEvents: ok.largestEvents.quality.unpairedEvents + 1 },
    },
  });
  return { overview, row };
}

// Contract fixtures that no mock state serves (packages/contracts/fixtures, read as data).
const fixture = (name: string): Overview =>
  Overview.parse(JSON.parse(readFileSync(path.join(import.meta.dirname, '../../../../packages/contracts/fixtures', name, 'overview.json'), 'utf8')));

const render = (overview: Overview): string =>
  renderToStaticMarkup(createElement(PageView, { model: { state: overview.asOf === null ? 'empty' : 'data', overview }, demoState: null }));

describe('PageView', () => {
  it('shows chains with closed days but no common coverage as empty, with each chain\'s status', () => {
    const overview = fixture('nonintersecting-coverage');
    expect(overview.asOf).toBeNull();
    expect(overview.status.chains.every((status) => status.lastClosedDay !== null)).toBe(true);
    const html = render(overview);
    expect(checkPageHtml(html, { overview, demoState: null })).toEqual([]);
    expect(html).toContain(texts.howWeCount.coverage(overview.chains.map((chain) => chain.name), null));
  });

  it('keeps an unpaired known-minter event a marked bridge flow', () => {
    const overview = fixture('known-minter-unpaired');
    const unpaired = overview.largestEvents.items.filter((row) => row.unpaired);
    expect(unpaired.length).toBeGreaterThan(0);
    const html = render(overview);
    expect(checkPageHtml(html, { overview, demoState: null })).toEqual([]);
    for (const row of unpaired) {
      expect(row.flow).toMatch(/^bridge_/);
      expect(html).toContain(`<tr data-flow="${row.flow}" data-unpaired="true"`);
    }
  });

  it('marks an unpaired feed row, its unknown peer and the feed quality', async () => {
    const { overview, row } = await withUnpairedRow();
    const html = renderToStaticMarkup(createElement(PageView, { model: { state: 'data', overview }, demoState: null }));
    expect(checkPageHtml(html, { overview, demoState: null })).toEqual([]);
    // The feed row carries the flow and the unpaired attribute, whatever their order or number.
    const rowStart = new RegExp(`<tr data-flow="${row.flow}"[^>]*data-unpaired="true"[^>]*>`).exec(html);
    expect(rowStart).not.toBeNull();
    const start = rowStart?.index ?? -1;
    const markup = html.slice(start, html.indexOf('</tr>', start));
    expect(markup).toContain(`data-mark="unpaired">${texts.tags.unpaired}<`);
    // An unpaired event has no peer: "bridge in" without a direction, and the "peer unknown" tag.
    expect(markup).toContain(`${texts.feed.types.bridge_in}<`);
    expect(markup).not.toContain(texts.feed.bridgeFrom(''));
    expect(markup).toContain(`>${texts.tags.peerUnknown}<`);
    expect(markup).toContain(texts.feed.cctp(2));
    expect(html).toMatch(/data-block="feed" data-quality="[^"]*operations-incomplete unpaired/);
    expect(html).toContain(texts.quality.unpaired(overview.largestEvents.quality.unpairedEvents));
  });
});
