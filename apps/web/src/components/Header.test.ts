import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createMockClient, Overview, type MockState } from '@app/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { addDays, formatDay, formatShortDay } from '../view.ts';
import { texts } from '../texts.ts';
import { Header } from './Header.tsx';
import { Sparkline } from './Sparkline.tsx';

const overviewOf = (state: MockState): Promise<Overview> => createMockClient(state).overview();
// Contract fixtures that no mock state serves (packages/contracts/fixtures, read as data).
const fixture = (name: string): Overview =>
  Overview.parse(JSON.parse(readFileSync(path.join(import.meta.dirname, '../../../../packages/contracts/fixtures', name, 'overview.json'), 'utf8')));
const render = (overview: Overview): string => renderToStaticMarkup(createElement(Header, { overview }));

/** One card's markup, up to the next card. */
function card(html: string, name: string): string {
  const from = html.indexOf(`data-kpi="${name}"`);
  if (from < 0) throw new Error(`no ${name} card`);
  const next = html.indexOf('data-kpi="', from + 1);
  return html.slice(from, next < 0 ? undefined : next);
}
const change = (markup: string): string => /<p class="chg">([\s\S]*?)<\/p>/.exec(markup.slice(markup.indexOf('class="vals"')))?.[1] ?? '';
const text = (html: string): string => html.replace(/<[^>]+>/g, '');

describe('Header percentages', () => {
  it('keeps the issuer percentages neutral: no arrow, no positive/negative colour', async () => {
    const html = render(await overviewOf('ok'));
    for (const name of ['issuerMinted7d', 'issuerBurned7d']) {
      const markup = change(card(html, name));
      expect(markup).toContain('data-tone="neutral"');
      expect(markup).toContain('class="neu"');
      expect(markup).not.toMatch(/class="(pos|neg)"/);
      expect(text(markup)).not.toMatch(/[▲▼]/);
    }
  });

  it('gives the supply changes their direction: a sign, an arrow and the colour of the sign', async () => {
    const ok = await overviewOf('ok');
    const html = render(ok);
    for (const name of ['change1d', 'change7d'] as const) {
      expect(ok.header[name].changePct?.startsWith('-')).toBe(false);
      const markup = change(card(html, name));
      expect(markup).toContain('data-tone="positive"');
      expect(markup).toContain('class="pos"');
      expect(text(markup)).toContain(`${texts.header.sign.up} ${texts.plus}`);
    }
  });

  it('names the compared day of the 7-day change: the last closed day minus 7', async () => {
    const overview = await overviewOf('ok');
    const last = overview.header.days.at(-1);
    if (last === undefined) throw new Error('the ok state has no header days');
    const expected = formatShortDay(addDays(last, -7));
    const html = render(overview);
    expect(text(change(card(html, 'change7d')))).toContain(`vs ${expected}`);
    expect(text(change(card(html, 'change7d')))).not.toContain('7 days earlier');
    // The other cards keep their static references.
    expect(text(change(card(html, 'change1d')))).toContain('vs the previous day');
    expect(text(change(card(html, 'issuerMinted7d')))).toContain('vs the previous 7 days');
    // A shifted history moves the named day with it: the date is computed, not copied.
    const shifted = structuredClone(overview);
    shifted.header.days = shifted.header.days.map((day) => addDays(day, 3));
    if (shifted.asOf !== null) shifted.asOf = addDays(shifted.asOf, 3);
    const movedLast = shifted.header.days.at(-1);
    if (movedLast === undefined) throw new Error('the shifted state has no header days');
    const moved = formatShortDay(addDays(movedLast, -7));
    expect(moved).not.toBe(expected);
    const movedMarkup = text(change(card(render(shifted), 'change7d')));
    expect(movedMarkup).toContain(`vs ${moved}`);
    expect(movedMarkup).not.toContain(`vs ${expected}`);
  });

  it('draws a fall in negative, with ▼', () => {
    const overview = fixture('negative-change');
    const html = render(overview);
    const negatives = (['change1d', 'change7d'] as const).filter((name) => overview.header[name].changePct?.startsWith('-'));
    expect(negatives.length).toBeGreaterThan(0);
    for (const name of negatives) {
      const markup = change(card(html, name));
      expect(markup).toContain('data-tone="negative"');
      expect(markup).toContain('class="neg"');
      expect(text(markup)).toContain(`${texts.header.sign.down} ${texts.minus}`);
    }
    // A fall in the issuer volumes keeps its minus but stays neutral.
    for (const name of ['issuerMinted7d', 'issuerBurned7d'] as const) {
      if (overview.header[name].changePct?.startsWith('-')) {
        expect(text(change(card(html, name)))).toContain(texts.minus);
        expect(change(card(html, name))).toContain('data-tone="neutral"');
      }
    }
  });
});

