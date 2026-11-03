import { createMockClient, type ChainStatus, type EventRow, type MockState, type Overview, type RecordItem } from '@app/contracts';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatCompact, formatDay, formatShortDay } from '../view.ts';
import { texts } from '../texts.ts';
import { Feed } from './Feed.tsx';
import { Disclaimer, HowWeCount } from './Notes.tsx';
import { Records } from './Records.tsx';
import { Status } from './Status.tsx';

const load = (state: MockState): Promise<Overview> => createMockClient(state).overview();
const html = <P extends object>(component: FunctionComponent<P>, props: P): string => renderToStaticMarkup(createElement(component, props));

/** The markup of the table row that contains `needle`, from its `<tr` to `</tr>`. */
function rowContaining(markup: string, needle: string): string {
  const row = markup.split('<tr ').find((part) => part.includes(needle));
  if (row === undefined) throw new Error(`no row with ${needle}`);
  return row.slice(0, row.indexOf('</tr>'));
}

const withFeed = (overview: Overview, items: EventRow[]): Overview => ({ ...overview, largestEvents: { ...overview.largestEvents, items } });
const firstBridge = (overview: Overview): EventRow => {
  const row = overview.largestEvents.items.find((item) => item.bridge !== null);
  if (row === undefined) throw new Error('no bridge row in the feed');
  return row;
};

describe('Feed', () => {
  it('is a table whose rows keep data-flow first, with roles after the data attributes', async () => {
    const overview = await load('ok');
    const markup = html(Feed, { overview });
    expect(markup).toContain('<table class="feed" role="table"');
    expect(markup.split('<tr data-flow=').length - 1).toBe(overview.largestEvents.items.length);
    for (const item of overview.largestEvents.items) {
      expect(markup).toMatch(new RegExp(`<tr data-flow="${item.flow}"[^>]*role="row"`));
      expect(markup).toContain(`href="${item.explorerUrl}"`);
    }
    expect(markup).toContain(texts.feed.explorer);
  });

  it('shows the order-of-magnitude step from the digits of the amount', async () => {
    const overview = await load('delayed');
    const base = firstBridge(overview);
    const amounts = ['999.5', '10000', '31874002.55', '250000000', '9007199254740993'];
    const items = amounts.map((amount, index) => ({ ...base, id: `${base.id}-${index}`, amount }));
    const markup = html(Feed, { overview: withFeed(overview, items) });
    expect(markup.match(/data-step="\d"/g)).toEqual(['data-step="1"', 'data-step="2"', 'data-step="5"', 'data-step="6"', 'data-step="6"']);
    expect(markup).toContain(texts.feed.magnitudeAria('10⁸'));
    // Six bars, as many lit as the step.
    const bars = /<span class="mag"[^>]*data-step="5">(.*?)<\/span>/.exec(markup)?.[1] ?? '';
    expect(bars.match(/<i class="on"/g)).toHaveLength(5);
    expect(bars.match(/<i/g)).toHaveLength(6);
    // The digits stay exact beyond 2^53.
    expect(markup).toContain('9,007,199,254,740,993');
  });

  it('writes the direction and the peer for a matched CCTP operation, with the CCTP version tag', async () => {
    const overview = await load('delayed');
    const row = firstBridge(overview);
    const peer = row.bridge?.peer;
    expect(peer).toBeTruthy();
    const markup = html(Feed, { overview: withFeed(overview, [row]) });
    const type = row.flow === 'bridge_in' ? texts.feed.bridgeFrom(peer?.name ?? '') : texts.feed.bridgeTo(peer?.name ?? '');
    expect(markup).toContain(`${texts.feed.types[row.flow]} ${type}`);
    expect(markup).toContain(`<span class="tag cctp">${texts.feed.cctp(row.bridge?.version ?? 0)}</span>`);
  });

  it('marks an unpaired event and its unknown peer', async () => {
    const overview = await load('delayed');
    const row: EventRow = { ...firstBridge(overview), unpaired: true, bridge: { version: 2, peer: null } };
    const markup = rowContaining(html(Feed, { overview: withFeed(overview, [row]) }), 'data-unpaired');
    expect(markup).toContain('data-unpaired="true"');
    expect(markup).toContain(`data-mark="unpaired">${texts.tags.unpaired}<`);
    expect(markup).toContain(`>${texts.tags.peerUnknown}<`);
    expect(markup).not.toContain(` ${texts.feed.bridgeFrom('')}`);
  });

  it('shows only "peer unknown" for a matched operation without a peer', async () => {
    const overview = await load('delayed');
    const row: EventRow = { ...firstBridge(overview), unpaired: false, bridge: { version: 1, peer: null } };
    const markup = html(Feed, { overview: withFeed(overview, [row]) });
    expect(markup).toContain(`>${texts.tags.peerUnknown}<`);
    expect(markup).not.toContain('data-unpaired');
    expect(markup).not.toContain(`>${texts.tags.unpaired}<`);
  });

  it('writes a peer outside the tracked chains as plain text, without a chain colour', async () => {
    const overview = await load('delayed');
    const base = firstBridge(overview);
    const row: EventRow = { ...base, flow: 'bridge_in', bridge: { version: 2, peer: { domain: 2, chain: null, name: 'Optimism' } } };
    const markup = rowContaining(html(Feed, { overview: withFeed(overview, [row]) }), 'data-flow');
    expect(markup).toContain(`${texts.feed.types.bridge_in} ${texts.feed.bridgeFrom('Optimism')}`);
    // The only chain swatch of the row is the row's own chain.
    expect(markup.match(/data-chain-index=/g)).toHaveLength(1);
    expect(markup).not.toContain(texts.tags.peerUnknown);
  });

  it('marks the rows of an unreconciled day, in the feed only', async () => {
    const overview = await load('unreconciled');
    const flagged = overview.largestEvents.items.filter((row) => row.unreconciled);
    expect(flagged.length).toBeGreaterThan(0);
    const markup = html(Feed, { overview });
    expect(markup.match(/data-mark="unreconciled"/g)).toHaveLength(flagged.length);
    expect(markup.split(texts.tags.unreconciledDay).length - 1).toBe(flagged.length);
    for (const row of flagged) expect(rowContaining(markup, row.explorerUrl)).toContain('data-unreconciled="true"');
  });

  it('says so when there are no events', async () => {
    const overview = await load('ok');
    expect(html(Feed, { overview: withFeed(overview, []) })).toContain(texts.feed.none);
  });
});

