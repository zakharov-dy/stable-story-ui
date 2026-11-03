// Fixture-backed ApiClient. The generated index is loaded when a method first needs it, and each response
// file only when its query is served. JSON is loaded with import attributes (Node 22, Vitest, Next;
// React Native needs a Metro/Babel setup that parses them, Babel 7.26 or newer). No node:fs.
import type { z } from 'zod';
import { ApiError, abortedError } from './client.ts';
import type { ApiClient, RequestOptions } from './client.ts';
import { createEventsCursorFingerprint, CursorError, decodeEventsCursor } from './cursor.ts';
import { endpoints } from './endpoints.ts';
import { toQueryString } from './http.ts';
import type { MockIndex } from './mock-data.ts';
import { FLOWS } from './primitives.ts';
import type { Flow } from './primitives.ts';

export type MockState = 'ok' | 'delayed' | 'unreconciled' | 'empty-day' | 'short-history' | 'gap' | 'empty' | 'long-history' | 'unavailable';
const STATES: readonly MockState[] = ['ok', 'delayed', 'unreconciled', 'empty-day', 'short-history', 'gap', 'empty', 'long-history', 'unavailable'];
let catalogPromise: Promise<MockIndex> | undefined;

function loadCatalog(): Promise<MockIndex> {
  catalogPromise ??= import('./mock-index.generated.ts')
    .then((module) => module.index)
    .catch((cause: unknown) => {
      catalogPromise = undefined;
      throw cause;
    });
  return catalogPromise;
}

function badRequest(message: string, code = 'invalid_query'): ApiError {
  return new ApiError('http', message, { status: 400, code });
}

type Params = Record<string, string | number | readonly string[] | undefined>;

export function createMockClient(state: MockState): ApiClient {
  if (!STATES.includes(state)) {
    throw new TypeError(`Unknown mock state: ${String(state)}`);
  }

  async function get<T>(
    method: keyof ApiClient,
    schema: z.ZodType<T>,
    params: Params = {},
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    const { signal } = requestOptions;
    const assertNotAborted = (): void => {
      if (signal?.aborted) throw abortedError(endpoints[method].path, signal.reason);
    };
    assertNotAborted();
    if (state === 'unavailable') {
      throw new ApiError('transport', 'API unavailable (mock)');
    }
    let catalog: MockIndex;
    try {
      catalog = await loadCatalog();
    } catch (cause) {
      throw new ApiError('transport', 'Mock catalog could not be loaded', { cause });
    }
    assertNotAborted();
    const config = catalog.states[state];
    if (!config) {
      throw new ApiError('invalid_response', 'Missing mock state');
    }
    let wire: Record<string, string>;
    try {
      wire = Object.fromEntries(new URLSearchParams(toQueryString(params)));
    } catch (cause) {
      throw new ApiError('http', 'Invalid mock request', { status: 400, code: 'invalid_query', cause });
    }
    const parsed = endpoints[method].query.safeParse(wire);
    if (!parsed.success) {
      throw badRequest('Invalid mock query');
    }
    const query: { asset: string; chains?: string[]; flows?: Flow[] } = parsed.data;
    if (!config.assets.includes(query.asset)) {
      throw new ApiError('http', 'Unknown asset', { status: 404, code: 'unknown_asset' });
    }
    if (query.chains !== undefined) {
      if (query.chains.some((chain) => !config.chains.includes(chain))) {
        throw badRequest('Unknown or disabled chain', 'unknown_chain');
      }
      query.chains = (query.chains.length === 0 ? config.chains : query.chains).slice().sort();
    }
    if (query.flows !== undefined) {
      const requested = query.flows;
      query.flows = FLOWS.filter((flow) => requested.length === 0 || requested.includes(flow));
    }
    if (method === 'events') {
      const events = endpoints.events.query.parse(wire);
      if (events.cursor !== undefined) {
        try {
          const fingerprint = createEventsCursorFingerprint({
            ...events,
            chains: events.chains.length === 0 ? config.chains : events.chains,
            flows: FLOWS.filter((flow) => events.flows.length === 0 || events.flows.includes(flow)),
          });
          decodeEventsCursor(events.cursor, fingerprint, events.sort);
        } catch (error) {
          if (error instanceof CursorError) {
            throw badRequest(error.message, error.code);
          }
          throw error;
        }
      }
    }
    const key = `${state}:${JSON.stringify([method, query])}`;
    const load = catalog.entries[key];
    if (load === undefined) {
      throw badRequest('Query is outside the documented mock catalog', 'mock_query_unsupported');
    }
    let value: unknown;
    try {
      value = (await load()).default;
    } catch (cause) {
      throw new ApiError('transport', 'Mock response could not be loaded', { cause });
    }
    assertNotAborted();
    const response = schema.safeParse(value);
    if (!response.success) {
      throw new ApiError('invalid_response', 'Mock response does not match the schema', { status: 200, cause: response.error });
    }
    // Zod parsing creates fresh arrays/objects, so callers cannot mutate the loaded (cached) JSON module.
    return response.data;
  }

  return {
    overview: (params, requestOptions) => get('overview', endpoints.overview.response, params, requestOptions),
    series: (params, requestOptions) => get('series', endpoints.series.response, params, requestOptions),
    events: (params, requestOptions) => get('events', endpoints.events.response, params, requestOptions),
    eventsStats: (params, requestOptions) =>
      get('eventsStats', endpoints.eventsStats.response, params, requestOptions),
  };
}
