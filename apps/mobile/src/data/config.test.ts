import { afterEach, describe, expect, it, vi } from 'vitest';
import * as contracts from '@app/contracts';
import { resolveConfig } from './config.ts';
import { createLiveClient } from './client.ts';
import { createDevelopmentClient } from './dev/client.ts';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('public config and client choice', () => {
  it('defaults to live with platform-local development addresses', () => {
    expect(resolveConfig(undefined, 'ios', true)).toEqual({ mode: 'live', baseUrl: 'http://127.0.0.1:3000' });
    expect(resolveConfig(undefined, 'android', true).baseUrl).toBe('http://10.0.2.2:3000');
  });
  it('uses explicit public names and refuses invalid configuration', () => {
    expect(resolveConfig({ API_MODE: 'mock', API_URL: 'http://127.0.0.1:4000' }, 'ios', true)).toEqual({ mode: 'mock', baseUrl: 'http://127.0.0.1:4000' });
    for (const extra of [{ API_MODE: 'oops' }, { API_URL: 'file:///tmp/api' }, { API_URL: 'https://user:secret@example.com' }, { API_URL: 'https://example.com?token=secret' }]) {
      expect(() => resolveConfig(extra, 'ios', true)).toThrow();
    }
    expect(() => resolveConfig(undefined, 'ios', false)).toThrow('API_URL');
  });
  it('release forces live with a loud diagnostic and never constructs a mock', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mock = vi.spyOn(contracts, 'createMockClient');
    const http = vi.spyOn(contracts, 'createHttpClient');
    const config = resolveConfig({ API_MODE: 'mock', API_URL: 'http://127.0.0.1:3000' }, 'ios', false);
    createLiveClient(config);
    expect(config.mode).toBe('live');
    expect(warn).toHaveBeenCalledOnce();
    expect(http).toHaveBeenCalledExactlyOnceWith({ baseUrl: config.baseUrl });
    expect(mock).not.toHaveBeenCalled();
  });
  it('development mock starts at ok; live constructs HTTP without calling fetch', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const fetch = vi.fn(() => { throw new Error('Network forbidden in tests'); });
    vi.stubGlobal('fetch', fetch);
    const mock = vi.spyOn(contracts, 'createMockClient');
    const http = vi.spyOn(contracts, 'createHttpClient');
    const config = resolveConfig({ API_MODE: 'mock', MOCK_STATE: 'unavailable' }, 'ios', true);
    expect((await createDevelopmentClient(config).overview()).asOf).toBe('2026-10-09');
    expect(mock).toHaveBeenCalledExactlyOnceWith('ok');
    createDevelopmentClient({ ...config, mode: 'live' });
    expect(http).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
});
