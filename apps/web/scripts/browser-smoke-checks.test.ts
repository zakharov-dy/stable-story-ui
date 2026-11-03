import { createMockClient, type Overview } from '@app/contracts';
import { describe, expect, it } from 'vitest';
import { ALL_BLOCKS, CARDS } from '../src/checks/page-html.ts';
import { texts } from '../src/texts.ts';
import {
  OK_SVGS,
  checkChartHover,
  checkConsole,
  checkFonts,
  checkHydratedHtml,
  checkNetwork,
  checkOverflow,
  checkPage,
  checkPageState,
  checkTones,
  createNetworkLog,
  groupProblems,
  sandboxRefusal,
  signOfPercentText,
  type DomFacts,
  type PageFacts,
  type StateExpectation,
  type ToneFact,
} from './browser-smoke-checks.ts';

const ORIGIN = 'http://127.0.0.1:3100';
const overview = (state: Parameters<typeof createMockClient>[0]): Promise<Overview> => createMockClient(state).overview();

async function expectationFor(state: Parameters<typeof createMockClient>[0]): Promise<StateExpectation> {
  const data = await overview(state);
  return { state, kind: data.asOf === null ? 'empty' : 'data', overview: data, exact: state === 'ok' || state === 'long-history', demoState: state };
}

const okDom = (chains: number): DomFacts => ({
  pageStates: ['data'],
  kpis: CARDS.length,
  chainStates: Array.from({ length: chains * 2 }, () => 'ok'),
  flows: 40,
  blocks: [...ALL_BLOCKS],
  svgs: OK_SVGS,
  chartSvgs: OK_SVGS - 3,
  unreconciled: 0,
  delayedFlags: 0,
  demoLabels: 1,
  robots: [],
});

const tone = (card: string, text: string, toneValue: string, className: string, color: string): ToneFact => ({ card, text, tone: toneValue, className, color });
const GOOD_TONES: ToneFact[] = [
  tone('change1d', '▲ +1.70%', 'positive', 'pos', 'rgb(0, 255, 0)'),
  tone('change7d', '▼ -2.00%', 'negative', 'neg', 'rgb(255, 0, 0)'),
  tone('issuerMinted7d', '+5.00%', 'neutral', 'neu', 'rgb(255, 255, 255)'),
];

function goodFacts(chains: number): PageFacts {
  return {
    origin: ORIGIN,
    documentStatus: 200,
    pendingRequests: [],
    console: [{ type: 'log', text: 'fine' }],
    requests: [`${ORIGIN}/`, `${ORIGIN}/_next/static/media/a.woff2`, 'data:image/png;base64,AAAA'],
    responses: [
      { url: `${ORIGIN}/`, status: 200 },
      { url: `${ORIGIN}/_next/static/media/a.woff2`, status: 200 },
    ],
    scrollWidth: 375,
    innerWidth: 375,
    fontsStatus: 'loaded',
    fontFaces: [{ family: 'Space Grotesk', status: 'loaded' }],
    dom: okDom(chains),
    hovers: [{ chart: 'chart 1 (header)', tip: 'Sep 24: 9,030', tipVisible: true }],
    chartFrames: 1,
    tones: GOOD_TONES,
    html: '',
  };
}

describe('the numbers of the prompt come from the shared lists', () => {
  it('state the prompt counts: 10 blocks, 5 cards, 6 chain states for the ok mock', async () => {
    const ok = await overview('ok');
    expect(ALL_BLOCKS).toHaveLength(10);
    expect(CARDS).toHaveLength(5);
    expect(ok.status.chains.length + ok.chains.length).toBe(6);
  });
});

