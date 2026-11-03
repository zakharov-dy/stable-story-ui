import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createMockClient, type MockState, type Overview } from '@app/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatEnds, formatPercent } from '../view.ts';
import { texts } from '../texts.ts';
import { IssuerVsBridge } from './IssuerVsBridge.tsx';
import { SupplyByChain } from './SupplyByChain.tsx';

const load = (state: MockState): Promise<Overview> => createMockClient(state).overview();
const count = (html: string, fragment: string): number => html.split(fragment).length - 1;
const render = (component: typeof IssuerVsBridge, overview: Overview): string => renderToStaticMarkup(createElement(component, { overview }));
const parse = (value: Overview): Overview => value;
const chunks = (html: string, open: string): string[] => html.split(open).slice(1).map((part) => open + part);
const clone = (overview: Overview): Overview => structuredClone(overview);
const thirty = (overview: Overview) => overview.views['30d']?.issuerVsBridge ?? [];

describe('supply by chain from public views', () => {
  it('renders every chain at the declared resolution and uses ready totals', async () => {
    const overview = await load('long-history');
    for (const period of ['30d', '90d', 'all'] as const) {
      const html = renderToStaticMarkup(createElement(SupplyByChain, { overview, period }));
      expect(count(html, '<svg')).toBe(2);
      for (const chain of overview.chains) expect(html).toContain(chain.name);
      expect(html).toContain(texts.resolution.steps[overview.views[period]!.period]);
      expect(html).not.toContain('undefined');
    }
  });

  it('draws the total of the response as sent, never a sum of the chain levels', async () => {
    const overview = clone(await load('long-history'));
    const supply = overview.views['30d']!.supplyByChain;
    const at = supply.level.buckets.length - 1;
    for (const line of supply.level.lines) line.values[at] = '1000000000'; // six chains summing to 6.00B
    for (const line of supply.total.lines) line.values[at] = '1'; // the response says otherwise
    const html = renderToStaticMarkup(createElement(SupplyByChain, { overview, period: '30d' }));
    expect(html).toContain('Mar 15: Tracked supply 1 (100%)');
    expect(html).not.toContain('Tracked supply 6.00B');
  });

  it('keeps a zero denominator separate from a missing level', async () => {
    const overview = clone(await load('ok'));
    const supply = overview.views['30d']!.supplyByChain;
    for (const name of ['level', 'total', 'stackedLevel'] as const) for (const line of supply[name].lines) line.values[0] = '0';
    for (const name of ['share', 'stackedShare'] as const) for (const line of supply[name].lines) line.values[0] = null;
    const html = renderToStaticMarkup(createElement(SupplyByChain, { overview, period: '30d' }));
    expect(html).not.toContain(texts.supplyByChain.missing);
    expect(html).not.toContain('▨ no data');
    expect(html).toContain('100%');
  });

  it('takes captions, tooltips and notes from the declared step, never assumed daily', async () => {
    const overview = await load('long-history');
    const rendered = {
      day: renderToStaticMarkup(createElement(SupplyByChain, { overview, period: '30d' })),
      week: renderToStaticMarkup(createElement(SupplyByChain, { overview, period: '90d' })),
      month: renderToStaticMarkup(createElement(SupplyByChain, { overview, period: 'all' })),
    };
    // The tooltip footer and the level caption come from Series.period.
    expect(rendered.day).toContain(texts.supplyByChain.endOfDay);
    expect(rendered.day).toContain('Last day');
    expect(rendered.week).toContain(texts.resolution.end('week'));
    expect(rendered.week).not.toContain(texts.supplyByChain.endOfDay);
    expect(rendered.week).not.toContain('Last day');
    expect(rendered.month).toContain(texts.resolution.end('month'));
    expect(rendered.month).not.toContain(texts.resolution.end('week'));
    // The accessible label names the step; the axis ends are the series' own bucket ends.
    for (const [copy, period] of [[rendered.day, '30d'], [rendered.week, '90d'], [rendered.month, 'all']] as const) {
      const level = overview.views[period]!.supplyByChain.level;
      expect(copy).toContain(texts.resolution.steps[level.period] ?? '');
      const first = level.buckets[0];
      const last = level.buckets.at(-1);
      if (first === undefined || last === undefined) throw new Error('no buckets');
      for (const end of formatEnds(first.start, last.end)) expect(copy).toContain(`>${end}</span>`);
    }
    // The shaded-columns note names the bucket of the chart's step.
    expect(rendered.week).toContain(texts.quality.incompleteBuckets('week'));
    expect(rendered.month).toContain(texts.quality.incompleteBuckets('month'));
    expect(rendered.week).not.toContain(texts.quality.incompleteBuckets('day'));
    // A cut calendar bucket reads "incomplete period", never "no data"; the gap note names only the real gap.
    expect(rendered.week).toContain(texts.resolution.partial);
    expect(rendered.week).toContain(texts.supplyByChain.gapNote('Jan 4 – Jan 10'));
  });

  it('uses level gaps and includes interior mismatch flags without naming the bucket end as the failed day', async () => {
    const overview = await load('long-history');
    const html = renderToStaticMarkup(createElement(SupplyByChain, { overview, period: '90d' }));
    expect(html).toContain(texts.supplyByChain.missing);
    expect(html).toContain(texts.resolution.partial);
    expect(html).toContain(texts.resolution.flagged);
    expect(html).not.toContain('Reconciliation mismatch on Jan 3');
  });
});