describe('Header n/a', () => {
  it('shows an unknown value as n/a with its reason, never as 0', async () => {
    const overview = await overviewOf('gap');
    expect(overview.header.change7d.value).toBeNull();
    const markup = card(render(overview), 'change7d');
    expect(markup).toContain(`class="kpi kpi-value na">${texts.na.label}<`);
    // The mock history starts Oct 3, a week needs Oct 2: the reason names the days.
    expect(markup).toContain(`<p class="na-why">${texts.na.history.needs('Oct 2', 'Oct 3')}</p>`);
    expect(markup).not.toContain('class="full"');
    // Without a short history the same value only has no data for the range.
    const longer = card(render({ ...overview, historyStart: '2026-08-26' }), 'change7d');
    expect(longer).toContain(`<p class="na-why">${texts.na.reasons.noDataForRange}</p>`);
    expect(text(markup.slice(0, markup.indexOf('<div class="spark"')))).not.toMatch(/\b0\b/);
  });

  it('explains an unknown percentage by the quality of the card', async () => {
    const overview = await overviewOf('gap');
    const html = render(overview);
    // The previous week starts before the history does: the reason names those days.
    expect(overview.header.issuerMinted7d.value).not.toBeNull();
    expect(overview.header.issuerMinted7d.changePct).toBeNull();
    expect(change(card(html, 'issuerMinted7d'))).toContain(texts.na.history.before('Sep 26 – Oct 2'));
    expect(change(card(html, 'issuerBurned7d'))).toContain(texts.na.history.before('Sep 26 – Oct 2'));
    // The history is long enough, the week is still incomplete.
    const longer = change(card(render({ ...overview, historyStart: '2026-08-26' }), 'issuerMinted7d'));
    expect(longer).toContain(texts.na.reasons.previousWeekIncomplete);
    expect(change(card(html, 'issuerMinted7d'))).toContain(`class="na">${texts.na.label}<`);
    // A known percentage has no reason.
    expect(change(card(html, 'change1d'))).not.toContain('na-why');
  });

  it('says so when the previous value is exactly zero, and still shows the known value', () => {
    const overview = fixture('zero-denominators');
    expect(overview.header.change1d.quality.complete).toBe(true);
    expect(overview.header.change1d.changePct).toBeNull();
    const markup = card(render(overview), 'change1d');
    expect(change(markup)).toContain(texts.header.zeroBase);
    expect(change(markup)).not.toContain('%');
    expect(markup).toContain('class="kpi kpi-value">0<'); // a true zero value is shown as 0
  });
});

describe('Header date and delay', () => {
  it('shows the delayed chains as tags next to the date and one note, only when a chain is delayed', async () => {
    const delayed = await overviewOf('delayed');
    const html = render(delayed);
    const base = delayed.status.chains.find((status) => status.state === 'delayed');
    expect(base).toBeDefined();
    const name = delayed.chains.find((chain) => chain.slug === base?.chain)?.name ?? '';
    if (delayed.asOf === null) throw new Error('the delayed state has an asOf');
    expect(html).toContain(texts.asOf(formatDay(delayed.asOf)));
    expect(html).toContain(`<span class="tag delayed">${texts.tags.behind(name, String(base?.lagHours))}</span>`);
    expect(html.split('data-flag="delayed"')).toHaveLength(2);
    expect(text(html)).toContain(texts.states.delayed([name], formatShortDay(delayed.asOf)));

    const ok = render(await overviewOf('ok'));
    expect(ok).not.toContain('tag delayed');
    expect(ok).not.toContain('data-flag="delayed"');
  });
});

