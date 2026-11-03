// The UI pass to the design mockups (docs/design.md): marks in their places, notes above or below,
// dates without a year inside a section, a year on both ends when a range crosses 1 January.
import { createMockClient, Overview, type MockState } from '@app/contracts';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { withLastDay } from '../test-support/last-day.ts';
import { shiftOverview } from '../test-support/shift-dates.ts';
import { texts } from '../texts.ts';
import { DayEquation } from './DayEquation.tsx';
import { Drivers } from './Drivers.tsx';
import { Feed } from './Feed.tsx';
import { Header } from './Header.tsx';
import { IssuerVsBridge } from './IssuerVsBridge.tsx';
import { Disclaimer } from './Notes.tsx';
import { Records } from './Records.tsx';
import { Status } from './Status.tsx';
import { SupplyByChain } from './SupplyByChain.tsx';

const load = (state: MockState): Promise<Overview> => createMockClient(state).overview();
const render = (component: FunctionComponent<{ overview: Overview }>, overview: Overview): string =>
  renderToStaticMarkup(createElement(component, { overview }));
const text = (html: string): string => html.replace(/<[^>]+>/g, '');
const count = (html: string, fragment: string): number => html.split(fragment).length - 1;

describe('header marks and notes', () => {
  it('names the chain whose last closed day is mismatched, in the row of the date', async () => {
    const overview = await load('unreconciled');
    const html = render(Header, overview);
    const row = html.slice(html.indexOf('class="date-row"'), html.indexOf('class="a-hero"'));
    expect(row).toContain(`<span class="tag unrec">${texts.tags.chainUnreconciled('Ethereum', 'Oct 9')}</span>`);
    expect(count(html, 'class="tag unrec"')).toBe(1);
    expect(render(Header, await load('ok'))).not.toContain('class="tag unrec"');
  });

  it('puts the unreconciled note under the issuer line, with the distance of the mockup', async () => {
    const html = render(Header, await load('unreconciled'));
    expect(html.indexOf('data-flag="unreconciled"')).toBeGreaterThan(html.indexOf('class="inote a-foot"'));
    expect(html.indexOf('class="inote a-foot"')).toBeGreaterThan(html.indexOf('class="a-band"'));
  });

  it('puts the delayed note and the missing-data note above the cards', async () => {
    const delayed = render(Header, await load('delayed'));
    expect(delayed.indexOf('data-flag="delayed"')).toBeGreaterThan(-1);
    expect(delayed.indexOf('data-flag="delayed"')).toBeLessThan(delayed.indexOf('class="a-hero"'));
    const gap = render(Header, await load('gap'));
    expect(gap.indexOf('data-flag="incomplete"')).toBeGreaterThan(-1);
    expect(gap.indexOf('data-flag="incomplete"')).toBeLessThan(gap.indexOf('class="a-hero"'));
    // Both notes of missing data stay together above the cards; nothing of it is left below.
    expect(gap.slice(gap.indexOf('class="inote a-foot"'))).not.toContain('class="qnote');
  });

  it('writes the date of the delayed note without a year', async () => {
    const html = text(render(Header, await load('delayed')));
    expect(html).toContain('All figures stay on Oct 8, the last day');
    expect(html).toContain(texts.asOf('Oct 8, 2026'));
  });
});

describe('the lag of a chain in its places', () => {
  it('shows it beside the layer, in the day card and in the drivers card, and names the chain only in the header and the status', async () => {
    const overview = await load('delayed');
    const supply = render(SupplyByChain, overview);
    expect(count(supply, '<span class="tag delayed">30 h</span>')).toBe(1); // the layer label of the level panel
    expect(supply).not.toContain(texts.tags.behind('Base', '30'));
    const card = render(DayEquation, overview);
    expect(card).toContain(`<span class="tag delayed">${texts.tags.behindNotClosed('30', 'Oct 9')}</span>`);
    expect(card).toContain('30 h behind · Oct 9 not closed');
    const drivers = render(Drivers, overview);
    expect(drivers).toContain('<span class="tag delayed">30 h behind</span>');
    expect(render(Status, overview)).toContain('<span class="lag">Base · 30 h behind</span>');
    expect(text(render(Header, overview))).toContain('Base · 30 h behind');
  });

  it('draws no lag on a layer that is up to date', async () => {
    expect(render(SupplyByChain, await load('ok'))).not.toContain('tag delayed');
  });
});

describe('a day with zero flows', () => {
  it('does not claim that the chain had no events while its event count is above 0', async () => {
    const zero = withLastDay(await load('ok'), 'arbitrum', { events: 3, flows: 'zero' });
    const html = text(render(DayEquation, zero));
    expect(html).not.toContain('no events');
    expect(html).not.toContain('tag noevents');
  });
});

describe('drivers legend', () => {
  it('names the flows in lower case, as the mockup does', async () => {
    const html = render(Drivers, await load('ok'));
    for (const [flow, label] of [['issuer_mint', 'issuer mint'], ['bridge_in', 'bridge in'], ['issuer_burn', 'issuer burn'], ['bridge_out', 'bridge out'], ['net', 'net']]) {
      expect(html).toContain(`<li data-flow="${flow}">${label}</li>`);
    }
  });
});

describe('supply by chain caption', () => {
  it('says the history is short, as the gap mockup does, and only then', async () => {
    const short = text(render(SupplyByChain, await load('gap')));
    expect(short).toContain('History since Oct 3, 2026, the first day closed on every chain. The chart starts there; nothing before is drawn.');
    expect(short).not.toContain('Common history');
    const ok = text(render(SupplyByChain, await load('ok')));
    expect(ok).toContain('Common history, Aug 26 – Oct 9, 2026.');
    expect(ok).not.toContain('History since');
  });
});

