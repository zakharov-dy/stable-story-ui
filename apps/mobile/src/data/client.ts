import { createHttpClient } from '@app/contracts';
import type { ApiClient } from '@app/contracts';
import type { DataConfig } from './config.ts';

// Production never imports or constructs a mock client; contracts retains its 10s timeout.
export function createLiveClient(config: DataConfig): ApiClient {
  return createHttpClient({ baseUrl: config.baseUrl });
}