describe('Header sparklines', () => {
  it('marks only the points the API listed, as hollow diamonds', async () => {
    const overview = await overviewOf('unreconciled');
    const html = render(overview);
    const listed = (['supply', 'change1d', 'change7d', 'issuerMinted7d', 'issuerBurned7d'] as const)
      .reduce((total, name) => total + overview.header[name].sparkUnreconciled.length, 0);
    expect(listed).toBeGreaterThan(0);
    expect(html.split('class="spark-point" data-unreconciled="true"')).toHaveLength(listed + 1);
    expect(html).toMatch(/data-kpi="supply" data-quality="[^"]*unreconciled[^"]*" data-unreconciled="true"/);
    expect(render(await overviewOf('ok'))).not.toContain('spark-point');
  });

  it('breaks the line at null and names the missing days', async () => {
    const overview = await overviewOf('gap');
    const supply = overview.header.supply;
    const html = card(render(overview), 'supply');
    const nulls = supply.spark.flatMap((value, index) => (value === null ? [index] : []));
    expect(nulls.length).toBeGreaterThan(0);
    expect(html).toContain('class="spark-gap"');
    const first = overview.header.days[nulls[0] ?? 0] ?? '';
    expect(html).toContain(`class="spark-nodata">${texts.header.spark.noData([formatShortDay(first)])}`.slice(0, 40));
    expect(text(html)).toContain(formatShortDay(first));
  });

  const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'];
  const sparkMarkup = (values: (string | null)[], flagged: number[] = [], signed = false) =>
    renderToStaticMarkup(createElement(Sparkline, { days, values, unreconciled: flagged, label: 'x', signed, size: 'compact' }));

  it('draws no segment across a gap, and a gap is not a zero', () => {
    const path = /class="spark-line" d="([^"]*)"/.exec(sparkMarkup(['10', '20', null, '40', '50']))?.[1] ?? '';
    expect(path.match(/M/g)).toHaveLength(2);
    expect(path.match(/L/g)).toHaveLength(2);
    // The same data with 0 in place of the gap would be one connected line.
    const zero = /class="spark-line" d="([^"]*)"/.exec(sparkMarkup(['10', '20', '0', '40', '50']))?.[1] ?? '';
    expect(zero.match(/M/g)).toHaveLength(1);
    expect(sparkMarkup(['10', '20', null, '40', '50'])).toContain(texts.header.spark.noData(['Oct 3']));
  });

  it('keeps an isolated point visible and marks a flagged day without a value on the baseline', () => {
    const html = sparkMarkup([null, '5', null, null, null], [3]);
    expect(html).toMatch(/class="spark-line" d="M[\d.]+ [\d.]+H[\d.]+"/);
    expect(html).toContain('class="spark-point" data-unreconciled="true" data-missing="true"');
    expect(html).toContain(texts.header.spark.noData(['Oct 1', 'Oct 3 – Oct 5']));
  });

  it('draws the zero line only for signed sparks that cross zero', () => {
    expect(sparkMarkup(['-5', '0', '7', '3', '1'], [], true)).toContain('class="spark-zero"');
    expect(sparkMarkup(['5', '6', '7', '3', '9'], [], true)).not.toContain('class="spark-zero"');
    expect(sparkMarkup(['-5', '0', '7', '3', '1'], [], false)).not.toContain('class="spark-zero"');
  });

  it('shows no data at all as a gap and no line', () => {
    const html = sparkMarkup([null, null, null, null, null]);
    expect(html).toMatch(/class="spark-line" d=""/);
    expect(html).toContain(texts.header.spark.noData(['Oct 1 – Oct 5']));
  });
});
