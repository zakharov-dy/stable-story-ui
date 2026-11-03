import { execFileSync } from 'node:child_process';
import { globSync, mkdirSync, readFileSync, rmSync } from 'node:fs';

const output = '.expo/release-check';
rmSync(output, { recursive: true, force: true });
const env = { ...process.env, NODE_ENV: 'production', API_MODE: 'mock', API_URL: 'http://127.0.0.1:3000', EXPO_PUBLIC_STORYBOOK_ENABLED: 'true', EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH: '0', EXPO_UNSTABLE_TREE_SHAKING: '0', EXPO_NO_TELEMETRY: '1', CI: '1' };
// Incoming toggles deliberately disagree; the normal Metro config enforces exclusion.
execFileSync('pnpm', ['exec', 'expo', 'export', '--platform', 'ios', '--source-maps', '--no-bytecode', '--output-dir', '.expo/release-check'], {
  stdio: 'inherit',
  env,
});
// Exercise the same embedding command as the generated Xcode Release build.
mkdirSync(`${output}/embed`, { recursive: true });
execFileSync('pnpm', ['exec', 'expo', 'export:embed', '--entry-file', 'index.ts', '--platform', 'ios', '--dev', 'false', '--bundle-output', `${output}/embed/main.jsbundle`, '--sourcemap-output', `${output}/embed/main.jsbundle.map`, '--assets-dest', `${output}/embed/assets`], { stdio: 'inherit', env });
function sources(map) {
  return [...(map.sources ?? []), ...(map.sections ?? []).flatMap((section) => sources(section.map))];
}
const maps = globSync('.expo/release-check/**/*.map');
if (!maps.length) throw new Error('Release export produced no source maps');
for (const file of maps) {
  const modules = sources(JSON.parse(readFileSync(file, 'utf8')));
  const leaked = modules.filter((name) => /storybook|\.stories\.|src\/data\/dev\/|contracts\/src\/mock(?:\.ts|-)|contracts\/fixtures\/|expo-mcp|agent-device/i.test(name));
  if (!modules.length || leaked.length) throw new Error(`Development modules leaked into release: ${leaked.join(', ')}`);
  console.log(`Release exclusion passed (${file}): ${modules.length} modules, no catalog, mocks or agent tooling`);
}
for (const file of [...globSync(`${output}/**/*.js`), ...globSync(`${output}/**/*.jsbundle`)]) {
  if (/scenario\.selected|Select API scenario|mock_query_unsupported|api\.request/.test(readFileSync(file, 'utf8'))) throw new Error(`Development behavior leaked into ${file}`);
}
