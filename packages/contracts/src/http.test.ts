import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from './client.ts';
import { endpoints } from './endpoints.ts';
import { createHttpClient, toQueryString } from './http.ts';

const quality = { complete: true, unreconciledDays: [], operationsComplete: true, unpairedEvents: 0 };
const series = {
  period: 'day',
  buckets: [{ start: '2026-10-06', end: '2026-10-06', complete: true }],
  unit: 'tokens',
  lines: [{ key: 'all', values: ['1000'], unreconciled: [] }],
};
const eventsPage = { from: '2026-09-30', to: '2026-10-06', quality, items: [], nextCursor: null };
const eventsStats = { from: null, to: null, quality: { complete: false, unreconciledDays: [], operationsComplete: false, unpairedEvents: 0 }, byFlow: [], buckets: [] }; // no coverage

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const stubFetch = (respond: () => Response | Promise<Response>) => vi.fn<typeof fetch>(() => Promise.resolve(respond()));

const calledUrl = (fetch: ReturnType<typeof stubFetch>): URL => {
  const input = fetch.mock.calls[0]?.[0];
  if (typeof input !== 'string') throw new TypeError('fetch was not called with a URL string');
  return new URL(input);
};

const rejection = async (promise: Promise<unknown>): Promise<ApiError> => {
  const error: unknown = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
};

describe('endpoints', () => {
  it('map the methods to the /v1 paths and /health', () => {
    expect(Object.fromEntries(Object.entries(endpoints).map(([name, e]) => [name, e.path]))).toEqual({
      overview: '/v1/supply/overview',
      series: '/v1/supply/series',
      events: '/v1/supply/events',
      eventsStats: '/v1/supply/events/stats',
      health: '/health',
    });
  });
});

describe('toQueryString', () => {
  it('joins lists with commas and leaves out undefined', () => {
    const query = toQueryString({ asset: 'usdc', chains: ['ethereum', 'base'], flows: [], limit: 50, cursor: undefined });
    const params = new URLSearchParams(query);
    expect([...params.entries()]).toEqual([
      ['asset', 'usdc'],
      ['chains', 'ethereum,base'],
      ['flows', ''],
      ['limit', '50'],
    ]);
  });

  it('is empty without parameters', () => {
    expect(toQueryString()).toBe('');
    expect(toQueryString({ from: undefined })).toBe('');
  });

  it('encodes values', () => {
    expect(new URLSearchParams(toQueryString({ cursor: 'a+b/c=&d' })).get('cursor')).toBe('a+b/c=&d');
  });
});

