import { expect, it } from 'vitest';
import { ApiError, createMockClient } from '@app/contracts';
import { screenState } from './state.ts';

it('maps all contract failures to unavailable even with cached data', async () => {
  const data = await createMockClient('ok').overview();
  for (const kind of ['transport', 'http', 'invalid_response'] as const) {
    expect(screenState(new ApiError(kind, 'failure'), undefined)).toBe('unavailable');
    expect(screenState(new ApiError(kind, 'failure'), data)).toBe('unavailable');
  }
  expect(screenState(null, undefined)).toBe('loading');
  expect(screenState(null, data)).toBe('data');
  expect(screenState(null, await createMockClient('empty').overview())).toBe('empty');
  expect(screenState(null, await createMockClient('empty-day').overview())).toBe('data');
});
