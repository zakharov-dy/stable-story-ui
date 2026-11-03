// Checks of the server HTML of the page, shared by the unit tests (rendering the root server
// component) and scripts/check-build.ts (plain HTTP against `next start`). Expected values come from
// the overview the page was given, never from literals. Returns the list of problems.

import type { Overview } from '@app/contracts';
import {
  addDays,
  formatAmount,
  formatCompact,
  formatCount,
  formatDay,
  formatDays,
  formatPercent,
  formatShortDay,
} from '../view.ts';
import { texts } from '../texts.ts';
import { checkChips, type CheckKind, isShortHistory } from '@app/view';

export const DATA_BLOCKS = ['header', 'day-equation', 'supply-by-chain', 'drivers', 'issuer-vs-bridge', 'feed', 'records'] as const;
export const ALL_BLOCKS = [...DATA_BLOCKS, 'status', 'how-we-count', 'disclaimer'] as const;
export const CARDS = ['supply', 'change1d', 'change7d', 'issuerMinted7d', 'issuerBurned7d'] as const;
const SIGNED_CARDS = new Set(['change1d', 'change7d']);

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'" };

/** The markup without scripts (the RSC payload repeats the props as JSON) and styles. */
export const withoutScripts = (html: string): string =>
  html.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '');

/** What a reader sees: tags removed, entities decoded, whitespace collapsed. */
export const visibleText = (html: string): string =>
  withoutScripts(html)
    .replace(/<title>[\s\S]*?<\/title>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();

const count = (html: string, fragment: string): number => html.split(fragment).length - 1;

/** The text of a fragment as written: tags removed without inserting spaces, entities decoded. */
const inline = (html: string): string =>
  html.replace(/<[^>]+>/g, '').replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (entity) => ENTITIES[entity] ?? entity).trim();

/** SVGs that draw something: the decorative ones (wordmark, pattern definitions) are aria-hidden. */
const chartSvgs = (markup: string): number => (markup.match(/<svg\b[^>]*>/g) ?? []).filter((tag) => !tag.includes('aria-hidden="true"')).length;

/** The markup from the first `start` to the first `end` after it (or to the end). */
function slice(markup: string, start: string, end: string): string {
  const from = markup.indexOf(start);
  if (from < 0) return '';
  const to = markup.indexOf(end, from + start.length);
  return markup.slice(from, to < 0 ? undefined : to);
}

const chainName = (overview: Overview, slug: string): string => overview.chains.find((chain) => chain.slug === slug)?.name ?? slug;

const TERMS = ['issuer_mint', 'issuer_burn', 'bridge_in', 'bridge_out', 'net'] as const;
const OUTFLOWS = new Set<string>(['issuer_burn', 'bridge_out']);
const ZERO = /^-?0*(\.0*)?$/;

/** Every constant string of texts.ts: static copy that may legitimately contain digits. */
function staticTexts(): string[] {
  const strings: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(texts);
  return strings.filter((text) => text.length > 0).sort((a, b) => b.length - a.length);
}

/** The visible text with the static copy removed: what is left is data. */
export function dataText(html: string, demoState: string | null): string {
  let text = visibleText(html);
  const copy = [...(demoState === null ? [] : [texts.demo(demoState)]), ...staticTexts()];
  for (const fragment of copy) text = text.split(fragment).join(' ');
  return text;
}

export interface PageExpectation {
  overview: Overview | null; // null: the API failed
  demoState: string | null;
}