describe('console', () => {
  it('passes on logs, info and debug', () => {
    expect(checkConsole([{ type: 'log', text: 'a' }, { type: 'info', text: 'b' }, { type: 'debug', text: 'c' }])).toEqual([]);
  });
  it('fails on an error, a warning, a page error and a failed request', () => {
    const problems = checkConsole([
      { type: 'error', text: 'Failed to load resource: 404' },
      { type: 'warning', text: 'deprecated' },
      { type: 'pageerror', text: 'x is not defined' },
      { type: 'requestfailed', text: 'https://example.com/a net::ERR_FAILED' },
    ]);
    expect(problems).toHaveLength(4);
  });
  it('names a hydration error, also the minified React one of a production build', () => {
    expect(checkConsole([{ type: 'error', text: 'Hydration failed because the server rendered HTML' }])[0]).toContain('hydration');
    expect(checkConsole([{ type: 'pageerror', text: 'Minified React error #418; visit https://react.dev/errors/418' }])[0]).toContain('hydration');
    expect(checkConsole([{ type: 'error', text: 'other' }])[0]).not.toContain('hydration');
  });
});

describe('network', () => {
  const base = { origin: ORIGIN, documentStatus: 200, pendingRequests: [], requests: [`${ORIGIN}/`], responses: [{ url: `${ORIGIN}/`, status: 200 }] };
  it('passes on own-origin requests, data: and blob:', () => {
    expect(checkNetwork({ ...base, requests: [`${ORIGIN}/a`, 'data:text/plain,x', 'blob:http://127.0.0.1:3100/uuid'] })).toEqual([]);
  });
  it('fails on a request to another origin, also another port or host', () => {
    expect(checkNetwork({ ...base, requests: [`${ORIGIN}/`, 'https://fonts.gstatic.com/x.woff2'] })).toEqual(['request to another origin: https://fonts.gstatic.com/x.woff2']);
    expect(checkNetwork({ ...base, requests: ['http://127.0.0.1:3101/'] })).toHaveLength(1);
    expect(checkNetwork({ ...base, requests: ['http://localhost:3100/'] })).toHaveLength(1);
  });
  it('fails on a 404 and a 500, naming the URL and the status', () => {
    expect(checkNetwork({ ...base, responses: [...base.responses, { url: `${ORIGIN}/favicon.ico`, status: 404 }] })).toEqual([`404 for ${ORIGIN}/favicon.ico`]);
    expect(checkNetwork({ ...base, responses: [{ url: `${ORIGIN}/api`, status: 500 }] })).toEqual([`500 for ${ORIGIN}/api`]);
  });
  it('lets 399 pass and requires 200 for the document', () => {
    expect(checkNetwork({ ...base, responses: [{ url: `${ORIGIN}/r`, status: 304 }] })).toEqual([]);
    expect(checkNetwork({ ...base, documentStatus: 500 })).toEqual(['the document answered 500, expected 200']);
    expect(checkNetwork({ ...base, documentStatus: null })).toHaveLength(1);
  });
});

describe('overflow', () => {
  it('passes when equal and fails by one pixel', () => {
    expect(checkOverflow({ scrollWidth: 375, innerWidth: 375 })).toEqual([]);
    expect(checkOverflow({ scrollWidth: 376, innerWidth: 375 })).toHaveLength(1);
  });
});

describe('fonts', () => {
  const ok = { fontsStatus: 'loaded', fontFaces: [{ family: 'A', status: 'loaded' }], responses: [{ url: `${ORIGIN}/m/a.woff2`, status: 200 }] };
  it('passes when loaded', () => {
    expect(checkFonts(ok)).toEqual([]);
  });
  it('fails on a status other than loaded, a face in error and no font file', () => {
    expect(checkFonts({ ...ok, fontsStatus: 'loading' })).toHaveLength(1);
    expect(checkFonts({ ...ok, fontFaces: [{ family: 'A', status: 'error' }] })).toEqual(['font face A is in error']);
    expect(checkFonts({ ...ok, responses: [] })).toEqual(['no .woff2 font file was loaded']);
    expect(checkFonts({ ...ok, responses: [{ url: `${ORIGIN}/m/a.woff2`, status: 404 }] })).toEqual(['no .woff2 font file was loaded']);
  });
});

