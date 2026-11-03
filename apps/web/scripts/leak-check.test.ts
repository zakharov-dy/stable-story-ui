import { createMockClient } from '@app/contracts';
import { describe, expect, it } from 'vitest';
import { assertNoCollisions, checkLeakHtml, checkLongHistory, MARKERS } from './leak-check.ts';
import { flightModels, resolveFlight, walkFlight, type Model } from './leak-check-flight.ts';

const flight = (stream: string, split?: number): string => (split === undefined ? [stream] : [stream.slice(0, split), stream.slice(split)])
  .map((chunk) => `<script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script>`).join('');
const element = (props: Record<string, Model>): Model => ['$', 'section', null, props];
const response = (child: Model, body = ''): string => body + flight(`0:${JSON.stringify(child)}\n`);

describe('The long-history leak gate over HTML and inline RSC', () => {
  it('has independently computed fixture anchors and no legal-value collisions', async () => {
    expect(MARKERS).toEqual({ level: '3659.456789', net: '180.456789', mint: '123.456789' });
    const overview = await createMockClient('long-history').overview();
    expect(() => assertNoCollisions(overview)).not.toThrow();
    // Records legitimately carry the mint marker and an old date.
    expect(overview.records.some((record) => record.value === MARKERS.mint)).toBe(true);
    const daily = await createMockClient('long-history').series({ asset: 'usdc', metric: 'level', groupBy: 'chain', period: 'day', from: '2026-12-16', to: '2027-03-15' });
    const at = daily.buckets.findIndex((bucket) => bucket.start === '2026-12-22');
    expect(daily.lines.find((line) => line.chain === 'ethereum')?.values[at]).toBe('3659.456789');
    overview.header.supply.value = MARKERS.net;
    expect(() => assertNoCollisions(overview)).toThrow('fixture collision');
    overview.header.supply.value = '3658'; // only the compact representation collides (3.66K)
    expect(() => assertNoCollisions(overview)).toThrow('fixture collision: forbidden 3.66K');
  });

  it('preserves old records/feed, legal aggregates and grouped 30D values in both channels', () => {
    const html = response(element({ children: [
      element({ 'data-block': 'records', children: 'Dec 22, 2026: 123.46 / 123.456789' }),
      element({ 'data-block': 'feed', children: '123.46' }),
      element({ 'data-period': '30d', children: '79,123.46 / 79123.456789' }),
      element({ 'data-period': '90d', children: '183.46 / 183.456789' }),
    ] }), '<section data-block="records">2026-12-22 123.46</section><p>79,123.46 79123.456789 183.46</p>');
    expect(() => checkLeakHtml(html)).not.toThrow();
  });

  it.each([
    ['hidden copy', '<div hidden>3659.456789</div>'],
    ['data attribute', '<div data-old="3,659.456789"></div>'],
    ['compact tooltip', '<svg><title>Ethereum 3.66K</title></svg>'],
    ['signed net tooltip', '<svg><title>Net +180.46</title></svg>'],
    ['encoded number', '<p>&#51;659.456789</p>'],
    ['old flow in chart 05', '<section aria-labelledby="h-issuer-vs-bridge-all"><div hidden>123.46</div></section>'],
    ['inline script', '<script>const oldDaily = "123.456789";</script>'],
  ])('rejects a planted %s', (_name, body) => {
    expect(() => checkLeakHtml(response(null, body))).toThrow(/old daily value/);
  });

  it('rejects an old daily prop even alongside a legal record reference', () => {
    const stream = `0:${JSON.stringify(element({ children: ['$1', '$2'] }))}\n1:${JSON.stringify(element({ 'data-block': 'records', children: '$3' }))}\n2:${JSON.stringify(element({ 'data-period': 'all', hiddenCopy: '$3' }))}\n3:"123.456789"\n`;
    expect(() => checkLeakHtml(flight(stream))).toThrow('123.456789 (123.456789) leaked in decoded Flight');
  });

  it('joins Flight chunks and decodes escaped and referenced prop strings', () => {
    const stream = '0:{"hidden":"3659.456789"}\n';
    expect(() => checkLeakHtml(flight(stream, stream.indexOf('456789')))).toThrow('decoded Flight');
    const escaped = '0:{"tooltip":"\\u0033.66K"}\n';
    expect(() => checkLeakHtml(flight(escaped))).toThrow('3.66K');
  });

  it('follows shared paths to props under each use, including a checked use after records', () => {
    const stream = `0:${JSON.stringify(element({ children: ['$1', '$2'] }))}\n1:${JSON.stringify(element({ 'data-block': 'records', children: '123.46' }))}\n2:{"hidden":"$1:props:children"}\n`;
    expect(() => checkLeakHtml(flight(stream))).toThrow('123.46');
    expect(() => checkLeakHtml(flight('0:"$1:recent"\n1:{"recent":"67","hidden":"123.46"}\n'))).toThrow('123.46');
    const rows = flightModels(flight('0:["$","div",null,{"tips":["recent"]}]\n'));
    expect(resolveFlight(rows, '$0:props:tips:0')).toBe('recent');
  });

  it('fails loudly on absent or unknown Flight models and unresolved references', () => {
    expect(() => checkLeakHtml('<main />')).toThrow('missing inline Flight');
    expect(() => flightModels(flight('0:T4,test\n'))).toThrow('unsupported Flight model row');
    expect(() => checkLeakHtml(flight('0:"$f"\n'))).toThrow('unresolved Flight reference');
    expect(() => resolveFlight(new Map([['0', '$0']]), '$0')).toThrow('circular Flight reference');
    expect(() => walkFlight(new Map([['0', null], ['1', { hidden: MARKERS.mint }]]), (value) => {
      if (value === MARKERS.mint) throw new Error('orphan visited');
    })).toThrow('orphan visited');
  });

  it('does not accept an empty page or a page carrying only the forbidden-value absence', async () => {
    const overview = await createMockClient('long-history').overview();
    await expect(checkLongHistory(response(null), overview)).rejects.toThrow('missing positive control');
  });
});
