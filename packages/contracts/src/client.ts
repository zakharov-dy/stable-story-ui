// ApiClient: web and mobile reach the API only through it; the http
// and mock implementations behave the same.

import type { EventsQuery, EventsStatsQuery, OverviewQuery, SeriesQuery } from './query.ts';
import type { EventsPage, EventsStats, Overview, Series } from './schemas.ts';

// Typed parameters; the client serializes them into the query string.
export type OverviewParams = Partial<OverviewQuery>;
export type SeriesParams = Partial<SeriesQuery>;
export type EventsParams = Partial<EventsQuery>;
export type EventsStatsParams = Partial<EventsStatsQuery>;

// Per-call cancellation: the http and mock clients reject with a `transport` error when it aborts.
export interface RequestOptions {
  signal?: AbortSignal;
}

export interface ApiClient {
  overview(params?: OverviewParams, options?: RequestOptions): Promise<Overview>;
  series(params?: SeriesParams, options?: RequestOptions): Promise<Series>;
  events(params?: EventsParams, options?: RequestOptions): Promise<EventsPage>;
  eventsStats(params?: EventsStatsParams, options?: RequestOptions): Promise<EventsStats>;
}

/**
 * `transport` — the request failed, was aborted or timed out, or the response could not be read
 * (also the mock `unavailable`); an abort and a timeout keep the reason in `cause` and differ by `timeout`;
 * `http` — a non-2xx response, `code` from its error body when it parses;
 * `invalid_response` — a 2xx body that is not JSON or does not pass the schema.
 */
export type ApiErrorKind = 'transport' | 'http' | 'invalid_response';

export interface ApiErrorOptions {
  status?: number | null;
  code?: string | null;
  cause?: unknown;
  timeout?: boolean; // transport only: the client's own deadline aborted the call
}

// ApiClient methods reject only with this error.
export class ApiError extends Error {
  override name = 'ApiError';
  kind: ApiErrorKind;
  status: number | null; // the HTTP status, null for transport
  code: string | null; // `error.code` of the error body, http only
  timeout: boolean; // transport only: true when the client timeout fired, false for a caller abort

  constructor(kind: ApiErrorKind, message: string, options: ApiErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.timeout = options.timeout ?? false;
  }
}

/** The transport error of a request cancelled through its `signal`; `cause` is the abort reason. */
export const abortedError = (path: string, reason: unknown): ApiError =>
  new ApiError('transport', `GET ${path} was aborted`, { cause: reason });
