import type { MockState } from '@app/contracts';

export const scenarios = ['ok', 'delayed', 'unreconciled', 'empty-day', 'short-history', 'gap', 'empty', 'long-history', 'unavailable', 'live'] as const satisfies readonly (MockState | 'live')[];
export type Scenario = typeof scenarios[number];

export function isScenario(value: unknown): value is Scenario {
  return scenarios.some((scenario) => scenario === value);
}

export function parseScenario(path: string): Scenario | null {
  // Raw matching prevents URL normalization turning malformed paths into valid controls.
  // Absolute URL: scheme stablestory:, host dev, path /scenario/<name>.
  const match = /^(?:stablestory:\/\/dev|\/dev)\/scenario\/([a-z-]+)$/.exec(path);
  return match && isScenario(match[1]) ? match[1] : null;
}
