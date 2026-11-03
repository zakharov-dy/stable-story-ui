import type * as Contracts from '@app/contracts';
import type { ApiClient, Overview } from '@app/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkPageHtml, visibleText } from '../checks/page-html.ts';
import { formatCount } from '../view.ts';
import { mockStates } from '../server/config.ts';
import { ConfigError } from '../server/config.ts';
import { texts } from '../texts.ts';

vi.mock('server-only', () => ({}));
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));

// The real clients, wrapped to count the API calls a render makes.
const calls = vi.hoisted(() => ({ overview: 0, series: 0, events: 0, eventsStats: 0 }));
vi.mock('@app/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof Contracts>();
  const counted = (client: ApiClient): ApiClient => ({
    overview: (params) => (calls.overview++, client.overview(params)),
    series: (params) => (calls.series++, client.series(params)),
    events: (params) => (calls.events++, client.events(params)),
    eventsStats: (params) => (calls.eventsStats++, client.eventsStats(params)),
  });
  return {
    ...actual,
    createMockClient: (state: Contracts.MockState) => counted(actual.createMockClient(state)),
    createHttpClient: (options: Contracts.HttpClientOptions) => counted(actual.createHttpClient(options)),
  };
});

const { createMockClient } = await import('@app/contracts');
const { default: Page, generateMetadata } = await import('./page.tsx');

const render = async (): Promise<string> => renderToStaticMarkup(await Page());

/** The overview the page receives in this state, or null when the mock API fails. */
async function expectedOverview(state: Contracts.MockState): Promise<Overview | null> {
  try {
    return await createMockClient(state).overview();
  } catch {
    return null;
  }
}

const resetCalls = () => Object.assign(calls, { overview: 0, series: 0, events: 0, eventsStats: 0 });

beforeEach(() => {
  vi.stubEnv('API_MODE', 'mock');
  vi.stubEnv('API_URL', '');
  vi.stubEnv('MOCK_STATE', '');
  vi.stubEnv('SITE_URL', '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('page in mock mode', () => {
  it('covers every mock state', () => {
    expect(mockStates).toHaveLength(9);
  });

  it.each(mockStates)('renders %s from exactly one overview call', async (state) => {
    vi.stubEnv('MOCK_STATE', state);
    const overview = await expectedOverview(state);
    resetCalls();
    const html = await render();
    expect(calls).toEqual({ overview: 1, series: 0, events: 0, eventsStats: 0 });
    expect(checkPageHtml(html, { overview, demoState: state })).toEqual([]);
  });

  it('defaults to the ok state', async () => {
    const html = await render();
    expect(checkPageHtml(html, { overview: await expectedOverview('ok'), demoState: 'ok' })).toEqual([]);
  });

  it('tells empty and unavailable apart', async () => {
    vi.stubEnv('MOCK_STATE', 'empty');
    const empty = visibleText(await render());
    vi.stubEnv('MOCK_STATE', 'unavailable');
    const unavailable = visibleText(await render());
    expect(empty).toContain(texts.states.empty);
    expect(empty).not.toContain(texts.states.unavailable);
    expect(unavailable).toContain(texts.states.unavailable);
    expect(unavailable).not.toContain(texts.states.empty);
  });

  it('marks quality, unreconciled rows and spark points in the unreconciled state', async () => {
    vi.stubEnv('MOCK_STATE', 'unreconciled');
    const overview = await expectedOverview('unreconciled');
    const html = await render();
    const flagged = overview?.header.supply.sparkUnreconciled ?? [];
    expect(flagged.length).toBeGreaterThan(0);
    expect(overview?.largestEvents.items.some((row) => row.unreconciled)).toBe(true);
    expect(html).toMatch(/data-block="header" data-quality="[^"]*unreconciled/);
    expect(html).toMatch(/data-block="feed" data-quality="[^"]*unreconciled/);
    for (const row of overview?.largestEvents.items.filter((item) => item.unreconciled) ?? []) {
      expect(html).toMatch(new RegExp(`<tr data-flow="${row.flow}"[^>]*data-unreconciled="true"[^>]*>`));
    }
    expect(html).toContain('data-flag="unreconciled"');
  });

  it('shows the lag and state of the delayed chain', async () => {
    vi.stubEnv('MOCK_STATE', 'delayed');
    const overview = await expectedOverview('delayed');
    const delayed = overview?.status.chains.filter((status) => status.state === 'delayed') ?? [];
    expect(delayed.length).toBeGreaterThan(0);
    const html = await render();
    for (const status of delayed) {
      const row = html.slice(html.indexOf(`data-chain="${status.chain}"`));
      expect(row.slice(0, row.indexOf('</tr>'))).toContain(texts.tags.behind(overview?.chains.find((chain) => chain.slug === status.chain)?.name ?? '', formatCount(status.lagHours)));
    }
  });
});

