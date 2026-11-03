import js from '@eslint/js';
import { builtinModules, createRequire } from 'node:module';
import { URL } from 'node:url';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import { boundariesPlugin } from './eslint.boundaries.js';

// The Expo preset belongs to mobile; resolve its declared dependency there.
const requireMobile = createRequire(new URL('./apps/mobile/package.json', import.meta.url));
// Expo's React/import plugins still use rule-context APIs removed in ESLint 10.
// Adapt those APIs without disabling their rules or changing the UI ESLint version.
const { fixupPluginRules } = requireMobile('@eslint/compat');
/** @type {import('eslint').Linter.Config[]} */
const rawExpoConfig = requireMobile('eslint-config-expo/flat');
const expoConfig = rawExpoConfig.map((config) => ({
  ...config,
  // Keep typescript-eslint's shared plugin identity; it already supports ESLint 10.
  ...(config.plugins && {
    plugins: Object.fromEntries(Object.entries(config.plugins).map(([name, plugin]) => [
      name, name === '@typescript-eslint' ? tseslint.plugin : fixupPluginRules(plugin),
    ])),
  }),
}));

export default defineConfig([
  globalIgnores([
    '**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**', 'docs/**',
    'apps/mobile/.expo/**', 'apps/mobile/expo-env.d.ts', 'apps/mobile/ios/**', 'apps/mobile/android/**',
  ]),
  { files: ['apps/mobile/**/*.{js,ts,tsx}'], extends: [expoConfig] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },

  // View is pure: contracts' source types need DOM declarations, view itself uses ES APIs only.
  {
    files: ['packages/view/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: builtinModules.map((name) => ({ name, message: 'View uses ES APIs only.' })),
        patterns: [
          'node:*', 'react', 'react/*', 'react-dom', 'react-dom/*',
          'react-native', 'react-native/*', 'react-native-web', 'react-native-web/*',
        ],
      }],
      'no-restricted-globals': ['error', {
        globals: [
          'window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage',
          'fetch', 'Request', 'Response', 'Headers', 'AbortController', 'AbortSignal',
          'URL', 'URLSearchParams', 'XMLHttpRequest', 'WebSocket', 'Event', 'EventTarget',
          'Element', 'HTMLElement', 'Node', 'DOMParser', 'File', 'FileReader', 'Blob', 'FormData',
          'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
          'requestAnimationFrame', 'cancelAnimationFrame', 'console', 'process', 'Buffer',
          '__dirname', '__filename', 'require', 'module', 'exports',
        ],
        checkGlobalObject: true,
      }],
    },
  },

  // Module boundaries; the table of modules is in eslint.boundaries.js.
  {
    plugins: { boundaries: boundariesPlugin },
    rules: { 'boundaries/module-boundaries': 'error' },
  },
]);
