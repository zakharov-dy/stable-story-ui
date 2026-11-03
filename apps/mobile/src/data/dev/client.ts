import { createMockClient } from '@app/contracts';
import type { ApiClient } from '@app/contracts';
import { createLiveClient } from '../client.ts';
import type { DataConfig } from '../config.ts';
import type { Scenario } from './scenarios.ts';
import { log, logFailure } from './logger.ts';

export function createDevelopmentClient(config: DataConfig, scenario: Scenario = config.mode === 'mock' ? 'ok' : 'live'): ApiClient {
  const client = scenario === 'live' ? createLiveClient(config) : createMockClient(scenario);
  return { ...client, async overview(params, options) {
    const start = Date.now();
    try {
      const data = await client.overview(params, options);
      log('api.request', { ms: Date.now() - start, status: 200 });
      return data;
    } catch (error) {
      logFailure(error, Date.now() - start);
      throw error;
    }
  } };
}
