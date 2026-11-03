import type { MetadataRoute } from 'next';

// The whole page is public and indexable: every agent may crawl
// everything. There is no sitemap, so no sitemap line is emitted.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/' } };
}
