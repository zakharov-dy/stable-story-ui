import { describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from './client.ts';
import { createHttpClient } from './http.ts';
import { createMockClient } from './mock.ts';

const rejection = async (promise: Promise<unknown>): Promise<ApiError> => {
  const error: unknown = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
};

describe('createMockClient', () => {
  const methods: (keyof ApiClient)[] = ['overview', 'series', 'events', 'eventsStats'];

  it.each(methods)('unavailable: %s rejects with a transport error', async (method) => {
    const client = createMockClient('unavailable');
    let promise: Promise<unknown> | undefined;
    expect(() => {
      promise = client[method]();
    }).not.toThrow();
    const error = await rejection(promise ?? Promise.resolve());
    expect(error).toMatchObject({ name: 'ApiError', kind: 'transport', status: null, code: null });
  });

  it('rejects an unknown state', () => {
    // @ts-expect-error Unknown runtime states are rejected at the factory boundary.
    expect(() => createMockClient('unknown')).toThrow(TypeError);
  });

  it('rejects an already-aborted signal like the http client', async () => {
    const reason = new Error('left the screen');
    const controller = new AbortController();
    controller.abort(reason);
    const fetch = vi.fn<typeof globalThis.fetch>();
    const http = createHttpClient({ baseUrl: 'http://localhost:3000', fetch });
    const mock = createMockClient('ok');

    for (const method of methods) {
      const [mockError, httpError] = await Promise.all([
        rejection(mock[method](undefined, { signal: controller.signal })),
        rejection(http[method](undefined, { signal: controller.signal })),
      ]);
      expect(mockError).toMatchObject({ kind: 'transport', status: null, code: null, timeout: false, cause: reason });
      expect(mockError.message).toBe(httpError.message);
      expect(mockError.timeout).toBe(httpError.timeout);
      expect(mockError.cause).toBe(reason);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('prefers the abort over the unavailable state', async () => {
    const reason = new Error('left the screen');
    const controller = new AbortController();
    controller.abort(reason);

    const error = await rejection(createMockClient('unavailable').overview(undefined, { signal: controller.signal }));

    expect(error).toMatchObject({ kind: 'transport', timeout: false, cause: reason });
    expect(error.message).toBe('GET /v1/supply/overview was aborted');
  });
});