describe('issuer vs bridge: n/a for an unknown share', () => {
  const cells = (html: string): string[] => chunks(html, '<div class="mx-cell"');

  it.each(['ok', 'unreconciled', 'gap', 'short-history', 'empty-day'] as const)('shows %s from the API shares', async (state) => {
    const overview = await load(state);
    const html = render(IssuerVsBridge, overview);
    const expected = thirty(overview).flatMap((row) =>
      (['in', 'out'] as const).flatMap((side) =>
        (['volume', 'count'] as const).map((basis) => ({ share: row[side][basis].issuerShare, split: row[side], side, basis }))));
    const rendered = cells(html);
    expect(rendered).toHaveLength(expected.length);
    expected.forEach(({ share, split, side, basis }, index) => {
      const cell = (rendered[index] ?? '').split('</div></div>')[0] ?? '';
      expect(cell).toContain(`data-side="${side}" data-basis="${basis}"`);
      if (share === null) {
        expect(cell).toContain(`<span class="pct na">${texts.na.label}</span>`);
        expect(cell).toContain('class="share-bar empty"');
        expect(cell).not.toContain('class="iss');
        expect(cell).not.toContain('class="brg');
        expect(cell).not.toContain(formatPercent('0'));
        const reason = !split.quality.complete
          ? texts.na.reasons.noDataForRange
          : basis === 'count' && !split.quality.operationsComplete
            ? texts.na.reasons.operationsIncomplete
            : texts.issuerVsBridge.noFlow[side];
        expect(cell).toContain(`<span class="words na-why">${reason}</span>`);
      } else {
        expect(cell).toContain(formatPercent(share));
        expect(cell).not.toContain('pct na');
        expect(cell).toContain(`class="iss ${side}"`);
      }
    });
  });

  it('reads "operation counts incomplete" for the inflow operations of the unreconciled mock', async () => {
    const overview = await load('unreconciled');
    const html = render(IssuerVsBridge, overview);
    expect(thirty(overview)[0]?.in.count.issuerShare).toBeNull();
    expect(html).toContain(texts.na.reasons.operationsIncomplete);
    // Its volume share is known, so only the operations cell is n/a.
    expect(count(html, 'pct na')).toBe(thirty(overview).filter((row) => row.in.count.issuerShare === null).length);
  });

  it('shows the flagged days next to the percentage, from the API quality', async () => {
    const overview = await load('unreconciled');
    const html = render(IssuerVsBridge, overview);
    const days = thirty(overview).flatMap((row) => [row.in, row.out]).filter((split) => split.quality.unreconciledDays.length > 0);
    expect(days.length).toBeGreaterThan(0);
    expect(count(html, `${texts.issuerVsBridge.flagDays('Oct 9')}`)).toBe(days.length * 2);
    expect(count(render(IssuerVsBridge, await load('ok')), 'data-flag="unreconciled"')).toBe(0);
  });

  it('keeps one card per scope: all chains first, then each chain', async () => {
    const overview = await load('ok');
    const html = render(IssuerVsBridge, overview);
    expect(thirty(overview).map((row) => row.scope)).toEqual(['all', ...overview.chains.map((chain) => chain.slug)]);
    for (const row of thirty(overview)) expect(html).toContain(`data-scope="${row.scope}"`);
    expect(html).toContain(texts.dayRange('Sep 10', 'Oct 9'));
  });

  it('lists every flagged day and lets the list wrap inside its cell', async () => {
    const overview = clone(await load('ok'));
    const row = thirty(overview)[0];
    if (row === undefined) throw new Error('no row');
    row.in.quality.unreconciledDays = ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
    const html = render(IssuerVsBridge, parse(overview));
    expect(html).toContain(texts.issuerVsBridge.flagDays('Oct 3, Oct 4, Oct 5, Oct 6, Oct 7, Oct 8, Oct 9'));
    const css = readFileSync(path.join(import.meta.dirname, '../styles/charts.css'), 'utf8');
    const rule = (selector: string): string => {
      const start = css.indexOf(selector + ' {');
      return start < 0 ? '' : css.slice(start, css.indexOf('}', start));
    };
    expect(rule('.mx-cell .top')).toContain('flex-wrap: wrap');
    expect(rule('.mx-cell .ur')).not.toContain('nowrap');
    expect(rule('.mx-cell .ur')).toContain('overflow-wrap: anywhere');
    expect(rule('.mult .tag')).toContain('white-space: normal');
  });
});
