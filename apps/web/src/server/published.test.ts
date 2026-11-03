import { ApiError } from '@app/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPage } from './api.ts';
import { createPublishedClient, PUBLICATION_TIMEOUT_MS } from './published.ts';
import { jsonBytes, publication, sha256, VERSION_B } from '../test-support/publication.ts';

vi.mock('server-only', () => ({}));
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

async function setup(state: 'ok' | 'empty' | 'delayed' = 'ok') {
  const fixture = await publication(state);
  const get = vi.fn((key: string, signal: AbortSignal) => {
    expect(signal).toBeInstanceOf(AbortSignal);
    return Promise.resolve(fixture.objects.get(key) ?? null);
  });
  const close = vi.fn();
  const client = createPublishedClient(() => ({ get, close }));
  return { ...fixture, get, close, client };
}

describe('verified published overview', () => {
  it.each(['ok', 'delayed', 'empty'] as const)('renders %s using three verified reads and one pointer read', async (state) => {
    const f = await setup(state);
    expect(await loadPage(f.client)).toEqual({ state: state === 'empty' ? 'empty' : 'data', overview: f.overview });
    expect(f.get.mock.calls.map(([key]) => key)).toEqual(['current.json', f.manifestKey, f.documentKey]);
    expect(f.close).toHaveBeenCalledOnce();
  });

  it('keeps an old but valid publication readable without applying a freshness deadline', async () => {
    const f = await setup();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2040-01-01'));
    expect(await loadPage(f.client)).toEqual({ state: 'data', overview: f.overview });
  });

  it('pins a render across a switch and picks up the new pointer on the next render', async () => {
    const a = await setup();
    const b = await publication('delayed', VERSION_B);
    for (const [key, bytes] of b.objects) if (key !== 'current.json') a.objects.set(key, bytes);
    a.get.mockImplementation((key) => {
      const bytes = a.objects.get(key) ?? null;
      if (key === 'current.json') a.objects.set(key, jsonBytes(b.current));
      return Promise.resolve(bytes);
    });
    expect(await loadPage(a.client)).toEqual({ state: 'data', overview: a.overview });
    expect(await loadPage(a.client)).toEqual({ state: 'data', overview: b.overview });
    expect(a.get.mock.calls.map(([key]) => key)).toEqual(['current.json', a.manifestKey, a.documentKey, 'current.json', b.manifestKey, b.documentKey]);
  });

  it('accepts the explicit default asset and rejects other assets without any reads', async () => {
    const f = await setup();
    await expect(f.client.overview({ asset: 'eth' })).rejects.toMatchObject({ kind: 'http', status: 404, code: 'not_published', message: 'Request is not published' });
    expect(f.get).not.toHaveBeenCalled();
    await expect(f.client.overview({ asset: 'usdc' })).resolves.toEqual(f.overview);
  });

  it.each(['series', 'events', 'eventsStats'] as const)('%s rejects as not published with no fallback', async (method) => {
    const f = await setup();
    await expect(f.client[method]()).rejects.toMatchObject({ name: 'ApiError', kind: 'http', status: 404, code: 'not_published', message: 'Request is not published' });
    expect(f.get).not.toHaveBeenCalled();
  });
});

describe('invalid publications', () => {
  const cases: [string, (f: Awaited<ReturnType<typeof setup>>) => void, string][] = [
    ['missing pointer', (f) => { f.objects.delete('current.json'); }, 'pointer is missing'],
    ['missing manifest', (f) => { f.objects.delete(f.manifestKey); }, 'manifest is missing'],
    ['missing document', (f) => { f.objects.delete(f.documentKey); }, 'overview is missing'],
    ['pointer JSON', (f) => { f.objects.set('current.json', new TextEncoder().encode('{')); }, 'pointer is not JSON'],
    ['pointer schema', (f) => { f.objects.set('current.json', jsonBytes({})); }, 'pointer schema is invalid'],
    ['manifest hash', (f) => { f.objects.set(f.manifestKey, jsonBytes({})); }, 'manifest hash mismatch'],
    ['manifest JSON', (f) => {
      const bytes = new TextEncoder().encode('{'); f.objects.set(f.manifestKey, bytes);
      f.current.manifestSha256 = sha256(bytes); f.objects.set('current.json', jsonBytes(f.current));
    }, 'manifest is not JSON'],
    ['manifest schema', (f) => { f.manifest.documents[0].key = 'outside.json'; f.updateManifest(); }, 'manifest schema is invalid'],
    ['manifest version', (f) => {
      f.manifest.version = VERSION_B; f.manifest.documents[0].key = `versions/${VERSION_B}/supply/usdc/overview.json`; f.updateManifest();
    }, 'manifest version mismatch'],
    ['document hash', (f) => {
      const bytes = f.objects.get(f.documentKey)!.slice(); bytes[0] = 32; f.objects.set(f.documentKey, bytes);
    }, 'overview hash mismatch'],
    ['document length', (f) => { f.manifest.documents[0].byteLength += 1; f.updateManifest(); }, 'overview byte length mismatch'],
    ['overview JSON', (f) => {
      const bytes = new TextEncoder().encode('{'); f.objects.set(f.documentKey, bytes);
      f.manifest.documents[0].byteLength = bytes.length; f.manifest.documents[0].sha256 = sha256(bytes); f.updateManifest();
    }, 'overview is not JSON'],
    ['overview schema', (f) => { f.updateDocument({ ...f.overview, asOf: 'broken' }); }, 'overview schema is invalid'],
    ['overview metadata', (f) => { f.manifest.documents[0].asOf = null; f.updateManifest(); }, 'overview metadata mismatch'],
  ];
  it.each(cases)('%s becomes the specific invalid_response and unavailable', async (_name, mutate, reason) => {
    const f = await setup(); mutate(f);
    await expect(f.client.overview()).rejects.toMatchObject({ name: 'ApiError', kind: 'invalid_response', message: `Publication ${reason}` });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadPage(f.client)).toEqual({ state: 'unavailable', reason: 'invalid_response' });
    expect(log).toHaveBeenCalledWith(`overview unavailable: invalid_response: Publication ${reason}`);
  });
});

