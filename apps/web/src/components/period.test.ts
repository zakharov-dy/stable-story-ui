import { createMockClient, type Overview } from '@app/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageView } from './PageView.tsx';
import { texts } from '../texts.ts';
import { historyDays } from '@app/view';

const render = (overview: Overview): string => renderToStaticMarkup(createElement(PageView, { model: { state: 'data', overview }, demoState: null }));
const count = (html: string, fragment: string): number => html.split(fragment).length - 1;

describe('server-selected public periods', () => {
  it('keeps one period switch, unique ids, and all six chains in every period', async () => {
    const overview = await createMockClient('long-history').overview();
    const html = render(overview);
    expect(count(html, 'name="period"')).toBe(3);
    expect(count(html, 'data-block="supply-by-chain"')).toBe(1);
    expect(count(html, 'data-block="drivers"')).toBe(1);
    expect(count(html, 'data-block="issuer-vs-bridge"')).toBe(1);
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const period of ['30d', '90d', 'all'] as const) {
      expect(count(html, '<figure class="card mult" data-period="' + period + '"')).toBe(7);
      for (const chain of overview.chains) expect(overview.views[period]!.drivers.some((driver) => driver.scope === chain.slug)).toBe(true);
    }
    expect(html).toContain('weekly flows');
    expect(html).toContain('monthly flows');
    expect(html).toContain(texts.resolution.sentence);
    expect(html).not.toContain('disabled');
  });

  it('bases disabled periods on coverage rather than bucket counts', async () => {
    const short = await createMockClient('short-history').overview();
    expect(historyDays(short)).toBe(7);
    expect(count(render(short), 'disabled')).toBe(2);
    expect(render(short)).toContain(texts.period.shortNote);
    const long = await createMockClient('long-history').overview();
    expect(historyDays(long)).toBe(121);
    expect(long.views.all!.supplyByChain.level.buckets).toHaveLength(5);
    expect(count(render(long), 'disabled')).toBe(0);
  });
});
