import type * as Contracts from '@app/contracts';
import { ApiError, createMockClient } from '@app/contracts';
import type { ApiClient } from '@app/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_REQUEST_TIMEOUT_MS, createApiClient, loadPage } from './api.ts';
import { readConfig, type R2Config } from './config.ts';
import { publication } from '../test-support/publication.ts';

vi.mock('server-only', () => ({}));

// Captures the options `createApiClient` hands to the real http client. The client's default is the
// same 10 000 ms, so only this boundary shows whether the page constant is really used.
const httpOptions = vi.hoisted(() => [] as Contracts.HttpClientOptions[]);
const r2 = vi.hoisted(() => ({ configs: [] as R2Config[], objects: new Map<string, Uint8Array>() }));
vi.mock('./r2.ts', () => ({ createR2Store: (config: R2Config) => {
  r2.configs.push(config);
  return { get: (key: string) => Promise.resolve(r2.objects.get(key) ?? null) };
} }));
vi.mock('@app/contracts', async (importOriginal) => {
  const actual = await importOriginal<typeof Contracts>();
  return {
    ...actual,
    createHttpClient: (options: Contracts.HttpClientOptions) => {
      httpOptions.push(options);
      return actual.createHttpClient(options);
    },
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  httpOptions.length = 0;
  r2.configs.length = 0;
  r2.objects.clear();
});

const failing = (error: Error): ApiClient => {
  const reject = () => Promise.reject(error);
  return { overview: reject, series: reject, events: reject, eventsStats: reject };
};

describe('loadPage', () => {
  it('classifies 200 with coverage as data and 200 with asOf: null as empty', async () => {
    expect((await loadPage(createMockClient('ok'))).state).toBe('data');
    expect((await loadPage(createMockClient('empty'))).state).toBe('empty');
  });

  it.each(['transport', 'http', 'invalid_response'] as const)('turns an ApiError (%s) into unavailable', async (kind) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadPage(failing(new ApiError(kind, 'failed')))).toEqual({ state: 'unavailable', reason: kind });
  });

  it('lets other exceptions through', async () => {
    await expect(loadPage(failing(new TypeError('bug')))).rejects.toThrow(TypeError);
  });
});

describe('createApiClient', () => {
  it('selects published mode and reads changed environment credentials for each request', async () => {
    const fixture = await publication();
    r2.objects = fixture.objects;
    const env = { API_MODE: 'published', R2_ENDPOINT: 'https://r2.invalid', R2_BUCKET: 'prepared', R2_ACCESS_KEY_ID: 'read-key', R2_SECRET_ACCESS_KEY: 'secret-first' };
    expect(await loadPage(createApiClient(readConfig(env)))).toEqual({ state: 'data', overview: fixture.overview });
    env.R2_SECRET_ACCESS_KEY = 'secret-rotated';
    expect(await loadPage(createApiClient(readConfig(env)))).toEqual({ state: 'data', overview: fixture.overview });
    expect(r2.configs.map((config) => config.secretAccessKey)).toEqual(['secret-first', 'secret-rotated']);
    expect(httpOptions).toHaveLength(0);
  });
  it('uses the http client against API_URL in live mode', async () => {
    const overview = await createMockClient('ok').overview();
    const fetch = vi.fn<(url: string) => Promise<Response>>(() => Promise.resolve(new Response(JSON.stringify(overview), { status: 200 })));
    vi.stubGlobal('fetch', fetch);
    const model = await loadPage(createApiClient({ mode: 'live', apiUrl: 'https://api.example.com/' }));
    expect(fetch.mock.calls.map((call) => call[0])).toEqual(['https://api.example.com/v1/supply/overview']);
    expect(model).toEqual({ state: 'data', overview });
  });

  it('gives the live http client the explicit page timeout', () => {
    createApiClient({ mode: 'live', apiUrl: 'https://api.example.com/' });
    expect(httpOptions).toEqual([{ baseUrl: 'https://api.example.com/', timeoutMs: PAGE_REQUEST_TIMEOUT_MS }]);
  });

  it('uses the mock client for the configured state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await loadPage(createApiClient({ mode: 'mock', state: 'unavailable' }))).state).toBe('unavailable');
  });
});

describe('loadPage with a live client and a hanging API', () => {
  const liveClient = (): ApiClient => createApiClient({ mode: 'live', apiUrl: 'https://api.example.com/' });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('turns a fetch that never answers into unavailable after the page timeout', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const page = loadPage(liveClient());
    await vi.advanceTimersByTimeAsync(PAGE_REQUEST_TIMEOUT_MS - 1);
    expect(log).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(page).resolves.toEqual({ state: 'unavailable', reason: 'transport' });
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain('transport');
  });

  it('times out while the body is still being read after the head arrived', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const head = new Response(new ReadableStream({ start() {} }), { status: 200 });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(head)));
    const page = loadPage(liveClient());
    await vi.advanceTimersByTimeAsync(PAGE_REQUEST_TIMEOUT_MS);
    await expect(page).resolves.toEqual({ state: 'unavailable', reason: 'transport' });
    expect(String(log.mock.calls[0]?.[0])).toContain('transport');
  });

  it('reads a fast response as data and leaves no timer pending', async () => {
    const overview = await createMockClient('ok').overview();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(overview), { status: 200 }))));
    await expect(loadPage(liveClient())).resolves.toEqual({ state: 'data', overview });
    expect(vi.getTimerCount()).toBe(0);
  });
});
