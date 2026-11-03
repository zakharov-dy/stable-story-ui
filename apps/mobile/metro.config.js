import { getDefaultConfig } from 'expo/metro-config';
import { withStorybook } from '@storybook/react-native/metro/withStorybook';

process.env.STORYBOOK_DISABLE_TELEMETRY = '1';
// Normal native Release builds and check:release share these exclusions.
process.env.EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH = '1';
process.env.EXPO_UNSTABLE_TREE_SHAKING = '1';
const config = getDefaultConfig(import.meta.dirname);
const enabled = process.env.NODE_ENV !== 'production' && process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true';
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (enabled && moduleName === 'expo-router/entry') {
    return { type: 'sourceFile', filePath: `${import.meta.dirname}/.rnstorybook/entry.ts` };
  }
  const resolved = (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  if (context.dev === false && resolved.type === 'sourceFile') {
    const replacements = {
      [`${import.meta.dirname}/src/data/dev/index.tsx`]: `${import.meta.dirname}/src/data/production/dev-disabled.tsx`,
      [`${import.meta.dirname}/app/+native-intent.tsx`]: `${import.meta.dirname}/src/data/production/native-intent.ts`,
    };
    const filePath = replacements[resolved.filePath];
    if (filePath) return { type: 'sourceFile', filePath };
  }
  return resolved;
};
export default withStorybook(config, {
  enabled,
  configPath: `${import.meta.dirname}/.rnstorybook`,
  docTools: false,
  useJs: true,
  experimental_mcp: false,
});