describe('page state and blocks', () => {
  it('passes on the ok page', async () => {
    const expectation = await expectationFor('ok');
    expect(checkPageState(goodFacts(3), expectation)).toEqual([]);
  });
  it('fails on a missing block, a duplicated block and a wrong card count', async () => {
    const expectation = await expectationFor('ok');
    const facts = goodFacts(3);
    expect(checkPageState({ ...facts, dom: { ...facts.dom, blocks: facts.dom.blocks.filter((block) => block !== 'drivers') } }, expectation).join()).toContain('drivers');
    expect(checkPageState({ ...facts, dom: { ...facts.dom, blocks: [...facts.dom.blocks, 'feed'] } }, expectation).join()).toContain('feed');
    expect(checkPageState({ ...facts, dom: { ...facts.dom, kpis: 4 } }, expectation).join()).toContain('[data-kpi]');
  });
  it('fails on the wrong page state, no charts, a no-figures block and a missing demo label', async () => {
    const expectation = await expectationFor('ok');
    const facts = goodFacts(3);
    expect(checkPageState({ ...facts, dom: { ...facts.dom, pageStates: ['empty'] } }, expectation).join()).toContain('data-page-state');
    expect(checkPageState({ ...facts, dom: { ...facts.dom, chartSvgs: 0, svgs: 0 } }, expectation).join()).toContain('chart svg');
    expect(checkPageState({ ...facts, dom: { ...facts.dom, blocks: [...facts.dom.blocks, 'no-figures'] } }, expectation).join()).toContain('no-figures');
    expect(checkPageState({ ...facts, dom: { ...facts.dom, demoLabels: 0 } }, expectation).join()).toContain('demo label');
  });
  it('checks 41 SVGs and twelve chain states for the six-chain long-history scenario', async () => {
    const expectation = await expectationFor('long-history');
    const facts = goodFacts(6);
    const dom = { ...facts.dom, svgs: 41, chartSvgs: 38 };
    expect(checkPageState({ ...facts, dom }, expectation)).toEqual([]);
    expect(checkPageState({ ...facts, dom: { ...dom, svgs: 40 } }, expectation).join()).toContain('41 svg');
  });
  it('states the exact counts of ok only', async () => {
    const ok = await expectationFor('ok');
    const facts = goodFacts(3);
    expect(checkPageState({ ...facts, dom: { ...facts.dom, svgs: OK_SVGS - 1 } }, ok).join()).toContain(`${OK_SVGS} svg`);
    expect(checkPageState({ ...facts, dom: { ...facts.dom, chainStates: ['ok', 'ok'] } }, ok).join()).toContain('[data-chain-state]');
    const gap = await expectationFor('gap');
    expect(checkPageState({ ...facts, dom: { ...facts.dom, svgs: OK_SVGS - 1, chainStates: ['ok'] } }, gap)).toEqual([]);
  });
  it('requires the flags of delayed and unreconciled', async () => {
    const facts = goodFacts(3);
    const delayed = await expectationFor('delayed');
    expect(checkPageState(facts, delayed).join()).toContain('delayed');
    expect(checkPageState({ ...facts, dom: { ...facts.dom, chainStates: ['delayed'], delayedFlags: 1 } }, delayed)).toEqual([]);
    const unreconciled = await expectationFor('unreconciled');
    expect(checkPageState(facts, unreconciled).join()).toContain('data-unreconciled');
    expect(checkPageState({ ...facts, dom: { ...facts.dom, unreconciled: 2 } }, unreconciled)).toEqual([]);
  });
  it('checks the empty page: no cards or charts, the no-figures block, a status row per chain', async () => {
    const expectation = await expectationFor('empty');
    const chains = expectation.overview?.status.chains.length ?? 0;
    const empty: DomFacts = { ...okDom(0), pageStates: ['empty'], kpis: 0, chainStates: Array.from({ length: chains }, () => 'ok'), flows: 0, blocks: ['no-figures', 'status', 'how-we-count', 'disclaimer'], svgs: 2, chartSvgs: 0 };
    expect(checkPageState({ dom: empty, html: '' }, expectation)).toEqual([]);
    expect(checkPageState({ dom: { ...empty, kpis: 1 }, html: '' }, expectation)).toHaveLength(1);
    expect(checkPageState({ dom: { ...empty, blocks: ['status', 'feed'] }, html: '' }, expectation).join()).toContain('no-figures');
    expect(checkPageState({ dom: { ...empty, chainStates: [] }, html: '' }, expectation).join()).toContain('one per chain');
    expect(checkPageState({ dom: { ...empty, chartSvgs: 1 }, html: '' }, expectation).join()).toContain('chart svg');
  });
  describe('unavailable', () => {
    const expectation: StateExpectation = { state: 'unavailable', kind: 'unavailable', overview: null, exact: false, demoState: 'unavailable' };
    const dom: DomFacts = { ...okDom(0), pageStates: ['unavailable'], kpis: 0, chainStates: [], flows: 0, blocks: ['how-we-count'], svgs: 1, chartSvgs: 0, robots: ['noindex'] };
    const html = `<main>${texts.states.unavailable} ${texts.states.unavailableBody}</main>`;
    it('passes without data text', () => {
      expect(checkPageState({ dom, html }, expectation)).toEqual([]);
    });
    it('fails without the robots meta, with a status block, a card or digits in the data text', () => {
      expect(checkPageState({ dom: { ...dom, robots: [] }, html }, expectation).join()).toContain('noindex');
      expect(checkPageState({ dom: { ...dom, blocks: ['status'] }, html }, expectation).join()).toContain('status');
      expect(checkPageState({ dom: { ...dom, kpis: 5 }, html }, expectation).join()).toContain('[data-kpi]');
      expect(checkPageState({ dom, html: `${html}<p>1,234 USDC</p>` }, expectation).join()).toContain('digits');
    });
  });
  it('rejects a live page that reports no known state', () => {
    const live: StateExpectation = { state: 'live', kind: null, overview: null, exact: false, demoState: null };
    expect(checkPageState({ dom: { ...okDom(0), pageStates: ['weird'] }, html: '' }, live)).toHaveLength(1);
  });
  it.each(['live', 'published'])('requires no demo label on %s data', (state) => {
    const live: StateExpectation = { state, kind: 'data', overview: null, exact: false, demoState: null };
    expect(checkPageState({ dom: { ...okDom(0), demoLabels: 1 }, html: '' }, live).join()).toContain('demo label');
    expect(checkPageState({ dom: { ...okDom(0), demoLabels: 0 }, html: '' }, live).join()).not.toContain('demo label');
    expect(checkPageState({ dom: { ...okDom(1), demoLabels: 0 }, html: '' }, live)).toEqual([]);
  });
});

