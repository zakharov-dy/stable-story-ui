import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '@app/contracts';
import { log, logFailure } from './logger.ts';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('prints exactly one JSON line with only allowed fields per request', () => {
  vi.stubGlobal('__DEV__', true);
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  const fields = { ms: 120, status: 200, url: 'https://secret.invalid', cause: 'private', response: { data: 'private' }, extra: 'private' };
  log('api.request', fields);
  expect(info).toHaveBeenCalledExactlyOnceWith('{"evt":"api.request","path":"/v1/supply/overview","ms":120,"status":200}');
  info.mockClear();
  logFailure(new ApiError('http', 'private message', { status: 503, code: 'db_unavailable', cause: 'private cause' }), 5);
  expect(info).toHaveBeenCalledExactlyOnceWith('{"evt":"api.request","path":"/v1/supply/overview","ms":5,"status":503,"kind":"http","code":"db_unavailable"}');
  info.mockClear();
  logFailure(new ApiError('http', 'private', { status: 400, code: 'person@example.com' }), 1);
  expect(info.mock.calls).toEqual([['{"evt":"api.request","path":"/v1/supply/overview","ms":1,"status":400,"kind":"http","code":"unknown"}']]);
});
it('is silent outside development', () => {
  vi.stubGlobal('__DEV__', false);
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  log('api.request', { ms: 1, status: 200 });
  expect(info).not.toHaveBeenCalled();
});
