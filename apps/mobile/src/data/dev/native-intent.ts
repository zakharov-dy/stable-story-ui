import { parseScenario } from './scenarios.ts';

let revision = 0;

// Router passes the original Linking URL in both cold and warm cases.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (!__DEV__) return path;
  const scenario = parseScenario(path);
  return scenario ? `/?devScenario=${scenario}&devScenarioRevision=${++revision}` : path;
}