describe('hydrated HTML', () => {
  it('fails on a page that is not what the overview says', async () => {
    const expectation = await expectationFor('ok');
    expect(checkHydratedHtml('<html><body><main data-page-state="data"></main></body></html>', expectation).length).toBeGreaterThan(0);
  });
  it('is not applied to live pages, which have no overview to compare with', () => {
    expect(checkHydratedHtml('', { state: 'live', kind: 'data', overview: null, exact: false, demoState: null })).toEqual([]);
  });
});

describe('network log', () => {
  const base = { origin: ORIGIN, documentStatus: 200, pendingRequests: [], requests: [], responses: [] };
  it('records requests and responses as the browser made them, favicon included', () => {
    const log = createNetworkLog();
    log.onRequestWillBeSent({ requestId: '1', request: { url: `${ORIGIN}/` } });
    log.onRequestWillBeSent({ requestId: '2', request: { url: `${ORIGIN}/favicon.ico` } });
    log.onResponseReceived({ requestId: '1', response: { url: `${ORIGIN}/`, status: 200 } });
    log.onResponseReceived({ requestId: '2', response: { url: `${ORIGIN}/favicon.ico`, status: 404 } });
    expect(log.requests).toEqual([`${ORIGIN}/`, `${ORIGIN}/favicon.ico`]);
    expect(checkNetwork({ ...base, requests: log.requests, responses: log.responses })).toEqual([`404 for ${ORIGIN}/favicon.ico`]);
  });
  it('keeps a slow favicon pending until its answer ends it, and reports it when collection stops first', () => {
    const log = createNetworkLog();
    log.onRequestWillBeSent({ requestId: '1', request: { url: `${ORIGIN}/` } });
    log.onRequestWillBeSent({ requestId: '2', request: { url: `${ORIGIN}/favicon.ico` } });
    log.onLoadingFinished({ requestId: '1' });
    expect(log.pending()).toEqual([`${ORIGIN}/favicon.ico`]);
    // collection stopped now: the request exists, its status is unknown, so the check fails
    expect(checkNetwork({ ...base, requests: log.requests, responses: log.responses, pendingRequests: log.pending() })).toEqual([`no answer yet when collection stopped: ${ORIGIN}/favicon.ico`]);
    // the 404 arrives late: nothing pending, and the status is checked
    log.onResponseReceived({ requestId: '2', response: { url: `${ORIGIN}/favicon.ico`, status: 404 } });
    log.onLoadingFinished({ requestId: '2' });
    expect(log.pending()).toEqual([]);
    expect(checkNetwork({ ...base, requests: log.requests, responses: log.responses, pendingRequests: log.pending() })).toEqual([`404 for ${ORIGIN}/favicon.ico`]);
  });
  it('sees a favicon request to another origin and a favicon that failed before an answer', () => {
    const log = createNetworkLog();
    log.onRequestWillBeSent({ requestId: '1', request: { url: 'https://cdn.example.com/favicon.ico' } });
    log.onRequestWillBeSent({ requestId: '2', request: { url: `${ORIGIN}/favicon.ico` } });
    log.onRequestWillBeSent({ requestId: '3', request: { url: `${ORIGIN}/_next/static/a.js` } });
    log.onLoadingFailed({ requestId: '2', errorText: 'net::ERR_ABORTED' });
    log.onLoadingFailed({ requestId: '3', errorText: 'net::ERR_FAILED' }); // not a favicon: Playwright reports it
    expect(checkNetwork({ ...base, requests: log.requests, responses: log.responses })).toEqual(['request to another origin: https://cdn.example.com/favicon.ico']);
    expect(log.failures).toEqual([{ type: 'requestfailed', text: `${ORIGIN}/favicon.ico net::ERR_ABORTED` }]);
    expect(checkConsole(log.failures)).toHaveLength(1);
  });
});

