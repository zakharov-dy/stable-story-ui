export interface DataConfig {
  mode: 'mock' | 'live';
  baseUrl: string;
}

export function resolveConfig(extra: Record<string, unknown> | undefined, platform: string, development: boolean): DataConfig {
  const mode = extra?.API_MODE ?? 'live';
  if (mode !== 'mock' && mode !== 'live') throw new Error('API_MODE must be mock or live');
  if (!development && mode === 'mock') console.warn('Release ignores API_MODE=mock; using live API_URL.');
  const baseUrl = extra?.API_URL ?? (development ? (platform === 'android' ? 'http://10.0.2.2:3000' : 'http://127.0.0.1:3000') : undefined);
  if (typeof baseUrl !== 'string' || !/^https?:\/\//.test(baseUrl)) throw new Error('API_URL must be an explicit HTTP(S) URL in release');
  const url = new URL(baseUrl);
  if (url.username || url.password || url.search || url.hash) throw new Error('API_URL must not contain credentials, query or fragment');
  return { mode: development ? mode : 'live', baseUrl };
}