describe('page in mock mode: the day equation and its check chips', () => {
  /** The equation cards of the page, in page order. */
  const cardsOf = (html: string): string[] => {
    const start = html.indexOf('data-block="day-equation"');
    const section = html.slice(start, html.indexOf('</section>', start));
    return section.split('<article ').slice(1).map((card) => card.slice(0, card.indexOf('</article>')));
  };
  const chipKinds = (card: string): string[] => [...card.matchAll(/data-chip-kind="([^"]+)"/g)].map((match) => match[1] ?? '');

  it.each(['ok', 'delayed', 'unreconciled', 'empty-day', 'short-history', 'gap'] as const)('shows an equation card and chips for every chain in %s', async (state) => {
    vi.stubEnv('MOCK_STATE', state);
    const overview = (await expectedOverview(state))!;
    const cards = cardsOf(await render());
    expect(cards).toHaveLength(overview.chains.length);
    for (const status of overview.status.chains) {
      const card = cards[overview.chains.findIndex((chain) => chain.slug === status.chain)] ?? '';
      expect(card).toContain(`data-chain-state="${status.state}"`);
      expect(chipKinds(card).length).toBeGreaterThan(0);
    }
  });

  it('shows the bridge mismatch of Ethereum as its own chip, and the other chains as passed', async () => {
    vi.stubEnv('MOCK_STATE', 'unreconciled');
    const overview = (await expectedOverview('unreconciled'))!;
    const cards = cardsOf(await render());
    // Expectations come from the mock status.
    const expected = overview.status.chains.map((status) => (status.reconciliation?.bridge === 'mismatch' ? ['bridge'] : ['passed']));
    expect(overview.status.chains.map((status) => status.chain)).toEqual(overview.chains.map((chain) => chain.slug));
    expect(cards.map(chipKinds)).toEqual(expected);
    expect(expected[0]).toEqual(['bridge']);
    expect(cards[0]).toContain('data-unreconciled="true"');
    expect(cards[0]).toContain(`${texts.equation.marks.failed}</span>${texts.equation.checks.bridge}`);
    expect(cards.slice(1).every((card) => !card.includes('data-unreconciled'))).toBe(true);
  });

  it('shows the delayed chain with its own checks and the other chains with the later day named', async () => {
    vi.stubEnv('MOCK_STATE', 'delayed');
    const overview = (await expectedOverview('delayed'))!;
    const html = await render();
    const cards = cardsOf(html);
    const delayed = overview.status.chains.findIndex((status) => status.state === 'delayed');
    expect(delayed).toBeGreaterThanOrEqual(0);
    overview.status.chains.forEach((status, index) => {
      expect(chipKinds(cards[index] ?? '')).toEqual(index === delayed ? ['passed'] : ['notFlagged']);
      if (index !== delayed) expect((status.reconciliation?.day ?? '') > (overview.asOf ?? '')).toBe(true);
    });
    expect(cards[delayed]).toContain('data-chain-state="delayed"');
    expect(visibleText(html)).toContain(texts.tags.behind(overview.chains[delayed]?.name ?? '', formatCount(overview.status.chains[delayed]?.lagHours ?? null)));
  });

  it.each(['empty', 'unavailable'] as const)('has no equation, chips or charts in %s', async (state) => {
    vi.stubEnv('MOCK_STATE', state);
    const html = await render();
    for (const fragment of ['day-equation', 'data-chip-kind', 'data-kpi', 'class="chart"', 'wf-bar']) expect(html).not.toContain(fragment);
  });
});