export function checkPageHtml(html: string, { overview, demoState }: PageExpectation): string[] {
  const problems: string[] = [];
  const markup = withoutScripts(html);
  const text = visibleText(html);
  const expect = (condition: boolean, message: string) => {
    if (!condition) problems.push(message);
  };
  const hasBlock = (block: string) => markup.includes(`data-block="${block}"`);
  const state = overview === null ? 'unavailable' : overview.asOf === null ? 'empty' : 'data';

  expect(count(markup, `data-page-state="${state}"`) === 1, `expected data-page-state="${state}"`);
  // The header names the product (the tab title is checked over HTTP in scripts/check-build.ts:
  // unit renders of the page carry no <head>).
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(markup)?.[1];
  expect(count(markup, '<h1') === 1, 'expected one h1 header');
  expect(h1 !== undefined && inline(h1).includes(texts.productName), 'expected the header to name the product');
  if (demoState === null) {
    expect(!markup.includes('data-demo-state='), 'live data must not carry the demo label');
  } else {
    expect(text.includes(texts.demo(demoState)), `expected the demo label for ${demoState}`);
  }

  if (overview === null) {
    expect(text.includes(texts.states.unavailable), 'expected the unavailable message');
    expect(!text.includes(texts.states.empty), 'unavailable must not show the empty message');
    for (const block of [...DATA_BLOCKS, 'no-figures', 'status']) expect(!hasBlock(block), `unavailable must not render ${block}`);
    expect(chartSvgs(markup) === 0, 'unavailable must not render charts');
    expect(!markup.includes('data-chip-kind=') && !markup.includes('class="cadence"'), 'unavailable must not render the equation chips or the cadence');
    expect(text.includes(texts.states.unavailableBody), 'expected the unavailable explanation');
    expect(markup.includes('content="noindex"'), 'unavailable must not be indexed');
    const data = dataText(html, demoState);
    expect(!/\d/.test(data), `unavailable shows figures: ${data}`);
    return problems;
  }

  const coverage = texts.coverage(texts.assetNames[overview.asset] ?? overview.asset.toUpperCase(), overview.chains.map((chain) => chain.name));
  expect(text.includes(coverage), 'expected the coverage caption from overview.chains');
  for (const block of ['status', 'how-we-count', 'disclaimer']) expect(hasBlock(block), `expected the ${block} block`);
  const statusRows = markup.match(/data-chain="[^"]*" data-chain-state="/g) ?? [];
  expect(statusRows.length === overview.status.chains.length, 'expected one status row per chain');
  for (const status of overview.status.chains) {
    expect(markup.includes(`data-chain="${status.chain}" data-chain-state="${status.state}"`), `expected ${status.chain} as ${status.state}`);
  }
  const lagging = overview.status.chains.filter((status) => status.state === 'delayed' && status.lagHours !== null);
  expect(count(markup, 'class="lag"') === lagging.length, 'expected lag hours on delayed chains only');
  for (const status of lagging) {
    expect(text.includes(texts.tags.behind(chainName(overview, status.chain), formatCount(status.lagHours))), `expected the lag of ${status.chain}`);
  }

  if (overview.asOf === null) {
    expect(text.includes(texts.states.empty), 'expected the empty message');
    expect(!text.includes(texts.states.unavailable), 'empty must not show the unavailable message');
    for (const block of DATA_BLOCKS) expect(!hasBlock(block), `empty must not render ${block}`);
    expect(hasBlock('no-figures'), 'expected the no-figures message block');
    expect(text.includes(texts.states.emptyBody), 'expected the empty explanation');
    expect(chartSvgs(markup) === 0, 'empty must not render charts');
    expect(!markup.includes('data-chip-kind=') && !markup.includes('data-kpi='), 'empty must not render the equation chips or the cards');
    return problems;
  }

  for (const block of ALL_BLOCKS) expect(count(markup, `data-block="${block}"`) === 1, `expected one ${block} block`);
  expect(!text.includes(texts.states.empty) && !text.includes(texts.states.unavailable), 'data must not show a state message');
  expect(chartSvgs(markup) > 0, 'expected SVG charts');
  expect(text.includes(texts.asOf(formatDay(overview.asOf))), 'expected the as-of line');
  expect(markup.includes('class="cadence"'), 'expected the cadence line');
  expect(!hasBlock('no-figures'), 'data must not render the no-figures block');
  const delayedChains = overview.status.chains.filter((status) => status.state === 'delayed' && status.lagHours !== null);
  expect(count(markup, 'data-flag="delayed"') === (delayedChains.length > 0 ? 1 : 0), 'expected the delayed note exactly when a chain is delayed');
  for (const status of delayedChains) {
    const name = overview.chains.find((chain) => chain.slug === status.chain)?.name ?? status.chain;
    expect(text.includes(texts.tags.behind(name, formatCount(status.lagHours))), `expected the delayed tag of ${status.chain}`);
  }
  const headerMarkup = slice(markup, 'data-block="header"', '</section>');
  const assetUnit = texts.assetNames[overview.asset] ?? overview.asset.toUpperCase();
  expect(count(headerMarkup, 'data-kpi="') === CARDS.length, 'expected the five header cards');
  for (const card of CARDS) {
    const kpi = overview.header[card];
    expect(markup.includes(`data-kpi="${card}"`), `expected the ${card} card`);
    const signed = SIGNED_CARDS.has(card);
    // null is no data, never 0: n/a with its reason, expected without going through the formatters.
    const cardMarkup = slice(headerMarkup, `data-kpi="${card}"`, 'data-kpi="');
    const shown = /<p class="kpi kpi-value[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(cardMarkup)?.[1];
    const value = kpi.value === null ? texts.na.label : formatCompact(kpi.value, { signed });
    expect(shown !== undefined && inline(shown) === value, `expected ${card} = ${value}, shown ${String(shown)}`);
    const full = /<p class="full">([\s\S]*?)<\/p>/.exec(cardMarkup)?.[1];
    if (kpi.value === null) {
      expect(full === undefined && cardMarkup.includes('class="na-why"'), `expected ${card} as n/a with a reason and no exact amount`);
    } else {
      expect(full !== undefined && inline(full) === `${formatAmount(kpi.value, { signed })}${assetUnit}`, `expected ${card} exact amount, shown ${String(full)}`);
    }
    if (card !== 'supply') {
      const change = /<p class="chg">([\s\S]*?)<\/p>/.exec(cardMarkup.slice(cardMarkup.indexOf('class="vals"')))?.[1] ?? '';
      if (kpi.changePct === null) {
        expect(change.includes(`class="na">${texts.na.label}<`) && change.includes('class="na-why"'), `expected ${card} change as n/a with a reason`);
      } else {
        const percent = formatPercent(kpi.changePct, { signed: true });
        expect(inline(change).includes(percent), `expected ${card} change ${percent}, shown ${inline(change)}`);
        // Direction (▲▼, positive/negative colours) belongs to the supply changes only.
        const tone = !signed || ZERO.test(kpi.changePct) ? 'neutral' : kpi.changePct.startsWith('-') ? 'negative' : 'positive';
        expect(change.includes(`data-tone="${tone}"`), `expected ${card} change tone ${tone}`);
        const arrows = texts.header.sign.up + texts.header.sign.down;
        expect([...inline(change)].some((char) => arrows.includes(char)) === (tone !== 'neutral'), `expected ${card} arrows only on directed changes`);
      }
    }
    expect(cardMarkup.includes('data-unreconciled="true"') === (kpi.sparkUnreconciled.length > 0), `expected ${card} unreconciled mark from sparkUnreconciled`);
  }
  const flaggedSpark = CARDS.reduce((total, card) => total + overview.header[card].sparkUnreconciled.length, 0);
  expect(count(markup, 'class="spark-point" data-unreconciled="true"') === flaggedSpark, `expected ${flaggedSpark} flagged spark points`);

  checkEquation(markup, overview, expect);
  checkMarks(markup, text, overview, expect);

  const items = overview.largestEvents.items;
  expect(count(markup, '<tr data-flow=') === items.length, `expected ${items.length} feed rows`);
  const unreconciledRows = items.filter((row) => row.unreconciled).length;
  expect(count(markup, 'data-mark="unreconciled"') === unreconciledRows, `expected ${unreconciledRows} unreconciled feed marks`);
  const unpairedRows = items.filter((row) => row.unpaired).length;
  expect(count(markup, 'data-mark="unpaired"') === unpairedRows, `expected ${unpairedRows} unpaired feed marks`);
  for (const row of items) expect(markup.includes(`href="${row.explorerUrl}"`), `expected the explorer link of ${row.id}`);

  const headerDays = new Set(CARDS.flatMap((card) => overview.header[card].quality.unreconciledDays));
  const shownDays = formatDays([...headerDays]);
  [...headerDays].forEach((day, index) => expect(text.includes(shownDays[index] ?? ''), `expected the unreconciled day ${day}`));
  const headerFlagged = headerDays.size > 0;
  expect(/data-block="header" data-quality="[^"]*unreconciled/.test(markup) === headerFlagged, 'header quality must match its Kpi quality');
  const feedFlagged = overview.largestEvents.quality.unreconciledDays.length > 0;
  expect(/data-block="feed" data-quality="[^"]*unreconciled/.test(markup) === feedFlagged, 'feed quality must match its quality');
  return problems;
}

