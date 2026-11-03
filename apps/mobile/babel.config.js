import nativeImports from './scripts/native-imports.js';

export default function (api) {
  const jest = api.caller((caller) => caller?.bundler === 'jest');
  return { presets: ['expo/internal/babel-preset'], plugins: [[nativeImports, { jest }]] };
}
