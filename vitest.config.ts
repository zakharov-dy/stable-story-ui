import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          // The default 5 s is too tight for a loaded machine; the shared UI suites include
          // CPU-bound chart and token checks.
          testTimeout: 20_000,
          include: ['{packages,apps}/**/*.test.ts', '*.test.ts'],
          exclude: [...configDefaults.exclude, '**/.claude/**'],
        },
      },
    ],
  },
});
