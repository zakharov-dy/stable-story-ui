import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertNoR2Leaks } from './leak-check.ts';
import { nextEnv } from './next-server.ts';

afterEach(() => vi.unstubAllEnvs());

describe('The R2 leak gate controls', () => {
  const sentinels = ['https://private-r2.invalid', 'private-bucket', 'access-sentinel', 'secret-sentinel'];
  it.each(sentinels)('fails for a planted private configuration value: %s', (needle) => {
    for (const text of [`<p>${needle}</p>`, `0:{"secret":"${needle}"}\n`, `const value="${needle}";`]) {
      expect(() => assertNoR2Leaks(text, sentinels, 'positive control')).toThrow('private R2 configuration');
    }
  });
  it('detects escaped Flight values and signed object URLs', () => {
    expect(() => assertNoR2Leaks('"secret-\\u0073entinel"', sentinels, 'RSC')).toThrow('private R2 configuration');
    expect(() => assertNoR2Leaks('https:\\/\\/private-r2.invalid', sentinels, 'RSC')).toThrow('private R2 configuration');
    expect(() => assertNoR2Leaks('<a href="https://objects.invalid/doc?X-Amz-Signature=unlisted-secret">', sentinels, 'HTML')).toThrow('private R2 configuration');
    expect(() => assertNoR2Leaks('<p>Published overview</p>', sentinels, 'HTML')).not.toThrow();
  });
  it('strips inherited R2 values for every child unless explicitly supplied', () => {
    for (const name of ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) vi.stubEnv(name, 'real-owner-value');
    const clean = nextEnv({ API_MODE: 'published' });
    for (const name of ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) expect(clean[name]).toBeUndefined();
    expect(nextEnv({ R2_SECRET_ACCESS_KEY: 'test-secret' }).R2_SECRET_ACCESS_KEY).toBe('test-secret');
  });
});