/** The day equation: one card per chain in `overview.chains` order, the figures of asOf and the chips of the rule. */
function checkEquation(markup: string, overview: Overview, expect: (condition: boolean, message: string) => void): void {
  const asOf = overview.asOf;
  if (asOf === null) return;
  const section = slice(markup, 'data-block="day-equation"', '</section>');
  const cards = section.split('<article ').slice(1).map((card) => card.slice(0, card.indexOf('</article>')));
  expect(cards.length === overview.chains.length, `expected ${overview.chains.length} equation cards, found ${cards.length}`);
  expect(section.includes(texts.equation.scaleNote), 'expected the shared-scale caption');
  overview.chains.forEach((chain, index) => {
    const card = cards[index] ?? '';
    const status = overview.status.chains.find((candidate) => candidate.chain === chain.slug);
    expect(card.includes(`data-chain-index="${index + 1}" data-chain-state="${status?.state ?? ''}"`), `expected the ${chain.slug} card in position ${index + 1} as ${status?.state ?? '?'}`);
    const row = overview.day?.rows.find((row) => row.scope === chain.slug);
    const values: Record<string, string | null> = row?.values ?? {};
    const known = overview.day?.date === asOf && TERMS.every((term) => values[term] !== null && values[term] !== undefined);
    for (const term of TERMS) {
      const raw = known ? values[term] ?? null : null;
      const signedValue = raw !== null && OUTFLOWS.has(term) && !ZERO.test(raw) ? `-${raw}` : raw;
      const chip = slice(card, `data-flow="${term}"`, '</div>');
      const shown = inline(/class="chip-v">([\s\S]*?)<\/span>/.exec(chip)?.[1] ?? '');
      expect(shown === formatCompact(signedValue, { signed: true }), `expected the ${chain.slug} ${term} chip = ${formatCompact(signedValue, { signed: true })}, shown ${shown}`);
    }
    expect(card.includes('<svg') === known, `expected the ${chain.slug} bars only for a known day`);
    const flagged = known && row?.unreconciled === true;
    expect(card.includes('data-unreconciled="true"') === flagged, `expected the ${chain.slug} card unreconciled=${String(flagged)}`);
    const expected: CheckKind[] = status === undefined ? [] : checkChips({
      asOf,
      reconciliation: status.reconciliation,
      unreconciledDays: status.unreconciledDays,
      figuresKnown: known,
    })?.chips.map((chip) => chip.kind) ?? [];
    const kinds = [...card.matchAll(/data-chip-kind="([^"]+)"/g)].map((match) => match[1]);
    expect(JSON.stringify(kinds) === JSON.stringify(expected), `expected the ${chain.slug} check chips ${expected.join(',') || 'none'}, shown ${kinds.join(',') || 'none'}`);
  });
}