describe('chart hover', () => {
  it('is skipped without charts', () => {
    expect(checkChartHover({ hovers: [], chartFrames: 0 })).toEqual([]);
  });
  it('passes when every chart shows a tip', () => {
    expect(checkChartHover({ hovers: [{ chart: 'a', tip: 'x', tipVisible: true }, { chart: 'b', tip: 'y', tipVisible: true }], chartFrames: 2 })).toEqual([]);
  });
  it('fails on a missing or blank tooltip, naming the chart', () => {
    expect(checkChartHover({ hovers: [{ chart: 'chart 2 (feed)', tip: null, tipVisible: false }], chartFrames: 1 })).toEqual(['no tooltip after hovering chart 2 (feed)']);
    expect(checkChartHover({ hovers: [{ chart: 'a', tip: '  ', tipVisible: true }], chartFrames: 1 })).toHaveLength(1);
  });
  it('fails on a tooltip that exists but is hidden (display:none, visibility, opacity, zero box)', () => {
    expect(checkChartHover({ hovers: [{ chart: 'chart 1 (header)', tip: 'Sep 24: 9,030', tipVisible: false }], chartFrames: 1 })).toEqual([
      'the tooltip of chart 1 (header) exists but is not visible',
    ]);
  });
  it('fails when there are charts and none could be hovered', () => {
    expect(checkChartHover({ hovers: [], chartFrames: 3 })).toHaveLength(1);
  });
});

