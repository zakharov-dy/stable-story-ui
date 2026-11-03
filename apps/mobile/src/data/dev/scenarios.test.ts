import { afterEach, expect, it, vi } from 'vitest';
import { parseScenario, scenarios } from './scenarios.ts';
import { redirectSystemPath } from './native-intent.ts';
import { redirectSystemPath as productionRedirect } from '../production/native-intent.ts';

afterEach(() => { vi.unstubAllGlobals(); });
it('recognizes every exact link and Router-relative form', () => {
  vi.stubGlobal('__DEV__', true);
  for (const scenario of scenarios) {
    for (const path of [`stablestory://dev/scenario/${scenario}`, `/dev/scenario/${scenario}`]) {
      expect(parseScenario(path)).toBe(scenario);
      for (const initial of [true, false]) expect(redirectSystemPath({ path, initial })).toMatch(new RegExp(`^/\\?devScenario=${scenario}&devScenarioRevision=\\d+$`));
    }
  }
});
it('gives repeated scenario links distinct revisions to reset the cache again', () => {
  vi.stubGlobal('__DEV__', true);
  const input = { path: 'stablestory://dev/scenario/ok', initial: false };
  expect(redirectSystemPath(input)).not.toBe(redirectSystemPath(input));
});
it('leaves malformed controls, other schemes and hosts unchanged cold and warm', () => {
  vi.stubGlobal('__DEV__', true);
  const paths = ['stablestory://dev/scenario/nope', 'stablestory://other/scenario/ok', 'https://dev/scenario/ok', 'stablestory://dev:123/scenario/ok', 'stablestory://user@dev/scenario/ok', 'stablestory://dev/scenario/ok?x=1', 'stablestory://dev/scenario/ok#x', 'stablestory://dev/scenario/ok/', 'stablestory://dev/scenario/../scenario/ok', '/scenario/ok', '/'];
  for (const path of paths) {
    expect(parseScenario(path)).toBeNull();
    for (const initial of [true, false]) expect(redirectSystemPath({ path, initial })).toBe(path);
  }
});
it('production identity handler preserves all links; dev handler is guarded too', () => {
  vi.stubGlobal('__DEV__', false);
  for (const path of ['stablestory://dev/scenario/ok', 'other://host/path', '/']) {
    for (const initial of [true, false]) {
      expect(productionRedirect({ path, initial })).toBe(path);
      expect(redirectSystemPath({ path, initial })).toBe(path);
    }
  }
});