/** The marks the mockups put in their places: a chain's lag and mismatch, the short-history caption, the records grid, the footer mark. */
function checkMarks(
  markup: string,
  text: string,
  overview: Overview,
  expect: (condition: boolean, message: string) => void,
): void {
  for (const status of overview.status.chains) {
    const name = chainName(overview, status.chain);
    const last = status.lastClosedDay;
    if (last !== null) {
      const tag = texts.tags.chainUnreconciled(name, formatShortDay(last));
      expect(text.includes(tag) === status.unreconciledDays.includes(last), `expected the header mismatch tag of ${status.chain} exactly when its last closed day is mismatched`);
    }
    if (status.state !== 'delayed' || status.lagHours === null || last === null) continue;
    const hours = formatCount(status.lagHours);
    const equation = slice(markup, 'data-block="day-equation"', '</section>');
    expect(equation.includes(texts.tags.behindNotClosed(hours, formatShortDay(addDays(last, 1)))), `expected the day equation to name the day ${status.chain} has not closed`);
    expect(slice(markup, 'data-block="drivers"', '</section>').includes(`>${texts.tags.behindShort(hours)}<`), `expected the drivers card of ${status.chain} to show its lag`);
    expect(slice(markup, 'data-block="supply-by-chain"', '</section>').includes(`>${texts.tags.behindLabel(hours)}<`), `expected the lag beside the layer of ${status.chain}`);
  }

  const supply = slice(markup, 'data-block="supply-by-chain"', '</section>');
  if (overview.historyStart !== null) {
    const caption = inline(texts.supplyByChain.shortHistory(formatDay(overview.historyStart)));
    expect(inline(supply).includes(caption) === isShortHistory(overview), 'expected the short-history caption exactly when the history is shorter than the windows');
  }

  const header = slice(markup, 'data-block="header"', '</section>');
  const missing = CARDS.some((card) => !overview.header[card].quality.complete);
  const noteAt = header.indexOf('data-flag="incomplete"');
  expect(noteAt >= 0 === missing, 'expected the missing-data note exactly when a header card is incomplete');
  if (missing) expect(noteAt < header.indexOf('class="a-hero"'), 'expected the missing-data note above the cards');

  const four = !overview.records.some((record) => record.scope === 'all' && record.event);
  expect(slice(markup, 'data-block="records"', '</section>').includes('class="recs four"') === four, 'expected four record columns exactly when no record has an operation');
  expect(slice(markup, 'data-block="disclaimer"', '</footer>').includes('class="mark-outline"'), 'expected the mark in the footer');
}