describe('page in live mode', () => {
  const okOverview = async (): Promise<Overview> => (await expectedOverview('ok'))!;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  beforeEach(() => {
    vi.stubEnv('API_MODE', 'live');
    vi.stubEnv('API_URL', 'http://api.test/base');
  });

  it('calls the configured API once and shows the data without a demo label', async () => {
    const overview = await okOverview();
    const fetch = vi.fn<(url: string) => Promise<Response>>(() => Promise.resolve(json(overview)));
    vi.stubGlobal('fetch', fetch);
    resetCalls();
    const html = await render();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe('http://api.test/base/v1/supply/overview');
    expect(calls).toEqual({ overview: 1, series: 0, events: 0, eventsStats: 0 });
    expect(checkPageHtml(html, { overview, demoState: null })).toEqual([]);
  });

  it('does not keep a failure: the next request after recovery shows the data', async () => {
    const overview = await okOverview();
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(json(overview));
    vi.stubGlobal('fetch', fetch);
    expect(checkPageHtml(await render(), { overview: null, demoState: null })).toEqual([]);
    expect(checkPageHtml(await render(), { overview, demoState: null })).toEqual([]);
  });

  it.each([
    ['http', () => json({ error: { code: 'db_unavailable', message: 'down' } }, 503)],
    ['invalid_response: not JSON', () => new Response('<html>', { status: 200 })],
    ['invalid_response: wrong shape', () => json({ asOf: 0 })],
  ])('shows unavailable on %s', async (_name, response) => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response())));
    expect(checkPageHtml(await render(), { overview: null, demoState: null })).toEqual([]);
  });

  it('fails loudly on a configuration error instead of falling back to mock data', async () => {
    vi.stubEnv('API_URL', '');
    vi.stubGlobal('fetch', vi.fn());
    resetCalls();
    await expect(render()).rejects.toThrow(/API_URL/);
    expect(calls.overview).toBe(0);
  });
});

describe('page metadata', () => {
  it('renders without a base or canonical address when SITE_URL is unset', async () => {
    const metadata = await generateMetadata();
    expect(metadata.metadataBase).toBeUndefined();
    expect(metadata.alternates).toBeUndefined();
  });

  it('uses SITE_URL as the base and canonical address when set', async () => {
    vi.stubEnv('SITE_URL', 'https://example.com');
    const metadata = await generateMetadata();
    expect(metadata.metadataBase).toEqual(new URL('https://example.com'));
    // The canonical link resolves against the base address to the page root.
    expect(new URL('/', metadata.metadataBase ?? undefined).href).toBe('https://example.com/');
    expect(metadata.alternates).toEqual({ canonical: '/' });
  });

  it.each([['example.com'], ['not a url'], ['ftp://example.com']])(
    'renders without a base or canonical address on SITE_URL=%s: the page itself fails loudly',
    async (siteUrl) => {
      vi.stubEnv('SITE_URL', siteUrl);
      // The head carries no address from an invalid value; the loud ConfigError comes from the page.
      expect(await generateMetadata()).toEqual({});
      resetCalls();
      await expect(render()).rejects.toThrow(ConfigError);
      await expect(render()).rejects.toThrow(/SITE_URL/);
      expect(calls.overview).toBe(0);
    },
  );
});
