import type { Metadata } from 'next';
import { connection } from 'next/server';
import { PageView } from '../components/PageView.tsx';
import { createApiClient, loadPage } from '../server/api.ts';
import { readConfig, readSiteUrl } from '../server/config.ts';

// Dynamic SSR per request: no static generation, no ISR, fetch is not cached.
export const dynamic = 'force-dynamic';

// The public base address of the page: SITE_URL feeds metadataBase and
// the canonical link when set and valid; without it the page renders with neither, never with a
// hardcoded domain. An invalid value is a loud ConfigError from the page itself below: a throw in
// generateMetadata is only logged by Next while the page still answers 200.
export async function generateMetadata(): Promise<Metadata> {
  // Opt into request time before reading the environment, so the build never reads it.
  await connection();
  let siteUrl: URL | null;
  try {
    siteUrl = readSiteUrl(process.env);
  } catch {
    siteUrl = null; // the page raises the loud ConfigError for an invalid SITE_URL
  }
  if (siteUrl === null) return {};
  return { metadataBase: siteUrl, alternates: { canonical: '/' } };
}

export default async function Page() {
  // Opt into request time before reading the environment, so the build never reads it.
  await connection();
  const config = readConfig(process.env);
  readSiteUrl(process.env); // loud ConfigError on an invalid SITE_URL, like the other web configuration
  const model = await loadPage(createApiClient(config));
  return <PageView model={model} demoState={config.mode === 'mock' ? config.state : null} />;
}