describe('tone colors', () => {
  it('passes the good set', () => {
    expect(checkTones(GOOD_TONES)).toEqual([]);
  });
  it('fails when two tones have the same color', () => {
    const same = GOOD_TONES.map((fact) => (fact.tone === 'negative' ? { ...fact, color: 'rgb(0, 255, 0)' } : fact));
    expect(checkTones(same).join()).toContain('same color');
    const neutralLikePositive = GOOD_TONES.map((fact) => (fact.tone === 'neutral' ? { ...fact, color: 'rgb(0, 255, 0)' } : fact));
    expect(checkTones(neutralLikePositive).join()).toContain('same color');
  });
  it('fails when one tone has two colors', () => {
    expect(checkTones([...GOOD_TONES, tone('change7d', '▲ +1.00%', 'positive', 'pos', 'rgb(1, 2, 3)')]).join()).toContain('two colors');
  });
  it('fails on a directed card with the wrong tone or arrow', () => {
    expect(checkTones([tone('change1d', '▲ +1.70%', 'neutral', 'neu', 'c')]).join()).toContain('must be positive');
    expect(checkTones([tone('change1d', '▼ -1.70%', 'positive', 'pos', 'c')]).join()).toContain('must be negative');
    expect(checkTones([tone('change7d', '+1.70%', 'positive', 'pos', 'c')]).join()).toContain('expected ▲');
    expect(checkTones([tone('change7d', '▲ 0.00%', 'neutral', 'neu', 'c')]).join()).toContain('no arrow');
    expect(checkTones([tone('change7d', '0.00%', 'neutral', 'neu', 'c')])).toEqual([]);
  });
  it('fails on a never-directed card with a direction', () => {
    expect(checkTones([tone('supply', '+1.70%', 'positive', 'pos', 'c')]).join()).toContain('never directed');
    expect(checkTones([tone('issuerBurned7d', '▲ +1.70%', 'neutral', 'neu', 'c')]).join()).toContain('no arrow');
    expect(checkTones([tone('issuerMinted7d', '-12.00%', 'neutral', 'neu', 'c')])).toEqual([]);
  });
  it('fails on a class that does not follow the tone and on an unknown tone', () => {
    expect(checkTones([tone('change1d', '▲ +1.70%', 'positive', 'neg', 'c')]).join()).toContain('class pos');
    expect(checkTones([tone('change1d', '▲ +1.70%', 'up', 'pos', 'c')]).join()).toContain('data-tone');
  });
  it('reads the sign of a percent text', () => {
    expect(signOfPercentText('▲ +1.70%')).toBe('positive');
    expect(signOfPercentText('▼ -1.70%')).toBe('negative');
    expect(signOfPercentText('▼ −1.70%')).toBe('negative');
    expect(signOfPercentText('0.00%')).toBe('zero');
    expect(signOfPercentText('n/a')).toBeNull();
  });
});

describe('checkPage and groupProblems', () => {
  it('passes a good live data page and skips tone colors on empty and unavailable', () => {
    const live: StateExpectation = { state: 'live', kind: 'data', overview: null, exact: false, demoState: null };
    const facts = goodFacts(3);
    expect(Object.values(checkPage({ ...facts, dom: { ...facts.dom, demoLabels: 0 } }, live)).flat()).toEqual([]);
    const unavailable = checkPage({ ...goodFacts(0), tones: [tone('supply', '▲ +1%', 'positive', 'pos', 'x')] }, { state: 'unavailable', kind: 'unavailable', overview: null, exact: false, demoState: 'unavailable' });
    expect(unavailable['tone-colors']).toEqual([]);
  });
  it('counts repeated problems', () => {
    expect(groupProblems(['a', 'b', 'a', 'a'])).toEqual(['a (x3)', 'b']);
  });
});

describe('sandboxRefusal', () => {
  it('refuses inside a sandbox marked as unable to start Chrome', () => {
    expect(sandboxRefusal({ BROWSER_SMOKE_UNSUPPORTED_SANDBOX: '1' })).toBe('browser-smoke: not run inside a sandbox that cannot start Chrome (BROWSER_SMOKE_UNSUPPORTED_SANDBOX); CI runs it');
  });
  it('allows launching elsewhere', () => {
    expect(sandboxRefusal({})).toBeNull();
    expect(sandboxRefusal({ BROWSER_SMOKE_UNSUPPORTED_SANDBOX: '' })).toBeNull();
    expect(sandboxRefusal({ CI: 'true' })).toBeNull();
  });
});