describe('records', () => {
  it('has four columns and one note for the section when no operation card is drawn, the reason staying on its card', async () => {
    const overview = await load('unreconciled');
    const html = render(Records, overview);
    expect(html).toContain('class="recs four"');
    expect(count(html, 'class="qnotes"')).toBe(1);
    expect(html.indexOf('class="qnotes"')).toBeLessThan(html.indexOf('class="recs four"'));
    expect(html).toContain(`<p class="rec-reason">${texts.na.reasons.operationsIncomplete}</p>`);
    expect(html).toContain(`<p class="rec-kpi na">${texts.na.label}</p>`);
    // The cards no longer carry a note of their own.
    expect(html.slice(html.indexOf('class="recs four"'))).not.toContain('qnote');
  });

  it('keeps three columns with an operation card', async () => {
    const html = render(Records, await load('ok'));
    expect(html).toContain('class="recs"');
    expect(html).not.toContain('four');
  });

  it('writes the day of a record with its year, and nothing else', async () => {
    const html = render(Records, await load('ok'));
    expect(html).toContain('<p class="when">Oct 9, 2026</p>');
    expect(html).not.toMatch(/class="when">[^<]*since/);
  });
});

describe('footer mark', () => {
  it('has the mark of the top bar before the name', () => {
    const html = renderToStaticMarkup(createElement(Disclaimer));
    const wordmark = html.slice(html.indexOf('class="wordmark"'), html.indexOf('</span>'));
    expect(wordmark).toContain('<svg');
    expect(wordmark).toContain('class="mark-outline"');
    expect(wordmark).toContain('aria-hidden="true"');
    expect(wordmark.indexOf('<svg')).toBeLessThan(wordmark.indexOf(texts.productName));
  });
});

describe('sparklines', () => {
  it('are squeezed into the box CSS gives them, with a round-capped last point and HTML diamonds', async () => {
    const ok = render(Header, await load('ok'));
    expect(ok).toContain('preserveAspectRatio="none"');
    expect(ok).toMatch(/<path class="spark-dot" d="M([\d.]+) ([\d.]+)L\1 \2"/);
    expect(ok).not.toContain('<circle');
    const html = render(Header, await load('unreconciled'));
    expect(html).toMatch(/<span class="spark-point" data-unreconciled="true" style="left:[\d.]+%;top:[\d.]+%"/);
  });
});

describe('dates across 1 January', () => {
  // The ok state moved by 85 days: asOf is Jan 2, 2027, the 30-day windows start Dec 4, 2026 and the
  // whole history Nov 19, 2026. Shifted rendering fixtures test formatting; calendar selections are checked in contracts.
  const crossed = async (): Promise<Overview> => shiftOverview(await load('ok'), 85);

  it('keeps the year in the header and drops it from the title of the day equation', async () => {
    const overview = await crossed();
    expect(overview.asOf).toBe('2027-01-02');
    expect(text(render(Header, overview))).toContain(texts.asOf('Jan 2, 2027'));
    expect(text(render(DayEquation, overview))).toContain(`${texts.equation.label} · Jan 2`);
  });

  it('puts a year on both ends of a range that crosses it, and on none of one that does not', async () => {
    const overview = await crossed();
    expect(text(render(Drivers, overview))).toContain('Dec 4, 2026 – Jan 2, 2027.');
    expect(text(render(IssuerVsBridge, overview))).toContain('Dec 4, 2026 – Jan 2, 2027.');
    expect(text(render(Feed, overview))).toContain('Dec 27, 2026 – Jan 2, 2027,');
    expect(text(render(SupplyByChain, overview))).toContain('Common history, Nov 19, 2026 – Jan 2, 2027.');
    // Inside one year the same views carry no year.
    const ok = await load('ok');
    expect(text(render(Drivers, ok))).toContain('Sep 10 – Oct 9.');
    expect(text(render(Feed, ok))).toContain('Oct 3 – Oct 9,');
  });

  it('puts the years on the ends of a spark axis that crosses it', async () => {
    const html = render(Header, await crossed());
    expect(html).toContain('<div class="spark-axis"><span>Dec 4, 2026</span><span>30 days</span><span>Jan 2, 2027</span></div>');
    const ok = render(Header, await load('ok'));
    expect(ok).toContain('<div class="spark-axis"><span>Sep 10</span><span>30 days</span><span>Oct 9</span></div>');
  });

  it('keeps the time of a feed row and of the last run without a year', async () => {
    const overview = await crossed();
    const feed = text(render(Feed, overview));
    expect(feed).toMatch(/(?:Dec \d+|Jan \d+) · \d\d:\d\d UTC/);
    expect(feed).not.toMatch(/2027, \d\d:\d\d/);
    expect(text(render(Status, overview))).toMatch(/(?:Jan 3|Jan 2) \d\d:\d\d · /);
  });

  it('keeps the years on the two days of a latest-checks line that spans New Year', async () => {
    // Delayed: the common day is Oct 8, the chains ahead have closed Oct 9; moved by 84 days they are Dec 31 and Jan 1.
    const overview = shiftOverview(await load('delayed'), 84);
    expect(overview.asOf).toBe('2026-12-31');
    expect(text(render(DayEquation, overview))).toContain(texts.equation.latestChecks('Dec 31, 2026', 'Jan 1, 2027'));
    const inside = text(render(DayEquation, await load('delayed')));
    expect(inside).toContain(texts.equation.latestChecks('Oct 8', 'Oct 9'));
  });

  it('lists mismatched days with a year only when they are in different years', async () => {
    const overview = shiftOverview(await load('unreconciled'), 85);
    const html = text(render(Status, overview));
    expect(html).toContain('Jan 2');
    expect(html).not.toContain('Jan 2, 2027');
  });
});
