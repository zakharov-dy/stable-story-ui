import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createR2Store } from './r2.ts';
import { createPublishedClient } from './published.ts';

vi.mock('server-only', () => ({}));
afterEach(() => vi.unstubAllEnvs());
const config = { endpoint: 'https://r2.invalid', bucket: 'prepared', accessKeyId: 'explicit-access-key', secretAccessKey: 'sentinel-secret' };

describe('GET-only S3 transport with an offline handler', () => {
  it('signs path-style GET with explicit credentials, ignores ambient credentials and reads exact bytes', async () => {
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'ambient-key');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'ambient-secret');
    const handle = vi.fn((request: { method: string; path: string; headers: Record<string, string> }) => {
      expect(request.method).toBe('GET');
      expect(request.path).toBe('/prepared/current.json');
      expect(request.headers.authorization).toContain('Credential=explicit-access-key/');
      expect(request.headers.authorization).not.toContain('ambient');
      return Promise.resolve({ response: { statusCode: 200, headers: { etag: '"fake"' }, body: Readable.from([Buffer.from('exact bytes')]) } });
    });
    const destroy = vi.fn();
    const store = createR2Store(config, { handle, destroy });
    try {
      expect(await store.get('current.json', new AbortController().signal)).toEqual(new TextEncoder().encode('exact bytes'));
      expect(handle).toHaveBeenCalledOnce();
    } finally { store.close?.(); }
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('makes one attempt on a 503 and strips the SDK response and all credentials', async () => {
    const handle = vi.fn(() => Promise.resolve({ response: {
      statusCode: 503, headers: { 'content-type': 'application/xml' },
      body: Readable.from([`<Error><Code>ServiceUnavailable</Code><Message>${config.secretAccessKey}</Message></Error>`]),
    } }));
    const client = createPublishedClient(() => createR2Store(config, { handle }));
    await expect(client.overview()).rejects.toMatchObject({ kind: 'transport', message: 'Publication storage read failed' });
    expect(handle).toHaveBeenCalledOnce();
  });

  it('rejects an object with no ETag rather than accepting unreadable publication bytes', async () => {
    const handle = vi.fn(() => Promise.resolve({ response: { statusCode: 200, headers: {}, body: Readable.from(['{}']) } }));
    const client = createPublishedClient(() => createR2Store(config, { handle }));
    await expect(client.overview()).rejects.toMatchObject({ kind: 'transport', message: 'Publication storage read failed' });
    expect(handle).toHaveBeenCalledOnce();
  });
});