describe('createHttpClient', () => {
  it('GETs the endpoint with the serialized query and returns the validated body', async () => {
    const fetch = stubFetch(() => json({ ...series, extra: 'dropped' }));
    const client = createHttpClient({ baseUrl: 'https://api.example.com/', fetch });

    const result = await client.series({ metric: 'issuer_mint', chains: ['ethereum', 'base'], from: undefined });

    expect(result).toStrictEqual(series);
    expect(fetch).toHaveBeenCalledOnce();
    const url = calledUrl(fetch);
    expect(url.origin + url.pathname).toBe('https://api.example.com/v1/supply/series');
    expect(Object.fromEntries(url.searchParams)).toEqual({ metric: 'issuer_mint', chains: 'ethereum,base' });
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
  });

  it('keeps a path prefix of the base URL', async () => {
    const fetch = stubFetch(() => json(eventsStats));
    await createHttpClient({ baseUrl: 'https://example.com/api', fetch }).eventsStats();
    expect(calledUrl(fetch).href).toBe('https://example.com/api/v1/supply/events/stats');
  });

  it.each<[keyof ApiClient, string, unknown]>([
    ['series', '/v1/supply/series', series],
    ['events', '/v1/supply/events', eventsPage],
    ['eventsStats', '/v1/supply/events/stats', eventsStats],
  ])('%s calls %s', async (method, path, body) => {
    const fetch = stubFetch(() => json(body));
    await createHttpClient({ baseUrl: 'http://localhost:3000', fetch })[method]();
    expect(calledUrl(fetch).pathname).toBe(path);
  });

  it('serializes events paging parameters', async () => {
    const fetch = stubFetch(() => json(eventsPage));
    await createHttpClient({ baseUrl: 'http://localhost:3000', fetch }).events({
      flows: ['bridge_in'],
      sort: 'time',
      limit: 50,
      cursor: 'eyJrIjoxfQ',
    });
    expect(Object.fromEntries(calledUrl(fetch).searchParams)).toEqual({
      flows: 'bridge_in',
      sort: 'time',
      limit: '50',
      cursor: 'eyJrIjoxfQ',
    });
  });

  it('turns a non-2xx response with an error body into an http error with its code', async () => {
    const fetch = stubFetch(() => json({ error: { code: 'db_unavailable', message: 'Database is unavailable' } }, 503));
    const error = await rejection(createHttpClient({ baseUrl: 'http://localhost:3000', fetch }).overview());
    expect(error).toMatchObject({ kind: 'http', status: 503, code: 'db_unavailable' });
  });

  it.each([
    ['a body that is not JSON', () => new Response('<html>Bad gateway</html>', { status: 502 })],
    ['a JSON body of another shape', () => json({ message: 'Not found' }, 404)],
    ['an empty body', () => new Response(null, { status: 500 })],
  ])('turns a non-2xx response with %s into an http error without a code', async (_, respond) => {
    const fetch = stubFetch(respond);
    const error = await rejection(createHttpClient({ baseUrl: 'http://localhost:3000', fetch }).overview());
    expect(error.kind).toBe('http');
    expect(error.code).toBeNull();
    expect(error.status).toBeGreaterThanOrEqual(400);
  });

  it('turns a failed fetch into a transport error', async () => {
    const cause = new TypeError('fetch failed');
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.reject(cause));
    const error = await rejection(createHttpClient({ baseUrl: 'http://localhost:3000', fetch }).overview());
    expect(error).toMatchObject({ kind: 'transport', status: null, code: null, cause });
  });

  it('turns a body that fails to arrive into a transport error', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.error(new TypeError('terminated'));
      },
    });
    const fetch = stubFetch(() => new Response(body, { status: 200 }));
    const error = await rejection(createHttpClient({ baseUrl: 'http://localhost:3000', fetch }).overview());
    expect(error.kind).toBe('transport');
  });

  it('turns a 2xx body that is not JSON into invalid_response', async () => {
    const fetch = stubFetch(() => new Response('OK', { status: 200 }));
    const error = await rejection(createHttpClient({ baseUrl: 'http://localhost:3000', fetch }).overview());
    expect(error).toMatchObject({ kind: 'invalid_response', status: 200, code: null });
  });

  it('turns a 2xx body that fails the schema into invalid_response', async () => {
    const fetch = stubFetch(() => json({ ...series, lines: [{ key: 'all', values: [1000], unreconciled: [] }] }));
    const error = await rejection(createHttpClient({ baseUrl: 'http://localhost:3000', fetch }).series());
    expect(error).toMatchObject({ kind: 'invalid_response', status: 200 });
    expect(error.cause).toBeDefined();
  });

  it('uses the global fetch by default, resolved per call and without a receiver', async () => {
    const receivers: unknown[] = [];
    const fetch = vi.fn(function (this: unknown) {
      receivers.push(this);
      return Promise.resolve(json(eventsStats));
    });
    vi.stubGlobal('fetch', fetch);
    try {
      const client = createHttpClient({ baseUrl: 'http://localhost:3000' });
      await client.eventsStats();
      expect(fetch).toHaveBeenCalledOnce();
      expect(receivers).toEqual([undefined]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('createHttpClient deadline and cancellation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const neverResolvingFetch = () => vi.fn<typeof globalThis.fetch>(() => new Promise<Response>(() => undefined));

  const hangingResponse = (): Response =>
    ({ status: 200, ok: true, text: () => new Promise<string>(() => undefined) }) as unknown as Response;

  it('rejects a call that never resolves after the default 10 000 ms timeout', async () => {
    vi.useFakeTimers();
    const fetch = neverResolvingFetch();
    const promise = createHttpClient({ baseUrl: 'http://localhost:3000', fetch }).overview();
    const settled = vi.fn();
    void promise.then(settled, settled);

    await vi.advanceTimersByTimeAsync(9_999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    const error = await rejection(promise);
    expect(error).toMatchObject({ kind: 'transport', status: null, code: null, timeout: true });
    expect(error.message).toBe('GET /v1/supply/overview timed out after 10000 ms');
    expect(error.cause).toMatchObject({ name: 'TimeoutError', message: 'Request timed out after 10000 ms' });
    const signal = fetch.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBe(error.cause);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('applies a custom timeout to the reading of the body', async () => {
    vi.useFakeTimers();
    const fetch = stubFetch(hangingResponse);
    const promise = createHttpClient({ baseUrl: 'http://localhost:3000', fetch, timeoutMs: 25 }).series();
    const outcome = rejection(promise);

    await vi.advanceTimersByTimeAsync(25);

    const error = await outcome;
    expect(error).toMatchObject({ kind: 'transport', timeout: true });
    expect(error.message).toBe('GET /v1/supply/series timed out after 25 ms');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects before calling fetch when the signal is already aborted', async () => {
    const reason = new Error('left the screen');
    const controller = new AbortController();
    controller.abort(reason);
    const fetch = neverResolvingFetch();
    const client = createHttpClient({ baseUrl: 'http://localhost:3000', fetch });

    const error = await rejection(client.overview(undefined, { signal: controller.signal }));

    expect(error).toMatchObject({ kind: 'transport', status: null, code: null, timeout: false, cause: reason });
    expect(error.message).toBe('GET /v1/supply/overview was aborted');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects with the abort reason when the signal aborts during the request', async () => {
    const reason = new Error('left the screen');
    const controller = new AbortController();
    const fetch = vi.fn<typeof globalThis.fetch>(
      () => new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('late')), 0)),
    );
    const client = createHttpClient({ baseUrl: 'http://localhost:3000', fetch });

    const promise = client.overview(undefined, { signal: controller.signal });
    controller.abort(reason);
    const error = await rejection(promise);

    expect(error).toMatchObject({ kind: 'transport', timeout: false, cause: reason });
    expect(error.message).toBe('GET /v1/supply/overview was aborted');
    const signal = fetch.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBe(reason);
    // The abandoned fetch rejects after the abort; the race keeps that rejection handled.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('rejects when the signal aborts during the reading of the body', async () => {
    const reason = new Error('left the screen');
    const controller = new AbortController();
    let rejectBody: (error: Error) => void = () => undefined;
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve({
        status: 200,
        ok: true,
        text: () =>
          new Promise<string>((_, reject) => {
            rejectBody = reject;
          }),
      } as unknown as Response),
    );
    const client = createHttpClient({ baseUrl: 'http://localhost:3000', fetch });

    const promise = client.overview(undefined, { signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0)); // the response arrived, the body is being read
    controller.abort(reason);
    const error = await rejection(promise);

    expect(error).toMatchObject({ kind: 'transport', timeout: false, cause: reason });
    const signal = fetch.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBe(reason);
    // The abandoned body rejection is handled by the race.
    rejectBody(new Error('late'));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('keeps a caller abort that happens before the deadline even after the timer elapses', async () => {
    vi.useFakeTimers();
    const reason = new Error('left the screen');
    const controller = new AbortController();
    const client = createHttpClient({ baseUrl: 'http://localhost:3000', fetch: neverResolvingFetch() });

    const promise = client.overview(undefined, { signal: controller.signal });
    const outcome = rejection(promise);
    controller.abort(reason);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await outcome;

    expect(error).toMatchObject({ kind: 'transport', timeout: false, cause: reason });
  });

  it('keeps the timeout when the signal aborts after the deadline', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const client = createHttpClient({ baseUrl: 'http://localhost:3000', fetch: neverResolvingFetch() });

    const promise = client.overview(undefined, { signal: controller.signal });
    const outcome = rejection(promise);
    await vi.advanceTimersByTimeAsync(10_000);
    controller.abort(new Error('left the screen'));
    const error = await outcome;

    expect(error).toMatchObject({ kind: 'transport', timeout: true });
  });

  it('leaves no timer and removes the abort listener after a normal call', async () => {
    vi.useFakeTimers();
    const fetch = stubFetch(() => json(series));
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');

    await expect(
      createHttpClient({ baseUrl: 'http://localhost:3000', fetch }).series(undefined, { signal: controller.signal }),
    ).resolves.toStrictEqual(series);

    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('rejects when fetch aborts the signal before returning an already-fulfilled response', async () => {
    const reason = new Error('left the screen');
    const controller = new AbortController();
    const fetch = vi.fn<typeof globalThis.fetch>(() => {
      controller.abort(reason);
      return Promise.resolve(json(eventsStats));
    });

    const error = await rejection(
      createHttpClient({ baseUrl: 'http://localhost:3000', fetch }).eventsStats(undefined, {
        signal: controller.signal,
      }),
    );

    expect(error).toMatchObject({ kind: 'transport', timeout: false, cause: reason });
  });

  it('rejects when text() aborts the signal before returning an already-fulfilled body', async () => {
    const reason = new Error('left the screen');
    const controller = new AbortController();
    const body = JSON.stringify(eventsStats);
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve({
        status: 200,
        ok: true,
        text: () => {
          controller.abort(reason);
          return Promise.resolve(body);
        },
      } as unknown as Response),
    );

    const error = await rejection(
      createHttpClient({ baseUrl: 'http://localhost:3000', fetch }).eventsStats(undefined, {
        signal: controller.signal,
      }),
    );

    expect(error).toMatchObject({ kind: 'transport', timeout: false, cause: reason });
  });

  it.each([
    ['a non-finite', Number.POSITIVE_INFINITY],
    ['a non-numeric', Number.NaN],
    ['a negative', -1],
    ['an above-maximum', 2_147_483_648],
  ])('rejects %s timeout at construction', (_, timeoutMs) => {
    expect(() => createHttpClient({ baseUrl: 'http://localhost:3000', timeoutMs })).toThrow(TypeError);
  });

  it('accepts the portable timer maximum', () => {
    expect(() => createHttpClient({ baseUrl: 'http://localhost:3000', timeoutMs: 2_147_483_647 })).not.toThrow();
  });
});