describe('Records', () => {
  it('shows the scope-all records in compact form with the full amount and the start date', async () => {
    const overview = await load('ok');
    const markup = html(Records, { overview });
    const records = overview.records.filter((record) => record.scope === 'all' && record.value !== null);
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      const card = markup.slice(markup.indexOf(`data-record="${record.kind}"`));
      const compact = formatCompact(record.value);
      const figure = /^[\d.,]+/.exec(compact)?.[0] ?? '';
      const unit = /[A-Za-z]+$/.exec(compact)?.[0] ?? '';
      expect(figure).not.toBe('');
      expect(card).toContain(figure);
      if (unit !== '') expect(card).toContain(`<span class="sfx">${unit}</span>`);
      expect(card).toContain(`<p class="when">${formatDay(record.day)}</p>`);
    }
    expect(markup).toContain(texts.records.caption(formatDay(records[0]?.since ?? null)));
  });

  it('shows the largest operation with its event row', async () => {
    const overview = await load('ok');
    const record = overview.records.find((item) => item.scope === 'all' && item.kind === 'largest_event');
    expect(record?.event).toBeTruthy();
    const markup = html(Records, { overview });
    expect(markup).toContain(`href="${record?.event?.explorerUrl}"`);
    // The record's table is not a feed row.
    expect(markup).not.toContain('<tr data-flow=');
  });

  it('writes n/a with its reason for a missing value, never 0', async () => {
    const overview = await load('ok');
    const missing: RecordItem[] = overview.records.map((record) => {
      if (record.scope !== 'all') return record;
      if (record.kind === 'largest_event') {
        return { ...record, value: null, day: null, event: undefined, quality: { ...record.quality, operationsComplete: false } };
      }
      if (record.kind === 'max_supply') return { ...record, value: null, day: null };
      return record;
    });
    const markup = html(Records, { overview: { ...overview, records: missing } });
    expect(markup).toContain(`<p class="rec-kpi na">${texts.na.label}</p>`);
    expect(markup).toContain(texts.na.reasons.operationsIncomplete);
    expect(markup).toContain(texts.na.reasons.noDataForRange);
  });
});

const withStatus = (overview: Overview, change: (status: ChainStatus, index: number) => ChainStatus): Overview => ({
  ...overview,
  status: { chains: overview.status.chains.map(change) },
});