describe('read failures, cancellation and secrets', () => {
  const secret = 'secret-sentinel-never-log';
  it('sanitizes errors constructing or closing a transport', async () => {
    const failing = createPublishedClient(() => { throw new ApiError('http', secret, { cause: secret }); });
    await expect(failing.overview()).rejects.toMatchObject({ kind: 'transport', message: 'Publication storage read failed' });
    const f = await setup();
    f.close.mockImplementation(() => { throw new Error(secret); });
    await expect(f.client.overview()).resolves.toEqual(f.overview);
  });
  it.each(['R2 503', 'socket timeout', 'body unreadable'])('%s is sanitized to transport and unavailable', async (message) => {
    const f = await setup();
    f.get.mockRejectedValue(new Error(`${message}: https://${secret}/?X-Amz-Signature=${secret}`));
    const failure: unknown = await f.client.overview().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ kind: 'transport', message: 'Publication storage read failed' });
    expect(failure).not.toHaveProperty('cause');
    expect(JSON.stringify(failure)).not.toContain(secret);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadPage(f.client)).toEqual({ state: 'unavailable', reason: 'transport' });
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });

  it.each([0, 2])('bounds a stalled GET/body after %i completed reads by the whole-call deadline', async (completed) => {
    const f = await setup();
    vi.useFakeTimers();
    f.get.mockImplementation((key) => f.get.mock.calls.length <= completed ? Promise.resolve(f.objects.get(key) ?? null) : new Promise(() => {}));
    const pending = f.client.overview();
    const check = expect(pending).rejects.toMatchObject({ kind: 'transport', timeout: true, message: 'Publication read timed out' });
    await vi.advanceTimersByTimeAsync(PUBLICATION_TIMEOUT_MS);
    await check;
    expect(f.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([true, false])('handles caller abort (already aborted: %s) without retaining the reason', async (already) => {
    const f = await setup();
    const controller = new AbortController();
    f.get.mockImplementation(() => new Promise(() => {}));
    if (already) controller.abort(new Error(secret));
    const pending = f.client.overview({}, { signal: controller.signal });
    if (!already) controller.abort(new Error(secret));
    await expect(pending).rejects.toMatchObject({ kind: 'transport', timeout: false, message: 'Publication read aborted' });
    if (already) expect(f.get).not.toHaveBeenCalled();
    else expect(f.get.mock.calls[0]?.[1].aborted).toBe(true);
  });

  it('shares one deadline across successive slow objects instead of resetting it', async () => {
    const f = await setup();
    vi.useFakeTimers();
    f.get.mockImplementation((key) => new Promise((resolve) => {
      setTimeout(() => resolve(f.objects.get(key) ?? null), 2_500);
    }));
    const pending = expect(f.client.overview()).rejects.toMatchObject({ kind: 'transport', timeout: true, message: 'Publication read timed out' });
    await vi.advanceTimersByTimeAsync(PUBLICATION_TIMEOUT_MS);
    await pending;
    expect(f.get).toHaveBeenCalledTimes(3);
    expect(f.get.mock.calls[2]?.[1].aborted).toBe(true);
    await vi.runAllTimersAsync(); // let the fake finish; no late unhandled rejection
  });
});
