// Page configuration from the environment, read per request: API_MODE
// selects the client, API_URL the live API, MOCK_STATE the mock state, R2_* the publication store. Invalid values are a loud
// configuration error, never a silent fallback to mock data.

import type { MockState } from '@app/contracts';

export interface R2Config { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string }
export type WebConfig = { mode: 'mock'; state: MockState } | { mode: 'live'; apiUrl: string } | { mode: 'published'; r2: R2Config };

export class ConfigError extends Error {
  override name = 'ConfigError';
}

// Record<MockState, …> keeps this list exactly in step with the contracts type: a missing or an
// extra state is a type error.
const MOCK_STATES: Record<MockState, true> = {
  ok: true,
  delayed: true,
  unreconciled: true,
  'empty-day': true,
  'short-history': true,
  gap: true,
  empty: true,
  'long-history': true,
  unavailable: true,
};

export const mockStates = Object.keys(MOCK_STATES) as MockState[];

const isMockState = (value: string): value is MockState => Object.hasOwn(MOCK_STATES, value);

// An unset or empty variable takes the default.
const read = (env: Readonly<Record<string, string | undefined>>, name: string): string | undefined => {
  const value = env[name];
  return value === undefined || value === '' ? undefined : value;
};

export function readConfig(env: Readonly<Record<string, string | undefined>>): WebConfig {
  const mode = read(env, 'API_MODE') ?? 'mock';
  if (mode === 'mock') {
    const state = read(env, 'MOCK_STATE') ?? 'ok';
    if (!isMockState(state)) {
      throw new ConfigError(`MOCK_STATE must be one of ${mockStates.join(', ')}; got "${state}"`);
    }
    return { mode, state };
  }
  if (mode === 'live') {
    const apiUrl = read(env, 'API_URL');
    if (apiUrl === undefined) throw new ConfigError('API_URL is required when API_MODE=live');
    let url: URL;
    try {
      url = new URL(apiUrl);
    } catch (cause) {
      throw new ConfigError(`API_URL is not an absolute URL: "${apiUrl}"`, { cause });
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new ConfigError(`API_URL must be http or https: "${apiUrl}"`);
    }
    return { mode, apiUrl };
  }
  if (mode === 'published') {
    const required = (name: string): string => {
      const value = read(env, name);
      if (value === undefined || value.trim() !== value || value.trim() === '') {
        throw new ConfigError(`${name} is required and must have no surrounding whitespace when API_MODE=published`);
      }
      return value;
    };
    const endpoint = required('R2_ENDPOINT');
    let url: URL;
    try { url = new URL(endpoint); } catch { throw new ConfigError('R2_ENDPOINT must be an absolute HTTP(S) origin'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new ConfigError('R2_ENDPOINT must be an HTTP(S) origin without credentials, path, query or fragment');
    }
    const bucket = required('R2_BUCKET');
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw new ConfigError('R2_BUCKET must be a valid R2 bucket name');
    return { mode, r2: { endpoint, bucket, accessKeyId: required('R2_ACCESS_KEY_ID'), secretAccessKey: required('R2_SECRET_ACCESS_KEY') } };
  }
  throw new ConfigError('API_MODE must be mock, live or published');
}

// The public base address of the page: SITE_URL, optional. When set it
// feeds metadataBase and the canonical link; when unset the page renders without them, never with
// a hardcoded domain. An invalid value is a loud configuration error like the other web variables.
export function readSiteUrl(env: Readonly<Record<string, string | undefined>>): URL | null {
  const value = read(env, 'SITE_URL');
  if (value === undefined) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new ConfigError(`SITE_URL is not an absolute URL: "${value}"`, { cause });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigError(`SITE_URL must be http or https: "${value}"`);
  }
  return url;
}
