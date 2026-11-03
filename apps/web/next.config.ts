import path from 'node:path';
import type { NextConfig } from 'next';

// The workspace root: @app/contracts is compiled from its TypeScript sources outside apps/web.
const root = path.join(import.meta.dirname, '../..');

const config: NextConfig = {
  transpilePackages: ['@app/contracts', '@app/view'],
  turbopack: { root },
  outputFileTracingRoot: root,
  poweredByHeader: false,
};

export default config;
