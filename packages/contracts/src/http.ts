// HTTP implementation of ApiClient.

import type { z } from 'zod';
import { ApiError, abortedError, type ApiClient, type RequestOptions } from './client.ts';
import { endpoints } from './endpoints.ts';
import { ApiErrorBody } from './schemas.ts';

/** One deadline per call, the body read included. `0` disables it. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * The largest portable timer delay: browsers clamp `setTimeout` to a signed 32-bit millisecond
 * count and Node warns and fires in about 1 ms above it. A longer deadline is refused instead of
 * silently turning into an almost immediate timeout.
 */
const MAX_TIMEOUT_MS = 2_147_483_647;

export interface HttpClientOptions {
  baseUrl: string; // e.g. https://api.example.com; a path prefix is kept
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number; // default DEFAULT_TIMEOUT_MS; 0 disables; at most MAX_TIMEOUT_MS
}

type Params = Record<string, string | number | readonly string[] | undefined>;

/** Lists are joined with `,`; undefined values are left out. */
export const toQueryString = (params: Params = {}): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, typeof value === 'object' ? value.join(',') : String(value));
  }
  const query = search.toString();
  return query === '' ? '' : `?${query}`;
};

const parseJson = (text: string): { ok: true; value: unknown } | { ok: false; error: unknown } => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error };
  }
};

interface Deadline {
  signal: AbortSignal;
  abortPromise: Promise<never>;
  timedOut(): boolean;
  reason(): unknown;
  dispose(): void;
}

/**
 * The per-call deadline: the caller's signal and the client timeout feed one AbortController, so a
 * fetch that ignores the signal is still cut off by the race with `abortPromise`. Whichever fires
 * first wins; `AbortSignal.any` and `AbortSignal.timeout` are not used for portability.
 */
function createDeadline(timeoutMs: number, caller?: AbortSignal): Deadline {
  const controller = new AbortController();
  let timedOut = false;
  let reason: unknown;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onCallerAbort = (): void => {
    if (controller.signal.aborted) return;
    reason = caller?.reason;
    controller.abort(reason);
  };
  caller?.addEventListener('abort', onCallerAbort, { once: true });

  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      if (controller.signal.aborted) return;
      timedOut = true;
      const error = new Error(`Request timed out after ${timeoutMs} ms`);
      error.name = 'TimeoutError';
      reason = error;
      controller.abort(error);
    }, timeoutMs);
  }

  const abortPromise = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  // A call that finishes first leaves the deadline pending; a late rejection must stay handled.
  void abortPromise.catch(() => {});

  return {
    signal: controller.signal,
    abortPromise,
    timedOut: () => timedOut,
    reason: () => reason,
    dispose() {
      clearTimeout(timer);
      caller?.removeEventListener('abort', onCallerAbort);
    },
  };
}

export function createHttpClient(options: HttpClientOptions): ApiClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new TypeError(`timeoutMs must be a finite number between 0 and ${MAX_TIMEOUT_MS}`);
  }

  const get = async <T>(
    endpoint: { path: string; response: z.ZodType<T> },
    params?: Params,
    requestOptions: RequestOptions = {},
  ): Promise<T> => {
    const callerSignal = requestOptions.signal;
    if (callerSignal?.aborted) {
      throw abortedError(endpoint.path, callerSignal.reason);
    }
    const url = `${baseUrl}${endpoint.path}${toQueryString(params)}`;
    // Resolved per call and called without a receiver: a browser fetch throws on a foreign `this`.
    const fetch = options.fetch ?? globalThis.fetch;
    const deadline = createDeadline(timeoutMs, callerSignal);

    // A custom fetch or `text()` may abort the caller's signal synchronously and still return an
    // already-fulfilled promise, which wins the race; the boundary checks keep cancellation final.
    const cancellation = (): ApiError | null => {
      if (!deadline.signal.aborted) return null;
      if (deadline.timedOut()) {
        return new ApiError('transport', `GET ${endpoint.path} timed out after ${timeoutMs} ms`, {
          timeout: true,
          cause: deadline.reason(),
        });
      }
      return abortedError(endpoint.path, deadline.reason());
    };

    let status: number;
    let ok: boolean;
    let text: string;
    try {
      const response = await Promise.race([
        fetch(url, { method: 'GET', headers: { accept: 'application/json' }, signal: deadline.signal }),
        deadline.abortPromise,
      ]);
      const cancelledAfterFetch = cancellation();
      if (cancelledAfterFetch) throw cancelledAfterFetch;
      ({ status, ok } = response);
      text = await Promise.race([response.text(), deadline.abortPromise]);
      const cancelledAfterBody = cancellation();
      if (cancelledAfterBody) throw cancelledAfterBody;
    } catch (cause) {
      const cancelled = cancellation();
      if (cancelled) throw cancelled;
      throw new ApiError('transport', `GET ${endpoint.path} failed`, { cause });
    } finally {
      deadline.dispose();
    }

    const json = parseJson(text);
    if (!ok) {
      const body = json.ok ? ApiErrorBody.safeParse(json.value) : null;
      const code = body?.success ? body.data.error.code : null;
      throw new ApiError('http', `GET ${endpoint.path} returned ${status}${code ? ` (${code})` : ''}`, {
        status,
        code,
      });
    }
    if (!json.ok) {
      throw new ApiError('invalid_response', `GET ${endpoint.path} returned a body that is not JSON`, {
        status,
        cause: json.error,
      });
    }
    const parsed = endpoint.response.safeParse(json.value);
    if (!parsed.success) {
      throw new ApiError('invalid_response', `GET ${endpoint.path} returned a body that does not match the schema`, {
        status,
        cause: parsed.error,
      });
    }
    return parsed.data;
  };

  return {
    overview: (params, requestOptions) => get(endpoints.overview, params, requestOptions),
    series: (params, requestOptions) => get(endpoints.series, params, requestOptions),
    events: (params, requestOptions) => get(endpoints.events, params, requestOptions),
    eventsStats: (params, requestOptions) => get(endpoints.eventsStats, params, requestOptions),
  };
}
