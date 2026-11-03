import { describe, expect, it } from 'vitest';
import { ConfigError, mockStates, readConfig, readSiteUrl } from './config.ts';

describe('readConfig', () => {
  it('defaults to the ok mock state', () => {
    expect(readConfig({})).toEqual({ mode: 'mock', state: 'ok' });
    expect(readConfig({ API_MODE: '', MOCK_STATE: '' })).toEqual({ mode: 'mock', state: 'ok' });
  });

  it.each(mockStates)('accepts MOCK_STATE=%s', (state) => {
    expect(readConfig({ API_MODE: 'mock', MOCK_STATE: state })).toEqual({ mode: 'mock', state });
  });

  it('reads the live API URL', () => {
    expect(readConfig({ API_MODE: 'live', API_URL: 'https://api.example.com/prefix' })).toEqual({
      mode: 'live',
      apiUrl: 'https://api.example.com/prefix',
    });
  });

  it.each([
    [{ API_MODE: 'prod' }, /API_MODE/],
    [{ API_MODE: 'Mock' }, /API_MODE/],
    [{ MOCK_STATE: 'broken' }, /MOCK_STATE/],
    [{ MOCK_STATE: 'OK' }, /MOCK_STATE/],
    [{ MOCK_STATE: 'toString' }, /MOCK_STATE/],
    [{ API_MODE: 'live' }, /API_URL/],
    [{ API_MODE: 'live', API_URL: '' }, /API_URL/],
    [{ API_MODE: 'live', API_URL: 'api.example.com' }, /API_URL/],
    [{ API_MODE: 'live', API_URL: 'ftp://api.example.com' }, /API_URL/],
  ])('rejects %j', (env, message) => {
    expect(() => readConfig(env)).toThrow(ConfigError);
    expect(() => readConfig(env)).toThrow(message);
  });
});

describe('readSiteUrl', () => {
  it('is unset without SITE_URL', () => {
    expect(readSiteUrl({})).toBeNull();
    expect(readSiteUrl({ SITE_URL: '' })).toBeNull();
  });

  it.each([['https://example.com'], ['https://example.com/'], ['http://127.0.0.1:3000/base']])(
    'reads the base address %s',
    (siteUrl) => {
      expect(readSiteUrl({ SITE_URL: siteUrl })).toEqual(new URL(siteUrl));
    },
  );

  it.each([[{ SITE_URL: 'example.com' }], [{ SITE_URL: 'not a url' }], [{ SITE_URL: 'ftp://example.com' }]])(
    'rejects %j',
    (env) => {
      expect(() => readSiteUrl(env)).toThrow(ConfigError);
      expect(() => readSiteUrl(env)).toThrow(/SITE_URL/);
    },
  );
});

describe('published configuration', () => {
  const env = { API_MODE: 'published', R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com', R2_BUCKET: 'prepared', R2_ACCESS_KEY_ID: 'sentinel-key', R2_SECRET_ACCESS_KEY: 'sentinel-secret' };
  it('selects published mode with explicit request-time values', () => {
    expect(readConfig(env)).toEqual({ mode: 'published', r2: { endpoint: env.R2_ENDPOINT, bucket: env.R2_BUCKET, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } });
    expect(readConfig({ ...env, R2_SECRET_ACCESS_KEY: 'rotated-secret' })).toMatchObject({ r2: { secretAccessKey: 'rotated-secret' } });
  });
  it.each(['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'])('rejects missing/blank %s without fallback or secret diagnostics', (name) => {
    for (const value of [undefined, '', ' ', ' padded ']) {
      const read = () => readConfig({ ...env, [name]: value });
      expect(read).toThrow(ConfigError);
      expect(read).toThrow(name);
      try { read(); } catch (error) {
        expect(String(error)).not.toContain(env.R2_ACCESS_KEY_ID);
        expect(String(error)).not.toContain(env.R2_SECRET_ACCESS_KEY);
        expect(error).not.toHaveProperty('cause');
      }
    }
  });
  it.each(['invalid', 'ftp://account', 'https://sentinel-key:sentinel-secret@account', 'https://account/prefix', 'https://account/?secret=sentinel-secret', 'https://account/#sentinel-secret'])('rejects unsafe endpoint %s safely', (endpoint) => {
    expect(() => readConfig({ ...env, R2_ENDPOINT: endpoint })).toThrow(ConfigError);
    try { readConfig({ ...env, R2_ENDPOINT: endpoint }); } catch (error) {
      expect(String(error)).not.toContain('sentinel-');
      expect(error).not.toHaveProperty('cause');
    }
  });
  it.each(['UPPER', 'a', '../escape', 'bucket/path'])('rejects invalid bucket %s', (bucket) => {
    expect(() => readConfig({ ...env, R2_BUCKET: bucket })).toThrow('R2_BUCKET');
  });
});