describe('Status', () => {
  it('has a row per chain with data-chain and data-chain-state, and a table with roles', async () => {
    const overview = await load('ok');
    const markup = html(Status, { overview });
    for (const status of overview.status.chains) {
      expect(markup).toContain(`<tr data-chain="${status.chain}" data-chain-state="${status.state}" role="row">`);
    }
    expect(markup).toContain('role="columnheader"');
    expect(markup).toContain('role="rowheader"');
    expect(markup).toContain('role="cell"');
  });

  it('shows continuity "none" as the first day, not as a failure', async () => {
    const overview = await load('ok');
    const none = withStatus(overview, (status) =>
      status.reconciliation === null ? status : { ...status, reconciliation: { ...status.reconciliation, continuity: 'none' } });
    const markup = html(Status, { overview: none });
    expect(markup).toContain('data-check="none"');
    expect(markup).toContain(`${texts.status.checks.continuity} · ${texts.status.firstDay}`);
    expect(markup).not.toContain('c3 bad');
    expect(markup).not.toContain('data-check="mismatch"');
  });

  it('shows the supply difference only for a supply mismatch', async () => {
    const overview = await load('unreconciled');
    const mismatched = overview.status.chains.filter((status) => status.reconciliation?.supply === 'mismatch');
    expect(html(Status, { overview }).match(/class="diff"/g)?.length ?? 0).toBe(mismatched.length);
    const clean = html(Status, { overview: await load('ok') });
    expect(clean).not.toContain('class="diff"');
    expect(clean).not.toContain('c3 bad');
  });

  it('marks mismatched days and unreconciled chains', async () => {
    const overview = await load('unreconciled');
    const markup = html(Status, { overview });
    const flagged = overview.status.chains.filter((status) => status.unreconciledDays.length > 0);
    expect(flagged.length).toBeGreaterThan(0);
    expect(markup.match(/<td role="cell" data-unreconciled="true">/g)).toHaveLength(flagged.length);
    for (const status of flagged) for (const day of status.unreconciledDays) expect(markup).toContain(formatShortDay(day));
    expect(markup).toContain(`<span class="tag unrec">${texts.status.states.unreconciled}</span>`);
    expect(markup).toContain('data-quality="unreconciled"');
  });

  it('shows a delayed chain with its lag as a tag', async () => {
    const overview = await load('delayed');
    const delayed = overview.status.chains.filter((status) => status.state === 'delayed');
    expect(delayed.length).toBeGreaterThan(0);
    const markup = html(Status, { overview });
    expect(markup.match(/class="lag"/g)).toHaveLength(delayed.length);
    for (const status of delayed) {
      const name = overview.chains.find((chain) => chain.slug === status.chain)?.name ?? status.chain;
      expect(markup).toContain(`<span class="tag delayed"><span class="lag">${texts.tags.behind(name, String(status.lagHours))}</span></span>`);
    }
  });

  it('shows a partial last run as calm text, not an alarm', async () => {
    const overview = await load('ok');
    const partial = withStatus(overview, (status) =>
      status.lastRun === null ? status : { ...status, lastRun: { ...status.lastRun, status: 'partial' } });
    const markup = html(Status, { overview: partial });
    expect(markup).toContain('data-run-status="partial"');
    expect(markup).toContain(texts.status.runStatus.partial);
    expect(markup).not.toContain('tag unrec');
    expect(markup).not.toContain('tag delayed');
    expect(markup).not.toContain('data-unreconciled');
    expect(markup).toContain('data-quality="ok"');
  });

  it('shows a chain without data with a tag and "no closed day yet", and no other figures', async () => {
    const overview = await load('ok');
    const noData: ChainStatus = {
      chain: overview.status.chains[0]?.chain ?? '',
      state: 'no_data',
      historyStart: null,
      lastClosedDay: null,
      lastBlock: null,
      nextDueAt: null,
      lagHours: null,
      lastRun: null,
      reconciliation: null,
      unreconciledDays: [],
    };
    const markup = html(Status, { overview: withStatus(overview, (status, index) => (index === 0 ? noData : status)) });
    const row = rowContaining(markup, 'data-chain-state="no_data"');
    expect(row).toContain(`<span class="tag nodata">${texts.status.states.no_data}</span>`);
    expect(row).toContain(texts.status.noClosedDay);
    expect(row).not.toContain('class="c3');
    expect(row).not.toContain(texts.noData);
  });
});

describe('HowWeCount and Disclaimer', () => {
  const decode = (text: string): string => text.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const items = (markup: string): string[] =>
    [...markup.matchAll(/<li><span class="n"[^>]*>[^<]*<\/span><p>([^<]*)<\/p><\/li>/g)].map((match) => decode(match[1] ?? ''));

  it('is a numbered list with the softened aggregators sentence and the chains line', async () => {
    const overview = await load('ok');
    const markup = html(HowWeCount, { overview });
    expect(markup).toContain('<ol>');
    expect(items(markup)).toEqual([
      texts.howWeCount.tracked,
      texts.howWeCount.issuer,
      texts.howWeCount.reconciliation,
      texts.howWeCount.aggregators,
      texts.howWeCount.coverage(overview.chains.map((chain) => chain.name), formatDay(overview.historyStart)),
    ]);
    expect(texts.howWeCount.aggregators).toBe(
      'Figures can differ from aggregators such as DefiLlama or Circle’s own reports: they may cover other chains, use other cut-off times or define supply differently.',
    );
  });

  it('uses the empty variant of the chains line when asOf is null', async () => {
    const overview = await load('empty');
    expect(overview.asOf).toBeNull();
    expect(items(html(HowWeCount, { overview })).at(-1)).toBe(texts.howWeCount.coverage(overview.chains.map((chain) => chain.name), null));
  });

  it('has no chains line without an overview (unavailable)', () => {
    const markup = html(HowWeCount, { overview: null });
    expect(items(markup)).toHaveLength(4);
    expect(markup).not.toContain('Chains:');
  });

  it('closes the page with the disclaimer', () => {
    const markup = html(Disclaimer, {});
    expect(markup).toContain('data-block="disclaimer"');
    expect(markup).toContain(texts.disclaimer.body);
  });
});

describe('texts.feed keeps the words of texts.tags', () => {
  it('has the same unpaired and unknown-peer words', () => {
    expect(texts.feed.unpaired).toBe(texts.tags.unpaired);
    expect(texts.feed.peerUnknown).toBe(texts.tags.peerUnknown);
  });
});
