// The only place that creates an ApiClient and calls the API. `server-only` makes a client-side import
// fail the build, so the clients and the lazily loaded mock catalog stay out of the browser bundle.
import 'server-only';
import { ApiError, createHttpClient, createMockClient } from '@app/contracts';
import type { ApiClient } from '@app/contracts';
import type { PageModel } from '@app/view';
import type { WebConfig } from './config.ts';
import { createPublishedClient } from './published.ts';
import { createR2Store } from './r2.ts';

// The whole overview request, not one SQL statement: a cold computation was measured at about
// 10 s, so the page waits up to 30 s before rendering unavailable.
export const PAGE_REQUEST_TIMEOUT_MS = 30_000;

export function createApiClient(config: WebConfig): ApiClient {
  if (config.mode === 'published') return createPublishedClient(() => createR2Store(config.r2));
  return config.mode === 'mock'
    ? createMockClient(config.state)
    : createHttpClient({ baseUrl: config.apiUrl, timeoutMs: PAGE_REQUEST_TIMEOUT_MS });
}

/**
 * Exactly one `overview()` call per request, nothing cached: any ApiError is `unavailable`, a 200
 * without common coverage (`asOf: null`) is `empty`. Other exceptions are bugs and propagate.
 */
export async function loadPage(client: ApiClient): Promise<PageModel> {
  try {
    const overview = await client.overview();
    return overview.asOf === null ? { state: 'empty', overview } : { state: 'data', overview };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    console.error(`overview unavailable: ${error.kind}${error.status === null ? '' : ` ${error.status}`}: ${error.message}`);
    return { state: 'unavailable', reason: error.kind };
  }
}
